// ── FORGE PROTOCOL PROGRAM ───────────────────────────────────────────────
// Registers itself with the PROGRAMS registry defined in app.js
(function(){
'use strict';

const MS_PER_DAY = 864e5;

function trForge(key,fallback,params){
  if(window.I18N)return I18N.t(key,params,fallback);
  return fallback;
}

function forgeExerciseName(name){
  if(window.EXERCISE_LIBRARY&&EXERCISE_LIBRARY.getDisplayName)return EXERCISE_LIBRARY.getDisplayName(name);
  return name;
}

function getForgeDaysPerWeek(){
  return typeof getProgramTrainingDaysPerWeek==='function'
    ? getProgramTrainingDaysPerWeek('forge')
    : 3;
}

function normalizeForgeWeek(rawWeek,skipPeakBlock){
  const week=parseInt(rawWeek,10);
  const maxWeek=skipPeakBlock?14:21;
  if(!Number.isFinite(week)||week<1)return 1;
  return Math.min(maxWeek,week);
}

function getForgeLoggedRepCount(raw){
  const reps=parseInt(raw,10);
  return Number.isFinite(reps)&&reps>=0?reps:null;
}

function getForgeNextWeek(rawWeek,skipPeakBlock){
  const week=normalizeForgeWeek(rawWeek,skipPeakBlock);
  const next=week+1;
  if(skipPeakBlock&&next>=15)return 1;
  return Math.min(21,next);
}

function getForgeCatchUpWeek(rawWeek,elapsedWeeks,skipPeakBlock){
  let week=normalizeForgeWeek(rawWeek,skipPeakBlock);
  const elapsed=Math.max(0,parseInt(elapsedWeeks,10)||0);
  for(let i=0;i<elapsed;i++){
    const next=getForgeNextWeek(week,skipPeakBlock);
    if(next===week)break;
    week=next;
    if(FORGE_INTERNAL.deloadWeeks.includes(week))break;
  }
  return week;
}

function getForgeBlockName(rawName){
  if(!rawName)return rawName;
  const keyMap={Hypertrophy:'program.forge.block.hypertrophy',Strength:'program.forge.block.strength',Peaking:'program.forge.block.peaking',Deload:'program.forge.block.deload'};
  const k=keyMap[rawName];
  return k?trForge(k,rawName):rawName;
}

function getForgeModeName(mode){
  return trForge('program.forge.mode.'+mode+'.name',FORGE_INTERNAL.modes[mode]?.name||mode);
}

function getForgeModeDesc(mode){
  return trForge('program.forge.mode.'+mode+'.desc',FORGE_INTERNAL.modes[mode]?.desc||'');
}

function getForgeSimpleMainOptions(slotIdx,currentName){
  const config=[
    {base:'Squat',category:'squat'},
    {base:'Bench Press',category:'bench'},
    {base:'Deadlift',category:'deadlift'},
    {base:'OHP',category:'ohp'}
  ][slotIdx]||{base:currentName||'Lift',category:'squat'};
  const opts=[config.base,...(FORGE_INTERNAL.auxOptions[config.category]||[])];
  if(currentName&&!opts.includes(currentName))opts.push(currentName);
  return [...new Set(opts)];
}

function getForgeSwapFilters(category){
  const filtersByCategory={
    squat:{movementTags:['squat'],equipmentTags:['barbell','dumbbell','machine','bodyweight'],muscleGroups:['quads','glutes']},
    bench:{movementTags:['horizontal_press'],equipmentTags:['barbell','dumbbell','machine','bodyweight'],muscleGroups:['chest','triceps','shoulders']},
    deadlift:{movementTags:['hinge'],equipmentTags:['barbell','trap_bar','dumbbell','machine','bodyweight'],muscleGroups:['hamstrings','glutes','back']},
    ohp:{movementTags:['vertical_press'],equipmentTags:['barbell','dumbbell','machine','bodyweight'],muscleGroups:['shoulders','triceps']},
    back:{movementTags:['horizontal_pull','vertical_pull'],equipmentTags:['barbell','dumbbell','cable','machine','pullup_bar','bodyweight'],muscleGroups:['back','biceps']}
  };
  return filtersByCategory[category]||{};
}

const FORGE_MAIN_SLOT_CONFIG=[
  {labelKey:'program.forge.lift.sq',fallback:'Squat (SQ)',base:'Squat',category:'squat'},
  {labelKey:'program.forge.lift.bp',fallback:'Bench Press (BP)',base:'Bench Press',category:'bench'},
  {labelKey:'program.forge.lift.dl',fallback:'Deadlift (DL)',base:'Deadlift',category:'deadlift'},
  {labelKey:'program.forge.lift.ohp',fallback:'Overhead Press (OHP)',base:'OHP',category:'ohp'}
];
const FORGE_AUX_LABELS=[
  'program.forge.lift.sq1','program.forge.lift.sq2','program.forge.lift.bp1',
  'program.forge.lift.bp2','program.forge.lift.dlv','program.forge.lift.ohpv'
];
const FORGE_AUX_FALLBACKS=[
  'Squat Variant 1 (SQ-1)','Squat Variant 2 (SQ-2)','Bench Variant 1 (BP-1)',
  'Bench Variant 2 (BP-2)','Deadlift Variant (DL)','Overhead Press Variant (OHP)'
];
let _forgeSettingsDrafts={basic:null,advanced:null};

function createForgeSettingsDraft(state){
  const initial=FORGE_PROGRAM.getInitialState();
  const source=state||initial;
  const lifts=source.lifts||initial.lifts;
  return{
    main:(lifts.main||initial.lifts.main).map((lift,idx)=>({
      name:resolveProgramExerciseName(lift.name||FORGE_MAIN_SLOT_CONFIG[idx]?.base||''),
      tm:Number(lift.tm||0)
    })),
    aux:(lifts.aux||initial.lifts.aux).map(lift=>({
      name:resolveProgramExerciseName(lift.name||''),
      tm:Number(lift.tm||0)
    })),
    backExercise:resolveProgramExerciseName(source.backExercise||initial.backExercise||'Barbell Rows')
  };
}

function getForgeSettingsDraft(scope,state){
  if(!_forgeSettingsDrafts[scope])_forgeSettingsDrafts[scope]=createForgeSettingsDraft(state);
  return _forgeSettingsDrafts[scope];
}

function getForgeMainPickerInfo(slotIdx,currentName){
  const config=FORGE_MAIN_SLOT_CONFIG[slotIdx]||FORGE_MAIN_SLOT_CONFIG[0];
  const options=getForgeSimpleMainOptions(slotIdx,currentName);
  return{category:config.category,filters:getForgeSwapFilters(config.category),options};
}

function getForgeAuxPickerInfo(slotIdx,currentName){
  const category=FORGE_INTERNAL.getAuxCategory(slotIdx);
  const options=(FORGE_INTERNAL.auxOptions[category]||[]).slice();
  if(currentName&&!options.includes(currentName))options.unshift(currentName);
  return{category,filters:getForgeSwapFilters(category),options};
}

function getForgeBackPickerInfo(currentName){
  const options=(FORGE_INTERNAL.auxOptions.back||[]).slice();
  if(currentName&&!options.includes(currentName))options.unshift(currentName);
  return{category:'back',filters:getForgeSwapFilters('back'),options};
}

function renderForgePickerRow(label,value,onClick,meta,valueId){
  return`<div class="settings-picker-row">
    <div class="settings-picker-main">
      <div class="settings-picker-label">${escapeHtml(label)}</div>
      <div class="settings-picker-value${value?'':' is-empty'}"${valueId?` id="${valueId}"`:''}>${escapeHtml(value?forgeExerciseName(value):trForge('program.w531.settings.pick_exercise','Pick exercise'))}</div>
      ${meta?`<div class="settings-picker-meta">${meta}</div>`:''}
    </div>
    <button class="btn btn-secondary btn-sm" type="button" onclick="${onClick}" style="width:auto;white-space:nowrap">${trForge('workout.swap','Swap')}</button>
  </div>`;
}

function buildForgeLiftsFromDraft(draft){
  const initial=FORGE_PROGRAM.getInitialState().lifts;
  const safeDraft=draft||createForgeSettingsDraft();
  return{
    main:(safeDraft.main||initial.main).map((lift,idx)=>({
      name:resolveProgramExerciseName(lift?.name||FORGE_MAIN_SLOT_CONFIG[idx]?.base||''),
      tm:Number(lift?.tm||0)
    })),
    aux:(safeDraft.aux||initial.aux).map(lift=>({
      name:resolveProgramExerciseName(lift?.name||''),
      tm:Number(lift?.tm||0)
    }))
  };
}

function syncForgePickerDisplay(scope,group,idx){
  const draft=getForgeSettingsDraft(scope,typeof getActiveProgramState==='function'?getActiveProgramState():FORGE_PROGRAM.getInitialState());
  let value='';
  let valueId='';
  if(group==='main'){
    value=draft.main?.[idx]?.name||'';
    valueId=`forge-${scope}-main-value-${idx}`;
  }else if(group==='aux'){
    value=draft.aux?.[idx]?.name||'';
    valueId=`forge-${scope}-aux-value-${idx}`;
  }else{
    value=draft.backExercise||'';
    valueId=`forge-${scope}-back-value`;
  }
  const el=document.getElementById(valueId);
  if(el){
    el.textContent=value?forgeExerciseName(value):trForge('program.w531.settings.pick_exercise','Pick exercise');
    el.classList.toggle('is-empty',!value);
  }
  if(scope==='advanced'&&group!=='back'){
    window._forgeRefreshAdvancedPreview();
  }
}

const FORGE_INTERNAL={
  mainIntensity:[0,0.70,0.75,0.80,0.725,0.775,0.825,0.60,0.75,0.80,0.85,0.775,0.825,0.875,0.60,0.80,0.85,0.90,0.85,0.90,0.95,0.60],
  auxIntensity:[0,0.60,0.65,0.70,0.625,0.675,0.725,0.50,0.65,0.70,0.75,0.675,0.725,0.775,0.50,0.70,0.75,0.80,0.75,0.80,0.85,0.50],
  deloadWeeks:[7,14,21],
  blockNames:['','Hypertrophy','Hypertrophy','Hypertrophy','Hypertrophy','Hypertrophy','Hypertrophy','Deload','Strength','Strength','Strength','Strength','Strength','Strength','Deload','Peaking','Peaking','Peaking','Peaking','Peaking','Peaking','Deload'],
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
      const normalSets=4,repOutTarget=reps*2;
      return{weight:wt,reps,rir,pct,isDeload,blockName:this.blockNames[week]||'',mode:'rtf',normalSets,repOutTarget,
        setTarget:isDeload?'5':(normalSets+'+AMRAP'),
        note:isDeload?trForge('program.forge.note.deload',reps+'×'+wt+'kg — easy, 5 sets',{reps,weight:wt}):trForge('program.forge.note.rtf',wt+'kg × '+reps+' reps for '+normalSets+' sets, then go all-out on set '+(normalSets+1)+' (target '+repOutTarget+'+ reps)',{weight:wt,reps,normalSets,amrapSet:normalSets+1,repOutTarget})};
    }
    if(mode==='rir'){
      const fixedSets=5;
      return{weight:wt,reps,rir,pct,isDeload,blockName:this.blockNames[week]||'',mode:'rir',fixedSets,rirTarget:rir,
        setTarget:String(fixedSets),
        note:isDeload?trForge('program.forge.note.deload',reps+'×'+wt+'kg — easy, 5 sets',{reps,weight:wt}):trForge('program.forge.note.rir',wt+'kg × '+reps+' for '+fixedSets+' sets — on the last set, note how many reps you had left (target RIR ≤'+rir+')',{weight:wt,reps,fixedSets,rir})};
    }
    return{weight:wt,reps,rir,pct,isDeload,setTarget:isDeload?'5':this.setLow+'-'+this.setHigh,blockName:this.blockNames[week]||'',mode:'sets',
      note:isDeload?trForge('program.forge.note.deload',reps+'×'+wt+'kg — easy, 5 sets',{reps,weight:wt}):trForge('program.forge.note.sets',wt+'kg × '+reps+' reps — stop when RIR ≤'+rir+' (aim for '+this.setLow+'-'+this.setHigh+' sets)',{weight:wt,reps,rir,setLow:this.setLow,setHigh:this.setHigh})};
  },
  adjustTM(tm,data,week,mode){
    mode=mode||'sets';
    if(this.deloadWeeks.includes(week))return tm;
    if(mode==='rtf'){
      const reps=data.repsOnLastSet;
      const target=data.repOutTarget||10;
      if(reps===null||reps===undefined)return tm;
      if(reps>=target+3)return Math.round(tm*1.04*100)/100;
      if(reps>=target)return Math.round(tm*1.02*100)/100;
      if(reps>=target-2)return tm;
      return Math.round(tm*0.95*100)/100;
    }
    if(mode==='rir'){
      const sets=data.setsCompleted||0,lastRIR=data.lastSetRIR;
      if(sets<5)return Math.round(tm*0.95*100)/100;
      if(lastRIR!==null&&lastRIR!==undefined){
        if(lastRIR<=0)return Math.round(tm*0.97*100)/100;
        if(lastRIR<=1)return tm;
        if(lastRIR<=2)return Math.round(tm*1.01*100)/100;
        return Math.round(tm*1.02*100)/100;
      }
      return tm;
    }
    const sets=typeof data==='number'?data:data.setsCompleted||0;
    if(sets<this.setLow)return Math.round(tm*(1+this.tmDown)*100)/100;
    if(sets>this.setHigh)return Math.round(tm*(1+this.tmUp)*100)/100;
    return tm;
  },
  getDayExercises(day,freq,lifts){
    const m=lifts.main,a=lifts.aux,r=[];
    const splits={
      2:[[['m',0],['m',1],['a',4],['a',5]],[['m',2],['m',3],['a',0],['a',2]]],
      3:[[['m',0],['a',4],['a',3]],[['m',1],['m',3],['a',0]],[['m',2],['a',2],['a',1],['a',5]]],
      4:[[['m',0],['a',3],['a',4]],[['m',1],['a',0],['a',5]],[['m',2],['a',2]],[['m',3],['a',1]]],
      5:[[['m',0],['a',5]],[['m',1],['a',0]],[['m',2],['a',2]],[['m',3],['a',1]],[['a',3],['a',4]]],
      6:[[['m',0],['a',2]],[['a',5],['a',4]],[['m',1],['a',0]],[['a',3],['a',1]],[['m',2]],[['m',3]]]
    };
    const layout=splits[freq]?splits[freq][day-1]:splits[3][0];
    if(!layout)return r;
    layout.forEach(([type,idx])=>{const src=type==='m'?m:a;if(src[idx])r.push({...src[idx],isAux:type==='a'});});
    return r;
  },
  auxOptions:{
    squat:['Front Squat','Paused Squat','High Bar Squat','Beltless Squat','Wider Stance Squat','Narrower Stance Squat','Box Squat','Pin Squat','Half Squat','Good Morning','Squat With Slow Eccentric','Leg Press'],
    bench:['Close-Grip Bench','Long Pause Bench','Spoto Press','Incline Press','Wider Grip Bench','Board Press','Pin Press','Slingshot Bench','Bench With Feet Up','Bench With Slow Eccentric','DB Bench'],
    deadlift:['Sumo Deadlift','Conventional Deadlift','Block Pull','Rack Pull','Deficit Deadlift','Romanian Deadlift','Stiff Leg Deadlift','Snatch Grip Deadlift','Trap Bar Deadlift'],
    ohp:['Push Press','Behind The Neck OHP','Seated OHP','Incline Press','DB OHP'],
    back:['Barbell Rows','DB Rows','Chest Supported Rows','T-Bar Rows','Pull-ups','Chin-ups','Neutral Grip Pull-ups','Pull-downs']
  },
  getAuxCategory(slotIdx){return['squat','squat','bench','bench','deadlift','ohp'][slotIdx]||'squat';}
};

const LEG_LIFTS=['squat','front squat','paused squat','high bar squat','beltless squat','wider stance squat','narrower stance squat','box squat','pin squat','half squat','good morning','squat with slow eccentric','leg press','deadlift','sumo deadlift','conventional deadlift','block pull','rack pull','deficit deadlift','romanian deadlift','stiff leg deadlift','snatch grip deadlift','trap bar deadlift'];

const FORGE_PROGRAM={
  id:'forge',
  name:trForge('program.forge.name','Forge Protocol'),
  description:trForge('program.forge.description','21-week strength cycle: hypertrophy, strength, and peaking.'),
  icon:'⚒️',
  legLifts:LEG_LIFTS,

  getInitialState(){
      return{week:1,daysPerWeek:3,mode:'sets',rounding:2.5,skipPeakBlock:false,weekStartDate:new Date().toISOString(),backExercise:'Barbell Rows',backWeight:0,
        lifts:{main:[{name:'Squat',tm:100},{name:'Bench Press',tm:80},{name:'Deadlift',tm:120},{name:'OHP',tm:50}],
        aux:[{name:'Front Squat',tm:80},{name:'Paused Squat',tm:90},{name:'Close-Grip Bench',tm:70},{name:'Spoto Press',tm:75},{name:'Stiff Leg Deadlift',tm:100},{name:'Push Press',tm:50}]}};
  },

  getSessionOptions(state,workouts,schedule){
    const freq=getForgeDaysPerWeek(),week=state.week||1,lifts=state.lifts;
    const todayDow=new Date().getDay();
    const sportDays=schedule?.sportDays||[];
    const legsHeavy=schedule?.sportLegsHeavy!==false;
    const recentHours={easy:18,moderate:24,hard:30}[schedule?.sportIntensity||'hard'];
    const isSportDay=sportDays.includes(todayDow);
    const hadSportRecently=workouts.some(w=>(w.type==='sport'||w.type==='hockey')&&(Date.now()-new Date(w.date).getTime())/3600000<=recentHours);
    const sportLegs=(isSportDay||hadSportRecently)&&legsHeavy;
    const now=new Date(),sow=getWeekStart(now);
    const doneThisWeek=workouts.filter(w=>(w.program==='forge'||(!w.program&&w.type==='forge'))&&new Date(w.date)>=sow).map(w=>w.programDayNum);
    let bestDay=1,bestScore=-999;
    const dayScores=[];
    for(let d=1;d<=freq;d++){
      const exs=FORGE_INTERNAL.getDayExercises(d,freq,lifts);
      const hasLegs=exs.some(e=>LEG_LIFTS.includes(e.name.toLowerCase()));
      const done=doneThisWeek.includes(d);
      let score=0;
      if(done)score-=100;if(sportLegs&&hasLegs)score-=30;if(!done)score+=10;if(!hasLegs&&sportLegs)score+=15;
      dayScores.push({d,hasLegs,done,score});
      if(score>bestScore){bestScore=score;bestDay=d;}
    }
    return dayScores.map(({d,hasLegs,done})=>{
      const exs=FORGE_INTERNAL.getDayExercises(d,freq,lifts);
      const label=exs.map(e=>forgeExerciseName(e.name)).join(' + ');
      const badges=[];
      if(done)badges.push('✅');
      if(sportLegs&&hasLegs&&!FORGE_INTERNAL.deloadWeeks.includes(week))badges.push('🏃⚠️');
      if(d===bestDay&&!done)badges.push('⭐');
      return{value:String(d),label:badges.join('')+' '+trForge('program.forge.day_label','Day {day}: {label}',{day:d,label}),isRecommended:d===bestDay,done,hasLegs,sportLegs};
    });
  },

  buildSession(selectedOption,state,context){
    const dayNum=parseInt(selectedOption)||1;
    const week=state.week||1,freq=getForgeDaysPerWeek(),rounding=state.rounding||2.5,mode=state.mode||'sets';
    const effectiveSessionMode=context?.effectiveSessionMode==='light'?'light':'normal';
    const energyBoost=context?.energyBoost===true;
    const programDeload=FORGE_INTERNAL.deloadWeeks.includes(week);
    const prescriptionWeek=effectiveSessionMode==='normal'&&programDeload?Math.max(1,week-1):week;
    const lifts=state.lifts;
    const isDeload=effectiveSessionMode==='light'&&programDeload;
    const dayExercises=FORGE_INTERNAL.getDayExercises(dayNum,freq,lifts);
    const exercises=[];
    dayExercises.forEach(ex=>{
      const rx=FORGE_INTERNAL.getPrescription(ex.tm,prescriptionWeek,ex.isAux,rounding,mode);
      let auxSlotIdx=-1;if(ex.isAux)auxSlotIdx=lifts.aux.findIndex(a=>a.name===ex.name);
      const extraSet=energyBoost&&!ex.isAux&&!isDeload?1:0;
      let sets;
      if(mode==='rtf'&&!isDeload){sets=Array.from({length:rx.normalSets+extraSet},()=>({weight:rx.weight,reps:rx.reps,done:false,rpe:null}));sets.push({weight:rx.weight,reps:'AMRAP',done:false,rpe:null,isAmrap:true,repOutTarget:rx.repOutTarget});}
      else if(mode==='rir'&&!isDeload){sets=Array.from({length:rx.fixedSets+extraSet},()=>({weight:rx.weight,reps:rx.reps,done:false,rpe:null}));}
      else{const count=isDeload?5:FORGE_INTERNAL.setHigh+extraSet;sets=Array.from({length:count},()=>({weight:rx.weight,reps:rx.reps,done:false,rpe:null}));}
      exercises.push({id:Date.now()+Math.random(),name:ex.name,note:rx.note||'',isAux:ex.isAux,tm:ex.tm,auxSlotIdx,prescribedWeight:rx.weight,prescribedReps:rx.reps,rirCutoff:rx.rir,isDeload:rx.isDeload,repOutTarget:rx.repOutTarget||0,sets});
    });
    const backEx=state.backExercise||'Barbell Rows',backWt=state.backWeight||0;
    exercises.push({id:Date.now()+Math.random(),name:backEx,note:backWt?trForge('program.forge.back.note_weight',backWt+'kg × 3 sets of 8-10 — hit 3×10 then increase weight',{weight:backWt}):trForge('program.forge.back.note_empty','Set a working weight in Settings for auto-fill'),isAux:false,isAccessory:true,tm:0,auxSlotIdx:-1,sets:[{weight:backWt||'',reps:8,done:false,rpe:null},{weight:backWt||'',reps:8,done:false,rpe:null},{weight:backWt||'',reps:8,done:false,rpe:null}]});
    return exercises;
  },

  getSessionLabel(selectedOption,state,context){
    const dayNum=parseInt(selectedOption)||1,week=state.week||1;
    const effectiveSessionMode=context?.effectiveSessionMode==='light'?'light':'normal';
    const programDeload=FORGE_INTERNAL.deloadWeeks.includes(week);
    const labelWeek=effectiveSessionMode==='normal'&&programDeload?Math.max(1,week-1):week;
    const isDeload=effectiveSessionMode==='light'&&programDeload,mode=state.mode||'sets';
    const modeTag=getForgeModeName(mode);
    return(isDeload?'🌊':'🏋️')+' '+trForge('program.forge.session_label','W{week} Day {day} · {block} [{mode}]',{week:labelWeek,day:dayNum,block:getForgeBlockName(FORGE_INTERNAL.blockNames[labelWeek]||''),mode:modeTag});
  },

  getSessionModeRecommendation(state){
    const week=state?.week||1;
    return FORGE_INTERNAL.deloadWeeks.includes(week)?'light':'normal';
  },

  getBlockInfo(state){
    const week=state.week||1,mode=state.mode||'sets';
    const pct=Math.round((FORGE_INTERNAL.mainIntensity[week]||0)*100);
    const isDeload=FORGE_INTERNAL.deloadWeeks.includes(week);
    const reps=FORGE_INTERNAL.getReps(FORGE_INTERNAL.mainIntensity[week]||0.7);
    const rir=FORGE_INTERNAL.getRIR(FORGE_INTERNAL.mainIntensity[week]||0.7);
    let modeDesc='';
    if(isDeload)modeDesc=trForge('program.forge.blockinfo.deload','Light week — 60% TM, 5 easy sets.');
    else if(mode==='sets')modeDesc=trForge('program.forge.blockinfo.sets','Do sets of {reps} until RIR ≤{rir}. Aim for 4-6 sets.',{reps,rir});
    else if(mode==='rtf')modeDesc=trForge('program.forge.blockinfo.rtf',reps+' reps × 4 sets, then AMRAP last set (target '+(reps*2)+'+).',{reps,target:reps*2});
    else if(mode==='rir')modeDesc=trForge('program.forge.blockinfo.rir','5 sets of '+reps+'. Note reps left in tank on last set.',{reps});
    if(state.skipPeakBlock&&week===14)modeDesc+=trForge('program.forge.blockinfo.skip_peak',' Peak block skipped — program restarts from Hypertrophy after this deload.');
    return{name:getForgeBlockName(FORGE_INTERNAL.blockNames[week]||''),weekLabel:trForge('program.forge.week_label','Week {week}',{week}),pct,isDeload,totalWeeks:state.skipPeakBlock?14:21,mode,modeName:getForgeModeName(mode),modeDesc,reps,rir};
  },

  getSessionCharacter(selectedOption,state){
    const week=state.week||1;
    const pct=Math.round((FORGE_INTERNAL.mainIntensity[week]||0)*100);
    if(FORGE_INTERNAL.deloadWeeks.includes(week)){
      return{tone:'deload',icon:'🌊',labelKey:'program.forge.character.deload',labelFallback:trForge('program.forge.character.deload','Deload — lighter loads, recovery focus'),labelParams:{}};
    }
    const block=FORGE_INTERNAL.blockNames[week]||'';
    if(block==='Peaking'||pct>=85){
      return{tone:'heavy',icon:'🔥',labelKey:'program.forge.character.heavy',labelFallback:trForge('program.forge.character.heavy','Heavy — top sets at {pct}% TM',{pct}),labelParams:{pct}};
    }
    if(block==='Strength'){
      return{tone:'heavy',icon:'💪',labelKey:'program.forge.character.strength',labelFallback:trForge('program.forge.character.strength','Strength — {pct}% TM, controlled volume',{pct}),labelParams:{pct}};
    }
    return{tone:'volume',icon:'📈',labelKey:'program.forge.character.volume',labelFallback:trForge('program.forge.character.volume','Hypertrophy — {pct}% TM, build volume',{pct}),labelParams:{pct}};
  },

  getPreSessionNote(selectedOption,state){
    const week=state.week||1;
    const mode=state.mode||'sets';
    const totalWeeks=state.skipPeakBlock?14:21;
    const block=getForgeBlockName(FORGE_INTERNAL.blockNames[week]||'');
    let modeHint='';
    if(mode==='sets')modeHint=trForge('program.forge.note.sets_hint','Stop sets when form breaks down.');
    else if(mode==='rtf')modeHint=trForge('program.forge.note.rtf_hint','Push the last set for max reps.');
    else if(mode==='rir')modeHint=trForge('program.forge.note.rir_hint','Note reps left in tank on the last set.');
    if(FORGE_INTERNAL.deloadWeeks.includes(week)){
      return trForge('program.forge.note.deload','Week {week} of {total} — deload. Light and easy, let recovery happen.',{week,total:totalWeeks});
    }
    return trForge('program.forge.note.default','Week {week} of {total} — {block}. {hint}',{week,total:totalWeeks,block,hint:modeHint});
  },

  adjustAfterSession(exercises,state){
    const newState=JSON.parse(JSON.stringify(state));
    const week=normalizeForgeWeek(state.week,state.skipPeakBlock),mode=state.mode||'sets';
    if(FORGE_INTERNAL.deloadWeeks.includes(week))return newState;
    exercises.forEach(ex=>{
      if(ex.isAccessory)return;
      const all=[...newState.lifts.main,...newState.lifts.aux];
      const match=all.find(l=>l.name===ex.name);if(!match)return;
      const doneSets=ex.sets.filter(s=>s.done).length;
      let adjustData;
      if(mode==='rtf'){
        const amrapSet=ex.sets.find(s=>s.isAmrap&&s.done);
        adjustData={repsOnLastSet:getForgeLoggedRepCount(amrapSet?.reps),repOutTarget:ex.repOutTarget||10};
      }
      else if(mode==='rir'){
        const lastDone=ex.sets.filter(s=>s.done).pop();
        const rir=lastDone?.rir!==undefined&&lastDone.rir!==''?getForgeLoggedRepCount(lastDone.rir):null;
        adjustData={setsCompleted:doneSets,lastSetRIR:rir};
      }
      else{adjustData=doneSets;}
      const oldTM=match.tm;match.tm=FORGE_INTERNAL.adjustTM(match.tm,adjustData,week,mode);
      if(match.tm!==oldTM)console.log('[Forge/'+mode+']',ex.name,'TM',match.tm>oldTM?'↑':'↓',oldTM,'→',match.tm);
    });
    return newState;
  },

  advanceState(state,sessionsThisWeek){
    const freq=getForgeDaysPerWeek(),week=normalizeForgeWeek(state.week,state.skipPeakBlock);
    if(sessionsThisWeek>=freq&&week<21){
      return{...state,week:getForgeNextWeek(week,state.skipPeakBlock),weekStartDate:new Date().toISOString()};
    }
    return state;
  },

  dateCatchUp(state){
    const week=normalizeForgeWeek(state.week,state.skipPeakBlock);if(week>=21)return state;
    const daysSince=(Date.now()-new Date(state.weekStartDate||Date.now()).getTime())/MS_PER_DAY;
    if(daysSince>=7){
      const elapsed=Math.floor(daysSince/7);
      const next=getForgeCatchUpWeek(week,elapsed,state.skipPeakBlock);
      if(next===week)return state;
      return{...state,week:next,weekStartDate:new Date().toISOString()};
    }
    return state;
  },

  migrateState(state){
    if(!state||typeof state!=='object')return this.getInitialState();
    if(!state.daysPerWeek)state.daysPerWeek=getForgeDaysPerWeek();
    if(!state.mode||!FORGE_INTERNAL.modes[state.mode])state.mode='sets';
    if(!state.rounding||state.rounding<=0)state.rounding=2.5;
    if(state.skipPeakBlock===undefined)state.skipPeakBlock=false;
    state.week=normalizeForgeWeek(state.week,state.skipPeakBlock);
    if(!state.weekStartDate)state.weekStartDate=new Date().toISOString();
    if(!state.backExercise)state.backExercise='Barbell Rows';
    state.backWeight=Number.isFinite(Number(state.backWeight))?Number(state.backWeight):0;
    const initial=this.getInitialState();
    if(!state.lifts)state.lifts=JSON.parse(JSON.stringify(initial.lifts));
    if(!Array.isArray(state.lifts.main)||state.lifts.main.length!==initial.lifts.main.length){
      state.lifts.main=JSON.parse(JSON.stringify(initial.lifts.main));
    }
    if(!Array.isArray(state.lifts.aux)||state.lifts.aux.length!==initial.lifts.aux.length){
      state.lifts.aux=JSON.parse(JSON.stringify(initial.lifts.aux));
    }
    state.lifts.main=state.lifts.main.map((lift,idx)=>({
      name:resolveProgramExerciseName(lift?.name||initial.lifts.main[idx].name),
      tm:Number.isFinite(Number(lift?.tm))?Number(lift.tm):initial.lifts.main[idx].tm
    }));
    state.lifts.aux=state.lifts.aux.map((lift,idx)=>({
      name:resolveProgramExerciseName(lift?.name||initial.lifts.aux[idx].name),
      tm:Number.isFinite(Number(lift?.tm))?Number(lift.tm):initial.lifts.aux[idx].tm
    }));
    return state;
  },

  getAuxSwapOptions(exercise){
    if(exercise.auxSlotIdx<0)return null;
    const cat=FORGE_INTERNAL.getAuxCategory(exercise.auxSlotIdx);
    return{category:cat,filters:getForgeSwapFilters(cat),options:FORGE_INTERNAL.auxOptions[cat]||[]};
  },
  getBackSwapOptions(){return{category:'back',filters:getForgeSwapFilters('back'),options:FORGE_INTERNAL.auxOptions.back||[]};},
  onAuxSwap(slotIdx,newName,state){const s=JSON.parse(JSON.stringify(state));if(s.lifts&&s.lifts.aux[slotIdx])s.lifts.aux[slotIdx].name=newName;return s;},
  onBackSwap(newName,state){return{...state,backExercise:newName};},
  getProgramConstraints(state){
    const nextState=state&&state.lifts?state:this.getInitialState();
    const overrides={};
    (nextState.lifts?.main||[]).forEach((lift,idx)=>{
      const info=getForgeMainPickerInfo(idx,lift?.name||'');
      overrides[String(lift?.name||'').trim().toLowerCase()]={filters:info.filters,options:info.options,clearWeightOnSwap:true};
    });
    (nextState.lifts?.aux||[]).forEach((lift,idx)=>{
      const info=getForgeAuxPickerInfo(idx,lift?.name||'');
      overrides[String(lift?.name||'').trim().toLowerCase()]={filters:info.filters,options:info.options,clearWeightOnSwap:true};
    });
    const backName=nextState.backExercise||'Barbell Rows';
    const backInfo=getForgeBackPickerInfo(backName);
    overrides[String(backName).trim().toLowerCase()]={filters:backInfo.filters,options:backInfo.options,clearWeightOnSwap:true};
    return{exerciseOverrides:overrides};
  },
  adaptSession(baseSession,planningContext,decision){
    const exercises=JSON.parse(JSON.stringify(baseSession||[]));
    const adaptationEvents=[];
    const equipmentHint=(planningContext?.equipmentAccess==='home_gym'||planningContext?.equipmentAccess==='minimal')
      ? (typeof createTrainingCommentaryEvent==='function'
        ? createTrainingCommentaryEvent('same_pattern_swaps',{programId:'forge',programName:'Forge'})
        : null)
      : null;
    return{exercises,adaptationEvents,equipmentHint};
  },

  getDashboardTMs(state){return(state.lifts?.main||[]).map(l=>({name:l.name,value:l.tm+'kg'}));},

  getBannerHTML(options,state,schedule,workouts,fatigue){
    const freq=getForgeDaysPerWeek();
    const doneCount=options.filter(o=>o.done).length;
    const allDone=options.every(o=>o.done);
    const todayDow=new Date().getDay();
    const sportDays=schedule?.sportDays||[];
    const legsHeavy=schedule?.sportLegsHeavy!==false;
    const recentHours={easy:18,moderate:24,hard:30}[schedule?.sportIntensity||'hard'];
    const sportName=schedule?.sportName||trForge('common.sport','Sport');
    const isSportDay=sportDays.includes(todayDow);
    const hadSportRecently=workouts.some(w=>(w.type==='sport'||w.type==='hockey')&&(Date.now()-new Date(w.date).getTime())/3600000<=recentHours);
    const sportLegs=(isSportDay||hadSportRecently)&&legsHeavy;
    const sportLabel=isSportDay?sportName+' day':'Post-'+sportName.toLowerCase();
    const recovery=fatigue?100-fatigue.overall:100;
    const bestOpt=options.find(o=>o.isRecommended);
    const left=freq-doneCount;
    if(allDone)return{style:'rgba(34,197,94,0.1)',border:'rgba(34,197,94,0.25)',color:'var(--green)',html:trForge('program.forge.banner_all_done','✅ All {count} sessions done this week! Rest up and recover.',{count:freq})};
    if(sportLegs&&bestOpt&&!bestOpt.hasLegs)return{style:'rgba(59,130,246,0.1)',border:'rgba(59,130,246,0.25)',color:'var(--blue)',html:'🏃 '+sportLabel+' — '+trForge('program.forge.banner_upper_recommended','recommending <strong>Day {day}</strong> (upper-focused). Spare those legs.',{day:bestOpt.value})};
    if(sportLegs&&bestOpt&&bestOpt.hasLegs)return{style:'rgba(251,146,60,0.1)',border:'rgba(251,146,60,0.25)',color:'var(--orange)',html:'🏃 '+trForge('program.forge.banner_legs_only_left','{sport} legs but only leg days remain. Go lighter or rest today.',{sport:sportName})};
    if(recovery<40)return{style:'rgba(251,146,60,0.1)',border:'rgba(251,146,60,0.25)',color:'var(--orange)',html:trForge('program.forge.banner_low_recovery','⚠️ Recovery {recovery}% — consider resting. If training, <strong>Day {day}</strong> is next.',{recovery,day:(bestOpt?.value||1)})};
    return{style:'rgba(167,139,250,0.08)',border:'rgba(167,139,250,0.15)',color:'var(--purple)',html:trForge('program.forge.banner_recommended','⭐ Recommended: <strong>Day {day}</strong> · {left} sessions left this week · Recovery {recovery}%',{day:(bestOpt?.value||1),left,recovery})};
  },

  _updateModeDesc(mode){const desc=document.getElementById('prog-mode-desc');if(desc)desc.textContent=getForgeModeDesc(mode);},
  _previewSplit(freq,lifts){
    const prev=document.getElementById('prog-split-preview');if(!prev||!lifts)return;
    let html='';
    for(let d=1;d<=freq;d++){
      const exs=FORGE_INTERNAL.getDayExercises(d,freq,lifts);
      const names=exs.map(e=>e.isAux?'<span style="color:var(--purple)">'+escapeHtml(forgeExerciseName(e.name))+'</span>':'<strong>'+escapeHtml(forgeExerciseName(e.name))+'</strong>').join(' · ');
      html+=`<div style="margin-bottom:4px"><span style="color:var(--accent);font-weight:700">${trForge('program.forge.settings.day_num','Day {day}:',{day:d})}</span> ${names}</div>`;
    }
    html+='<div style="margin-top:6px;font-size:11px;color:var(--muted)">'+trForge('program.forge.settings.split_legend','<strong>Bold</strong> = main lift · <span style="color:var(--purple)">Purple</span> = auxiliary')+'</div>';
    prev.innerHTML=html;
  },

};

FORGE_PROGRAM.renderSimpleSettings=function(state,container){
  const freq=getForgeDaysPerWeek();
  const backWt=state.backWeight||0;
  _forgeSettingsDrafts.basic=createForgeSettingsDraft(state);
  const draft=_forgeSettingsDrafts.basic;
  const mainRows=draft.main.map((lift,idx)=>`
    <div style="margin-bottom:12px">
      ${renderForgePickerRow(
        trForge(FORGE_MAIN_SLOT_CONFIG[idx]?.labelKey,FORGE_MAIN_SLOT_CONFIG[idx]?.fallback||`Lift ${idx+1}`),
        lift.name,
        `window._forgePickMain('basic',${idx})`,
        trForge('program.forge.settings.library_hint','Library-backed selection with same-pattern suggestions first.'),
        `forge-basic-main-value-${idx}`
      )}
      <div class="lift-row" style="margin-top:6px">
        <span class="lift-label">${trForge('program.w531.settings.training_max','Training Max (kg)')}</span>
        <input type="number" id="forge-basic-main-tm-${idx}" value="${lift.tm}" min="0" step="0.1">
      </div>
    </div>
  `).join('');
  container.innerHTML=`
    <div class="program-settings-grid">
      <div class="settings-section-card">
        <div class="settings-section-title">${trForge('program.forge.simple.schedule','Weekly Rhythm')}</div>
        <div class="settings-section-sub">${trForge('program.forge.simple.overview','Set your core lifts here. Weekly frequency now comes from Training Preferences, and daily adjustments still follow the rest of your Training settings.')}</div>
        <div class="settings-row-note">${trForge('program.global_frequency_hint','Uses your Training preference: {value}.',{value:(typeof getTrainingDaysPerWeekLabel==='function'?getTrainingDaysPerWeekLabel(freq):freq+' sessions / week')})}</div>
      </div>
      <div class="settings-section-card">
        <div class="settings-section-title">${trForge('program.forge.simple.main_lifts','Main Lifts')}</div>
        <div class="settings-section-sub">${trForge('program.forge.simple.main_help','Pick the four core lifts and set a training max for each one.')}</div>
        <div class="settings-picker-stack">${mainRows}</div>
      </div>
      <div class="settings-section-card">
        <div class="settings-section-title">${trForge('program.forge.simple.back_work','Back Work')}</div>
        <div class="settings-section-sub">${trForge('program.forge.simple.back_help','This movement appears every session as your repeat back exercise.')}</div>
        ${renderForgePickerRow(
          trForge('program.forge.settings.back_exercise','Back Exercise (every session)'),
          draft.backExercise,
          `window._forgePickBack('basic')`,
          trForge('program.forge.settings.back_picker_hint','Recommended rows and pull variations are shown first.'),
          'forge-basic-back-value'
        )}
        <label style="margin-top:12px">${trForge('program.forge.settings.working_weight','Working Weight (kg)')}</label>
        <input type="number" id="forge-basic-back-weight" value="${backWt||''}" min="0" step="0.1" placeholder="e.g. 60">
      </div>
    </div>
  `;
};

FORGE_PROGRAM.getSimpleSettingsSummary=function(state){
  const freq=getForgeDaysPerWeek();
  const backEx=forgeExerciseName(state.backExercise||'Barbell Rows');
  return trForge('program.forge.simple.summary','{count} sessions / week · {back} every session',{count:freq,back:backEx});
};

FORGE_PROGRAM.renderSettings=function(state,container){
  const week=state.week||1;
  const mode=state.mode||'sets';
  const rounding=state.rounding||2.5;
  const freq=getForgeDaysPerWeek();
  const skipPeak=!!state.skipPeakBlock;
  _forgeSettingsDrafts.advanced=createForgeSettingsDraft(state);
  const draft=_forgeSettingsDrafts.advanced;
  const modeOpts=Object.entries(FORGE_INTERNAL.modes).map(([key])=>`<option value="${key}"${key===mode?' selected':''}>${getForgeModeName(key)} — ${getForgeModeDesc(key)}</option>`).join('');
  const roundOpts=[1,2.5,5].map(n=>`<option value="${n}"${n===rounding?' selected':''}>${n} kg</option>`).join('');
  const auxRows=draft.aux.map((lift,idx)=>`
    <div style="margin-bottom:12px">
      ${renderForgePickerRow(
        trForge(FORGE_AUX_LABELS[idx],FORGE_AUX_FALLBACKS[idx]||`Variant ${idx+1}`),
        lift.name,
        `window._forgePickAux('advanced',${idx})`,
        trForge('program.forge.settings.aux_picker_hint','Starts from the old Forge shortlist, but you can browse the full library.'),
        `forge-advanced-aux-value-${idx}`
      )}
      <div class="lift-row" style="margin-top:6px">
        <span class="lift-label">${trForge('program.w531.settings.training_max','Training Max (kg)')}</span>
        <input type="number" id="forge-advanced-aux-tm-${idx}" value="${lift.tm}" min="0" step="0.1">
      </div>
    </div>
  `).join('');
  const basicsSummary=draft.main.map((lift,idx)=>{
    const label=trForge(FORGE_MAIN_SLOT_CONFIG[idx]?.labelKey,FORGE_MAIN_SLOT_CONFIG[idx]?.fallback||`Lift ${idx+1}`);
    return `<div class="settings-row-note" style="margin-top:8px"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(forgeExerciseName(lift.name))} · ${escapeHtml(String(lift.tm||0))} kg</div>`;
  }).join('');
  const backSummary=`<div class="settings-row-note" style="margin-top:8px"><strong>${escapeHtml(trForge('program.forge.settings.back_exercise','Back Exercise (every session)'))}:</strong> ${escapeHtml(forgeExerciseName(state.backExercise||'Barbell Rows'))} · ${escapeHtml(String(state.backWeight||0))} kg</div>`;
  container.innerHTML=`
    <div class="program-settings-grid">
      <div class="settings-section-card">
        <div class="settings-section-title">${trForge('program.forge.settings.control_title','Cycle Controls')}</div>
        <div class="settings-section-sub">${trForge('program.forge.settings.overview','21-week strength cycle: Hypertrophy → Strength → Peaking.')}</div>
        <label>${trForge('program.forge.settings.mode','Program Mode')}</label>
        <select id="prog-mode" onchange="updateForgeModeSetting()">${modeOpts}</select>
        <div id="prog-mode-desc" class="settings-row-note"></div>
        <label style="margin-top:12px">${trForge('program.forge.settings.week','Current Week (1-21)')}</label>
        <div style="display:flex;gap:8px;align-items:center">
          <input type="number" id="prog-week" min="1" max="21" value="${week}" style="flex:1">
          <button class="btn btn-sm btn-secondary" type="button" onclick="document.getElementById('prog-week').value=1" style="width:auto">Reset</button>
        </div>
        <label style="margin-top:12px">${trForge('program.forge.settings.rounding','Weight Rounding (kg)')}</label>
        <select id="prog-rounding">${roundOpts}</select>
        <div class="settings-row-note">${trForge('program.global_frequency_hint','Uses your Training preference: {value}.',{value:(typeof getTrainingDaysPerWeekLabel==='function'?getTrainingDaysPerWeekLabel(freq):freq+' sessions / week')})}</div>
        <label style="margin-top:14px">${trForge('program.forge.settings.peak_title','Peak Block (Weeks 15–20)')} <span style="font-weight:400;color:var(--muted)">(${trForge('program.forge.settings.peak_optional','optional')})</span></label>
        <div class="settings-row-note">${trForge('program.forge.settings.peak_help','The highest-intensity phase. Skip it to loop back to Hypertrophy after the Strength deload — runs as a continuous 14-week cycle.')}</div>
        <input type="hidden" id="prog-skip-peak" value="${skipPeak?'1':'0'}">
        <button class="btn ${skipPeak?'btn-primary':'btn-secondary'}" id="forge-skip-peak-btn" type="button" onclick="window._forgeToggleSkipPeak()" style="width:100%;text-align:left;padding:10px 14px">
          ${skipPeak?trForge('program.forge.settings.skip_peak_on','🏃 Peak Block skipped — program loops to Hypertrophy after Strength'):trForge('program.forge.settings.skip_peak_off','🏔️ Skip Peak Block — loop back after Strength instead of peaking')}
        </button>
      </div>
      <div class="settings-section-card">
        <div class="settings-section-title">${trForge('program.forge.settings.basics_location_title','Program Basics')}</div>
        <div class="settings-section-sub">${trForge('program.forge.settings.basics_location_help','Main lifts, training maxes, and back work live in Program Basics so the day-to-day setup stays in one place.')}</div>
        ${basicsSummary}
        ${backSummary}
      </div>
      <div class="settings-section-card">
        <div class="settings-section-title">${trForge('program.forge.settings.aux_lifts','Auxiliary Lifts (Training Max in kg)')}</div>
        <div class="settings-section-sub">${trForge('program.forge.settings.aux_help','Choose the supporting variations you want Forge to rotate through during the week.')}</div>
        <div class="settings-picker-stack">${auxRows}</div>
      </div>
      <div class="settings-section-card">
        <div class="settings-section-title">${trForge('program.forge.settings.preview_title','Weekly Split Preview')}</div>
        <div class="settings-section-sub">${trForge('program.forge.settings.preview_help','Preview how Forge distributes your main and auxiliary work across the week.')}</div>
        <div id="prog-split-preview" style="margin-top:10px;font-size:12px;color:var(--muted);line-height:1.8"></div>
        <div class="settings-row-note" style="margin-top:10px">${trForge('program.forge.settings.terms','<strong>Terms:</strong> TM = Training Max. RIR = reps left before failure. AMRAP = as many reps as possible.')}</div>
      </div>
    </div>
    <div class="program-setup-actions">
      <button class="btn btn-purple program-setup-save-btn" type="button" onclick="saveProgramSetup()">${trForge('program.forge.save_setup','Save Program Setup')}</button>
    </div>
  `;
  this._updateModeDesc(mode);
  window._forgeRefreshAdvancedPreview();
};

FORGE_PROGRAM.saveSettings=function(state){
  const next=JSON.parse(JSON.stringify(state||this.getInitialState()));
  const draft=getForgeSettingsDraft('advanced',next);
  next.mode=document.getElementById('prog-mode')?.value||next.mode||'sets';
  next.week=parseInt(document.getElementById('prog-week')?.value,10)||next.week||1;
  next.rounding=parseFloat(document.getElementById('prog-rounding')?.value)||next.rounding||2.5;
  next.skipPeakBlock=document.getElementById('prog-skip-peak')?.value==='1';
  if(!next.lifts)next.lifts=this.getInitialState().lifts;
  next.lifts.aux=(next.lifts.aux||this.getInitialState().lifts.aux).map((lift,idx)=>({
    ...lift,
    name:resolveProgramExerciseName(draft.aux?.[idx]?.name||lift.name||''),
    tm:parseFloat(document.getElementById(`forge-advanced-aux-tm-${idx}`)?.value)||0
  }));
  return next;
};

FORGE_PROGRAM.saveSimpleSettings=function(state){
  const next=JSON.parse(JSON.stringify(state||this.getInitialState()));
  const draft=getForgeSettingsDraft('basic',next);
  if(!next.lifts)next.lifts=this.getInitialState().lifts;
  next.lifts.main=(next.lifts.main||this.getInitialState().lifts.main).map((lift,idx)=>({
    ...lift,
    name:resolveProgramExerciseName(draft.main?.[idx]?.name||lift.name||FORGE_MAIN_SLOT_CONFIG[idx]?.base||''),
    tm:parseFloat(document.getElementById(`forge-basic-main-tm-${idx}`)?.value)||0
  }));
  next.backExercise=resolveProgramExerciseName(draft.backExercise||next.backExercise||'Barbell Rows');
  next.backWeight=parseFloat(document.getElementById('forge-basic-back-weight')?.value)||0;
  return next;
};

window._forgePickMain=function(scope,slotIdx){
  const draft=getForgeSettingsDraft(scope,typeof getActiveProgramState==='function'?getActiveProgramState():FORGE_PROGRAM.getInitialState());
  const currentName=draft.main?.[slotIdx]?.name||'';
  const info=getForgeMainPickerInfo(slotIdx,currentName);
  openProgramExercisePicker({
    currentName,
    category:info.category,
    filters:info.filters,
    options:info.options,
    title:trForge('catalog.title.swap','Swap Exercise'),
    onSelect:(name)=>{
      draft.main[slotIdx].name=resolveProgramExerciseName(name);
      syncForgePickerDisplay(scope,'main',slotIdx);
    }
  });
};

window._forgePickAux=function(scope,slotIdx){
  const draft=getForgeSettingsDraft(scope,typeof getActiveProgramState==='function'?getActiveProgramState():FORGE_PROGRAM.getInitialState());
  const currentName=draft.aux?.[slotIdx]?.name||'';
  const info=getForgeAuxPickerInfo(slotIdx,currentName);
  openProgramExercisePicker({
    currentName,
    category:info.category,
    filters:info.filters,
    options:info.options,
    title:trForge('catalog.title.swap','Swap Exercise'),
    onSelect:(name)=>{
      draft.aux[slotIdx].name=resolveProgramExerciseName(name);
      syncForgePickerDisplay(scope,'aux',slotIdx);
    }
  });
};

window._forgePickBack=function(scope){
  const draft=getForgeSettingsDraft(scope,typeof getActiveProgramState==='function'?getActiveProgramState():FORGE_PROGRAM.getInitialState());
  const currentName=draft.backExercise||'';
  const info=getForgeBackPickerInfo(currentName);
  openProgramExercisePicker({
    currentName,
    category:info.category,
    filters:info.filters,
    options:info.options,
    title:trForge('workout.swap_back_title','Swap Back Exercise'),
    onSelect:(name)=>{
      draft.backExercise=resolveProgramExerciseName(name);
      syncForgePickerDisplay(scope,'back');
    }
  });
};

window._forgeRefreshAdvancedPreview=function(){
  const draft=getForgeSettingsDraft('advanced',typeof getActiveProgramState==='function'?getActiveProgramState():FORGE_PROGRAM.getInitialState());
  const freq=getForgeDaysPerWeek();
  FORGE_PROGRAM._previewSplit(freq,buildForgeLiftsFromDraft(draft));
};

// Peak block toggle button (called from rendered HTML)
window._forgeToggleSkipPeak=function(){
  const hidden=document.getElementById('prog-skip-peak');
  const btn=document.getElementById('forge-skip-peak-btn');
  if(!hidden||!btn)return;
  const next=hidden.value!=='1';
  hidden.value=next?'1':'0';
  btn.className='btn '+(next?'btn-primary':'btn-secondary');
  btn.style.cssText='width:100%;text-align:left;padding:10px 14px';
  btn.textContent=next
    ?trForge('program.forge.settings.skip_peak_on','🏃 Peak Block skipped — program loops to Hypertrophy after Strength')
    :trForge('program.forge.settings.skip_peak_off','🏔️ Skip Peak Block — loop back after Strength instead of peaking');
};

registerProgram(FORGE_PROGRAM);
})();
