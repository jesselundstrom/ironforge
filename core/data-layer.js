// Data and auth layer extracted from app.js.
// Keeps runtime behavior the same while reducing app.js size/responsibility.

const PROFILE_CORE_DOC_KEY='profile_core';
const SCHEDULE_DOC_KEY='schedule';
const PROGRAM_DOC_PREFIX='program:';
let profileDocumentsSupported=null;
let syncRealtimeChannel=null;
let realtimeSyncTimer=null;
let isApplyingRemoteSync=false;

function loadLocalData(){
  try{const w=localStorage.getItem('ic_workouts');if(w)workouts=JSON.parse(w);}catch(e){logWarn('Failed to load workouts from localStorage',e);}
  try{const s=localStorage.getItem('ic_schedule');if(s)schedule=JSON.parse(s);}catch(e){logWarn('Failed to load schedule from localStorage',e);}
  try{const pr=localStorage.getItem('ic_profile');if(pr)profile=JSON.parse(pr);}catch(e){logWarn('Failed to load profile from localStorage',e);}
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

function uniqueDocKeys(keys){
  return [...new Set((keys||[]).filter(Boolean))];
}

function programDocKey(programId){
  return PROGRAM_DOC_PREFIX+String(programId||'');
}

function programIdFromDocKey(docKey){
  const key=String(docKey||'');
  return key.startsWith(PROGRAM_DOC_PREFIX)?key.slice(PROGRAM_DOC_PREFIX.length):'';
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

function getProgramTrainingDaysPerWeek(programId,profileLike){
  const preferred=getPreferredTrainingDaysPerWeek(profileLike);
  const limits={
    forge:[2,6],
    hypertrophysplit:[2,6],
    w531:[2,4],
    casualfullbody:[2,3]
  };
  const [min,max]=limits[programId]||[2,6];
  return Math.max(min,Math.min(max,preferred));
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
  try{localStorage.setItem('ic_workouts',JSON.stringify(workouts));}catch(e){logWarn('Failed to persist workouts locally',e);}
}

function persistLocalScheduleCache(){
  try{localStorage.setItem('ic_schedule',JSON.stringify(schedule));}catch(e){logWarn('Failed to persist schedule locally',e);}
}

function persistLocalProfileCache(){
  try{localStorage.setItem('ic_profile',JSON.stringify(profile));}catch(e){logWarn('Failed to persist profile locally',e);}
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
  loadLocalData();
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
  const normalizedWorkouts=normalizeWorkoutRecords(workouts);
  workouts=normalizedWorkouts.items;
  // Ensure activeProgram is set
  if(!profile.activeProgram)profile.activeProgram='forge';
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

async function upsertProfileDocuments(docKeys,profileLike,scheduleLike){
  if(!currentUser)return false;
  const rows=toProfileDocumentRows(docKeys,profileLike,scheduleLike);
  if(!rows.length)return true;
  try{
    await _SB.from('profile_documents').upsert(rows,{onConflict:'user_id,doc_key'});
    profileDocumentsSupported=true;
    return true;
  }catch(e){
    if(profileDocumentsSupported!==false)logWarn('Failed to upsert profile documents',e);
    profileDocumentsSupported=false;
    return false;
  }
}

function buildStateFromProfileDocuments(rows,fallbackProfile,fallbackSchedule){
  const baseProfile=cloneJson(fallbackProfile||{})||{};
  const nextProfile={...baseProfile,programs:{...cloneJson(getProfilePrograms(baseProfile))}};
  const nextSchedule=cloneJson(fallbackSchedule||schedule||{})||{};
  const rowsByKey=new Map((rows||[]).map(row=>[row.doc_key,row]));
  const corePayload=rowsByKey.get(PROFILE_CORE_DOC_KEY)?.payload;
  if(corePayload&&typeof corePayload==='object'){
    const existingPrograms=nextProfile.programs||{};
    const existingSyncMeta={...(nextProfile.syncMeta||{})};
    const incomingSyncMeta={...(corePayload.syncMeta||{})};
    Object.assign(nextProfile,corePayload);
    nextProfile.programs=existingPrograms;
    nextProfile.syncMeta={...existingSyncMeta,...incomingSyncMeta};
  }
  const schedulePayload=rowsByKey.get(SCHEDULE_DOC_KEY)?.payload;
  const resolvedSchedule=(schedulePayload&&typeof schedulePayload==='object')?schedulePayload:nextSchedule;
  const programIds=new Set([
    ...Object.keys(nextProfile.programs||{}),
    ...Array.from(rowsByKey.keys()).filter(isProgramDocKey).map(programIdFromDocKey)
  ]);
  programIds.forEach(programId=>{
    const payload=rowsByKey.get(programDocKey(programId))?.payload;
    if(payload&&typeof payload==='object'){
      nextProfile.programs[programId]=payload;
    }
  });
  cleanupLegacyProfileFields(nextProfile);
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
    if(missingDocKeys.length)await upsertProfileDocuments(missingDocKeys,profile,schedule);

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

async function upsertWorkoutRecord(workout){
  if(!currentUser||!workout)return;
  try{
    await _SB.from('workouts').upsert(toWorkoutRow(workout),{onConflict:'user_id,client_workout_id'});
  }catch(e){logWarn('Failed to upsert workout row',e);}
}

async function upsertWorkoutRecords(items){
  if(!currentUser||!Array.isArray(items)||!items.length)return;
  const rows=items.map(toWorkoutRow).filter(Boolean);
  if(!rows.length)return;
  try{
    await _SB.from('workouts').upsert(rows,{onConflict:'user_id,client_workout_id'});
  }catch(e){logWarn('Failed to upsert workout rows',e);}
}

async function softDeleteWorkoutRecord(workoutId){
  if(!currentUser||workoutId===undefined||workoutId===null)return;
  try{
    await _SB.from('workouts')
      .update({deleted_at:new Date().toISOString()})
      .eq('user_id',currentUser.id)
      .eq('client_workout_id',String(workoutId));
  }catch(e){logWarn('Failed to soft-delete workout row',e);}
}

async function replaceWorkoutTableSnapshot(items){
  if(!currentUser)return;
  const nextItems=Array.isArray(items)?items:[];
  const nextIds=new Set(nextItems.map(workoutClientId).filter(Boolean));
  await upsertWorkoutRecords(nextItems);
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
    await _SB.from('workouts')
      .update({deleted_at:new Date().toISOString()})
      .eq('user_id',currentUser.id)
      .in('client_workout_id',staleIds);
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

    if(missingFromTable.length)await upsertWorkoutRecords(missingFromTable);
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
    if(error&&error.code!=='PGRST116'){logWarn('Failed to read cloud profile before legacy push',error);}
    const remoteData=data?.data||{};
    const remoteProfile=remoteData.profile||{};
    const remoteSchedule=remoteData.schedule;
    const mergedProfile=chooseNewerSection(profile,remoteProfile,profile,remoteProfile,'profileUpdatedAt');
    const mergedSchedule=chooseNewerSection(schedule,remoteSchedule,profile,remoteProfile,'scheduleUpdatedAt');
    profile={...mergedProfile,syncMeta:mergeSyncMeta(profile?.syncMeta,remoteProfile?.syncMeta)};
    if(mergedSchedule!==undefined)schedule=mergedSchedule;
    persistLocalProfileCache();
    persistLocalScheduleCache();
    await _SB.from('profiles').upsert({id:currentUser.id,data:{profile,schedule},updated_at:new Date().toISOString()});
  }catch(e){logWarn('Failed to push legacy profile blob',e);}
}

async function pushToCloud(options){
  if(!currentUser||isApplyingRemoteSync)return;
  const opts=options||{};
  await upsertProfileDocuments(opts.docKeys||getAllProfileDocumentKeys(profile),profile,schedule);
  await pushLegacyProfileBlob();
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
      await upsertProfileDocuments(getAllProfileDocumentKeys(profile),profile,schedule);
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
  await loadData({allowCloudSync:false});
  const{data:{session}}=await _SB.auth.getSession();
  currentUser=session?.user??null;
  if(currentUser){hideLoginScreen();await loadData({allowCloudSync:true});setupRealtimeSync();}
  else{teardownRealtimeSync();showLoginScreen();}

  _SB.auth.onAuthStateChange(async(_event,session)=>{
    const wasLoggedIn=!!currentUser;
    currentUser=session?.user??null;
    if(currentUser&&!wasLoggedIn){hideLoginScreen();await loadData({allowCloudSync:true});setupRealtimeSync();}
    else if(!currentUser&&wasLoggedIn){teardownRealtimeSync();await loadData({allowCloudSync:false});showLoginScreen();}
    else if(!currentUser){teardownRealtimeSync();showLoginScreen();}
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
  workouts=[];schedule={sportName:getDefaultSportName(),sportDays:[],sportIntensity:'hard',sportLegsHeavy:true};profile={defaultRest:120,language:(window.I18N&&I18N.getLanguage?I18N.getLanguage():'en'),preferences:getDefaultTrainingPreferences()};currentUser=null;
  updateDashboard();
}
