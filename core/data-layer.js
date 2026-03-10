// Data and auth layer extracted from app.js.
// Keeps runtime behavior the same while reducing app.js size/responsibility.

const PROFILE_CORE_DOC_KEY='profile_core';
const SCHEDULE_DOC_KEY='schedule';
const PROGRAM_DOC_PREFIX='program:';
const LOCAL_CACHE_KEYS={
  workouts:'ic_workouts',
  schedule:'ic_schedule',
  profile:'ic_profile'
};
let profileDocumentsSupported=null;
let syncRealtimeChannel=null;
let realtimeSyncTimer=null;
let isApplyingRemoteSync=false;
let lastCloudSyncErrorToastAt=0;

function getLocalCacheUserId(explicitUserId){
  const raw=explicitUserId||currentUser?.id||'';
  return String(raw||'').trim();
}

function getLocalCacheKey(baseKey,userId){
  const scopedUserId=getLocalCacheUserId(userId);
  return scopedUserId?baseKey+'::'+scopedUserId:baseKey;
}

function readLocalCacheJson(key,label){
  try{
    const raw=localStorage.getItem(key);
    return raw?JSON.parse(raw):undefined;
  }catch(e){
    logWarn('Failed to load '+label+' from localStorage',e);
    return undefined;
  }
}

function writeLocalCacheJson(key,value,label){
  try{localStorage.setItem(key,JSON.stringify(value));}
  catch(e){logWarn('Failed to persist '+label+' locally',e);}
}

function removeLocalCacheKeys(keys){
  try{(keys||[]).forEach(key=>localStorage.removeItem(key));}
  catch(e){logWarn('Failed to clear local cache keys',e);}
}

function clearLegacyLocalCache(){
  removeLocalCacheKeys(Object.values(LOCAL_CACHE_KEYS));
}

function clearScopedLocalCache(userId){
  const scopedUserId=getLocalCacheUserId(userId);
  if(!scopedUserId)return;
  removeLocalCacheKeys(Object.values(LOCAL_CACHE_KEYS).map(key=>getLocalCacheKey(key,scopedUserId)));
}

function clearLocalDataCache(options){
  const opts=options||{};
  if(opts.includeScoped!==false)clearScopedLocalCache(opts.userId);
  if(opts.includeLegacy!==false)clearLegacyLocalCache();
}

function resetRuntimeState(){
  workouts=[];
  schedule={sportName:getDefaultSportName(),sportDays:[],sportIntensity:'hard',sportLegsHeavy:true};
  profile={
    defaultRest:120,
    language:(window.I18N&&I18N.getLanguage?I18N.getLanguage():'en'),
    preferences:getDefaultTrainingPreferences(),
    coaching:getDefaultCoachingProfile()
  };
}

function notifyCloudSyncError(options){
  const opts=options||{};
  if(opts.notifyUser===false||typeof showToast!=='function')return;
  const now=Date.now();
  if(now-lastCloudSyncErrorToastAt<4000)return;
  lastCloudSyncErrorToastAt=now;
  showToast(i18nText('toast.sync_issue','Cloud sync failed. Changes stay on this device for now.'),'var(--orange)');
}

function getSupabaseError(result){
  return result&&typeof result==='object'&&'error' in result?result.error:null;
}

async function runSupabaseWrite(operationPromise,context,options){
  const opts=options||{};
  try{
    const result=await operationPromise;
    const error=getSupabaseError(result);
    if(error){
      logWarn(context,error);
      notifyCloudSyncError(opts);
      return{ok:false,error,data:result?.data};
    }
    return{ok:true,error:null,data:result?.data};
  }catch(error){
    logWarn(context,error);
    notifyCloudSyncError(opts);
    return{ok:false,error,data:null};
  }
}

function loadLocalData(options){
  const opts=options||{};
  const userId=getLocalCacheUserId(opts.userId);
  if(!userId)return false;

  const scopedWorkouts=readLocalCacheJson(getLocalCacheKey(LOCAL_CACHE_KEYS.workouts,userId),'workouts');
  const scopedSchedule=readLocalCacheJson(getLocalCacheKey(LOCAL_CACHE_KEYS.schedule,userId),'schedule');
  const scopedProfile=readLocalCacheJson(getLocalCacheKey(LOCAL_CACHE_KEYS.profile,userId),'profile');
  const hasScoped=scopedWorkouts!==undefined||scopedSchedule!==undefined||scopedProfile!==undefined;

  if(hasScoped){
    if(scopedWorkouts!==undefined)workouts=scopedWorkouts;
    if(scopedSchedule!==undefined)schedule=scopedSchedule;
    if(scopedProfile!==undefined)profile=scopedProfile;
    return true;
  }

  if(opts.allowLegacyFallback===false)return false;

  const legacyWorkouts=readLocalCacheJson(LOCAL_CACHE_KEYS.workouts,'workouts');
  const legacySchedule=readLocalCacheJson(LOCAL_CACHE_KEYS.schedule,'schedule');
  const legacyProfile=readLocalCacheJson(LOCAL_CACHE_KEYS.profile,'profile');
  const hasLegacy=legacyWorkouts!==undefined||legacySchedule!==undefined||legacyProfile!==undefined;
  if(!hasLegacy)return false;

  if(legacyWorkouts!==undefined)workouts=legacyWorkouts;
  if(legacySchedule!==undefined)schedule=legacySchedule;
  if(legacyProfile!==undefined)profile=legacyProfile;
  persistLocalWorkoutsCache();
  persistLocalScheduleCache();
  persistLocalProfileCache();
  clearLegacyLocalCache();
  return true;
}

function workoutClientId(workout){
  if(!workout||workout.id===undefined||workout.id===null)return'';
  return String(workout.id);
}

function mergeWorkoutLists(primary,fallback,deletedIds){
  const removed=deletedIds||new Set();
  const seen=new Set();
  const merged=[];

  function add(items){
    (items||[]).forEach(workout=>{
      const id=workoutClientId(workout);
      if(!id||removed.has(id)||seen.has(id))return;
      seen.add(id);
      merged.push(workout);
    });
  }

  add(primary);
  add(fallback);
  merged.sort((a,b)=>new Date(a.date)-new Date(b.date));
  return merged;
}

function cloneJson(value){
  if(value===undefined)return undefined;
  return JSON.parse(JSON.stringify(value));
}

function arrayifyProfileValue(value){
  if(Array.isArray(value))return value;
  if(value===undefined||value===null||value==='')return [];
  return [value];
}

function uniqueDocKeys(keys){
  return [...new Set((keys||[]).filter(Boolean))];
}

function programDocKey(programId){
  const canonicalId=typeof getCanonicalProgramId==='function'?getCanonicalProgramId(programId):String(programId||'');
  return PROGRAM_DOC_PREFIX+String(canonicalId||'');
}

function programIdFromDocKey(docKey){
  const key=String(docKey||'');
  const programId=key.startsWith(PROGRAM_DOC_PREFIX)?key.slice(PROGRAM_DOC_PREFIX.length):'';
  return typeof getCanonicalProgramId==='function'?getCanonicalProgramId(programId):programId;
}

function isProgramDocKey(docKey){
  return !!programIdFromDocKey(docKey);
}

function getProfilePrograms(profileLike){
  return profileLike&&typeof profileLike.programs==='object'&&profileLike.programs?profileLike.programs:{};
}

function listProgramIds(profileLike){
  return Object.keys(getProfilePrograms(profileLike)).sort();
}

function filterCoreSyncMeta(syncMetaLike){
  if(!syncMetaLike||typeof syncMetaLike!=='object')return undefined;
  const next={...syncMetaLike};
  delete next.profileUpdatedAt;
  delete next.scheduleUpdatedAt;
  delete next.programUpdatedAt;
  return Object.keys(next).length?next:undefined;
}

function getProfileCorePayload(profileLike){
  const next=cloneJson(profileLike||{})||{};
  delete next.programs;
  if(next.syncMeta){
    const filteredSyncMeta=filterCoreSyncMeta(next.syncMeta);
    if(filteredSyncMeta)next.syncMeta=filteredSyncMeta;
    else delete next.syncMeta;
  }
  return next;
}

function getDocumentPayload(docKey,profileLike,scheduleLike){
  if(docKey===PROFILE_CORE_DOC_KEY)return getProfileCorePayload(profileLike);
  if(docKey===SCHEDULE_DOC_KEY)return cloneJson(scheduleLike||{})||{};
  const programId=programIdFromDocKey(docKey);
  if(programId){
    const state=getProfilePrograms(profileLike)[programId];
    return state===undefined?undefined:(cloneJson(state)||{});
  }
  return undefined;
}

function getAllProfileDocumentKeys(profileLike){
  return uniqueDocKeys([PROFILE_CORE_DOC_KEY,SCHEDULE_DOC_KEY,...listProgramIds(profileLike).map(programDocKey)]);
}

function getDefaultTrainingPreferences(){
  return{
    goal:'strength',
    trainingDaysPerWeek:3,
    sessionMinutes:60,
    equipmentAccess:'full_gym',
    sportReadinessCheckEnabled:false,
    warmupSetsEnabled:false,
    notes:''
  };
}

function normalizeTrainingPreferences(profileLike){
  if(!profileLike||typeof profileLike!=='object')return getDefaultTrainingPreferences();
  const defaults=getDefaultTrainingPreferences();
  const next={...defaults,...(profileLike.preferences||{})};
  const allowedGoals=new Set(['strength','hypertrophy','general_fitness','sport_support']);
  const allowedEquipment=new Set(['full_gym','basic_gym','home_gym','minimal']);
  const allowedTrainingDays=new Set([2,3,4,5,6]);
  const allowedMinutes=new Set([30,45,60,75,90]);
  if(!allowedGoals.has(next.goal))next.goal=defaults.goal;
  if(!allowedEquipment.has(next.equipmentAccess))next.equipmentAccess=defaults.equipmentAccess;
  const trainingDays=parseInt(next.trainingDaysPerWeek,10);
  next.trainingDaysPerWeek=allowedTrainingDays.has(trainingDays)?trainingDays:defaults.trainingDaysPerWeek;
  const minutes=parseInt(next.sessionMinutes,10);
  next.sessionMinutes=allowedMinutes.has(minutes)?minutes:defaults.sessionMinutes;
  next.sportReadinessCheckEnabled=next.sportReadinessCheckEnabled===true;
  next.warmupSetsEnabled=next.warmupSetsEnabled===true;
  next.notes=String(next.notes||'').trim().slice(0,500);
  profileLike.preferences=next;
  return next;
}

function getDefaultCoachingProfile(){
  return{
    experienceLevel:'returning',
    guidanceMode:'balanced',
    sportProfile:{
      name:'',
      inSeason:false,
      sessionsPerWeek:0
    },
    limitations:{
      jointFlags:[],
      avoidMovementTags:[],
      avoidExerciseIds:[]
    },
    exercisePreferences:{
      preferredExerciseIds:[],
      excludedExerciseIds:[]
    },
    behaviorSignals:{
      avoidedExerciseIds:[],
      skippedAccessoryExerciseIds:[],
      preferredSwapExerciseIds:[]
    },
    onboardingCompleted:false
  };
}

function normalizeCoachingProfile(profileLike){
  if(!profileLike||typeof profileLike!=='object')return getDefaultCoachingProfile();
  const defaults=getDefaultCoachingProfile();
  const incoming=profileLike.coaching&&typeof profileLike.coaching==='object'?profileLike.coaching:{};
  const next={
    ...defaults,
    ...incoming,
    sportProfile:{
      ...defaults.sportProfile,
      ...(incoming.sportProfile||{})
    },
    limitations:{
      ...defaults.limitations,
      ...(incoming.limitations||{})
    },
    exercisePreferences:{
      ...defaults.exercisePreferences,
      ...(incoming.exercisePreferences||{})
    },
    behaviorSignals:{
      ...defaults.behaviorSignals,
      ...(incoming.behaviorSignals||{})
    }
  };
  const allowedExperience=new Set(['beginner','returning','intermediate','advanced']);
  const allowedGuidance=new Set(['guided','balanced','self_directed']);
  if(!allowedExperience.has(next.experienceLevel))next.experienceLevel=defaults.experienceLevel;
  if(!allowedGuidance.has(next.guidanceMode))next.guidanceMode=defaults.guidanceMode;
  next.sportProfile.name=String(next.sportProfile.name||'').trim().slice(0,60);
  next.sportProfile.inSeason=next.sportProfile.inSeason===true;
  const sportSessions=parseInt(next.sportProfile.sessionsPerWeek,10);
  next.sportProfile.sessionsPerWeek=Number.isFinite(sportSessions)?Math.max(0,Math.min(7,sportSessions)):0;
  next.limitations.jointFlags=[...new Set(arrayifyProfileValue(next.limitations.jointFlags).map(value=>String(value||'').trim()).filter(Boolean))];
  next.limitations.avoidMovementTags=[...new Set(arrayifyProfileValue(next.limitations.avoidMovementTags).map(value=>String(value||'').trim()).filter(Boolean))];
  next.limitations.avoidExerciseIds=[...new Set(arrayifyProfileValue(next.limitations.avoidExerciseIds).map(value=>String(value||'').trim()).filter(Boolean))];
  next.exercisePreferences.preferredExerciseIds=[...new Set(arrayifyProfileValue(next.exercisePreferences.preferredExerciseIds).map(value=>String(value||'').trim()).filter(Boolean))];
  next.exercisePreferences.excludedExerciseIds=[...new Set(arrayifyProfileValue(next.exercisePreferences.excludedExerciseIds).map(value=>String(value||'').trim()).filter(Boolean))];
  next.behaviorSignals.avoidedExerciseIds=[...new Set(arrayifyProfileValue(next.behaviorSignals.avoidedExerciseIds).map(value=>String(value||'').trim()).filter(Boolean))];
  next.behaviorSignals.skippedAccessoryExerciseIds=[...new Set(arrayifyProfileValue(next.behaviorSignals.skippedAccessoryExerciseIds).map(value=>String(value||'').trim()).filter(Boolean))];
  next.behaviorSignals.preferredSwapExerciseIds=[...new Set(arrayifyProfileValue(next.behaviorSignals.preferredSwapExerciseIds).map(value=>String(value||'').trim()).filter(Boolean))];
  next.onboardingCompleted=next.onboardingCompleted===true;
  profileLike.coaching=next;
  return next;
}

function getTrainingGoalLabel(goal){
  const map={
    strength:['settings.preferences.goal.strength','Strength'],
    hypertrophy:['settings.preferences.goal.hypertrophy','Hypertrophy'],
    general_fitness:['settings.preferences.goal.general_fitness','General Fitness'],
    sport_support:['settings.preferences.goal.sport_support','Sport Support']
  };
  const [key,fallback]=map[goal]||map.strength;
  return window.I18N&&I18N.t?I18N.t(key,null,fallback):fallback;
}

function getEquipmentAccessLabel(value){
  const map={
    full_gym:['settings.preferences.equipment.full_gym','Full Gym'],
    basic_gym:['settings.preferences.equipment.basic_gym','Basic Gym'],
    home_gym:['settings.preferences.equipment.home_gym','Home Gym'],
    minimal:['settings.preferences.equipment.minimal','Minimal Equipment']
  };
  const [key,fallback]=map[value]||map.full_gym;
  return window.I18N&&I18N.t?I18N.t(key,null,fallback):fallback;
}

function getTrainingPreferencesSummary(profileLike){
  const prefs=normalizeTrainingPreferences(profileLike||profile||{});
  const goal=getTrainingGoalLabel(prefs.goal);
  const days=getTrainingDaysPerWeekLabel(prefs.trainingDaysPerWeek);
  const minutes=window.I18N&&I18N.t?I18N.t('settings.preferences.duration_value',{minutes:prefs.sessionMinutes},'{minutes} min'):prefs.sessionMinutes+' min';
  const equipment=getEquipmentAccessLabel(prefs.equipmentAccess);
  const fallback='Goal: '+goal+' · '+days+' · '+minutes+' · '+equipment;
  return window.I18N&&I18N.t
    ? I18N.t('dashboard.preferences_context',{goal,days,minutes,equipment},fallback)
    : fallback;
}

function getTrainingDaysPerWeekLabel(value){
  const count=parseInt(value,10)||3;
  return window.I18N&&I18N.t
    ? I18N.t('settings.preferences.training_days_value',{count},'{count} sessions / week')
    : count+' sessions / week';
}

function getPreferredTrainingDaysPerWeek(profileLike){
  return normalizeTrainingPreferences(profileLike||profile||{}).trainingDaysPerWeek;
}

const PROGRAM_CAPABILITIES={
  forge:{
    id:'forge',
    aliases:[],
    frequencyRange:{min:2,max:6},
    recommendationScore(days,prefs){
      let score=prefs.goal==='strength'?6:2;
      score+=days>=4?2:1;
      return score;
    }
  },
  hypertrophysplit:{
    id:'hypertrophysplit',
    aliases:[],
    frequencyRange:{min:2,max:6},
    recommendationScore(days,prefs){
      let score=prefs.goal==='hypertrophy'?7:2;
      score+=days>=4?3:1;
      return score;
    }
  },
  wendler531:{
    id:'wendler531',
    aliases:['w531'],
    frequencyRange:{min:2,max:4},
    recommendationScore(days,prefs){
      let score=prefs.goal==='strength'?7:1;
      score+=days<=4?2:-4;
      return score;
    }
  },
  casualfullbody:{
    id:'casualfullbody',
    aliases:[],
    frequencyRange:{min:2,max:3},
    recommendationScore(days,prefs){
      let score=prefs.goal==='general_fitness'?7:0;
      score+=prefs.goal==='sport_support'?4:0;
      score+=days<=3?3:-6;
      return score;
    }
  },
  stronglifts5x5:{
    id:'stronglifts5x5',
    aliases:[],
    frequencyRange:{min:3,max:3},
    recommendationScore(days,prefs){
      let score=prefs.goal==='strength'?5:1;
      score+=days===3?3:-8;
      return score;
    }
  }
};

function getCanonicalProgramId(programId){
  const raw=String(programId||'').trim();
  if(!raw)return raw;
  const direct=PROGRAM_CAPABILITIES[raw];
  if(direct)return direct.id;
  const match=Object.values(PROGRAM_CAPABILITIES).find(cap=>(cap.aliases||[]).includes(raw));
  return match?match.id:raw;
}

function getProgramCapabilities(programId){
  const canonicalId=getCanonicalProgramId(programId);
  return PROGRAM_CAPABILITIES[canonicalId]||{
    id:canonicalId||String(programId||'').trim(),
    aliases:[],
    frequencyRange:{min:2,max:6},
    recommendationScore(){return 0;}
  };
}

function getProgramTrainingDaysRange(programId){
  const range=getProgramCapabilities(programId).frequencyRange||{min:2,max:6};
  return {min:range.min,max:range.max};
}

function getEffectiveProgramFrequency(programId,profileLike){
  const preferred=getPreferredTrainingDaysPerWeek(profileLike);
  const {min,max}=getProgramTrainingDaysRange(programId);
  return Math.max(min,Math.min(max,preferred));
}

function getProgramTrainingDaysPerWeek(programId,profileLike){
  return getEffectiveProgramFrequency(programId,profileLike);
}

function normalizeProfileProgramStateMap(profileLike){
  if(!profileLike||typeof profileLike!=='object')return profileLike;
  if(!profileLike.programs||typeof profileLike.programs!=='object')return profileLike;
  const normalized={};
  Object.entries(profileLike.programs).forEach(([programId,state])=>{
    const canonicalId=getCanonicalProgramId(programId);
    const isCanonicalKey=canonicalId===programId;
    if(normalized[canonicalId]===undefined){
      normalized[canonicalId]=state;
      return;
    }
    if(normalized[canonicalId]&&typeof normalized[canonicalId]==='object'&&state&&typeof state==='object'){
      normalized[canonicalId]=isCanonicalKey
        ? {...normalized[canonicalId],...state}
        : {...state,...normalized[canonicalId]};
      return;
    }
    if(isCanonicalKey)normalized[canonicalId]=state;
  });
  profileLike.programs=normalized;
  return profileLike;
}

function normalizeWorkoutRecord(workout){
  if(!workout||typeof workout!=='object')return workout;
  let changed=false;
  if(!workout.program&&workout.type&&workout.type!=='hockey'&&workout.type!=='sport'){
    workout.program=workout.type;
    changed=true;
  }
  if((workout.forgeWeek!==undefined&&workout.forgeWeek!==null)||workout.programMeta){
    const beforeMeta=JSON.stringify(workout.programMeta||{});
    const meta={...(workout.programMeta||{})};
    if(meta.week===undefined&&workout.forgeWeek!==undefined&&workout.forgeWeek!==null){
      meta.week=workout.forgeWeek;
    }
    workout.programMeta=meta;
    if(JSON.stringify(meta)!==beforeMeta)changed=true;
  }
  if((workout.programDayNum===undefined||workout.programDayNum===null)&&workout.forgeDayNum!==undefined&&workout.forgeDayNum!==null){
    workout.programDayNum=workout.forgeDayNum;
    changed=true;
  }
  const canonicalProgramId=getCanonicalProgramId(workout.program);
  if(canonicalProgramId&&canonicalProgramId!==workout.program){
    workout.program=canonicalProgramId;
    changed=true;
  }
  if(workout.type&&workout.type!=='hockey'&&workout.type!=='sport'){
    const canonicalTypeId=getCanonicalProgramId(workout.type);
    if(canonicalTypeId&&canonicalTypeId!==workout.type){
      workout.type=canonicalTypeId;
      changed=true;
    }
  }
  if('forgeWeek' in workout){delete workout.forgeWeek;changed=true;}
  if('forgeDayNum' in workout){delete workout.forgeDayNum;changed=true;}
  return changed?workout:workout;
}

function normalizeWorkoutRecords(items){
  let changed=false;
  const normalized=(items||[]).map(workout=>{
    const before=JSON.stringify(workout);
    const next=normalizeWorkoutRecord(workout);
    if(JSON.stringify(next)!==before)changed=true;
    return next;
  });
  return{items:normalized,changed};
}

function isWorkoutTableReady(profileLike){
  return !!(profileLike&&profileLike.syncMeta&&profileLike.syncMeta.workoutsTableReady);
}

function cleanupLegacyProfileFields(profileLike){
  if(!profileLike||typeof profileLike!=='object')return profileLike;
  const legacyKeys=[
    'atsLifts','atsWeek','atsRounding','atsDaysPerWeek','atsDayNum','atsBackExercise','atsBackWeight','atsMode','atsWeekStartDate',
    'forgeLifts','forgeWeek','forgeRounding','forgeDaysPerWeek','forgeDayNum','forgeBackExercise','forgeBackWeight','forgeMode','forgeWeekStartDate'
  ];
  legacyKeys.forEach(key=>{if(key in profileLike)delete profileLike[key];});
  return profileLike;
}

function persistLocalWorkoutsCache(){
  const userId=getLocalCacheUserId();
  if(!userId)return;
  writeLocalCacheJson(getLocalCacheKey(LOCAL_CACHE_KEYS.workouts,userId),workouts,'workouts');
}

function persistLocalScheduleCache(){
  const userId=getLocalCacheUserId();
  if(!userId)return;
  writeLocalCacheJson(getLocalCacheKey(LOCAL_CACHE_KEYS.schedule,userId),schedule,'schedule');
}

function persistLocalProfileCache(){
  const userId=getLocalCacheUserId();
  if(!userId)return;
  writeLocalCacheJson(getLocalCacheKey(LOCAL_CACHE_KEYS.profile,userId),profile,'profile');
}

function ensureProfileSyncMeta(){
  if(!profile||typeof profile!=='object')profile={};
  if(!profile.syncMeta||typeof profile.syncMeta!=='object')profile.syncMeta={};
  return profile.syncMeta;
}

function ensureProgramSyncMeta(profileLike){
  const target=profileLike&&typeof profileLike==='object'?profileLike:profile;
  if(!target||typeof target!=='object')return{};
  if(!target.syncMeta||typeof target.syncMeta!=='object')target.syncMeta={};
  if(!target.syncMeta.programUpdatedAt||typeof target.syncMeta.programUpdatedAt!=='object')target.syncMeta.programUpdatedAt={};
  return target.syncMeta.programUpdatedAt;
}

function parseSyncStamp(value){
  const ts=Date.parse(String(value||''));
  return Number.isFinite(ts)?ts:0;
}

function getSectionSyncStamp(profileLike,key){
  return parseSyncStamp(profileLike?.syncMeta?.[key]);
}

function getProgramSyncStamp(profileLike,programId){
  return parseSyncStamp(profileLike?.syncMeta?.programUpdatedAt?.[programId]);
}

function laterIso(a,b){
  const at=parseSyncStamp(a),bt=parseSyncStamp(b);
  if(at===0&&bt===0)return undefined;
  return at>=bt?(a||new Date(at).toISOString()):(b||new Date(bt).toISOString());
}

function getDocumentUpdatedAt(row){
  if(!row||typeof row!=='object')return undefined;
  return row.client_updated_at||row.updated_at||undefined;
}

function mergeSyncMeta(localMeta,remoteMeta){
  const merged={...(remoteMeta||{}),...(localMeta||{})};
  const profileUpdatedAt=laterIso(localMeta?.profileUpdatedAt,remoteMeta?.profileUpdatedAt);
  const scheduleUpdatedAt=laterIso(localMeta?.scheduleUpdatedAt,remoteMeta?.scheduleUpdatedAt);
  if(profileUpdatedAt)merged.profileUpdatedAt=profileUpdatedAt;
  if(scheduleUpdatedAt)merged.scheduleUpdatedAt=scheduleUpdatedAt;
  const programIds=new Set([
    ...Object.keys(localMeta?.programUpdatedAt||{}),
    ...Object.keys(remoteMeta?.programUpdatedAt||{})
  ]);
  if(programIds.size){
    merged.programUpdatedAt={};
    programIds.forEach(programId=>{
      const next=laterIso(localMeta?.programUpdatedAt?.[programId],remoteMeta?.programUpdatedAt?.[programId]);
      if(next)merged.programUpdatedAt[programId]=next;
    });
    if(!Object.keys(merged.programUpdatedAt).length)delete merged.programUpdatedAt;
  }
  if((localMeta&&'workoutsTableReady'in localMeta)||(remoteMeta&&'workoutsTableReady'in remoteMeta)){
    merged.workoutsTableReady=!!(localMeta?.workoutsTableReady||remoteMeta?.workoutsTableReady);
  }
  return merged;
}

function chooseNewerSection(localValue,remoteValue,localProfileLike,remoteProfileLike,syncKey,options){
  const opts=options||{};
  if(remoteValue===undefined)return localValue;
  const localStamp=getSectionSyncStamp(localProfileLike,syncKey);
  const remoteStamp=getSectionSyncStamp(remoteProfileLike,syncKey);
  if(localStamp===0&&remoteStamp===0&&opts.preferRemoteWhenUnset)return remoteValue;
  if(remoteStamp>localStamp)return remoteValue;
  return localValue;
}

function touchSectionSync(syncKey){
  ensureProfileSyncMeta()[syncKey]=new Date().toISOString();
}

function touchProgramSync(programId){
  if(!programId)return;
  ensureProgramSyncMeta()[programId]=new Date().toISOString();
}

function resolveProfileSaveDocKeys(options){
  const opts=options||{};
  if(Array.isArray(opts.docKeys)&&opts.docKeys.length)return uniqueDocKeys(opts.docKeys);
  if(Array.isArray(opts.programIds)&&opts.programIds.length)return uniqueDocKeys(opts.programIds.map(programDocKey));
  return uniqueDocKeys([PROFILE_CORE_DOC_KEY,...listProgramIds(profile).map(programDocKey)]);
}

async function loadData(options){
  const opts=options||{};
  const allowCloudSync=opts.allowCloudSync!==false;
  loadLocalData({userId:opts.userId||currentUser?.id,allowLegacyFallback:true});
  // Pull profile/schedule from cloud and workouts from the dedicated workouts table.
  const cloudResult=allowCloudSync?await pullFromCloud():{usedCloud:false};
  const tableResult=allowCloudSync?await pullWorkoutsFromTable(workouts):{usedTable:false,didBackfill:false};
  const gotCloud=!!cloudResult.usedCloud;
  const gotWorkoutTable=!!tableResult.usedTable||!!tableResult.didBackfill;
  if(gotWorkoutTable&&Array.isArray(tableResult.workouts))workouts=tableResult.workouts;
  if(gotCloud||gotWorkoutTable){
    persistLocalWorkoutsCache();
    persistLocalScheduleCache();
    persistLocalProfileCache();
  }
  const profileBeforeNormalization=JSON.stringify(profile||{});
  const scheduleBeforeNormalization=JSON.stringify(schedule||{});
  // Migrate legacy hockeyDays -> sportDays (one-time migration)
  if(schedule.hockeyDays&&!schedule.sportDays){schedule.sportDays=schedule.hockeyDays;delete schedule.hockeyDays;}
  if(!schedule.sportDays)schedule.sportDays=[];
  if(isLegacyDefaultSportName(schedule.sportName))schedule.sportName=getDefaultSportName();
  if(!schedule.sportIntensity)schedule.sportIntensity='hard';
  if(schedule.sportLegsHeavy===undefined)schedule.sportLegsHeavy=true;
  // Migrate legacy ats* keys to forge* (one-time migration)
  if(profile.atsLifts&&!profile.forgeLifts){profile.forgeLifts=profile.atsLifts;profile.forgeWeek=profile.atsWeek||1;profile.forgeRounding=profile.atsRounding||2.5;profile.forgeDaysPerWeek=profile.atsDaysPerWeek||3;profile.forgeDayNum=profile.atsDayNum||1;profile.forgeBackExercise=profile.atsBackExercise||'Barbell Rows';profile.forgeBackWeight=profile.atsBackWeight||0;profile.forgeMode=profile.atsMode||'sets';profile.forgeWeekStartDate=profile.atsWeekStartDate||new Date().toISOString();}
  workouts.forEach(w=>{
    if(w.type!=='ats')return;
    w.type='forge';
    w.program='forge';
    if(w.atsWeek){
      w.programMeta={...(w.programMeta||{}),week:w.atsWeek};
    }
    if(w.atsDayNum&&w.programDayNum===undefined){
      w.programDayNum=w.atsDayNum;
    }
    if('atsWeek' in w)delete w.atsWeek;
    if('atsDayNum' in w)delete w.atsDayNum;
  });
  // Migrate forge* flat fields -> profile.programs.forge (one-time migration)
  if(profile.forgeLifts&&!profile.programs){
    profile.programs={forge:{week:profile.forgeWeek||1,dayNum:profile.forgeDayNum||1,daysPerWeek:profile.forgeDaysPerWeek||3,mode:profile.forgeMode||'sets',rounding:profile.forgeRounding||2.5,weekStartDate:profile.forgeWeekStartDate||new Date().toISOString(),backExercise:profile.forgeBackExercise||'Barbell Rows',backWeight:profile.forgeBackWeight||0,lifts:profile.forgeLifts}};
    profile.activeProgram='forge';
  }
  cleanupLegacyProfileFields(profile);
  normalizeTrainingPreferences(profile);
  normalizeCoachingProfile(profile);
  normalizeProfileProgramStateMap(profile);
  const normalizedWorkouts=normalizeWorkoutRecords(workouts);
  workouts=normalizedWorkouts.items;
  // Ensure activeProgram is set
  if(!profile.activeProgram)profile.activeProgram='forge';
  profile.activeProgram=getCanonicalProgramId(profile.activeProgram)||'forge';
  if(!profile.language)profile.language=(window.I18N&&I18N.getLanguage?I18N.getLanguage():'en');
  if(window.I18N&&I18N.setLanguage){
    I18N.setLanguage(profile.language,{persist:true,notify:false});
    profile.language=I18N.getLanguage();
  }
  // Initialize program states for all registered programs (fills in defaults for new programs)
  if(!profile.programs)profile.programs={};
  Object.values(PROGRAMS).forEach(prog=>{if(!profile.programs[prog.id])profile.programs[prog.id]=prog.getInitialState();});
  // Backfill new fields for programs that carry existing state (missing keys get safe defaults)
  Object.values(PROGRAMS).forEach(prog=>{if(prog.migrateState&&profile.programs[prog.id])profile.programs[prog.id]=prog.migrateState(profile.programs[prog.id]);});
  // Apply date-based catch-up for the active program
  const activeProg=getActiveProgram();
  if(activeProg.dateCatchUp&&profile.programs[activeProg.id]){const caught=activeProg.dateCatchUp(profile.programs[activeProg.id]);if(caught!==profile.programs[activeProg.id])profile.programs[activeProg.id]=caught;}
  const profileChangedDuringLoad=JSON.stringify(profile||{})!==profileBeforeNormalization;
  const scheduleChangedDuringLoad=JSON.stringify(schedule||{})!==scheduleBeforeNormalization;
  if(normalizedWorkouts.changed){
    await saveWorkouts();
    if(currentUser)await upsertWorkoutRecords(workouts);
  }
  await saveScheduleData({touchSync:scheduleChangedDuringLoad,push:false});
  await saveProfileData({touchSync:profileChangedDuringLoad});
  restDuration=profile.defaultRest||120;
  buildExerciseIndex();
  if(window.I18N&&I18N.applyTranslations)I18N.applyTranslations(document);
  updateDashboard();
  if(typeof maybeOpenOnboarding==='function')maybeOpenOnboarding();
}

async function saveWorkouts(){ persistLocalWorkoutsCache(); }
async function saveScheduleData(options){
  const opts=options||{};
  if(opts.touchSync!==false)touchSectionSync('scheduleUpdatedAt');
  persistLocalScheduleCache();
  persistLocalProfileCache();
  if(opts.push!==false)await pushToCloud({docKeys:[SCHEDULE_DOC_KEY]});
}
async function saveProfileData(options){
  const opts=options||{};
  if(opts.touchSync!==false){
    if(Array.isArray(opts.programIds)&&opts.programIds.length){
      opts.programIds.forEach(touchProgramSync);
      touchSectionSync('profileUpdatedAt');
    }else touchSectionSync('profileUpdatedAt');
  }
  persistLocalProfileCache();
  if(opts.push!==false)await pushToCloud({docKeys:resolveProfileSaveDocKeys(opts)});
}

function toProfileDocumentRows(docKeys,profileLike,scheduleLike){
  if(!currentUser)return[];
  return uniqueDocKeys(docKeys).map(docKey=>{
    const payload=getDocumentPayload(docKey,profileLike,scheduleLike);
    if(payload===undefined)return null;
    let clientUpdatedAt=new Date().toISOString();
    if(docKey===PROFILE_CORE_DOC_KEY)clientUpdatedAt=profileLike?.syncMeta?.profileUpdatedAt||clientUpdatedAt;
    else if(docKey===SCHEDULE_DOC_KEY)clientUpdatedAt=profileLike?.syncMeta?.scheduleUpdatedAt||clientUpdatedAt;
    else{
      const programId=programIdFromDocKey(docKey);
      clientUpdatedAt=profileLike?.syncMeta?.programUpdatedAt?.[programId]||clientUpdatedAt;
    }
    return{
      user_id:currentUser.id,
      doc_key:docKey,
      payload,
      client_updated_at:clientUpdatedAt
    };
  }).filter(Boolean);
}

async function upsertProfileDocuments(docKeys,profileLike,scheduleLike,options){
  if(!currentUser)return false;
  const rows=toProfileDocumentRows(docKeys,profileLike,scheduleLike);
  if(!rows.length)return true;
  const opts=options||{};
  const result=await runSupabaseWrite(
    _SB.from('profile_documents').upsert(rows,{onConflict:'user_id,doc_key'}),
    'Failed to upsert profile documents',
    opts
  );
  profileDocumentsSupported=result.ok;
  return result.ok;
}

function buildStateFromProfileDocuments(rows,fallbackProfile,fallbackSchedule){
  const baseProfile=cloneJson(fallbackProfile||{})||{};
  const nextProfile={...baseProfile,programs:{...cloneJson(getProfilePrograms(baseProfile))}};
  const nextSchedule=cloneJson(fallbackSchedule||schedule||{})||{};
  const rowsByKey=new Map((rows||[]).map(row=>[row.doc_key,row]));
  const coreRow=rowsByKey.get(PROFILE_CORE_DOC_KEY);
  const corePayload=coreRow?.payload;
  if(corePayload&&typeof corePayload==='object'){
    const existingPrograms=nextProfile.programs||{};
    const existingSyncMeta={...(nextProfile.syncMeta||{})};
    const incomingSyncMeta={...(corePayload.syncMeta||{})};
    const remoteUpdatedAt=getDocumentUpdatedAt(coreRow);
    const localUpdatedAt=baseProfile?.syncMeta?.profileUpdatedAt;
    const shouldApplyRemoteCore=parseSyncStamp(remoteUpdatedAt)>=parseSyncStamp(localUpdatedAt);
    if(shouldApplyRemoteCore){
      Object.assign(nextProfile,corePayload);
      nextProfile.programs=existingPrograms;
    }
    nextProfile.syncMeta={...existingSyncMeta,...incomingSyncMeta};
    const mergedProfileUpdatedAt=laterIso(localUpdatedAt,remoteUpdatedAt);
    if(mergedProfileUpdatedAt)nextProfile.syncMeta.profileUpdatedAt=mergedProfileUpdatedAt;
  }
  const scheduleRow=rowsByKey.get(SCHEDULE_DOC_KEY);
  const schedulePayload=scheduleRow?.payload;
  let resolvedSchedule=nextSchedule;
  if(schedulePayload&&typeof schedulePayload==='object'){
    const remoteUpdatedAt=getDocumentUpdatedAt(scheduleRow);
    const localUpdatedAt=baseProfile?.syncMeta?.scheduleUpdatedAt;
    const shouldApplyRemoteSchedule=parseSyncStamp(remoteUpdatedAt)>=parseSyncStamp(localUpdatedAt);
    if(shouldApplyRemoteSchedule)resolvedSchedule=schedulePayload;
    const mergedScheduleUpdatedAt=laterIso(localUpdatedAt,remoteUpdatedAt);
    if(mergedScheduleUpdatedAt){
      if(!nextProfile.syncMeta||typeof nextProfile.syncMeta!=='object')nextProfile.syncMeta={};
      nextProfile.syncMeta.scheduleUpdatedAt=mergedScheduleUpdatedAt;
    }
  }
  const programIds=new Set([
    ...Object.keys(nextProfile.programs||{}),
    ...Array.from(rowsByKey.keys()).filter(isProgramDocKey).map(programIdFromDocKey)
  ]);
  programIds.forEach(programId=>{
    const row=rowsByKey.get(programDocKey(programId));
    const payload=row?.payload;
    if(payload&&typeof payload==='object'){
      const remoteUpdatedAt=getDocumentUpdatedAt(row);
      const localUpdatedAt=baseProfile?.syncMeta?.programUpdatedAt?.[programId];
      const shouldApplyRemoteProgram=parseSyncStamp(remoteUpdatedAt)>=parseSyncStamp(localUpdatedAt);
      if(shouldApplyRemoteProgram)nextProfile.programs[programId]=payload;
      const mergedProgramUpdatedAt=laterIso(localUpdatedAt,remoteUpdatedAt);
      if(mergedProgramUpdatedAt){
        if(!nextProfile.syncMeta||typeof nextProfile.syncMeta!=='object')nextProfile.syncMeta={};
        if(!nextProfile.syncMeta.programUpdatedAt||typeof nextProfile.syncMeta.programUpdatedAt!=='object')nextProfile.syncMeta.programUpdatedAt={};
        nextProfile.syncMeta.programUpdatedAt[programId]=mergedProgramUpdatedAt;
      }
    }
  });
  cleanupLegacyProfileFields(nextProfile);
  normalizeCoachingProfile(nextProfile);
  return{profile:nextProfile,schedule:resolvedSchedule,rowsByKey};
}

async function pullProfileDocuments(options){
  if(!currentUser)return{usedDocs:false,supported:false};
  try{
    const{data,error}=await _SB.from('profile_documents')
      .select('doc_key,payload,client_updated_at,updated_at')
      .eq('user_id',currentUser.id);
    if(error){
      if(profileDocumentsSupported!==false)logWarn('Failed to pull profile documents',error);
      profileDocumentsSupported=false;
      return{usedDocs:false,supported:false};
    }
    profileDocumentsSupported=true;
    const rows=Array.isArray(data)?data:[];
    if(!rows.length)return{usedDocs:false,supported:true};

    const fallbackProfile=options?.legacyProfile||profile;
    const fallbackSchedule=options?.legacySchedule||schedule;
    const next=buildStateFromProfileDocuments(rows,fallbackProfile,fallbackSchedule);
    profile=next.profile;
    schedule=next.schedule;

    const desiredDocKeys=getAllProfileDocumentKeys(profile);
    const missingDocKeys=desiredDocKeys.filter(docKey=>!next.rowsByKey.has(docKey));
    if(missingDocKeys.length)await upsertProfileDocuments(missingDocKeys,profile,schedule,{notifyUser:false});

    return{usedDocs:true,supported:true};
  }catch(e){
    if(profileDocumentsSupported!==false)logWarn('Failed to pull profile documents',e);
    profileDocumentsSupported=false;
    return{usedDocs:false,supported:false};
  }
}

function toWorkoutRow(workout){
  if(!workout)return null;
  return{
    user_id:currentUser.id,
    client_workout_id:String(workout.id),
    program:workout.program||null,
    type:workout.type,
    subtype:workout.subtype||null,
    performed_at:workout.date,
    payload:workout,
    deleted_at:null
  };
}

async function upsertWorkoutRecord(workout,options){
  if(!currentUser||!workout)return;
  await runSupabaseWrite(
    _SB.from('workouts').upsert(toWorkoutRow(workout),{onConflict:'user_id,client_workout_id'}),
    'Failed to upsert workout row',
    options
  );
}

async function upsertWorkoutRecords(items,options){
  if(!currentUser||!Array.isArray(items)||!items.length)return;
  const rows=items.map(toWorkoutRow).filter(Boolean);
  if(!rows.length)return;
  await runSupabaseWrite(
    _SB.from('workouts').upsert(rows,{onConflict:'user_id,client_workout_id'}),
    'Failed to upsert workout rows',
    options
  );
}

async function softDeleteWorkoutRecord(workoutId,options){
  if(!currentUser||workoutId===undefined||workoutId===null)return;
  await runSupabaseWrite(
    _SB.from('workouts')
      .update({deleted_at:new Date().toISOString()})
      .eq('user_id',currentUser.id)
      .eq('client_workout_id',String(workoutId)),
    'Failed to soft-delete workout row',
    options
  );
}

async function replaceWorkoutTableSnapshot(items,options){
  if(!currentUser)return;
  const opts=options||{};
  const nextItems=Array.isArray(items)?items:[];
  const nextIds=new Set(nextItems.map(workoutClientId).filter(Boolean));
  await upsertWorkoutRecords(nextItems,opts);
  try{
    const{data,error}=await _SB.from('workouts')
      .select('client_workout_id,deleted_at')
      .eq('user_id',currentUser.id);
    if(error){logWarn('Failed to read workout rows for snapshot replace',error);return;}
    const rows=Array.isArray(data)?data:[];
    const staleIds=rows
      .filter(row=>!row.deleted_at&&!nextIds.has(String(row.client_workout_id)))
      .map(row=>String(row.client_workout_id));
    if(!staleIds.length)return;
    await runSupabaseWrite(
      _SB.from('workouts')
        .update({deleted_at:new Date().toISOString()})
        .eq('user_id',currentUser.id)
        .in('client_workout_id',staleIds),
      'Failed to prune workout rows during snapshot replace',
      opts
    );
  }catch(e){logWarn('Failed to replace workout table snapshot',e);}
}

async function pullWorkoutsFromTable(fallbackWorkouts){
  if(!currentUser)return{usedTable:false,didBackfill:false};
  try{
    const{data,error}=await _SB.from('workouts')
      .select('client_workout_id,payload,deleted_at,performed_at')
      .eq('user_id',currentUser.id)
      .order('performed_at',{ascending:true});
    if(error)return{usedTable:false,didBackfill:false};

    const rows=Array.isArray(data)?data:[];
    const deletedIds=new Set(rows.filter(row=>row.deleted_at).map(row=>String(row.client_workout_id)));
    const knownIds=new Set(rows.map(row=>String(row.client_workout_id)));
    const activeRows=rows.filter(row=>!row.deleted_at&&row.payload&&typeof row.payload==='object');
    const tableWorkouts=activeRows.map(row=>row.payload);
    const merged=mergeWorkoutLists(tableWorkouts,fallbackWorkouts,deletedIds);
    const missingFromTable=merged.filter(workout=>!knownIds.has(workoutClientId(workout)));

    if(missingFromTable.length)await upsertWorkoutRecords(missingFromTable,{notifyUser:false});
    if((rows.length>0||missingFromTable.length>0)&&!isWorkoutTableReady(profile)){
      profile.syncMeta={...(profile.syncMeta||{}),workoutsTableReady:true};
      await saveProfileData({docKeys:[PROFILE_CORE_DOC_KEY]});
    }

    return{
      usedTable:rows.length>0,
      didBackfill:missingFromTable.length>0,
      workouts:merged
    };
  }catch(e){
    logWarn('Failed to pull workouts from table',e);
    return{usedTable:false,didBackfill:false};
  }
}

async function fetchLegacyProfileBlob(){
  if(!currentUser)return{usedCloud:false};
  try{
    const{data,error}=await _SB.from('profiles').select('data').eq('id',currentUser.id).single();
    if(error||!data?.data)return{usedCloud:false};
    return{
      usedCloud:true,
      profile:data.data.profile||{},
      schedule:data.data.schedule
    };
  }catch(e){
    return{usedCloud:false};
  }
}

function applyLegacyProfileBlob(remoteProfile,remoteSchedule,options){
  const localProfile=profile;
  const localSchedule=schedule;
  const nextProfile=chooseNewerSection(localProfile,remoteProfile,localProfile,remoteProfile,'profileUpdatedAt',options);
  const nextSchedule=chooseNewerSection(localSchedule,remoteSchedule,localProfile,remoteProfile,'scheduleUpdatedAt',options);
  profile={...nextProfile,syncMeta:mergeSyncMeta(localProfile?.syncMeta,remoteProfile?.syncMeta)};
  if(nextSchedule!==undefined)schedule=nextSchedule;
}

async function pushLegacyProfileBlob(){
  try{
    const{data,error}=await _SB.from('profiles').select('data').eq('id',currentUser.id).single();
    if(error&&error.code!=='PGRST116'){
      logWarn('Failed to read cloud profile before legacy push',error);
      notifyCloudSyncError({notifyUser:true});
      return false;
    }
    const remoteData=data?.data||{};
    const remoteProfile=remoteData.profile||{};
    const remoteSchedule=remoteData.schedule;
    const mergedProfile=chooseNewerSection(profile,remoteProfile,profile,remoteProfile,'profileUpdatedAt');
    const mergedSchedule=chooseNewerSection(schedule,remoteSchedule,profile,remoteProfile,'scheduleUpdatedAt');
    profile={...mergedProfile,syncMeta:mergeSyncMeta(profile?.syncMeta,remoteProfile?.syncMeta)};
    if(mergedSchedule!==undefined)schedule=mergedSchedule;
    persistLocalProfileCache();
    persistLocalScheduleCache();
    const result=await runSupabaseWrite(
      _SB.from('profiles').upsert({id:currentUser.id,data:{profile,schedule},updated_at:new Date().toISOString()}),
      'Failed to push legacy profile blob',
      {notifyUser:true}
    );
    return result.ok;
  }catch(e){
    logWarn('Failed to push legacy profile blob',e);
    notifyCloudSyncError({notifyUser:true});
    return false;
  }
}

async function pushToCloud(options){
  if(!currentUser||isApplyingRemoteSync)return;
  const opts=options||{};
  const docKeys=opts.docKeys||getAllProfileDocumentKeys(profile);
  const docsSaved=await upsertProfileDocuments(docKeys,profile,schedule,{notifyUser:false});
  if(docsSaved)return true;
  return pushLegacyProfileBlob();
}

async function pullFromCloud(){
  if(!currentUser)return{usedCloud:false};
  const legacySnapshot=await fetchLegacyProfileBlob();
  const docsResult=await pullProfileDocuments({
    legacyProfile:legacySnapshot.profile,
    legacySchedule:legacySnapshot.schedule
  });
  if(docsResult.usedDocs)return{usedCloud:true,usedDocs:true};
  if(legacySnapshot.usedCloud){
    applyLegacyProfileBlob(legacySnapshot.profile,legacySnapshot.schedule,{preferRemoteWhenUnset:true});
    if(profileDocumentsSupported!==false){
      await upsertProfileDocuments(getAllProfileDocumentKeys(profile),profile,schedule,{notifyUser:false});
    }
    return{usedCloud:true,usedDocs:false};
  }
  return{usedCloud:false,usedDocs:false};
}

function refreshSyncedUI(options){
  const opts=options||{};
  restDuration=profile.defaultRest||120;
  buildExerciseIndex();
  if(typeof initSettings==='function'&&document.getElementById('settings-modal')?.classList.contains('active'))initSettings();
  if(typeof updateProgramDisplay==='function')updateProgramDisplay();
  if(typeof updateDashboard==='function')updateDashboard();
  if(typeof renderHistory==='function'&&document.getElementById('page-history')?.classList.contains('active')){
    renderHistory();
    if(typeof updateStats==='function')updateStats();
  }
  if(!activeWorkout&&document.getElementById('page-log')?.classList.contains('active')&&typeof resetNotStartedView==='function'){
    resetNotStartedView();
  }
  if(typeof maybeOpenOnboarding==='function')maybeOpenOnboarding();
  if(opts.toast&&typeof showToast==='function'){
    showToast(i18nText('toast.synced_other_device','Synced latest changes from another device'),'var(--blue)');
  }
}

function teardownRealtimeSync(){
  if(realtimeSyncTimer){
    clearTimeout(realtimeSyncTimer);
    realtimeSyncTimer=null;
  }
  if(syncRealtimeChannel&&_SB?.removeChannel){
    _SB.removeChannel(syncRealtimeChannel);
  }
  syncRealtimeChannel=null;
}

async function applyRealtimeSync(reason){
  if(!currentUser||isApplyingRemoteSync)return;
  isApplyingRemoteSync=true;
  try{
    const beforeProfile=JSON.stringify(profile||{});
    const beforeSchedule=JSON.stringify(schedule||{});
    const beforeWorkouts=JSON.stringify(workouts||[]);
    await pullFromCloud();
    const tableResult=await pullWorkoutsFromTable(workouts);
    if(tableResult.usedTable||tableResult.didBackfill)workouts=tableResult.workouts||workouts;
    const changed=
      beforeProfile!==JSON.stringify(profile||{})||
      beforeSchedule!==JSON.stringify(schedule||{})||
      beforeWorkouts!==JSON.stringify(workouts||[]);
    if(changed){
      persistLocalProfileCache();
      persistLocalScheduleCache();
      persistLocalWorkoutsCache();
      refreshSyncedUI({toast:reason!=='auth-load'});
    }
  }finally{
    isApplyingRemoteSync=false;
  }
}

function scheduleRealtimeSync(reason){
  if(!currentUser)return;
  if(realtimeSyncTimer)clearTimeout(realtimeSyncTimer);
  realtimeSyncTimer=setTimeout(()=>{applyRealtimeSync(reason);},150);
}

function setupRealtimeSync(){
  teardownRealtimeSync();
  if(!currentUser||!_SB?.channel)return;
  syncRealtimeChannel=_SB.channel('ironforge-sync-'+currentUser.id)
    .on('postgres_changes',{
      event:'*',
      schema:'public',
      table:'workouts',
      filter:`user_id=eq.${currentUser.id}`
    },()=>scheduleRealtimeSync('workouts'))
    .on('postgres_changes',{
      event:'*',
      schema:'public',
      table:'profile_documents',
      filter:`user_id=eq.${currentUser.id}`
    },()=>scheduleRealtimeSync('profile-documents'))
    .on('postgres_changes',{
      event:'*',
      schema:'public',
      table:'profiles',
      filter:`id=eq.${currentUser.id}`
    },()=>scheduleRealtimeSync('legacy-profile'))
    .subscribe();
}

async function initAuth(){
  const{data:{session}}=await _SB.auth.getSession();
  currentUser=session?.user??null;
  if(currentUser){hideLoginScreen();await loadData({allowCloudSync:true});setupRealtimeSync();}
  else{teardownRealtimeSync();resetRuntimeState();showLoginScreen();}

  _SB.auth.onAuthStateChange(async(_event,session)=>{
    const wasLoggedIn=!!currentUser;
    currentUser=session?.user??null;
    if(currentUser&&!wasLoggedIn){hideLoginScreen();await loadData({allowCloudSync:true});setupRealtimeSync();}
    else if(!currentUser&&wasLoggedIn){teardownRealtimeSync();resetRuntimeState();showLoginScreen();}
    else if(!currentUser){teardownRealtimeSync();resetRuntimeState();showLoginScreen();}
  });
}

function showLoginScreen(){
  document.body.classList.add('login-active');
  document.getElementById('login-screen').style.display='flex';
  if(typeof window.startLoginSparks==='function')window.startLoginSparks();
}

function hideLoginScreen(){
  document.body.classList.remove('login-active');
  document.getElementById('login-screen').style.display='none';
  if(typeof window.stopLoginSparks==='function')window.stopLoginSparks();
  const el=document.getElementById('account-email');
  if(el)el.textContent=currentUser?.email??'';
}

async function loginWithEmail(){
  const email=document.getElementById('login-email').value.trim();
  const password=document.getElementById('login-password').value;
  const errEl=document.getElementById('login-error');
  errEl.style.color='var(--accent)';errEl.textContent='Signing in...';
  const{error}=await _SB.auth.signInWithPassword({email,password});
  if(error){errEl.style.color='#f87171';errEl.textContent=error.message;}
}

async function signUpWithEmail(){
  const email=document.getElementById('login-email').value.trim();
  const password=document.getElementById('login-password').value;
  const errEl=document.getElementById('login-error');
  if(password.length<6){errEl.style.color='#f87171';errEl.textContent='Password must be at least 6 characters.';return;}
  errEl.style.color='var(--accent)';errEl.textContent='Creating account...';
  const{error}=await _SB.auth.signUp({email,password});
  if(error){errEl.style.color='#f87171';errEl.textContent=error.message;}
  else{errEl.style.color='var(--accent)';errEl.textContent='Account created! Check your email to confirm, then sign in.';}
}

async function logout(){
  teardownRealtimeSync();
  await _SB.auth.signOut();
  currentUser=null;
  resetRuntimeState();
  updateDashboard();
}
