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
let schedule={sportName:getDefaultSportName(),sportDays:[],sportIntensity:'hard',sportLegsHeavy:true};
let profile={defaultRest:120,language:(window.I18N&&I18N.getLanguage?I18N.getLanguage():'en'),preferences:getDefaultTrainingPreferences(),coaching:getDefaultCoachingProfile()};
let activeWorkout=null, workoutTimer=null, workoutSeconds=0;
let restInterval=null, restSecondsLeft=0, restTotal=0, restDuration=120, restEndsAt=0, restHideTimeout=null;
let pendingRPECallback=null;
let confirmCallback=null;
let nameModalCallback=null;
let _toastTimeout=null;
let exerciseIndex={};
let _appViewportSyncTimeout=null;

function getDefaultSportName(){
  const locale=window.I18N&&I18N.getLanguage?I18N.getLanguage():'en';
  return locale==='fi'?'Kestävyys':'Cardio';
}

function isLegacyDefaultSportName(name){
  const raw=String(name||'').trim().toLowerCase();
  return raw===''||raw==='hockey'||raw==='jääkiekko'||raw==='cardio'||raw==='sport'||raw==='urheilu'||raw==='kestävyys';
}

function syncAppViewportHeight(){
  const viewport=window.visualViewport;
  const height=Math.round((viewport&&viewport.height)||window.innerHeight||0);
  if(height>0)document.documentElement.style.setProperty('--app-vh',height+'px');
}

function scheduleAppViewportHeightSync(delay=0){
  clearTimeout(_appViewportSyncTimeout);
  _appViewportSyncTimeout=setTimeout(syncAppViewportHeight,delay);
}

syncAppViewportHeight();
window.addEventListener('resize',()=>scheduleAppViewportHeightSync());
window.addEventListener('orientationchange',()=>scheduleAppViewportHeightSync(120));
window.addEventListener('pageshow',()=>scheduleAppViewportHeightSync());
document.addEventListener('visibilitychange',()=>{if(!document.hidden)scheduleAppViewportHeightSync();});
document.addEventListener('focusout',()=>scheduleAppViewportHeightSync(120));
if(window.visualViewport){
  window.visualViewport.addEventListener('resize',()=>scheduleAppViewportHeightSync());
  window.visualViewport.addEventListener('scroll',()=>scheduleAppViewportHeightSync());
}

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
  nameModalCallback=cb;
  if(typeof openExerciseCatalogForAdd==='function'){
    openExerciseCatalogForAdd(title,cb);
    return;
  }
  document.getElementById('name-modal-title').textContent=title||tr('catalog.title.add','Add Exercise');
  document.getElementById('name-modal-input').value='';
  document.getElementById('name-modal').classList.add('active');
  setTimeout(()=>document.getElementById('name-modal-input').focus(),100);
}
function closeNameModal(){
  document.getElementById('name-modal').classList.remove('active');
  if(typeof resetExerciseCatalogState==='function')resetExerciseCatalogState();
  nameModalCallback=null;
}
function submitNameModal(){
  if(typeof submitExerciseCatalogSelection==='function'){
    submitExerciseCatalogSelection();
    return;
  }
  const v=document.getElementById('name-modal-input').value.trim();
  if(!v)return;
  document.getElementById('name-modal').classList.remove('active');
  if(nameModalCallback)nameModalCallback(v);
  nameModalCallback=null;
}

// REST TIMER
function updateRestDuration(){restDuration=parseInt(document.getElementById('rest-duration').value,10)||0;}
function clearRestInterval(){if(restInterval){clearInterval(restInterval);restInterval=null;}}
function clearRestHideTimer(){if(restHideTimeout){clearTimeout(restHideTimeout);restHideTimeout=null;}}
function syncRestTimer(){
  if(!restEndsAt)return;
  restSecondsLeft=Math.max(0,Math.ceil((restEndsAt-Date.now())/1000));
  if(restSecondsLeft<=0){restDone();return;}
  updateRestDisplay();
}
function startRestTimer(){
  if(!restDuration){skipRest();return;}
  clearRestInterval();
  clearRestHideTimer();
  restTotal=restDuration;restEndsAt=Date.now()+restDuration*1000;
  document.getElementById('rest-timer-bar').classList.add('active');
  syncRestTimer();
  restInterval=setInterval(syncRestTimer,250);
}
function updateRestDisplay(){
  const m=Math.floor(restSecondsLeft/60),s=restSecondsLeft%60;
  const el=document.getElementById('rest-timer-count');
  if(!el)return;
  el.textContent=m+':'+(s<10?'0':'')+s;
  el.className='rest-timer-count'+(restSecondsLeft<=10?' warning':'');
  const offset=restTotal?119.4*(1-(restSecondsLeft/restTotal)):119.4;
  document.getElementById('timer-arc').setAttribute('stroke-dashoffset',offset);
}
function restDone(){
  clearRestInterval();
  clearRestHideTimer();
  restEndsAt=0;restSecondsLeft=0;
  const el=document.getElementById('rest-timer-count');
  el.className='rest-timer-count done';el.textContent=tr('dashboard.badge.go','GO');
  playBeep();
  restHideTimeout=setTimeout(()=>document.getElementById('rest-timer-bar').classList.remove('active'),3000);
}
function skipRest(){
  clearRestInterval();
  clearRestHideTimer();
  restEndsAt=0;restSecondsLeft=0;
  document.getElementById('rest-timer-bar').classList.remove('active');
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncRestTimer();});
window.addEventListener('pageshow',syncRestTimer);
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
  ['schedule','preferences','program','account'].forEach(t=>{
    const d=document.getElementById('settings-tab-'+t);
    if(d)d.style.display=t===name?'':'none';
  });
  document.querySelectorAll('#settings-tabs .tab').forEach((t,i)=>{
    t.classList.toggle('active',['schedule','preferences','program','account'][i]===name);
  });
}
function openProgramSetupSheet(){
  const prog=getActiveProgram(),state=getActiveProgramState();
  const container=document.getElementById('program-settings-container');
  if(container&&prog.renderSettings)prog.renderSettings(state,container);
  const title=document.getElementById('program-setup-sheet-title');
  if(title){
    const progName=(window.I18N&&I18N.t)?I18N.t('program.'+prog.id+'.name',null,prog.name):prog.name;
    title.textContent=progName+' '+tr('settings.program_setup_suffix','Setup');
  }
  document.getElementById('program-setup-sheet').classList.add('active');
}
function renderProgramBasics(){
  const card=document.getElementById('program-basics-panel');
  const container=document.getElementById('program-basics-container');
  const summaryEl=document.getElementById('program-basics-summary');
  const prog=getActiveProgram(),state=getActiveProgramState();
  if(!card||!container)return;
  if(prog&&prog.renderSimpleSettings){
    card.style.display='';
    prog.renderSimpleSettings(state,container);
    if(typeof getProgramFrequencyNoticeHTML==='function'){
      const noticeHtml=getProgramFrequencyNoticeHTML(prog.id,profile);
      if(noticeHtml)container.insertAdjacentHTML('afterbegin',noticeHtml);
    }
    if(summaryEl)summaryEl.textContent=prog.getSimpleSettingsSummary?prog.getSimpleSettingsSummary(state):'';
    if(window.I18N&&I18N.applyTranslations)I18N.applyTranslations(card);
    return;
  }
  card.style.display='none';
  container.innerHTML='';
  if(summaryEl)summaryEl.textContent='';
}
function renderTrainingProgramSummary(){
  const summaryEl=document.getElementById('training-program-summary');
  const prog=getActiveProgram();
  if(!summaryEl||!prog)return;
  const progName=(window.I18N&&I18N.t)?I18N.t('program.'+prog.id+'.name',null,prog.name):prog.name;
  const progDesc=(window.I18N&&I18N.t)?I18N.t('program.'+prog.id+'.description',null,prog.description||''):prog.description||'';
  summaryEl.textContent=progDesc?`${progName} · ${progDesc}`:progName;
}
function renderTrainingPreferencesSummary(){
  const summaryEl=document.getElementById('training-preferences-summary');
  if(!summaryEl)return;
  summaryEl.textContent=getTrainingPreferencesSummary(profile);
}

const ONBOARDING_JOINT_FLAGS=[
  {value:'shoulder',label:'Shoulder'},
  {value:'knee',label:'Knee'},
  {value:'low_back',label:'Low Back'}
];
const ONBOARDING_MOVEMENT_TAGS=[
  {value:'squat',label:'Squat'},
  {value:'hinge',label:'Hinge'},
  {value:'vertical_press',label:'Overhead Press'},
  {value:'single_leg',label:'Single-Leg'}
];
let onboardingState={step:0,draft:null,recommendation:null,retryTimer:null};

function getOnboardingDraft(){
  if(onboardingState.draft)return onboardingState.draft;
  const prefs=normalizeTrainingPreferences(profile);
  const coaching=normalizeCoachingProfile(profile);
  onboardingState.draft={
    goal:prefs.goal,
    experienceLevel:coaching.experienceLevel,
    trainingDaysPerWeek:prefs.trainingDaysPerWeek,
    sessionMinutes:prefs.sessionMinutes,
    equipmentAccess:prefs.equipmentAccess,
    sportName:coaching.sportProfile?.name||schedule.sportName||'',
    inSeason:coaching.sportProfile?.inSeason===true,
    sportSessionsPerWeek:coaching.sportProfile?.sessionsPerWeek||schedule.sportDays?.length||0,
    jointFlags:[...(coaching.limitations?.jointFlags||[])],
    avoidMovementTags:[...(coaching.limitations?.avoidMovementTags||[])],
    avoidExercisesText:(coaching.limitations?.avoidExerciseIds||[]).join(', '),
    guidanceMode:coaching.guidanceMode
  };
  return onboardingState.draft;
}

function resetOnboardingState(options){
  const opts=options||{};
  onboardingState.step=0;
  onboardingState.recommendation=null;
  onboardingState.draft=opts.keepDraft?onboardingState.draft:null;
}

function toggleOnboardingArrayValue(key,value){
  const draft=getOnboardingDraft();
  const current=new Set(draft[key]||[]);
  if(current.has(value))current.delete(value);
  else current.add(value);
  draft[key]=[...current];
  renderOnboarding();
}

function setOnboardingValue(key,value){
  const draft=getOnboardingDraft();
  draft[key]=value;
}

function parseOnboardingExerciseIds(text){
  return String(text||'')
    .split(',')
    .map(part=>part.trim())
    .filter(Boolean)
    .map(name=>{
      if(window.EXERCISE_LIBRARY&&EXERCISE_LIBRARY.resolveExerciseId){
        return EXERCISE_LIBRARY.resolveExerciseId(name)||'';
      }
      return name;
    })
    .filter(Boolean);
}

function getOnboardingPreviewProfile(){
  const draft=getOnboardingDraft();
  const nextProfile=cloneJson(profile)||{};
  nextProfile.preferences=normalizeTrainingPreferences({
    ...nextProfile,
    preferences:{
      ...(nextProfile.preferences||getDefaultTrainingPreferences()),
      goal:draft.goal,
      trainingDaysPerWeek:parseInt(draft.trainingDaysPerWeek,10)||3,
      sessionMinutes:parseInt(draft.sessionMinutes,10)||60,
      equipmentAccess:draft.equipmentAccess
    }
  });
  nextProfile.coaching=normalizeCoachingProfile({
    ...nextProfile,
    coaching:{
      ...(nextProfile.coaching||getDefaultCoachingProfile()),
      experienceLevel:draft.experienceLevel,
      guidanceMode:draft.guidanceMode,
      sportProfile:{
        name:String(draft.sportName||'').trim(),
        inSeason:draft.inSeason===true,
        sessionsPerWeek:parseInt(draft.sportSessionsPerWeek,10)||0
      },
      limitations:{
        jointFlags:[...(draft.jointFlags||[])],
        avoidMovementTags:[...(draft.avoidMovementTags||[])],
        avoidExerciseIds:parseOnboardingExerciseIds(draft.avoidExercisesText)
      },
      exercisePreferences:{
        preferredExerciseIds:[],
        excludedExerciseIds:parseOnboardingExerciseIds(draft.avoidExercisesText)
      },
      onboardingCompleted:false
    }
  });
  return nextProfile;
}

function buildOnboardingRecommendation(){
  onboardingState.recommendation=getInitialPlanRecommendation({
    profile:getOnboardingPreviewProfile(),
    schedule:{...schedule,sportName:String(getOnboardingDraft().sportName||schedule.sportName||'').trim()||schedule.sportName}
  });
  return onboardingState.recommendation;
}

function getOnboardingStepCount(){return 5;}

function renderOnboardingProgress(){
  return `<div class="onboarding-progress">${Array.from({length:getOnboardingStepCount()},(_,idx)=>`<div class="onboarding-progress-pill${idx<=onboardingState.step?' active':''}"></div>`).join('')}</div>`;
}

function renderOnboardingOptionButton(isActive,title,description,onClick){
  return `<button type="button" class="onboarding-option-btn${isActive?' active':''}" onclick="${onClick}">
    <div class="onboarding-option-title">${escapeHtml(title)}</div>
    <div class="onboarding-option-desc">${escapeHtml(description)}</div>
  </button>`;
}

function renderOnboardingSelectionStep(){
  const draft=getOnboardingDraft();
  if(onboardingState.step===0){
    return `
      <div class="onboarding-grid">
        <div>
          <label>Primary Goal</label>
          <div class="onboarding-option-grid">
            ${renderOnboardingOptionButton(draft.goal==='strength','Strength','Improve main lifts and progression.',"setOnboardingValue('goal','strength');renderOnboarding()")}
            ${renderOnboardingOptionButton(draft.goal==='hypertrophy','Hypertrophy','Bias training toward muscle gain and volume.',"setOnboardingValue('goal','hypertrophy');renderOnboarding()")}
            ${renderOnboardingOptionButton(draft.goal==='general_fitness','General Fitness','Keep training sustainable and broadly useful.',"setOnboardingValue('goal','general_fitness');renderOnboarding()")}
            ${renderOnboardingOptionButton(draft.goal==='sport_support','Sport Support','Fit lifting around outside sport or cardio load.',"setOnboardingValue('goal','sport_support');renderOnboarding()")}
          </div>
        </div>
        <div>
          <label>Experience Level</label>
          <div class="onboarding-option-grid">
            ${renderOnboardingOptionButton(draft.experienceLevel==='beginner','Beginner','You want simple defaults and low complexity.',"setOnboardingValue('experienceLevel','beginner');renderOnboarding()")}
            ${renderOnboardingOptionButton(draft.experienceLevel==='returning','Returning','You have trained before, but want a stable ramp back in.',"setOnboardingValue('experienceLevel','returning');renderOnboarding()")}
            ${renderOnboardingOptionButton(draft.experienceLevel==='intermediate','Intermediate','You can handle more structure and moderate autoregulation.',"setOnboardingValue('experienceLevel','intermediate');renderOnboarding()")}
            ${renderOnboardingOptionButton(draft.experienceLevel==='advanced','Advanced','You want a higher ceiling and more nuanced planning.',"setOnboardingValue('experienceLevel','advanced');renderOnboarding()")}
          </div>
        </div>
      </div>`;
  }
  if(onboardingState.step===1){
    return `
      <div class="onboarding-grid">
        <div class="onboarding-inline-grid">
          <div>
            <label>Training Frequency</label>
            <select onchange="setOnboardingValue('trainingDaysPerWeek',parseInt(this.value,10));renderOnboarding()">
              ${[2,3,4,5,6].map(value=>`<option value="${value}"${value===parseInt(draft.trainingDaysPerWeek,10)?' selected':''}>${value} sessions / week</option>`).join('')}
            </select>
          </div>
          <div>
            <label>Session Length</label>
            <select onchange="setOnboardingValue('sessionMinutes',parseInt(this.value,10));renderOnboarding()">
              ${[30,45,60,75,90].map(value=>`<option value="${value}"${value===parseInt(draft.sessionMinutes,10)?' selected':''}>${value} min</option>`).join('')}
            </select>
          </div>
        </div>
        <div>
          <label>Equipment Access</label>
          <select onchange="setOnboardingValue('equipmentAccess',this.value);renderOnboarding()">
            <option value="full_gym"${draft.equipmentAccess==='full_gym'?' selected':''}>Full Gym</option>
            <option value="basic_gym"${draft.equipmentAccess==='basic_gym'?' selected':''}>Basic Gym</option>
            <option value="home_gym"${draft.equipmentAccess==='home_gym'?' selected':''}>Home Gym</option>
            <option value="minimal"${draft.equipmentAccess==='minimal'?' selected':''}>Minimal Equipment</option>
          </select>
        </div>
      </div>`;
  }
  if(onboardingState.step===2){
    return `
      <div class="onboarding-grid">
        <div class="onboarding-inline-grid">
          <div>
            <label>Sport or Cardio</label>
            <input type="text" value="${escapeHtml(draft.sportName||'')}" placeholder="e.g. Hockey, Running, Soccer" oninput="setOnboardingValue('sportName',this.value)">
          </div>
          <div>
            <label>Sessions / Week</label>
            <select onchange="setOnboardingValue('sportSessionsPerWeek',parseInt(this.value,10));renderOnboarding()">
              ${[0,1,2,3,4,5,6,7].map(value=>`<option value="${value}"${value===parseInt(draft.sportSessionsPerWeek,10)?' selected':''}>${value}</option>`).join('')}
            </select>
          </div>
        </div>
        <label class="toggle-row" for="onboarding-in-season" style="margin-top:0">
          <div>
            <div class="toggle-row-title">In season</div>
            <div class="toggle-row-sub">Use a more conservative starting point when sport is a real load right now.</div>
          </div>
          <div class="toggle-switch">
            <input type="checkbox" id="onboarding-in-season" ${draft.inSeason?'checked':''} onchange="setOnboardingValue('inSeason',this.checked)">
            <span class="toggle-track"><span class="toggle-thumb"></span></span>
          </div>
        </label>
        <div>
          <label>Joint Flags</label>
          <div class="onboarding-chip-row">
            ${ONBOARDING_JOINT_FLAGS.map(item=>`<button type="button" class="onboarding-chip${(draft.jointFlags||[]).includes(item.value)?' active':''}" onclick="toggleOnboardingArrayValue('jointFlags','${item.value}')">${escapeHtml(item.label)}</button>`).join('')}
          </div>
        </div>
        <div>
          <label>Avoid Movement Patterns</label>
          <div class="onboarding-chip-row">
            ${ONBOARDING_MOVEMENT_TAGS.map(item=>`<button type="button" class="onboarding-chip${(draft.avoidMovementTags||[]).includes(item.value)?' active':''}" onclick="toggleOnboardingArrayValue('avoidMovementTags','${item.value}')">${escapeHtml(item.label)}</button>`).join('')}
          </div>
        </div>
        <div>
          <label>Avoided Exercises</label>
          <textarea rows="3" placeholder="Comma-separated exercise names" oninput="setOnboardingValue('avoidExercisesText',this.value)">${escapeHtml(draft.avoidExercisesText||'')}</textarea>
          <div class="onboarding-field-help">Used to exclude obvious no-go exercises from the first recommendation and future session adaptation.</div>
        </div>
      </div>`;
  }
  if(onboardingState.step===3){
    return `
      <div class="onboarding-grid">
        <div class="onboarding-option-grid">
          ${renderOnboardingOptionButton(draft.guidanceMode==='guided','Tell me what to do','Strong default recommendations, less manual decision-making.',"setOnboardingValue('guidanceMode','guided');renderOnboarding()")}
          ${renderOnboardingOptionButton(draft.guidanceMode==='balanced','Balanced','Good defaults, but still leaves room to steer the plan.',"setOnboardingValue('guidanceMode','balanced');renderOnboarding()")}
          ${renderOnboardingOptionButton(draft.guidanceMode==='self_directed','Give me control','Lighter guidance and more room for manual choices.',"setOnboardingValue('guidanceMode','self_directed');renderOnboarding()")}
        </div>
      </div>`;
  }
  const recommendation=onboardingState.recommendation||buildOnboardingRecommendation();
  const program=PROGRAMS?.[recommendation.programId];
  const programName=(window.I18N&&I18N.t)?I18N.t('program.'+recommendation.programId+'.name',null,program?.name||recommendation.programId):program?.name||recommendation.programId;
  return `
    <div class="onboarding-grid">
      <div class="onboarding-card">
        <div class="onboarding-kicker">Recommended Program</div>
        <div class="onboarding-title" style="font-size:20px">${escapeHtml(programName)}</div>
        <div class="onboarding-sub" style="margin-top:8px">This is the best starting point based on your goal, schedule, sport load, and desired guidance level.</div>
      </div>
      <div class="onboarding-card">
        <div class="card-title" style="margin-bottom:10px">Why this fits</div>
        <div class="onboarding-why-list">${(recommendation.why||[]).map(item=>`<div class="onboarding-why-item">• ${escapeHtml(item)}</div>`).join('')}</div>
      </div>
      <div class="onboarding-card">
        <div class="card-title" style="margin-bottom:10px">Your first week</div>
        <div class="onboarding-week-list">${(recommendation.weekTemplate||[]).map(item=>`<div class="onboarding-week-item"><span>${escapeHtml(item.dayLabel)} · ${escapeHtml(item.type)}</span><span class="onboarding-week-meta">${escapeHtml(item.durationHint)}</span></div>`).join('')}</div>
      </div>
      <div class="onboarding-card">
        <div class="card-title" style="margin-bottom:10px">Start with this</div>
        <div class="onboarding-note">First session option: ${escapeHtml(String(recommendation.firstSessionOption||'1'))}</div>
        ${(recommendation.initialAdjustments||[]).length?`<div class="onboarding-why-list" style="margin-top:10px">${recommendation.initialAdjustments.map(item=>`<div class="onboarding-why-item">• ${escapeHtml(item)}</div>`).join('')}</div>`:''}
      </div>
    </div>`;
}

function renderOnboarding(){
  const modal=document.getElementById('onboarding-modal');
  const container=document.getElementById('onboarding-content');
  if(!modal||!container)return;
  const titleMap=[
    'Build your starting point',
    'Set your training envelope',
    'Add sport and constraints',
    'Choose your guidance level',
    'Start from a real plan'
  ];
  const subMap=[
    'This gives the engine enough signal to recommend the right starting plan.',
    'These limits drive frequency, session trimming, and program fit.',
    'Tell the engine what has to be respected, not just what sounds ideal.',
    'This sets how opinionated the app should be when making decisions.',
    'You should leave onboarding with a clear program, first week, and first session.'
  ];
  const primaryLabel=onboardingState.step===getOnboardingStepCount()-1?'Use This Plan':'Continue';
  const secondaryLabel=onboardingState.step===0?'Not now':'Back';
  container.innerHTML=`
    <div class="onboarding-flow">
      ${renderOnboardingProgress()}
      <div>
        <div class="onboarding-kicker">Guided Setup</div>
        <div class="onboarding-title">${escapeHtml(titleMap[onboardingState.step]||'Guided setup')}</div>
        <div class="onboarding-sub">${escapeHtml(subMap[onboardingState.step]||'')}</div>
      </div>
      ${renderOnboardingSelectionStep()}
      <div class="onboarding-actions">
        <button class="btn btn-secondary" type="button" onclick="${onboardingState.step===0?'closeOnboardingModal()':'goToOnboardingStep('+(onboardingState.step-1)+')'}">${escapeHtml(secondaryLabel)}</button>
        <button class="btn btn-primary" type="button" onclick="${onboardingState.step===getOnboardingStepCount()-1?'completeOnboarding()':'advanceOnboarding()'}">${escapeHtml(primaryLabel)}</button>
      </div>
    </div>`;
}

function goToOnboardingStep(step){
  onboardingState.step=Math.max(0,Math.min(getOnboardingStepCount()-1,step));
  renderOnboarding();
}

function advanceOnboarding(){
  if(onboardingState.step===getOnboardingStepCount()-2)buildOnboardingRecommendation();
  goToOnboardingStep(onboardingState.step+1);
}

function closeOnboardingModal(){
  document.getElementById('onboarding-modal')?.classList.remove('active');
}

async function completeOnboarding(){
  const recommendation=onboardingState.recommendation||buildOnboardingRecommendation();
  const nextProfile=getOnboardingPreviewProfile();
  nextProfile.coaching=normalizeCoachingProfile({
    ...nextProfile,
    coaching:{...nextProfile.coaching,onboardingCompleted:true}
  });
  profile.preferences=nextProfile.preferences;
  profile.coaching=nextProfile.coaching;
  if(String(getOnboardingDraft().sportName||'').trim()){
    schedule.sportName=String(getOnboardingDraft().sportName||'').trim();
  }
  profile.activeProgram=recommendation.programId;
  if(!profile.programs)profile.programs={};
  if(!profile.programs[recommendation.programId]&&PROGRAMS?.[recommendation.programId]?.getInitialState){
    profile.programs[recommendation.programId]=PROGRAMS[recommendation.programId].getInitialState();
  }
  normalizeProfileProgramStateMap(profile);
  closeOnboardingModal();
  await saveScheduleData();
  await saveProfileData({docKeys:getAllProfileDocumentKeys(profile)});
  initSettings();
  if(!activeWorkout)resetNotStartedView();
  updateProgramDisplay();
  updateDashboard();
  showToast('Plan created and onboarding completed','var(--green)');
  goToLog();
}

function maybeOpenOnboarding(options){
  const opts=options||{};
  clearTimeout(onboardingState.retryTimer);
  if(document.body.classList.contains('login-active'))return;
  if(activeWorkout)return;
  const coaching=normalizeCoachingProfile(profile);
  if(!opts.force&&coaching.onboardingCompleted===true)return;
  if(!window.PROGRAMS||!Object.keys(PROGRAMS).length){
    onboardingState.retryTimer=setTimeout(()=>maybeOpenOnboarding(opts),120);
    return;
  }
  if(opts.force)resetOnboardingState();
  else if(!onboardingState.draft)resetOnboardingState();
  document.getElementById('onboarding-modal')?.classList.add('active');
  renderOnboarding();
}

function restartOnboarding(){
  resetOnboardingState();
  maybeOpenOnboarding({force:true});
}
function closeProgramSetupSheet(e){
  if(!e||e.target.id==='program-setup-sheet'){
    document.getElementById('program-setup-sheet').classList.remove('active');
  }
}
function initSettings(){
  refreshDayNames();
  {const inp=document.getElementById('sport-name');if(inp)inp.value=schedule.sportName||getDefaultSportName();}
  {const btns=document.querySelectorAll('#sport-intensity-btns button');
    btns.forEach(b=>{b.classList.toggle('active',b.dataset.intensity===(schedule.sportIntensity||'hard'));});
  }
  {const cb=document.getElementById('sport-legs-heavy');if(cb)cb.checked=schedule.sportLegsHeavy!==false;}
  {
    const langSel=document.getElementById('app-language');
    if(langSel)langSel.value=profile.language||(window.I18N&&I18N.getLanguage?I18N.getLanguage():'en');
  }
  {
    const prefs=normalizeTrainingPreferences(profile);
    const goalSel=document.getElementById('training-goal');
    if(goalSel)goalSel.value=prefs.goal;
    const trainingDaysSel=document.getElementById('training-days-per-week');
    if(trainingDaysSel)trainingDaysSel.value=String(prefs.trainingDaysPerWeek);
    const minutesSel=document.getElementById('training-session-minutes');
    if(minutesSel)minutesSel.value=String(prefs.sessionMinutes);
    const equipmentSel=document.getElementById('training-equipment');
    if(equipmentSel)equipmentSel.value=prefs.equipmentAccess;
    const sportCheckEl=document.getElementById('training-sport-check');
    if(sportCheckEl)sportCheckEl.checked=prefs.sportReadinessCheckEnabled===true;
    const warmupEl=document.getElementById('training-warmup-sets');
    if(warmupEl)warmupEl.checked=prefs.warmupSetsEnabled===true;
    const notesEl=document.getElementById('training-preferences-notes');
    if(notesEl)notesEl.value=prefs.notes||'';
  }
  renderSportDayToggles();
  document.getElementById('default-rest').value=profile.defaultRest||120;
  renderProgramSwitcher();
  renderTrainingProgramSummary();
  renderProgramBasics();
  renderTrainingPreferencesSummary();
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
  saveProfileData({docKeys:['profile_core']});
  showToast(tr('toast.rest_updated','Rest timer updated'),'var(--blue)');
}
function saveTrainingPreferences(){
  const prefs=normalizeTrainingPreferences(profile);
  const goal=document.getElementById('training-goal')?.value||prefs.goal;
  const trainingDaysPerWeek=parseInt(document.getElementById('training-days-per-week')?.value,10)||prefs.trainingDaysPerWeek;
  const sessionMinutes=parseInt(document.getElementById('training-session-minutes')?.value,10)||prefs.sessionMinutes;
  const equipmentAccess=document.getElementById('training-equipment')?.value||prefs.equipmentAccess;
  const sportReadinessCheckEnabled=document.getElementById('training-sport-check')?.checked===true;
  const warmupSetsEnabled=document.getElementById('training-warmup-sets')?.checked===true;
  const notes=document.getElementById('training-preferences-notes')?.value||'';
  profile.preferences=normalizeTrainingPreferences({...profile,preferences:{...prefs,goal,trainingDaysPerWeek,sessionMinutes,equipmentAccess,sportReadinessCheckEnabled,warmupSetsEnabled,notes}});
  saveProfileData({docKeys:['profile_core']});
  renderTrainingPreferencesSummary();
  renderProgramBasics();
  updateDashboard();
  updateProgramDisplay();
  if(typeof getActiveProgramFrequencyMismatch==='function'){
    const mismatch=getActiveProgramFrequencyMismatch(profile);
    if(mismatch){
      showToast(
        tr(
          'program.frequency_notice.toast',
          '{name} now uses {effective}. Open Program to switch for {requested}.',
          {
            name:(window.I18N&&I18N.t)?I18N.t('program.'+mismatch.prog.id+'.name',null,mismatch.prog.name):mismatch.prog.name,
            effective:mismatch.effectiveLabel,
            requested:mismatch.requestedLabel
          }
        ),
        'var(--orange)'
      );
      return;
    }
  }
  showToast(tr('toast.preferences_saved','Training preferences saved'),'var(--purple)');
}
function saveSimpleProgramSettings(){
  const prog=getActiveProgram(),state=getActiveProgramState();
  if(!prog||!prog.saveSimpleSettings)return;
  const newState=prog.saveSimpleSettings(state);
  setProgramState(prog.id,newState);
  saveProfileData({programIds:[prog.id]});
  renderProgramBasics();
  updateProgramDisplay();
  updateDashboard();
  showToast(tr('program.setup_saved','Program setup saved!'),'var(--purple)');
}
function saveLanguageSetting(){
  const lang=document.getElementById('app-language')?.value||'en';
  if(window.I18N&&I18N.setLanguage)I18N.setLanguage(lang,{persist:true});
  profile.language=lang;
  saveProfileData({docKeys:['profile_core']});
  const msg=window.I18N&&I18N.t?I18N.t('settings.language.saved'):'Language updated';
  showToast(msg,'var(--blue)');
}
function saveSchedule(){
  const nameInp=document.getElementById('sport-name');
  if(nameInp)schedule.sportName=nameInp.value.trim()||getDefaultSportName();
  const cb=document.getElementById('sport-legs-heavy');
  if(cb)schedule.sportLegsHeavy=cb.checked;
  const prefs=normalizeTrainingPreferences(profile);
  const sportCheckEl=document.getElementById('training-sport-check');
  if(sportCheckEl){
    profile.preferences=normalizeTrainingPreferences({
      ...profile,
      preferences:{...prefs,sportReadinessCheckEnabled:sportCheckEl.checked===true}
    });
  }
  if(!activeWorkout)resetNotStartedView();
  saveScheduleData();
  saveProfileData({docKeys:['profile_core']});
  updateProgramDisplay();updateDashboard();showToast(tr('toast.schedule_saved','Schedule saved!'),'var(--blue)');
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
        cleanupLegacyProfileFields(profile);
        normalizeTrainingPreferences(profile);
        normalizeCoachingProfile(profile);
        await replaceWorkoutTableSnapshot(workouts);
        await saveWorkouts();await saveScheduleData();await saveProfileData({docKeys:getAllProfileDocumentKeys(profile)});
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
  workouts=[];schedule={sportName:getDefaultSportName(),sportDays:[],sportIntensity:'hard',sportLegsHeavy:true};
  profile={defaultRest:120,activeProgram:'forge',programs:{},language:(window.I18N&&I18N.getLanguage?I18N.getLanguage():'en'),preferences:getDefaultTrainingPreferences(),coaching:getDefaultCoachingProfile()};
  Object.values(PROGRAMS).forEach(prog=>{profile.programs[prog.id]=prog.getInitialState();});
  await replaceWorkoutTableSnapshot([]);
  await saveWorkouts();await saveScheduleData();await saveProfileData({docKeys:getAllProfileDocumentKeys(profile)});
  updateDashboard();
  if(typeof maybeOpenOnboarding==='function')maybeOpenOnboarding({force:true});
  showToast(tr('toast.all_data_cleared','All data cleared'),'var(--accent)');
}

function updateLanguageDependentUI(){
  refreshDayNames();
  if(window.I18N&&I18N.applyTranslations)I18N.applyTranslations(document);
  updateDashboard();
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
  if(document.getElementById('name-modal')?.classList.contains('active')&&typeof renderExerciseCatalog==='function'){
    renderExerciseCatalog();
  }
  if(document.getElementById('onboarding-modal')?.classList.contains('active')){
    renderOnboarding();
  }
  else if(document.getElementById('page-log')?.classList.contains('active'))resetNotStartedView();
}
window.updateLanguageDependentUI=updateLanguageDependentUI;

// INIT
initAuth();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js'); });
}


