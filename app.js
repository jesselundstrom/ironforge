let DAY_NAMES=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
function refreshDayNames(){
  DAY_NAMES=[
    tr('day.sun.short','Sun'),
    tr('day.mon.short','Mon'),
    tr('day.tue.short','Tue'),
    tr('day.wed.short','Wed'),
    tr('day.thu.short','Thu'),
    tr('day.fri.short','Fri'),
    tr('day.sat.short','Sat')
  ];
}

// SUPABASE
const _SB=supabase.createClient(
  'https://koreqcjrpzcbfgkptvfx.supabase.co',
  'sb_publishable_Ccuq9Bwyxmyy4JfrWqXlhg_qiWmCYpn'
);
let currentUser=null;

// STATE (persisted via localStorage)
let workouts=[];
let schedule={sportName:'Hockey',sportDays:[],sportIntensity:'hard',sportLegsHeavy:true};
let profile={defaultRest:120,language:(window.I18N&&I18N.getLanguage?I18N.getLanguage():'en')};
let activeWorkout=null, workoutTimer=null, workoutSeconds=0;
let restInterval=null, restSecondsLeft=0, restTotal=0, restDuration=120;
let pendingRPECallback=null;
let confirmCallback=null;
let nameModalCallback=null;
let _toastTimeout=null;
let exerciseIndex={};

const RPE_FEELS={6:'Easy',7:'Moderate',8:'Hard',9:'Very Hard',10:'Max'};
function logWarn(context,error){console.warn('[Ironforge]',context,error);}
function tr(key,fallback,params){
  if(window.I18N)return I18N.t(key,params,fallback);
  return fallback;
}

refreshDayNames();

// LOGIN SPARKS CANVAS
const loginSparks=(()=>{
  const MIN_EMBERS=18;
  const MAX_EMBERS=34;
  const COLOR_A=[255,122,58];
  const COLOR_B=[255,176,103];

  let canvas=null;
  let ctx=null;
  let embers=[];
  let width=0;
  let height=0;
  let dpr=1;
  let animationId=0;
  let isRunning=false;
  let lastTs=0;
  let reducedMotionQuery=null;
  let isReducedMotion=false;

  function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
  function lerp(a,b,t){return a+(b-a)*t;}

  function emberColor(t,alpha){
    const r=Math.round(lerp(COLOR_A[0],COLOR_B[0],t));
    const g=Math.round(lerp(COLOR_A[1],COLOR_B[1],t));
    const b=Math.round(lerp(COLOR_A[2],COLOR_B[2],t));
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function resetEmber(ember,initial){
    const fromForge=Math.random()<0.82;
    const originX=width*0.5;
    const spread=fromForge?width*0.32:width*0.72;

    ember.size=fromForge?(0.8+Math.random()*1.8):(0.6+Math.random()*1.2);
    ember.x=fromForge
      ? originX+((Math.random()-0.5)*spread)
      : Math.random()*width;
    ember.y=initial
      ? (fromForge?(height*0.64+Math.random()*height*0.22):(height*0.4+Math.random()*height*0.36))
      : (fromForge?(height*0.8+Math.random()*height*0.12):(height*0.58+Math.random()*height*0.24));
    ember.speed=fromForge?(8+Math.random()*16):(6+Math.random()*10);
    ember.drift=(Math.random()-0.5)*(fromForge?8:4);
    ember.phase=Math.random()*Math.PI*2;
    ember.wiggle=0.35+Math.random()*0.95;
    ember.life=0.55+Math.random()*0.95;
    ember.alpha=fromForge?(0.24+Math.random()*0.36):(0.16+Math.random()*0.22);
    ember.t=Math.random();
  }

  function resize(){
    if(!canvas||!ctx)return;
    const rect=canvas.getBoundingClientRect();
    width=Math.max(1,Math.floor(rect.width));
    height=Math.max(1,Math.floor(rect.height));
    dpr=clamp(window.devicePixelRatio||1,1,1.75);
    canvas.width=Math.floor(width*dpr);
    canvas.height=Math.floor(height*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    if(!embers.length){
      const total=Math.floor(lerp(MIN_EMBERS,MAX_EMBERS,Math.random()));
      embers=Array.from({length:total},()=>{
        const ember={};
        resetEmber(ember,true);
        return ember;
      });
    }
  }

  function draw(ts){
    if(!isRunning||!ctx)return;
    if(!lastTs)lastTs=ts;
    const dt=Math.min((ts-lastTs)/1000,0.033);
    lastTs=ts;

    ctx.clearRect(0,0,width,height);
    for(let i=0;i<embers.length;i++){
      const e=embers[i];
      e.y-=e.speed*dt;
      e.x+=(e.drift+Math.sin(ts*0.0012+e.phase)*e.wiggle*3.8)*dt;
      e.life-=dt*0.22;
      e.alpha=Math.max(0,e.alpha-dt*0.024);

      if(e.y<-10||e.life<=0||e.alpha<=0){
        resetEmber(e,false);
      }

      const fadeTop=clamp((height-e.y)/(height*0.9),0,1);
      const alpha=e.alpha*(1-fadeTop*0.88);
      if(alpha<=0.01)continue;

      ctx.beginPath();
      ctx.globalCompositeOperation='lighter';
      ctx.fillStyle=emberColor(e.t,alpha);
      ctx.shadowColor=emberColor(e.t,alpha*0.6);
      ctx.shadowBlur=3;
      ctx.arc(e.x,e.y,e.size,0,Math.PI*2);
      ctx.fill();
    }
    const forgeGlow=ctx.createRadialGradient(width*0.5,height*0.82,8,width*0.5,height*0.82,height*0.2);
    forgeGlow.addColorStop(0,'rgba(255,132,46,0.18)');
    forgeGlow.addColorStop(0.52,'rgba(255,120,40,0.09)');
    forgeGlow.addColorStop(1,'rgba(0,0,0,0)');
    ctx.globalCompositeOperation='screen';
    ctx.fillStyle=forgeGlow;
    ctx.fillRect(0,0,width,height);

    ctx.shadowBlur=0;
    animationId=requestAnimationFrame(draw);
  }

  function start(){
    if(isRunning)return;
    canvas=document.getElementById('sparks');
    if(!canvas)return;
    ctx=canvas.getContext('2d');
    if(!ctx)return;

    reducedMotionQuery=window.matchMedia('(prefers-reduced-motion: reduce)');
    isReducedMotion=!!reducedMotionQuery.matches;
    if(reducedMotionQuery.addEventListener){
      reducedMotionQuery.addEventListener('change',onMotionPreferenceChange);
    }else if(reducedMotionQuery.addListener){
      reducedMotionQuery.addListener(onMotionPreferenceChange);
    }
    resize();
    if(isReducedMotion)return;
    lastTs=0;
    isRunning=true;
    window.addEventListener('resize',resize);
    animationId=requestAnimationFrame(draw);
  }

  function onMotionPreferenceChange(e){
    isReducedMotion=!!e.matches;
    if(isReducedMotion){
      isRunning=false;
      if(animationId)cancelAnimationFrame(animationId);
      animationId=0;
      lastTs=0;
      window.removeEventListener('resize',resize);
      if(ctx&&width&&height)ctx.clearRect(0,0,width,height);
      return;
    }
    if(!isRunning&&canvas&&ctx){
      resize();
      lastTs=0;
      isRunning=true;
      window.addEventListener('resize',resize);
      animationId=requestAnimationFrame(draw);
    }
  }

  function stop(){
    isRunning=false;
    if(animationId)cancelAnimationFrame(animationId);
    animationId=0;
    lastTs=0;
    if(reducedMotionQuery){
      if(reducedMotionQuery.removeEventListener){
        reducedMotionQuery.removeEventListener('change',onMotionPreferenceChange);
      }else if(reducedMotionQuery.removeListener){
        reducedMotionQuery.removeListener(onMotionPreferenceChange);
      }
    }
    reducedMotionQuery=null;
    window.removeEventListener('resize',resize);
    if(ctx&&width&&height)ctx.clearRect(0,0,width,height);
  }

  return{start,stop};
})();

window.startLoginSparks=()=>loginSparks.start();
window.stopLoginSparks=()=>loginSparks.stop();

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
  const contentScroller=document.querySelector('.content');
  if(contentScroller)contentScroller.scrollTo({top:0,behavior:'auto'});
  if(name==='dashboard') updateDashboard();
  if(name==='history') renderHistory();
  if(name==='settings') initSettings();
  if(name==='log'){
    if(!activeWorkout)resetNotStartedView();
  }
}
function goToLog(){showPage('log',document.querySelectorAll('.nav-btn')[1]);}



function showToast(msg,color,undoFn){
  const t=document.getElementById('toast');
  clearTimeout(_toastTimeout);
  t.style.background=color||'var(--green)';
  if(undoFn){
    t.style.pointerEvents='auto';
    t.innerHTML=msg+' <span id="t-undo" style="background:rgba(255,255,255,0.2);border-radius:6px;padding:2px 10px;margin-left:6px;cursor:pointer;font-weight:700;font-size:13px">'+tr('common.undo','Undo')+'</span>';
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
  document.getElementById('name-modal-title').textContent=title||tr('modal.name.title','Add Exercise');
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
  el.className='rest-timer-count done';el.textContent=tr('dashboard.badge.go','GO');
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
  document.getElementById('rpe-modal-sub').textContent=setNum<0?tr('rpe.session_prompt','Rate overall session effort (6 = easy, 10 = max)'):exName+' - '+tr('rpe.set','Set')+' '+(setNum+1);
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
let _settingsTab='schedule';
function showSettingsTab(name,el){
  _settingsTab=name;
  ['schedule','program','account'].forEach(t=>{
    const d=document.getElementById('settings-tab-'+t);
    if(d)d.style.display=t===name?'':'none';
  });
  document.querySelectorAll('#settings-tabs .tab').forEach((t,i)=>{
    t.classList.toggle('active',['schedule','program','account'][i]===name);
  });
}
function openProgramSetupSheet(){
  const prog=getActiveProgram(),state=getActiveProgramState();
  const container=document.getElementById('program-settings-container');
  if(container&&prog.renderSettings)prog.renderSettings(state,container);
  const title=document.getElementById('program-setup-sheet-title');
  if(title)title.textContent=prog.name+' '+tr('settings.program_setup_suffix','Setup');
  document.getElementById('program-setup-sheet').classList.add('active');
}
function closeProgramSetupSheet(e){
  if(!e||e.target.id==='program-setup-sheet'){
    document.getElementById('program-setup-sheet').classList.remove('active');
  }
}
function initSettings(){
  refreshDayNames();
  {const inp=document.getElementById('sport-name');if(inp)inp.value=schedule.sportName||'Hockey';}
  {const btns=document.querySelectorAll('#sport-intensity-btns button');
    btns.forEach(b=>{b.classList.toggle('active',b.dataset.intensity===(schedule.sportIntensity||'hard'));});
  }
  {const cb=document.getElementById('sport-legs-heavy');if(cb)cb.checked=schedule.sportLegsHeavy!==false;}
  {
    const langSel=document.getElementById('app-language');
    if(langSel)langSel.value=profile.language||(window.I18N&&I18N.getLanguage?I18N.getLanguage():'en');
  }
  renderSportDayToggles();
  document.getElementById('default-rest').value=profile.defaultRest||120;
  renderProgramSwitcher();
  showSettingsTab(_settingsTab);
  if(window.I18N&&I18N.applyTranslations)I18N.applyTranslations(document);
}

// Program UI/state helpers moved to core/program-layer.js.

function toggleDay(kind,dow,el){
  const key=kind==='sport'?'sportDays':kind+'Days';
  const cls=kind+'-day';
  if(el.classList.contains(cls)){el.classList.remove(cls);schedule[key]=schedule[key].filter(d=>d!==dow);}
  else{el.classList.add(cls);if(!schedule[key])schedule[key]=[];if(!schedule[key].includes(dow))schedule[key].push(dow);}
}

function saveRestTimer(){
  profile.defaultRest=parseInt(document.getElementById('default-rest').value)||120;
  restDuration=profile.defaultRest;
  saveProfileData();
  showToast(tr('toast.rest_updated','Rest timer updated'),'var(--blue)');
}
function saveLanguageSetting(){
  const lang=document.getElementById('app-language')?.value||'en';
  if(window.I18N&&I18N.setLanguage)I18N.setLanguage(lang,{persist:true});
  profile.language=lang;
  saveProfileData();
  const msg=window.I18N&&I18N.t?I18N.t('settings.language.saved'):'Language updated';
  showToast(msg,'var(--blue)');
}
function saveSchedule(){
  const nameInp=document.getElementById('sport-name');
  if(nameInp)schedule.sportName=nameInp.value.trim()||'Sport';
  const cb=document.getElementById('sport-legs-heavy');
  if(cb)schedule.sportLegsHeavy=cb.checked;
  if(!activeWorkout)resetNotStartedView();
  saveScheduleData();saveProfileData();updateProgramDisplay();updateDashboard();showToast(tr('toast.schedule_saved','Schedule saved!'),'var(--blue)');
}

function exportData(){
  const data={version:1,exported:new Date().toISOString(),workouts,schedule,profile};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download="ironforge-backup-"+new Date().toISOString().slice(0,10)+".json";
  a.click();URL.revokeObjectURL(url);
  showToast(tr('toast.backup_exported','Backup exported!'),"var(--green)");
}

function importData(event){
  const file=event.target.files[0];
  if(!file)return;
  const reader=new FileReader();
  reader.onload=async(e)=>{
    try{
      const data=JSON.parse(e.target.result);
      if(typeof data!=='object'||!data){showToast(tr('import.invalid_file','Invalid backup file'),'var(--orange)');return;}
      if(!Array.isArray(data.workouts)&&!data.profile){showToast(tr('import.invalid_file','Invalid backup file'),'var(--orange)');return;}
      if(data.workouts&&!Array.isArray(data.workouts)){showToast(tr('import.invalid_workout_data','Backup file has invalid workout data'),'var(--orange)');return;}
      if(data.workouts){const bad=data.workouts.some(w=>!w.id||!w.date||!w.type||!Array.isArray(w.exercises));if(bad){showToast(tr('import.malformed_entries','Backup file has malformed workout entries'),'var(--orange)');return;}}
      if(data.profile&&typeof data.profile!=='object'){showToast(tr('import.invalid_profile_data','Backup file has invalid profile data'),'var(--orange)');return;}
      showConfirm(tr('import.title','Import Data'),tr('import.replace_with_backup','Replace all data with backup from {date}?',{date:(data.exported?new Date(data.exported).toLocaleDateString():'unknown')}),async()=>{
        if(data.workouts) workouts=data.workouts;
        if(data.schedule) schedule=data.schedule;
        if(data.profile) profile=data.profile;
        await saveWorkouts();await saveScheduleData();await saveProfileData();
        showToast(tr('toast.data_imported','Data imported! Reloading...'),"var(--green)");
        setTimeout(()=>location.reload(),1000);
      });
    }catch(err){showToast(tr('toast.could_not_read_file','Could not read file'),"var(--orange)");}
  };
  reader.readAsText(file);
  event.target.value="";
}

async function clearAllData(){
  try{localStorage.removeItem('ic_workouts');localStorage.removeItem('ic_schedule');localStorage.removeItem('ic_profile');}catch(e){}
  workouts=[];schedule={sportName:'Hockey',sportDays:[],sportIntensity:'hard',sportLegsHeavy:true};
  profile={defaultRest:120,activeProgram:'forge',programs:{},language:(window.I18N&&I18N.getLanguage?I18N.getLanguage():'en')};
  Object.values(PROGRAMS).forEach(prog=>{profile.programs[prog.id]=prog.getInitialState();});
  updateDashboard();showToast(tr('toast.all_data_cleared','All data cleared'),'var(--accent)');
}

function updateLanguageDependentUI(){
  refreshDayNames();
  if(window.I18N&&I18N.applyTranslations)I18N.applyTranslations(document);
  renderSportDayToggles();
  if(activeWorkout){
    const prog=getActiveProgram();
    const titleEl=document.getElementById('active-session-title');
    if(titleEl&&prog&&typeof prog.getSessionLabel==='function'){
      titleEl.textContent=prog.getSessionLabel(activeWorkout.programOption,getActiveProgramState());
    }
    renderExercises();
    const descEl=document.getElementById('active-session-description');
    if(descEl){
      const prefix=window.I18N&&I18N.t?I18N.t('session.description'):'Session focus';
      const sessionDescription=activeWorkout.sessionDescription||'';
      descEl.textContent=sessionDescription?(prefix+': '+sessionDescription):'';
      descEl.style.display=sessionDescription?'':'none';
    }
  }
  else if(document.getElementById('page-log')?.classList.contains('active'))resetNotStartedView();
}
window.updateLanguageDependentUI=updateLanguageDependentUI;

// INIT
initAuth();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js'); });
}


