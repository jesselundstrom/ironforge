function isSportWorkout(w){return w.type==='sport'||w.type==='hockey';}
let _lastTmSignature='';
function trDash(key,fallback,params){
  if(window.I18N)return I18N.t(key,params,fallback);
  return fallback;
}
function dashExerciseName(name){
  if(window.EXERCISE_LIBRARY&&EXERCISE_LIBRARY.getDisplayName)return EXERCISE_LIBRARY.getDisplayName(name);
  return name;
}
function computeFatigue(){
  const now=Date.now();
  const liftS=workouts.filter(w=>!isSportWorkout(w)).sort((a,b)=>new Date(b.date)-new Date(a.date));
  const sportS=workouts.filter(w=>isSportWorkout(w)).sort((a,b)=>new Date(b.date)-new Date(a.date));
  const daysSinceLift=liftS.length?(now-new Date(liftS[0].date).getTime())/864e5:99;
  const daysSinceSport=sportS.length?(now-new Date(sportS[0].date).getTime())/864e5:99;
  const last72h=workouts.filter(w=>now-new Date(w.date).getTime()<3*864e5);
  let recentSets=0,recentRPE=0,rpeCount=0;
  last72h.forEach(w=>{
    if(!isSportWorkout(w))w.exercises?.forEach(e=>recentSets+=e.sets.length);
    if(w.rpe){recentRPE+=w.rpe;rpeCount++;}
  });
  const avgRecentRPE=rpeCount?recentRPE/rpeCount:7;
  const recentHasSport=last72h.some(w=>isSportWorkout(w));
  const sc=getSportConfig();
  const cfg=FATIGUE_CONFIG;
  let muscular=Math.max(0,cfg.muscularBase-daysSinceLift*cfg.muscularDecay)+Math.min(30,recentSets*cfg.setsWeight)+(recentHasSport?sc.muscularBonus:0);
  let cns=Math.max(0,cfg.cnsBase-daysSinceLift*cfg.cnsDecay)+(avgRecentRPE-5)*cfg.rpeWeight+(recentHasSport?sc.cnsBonus:0);
  const extraToday=last72h.filter(w=>isSportWorkout(w)&&w.subtype==='extra').length;
  cns+=extraToday*sc.extraCns;
  muscular=Math.min(100,Math.max(0,muscular));cns=Math.min(100,Math.max(0,cns));
  return{muscular:Math.round(muscular),cns:Math.round(cns),overall:Math.round(muscular*.5+cns*.5),daysSinceLift,daysSinceSport,recentSets,avgRecentRPE};
}
function wasSportRecently(hours){
  const sc=getSportConfig();
  hours=hours||sc.recentHours;
  return workouts.some(w=>isSportWorkout(w)&&(Date.now()-new Date(w.date).getTime())<hours*3600000);
}
// Backward-compat alias used by program files
function wasHockeyRecently(hours){return wasSportRecently(hours);}
function getRecoveryColor(r){return r>=85?'var(--green)':r>=60?'var(--orange)':'var(--accent)';}
function getRecoveryGradient(r){
  if(r>=85)return{start:'#2eddb1',mid:'#7cf2d6',end:'#119b79',glow:'rgba(46,221,177,0.48)'};
  if(r>=60)return{start:'#ffd166',mid:'#ffc24a',end:'#f08a22',glow:'rgba(255,185,78,0.44)'};
  return{start:'#ff9b76',mid:'#ff7a5c',end:'#ff5a44',glow:'rgba(255,106,84,0.42)'};
}
function getReadinessLabel(o){
  const r=100-o;
  if(r>=75)return{label:trDash('dashboard.fully_recovered','Fully Recovered'),color:'var(--green)'};
  if(r>=50)return{label:trDash('dashboard.mostly_recovered','Mostly Recovered'),color:'var(--orange)'};
  if(r>=30)return{label:trDash('dashboard.partially_fatigued','Partially Fatigued'),color:'var(--orange)'};
  return{label:trDash('dashboard.high_fatigue','High Fatigue'),color:'var(--accent)'};
}
function updateFatigueBars(f){
  ['muscular','cns','overall'].forEach(k=>{
    const el=document.getElementById('f-'+k),vEl=document.getElementById('f-'+k+'-val');
    const recovery=100-f[k];
    if(el){
      const bars=getRecoveryGradient(recovery);
      el.style.width=recovery+'%';
      el.style.setProperty('--bar-start',bars.start);
      el.style.setProperty('--bar-mid',bars.mid);
      el.style.setProperty('--bar-end',bars.end);
      el.style.setProperty('--bar-glow',bars.glow);
    }
    if(vEl)vEl.textContent=recovery+'%';
  });
  const overallRec=100-f.overall;
  let badgeText,badgeCls;
  if(overallRec>=85){badgeText=trDash('dashboard.badge.go','GO');badgeCls='rbadge-go';}
  else if(overallRec>=60){badgeText=trDash('dashboard.badge.caution','CAUTION');badgeCls='rbadge-caution';}
  else{badgeText=trDash('dashboard.badge.rest','REST');badgeCls='rbadge-rest';}
  const badgeEl=document.getElementById('recovery-badge');
  if(badgeEl)badgeEl.innerHTML=`<span class="readiness-badge ${badgeCls}">${badgeText}</span>`;
}

// DATA HELPERS
function exerciseLookupKeys(exercise){
  if(!exercise)return[];
  const src=typeof exercise==='string'?{name:exercise}:exercise;
  const keys=[];
  const id=src.exerciseId||(window.EXERCISE_LIBRARY&&EXERCISE_LIBRARY.resolveExerciseId?EXERCISE_LIBRARY.resolveExerciseId(src.name):null);
  if(id)keys.push('id:'+id);
  if(src.name)keys.push('name:'+String(src.name).trim().toLowerCase());
  return keys;
}
function buildExerciseIndex(){
  exerciseIndex={};
  workouts.forEach(w=>{
    w.exercises?.forEach(e=>{
      const ts=new Date(w.date).getTime();
      exerciseLookupKeys(e).forEach(key=>{
        const prev=exerciseIndex[key];
        if(!prev||ts>prev.ts)exerciseIndex[key]={sets:e.sets,date:w.date,ts};
      });
    });
  });
}
function getPreviousSets(exercise){
  const keys=exerciseLookupKeys(exercise);
  for(let i=0;i<keys.length;i++){
    const hit=exerciseIndex[keys[i]];
    if(hit?.sets)return hit.sets;
  }
  return null;
}
function getSuggested(exercise){
  const prev=getPreviousSets(exercise);
  if(!prev?.length)return null;
  const max=Math.max(...prev.map(s=>parseFloat(s.weight)||0));
  return prev.every(s=>s.done)?Math.round((max+2.5)*2)/2:max;
}

// WEEK STRIP
function renderWeekStrip(){
  const strip=document.getElementById('week-strip');
  const today=new Date(),todayDow=today.getDay();
  const start=new Date(today);start.setDate(today.getDate()-((todayDow+6)%7));
  const sn=schedule.sportName||trDash('common.sport','Sport');
  strip.innerHTML='';
  for(let i=0;i<7;i++){
    const d=new Date(start);d.setDate(start.getDate()+i);
    const dow=d.getDay(),isToday=d.toDateString()===today.toDateString();
    const logged=workouts.filter(w=>new Date(w.date).toDateString()===d.toDateString());
    const isSportDay=schedule.sportDays.includes(dow);
    const hasLift=logged.some(w=>!isSportWorkout(w)),hasSport=logged.some(w=>isSportWorkout(w));
    const isLogged=hasLift||hasSport;
    let cls='day-pill'+(isSportDay?' sport':'')+(isToday?' today':'')+(isLogged?' logged':'');
    let icon=hasLift&&hasSport?'WS':hasLift?'W':hasSport?'S':(isSportDay?'S':'');
    const bottom=isLogged?`<div class="day-check">✓</div>`:`<div style="font-size:11px;margin-top:2px;min-height:14px">${icon}</div>`;
    strip.innerHTML+=`<div class="${cls}" onclick="toggleDayDetail(${i})"><div class="day-label">${DAY_NAMES[dow]}</div><div class="day-num">${d.getDate()}</div>${bottom}</div>`;
  }
  const todayIsSportDay=schedule.sportDays.includes(todayDow);
  const todayLogged=workouts.filter(w=>new Date(w.date).toDateString()===today.toDateString());
  const tHasLift=todayLogged.some(w=>!isSportWorkout(w)),tHasSport=todayLogged.some(w=>isSportWorkout(w));
  let s='';
  if(tHasLift&&tHasSport)s=`<span style="color:var(--green);font-weight:700">${trDash('dashboard.status.workout_plus_sport_logged','Workout + {sport} logged',{sport:sn})}</span>`;
  else if(tHasLift)s=`<span style="color:var(--green);font-weight:700">${trDash('dashboard.status.workout_logged','Workout logged')}</span>`;
  else if(tHasSport)s=`<span style="color:var(--blue);font-weight:700">${trDash('dashboard.status.sport_logged','{sport} logged',{sport:sn})}</span>`;
  else if(todayIsSportDay)s=`<span style="color:var(--blue);font-weight:700">${trDash('dashboard.status.sport_day','{sport} day',{sport:sn})}</span>`;
  document.getElementById('today-status').innerHTML=s;
}

function toggleDayDetail(dayIdx){
  const panel=document.getElementById('day-detail-panel');
  if(!panel)return;
  if(panel.dataset.active===String(dayIdx)&&panel.style.display!=='none'){
    panel.style.display='none';
    panel.dataset.active='';
    document.querySelectorAll('#week-strip .day-pill').forEach(p=>p.classList.remove('active'));
    return;
  }
  panel.dataset.active=String(dayIdx);
  document.querySelectorAll('#week-strip .day-pill').forEach((p,i)=>p.classList.toggle('active',i===dayIdx));
  const today=new Date(),todayDow=today.getDay();
  const start=new Date(today);start.setDate(today.getDate()-((todayDow+6)%7));
  const d=new Date(start);d.setDate(start.getDate()+dayIdx);
  const logged=workouts.filter(w=>new Date(w.date).toDateString()===d.toDateString());
  if(logged.length){
    const items=[];
    logged.forEach(w=>{
      if(isSportWorkout(w)){
        items.push(`<div class="day-detail-item"><span style="color:var(--blue)">${w.name||(schedule.sportName||trDash('common.sport','Sport'))}</span></div>`);
      } else {
        const names=(w.exercises||[]).map(e=>e.name);
        if(names.length)names.forEach(n=>items.push(`<div class="day-detail-item">${n}</div>`));
        else items.push(`<div class="day-detail-item" style="color:var(--muted)">${trDash('common.workout','Workout')}</div>`);
      }
    });
    panel.innerHTML=items.join('');
  } else {
    const dow=d.getDay(),isSportDay=schedule.sportDays.includes(dow),isPast=d<today&&!d.toDateString()===today.toDateString();
    const label=isSportDay?trDash('dashboard.status.sport_day','{sport} day',{sport:(schedule.sportName||trDash('common.sport','Sport'))}):trDash('dashboard.no_session_logged','No session logged');
    panel.innerHTML=`<div class="day-detail-item" style="color:var(--muted)">${label}</div>`;
  }
  panel.style.display='block';
}

// DASHBOARD
function updateDashboard(){
  renderWeekStrip();
  const f=computeFatigue();updateFatigueBars(f);
  const prog=getActiveProgram(),ps=getActiveProgramState();
  const programName=window.I18N&&I18N.t?I18N.t('program.'+prog.id+'.name',null,prog.name||'Training'):prog.name||'Training';

  // Training Maxes - dynamic per program
  const tmGrid=document.getElementById('tm-grid');
  const tmTitle=document.getElementById('tm-section-title');
  if(tmGrid&&prog.getDashboardTMs){
    const tms=prog.getDashboardTMs(ps);
    const tmSignature=tms.map(t=>`${t.name}:${t.value}`).join('|');
    const tmChanged=!!_lastTmSignature&&tmSignature!==_lastTmSignature;
    _lastTmSignature=tmSignature;
    tmGrid.innerHTML=tms.map((t,i)=>`<div class="lift-stat${tmChanged?' tm-updated':''}" style="--tm-delay:${i*65}ms"><div class="value">${t.value}</div><div class="label">${dashExerciseName(t.name)}</div></div>`).join('');
    if(tmTitle)tmTitle.textContent=prog.dashboardStatsLabel||trDash('dashboard.training_maxes','Training Maxes');
  }

  // Weekly session progress
  const now=new Date(),sow=new Date(now);sow.setDate(now.getDate()-((now.getDay()+6)%7));sow.setHours(0,0,0,0);
  const freq=ps.daysPerWeek||3;
  const doneThisWeek=workouts.filter(w=>(w.program===prog.id||(!w.program&&w.type===prog.id))&&new Date(w.date)>=sow).length;
  const sportThisWeek=workouts.filter(w=>isSportWorkout(w)&&new Date(w.date)>=sow).length;
  const sn=schedule.sportName||trDash('common.sport','Sport');
  const pillsEl=document.getElementById('session-pills');
  if(pillsEl)pillsEl.innerHTML=Array.from({length:freq},(_,i)=>`<div class="session-pill${i<doneThisWeek?' done':''}"></div>`).join('');
  let volText=trDash('dashboard.sessions','{done}/{total} sessions',{done:doneThisWeek,total:freq});
  if(sportThisWeek)volText+=' · '+sportThisWeek+' '+sn.toLowerCase();
  if(doneThisWeek>=freq)volText+=' ✓';
  document.getElementById('volume-text').textContent=volText;

  // Today's Plan - uses program's getBlockInfo
  const recovery=100-f.overall,todayDow=new Date().getDay();
  const isSportDay=schedule.sportDays.includes(todayDow);
  const hadSportRecently=wasSportRecently(36);
  const bi=prog.getBlockInfo?prog.getBlockInfo(ps):{name:'',weekLabel:'',isDeload:false,pct:null,modeDesc:'',modeName:''};
  const modeDescHtml=bi.modeDesc?`<div style="font-size:11px;color:var(--muted);margin-bottom:10px;padding:0 2px">${bi.modeDesc}</div>`:'';
  const startBtn=`<button class="btn btn-primary" style="margin-top:12px;width:100%" onclick="goToLog()">${trDash('dashboard.start_session','Start Session')}</button>`;
  let rec='',cardAccent=false;
  if(doneThisWeek>=freq) rec=modeDescHtml+`<div style="font-weight:700;color:var(--green);margin-bottom:6px">${trDash('dashboard.week_complete','Week complete!')}</div><div style="font-size:13px;color:var(--muted)">${trDash('dashboard.sessions_done','All {total} sessions done. Rest up.',{total:freq})}</div>`;
  else if(recovery<40) rec=modeDescHtml+`<div style="font-weight:700;color:var(--accent);margin-bottom:6px">${trDash('dashboard.high_fatigue_title','High fatigue - rest or deload')}</div><div style="font-size:13px;color:var(--muted)">${trDash('dashboard.recovery_pct','Recovery {recovery}%',{recovery})}. ${bi.isDeload?trDash('dashboard.good_deload_timing','Good timing - deload!'):trDash('dashboard.consider_rest','Consider resting today.')} ${freq-doneThisWeek} ${freq-doneThisWeek>1?trDash('dashboard.sessions_left','sessions left'):trDash('dashboard.session_left','session left')}.</div>`;
  else if(isSportDay){cardAccent=true;rec=modeDescHtml+`<div style="font-weight:700;color:var(--blue);margin-bottom:6px">${trDash('dashboard.status.sport_day','{sport} day',{sport:sn})}</div><div style="font-size:13px;color:var(--muted)">${trDash('dashboard.sport_day_advice','Pick an upper-body day on the Log tab, or rest.')} ${freq-doneThisWeek} ${freq-doneThisWeek>1?trDash('dashboard.sessions_left','sessions left'):trDash('dashboard.session_left','session left')}.</div>${startBtn}`;}
  else if(hadSportRecently){cardAccent=true;rec=modeDescHtml+`<div style="font-weight:700;color:var(--blue);margin-bottom:6px">${trDash('dashboard.post_sport','Post-{sport}',{sport:sn.toLowerCase()})}</div><div style="font-size:13px;color:var(--muted)">${trDash('dashboard.post_sport_advice','Legs may be fatigued. The Log tab will suggest an upper-focused day.')} ${freq-doneThisWeek} ${freq-doneThisWeek>1?trDash('dashboard.sessions_left','sessions left'):trDash('dashboard.session_left','session left')}.</div>${startBtn}`;}
  else if(bi.isDeload){cardAccent=true;rec=modeDescHtml+`<div style="font-weight:700;color:var(--green);margin-bottom:6px">${trDash('dashboard.deload_week','Deload week')}</div><div style="font-size:13px;color:var(--muted)">${trDash('dashboard.recovery_pct','Recovery {recovery}%',{recovery})}. ${freq-doneThisWeek} ${freq-doneThisWeek>1?trDash('dashboard.sessions_left','sessions left'):trDash('dashboard.session_left','session left')}.</div>${startBtn}`;}
  else{cardAccent=true;rec=modeDescHtml+`<div style="font-weight:700;color:var(--accent);margin-bottom:6px">${trDash('dashboard.training_day','Training day')}</div><div style="font-size:13px;color:var(--muted)">${trDash('dashboard.recovery_pct','Recovery {recovery}%',{recovery})} - ${recovery>=75?trDash('dashboard.feeling_fresh','feeling fresh, push it'):trDash('dashboard.moderate_effort','moderate effort')}. ${freq-doneThisWeek} ${freq-doneThisWeek>1?trDash('dashboard.sessions_left','sessions left'):trDash('dashboard.session_left','session left')}.</div>${startBtn}`;}
  document.getElementById('next-session-content').innerHTML=rec;
  document.getElementById('next-session-content').parentElement.style.borderColor=cardAccent?'var(--accent)':'';
  document.getElementById('header-sub').textContent=trDash('dashboard.header_sub','{program} - {block} - {week} - Recovery {recovery}%',{program:programName,block:bi.name||'',week:bi.weekLabel||'',recovery});
}

