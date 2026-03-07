// ── FORGE PROTOCOL PROGRAM ───────────────────────────────────────────────
// Registers itself with the PROGRAMS registry defined in app.js
(function(){
'use strict';

function trForge(key,fallback,params){
  if(window.I18N)return I18N.t(key,params,fallback);
  return fallback;
}

function forgeExerciseName(name){
  if(window.EXERCISE_LIBRARY&&EXERCISE_LIBRARY.getDisplayName)return EXERCISE_LIBRARY.getDisplayName(name);
  return name;
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
      const reps=data.repsOnLastSet||0,target=data.repOutTarget||10;
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
    return{week:1,dayNum:1,daysPerWeek:3,mode:'sets',rounding:2.5,skipPeakBlock:false,weekStartDate:new Date().toISOString(),backExercise:'Barbell Rows',backWeight:0,
      lifts:{main:[{name:'Squat',tm:100},{name:'Bench Press',tm:80},{name:'Deadlift',tm:120},{name:'OHP',tm:50}],
        aux:[{name:'Front Squat',tm:80},{name:'Pause Squat',tm:90},{name:'Close-Grip Bench',tm:70},{name:'Spoto Press',tm:75},{name:'Stiff Leg Deadlift',tm:100},{name:'Push Press',tm:50}]}};
  },

  getSessionOptions(state,workouts,schedule){
    const freq=state.daysPerWeek||3,week=state.week||1,lifts=state.lifts;
    const todayDow=new Date().getDay();
    const sportDays=schedule?.sportDays||schedule?.hockeyDays||[];
    const legsHeavy=schedule?.sportLegsHeavy!==false;
    const recentHours={easy:18,moderate:24,hard:30}[schedule?.sportIntensity||'hard'];
    const isSportDay=sportDays.includes(todayDow);
    const hadSportRecently=workouts.some(w=>(w.type==='sport'||w.type==='hockey')&&(Date.now()-new Date(w.date).getTime())/3600000<=recentHours);
    const sportLegs=(isSportDay||hadSportRecently)&&legsHeavy;
    const now=new Date(),sow=new Date(now);sow.setDate(now.getDate()-((now.getDay()+6)%7));sow.setHours(0,0,0,0);
    const doneThisWeek=workouts.filter(w=>(w.program==='forge'||(!w.program&&w.type==='forge'))&&new Date(w.date)>=sow).map(w=>w.programDayNum||w.forgeDayNum);
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

  buildSession(selectedOption,state){
    const dayNum=parseInt(selectedOption)||state.dayNum||1;
    const week=state.week||1,freq=state.daysPerWeek||3,rounding=state.rounding||2.5,mode=state.mode||'sets';
    const lifts=state.lifts;
    const isDeload=FORGE_INTERNAL.deloadWeeks.includes(week);
    const dayExercises=FORGE_INTERNAL.getDayExercises(dayNum,freq,lifts);
    const exercises=[];
    dayExercises.forEach(ex=>{
      const rx=FORGE_INTERNAL.getPrescription(ex.tm,week,ex.isAux,rounding,mode);
      let auxSlotIdx=-1;if(ex.isAux)auxSlotIdx=lifts.aux.findIndex(a=>a.name===ex.name);
      let sets;
      if(mode==='rtf'&&!isDeload){sets=Array.from({length:rx.normalSets},()=>({weight:rx.weight,reps:rx.reps,done:false,rpe:null}));sets.push({weight:rx.weight,reps:'AMRAP',done:false,rpe:null,isAmrap:true,repOutTarget:rx.repOutTarget});}
      else if(mode==='rir'&&!isDeload){sets=Array.from({length:rx.fixedSets},()=>({weight:rx.weight,reps:rx.reps,done:false,rpe:null}));}
      else{sets=Array.from({length:5},()=>({weight:rx.weight,reps:rx.reps,done:false,rpe:null}));}
      exercises.push({id:Date.now()+Math.random(),name:ex.name,note:rx.note||'',isAux:ex.isAux,tm:ex.tm,auxSlotIdx,prescribedWeight:rx.weight,prescribedReps:rx.reps,rirCutoff:rx.rir,isDeload:rx.isDeload,repOutTarget:rx.repOutTarget||0,sets});
    });
    const backEx=state.backExercise||'Barbell Rows',backWt=state.backWeight||0;
    exercises.push({id:Date.now()+Math.random(),name:backEx,note:backWt?trForge('program.forge.back.note_weight',backWt+'kg × 3 sets of 8-10 — hit 3×10 then increase weight',{weight:backWt}):trForge('program.forge.back.note_empty','Set a working weight in Settings for auto-fill'),isAux:false,isAccessory:true,tm:0,auxSlotIdx:-1,sets:[{weight:backWt||'',reps:8,done:false,rpe:null},{weight:backWt||'',reps:8,done:false,rpe:null},{weight:backWt||'',reps:8,done:false,rpe:null}]});
    return exercises;
  },

  getSessionLabel(selectedOption,state){
    const dayNum=parseInt(selectedOption)||1,week=state.week||1;
    const isDeload=FORGE_INTERNAL.deloadWeeks.includes(week),mode=state.mode||'sets';
    const modeTag=getForgeModeName(mode);
    return(isDeload?'🌊':'🏋️')+' '+trForge('program.forge.session_label','W{week} Day {day} · {block} [{mode}]',{week,day:dayNum,block:getForgeBlockName(FORGE_INTERNAL.blockNames[week]||''),mode:modeTag});
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

  adjustAfterSession(exercises,state){
    const newState=JSON.parse(JSON.stringify(state));
    const week=state.week||1,mode=state.mode||'sets';
    if(FORGE_INTERNAL.deloadWeeks.includes(week))return newState;
    exercises.forEach(ex=>{
      if(ex.isAccessory)return;
      const all=[...newState.lifts.main,...newState.lifts.aux];
      const match=all.find(l=>l.name===ex.name);if(!match)return;
      const doneSets=ex.sets.filter(s=>s.done).length;
      let adjustData;
      if(mode==='rtf'){const amrapSet=ex.sets.find(s=>s.isAmrap&&s.done);adjustData={repsOnLastSet:amrapSet?parseInt(amrapSet.reps)||0:0,repOutTarget:ex.repOutTarget||10};}
      else if(mode==='rir'){const lastDone=ex.sets.filter(s=>s.done).pop();const rir=lastDone?.rir!==undefined&&lastDone.rir!==''?parseInt(lastDone.rir):null;adjustData={setsCompleted:doneSets,lastSetRIR:rir};}
      else{adjustData=doneSets;}
      const oldTM=match.tm;match.tm=FORGE_INTERNAL.adjustTM(match.tm,adjustData,week,mode);
      if(match.tm!==oldTM)console.log('[Forge/'+mode+']',ex.name,'TM',match.tm>oldTM?'↑':'↓',oldTM,'→',match.tm);
    });
    return newState;
  },

  advanceState(state,sessionsThisWeek){
    const freq=state.daysPerWeek||3,week=state.week||1;
    if(sessionsThisWeek>=freq&&week<21){
      const next=week+1;
      // Skip peak block (weeks 15-20): jump back to week 1 after the strength deload
      if(state.skipPeakBlock&&next===15)return{...state,week:1,weekStartDate:new Date().toISOString()};
      return{...state,week:next,weekStartDate:new Date().toISOString()};
    }
    return state;
  },

  dateCatchUp(state){
    const week=state.week||1;if(week>=21)return state;
    const daysSince=(Date.now()-new Date(state.weekStartDate||Date.now()).getTime())/864e5;
    if(daysSince>=7){
      const elapsed=Math.floor(daysSince/7);
      let next=Math.min(21,week+elapsed);
      if(state.skipPeakBlock&&next>=15)next=1;
      return{...state,week:next,weekStartDate:new Date().toISOString()};
    }
    return state;
  },

  getAuxSwapOptions(exercise){
    if(exercise.auxSlotIdx<0)return null;
    const cat=FORGE_INTERNAL.getAuxCategory(exercise.auxSlotIdx);
    return{category:cat,options:FORGE_INTERNAL.auxOptions[cat]||[]};
  },
  getBackSwapOptions(){return FORGE_INTERNAL.auxOptions.back||[];},
  onAuxSwap(slotIdx,newName,state){const s=JSON.parse(JSON.stringify(state));if(s.lifts&&s.lifts.aux[slotIdx])s.lifts.aux[slotIdx].name=newName;return s;},
  onBackSwap(newName,state){return{...state,backExercise:newName};},

  getDashboardTMs(state){return(state.lifts?.main||[]).map(l=>({name:l.name,value:l.tm+'kg'}));},

  getBannerHTML(options,state,schedule,workouts,fatigue){
    const freq=state.daysPerWeek||3;
    const doneCount=options.filter(o=>o.done).length;
    const allDone=options.every(o=>o.done);
    const todayDow=new Date().getDay();
    const sportDays=schedule?.sportDays||schedule?.hockeyDays||[];
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

  renderSettings(state,container){
    const week=state.week||1,mode=state.mode||'sets',rounding=state.rounding||2.5,freq=state.daysPerWeek||3,skipPeak=!!state.skipPeakBlock;
    const backEx=state.backExercise||'Barbell Rows',backWt=state.backWeight||0;
    const lifts=state.lifts;
    const modeSelectLabel=Object.entries(FORGE_INTERNAL.modes).map(([k])=>`<option value="${k}"${k===mode?' selected':''}>${getForgeModeName(k)} — ${getForgeModeDesc(k)}</option>`).join('');
    const freqOpts=[2,3,4,5,6].map(n=>`<option value="${n}"${n===freq?' selected':''}>${n}×/week</option>`).join('');
    const roundOpts=[1,2.5,5].map(n=>`<option value="${n}"${n===rounding?' selected':''}>${n} kg</option>`).join('');
    const backOpts=FORGE_INTERNAL.auxOptions.back.map(o=>`<option value="${o}"${o===backEx?' selected':''}>${o}</option>`).join('');
    container.innerHTML=`
      <div style="font-size:13px;color:var(--muted);margin-bottom:12px">${trForge('program.forge.settings.overview','21-week strength cycle: Hypertrophy → Strength → Peaking.')}</div>
      <label>${trForge('program.forge.settings.mode','Program Mode')}</label>
      <select id="prog-mode" onchange="updateForgeModeSetting()">${modeSelectLabel}</select>
      <div id="prog-mode-desc" style="font-size:11px;color:var(--muted);margin-top:4px;margin-bottom:8px"></div>
      <label>${trForge('program.forge.settings.week','Current Week (1-21)')}</label>
      <div style="display:flex;gap:8px;align-items:center">
        <input type="number" id="prog-week" min="1" max="21" value="${week}" style="flex:1">
        <button class="btn btn-sm btn-secondary" onclick="document.getElementById('prog-week').value=1" style="width:auto">Reset</button>
      </div>

      <label style="margin-top:14px">${trForge('program.forge.settings.peak_title','Peak Block (Weeks 15–20)')} <span style="font-weight:400;color:var(--muted)">(${trForge('program.forge.settings.peak_optional','optional')})</span></label>
      <div style="font-size:11px;color:var(--muted);margin-bottom:8px">
        ${trForge('program.forge.settings.peak_help','The highest-intensity phase. Skip it to loop back to Hypertrophy after the Strength deload — runs as a continuous 14-week cycle.')}
      </div>
      <input type="hidden" id="prog-skip-peak" value="${skipPeak?'1':'0'}">
      <button class="btn ${skipPeak?'btn-primary':'btn-secondary'}" id="forge-skip-peak-btn"
        onclick="window._forgeToggleSkipPeak()"
        style="width:100%;text-align:left;padding:10px 14px">
        ${skipPeak?trForge('program.forge.settings.skip_peak_on','🏃 Peak Block skipped — program loops to Hypertrophy after Strength'):trForge('program.forge.settings.skip_peak_off','🏔️ Skip Peak Block — loop back after Strength instead of peaking')}
      </button>

      <label style="margin-top:12px">${trForge('program.forge.settings.rounding','Weight Rounding (kg)')}</label>
      <select id="prog-rounding">${roundOpts}</select>
      <label style="margin-top:12px">${trForge('program.forge.settings.sessions_pw','Sessions Per Week')}</label>
      <select id="prog-days" onchange="previewProgramSplit()">${freqOpts}</select>
      <div id="prog-split-preview" style="margin-top:10px;font-size:12px;color:var(--muted);line-height:1.8"></div>
      <div style="font-size:11px;color:var(--muted);margin-top:10px;padding:8px 10px;background:rgba(255,255,255,0.03);border-radius:6px;line-height:1.5">
        ${trForge('program.forge.settings.terms','<strong>Terms:</strong> TM = Training Max. RIR = reps left before failure. AMRAP = as many reps as possible.')}
      </div>
      <div class="divider-label" style="margin-top:18px"><span>${trForge('program.forge.settings.main_lifts','Main Lifts (Training Max in kg)')}</span></div>
      <div id="prog-main-lifts"></div>
      <div class="divider-label" style="margin-top:14px"><span>${trForge('program.forge.settings.aux_lifts','Auxiliary Lifts (Training Max in kg)')}</span></div>
      <div id="prog-aux-lifts"></div>
      <div class="divider-label" style="margin-top:14px"><span>${trForge('program.forge.settings.back_exercise','Back Exercise (every session)')}</span></div>
      <select id="prog-back-exercise" style="margin-bottom:8px">${backOpts}</select>
      <label>${trForge('program.forge.settings.working_weight','Working Weight (kg)')}</label>
      <div style="display:flex;align-items:center;gap:8px">
        <input type="number" id="prog-back-weight" value="${backWt||''}" placeholder="e.g. 60" style="flex:1">
        <span style="font-size:11px;color:var(--muted);flex:1">${trForge('program.forge.settings.back_prog','3×8 → 3×10, then increase')}</span>
      </div>
      <button class="btn btn-purple" style="margin-top:16px" onclick="saveProgramSetup()">${trForge('program.forge.save_setup','Save Program Setup')}</button>
    `;
    this._renderMainLifts(lifts);this._renderAuxLifts(lifts);this._updateModeDesc(mode);this._previewSplit(freq,lifts);
  },

  _renderMainLifts(lifts){
    const mc=document.getElementById('prog-main-lifts');if(!mc||!lifts)return;mc.innerHTML='';
    const labels=[trForge('program.forge.lift.sq','Squat (SQ)'),trForge('program.forge.lift.bp','Bench Press (BP)'),trForge('program.forge.lift.dl','Deadlift (DL)'),trForge('program.forge.lift.ohp','Overhead Press (OHP)')];
    lifts.main.forEach((l,i)=>{mc.innerHTML+=`<div class="lift-row"><span class="lift-label">${labels[i]||'#'+(i+1)}</span><input type="text" value="${l.name}" onchange="updateProgramLift('main',${i},'name',this.value)" style="flex:1"><input type="number" value="${l.tm}" onchange="updateProgramLift('main',${i},'tm',parseFloat(this.value)||0)"></div>`;});
  },
  _renderAuxLifts(lifts){
    const ac=document.getElementById('prog-aux-lifts');if(!ac||!lifts)return;ac.innerHTML='';
    const auxLabels=[trForge('program.forge.lift.sq1','Squat Variant 1 (SQ-1)'),trForge('program.forge.lift.sq2','Squat Variant 2 (SQ-2)'),trForge('program.forge.lift.bp1','Bench Variant 1 (BP-1)'),trForge('program.forge.lift.bp2','Bench Variant 2 (BP-2)'),trForge('program.forge.lift.dlv','Deadlift Variant (DL)'),trForge('program.forge.lift.ohpv','Overhead Press Variant (OHP)')];const cats=['squat','squat','bench','bench','deadlift','ohp'];
    lifts.aux.forEach((l,i)=>{
      const cat=cats[i]||'squat',opts=FORGE_INTERNAL.auxOptions[cat]||[];
      let sel=`<select onchange="updateProgramLift('aux',${i},'name',this.value)" style="flex:1;font-size:13px">`;
      opts.forEach(o=>{sel+=`<option value="${o}"${o===l.name?' selected':''}>${o}</option>`;});
      if(!opts.includes(l.name))sel+=`<option value="${l.name}" selected>${l.name}</option>`;
      sel+='</select>';
      ac.innerHTML+=`<div class="lift-row"><span class="lift-label">${auxLabels[i]||'A'+(i+1)}</span>${sel}<input type="number" value="${l.tm}" onchange="updateProgramLift('aux',${i},'tm',parseFloat(this.value)||0)"></div>`;
    });
  },
  _updateModeDesc(mode){const desc=document.getElementById('prog-mode-desc');if(desc)desc.textContent=getForgeModeDesc(mode);},
  _previewSplit(freq,lifts){
    const prev=document.getElementById('prog-split-preview');if(!prev||!lifts)return;
    let html='';
    for(let d=1;d<=freq;d++){
      const exs=FORGE_INTERNAL.getDayExercises(d,freq,lifts);
      const names=exs.map(e=>e.isAux?'<span style="color:var(--purple)">'+e.name+'</span>':'<strong>'+e.name+'</strong>').join(' · ');
      html+=`<div style="margin-bottom:4px"><span style="color:var(--accent);font-weight:700">${trForge('program.forge.settings.day_num','Day {day}:',{day:d})}</span> ${names}</div>`;
    }
    html+='<div style="margin-top:6px;font-size:11px;color:var(--muted)">'+trForge('program.forge.settings.split_legend','<strong>Bold</strong> = main lift · <span style="color:var(--purple)">Purple</span> = auxiliary')+'</div>';
    prev.innerHTML=html;
  },

  saveSettings(state){
    const mode=document.getElementById('prog-mode')?.value||'sets';
    const week=parseInt(document.getElementById('prog-week')?.value)||1;
    const rounding=parseFloat(document.getElementById('prog-rounding')?.value)||2.5;
    const daysPerWeek=parseInt(document.getElementById('prog-days')?.value)||3;
    const skipPeakBlock=document.getElementById('prog-skip-peak')?.value==='1';
    const backExercise=document.getElementById('prog-back-exercise')?.value||'Barbell Rows';
    const backWeight=parseFloat(document.getElementById('prog-back-weight')?.value)||0;
    return{...state,mode,week,rounding,daysPerWeek,dayNum:1,skipPeakBlock,backExercise,backWeight};
  }
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
