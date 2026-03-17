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
const IS_E2E_TEST_ENV=window.__IRONFORGE_TEST_USER_ID__==='e2e-user'||window.navigator.webdriver===true;

if(IS_E2E_TEST_ENV){
  document.documentElement.classList.add('test-env');
}

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
}
function setSportIntensity(val,el){
  schedule.sportIntensity=val;
  document.querySelectorAll('#sport-intensity-btns button').forEach(b=>b.classList.remove('active'));
  if(el)el.classList.add('active');
  saveSchedule();
}
let _settingsTab='schedule';
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
    // Auto-save: delegate change events from program basics fields
    if(!_programBasicsAutoSaveBound){
      _programBasicsAutoSaveBound=true;
      container.addEventListener('change',function(e){
        if(e.target.matches('select,input[type="number"],input[type="text"],input[type="checkbox"],input[type="hidden"]')){
          saveSimpleProgramSettings();
        }
      });
    }
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
  if(summaryEl)summaryEl.textContent=getTrainingPreferencesSummary(profile);
  renderTrainingStatusBar();
}
function renderSportStatusBar(){
  const bar=document.getElementById('sport-status-bar');
  if(!bar)return;
  const sep='<span class="status-sep">\u00b7</span>';
  const name=schedule.sportName||getDefaultSportName();
  const intensity=schedule.sportIntensity||'hard';
  const intensityLabel=tr('settings.intensity.'+intensity,intensity.charAt(0).toUpperCase()+intensity.slice(1));
  const days=schedule.sportDays||[];
  const dayStr=days.length?days.sort((a,b)=>a-b).map(d=>DAY_NAMES[d]).join(', '):tr('settings.status.no_days','No days set');
  bar.innerHTML=name+sep+intensityLabel+sep+dayStr;
}
function renderTrainingStatusBar(){
  const bar=document.getElementById('training-status-bar');
  if(!bar)return;
  bar.textContent=getTrainingPreferencesSummary(profile);
}
function renderProgramStatusBar(){
  const bar=document.getElementById('program-status-bar');
  if(!bar)return;
  const prog=getActiveProgram(),state=getActiveProgramState();
  if(!prog){bar.textContent='';return;}
  const sep='<span class="status-sep">\u00b7</span>';
  const progName=(window.I18N&&I18N.t)?I18N.t('program.'+prog.id+'.name',null,prog.name):prog.name;
  const summary=prog.getSimpleSettingsSummary?prog.getSimpleSettingsSummary(state):'';
  bar.innerHTML=summary?progName+sep+summary:progName;
}

const ONBOARDING_JOINT_FLAGS=[
  {value:'shoulder',key:'onboarding.joint.shoulder',label:'Shoulder'},
  {value:'knee',key:'onboarding.joint.knee',label:'Knee'},
  {value:'low_back',key:'onboarding.joint.low_back',label:'Low Back'}
];
const ONBOARDING_MOVEMENT_TAGS=[
  {value:'squat',key:'onboarding.movement.squat',label:'Squat'},
  {value:'hinge',key:'onboarding.movement.hinge',label:'Hinge'},
  {value:'vertical_press',key:'onboarding.movement.vertical_press',label:'Overhead Press'},
  {value:'single_leg',key:'onboarding.movement.single_leg',label:'Single-Leg'}
];
let onboardingState={step:0,draft:null,recommendation:null,retryTimer:null};

function trOnboarding(key,fallback,params){
  return (window.I18N&&I18N.t)?I18N.t(key,params,fallback):fallback;
}

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

function getOnboardingProgramMeta(recommendation){
  const program=PROGRAMS?.[recommendation?.programId];
  const programId=recommendation?.programId||'';
  const programName=(window.I18N&&I18N.t)?I18N.t('program.'+programId+'.name',null,program?.name||programId):program?.name||programId;
  const programDescription=(window.I18N&&I18N.t)?I18N.t('program.'+programId+'.description',null,program?.description||''):program?.description||'';
  return{program,programId,programName,programDescription};
}

function renderOnboardingRecommendationStep(){
  const recommendation=buildOnboardingRecommendation();
  const {programName,programDescription}=getOnboardingProgramMeta(recommendation);
  const weekCount=(recommendation.weekTemplate||[]).length;
  const firstDuration=recommendation.weekTemplate?.[0]?.durationHint||'';
  const firstSessionLabel=/^\d+$/.test(String(recommendation.firstSessionOption||''))?trOnboarding('onboarding.first_session_label','Session {value}',{value:recommendation.firstSessionOption}):String(recommendation.firstSessionOption||trOnboarding('onboarding.first_session_default','Session 1'));
  const whyItems=(recommendation.why||[]).slice(0,2);
  const adjustments=(recommendation.initialAdjustments||[]).slice(0,2);
  return `
    <div class="onboarding-grid">
      <div class="onboarding-card onboarding-recommendation-hero">
        <div class="onboarding-kicker">${escapeHtml(trOnboarding('onboarding.recommend.kicker','Recommended Program'))}</div>
        <div class="onboarding-title" style="font-size:20px">${escapeHtml(programName)}</div>
        <div class="onboarding-sub" style="margin-top:8px">${escapeHtml(programDescription||trOnboarding('onboarding.recommend.sub','This is the best starting point based on your goal, schedule, sport load, and desired guidance level.'))}</div>
        <div class="onboarding-recommendation-pills">
          <div class="onboarding-recommendation-pill"><span>${escapeHtml(trOnboarding('onboarding.recommend.week1','Week 1'))}</span><strong>${escapeHtml(trOnboarding('onboarding.recommend.sessions','{count} sessions',{count:weekCount}))}</strong></div>
          <div class="onboarding-recommendation-pill"><span>${escapeHtml(trOnboarding('onboarding.recommend.start_here','Start here'))}</span><strong>${escapeHtml(firstSessionLabel)}</strong></div>
          ${firstDuration?`<div class="onboarding-recommendation-pill"><span>${escapeHtml(trOnboarding('onboarding.recommend.time_target','Time target'))}</span><strong>${escapeHtml(firstDuration)}</strong></div>`:''}
        </div>
        ${adjustments.length?`<div class="onboarding-note" style="margin-top:12px">${adjustments.map(item=>escapeHtml(item)).join(' · ')}</div>`:''}
      </div>
      <div class="onboarding-card">
        <div class="card-title" style="margin-bottom:10px">${escapeHtml(trOnboarding('onboarding.recommend.why_title','Why this is your best start'))}</div>
        <div class="onboarding-why-list">${whyItems.map(item=>`<div class="onboarding-why-item">• ${escapeHtml(item)}</div>`).join('')}</div>
      </div>
      <div class="onboarding-card">
        <div class="card-title" style="margin-bottom:10px">${escapeHtml(trOnboarding('onboarding.recommend.week_title','Your first week'))}</div>
        <div class="onboarding-week-list">${(recommendation.weekTemplate||[]).map(item=>`<div class="onboarding-week-item"><span>${escapeHtml(item.dayLabel)} · ${escapeHtml(item.type)}</span><span class="onboarding-week-meta">${escapeHtml(item.durationHint)}</span></div>`).join('')}</div>
      </div>
    </div>`;
}

function renderOnboardingSelectionStep(){
  const draft=getOnboardingDraft();
  if(onboardingState.step===0){
    return `
      <div class="onboarding-grid">
        <div>
          <label>${escapeHtml(trOnboarding('onboarding.field.goal','Primary Goal'))}</label>
          <div class="onboarding-option-grid">
            ${renderOnboardingOptionButton(draft.goal==='strength',trOnboarding('onboarding.goal.strength','Strength'),trOnboarding('onboarding.goal.strength_desc','Improve main lifts and progression.'),"setOnboardingValue('goal','strength');renderOnboarding()")}
            ${renderOnboardingOptionButton(draft.goal==='hypertrophy',trOnboarding('onboarding.goal.hypertrophy','Hypertrophy'),trOnboarding('onboarding.goal.hypertrophy_desc','Bias training toward muscle gain and volume.'),"setOnboardingValue('goal','hypertrophy');renderOnboarding()")}
            ${renderOnboardingOptionButton(draft.goal==='general_fitness',trOnboarding('onboarding.goal.general_fitness','General Fitness'),trOnboarding('onboarding.goal.general_fitness_desc','Keep training sustainable and broadly useful.'),"setOnboardingValue('goal','general_fitness');renderOnboarding()")}
            ${renderOnboardingOptionButton(draft.goal==='sport_support',trOnboarding('onboarding.goal.sport_support','Sport Support'),trOnboarding('onboarding.goal.sport_support_desc','Fit lifting around outside sport or cardio load.'),"setOnboardingValue('goal','sport_support');renderOnboarding()")}
          </div>
        </div>
        <div>
          <label>${escapeHtml(trOnboarding('onboarding.field.experience','Experience Level'))}</label>
          <div class="onboarding-option-grid">
            ${renderOnboardingOptionButton(draft.experienceLevel==='beginner',trOnboarding('onboarding.experience.beginner','Beginner'),trOnboarding('onboarding.experience.beginner_desc','You want simple defaults and low complexity.'),"setOnboardingValue('experienceLevel','beginner');renderOnboarding()")}
            ${renderOnboardingOptionButton(draft.experienceLevel==='returning',trOnboarding('onboarding.experience.returning','Returning'),trOnboarding('onboarding.experience.returning_desc','You have trained before, but want a stable ramp back in.'),"setOnboardingValue('experienceLevel','returning');renderOnboarding()")}
            ${renderOnboardingOptionButton(draft.experienceLevel==='intermediate',trOnboarding('onboarding.experience.intermediate','Intermediate'),trOnboarding('onboarding.experience.intermediate_desc','You can handle more structure and moderate autoregulation.'),"setOnboardingValue('experienceLevel','intermediate');renderOnboarding()")}
            ${renderOnboardingOptionButton(draft.experienceLevel==='advanced',trOnboarding('onboarding.experience.advanced','Advanced'),trOnboarding('onboarding.experience.advanced_desc','You want a higher ceiling and more nuanced planning.'),"setOnboardingValue('experienceLevel','advanced');renderOnboarding()")}
          </div>
        </div>
      </div>`;
  }
  if(onboardingState.step===1){
    return `
      <div class="onboarding-grid">
        <div class="onboarding-inline-grid">
          <div>
            <label>${escapeHtml(trOnboarding('onboarding.field.frequency','Training Frequency'))}</label>
            <select onchange="setOnboardingValue('trainingDaysPerWeek',parseInt(this.value,10));renderOnboarding()">
              ${[2,3,4,5,6].map(value=>`<option value="${value}"${value===parseInt(draft.trainingDaysPerWeek,10)?' selected':''}>${escapeHtml(trOnboarding('onboarding.frequency_value','{count} sessions / week',{count:value}))}</option>`).join('')}
            </select>
          </div>
          <div>
            <label>${escapeHtml(trOnboarding('onboarding.field.duration','Session Length'))}</label>
            <select onchange="setOnboardingValue('sessionMinutes',parseInt(this.value,10));renderOnboarding()">
              ${[30,45,60,75,90].map(value=>`<option value="${value}"${value===parseInt(draft.sessionMinutes,10)?' selected':''}>${escapeHtml(trOnboarding('onboarding.duration_value','{count} min',{count:value}))}</option>`).join('')}
            </select>
          </div>
        </div>
        <div>
          <label>${escapeHtml(trOnboarding('onboarding.field.equipment','Equipment Access'))}</label>
          <select onchange="setOnboardingValue('equipmentAccess',this.value);renderOnboarding()">
            <option value="full_gym"${draft.equipmentAccess==='full_gym'?' selected':''}>${escapeHtml(trOnboarding('onboarding.equipment.full_gym','Full Gym'))}</option>
            <option value="basic_gym"${draft.equipmentAccess==='basic_gym'?' selected':''}>${escapeHtml(trOnboarding('onboarding.equipment.basic_gym','Basic Gym'))}</option>
            <option value="home_gym"${draft.equipmentAccess==='home_gym'?' selected':''}>${escapeHtml(trOnboarding('onboarding.equipment.home_gym','Home Gym'))}</option>
            <option value="minimal"${draft.equipmentAccess==='minimal'?' selected':''}>${escapeHtml(trOnboarding('onboarding.equipment.minimal','Minimal Equipment'))}</option>
          </select>
        </div>
      </div>`;
  }
  if(onboardingState.step===2){
    return `
      <div class="onboarding-grid">
        <div class="onboarding-inline-grid">
          <div>
            <label>${escapeHtml(trOnboarding('onboarding.field.sport','Sport or Cardio'))}</label>
            <input type="text" value="${escapeHtml(draft.sportName||'')}" placeholder="${escapeHtml(trOnboarding('onboarding.field.sport_placeholder','e.g. Hockey, Running, Soccer'))}" oninput="setOnboardingValue('sportName',this.value)">
            <div class="onboarding-field-help">${escapeHtml(trOnboarding('onboarding.field.sport_help','Add your regular sport or other recurring hobby here if it affects recovery during the week.'))}</div>
          </div>
          <div>
            <label>${escapeHtml(trOnboarding('onboarding.field.sport_sessions','Sessions / Week'))}</label>
            <select onchange="setOnboardingValue('sportSessionsPerWeek',parseInt(this.value,10));renderOnboarding()">
              ${[0,1,2,3,4,5,6,7].map(value=>`<option value="${value}"${value===parseInt(draft.sportSessionsPerWeek,10)?' selected':''}>${value}</option>`).join('')}
            </select>
          </div>
        </div>
        <label class="toggle-row" for="onboarding-in-season" style="margin-top:0">
          <div>
            <div class="toggle-row-title">${escapeHtml(trOnboarding('onboarding.field.in_season','In season'))}</div>
            <div class="toggle-row-sub">${escapeHtml(trOnboarding('onboarding.field.in_season_help','Use a more conservative starting point when sport is a real load right now.'))}</div>
          </div>
          <div class="toggle-switch">
            <input type="checkbox" id="onboarding-in-season" ${draft.inSeason?'checked':''} onchange="setOnboardingValue('inSeason',this.checked)">
            <span class="toggle-track"><span class="toggle-thumb"></span></span>
          </div>
        </label>
        <div>
          <label>${escapeHtml(trOnboarding('onboarding.field.joints','Joint Flags'))}</label>
          <div class="onboarding-chip-row">
            ${ONBOARDING_JOINT_FLAGS.map(item=>`<button type="button" class="onboarding-chip${(draft.jointFlags||[]).includes(item.value)?' active':''}" onclick="toggleOnboardingArrayValue('jointFlags','${item.value}')">${escapeHtml(trOnboarding(item.key,item.label))}</button>`).join('')}
          </div>
        </div>
        <div>
          <label>${escapeHtml(trOnboarding('onboarding.field.movements','Avoid Movement Patterns'))}</label>
          <div class="onboarding-chip-row">
            ${ONBOARDING_MOVEMENT_TAGS.map(item=>`<button type="button" class="onboarding-chip${(draft.avoidMovementTags||[]).includes(item.value)?' active':''}" onclick="toggleOnboardingArrayValue('avoidMovementTags','${item.value}')">${escapeHtml(trOnboarding(item.key,item.label))}</button>`).join('')}
          </div>
        </div>
        <div>
          <label>${escapeHtml(trOnboarding('onboarding.field.avoid_exercises','Avoided Exercises'))}</label>
          <textarea rows="3" placeholder="${escapeHtml(trOnboarding('onboarding.field.avoid_exercises_placeholder','Comma-separated exercise names'))}" oninput="setOnboardingValue('avoidExercisesText',this.value)">${escapeHtml(draft.avoidExercisesText||'')}</textarea>
          <div class="onboarding-field-help">${escapeHtml(trOnboarding('onboarding.field.avoid_exercises_help','Used to exclude obvious no-go exercises from the first recommendation and future session adaptation.'))}</div>
        </div>
      </div>`;
  }
  if(onboardingState.step===3){
    return `
      <div class="onboarding-grid">
        <div class="onboarding-option-grid">
          ${renderOnboardingOptionButton(draft.guidanceMode==='guided',trOnboarding('onboarding.guidance.guided','Tell me what to do'),trOnboarding('onboarding.guidance.guided_desc','Strong default recommendations, less manual decision-making.'),"setOnboardingValue('guidanceMode','guided');renderOnboarding()")}
          ${renderOnboardingOptionButton(draft.guidanceMode==='balanced',trOnboarding('onboarding.guidance.balanced','Balanced'),trOnboarding('onboarding.guidance.balanced_desc','Good defaults, but still leaves room to steer the plan.'),"setOnboardingValue('guidanceMode','balanced');renderOnboarding()")}
          ${renderOnboardingOptionButton(draft.guidanceMode==='self_directed',trOnboarding('onboarding.guidance.self_directed','Give me control'),trOnboarding('onboarding.guidance.self_directed_desc','Lighter guidance and more room for manual choices.'),"setOnboardingValue('guidanceMode','self_directed');renderOnboarding()")}
        </div>
      </div>`;
  }
  return renderOnboardingRecommendationStep();
}

function renderOnboarding(){
  const modal=document.getElementById('onboarding-modal');
  const container=document.getElementById('onboarding-content');
  if(!modal||!container)return;
  const titleMap=[
    trOnboarding('onboarding.step.0.title','Build your starting point'),
    trOnboarding('onboarding.step.1.title','Set your training envelope'),
    trOnboarding('onboarding.step.2.title','Add sport and constraints'),
    trOnboarding('onboarding.step.3.title','Choose your guidance level'),
    trOnboarding('onboarding.step.4.title','Start from a real plan')
  ];
  const subMap=[
    trOnboarding('onboarding.step.0.sub','This gives the engine enough signal to recommend the right starting plan.'),
    trOnboarding('onboarding.step.1.sub','These limits drive frequency, session trimming, and program fit.'),
    trOnboarding('onboarding.step.2.sub','Tell the assistant what has to be respected, especially your regular sport and real constraints.'),
    trOnboarding('onboarding.step.3.sub','This sets how opinionated the app should be when making decisions.'),
    trOnboarding('onboarding.step.4.sub','You should leave onboarding with a clear program, first week, and first session.')
  ];
  const primaryLabel=onboardingState.step===getOnboardingStepCount()-1?trOnboarding('onboarding.action.use_plan','Use This Plan'):trOnboarding('onboarding.action.continue','Continue');
  const secondaryLabel=onboardingState.step===0?trOnboarding('onboarding.action.not_now','Not now'):trOnboarding('onboarding.action.back','Back');
  container.innerHTML=`
    <div class="onboarding-flow">
      ${renderOnboardingProgress()}
      <div>
        <div class="onboarding-kicker">${escapeHtml(trOnboarding('onboarding.kicker','Guided Setup'))}</div>
        <div class="onboarding-title">${escapeHtml(titleMap[onboardingState.step]||trOnboarding('onboarding.kicker','Guided Setup'))}</div>
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
  const container=document.getElementById('onboarding-content');
  if(container)container.scrollTop=0;
}

function advanceOnboarding(){
  goToOnboardingStep(onboardingState.step+1);
}

function closeOnboardingModal(){
  document.getElementById('onboarding-modal')?.classList.remove('active');
  const container=document.getElementById('onboarding-content');
  if(container)container.scrollTop=0;
}

async function completeOnboarding(){
  const recommendation=onboardingState.recommendation||buildOnboardingRecommendation();
  const draft=getOnboardingDraft();
  const nextPreferences=normalizeTrainingPreferences({
    preferences:{
      ...(profile.preferences||getDefaultTrainingPreferences()),
      goal:draft.goal,
      trainingDaysPerWeek:parseInt(draft.trainingDaysPerWeek,10)||3,
      sessionMinutes:parseInt(draft.sessionMinutes,10)||60,
      equipmentAccess:draft.equipmentAccess
    }
  });
  const nextCoaching=normalizeCoachingProfile({
    coaching:{
      ...(profile.coaching||getDefaultCoachingProfile()),
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
      onboardingCompleted:true
    }
  });
  const nextPrograms={...(profile.programs||{})};
  if(!nextPrograms[recommendation.programId]&&PROGRAMS?.[recommendation.programId]?.getInitialState){
    nextPrograms[recommendation.programId]=PROGRAMS[recommendation.programId].getInitialState();
  }
  profile={
    ...profile,
    preferences:nextPreferences,
    coaching:nextCoaching,
    activeProgram:recommendation.programId,
    programs:nextPrograms
  };
  normalizeProfileProgramStateMap(profile);
  if(String(draft.sportName||'').trim())schedule.sportName=String(draft.sportName||'').trim();
  closeOnboardingModal();
  await saveProfileData({docKeys:getAllProfileDocumentKeys(profile)});
  await saveScheduleData();
  initSettings();
  onboardingState.draft=null;
  onboardingState.recommendation=null;
  onboardingState.step=0;
  if(!activeWorkout)resetNotStartedView();
  updateProgramDisplay();
  updateDashboard();
  showToast(trOnboarding('onboarding.complete_toast','Plan created and onboarding completed'),'var(--green)');
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
  if(activeWorkout){
    showToast(
      (window.I18N&&I18N.t)?I18N.t('settings.preferences.restart_onboarding_active',null,'Finish or discard the active workout before reopening guided setup.'):'Finish or discard the active workout before reopening guided setup.',
      'var(--muted)'
    );
    return;
  }
  resetOnboardingState();
  const modal=document.getElementById('onboarding-modal');
  if(!modal)return;
  modal.classList.add('active');
  renderOnboarding();
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
   const w=document.getElementById('body-weight');if(w)w.value=bm.weight||'';
   const h=document.getElementById('body-height');if(h)h.value=bm.height||'';
   const a=document.getElementById('body-age');if(a)a.value=bm.age||'';
   const tw=document.getElementById('body-target-weight');if(tw)tw.value=bm.targetWeight||'';
   const bg=document.getElementById('body-goal');if(bg)bg.value=bm.bodyGoal||'';}
  // Version display
  {const vEl=document.getElementById('app-version');if(vEl)vEl.textContent='Ironforge v'+APP_VERSION;}
  // Reset danger zone confirm state
  {const dzt=document.getElementById('danger-zone-trigger');if(dzt)dzt.style.display='';
   const dzc=document.getElementById('danger-zone-confirm');if(dzc)dzc.style.display='none';
   const dzi=document.getElementById('danger-zone-input');if(dzi)dzi.value='';
   const dzb=document.getElementById('danger-zone-delete-btn');if(dzb)dzb.disabled=true;}
  showSettingsTab(_settingsTab);
  if(window.I18N&&I18N.applyTranslations)I18N.applyTranslations(document);
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
  _showAutoSaveToast(tr('toast.rest_updated','Saved'),'var(--blue)');
}
function saveBodyMetrics(){
  const toNum=(id,parse)=>{const v=document.getElementById(id)?.value;return v?parse(v):null;};
  if(!profile.bodyMetrics)profile.bodyMetrics={};
  profile.bodyMetrics={
    weight:toNum('body-weight',parseFloat),
    height:toNum('body-height',parseFloat),
    age:toNum('body-age',parseInt),
    targetWeight:toNum('body-target-weight',parseFloat),
    bodyGoal:document.getElementById('body-goal')?.value||null,
  };
  saveProfileData({docKeys:['profile_core']});
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
  updateProgramDisplay();
  updateDashboard();
  renderProgramStatusBar();
  _showAutoSaveToast(tr('program.setup_saved','Saved'),'var(--purple)');
}
function saveLanguageSetting(){
  const lang=document.getElementById('app-language')?.value||'en';
  if(window.I18N&&I18N.setLanguage)I18N.setLanguage(lang,{persist:true});
  profile.language=lang;
  saveProfileData({docKeys:['profile_core']});
  const msg=window.I18N&&I18N.t?I18N.t('settings.language.saved'):'Language updated';
  showToast(msg,'var(--blue)');
}
let _autoSaveToastTimer=null;
function _showAutoSaveToast(msg,color){
  clearTimeout(_autoSaveToastTimer);
  _autoSaveToastTimer=setTimeout(()=>showToast(msg,color),600);
}
function saveSchedule(){
  const nameInp=document.getElementById('sport-name');
  if(nameInp)schedule.sportName=nameInp.value.trim()||getDefaultSportName();
  const cb=document.getElementById('sport-legs-heavy');
  if(cb)schedule.sportLegsHeavy=cb.checked;
  if(!activeWorkout)resetNotStartedView();
  saveScheduleData();
  saveProfileData({docKeys:['profile_core']});
  updateProgramDisplay();updateDashboard();renderSportStatusBar();
  _showAutoSaveToast(tr('toast.schedule_saved','Saved'),'var(--blue)');
}

function renderBackupContext(){
  const el=document.getElementById('backup-context');
  if(!el)return;
  const count=workouts?workouts.length:0;
  if(!count){el.textContent=tr('settings.backup_empty','No workouts recorded yet.');return;}
  const dates=workouts.map(w=>w.date).filter(Boolean).sort();
  const first=dates[0]||'';
  const firstFormatted=first?new Date(first).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'';
  el.textContent=tr('settings.backup_context','{count} workouts since {date}',{count,date:firstFormatted});
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

function showDangerConfirm(){
  document.getElementById('danger-zone-trigger').style.display='none';
  const panel=document.getElementById('danger-zone-confirm');
  panel.style.display='';
  const inp=document.getElementById('danger-zone-input');
  inp.value='';
  document.getElementById('danger-zone-delete-btn').disabled=true;
  inp.focus();
}
function checkDangerConfirm(){
  const inp=document.getElementById('danger-zone-input');
  document.getElementById('danger-zone-delete-btn').disabled=inp.value.trim().toUpperCase()!=='DELETE';
}
async function clearAllData(){
  if(typeof clearLocalDataCache==='function')clearLocalDataCache({includeScoped:true,includeLegacy:true});
  else{
    try{localStorage.removeItem('ic_workouts');localStorage.removeItem('ic_schedule');localStorage.removeItem('ic_profile');}catch(e){}
  }
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


