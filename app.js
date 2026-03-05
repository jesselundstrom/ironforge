const DAY_NAMES=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// ── SUPABASE ─────────────────────────────────────────────────
const _SB=supabase.createClient(
  'https://koreqcjrpzcbfgkptvfx.supabase.co',
  'sb_publishable_Ccuq9Bwyxmyy4JfrWqXlhg_qiWmCYpn'
);
let currentUser=null;

// ── STATE (persisted via localStorage) ──────────
let workouts=[];
let schedule={hockeyDays:[]};
let profile={defaultRest:120};
let activeWorkout=null, workoutTimer=null, workoutSeconds=0;
let restInterval=null, restSecondsLeft=0, restTotal=0, restDuration=120;
let pendingRPECallback=null;
let confirmCallback=null;
let nameModalCallback=null;
let _toastTimeout=null;
let exerciseIndex={};

const RPE_FEELS={6:'Easy',7:'Moderate',8:'Hard',9:'Very Hard',10:'Max'};

// ── PROGRAM REGISTRY ─────────────────────────────────
// Programs (loaded via <script> tags after this file) call registerProgram() to self-register.
const PROGRAMS={};
function registerProgram(p){PROGRAMS[p.id]=p;}
function getActiveProgram(){return PROGRAMS[profile.activeProgram||'forge']||PROGRAMS.forge||Object.values(PROGRAMS)[0]||{};}
function getActiveProgramState(){return profile.programs?.[profile.activeProgram||'forge']||{};}
function setProgramState(id,state){if(!profile.programs)profile.programs={};profile.programs[id]=state;}

// ── FATIGUE ENGINE CONFIG ─────────────────────────────
// Separate from program definitions — these are app-wide constants
const FATIGUE_CONFIG={
  muscularBase:40,muscularDecay:15,
  cnsBase:50,cnsDecay:20,
  setsWeight:3,
  hockeyMuscularBonus:20,hockeyCnsBonus:15,
  rpeWeight:8,extraHockeyCns:10,
  hockeyRecentHours:30
};



// ── STORAGE ──────────────────────────────────────────────────
async function loadData(){
  try{const w=localStorage.getItem('ic_workouts');if(w)workouts=JSON.parse(w);}catch(e){}
  try{const s=localStorage.getItem('ic_schedule');if(s)schedule=JSON.parse(s);}catch(e){}
  try{const pr=localStorage.getItem('ic_profile');if(pr)profile=JSON.parse(pr);}catch(e){}
  // Pull fresher data from cloud if logged in
  const gotCloud=await pullFromCloud();
  if(gotCloud){
    try{localStorage.setItem('ic_workouts',JSON.stringify(workouts));}catch(e){}
    try{localStorage.setItem('ic_schedule',JSON.stringify(schedule));}catch(e){}
    try{localStorage.setItem('ic_profile',JSON.stringify(profile));}catch(e){}
  }
  // Ensure schedule shape is valid after local + cloud load
  if(!schedule.hockeyDays)schedule.hockeyDays=[];
  // Migrate legacy ats* keys to forge* (one-time migration)
  if(profile.atsLifts&&!profile.forgeLifts){profile.forgeLifts=profile.atsLifts;profile.forgeWeek=profile.atsWeek||1;profile.forgeRounding=profile.atsRounding||2.5;profile.forgeDaysPerWeek=profile.atsDaysPerWeek||3;profile.forgeDayNum=profile.atsDayNum||1;profile.forgeBackExercise=profile.atsBackExercise||'Barbell Rows';profile.forgeBackWeight=profile.atsBackWeight||0;profile.forgeMode=profile.atsMode||'sets';profile.forgeWeekStartDate=profile.atsWeekStartDate||new Date().toISOString();}
  workouts.forEach(w=>{if(w.type==='ats'){w.type='forge';if(w.atsWeek){w.forgeWeek=w.atsWeek;}if(w.atsDayNum){w.forgeDayNum=w.atsDayNum;}}});
  // Migrate forge* flat fields → profile.programs.forge (one-time migration)
  if(profile.forgeLifts&&!profile.programs){
    profile.programs={forge:{week:profile.forgeWeek||1,dayNum:profile.forgeDayNum||1,daysPerWeek:profile.forgeDaysPerWeek||3,mode:profile.forgeMode||'sets',rounding:profile.forgeRounding||2.5,weekStartDate:profile.forgeWeekStartDate||new Date().toISOString(),backExercise:profile.forgeBackExercise||'Barrell Rows',backWeight:profile.forgeBackWeight||0,lifts:profile.forgeLifts}};
    profile.activeProgram='forge';
  }
  // Stamp old workout records with program field
  workouts.forEach(w=>{if(!w.program&&w.type&&w.type!=='hockey')w.program=w.type;});
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
async function saveWorkouts(){ try{localStorage.setItem('ic_workouts',JSON.stringify(workouts));}catch(e){} pushToCloud(); }
async function saveScheduleData(){ try{localStorage.setItem('ic_schedule',JSON.stringify(schedule));}catch(e){} pushToCloud(); }
async function saveProfileData(){ try{localStorage.setItem('ic_profile',JSON.stringify(profile));}catch(e){} pushToCloud(); }

// ── CLOUD SYNC ────────────────────────────────────────────────
async function pushToCloud(){
  if(!currentUser)return;
  try{await _SB.from('profiles').upsert({id:currentUser.id,data:{profile,schedule,workouts},updated_at:new Date().toISOString()});}catch(e){}
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

// ── AUTH ─────────────────────────────────────────────────────
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
  workouts=[];schedule={hockeyDays:[]};profile={defaultRest:120};currentUser=null;
  updateDashboard();
}

// ── NAV ──────────────────────────────────────────────────────
function showPage(name,btn){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('page-'+name).classList.add('active');
  btn.classList.add('active');
  window.scrollTo(0,0);
  if(name==='dashboard') updateDashboard();
  if(name==='history') renderHistory();
  if(name==='settings') initSettings();
  if(name==='log'){if(!activeWorkout)resetNotStartedView();}
}
function goToLog(){showPage('log',document.querySelectorAll('.nav-btn')[1]);}



function showToast(msg,color,undoFn){
  const t=document.getElementById('toast');
  clearTimeout(_toastTimeout);
  t.style.background=color||'var(--green)';
  if(undoFn){
    t.style.pointerEvents='auto';
    t.innerHTML=msg+' <span id="t-undo" style="background:rgba(255,255,255,0.2);border-radius:6px;padding:2px 10px;margin-left:6px;cursor:pointer;font-weight:700;font-size:13px">Undo</span>';
    document.getElementById('t-undo').onclick=()=>{clearTimeout(_toastTimeout);t.classList.remove('show');t.style.pointerEvents='none';undoFn();};
  }else{
    t.style.pointerEvents='none';
    t.textContent=msg;
  }
  t.classList.add('show');
  _toastTimeout=setTimeout(()=>{t.classList.remove('show');t.style.pointerEvents='none';},undoFn?5000:2800);
}

// ── CONFIRM MODAL ────────────────────────────────────────────
function showConfirm(title,msg,cb){
  document.getElementById('confirm-title').textContent=title;
  document.getElementById('confirm-msg').textContent=msg;
  confirmCallback=cb;
  document.getElementById('confirm-modal').classList.add('active');
}
function confirmOk(){document.getElementById('confirm-modal').classList.remove('active');if(confirmCallback)confirmCallback();confirmCallback=null;}
function confirmCancel(){document.getElementById('confirm-modal').classList.remove('active');confirmCallback=null;}

// ── NAME INPUT MODAL ─────────────────────────────────────────
function showNameModal(title,cb){
  document.getElementById('name-modal-title').textContent=title;
  document.getElementById('name-modal-input').value='';
  nameModalCallback=cb;
  document.getElementById('name-modal').classList.add('active');
  setTimeout(()=>document.getElementById('name-modal-input').focus(),100);
}
function closeNameModal(){document.getElementById('name-modal').classList.remove('active');nameModalCallback=null;}
function submitNameModal(){
  const v=document.getElementById('name-modal-input').value.trim();
  if(!v)return;
  document.getElementById('name-modal').classList.remove('active');
  if(nameModalCallback)nameModalCallback(v);
  nameModalCallback=null;
}

// ── REST TIMER ───────────────────────────────────────────────
function updateRestDuration(){restDuration=parseInt(document.getElementById('rest-duration').value);}
function startRestTimer(){
  if(!restDuration)return;
  clearInterval(restInterval);
  restSecondsLeft=restDuration;restTotal=restDuration;
  document.getElementById('rest-timer-bar').classList.add('active');
  updateRestDisplay();
  restInterval=setInterval(()=>{
    restSecondsLeft--;
    if(restSecondsLeft<=0){clearInterval(restInterval);restDone();return;}
    updateRestDisplay();
  },1000);
}
function updateRestDisplay(){
  const m=Math.floor(restSecondsLeft/60),s=restSecondsLeft%60;
  const el=document.getElementById('rest-timer-count');
  el.textContent=m+':'+(s<10?'0':'')+s;
  el.className='rest-timer-count'+(restSecondsLeft<=10?' warning':'');
  const offset=119.4*(1-(restSecondsLeft/restTotal));
  document.getElementById('timer-arc').setAttribute('stroke-dashoffset',offset);
}
function restDone(){
  const el=document.getElementById('rest-timer-count');
  el.className='rest-timer-count done';el.textContent='GO!';
  playBeep();
  setTimeout(()=>document.getElementById('rest-timer-bar').classList.remove('active'),3000);
}
function skipRest(){clearInterval(restInterval);document.getElementById('rest-timer-bar').classList.remove('active');}
function playBeep(){
  try{
    const ctx=new(window.AudioContext||window.webkitAudioContext)();
    [0,150,300].forEach(d=>{
      const o=ctx.createOscillator(),g=ctx.createGain();
      o.connect(g);g.connect(ctx.destination);
      o.frequency.value=880;o.type='sine';
      g.gain.setValueAtTime(0.3,ctx.currentTime+d/1000);
      g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+d/1000+0.2);
      o.start(ctx.currentTime+d/1000);o.stop(ctx.currentTime+d/1000+0.25);
    });
  }catch(e){}
}

// ── RPE MODAL ────────────────────────────────────────────────
function showRPEPicker(exName,setNum,cb){
  pendingRPECallback=cb;
  document.getElementById('rpe-modal-sub').textContent=setNum<0?'Rate overall session effort (6 = easy, 10 = max)':exName+' — Set '+(setNum+1);
  const grid=document.getElementById('rpe-grid');grid.innerHTML='';
  [6,7,8,9,10].forEach(v=>{
    const btn=document.createElement('div');btn.className='rpe-btn';
    btn.innerHTML=`<div class="rpe-num">${v}</div><div class="rpe-feel">${RPE_FEELS[v]||''}</div>`;
    btn.onclick=()=>{document.querySelectorAll('.rpe-btn').forEach(b=>b.classList.remove('selected'));btn.classList.add('selected');setTimeout(()=>selectRPE(v),200);};
    grid.appendChild(btn);
  });
  document.getElementById('rpe-modal').classList.add('active');
}
function selectRPE(val){document.getElementById('rpe-modal').classList.remove('active');if(pendingRPECallback)pendingRPECallback(val);pendingRPECallback=null;}
function skipRPE(){document.getElementById('rpe-modal').classList.remove('active');if(pendingRPECallback)pendingRPECallback(null);pendingRPECallback=null;}

// ── FATIGUE ENGINE ───────────────────────────────────────────
function computeFatigue(){
  const now=Date.now();
  const liftS=workouts.filter(w=>w.type!=='hockey').sort((a,b)=>new Date(b.date)-new Date(a.date));
  const hockS=workouts.filter(w=>w.type==='hockey').sort((a,b)=>new Date(b.date)-new Date(a.date));
  const daysSinceLift=liftS.length?(now-new Date(liftS[0].date).getTime())/864e5:99;
  const daysSinceHockey=hockS.length?(now-new Date(hockS[0].date).getTime())/864e5:99;
  const last72h=workouts.filter(w=>now-new Date(w.date).getTime()<3*864e5);
  let recentSets=0,recentRPE=0,rpeCount=0;
  last72h.forEach(w=>{
    if(w.type!=='hockey')w.exercises?.forEach(e=>recentSets+=e.sets.length);
    if(w.rpe){recentRPE+=w.rpe;rpeCount++;}
  });
  const avgRecentRPE=rpeCount?recentRPE/rpeCount:7;
  const recentTypes=last72h.map(w=>w.type);
  const cfg=FATIGUE_CONFIG;
  let muscular=Math.max(0,cfg.muscularBase-daysSinceLift*cfg.muscularDecay)+Math.min(30,recentSets*cfg.setsWeight)+(recentTypes.includes('hockey')?cfg.hockeyMuscularBonus:0);
  let cns=Math.max(0,cfg.cnsBase-daysSinceLift*cfg.cnsDecay)+(avgRecentRPE-5)*cfg.rpeWeight+(recentTypes.includes('hockey')?cfg.hockeyCnsBonus:0);
  const extraToday=last72h.filter(w=>w.type==='hockey'&&w.subtype==='extra').length;
  cns+=extraToday*cfg.extraHockeyCns;
  muscular=Math.min(100,Math.max(0,muscular));cns=Math.min(100,Math.max(0,cns));
  return{muscular:Math.round(muscular),cns:Math.round(cns),overall:Math.round(muscular*.5+cns*.5),daysSinceLift,daysSinceHockey,recentSets,avgRecentRPE};
}
function wasHockeyRecently(hours){
  hours=hours||FATIGUE_CONFIG.hockeyRecentHours;
  return workouts.some(w=>w.type==='hockey'&&(Date.now()-new Date(w.date).getTime())<hours*3600000);
}
function getRecoveryColor(r){return r>=65?'var(--green)':r>=35?'var(--orange)':'var(--accent)';}
function getReadinessLabel(o){
  const r=100-o;
  if(r>=75)return{label:'🟢 Fully Recovered',color:'var(--green)'};
  if(r>=50)return{label:'🟡 Mostly Recovered',color:'var(--orange)'};
  if(r>=30)return{label:'🟠 Partially Fatigued',color:'var(--orange)'};
  return{label:'🔴 High Fatigue',color:'var(--accent)'};
}
function updateFatigueBars(f){
  ['muscular','cns','overall'].forEach(k=>{
    const el=document.getElementById('f-'+k),vEl=document.getElementById('f-'+k+'-val');
    const recovery=100-f[k];
    if(el){el.style.width=recovery+'%';el.style.background=getRecoveryColor(recovery);}
    if(vEl)vEl.textContent=recovery+'%';
  });
  const{label,color}=getReadinessLabel(f.overall);
  const days=f.daysSinceLift<99?`Last lift: ${f.daysSinceLift<1?'today':Math.round(f.daysSinceLift)+'d ago'}`:'No lifts yet';
  const hock=f.daysSinceHockey<99?` · Hockey: ${f.daysSinceHockey<1?'today':Math.round(f.daysSinceHockey)+'d ago'}`:'';
  document.getElementById('recovery-msg').innerHTML=`<span style="color:${color};font-weight:700">${label}</span><br><span style="color:var(--muted)">${days}${hock}</span>`;
}

// ── DATA HELPERS ─────────────────────────────────────────────
function buildExerciseIndex(){
  exerciseIndex={};
  workouts.forEach(w=>{
    w.exercises?.forEach(e=>{
      if(!exerciseIndex[e.name]||new Date(w.date)>new Date(exerciseIndex[e.name].date))
        exerciseIndex[e.name]={sets:e.sets,date:w.date};
    });
  });
}
function getPreviousSets(name){return exerciseIndex[name]?.sets||null;}
function getSuggested(name){const prev=getPreviousSets(name);if(!prev?.length)return null;const max=Math.max(...prev.map(s=>parseFloat(s.weight)||0));return prev.every(s=>s.done)?Math.round((max+2.5)*2)/2:max;}

// ── WEEK STRIP ───────────────────────────────────────────────
function renderWeekStrip(){
  const strip=document.getElementById('week-strip');
  const today=new Date(),todayDow=today.getDay();
  const start=new Date(today);start.setDate(today.getDate()-((todayDow+6)%7));
  strip.innerHTML='';
  for(let i=0;i<7;i++){
    const d=new Date(start);d.setDate(start.getDate()+i);
    const dow=d.getDay(),isToday=d.toDateString()===today.toDateString();
    const logged=workouts.filter(w=>new Date(w.date).toDateString()===d.toDateString());
    const isHockey=schedule.hockeyDays.includes(dow);
    const hasLift=logged.some(w=>w.type!=='hockey'),hasHockey=logged.some(w=>w.type==='hockey');
    let cls='day-pill'+(isHockey?' hockey':'')+(isToday?' today':'');
    let icon=hasLift&&hasHockey?'🏋️🏒':hasLift?'✅':hasHockey?'🏒':(isHockey?'🏒':'');
    strip.innerHTML+=`<div class="${cls}"><div class="day-label">${DAY_NAMES[dow]}</div><div class="day-num">${d.getDate()}</div><div style="font-size:11px;margin-top:2px;min-height:14px">${icon}</div></div>`;
  }
  const todayIsHockey=schedule.hockeyDays.includes(todayDow);
  const todayLogged=workouts.filter(w=>new Date(w.date).toDateString()===today.toDateString());
  const tHasLift=todayLogged.some(w=>w.type!=='hockey'),tHasHockey=todayLogged.some(w=>w.type==='hockey');
  let s='';
  if(tHasLift&&tHasHockey)s=`<span style="color:var(--green);font-weight:700">✅ Workout + hockey logged</span>`;
  else if(tHasLift)s=`<span style="color:var(--green);font-weight:700">✅ Workout logged</span>`;
  else if(tHasHockey)s=`<span style="color:var(--blue);font-weight:700">🏒 Hockey logged</span>`;
  else if(todayIsHockey)s=`<span style="color:var(--blue);font-weight:700">🏒 Hockey day — go easy on legs if you lift</span>`;
  else{s='';}
  document.getElementById('today-status').innerHTML=s;
}

// ── DASHBOARD ────────────────────────────────────────────────
function updateDashboard(){
  renderWeekStrip();
  const f=computeFatigue();updateFatigueBars(f);
  const prog=getActiveProgram(),ps=getActiveProgramState();

  // Training Maxes — dynamic per program
  const tmGrid=document.getElementById('tm-grid');
  const tmTitle=document.getElementById('tm-section-title');
  if(tmGrid&&prog.getDashboardTMs){
    const tms=prog.getDashboardTMs(ps);
    tmGrid.innerHTML=tms.map(t=>`<div class="lift-stat"><div class="value">${t.value}</div><div class="label">${t.name}</div></div>`).join('');
    if(tmTitle)tmTitle.textContent=prog.dashboardStatsLabel||'Training Maxes';
  }

  // Weekly session progress
  const now=new Date(),sow=new Date(now);sow.setDate(now.getDate()-((now.getDay()+6)%7));sow.setHours(0,0,0,0);
  const freq=ps.daysPerWeek||3;
  const doneThisWeek=workouts.filter(w=>(w.program===prog.id||(!w.program&&w.type===prog.id))&&new Date(w.date)>=sow).length;
  const hockeyThisWeek=workouts.filter(w=>w.type==='hockey'&&new Date(w.date)>=sow).length;
  const pctDone=Math.min(100,doneThisWeek/freq*100);
  document.getElementById('volume-bar').style.width=pctDone+'%';
  let volText=doneThisWeek+'/'+freq+' sessions done';
  if(hockeyThisWeek) volText+=' · '+hockeyThisWeek+' hockey';
  if(doneThisWeek>=freq) volText+=' ✅';
  document.getElementById('volume-text').textContent=volText;

  // Today's Plan — uses program's getBlockInfo
  const recovery=100-f.overall,todayDow=new Date().getDay();
  const isHockeyDay=schedule.hockeyDays.includes(todayDow);
  const hadHockeyYesterday=wasHockeyRecently(36);
  const bi=prog.getBlockInfo?prog.getBlockInfo(ps):{name:'',weekLabel:'',isDeload:false,pct:null,modeDesc:'',modeName:''};
  const modeDescHtml=bi.modeDesc?`<div style="font-size:11px;color:var(--muted);margin-bottom:10px;padding:0 2px">${bi.modeDesc}</div>`:'';
  const startBtn=`<button class="btn btn-primary" style="margin-top:12px;width:100%" onclick="goToLog()">Start Session →</button>`;
  let rec='',cardAccent=false;
  if(doneThisWeek>=freq) rec=modeDescHtml+`<div style="font-weight:700;color:var(--green);margin-bottom:6px">✅ Week complete!</div><div style="font-size:13px;color:var(--muted)">All ${freq} sessions done. Rest up.</div>`;
  else if(recovery<40) rec=modeDescHtml+`<div style="font-weight:700;color:var(--accent);margin-bottom:6px">⚠️ High fatigue — rest or deload</div><div style="font-size:13px;color:var(--muted)">Recovery ${recovery}%. ${bi.isDeload?'Good timing — deload!':'Consider resting today.'} ${freq-doneThisWeek} session${freq-doneThisWeek>1?'s':''} left.</div>`;
  else if(isHockeyDay){cardAccent=true;rec=modeDescHtml+`<div style="font-weight:700;color:var(--blue);margin-bottom:6px">🏒 Hockey day</div><div style="font-size:13px;color:var(--muted)">Pick an upper-body day on the Log tab, or rest. ${freq-doneThisWeek} session${freq-doneThisWeek>1?'s':''} left this week.</div>${startBtn}`;}
  else if(hadHockeyYesterday){cardAccent=true;rec=modeDescHtml+`<div style="font-weight:700;color:var(--blue);margin-bottom:6px">🏒 Post-hockey</div><div style="font-size:13px;color:var(--muted)">Legs may be fatigued. The Log tab will suggest an upper-focused day. ${freq-doneThisWeek} left.</div>${startBtn}`;}
  else if(bi.isDeload){cardAccent=true;rec=modeDescHtml+`<div style="font-weight:700;color:var(--green);margin-bottom:6px">🌊 Deload week</div><div style="font-size:13px;color:var(--muted)">Recovery ${recovery}%. ${freq-doneThisWeek} session${freq-doneThisWeek>1?'s':''} left.</div>${startBtn}`;}
  else{cardAccent=true;rec=modeDescHtml+`<div style="font-weight:700;color:var(--accent);margin-bottom:6px">🏋️ Training day</div><div style="font-size:13px;color:var(--muted)">Recovery ${recovery}% — ${recovery>=75?'feeling fresh, push it':'moderate effort'}. ${freq-doneThisWeek} session${freq-doneThisWeek>1?'s':''} left this week.</div>${startBtn}`;}
  document.getElementById('next-session-content').innerHTML=rec;
  document.getElementById('next-session-content').parentElement.style.borderColor=cardAccent?'var(--accent)':'';
  document.getElementById('header-sub').textContent=`${prog.name||'Training'} · ${bi.name||''} · ${bi.weekLabel||''} · Recovery ${recovery}%`;
}



function resetNotStartedView(){
  const prog=getActiveProgram();
  document.getElementById('workout-not-started').innerHTML=`
    <div class="quick-log-row">
      <div class="quick-log-card ql-hockey" onclick="quickLogHockey()">
        <div class="ql-icon">🏒</div>
        <div><div class="ql-title">Log Extra Hockey</div><div class="ql-sub">Unscheduled practice or game</div></div>
      </div>
    </div>
    <div class="divider-label"><span>${(prog.icon||'🏋️')+' '+(prog.name||'Training')+' Session'}</span></div>
    <div class="card" style="padding:20px">
      <div style="font-weight:800;font-size:16px;margin-bottom:4px">Start a Session</div>
      <label style="margin-top:8px">Training Day</label>
      <select id="program-day-select" onchange="onDaySelectChange()"></select>
      <div id="program-week-display" style="margin-top:14px;background:rgba(167,139,250,0.08);border:1px solid rgba(167,139,250,0.2);border-radius:10px;padding:10px 12px;font-size:12px;color:var(--purple)"></div>
      <div style="margin-top:18px"><button class="btn btn-primary" onclick="startWorkout()">🏋️ Start Workout</button></div>
    </div>`;
  updateProgramDisplay();
}

// ── WORKOUT STARTER ──────────────────────────────────────────
function startWorkout(){
  const prog=getActiveProgram();
  const state=getActiveProgramState();
  const selectedOption=document.getElementById('program-day-select')?.value;

  const exercises=prog.buildSession(selectedOption,state);
  const label=prog.getSessionLabel(selectedOption,state);
  const bi=prog.getBlockInfo?prog.getBlockInfo(state):{isDeload:false};

  activeWorkout={
    program:prog.id,
    type:prog.id,           // keep type=prog.id for backwards-compat filters
    programOption:selectedOption,
    programDayNum:parseInt(selectedOption)||1,
    programMode:state.mode||undefined,
    programLabel:label,
    exercises,
    startTime:Date.now()
  };

  updateProgramDisplay();
  document.getElementById('workout-not-started').style.display='none';
  document.getElementById('workout-active').style.display='block';
  document.getElementById('active-session-title').textContent=label;
  restDuration=parseInt(document.getElementById('rest-duration')?.value)||profile.defaultRest||120;
  startWorkoutTimer();renderExercises();
  showToast(bi.isDeload?'Deload — keep it light':(prog.name||'Training'),bi.isDeload?'var(--blue)':'var(--purple)');

  // Hockey warning for leg-heavy days
  const legLifts=prog.legLifts||[];
  const todayDow=new Date().getDay();
  const isHockeyDay=schedule.hockeyDays.includes(todayDow);
  const hadHockeyRecently=wasHockeyRecently();
  if((isHockeyDay||hadHockeyRecently)&&!bi.isDeload){
    const hasLegs=activeWorkout.exercises.some(e=>legLifts.includes(e.name.toLowerCase()));
    if(hasLegs)setTimeout(()=>showToast('🏒 Hockey legs — consider fewer sets or swapping day order','var(--blue)'),1500);
  }
}


// ── QUICK LOG ────────────────────────────────────────────────
function quickLogHockey(){
  showConfirm('Log Hockey','Log an extra hockey practice for today?',async()=>{
    workouts.push({id:Date.now(),date:new Date().toISOString(),type:'hockey',subtype:'extra',duration:5400,exercises:[],rpe:7,sets:0});
    await saveWorkouts();
    showToast('🏒 Extra hockey logged!','var(--blue)');
    updateDashboard();
  });
}



// ── WORKOUT LOGGING ──────────────────────────────────────────
function startWorkoutTimer(){
  workoutSeconds=0;
  workoutTimer=setInterval(()=>{
    workoutSeconds++;
    const m=String(Math.floor(workoutSeconds/60)).padStart(2,'0');
    const s=String(workoutSeconds%60).padStart(2,'0');
    document.getElementById('active-session-timer').textContent=m+':'+s;
  },1000);
}

function addExerciseByName(name){
  if(!activeWorkout)return;
  const suggested=getSuggested(name);
  activeWorkout.exercises.push({id:Date.now()+Math.random(),name,note:'',sets:[
    {weight:suggested||'',reps:5,done:false,rpe:null},
    {weight:suggested||'',reps:5,done:false,rpe:null},
    {weight:suggested||'',reps:5,done:false,rpe:null}
  ]});
  renderExercises();
}

function renderExercises(){
  const c=document.getElementById('exercises-container');c.innerHTML='';
  activeWorkout.exercises.forEach((ex,ei)=>{
    const prev=getPreviousSets(ex.name);
    const prevText=prev?'Last: '+prev.map(s=>s.weight+'kg\u00d7'+s.reps).join(', '):'No previous data';
    const suggested=getSuggested(ex.name);
    const block=document.createElement('div');block.className='exercise-block';
    let badges='';
    if(suggested)badges+=`<div class="suggest-badge">\ud83d\udcc8 Last best: ${suggested}kg</div>`;
    if(ex.note)badges+=`<div class="ai-badge" style="background:rgba(167,139,250,0.1);color:var(--purple);border-color:rgba(167,139,250,0.2)">\ud83d\udccb ${ex.note}</div>`;

    // Swap button for auxiliary exercises
    let swapBtn='';
    if(ex.isAux&&ex.auxSlotIdx>=0){
      swapBtn=`<button class="btn btn-icon btn-secondary" onclick="swapAuxExercise(${ei})" title="Swap exercise" style="font-size:14px">🔄</button>`;
    }
    // Swap button for back accessory
    if(ex.isAccessory){
      swapBtn=`<button class="btn btn-icon btn-secondary" onclick="swapBackExercise(${ei})" title="Swap back exercise" style="font-size:14px">🔄</button>`;
    }
    const typeLabel=ex.isAux?'<span style="font-size:10px;color:var(--muted);font-weight:600;margin-left:6px">AUX</span>':ex.isAccessory?'<span style="font-size:10px;color:var(--blue);font-weight:600;margin-left:6px">BACK</span>':'';

    block.innerHTML=`
      <div class="exercise-header">
        <div class="exercise-name">${ex.name}${typeLabel}</div>
        <div style="display:flex;gap:4px">${swapBtn}<button class="btn btn-icon btn-secondary" onclick="removeEx(${ei})">\u2715</button></div>
      </div>
      <div class="last-session">${prevText}</div>
      ${badges}
      <div id="sets-${ei}"></div>
      <button class="btn btn-sm btn-secondary" style="margin-top:8px" onclick="addSet(${ei})">+ Set</button>`;
    c.appendChild(block);
    const sc=document.getElementById('sets-'+ei);
    ex.sets.forEach((set,si)=>{
      const row=document.createElement('div');row.className='set-row';
      const isAmrap=set.isAmrap;
      const mode=activeWorkout?.programMode||'sets';
      const isLastSet=si===ex.sets.length-1;
      const showRir=mode==='rir'&&isLastSet&&!ex.isAccessory;
      const setLabel=isAmrap?'MAX':String(si+1);
      const repVal=isAmrap&&set.reps==='AMRAP'?'':set.reps;
      if(isAmrap)row.style.cssText='background:rgba(167,139,250,0.12);border-radius:8px;padding:2px 0';
      row.innerHTML=`
        <span class="set-num"${isAmrap?' style="color:var(--purple);font-weight:800"':''}>${setLabel}</span>
        <input type="number" placeholder="kg" value="${set.weight}" onchange="updateSet(${ei},${si},'weight',this.value)" style="width:62px">
        <input type="number" placeholder="${isAmrap?'reps hit':'reps'}" value="${repVal}" onchange="updateSet(${ei},${si},'reps',this.value)" style="width:56px${isAmrap?';border-color:var(--purple)':''}">
        ${showRir?`<select onchange="updateSet(${ei},${si},'rir',this.value)" style="width:56px;padding:6px 4px;font-size:12px;border-radius:8px;background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.25);color:var(--blue);font-weight:700;text-align:center">
          <option value="">RIR</option><option value="0"${set.rir==='0'||set.rir===0?' selected':''}>0</option><option value="1"${set.rir==='1'||set.rir===1?' selected':''}>1</option><option value="2"${set.rir==='2'||set.rir===2?' selected':''}>2</option><option value="3"${set.rir==='3'||set.rir===3?' selected':''}>3</option><option value="4"${set.rir==='4'||set.rir===4?' selected':''}>4</option><option value="5"${set.rir==='5'||set.rir===5?' selected':''}>5+</option>
        </select>`:''}
        <div class="set-check ${set.done?'done':''}" onclick="toggleSet(${ei},${si})">\u2713</div>`;
      sc.appendChild(row);
    });
  });
}

function updateSet(ei,si,f,v){activeWorkout.exercises[ei].sets[si][f]=v;}

function toggleSet(ei,si){
  const set=activeWorkout.exercises[ei].sets[si];
  if(!set.done){
    set.done=true;renderExercises();
    startRestTimer();
  }else{
    set.done=false;set.rir=undefined;renderExercises();
  }
}

function addSet(ei){const ex=activeWorkout.exercises[ei];const l=ex.sets[ex.sets.length-1];ex.sets.push({weight:l?.weight||'',reps:l?.reps||5,done:false,rpe:null});renderExercises();}
function removeEx(ei){activeWorkout.exercises.splice(ei,1);renderExercises();}

function swapAuxExercise(ei){
  const ex=activeWorkout.exercises[ei];
  if(ex.auxSlotIdx<0)return;
  const prog=getActiveProgram();
  const swapInfo=prog.getAuxSwapOptions?prog.getAuxSwapOptions(ex):null;
  if(!swapInfo)return;
  const cat=swapInfo.category||'',opts=swapInfo.options||[];
  const title=cat?'Swap '+cat.charAt(0).toUpperCase()+cat.slice(1)+' Auxiliary':'Swap Exercise';
  let optHtml=opts.map(o=>`<div class="swap-option${o===ex.name?' swap-active':''}" onclick="doAuxSwap(${ei},'${o.replace(/'/g,"\\'")}',${ex.auxSlotIdx})">${o}</div>`).join('');
  showCustomModal(title,`<div style="max-height:300px;overflow-y:auto">${optHtml}</div>`);
}

function doAuxSwap(ei,newName,slotIdx){
  activeWorkout.exercises[ei].name=newName;
  const prog=getActiveProgram(),state=getActiveProgramState();
  const newState=prog.onAuxSwap?prog.onAuxSwap(slotIdx,newName,state):state;
  setProgramState(prog.id,newState);
  saveProfileData();
  closeCustomModal();renderExercises();
  showToast('Swapped to '+newName,'var(--purple)');
}

function swapBackExercise(ei){
  const prog=getActiveProgram();
  const opts=prog.getBackSwapOptions?prog.getBackSwapOptions():[];
  let optHtml=opts.map(o=>`<div class="swap-option${o===activeWorkout.exercises[ei].name?' swap-active':''}" onclick="doBackSwap(${ei},'${o.replace(/'/g,"\\'")}')"> ${o}</div>`).join('');
  showCustomModal('Swap Back Exercise',`<div style="max-height:300px;overflow-y:auto">${optHtml}</div>`);
}

function doBackSwap(ei,newName){
  activeWorkout.exercises[ei].name=newName;
  const prog=getActiveProgram(),state=getActiveProgramState();
  const newState=prog.onBackSwap?prog.onBackSwap(newName,state):state;
  setProgramState(prog.id,newState);
  saveProfileData();
  closeCustomModal();renderExercises();
  showToast('Swapped to '+newName,'var(--purple)');
}

function showCustomModal(title,bodyHtml){
  let m=document.getElementById('custom-swap-modal');
  if(m)m.remove();
  m=document.createElement('div');m.id='custom-swap-modal';
  m.style.cssText='position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.7);padding:20px';
  m.innerHTML=`<div style="background:var(--card);border:1px solid var(--border);border-radius:16px;padding:20px;max-width:340px;width:100%">
    <div style="font-weight:800;font-size:16px;margin-bottom:14px">${title}</div>
    ${bodyHtml}
    <button class="btn btn-secondary" style="margin-top:14px;width:100%" onclick="closeCustomModal()">Cancel</button>
  </div>`;
  m.onclick=e=>{if(e.target===m)closeCustomModal();};
  document.body.appendChild(m);
}

function closeCustomModal(){const m=document.getElementById('custom-swap-modal');if(m)m.remove();}

async function finishWorkout(){
  if(!activeWorkout.exercises.length){showToast('Add at least one exercise!','var(--orange)');return;}
  clearInterval(workoutTimer);skipRest();
  let totalSets=0;
  activeWorkout.exercises.forEach(e=>{totalSets+=e.sets.length;});

  const sessionRPE = await new Promise(resolve=>{
    showRPEPicker('Session',-1,(val)=>resolve(val||7));
  });

  const prog=getActiveProgram();
  const state=getActiveProgramState();

  // Structured state snapshot at session time (program-agnostic; used by history + analytics)
  const programMeta=prog.getWorkoutMeta?prog.getWorkoutMeta(state):{week:state.week,cycle:state.cycle};
  // Push workout record (keep legacy forge fields for history backwards-compat)
  workouts.push({id:Date.now(),date:new Date().toISOString(),
    program:prog.id,type:prog.id,
    programOption:activeWorkout.programOption,
    programDayNum:activeWorkout.programDayNum,
    programLabel:activeWorkout.programLabel||'',
    programMeta,
    forgeWeek:state.week||undefined,forgeDayNum:activeWorkout.programDayNum||undefined,
    duration:workoutSeconds,exercises:activeWorkout.exercises,rpe:sessionRPE,sets:totalSets});

  // Adjust program state (TMs, weights, failures, etc.)
  let newState=prog.adjustAfterSession?prog.adjustAfterSession(activeWorkout.exercises,state,activeWorkout.programOption):state;

  // Count sessions this week for advanceState
  const now=new Date(),sow=new Date(now);sow.setDate(now.getDate()-((now.getDay()+6)%7));sow.setHours(0,0,0,0);
  const sessionsThisWeek=workouts.filter(w=>(w.program===prog.id||(!w.program&&w.type===prog.id))&&new Date(w.date)>=sow).length;

  // Advance program state (week, cycle, A/B, etc.)
  const advancedState=prog.advanceState?prog.advanceState(newState,sessionsThisWeek):newState;

  // Toast on week or cycle advance (any program)
  if(advancedState.cycle!==undefined&&advancedState.cycle!==(newState.cycle)){
    const bi=prog.getBlockInfo?prog.getBlockInfo(advancedState):{name:''};
    setTimeout(()=>showToast(prog.name+' · Cycle '+advancedState.cycle+' starting — TMs updated!','var(--purple)'),500);
  } else if(advancedState.week!==undefined&&advancedState.week!==newState.week){
    const bi=prog.getBlockInfo?prog.getBlockInfo(advancedState):{name:'',weekLabel:''};
    setTimeout(()=>showToast(prog.name+' · '+(bi.name||'Week '+advancedState.week)+' up next!','var(--purple)'),500);
  }

  setProgramState(prog.id,advancedState);
  saveProfileData();
  await saveWorkouts();
  buildExerciseIndex();
  activeWorkout=null;
  document.getElementById('workout-not-started').style.display='block';
  document.getElementById('workout-active').style.display='none';
  resetNotStartedView();
  showToast('Session saved!');
  updateDashboard();
}

function cancelWorkout(){
  clearInterval(workoutTimer);skipRest();
  activeWorkout=null;
  document.getElementById('workout-not-started').style.display='block';
  document.getElementById('workout-active').style.display='none';
  resetNotStartedView();
}

// ── HISTORY ──────────────────────────────────────────────────
function switchHistoryTab(tab,e){
  document.querySelectorAll('#page-history .tab').forEach(t=>t.classList.remove('active'));
  e.target.classList.add('active');
  document.getElementById('history-log').style.display=tab==='log'?'block':'none';
  document.getElementById('history-stats').style.display=tab==='stats'?'block':'none';
  if(tab==='stats')updateStats();
}

// ── History helpers ──

function histLiftIcon(name){
  if(!name)return'🏋️';
  if(name.includes('Squat'))return'🦵';
  if(name.includes('Bench'))return'💪';
  if(name.includes('Deadlift'))return'⚡';
  if(name.includes('Press')||name.includes('OHP'))return'🔱';
  if(name.includes('Row'))return'🚣';
  return'🏋️';
}

// Build a Set of workout IDs that contain a rep PR on an AMRAP/last-heavy set
function histComputePRs(){
  const sorted=workouts.slice().sort((a,b)=>new Date(a.date)-new Date(b.date));
  const best={}; // "ExerciseName_weight" → maxReps seen so far
  const prs=new Set();
  for(const w of sorted){
    let hasPR=false;
    (w.exercises||[]).forEach(ex=>{
      ex.sets.forEach(s=>{
        if(!s.isLastHeavySet&&!s.isAmrap)return;
        if(!s.done)return;
        const reps=parseInt(s.reps);
        if(isNaN(reps)||reps<=0)return;
        const key=ex.name+'_'+(parseFloat(s.weight)||0);
        if(key in best&&reps>best[key])hasPR=true;
      });
    });
    if(hasPR)prs.add(w.id);
    // Update best AFTER checking so first occurrence never auto-qualifies
    (w.exercises||[]).forEach(ex=>{
      ex.sets.forEach(s=>{
        if(!s.isLastHeavySet&&!s.isAmrap)return;
        if(!s.done)return;
        const reps=parseInt(s.reps);
        if(isNaN(reps)||reps<=0)return;
        const key=ex.name+'_'+(parseFloat(s.weight)||0);
        if(!(key in best)||reps>best[key])best[key]=reps;
      });
    });
  }
  return prs;
}

// Estimate recovery (0-100) at time of each workout based on gap + prior RPE
function histComputeRecovery(){
  const sorted=workouts.filter(w=>w.type!=='hockey').sort((a,b)=>new Date(a.date)-new Date(b.date));
  const map={};
  let prev=null;
  for(const w of sorted){
    if(!prev){
      map[w.id]=85; // first session — assume well-rested
    } else {
      const gapDays=(new Date(w.date)-new Date(prev.date))/864e5;
      const prevRPE=prev.rpe||7;
      // Base: gap adds recovery, high-RPE sessions reduce it
      const raw=Math.round(40+(gapDays-1)*25-(prevRPE-7)*4);
      map[w.id]=Math.max(20,Math.min(95,raw));
    }
    prev=w;
  }
  return map;
}

// Group workouts into [{groupLabel, groupIcon, programId, weeks:[{weekLabel, workouts:[]}]}]
// Newest-first within each group and week
function histGroupWorkouts(){
  const groups=new Map();
  const sorted=workouts.slice().sort((a,b)=>new Date(b.date)-new Date(a.date));

  function addToGroup(key,groupLabel,groupIcon,programId,weekKey,weekLabel,w){
    if(!groups.has(key))groups.set(key,{key,groupLabel,groupIcon,programId,weeks:new Map()});
    const g=groups.get(key);
    if(!g.weeks.has(weekKey))g.weeks.set(weekKey,{weekKey,weekLabel,workouts:[]});
    g.weeks.get(weekKey).workouts.push(w);
  }

  for(const w of sorted){
    const isHockey=w.type==='hockey';
    if(isHockey){
      const mo=new Date(w.date).toLocaleDateString('en-GB',{month:'long',year:'numeric'});
      addToGroup('hockey-'+mo,'Hockey · '+mo,'🏒','hockey','all','',w);
      continue;
    }
    const prog=w.program||w.type||'other';
    const meta=w.programMeta||{};
    const cycle=meta.cycle;
    const week=meta.week||w.forgeWeek;

    if(prog==='wendler531'){
      const seasonMap={off:'Off-Season',in:'In-Season'};
      const seasonLabel=seasonMap[meta.season]||'';
      const gKey='w531-c'+(cycle||'x');
      const gLabel='5/3/1 · Cycle '+(cycle||'?')+(seasonLabel?' · '+seasonLabel:'');
      const gIcon=meta.season==='in'?'🏒':'🏗️';
      const weekMap={1:'5s Wave',2:'3s Wave',3:'5/3/1 Week',4:meta.testWeekPending?'TM Test':'Deload'};
      const wKey=week?'w'+week:'wx';
      const wLabel=week?'Week '+week+' · '+(weekMap[week]||''):'Ungrouped';
      addToGroup(gKey,gLabel,gIcon,'wendler531',wKey,wLabel,w);
    } else if(prog==='forge'){
      const blockNum=week<=7?1:week<=14?2:3;
      const blockNames={1:'Hypertrophy (Wks 1–7)',2:'Strength (Wks 8–14)',3:'Peaking (Wks 15–21)'};
      const gKey='forge-b'+blockNum;
      const gLabel='Forge · '+(blockNames[blockNum]||'Block '+blockNum);
      addToGroup(gKey,gLabel,'🔥','forge',week?'w'+week:'wx',week?'Week '+week:'Sessions',w);
    } else if(prog==='stronglifts5x5'){
      addToGroup('sl5x5','StrongLifts 5×5','📈','stronglifts5x5','all','',w);
    } else {
      addToGroup('other','Other Sessions','🏋️','other','all','',w);
    }
  }

  return [...groups.values()].map(g=>({...g,weeks:[...g.weeks.values()]}));
}

function histRecoveryStyle(pct){
  if(pct===null||pct===undefined)return null;
  if(pct>=70)return{color:'var(--green)',bg:'rgba(52,211,153,0.12)',border:'rgba(52,211,153,0.3)'};
  if(pct>=45)return{color:'var(--orange)',bg:'rgba(245,158,11,0.12)',border:'rgba(245,158,11,0.3)'};
  return{color:'var(--accent)',bg:'rgba(230,57,70,0.12)',border:'rgba(230,57,70,0.3)'};
}

function histRenderCard(w,isPR,recovery){
  const d=new Date(w.date);
  const dateStr=d.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'short'});
  const mins=Math.floor((w.duration||0)/60);
  const isHockey=w.type==='hockey';
  const isExtra=w.subtype==='extra';

  if(isHockey){
    const hLabel=isExtra?'Extra Hockey Practice':'Hockey Practice';
    return`<div class="hist-card hist-hockey-card">
      <div class="hist-card-header">
        <div class="hist-card-left">
          <span class="hist-lift-icon">🏒</span>
          <div>
            <div class="hist-card-title">${hLabel}</div>
            <div class="hist-card-date">${dateStr}</div>
            ${mins>0?`<div class="hist-hockey-duration">${mins} min</div>`:''}
          </div>
        </div>
        <div class="hist-card-badges">
          <button class="hist-delete-btn" onclick="deleteWorkout(${w.id})" title="Delete">✕</button>
        </div>
      </div>
    </div>`;
  }

  // Primary lift: first main-lift exercise
  const MAIN=['Squat','Bench Press','Deadlift','Overhead Press','OHP'];
  const mainEx=(w.exercises||[]).find(e=>MAIN.some(l=>e.name.includes(l)));
  const liftIcon=histLiftIcon(mainEx?.name||(w.exercises||[])[0]?.name||'');

  // Short label — strip emoji from programLabel if present
  const rawLabel=w.programLabel||'';
  const shortLabel=rawLabel.replace(/^[\u{1F300}-\u{1FFFF}\u2600-\u27FF]\s*/u,'').trim()||dateStr;

  // Tonnage
  let tonnage=0;
  (w.exercises||[]).forEach(ex=>{
    ex.sets.filter(s=>s.done).forEach(s=>{
      tonnage+=(parseFloat(s.weight)||0)*(parseInt(s.reps)||0);
    });
  });

  // Badges
  const prBadge=isPR?`<span class="hist-pr-badge">⭐ Rep PR</span>`:'';
  const rs=histRecoveryStyle(recovery);
  const recovBadge=rs?`<span class="hist-recovery-tag" style="background:${rs.bg};color:${rs.color};border-color:${rs.border}">${recovery}%</span>`:'';

  // Exercise rows
  const exRows=(w.exercises||[]).filter(ex=>ex.sets.some(s=>s.done)).map(ex=>{
    const done=ex.sets.filter(s=>s.done);
    const maxKg=Math.max(...done.map(s=>parseFloat(s.weight)||0));
    const lastHeavy=ex.sets.find(s=>s.isLastHeavySet&&s.done);
    const amrapStr=lastHeavy&&parseInt(lastHeavy.reps)>0
      ?` · <span class="hist-amrap-reps">${lastHeavy.reps}+ reps</span>` :'';
    return`<div class="hist-exercise-row">
      <span>${ex.name}</span>
      <span class="hist-exercise-vol">${done.length}×${maxKg>0?maxKg+'kg':'bw'}${amrapStr}</span>
    </div>`;
  }).join('');

  const tonnageStr=tonnage>0
    ?`<div class="hist-tonnage">${(tonnage/1000).toFixed(1)} t total volume</div>`:'';

  return`<div class="hist-card">
    <div class="hist-card-header">
      <div class="hist-card-left">
        <span class="hist-lift-icon">${liftIcon}</span>
        <div style="min-width:0">
          <div class="hist-card-title">${shortLabel}</div>
          <div class="hist-card-date">${dateStr}</div>
        </div>
      </div>
      <div class="hist-card-badges">
        ${prBadge}
        ${recovBadge}
        <span class="hist-meta-tag">${mins}min${w.rpe?' · RPE '+w.rpe:''}</span>
        <button class="hist-delete-btn" onclick="deleteWorkout(${w.id})" title="Delete">✕</button>
      </div>
    </div>
    ${exRows?`<div class="hist-exercises">${exRows}</div>`:''}
    ${tonnageStr}
  </div>`;
}

function histRenderWeekGroup(wk,isOpen,prSet,recovMap){
  if(!wk.weekLabel){
    // No week sub-grouping — render cards flat
    return wk.workouts.map(w=>histRenderCard(w,prSet.has(w.id),recovMap[w.id]??null)).join('');
  }
  const count=wk.workouts.length;
  const cards=wk.workouts.map(w=>histRenderCard(w,prSet.has(w.id),recovMap[w.id]??null)).join('');
  return`<details class="hist-week-details"${isOpen?' open':''}>
    <summary class="hist-week-toggle">
      <div class="hist-week-toggle-left">
        <span class="hist-week-chevron">▼</span>
        <span class="hist-week-label">${wk.weekLabel}</span>
      </div>
      <span class="hist-week-count">${count} session${count!==1?'s':''}</span>
    </summary>
    <div class="hist-week-body">${cards}</div>
  </details>`;
}

function histRenderGroup(g,prSet,recovMap){
  const total=g.weeks.reduce((n,wk)=>n+wk.workouts.length,0);
  const weeks=g.weeks.map((wk,i)=>histRenderWeekGroup(wk,i===0,prSet,recovMap)).join('');
  return`<div class="hist-cycle-group">
    <div class="hist-cycle-header">
      <span class="hist-cycle-icon">${g.groupIcon}</span>
      <div>
        <div class="hist-cycle-label">${g.groupLabel}</div>
        <div class="hist-cycle-sub">${total} session${total!==1?'s':''}</div>
      </div>
    </div>
    ${weeks}
  </div>`;
}

function histEmptyState(){
  const prog=getActiveProgram();
  const state=getActiveProgramState();
  const bi=prog.getBlockInfo?prog.getBlockInfo(state):null;
  const phaseCard=bi&&(bi.name||bi.modeDesc||bi.weekLabel)?`
    <div class="hist-phase-card">
      <div class="hist-phase-card-label">Current Phase</div>
      <div class="hist-phase-card-name">${bi.name||bi.weekLabel||'Week '+state.week}</div>
      ${bi.modeDesc?`<div class="hist-phase-card-desc">${bi.modeDesc}</div>`:''}
    </div>`:'';
  return`<div class="hist-empty">
    <div class="hist-empty-icon">📋</div>
    <div class="hist-empty-title">No sessions yet</div>
    <div class="hist-empty-sub">Complete your first workout to start building your training history.</div>
    <button class="btn btn-primary hist-empty-cta" onclick="showPage('log',document.querySelectorAll('.nav-btn')[1])">Start Today's Workout</button>
    ${phaseCard}
  </div>`;
}

function renderHeatmap(){
  const el=document.getElementById('history-heatmap');
  if(!el)return;

  const WEEKS=10;
  const today=new Date();today.setHours(0,0,0,0);

  // Monday of the current week
  const dow=(today.getDay()+6)%7; // 0=Mon … 6=Sun
  const weekStart=new Date(today);weekStart.setDate(today.getDate()-dow);

  // Grid starts WEEKS weeks back (Monday)
  const gridStart=new Date(weekStart);gridStart.setDate(weekStart.getDate()-(WEEKS-1)*7);

  // Map each calendar date to what was trained
  const dayMap={};
  workouts.forEach(w=>{
    const d=new Date(w.date);d.setHours(0,0,0,0);
    const k=d.toISOString().slice(0,10);
    if(!dayMap[k])dayMap[k]={lift:false,hockey:false};
    if(w.type==='hockey')dayMap[k].hockey=true;
    else dayMap[k].lift=true;
  });

  // Build 70 cells (WEEKS × 7 days)
  const cells=[];
  for(let i=0;i<WEEKS*7;i++){
    const d=new Date(gridStart);d.setDate(gridStart.getDate()+i);
    const k=d.toISOString().slice(0,10);
    cells.push({k,isToday:d.getTime()===today.getTime(),isFuture:d>today,...(dayMap[k]||{})});
  }

  // Week streak: consecutive weeks (newest first) with ≥1 lift
  let weekStreak=0;
  for(let i=0;i<WEEKS;i++){
    const ws=new Date(weekStart);ws.setDate(weekStart.getDate()-i*7);
    const we=new Date(ws);we.setDate(ws.getDate()+6);
    const hasLift=workouts.some(w=>{
      if(w.type==='hockey')return false;
      const wd=new Date(w.date);wd.setHours(0,0,0,0);
      return wd>=ws&&wd<=we;
    });
    if(hasLift){weekStreak++;}
    else if(i===0){/* current week not started yet — don't break streak */}
    else{break;}
  }

  // Sessions per week over last 28 days
  const cut28=new Date(today);cut28.setDate(today.getDate()-27);
  const last28=workouts.filter(w=>w.type!=='hockey'&&new Date(w.date)>=cut28).length;
  const perWeek=(last28/4).toFixed(1);

  const DAY_LABELS=['M','T','W','T','F','S','S'];
  const labelCells=DAY_LABELS.map(l=>`<div class="heatmap-day-label">${l}</div>`).join('');
  const gridCells=cells.map(c=>{
    let cls='heatmap-cell';
    if(c.isFuture)cls+=' future';
    else if(c.lift&&c.hockey)cls+=' both';
    else if(c.lift)cls+=' lift';
    else if(c.hockey)cls+=' hockey';
    if(c.isToday)cls+=' today';
    return`<div class="${cls}"></div>`;
  }).join('');

  const streakHtml=weekStreak>0
    ?`<span class="heatmap-stat"><span class="heatmap-stat-val">${weekStreak}w</span> streak</span>`
    :`<span class="heatmap-stat" style="color:var(--muted)">No streak yet</span>`;
  const rateHtml=`<span class="heatmap-stat"><span class="heatmap-stat-val">${perWeek}</span> lifts/wk</span>`;

  const legendHtml=`<div class="heatmap-legend">
    <div class="heatmap-legend-item"><div class="heatmap-legend-dot" style="background:var(--accent2)"></div>Lift</div>
    <div class="heatmap-legend-item"><div class="heatmap-legend-dot" style="background:var(--blue)"></div>Hockey</div>
    <div class="heatmap-legend-item"><div class="heatmap-legend-dot" style="background:var(--purple)"></div>Both</div>
  </div>`;

  el.innerHTML=`<div class="heatmap-wrap">
    <div class="heatmap-grid">${labelCells}</div>
    <div class="heatmap-grid">${gridCells}</div>
    <div class="heatmap-foot">
      <div class="heatmap-stats">${streakHtml}${rateHtml}</div>
      ${legendHtml}
    </div>
  </div>`;
}

function renderHistory(){
  renderHeatmap();
  const list=document.getElementById('history-list');
  if(!workouts.length){list.innerHTML=histEmptyState();return;}
  const prSet=histComputePRs();
  const recovMap=histComputeRecovery();
  const groups=histGroupWorkouts();
  list.innerHTML=groups.map(g=>histRenderGroup(g,prSet,recovMap)).join('');
}

function deleteWorkout(id){
  const w=workouts.find(w=>w.id===id);
  if(!w)return;
  const d=new Date(w.date);
  const label=w.type==='hockey'?'Hockey session':'Workout';
  const dateStr=d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});
  showConfirm('Delete '+label,'Remove '+label.toLowerCase()+' from '+dateStr+'?',async()=>{
    const backup=workouts.find(x=>x.id===id);
    workouts=workouts.filter(x=>x.id!==id);
    buildExerciseIndex();
    await saveWorkouts();
    renderHistory();updateStats();updateDashboard();
    showToast('Session deleted','var(--muted)',async()=>{
      workouts.push(backup);
      workouts.sort((a,b)=>new Date(a.date)-new Date(b.date));
      buildExerciseIndex();
      await saveWorkouts();
      renderHistory();updateStats();updateDashboard();
      showToast('Session restored!','var(--green)');
    });
  });
}

function updateStats(){
  document.getElementById('stat-total').textContent=workouts.length;
  document.getElementById('stat-hockey').textContent=workouts.filter(w=>w.type==='hockey').length;
  const m=new Date().getMonth();let s=0;
  workouts.filter(w=>new Date(w.date).getMonth()===m&&w.type!=='hockey').forEach(w=>w.exercises?.forEach(e=>s+=e.sets.length));
  document.getElementById('stat-sets').textContent=s;
  const allRPE=workouts.filter(w=>w.rpe).map(w=>w.rpe);
  document.getElementById('stat-rpe').textContent=allRPE.length?(allRPE.reduce((a,b)=>a+b,0)/allRPE.length).toFixed(1):'—';
}

// ── SETTINGS ─────────────────────────────────────────────────
function initSettings(){
  {const grid=document.getElementById('hockey-day-toggles');grid.innerHTML='';
    for(let i=0;i<7;i++){
      const dow=(i+1)%7,active=schedule.hockeyDays.includes(dow);
      grid.innerHTML+=`<div class="day-toggle ${active?'hockey-day':''}" onclick="toggleDay('hockey',${dow},this)">${DAY_NAMES[dow]}</div>`;
    }
  }
  document.getElementById('default-rest').value=profile.defaultRest||120;
  renderProgramSwitcher();
  const prog=getActiveProgram(),state=getActiveProgramState();
  const container=document.getElementById('program-settings-container');
  if(container&&prog.renderSettings)prog.renderSettings(state,container);
}

function renderProgramSwitcher(){
  const container=document.getElementById('program-switcher-container');if(!container)return;
  const active=profile.activeProgram||'forge';
  container.innerHTML=Object.values(PROGRAMS).map(p=>`
    <div class="program-card${p.id===active?' active':''}" onclick="switchProgram('${p.id}')">
      <div class="program-card-icon">${p.icon||'🏋️'}</div>
      <div style="flex:1;min-width:0">
        <div class="program-card-name">${p.name}</div>
        <div class="program-card-desc">${p.description}</div>
      </div>
      ${p.id===active?'<div class="program-card-badge">Active</div>':''}
    </div>`).join('');
}

function switchProgram(id){
  if(id===profile.activeProgram)return;
  const prog=PROGRAMS[id];if(!prog)return;
  showConfirm('Switch to '+prog.name,'Your current program is paused. '+prog.name+' will start where you left off.',()=>{
    profile.activeProgram=id;
    if(!profile.programs)profile.programs={};
    if(!profile.programs[id])profile.programs[id]=prog.getInitialState();
    saveProfileData();
    initSettings();
    updateDashboard();
    showToast('Switched to '+prog.name,'var(--purple)');
  });
}

function saveProgramSetup(){
  const prog=getActiveProgram(),state=getActiveProgramState();
  const newState=prog.saveSettings?prog.saveSettings(state):state;
  setProgramState(prog.id,newState);
  saveProfileData();
  showToast('Program setup saved!','var(--purple)');
  updateProgramDisplay();
}

function updateProgramLift(array,idx,field,val){
  const prog=getActiveProgram(),state=getActiveProgramState();
  if(!state.lifts||!state.lifts[array]||!state.lifts[array][idx])return;
  const newState=JSON.parse(JSON.stringify(state));
  newState.lifts[array][idx][field]=val;
  setProgramState(prog.id,newState);
}

function updateSLLift(key,val){
  const prog=getActiveProgram(),state=getActiveProgramState();
  const newState=JSON.parse(JSON.stringify(state));
  if(newState.lifts&&newState.lifts[key])newState.lifts[key].weight=val;
  setProgramState(prog.id,newState);
}

function setSLNextWorkout(wk){
  const prog=getActiveProgram(),state=getActiveProgramState();
  setProgramState(prog.id,{...state,nextWorkout:wk});
  initSettings();
}

function previewProgramSplit(){
  const prog=getActiveProgram(),state=getActiveProgramState();
  if(prog._previewSplit){
    const freq=parseInt(document.getElementById('prog-days')?.value)||state.daysPerWeek||3;
    prog._previewSplit(freq,state.lifts);
  }
}

function updateForgeModeSetting(){
  const prog=getActiveProgram();
  const mode=document.getElementById('prog-mode')?.value||'sets';
  if(prog._updateModeDesc)prog._updateModeDesc(mode);
}

function updateProgramDisplay(){
  const prog=getActiveProgram(),state=getActiveProgramState();
  const ds=document.getElementById('program-day-select');if(!ds)return;
  // Preserve any selection the user has already made before rebuilding the list
  const prevVal=ds.value;
  const options=prog.getSessionOptions?prog.getSessionOptions(state,workouts,schedule):[];
  ds.innerHTML='';
  const recommended=options.find(o=>o.isRecommended)||options[0];
  // Use user's current pick if it still exists in the option list; otherwise recommend
  const hasMatch=prevVal&&options.some(o=>o.value===prevVal);
  options.forEach(o=>{
    const opt=document.createElement('option');
    opt.value=o.value;opt.textContent=o.label;
    if(hasMatch?o.value===prevVal:o===recommended)opt.selected=true;
    if(o.done)opt.style.color='var(--muted)';
    ds.appendChild(opt);
  });
  const info=document.getElementById('program-week-display');
  if(info&&prog.getBlockInfo){
    const bi=prog.getBlockInfo(state);
    info.innerHTML=`${prog.icon||'🏋️'} <strong>${prog.name}</strong> · ${bi.name} · ${bi.weekLabel}${bi.pct?` · <span style="color:var(--purple)">${bi.pct}% TM</span>`:''}${bi.modeName?` · <span style="color:var(--purple)">${bi.modeName}</span>`:''}${bi.modeDesc?`<br><span style="font-size:11px">${bi.modeDesc}</span>`:''}`;
  }
  let banner=document.getElementById('program-recommend-banner');
  if(!banner){
    banner=document.createElement('div');banner.id='program-recommend-banner';
    banner.style.cssText='margin-top:10px;padding:10px 12px;border-radius:10px;font-size:12px';
    const ref=document.getElementById('program-week-display');
    if(ref)ref.parentNode.insertBefore(banner,ref.nextSibling);
  }
  const fatigue=computeFatigue();
  const bHTML=prog.getBannerHTML?prog.getBannerHTML(options,state,schedule,workouts,fatigue):null;
  if(bHTML&&banner){
    banner.style.background=bHTML.style;banner.style.border='1px solid '+bHTML.border;
    banner.style.color=bHTML.color;banner.innerHTML=bHTML.html;
  }
}

function onDaySelectChange(){updateProgramDisplay();}

function toggleDay(kind,dow,el){
  const key=kind+'Days';
  if(el.classList.contains(kind+'-day')){el.classList.remove(kind+'-day');schedule[key]=schedule[key].filter(d=>d!==dow);}
  else{el.classList.add(kind+'-day');if(!schedule[key].includes(dow))schedule[key].push(dow);}
}

function saveSchedule(){
  profile.defaultRest=parseInt(document.getElementById('default-rest').value)||120;
  restDuration=profile.defaultRest;
  saveScheduleData();saveProfileData();updateProgramDisplay();updateDashboard();showToast('Settings saved!','var(--blue)');
}

function exportData(){
  const data={version:1,exported:new Date().toISOString(),workouts,schedule,profile};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download="ironforge-backup-"+new Date().toISOString().slice(0,10)+".json";
  a.click();URL.revokeObjectURL(url);
  showToast("Backup exported!","var(--green)");
}

function importData(event){
  const file=event.target.files[0];
  if(!file)return;
  const reader=new FileReader();
  reader.onload=async(e)=>{
    try{
      const data=JSON.parse(e.target.result);
      if(typeof data!=='object'||!data){showToast('Invalid backup file','var(--orange)');return;}
      if(!Array.isArray(data.workouts)&&!data.profile){showToast('Invalid backup file','var(--orange)');return;}
      if(data.workouts&&!Array.isArray(data.workouts)){showToast('Backup file has invalid workout data','var(--orange)');return;}
      if(data.workouts){const bad=data.workouts.some(w=>!w.id||!w.date||!w.type||!Array.isArray(w.exercises));if(bad){showToast('Backup file has malformed workout entries','var(--orange)');return;}}
      if(data.profile&&typeof data.profile!=='object'){showToast('Backup file has invalid profile data','var(--orange)');return;}
      showConfirm("Import Data","Replace all data with backup from "+(data.exported?new Date(data.exported).toLocaleDateString():"unknown")+"?",async()=>{
        if(data.workouts) workouts=data.workouts;
        if(data.schedule) schedule=data.schedule;
        if(data.profile) profile=data.profile;
        await saveWorkouts();await saveScheduleData();await saveProfileData();
        showToast("Data imported! Reloading...","var(--green)");
        setTimeout(()=>location.reload(),1000);
      });
    }catch(err){showToast("Could not read file","var(--orange)");}
  };
  reader.readAsText(file);
  event.target.value="";
}

async function clearAllData(){
  try{localStorage.removeItem('ic_workouts');localStorage.removeItem('ic_schedule');localStorage.removeItem('ic_profile');}catch(e){}
  workouts=[];schedule={hockeyDays:[]};
  profile={defaultRest:120,activeProgram:'forge',programs:{}};
  Object.values(PROGRAMS).forEach(prog=>{profile.programs[prog.id]=prog.getInitialState();});
  updateDashboard();showToast('All data cleared','var(--accent)');
}

// ── INIT ─────────────────────────────────────────────────────
initAuth();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js'); });
}
