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
function computeFatigue(){
  const now=Date.now();
  const liftS=workouts.filter(w=>!isSportWorkout(w)).sort((a,b)=>new Date(b.date)-new Date(a.date));
  const sportS=workouts.filter(w=>isSportWorkout(w)).sort((a,b)=>new Date(b.date)-new Date(a.date));
  const daysSinceLift=liftS.length?daysSince(liftS[0].date):99;
  const daysSinceSport=sportS.length?daysSince(sportS[0].date):99;
  const last72h=workouts.filter(w=>daysSince(w.date)<3);
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
  if(overallCopyEl)overallCopyEl.textContent=badgeText;
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
  const sessionScale=Math.max(0.75,Math.min(1.25,((parseFloat(workout?.rpe)||7)-5)*0.08+0.9));
  exercises.forEach(ex=>{
    const profile=getExerciseMuscleProfile(ex);
    if(!profile)return;
    const sets=Array.isArray(ex.sets)?ex.sets.filter(set=>set.done!==false).length:0;
    const setCount=sets||0;
    if(!setCount)return;
    (profile.primaryMuscles||[]).forEach(muscle=>{
      totals[muscle]=(totals[muscle]||0)+setCount*1*sessionScale;
    });
    (profile.secondaryMuscles||[]).forEach(muscle=>{
      totals[muscle]=(totals[muscle]||0)+setCount*0.5*sessionScale;
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
  totals.calves=load*0.55;
  totals.core=load*0.25;
  return totals;
}

function getRecentMuscleLoads(days){
  const lookbackDays=Math.max(1,parseInt(days,10)||7);
  const cutoff=Date.now()-lookbackDays*86400000;
  const totals={};
  workouts.forEach(workout=>{
    const ts=new Date(workout.date).getTime();
    if(!Number.isFinite(ts)||ts<cutoff)return;
    const load=isSportWorkout(workout)?getSportWorkoutMuscleLoad(workout):getWorkoutMuscleLoad(workout);
    Object.entries(load).forEach(([muscle,value])=>{
      totals[muscle]=(totals[muscle]||0)+value;
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
  if(value>=8)return'high';
  if(value>=4)return'moderate';
  if(value>=1.5)return'light';
  return null;
}

function getRecentMuscleLoadSummary(days){
  const displayLoads=getRecentDisplayMuscleLoads(days||4);
  return Object.entries(displayLoads)
    .map(([group,value])=>({group,value,level:getDisplayMuscleLoadLevel(value)}))
    .filter(item=>item.level)
    .slice(0,3);
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
    bestDays.length?trDash('dashboard.insights.best_days_line','Treenaat tasaisimmin päivinä {days}.',{days:bestDays.join(' / ')}):'',
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
  const sessionsLeft=context?.sessionsRemaining||0;
  const sportName=context?.sportLoad?.sportName||trDash('common.sport','Laji');
  if(decision.action==='rest'){
    return{
      title:trDash('dashboard.week_complete','Viikko valmis!'),
      body:trDash('dashboard.sessions_done','Kaikki suunnitellut sessiot on jo tehty tälle viikolle. Lepää ja palaudu.'),
      tone:'positive'
    };
  }
  if(decision.action==='deload'){
    return{
      title:trDash('dashboard.high_fatigue_title','Korkea kuormitus - kevennä'),
      body:trDash('dashboard.plan.deload','Palautuminen laahaa, joten pidä päivä kevyenä ja käsittele se kevennyksenä. {count} sessiota on jäljellä tällä viikolla.',{count:sessionsLeft}),
      tone:'warning'
    };
  }
  if(decision.action==='train_light'){
    return{
      title:trDash('dashboard.plan.train_light','Treenaa tänään kevyemmin'),
      body:trDash('dashboard.plan.train_light_body','Voit silti treenata, mutta pidä rasitus maltillisena ja vältä turhaa grindia. {count} sessiota on jäljellä tällä viikolla.',{count:sessionsLeft}),
      tone:'info'
    };
  }
  if(decision.action==='shorten'){
    return{
      title:trDash('dashboard.plan.shorten','Lyhyt sessio tänään'),
      body:trDash('dashboard.plan.shorten_body','Tee päätyö ensin ja karsi apuliikkeitä pysyäksesi aikaraamissa. {count} sessiota on jäljellä tällä viikolla.',{count:sessionsLeft}),
      tone:'neutral'
    };
  }
  if(decision.restrictionFlags.includes('avoid_heavy_legs')){
    return{
      title:trDash('dashboard.post_sport','{sport}n jälkeen',{sport:sportName.toLowerCase()}),
      body:trDash('dashboard.plan.avoid_legs','Lajikuorma on tänään korkea, joten suuntaa sessio pois raskaasta jalkatyöstä aina kun mahdollista. {count} sessiota on jäljellä tällä viikolla.',{count:sessionsLeft}),
      tone:'info'
    };
  }
  return{
    title:trDash('dashboard.training_day','Treenipäivä'),
    body:trDash('dashboard.plan.train','Palautuminen näyttää riittävän hyvältä normaaliin treeniin tänään. {count} sessiota on jäljellä tällä viikolla.',{count:sessionsLeft}),
    tone:'neutral'
  };
}

function getTrainingDecisionReasonLabels(decision){
  const map={
    low_recovery:trDash('dashboard.reason.low_recovery','Heikko palautuminen'),
    conservative_recovery:trDash('dashboard.reason.conservative','Palautumisvaroitus'),
    tight_time_budget:trDash('dashboard.reason.time_budget','35 min raja'),
    sport_load:trDash('dashboard.reason.sport_load','Lajikuorma'),
    equipment_constraint:trDash('dashboard.reason.equipment','Välineet'),
    progression_stall:trDash('dashboard.reason.stall','Eteneminen jumissa'),
    guided_beginner:trDash('dashboard.reason.guided','Ohjattu polku'),
    week_complete:trDash('dashboard.reason.complete','Viikko valmis')
  };
  return(decision.reasonCodes||[]).map(code=>map[code]).filter(Boolean);
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
  if(tHasLift&&tHasSport)s=`<span style="color:var(--green);font-weight:700">${trDash('dashboard.status.workout_plus_sport_logged','Treeni + {sport} kirjattu',{sport:sn})}</span>`;
  else if(tHasLift)s=`<span style="color:var(--green);font-weight:700">${trDash('dashboard.status.workout_logged','Treeni kirjattu')}</span>`;
  else if(tHasSport)s=`<span style="color:var(--blue);font-weight:700">${trDash('dashboard.status.sport_logged','{sport} kirjattu',{sport:sn})}</span>`;
  else if(todayIsSportDay)s=`<span style="color:var(--blue);font-weight:700">${trDash('dashboard.status.sport_day','{sport}-päivä',{sport:sn})}</span>`;
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
        items.push(`<div class="day-detail-item"><span style="color:var(--blue)">${w.name||(schedule.sportName||trDash('common.sport','Laji'))}</span></div>`);
      } else {
        const names=(w.exercises||[]).map(e=>e.name);
        if(names.length)names.forEach(n=>items.push(`<div class="day-detail-item">${n}</div>`));
        else items.push(`<div class="day-detail-item" style="color:var(--muted)">${trDash('common.workout','Treeni')}</div>`);
      }
    });
    panel.innerHTML=items.join('');
  } else {
    const dow=d.getDay(),isSportDay=schedule.sportDays.includes(dow);
    const label=isSportDay?trDash('dashboard.status.sport_day','{sport}-päivä',{sport:(schedule.sportName||trDash('common.sport','Laji'))}):trDash('dashboard.no_session_logged','Ei kirjattua treeniä');
    panel.innerHTML=`<div class="day-detail-item" style="color:var(--muted)">${label}</div>`;
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
  const reasonLabels=getTrainingDecisionReasonLabels(trainingDecision);
  const prefSummaryHtml=`<div class="dashboard-plan-meta">${escapeHtml(getTrainingPreferencesSummary(profile))}</div>`;
  const focusVerdictHtml=renderFocusVerdictCard(profile,{
    detail:bi.modeDesc||'',
    canPushVolume:recovery>=70&&trainingDecision.action==='train'&&!bi.isDeload,
    decisionSummary,
    reasonLabels
  });
  const muscleLoadHtml=renderRecentMuscleLoadSummary(4);
  const coachingHtml=renderCoachingInsightsCard(coachingInsights);
  const shouldShowStart=trainingDecision.action!=='rest';
  const startSlot=document.getElementById('dashboard-start-session-slot');
  if(startSlot)startSlot.innerHTML=shouldShowStart?`<div class="dashboard-top-cta"><button class="btn btn-primary cta-btn" type="button" onclick="goToLog()">${trDash('dashboard.start_session','Aloita sessio')}</button></div>`:'';
  const todayBadgeEl=document.getElementById('today-plan-badge');
  if(todayBadgeEl){
    todayBadgeEl.className=`dashboard-card-head-badge is-${decisionSummary.tone||'neutral'}`;
    todayBadgeEl.textContent=decisionSummary.title||'';
  }
  const rec=focusVerdictHtml
    +muscleLoadHtml
    +coachingHtml
    +prefSummaryHtml;
  document.getElementById('next-session-content').innerHTML=rec;
  document.getElementById('header-sub').textContent=[programName,bi.name||'',bi.weekLabel||''].filter(Boolean).join(' · ');
}

