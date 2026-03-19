const APP_VERSION='1.0.0';
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
let exerciseIndex={};
let _appViewportSyncTimeout=null;
let _appViewportBurstTimeouts=[];
const IS_E2E_TEST_ENV=window.__IRONFORGE_TEST_USER_ID__==='e2e-user'||window.navigator.webdriver===true;

if(IS_E2E_TEST_ENV){
  document.documentElement.classList.add('test-env');
}

function getIronforgeState(){
  return{
    workouts,
    schedule,
    profile,
    activeWorkout,
    restDuration,
    restEndsAt,
    restSecondsLeft,
    restTotal,
    currentUser
  };
}
window.getIronforgeState=getIronforgeState;

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

function clearAppViewportBurstSync(){
  while(_appViewportBurstTimeouts.length){
    clearTimeout(_appViewportBurstTimeouts.pop());
  }
}

function scheduleAppViewportHeightBurstSync(delays){
  const steps=Array.isArray(delays)&&delays.length?delays:[0,80,180,320,480];
  clearAppViewportBurstSync();
  steps.forEach((delay)=>{
    const handle=setTimeout(syncAppViewportHeight,delay);
    _appViewportBurstTimeouts.push(handle);
  });
}

function isViewportSensitiveTarget(target){
  if(!(target instanceof HTMLElement))return false;
  if(target.matches('input,textarea,select,[contenteditable="true"]'))return true;
  return !!target.closest('[contenteditable="true"]');
}

syncAppViewportHeight();
window.addEventListener('resize',()=>scheduleAppViewportHeightSync());
window.addEventListener('orientationchange',()=>scheduleAppViewportHeightSync(120));
window.addEventListener('pageshow',()=>scheduleAppViewportHeightSync());
document.addEventListener('visibilitychange',()=>{if(!document.hidden)scheduleAppViewportHeightSync();});
document.addEventListener('focusin',(event)=>{
  if(isViewportSensitiveTarget(event.target)){
    scheduleAppViewportHeightBurstSync();
  }
});
document.addEventListener('focusout',()=>scheduleAppViewportHeightBurstSync([0,120,240,360]));
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
const loginSparks=typeof window.createLoginSparksController==='function'
  ? window.createLoginSparksController()
  : {start(){},stop(){}};

window.startLoginSparks=()=>loginSparks.start();
window.stopLoginSparks=()=>loginSparks.stop();

function playForgeBurst(canvas,options){
  const target=canvas instanceof HTMLCanvasElement?canvas:null;
  if(!target)return()=>{};
  const ctx=target.getContext('2d');
  if(!ctx)return()=>{};

  const prefersReducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches
    || document.documentElement.classList.contains('test-env');
  if(prefersReducedMotion){
    const rect=target.getBoundingClientRect();
    const width=Math.max(1,Math.floor(rect.width||target.clientWidth||1));
    const height=Math.max(1,Math.floor(rect.height||target.clientHeight||1));
    const dpr=Math.max(1,Math.min(window.devicePixelRatio||1,1.75));
    target.width=Math.floor(width*dpr);
    target.height=Math.floor(height*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,width,height);
    return()=>ctx.clearRect(0,0,width,height);
  }

  const COLOR_A=[255,122,58];
  const COLOR_B=[255,176,103];
  const config={
    densityMultiplier:1,
    duration:980,
    originX:0.5,
    originY:0.84,
    glowFrom:0.18,
    glowTo:0.4,
    palette:null,
    ...(options||{})
  };
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const lerp=(a,b,t)=>a+(b-a)*t;
  const easeOutCubic=t=>1-Math.pow(1-t,3);
  const emberColor=(t,alpha)=>{
    const palette=Array.isArray(config.palette)&&config.palette.length>=2
      ? config.palette
      : [COLOR_A,COLOR_B];
    const start=palette[0];
    const end=palette[Math.min(1,palette.length-1)]||palette[0];
    const r=Math.round(lerp(start[0],end[0],t));
    const g=Math.round(lerp(start[1],end[1],t));
    const b=Math.round(lerp(start[2],end[2],t));
    return `rgba(${r},${g},${b},${alpha})`;
  };

  let width=0;
  let height=0;
  let dpr=1;
  let rafId=0;
  let startTs=0;
  let lastTs=0;
  let embers=[];

  function resize(){
    const rect=target.getBoundingClientRect();
    width=Math.max(1,Math.floor(rect.width||target.clientWidth||1));
    height=Math.max(1,Math.floor(rect.height||target.clientHeight||1));
    dpr=clamp(window.devicePixelRatio||1,1,1.75);
    target.width=Math.floor(width*dpr);
    target.height=Math.floor(height*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }

  function buildEmbers(){
    const total=Math.max(18,Math.round(32*(parseFloat(config.densityMultiplier)||1)));
    const originX=width*(parseFloat(config.originX)||0.5);
    const originY=height*(parseFloat(config.originY)||0.84);
    embers=Array.from({length:total},(_,index)=>{
      const spread=Math.PI*(0.65+Math.random()*0.4);
      const baseAngle=(-Math.PI/2)+((index/Math.max(1,total-1))-0.5)*spread;
      const angle=baseAngle+((Math.random()-0.5)*0.32);
      const speed=190+Math.random()*210;
      const lift=0.72+Math.random()*0.4;
      return{
        x:originX+((Math.random()-0.5)*28),
        y:originY+Math.random()*18,
        vx:Math.cos(angle)*speed*0.55,
        vy:Math.sin(angle)*speed*lift,
        gravity:140+Math.random()*70,
        drag:0.9+Math.random()*0.06,
        size:1.6+Math.random()*3,
        alpha:0.42+Math.random()*0.42,
        life:0.62+Math.random()*0.38,
        age:0,
        t:Math.random()
      };
    });
  }

  function cleanup(){
    if(rafId)cancelAnimationFrame(rafId);
    rafId=0;
    ctx.clearRect(0,0,width,height);
  }

  function draw(ts){
    if(!startTs){
      startTs=ts;
      lastTs=ts;
    }
    const dt=Math.min((ts-lastTs)/1000,0.033);
    lastTs=ts;
    const elapsed=ts-startTs;
    const progress=clamp(elapsed/(parseFloat(config.duration)||980),0,1);
    const glowStrength=lerp(config.glowFrom,config.glowTo,easeOutCubic(Math.min(1,elapsed/600)));

    ctx.clearRect(0,0,width,height);
    const glow=ctx.createRadialGradient(
      width*(parseFloat(config.originX)||0.5),
      height*(parseFloat(config.originY)||0.84),
      10,
      width*(parseFloat(config.originX)||0.5),
      height*(parseFloat(config.originY)||0.84),
      height*0.26
    );
    glow.addColorStop(0,`rgba(255,132,46,${(glowStrength*(1-progress*0.3)).toFixed(3)})`);
    glow.addColorStop(0.45,`rgba(255,120,40,${(glowStrength*0.52).toFixed(3)})`);
    glow.addColorStop(1,'rgba(0,0,0,0)');
    ctx.globalCompositeOperation='screen';
    ctx.fillStyle=glow;
    ctx.fillRect(0,0,width,height);

    let alive=0;
    for(let i=0;i<embers.length;i++){
      const ember=embers[i];
      ember.age+=dt;
      const lifeProgress=clamp(ember.age/ember.life,0,1);
      if(lifeProgress>=1)continue;
      alive++;
      ember.vx*=ember.drag;
      ember.vy+=(ember.gravity*dt);
      ember.x+=ember.vx*dt;
      ember.y+=ember.vy*dt;
      const alpha=ember.alpha*(1-lifeProgress)*(1-progress*0.16);
      if(alpha<=0.01)continue;
      ctx.beginPath();
      ctx.globalCompositeOperation='lighter';
      ctx.fillStyle=emberColor(ember.t,alpha);
      ctx.shadowColor=emberColor(ember.t,alpha*0.8);
      ctx.shadowBlur=6;
      ctx.arc(ember.x,ember.y,ember.size*(1-lifeProgress*0.2),0,Math.PI*2);
      ctx.fill();
    }
    ctx.shadowBlur=0;

    if(progress<1&&alive>0){
      rafId=requestAnimationFrame(draw);
      return;
    }
    cleanup();
  }

  resize();
  buildEmbers();
  rafId=requestAnimationFrame(draw);
  window.addEventListener('resize',resize,{once:true});
  return cleanup;
}

window.playForgeBurst=playForgeBurst;

// PROGRAM REGISTRY
// Programs (loaded via <script> tags after this file) call registerProgram() to self-register.
// Program registry/state helpers moved to core/program-layer.js.

// FATIGUE + MUSCLE LOAD CONFIG
// Separate from program definitions - these are app-wide constants
const FATIGUE_CONFIG={
  lookbackDays:10,
  muscularHalfLifeDays:4.5,
  cnsHalfLifeDays:3.25,
  lift:{
    muscularBase:8,
    muscularSetWeight:1.9,
    muscularRpeWeight:4,
    cnsBase:10,
    cnsSetWeight:1.05,
    cnsRpeWeight:7,
    loadFactorDivisor:200,
    loadFactorMaxBonus:0.35,
    repFactorPerRepFromFive:0.05,
    repFactorMin:0.9,
    repFactorMax:1.25,
    sessionCap:70
  },
  sport:{
    easy:{muscular:6,cns:5},
    moderate:{muscular:11,cns:9},
    hard:{muscular:17,cns:14},
    durationMin:0.75,
    durationMax:1.5,
    effortBase:0.85,
    effortPerRpeAboveSix:0.12,
    effortMax:1.33,
    extraSubtypeCnsMultiplier:1.15
  }
};

const MUSCLE_LOAD_CONFIG={
  lookbackDays:7,
  halfLifeDays:3.5,
  displayLimit:3,
  thresholds:{high:8,moderate:4,light:1.5},
  liftPrimaryWeight:1,
  liftSecondaryWeight:0.5,
  liftRpeScaleBase:0.8,
  liftRpeScalePerPoint:0.16,
  liftRpeScaleMax:1.6
};
window.FATIGUE_CONFIG=FATIGUE_CONFIG;
window.MUSCLE_LOAD_CONFIG=MUSCLE_LOAD_CONFIG;

const SPORT_RECENT_HOURS={
  easy:18,
  moderate:24,
  hard:30
};
function getSportConfig(){return FATIGUE_CONFIG.sport[schedule.sportIntensity||'hard']||FATIGUE_CONFIG.sport.hard;}
function getSportRecentHours(){return SPORT_RECENT_HOURS[schedule.sportIntensity||'hard']||SPORT_RECENT_HOURS.hard;}



// Data/auth lifecycle functions moved to core/data-layer.js.

// REST TIMER
function updateRestDuration(){
  restDuration=parseInt(document.getElementById('rest-duration').value,10)||0;
  if(activeWorkout&&typeof persistActiveWorkoutDraft==='function')persistActiveWorkoutDraft();
  if(typeof isLogActiveIslandActive==='function'&&isLogActiveIslandActive())notifyLogActiveIsland();
}
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
  if(activeWorkout&&typeof persistActiveWorkoutDraft==='function')persistActiveWorkoutDraft();
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
  if(activeWorkout&&typeof persistActiveWorkoutDraft==='function')persistActiveWorkoutDraft();
  restHideTimeout=setTimeout(()=>document.getElementById('rest-timer-bar').classList.remove('active'),3000);
}
function skipRest(){
  clearRestInterval();
  clearRestHideTimer();
  restEndsAt=0;restSecondsLeft=0;
  document.getElementById('rest-timer-bar').classList.remove('active');
  if(activeWorkout&&typeof persistActiveWorkoutDraft==='function')persistActiveWorkoutDraft();
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
  if(typeof isSettingsScheduleIslandActive==='function'&&isSettingsScheduleIslandActive())notifySettingsScheduleIsland();
}
function setSportIntensity(val,el){
  schedule.sportIntensity=val;
  document.querySelectorAll('#sport-intensity-btns button').forEach(b=>b.classList.remove('active'));
  if(el)el.classList.add('active');
  saveSchedule({sportIntensity:val});
}
let _settingsTab='schedule';
let settingsAccountUiState={dangerOpen:false,dangerInput:''};
function showSettingsTab(name,el){
  _settingsTab=name;
  ['schedule','preferences','program','account','body'].forEach(t=>{
    const d=document.getElementById('settings-tab-'+t);
    if(d)d.style.display=t===name?'':'none';
  });
  document.querySelectorAll('#settings-tabs .tab').forEach(tab=>{
    const isActive=tab.dataset.settingsTab===name;
    tab.classList.toggle('active',isActive);
    tab.setAttribute('aria-selected',isActive?'true':'false');
  });
}
const SETTINGS_ACCOUNT_ISLAND_EVENT='ironforge:settings-account-updated';
function hasSettingsAccountIslandMount(){
  return !!document.getElementById('settings-account-react-root');
}
function isSettingsAccountIslandActive(){
  return window.__IRONFORGE_SETTINGS_ACCOUNT_ISLAND_MOUNTED__===true;
}
function notifySettingsAccountIsland(){
  if(!hasSettingsAccountIslandMount())return;
  window.dispatchEvent(new CustomEvent(SETTINGS_ACCOUNT_ISLAND_EVENT));
}
function getAccountBackupContextText(){
  const count=workouts?workouts.length:0;
  if(!count)return tr('settings.backup_empty','No workouts recorded yet.');
  const dates=workouts.map(w=>w.date).filter(Boolean).sort();
  const first=dates[0]||'';
  const firstFormatted=first?new Date(first).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'';
  return tr('settings.backup_context','{count} workouts since {date}',{count,date:firstFormatted});
}
function isDangerDeleteConfirmed(){
  return String(settingsAccountUiState.dangerInput||'').trim().toUpperCase()==='DELETE';
}
function getSettingsAccountReactSnapshot(){
  const syncStatus=typeof getSyncStatusLabel==='function'
    ? getSyncStatusLabel()
    : {label:tr('settings.sync.synced','Synced to cloud'),className:'sync-status synced'};
  const apiKey=typeof getNutritionApiKey==='function'?getNutritionApiKey():'';
  return{
    labels:{
      accountSection:tr('settings.account_section','Account'),
      languageLabel:tr('settings.language.label','App language'),
      optionEn:tr('settings.language.option.en','English'),
      optionFi:tr('settings.language.option.fi','Finnish'),
      signOut:tr('settings.sign_out','Sign Out'),
      dataBackup:tr('settings.data_backup','Data Backup'),
      export:tr('settings.export','Export'),
      import:tr('settings.import','Import'),
      backupHelp:tr('settings.backup_help','Export saves all data as a JSON file. Import replaces all current data.'),
      apiTitle:tr('settings.claude_api_key.title','AI Nutrition Coach'),
      apiHelp:tr('settings.claude_api_key.help','Get your free API key at console.anthropic.com. The key is stored only on this device and is never synced to the cloud.'),
      apiLabel:tr('settings.claude_api_key.label','Claude API Key'),
      apiPlaceholder:tr('settings.claude_api_key.placeholder','sk-ant-...'),
      apiSave:tr('settings.claude_api_key.save','Save Key'),
      danger:tr('settings.danger','Danger Zone'),
      dangerDesc:tr('settings.danger_desc','This permanently deletes all your workouts, programs, and settings. This cannot be undone.'),
      dangerTypeConfirm:tr('settings.danger_type_confirm','Type DELETE to confirm'),
      clearAll:tr('settings.clear_all','Clear All Data'),
      clearAllConfirm:tr('settings.clear_all_confirm','Permanently Delete All Data')
    },
    values:{
      email:currentUser?.email||'',
      syncLabel:syncStatus.label,
      syncClassName:syncStatus.className,
      language:profile.language||(window.I18N&&I18N.getLanguage?I18N.getLanguage():'en'),
      backupContext:getAccountBackupContextText(),
      apiKey,
      appVersion:'Ironforge v'+APP_VERSION,
      dangerOpen:settingsAccountUiState.dangerOpen===true,
      dangerInput:settingsAccountUiState.dangerInput||'',
      dangerDeleteDisabled:!isDangerDeleteConfirmed()
    }
  };
}
window.__IRONFORGE_SETTINGS_ACCOUNT_ISLAND_EVENT__=SETTINGS_ACCOUNT_ISLAND_EVENT;
window.getSettingsAccountReactSnapshot=getSettingsAccountReactSnapshot;
window.notifySettingsAccountIsland=notifySettingsAccountIsland;
const SETTINGS_SCHEDULE_ISLAND_EVENT='ironforge:settings-schedule-updated';
function hasSettingsScheduleIslandMount(){
  return !!document.getElementById('settings-schedule-react-root');
}
function isSettingsScheduleIslandActive(){
  return window.__IRONFORGE_SETTINGS_SCHEDULE_ISLAND_MOUNTED__===true;
}
function notifySettingsScheduleIsland(){
  if(!hasSettingsScheduleIslandMount())return;
  window.dispatchEvent(new CustomEvent(SETTINGS_SCHEDULE_ISLAND_EVENT));
}
function getSettingsScheduleStatusText(){
  const sep=' · ';
  const name=schedule.sportName||getDefaultSportName();
  const intensity=schedule.sportIntensity||'hard';
  const intensityLabel=tr('settings.intensity.'+intensity,intensity.charAt(0).toUpperCase()+intensity.slice(1));
  const days=schedule.sportDays||[];
  const dayStr=days.length?days.slice().sort((a,b)=>a-b).map(d=>DAY_NAMES[d]).join(', '):tr('settings.status.no_days','No days set');
  return name+sep+intensityLabel+sep+dayStr;
}
function getSettingsScheduleReactSnapshot(){
  const intensity=schedule.sportIntensity||'hard';
  return{
    labels:{
      statusBar:getSettingsScheduleStatusText(),
      title:tr('settings.sport_load.title','Sport Load'),
      subtitle:tr('settings.sport_load.subtitle','Set up your regular sport so the planner can steer sessions around it.'),
      activitySection:tr('settings.sport_load.section.activity','Sport'),
      activitySectionSub:tr('settings.sport_load.section.activity_sub','Name the recurring sport or cardio that affects your training week.'),
      activityName:tr('settings.activity_name','Activity name'),
      activityPlaceholder:tr('settings.activity_placeholder','e.g. Hockey, Soccer, Running'),
      profileSection:tr('settings.sport_load.section.profile','Load profile'),
      profileSectionSub:tr('settings.sport_load.section.profile_sub','Shape how strongly sport load should push training away from hard lower-body work.'),
      intensityLabel:tr('settings.intensity','Intensity'),
      intensityEasy:tr('settings.intensity.easy','Easy'),
      intensityModerate:tr('settings.intensity.moderate','Moderate'),
      intensityHard:tr('settings.intensity.hard','Hard'),
      legHeavy:tr('settings.leg_heavy','Leg-heavy'),
      legHeavySub:tr('settings.leg_heavy_sub','Warns when scheduling legs after sport'),
      regularSportDays:tr('settings.regular_sport_days','Regular Sport Days')
    },
    values:{
      sportName:schedule.sportName||getDefaultSportName(),
      sportIntensity:intensity,
      sportLegsHeavy:schedule.sportLegsHeavy!==false,
      sportDays:[...(schedule.sportDays||[])],
      dayNames:Array.from({length:7},(_,i)=>DAY_NAMES[(i+1)%7]||'')
    }
  };
}
window.__IRONFORGE_SETTINGS_SCHEDULE_ISLAND_EVENT__=SETTINGS_SCHEDULE_ISLAND_EVENT;
window.getSettingsScheduleReactSnapshot=getSettingsScheduleReactSnapshot;
window.notifySettingsScheduleIsland=notifySettingsScheduleIsland;
const SETTINGS_PROGRAM_ISLAND_EVENT='ironforge:settings-program-updated';
function hasSettingsProgramIslandMount(){
  return !!document.getElementById('settings-program-react-root');
}
function isSettingsProgramIslandActive(){
  return window.__IRONFORGE_SETTINGS_PROGRAM_ISLAND_MOUNTED__===true;
}
function notifySettingsProgramIsland(){
  if(!hasSettingsProgramIslandMount())return;
  window.dispatchEvent(new CustomEvent(SETTINGS_PROGRAM_ISLAND_EVENT));
}
function parseInlineStyle(styleText){
  return String(styleText||'').split(';').reduce((acc,entry)=>{
    const [rawKey,rawValue]=entry.split(':');
    const key=String(rawKey||'').trim();
    const value=String(rawValue||'').trim();
    if(!key||!value)return acc;
    const camelKey=key.replace(/-([a-z])/g,(_,char)=>char.toUpperCase());
    acc[camelKey]=value;
    return acc;
  },{});
}
function serializeSettingsNode(node){
  if(!node)return null;
  if(node.nodeType===Node.TEXT_NODE){
    return node.textContent?{type:'text',text:node.textContent}:null;
  }
  if(node.nodeType!==Node.ELEMENT_NODE)return null;
  const el=node;
  const attrs={};
  Array.from(el.attributes||[]).forEach(attr=>{
    if(attr.name==='class')attrs.className=attr.value;
    else if(attr.name==='for')attrs.htmlFor=attr.value;
    else if(attr.name==='style')attrs.style=parseInlineStyle(attr.value);
    else if(attr.name==='onclick')attrs.onClickCode=attr.value;
    else if(attr.name==='onchange')attrs.onChangeCode=attr.value;
    else if(attr.name==='checked')attrs.defaultChecked=true;
    else attrs[attr.name]=attr.value===''?true:attr.value;
  });
  if(el.tagName==='INPUT'&&el.type==='checkbox'){
    attrs.defaultChecked=el.checked===true;
  }else if(el.tagName==='TEXTAREA'){
    attrs.defaultValue=el.value||'';
  }else if(el.tagName==='SELECT'){
    attrs.defaultValue=el.value||'';
  }else if(el.tagName==='INPUT'){
    if(attrs.value!==undefined){
      attrs.defaultValue=attrs.value;
      delete attrs.value;
    }else if(el.value!==''){
      attrs.defaultValue=el.value;
    }
  }
  return{
    type:'element',
    tag:el.tagName.toLowerCase(),
    attrs,
    children:Array.from(el.childNodes||[]).map(serializeSettingsNode).filter(Boolean)
  };
}
function getProgramBasicsSnapshotData(){
  const card=document.createElement('details');
  const container=document.createElement('div');
  const summaryEl=document.createElement('div');
  renderProgramBasics({card,container,summaryEl,bindAutoSave:false,notifyIsland:false});
  return{
    visible:card.style.display!=='none',
    summary:summaryEl.textContent||'',
    tree:Array.from(container.childNodes).map(serializeSettingsNode).filter(Boolean)
  };
}
function getProgramSwitcherSnapshotData(){
  const active=getActiveProgramId();
  const requested=typeof getPreferredTrainingDaysPerWeek==='function'
    ? getPreferredTrainingDaysPerWeek(profile)
    : 3;
  const requestedLabel=typeof getTrainingDaysPerWeekLabel==='function'
    ? getTrainingDaysPerWeekLabel(requested)
    : requested+' sessions / week';
  const exactPrograms=getSuggestedProgramsForTrainingDays(requested,profile);
  const visible=exactPrograms.slice();
  if(active&&!visible.some(program=>program.id===active)&&PROGRAMS[active]){
    visible.push(PROGRAMS[active]);
  }
  const cards=(visible.length?visible:Object.values(PROGRAMS)).map(program=>{
    const compatibility=getProgramFrequencyCompatibility(program.id,profile);
    const effectiveLabel=typeof getTrainingDaysPerWeekLabel==='function'
      ? getTrainingDaysPerWeekLabel(compatibility.effective)
      : compatibility.effective+' sessions / week';
    return{
      id:program.id,
      icon:program.icon||'🏋️',
      name:(window.I18N&&I18N.t)?I18N.t('program.'+program.id+'.name',null,program.name):program.name,
      description:(window.I18N&&I18N.t)?I18N.t('program.'+program.id+'.description',null,program.description||''):program.description||'',
      fitLabel:compatibility.supportsExact
        ? tr('program.frequency_card.fit','Fits {value}',{value:requestedLabel})
        : tr('program.frequency_card.fallback','Uses {value}',{value:effectiveLabel}),
      fitTone:compatibility.supportsExact?'ok':'fallback',
      active:program.id===active,
      activeLabel:tr('program.active','Active')
    };
  });
  return{
    helper:tr('program.frequency_filter.showing','Showing programs that fit {value}. Your current program stays visible if it needs a fallback.',{value:requestedLabel}),
    cards
  };
}
function getSettingsProgramReactSnapshot(){
  const prog=getActiveProgram();
  const basics=getProgramBasicsSnapshotData();
  const switcher=getProgramSwitcherSnapshotData();
  const progName=(window.I18N&&I18N.t)?I18N.t('program.'+prog.id+'.name',null,prog.name):prog.name;
  const progDesc=(window.I18N&&I18N.t)?I18N.t('program.'+prog.id+'.description',null,prog.description||''):prog.description||'';
  return{
    labels:{
      statusBar:(()=>{const canonicalName=(window.I18N&&I18N.t)?I18N.t('program.'+prog.id+'.name',null,prog.name):prog.name;const summary=prog.getSimpleSettingsSummary?prog.getSimpleSettingsSummary(getActiveProgramState()):'';return summary?canonicalName+' · '+summary:canonicalName;})(),
      basicsTitle:tr('settings.program_basics','Program Basics'),
      trainingProgram:tr('settings.training_program','Training Program'),
      advancedTitle:tr('settings.program_advanced_title','Advanced Setup'),
      advancedHelp:tr('settings.program_advanced_help','Exercise swaps, cycle controls, peak block, and program-specific options.')
    },
    values:{
      programId:prog.id,
      basicsVisible:basics.visible,
      basicsSummary:basics.summary,
      basicsTree:basics.tree,
      basicsRenderKey:JSON.stringify(basics.tree),
      trainingProgramSummary:progDesc?`${progName} · ${progDesc}`:progName,
      switcher
    }
  };
}
window.__IRONFORGE_SETTINGS_PROGRAM_ISLAND_EVENT__=SETTINGS_PROGRAM_ISLAND_EVENT;
window.getSettingsProgramReactSnapshot=getSettingsProgramReactSnapshot;
window.notifySettingsProgramIsland=notifySettingsProgramIsland;
const SETTINGS_PREFERENCES_ISLAND_EVENT='ironforge:settings-preferences-updated';
function hasSettingsPreferencesIslandMount(){
  return !!document.getElementById('settings-preferences-react-root');
}
function isSettingsPreferencesIslandActive(){
  return window.__IRONFORGE_SETTINGS_PREFERENCES_ISLAND_MOUNTED__===true;
}
function notifySettingsPreferencesIsland(){
  if(!hasSettingsPreferencesIslandMount())return;
  window.dispatchEvent(new CustomEvent(SETTINGS_PREFERENCES_ISLAND_EVENT));
}
function getSettingsPreferencesReactSnapshot(){
  const prefs=normalizeTrainingPreferences(profile);
  return{
    labels:{
      statusBar:getTrainingPreferencesSummary(profile),
      title:tr('settings.preferences.title','Training Preferences'),
      help:tr('settings.preferences.help','These preferences shape future smart recommendations and AI-generated training.'),
      goalsSection:tr('settings.preferences.section.goals','Goals & Volume'),
      goalLabel:tr('settings.preferences.goal','Primary Goal'),
      goalStrength:tr('settings.preferences.goal.strength','Strength'),
      goalHypertrophy:tr('settings.preferences.goal.hypertrophy','Hypertrophy'),
      goalGeneralFitness:tr('settings.preferences.goal.general_fitness','General Fitness'),
      goalSportSupport:tr('settings.preferences.goal.sport_support','Sport Support'),
      trainingDaysLabel:tr('settings.preferences.training_days','Target Training Frequency'),
      trainingDays2:tr('settings.preferences.training_days_value','{count} sessions / week',{count:2}),
      trainingDays3:tr('settings.preferences.training_days_value','{count} sessions / week',{count:3}),
      trainingDays4:tr('settings.preferences.training_days_value','{count} sessions / week',{count:4}),
      trainingDays5:tr('settings.preferences.training_days_value','{count} sessions / week',{count:5}),
      trainingDays6:tr('settings.preferences.training_days_value','{count} sessions / week',{count:6}),
      sessionDurationLabel:tr('settings.preferences.session_duration','Target Session Length'),
      duration30:tr('settings.preferences.duration_value.30','30 min'),
      duration45:tr('settings.preferences.duration_value.45','45 min'),
      duration60:tr('settings.preferences.duration_value.60','60 min'),
      duration75:tr('settings.preferences.duration_value.75','75 min'),
      duration90:tr('settings.preferences.duration_value.90','90 min'),
      equipmentSection:tr('settings.preferences.section.equipment','Equipment & Session Prep'),
      equipmentLabel:tr('settings.preferences.equipment','Equipment Access'),
      equipmentFullGym:tr('settings.preferences.equipment.full_gym','Full Gym'),
      equipmentBasicGym:tr('settings.preferences.equipment.basic_gym','Basic Gym'),
      equipmentHomeGym:tr('settings.preferences.equipment.home_gym','Home Gym'),
      equipmentMinimal:tr('settings.preferences.equipment.minimal','Minimal Equipment'),
      warmupTitle:tr('settings.preferences.warmup_sets','Automatic warm-up sets'),
      warmupHelp:tr('settings.preferences.warmup_sets_help','Prepend warm-up ramp sets (50%-85%) to main compound lifts at the start of each workout.'),
      sportCheckTitle:tr('settings.preferences.sport_check','Pre-workout sport check-in'),
      sportCheckHelp:tr('settings.preferences.sport_check_help','Ask about sport load around today before recommending the session.'),
      sessionSection:tr('settings.preferences.section.session','Session Settings'),
      restLabel:tr('settings.default_rest','Default Rest Timer'),
      off:tr('common.off','Off'),
      notesLabel:tr('settings.preferences.notes','Notes, limitations, preferences'),
      notesPlaceholder:tr('settings.preferences.notes_placeholder','e.g. Avoid high-impact jumps, prefer barbell compounds, 60 min cap'),
      restartOnboarding:tr('settings.preferences.restart_onboarding','Run Guided Setup Again')
    },
    values:{
      summary:getTrainingPreferencesSummary(profile),
      goal:prefs.goal,
      trainingDaysPerWeek:String(prefs.trainingDaysPerWeek),
      sessionMinutes:String(prefs.sessionMinutes),
      equipmentAccess:prefs.equipmentAccess,
      warmupSetsEnabled:prefs.warmupSetsEnabled===true,
      sportReadinessCheckEnabled:prefs.sportReadinessCheckEnabled===true,
      defaultRest:String(profile.defaultRest||120),
      notes:prefs.notes||''
    }
  };
}
window.__IRONFORGE_SETTINGS_PREFERENCES_ISLAND_EVENT__=SETTINGS_PREFERENCES_ISLAND_EVENT;
window.getSettingsPreferencesReactSnapshot=getSettingsPreferencesReactSnapshot;
window.notifySettingsPreferencesIsland=notifySettingsPreferencesIsland;
const SETTINGS_BODY_ISLAND_EVENT='ironforge:settings-body-updated';
function hasSettingsBodyIslandMount(){
  return !!document.getElementById('settings-body-react-root');
}
function isSettingsBodyIslandActive(){
  return window.__IRONFORGE_SETTINGS_BODY_ISLAND_MOUNTED__===true;
}
function notifySettingsBodyIsland(){
  if(!hasSettingsBodyIslandMount())return;
  window.dispatchEvent(new CustomEvent(SETTINGS_BODY_ISLAND_EVENT));
}
function getSettingsBodyReactSnapshot(){
  const bodyMetrics=profile.bodyMetrics||{};
  return{
    labels:{
      metricsTitle:tr('settings.body.metrics_title','Body Metrics'),
      metricsHelp:tr('settings.body.metrics_help','Used by the AI Nutrition Coach to personalise advice. All weights in kg.'),
      sex:tr('settings.body.sex','Sex'),
      sexNone:tr('settings.body.sex_none','— select —'),
      sexMale:tr('settings.body.sex_male','Male'),
      sexFemale:tr('settings.body.sex_female','Female'),
      activity:tr('settings.body.activity','Activity level'),
      activityNone:tr('settings.body.activity_none','— select —'),
      activitySedentary:tr('settings.body.activity_sedentary','Sedentary'),
      activityLight:tr('settings.body.activity_light','Lightly active'),
      activityModerate:tr('settings.body.activity_moderate','Active'),
      activityVery:tr('settings.body.activity_very','Very active'),
      weight:tr('settings.body.weight','Current weight (kg)'),
      height:tr('settings.body.height','Height (cm)'),
      age:tr('settings.body.age','Age'),
      targetWeight:tr('settings.body.target_weight','Target weight (kg)'),
      goalTitle:tr('settings.body.goal_title','Body Composition Goal'),
      goalLabel:tr('settings.body.goal_label','What are you working towards?'),
      goalNone:tr('settings.body.goal_none','— select —'),
      goalLoseFat:tr('settings.body.goal.lose_fat','Lose fat'),
      goalGainMuscle:tr('settings.body.goal.gain_muscle','Gain muscle'),
      goalRecomp:tr('settings.body.goal.recomp','Body recomp (lose fat + gain muscle)'),
      goalMaintain:tr('settings.body.goal.maintain','Maintain'),
      save:tr('settings.body.save','Save')
    },
    values:{
      sex:bodyMetrics.sex||'',
      activityLevel:bodyMetrics.activityLevel||'',
      weight:bodyMetrics.weight??'',
      height:bodyMetrics.height??'',
      age:bodyMetrics.age??'',
      targetWeight:bodyMetrics.targetWeight??'',
      bodyGoal:bodyMetrics.bodyGoal||''
    }
  };
}
window.__IRONFORGE_SETTINGS_BODY_ISLAND_EVENT__=SETTINGS_BODY_ISLAND_EVENT;
window.getSettingsBodyReactSnapshot=getSettingsBodyReactSnapshot;
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
let _programBasicsAutoSaveBound=false;
function renderProgramBasics(options){
  const opts=options||{};
  const card=opts.card||document.getElementById('program-basics-panel');
  const container=opts.container||document.getElementById('program-basics-container');
  const summaryEl=opts.summaryEl||document.getElementById('program-basics-summary');
  const prog=getActiveProgram(),state=getActiveProgramState();
  if(!card||!container)return;
  if(!opts.container&&isSettingsProgramIslandActive()){
    notifySettingsProgramIsland();
    return;
  }
  if(prog&&prog.renderSimpleSettings){
    card.style.display='';
    prog.renderSimpleSettings(state,container);
    if(typeof getProgramFrequencyNoticeHTML==='function'){
      const noticeHtml=getProgramFrequencyNoticeHTML(prog.id,profile);
      if(noticeHtml)container.insertAdjacentHTML('afterbegin',noticeHtml);
    }
    if(summaryEl)summaryEl.textContent=prog.getSimpleSettingsSummary?prog.getSimpleSettingsSummary(state):'';
    if(window.I18N&&I18N.applyTranslations)I18N.applyTranslations(card);
    // Auto-save: delegate change events from program basics fields
    if(opts.bindAutoSave!==false&&container.isConnected&&!_programBasicsAutoSaveBound){
      _programBasicsAutoSaveBound=true;
      container.addEventListener('change',function(e){
        if(e.target.matches('select,input[type="number"],input[type="text"],input[type="checkbox"],input[type="hidden"]')){
          saveSimpleProgramSettings();
        }
      });
    }
    if(opts.notifyIsland!==false&&isSettingsProgramIslandActive())notifySettingsProgramIsland();
    return;
  }
  card.style.display='none';
  container.innerHTML='';
  if(summaryEl)summaryEl.textContent='';
  if(opts.notifyIsland!==false&&isSettingsProgramIslandActive())notifySettingsProgramIsland();
}
function renderTrainingProgramSummary(){
  const summaryEl=document.getElementById('training-program-summary');
  const prog=getActiveProgram();
  if(isSettingsProgramIslandActive()){
    notifySettingsProgramIsland();
    return;
  }
  if(!summaryEl||!prog)return;
  const progName=(window.I18N&&I18N.t)?I18N.t('program.'+prog.id+'.name',null,prog.name):prog.name;
  const progDesc=(window.I18N&&I18N.t)?I18N.t('program.'+prog.id+'.description',null,prog.description||''):prog.description||'';
  summaryEl.textContent=progDesc?`${progName} · ${progDesc}`:progName;
  if(isSettingsProgramIslandActive())notifySettingsProgramIsland();
}
function renderTrainingPreferencesSummary(){
  const summaryEl=document.getElementById('training-preferences-summary');
  if(summaryEl)summaryEl.textContent=getTrainingPreferencesSummary(profile);
  renderTrainingStatusBar();
  if(isSettingsPreferencesIslandActive())notifySettingsPreferencesIsland();
}
function renderSportStatusBar(){
  const bar=document.getElementById('sport-status-bar');
  if(!bar){
    if(isSettingsScheduleIslandActive())notifySettingsScheduleIsland();
    return;
  }
  const sep='<span class="status-sep">\u00b7</span>';
  const name=schedule.sportName||getDefaultSportName();
  const intensity=schedule.sportIntensity||'hard';
  const intensityLabel=tr('settings.intensity.'+intensity,intensity.charAt(0).toUpperCase()+intensity.slice(1));
  const days=schedule.sportDays||[];
  const dayStr=days.length?days.sort((a,b)=>a-b).map(d=>DAY_NAMES[d]).join(', '):tr('settings.status.no_days','No days set');
  bar.innerHTML=name+sep+intensityLabel+sep+dayStr;
  if(isSettingsScheduleIslandActive())notifySettingsScheduleIsland();
}
function renderTrainingStatusBar(){
  const bar=document.getElementById('training-status-bar');
  if(!bar)return;
  bar.textContent=getTrainingPreferencesSummary(profile);
}
function renderProgramStatusBar(){
  const bar=document.getElementById('program-status-bar');
  if(isSettingsProgramIslandActive()){
    notifySettingsProgramIsland();
    return;
  }
  if(!bar){
    if(isSettingsProgramIslandActive())notifySettingsProgramIsland();
    return;
  }
  const prog=getActiveProgram(),state=getActiveProgramState();
  if(!prog){bar.textContent='';return;}
  const sep='<span class="status-sep">\u00b7</span>';
  const progName=(window.I18N&&I18N.t)?I18N.t('program.'+prog.id+'.name',null,prog.name):prog.name;
  const summary=prog.getSimpleSettingsSummary?prog.getSimpleSettingsSummary(state):'';
  bar.innerHTML=summary?progName+sep+summary:progName;
  if(isSettingsProgramIslandActive())notifySettingsProgramIsland();
}

/* ── Onboarding bridge (UI is in src/onboarding-island/main.jsx) ── */

let _onboardingRetryTimer=null;

function parseOnboardingExerciseIds(text){
  return String(text||'').split(',').map(p=>p.trim()).filter(Boolean)
    .map(name=>window.EXERCISE_LIBRARY?.resolveExerciseId?.(name)||name).filter(Boolean);
}

function getOnboardingDefaultDraft(){
  const prefs=normalizeTrainingPreferences(profile);
  const coaching=normalizeCoachingProfile(profile);
  return{
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
}

function getOnboardingReactSnapshot(){
  return{draft:getOnboardingDefaultDraft()};
}

function notifyOnboardingIsland(){
  window.dispatchEvent(new CustomEvent('ironforge:onboarding-updated'));
}

function buildOnboardingRecommendation(draft){
  const d=draft||getOnboardingDefaultDraft();
  const nextProfile=cloneJson(profile)||{};
  nextProfile.preferences=normalizeTrainingPreferences({
    ...nextProfile,
    preferences:{...(nextProfile.preferences||getDefaultTrainingPreferences()),goal:d.goal,trainingDaysPerWeek:parseInt(d.trainingDaysPerWeek,10)||3,sessionMinutes:parseInt(d.sessionMinutes,10)||60,equipmentAccess:d.equipmentAccess}
  });
  nextProfile.coaching=normalizeCoachingProfile({
    ...nextProfile,
    coaching:{...(nextProfile.coaching||getDefaultCoachingProfile()),experienceLevel:d.experienceLevel,guidanceMode:d.guidanceMode,
      sportProfile:{name:String(d.sportName||'').trim(),inSeason:d.inSeason===true,sessionsPerWeek:parseInt(d.sportSessionsPerWeek,10)||0},
      limitations:{jointFlags:[...(d.jointFlags||[])],avoidMovementTags:[...(d.avoidMovementTags||[])],avoidExerciseIds:parseOnboardingExerciseIds(d.avoidExercisesText)},
      exercisePreferences:{preferredExerciseIds:[],excludedExerciseIds:parseOnboardingExerciseIds(d.avoidExercisesText)},
      onboardingCompleted:false}
  });
  return getInitialPlanRecommendation({
    profile:nextProfile,
    schedule:{...schedule,sportName:String(d.sportName||schedule.sportName||'').trim()||schedule.sportName}
  });
}

function closeOnboardingModal(){
  document.getElementById('onboarding-modal')?.classList.remove('active');
}

async function completeOnboarding(draft){
  const d=draft||getOnboardingDefaultDraft();
  const recommendation=buildOnboardingRecommendation(d);
  const nextPreferences=normalizeTrainingPreferences({
    preferences:{...(profile.preferences||getDefaultTrainingPreferences()),goal:d.goal,trainingDaysPerWeek:parseInt(d.trainingDaysPerWeek,10)||3,sessionMinutes:parseInt(d.sessionMinutes,10)||60,equipmentAccess:d.equipmentAccess}
  });
  const nextCoaching=normalizeCoachingProfile({
    coaching:{...(profile.coaching||getDefaultCoachingProfile()),experienceLevel:d.experienceLevel,guidanceMode:d.guidanceMode,
      sportProfile:{name:String(d.sportName||'').trim(),inSeason:d.inSeason===true,sessionsPerWeek:parseInt(d.sportSessionsPerWeek,10)||0},
      limitations:{jointFlags:[...(d.jointFlags||[])],avoidMovementTags:[...(d.avoidMovementTags||[])],avoidExerciseIds:parseOnboardingExerciseIds(d.avoidExercisesText)},
      exercisePreferences:{preferredExerciseIds:[],excludedExerciseIds:parseOnboardingExerciseIds(d.avoidExercisesText)},
      onboardingCompleted:true}
  });
  const nextPrograms={...(profile.programs||{})};
  if(!nextPrograms[recommendation.programId]&&PROGRAMS?.[recommendation.programId]?.getInitialState){
    nextPrograms[recommendation.programId]=PROGRAMS[recommendation.programId].getInitialState();
  }
  profile={...profile,preferences:nextPreferences,coaching:nextCoaching,activeProgram:recommendation.programId,programs:nextPrograms};
  normalizeProfileProgramStateMap(profile);
  if(String(d.sportName||'').trim())schedule.sportName=String(d.sportName||'').trim();
  closeOnboardingModal();
  await saveProfileData({docKeys:getAllProfileDocumentKeys(profile)});
  await saveScheduleData();
  initSettings();
  if(!activeWorkout)resetNotStartedView();
  updateProgramDisplay();
  updateDashboard();
  const msg=(window.I18N&&I18N.t)?I18N.t('onboarding.complete_toast',null,'Plan created and onboarding completed'):'Plan created and onboarding completed';
  showToast(msg,'var(--green)');
  goToLog();
}

function maybeOpenOnboarding(options){
  const opts=options||{};
  clearTimeout(_onboardingRetryTimer);
  if(document.body.classList.contains('login-active'))return;
  if(activeWorkout)return;
  const coaching=normalizeCoachingProfile(profile);
  if(!opts.force&&coaching.onboardingCompleted===true)return;
  if(!window.PROGRAMS||!Object.keys(PROGRAMS).length){
    _onboardingRetryTimer=setTimeout(()=>maybeOpenOnboarding(opts),120);
    return;
  }
  document.getElementById('onboarding-modal')?.classList.add('active');
  notifyOnboardingIsland();
}

function restartOnboarding(){
  if(activeWorkout){
    showToast(
      (window.I18N&&I18N.t)?I18N.t('settings.preferences.restart_onboarding_active',null,'Finish or discard the active workout before reopening guided setup.'):'Finish or discard the active workout before reopening guided setup.',
      'var(--muted)'
    );
    return;
  }
  const modal=document.getElementById('onboarding-modal');
  if(!modal)return;
  modal.classList.add('active');
  notifyOnboardingIsland();
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
  renderSportStatusBar();
  renderProgramStatusBar();
  renderBackupContext();
  // Claude API key field (nutrition coach)
  {const keyInp=document.getElementById('nutrition-api-key-input');
   if(keyInp&&typeof getNutritionApiKey==='function')keyInp.value=getNutritionApiKey();}
  // Body metrics
  {const bm=profile.bodyMetrics||{};
   const sx=document.getElementById('body-sex');if(sx)sx.value=bm.sex||'';
   const al=document.getElementById('body-activity');if(al)al.value=bm.activityLevel||'';
   const w=document.getElementById('body-weight');if(w)w.value=bm.weight||'';
   const h=document.getElementById('body-height');if(h)h.value=bm.height||'';
   const a=document.getElementById('body-age');if(a)a.value=bm.age||'';
   const tw=document.getElementById('body-target-weight');if(tw)tw.value=bm.targetWeight||'';
   const bg=document.getElementById('body-goal');if(bg)bg.value=bm.bodyGoal||'';}
  // Version display
  {const vEl=document.getElementById('app-version');if(vEl)vEl.textContent='Ironforge v'+APP_VERSION;}
  // Reset danger zone confirm state
  settingsAccountUiState={dangerOpen:false,dangerInput:''};
  {const dzt=document.getElementById('danger-zone-trigger');if(dzt)dzt.style.display='';
   const dzc=document.getElementById('danger-zone-confirm');if(dzc)dzc.style.display='none';
   const dzi=document.getElementById('danger-zone-input');if(dzi)dzi.value='';
   const dzb=document.getElementById('danger-zone-delete-btn');if(dzb)dzb.disabled=true;}
  showSettingsTab(_settingsTab);
  if(window.I18N&&I18N.applyTranslations)I18N.applyTranslations(document);
  if(isSettingsAccountIslandActive())notifySettingsAccountIsland();
  if(isSettingsScheduleIslandActive())notifySettingsScheduleIsland();
  if(isSettingsPreferencesIslandActive())notifySettingsPreferencesIsland();
  if(isSettingsProgramIslandActive())notifySettingsProgramIsland();
  if(isSettingsBodyIslandActive())notifySettingsBodyIsland();
}

// Program UI/state helpers moved to core/program-layer.js.

function toggleDay(kind,dow,el){
  const key=kind==='sport'?'sportDays':kind+'Days';
  const cls=kind+'-day';
  if(el.classList.contains(cls)){el.classList.remove(cls);schedule[key]=schedule[key].filter(d=>d!==dow);}
  else{el.classList.add(cls);if(!schedule[key])schedule[key]=[];if(!schedule[key].includes(dow))schedule[key].push(dow);}
  if(kind==='sport')saveSchedule();
}

function saveRestTimer(){
  profile.defaultRest=parseInt(document.getElementById('default-rest').value)||120;
  restDuration=profile.defaultRest;
  saveProfileData({docKeys:['profile_core']});
  notifySettingsPreferencesIsland();
  _showAutoSaveToast(tr('toast.rest_updated','Saved'),'var(--blue)');
}
function saveBodyMetrics(){
  const toNum=(id,parse)=>{const v=document.getElementById(id)?.value;return v?parse(v):null;};
  if(!profile.bodyMetrics)profile.bodyMetrics={};
  profile.bodyMetrics={
    sex:document.getElementById('body-sex')?.value||null,
    activityLevel:document.getElementById('body-activity')?.value||null,
    weight:toNum('body-weight',parseFloat),
    height:toNum('body-height',parseFloat),
    age:toNum('body-age',parseInt),
    targetWeight:toNum('body-target-weight',parseFloat),
    bodyGoal:document.getElementById('body-goal')?.value||null,
  };
  saveProfileData({docKeys:['profile_core']});
  notifySettingsBodyIsland();
  showToast(tr('settings.body.saved','Saved'),'var(--green)');
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
  notifySettingsPreferencesIsland();
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
  _showAutoSaveToast(tr('toast.preferences_saved','Saved'),'var(--purple)');
}
function saveSimpleProgramSettings(){
  const prog=getActiveProgram(),state=getActiveProgramState();
  if(!prog||!prog.saveSimpleSettings)return;
  const newState=prog.saveSimpleSettings(state);
  setProgramState(prog.id,newState);
  saveProfileData({programIds:[prog.id]});
  renderProgramBasics();
  notifySettingsProgramIsland();
  updateProgramDisplay();
  updateDashboard();
  renderProgramStatusBar();
  _showAutoSaveToast(tr('program.setup_saved','Saved'),'var(--purple)');
}
function saveLanguageSetting(){
  const lang=arguments.length&&typeof arguments[0]==='string'?arguments[0]:(document.getElementById('app-language')?.value||'en');
  if(window.I18N&&I18N.setLanguage)I18N.setLanguage(lang,{persist:true});
  profile.language=lang;
  saveProfileData({docKeys:['profile_core']});
  notifySettingsAccountIsland();
  notifySettingsBodyIsland();
  const msg=window.I18N&&I18N.t?I18N.t('settings.language.saved'):'Language updated';
  showToast(msg,'var(--blue)');
}
let _autoSaveToastTimer=null;
function _showAutoSaveToast(msg,color){
  clearTimeout(_autoSaveToastTimer);
  _autoSaveToastTimer=setTimeout(()=>showToast(msg,color),600);
}
function saveSchedule(nextValues){
  if(nextValues&&typeof nextValues==='object'){
    if('sportName' in nextValues)schedule.sportName=String(nextValues.sportName||'').trim()||getDefaultSportName();
    if('sportLegsHeavy' in nextValues)schedule.sportLegsHeavy=nextValues.sportLegsHeavy!==false;
    if('sportIntensity' in nextValues)schedule.sportIntensity=nextValues.sportIntensity||'hard';
    if('sportDays' in nextValues)schedule.sportDays=Array.isArray(nextValues.sportDays)?[...nextValues.sportDays]:[];
  }else{
    const nameInp=document.getElementById('sport-name');
    if(nameInp)schedule.sportName=nameInp.value.trim()||getDefaultSportName();
    const cb=document.getElementById('sport-legs-heavy');
    if(cb)schedule.sportLegsHeavy=cb.checked;
  }
  if(!activeWorkout)resetNotStartedView();
  saveScheduleData();
  saveProfileData({docKeys:['profile_core']});
  if(isSettingsScheduleIslandActive())notifySettingsScheduleIsland();
  updateProgramDisplay();updateDashboard();renderSportStatusBar();
  _showAutoSaveToast(tr('toast.schedule_saved','Saved'),'var(--blue)');
}

function renderBackupContext(){
  const el=document.getElementById('backup-context');
  const text=getAccountBackupContextText();
  if(isSettingsAccountIslandActive()){
    notifySettingsAccountIsland();
    return text;
  }
  if(!el)return text;
  el.textContent=text;
  return text;
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
        notifySettingsAccountIsland();
        notifySettingsBodyIsland();
        showToast(tr('toast.data_imported','Data imported! Reloading...'),"var(--green)");
        setTimeout(()=>location.reload(),1000);
      });
    }catch(err){showToast(tr('toast.could_not_read_file','Could not read file'),"var(--orange)");}
  };
  reader.readAsText(file);
  event.target.value="";
}

function showDangerConfirm(){
  settingsAccountUiState={dangerOpen:true,dangerInput:''};
  if(isSettingsAccountIslandActive()){
    notifySettingsAccountIsland();
    return;
  }
  document.getElementById('danger-zone-trigger').style.display='none';
  const panel=document.getElementById('danger-zone-confirm');
  panel.style.display='';
  const inp=document.getElementById('danger-zone-input');
  inp.value='';
  document.getElementById('danger-zone-delete-btn').disabled=true;
  inp.focus();
}
function checkDangerConfirm(){
  const nextValue=arguments.length&&typeof arguments[0]==='string'
    ? arguments[0]
    : (document.getElementById('danger-zone-input')?.value||'');
  settingsAccountUiState={...settingsAccountUiState,dangerInput:nextValue};
  if(isSettingsAccountIslandActive()){
    notifySettingsAccountIsland();
    return;
  }
  document.getElementById('danger-zone-delete-btn').disabled=nextValue.trim().toUpperCase()!=='DELETE';
}
async function clearAllData(){
  if(typeof clearLocalDataCache==='function')clearLocalDataCache({includeScoped:true,includeLegacy:true});
  else{
    try{localStorage.removeItem('ic_workouts');localStorage.removeItem('ic_schedule');localStorage.removeItem('ic_profile');}catch(e){}
  }
  workouts=[];schedule={sportName:getDefaultSportName(),sportDays:[],sportIntensity:'hard',sportLegsHeavy:true};
  profile={defaultRest:120,activeProgram:'forge',programs:{},language:(window.I18N&&I18N.getLanguage?I18N.getLanguage():'en'),preferences:getDefaultTrainingPreferences(),coaching:getDefaultCoachingProfile()};
  settingsAccountUiState={dangerOpen:false,dangerInput:''};
  Object.values(PROGRAMS).forEach(prog=>{profile.programs[prog.id]=prog.getInitialState();});
  await replaceWorkoutTableSnapshot([]);
  await saveWorkouts();await saveScheduleData();await saveProfileData({docKeys:getAllProfileDocumentKeys(profile)});
  notifySettingsAccountIsland();
  notifySettingsBodyIsland();
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
    if(typeof isLogActiveIslandActive==='function'&&isLogActiveIslandActive())notifyLogActiveIsland();
  }
  if(document.getElementById('name-modal')?.classList.contains('active')&&typeof renderExerciseCatalog==='function'){
    renderExerciseCatalog();
  }
  if(document.getElementById('page-nutrition')?.classList.contains('active')&&typeof window.initNutritionPage==='function')window.initNutritionPage();
  else if(document.getElementById('page-history')?.classList.contains('active'))renderHistory();
  else if(document.getElementById('page-log')?.classList.contains('active'))resetNotStartedView();
  notifySettingsAccountIsland();
  notifySettingsScheduleIsland();
  notifySettingsPreferencesIsland();
  notifySettingsProgramIsland();
  notifySettingsBodyIsland();
}
window.updateLanguageDependentUI=updateLanguageDependentUI;

// INIT
initAuth();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js'); });
}
