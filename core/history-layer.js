const HISTORY_ISLAND_EVENT='ironforge:history-updated';
let historyTabState='log';
let historyHeatmapOpen=false;

function hasHistoryIslandMount(){
  return !!document.getElementById('history-react-root');
}

function isHistoryIslandActive(){
  return window.__IRONFORGE_HISTORY_ISLAND_MOUNTED__===true;
}

function notifyHistoryIsland(){
  if(!hasHistoryIslandMount())return;
  window.dispatchEvent(new CustomEvent(HISTORY_ISLAND_EVENT));
}

function switchHistoryTab(tab){
  historyTabState=tab==='stats'?'stats':'log';
  if(isHistoryIslandActive()){
    notifyHistoryIsland();
    return;
  }
  document.querySelectorAll('#page-history .tab').forEach(t=>{
    t.classList.toggle('active',t.dataset.historyTab===historyTabState);
    t.setAttribute('aria-selected',t.dataset.historyTab===historyTabState?'true':'false');
  });
  document.getElementById('history-log').style.display=historyTabState==='log'?'block':'none';
  document.getElementById('history-stats').style.display=historyTabState==='stats'?'block':'none';
  if(historyTabState==='stats')updateStats();
}

function trHist(key,fallback,params){
  if(window.I18N)return I18N.t(key,params,fallback);
  return fallback;
}

function histLocale(){
  return(window.I18N&&I18N.getLanguage()==='fi')?'fi-FI':'en-GB';
}

function histDisplayName(input){
  if(window.EXERCISE_LIBRARY&&EXERCISE_LIBRARY.getDisplayName)return EXERCISE_LIBRARY.getDisplayName(input);
  return String(input||'');
}

// History helpers

function histLiftIcon(name){
  if(!name)return trHist('history.legend.lift','Lift');
  if(name.includes('Squat'))return'SQ';
  if(name.includes('Bench'))return'BP';
  if(name.includes('Deadlift'))return'DL';
  if(name.includes('Press')||name.includes('OHP'))return'PR';
  if(name.includes('Row'))return'RW';
  return trHist('history.legend.lift','Lift');
}

// Build a Set of workout IDs that contain a rep PR on an AMRAP/last-heavy set
function histComputePRs(){
  const sorted=workouts.slice().sort((a,b)=>new Date(a.date)-new Date(b.date));
  const best={}; // "ExerciseName_weight" -> maxReps seen so far
  const prs=new Set();
  for(const w of sorted){
    let hasPR=(parseInt(w?.prCount,10)||0)>0
      || (w.exercises||[]).some(ex=>(ex.sets||[]).some(s=>s?.isPr===true));
    (w.exercises||[]).forEach(ex=>{
      ex.sets.forEach(s=>{
        if(!s.isLastHeavySet&&!s.isAmrap)return;
        if(!s.done)return;
        const reps=parseInt(s.reps);
        if(isNaN(reps)||reps<=0)return;
        const key=ex.name+'_'+(parseFloat(s.weight)||0);
        if(key in best&&reps>best[key])hasPR=true;
      });
    });
    if(hasPR)prs.add(w.id);
    // Update best AFTER checking so first occurrence never auto-qualifies
    (w.exercises||[]).forEach(ex=>{
      ex.sets.forEach(s=>{
        if(!s.isLastHeavySet&&!s.isAmrap)return;
        if(!s.done)return;
        const reps=parseInt(s.reps);
        if(isNaN(reps)||reps<=0)return;
        const key=ex.name+'_'+(parseFloat(s.weight)||0);
        if(!(key in best)||reps>best[key])best[key]=reps;
      });
    });
  }
  return prs;
}

// Estimate recovery (0-100) at time of each workout based on gap + prior RPE
function histComputeRecovery(){
  const sorted=workouts.filter(w=>w.type!=='hockey').sort((a,b)=>new Date(a.date)-new Date(b.date));
  const map={};
  let prev=null;
  for(const w of sorted){
    if(!prev){
      map[w.id]=85; // first session - assume well-rested
    } else {
      const gapDays=(new Date(w.date)-new Date(prev.date))/MS_PER_DAY;
      const prevRPE=prev.rpe||7;
      // Base: gap adds recovery, high-RPE sessions reduce it
      const raw=Math.round(40+(gapDays-1)*25-(prevRPE-7)*4);
      map[w.id]=Math.max(20,Math.min(95,raw));
    }
    prev=w;
  }
  return map;
}

// Group workouts into [{groupLabel, groupIcon, programId, weeks:[{weekLabel, workouts:[]}]}]
// Newest-first within each group and week
function histGroupWorkouts(){
  const groups=new Map();
  const sorted=workouts.slice().sort((a,b)=>new Date(b.date)-new Date(a.date));

  function addToGroup(key,groupLabel,groupIcon,programId,weekKey,weekLabel,w){
    if(!groups.has(key))groups.set(key,{key,groupLabel,groupIcon,programId,weeks:new Map()});
    const g=groups.get(key);
    if(!g.weeks.has(weekKey))g.weeks.set(weekKey,{weekKey,weekLabel,workouts:[]});
    g.weeks.get(weekKey).workouts.push(w);
  }

  for(const w of sorted){
    if(isSportWorkout(w)){
      const sportLabel=w.type==='hockey'?'Hockey':(schedule.sportName||trHist('common.sport','Sport'));
      const mo=new Date(w.date).toLocaleDateString(histLocale(),{month:'long',year:'numeric'});
      addToGroup('sport-'+mo,sportLabel+' - '+mo,trHist('history.sport','Sport'),'sport','all','',w);
      continue;
    }
    const prog=w.program||w.type||'other';
    const meta=w.programMeta||{};
    const cycle=meta.cycle;
    const week=meta.week;

    if(prog==='wendler531'){
      const seasonMap={off:trHist('program.season.off','Off-Season'),in:trHist('program.season.in','In-Season')};
      const seasonLabel=seasonMap[meta.season]||'';
      const gKey='w531-c'+(cycle||'x');
      const gLabel='5/3/1 - Cycle '+(cycle||'?')+(seasonLabel?' - '+seasonLabel:'');
      const gIcon=meta.season==='in'?'IN':'OFF';
      const weekMap={1:trHist('program.w531.wave5','5s Wave'),2:trHist('program.w531.wave3','3s Wave'),3:trHist('program.w531.week531','5/3/1 Week'),4:meta.testWeekPending?trHist('program.w531.tm_test','TM Test'):trHist('program.w531.deload','Deload')};
      const wKey=week?'w'+week:'wx';
      const wLabel=week?trHist('history.week_label','WEEK {week}',{week})+' - '+(weekMap[week]||''):'Ungrouped';
      addToGroup(gKey,gLabel,gIcon,'wendler531',wKey,wLabel,w);
    } else if(prog==='forge'){
      const blockNum=week<=7?1:week<=14?2:3;
      const blockKeys={1:'program.forge.block.hypertrophy',2:'program.forge.block.strength',3:'program.forge.block.peaking'};
      const blockFallbacks={1:'Hypertrophy',2:'Strength',3:'Peaking'};
      const blockRanges={1:{start:1,end:7},2:{start:8,end:14},3:{start:15,end:21}};
      const blockName=trHist(blockKeys[blockNum],blockFallbacks[blockNum]);
      const range=blockRanges[blockNum];
      const gKey='forge-b'+blockNum;
      const gLabel=trHist('history.block_label','{program} – {block} (Wk {start}-{end})',{program:'Forge',block:blockName,start:range.start,end:range.end});
      const wLabel=week?trHist('history.week_label','WEEK {week}',{week}):trHist('dashboard.sessions_left','Sessions');
      addToGroup(gKey,gLabel,'FG','forge',week?'w'+week:'wx',wLabel,w);
    } else if(prog==='stronglifts5x5'){
      addToGroup('sl5x5','StrongLifts 5x5','SL','stronglifts5x5','all','',w);
    } else {
      addToGroup('other',trHist('history.other_sessions','Other Sessions'),trHist('history.legend.lift','Lift'),'other','all','',w);
    }
  }

  return [...groups.values()].map(g=>({...g,weeks:[...g.weeks.values()]}));
}

function histRecoveryStyle(pct){
  if(pct===null||pct===undefined)return null;
  if(pct>=70)return{color:'var(--green)',bg:'rgba(52,211,153,0.12)',border:'rgba(52,211,153,0.3)'};
  if(pct>=45)return{color:'var(--orange)',bg:'rgba(245,158,11,0.12)',border:'rgba(245,158,11,0.3)'};
  return{color:'var(--accent)',bg:'rgba(230,57,70,0.12)',border:'rgba(230,57,70,0.3)'};
}

function histDeleteAction(w,options){
  if(options?.interactive===false)return'';
  const actionLabel=trHist('common.delete','Delete');
  const titleLabel=escapeHtml(histDeleteTitle(w));
  return`<button class="hist-delete-btn" type="button" onclick="deleteWorkout(${w.id})" title="${titleLabel}" aria-label="${titleLabel}">${escapeHtml(actionLabel)}</button>`;
}

function histDeleteTitle(w){
  if(!isSportWorkout(w))return trHist('history.delete_workout','Delete Workout');
  const sportLabel=w.type==='hockey'?'Hockey':(schedule.sportName||trHist('common.sport','Sport'));
  return trHist('history.delete_sport','Delete {sport} Session',{sport:sportLabel});
}

function histDeleteMessage(w,dateStr){
  if(!isSportWorkout(w))return trHist('history.remove_workout_from','Remove workout from {date}?',{date:dateStr});
  const sportLabel=w.type==='hockey'?'Hockey':(schedule.sportName||trHist('common.sport','Sport'));
  return trHist('history.remove_sport_from','Remove {sport} session from {date}?',{sport:sportLabel,date:dateStr});
}

function histRenderCard(w,isPR,recovery,options){
  const d=new Date(w.date);
  const dateStr=d.toLocaleDateString(histLocale(),{weekday:'short',day:'numeric',month:'short'});
  const mins=Math.floor((w.duration||0)/60);
  const isExtra=w.subtype==='extra';

  if(isSportWorkout(w)){
    const sportLabel=w.type==='hockey'?'Hockey':(schedule.sportName||trHist('common.sport','Sport'));
    const sLabel=isExtra?trHist('history.extra_sport_session','Extra {sport} Session',{sport:sportLabel}):trHist('history.sport_session','{sport} Session',{sport:sportLabel});
    return`<div class="hist-card hist-sport-card" data-wid="${w.id}">
      <div class="hist-card-header">
        <div class="hist-card-left">
          <span class="hist-lift-icon hist-icon-sport">${trHist('history.sport','Sport')}</span>
          <div>
            <div class="hist-card-title">${escapeHtml(sLabel)}</div>
            <div class="hist-card-date">${dateStr}</div>
            ${mins>0?`<div class="hist-sport-duration">${mins} min</div>`:''}
          </div>
        </div>
        ${histDeleteAction(w,options)}
      </div>
    </div>`;
  }

  // Primary lift: first main-lift exercise
  const MAIN=['Squat','Bench Press','Deadlift','Overhead Press','OHP'];
  const mainEx=(w.exercises||[]).find(e=>MAIN.some(l=>e.name.includes(l)));
  const liftIcon=histLiftIcon(mainEx?.name||(w.exercises||[])[0]?.name||'');

  // Build card title from programMeta
  const meta=w.programMeta||{};
  let cardTitle;
  if(w.program==='forge'&&meta.week){
    const blockNum=meta.week<=7?1:meta.week<=14?2:3;
    const blockKeys={1:'program.forge.block.hypertrophy',2:'program.forge.block.strength',3:'program.forge.block.peaking'};
    const blockFallbacks={1:'Hypertrophy',2:'Strength',3:'Peaking'};
    const blockName=trHist(blockKeys[blockNum],blockFallbacks[blockNum]);
    const weekDay=trHist('history.card.week_day','Week {week} · Day {day}',{week:meta.week,day:w.programDayNum||1});
    cardTitle=weekDay+' \u2014 '+blockName;
  } else {
    // Fallback: strip emoji from programLabel
    const rawLabel=w.programLabel||'';
    cardTitle=rawLabel.replace(/^[\u{1F300}-\u{1FFFF}\u2600-\u27FF]\s*/u,'').trim()||d.toLocaleDateString(histLocale(),{weekday:'long',day:'numeric',month:'short'});
  }

  // Subtitle: date + session description
  const descPart=w.sessionDescription?' \u00B7 '+w.sessionDescription:'';
  const cardSub=dateStr+descPart;

  // Tonnage
  let tonnage=0;
  (w.exercises||[]).forEach(ex=>{
    ex.sets.filter(s=>s.done).forEach(s=>{
      tonnage+=(parseFloat(s.weight)||0)*(parseInt(s.reps)||0);
    });
  });

  // Badges — recovery + duration inline
  const rs=histRecoveryStyle(recovery);
  const recovBadge=rs?` <span class="hist-recovery-tag" style="background:${rs.bg};color:${rs.color};border-color:${rs.border}">${recovery}%</span>`:'';
  const durationBadge=mins>0?` <span class="hist-meta-tag">${mins}min</span>`:'';
  const prBadge=isPR?` <span class="hist-pr-badge">${escapeHtml(trHist('history.pr_badge','NEW PR'))}</span>`:'';

  // Exercise rows
  const completedExercises=(w.exercises||[]).filter(ex=>ex.sets.some(s=>s.done));
  const exRows=completedExercises.map(ex=>{
    const done=ex.sets.filter(s=>s.done);
    const maxKg=Math.max(...done.map(s=>parseFloat(s.weight)||0));
    const lastHeavy=ex.sets.find(s=>s.isLastHeavySet&&s.done);
    const amrapStr=lastHeavy&&parseInt(lastHeavy.reps)>0
      ?` - <span class="hist-amrap-reps">${lastHeavy.reps}+ reps</span>` :'';
    return`<div class="hist-exercise-row">
      <span>${escapeHtml(histDisplayName(ex.name))}</span>
      <span class="hist-exercise-vol">${done.length}\u00D7${maxKg>0?maxKg+'kg':'bw'}${amrapStr}</span>
    </div>`;
  }).join('');

  // Footer: volume, exercises, RPE
  const exCount=completedExercises.length;
  const volStr=tonnage>0?(tonnage/1000).toFixed(1)+'t':'0t';
  const footerHtml=`<div class="hist-card-footer">
    <span class="hist-footer-stat">${trHist('history.card.volume','Volume')} <span class="hist-footer-val">${volStr}</span></span>
    <span class="hist-footer-stat">${trHist('history.card.exercises','Exercises')} <span class="hist-footer-val">${exCount}</span></span>
    <span class="hist-footer-stat">RPE <span class="hist-footer-val">${w.rpe||'\u2014'}</span></span>
  </div>`;

  return`<div class="hist-card" data-wid="${w.id}">
    <div class="hist-card-header">
      <div class="hist-card-left">
        <span class="hist-lift-icon">${liftIcon}</span>
        <div class="hist-card-copy">
          <div class="hist-card-title">${escapeHtml(cardTitle)}${prBadge}${recovBadge}${durationBadge}</div>
          <div class="hist-card-date">${escapeHtml(cardSub)}</div>
        </div>
      </div>
      ${histDeleteAction(w,options)}
    </div>
    ${exRows?`<div class="hist-exercises">${exRows}</div>`:''}
    ${footerHtml}
  </div>`;
}

function histRenderWeekGroup(wk,isOpen,prSet,recovMap,options){
  if(!wk.weekLabel){
    // No week sub-grouping - render cards flat
    return wk.workouts.map(w=>histRenderCard(w,prSet.has(w.id),recovMap[w.id]??null,options)).join('');
  }
  const count=wk.workouts.length;
  const cards=wk.workouts.map(w=>histRenderCard(w,prSet.has(w.id),recovMap[w.id]??null,options)).join('');
  return`<details class="hist-week-details"${isOpen?' open':''}>
    <summary class="hist-week-toggle">
      <div class="hist-week-toggle-left">
        <span class="hist-week-chevron">v</span>
        <span class="hist-week-label">${escapeHtml(wk.weekLabel)}</span>
      </div>
      <span class="hist-week-count">${count} ${count!==1?trHist('dashboard.sessions_left','sessions'):trHist('dashboard.session_left','session',{count:1})}</span>
    </summary>
    <div class="hist-week-body">${cards}</div>
  </details>`;
}

function histRenderGroup(g,prSet,recovMap,options){
  const total=g.weeks.reduce((n,wk)=>n+wk.workouts.length,0);
  const weeks=g.weeks.map((wk,i)=>histRenderWeekGroup(wk,i===0,prSet,recovMap,options)).join('');
  return`<div class="hist-cycle-group">
    <div class="hist-cycle-header">
      <span class="hist-cycle-icon">${escapeHtml(g.groupIcon)}</span>
      <div>
        <div class="hist-cycle-label">${escapeHtml(g.groupLabel)}</div>
        <div class="hist-cycle-sub">${total} ${total!==1?trHist('dashboard.sessions_left','sessions'):trHist('dashboard.session_left','session',{count:1})}</div>
      </div>
    </div>
    ${weeks}
  </div>`;
}

function histEmptyState(){
  const prog=getActiveProgram();
  const state=getActiveProgramState();
  const bi=prog.getBlockInfo?prog.getBlockInfo(state):null;
  const phaseCard=bi&&(bi.name||bi.modeDesc||bi.weekLabel)?`
    <div class="hist-phase-card">
      <div class="hist-phase-card-label">${trHist('history.current_phase','Current Phase')}</div>
      <div class="hist-phase-card-name">${bi.name||bi.weekLabel||'Week '+state.week}</div>
      ${bi.modeDesc?`<div class="hist-phase-card-desc">${bi.modeDesc}</div>`:''}
    </div>`:'';
  return`<div class="hist-empty">
    <div class="hist-empty-kicker">${trHist('history.activity_title','Activity')}</div>
    <div class="hist-empty-orb"><div class="hist-empty-icon">LOG</div></div>
    <div class="hist-empty-title">${trHist('history.empty_title','No sessions yet')}</div>
    <div class="hist-empty-sub">${trHist('history.empty_sub','Complete your first workout to start building your training history.')}</div>
    <button class="btn btn-primary hist-empty-cta" type="button" onclick="showPage('log',document.querySelectorAll('.nav-btn')[1])">${trHist('history.start_today','Start Today\'s Workout')}</button>
    ${phaseCard}
  </div>`;
}

function buildHeatmapMarkup(isOpen){
  const WEEKS=14;
  const today=new Date();today.setHours(0,0,0,0);

  // Monday of the current week
  const weekStart=getWeekStart(today);

  // Grid starts WEEKS weeks back (Monday)
  const gridStart=new Date(weekStart);gridStart.setDate(weekStart.getDate()-(WEEKS-1)*7);

  // Map each calendar date to what was trained
  const dayMap={};
  workouts.forEach(w=>{
    const d=new Date(w.date);d.setHours(0,0,0,0);
    const k=d.toISOString().slice(0,10);
    if(!dayMap[k])dayMap[k]={lift:false,sport:false};
    if(isSportWorkout(w))dayMap[k].sport=true;
    else dayMap[k].lift=true;
  });

  // Build cells (WEEKS x 7 days)
  const cells=[];
  for(let i=0;i<WEEKS*7;i++){
    const d=new Date(gridStart);d.setDate(gridStart.getDate()+i);
    const k=d.toISOString().slice(0,10);
    cells.push({k,isToday:d.getTime()===today.getTime(),isFuture:d>today,...(dayMap[k]||{})});
  }

  // Week streak: consecutive weeks (newest first) with >=1 lift
  let weekStreak=0;
  for(let i=0;i<WEEKS;i++){
    const ws=new Date(weekStart);ws.setDate(weekStart.getDate()-i*7);
    const we=new Date(ws);we.setDate(ws.getDate()+6);
    const hasLift=workouts.some(w=>{
      if(isSportWorkout(w))return false;
      const wd=new Date(w.date);wd.setHours(0,0,0,0);
      return wd>=ws&&wd<=we;
    });
    if(hasLift){weekStreak++;}
    else if(i===0){/* current week not started yet - don't break streak */}
    else{break;}
  }

  // Sessions per week over last 28 days
  const cut28=new Date(today);cut28.setDate(today.getDate()-27);
  const last28=workouts.filter(w=>!isSportWorkout(w)&&new Date(w.date)>=cut28).length;
  const perWeek=(last28/4).toFixed(1);

  // Total volume in heatmap period
  let totalVol=0;
  workouts.forEach(w=>{
    if(isSportWorkout(w))return;
    const wd=new Date(w.date);wd.setHours(0,0,0,0);
    if(wd>=gridStart&&wd<=today){
      (w.exercises||[]).forEach(ex=>{
        ex.sets.filter(s=>s.done).forEach(s=>{
          totalVol+=(parseFloat(s.weight)||0)*(parseInt(s.reps)||0);
        });
      });
    }
  });
  const volStr=(totalVol/1000).toFixed(1);

  // Week number labels (ISO week)
  const weekNums=[];
  for(let i=0;i<WEEKS;i++){
    const mon=new Date(gridStart);mon.setDate(gridStart.getDate()+i*7);
    const tmp=new Date(mon.getTime());tmp.setDate(tmp.getDate()+3-(tmp.getDay()+6)%7);
    const w1=new Date(tmp.getFullYear(),0,4);
    const wn=1+Math.round(((tmp.getTime()-w1.getTime())/86400000-3+(w1.getDay()+6)%7)/7);
    weekNums.push(wn);
  }
  const weekNumCells=weekNums.map(n=>`<div class="heatmap-week-label">${n}</div>`).join('');

  const DAY_LABELS=histLocale()==='fi-FI'?['M','T','K','T','P','L','S']:['M','T','W','T','F','S','S'];
  const labelCells=DAY_LABELS.map(l=>`<div class="heatmap-day-label">${l}</div>`).join('');
  const gridCells=cells.map(c=>{
    let cls='heatmap-cell';
    if(c.isFuture)cls+=' future';
    else if(c.lift&&c.sport)cls+=' both';
    else if(c.lift)cls+=' lift';
    else if(c.sport)cls+=' sport';
    if(c.isToday)cls+=' today';
    return`<div class="${cls}"></div>`;
  }).join('');

  // Stats
  const streakHtml=weekStreak>0
    ?`<span class="heatmap-stat"><span class="heatmap-stat-val">${weekStreak}vk</span> putki</span>`
    :`<span class="heatmap-stat heatmap-stat-muted">${trHist('history.no_streak','No streak yet')}</span>`;
  const rateHtml=`<span class="heatmap-stat"><span class="heatmap-stat-val">${perWeek}</span> ${trHist('history.lifts_per_week','lifts/wk')}</span>`;
  const volHtml=`<span class="heatmap-stat"><span class="heatmap-stat-val">${volStr}t</span> ${trHist('history.total_volume_label','total volume')}</span>`;

  // Legend (moved to title row)
  const legendHtml=`<div class="heatmap-legend">
    <div class="heatmap-legend-item"><div class="heatmap-legend-dot heatmap-legend-dot-lift"></div>${trHist('history.legend.lift','Lift')}</div>
    <div class="heatmap-legend-item"><div class="heatmap-legend-dot heatmap-legend-dot-sport"></div>${schedule.sportName||trHist('common.sport','Sport')}</div>
  </div>`;

  const inlineStatsHtml=`<div class="heatmap-inline-stats">${streakHtml}${rateHtml}${volHtml}</div>`;
  const openCls=isOpen?' open':'';

  const titleHtml=`<div class="heatmap-title-row" onclick="toggleHeatmap()">
    <span class="heatmap-title">${trHist('history.activity_title','ACTIVITY \u00B7 {weeks} WK',{weeks:WEEKS})} <span class="heatmap-toggle-chevron">▼</span></span>
    ${inlineStatsHtml}
    ${legendHtml}
  </div>`;

  return`<div class="heatmap-wrap${openCls}">
    ${titleHtml}
    <div class="heatmap-collapsible"><div class="heatmap-collapsible-inner">
      <div class="heatmap-board">
        <div></div>
        <div class="heatmap-week-labels">${weekNumCells}</div>
        <div class="heatmap-day-labels">${labelCells}</div>
        <div class="heatmap-grid heatmap-grid-cells">${gridCells}</div>
      </div>
      <div class="heatmap-foot">
        <div class="heatmap-stats">${streakHtml}${rateHtml}${volHtml}</div>
      </div>
    </div></div>
  </div>`;
}

function renderHeatmap(){
  const el=document.getElementById('history-heatmap');
  if(!el)return;
  el.innerHTML=buildHeatmapMarkup(historyHeatmapOpen);
}

function toggleHeatmap(){
  historyHeatmapOpen=!historyHeatmapOpen;
  if(isHistoryIslandActive()){
    notifyHistoryIsland();
    return;
  }
  renderHeatmap();
}

function buildHistoryLogMarkup(options){
  if(!workouts.length)return histEmptyState();
  const prSet=histComputePRs();
  const recovMap=histComputeRecovery();
  const groups=histGroupWorkouts();
  return groups.map(g=>histRenderGroup(g,prSet,recovMap,options)).join('');
}

function renderHistory(){
  if(isHistoryIslandActive()){
    notifyHistoryIsland();
    return;
  }
  renderHeatmap();
  const list=document.getElementById('history-list');
  if(!list)return;
  list.innerHTML=buildHistoryLogMarkup();
  list.querySelectorAll('.hist-card').forEach((el,i)=>el.style.setProperty('--i',Math.min(i,10)));
}

function deleteWorkout(id){
  const w=workouts.find(w=>w.id===id);
  if(!w)return;
  const d=new Date(w.date);
  const dateStr=d.toLocaleDateString(histLocale(),{weekday:'short',day:'numeric',month:'short'});
  showConfirm(histDeleteTitle(w),histDeleteMessage(w,dateStr),async()=>{
    const programsBackup=JSON.parse(JSON.stringify(profile.programs||{}));
    const backup=workouts.find(x=>x.id===id);
    const affectedProgramId=getWorkoutProgramId(backup);
    workouts=workouts.filter(x=>x.id!==id);
    buildExerciseIndex();
    if(affectedProgramId)recomputeProgramStateFromWorkouts(affectedProgramId);
    await softDeleteWorkoutRecord(id);
    await saveWorkouts();
    if(affectedProgramId)await saveProfileData({programIds:[affectedProgramId]});
    renderHistory();updateStats();updateDashboard();updateProgramDisplay();
    showToast(trHist('history.session_deleted','Session deleted'),'var(--muted)',async()=>{
      workouts.push(backup);
      workouts.sort((a,b)=>new Date(a.date)-new Date(b.date));
      profile.programs=programsBackup;
      buildExerciseIndex();
      await upsertWorkoutRecord(backup);
      await saveWorkouts();
      if(affectedProgramId)await saveProfileData({programIds:[affectedProgramId]});
      renderHistory();updateStats();updateDashboard();updateProgramDisplay();
      showToast(trHist('history.session_restored','Session restored!'),'var(--green)');
    });
  });
}

// ── Stats chart helpers ───────────────────────────────────────────────

function _statsWeeklyVolume(n){
  const today=new Date();today.setHours(0,0,0,0);
  const ws0=getWeekStart(today);
  return Array.from({length:n},(_,i)=>{
    const ws=new Date(ws0);ws.setDate(ws0.getDate()-(n-1-i)*7);
    const we=new Date(ws);we.setDate(ws.getDate()+6);
    let vol=0;
    workouts.forEach(w=>{
      if(isSportWorkout(w))return;
      const wd=new Date(w.date);wd.setHours(0,0,0,0);
      if(wd>=ws&&wd<=we)(w.exercises||[]).forEach(ex=>ex.sets.filter(s=>s.done).forEach(s=>{vol+=(parseFloat(s.weight)||0)*(parseInt(s.reps)||0);}));
    });
    const tmp=new Date(ws.getTime());tmp.setDate(tmp.getDate()+3-(tmp.getDay()+6)%7);
    const y1=new Date(tmp.getFullYear(),0,4);
    const wn=1+Math.round(((tmp-y1)/86400000-3+(y1.getDay()+6)%7)/7);
    const wp=trHist('history.stats.week_prefix','W');
    return{vol,label:wp+wn,isCurrent:i===n-1};
  });
}

function _statsLiftProgress(matcher,nWeeks){
  const today=new Date();today.setHours(0,0,0,0);
  const cutoff=new Date(today);cutoff.setDate(today.getDate()-nWeeks*7);
  const pts=[];
  workouts.filter(w=>!isSportWorkout(w)).sort((a,b)=>new Date(a.date)-new Date(b.date)).forEach(w=>{
    const wd=new Date(w.date);wd.setHours(0,0,0,0);
    if(wd<cutoff)return;
    const ex=(w.exercises||[]).find(e=>matcher(e.name));
    if(!ex)return;
    const wts=ex.sets.filter(s=>s.done).map(s=>parseFloat(s.weight)||0).filter(x=>x>0);
    if(wts.length)pts.push({date:wd,weight:Math.max(...wts)});
  });
  return pts;
}

function _svgVolumeBars(weeks){
  const W=300,H=90,padX=4,bottomH=18,topPad=12;
  const chartH=H-bottomH-topPad;
  const n=weeks.length,gap=2;
  const barW=Math.floor((W-padX*2-(n-1)*gap)/n);
  const maxVol=Math.max(...weeks.map(w=>w.vol),1);
  const bars=weeks.map((wk,i)=>{
    const x=padX+i*(barW+gap);
    const h=Math.max(2,Math.round((wk.vol/maxVol)*chartH));
    const y=topPad+chartH-h;
    const op=(wk.vol>0?(0.3+0.7*(i/(n-1))):0.1).toFixed(2);
    const fill=wk.isCurrent?'var(--orange)':'#c46a10';
    return`<rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="2" fill="${fill}" style="--bar-op:${op}" class="stats-bar stats-bar-${i}"/><text x="${x+barW/2}" y="${H-2}" text-anchor="middle" class="stats-wlabel">${wk.label}</text>`;
  }).join('');
  const maxLabel=maxVol>=1000?(maxVol/1000).toFixed(0)+'t':Math.round(maxVol)+'kg';
  return`<svg viewBox="0 0 ${W} ${H}" class="stats-svg"><text x="${W-padX}" y="9" text-anchor="end" class="stats-axis-top">${maxLabel}</text>${bars}</svg>`;
}

function _svgLiftLines(lifts,nWeeks){
  const active=lifts.filter(l=>l.pts.length>=1);
  if(!active.length)return null;
  const W=300,H=160,padX=10,padY=10;
  const today=new Date();today.setHours(0,0,0,0);
  const cutoff=new Date(today);cutoff.setDate(today.getDate()-nWeeks*7);
  const xRange=today.getTime()-cutoff.getTime()||1;
  const allW=active.flatMap(l=>l.pts.map(p=>p.weight));
  const minW=Math.min(...allW)*0.96,maxW=Math.max(...allW)*1.02;
  const wRange=maxW-minW||1;
  const chartW=W-padX*2,chartH=H-padY*2;
  const tx=d=>padX+Math.round(((d.getTime()-cutoff.getTime())/xRange)*chartW);
  const ty=w=>padY+Math.round((1-(w-minW)/wRange)*chartH);
  // Dynamic grid lines based on actual weight range
  const rawStep=wRange/6;
  const mag=Math.pow(10,Math.floor(Math.log10(rawStep||1)));
  const res=rawStep/mag;
  const step=mag*(res<=1.5?1:res<=3?2:res<=7?5:10);
  const gridStart=Math.ceil(minW/step)*step;
  const gridLines=[];
  for(let kg=gridStart;kg<=maxW;kg+=step)gridLines.push(kg);
  const grids=gridLines.map(kg=>{
    const y=ty(kg);
    return`<line x1="${padX}" y1="${y}" x2="${W-padX}" y2="${y}" stroke="var(--border)" stroke-width="0.5" stroke-dasharray="2 4"/><text x="${padX}" y="${y-2}" class="stats-axis-top">${Math.round(kg)} kg</text>`;
  }).join('');
  const lines=active.map(l=>{
    const dots=l.pts.map(p=>`<circle cx="${tx(p.date)}" cy="${ty(p.weight)}" r="${l.pts.length===1?4:2.5}" fill="${l.color}"/>`).join('');
    if(l.pts.length===1)return dots;
    const pts=l.pts.map(p=>`${tx(p.date)},${ty(p.weight)}`).join(' ');
    return`<polyline points="${pts}" fill="none" stroke="${l.color}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" opacity="0.9"/>${dots}`;
  }).join('');
  return`<svg viewBox="0 0 ${W} ${H}" class="stats-svg">${grids}${lines}</svg>`;
}

function buildHistoryStatsMarkup(){
  const liftWks=workouts.filter(w=>!isSportWorkout(w));
  const sportWks=workouts.filter(w=>isSportWorkout(w));
  const m=new Date().getMonth();
  let sets=0;liftWks.filter(w=>new Date(w.date).getMonth()===m).forEach(w=>(w.exercises||[]).forEach(e=>sets+=e.sets.filter(s=>s.done).length));
  const allRPE=workouts.filter(w=>w.rpe).map(w=>w.rpe);
  const avgRPE=allRPE.length?(allRPE.reduce((a,b)=>a+b,0)/allRPE.length).toFixed(1):'\u2014';

  const numbersHtml=`
    <div class="stats-num-card" style="--c:var(--gold)"><div class="stats-num-label">${trHist('history.total_sessions','Total Sessions')}</div><div class="stats-num-val">${liftWks.length}</div></div>
    <div class="stats-num-card" style="--c:var(--blue)"><div class="stats-num-label">${trHist('history.sport_sessions','Sport Sessions')}</div><div class="stats-num-val">${sportWks.length}</div></div>
    <div class="stats-num-card" style="--c:var(--accent)"><div class="stats-num-label">${trHist('history.sets_this_month','Sets This Month')}</div><div class="stats-num-val">${sets}</div></div>
    <div class="stats-num-card" style="--c:var(--purple)"><div class="stats-num-label">${trHist('history.avg_rpe','Avg RPE')}</div><div class="stats-num-val">${avgRPE}</div></div>`;

  const weeks=_statsWeeklyVolume(10);
  const volumeVisible=weeks.some(w=>w.vol>0);
  const volumeHtml=volumeVisible
    ? `<div class="stats-chart-title">${trHist('history.stats.volume','Weekly Volume')}</div>${_svgVolumeBars(weeks)}`
    : '';

  const NWEEKS=16;
  const lifts=[
    {label:trHist('history.stats.lift.squat','Squat'),color:'var(--orange)',pts:_statsLiftProgress(n=>n==='Squat',NWEEKS)},
    {label:trHist('history.stats.lift.bench','Bench'),color:'var(--blue)',pts:_statsLiftProgress(n=>n==='Bench Press',NWEEKS)},
    {label:trHist('history.stats.lift.deadlift','Deadlift'),color:'var(--gold)',pts:_statsLiftProgress(n=>n==='Deadlift',NWEEKS)},
    {label:trHist('history.stats.lift.ohp','OH Press'),color:'var(--purple)',pts:_statsLiftProgress(n=>n==='OHP'||n==='Overhead Press (OHP)',NWEEKS)},
  ];
  const svg=_svgLiftLines(lifts,NWEEKS);
  const strengthVisible=!!svg;
  const legend=strengthVisible
    ? lifts.filter(l=>l.pts.length>0).map(l=>`<span class="stats-legend-item" style="color:${l.color}"><span class="stats-legend-dot" style="background:${l.color}"></span>${l.label}</span>`).join('')
    : '';
  const strengthHtml=strengthVisible
    ? `<div class="stats-chart-title">${trHist('history.stats.strength','Strength Progress')}</div>${svg}<div class="stats-chart-legend">${legend}</div>`
    : '';

  return{
    numbersHtml,
    volumeHtml,
    volumeVisible,
    strengthHtml,
    strengthVisible
  };
}

function updateStats(){
  const stats=buildHistoryStatsMarkup();
  if(isHistoryIslandActive()){
    notifyHistoryIsland();
    return stats;
  }
  const numEl=document.getElementById('stats-numbers-grid');
  if(numEl)numEl.innerHTML=stats.numbersHtml;

  const volEl=document.getElementById('stats-volume-wrap');
  if(volEl){
    volEl.style.display=stats.volumeVisible?'':'none';
    volEl.innerHTML=stats.volumeHtml;
  }

  const strEl=document.getElementById('stats-strength-wrap');
  if(strEl){
    strEl.style.display=stats.strengthVisible?'':'none';
    strEl.innerHTML=stats.strengthHtml;
  }
  return stats;
}

function getHistoryReactSnapshot(){
  const stats=buildHistoryStatsMarkup();
  return{
    tab:historyTabState,
    labels:{
      log:trHist('history.tab.log','Workout Log'),
      stats:trHist('history.tab.stats','Stats')
    },
    heatmapHtml:buildHeatmapMarkup(historyHeatmapOpen),
    logHtml:buildHistoryLogMarkup({interactive:false}),
    stats
  };
}

window.__IRONFORGE_HISTORY_ISLAND_EVENT__=HISTORY_ISLAND_EVENT;
window.getHistoryReactSnapshot=getHistoryReactSnapshot;
