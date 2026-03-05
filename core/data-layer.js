// Data and auth layer extracted from app.js.
// Keeps runtime behavior the same while reducing app.js size/responsibility.

async function loadData(){
  try{const w=localStorage.getItem('ic_workouts');if(w)workouts=JSON.parse(w);}catch(e){logWarn('Failed to load workouts from localStorage',e);}
  try{const s=localStorage.getItem('ic_schedule');if(s)schedule=JSON.parse(s);}catch(e){logWarn('Failed to load schedule from localStorage',e);}
  try{const pr=localStorage.getItem('ic_profile');if(pr)profile=JSON.parse(pr);}catch(e){logWarn('Failed to load profile from localStorage',e);}
  // Pull fresher data from cloud if logged in
  const gotCloud=await pullFromCloud();
  if(gotCloud){
    try{localStorage.setItem('ic_workouts',JSON.stringify(workouts));}catch(e){logWarn('Failed to persist cloud workouts snapshot locally',e);}
    try{localStorage.setItem('ic_schedule',JSON.stringify(schedule));}catch(e){logWarn('Failed to persist cloud schedule snapshot locally',e);}
    try{localStorage.setItem('ic_profile',JSON.stringify(profile));}catch(e){logWarn('Failed to persist cloud profile snapshot locally',e);}
  }
  // Migrate legacy hockeyDays -> sportDays (one-time migration)
  if(schedule.hockeyDays&&!schedule.sportDays){schedule.sportDays=schedule.hockeyDays;delete schedule.hockeyDays;}
  if(!schedule.sportDays)schedule.sportDays=[];
  if(!schedule.sportName)schedule.sportName='Hockey';
  if(!schedule.sportIntensity)schedule.sportIntensity='hard';
  if(schedule.sportLegsHeavy===undefined)schedule.sportLegsHeavy=true;
  // Migrate legacy ats* keys to forge* (one-time migration)
  if(profile.atsLifts&&!profile.forgeLifts){profile.forgeLifts=profile.atsLifts;profile.forgeWeek=profile.atsWeek||1;profile.forgeRounding=profile.atsRounding||2.5;profile.forgeDaysPerWeek=profile.atsDaysPerWeek||3;profile.forgeDayNum=profile.atsDayNum||1;profile.forgeBackExercise=profile.atsBackExercise||'Barbell Rows';profile.forgeBackWeight=profile.atsBackWeight||0;profile.forgeMode=profile.atsMode||'sets';profile.forgeWeekStartDate=profile.atsWeekStartDate||new Date().toISOString();}
  workouts.forEach(w=>{if(w.type==='ats'){w.type='forge';if(w.atsWeek){w.forgeWeek=w.atsWeek;}if(w.atsDayNum){w.forgeDayNum=w.atsDayNum;}}});
  // Migrate forge* flat fields -> profile.programs.forge (one-time migration)
  if(profile.forgeLifts&&!profile.programs){
    profile.programs={forge:{week:profile.forgeWeek||1,dayNum:profile.forgeDayNum||1,daysPerWeek:profile.forgeDaysPerWeek||3,mode:profile.forgeMode||'sets',rounding:profile.forgeRounding||2.5,weekStartDate:profile.forgeWeekStartDate||new Date().toISOString(),backExercise:profile.forgeBackExercise||'Barbell Rows',backWeight:profile.forgeBackWeight||0,lifts:profile.forgeLifts}};
    profile.activeProgram='forge';
  }
  // Stamp old workout records with program field
  workouts.forEach(w=>{if(!w.program&&w.type&&w.type!=='hockey'&&w.type!=='sport')w.program=w.type;});
  // Ensure activeProgram is set
  if(!profile.activeProgram)profile.activeProgram='forge';
  // Initialize program states for all registered programs (fills in defaults for new programs)
  if(!profile.programs)profile.programs={};
  Object.values(PROGRAMS).forEach(prog=>{if(!profile.programs[prog.id])profile.programs[prog.id]=prog.getInitialState();});
  // Backfill new fields for programs that carry existing state (missing keys get safe defaults)
  Object.values(PROGRAMS).forEach(prog=>{if(prog.migrateState&&profile.programs[prog.id])profile.programs[prog.id]=prog.migrateState(profile.programs[prog.id]);});
  // Apply date-based catch-up for the active program
  const activeProg=getActiveProgram();
  if(activeProg.dateCatchUp&&profile.programs[activeProg.id]){const caught=activeProg.dateCatchUp(profile.programs[activeProg.id]);if(caught!==profile.programs[activeProg.id])profile.programs[activeProg.id]=caught;}
  saveProfileData();
  restDuration=profile.defaultRest||120;
  buildExerciseIndex();
  updateDashboard();
}

async function saveWorkouts(){ try{localStorage.setItem('ic_workouts',JSON.stringify(workouts));}catch(e){logWarn('Failed to save workouts to localStorage',e);} pushToCloud(); }
async function saveScheduleData(){ try{localStorage.setItem('ic_schedule',JSON.stringify(schedule));}catch(e){logWarn('Failed to save schedule to localStorage',e);} pushToCloud(); }
async function saveProfileData(){ try{localStorage.setItem('ic_profile',JSON.stringify(profile));}catch(e){logWarn('Failed to save profile to localStorage',e);} pushToCloud(); }

async function pushToCloud(){
  if(!currentUser)return;
  try{await _SB.from('profiles').upsert({id:currentUser.id,data:{profile,schedule,workouts},updated_at:new Date().toISOString()});}catch(e){logWarn('Failed to push data to cloud',e);}
}

async function pullFromCloud(){
  if(!currentUser)return false;
  try{
    const{data,error}=await _SB.from('profiles').select('data').eq('id',currentUser.id).single();
    if(error||!data?.data)return false;
    const c=data.data;
    if(c.profile)profile=c.profile;
    if(c.schedule)schedule=c.schedule;
    if(c.workouts)workouts=c.workouts;
    return true;
  }catch(e){return false;}
}

async function initAuth(){
  const{data:{session}}=await _SB.auth.getSession();
  currentUser=session?.user??null;
  if(currentUser){hideLoginScreen();await loadData();}
  else showLoginScreen();

  _SB.auth.onAuthStateChange(async(_event,session)=>{
    const wasLoggedIn=!!currentUser;
    currentUser=session?.user??null;
    if(currentUser&&!wasLoggedIn){hideLoginScreen();await loadData();}
    else if(!currentUser){showLoginScreen();}
  });
}

function showLoginScreen(){document.getElementById('login-screen').style.display='flex';}

function hideLoginScreen(){
  document.getElementById('login-screen').style.display='none';
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
  workouts=[];schedule={sportName:'Hockey',sportDays:[],sportIntensity:'hard',sportLegsHeavy:true};profile={defaultRest:120};currentUser=null;
  updateDashboard();
}
