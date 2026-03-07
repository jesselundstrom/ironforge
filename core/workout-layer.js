function getSportQuickLogMeta(){
  const sportName=(schedule.sportName||'Cardio').trim()||'Cardio';
  const displayName=displaySportName(sportName);
  const normalized=sportName.toLowerCase();
  let icon='S';
  if(normalized.includes('hock'))icon='🏒';
  else if(normalized.includes('run'))icon='🏃';
  else if(normalized.includes('cycl')||normalized.includes('bike'))icon='🚴';
  else if(normalized.includes('swim'))icon='🏊';
  else if(normalized.includes('row'))icon='🚣';
  else if(normalized.includes('soccer')||normalized.includes('football'))icon='⚽';
  else if(normalized.includes('basket'))icon='🏀';
  else if(normalized.includes('tennis'))icon='🎾';
  const subtitle=i18nText('workout.unscheduled_session','Unscheduled {sport} session',{sport:normalized==='cardio'?normalized:displayName});
  return {sportName:displayName,icon,subtitle};
}

function resetNotStartedView(){
  const prog=getActiveProgram();
  const {sportName,icon,subtitle}=getSportQuickLogMeta();
  document.getElementById('workout-not-started').innerHTML=`
    <div class="quick-log-row">
      <div class="quick-log-card ql-sport" onclick="quickLogSport()">
        <div class="ql-icon">${icon}</div>
        <div><div class="ql-title">${i18nText('workout.log_extra','Log Extra {sport}',{sport:sportName})}</div><div class="ql-sub">${subtitle}</div></div>
      </div>
    </div>
    <div class="divider-label"><span>${(prog.icon||'Lift')+' '+(prog.name||'Training')+' '+i18nText('common.session','Session')}</span></div>
    <div class="card" style="padding:20px">
      <div style="font-weight:800;font-size:16px;margin-bottom:4px">${i18nText('workout.start_session','Start a Session')}</div>
      <label style="margin-top:8px">${i18nText('workout.training_day','Training Day')}</label>
      <select id="program-day-select" onchange="onDaySelectChange()"></select>
      <div id="program-week-display" style="margin-top:14px;background:rgba(167,139,250,0.08);border:1px solid rgba(167,139,250,0.2);border-radius:10px;padding:10px 12px;font-size:12px;color:var(--purple)"></div>
      <div style="margin-top:18px"><button class="btn btn-primary" onclick="startWorkout()">${i18nText('workout.start_workout','Start Workout')}</button></div>
    </div>`;
  updateProgramDisplay();
}

function exerciseIdForName(name){
  if(!window.EXERCISE_LIBRARY||!EXERCISE_LIBRARY.resolveExerciseId)return null;
  return EXERCISE_LIBRARY.resolveExerciseId(name)||null;
}

function withResolvedExerciseId(ex){
  if(!ex)return ex;
  const exerciseId=ex.exerciseId||exerciseIdForName(ex.name);
  return exerciseId?{...ex,exerciseId}:{...ex,exerciseId:null};
}

function i18nText(key,fallback,params){
  if(window.I18N&&I18N.t)return I18N.t(key,params,fallback);
  return fallback;
}

function escapeHtml(text){
  return String(text??'')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#39;');
}

function displayExerciseName(input){
  if(window.EXERCISE_LIBRARY&&EXERCISE_LIBRARY.getDisplayName)return EXERCISE_LIBRARY.getDisplayName(input);
  return String(input||'');
}

function displaySportName(input){
  const raw=String(input||'').trim();
  if(!raw)return raw;
  const locale=window.I18N&&I18N.getLanguage?I18N.getLanguage():'en';
  if(locale==='fi'&&raw.toLowerCase()==='hockey')return 'Jääkiekko';
  return raw;
}

function renderExerciseGuidance(ex){
  if(!window.EXERCISE_LIBRARY||!EXERCISE_LIBRARY.getExerciseGuidance){
    return'';
  }
  const guide=EXERCISE_LIBRARY.getExerciseGuidance(ex.exerciseId||ex.name,window.I18N&&I18N.getLanguage?I18N.getLanguage():'en');
  if(!guide){
    return`<div class="last-session" style="margin-top:2px">${escapeHtml(i18nText('guidance.none','No guidance is available for this exercise yet.'))}</div>`;
  }
  const execRows=(guide.execution||[]).map(step=>`<li>${escapeHtml(step)}</li>`).join('');
  const cueRows=(guide.cues||[]).map(cue=>`<li>${escapeHtml(cue)}</li>`).join('');
  const mediaLinks=[];
  if(guide.media?.videoUrl){
    mediaLinks.push(`<a class="exercise-guide-link" href="${escapeHtml(guide.media.videoUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(i18nText('guidance.media.video','Open video'))}</a>`);
  }
  if(guide.media?.imageUrl){
    mediaLinks.push(`<a class="exercise-guide-link" href="${escapeHtml(guide.media.imageUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(i18nText('guidance.media.image','Open image'))}</a>`);
  }
  const mediaHtml=mediaLinks.length?`<div class="exercise-guide-links">${mediaLinks.join('')}</div>`:'';
  return`
    <details class="exercise-guide">
      <summary>${escapeHtml(i18nText('guidance.title','Movement Guide'))}</summary>
      <div class="exercise-guide-grid">
        <div><div class="exercise-guide-title">${escapeHtml(i18nText('guidance.setup','Setup'))}</div><div class="exercise-guide-text">${escapeHtml(guide.setup||'')}</div></div>
        <div><div class="exercise-guide-title">${escapeHtml(i18nText('guidance.execution','Execution'))}</div><ol class="exercise-guide-list">${execRows}</ol></div>
        <div><div class="exercise-guide-title">${escapeHtml(i18nText('guidance.cues','Key cues'))}</div><ul class="exercise-guide-list">${cueRows}</ul></div>
        <div><div class="exercise-guide-title">${escapeHtml(i18nText('guidance.safety','Safety'))}</div><div class="exercise-guide-text">${escapeHtml(guide.safety||'')}</div></div>
        ${mediaHtml}
      </div>
    </details>`;
}

// WORKOUT STARTER
function startWorkout(){
  const prog=getActiveProgram();
  const state=getActiveProgramState();
  const selectedOption=document.getElementById('program-day-select')?.value;

  const exercises=(prog.buildSession(selectedOption,state)||[]).map(withResolvedExerciseId);
  const label=prog.getSessionLabel(selectedOption,state);
  const bi=prog.getBlockInfo?prog.getBlockInfo(state):{isDeload:false};
  const sessionDescription=prog.getSessionDescription
    ? (prog.getSessionDescription(selectedOption,state)||'')
    : (bi.modeDesc||bi.name||'');

  activeWorkout={
    program:prog.id,
    type:prog.id,           // keep type=prog.id for backwards-compat filters
    programOption:selectedOption,
    programDayNum:parseInt(selectedOption)||1,
    programMode:state.mode||undefined,
    programLabel:label,
    sessionDescription,
    exercises,
    startTime:Date.now()
  };

  updateProgramDisplay();
  document.getElementById('workout-not-started').style.display='none';
  document.getElementById('workout-active').style.display='block';
  document.getElementById('active-session-title').textContent=label;
  const descEl=document.getElementById('active-session-description');
  if(descEl){
    const prefix=i18nText('session.description','Session focus');
    descEl.textContent=sessionDescription?(prefix+': '+sessionDescription):'';
    descEl.style.display=sessionDescription?'':'none';
  }
  restDuration=parseInt(document.getElementById('rest-duration')?.value)||profile.defaultRest||120;
  startWorkoutTimer();renderExercises();
  showToast(bi.isDeload?i18nText('workout.deload_light','Deload - keep it light'):(prog.name||'Training'),bi.isDeload?'var(--blue)':'var(--purple)');

  // Sport warning for leg-heavy days
  const legLifts=prog.legLifts||[];
  const todayDow=new Date().getDay();
  const _isSportDay=schedule.sportDays.includes(todayDow);
  const _hadSportRecently=wasSportRecently();
  if((_isSportDay||_hadSportRecently)&&!bi.isDeload&&schedule.sportLegsHeavy!==false){
    const hasLegs=activeWorkout.exercises.some(e=>legLifts.includes(e.name.toLowerCase()));
    const _sn2=schedule.sportName||'Sport';
    if(hasLegs)setTimeout(()=>showToast(i18nText('workout.sport_legs_warning','{sport} legs - consider fewer sets or swapping day order',{sport:_sn2}),'var(--blue)'),1500);
  }
}


// QUICK LOG
function quickLogSport(){
  const {sportName}=getSportQuickLogMeta();
  showConfirm(i18nText('workout.log_extra','Log Extra {sport}',{sport:sportName}),i18nText('workout.log_extra_confirm','Log an extra {sport} session for today?',{sport:sportName.toLowerCase()}),async()=>{
    workouts.push({id:Date.now(),date:new Date().toISOString(),type:'sport',subtype:'extra',duration:5400,exercises:[],rpe:7,sets:0});
    await saveWorkouts();
    showToast(i18nText('workout.extra_logged','Extra {sport} logged!',{sport:sportName}),'var(--accent)');
    updateDashboard();
  });
}
function quickLogHockey(){quickLogSport();}



// WORKOUT LOGGING
function startWorkoutTimer(){
  workoutSeconds=0;
  workoutTimer=setInterval(()=>{
    workoutSeconds++;
    const m=String(Math.floor(workoutSeconds/60)).padStart(2,'0');
    const s=String(workoutSeconds%60).padStart(2,'0');
    document.getElementById('active-session-timer').textContent=m+':'+s;
  },1000);
}

function addExerciseByName(name){
  if(!activeWorkout)return;
  const exerciseId=exerciseIdForName(name);
  const suggested=getSuggested({name,exerciseId});
  activeWorkout.exercises.push({id:Date.now()+Math.random(),exerciseId,name,note:'',sets:[
    {weight:suggested||'',reps:5,done:false,rpe:null},
    {weight:suggested||'',reps:5,done:false,rpe:null},
    {weight:suggested||'',reps:5,done:false,rpe:null}
  ]});
  renderExercises();
}

function renderExercises(){
  const c=document.getElementById('exercises-container');c.innerHTML='';
  activeWorkout.exercises.forEach((ex,ei)=>{
    const prev=getPreviousSets(ex);
    const prevText=prev?i18nText('workout.last_prefix','Last:')+' '+prev.map(s=>s.weight+'kg\u00d7'+s.reps).join(', '):i18nText('workout.no_previous_data','No previous data');
    const suggested=getSuggested(ex);
    const block=document.createElement('div');block.className='exercise-block';
    let badges='';
    if(suggested)badges+=`<div class="suggest-badge">📈 ${i18nText('workout.last_best','Last best: {weight}kg',{weight:suggested})}</div>`;
    if(ex.note)badges+=`<div class="ai-badge">📋 ${escapeHtml(ex.note)}</div>`;
    const guidanceHtml=renderExerciseGuidance(ex);
    let swapBtn='';
    if(ex.isAux&&ex.auxSlotIdx>=0){
      swapBtn=`<button class="btn btn-icon btn-secondary exercise-action-btn" onclick="swapAuxExercise(${ei})" title="${escapeHtml(i18nText('workout.swap','Swap'))}" aria-label="${escapeHtml(i18nText('workout.swap','Swap'))}">${escapeHtml(i18nText('workout.swap','Swap'))}</button>`;
    }
    if(ex.isAccessory){
      swapBtn=`<button class="btn btn-icon btn-secondary exercise-action-btn" onclick="swapBackExercise(${ei})" title="${escapeHtml(i18nText('workout.swap_back','Swap back exercise'))}" aria-label="${escapeHtml(i18nText('workout.swap_back','Swap back exercise'))}">${escapeHtml(i18nText('workout.swap','Swap'))}</button>`;
    }
    const typeLabel=ex.isAux?`<span class="exercise-chip">${escapeHtml(i18nText('workout.aux','AUX'))}</span>`:ex.isAccessory?`<span class="exercise-chip exercise-chip-blue">${escapeHtml(i18nText('workout.back','BACK'))}</span>`:'';
    const badgesHtml=badges?`<div class="exercise-badges">${badges}</div>`:'';

    block.innerHTML=`
      <div class="exercise-top">
        <div class="exercise-header">
          <div class="exercise-title-stack">
            <div class="exercise-title-row">
              <div class="exercise-name">${escapeHtml(displayExerciseName(ex.name))}</div>
              ${typeLabel}
            </div>
            <div class="last-session">${prevText}</div>
          </div>
          <div class="exercise-action-row">${swapBtn}<button class="btn btn-icon btn-secondary exercise-action-btn exercise-remove-btn" onclick="removeEx(${ei})" title="${escapeHtml(i18nText('workout.remove_exercise','Remove exercise'))}" aria-label="${escapeHtml(i18nText('workout.remove_exercise','Remove exercise'))}">✕</button></div>
        </div>
        ${badgesHtml}
      </div>
      ${guidanceHtml}
      <div id="sets-${ei}"></div>
      <button class="btn btn-sm btn-secondary" style="margin-top:8px" onclick="addSet(${ei})">${i18nText('workout.add_set','+ Set')}</button>`;
    c.appendChild(block);
    const sc=document.getElementById('sets-'+ei);
    ex.sets.forEach((set,si)=>{
      const row=document.createElement('div');row.className='set-row';
      const isAmrap=set.isAmrap;
      const mode=activeWorkout?.programMode||'sets';
      const isLastSet=si===ex.sets.length-1;
      const showRir=mode==='rir'&&isLastSet&&!ex.isAccessory;
      const setLabel=isAmrap?i18nText('workout.max_short','MAX'):String(si+1);
      const repVal=isAmrap&&set.reps==='AMRAP'?'':set.reps;
      if(isAmrap)row.style.cssText='background:rgba(167,139,250,0.12);border-radius:8px;padding:2px 0';
      row.innerHTML=`
        <span class="set-num"${isAmrap?' style="color:var(--purple);font-weight:800"':''}>${setLabel}</span>
        <input class="set-input" type="number" placeholder="${escapeHtml(i18nText('workout.weight_placeholder','kg'))}" value="${set.weight}" onchange="updateSet(${ei},${si},'weight',this.value)">
        <input class="set-input" type="number" placeholder="${escapeHtml(isAmrap?i18nText('workout.reps_hit','reps hit'):i18nText('workout.reps_placeholder','reps'))}" value="${repVal}" onchange="updateSet(${ei},${si},'reps',this.value)"${isAmrap?' style="border-color:var(--purple)"':''}>
        ${showRir?`<select class="set-rir" onchange="updateSet(${ei},${si},'rir',this.value)">
          <option value="">${escapeHtml(i18nText('workout.rir','RIR'))}</option><option value="0"${set.rir==='0'||set.rir===0?' selected':''}>0</option><option value="1"${set.rir==='1'||set.rir===1?' selected':''}>1</option><option value="2"${set.rir==='2'||set.rir===2?' selected':''}>2</option><option value="3"${set.rir==='3'||set.rir===3?' selected':''}>3</option><option value="4"${set.rir==='4'||set.rir===4?' selected':''}>4</option><option value="5"${set.rir==='5'||set.rir===5?' selected':''}>5+</option>
        </select>`:''}
        <div class="set-check ${set.done?'done':''}" onclick="toggleSet(${ei},${si})">✓</div>`;
      sc.appendChild(row);
    });
  });
}

function updateSet(ei,si,f,v){activeWorkout.exercises[ei].sets[si][f]=v;}

function toggleSet(ei,si){
  const set=activeWorkout.exercises[ei].sets[si];
  if(!set.done){
    set.done=true;
    // Animate the live element directly - no re-render needed for mark-done
    const exCards=document.querySelectorAll('#exercises-container .exercise-block');
    if(exCards[ei]){
      const rows=exCards[ei].querySelectorAll('.set-row');
      const check=rows[si]?.querySelector('.set-check');
      if(check){
        check.classList.add('done','set-done-anim');
        rows[si].classList.add('set-done-anim');
        check.addEventListener('animationend',()=>check.classList.remove('set-done-anim'),{once:true});
        rows[si].addEventListener('animationend',()=>rows[si].classList.remove('set-done-anim'),{once:true});
      }
    }
    startRestTimer();
  }else{
    set.done=false;set.rir=undefined;renderExercises();
  }
}

function addSet(ei){const ex=activeWorkout.exercises[ei];const l=ex.sets[ex.sets.length-1];ex.sets.push({weight:l?.weight||'',reps:l?.reps||5,done:false,rpe:null});renderExercises();}
function removeEx(ei){activeWorkout.exercises.splice(ei,1);renderExercises();}

function swapAuxExercise(ei){
  const ex=activeWorkout.exercises[ei];
  if(ex.auxSlotIdx<0)return;
  const prog=getActiveProgram();
  const swapInfo=prog.getAuxSwapOptions?prog.getAuxSwapOptions(ex):null;
  if(!swapInfo)return;
  const cat=swapInfo.category||'',opts=swapInfo.options||[];
  const title=cat?i18nText('workout.swap_aux_category','Swap {cat} auxiliary',{cat:cat.charAt(0).toUpperCase()+cat.slice(1)}):i18nText('workout.swap_exercise','Swap exercise');
  let optHtml=opts.map(o=>`<div class="swap-option${o===ex.name?' swap-active':''}" onclick="doAuxSwap(${ei},'${o.replace(/'/g,"\\'")}',${ex.auxSlotIdx})">${escapeHtml(displayExerciseName(o))}</div>`).join('');
  showCustomModal(title,`<div style="max-height:300px;overflow-y:auto">${optHtml}</div>`);
}

function doAuxSwap(ei,newName,slotIdx){
  activeWorkout.exercises[ei].name=newName;
  activeWorkout.exercises[ei].exerciseId=exerciseIdForName(newName);
  const prog=getActiveProgram(),state=getActiveProgramState();
  const newState=prog.onAuxSwap?prog.onAuxSwap(slotIdx,newName,state):state;
  setProgramState(prog.id,newState);
  saveProfileData();
  closeCustomModal();renderExercises();
  showToast(i18nText('workout.swapped_to','Swapped to {name}',{name:displayExerciseName(newName)}),'var(--purple)');
}

function swapBackExercise(ei){
  const prog=getActiveProgram();
  const opts=prog.getBackSwapOptions?prog.getBackSwapOptions():[];
  let optHtml=opts.map(o=>`<div class="swap-option${o===activeWorkout.exercises[ei].name?' swap-active':''}" onclick="doBackSwap(${ei},'${o.replace(/'/g,"\\'")}')"> ${escapeHtml(displayExerciseName(o))}</div>`).join('');
  showCustomModal(i18nText('workout.swap_back_title','Swap Back Exercise'),`<div style="max-height:300px;overflow-y:auto">${optHtml}</div>`);
}

function doBackSwap(ei,newName){
  activeWorkout.exercises[ei].name=newName;
  activeWorkout.exercises[ei].exerciseId=exerciseIdForName(newName);
  const prog=getActiveProgram(),state=getActiveProgramState();
  const newState=prog.onBackSwap?prog.onBackSwap(newName,state):state;
  setProgramState(prog.id,newState);
  saveProfileData();
  closeCustomModal();renderExercises();
  showToast(i18nText('workout.swapped_to','Swapped to {name}',{name:displayExerciseName(newName)}),'var(--purple)');
}

function showCustomModal(title,bodyHtml){
  let m=document.getElementById('custom-swap-modal');
  if(m)m.remove();
  m=document.createElement('div');m.id='custom-swap-modal';
  m.style.cssText='position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.7);padding:20px';
  m.innerHTML=`<div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:20px;max-width:340px;width:100%">
    <div style="font-weight:800;font-size:16px;margin-bottom:14px">${title}</div>
    ${bodyHtml}
    <button class="btn btn-secondary" style="margin-top:14px;width:100%" onclick="closeCustomModal()">${i18nText('common.cancel','Cancel')}</button>
  </div>`;
  m.onclick=e=>{if(e.target===m)closeCustomModal();};
  document.body.appendChild(m);
}

function closeCustomModal(){const m=document.getElementById('custom-swap-modal');if(m)m.remove();}

async function finishWorkout(){
  if(!activeWorkout.exercises.length){showToast(i18nText('workout.add_at_least_one','Add at least one exercise!'),'var(--orange)');return;}
  clearInterval(workoutTimer);skipRest();
  activeWorkout.exercises=activeWorkout.exercises.map(withResolvedExerciseId);
  let totalSets=0;
  activeWorkout.exercises.forEach(e=>{totalSets+=e.sets.length;});

  const sessionRPE = await new Promise(resolve=>{
    showRPEPicker(i18nText('common.session','Session'),-1,(val)=>resolve(val||7));
  });

  const prog=getActiveProgram();
  const programName=window.I18N&&I18N.t?I18N.t('program.'+prog.id+'.name',null,prog.name||'Training'):prog.name||'Training';
  const state=getActiveProgramState();
  const stateBeforeSession=JSON.parse(JSON.stringify(state));

  // Structured state snapshot at session time (program-agnostic; used by history + analytics)
  const programMeta=prog.getWorkoutMeta?prog.getWorkoutMeta(state):{week:state.week,cycle:state.cycle};
  const workoutId=Date.now();
  const workoutDate=new Date().toISOString();

  // Push workout record (keep legacy forge fields for history backwards-compat)
  workouts.push({id:workoutId,date:workoutDate,
    program:prog.id,type:prog.id,
    programOption:activeWorkout.programOption,
    programDayNum:activeWorkout.programDayNum,
    programLabel:activeWorkout.programLabel||'',
    programMeta,
    programStateBefore:stateBeforeSession,
    forgeWeek:state.week||undefined,forgeDayNum:activeWorkout.programDayNum||undefined,
    duration:workoutSeconds,exercises:activeWorkout.exercises,rpe:sessionRPE,sets:totalSets});

  // Adjust program state (TMs, weights, failures, etc.)
  let newState=prog.adjustAfterSession?prog.adjustAfterSession(activeWorkout.exercises,state,activeWorkout.programOption):state;

  // Count sessions this week for advanceState
  const now=new Date(),sow=new Date(now);sow.setDate(now.getDate()-((now.getDay()+6)%7));sow.setHours(0,0,0,0);
  const sessionsThisWeek=workouts.filter(w=>(w.program===prog.id||(!w.program&&w.type===prog.id))&&new Date(w.date)>=sow).length;

  // Advance program state (week, cycle, A/B, etc.)
  const advancedState=prog.advanceState?prog.advanceState(newState,sessionsThisWeek):newState;
  const savedWorkout=workouts[workouts.length-1];
  if(savedWorkout)savedWorkout.programStateAfter=JSON.parse(JSON.stringify(advancedState));

  // Toast on week or cycle advance (any program)
  if(advancedState.cycle!==undefined&&advancedState.cycle!==(newState.cycle)){
    const bi=prog.getBlockInfo?prog.getBlockInfo(advancedState):{name:''};
    setTimeout(()=>showToast(i18nText('workout.next_cycle','{program} - cycle {cycle} starts now.',{program:programName,cycle:advancedState.cycle}),'var(--purple)'),500);
  } else if(advancedState.week!==undefined&&advancedState.week!==newState.week){
    const bi=prog.getBlockInfo?prog.getBlockInfo(advancedState):{name:'',weekLabel:''};
    setTimeout(()=>showToast(i18nText('workout.next_week','{program} - {label} up next!',{program:programName,label:(bi.name||('Week '+advancedState.week))}),'var(--purple)'),500);
  }

  setProgramState(prog.id,advancedState);
  saveProfileData();
  await saveWorkouts();
  buildExerciseIndex();
  activeWorkout=null;
  document.getElementById('workout-not-started').style.display='block';
  document.getElementById('workout-active').style.display='none';
  resetNotStartedView();
  showToast(i18nText('workout.session_saved','Session saved!'));
  updateDashboard();
}

function cancelWorkout(){
  clearInterval(workoutTimer);skipRest();
  activeWorkout=null;
  document.getElementById('workout-not-started').style.display='block';
  document.getElementById('workout-active').style.display='none';
  resetNotStartedView();
  showToast(i18nText('workout.session_discarded','Workout discarded.'));
}
