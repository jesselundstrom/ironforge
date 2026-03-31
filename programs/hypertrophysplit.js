// ── HYPERTROPHY SPLIT ────────────────────────────────────────────────────────
// Adaptive hypertrophy program that scales by training frequency:
//   2 days/week → Upper / Lower
//   3 days/week → Push / Pull / Legs
//   4 days/week → Upper A / Lower A / Upper B / Lower B
//   5 days/week → Push / Pull / Legs / Upper / Lower
//   6 days/week → Push / Pull / Legs × 2
// 8-week mesocycle with Forge-style TM-percentage periodisation.
// Weeks 1–2 ramp-up, 3–4 build, 5–6 push, 7–8 deload.
(function(){
'use strict';

const MS_PER_DAY = 864e5;

/* ── helpers ─────────────────────────────────────────────────────────────── */
function tr(key,fallback,params){
  if(window.I18N)return I18N.t(key,params,fallback);
  return fallback;
}
function exName(name){
  if(window.EXERCISE_LIBRARY&&EXERCISE_LIBRARY.getDisplayName)return EXERCISE_LIBRARY.getDisplayName(name);
  return name;
}

/* ── intensity table (8-week mesocycle) ───────────────────────────────── */
const WEEKS={
// week: { t1 pct, t2 pct, blockName, isDeload }
  1:{t1:0.65,t2:0.55,block:'Ramp-up',  deload:false},
  2:{t1:0.68,t2:0.58,block:'Ramp-up',  deload:false},
  3:{t1:0.72,t2:0.62,block:'Build',    deload:false},
  4:{t1:0.75,t2:0.65,block:'Build',    deload:false},
  5:{t1:0.78,t2:0.68,block:'Push',     deload:false},
  6:{t1:0.80,t2:0.70,block:'Push',     deload:false},
  7:{t1:0.60,t2:0.50,block:'Deload',   deload:true},
  8:{t1:0.60,t2:0.50,block:'Deload',   deload:true}
};
const CYCLE_LENGTH=8;

function normalizeHSWeek(rawWeek){
  const week=parseInt(rawWeek,10);
  if(!Number.isFinite(week)||week<1)return 1;
  return Math.min(CYCLE_LENGTH,week);
}

function getHSCatchUpWeek(rawWeek,elapsedWeeks){
  const startWeek=normalizeHSWeek(rawWeek);
  let week=startWeek;
  const elapsed=Math.max(0,parseInt(elapsedWeeks,10)||0);
  for(let i=0;i<elapsed&&week<CYCLE_LENGTH;i++){
    week=Math.min(CYCLE_LENGTH,week+1);
    if(week!==startWeek&&WEEKS[week]?.deload)break;
  }
  return week;
}

function getReps(pct){
  if(pct<=0.575)return 12;
  if(pct<=0.625)return 10;
  if(pct<=0.675)return 8;
  if(pct<=0.725)return 7;
  if(pct<=0.775)return 6;
  return 5;
}
function getSets(pct,deload){
  if(deload)return 3;
  if(pct>=0.75)return 4;
  return 3;
}
function rnd(v,inc){return Math.round(v/inc)*inc;}

function getPrescription(tm,week,isT2,rounding){
  const w=WEEKS[normalizeHSWeek(week)]||WEEKS[1];
  const pct=isT2?w.t2:w.t1;
  const weight=rnd(tm*pct,rounding||2.5);
  const reps=getReps(pct);
  const sets=getSets(pct,w.deload);
  return{weight,reps,sets,pct,isDeload:w.deload,blockName:w.block};
}

function adjustTM(tm,setsCompleted,targetSets){
  if(setsCompleted>=targetSets)return Math.round(tm*1.025*100)/100;    // +2.5%
  if(setsCompleted>=targetSets-1)return tm;                             // hold
  return Math.round(tm*0.95*100)/100;                                   // -5%
}

function getBlockKey(week){
  const w=WEEKS[normalizeHSWeek(week)]||WEEKS[1];
  return w.deload?'deload':w.block.toLowerCase().replace('-','_');
}

/* ── session templates ───────────────────────────────────────────────── */
// Each session: array of { liftKey, isT2, accSlotKey(optional) }
// liftKey maps into state.lifts;  accSlotKey maps into state.accessories

const TEMPLATES={
  push:[
    {liftKey:'bench',  isT2:false},
    {liftKey:'ohp',    isT2:true},
    {acc:'push_chest'},
    {acc:'push_shoulder'},
    {acc:'push_triceps'}
  ],
  pull:[
    {liftKey:'row',    isT2:false},
    {liftKey:'lat',    isT2:true},
    {acc:'pull_back'},
    {acc:'pull_biceps'},
    {acc:'pull_rear'}
  ],
  legs:[
    {liftKey:'squat',  isT2:false},
    {liftKey:'rdl',    isT2:true},
    {acc:'legs_quad'},
    {acc:'legs_ham'},
    {acc:'legs_core'}
  ],
  upper:[
    {liftKey:'bench',  isT2:false},
    {liftKey:'row',    isT2:false},
    {liftKey:'ohp',    isT2:true},
    {liftKey:'lat',    isT2:true},
    {acc:'push_shoulder'}
  ],
  lower:[
    {liftKey:'squat',  isT2:false},
    {liftKey:'rdl',    isT2:true},
    {acc:'legs_quad'},
    {acc:'legs_ham'},
    {acc:'legs_core'}
  ],
  upper_b:[
    {liftKey:'ohp',      isT2:false},
    {liftKey:'lat',      isT2:false},
    {liftKey:'bench_b',  isT2:true},
    {liftKey:'row_b',    isT2:true},
    {acc:'pull_biceps'}
  ],
  lower_b:[
    {liftKey:'deadlift', isT2:false},
    {liftKey:'fsquat',   isT2:true},
    {acc:'lower_b_single'},
    {acc:'lower_b_ham'},
    {acc:'legs_core'}
  ]
};

/* Which sessions exist per frequency */
const ROTATIONS={
  2:['upper','lower'],
  3:['push','pull','legs'],
  4:['upper','lower','upper_b','lower_b'],
  5:['push','pull','legs','upper','lower'],
  6:['push','pull','legs','push','pull','legs']
};

/* ── lift label/name mapping ─────────────────────────────────────────── */
const LIFT_NAMES={
  bench:'Bench Press',ohp:'OHP',row:'Barbell Rows',lat:'Lat Pulldown (Close Grip)',
  squat:'Squat',rdl:'Romanian Deadlift',deadlift:'Deadlift',fsquat:'Front Squat',
  bench_b:'DB Bench',row_b:'Dumbbell Rows'
};
const LIFT_DEFAULTS={
  bench:60,ohp:40,row:55,lat:45,squat:70,rdl:55,deadlift:90,fsquat:50,bench_b:50,row_b:45
};

/* ── accessory defaults & swap pools ─────────────────────────────────── */
const ACC_DEFAULTS={
  push_chest:'DB Incline Press',push_shoulder:'Dumbbell Lateral Raises',push_triceps:'Overhead Triceps Extensions',
  pull_back:'Seated Cable Rows',pull_biceps:'Dumbbell Bicep Curls',pull_rear:'Band Pull-Aparts',
  legs_quad:'Leg Press',legs_ham:'Hamstring Curls',legs_core:'Ab Wheel Rollouts',
  lower_b_single:'Bulgarian Split Squats',lower_b_ham:'Back Extensions'
};
const ACC_POOLS={
  push_chest:['DB Incline Press','Machine Chest Press','Dips','Push-ups','DB Bench'],
  push_shoulder:['Dumbbell Lateral Raises','DB OHP','Push Press'],
  push_triceps:['Overhead Triceps Extensions','Close-Grip Bench','Dips'],
  pull_back:['Seated Cable Rows','Machine Rows','Chest-Supported Rows','T-Bar Rows'],
  pull_biceps:['Dumbbell Bicep Curls','Chin-ups','Assisted Chin-ups'],
  pull_rear:['Band Pull-Aparts','Dumbbell Lateral Raises'],
  legs_quad:['Leg Press','Bulgarian Split Squats','Walking Lunges','Dumbbell Lunges'],
  legs_ham:['Hamstring Curls','Back Extensions','45deg Hip Extensions'],
  legs_core:['Ab Wheel Rollouts','Weighted Planks','Hanging Leg Raises','Cable Crunches'],
  lower_b_single:['Bulgarian Split Squats','Walking Lunges','Reverse Lunges','Step-Ups'],
  lower_b_ham:['Back Extensions','45deg Hip Extensions','Good Morning']
};
const ACC_FILTERS={
  push_chest:{movementTags:['horizontal_press'],equipmentTags:['dumbbell','machine','bodyweight'],muscleGroups:['chest']},
  push_shoulder:{movementTags:['isolation','vertical_press'],equipmentTags:['dumbbell'],muscleGroups:['shoulders']},
  push_triceps:{movementTags:['isolation','horizontal_press'],equipmentTags:['dumbbell','cable','barbell','bodyweight'],muscleGroups:['triceps']},
  pull_back:{movementTags:['horizontal_pull'],equipmentTags:['cable','machine','dumbbell','barbell'],muscleGroups:['back']},
  pull_biceps:{movementTags:['isolation','vertical_pull'],equipmentTags:['dumbbell','pullup_bar','bodyweight'],muscleGroups:['biceps']},
  pull_rear:{movementTags:['isolation'],equipmentTags:['band','dumbbell','cable'],muscleGroups:['shoulders']},
  legs_quad:{movementTags:['squat','single_leg'],equipmentTags:['machine','dumbbell','bodyweight'],muscleGroups:['quads','glutes']},
  legs_ham:{movementTags:['hinge'],equipmentTags:['machine','bodyweight'],muscleGroups:['hamstrings']},
  legs_core:{movementTags:['core'],equipmentTags:['bodyweight','cable','pullup_bar'],muscleGroups:['core']},
  lower_b_single:{movementTags:['single_leg','squat'],equipmentTags:['dumbbell','bodyweight'],muscleGroups:['quads','glutes']},
  lower_b_ham:{movementTags:['hinge'],equipmentTags:['bodyweight','barbell'],muscleGroups:['hamstrings','glutes']}
};
const ACC_REP_SCHEME={
  push_chest:{sets:3,reps:12},push_shoulder:{sets:3,reps:15},push_triceps:{sets:3,reps:15},
  pull_back:{sets:3,reps:12},pull_biceps:{sets:3,reps:15},pull_rear:{sets:3,reps:15},
  legs_quad:{sets:3,reps:12},legs_ham:{sets:3,reps:12},legs_core:{sets:3,reps:15},
  lower_b_single:{sets:3,reps:12},lower_b_ham:{sets:3,reps:12}
};
const ACC_SLOT_ORDER=Object.keys(ACC_DEFAULTS);
const ACC_SLOT_INDEX_OFFSET=100;

/* ── session display labels ──────────────────────────────────────────── */
const SESSION_ICONS={push:'🔥',pull:'🏋️',legs:'🦵',upper:'💪',lower:'🦵',upper_b:'💪',lower_b:'🦵'};
const SESSION_I18N={
  push:['program.hs.session.push','Push'],
  pull:['program.hs.session.pull','Pull'],
  legs:['program.hs.session.legs','Legs'],
  upper:['program.hs.session.upper','Upper'],
  lower:['program.hs.session.lower','Lower'],
  upper_b:['program.hs.session.upper_b','Upper B'],
  lower_b:['program.hs.session.lower_b','Lower B']
};
function sessionLabel(key){const[k,fb]=SESSION_I18N[key]||['',''];return tr(k,fb);}

/* ── leg-heavy lifts for sport awareness ─────────────────────────────── */
const LEG_SESSIONS=new Set(['legs','lower','lower_b']);
const LEG_LIFTS=['squat','front squat','romanian deadlift','deadlift','sumo deadlift',
  'leg press','bulgarian split squats','walking lunges','reverse lunges','step-ups',
  'dumbbell lunges','hamstring curls','back extensions','45deg hip extensions','good morning',
  'dumbbell goblet squat','barbell back squat'];

/* ── draft state for settings pickers ────────────────────────────────── */
let _accDrafts={basic:null,advanced:null};
function cloneAccessories(src){
  const out={};
  for(const k of Object.keys(ACC_DEFAULTS)){out[k]=String(src&&src[k]||ACC_DEFAULTS[k]);}
  return out;
}

/* ── helpers for compound swap pickers ───────────────────────────────── */
const COMPOUND_SWAP_POOLS={
  bench:['Bench Press','Close-Grip Bench','Incline Press','DB Bench','Machine Chest Press'],
  ohp:['OHP','Push Press','DB OHP'],
  row:['Barbell Rows','Dumbbell Rows','Chest-Supported Rows','T-Bar Rows','Machine Rows'],
  lat:['Lat Pulldown (Close Grip)','Lat Pulldown (Wide Grip)','Chin-ups','Pull-ups','Neutral-Grip Pull-ups'],
  squat:['Squat','Front Squat','Paused Squat','Leg Press'],
  rdl:['Romanian Deadlift','Sumo Deadlift','Trap Bar Deadlift','Good Morning'],
  deadlift:['Deadlift','Sumo Deadlift','Trap Bar Deadlift'],
  fsquat:['Front Squat','Paused Squat','Squat'],
  bench_b:['DB Bench','DB Incline Press','Machine Chest Press','Incline Press'],
  row_b:['Dumbbell Rows','Chest-Supported Rows','Seated Cable Rows','Machine Rows']
};
const COMPOUND_SWAP_FILTERS={
  bench:{movementTags:['horizontal_press'],muscleGroups:['chest','triceps']},
  ohp:{movementTags:['vertical_press'],muscleGroups:['shoulders','triceps']},
  row:{movementTags:['horizontal_pull'],muscleGroups:['back','biceps']},
  lat:{movementTags:['vertical_pull'],muscleGroups:['back','biceps']},
  squat:{movementTags:['squat'],muscleGroups:['quads','glutes']},
  rdl:{movementTags:['hinge'],muscleGroups:['hamstrings','glutes']},
  deadlift:{movementTags:['hinge'],muscleGroups:['hamstrings','glutes','back']},
  fsquat:{movementTags:['squat'],muscleGroups:['quads']},
  bench_b:{movementTags:['horizontal_press'],muscleGroups:['chest']},
  row_b:{movementTags:['horizontal_pull'],muscleGroups:['back']}
};

/* ── which lifts are active for a given daysPerWeek ──────────────────── */
function activeLiftKeys(freq){
  const keys=new Set();
  (ROTATIONS[freq]||ROTATIONS[3]).forEach(s=>{
    (TEMPLATES[s]||[]).forEach(e=>{if(e.liftKey)keys.add(e.liftKey);});
  });
  return keys;
}

function getHSDaysPerWeek(){
  if(typeof getProgramTrainingDaysPerWeek==='function'){
    return getProgramTrainingDaysPerWeek('hypertrophysplit');
  }
  return 3;
}

function getHSFrequencyHint(freq){
  const value=typeof getTrainingDaysPerWeekLabel==='function'
    ? getTrainingDaysPerWeekLabel(freq)
    : freq+' sessions / week';
  return tr('program.global_frequency_hint','Uses your Training preference: {value}.',{value});
}

function getHSAccessorySlotIdx(accKey){
  const idx=ACC_SLOT_ORDER.indexOf(accKey);
  return idx<0?-1:ACC_SLOT_INDEX_OFFSET+idx;
}

function getHSAccessorySlotKey(slotIdx){
  const idx=slotIdx-ACC_SLOT_INDEX_OFFSET;
  return idx>=0&&idx<ACC_SLOT_ORDER.length?ACC_SLOT_ORDER[idx]:null;
}

/* ══════════════════════════════════════════════════════════════════════ */
/*  PROGRAM OBJECT                                                      */
/* ══════════════════════════════════════════════════════════════════════ */
const HS_PROGRAM={
  id:'hypertrophysplit',
  name:tr('program.hs.name','Hypertrophy Split'),
  description:tr('program.hs.description','Adaptive hypertrophy program that scales from 2 to 6 days per week.'),
  icon:'💪',
  legLifts:LEG_LIFTS,

  getInitialState(){
    return{
      sessionCount:0,
      nextSession:'push',
      daysPerWeek:getHSDaysPerWeek(),
      rounding:2.5,
      week:1,
      cycle:1,
      weekStartDate:new Date().toISOString(),
      lifts:{
        bench:{tm:60,name:'Bench Press'},
        ohp:{tm:40,name:'OHP'},
        row:{tm:55,name:'Barbell Rows'},
        lat:{tm:45,name:'Lat Pulldown (Close Grip)'},
        squat:{tm:70,name:'Squat'},
        rdl:{tm:55,name:'Romanian Deadlift'},
        deadlift:{tm:90,name:'Deadlift'},
        fsquat:{tm:50,name:'Front Squat'},
        bench_b:{tm:50,name:'DB Bench'},
        row_b:{tm:45,name:'Dumbbell Rows'}
      },
      accessories:cloneAccessories()
    };
  },

  /* ── session options ─────────────────────────────────────────────── */
  getSessionOptions(state,workouts,schedule){
    const freq=getHSDaysPerWeek();
    const week=state.week||1;
    const rotation=ROTATIONS[freq]||ROTATIONS[3];
    const nextSession=rotation.includes(state.nextSession)?state.nextSession:rotation[0];

    // Sport awareness
    const todayDow=new Date().getDay();
    const sportDays=schedule?.sportDays||[];
    const legsHeavy=schedule?.sportLegsHeavy!==false;
    const recentHours={easy:18,moderate:24,hard:30}[schedule?.sportIntensity||'hard'];
    const isSportDay=sportDays.includes(todayDow);
    const hadSportRecently=workouts&&workouts.some(w=>(w.type==='sport'||w.type==='hockey')&&(Date.now()-new Date(w.date).getTime())/3600000<=recentHours);
    const sportLegs=(isSportDay||hadSportRecently)&&legsHeavy;

    // Done this week
    const sow=getWeekStart(new Date());
    const doneThisWeek=workouts?workouts.filter(w=>(w.program==='hypertrophysplit')&&new Date(w.date)>=sow).map(w=>w.programOption):[];

    // Build unique session list
    const seen=new Set();
    const uniqueSessions=[];
    rotation.forEach(s=>{if(!seen.has(s)){seen.add(s);uniqueSessions.push(s);}});

    // Score each option
    let bestKey=null,bestScore=-999;
    const scored=uniqueSessions.map(key=>{
      const done=doneThisWeek.filter(d=>d===key).length;
      const expectedCount=rotation.filter(s=>s===key).length;
      const remaining=expectedCount-done;
      const isLeg=LEG_SESSIONS.has(key);
      let score=0;
      if(remaining<=0)score-=100;
      if(sportLegs&&isLeg)score-=30;
      if(remaining>0)score+=10;
      if(!isLeg&&sportLegs)score+=15;
      // Prefer the nextSession from rotation order
      if(key===nextSession&&remaining>0)score+=5;
      if(score>bestScore){bestScore=score;bestKey=key;}
      return{key,done:remaining<=0,remaining,isLeg,score};
    });

    return scored.map(({key,done,isLeg})=>{
      const tmpl=TEMPLATES[key]||[];
      const compoundNames=tmpl.filter(e=>e.liftKey).map(e=>exName(state.lifts[e.liftKey]?.name||LIFT_NAMES[e.liftKey]||e.liftKey));
      const label=compoundNames.join(' + ');
      const badges=[];
      if(done)badges.push('✅');
      if(sportLegs&&isLeg&&!WEEKS[week].deload)badges.push('🏃⚠️');
      if(key===bestKey&&!done)badges.push('⭐');
      return{value:key,label:badges.join('')+' '+sessionLabel(key)+': '+label,isRecommended:key===bestKey,done,hasLegs:isLeg,sportLegs};
    });
  },

  /* ── build session ───────────────────────────────────────────────── */
  buildSession(selectedOption,state,context){
    const key=selectedOption||'push';
    const tmpl=TEMPLATES[key];
    if(!tmpl)return[];
    const week=state.week||1;
    const rounding=state.rounding||2.5;
    const effectiveSessionMode=context?.effectiveSessionMode==='light'?'light':'normal';
    const energyBoost=context?.energyBoost===true;
    const programDeload=WEEKS[week].deload;
    const buildWeek=effectiveSessionMode==='normal'&&programDeload?Math.max(1,week-1):week;
    const isDeload=effectiveSessionMode==='light'&&programDeload;
    const exercises=[];

    tmpl.forEach((slot,idx)=>{
      if(slot.liftKey){
        // Compound exercise
        const lift=state.lifts[slot.liftKey]||{tm:LIFT_DEFAULTS[slot.liftKey]||50,name:LIFT_NAMES[slot.liftKey]||slot.liftKey};
        const rx=getPrescription(lift.tm,buildWeek,slot.isT2,rounding);
        const setCount=rx.sets+(energyBoost&&!slot.isT2&&!isDeload?1:0);
        const sets=Array.from({length:setCount},()=>({weight:rx.weight,reps:rx.reps,done:false,rpe:null}));
        const tierLabel=slot.isT2?'T2':'T1';
        exercises.push({
          id:Date.now()+Math.random(),
          name:lift.name||LIFT_NAMES[slot.liftKey],
          liftKey:slot.liftKey,
          note:rx.weight+'kg × '+setCount+'×'+rx.reps+(isDeload?' — '+tr('program.hs.deload_easy','easy'):''),
          isAux:slot.isT2,
          isAccessory:false,
          tm:lift.tm,
          auxSlotIdx:-1,
          prescribedWeight:rx.weight,
          prescribedReps:rx.reps,
          tierLabel,
          sets
        });
      }else if(slot.acc){
        // Accessory exercise
        const accKey=slot.acc;
        const accName=state.accessories[accKey]||ACC_DEFAULTS[accKey]||'';
        const scheme=ACC_REP_SCHEME[accKey]||{sets:3,reps:12};
        const accSets=isDeload?Math.max(2,scheme.sets-1):scheme.sets;
        const sets=Array.from({length:accSets},()=>({weight:'',reps:scheme.reps,done:false,rpe:null}));
        exercises.push({
          id:Date.now()+Math.random(),
          name:accName,
          note:accSets+'×'+scheme.reps,
          isAux:true,
          isAccessory:true,
          tm:0,
          auxSlotIdx:getHSAccessorySlotIdx(accKey),
          accSlotKey:accKey,
          sets
        });
      }
    });
    return exercises;
  },

  /* ── labels & info ───────────────────────────────────────────────── */
  getSessionLabel(selectedOption,state,context){
    const key=selectedOption||'push';
    const week=state.week||1;
    const effectiveSessionMode=context?.effectiveSessionMode==='light'?'light':'normal';
    const buildWeek=effectiveSessionMode==='normal'&&(WEEKS[week]||WEEKS[1])?.deload?Math.max(1,week-1):week;
    const w=WEEKS[buildWeek]||WEEKS[1];
    const icon=w.deload?'🌊':(SESSION_ICONS[key]||'💪');
    const blockLabel=tr('program.hs.block.'+getBlockKey(buildWeek),w.block);
    return icon+' '+sessionLabel(key)+' · '+tr('program.hs.week_label','W{week}',{week:buildWeek})+' '+blockLabel+' ['+tr('program.hs.cycle_short','C{cycle}',{cycle:state.cycle||1})+']';
  },

  getSessionModeRecommendation(state){
    const week=state?.week||1;
    return (WEEKS[week]||WEEKS[1])?.deload?'light':'normal';
  },

  getBlockInfo(state){
    const week=state.week||1;
    const w=WEEKS[week]||WEEKS[1];
    const pct=Math.round(w.t1*100);
    const reps=getReps(w.t1);
    const sets=getSets(w.t1,w.deload);
    const blockLabel=tr('program.hs.block.'+getBlockKey(week),w.block);
    return{
      name:blockLabel,
      weekLabel:tr('program.hs.week_label','W{week}',{week}),
      pct,isDeload:w.deload,totalWeeks:CYCLE_LENGTH,
      reps,sets,
      modeDesc:w.deload
        ?tr('program.hs.blockinfo.deload','Light week — reduced volume and intensity for recovery.')
        :tr('program.hs.blockinfo.normal','T1: {sets}×{reps} @{pct}% TM · T2 lighter · Accessories {accSets}×12-15',{sets,reps,pct,accSets:3})
    };
  },

  getSessionCharacter(selectedOption,state){
    const week=normalizeHSWeek(state.week);
    const w=WEEKS[week]||WEEKS[1];
    const pct=Math.round((w.t1||0.65)*100);
    if(w.deload){
      return{tone:'deload',icon:'🌊',labelKey:'program.hs.character.deload',labelFallback:tr('program.hs.character.deload','Deload — reduced volume, recovery focus'),labelParams:{}};
    }
    if(w.block==='Push'||pct>=78){
      return{tone:'heavy',icon:'🔥',labelKey:'program.hs.character.heavy',labelFallback:tr('program.hs.character.heavy','Push — T1 at {pct}% TM',{pct}),labelParams:{pct}};
    }
    if(w.block==='Build'){
      return{tone:'volume',icon:'💪',labelKey:'program.hs.character.build',labelFallback:tr('program.hs.character.build','Build — T1 at {pct}% TM, growing volume',{pct}),labelParams:{pct}};
    }
    return{tone:'volume',icon:'📈',labelKey:'program.hs.character.ramp',labelFallback:tr('program.hs.character.ramp','Ramp-up — T1 at {pct}% TM, moderate start',{pct}),labelParams:{pct}};
  },

  getPreSessionNote(selectedOption,state){
    const week=normalizeHSWeek(state.week);
    const cycle=state.cycle||1;
    const w=WEEKS[week]||WEEKS[1];
    const block=w.block||'Training';
    if(w.deload){
      return tr('program.hs.note.deload','Cycle {cycle}, Week {week} — deload. Lighter loads, let your body recover.',{cycle,week});
    }
    return tr('program.hs.note.default','Cycle {cycle}, Week {week} of {total} — {block} phase. Stay consistent with prescribed volume.',{cycle,week,total:CYCLE_LENGTH,block});
  },

  /* ── TM adjustment after session ─────────────────────────────────── */
  adjustAfterSession(exercises,state,programOption){
    const newState=JSON.parse(JSON.stringify(state));
    const week=state.week||1;
    if(WEEKS[week].deload)return newState;

    exercises.forEach(ex=>{
      if(ex.isAccessory||!ex.liftKey)return;
      const lift=newState.lifts[ex.liftKey];
      if(!lift)return;
      const doneSets=ex.sets.filter(s=>s.done).length;
      const targetSets=ex.sets.length;
      // Only adjust on push weeks (5-6) to match Forge pattern
      if(week>=5&&week<=6){
        const oldTM=lift.tm;
        lift.tm=adjustTM(lift.tm,doneSets,targetSets);
        if(lift.tm!==oldTM)console.log('[HS]',ex.name,'TM',lift.tm>oldTM?'↑':'↓',oldTM,'→',lift.tm);
      }
    });
    return newState;
  },

  /* ── state advance ───────────────────────────────────────────────── */
  advanceState(state,sessionsThisWeek){
    const freq=getHSDaysPerWeek();
    const week=state.week||1;
    const rotation=ROTATIONS[freq]||ROTATIONS[3];
    const currentSession=rotation.includes(state.nextSession)?state.nextSession:rotation[0];
    // Find next session in rotation
    const currentIdx=rotation.indexOf(currentSession);
    const nextIdx=(currentIdx+1)%rotation.length;
    const nextSession=rotation[nextIdx];

    // Advance week when enough sessions done
    if(sessionsThisWeek>=freq&&week<CYCLE_LENGTH){
      return{...state,nextSession,week:week+1,weekStartDate:new Date().toISOString(),sessionCount:(state.sessionCount||0)+1};
    }
    // Cycle restart
    if(sessionsThisWeek>=freq&&week>=CYCLE_LENGTH){
      return{...state,nextSession:rotation[0],week:1,cycle:(state.cycle||1)+1,weekStartDate:new Date().toISOString(),sessionCount:(state.sessionCount||0)+1};
    }
    return{...state,nextSession,sessionCount:(state.sessionCount||0)+1};
  },

  /* ── date catch-up ───────────────────────────────────────────────── */
  dateCatchUp(state){
    const week=normalizeHSWeek(state.week);
    if(week>=CYCLE_LENGTH)return state;
    const daysSince=(Date.now()-new Date(state.weekStartDate||Date.now()).getTime())/MS_PER_DAY;
    if(daysSince>=7){
      const elapsed=Math.floor(daysSince/7);
      const next=getHSCatchUpWeek(week,elapsed);
      if(next===week)return state;
      return{...state,week:next,weekStartDate:new Date().toISOString()};
    }
    return state;
  },

  /* ── state migration ─────────────────────────────────────────────── */
  migrateState(state){
    if(state.sessionCount===undefined)state.sessionCount=0;
    if(!state.nextSession)state.nextSession='push';
    state.daysPerWeek=getHSDaysPerWeek();
    if(!state.rounding||state.rounding<=0)state.rounding=2.5;
    state.week=normalizeHSWeek(state.week);
    if(!state.cycle)state.cycle=1;
    if(!state.weekStartDate)state.weekStartDate=new Date().toISOString();
    if(!state.lifts)state.lifts={};
    // Ensure all lift keys exist
    for(const[key,defTM] of Object.entries(LIFT_DEFAULTS)){
      if(!state.lifts[key])state.lifts[key]={tm:defTM,name:LIFT_NAMES[key]||key};
      if(state.lifts[key].tm===undefined)state.lifts[key].tm=defTM;
      if(!state.lifts[key].name)state.lifts[key].name=LIFT_NAMES[key]||key;
    }
    if(!state.accessories)state.accessories=cloneAccessories();
    for(const k of Object.keys(ACC_DEFAULTS)){
      if(!state.accessories[k])state.accessories[k]=ACC_DEFAULTS[k];
    }
    return state;
  },

  /* ── swap support ────────────────────────────────────────────────── */
  getAuxSwapOptions(exercise){
    if(!exercise||!exercise.accSlotKey)return null;
    const key=exercise.accSlotKey;
    const pool=(ACC_POOLS[key]||[]).slice();
    if(exercise.name&&!pool.includes(exercise.name))pool.unshift(exercise.name);
    return{category:key,filters:ACC_FILTERS[key]||{},options:pool};
  },
  getBackSwapOptions(){return[];},
  onAuxSwap(slotIdx,newName,state){
    const accKey=getHSAccessorySlotKey(slotIdx);
    if(!accKey)return state;
    const next=JSON.parse(JSON.stringify(state));
    if(!next.accessories)next.accessories=cloneAccessories();
    next.accessories[accKey]=newName;
    return next;
  },
  onBackSwap(n,s){return s;},

  /* ── dashboard TMs ───────────────────────────────────────────────── */
  getDashboardTMs(state){
    const freq=getHSDaysPerWeek();
    const keys=activeLiftKeys(freq);
    const lifts=state.lifts||{};
    return Array.from(keys).filter(k=>lifts[k]).map(k=>({name:exName(lifts[k].name||LIFT_NAMES[k]),value:lifts[k].tm+'kg'}));
  },

  /* ── banner ──────────────────────────────────────────────────────── */
  getBannerHTML(options,state,schedule,workouts,fatigue){
    const freq=getHSDaysPerWeek();
    const week=state.week||1;
    const w=WEEKS[week]||WEEKS[1];
    const doneCount=options.filter(o=>o.done).length;
    const allDone=options.every(o=>o.done);
    const bestOpt=options.find(o=>o.isRecommended);
    const recovery=fatigue?100-fatigue.overall:100;

    // Sport awareness
    const todayDow=new Date().getDay();
    const sportDays=schedule?.sportDays||[];
    const legsHeavy=schedule?.sportLegsHeavy!==false;
    const recentHours={easy:18,moderate:24,hard:30}[schedule?.sportIntensity||'hard'];
    const sportName=schedule?.sportName||tr('common.sport','Sport');
    const isSportDay=sportDays.includes(todayDow);
    const hadSportRecently=workouts&&workouts.some(w=>(w.type==='sport'||w.type==='hockey')&&(Date.now()-new Date(w.date).getTime())/3600000<=recentHours);
    const sportLegs=(isSportDay||hadSportRecently)&&legsHeavy;
    const sportLabel=isSportDay?sportName+' day':'Post-'+sportName.toLowerCase();

    const blockLabel=tr('program.hs.block.'+getBlockKey(week),w.block);
    const left=options.filter(o=>!o.done).length;

    if(allDone)return{style:'rgba(34,197,94,0.1)',border:'rgba(34,197,94,0.25)',color:'var(--green)',
      html:tr('program.hs.banner_all_done','✅ All sessions done this week! Rest up.',{count:freq})};
    if(sportLegs&&bestOpt&&!bestOpt.hasLegs)return{style:'rgba(59,130,246,0.1)',border:'rgba(59,130,246,0.25)',color:'var(--blue)',
      html:'🏃 '+sportLabel+' — '+tr('program.hs.banner_upper_rec','recommending <strong>{session}</strong> (upper-focused).',{session:sessionLabel(bestOpt.value)})};
    if(sportLegs&&bestOpt&&bestOpt.hasLegs)return{style:'rgba(251,146,60,0.1)',border:'rgba(251,146,60,0.25)',color:'var(--orange)',
      html:'🏃 '+tr('program.hs.banner_legs_only','{sport} — only leg sessions remain. Go lighter or rest.',{sport:sportName})};
    if(recovery<40)return{style:'rgba(251,146,60,0.1)',border:'rgba(251,146,60,0.25)',color:'var(--orange)',
      html:tr('program.hs.banner_low_recovery','⚠️ Recovery {recovery}% — consider resting.',{recovery})};

    // Default
    const nextLabel=bestOpt?sessionLabel(bestOpt.value):sessionLabel(state.nextSession);
    return{style:'rgba(167,139,250,0.08)',border:'rgba(167,139,250,0.15)',color:'var(--purple)',
      html:'💪 '+tr('program.hs.banner_default','<strong>{session}</strong> next · {block} W{week} · {left} left · Recovery {recovery}%',{session:nextLabel,block:blockLabel,week,left,recovery})};
  },

  /* ── settings (advanced) ─────────────────────────────────────────── */
  renderSettings(state,container){
    const freq=getHSDaysPerWeek(),week=state.week||1,rounding=state.rounding||2.5;
    const cycle=state.cycle||1;
    const lifts=state.lifts||this.getInitialState().lifts;
    const roundOpts=[1,2.5,5].map(n=>`<option value="${n}"${n===rounding?' selected':''}>${n} kg</option>`).join('');

    const keys=activeLiftKeys(freq);
    const liftRows=Array.from(keys).map(key=>{
      const l=lifts[key]||{tm:LIFT_DEFAULTS[key],name:LIFT_NAMES[key]};
      return`<div class="lift-row">
        <span class="lift-label" style="min-width:100px">${escapeHtml(exName(l.name||LIFT_NAMES[key]))}</span>
        <input type="number" id="hs-adv-tm-${key}" value="${l.tm}" min="0" step="0.1" style="flex:1">
      </div>`;
    }).join('');

    container.innerHTML=`
      <div class="program-settings-grid">
        <div class="settings-section-card">
          <div class="settings-section-title">${tr('program.hs.settings.cycle_title','Cycle Controls')}</div>
          <div class="settings-section-sub">${tr('program.hs.settings.overview','8-week mesocycle: Ramp-up → Build → Push → Deload. TM adjusts automatically on Push weeks.')}</div>
          <label>${tr('program.hs.settings.cycle_week','Cycle & Week')}</label>
          <div style="font-size:13px;color:var(--text);margin-bottom:8px">${tr('program.hs.settings.cycle_value','Cycle {cycle} · Week {week} of {total}',{cycle,week,total:CYCLE_LENGTH})}</div>
          <label>${tr('program.hs.settings.week_override','Override Week (1-8)')}</label>
          <div style="display:flex;gap:8px;align-items:center">
            <input type="number" id="hs-adv-week" min="1" max="${CYCLE_LENGTH}" value="${week}" style="flex:1">
            <button class="btn btn-sm btn-secondary" type="button" onclick="document.getElementById('hs-adv-week').value=1" style="width:auto">Reset</button>
          </div>
          <label style="margin-top:12px">${tr('program.hs.settings.rounding','Weight Rounding (kg)')}</label>
          <select id="hs-adv-rounding">${roundOpts}</select>
          <div class="settings-section-sub" style="margin-top:12px">${escapeHtml(getHSFrequencyHint(freq))}</div>
          <div style="font-size:13px;color:var(--text);font-weight:600">${escapeHtml(_splitDescription(freq))}</div>
          <div id="hs-adv-split-preview" style="margin-top:10px;font-size:12px;color:var(--muted);line-height:1.8"></div>
        </div>
        <div class="settings-section-card">
          <div class="settings-section-title">${tr('program.hs.settings.tms','Training Maxes (kg)')}</div>
          <div class="settings-section-sub">${tr('program.hs.settings.tm_help','Weights are auto-calculated as a percentage of these values each week.')}</div>
          <div>${liftRows}</div>
        </div>
      </div>
      <button class="btn btn-purple" style="margin-top:16px" onclick="saveProgramSetup()">${tr('program.hs.save_setup','Save Program Setup')}</button>
    `;
    // Render split preview
    this._previewSplit();
  },

  /* ── settings (simple / basics) ──────────────────────────────────── */
  renderSimpleSettings(state,container){
    const freq=getHSDaysPerWeek();
    const lifts=state.lifts||this.getInitialState().lifts;

    const keys=activeLiftKeys(freq);
    const liftRows=Array.from(keys).map(key=>{
      const l=lifts[key]||{tm:LIFT_DEFAULTS[key],name:LIFT_NAMES[key]};
      return`<div class="lift-row">
        <span class="lift-label" style="min-width:100px">${escapeHtml(exName(l.name||LIFT_NAMES[key]))}</span>
        <input type="number" id="hs-basic-tm-${key}" value="${l.tm}" min="0" step="0.1" style="flex:1">
      </div>`;
    }).join('');

    container.innerHTML=`
      <div class="program-basics-note">${tr('program.hs.simple.overview','Choose how many times per week you want to train. The split adapts automatically.')}</div>
      <div class="settings-section-card" id="hs-basic-lifts-card">
        <div class="settings-section-title">${tr('program.hs.settings.tms','Training Maxes (kg)')}</div>
        <div class="settings-section-sub">${escapeHtml(getHSFrequencyHint(freq))}</div>
        <div class="settings-section-sub" style="margin-top:-2px;color:var(--text)">${escapeHtml(_splitDescription(freq))}</div>
        <div id="hs-basic-lifts-container">${liftRows}</div>
      </div>
    `;
  },

  getSimpleSettingsSummary(state){
    const freq=getHSDaysPerWeek();
    return tr('program.hs.simple.summary','{count} sessions/week · {split}',{count:freq,split:_splitDescription(freq)});
  },

  /* ── save settings ───────────────────────────────────────────────── */
  saveSettings(state){
    const week=parseInt(document.getElementById('hs-adv-week')?.value,10)||state.week||1;
    const rounding=parseFloat(document.getElementById('hs-adv-rounding')?.value)||2.5;
    const next=JSON.parse(JSON.stringify(state));
    const freq=getHSDaysPerWeek();
    next.week=Math.max(1,Math.min(CYCLE_LENGTH,week));
    next.rounding=rounding;
    // Read TMs
    const keys=activeLiftKeys(freq);
    keys.forEach(key=>{
      const el=document.getElementById('hs-adv-tm-'+key);
      if(el&&next.lifts[key])next.lifts[key].tm=parseFloat(el.value)||next.lifts[key].tm;
    });
    if(!(ROTATIONS[freq]||ROTATIONS[3]).includes(next.nextSession)){
      next.nextSession=(ROTATIONS[freq]||ROTATIONS[3])[0];
    }
    return next;
  },

  saveSimpleSettings(state){
    const next=JSON.parse(JSON.stringify(state||this.getInitialState()));
    const freq=getHSDaysPerWeek();
    // Read TMs from visible inputs
    const keys=activeLiftKeys(freq);
    keys.forEach(key=>{
      const el=document.getElementById('hs-basic-tm-'+key);
      if(el&&next.lifts[key])next.lifts[key].tm=parseFloat(el.value)||next.lifts[key].tm;
    });
    if(!(ROTATIONS[freq]||ROTATIONS[3]).includes(next.nextSession)){
      next.nextSession=(ROTATIONS[freq]||ROTATIONS[3])[0];
    }
    return next;
  },

  /* ── helpers ─────────────────────────────────────────────────────── */
  _previewSplit(){
    const freq=getHSDaysPerWeek();
    const prev=document.getElementById('hs-adv-split-preview');
    if(!prev)return;
    const rotation=ROTATIONS[freq]||ROTATIONS[3];
    const html=rotation.map((key,i)=>{
      const tmpl=TEMPLATES[key]||[];
      const names=tmpl.map(e=>{
        if(e.liftKey){
          const n=exName(this.getInitialState().lifts[e.liftKey]?.name||LIFT_NAMES[e.liftKey]||e.liftKey);
          return e.isT2?'<span style="color:var(--purple)">'+escapeHtml(n)+'</span>':'<strong>'+escapeHtml(n)+'</strong>';
        }
        return'<span style="color:var(--muted)">'+escapeHtml(exName(ACC_DEFAULTS[e.acc]||''))+'</span>';
      }).join(' · ');
      return'<div style="margin-bottom:4px"><span style="color:var(--accent);font-weight:700">'+sessionLabel(key)+':</span> '+names+'</div>';
    }).join('');
    prev.innerHTML=html+'<div style="margin-top:6px;font-size:11px;color:var(--muted)">'+tr('program.hs.settings.legend','<strong>Bold</strong> = T1 · <span style="color:var(--purple)">Purple</span> = T2 · <span style="color:var(--muted)">Grey</span> = accessory')+'</div>';
  }
};

/* ── split description helper ──────────────────────────────────────── */
function _splitDescription(freq){
  const map={
    2:tr('program.hs.split.2','Upper / Lower'),
    3:tr('program.hs.split.3','Push / Pull / Legs'),
    4:tr('program.hs.split.4','Upper / Lower × 2'),
    5:tr('program.hs.split.5','PPL + Upper + Lower'),
    6:tr('program.hs.split.6','Push / Pull / Legs × 2')
  };
  return map[freq]||map[3];
}

registerProgram(HS_PROGRAM);
})();
