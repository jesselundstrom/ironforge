// ── STRONGLIFTS 5×5 PROGRAM ──────────────────────────────────────────────
(function(){
'use strict';

function trSL(key,fallback,params){
  if(window.I18N)return I18N.t(key,params,fallback);
  return fallback;
}

const STRONGLIFTS_5X5={
  id:'stronglifts5x5',
  name:trSL('program.sl.name','StrongLifts 5x5'),
  description:trSL('program.sl.description','Beginner strength program with steady weight increases.'),
  icon:'📈',
  legLifts:['squat','deadlift'],

  _names:{squat:'Squat',bench:'Bench Press',row:'Barbell Row',ohp:'Overhead Press (OHP)',deadlift:'Deadlift'},
  _incrm:{squat:2.5,bench:2.5,row:2.5,ohp:2.5,deadlift:5},
  _workoutA:['squat','bench','row'],
  _workoutB:['squat','ohp','deadlift'],

  getInitialState(){
    return{sessionCount:0,nextWorkout:'A',rounding:2.5,
      lifts:{squat:{weight:60,failures:0},bench:{weight:50,failures:0},row:{weight:50,failures:0},ohp:{weight:40,failures:0},deadlift:{weight:80,failures:0}}};
  },

  getSessionOptions(state){
    const next=state.nextWorkout||'A',other=next==='A'?'B':'A';
    const mkLabel=wk=>(wk==='A'?this._workoutA:this._workoutB).map(k=>this._names[k]).join(' + ');
    return[
      {value:next,label:'⭐ '+trSL('program.sl.workout','Workout')+' '+next+': '+mkLabel(next),isRecommended:true,done:false},
      {value:other,label:trSL('program.sl.workout','Workout')+' '+other+': '+mkLabel(other),isRecommended:false,done:false}
    ];
  },

  buildSession(selectedOption,state){
    const wk=selectedOption==='B'?'B':'A';
    const keys=wk==='A'?this._workoutA:this._workoutB;
    const rounding=state.rounding||2.5;
    return keys.map(key=>{
      const ls=state.lifts[key]||{weight:60,failures:0};
      const weight=Math.round(ls.weight/rounding)*rounding;
      const isDeadlift=key==='deadlift';
      const setCount=isDeadlift?1:5;
      const sets=Array.from({length:setCount},()=>({weight,reps:5,done:false,rpe:null}));
      return{id:Date.now()+Math.random(),name:this._names[key],liftKey:key,note:weight+'kg × '+(isDeadlift?'1×5':'5×5'),isAux:false,tm:weight,auxSlotIdx:-1,sets};
    });
  },

  getSessionLabel(selectedOption,state){
    const wk=selectedOption==='B'?'B':'A';
    return'📈 '+trSL('program.sl.workout','Workout')+' '+wk+' · '+trSL('common.session','Session')+' '+((state.sessionCount||0)+1);
  },

  getBlockInfo(state){
    return{name:trSL('program.sl.linear_progression','Linear Progression'),weekLabel:trSL('common.session','Session')+' '+(state.sessionCount||0),pct:null,isDeload:false,totalWeeks:null};
  },

  // adjustAfterSession: updates lift weights based on session performance.
  // Called BEFORE advanceState so state.nextWorkout still reflects the workout just done.
  adjustAfterSession(exercises,state,programOption){
    const newState=JSON.parse(JSON.stringify(state));
    const wk=programOption==='B'?'B':'A';
    const keys=wk==='A'?this._workoutA:this._workoutB;
    const rounding=state.rounding||2.5;
    keys.forEach(key=>{
      const ex=exercises.find(e=>e.liftKey===key);
      if(!ex)return;
      const ls=newState.lifts[key]||{weight:60,failures:0};
      const allDone=ex.sets.length>0&&ex.sets.every(s=>s.done&&(parseInt(s.reps)||0)>=5);
      const incr=this._incrm[key]||2.5;
      if(allDone){ls.weight=Math.round((ls.weight+incr)*10)/10;ls.failures=0;}
      else{
        ls.failures=(ls.failures||0)+1;
        if(ls.failures>=3){ls.weight=Math.round(ls.weight*0.9/rounding)*rounding;ls.failures=0;
          console.log('[SL5x5] '+key+' deload to '+ls.weight+'kg after 3 failures');}
      }
    });
    return newState;
  },

  advanceState(state){
    const next=state.nextWorkout==='A'?'B':'A';
    return{...state,nextWorkout:next,sessionCount:(state.sessionCount||0)+1};
  },

  dateCatchUp:null,
  getAuxSwapOptions(){return null;},
  getBackSwapOptions(){return[];},
  onAuxSwap(si,n,s){return s;},
  onBackSwap(n,s){return s;},

  getDashboardTMs(state){
    const l=state.lifts||{};
    return[{name:'Squat',value:(l.squat?.weight||0)+'kg'},{name:'Bench',value:(l.bench?.weight||0)+'kg'},{name:'Deadlift',value:(l.deadlift?.weight||0)+'kg'},{name:'OHP',value:(l.ohp?.weight||0)+'kg'}];
  },

  getBannerHTML(options,state,schedule,workouts){
    const next=state.nextWorkout||'A',sc=state.sessionCount||0;
    const lifts=state.lifts||{};
    const sqWt=(lifts.squat?.weight||0)+'kg';
    // Sport awareness: both A and B include Squat (leg-heavy)
    const todayDow=new Date().getDay();
    const sportDays=schedule?.sportDays||schedule?.hockeyDays||[];
    const legsHeavy=schedule?.sportLegsHeavy!==false;
    const recentHours={easy:18,moderate:24,hard:30}[schedule?.sportIntensity||'hard'];
    const sportName=schedule?.sportName||trSL('common.sport','Sport');
    const isSportDay=schedule&&sportDays.includes(todayDow);
    const hadSportRecently=workouts&&workouts.some(w=>(w.type==='sport'||w.type==='hockey')&&(Date.now()-new Date(w.date).getTime())/3600000<=recentHours);
    if((isSportDay||hadSportRecently)&&legsHeavy){
      const sportLabel=isSportDay
        ? trSL('dashboard.status.sport_day','{sport} day',{sport:sportName})
        : trSL('dashboard.post_sport','Post-{sport}',{sport:sportName.toLowerCase()});
      return{style:'rgba(59,130,246,0.1)',border:'rgba(59,130,246,0.25)',color:'var(--blue)',
        html:'🏃 '+sportLabel+' — '+trSL('program.sl.banner_sport_warning','Both workouts include Squat. Consider going lighter or resting today.')};
    }
    return{style:'rgba(167,139,250,0.08)',border:'rgba(167,139,250,0.15)',color:'var(--purple)',html:'📈 '+trSL('common.session','Session')+' '+(sc+1)+' · <strong>'+trSL('program.sl.workout','Workout')+' '+next+'</strong> '+trSL('program.sl.is_next','is next')+' · '+trSL('program.sl.squat','Squat')+': '+sqWt};
  },

  renderSettings(state,container){
    const rounding=state.rounding||2.5,next=state.nextWorkout||'A',sc=state.sessionCount||0;
    const lifts=state.lifts||{};
    const roundOpts=[1,2.5,5].map(n=>`<option value="${n}"${n===rounding?' selected':''}>${n} kg</option>`).join('');
    const liftRows=Object.entries(this._names).map(([key,name])=>{
      const l=lifts[key]||{weight:60,failures:0};
      return`<div class="lift-row"><span class="lift-label" style="min-width:80px">${name}</span><input type="number" value="${l.weight}" onchange="updateSLLift('${key}',parseFloat(this.value)||0)" style="flex:1"><span style="font-size:11px;color:var(--muted);margin-left:8px;white-space:nowrap">${trSL('program.sl.failed_sessions','failed sessions')}: ${l.failures||0}</span></div>`;
    }).join('');
    container.innerHTML=`
      <div style="font-size:12px;color:var(--muted);margin-bottom:12px;background:rgba(167,139,250,0.08);padding:8px 12px;border-radius:8px">${trSL('program.sl.split_overview','A: Squat+Bench+Row · B: Squat+Overhead Press+Deadlift · alternating 3 sessions/week')}</div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:10px">${trSL('program.sl.session_completed_next','Session {count} completed · Next: Workout {workout}',{count:sc,workout:next})}</div>
      <label>${trSL('program.sl.weight_rounding','Weight Rounding (kg)')}</label>
      <select id="prog-rounding">${roundOpts}</select>
      <div class="divider-label" style="margin-top:18px"><span>${trSL('program.sl.working_weights','Working Weights (kg)')}</span></div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:8px">${trSL('program.sl.progression_help','Add +2.5kg (+5kg deadlift) after successful sessions. 3 failed sessions trigger a 10% deload.')}</div>
      ${liftRows}
      <label style="margin-top:14px">${trSL('program.sl.next_workout','Next Workout')}</label>
      <div style="display:flex;gap:8px;margin-top:6px">
        <button class="btn btn-sm ${next==='A'?'btn-primary':'btn-secondary'}" onclick="setSLNextWorkout('A')">${trSL('program.sl.workout_a','Workout A')}</button>
        <button class="btn btn-sm ${next==='B'?'btn-primary':'btn-secondary'}" onclick="setSLNextWorkout('B')">${trSL('program.sl.workout_b','Workout B')}</button>
      </div>
      <button class="btn btn-purple" style="margin-top:16px" onclick="saveProgramSetup()">${trSL('program.sl.save_setup','Save Program Setup')}</button>
    `;
  },

  saveSettings(state){
    const rounding=parseFloat(document.getElementById('prog-rounding')?.value)||2.5;
    return{...state,rounding};
  }
};

registerProgram(STRONGLIFTS_5X5);
})();
