// Data and auth layer extracted from app.js.
// Keeps runtime behavior the same while reducing app.js size/responsibility.

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

function parseSyncStamp(value){
  const ts=Date.parse(String(value||''));
  return Number.isFinite(ts)?ts:0;
}

function getSectionSyncStamp(profileLike,key){
  return parseSyncStamp(profileLike?.syncMeta?.[key]);
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
  if(opts.push!==false)await pushToCloud();
}
async function saveProfileData(options){
  const opts=options||{};
  if(opts.touchSync!==false)touchSectionSync('profileUpdatedAt');
  persistLocalProfileCache();
  if(opts.push!==false)await pushToCloud();
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
      await saveProfileData();
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

async function pushToCloud(){
  if(!currentUser)return;
  try{
    const{data,error}=await _SB.from('profiles').select('data').eq('id',currentUser.id).single();
    if(error&&error.code!=='PGRST116'){logWarn('Failed to read cloud profile before push',error);}
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
  }catch(e){logWarn('Failed to push data to cloud',e);}
}

async function pullFromCloud(){
  if(!currentUser)return{usedCloud:false};
  try{
    const{data,error}=await _SB.from('profiles').select('data').eq('id',currentUser.id).single();
    if(error||!data?.data)return{usedCloud:false};
    const c=data.data;
    const remoteProfile=c.profile||{};
    const remoteSchedule=c.schedule;
    const localProfile=profile;
    const localSchedule=schedule;
    const nextProfile=chooseNewerSection(localProfile,remoteProfile,localProfile,remoteProfile,'profileUpdatedAt',{preferRemoteWhenUnset:true});
    const nextSchedule=chooseNewerSection(localSchedule,remoteSchedule,localProfile,remoteProfile,'scheduleUpdatedAt',{preferRemoteWhenUnset:true});
    profile={...nextProfile,syncMeta:mergeSyncMeta(localProfile?.syncMeta,remoteProfile?.syncMeta)};
    if(nextSchedule!==undefined)schedule=nextSchedule;
    return{usedCloud:true};
  }catch(e){return{usedCloud:false};}
}

async function initAuth(){
  await loadData({allowCloudSync:false});
  const{data:{session}}=await _SB.auth.getSession();
  currentUser=session?.user??null;
  if(currentUser){hideLoginScreen();await loadData({allowCloudSync:true});}
  else showLoginScreen();

  _SB.auth.onAuthStateChange(async(_event,session)=>{
    const wasLoggedIn=!!currentUser;
    currentUser=session?.user??null;
    if(currentUser&&!wasLoggedIn){hideLoginScreen();await loadData({allowCloudSync:true});}
    else if(!currentUser&&wasLoggedIn){await loadData({allowCloudSync:false});showLoginScreen();}
    else if(!currentUser){showLoginScreen();}
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
  await _SB.auth.signOut();
  workouts=[];schedule={sportName:getDefaultSportName(),sportDays:[],sportIntensity:'hard',sportLegsHeavy:true};profile={defaultRest:120,language:(window.I18N&&I18N.getLanguage?I18N.getLanguage():'en')};currentUser=null;
  updateDashboard();
}
