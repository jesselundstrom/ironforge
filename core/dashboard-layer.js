function isSportWorkout(w){return w.type==='sport'||w.type==='hockey';}
let _lastTmSignature='';
let dashboardUiState={coachingExpanded:false};
function trDash(key,fallback,params){
  if(window.I18N)return I18N.t(key,params,fallback);
  return fallback;
}
function dashExerciseName(name){
  if(window.EXERCISE_LIBRARY&&EXERCISE_LIBRARY.getDisplayName)return EXERCISE_LIBRARY.getDisplayName(name);
  return name;
}
function clampDash(value,min,max){
  return Math.max(min,Math.min(max,value));
}
function getDashboardFatigueLookbackDays(){
  return Math.max(1,parseInt(FATIGUE_CONFIG?.lookbackDays,10)||10);
}
function getDashboardMuscleLoadLookbackDays(days){
  return Math.max(1,parseInt(days,10)||parseInt(MUSCLE_LOAD_CONFIG?.lookbackDays,10)||7);
}
function getCompletedWorkSets(exercise){
  return Array.isArray(exercise?.sets)
    ? exercise.sets.filter(set=>set?.done===true&&!set.isWarmup)
    : [];
}
function getWorkoutAgeDays(workout,now){
  const ts=new Date(workout?.date).getTime();
  if(!Number.isFinite(ts))return null;
  return (now-ts)/86400000;
}
function getFatigueDecayWeight(ageDays,halfLifeDays){
  if(ageDays===null||ageDays<0)return 0;
  const halfLife=Math.max(0.1,parseFloat(halfLifeDays)||1);
  return Math.pow(0.5,ageDays/halfLife);
}
function getLiftWorkoutFatigueImpulse(workout){
  const cfg=FATIGUE_CONFIG?.lift||{};
  let completedSets=0,totalReps=0,repsCount=0,totalWeight=0,weightCount=0;
  (Array.isArray(workout?.exercises)?workout.exercises:[]).forEach(exercise=>{
    getCompletedWorkSets(exercise).forEach(set=>{
      completedSets++;
      const reps=parseFloat(set?.reps);
      if(Number.isFinite(reps)&&reps>0){
        totalReps+=reps;
        repsCount++;
      }
      const weight=parseFloat(set?.weight);
      if(Number.isFinite(weight)&&weight>=0){
        totalWeight+=weight;
        weightCount++;
      }
    });
  });
  if(!completedSets)return{muscular:0,cns:0};
  const avgReps=repsCount?totalReps/completedSets:5;
  const repFactor=clampDash(
    1+(avgReps-5)*(cfg.repFactorPerRepFromFive||0.05),
    cfg.repFactorMin||0.9,
    cfg.repFactorMax||1.25
  );
  const avgWeightKg=weightCount?totalWeight/weightCount:0;
  const loadFactor=1+clampDash(
    avgWeightKg/(cfg.loadFactorDivisor||200),
    0,
    cfg.loadFactorMaxBonus||0.35
  );
  const effort=clampDash((parseFloat(workout?.rpe)||7)-6,0,4);
  const muscular=Math.min(
    cfg.sessionCap||70,
    (cfg.muscularBase||8)+(completedSets*(cfg.muscularSetWeight||1.9)*repFactor*loadFactor)+(effort*(cfg.muscularRpeWeight||4))
  );
  const cns=Math.min(
    cfg.sessionCap||70,
    (cfg.cnsBase||10)+(completedSets*(cfg.cnsSetWeight||1.05)*loadFactor)+(effort*(cfg.cnsRpeWeight||7))
  );
  return{muscular,cns};
}
function getSportFatigueConfig(workout){
  const intensity=workout?.type==='hockey'?'hard':(schedule?.sportIntensity||'hard');
  return FATIGUE_CONFIG?.sport?.[intensity]||FATIGUE_CONFIG?.sport?.hard||{muscular:17,cns:14};
}
function getSportWorkoutFatigueImpulse(workout){
  const sportCfg=FATIGUE_CONFIG?.sport||{};
  const base=getSportFatigueConfig(workout);
  const durationHours=Math.max(0,(parseFloat(workout?.duration)||0)/3600);
  const durationFactor=clampDash(
    durationHours||1,
    sportCfg.durationMin||0.75,
    sportCfg.durationMax||1.5
  );
  const effortFactor=clampDash(
    (sportCfg.effortBase||0.85)+(Math.max(0,(parseFloat(workout?.rpe)||7)-6)*(sportCfg.effortPerRpeAboveSix||0.12)),
    sportCfg.effortBase||0.85,
    sportCfg.effortMax||1.33
  );
  const muscular=(base.muscular||0)*durationFactor*effortFactor;
  let cns=(base.cns||0)*durationFactor*effortFactor;
  if(workout?.subtype==='extra')cns*=sportCfg.extraSubtypeCnsMultiplier||1.15;
  return{muscular,cns};
}
function computeFatigue(){
  const now=Date.now();
  const liftS=workouts.filter(w=>!isSportWorkout(w)).sort((a,b)=>new Date(b.date)-new Date(a.date));
  const sportS=workouts.filter(w=>isSportWorkout(w)).sort((a,b)=>new Date(b.date)-new Date(a.date));
  const daysSinceLift=liftS.length?daysSince(liftS[0].date):99;
  const daysSinceSport=sportS.length?daysSince(sportS[0].date):99;
  const cfg=FATIGUE_CONFIG;
  const lookbackDays=getDashboardFatigueLookbackDays();
  let muscular=0,cns=0,recentLiftSessions=0,recentSportSessions=0;
  workouts.forEach(workout=>{
    const ageDays=getWorkoutAgeDays(workout,now);
    if(ageDays===null||ageDays<0||ageDays>lookbackDays)return;
    const impulse=isSportWorkout(workout)?getSportWorkoutFatigueImpulse(workout):getLiftWorkoutFatigueImpulse(workout);
    if(!impulse.muscular&&!impulse.cns)return;
    if(isSportWorkout(workout))recentSportSessions++;
    else recentLiftSessions++;
    muscular+=impulse.muscular*getFatigueDecayWeight(ageDays,cfg?.muscularHalfLifeDays||4.5);
    cns+=impulse.cns*getFatigueDecayWeight(ageDays,cfg?.cnsHalfLifeDays||3.25);
  });
  muscular=clampDash(muscular,0,100);
  cns=clampDash(cns,0,100);
  return{
    muscular:Math.round(muscular),
    cns:Math.round(cns),
    overall:Math.round((muscular+cns)*0.5),
    daysSinceLift,
    daysSinceSport,
    recentLiftSessions,
    recentSportSessions
  };
}
function wasSportRecently(hours){
  hours=hours||((typeof getSportRecentHours==='function')?getSportRecentHours():30);
  return workouts.some(w=>isSportWorkout(w)&&(Date.now()-new Date(w.date).getTime())<hours*3600000);
}
// Backward-compat alias used by program files
function wasHockeyRecently(hours){return wasSportRecently(hours);}
function getRecoveryColor(r){return r>=85?'var(--green)':r>=60?'var(--orange)':'var(--accent)';}
function getRecoveryGradient(r){
  if(r>=85)return{start:'var(--green)',mid:'var(--green)',end:'var(--green)',glow:'rgba(76,175,121,0.2)'};
  if(r>=60)return{start:'var(--yellow)',mid:'var(--yellow)',end:'var(--yellow)',glow:'rgba(245,200,66,0.2)'};
  return{start:'var(--red)',mid:'var(--red)',end:'var(--red)',glow:'rgba(224,82,82,0.18)'};
}
function getReadinessLabel(o){
  const r=100-o;
  if(r>=75)return{label:trDash('dashboard.fully_recovered','Palautunut hyvin'),color:'var(--green)'};
  if(r>=50)return{label:trDash('dashboard.mostly_recovered','Enimmäkseen palautunut'),color:'var(--orange)'};
  if(r>=30)return{label:trDash('dashboard.partially_fatigued','Osittain väsynyt'),color:'var(--orange)'};
  return{label:trDash('dashboard.high_fatigue','Korkea kuormitus'),color:'var(--accent)'};
}
function updateFatigueBars(f){
  document.querySelectorAll('#recovery-badge').forEach((el,idx)=>{if(idx>0)el.remove();});
  const overallRow=document.getElementById('f-overall')?.closest('.fatigue-row');
  if(overallRow)overallRow.remove();
  ['muscular','cns'].forEach(k=>{
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
  if(overallRec>=85){badgeText=trDash('dashboard.badge.go','Valmis');badgeCls='rbadge-go';}
  else if(overallRec>=60){badgeText=trDash('dashboard.badge.caution','Kevennä');badgeCls='rbadge-caution';}
  else{badgeText=trDash('dashboard.badge.rest','Palautus');badgeCls='rbadge-rest';}
  const overallValueEl=document.getElementById('recovery-overall-value');
  if(overallValueEl)overallValueEl.textContent=overallRec+'%';
  const overallCopyEl=document.getElementById('recovery-overall-copy');
  if(overallCopyEl)overallCopyEl.textContent='';
  const badgeEl=document.getElementById('recovery-badge');
  if(badgeEl)badgeEl.innerHTML=`<span class="readiness-status ${badgeCls}"><span class="readiness-status-dot" aria-hidden="true"></span><span class="readiness-status-text">${badgeText}</span></span>`;
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

function getExerciseMuscleProfile(exercise){
  if(!window.EXERCISE_LIBRARY||!EXERCISE_LIBRARY.getExerciseMeta)return null;
  return EXERCISE_LIBRARY.getExerciseMeta(exercise?.exerciseId||exercise?.name||exercise)||null;
}

function getWorkoutMuscleLoad(workout){
  const totals={};
  const exercises=Array.isArray(workout?.exercises)?workout.exercises:[];
  const cfg=MUSCLE_LOAD_CONFIG||{};
  const sessionScale=clampDash(
    (cfg.liftRpeScaleBase||0.8)+(((parseFloat(workout?.rpe)||7)-5)*(cfg.liftRpeScalePerPoint||0.16)),
    cfg.liftRpeScaleBase||0.8,
    cfg.liftRpeScaleMax||1.6
  );
  exercises.forEach(ex=>{
    const profile=getExerciseMuscleProfile(ex);
    if(!profile)return;
    const setCount=getCompletedWorkSets(ex).length;
    if(!setCount)return;
    (profile.primaryMuscles||[]).forEach(muscle=>{
      totals[muscle]=(totals[muscle]||0)+setCount*(cfg.liftPrimaryWeight||1)*sessionScale;
    });
    (profile.secondaryMuscles||[]).forEach(muscle=>{
      totals[muscle]=(totals[muscle]||0)+setCount*(cfg.liftSecondaryWeight||0.5)*sessionScale;
    });
  });
  return totals;
}

function getSportWorkoutMuscleLoad(workout){
  const totals={};
  const isHockey=workout?.type==='hockey';
  const legsHeavy=isHockey||(schedule?.sportLegsHeavy!==false);
  if(!legsHeavy)return totals;
  const intensity=isHockey?'hard':(schedule?.sportIntensity||'hard');
  const baseByIntensity={easy:1.4,moderate:2.6,hard:4.2};
  const base=baseByIntensity[intensity]||baseByIntensity.hard;
  const durationSeconds=Math.max(0,parseFloat(workout?.duration)||0);
  const durationScale=Math.max(0.75,Math.min(1.5,durationSeconds?durationSeconds/3600:1));
  const effortScale=Math.max(0.8,Math.min(1.3,((parseFloat(workout?.rpe)||7)-5)*0.08+0.92));
  const load=base*durationScale*effortScale;
  totals.quads=load;
  totals.hamstrings=load*0.75;
  totals.glutes=load*0.8;
  totals.adductors=load*0.65;
  totals.calves=load*0.55;
  totals.core=load*0.45;
  return totals;
}

function getRecentMuscleLoads(days){
  const lookbackDays=getDashboardMuscleLoadLookbackDays(days);
  const now=Date.now();
  const totals={};
  workouts.forEach(workout=>{
    const ageDays=getWorkoutAgeDays(workout,now);
    if(ageDays===null||ageDays<0||ageDays>lookbackDays)return;
    const decay=getFatigueDecayWeight(ageDays,MUSCLE_LOAD_CONFIG?.halfLifeDays||3.5);
    const load=isSportWorkout(workout)?getSportWorkoutMuscleLoad(workout):getWorkoutMuscleLoad(workout);
    Object.entries(load).forEach(([muscle,value])=>{
      totals[muscle]=(totals[muscle]||0)+(value*decay);
    });
  });
  return Object.fromEntries(Object.entries(totals).sort((a,b)=>b[1]-a[1]));
}

function mapMuscleToDisplayGroup(muscle){
  if(window.EXERCISE_LIBRARY&&EXERCISE_LIBRARY.mapMuscleToDisplayGroup)return EXERCISE_LIBRARY.mapMuscleToDisplayGroup(muscle);
  return null;
}

function getRecentDisplayMuscleLoads(days){
  const grouped={};
  Object.entries(getRecentMuscleLoads(days)).forEach(([muscle,value])=>{
    const displayGroup=mapMuscleToDisplayGroup(muscle);
    if(!displayGroup)return;
    grouped[displayGroup]=(grouped[displayGroup]||0)+value;
  });
  return Object.fromEntries(Object.entries(grouped).sort((a,b)=>b[1]-a[1]));
}

function getDisplayMuscleLoadLevel(value){
  const thresholds=MUSCLE_LOAD_CONFIG?.thresholds||{};
  if(value>=(thresholds.high||8))return'high';
  if(value>=(thresholds.moderate||4))return'moderate';
  if(value>=(thresholds.light||1.5))return'light';
  return null;
}

function getRecentMuscleLoadSummary(days){
  const displayLoads=getRecentDisplayMuscleLoads(getDashboardMuscleLoadLookbackDays(days));
  return Object.entries(displayLoads)
    .map(([group,value])=>({group,value,level:getDisplayMuscleLoadLevel(value)}))
    .filter(item=>item.level)
    .slice(0,Math.max(1,parseInt(MUSCLE_LOAD_CONFIG?.displayLimit,10)||3));
}

function renderRecentMuscleLoadSummary(days){
  const summary=getRecentMuscleLoadSummary(days);
  if(!summary.length)return'';
  return `<div class="dashboard-muscle-summary"><div class="dashboard-muscle-summary-label">${escapeHtml(trDash('dashboard.muscle_load.recent','Viimeaikainen lihaskuorma'))}</div><div class="dashboard-muscle-chip-row">${summary.map(item=>`<div class="dashboard-muscle-chip dashboard-muscle-chip-${item.level}"><span class="dashboard-muscle-chip-name">${escapeHtml(trDash('dashboard.muscle_group.'+item.group,item.group))}</span><span class="dashboard-muscle-chip-level">${escapeHtml(trDash('dashboard.muscle_load.'+item.level,item.level))}</span></div>`).join('')}</div></div>`;
}

function getDashboardDayLabel(dayIndex){
  if(Number.isFinite(dayIndex)&&Array.isArray(DAY_NAMES)&&DAY_NAMES[dayIndex])return DAY_NAMES[dayIndex];
  return String(dayIndex||'');
}

function getCoachingRecommendationClass(type){
  const map={
    continue:'is-continue',
    shorten:'is-shorten',
    lighten:'is-lighten',
    deload:'is-deload',
    switch_block:'is-switch'
  };
  return map[type]||'is-continue';
}

function renderReasonChips(labels){
  if(!labels?.length)return'';
  return `<div class="dashboard-muscle-chip-row dashboard-reason-chip-row">${labels.map(label=>`<div class="dashboard-muscle-chip dashboard-muscle-chip-light"><span class="dashboard-muscle-chip-name">${escapeHtml(label)}</span></div>`).join('')}</div>`;
}

function renderFocusVerdictCard(profileLike,context){
  const lines=getPreferenceGuidance(profileLike,context);
  if(!lines.length&&!context?.decisionSummary)return'';
  const support=context?.decisionSummary?.body||context?.detail||lines.slice(1).find(Boolean)||'';
  return `<div class="dashboard-today-focus">
    <div class="dashboard-today-focus-copy">${escapeHtml(lines[0]||'')}</div>
    ${support?`<div class="dashboard-today-focus-support">${escapeHtml(support)}</div>`:''}
    ${renderReasonChips(context?.reasonLabels||[])}
  </div>`;
}

function renderSessionProgress(done,total,sportCount,sportName){
  const safeTotal=Math.max(1,parseInt(total,10)||1);
  const complete=Math.min(safeTotal,Math.max(0,parseInt(done,10)||0));
  const percent=Math.round((complete/safeTotal)*100);
  const remaining=safeTotal-complete;
  const footer=complete>=safeTotal
    ? trDash('dashboard.progress_complete','Viikon tavoite täynnä')
    : trDash(
      remaining===1?'dashboard.progress_remaining_one':'dashboard.progress_remaining_many',
      remaining===1?'1 sessio jäljellä tällä viikolla':'{count} sessiota jäljellä tällä viikolla',
      {count:remaining}
    );
  const sportFooter=sportCount
    ? trDash('dashboard.sport_sessions_week','Tällä viikolla kirjattu {count} {sport}-sessiota',{count:sportCount,sport:String(sportName||trDash('common.sport','Laji')).toLowerCase()})
    : '';
  const ringStyle=`--progress-angle:${Math.round((percent/100)*360)}deg;`;
  return `<div class="dashboard-session-progress-card">
    <div class="dashboard-session-progress-ring" style="${ringStyle}" aria-hidden="true">
      <div class="dashboard-session-progress-ring-inner">${escapeHtml(String(percent))}%</div>
    </div>
    <div class="dashboard-session-progress-copy">
      <div class="dashboard-session-progress-value">${escapeHtml(trDash('dashboard.sessions','{done}/{total} sessiota',{done:complete,total:safeTotal}))}</div>
      <div class="dashboard-session-progress-foot">${escapeHtml(footer)}</div>
      ${sportFooter?`<div class="dashboard-session-progress-foot is-secondary">${escapeHtml(sportFooter)}</div>`:''}
    </div>
  </div>`;
}

function renderWeekLegend(){
  const legend=document.getElementById('dashboard-week-legend');
  if(!legend)return;
  legend.innerHTML=`
    <div class="dashboard-week-legend-item"><span class="dashboard-week-legend-dot is-lift" aria-hidden="true"></span><span>${escapeHtml(trDash('dashboard.calendar.legend_lift','Treeni kirjattu'))}</span></div>
    <div class="dashboard-week-legend-item"><span class="dashboard-week-legend-dot is-scheduled" aria-hidden="true"></span><span>${escapeHtml(trDash('dashboard.calendar.legend_scheduled','Suunniteltu'))}</span></div>
  `;
}

function renderCoachingInsightsCard(insights){
  if(!insights)return'';
  const bestDays=(insights.bestDayIndexes||[]).map(getDashboardDayLabel).filter(Boolean);
  const chips=[
    `<div class="dashboard-insight-chip"><span class="dashboard-insight-chip-label">${escapeHtml(trDash('dashboard.insights.adherence','30 pv toteuma'))}</span><span class="dashboard-insight-chip-value">${escapeHtml(String(insights.adherenceRate30||0))}%</span></div>`
  ];
  if(bestDays.length){
    chips.push(`<div class="dashboard-insight-chip"><span class="dashboard-insight-chip-label">${escapeHtml(trDash('dashboard.insights.best_days','Parhaat päivät'))}</span><span class="dashboard-insight-chip-value">${escapeHtml(bestDays.join(' / '))}</span></div>`);
  }
  chips.push(`<div class="dashboard-insight-chip"><span class="dashboard-insight-chip-label">${escapeHtml(trDash('dashboard.insights.sessions_90','90 pv sessiot'))}</span><span class="dashboard-insight-chip-value">${escapeHtml(String(insights.sessions90||0))}</span></div>`);
  if(insights.frictionCount){
    chips.push(`<div class="dashboard-insight-chip"><span class="dashboard-insight-chip-label">${escapeHtml(trDash('dashboard.insights.friction','Kitkasignaalit'))}</span><span class="dashboard-insight-chip-value">${escapeHtml(String(insights.frictionCount))}</span></div>`);
  }
  const bullets=[
    insights.adherenceSummary,
    insights.progressionSummary,
    bestDays.length?trDash('dashboard.insights.best_days_line','Treenaat useimmiten {days}.',{days:bestDays.join(' / ')}):'',
    ...(insights.frictionItems||[])
  ].filter(Boolean).slice(0,4);
  const recType=insights.recommendation?.type||'continue';
  const expanded=dashboardUiState.coachingExpanded===true;
  const toggleLabel=expanded
    ? trDash('dashboard.insights.show_less','Piilota nostot')
    : trDash('dashboard.insights.show_more','Näytä nostot');
  return `<div class="dashboard-coaching-card ${getCoachingRecommendationClass(recType)}">
    <button class="dashboard-coaching-toggle" type="button" aria-expanded="${expanded?'true':'false'}" onclick="toggleDashboardCoachingInsights()">${escapeHtml(toggleLabel)}</button>
    <div class="dashboard-coaching-details"${expanded?'':' hidden'}>
      <div class="dashboard-coaching-body">${escapeHtml(insights.recommendation?.body||'')}</div>
      <div class="dashboard-insight-chip-row">${chips.join('')}</div>
      <div class="dashboard-coaching-list">${bullets.map(line=>`<div class="dashboard-coaching-item">${escapeHtml(line)}</div>`).join('')}</div>
    </div>
  </div>`;
}

function sanitizeDashboardRichText(text){
  return escapeHtml(String(text||''))
    .replace(/&lt;strong&gt;/gi,'<strong>')
    .replace(/&lt;\/strong&gt;/gi,'</strong>');
}

function highlightDashboardText(text,patterns){
  let next=String(text||'');
  (patterns||[]).forEach(pattern=>{
    if(!pattern)return;
    if(pattern instanceof RegExp){
      next=next.replace(pattern,match=>`<strong>${match}</strong>`);
      return;
    }
    const token=String(pattern);
    if(token)next=next.replace(token,`<strong>${token}</strong>`);
  });
  return next;
}

function getDashboardCoachCopy(focusLine,decisionSummary,coachCommentary,decision){
  if(decision?.action&&decision.action!=='train'&&coachCommentary?.title&&coachCommentary?.body){
    return `<strong>${escapeHtml(coachCommentary.title)}</strong> ${escapeHtml(coachCommentary.body)}`;
  }
  return escapeHtml(focusLine||decisionSummary?.body||'');
}
function getTodayWorkoutSummary(){
  const today=new Date();
  let liftCount=0,sportCount=0;
  workouts.forEach(workout=>{
    const ts=new Date(workout?.date);
    if(!Number.isFinite(ts.getTime())||ts.toDateString()!==today.toDateString())return;
    if(isSportWorkout(workout))sportCount++;
    else liftCount++;
  });
  return{
    hasLift:liftCount>0,
    liftCount,
    sportCount
  };
}
function getDashboardCompletionMessage(summary){
  if(!summary?.hasLift)return null;
  if(summary.sportCount>0){
    return{
      title:trDash('dashboard.today_done','Päivän työ tehty'),
      body:trDash(
        'dashboard.today_done_with_sport',
        'Salitreeni ja lajisessio on jo kirjattu tälle päivälle. Vahva päivä. Anna nyt palautumiselle tilaa tehdä työnsä.'
      )
    };
  }
  if(summary.liftCount>1){
    return{
      title:trDash('dashboard.today_done','Päivän työ tehty'),
      body:trDash(
        'dashboard.today_done_body_multi',
        'Olet kirjannut tälle päivälle jo {count} salitreeniä. Hyvä työ. Sulje päivä rauhassa ja tule seuraavaan sessioon tuoreena.',
        {count:summary.liftCount}
      )
    };
  }
  return{
    title:trDash('dashboard.today_done','Päivän työ tehty'),
    body:trDash(
      'dashboard.today_done_body',
      'Salitreeni on jo kirjattu tälle päivälle. Hyvä työ. Anna palautumiselle tilaa ja tule seuraavaan sessioon terävänä.'
    )
  };
}
function getDashboardCoachCardContent(focusLine,decisionSummary,coachCommentary,decision,todaySummary){
  const completion=getDashboardCompletionMessage(todaySummary);
  if(completion){
    return{
      copy:`<strong>${escapeHtml(trDash('dashboard.today_done_coach_title','Hyvä työ'))}</strong> ${escapeHtml(trDash('dashboard.today_done_coach_body','Tämän päivän päätyö on jo kasassa. Anna palautumiselle työrauha ja tule seuraavaan sessioon tuoreena.'))}`,
      positive:true
    };
  }
  return{
    copy:getDashboardCoachCopy(focusLine,decisionSummary,coachCommentary,decision),
    positive:false
  };
}

function getDashboardProgressMetric(insights){
  const summary=String(insights?.progressionSummary||'');
  const deltaMatch=summary.match(/([+-]?\d+(?:[.,]\d+)?)\s*kg/i);
  if(deltaMatch){
    const deltaValue=parseFloat(deltaMatch[1].replace(',','.'));
    if(Number.isFinite(deltaValue)){
      const absValue=Math.abs(deltaValue);
      const formatted=absValue%1===0?absValue.toFixed(0):absValue.toFixed(1);
      return{
        value:`${deltaValue>0?'+':(deltaValue<0?'-':'')}${formatted}kg`,
        color:deltaValue>0?'green':(deltaValue<0?'red':'text'),
        highlight:deltaMatch[0],
        label:trDash('workout.today.stats.progress','PR-kasvu')
      };
    }
  }
  return{
    value:String(insights?.sessions90||0),
    color:'text',
    highlight:'',
    label:trDash('dashboard.insights.sessions_90','90 pv sessiot')
  };
}

function getDashboardPlanMuscleBars(days){
  const summary=getRecentMuscleLoadSummary(getDashboardMuscleLoadLookbackDays(days));
  const maxValue=Math.max(...summary.map(item=>item.value),1);
  return summary.map(item=>({
    name:item.group,
    load:Math.max(12,Math.round((item.value/maxValue)*100)),
    level:item.level==='high'?'high':(item.level==='moderate'?'medium':'low')
  }));
}

// All 11 display muscle groups
const ALL_DISPLAY_MUSCLE_GROUPS=['chest','back','shoulders','biceps','triceps','forearms','quads','hamstrings','glutes','calves','core'];

// Front-visible groups (shown on front SVG)
const FRONT_MUSCLE_GROUPS=['chest','shoulders','biceps','forearms','quads','calves','core'];
// Back-visible groups (shown on back SVG)
const BACK_MUSCLE_GROUPS=['back','shoulders','triceps','forearms','glutes','hamstrings','calves'];

function getAllMuscleLoadLevels(days){
  const displayLoads=getRecentDisplayMuscleLoads(getDashboardMuscleLoadLookbackDays(days));
  const result={};
  ALL_DISPLAY_MUSCLE_GROUPS.forEach(group=>{
    const value=displayLoads[group]||0;
    const level=getDisplayMuscleLoadLevel(value);
    result[group]={value,level};
  });
  return result;
}

function renderMuscleBodyVisualization(days){
  const loads=getAllMuscleLoadLevels(days);
  const hasAnyData=Object.values(loads).some(l=>l.level);
  if(!hasAnyData){
    return `<div class="muscle-body-empty">${escapeHtml(trDash('dashboard.log_to_see','Kirjaa treenejä, niin data tulee näkyviin'))}</div>`;
  }

  // Build legend items: only groups that have data, sorted by load value desc
  const activeGroups=ALL_DISPLAY_MUSCLE_GROUPS
    .filter(g=>loads[g].level)
    .sort((a,b)=>loads[b].value-loads[a].value);
  const legendHtml=activeGroups.map(group=>{
    const l=loads[group];
    const levelKey=l.level==='high'?'dashboard.muscle_load.high':(l.level==='moderate'?'dashboard.muscle_load.moderate':'dashboard.muscle_load.light');
    const levelText=trDash(levelKey,l.level);
    const groupName=trDash('dashboard.muscle_group.'+group,group);
    return `<div class="muscle-body-legend-item is-${escapeHtml(l.level)}">
      <span class="muscle-body-legend-dot"></span>
      <span class="muscle-body-legend-name">${escapeHtml(groupName)}</span>
      <span class="muscle-body-legend-level">${escapeHtml(levelText)}</span>
    </div>`;
  }).join('');

  // Build data attributes for SVG colorizing
  const dataAttrs=ALL_DISPLAY_MUSCLE_GROUPS
    .map(g=>`data-muscle-${g}="${loads[g].level||'none'}"`)
    .join(' ');

  return `<div class="muscle-body-wrapper" ${dataAttrs}>
    <div class="muscle-body-flip-container">
      <div class="muscle-body-flipper">
        <div class="muscle-body-face muscle-body-front">${getMuscleBodySvgFront()}</div>
        <div class="muscle-body-face muscle-body-back">${getMuscleBodySvgBack()}</div>
      </div>
    </div>
    <button class="muscle-body-flip-btn" type="button" data-action="flip-muscle-body" aria-label="${escapeHtml(trDash('dashboard.muscle_body.flip','Käännä'))}">
      <span class="muscle-body-flip-label muscle-body-flip-label-front">${escapeHtml(trDash('dashboard.muscle_body.front','Edestä'))}</span>
      <span class="muscle-body-flip-label muscle-body-flip-label-back">${escapeHtml(trDash('dashboard.muscle_body.back','Takaa'))}</span>
    </button>
    <div class="muscle-body-legend">${legendHtml}</div>
  </div>`;
}

function initMuscleBodyFlip(){
  document.addEventListener('click',e=>{
    const btn=e.target.closest('[data-action="flip-muscle-body"]');
    if(!btn)return;
    const wrapper=btn.closest('.muscle-body-wrapper');
    if(wrapper)wrapper.classList.toggle('is-flipped');
  });
}

function colorMuscleBodySvg(){
  document.querySelectorAll('.muscle-body-wrapper').forEach(wrapper=>{
    ALL_DISPLAY_MUSCLE_GROUPS.forEach(group=>{
      const level=wrapper.getAttribute('data-muscle-'+group)||'none';
      wrapper.querySelectorAll(`.muscle-zone[data-muscle="${group}"]`).forEach(zone=>{
        zone.setAttribute('data-level',level);
      });
    });
  });
}

function renderDashboardTodayPlan(input){
  const next=input||{};
  const focusLine=String(next.focusLine||'');
  const decision=next.trainingDecision||{};
  const decisionSummary=next.decisionSummary||null;
  const coachCommentary=next.coachCommentary||null;
  const coachingInsights=next.coachingInsights||{};
  const todaySummary=next.todaySummary||null;
  const completionMessage=getDashboardCompletionMessage(todaySummary);
  const coachCard=getDashboardCoachCardContent(focusLine,decisionSummary,coachCommentary,decision,todaySummary);
  const adherenceRate=Math.max(0,Math.round(coachingInsights.adherenceRate30||0));
  const progressMetric=getDashboardProgressMetric(coachingInsights);
  const bestDays=(coachingInsights.bestDayIndexes||[]).map(getDashboardDayLabel).filter(Boolean).slice(0,2);
  const bestDaysValue=bestDays.length?bestDays.join('/'):'-';
  const adherenceText=highlightDashboardText(
    coachingInsights.adherenceSummary||'',
    [`${adherenceRate}%`]
  );
  const progressionText=highlightDashboardText(
    coachingInsights.progressionSummary||'',
    progressMetric.highlight?[progressMetric.highlight]:[]
  );
  const bestDaysText=bestDays.length
    ? highlightDashboardText(
      trDash('dashboard.insights.best_days_line','Treenaat useimmiten {days}.',{days:bestDays.join(' / ')}),
      [bestDays.join(' / ')]
    )
    : highlightDashboardText((coachingInsights.frictionItems||[])[0]||'',[]);
  const stats=[
    {
      value:`${adherenceRate}%`,
      label:trDash('dashboard.insights.adherence','30 pv toteuma'),
      color:adherenceRate>=50?'orange':'text'
    },
    {
      value:progressMetric.value,
      label:progressMetric.label,
      color:progressMetric.color
    },
    {
      value:bestDaysValue,
      label:trDash('dashboard.insights.best_days','Parhaat päivät'),
      color:'text'
    }
  ];
  const insights=[
    {tone:adherenceRate>=50?'orange':'neutral',text:adherenceText},
    {tone:progressMetric.color==='green'?'green':(progressMetric.color==='red'?'red':'blue'),text:progressionText||sanitizeDashboardRichText(coachingInsights.progressionSummary||'')},
    {tone:'blue',text:bestDaysText}
  ].filter(item=>item.text);
  const muscleBodyHtml=renderMuscleBodyVisualization(getDashboardMuscleLoadLookbackDays());
  return `<div class="dashboard-plan-stack">
    <section class="dashboard-plan-section dashboard-plan-section-coach">
      <div class="dashboard-plan-section-label">${escapeHtml(trDash('dashboard.insights.title','Valmennusnostot'))}</div>
      <article class="dashboard-plan-card dashboard-plan-coach-card">
        <div class="dashboard-plan-card-head dashboard-plan-card-head-coach"><span class="dashboard-plan-head-dot${coachCard.positive?' is-positive':''}" aria-hidden="true"></span>${escapeHtml(coachCard.positive?trDash('dashboard.today_done','Päivän työ tehty'):trDash('workout.today.coach_note','Valmentajan huomio'))}</div>
        <div class="dashboard-plan-coach-copy${coachCard.positive?' is-positive':''}">${sanitizeDashboardRichText(coachCard.copy)}</div>
        ${completionMessage?`<div class="dashboard-plan-completion">${renderPlanStatus(completionMessage.title,completionMessage.body,'positive')}</div>`:''}
      </article>
    </section>
    <section class="dashboard-plan-section dashboard-plan-section-stats">
      <div class="dashboard-plan-section-label">${escapeHtml(trDash('workout.today.block_stats','Trendit'))}</div>
      <article class="dashboard-plan-card dashboard-plan-stats-card">
        <div class="dashboard-plan-card-head">${escapeHtml(trDash('workout.today.last_30_days','Viimeiset 30 päivää'))}</div>
        <div class="dashboard-plan-stats-grid">${stats.map((stat,index)=>`<div class="dashboard-plan-stat${index<stats.length-1?' has-divider':''}"><div class="dashboard-plan-stat-value is-${escapeHtml(stat.color)}">${escapeHtml(stat.value)}</div><div class="dashboard-plan-stat-label">${escapeHtml(stat.label)}</div></div>`).join('')}</div>
        <div class="dashboard-plan-insight-list">${insights.map((item,index)=>`<div class="dashboard-plan-insight-row is-${escapeHtml(item.tone)}${index===insights.length-1?' is-last':''}"><span class="dashboard-plan-insight-text">${sanitizeDashboardRichText(item.text)}</span></div>`).join('')}</div>
      </article>
    </section>
    <section class="dashboard-plan-section dashboard-plan-section-muscle">
      <div class="dashboard-plan-section-label">${escapeHtml(trDash('dashboard.muscle_load.recent','Viimeaikainen lihaskuorma'))}</div>
      <article class="dashboard-plan-card dashboard-plan-muscle-card">
        <div class="dashboard-plan-card-head">${escapeHtml(trDash('workout.today.recovery_status','Palautumistilanne'))}</div>
        ${muscleBodyHtml}
      </article>
    </section>
  </div>`;
}

function animateDashboardPlanMuscleBars(){
  // Legacy bar animation (kept for backward compat if bars still exist)
  document.querySelectorAll('.dashboard-plan-muscle-fill').forEach(fill=>{
    const load=Math.max(0,Math.min(100,parseFloat(fill.getAttribute('data-load'))||0));
    fill.style.setProperty('--dashboard-muscle-scale',String(load/100));
  });
  // New body visualization colorizing
  colorMuscleBodySvg();
}

window.toggleDashboardCoachingInsights=function(){
  dashboardUiState.coachingExpanded=!dashboardUiState.coachingExpanded;
  updateDashboard();
};

function getPreferenceGuidance(profileLike,context){
  const prefs=normalizeTrainingPreferences(profileLike||profile||{});
  const ctx=context||{};
  const lines=[];

  const goalKeyMap={
    strength:'dashboard.pref.goal.strength',
    hypertrophy:'dashboard.pref.goal.hypertrophy',
    general_fitness:'dashboard.pref.goal.general_fitness',
    sport_support:'dashboard.pref.goal.sport_support'
  };
  const goalFallbackMap={
    strength:'Tänään painota teräviä pääsarjoja ja hyvää tangon nopeutta.',
    hypertrophy:'Tänään painota laadukasta volyymia ja hallittuja toistoja.',
    general_fitness:'Pidä sessio tänään kestävänä ja jätä hieman varaa tankkiin.',
    sport_support:'Pidä työ tänään urheilullisena ja vältä grindattuja toistoja.'
  };
  const goalKey=goalKeyMap[prefs.goal]||goalKeyMap.strength;
  const goalFallback=goalFallbackMap[prefs.goal]||goalFallbackMap.strength;
  lines.push(trDash(goalKey,goalFallback));

  if(prefs.sessionMinutes<=45){
    lines.push(trDash('dashboard.pref.time.short','Aikakatto on tiukka, joten tee päätyö ensin ja pidä apuliikkeet tarvittaessa valinnaisina.'));
  }else if(prefs.sessionMinutes>=75&&ctx.canPushVolume){
    lines.push(trDash('dashboard.pref.time.long','Tänään on aikaa täydemmälle sessiolle, joten tee apuliikkeetkin jos palautuminen pysyy hyvänä.'));
  }

  if(prefs.equipmentAccess==='basic_gym'){
    lines.push(trDash('dashboard.pref.equipment.basic_gym','Jos jokin suunniteltu liike ei ole saatavilla, käytä exercise swapia ja pysy lähellä samaa liikemallia.'));
  }else if(prefs.equipmentAccess==='home_gym'){
    lines.push(trDash('dashboard.pref.equipment.home_gym','Kotisali voi vaatia vaihtoja tänään, joten suosi käytännöllisiä variaatioita joita pystyt kuormaamaan hyvin.'));
  }else if(prefs.equipmentAccess==='minimal'){
    lines.push(trDash('dashboard.pref.equipment.minimal','Välineitä on vähän, joten pidä sessio minimitehokkaana annoksena ja vaihda liikkeitä vapaasti tarvittaessa.'));
  }

  return lines;
}

function renderPreferenceGuidance(profileLike,context){
  const lines=getPreferenceGuidance(profileLike,context);
  if(!lines.length)return'';
  const variant=context?.variant||'full';
  if(variant==='compact'){
    const detail=context?.detail?`<div class="dashboard-plan-focus-detail">${escapeHtml(context.detail)}</div>`:'';
    return `<div class="dashboard-plan-focus"><div class="dashboard-plan-focus-label">${escapeHtml(trDash('dashboard.pref.focus_label','Tämän päivän painotus'))}</div><div class="dashboard-plan-focus-copy">${escapeHtml(lines[0])}</div>${detail}</div>`;
  }
  return `<div style="font-size:12px;color:var(--text);margin:0 0 10px;padding:10px 12px;border-radius:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06)">${lines.map(line=>`<div style="margin-top:4px">${escapeHtml(line)}</div>`).join('')}</div>`;
}

function renderPlanStatus(title,body,tone){
  const resolvedTone=tone||'neutral';
  return `<div class="dashboard-plan-status dashboard-plan-status-${resolvedTone}"><div class="dashboard-plan-status-title">${escapeHtml(title)}</div><div class="dashboard-plan-status-body">${escapeHtml(body)}</div></div>`;
}

function getTrainingDecisionSummary(decision,context){
  if(typeof buildTrainingCommentaryState==='function'&&typeof presentTrainingCommentary==='function'){
    const state=buildTrainingCommentaryState({decision,context});
    const summary=presentTrainingCommentary(state,'dashboard_summary');
    if(!summary)return null;
    return{
      title:summary.title,
      body:summary.body,
      tone:summary.tone||state.tone,
      reasons:[...state.reasonCodes],
      reasonLabels:[...(summary.reasonLabels||[])]
    };
  }
  return null;
}

function getTrainingDecisionReasonLabels(decision){
  if(typeof buildTrainingCommentaryState==='function'&&typeof presentTrainingCommentary==='function'){
    const summary=presentTrainingCommentary(buildTrainingCommentaryState({decision}),'dashboard_summary');
    return summary?.reasonLabels||[];
  }
  return[];
}

// WEEK STRIP
function renderWeekStrip(){
  const strip=document.getElementById('week-strip');
  const today=new Date(),todayDow=today.getDay();
  const start=getWeekStart(today);
  const sn=schedule.sportName||trDash('common.sport','Laji');
  strip.innerHTML='';
  for(let i=0;i<7;i++){
    const d=new Date(start);d.setDate(start.getDate()+i);
    const dow=d.getDay(),isToday=d.toDateString()===today.toDateString();
    const logged=workouts.filter(w=>new Date(w.date).toDateString()===d.toDateString());
    const isSportDay=schedule.sportDays.includes(dow);
    const hasLift=logged.some(w=>!isSportWorkout(w)),hasSport=logged.some(w=>isSportWorkout(w));
    const isLogged=hasLift||hasSport;
    const markers=isLogged
      ? '<span class="day-marker is-lift" aria-hidden="true"></span>'
      : (isSportDay?'<span class="day-marker is-scheduled" aria-hidden="true"></span>':'');
    const tooltipParts=[`${DAY_NAMES[dow]} ${d.getDate()}.`];
    if(hasLift)tooltipParts.push(trDash('dashboard.calendar.legend_lift','Treeni kirjattu'));
    if(hasSport)tooltipParts.push(trDash('dashboard.calendar.legend_sport','Lajisessio kirjattu'));
    if(!hasSport&&isSportDay)tooltipParts.push(trDash('dashboard.calendar.legend_scheduled','Suunniteltu lajipäivä'));
    if(!isLogged&&!isSportDay)tooltipParts.push(trDash('dashboard.no_session_logged','Ei kirjattua treeniä'));
    let cls='day-pill';
    if(isToday)cls+=' today';
    else if(isLogged)cls+=' logged';
    else if(isSportDay)cls+=' scheduled';
    else cls+=' free';
    strip.innerHTML+=`<button class="${cls}" type="button" onclick="toggleDayDetail(${i})" title="${escapeHtml(tooltipParts.join(' · '))}" aria-label="${escapeHtml(tooltipParts.join(' · '))}"><div class="day-label">${DAY_NAMES[dow]}</div><div class="day-num">${d.getDate()}</div><div class="day-markers">${markers||'<span class="day-marker-placeholder" aria-hidden="true"></span>'}</div></button>`;
  }
  const todayIsSportDay=schedule.sportDays.includes(todayDow);
  const todayLogged=workouts.filter(w=>new Date(w.date).toDateString()===today.toDateString());
  const tHasLift=todayLogged.some(w=>!isSportWorkout(w)),tHasSport=todayLogged.some(w=>isSportWorkout(w));
  let s='';
  if(tHasLift&&tHasSport)s=`<span class="dashboard-status-line is-success">${trDash('dashboard.status.workout_plus_sport_logged','Treeni + {sport} kirjattu',{sport:sn})}</span>`;
  else if(tHasLift)s=`<span class="dashboard-status-line is-success">${trDash('dashboard.status.workout_logged','Treeni kirjattu')}</span>`;
  else if(tHasSport)s=`<span class="dashboard-status-line is-info">${trDash('dashboard.status.sport_logged','{sport} kirjattu',{sport:sn})}</span>`;
  else if(todayIsSportDay)s=`<span class="dashboard-status-line is-info">${trDash('dashboard.status.sport_day','{sport}-päivä',{sport:sn})}</span>`;
  else s=`<span class="dashboard-status-line is-neutral">${trDash('dashboard.no_session_logged','Ei kirjattua treeniä')}</span>`;
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
        items.push(`<div class="day-detail-item day-detail-item-sport">${w.name||(schedule.sportName||trDash('common.sport','Laji'))}</div>`);
      } else {
        const names=(w.exercises||[]).map(e=>e.name);
        if(names.length)names.forEach(n=>items.push(`<div class="day-detail-item">${n}</div>`));
        else items.push(`<div class="day-detail-item day-detail-item-muted">${trDash('common.workout','Treeni')}</div>`);
      }
    });
    panel.innerHTML=items.join('');
  } else {
    const dow=d.getDay(),isSportDay=schedule.sportDays.includes(dow);
    const label=isSportDay?trDash('dashboard.status.sport_day','{sport}-päivä',{sport:(schedule.sportName||trDash('common.sport','Laji'))}):trDash('dashboard.no_session_logged','Ei kirjattua treeniä');
    panel.innerHTML=`<div class="day-detail-item day-detail-item-muted">${label}</div>`;
  }
  panel.style.display='block';
}

// DASHBOARD
function updateDashboard(){
  document.querySelectorAll('#todays-plan-card > .card-title').forEach(el=>el.remove());
  renderWeekStrip();
  renderWeekLegend();
  const f=computeFatigue();updateFatigueBars(f);
  const prog=getActiveProgram(),ps=getActiveProgramState();
  const programName=window.I18N&&I18N.t?I18N.t('program.'+prog.id+'.name',null,prog.name||'Treeni'):prog.name||'Treeni';

  // Training Maxes - dynamic per program
  const tmGrid=document.getElementById('tm-grid');
  const tmTitle=document.getElementById('tm-section-title');
  if(tmGrid&&prog.getDashboardTMs){
    const tms=prog.getDashboardTMs(ps);
    const tmSignature=tms.map(t=>`${t.name}:${t.value}`).join('|');
    const tmChanged=!!_lastTmSignature&&tmSignature!==_lastTmSignature;
    _lastTmSignature=tmSignature;
    tmGrid.innerHTML=tms.map((t,i)=>{
      const rawValue=String(t.value||'');
      const match=rawValue.match(/^([0-9]+(?:[.,][0-9]+)?)(.*)$/);
      const valueMain=match?match[1]:rawValue;
      const valueUnit=match&&match[2]?match[2].trim():'';
      return `<div class="lift-stat${tmChanged?' tm-updated':''}" style="--tm-delay:${i*65}ms"><div class="value">${escapeHtml(valueMain)}${valueUnit?`<span class="unit">${escapeHtml(valueUnit)}</span>`:''}</div><div class="label">${escapeHtml(dashExerciseName(t.name))}${t.stalled?' ⚠️':''}</div></div>`;
    }).join('');
    if(tmTitle)tmTitle.textContent=prog.dashboardStatsLabel||trDash('dashboard.training_maxes','Treenimaksimit');
  }

  // Weekly session progress
  const now=new Date(),sow=getWeekStart(now);
  const freq=typeof getEffectiveProgramFrequency==='function'
    ? getEffectiveProgramFrequency(prog.id,profile)
    : (ps.daysPerWeek||3);
  const todaySummary=getTodayWorkoutSummary();
  const doneThisWeek=workouts.filter(w=>(w.program===prog.id||(!w.program&&w.type===prog.id))&&new Date(w.date)>=sow).length;
  const sportThisWeek=workouts.filter(w=>isSportWorkout(w)&&new Date(w.date)>=sow).length;
  const sn=schedule.sportName||trDash('common.sport','Laji');
  const sessionProgressEl=document.getElementById('session-progress');
  if(sessionProgressEl)sessionProgressEl.innerHTML=renderSessionProgress(doneThisWeek,freq,sportThisWeek,sn);

  // Today's Plan - unified through plan engine
  const recovery=100-f.overall;
  const bi=prog.getBlockInfo?prog.getBlockInfo(ps):{name:'',weekLabel:'',isDeload:false,pct:null,modeDesc:'',modeName:''};
  const planningContext=typeof buildPlanningContext==='function'
    ? buildPlanningContext({profile,schedule,workouts,activeProgram:prog,activeProgramState:ps,fatigue:f})
    : null;
  const trainingDecision=typeof getTodayTrainingDecision==='function'
    ? getTodayTrainingDecision(planningContext)
    : {action:'train',reasonCodes:[],restrictionFlags:[],timeBudgetMinutes:normalizeTrainingPreferences(profile).sessionMinutes};
  const coachingInsights=typeof getCoachingInsights==='function'
    ? getCoachingInsights({context:planningContext,decision:trainingDecision})
    : null;
  const decisionSummary=getTrainingDecisionSummary(trainingDecision,planningContext||{sessionsRemaining:Math.max(0,freq-doneThisWeek),sportLoad:{}});
  const commentaryState=(typeof buildTrainingCommentaryState==='function')
    ? buildTrainingCommentaryState({decision:trainingDecision,context:planningContext||{sessionsRemaining:Math.max(0,freq-doneThisWeek),sportLoad:{}}})
    : null;
  const focusSupport=(typeof presentTrainingCommentary==='function'&&commentaryState)
    ? presentTrainingCommentary(commentaryState,'dashboard_focus_support')
    : null;
  const coachCommentary=(typeof presentTrainingCommentary==='function'&&commentaryState)
    ? presentTrainingCommentary(commentaryState,'dashboard_coach')
    : null;
  const reasonLabels=decisionSummary?.reasonLabels||getTrainingDecisionReasonLabels(trainingDecision);
  const guidance=getPreferenceGuidance(profile,{
    detail:focusSupport?.text||bi.modeDesc||'',
    canPushVolume:recovery>=70&&trainingDecision.action==='train'&&!bi.isDeload,
    decisionSummary,
    reasonLabels
  });
  const shouldShowStart=trainingDecision.action!=='rest'&&!todaySummary.hasLift;
  const startSlot=document.getElementById('dashboard-start-session-slot');
  if(startSlot){
    startSlot.innerHTML=shouldShowStart
      ? `<div class="dashboard-top-cta"><button class="btn btn-primary cta-btn" type="button" onclick="goToLog()">${trDash('dashboard.start_session','Aloita sessio')}</button></div>`
      : (todaySummary.hasLift?`<div class="dashboard-top-cta"><div class="dashboard-card-head-badge is-positive">${escapeHtml(trDash('dashboard.today_done_badge','Päivän työ tehty'))}</div></div>`:'');
  }
  const todayBadgeEl=document.getElementById('today-plan-badge');
  if(todayBadgeEl){
    todayBadgeEl.className='dashboard-card-head-badge';
    todayBadgeEl.textContent='';
  }
  const rec=renderDashboardTodayPlan({
    focusLine:guidance[0]||'',
    trainingDecision,
    decisionSummary,
    coachCommentary,
    coachingInsights,
    todaySummary
  });
  document.getElementById('next-session-content').innerHTML=rec;
  requestAnimationFrame(animateDashboardPlanMuscleBars);
  document.getElementById('header-sub').textContent=[programName,bi.name||'',bi.weekLabel||''].filter(Boolean).join(' · ');
}

// Initialize muscle body flip listener (event delegation, safe to call once)
initMuscleBodyFlip();
