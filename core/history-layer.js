function switchHistoryTab(tab,e){
  document.querySelectorAll('#page-history .tab').forEach(t=>t.classList.remove('active'));
  e.target.classList.add('active');
  document.getElementById('history-log').style.display=tab==='log'?'block':'none';
  document.getElementById('history-stats').style.display=tab==='stats'?'block':'none';
  if(tab==='stats')updateStats();
}

// History helpers

function histLiftIcon(name){
  if(!name)return'Lift';
  if(name.includes('Squat'))return'SQ';
  if(name.includes('Bench'))return'BP';
  if(name.includes('Deadlift'))return'DL';
  if(name.includes('Press')||name.includes('OHP'))return'PR';
  if(name.includes('Row'))return'RW';
  return'Lift';
}

// Build a Set of workout IDs that contain a rep PR on an AMRAP/last-heavy set
function histComputePRs(){
  const sorted=workouts.slice().sort((a,b)=>new Date(a.date)-new Date(b.date));
  const best={}; // "ExerciseName_weight" -> maxReps seen so far
  const prs=new Set();
  for(const w of sorted){
    let hasPR=false;
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
      const gapDays=(new Date(w.date)-new Date(prev.date))/864e5;
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
      const sportLabel=w.type==='hockey'?'Hockey':(schedule.sportName||'Sport');
      const mo=new Date(w.date).toLocaleDateString('en-GB',{month:'long',year:'numeric'});
      addToGroup('sport-'+mo,sportLabel+' - '+mo,'Sport','sport','all','',w);
      continue;
    }
    const prog=w.program||w.type||'other';
    const meta=w.programMeta||{};
    const cycle=meta.cycle;
    const week=meta.week||w.forgeWeek;

    if(prog==='wendler531'){
      const seasonMap={off:'Off-Season',in:'In-Season'};
      const seasonLabel=seasonMap[meta.season]||'';
      const gKey='w531-c'+(cycle||'x');
      const gLabel='5/3/1 - Cycle '+(cycle||'?')+(seasonLabel?' - '+seasonLabel:'');
      const gIcon=meta.season==='in'?'IN':'OFF';
      const weekMap={1:'5s Wave',2:'3s Wave',3:'5/3/1 Week',4:meta.testWeekPending?'TM Test':'Deload'};
      const wKey=week?'w'+week:'wx';
      const wLabel=week?'Week '+week+' - '+(weekMap[week]||''):'Ungrouped';
      addToGroup(gKey,gLabel,gIcon,'wendler531',wKey,wLabel,w);
    } else if(prog==='forge'){
      const blockNum=week<=7?1:week<=14?2:3;
      const blockNames={1:'Hypertrophy (Wks 1-7)',2:'Strength (Wks 8-14)',3:'Peaking (Wks 15-21)'};
      const gKey='forge-b'+blockNum;
      const gLabel='Forge - '+(blockNames[blockNum]||'Block '+blockNum);
      addToGroup(gKey,gLabel,'Forge','forge',week?'w'+week:'wx',week?'Week '+week:'Sessions',w);
    } else if(prog==='stronglifts5x5'){
      addToGroup('sl5x5','StrongLifts 5x5','SL','stronglifts5x5','all','',w);
    } else {
      addToGroup('other','Other Sessions','Lift','other','all','',w);
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

function histRenderCard(w,isPR,recovery){
  const d=new Date(w.date);
  const dateStr=d.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'short'});
  const mins=Math.floor((w.duration||0)/60);
  const isExtra=w.subtype==='extra';

  if(isSportWorkout(w)){
    const sportLabel=w.type==='hockey'?'Hockey':(schedule.sportName||'Sport');
    const sLabel=isExtra?`Extra ${sportLabel} Session`:`${sportLabel} Session`;
    return`<div class="hist-card hist-sport-card">
      <div class="hist-card-header">
        <div class="hist-card-left">
          <span class="hist-lift-icon">Sport</span>
          <div>
            <div class="hist-card-title">${sLabel}</div>
            <div class="hist-card-date">${dateStr}</div>
            ${mins>0?`<div class="hist-sport-duration">${mins} min</div>`:''}
          </div>
        </div>
        <div class="hist-card-badges">
          <button class="hist-delete-btn" onclick="deleteWorkout(${w.id})" title="Delete">X</button>
        </div>
      </div>
    </div>`;
  }

  // Primary lift: first main-lift exercise
  const MAIN=['Squat','Bench Press','Deadlift','Overhead Press','OHP'];
  const mainEx=(w.exercises||[]).find(e=>MAIN.some(l=>e.name.includes(l)));
  const liftIcon=histLiftIcon(mainEx?.name||(w.exercises||[])[0]?.name||'');

  // Short label - strip emoji from programLabel if present
  const rawLabel=w.programLabel||'';
  const shortLabel=rawLabel.replace(/^[\u{1F300}-\u{1FFFF}\u2600-\u27FF]\s*/u,'').trim()||dateStr;

  // Tonnage
  let tonnage=0;
  (w.exercises||[]).forEach(ex=>{
    ex.sets.filter(s=>s.done).forEach(s=>{
      tonnage+=(parseFloat(s.weight)||0)*(parseInt(s.reps)||0);
    });
  });

  // Badges
  const prBadge=isPR?`<span class="hist-pr-badge">Rep PR</span>`:'';
  const rs=histRecoveryStyle(recovery);
  const recovBadge=rs?`<span class="hist-recovery-tag" style="background:${rs.bg};color:${rs.color};border-color:${rs.border}">${recovery}%</span>`:'';

  // Exercise rows
  const exRows=(w.exercises||[]).filter(ex=>ex.sets.some(s=>s.done)).map(ex=>{
    const done=ex.sets.filter(s=>s.done);
    const maxKg=Math.max(...done.map(s=>parseFloat(s.weight)||0));
    const lastHeavy=ex.sets.find(s=>s.isLastHeavySet&&s.done);
    const amrapStr=lastHeavy&&parseInt(lastHeavy.reps)>0
      ?` - <span class="hist-amrap-reps">${lastHeavy.reps}+ reps</span>` :'';
    return`<div class="hist-exercise-row">
      <span>${ex.name}</span>
      <span class="hist-exercise-vol">${done.length}x${maxKg>0?maxKg+'kg':'bw'}${amrapStr}</span>
    </div>`;
  }).join('');

  const tonnageStr=tonnage>0
    ?`<div class="hist-tonnage">${(tonnage/1000).toFixed(1)} t total volume</div>`:'';

  return`<div class="hist-card">
    <div class="hist-card-header">
      <div class="hist-card-left">
        <span class="hist-lift-icon">${liftIcon}</span>
        <div style="min-width:0">
          <div class="hist-card-title">${shortLabel}</div>
          <div class="hist-card-date">${dateStr}</div>
        </div>
      </div>
      <div class="hist-card-badges">
        ${prBadge}
        ${recovBadge}
        <span class="hist-meta-tag">${mins}min${w.rpe?' - RPE '+w.rpe:''}</span>
        <button class="hist-delete-btn" onclick="deleteWorkout(${w.id})" title="Delete">X</button>
      </div>
    </div>
    ${exRows?`<div class="hist-exercises">${exRows}</div>`:''}
    ${tonnageStr}
  </div>`;
}

function histRenderWeekGroup(wk,isOpen,prSet,recovMap){
  if(!wk.weekLabel){
    // No week sub-grouping - render cards flat
    return wk.workouts.map(w=>histRenderCard(w,prSet.has(w.id),recovMap[w.id]??null)).join('');
  }
  const count=wk.workouts.length;
  const cards=wk.workouts.map(w=>histRenderCard(w,prSet.has(w.id),recovMap[w.id]??null)).join('');
  return`<details class="hist-week-details"${isOpen?' open':''}>
    <summary class="hist-week-toggle">
      <div class="hist-week-toggle-left">
        <span class="hist-week-chevron">v</span>
        <span class="hist-week-label">${wk.weekLabel}</span>
      </div>
      <span class="hist-week-count">${count} session${count!==1?'s':''}</span>
    </summary>
    <div class="hist-week-body">${cards}</div>
  </details>`;
}

function histRenderGroup(g,prSet,recovMap){
  const total=g.weeks.reduce((n,wk)=>n+wk.workouts.length,0);
  const weeks=g.weeks.map((wk,i)=>histRenderWeekGroup(wk,i===0,prSet,recovMap)).join('');
  return`<div class="hist-cycle-group">
    <div class="hist-cycle-header">
      <span class="hist-cycle-icon">${g.groupIcon}</span>
      <div>
        <div class="hist-cycle-label">${g.groupLabel}</div>
        <div class="hist-cycle-sub">${total} session${total!==1?'s':''}</div>
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
      <div class="hist-phase-card-label">Current Phase</div>
      <div class="hist-phase-card-name">${bi.name||bi.weekLabel||'Week '+state.week}</div>
      ${bi.modeDesc?`<div class="hist-phase-card-desc">${bi.modeDesc}</div>`:''}
    </div>`:'';
  return`<div class="hist-empty">
    <div class="hist-empty-icon">Log</div>
    <div class="hist-empty-title">No sessions yet</div>
    <div class="hist-empty-sub">Complete your first workout to start building your training history.</div>
    <button class="btn btn-primary hist-empty-cta" onclick="showPage('log',document.querySelectorAll('.nav-btn')[1])">Start Today's Workout</button>
    ${phaseCard}
  </div>`;
}

function renderHeatmap(){
  const el=document.getElementById('history-heatmap');
  if(!el)return;

  const WEEKS=10;
  const today=new Date();today.setHours(0,0,0,0);

  // Monday of the current week
  const dow=(today.getDay()+6)%7; // 0=Mon ... 6=Sun
  const weekStart=new Date(today);weekStart.setDate(today.getDate()-dow);

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

  // Build 70 cells (WEEKS x 7 days)
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

  const DAY_LABELS=['M','T','W','T','F','S','S'];
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

  const streakHtml=weekStreak>0
    ?`<span class="heatmap-stat"><span class="heatmap-stat-val">${weekStreak}w</span> streak</span>`
    :`<span class="heatmap-stat" style="color:var(--muted)">No streak yet</span>`;
  const rateHtml=`<span class="heatmap-stat"><span class="heatmap-stat-val">${perWeek}</span> lifts/wk</span>`;

  const legendHtml=`<div class="heatmap-legend">
    <div class="heatmap-legend-item"><div class="heatmap-legend-dot" style="background:var(--accent2)"></div>Lift</div>
    <div class="heatmap-legend-item"><div class="heatmap-legend-dot" style="background:var(--blue)"></div>${schedule.sportName||'Sport'}</div>
    <div class="heatmap-legend-item"><div class="heatmap-legend-dot" style="background:var(--purple)"></div>Both</div>
  </div>`;

  el.innerHTML=`<div class="heatmap-wrap">
    <div class="heatmap-grid">${labelCells}</div>
    <div class="heatmap-grid">${gridCells}</div>
    <div class="heatmap-foot">
      <div class="heatmap-stats">${streakHtml}${rateHtml}</div>
      ${legendHtml}
    </div>
  </div>`;
}

function renderHistory(){
  renderHeatmap();
  const list=document.getElementById('history-list');
  if(!workouts.length){list.innerHTML=histEmptyState();return;}
  const prSet=histComputePRs();
  const recovMap=histComputeRecovery();
  const groups=histGroupWorkouts();
  list.innerHTML=groups.map(g=>histRenderGroup(g,prSet,recovMap)).join('');
}

function deleteWorkout(id){
  const w=workouts.find(w=>w.id===id);
  if(!w)return;
  const d=new Date(w.date);
  const label=isSportWorkout(w)?(schedule.sportName||'Sport')+' session':'Workout';
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
  document.getElementById('stat-sport').textContent=workouts.filter(w=>isSportWorkout(w)).length;
  const m=new Date().getMonth();let s=0;
  workouts.filter(w=>new Date(w.date).getMonth()===m&&!isSportWorkout(w)).forEach(w=>w.exercises?.forEach(e=>s+=e.sets.length));
  document.getElementById('stat-sets').textContent=s;
  const allRPE=workouts.filter(w=>w.rpe).map(w=>w.rpe);
  document.getElementById('stat-rpe').textContent=allRPE.length?(allRPE.reduce((a,b)=>a+b,0)/allRPE.length).toFixed(1):'-';
}
