const DAY_NAMES=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// ── STATE (persisted via localStorage) ──────────
let workouts=[];
let schedule={hockeyDays:[3,0]};
let profile={defaultRest:120};
let activeWorkout=null, workoutTimer=null, workoutSeconds=0;
let restInterval=null, restSecondsLeft=0, restTotal=0, restDuration=120;
let pendingRPECallback=null;
let confirmCallback=null;
let nameModalCallback=null;
let _toastTimeout=null;
let exerciseIndex={};

const RPE_FEELS={6:'Easy',7:'Moderate',8:'Hard',9:'Very Hard',10:'Max'};

// ── FORGE PROTOCOL ENGINE ─────────────────────────────
const FORGE={
  mainIntensity:[0,0.70,0.75,0.80,0.725,0.775,0.825,0.60,0.75,0.80,0.85,0.775,0.825,0.875,0.60,0.80,0.85,0.90,0.85,0.90,0.95,0.60],
  auxIntensity:[0,0.60,0.65,0.70,0.625,0.675,0.725,0.50,0.65,0.70,0.75,0.675,0.725,0.775,0.50,0.70,0.75,0.80,0.75,0.80,0.85,0.50],
  deloadWeeks:[7,14,21],
  blockNames:['','Hypertrophy','Hypertrophy','Hypertrophy','Hypertrophy','Hypertrophy','Hypertrophy','Deload',
    'Strength','Strength','Strength','Strength','Strength','Strength','Deload',
    'Peaking','Peaking','Peaking','Peaking','Peaking','Peaking','Deload'],
  getReps(pct){if(pct<=0.575)return 8;if(pct<=0.625)return 7;if(pct<=0.675)return 6;if(pct<=0.725)return 5;if(pct<=0.775)return 4;if(pct<=0.825)return 3;if(pct<=0.875)return 2;return 1;},
  getRIR(pct){if(pct<=0.575)return 5;if(pct<=0.675)return 4;if(pct<=0.775)return 3;if(pct<=0.875)return 2;if(pct<=0.925)return 1;return 0;},
  setLow:4,setHigh:6,tmUp:0.02,tmDown:-0.05,
  modes:{
    sets:{name:'Sets Completed',desc:'Do sets until RIR cutoff. TM adjusts by total sets.',short:'Sets'},
    rtf:{name:'Reps to Failure',desc:'Normal sets + AMRAP last set. TM adjusts by reps hit.',short:'RTF'},
    rir:{name:'Last Set RIR',desc:'Fixed sets, report RIR on last set. Best for athletes.',short:'RIR'}
  },
  rnd(v,inc){return Math.round(v/inc)*inc;},
  getPrescription(tm,week,isAux,rounding,mode){
    mode=mode||'sets';
    const pct=isAux?this.auxIntensity[week]:this.mainIntensity[week];
    const wt=this.rnd(tm*pct,rounding||2.5);
    const reps=this.getReps(pct);
    const rir=this.getRIR(pct);
    const isDeload=this.deloadWeeks.includes(week);

    if(mode==='rtf'){
      const normalSets=isDeload?4:4;
      const repOutTarget=reps*2; // AMRAP target ~2x normal reps
      return{weight:wt,reps,rir,pct,isDeload,blockName:this.blockNames[week]||'',
        mode:'rtf',normalSets,repOutTarget,
        setTarget:isDeload?'5':(normalSets+'+AMRAP'),
        note:isDeload?reps+'×'+wt+'kg — easy, 5 sets':wt+'kg × '+reps+' reps for '+normalSets+' sets, then go all-out on set '+(normalSets+1)+' (target '+repOutTarget+'+ reps)'};
    }
    if(mode==='rir'){
      const fixedSets=isDeload?5:5;
      return{weight:wt,reps,rir,pct,isDeload,blockName:this.blockNames[week]||'',
        mode:'rir',fixedSets,rirTarget:rir,
        setTarget:String(fixedSets),
        note:isDeload?reps+'×'+wt+'kg — easy, 5 sets':wt+'kg × '+reps+' for '+fixedSets+' sets — on the last set, note how many reps you had left (target RIR ≤'+rir+')'};
    }
    // Default: sets completed mode
    return{weight:wt,reps,rir,pct,isDeload,
      setTarget:isDeload?'5':this.setLow+'-'+this.setHigh,blockName:this.blockNames[week]||'',
      mode:'sets',
      note:isDeload?reps+'×'+wt+'kg — easy, 5 sets':wt+'kg × '+reps+' reps — stop when RIR ≤'+rir+' (aim for '+this.setLow+'-'+this.setHigh+' sets)'};
  },
  adjustTM(tm,data,week,mode){
    mode=mode||'sets';
    if(this.deloadWeeks.includes(week))return tm;
    if(mode==='rtf'){
      // data = {repsOnLastSet, repOutTarget}
      const reps=data.repsOnLastSet||0, target=data.repOutTarget||10;
      if(reps>=target+3)return Math.round(tm*1.04*100)/100;  // crushed it: +4%
      if(reps>=target)return Math.round(tm*1.02*100)/100;     // hit target: +2%
      if(reps>=target-2)return tm;                              // close: no change
      return Math.round(tm*0.95*100)/100;                      // missed badly: -5%
    }
    if(mode==='rir'){
      // data = {setsCompleted, lastSetRIR}
      const sets=data.setsCompleted||0, lastRIR=data.lastSetRIR;
      if(sets<5)return Math.round(tm*0.95*100)/100;           // didn't finish sets: -5%
      if(lastRIR!==null&&lastRIR!==undefined){
        if(lastRIR<=0)return Math.round(tm*0.97*100)/100;     // maxed out: -3%
        if(lastRIR<=1)return tm;                                // hard: no change
        if(lastRIR<=2)return Math.round(tm*1.01*100)/100;     // moderate: +1%
        return Math.round(tm*1.02*100)/100;                    // easy: +2%
      }
      return tm;
    }
    // Default: sets completed
    const sets=typeof data==='number'?data:data.setsCompleted||0;
    if(sets<this.setLow)return Math.round(tm*(1+this.tmDown)*100)/100;
    if(sets>this.setHigh)return Math.round(tm*(1+this.tmUp)*100)/100;
    return tm;
  },
  getDayExercises(day,freq,lifts){
    const m=lifts.main,a=lifts.aux,r=[];
    // Exact splits from Forge Protocol spreadsheet
    // m[0]=SQ m[1]=BP m[2]=DL m[3]=OHP  a[0]=SQaux1 a[1]=SQaux2 a[2]=BPaux1 a[3]=BPaux2 a[4]=DLaux a[5]=OHPaux
    const splits={
      2:[[['m',0],['m',1],['a',4],['a',5]],[['m',2],['m',3],['a',0],['a',2]]],
      3:[[['m',0],['a',4],['a',3]],[['m',1],['m',3],['a',0]],[['m',2],['a',2],['a',1],['a',5]]],
      4:[[['m',0],['a',3],['a',4]],[['m',1],['a',0],['a',5]],[['m',2],['a',2]],[['m',3],['a',1]]],
      5:[[['m',0],['a',5]],[['m',1],['a',0]],[['m',2],['a',2]],[['m',3],['a',1]],[['a',3],['a',4]]],
      6:[[['m',0],['a',2]],[['a',5],['a',4]],[['m',1],['a',0]],[['a',3],['a',1]],[['m',2]],[['m',3]]]
    };
    const layout=splits[freq]?splits[freq][day-1]:splits[3][0];
    if(!layout)return r;
    layout.forEach(([type,idx])=>{
      const src=type==='m'?m:a;
      if(src[idx])r.push({...src[idx],isAux:type==='a'});
    });
    return r;
  },

  // Auxiliary swap options per category (from Forge Protocol spreadsheet)
  auxOptions:{
    squat:['Front Squat','Paused Squat','High Bar Squat','Beltless Squat','Wider Stance Squat','Narrower Stance Squat','Box Squat','Pin Squat','Half Squat','Good Morning','Squat With Slow Eccentric','Leg Press'],
    bench:['Close-Grip Bench','Long Pause Bench','Spoto Press','Incline Press','Wider Grip Bench','Board Press','Pin Press','Slingshot Bench','Bench With Feet Up','Bench With Slow Eccentric','DB Bench'],
    deadlift:['Sumo Deadlift','Conventional Deadlift','Block Pull','Rack Pull','Deficit Deadlift','Romanian Deadlift','Stiff Leg Deadlift','Snatch Grip Deadlift','Trap Bar Deadlift'],
    ohp:['Push Press','Behind The Neck OHP','Seated OHP','Incline Press','DB OHP'],
    back:['Barbell Rows','DB Rows','Chest Supported Rows','T-Bar Rows','Pull-ups','Chin-ups','Neutral Grip Pull-ups','Pull-downs']
  },

  // Tuneable constants for fatigue engine and hockey logic
  config:{
    muscularBase:40,muscularDecay:15,
    cnsBase:50,cnsDecay:20,
    setsWeight:3,
    hockeyMuscularBonus:20,hockeyCnsBonus:15,
    rpeWeight:8,extraHockeyCns:10,
    hockeyRecentHours:30
  },

  // Get category for an auxiliary slot index (0-5)
  getAuxCategory(slotIdx){
    return ['squat','squat','bench','bench','deadlift','ohp'][slotIdx]||'squat';
  }
};



// ── STORAGE ──────────────────────────────────────────────────
async function loadData(){
  try{
    const w=localStorage.getItem('ic_workouts');
    if(w) workouts=JSON.parse(w);
  }catch(e){}
  try{
  }catch(e){}
  try{
    const s=localStorage.getItem('ic_schedule');
    if(s) schedule=JSON.parse(s);
  }catch(e){}
  try{
    const pr=localStorage.getItem('ic_profile');
    if(pr) profile=JSON.parse(pr);
  }catch(e){}
  // Migrate legacy ats* keys to forge* (one-time migration)
  if(profile.atsLifts&&!profile.forgeLifts){profile.forgeLifts=profile.atsLifts;profile.forgeWeek=profile.atsWeek||1;profile.forgeRounding=profile.atsRounding||2.5;profile.forgeDaysPerWeek=profile.atsDaysPerWeek||3;profile.forgeDayNum=profile.atsDayNum||1;profile.forgeBackExercise=profile.atsBackExercise||'Barbell Rows';profile.forgeBackWeight=profile.atsBackWeight||0;profile.forgeMode=profile.atsMode||'sets';profile.forgeWeekStartDate=profile.atsWeekStartDate||new Date().toISOString();}
  workouts.forEach(w=>{if(w.type==='ats'){w.type='forge';if(w.atsWeek){w.forgeWeek=w.atsWeek;}if(w.atsDayNum){w.forgeDayNum=w.atsDayNum;}}});
  // Ensure Forge Protocol fields exist
  if(!profile.forgeLifts) profile.forgeLifts={main:[{name:'Squat',tm:100},{name:'Bench Press',tm:80},{name:'Deadlift',tm:120},{name:'OHP',tm:50}],aux:[{name:'Front Squat',tm:80},{name:'Pause Squat',tm:90},{name:'Close-Grip Bench',tm:70},{name:'Spoto Press',tm:75},{name:'Stiff Leg Deadlift',tm:100},{name:'Push Press',tm:50}]};
  if(!profile.forgeWeek) profile.forgeWeek=1;
  if(!profile.forgeRounding) profile.forgeRounding=2.5;
  if(!profile.forgeDaysPerWeek) profile.forgeDaysPerWeek=3;
  if(!profile.forgeDayNum) profile.forgeDayNum=1;
  if(!profile.forgeBackExercise) profile.forgeBackExercise='Barbell Rows';
  if(!profile.forgeBackWeight) profile.forgeBackWeight=0;
  if(!profile.forgeMode) profile.forgeMode='sets';
  if(!profile.forgeWeekStartDate) profile.forgeWeekStartDate=new Date().toISOString();
  // Persist any newly defaulted fields so they survive next load
  saveProfileData();
  // Date-based week auto-advance: catch up if >=7 days have passed since last advance
  if((profile.forgeWeek||1)<21){
    const daysSinceStart=(Date.now()-new Date(profile.forgeWeekStartDate).getTime())/864e5;
    if(daysSinceStart>=7){
      const weeksElapsed=Math.floor(daysSinceStart/7);
      profile.forgeWeek=Math.min(21,(profile.forgeWeek||1)+weeksElapsed);
      profile.forgeWeekStartDate=new Date().toISOString();
      saveProfileData();
    }
  }
  restDuration=profile.defaultRest||120;
  buildExerciseIndex();
  updateDashboard();
  updateForgeDisplay();
}
async function saveWorkouts(){ try{localStorage.setItem('ic_workouts',JSON.stringify(workouts));}catch(e){} }
async function saveScheduleData(){ try{localStorage.setItem('ic_schedule',JSON.stringify(schedule));}catch(e){} }
async function saveProfileData(){ try{localStorage.setItem('ic_profile',JSON.stringify(profile));}catch(e){} }

// ── NAV ──────────────────────────────────────────────────────
function showPage(name,btn){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('page-'+name).classList.add('active');
  btn.classList.add('active');
  if(name==='dashboard') updateDashboard();
  if(name==='history') renderHistory();
  if(name==='settings') initSettings();
  if(name==='log'){updateForgeDisplay();}
}



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
  const cfg=FORGE.config;
  let muscular=Math.max(0,cfg.muscularBase-daysSinceLift*cfg.muscularDecay)+Math.min(30,recentSets*cfg.setsWeight)+(recentTypes.includes('hockey')?cfg.hockeyMuscularBonus:0);
  let cns=Math.max(0,cfg.cnsBase-daysSinceLift*cfg.cnsDecay)+(avgRecentRPE-5)*cfg.rpeWeight+(recentTypes.includes('hockey')?cfg.hockeyCnsBonus:0);
  const extraToday=last72h.filter(w=>w.type==='hockey'&&w.subtype==='extra').length;
  cns+=extraToday*cfg.extraHockeyCns;
  muscular=Math.min(100,Math.max(0,muscular));cns=Math.min(100,Math.max(0,cns));
  return{muscular:Math.round(muscular),cns:Math.round(cns),overall:Math.round(muscular*.5+cns*.5),daysSinceLift,daysSinceHockey,recentSets,avgRecentRPE};
}
function wasHockeyRecently(hours){
  hours=hours||FORGE.config.hockeyRecentHours;
  return workouts.some(w=>w.type==='hockey'&&(Date.now()-new Date(w.date).getTime())<hours*3600000);
}
function getFatigueColor(p){return p<35?'var(--green)':p<65?'var(--orange)':'var(--accent)';}
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
    if(el){el.style.width=f[k]+'%';el.style.background=getFatigueColor(f[k]);}
    if(vEl)vEl.textContent=f[k]+'%';
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
  const forgeW=profile.forgeWeek||1;
  let s='';
  if(tHasLift&&tHasHockey)s=`<span style="color:var(--green);font-weight:700">✅ Workout + hockey logged</span>`;
  else if(tHasLift)s=`<span style="color:var(--green);font-weight:700">✅ Workout logged</span>`;
  else if(tHasHockey)s=`<span style="color:var(--blue);font-weight:700">🏒 Hockey logged</span>`;
  else if(todayIsHockey)s=`<span style="color:var(--blue);font-weight:700">🏒 Hockey day — go easy on legs if you lift</span>`;
  else s=`<span style="color:var(--purple);font-weight:700">📋 Forge Protocol · ${FORGE.blockNames[forgeW]||''} · Week ${forgeW}</span>`;
  document.getElementById('today-status').innerHTML=s;
}

// ── DASHBOARD ────────────────────────────────────────────────
function updateDashboard(){
  renderWeekStrip();
  const f=computeFatigue();updateFatigueBars(f);

  // Training Maxes from profile
  const lifts=profile.forgeLifts;
  if(lifts){
    const m=lifts.main;
    document.getElementById('tm-sq').textContent=m[0]?m[0].tm+'kg':'—';
    document.getElementById('tm-bp').textContent=m[1]?m[1].tm+'kg':'—';
    document.getElementById('tm-dl').textContent=m[2]?m[2].tm+'kg':'—';
    document.getElementById('tm-ohp').textContent=m[3]?m[3].tm+'kg':'—';
    // Update labels with actual names
    const labels=document.querySelectorAll('#tm-grid .label');
    if(labels.length>=4){labels[0].textContent=m[0]?.name||'Squat';labels[1].textContent=m[1]?.name||'Bench';labels[2].textContent=m[2]?.name||'Deadlift';labels[3].textContent=m[3]?.name||'OHP';}
  }

  // Weekly session progress
  const now=new Date(),sow=new Date(now);sow.setDate(now.getDate()-((now.getDay()+6)%7));sow.setHours(0,0,0,0);
  const freq=profile.forgeDaysPerWeek||3;
  const doneThisWeek=workouts.filter(w=>w.type==='forge'&&new Date(w.date)>=sow).length;
  const hockeyThisWeek=workouts.filter(w=>w.type==='hockey'&&new Date(w.date)>=sow).length;
  const pctDone=Math.min(100,doneThisWeek/freq*100);
  document.getElementById('volume-bar').style.width=pctDone+'%';
  let volText=doneThisWeek+'/'+freq+' sessions done';
  if(hockeyThisWeek) volText+=' · '+hockeyThisWeek+' hockey';
  if(doneThisWeek>=freq) volText+=' ✅';
  document.getElementById('volume-text').textContent=volText;

  // Today's Plan
  const recovery=100-f.overall,todayDow=new Date().getDay();
  const isHockeyDay=schedule.hockeyDays.includes(todayDow);
  const hadHockeyYesterday=wasHockeyRecently(36);
  const forgeW=profile.forgeWeek||1;
  const mode=profile.forgeMode||'sets';
  const modeName=FORGE.modes[mode]?.short||'Sets';
  const isDeload=FORGE.deloadWeeks.includes(forgeW);
  const pct=Math.round((FORGE.mainIntensity[forgeW]||0)*100);
  const reps=FORGE.getReps(FORGE.mainIntensity[forgeW]||0.7);
  const rir=FORGE.getRIR(FORGE.mainIntensity[forgeW]||0.7);

  // Practical explanation of what today looks like
  let modeExplain='';
  if(isDeload){
    modeExplain='Light work — 60% TM, 5 easy sets per exercise.';
  }else if(mode==='sets'){
    modeExplain=`${pct}% TM × ${reps} reps per set. Do sets until RIR ≤${rir}, aim for 4-6 total.`;
  }else if(mode==='rtf'){
    modeExplain=`${pct}% TM × ${reps} reps for 4 sets, then one all-out AMRAP set (target ${reps*2}+ reps).`;
  }else if(mode==='rir'){
    modeExplain=`${pct}% TM × ${reps} reps for 5 sets. On the last set, note how many reps you had left.`;
  }

  const blockInfo=`<div style="font-size:11px;color:var(--purple);margin-bottom:4px;padding:6px 10px;background:rgba(167,139,250,0.08);border-radius:8px;border:1px solid rgba(167,139,250,0.15)">📋 Forge Protocol · ${FORGE.blockNames[forgeW]||''} · Week ${forgeW} · ${pct}% TM · ${modeName} mode</div><div style="font-size:11px;color:var(--muted);margin-bottom:10px;padding:0 2px">${modeExplain}</div>`;
  let rec='';
  if(doneThisWeek>=freq) rec=blockInfo+`<div style="font-weight:700;color:var(--green);margin-bottom:6px">✅ Week complete!</div><div style="font-size:13px;color:var(--muted)">All ${freq} sessions done. Rest up for ${forgeW<21?'next week':'the end of the cycle'}.</div>`;
  else if(recovery<40) rec=blockInfo+`<div style="font-weight:700;color:var(--accent);margin-bottom:6px">⚠️ High fatigue — rest or deload</div><div style="font-size:13px;color:var(--muted)">Recovery ${recovery}%. ${isDeload?'Good timing — deload week!':'Consider resting today.'} ${freq-doneThisWeek} session${freq-doneThisWeek>1?'s':''} left.</div>`;
  else if(isHockeyDay) rec=blockInfo+`<div style="font-weight:700;color:var(--blue);margin-bottom:6px">🏒 Hockey day</div><div style="font-size:13px;color:var(--muted)">Pick an upper-body day on the Log tab, or rest. ${freq-doneThisWeek} session${freq-doneThisWeek>1?'s':''} left this week.</div>`;
  else if(hadHockeyYesterday) rec=blockInfo+`<div style="font-weight:700;color:var(--blue);margin-bottom:6px">🏒 Post-hockey</div><div style="font-size:13px;color:var(--muted)">Legs may be fatigued. The Log tab will suggest an upper-focused day. ${freq-doneThisWeek} left.</div>`;
  else if(isDeload) rec=blockInfo+`<div style="font-weight:700;color:var(--green);margin-bottom:6px">🌊 Deload week</div><div style="font-size:13px;color:var(--muted)">60% TM, 5 easy sets. Recovery ${recovery}%. ${freq-doneThisWeek} session${freq-doneThisWeek>1?'s':''} left.</div>`;
  else rec=blockInfo+`<div style="font-weight:700;color:var(--accent);margin-bottom:6px">🏋️ Training day</div><div style="font-size:13px;color:var(--muted)">Recovery ${recovery}% — ${recovery>=75?'feeling fresh, push it':'moderate effort'}. ${freq-doneThisWeek} session${freq-doneThisWeek>1?'s':''} left this week.</div>`;
  document.getElementById('next-session-content').innerHTML=rec;
  document.getElementById('header-sub').textContent=`Forge Protocol · ${FORGE.blockNames[forgeW]||''} · Week ${forgeW} · Recovery ${recovery}%`;
}



function resetNotStartedView(){
  document.getElementById('workout-not-started').innerHTML=`
    <div class="quick-log-row">
      <div class="quick-log-card ql-hockey" onclick="quickLogHockey()">
        <div class="ql-icon">🏒</div>
        <div><div class="ql-title">Log Extra Hockey</div><div class="ql-sub">Unscheduled practice or game</div></div>
      </div>
    </div>
    <div class="divider-label"><span>Forge Protocol Session</span></div>
    <div class="card" style="padding:20px">
      <div style="font-weight:800;font-size:16px;margin-bottom:4px">Start a Session</div>
      <label style="margin-top:8px">Training Day</label>
      <select id="forge-day-select" onchange="onDaySelectChange()"></select>
      <div id="forge-week-display" style="margin-top:14px;background:rgba(167,139,250,0.08);border:1px solid rgba(167,139,250,0.2);border-radius:10px;padding:10px 12px;font-size:12px;color:var(--purple)"></div>
      <div style="margin-top:18px"><button class="btn btn-primary" onclick="startForgeWorkout()">🏋️ Start Workout</button></div>
    </div>`;

  updateForgeDisplay();
}

// ── FORGE PROTOCOL WORKOUT STARTER ──────────────────────────────────
function startForgeWorkout(){
  const dayNum=parseInt(document.getElementById('forge-day-select')?.value)||profile.forgeDayNum||1;
  const week=profile.forgeWeek||1;
  const freq=profile.forgeDaysPerWeek||3;
  const rounding=profile.forgeRounding||2.5;
  const mode=profile.forgeMode||'sets';
  const lifts=profile.forgeLifts||{main:[{name:'Squat',tm:100},{name:'Bench Press',tm:80},{name:'Deadlift',tm:120},{name:'OHP',tm:50}],aux:[{name:'Front Squat',tm:80},{name:'Pause Squat',tm:90},{name:'Close-Grip Bench',tm:70},{name:'Spoto Press',tm:75},{name:'Stiff Leg Deadlift',tm:100},{name:'Push Press',tm:50}]};
  const isDeload=FORGE.deloadWeeks.includes(week);
  const dayExercises=FORGE.getDayExercises(dayNum,freq,lifts);

  activeWorkout={type:'forge',exercises:[],startTime:Date.now(),forgeWeek:week,forgeDayNum:dayNum,forgeMode:mode};

  dayExercises.forEach((ex,idx)=>{
    const rx=FORGE.getPrescription(ex.tm,week,ex.isAux,rounding,mode);
    let auxSlotIdx=-1;
    if(ex.isAux) auxSlotIdx=lifts.aux.findIndex(a=>a.name===ex.name);

    // Build sets based on mode
    let sets;
    if(mode==='rtf'&&!isDeload){
      // Normal sets + 1 AMRAP last set
      sets=Array.from({length:rx.normalSets},()=>({weight:rx.weight,reps:rx.reps,done:false,rpe:null}));
      sets.push({weight:rx.weight,reps:'AMRAP',done:false,rpe:null,isAmrap:true,repOutTarget:rx.repOutTarget});
    }else if(mode==='rir'&&!isDeload){
      sets=Array.from({length:rx.fixedSets},()=>({weight:rx.weight,reps:rx.reps,done:false,rpe:null}));
    }else{
      // Sets completed mode or deload
      sets=Array.from({length:5},()=>({weight:rx.weight,reps:rx.reps,done:false,rpe:null}));
    }

    activeWorkout.exercises.push({
      id:Date.now()+Math.random(),name:ex.name,
      note:rx.note||'',
      isAux:ex.isAux,tm:ex.tm,auxSlotIdx,prescribedWeight:rx.weight,prescribedReps:rx.reps,
      rirCutoff:rx.rir,isDeload:rx.isDeload,repOutTarget:rx.repOutTarget||0,
      sets
    });
  });

  // Add back exercise as accessory (3×8-10, auto-progression)
  const backEx=profile.forgeBackExercise||'Barbell Rows';
  const backWt=profile.forgeBackWeight||0;
  activeWorkout.exercises.push({
    id:Date.now()+Math.random(),name:backEx,
    note:backWt?backWt+'kg × 3 sets of 8-10 — hit 3×10 then increase weight':'Set a working weight in Settings for auto-fill',
    isAux:false,isAccessory:true,tm:0,auxSlotIdx:-1,
    sets:[{weight:backWt||'',reps:8,done:false,rpe:null},{weight:backWt||'',reps:8,done:false,rpe:null},{weight:backWt||'',reps:8,done:false,rpe:null}]
  });

  resetNotStartedView();
  document.getElementById('workout-not-started').style.display='none';
  document.getElementById('workout-active').style.display='block';
  const modeTag=FORGE.modes[mode]?.short||'';
  document.getElementById('active-session-title').textContent=(isDeload?'🌊':'🏋️')+' W'+week+' Day '+dayNum+' · '+(FORGE.blockNames[week]||'')+' ['+modeTag+']';
  restDuration=parseInt(document.getElementById('rest-duration')?.value)||profile.defaultRest||120;
  startWorkoutTimer();renderExercises();
  showToast(isDeload?'Deload week — keep it light':FORGE.blockNames[week]+' block · '+Math.round((FORGE.mainIntensity[week]||0)*100)+'% TM',isDeload?'var(--blue)':'var(--purple)');

  // Hockey warning for leg-heavy days
  const legLifts=['squat','front squat','paused squat','high bar squat','beltless squat','box squat','pin squat','good morning','leg press','deadlift','sumo deadlift','conventional deadlift','block pull','rack pull','deficit deadlift','romanian deadlift','stiff leg deadlift','snatch grip deadlift','trap bar deadlift','squat with slow eccentric','wider stance squat','narrower stance squat','half squat'];
  const todayDow=new Date().getDay();
  const isHockeyDay=schedule.hockeyDays.includes(todayDow);
  const hadHockeyRecently=wasHockeyRecently();
  if((isHockeyDay||hadHockeyRecently)&&!isDeload){
    const hasLegs=activeWorkout.exercises.some(e=>legLifts.includes(e.name.toLowerCase()));
    if(hasLegs) setTimeout(()=>showToast('🏒 Hockey legs — consider fewer squat/DL sets or swapping day order','var(--blue)'),1500);
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
    // Show prescription note for Forge Protocol exercises
    if(ex.note&&activeWorkout.type==='forge')badges+=`<div class="ai-badge" style="background:rgba(167,139,250,0.1);color:var(--purple);border-color:rgba(167,139,250,0.2)">\ud83d\udccb ${ex.note}</div>`;

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
      const mode=activeWorkout?.forgeMode||'sets';
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
  const cat=FORGE.getAuxCategory(ex.auxSlotIdx);
  const opts=FORGE.auxOptions[cat]||[];
  // Build options HTML
  let optHtml=opts.map(o=>`<div class="swap-option${o===ex.name?' swap-active':''}" onclick="doAuxSwap(${ei},'${o.replace(/'/g,"\\'")}',${ex.auxSlotIdx})">${o}</div>`).join('');
  showCustomModal('Swap '+cat.charAt(0).toUpperCase()+cat.slice(1)+' Auxiliary',
    `<div style="max-height:300px;overflow-y:auto">${optHtml}</div>`);
}

function doAuxSwap(ei,newName,slotIdx){
  const ex=activeWorkout.exercises[ei];
  ex.name=newName;
  // Update profile aux too so TM carries over next time
  if(profile.forgeLifts&&profile.forgeLifts.aux[slotIdx]){
    profile.forgeLifts.aux[slotIdx].name=newName;
    saveProfileData();
  }
  closeCustomModal();renderExercises();
  showToast('Swapped to '+newName,'var(--purple)');
}

function swapBackExercise(ei){
  const opts=FORGE.auxOptions.back||[];
  let optHtml=opts.map(o=>`<div class="swap-option${o===activeWorkout.exercises[ei].name?' swap-active':''}" onclick="doBackSwap(${ei},'${o.replace(/'/g,"\\'")}')"> ${o}</div>`).join('');
  showCustomModal('Swap Back Exercise',
    `<div style="max-height:300px;overflow-y:auto">${optHtml}</div>`);
}

function doBackSwap(ei,newName){
  activeWorkout.exercises[ei].name=newName;
  profile.forgeBackExercise=newName;saveProfileData();
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
  let totalSets=0,doneSets=0;
  activeWorkout.exercises.forEach(e=>{
    totalSets+=e.sets.length;doneSets+=e.sets.filter(s=>s.done).length;
  });

  // Ask for session effort rating
  const sessionRPE = await new Promise(resolve=>{
    showRPEPicker('Session',-1,(val)=>resolve(val||7));
  });

  workouts.push({id:Date.now(),date:new Date().toISOString(),type:activeWorkout.type,duration:workoutSeconds,exercises:activeWorkout.exercises,rpe:sessionRPE,sets:totalSets,forgeWeek:activeWorkout.forgeWeek||0,forgeDayNum:activeWorkout.forgeDayNum||0});

  // Adjust Forge Protocol Training Maxes based on mode
  if(activeWorkout.type==='forge'&&activeWorkout.forgeWeek&&!FORGE.deloadWeeks.includes(activeWorkout.forgeWeek)){
    const lifts=profile.forgeLifts;
    const mode=activeWorkout.forgeMode||'sets';
    activeWorkout.exercises.forEach(ex=>{
      if(ex.isAccessory)return; // Skip back exercise
      const all=[...lifts.main,...lifts.aux];
      const match=all.find(l=>l.name===ex.name);
      if(!match)return;
      const oldTM=match.tm;
      const doneSets=ex.sets.filter(s=>s.done).length;

      let adjustData;
      if(mode==='rtf'){
        const amrapSet=ex.sets.find(s=>s.isAmrap&&s.done);
        adjustData={repsOnLastSet:amrapSet?parseInt(amrapSet.reps)||0:0, repOutTarget:ex.repOutTarget||10};
      }else if(mode==='rir'){
        const lastDone=ex.sets.filter(s=>s.done).pop();
        const rir=lastDone?.rir!==undefined&&lastDone.rir!==''?parseInt(lastDone.rir):null;
        adjustData={setsCompleted:doneSets, lastSetRIR:rir};
      }else{
        adjustData=doneSets;
      }

      match.tm=FORGE.adjustTM(match.tm,adjustData,activeWorkout.forgeWeek,mode);
      if(match.tm!==oldTM) console.log('[Forge/'+mode+']',ex.name,'TM',match.tm>oldTM?'↑':'↓',oldTM,'→',match.tm);
    });
    saveProfileData();
  }

  // Auto-advance Forge Protocol week when all sessions for this week are done
  if(activeWorkout.type==='forge'){
    const now=new Date(),sow=new Date(now);sow.setDate(now.getDate()-((now.getDay()+6)%7));sow.setHours(0,0,0,0);
    const thisWeekLifts=workouts.filter(w=>w.type==='forge'&&new Date(w.date)>=sow).length;
    if(thisWeekLifts>=(profile.forgeDaysPerWeek||3)&&(profile.forgeWeek||1)<21){
      profile.forgeWeek=(profile.forgeWeek||1)+1;
      profile.forgeWeekStartDate=new Date().toISOString();
      saveProfileData();
      showToast('Forge Protocol · '+FORGE.blockNames[profile.forgeWeek]+' · Week '+profile.forgeWeek+' starts next!','var(--purple)');
    }
  }

  await saveWorkouts();
  buildExerciseIndex();
  activeWorkout=null;
  document.getElementById('workout-not-started').style.display='block';
  document.getElementById('workout-active').style.display='none';

  showToast('Session saved!');
  updateDashboard();
}

function cancelWorkout(){
  clearInterval(workoutTimer);skipRest();
  activeWorkout=null;
  document.getElementById('workout-not-started').style.display='block';
  document.getElementById('workout-active').style.display='none';
}

// ── HISTORY ──────────────────────────────────────────────────
function switchHistoryTab(tab,e){
  document.querySelectorAll('#page-history .tab').forEach(t=>t.classList.remove('active'));
  e.target.classList.add('active');
  document.getElementById('history-log').style.display=tab==='log'?'block':'none';
  document.getElementById('history-stats').style.display=tab==='stats'?'block':'none';
  if(tab==='stats')updateStats();
}

function renderHistory(){
  const list=document.getElementById('history-list');
  if(!workouts.length){list.innerHTML='<div class="empty-state">No sessions logged yet.<br>Start your first workout!</div>';return;}
  list.innerHTML=workouts.slice().reverse().map(w=>{
    const d=new Date(w.date),mins=Math.floor(w.duration/60);
    const isHockey=w.type==='hockey',isExtra=w.subtype==='extra';
    const typeLabel=isHockey?(isExtra?'🏒 Extra Hockey':'🏒 Hockey'):'🏋️ W'+(w.forgeWeek||'?')+' Day '+(w.forgeDayNum||'?');
    const badgeClass=isHockey?'badge-blue':'badge-purple';
    const rpeStr=w.rpe||null;
    return `<div class="history-item">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <div style="font-weight:700">${typeLabel}</div>
        <div style="display:flex;gap:8px;align-items:center">
          <span class="badge ${badgeClass}">${mins}min${rpeStr?' · RPE '+rpeStr:''}</span>
          <button onclick="deleteWorkout(${w.id})" style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);color:var(--accent);font-size:13px;cursor:pointer;padding:4px 8px;border-radius:8px" title="Delete">✕</button>
        </div>
      </div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:8px">${d.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'short'})}</div>
      ${(w.exercises||[]).map(e=>{
        const maxKg=Math.max(...e.sets.map(s=>parseFloat(s.weight)||0));
        return `<div style="font-size:13px;margin-bottom:3px;display:flex;justify-content:space-between"><span>${e.name}</span><span style="color:var(--muted);font-size:11px;font-family:'JetBrains Mono',monospace">${e.sets.filter(s=>s.done).length}×${maxKg>0?maxKg+'kg':'bw'}</span></div>`;
      }).join('')}
    </div>`;
  }).join('');
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
  if(document.getElementById('forge-mode'))document.getElementById('forge-mode').value=profile.forgeMode||'sets';
  if(document.getElementById('forge-week'))document.getElementById('forge-week').value=profile.forgeWeek||1;
  if(document.getElementById('forge-rounding'))document.getElementById('forge-rounding').value=profile.forgeRounding||2.5;
  if(document.getElementById('forge-days'))document.getElementById('forge-days').value=profile.forgeDaysPerWeek||3;
  renderForgeLiftInputs();
  previewForgeSplit();
  updateModeDesc();
}

function updateModeDesc(){
  const mode=document.getElementById('forge-mode')?.value||'sets';
  const desc=document.getElementById('forge-mode-desc');
  if(!desc)return;
  const info=FORGE.modes[mode];
  desc.textContent=info?info.desc:'';
}

function renderForgeLiftInputs(){
  const lifts=profile.forgeLifts;if(!lifts)return;
  const mc=document.getElementById('forge-main-lifts');if(!mc)return;mc.innerHTML='';
  const labels=['SQ','BP','DL','OHP'];
  lifts.main.forEach((l,i)=>{mc.innerHTML+=`<div class="lift-row"><span class="lift-label">${labels[i]||'#'+(i+1)}</span><input type="text" value="${l.name}" onchange="profile.forgeLifts.main[${i}].name=this.value" style="flex:1"><input type="number" value="${l.tm}" onchange="profile.forgeLifts.main[${i}].tm=parseFloat(this.value)||0"></div>`;});
  const ac=document.getElementById('forge-aux-lifts');if(!ac)return;ac.innerHTML='';
  const auxLabels=['SQ-1','SQ-2','BP-1','BP-2','DL','OHP'];
  const cats=['squat','squat','bench','bench','deadlift','ohp'];
  lifts.aux.forEach((l,i)=>{
    const cat=cats[i]||'squat';
    const opts=FORGE.auxOptions[cat]||[];
    let sel='<select onchange="profile.forgeLifts.aux['+i+'].name=this.value;saveProfileData()" style="flex:1;font-size:13px">';
    opts.forEach(o=>{sel+=`<option value="${o}"${o===l.name?' selected':''}>${o}</option>`;});
    // Also allow current value if not in list
    if(!opts.includes(l.name)) sel+=`<option value="${l.name}" selected>${l.name}</option>`;
    sel+='</select>';
    ac.innerHTML+=`<div class="lift-row"><span class="lift-label">${auxLabels[i]||'A'+(i+1)}</span>${sel}<input type="number" value="${l.tm}" onchange="profile.forgeLifts.aux[${i}].tm=parseFloat(this.value)||0"></div>`;
  });
  // Back exercise selector
  const bs=document.getElementById('forge-back-exercise');
  if(bs) bs.value=profile.forgeBackExercise||'Barbell Rows';
  const bw=document.getElementById('forge-back-weight');
  if(bw) bw.value=profile.forgeBackWeight||'';
}

function saveForgeSetup(){
  profile.forgeMode=document.getElementById('forge-mode').value||'sets';
  profile.forgeWeek=parseInt(document.getElementById('forge-week').value)||1;
  profile.forgeRounding=parseFloat(document.getElementById('forge-rounding').value)||2.5;
  profile.forgeDaysPerWeek=parseInt(document.getElementById('forge-days').value)||3;
  profile.forgeBackExercise=document.getElementById('forge-back-exercise').value||'Barbell Rows';
  profile.forgeBackWeight=parseFloat(document.getElementById('forge-back-weight').value)||0;
  profile.forgeDayNum=1; // Reset day selection when frequency changes
  saveProfileData();showToast('Program setup saved!','var(--purple)');updateForgeDisplay();
}

function previewForgeSplit(){
  const freq=parseInt(document.getElementById('forge-days').value)||3;
  const lifts=profile.forgeLifts;
  const prev=document.getElementById('forge-split-preview');
  if(!prev||!lifts)return;
  let html='';
  for(let d=1;d<=freq;d++){
    const exs=FORGE.getDayExercises(d,freq,lifts);
    const names=exs.map(e=>{
      const tag=e.isAux?'<span style="color:var(--purple)">'+e.name+'</span>':'<strong>'+e.name+'</strong>';
      return tag;
    }).join(' · ');
    html+=`<div style="margin-bottom:4px"><span style="color:var(--accent);font-weight:700">Day ${d}:</span> ${names}</div>`;
  }
  html+='<div style="margin-top:6px;font-size:11px;color:var(--muted)"><strong>Bold</strong> = main lift · <span style="color:var(--purple)">Purple</span> = auxiliary</div>';
  prev.innerHTML=html;
}

function updateForgeDisplay(){
  const info=document.getElementById('forge-week-display');if(!info)return;
  const w=profile.forgeWeek||1;
  const mode=profile.forgeMode||'sets';
  const pct=Math.round((FORGE.mainIntensity[w]||0)*100);
  const reps=FORGE.getReps(FORGE.mainIntensity[w]||0.7);
  const isDeload=FORGE.deloadWeeks.includes(w);
  const modeName=FORGE.modes[mode]?.short||'Sets';
  const rir=FORGE.getRIR(FORGE.mainIntensity[w]||0.7);
  let modeDetail='';
  if(isDeload) modeDetail='Light week — 60% TM, 5 easy sets.';
  else if(mode==='sets') modeDetail=`Do sets of ${reps} until RIR ≤${rir}. Aim for 4-6 sets.`;
  else if(mode==='rtf') modeDetail=`${reps} reps × 4 sets, then AMRAP last set (target ${reps*2}+).`;
  else if(mode==='rir') modeDetail=`5 sets of ${reps}. Note reps left in tank on last set.`;
  let infoHtml=`📋 <strong>Forge Protocol</strong> · ${FORGE.blockNames[w]||''} · Week ${w} ·<span style="color:var(--purple)">${modeName}</span><br><span style="font-size:11px">${pct}% TM · ${modeDetail}</span>`;
  info.innerHTML=infoHtml;

  const ds=document.getElementById('forge-day-select');
  if(!ds)return;
  const freq=profile.forgeDaysPerWeek||3;ds.innerHTML='';
  const todayDow=new Date().getDay();
  const isHockeyDay=schedule.hockeyDays.includes(todayDow);
  const hadHockeyRecently=wasHockeyRecently();
  const hockeyLegs=isHockeyDay||hadHockeyRecently;
  const fatigue=computeFatigue();
  const recovery=100-fatigue.overall;

  const legLifts=['squat','front squat','paused squat','high bar squat','beltless squat','box squat','pin squat','half squat','good morning','leg press','deadlift','sumo deadlift','conventional deadlift','block pull','rack pull','deficit deadlift','romanian deadlift','stiff leg deadlift','snatch grip deadlift','trap bar deadlift','squat with slow eccentric','wider stance squat','narrower stance squat'];

  // Find which days have been done this week
  const now=new Date(),sow=new Date(now);sow.setDate(now.getDate()-((now.getDay()+6)%7));sow.setHours(0,0,0,0);
  const doneThisWeek=workouts.filter(wk=>wk.type==='forge'&&new Date(wk.date)>=sow).map(wk=>wk.forgeDayNum);

  // Score each day for recommendation
  let bestDay=1,bestScore=-999;
  const dayScores=[];
  for(let d=1;d<=freq;d++){
    const exs=FORGE.getDayExercises(d,freq,profile.forgeLifts);
    const hasLegs=exs.some(e=>legLifts.includes(e.name.toLowerCase()));
    const done=doneThisWeek.includes(d);
    let score=0;
    if(done) score-=100; // already done — deprioritize
    if(hockeyLegs&&hasLegs) score-=30; // legs fatigued from hockey
    if(recovery<40&&hasLegs) score-=20; // high fatigue + legs = bad
    if(!hasLegs&&hockeyLegs) score+=15; // upper day on hockey legs = good
    if(!done) score+=10; // not done yet = good
    dayScores.push({d,hasLegs,done,score});
    if(score>bestScore){bestScore=score;bestDay=d;}
  }

  for(let d=1;d<=freq;d++){
    const exs=FORGE.getDayExercises(d,freq,profile.forgeLifts);
    const ds_info=dayScores.find(x=>x.d===d);
    const label=exs.map(e=>e.name).join(' + ');
    const badges=[];
    if(ds_info.done) badges.push('✅');
    if(hockeyLegs&&ds_info.hasLegs&&!isDeload) badges.push('🏒⚠️');
    if(d===bestDay&&!ds_info.done) badges.push('⭐');
    ds.innerHTML+=`<option value="${d}"${d===bestDay?' selected':''}>${badges.join('')} Day ${d}: ${label}</option>`;
  }
  profile.forgeDayNum=bestDay;

  // Recommendation banner
  let banner=document.getElementById('forge-recommend-banner');
  if(!banner){banner=document.createElement('div');banner.id='forge-recommend-banner';
    banner.style.cssText='margin-top:10px;padding:10px 12px;border-radius:10px;font-size:12px';
    info.parentNode.insertBefore(banner,info.nextSibling);}

  const recDay=dayScores.find(x=>x.d===bestDay);
  const allDone=dayScores.every(x=>x.done);
  if(allDone){
    banner.style.background='rgba(34,197,94,0.1)';banner.style.border='1px solid rgba(34,197,94,0.25)';banner.style.color='var(--green)';
    banner.innerHTML='✅ All '+freq+' sessions done this week! Rest up and recover.';
  }else if(hockeyLegs&&recDay&&!recDay.hasLegs){
    banner.style.background='rgba(59,130,246,0.1)';banner.style.border='1px solid rgba(59,130,246,0.25)';banner.style.color='var(--blue)';
    banner.innerHTML='🏒 '+(isHockeyDay?'Hockey day':'Post-hockey')+' — recommending <strong>Day '+bestDay+'</strong> (upper-focused). Spare those legs.';
  }else if(hockeyLegs&&recDay&&recDay.hasLegs){
    banner.style.background='rgba(251,146,60,0.1)';banner.style.border='1px solid rgba(251,146,60,0.25)';banner.style.color='var(--orange)';
    banner.innerHTML='🏒 Hockey legs but only leg days remain. Go lighter or rest today.';
  }else if(recovery<40){
    banner.style.background='rgba(251,146,60,0.1)';banner.style.border='1px solid rgba(251,146,60,0.25)';banner.style.color='var(--orange)';
    banner.innerHTML='⚠️ Recovery '+recovery+'% — consider resting. If training, <strong>Day '+bestDay+'</strong> is next.';
  }else{
    banner.style.background='rgba(167,139,250,0.08)';banner.style.border='1px solid rgba(167,139,250,0.15)';banner.style.color='var(--purple)';
    const left=freq-doneThisWeek.length;
    banner.innerHTML='⭐ Recommended: <strong>Day '+bestDay+'</strong> · '+left+' session'+(left!==1?'s':'')+' left this week · Recovery '+recovery+'%';
  }
}

// Re-check hockey warning when day selection changes
function onDaySelectChange(){
  profile.forgeDayNum=parseInt(document.getElementById('forge-day-select')?.value)||1;
  updateForgeDisplay();
}

function toggleDay(kind,dow,el){
  const key=kind+'Days';
  if(el.classList.contains(kind+'-day')){el.classList.remove(kind+'-day');schedule[key]=schedule[key].filter(d=>d!==dow);}
  else{el.classList.add(kind+'-day');if(!schedule[key].includes(dow))schedule[key].push(dow);}
}

function saveSchedule(){
  profile.defaultRest=parseInt(document.getElementById('default-rest').value)||120;
  restDuration=profile.defaultRest;
  saveScheduleData();saveProfileData();updateForgeDisplay();updateDashboard();showToast('Settings saved!','var(--blue)');
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
  workouts=[];schedule={hockeyDays:[3,0]};profile={defaultRest:120,forgeWeek:1,forgeRounding:2.5,forgeDaysPerWeek:3,forgeDayNum:1,forgeBackExercise:'Barbell Rows',forgeBackWeight:0,forgeLifts:{main:[{name:'Squat',tm:100},{name:'Bench Press',tm:80},{name:'Deadlift',tm:120},{name:'OHP',tm:50}],aux:[{name:'Front Squat',tm:80},{name:'Pause Squat',tm:90},{name:'Close-Grip Bench',tm:70},{name:'Spoto Press',tm:75},{name:'Stiff Leg Deadlift',tm:100},{name:'Push Press',tm:50}]}};
  updateDashboard();showToast('All data cleared','var(--accent)');
}

// ── INIT ─────────────────────────────────────────────────────
loadData();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js'); });
}
