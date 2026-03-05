const DAY_NAMES=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// SUPABASE
const _SB=supabase.createClient(
  'https://koreqcjrpzcbfgkptvfx.supabase.co',
  'sb_publishable_Ccuq9Bwyxmyy4JfrWqXlhg_qiWmCYpn'
);
let currentUser=null;

// STATE (persisted via localStorage)
let workouts=[];
let schedule={sportName:'Hockey',sportDays:[],sportIntensity:'hard',sportLegsHeavy:true};
let profile={defaultRest:120};
let activeWorkout=null, workoutTimer=null, workoutSeconds=0;
let restInterval=null, restSecondsLeft=0, restTotal=0, restDuration=120;
let pendingRPECallback=null;
let confirmCallback=null;
let nameModalCallback=null;
let _toastTimeout=null;
let exerciseIndex={};

const RPE_FEELS={6:'Easy',7:'Moderate',8:'Hard',9:'Very Hard',10:'Max'};
function logWarn(context,error){console.warn('[Ironforge]',context,error);}

// PROGRAM REGISTRY
// Programs (loaded via <script> tags after this file) call registerProgram() to self-register.
// Program registry/state helpers moved to core/program-layer.js.

// FATIGUE ENGINE CONFIG
// Separate from program definitions - these are app-wide constants
const FATIGUE_CONFIG={
  muscularBase:40,muscularDecay:15,
  cnsBase:50,cnsDecay:20,
  setsWeight:3,
  rpeWeight:8
};

// Sport/cardio intensity fatigue bonuses
const SPORT_INTENSITY={
  easy:    {muscularBonus:6, cnsBonus:4, extraCns:2, recentHours:18},
  moderate:{muscularBonus:12,cnsBonus:9, extraCns:5, recentHours:24},
  hard:    {muscularBonus:20,cnsBonus:15,extraCns:10,recentHours:30},
};
function getSportConfig(){return SPORT_INTENSITY[schedule.sportIntensity||'hard']||SPORT_INTENSITY.hard;}



// Data/auth lifecycle functions moved to core/data-layer.js.

// NAV
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

// CONFIRM MODAL
function showConfirm(title,msg,cb){
  document.getElementById('confirm-title').textContent=title;
  document.getElementById('confirm-msg').textContent=msg;
  confirmCallback=cb;
  document.getElementById('confirm-modal').classList.add('active');
}
function confirmOk(){document.getElementById('confirm-modal').classList.remove('active');if(confirmCallback)confirmCallback();confirmCallback=null;}
function confirmCancel(){document.getElementById('confirm-modal').classList.remove('active');confirmCallback=null;}

// NAME INPUT MODAL
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

// REST TIMER
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

// RPE MODAL
function showRPEPicker(exName,setNum,cb){
  pendingRPECallback=cb;
  document.getElementById('rpe-modal-sub').textContent=setNum<0?'Rate overall session effort (6 = easy, 10 = max)':exName+' - Set '+(setNum+1);
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

// FATIGUE ENGINE
// Dashboard/fatigue/data helpers moved to core/dashboard-layer.js.



// Workout/session engine moved to core/workout-layer.js.

// HISTORY
// History/analytics helpers moved to core/history-layer.js.

// SETTINGS
function renderSportDayToggles(){
  const grid=document.getElementById('sport-day-toggles');if(!grid)return;
  grid.innerHTML='';
  for(let i=0;i<7;i++){
    const dow=(i+1)%7,active=schedule.sportDays.includes(dow);
    grid.innerHTML+=`<div class="day-toggle ${active?'sport-day':''}" onclick="toggleDay('sport',${dow},this)">${DAY_NAMES[dow]}</div>`;
  }
}
function setSportIntensity(val,el){
  schedule.sportIntensity=val;
  document.querySelectorAll('#sport-intensity-btns button').forEach(b=>b.classList.remove('active'));
  if(el)el.classList.add('active');
}
function initSettings(){
  {const inp=document.getElementById('sport-name');if(inp)inp.value=schedule.sportName||'Hockey';}
  {const btns=document.querySelectorAll('#sport-intensity-btns button');
    btns.forEach(b=>{b.classList.toggle('active',b.dataset.intensity===(schedule.sportIntensity||'hard'));});
  }
  {const cb=document.getElementById('sport-legs-heavy');if(cb)cb.checked=schedule.sportLegsHeavy!==false;}
  renderSportDayToggles();
  document.getElementById('default-rest').value=profile.defaultRest||120;
  renderProgramSwitcher();
  const prog=getActiveProgram(),state=getActiveProgramState();
  const container=document.getElementById('program-settings-container');
  if(container&&prog.renderSettings)prog.renderSettings(state,container);
}

// Program UI/state helpers moved to core/program-layer.js.

function toggleDay(kind,dow,el){
  const key=kind==='sport'?'sportDays':kind+'Days';
  const cls=kind+'-day';
  if(el.classList.contains(cls)){el.classList.remove(cls);schedule[key]=schedule[key].filter(d=>d!==dow);}
  else{el.classList.add(cls);if(!schedule[key])schedule[key]=[];if(!schedule[key].includes(dow))schedule[key].push(dow);}
}

function saveSchedule(){
  const nameInp=document.getElementById('sport-name');
  if(nameInp)schedule.sportName=nameInp.value.trim()||'Sport';
  const cb=document.getElementById('sport-legs-heavy');
  if(cb)schedule.sportLegsHeavy=cb.checked;
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
  workouts=[];schedule={sportName:'Hockey',sportDays:[],sportIntensity:'hard',sportLegsHeavy:true};
  profile={defaultRest:120,activeProgram:'forge',programs:{}};
  Object.values(PROGRAMS).forEach(prog=>{profile.programs[prog.id]=prog.getInitialState();});
  updateDashboard();showToast('All data cleared','var(--accent)');
}

// INIT
initAuth();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js'); });
}
