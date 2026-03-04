// ── 5/3/1 (WENDLER) PROGRAM ──────────────────────────────────────────────
(function(){
'use strict';

const WENDLER_531={
  id:'wendler531',
  name:'5/3/1 (Wendler)',
  description:'4-week cycles with AMRAP sets. Classic powerlifting progression for intermediate athletes.',
  icon:'💪',
  legLifts:['squat','deadlift'],

  // Week schemes: pcts are of TM, reps = set targets, last set is AMRAP unless isDeload
  _scheme:{
    1:{pcts:[0.65,0.75,0.85],reps:[5,5,5],label:'5s Week',isDeload:false},
    2:{pcts:[0.70,0.80,0.90],reps:[3,3,3],label:'3s Week',isDeload:false},
    3:{pcts:[0.75,0.85,0.95],reps:[5,3,1],label:'1+ Week',isDeload:false},
    4:{pcts:[0.40,0.50,0.60],reps:[5,5,5],label:'Deload',isDeload:true}
  },

  getInitialState(){
    return{week:1,cycle:1,daysPerWeek:4,rounding:2.5,
      lifts:{main:[{name:'Squat',tm:100,category:'legs'},{name:'Bench Press',tm:80,category:'upper'},{name:'Deadlift',tm:120,category:'legs'},{name:'OHP',tm:50,category:'upper'}]}};
  },

  getSessionOptions(state,workouts){
    const week=state.week||1,lifts=state.lifts.main;
    const now=new Date(),sow=new Date(now);sow.setDate(now.getDate()-((now.getDay()+6)%7));sow.setHours(0,0,0,0);
    const doneThisWeek=workouts.filter(w=>w.program==='wendler531'&&new Date(w.date)>=sow).map(w=>w.programDayNum);
    const scheme=this._scheme[week]||this._scheme[1];
    return lifts.map((l,i)=>{
      const done=doneThisWeek.includes(i+1);
      const isNext=!done&&doneThisWeek.length===i;
      const pct=Math.round(scheme.pcts[2]*100);
      const repLabel=scheme.reps[2]+(scheme.isDeload?'':'+');
      return{value:String(i+1),label:(done?'✅ ':(isNext?'⭐ ':'')+l.name+' · '+pct+'%×'+repLabel),isRecommended:isNext&&!done,done};
    });
  },

  buildSession(selectedOption,state){
    const dayNum=parseInt(selectedOption)||1,liftIdx=dayNum-1;
    const week=state.week||1,rounding=state.rounding||2.5;
    const lift=state.lifts.main[liftIdx];if(!lift)return[];
    const scheme=this._scheme[week]||this._scheme[1];
    const sets=scheme.pcts.map((pct,i)=>{
      const weight=Math.round(lift.tm*pct/rounding)*rounding;
      const reps=scheme.reps[i],isLast=i===scheme.pcts.length-1;
      if(isLast&&!scheme.isDeload)return{weight,reps:'AMRAP',done:false,rpe:null,isAmrap:true,repOutTarget:reps};
      return{weight,reps,done:false,rpe:null};
    });
    const pctStr=scheme.pcts.map(p=>Math.round(p*100)+'%').join('/');
    const repStr=scheme.reps.join('/')+(scheme.isDeload?'':'+ AMRAP');
    return[{id:Date.now()+Math.random(),name:lift.name,note:(scheme.isDeload?'Deload — ':'')+lift.tm+'kg TM · '+pctStr+' · '+repStr,isAux:false,tm:lift.tm,auxSlotIdx:-1,liftIdx,sets}];
  },

  getSessionLabel(selectedOption,state){
    const dayNum=parseInt(selectedOption)||1,liftIdx=dayNum-1;
    const week=state.week||1,cycle=state.cycle||1;
    const scheme=this._scheme[week]||this._scheme[1];
    const lift=state.lifts.main[liftIdx];
    return(scheme.isDeload?'🌊':'💪')+' C'+cycle+' W'+week+' · '+(lift?.name||'')+' ['+scheme.label+']';
  },

  getBlockInfo(state){
    const week=state.week||1,cycle=state.cycle||1;
    const scheme=this._scheme[week]||this._scheme[1];
    return{name:scheme.label,weekLabel:'Cycle '+cycle+' · Week '+week,pct:null,isDeload:!!scheme.isDeload,totalWeeks:null};
  },

  adjustAfterSession(exercises,state){
    return state; // TM advances per-cycle in advanceState, not per-session
  },

  advanceState(state,sessionsThisWeek){
    const freq=state.daysPerWeek||4,week=state.week||1,cycle=state.cycle||1;
    if(sessionsThisWeek>=freq){
      if(week>=4){
        // Cycle complete — add standard increments and reset
        const newState=JSON.parse(JSON.stringify(state));
        newState.lifts.main.forEach(l=>{l.tm=Math.round((l.tm+(l.category==='legs'?5:2.5))*10)/10;});
        newState.week=1;newState.cycle=cycle+1;
        return newState;
      }
      return{...state,week:week+1};
    }
    return state;
  },

  dateCatchUp:null, // 5/3/1 advances by sessions, not calendar weeks

  getAuxSwapOptions(){return null;},
  getBackSwapOptions(){return[];},
  onAuxSwap(si,n,s){return s;},
  onBackSwap(n,s){return s;},

  getDashboardTMs(state){return(state.lifts?.main||[]).map(l=>({name:l.name,value:l.tm+'kg'}));},

  getBannerHTML(options,state,schedule,workouts){
    const bestOpt=options.find(o=>o.isRecommended)||options[0];
    const week=state.week||1,cycle=state.cycle||1;
    const scheme=this._scheme[week]||this._scheme[1];
    const doneCount=options.filter(o=>o.done).length,left=options.length-doneCount;
    if(doneCount>=options.length){
      const willCycleEnd=week>=4;
      return{style:'rgba(34,197,94,0.1)',border:'rgba(34,197,94,0.25)',color:'var(--green)',html:'✅ Week '+week+' done!'+(willCycleEnd?' Cycle '+(cycle+1)+' starts next — TMs go up!':' '+scheme.label+' complete. Week '+(week+1)+' up next.')};
    }
    // Hockey awareness: warn if next recommended lift is legs on hockey/post-hockey day
    const todayDow=new Date().getDay();
    const isHockeyDay=schedule&&schedule.hockeyDays.includes(todayDow);
    const hadHockeyRecently=workouts&&workouts.some(w=>w.type==='hockey'&&(Date.now()-new Date(w.date).getTime())/3600000<=30);
    if((isHockeyDay||hadHockeyRecently)&&bestOpt){
      const lift=state.lifts?.main?.[parseInt(bestOpt.value)-1];
      if(lift?.category==='legs'){
        const upperOpt=options.find(o=>!o.done&&state.lifts?.main?.[parseInt(o.value)-1]?.category==='upper');
        return{style:'rgba(59,130,246,0.1)',border:'rgba(59,130,246,0.25)',color:'var(--blue)',
          html:'🏒 '+(isHockeyDay?'Hockey day':'Post-hockey')+' — next up is <strong>'+lift.name+'</strong>. '+(upperOpt?'Consider <strong>'+state.lifts.main[parseInt(upperOpt.value)-1].name+'</strong> instead.':'Go lighter or rest today.')};
      }
    }
    return{style:'rgba(167,139,250,0.08)',border:'rgba(167,139,250,0.15)',color:'var(--purple)',html:'💪 '+(bestOpt?'Next: <strong>'+bestOpt.label+'</strong>':'Start your session')+' · '+left+' session'+(left!==1?'s':'')+' left this week'};
  },

  renderSettings(state,container){
    const week=state.week||1,cycle=state.cycle||1,rounding=state.rounding||2.5,freq=state.daysPerWeek||4;
    const lifts=state.lifts.main;
    const freqOpts=[3,4].map(n=>`<option value="${n}"${n===freq?' selected':''}>${n===3?'3×/week (rotating)':'4×/week (one lift/day)'}</option>`).join('');
    const roundOpts=[1,2.5,5].map(n=>`<option value="${n}"${n===rounding?' selected':''}>${n} kg</option>`).join('');
    const liftRows=lifts.map((l,i)=>`<div class="lift-row"><span class="lift-label">${['SQ','BP','DL','OHP'][i]||'#'+(i+1)}</span><span style="flex:1;font-size:13px;padding:4px 0;color:var(--text)">${l.name}</span><input type="number" value="${l.tm}" onchange="updateProgramLift('main',${i},'tm',parseFloat(this.value)||0)"></div>`).join('');
    container.innerHTML=`
      <div style="font-size:12px;color:var(--muted);margin-bottom:12px;background:rgba(167,139,250,0.08);padding:8px 12px;border-radius:8px">4-week cycles · AMRAP last set · +5kg lower / +2.5kg upper per cycle</div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:10px">Currently: Cycle ${cycle} · Week ${week} of 4</div>
      <label>Sessions Per Week</label>
      <select id="prog-days">${freqOpts}</select>
      <label style="margin-top:12px">Weight Rounding (kg)</label>
      <select id="prog-rounding">${roundOpts}</select>
      <label style="margin-top:12px">Current Week in Cycle (1-4)</label>
      <div style="display:flex;gap:8px;align-items:center">
        <input type="number" id="prog-week" min="1" max="4" value="${week}" style="flex:1">
        <button class="btn btn-sm btn-secondary" onclick="document.getElementById('prog-week').value=1" style="width:auto">Reset</button>
      </div>
      <div class="divider-label" style="margin-top:18px"><span>Training Maxes (kg)</span></div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:8px">Enter ~90% of your 1RM. Increments applied automatically each cycle.</div>
      ${liftRows}
      <button class="btn btn-purple" style="margin-top:16px" onclick="saveProgramSetup()">Save Program Setup</button>
    `;
  },

  saveSettings(state){
    const week=parseInt(document.getElementById('prog-week')?.value)||1;
    const rounding=parseFloat(document.getElementById('prog-rounding')?.value)||2.5;
    const daysPerWeek=parseInt(document.getElementById('prog-days')?.value)||4;
    return{...state,week,rounding,daysPerWeek};
  }
};

registerProgram(WENDLER_531);
})();
