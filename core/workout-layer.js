function getSportQuickLogMeta(){
  const sportName=(schedule.sportName||getDefaultSportName()).trim()||getDefaultSportName();
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
  const subtitle=i18nText('workout.unscheduled_session','Unscheduled {sport} session',{sport:(normalized==='cardio'||normalized==='kestävyys')?displayName.toLowerCase():displayName});
  return {sportName:displayName,icon,subtitle};
}

function resetNotStartedView(){
  const prog=getActiveProgram();
  const progName=(window.I18N&&I18N.t)?I18N.t('program.'+prog.id+'.name',null,prog.name||'Training'):(prog.name||'Training');
  const prefs=normalizeTrainingPreferences(profile);
  const state=getActiveProgramState();
  if(prefs.sportReadinessCheckEnabled&&!pendingSportReadinessSignal)pendingSportReadinessSignal='none';
  const planningContext=typeof buildPlanningContext==='function'
    ? buildPlanningContext({
      profile,
      schedule,
      workouts,
      activeProgram:prog,
      activeProgramState:state,
      fatigue:typeof computeFatigue==='function'?computeFatigue():null,
      sportContext:getPendingSportReadinessContext()
    })
    : null;
  const trainingDecision=typeof getTodayTrainingDecision==='function'
    ? getTodayTrainingDecision(planningContext)
    : null;
  const sportCheckControls=prefs.sportReadinessCheckEnabled
    ? `<div class="sport-readiness-inline">
        <div class="sport-readiness-inline-header">
          <div class="sport-readiness-inline-title">${escapeHtml(i18nText('workout.sport_check.inline_title','Sport context'))}</div>
          <div class="sport-readiness-inline-sub">${escapeHtml(i18nText('workout.sport_check.inline_sub','Use today\'s sport load to guide the session recommendation.'))}</div>
        </div>
        <div class="sport-readiness-inline-grid">
          <button type="button" class="sport-readiness-chip" data-sport-check-option="none" onclick="setPendingSportReadiness('none')">${escapeHtml(i18nText('workout.sport_check.none','No'))}</button>
          <button type="button" class="sport-readiness-chip" data-sport-check-option="yesterday" onclick="setPendingSportReadiness('yesterday')">${escapeHtml(i18nText('workout.sport_check.yesterday','Yes, yesterday'))}</button>
          <button type="button" class="sport-readiness-chip" data-sport-check-option="tomorrow" onclick="setPendingSportReadiness('tomorrow')">${escapeHtml(i18nText('workout.sport_check.tomorrow','Yes, tomorrow'))}</button>
          <button type="button" class="sport-readiness-chip" data-sport-check-option="both" onclick="setPendingSportReadiness('both')">${escapeHtml(i18nText('workout.sport_check.both','Yes, both'))}</button>
        </div>
      </div>`
    : '';
  document.getElementById('workout-not-started').innerHTML=`
    <div class="workout-start-shell">
      <div class="workout-start-header">
        <div class="workout-start-title">${escapeHtml(i18nText('workout.start_session','Start a Session'))}</div>
        <div class="workout-start-subtitle" id="program-week-display">${escapeHtml(progName)}</div>
      </div>
      <input type="hidden" id="program-day-select" value="">
      <div id="program-day-options" class="program-day-options"></div>
      <div id="program-session-preview"></div>
      <div id="program-today-panel"></div>
      <div id="program-warning-panel"></div>
      ${sportCheckControls}
      <div class="workout-start-footer">
        <button class="btn btn-primary cta-btn workout-start-cta" onclick="startWorkout()">${i18nText('workout.start_workout','Start Workout')}</button>
      </div>
    </div>`;
  updateSportReadinessChoiceUI();
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

function arrayify(value){
  if(Array.isArray(value))return value.filter(Boolean);
  if(value===undefined||value===null||value==='')return [];
  return [value];
}

function uniqueList(items){
  return [...new Set((items||[]).filter(Boolean))];
}

let pendingSportReadinessCallback=null;
let pendingSportReadinessSignal='none';
let collapsedExerciseCardState={};
let activeGuideExerciseKey=null;
let exerciseUiKeyCounter=0;
let exerciseListInteractionsBound=false;

function createExerciseUiKey(){
  exerciseUiKeyCounter+=1;
  return `exercise-ui-${Date.now().toString(36)}-${exerciseUiKeyCounter.toString(36)}`;
}

function ensureExerciseUiKey(exercise){
  if(!exercise)return null;
  if(!exercise.uiKey)exercise.uiKey=createExerciseUiKey();
  return exercise.uiKey;
}

function ensureWorkoutExerciseUiKeys(exercises){
  if(!Array.isArray(exercises))return [];
  exercises.forEach(ensureExerciseUiKey);
  return exercises;
}

function ensureActiveWorkoutExerciseUiKeys(){
  return ensureWorkoutExerciseUiKeys(activeWorkout?.exercises);
}

function getExerciseStateKey(exercise){
  return ensureExerciseUiKey(exercise);
}

function getExerciseIndexByUiKey(uiKey){
  ensureActiveWorkoutExerciseUiKeys();
  if(!activeWorkout?.exercises?.length)return -1;
  return activeWorkout.exercises.findIndex(exercise=>exercise.uiKey===uiKey);
}

function getExerciseByUiKey(uiKey){
  const index=getExerciseIndexByUiKey(uiKey);
  return index>=0?activeWorkout.exercises[index]:null;
}

function resetActiveWorkoutUIState(){
  collapsedExerciseCardState={};
  activeGuideExerciseKey=null;
  document.getElementById('exercise-guide-modal')?.classList.remove('active');
}

function isExerciseComplete(exercise){
  return Array.isArray(exercise?.sets)&&exercise.sets.length>0&&exercise.sets.every(set=>set.done===true);
}

function getExerciseCompletionCounts(exercise){
  const total=Array.isArray(exercise?.sets)?exercise.sets.length:0;
  const completed=Array.isArray(exercise?.sets)?exercise.sets.filter(set=>set.done===true).length:0;
  return {completed,total};
}

function isExerciseCardCollapsed(exercise){
  const stateKey=getExerciseStateKey(exercise);
  if(!stateKey)return false;
  if(!isExerciseComplete(exercise)){
    delete collapsedExerciseCardState[stateKey];
    return false;
  }
  if(!(stateKey in collapsedExerciseCardState))collapsedExerciseCardState[stateKey]=true;
  return collapsedExerciseCardState[stateKey]!==false;
}

function setExerciseCardCollapsed(exercise,collapsed){
  const stateKey=getExerciseStateKey(exercise);
  if(!stateKey)return;
  if(!isExerciseComplete(exercise)){
    delete collapsedExerciseCardState[stateKey];
    return;
  }
  collapsedExerciseCardState[stateKey]=collapsed;
}

function isLowerBodyExercise(ex){
  if(!window.EXERCISE_LIBRARY||!EXERCISE_LIBRARY.getExerciseMeta)return false;
  const meta=EXERCISE_LIBRARY.getExerciseMeta(ex?.exerciseId||ex?.name||ex);
  if(!meta)return false;
  const groups=new Set(meta.displayMuscleGroups||[]);
  return groups.has('quads')||groups.has('hamstrings')||groups.has('glutes')||groups.has('calves');
}

function getSportStressLevel(sportContext){
  const signal=sportContext?.legsStress||'none';
  if(signal==='both')return 3;
  if(signal==='yesterday')return 2;
  if(signal==='tomorrow')return 1;
  return 0;
}

function buildSportReadinessContext(signal){
  return{
    legsStress:signal||'none',
    checkedAt:new Date().toISOString(),
    sportName:(schedule?.sportName||getDefaultSportName()).trim()||getDefaultSportName()
  };
}

function getPendingSportReadinessContext(){
  const prefs=normalizeTrainingPreferences(profile);
  if(!prefs.sportReadinessCheckEnabled)return null;
  return buildSportReadinessContext(pendingSportReadinessSignal||'none');
}

function updateSportReadinessChoiceUI(){
  document.querySelectorAll('[data-sport-check-option]').forEach(btn=>{
    btn.classList.toggle('active',btn.getAttribute('data-sport-check-option')===(pendingSportReadinessSignal||'none'));
  });
}

function setPendingSportReadiness(signal){
  pendingSportReadinessSignal=signal||'none';
  updateSportReadinessChoiceUI();
  if(typeof updateProgramDisplay==='function')updateProgramDisplay();
}

function showSportReadinessCheck(callback){
  pendingSportReadinessCallback=callback;
  const sportLabel=displaySportName((schedule?.sportName||getDefaultSportName()).trim()||getDefaultSportName());
  const titleEl=document.getElementById('sport-check-title');
  const subEl=document.getElementById('sport-check-sub');
  if(titleEl)titleEl.textContent=i18nText('workout.sport_check.title','Sport check-in');
  if(subEl)subEl.textContent=i18nText('workout.sport_check.sub','Have you had a leg-heavy {sport} session yesterday, or do you have one tomorrow?',{sport:sportLabel.toLowerCase()});
  document.getElementById('sport-check-modal')?.classList.add('active');
}

function selectSportReadiness(signal){
  document.getElementById('sport-check-modal')?.classList.remove('active');
  pendingSportReadinessSignal=signal||'none';
  updateSportReadinessChoiceUI();
  const cb=pendingSportReadinessCallback;
  pendingSportReadinessCallback=null;
  if(cb)cb(buildSportReadinessContext(signal));
}

function cancelSportReadinessCheck(){
  document.getElementById('sport-check-modal')?.classList.remove('active');
  pendingSportReadinessCallback=null;
}

function cloneWorkoutExercises(exercises){
  return ensureWorkoutExerciseUiKeys((exercises||[]).map(ex=>({
    ...ex,
    sets:Array.isArray(ex?.sets)?ex.sets.map(set=>({...set})):ex?.sets
  })));
}

function getCompletedSetCount(exercise){
  return Array.isArray(exercise?.sets)?exercise.sets.filter(set=>set.done&&!set.isWarmup).length:0;
}

function getRemainingSetCount(exercise){
  return Array.isArray(exercise?.sets)?exercise.sets.filter(set=>!set.done&&!set.isWarmup).length:0;
}

function getWorkoutRemainingWorkSets(){
  if(!activeWorkout?.exercises)return 0;
  return activeWorkout.exercises.reduce((sum,exercise)=>sum+getRemainingSetCount(exercise),0);
}

function getWorkoutCompletedWorkSets(){
  if(!activeWorkout?.exercises)return 0;
  return activeWorkout.exercises.reduce((sum,exercise)=>sum+getCompletedSetCount(exercise),0);
}

function getExercisePriority(exercise){
  if(exercise?.isAccessory)return 1;
  if(exercise?.isAux)return 2;
  return 3;
}

function getActiveWorkoutNextTarget(){
  if(!activeWorkout?.exercises)return null;
  for(let exerciseIndex=0;exerciseIndex<activeWorkout.exercises.length;exerciseIndex++){
    const exercise=activeWorkout.exercises[exerciseIndex];
    for(let setIndex=0;setIndex<(exercise.sets||[]).length;setIndex++){
      const set=exercise.sets[setIndex];
      if(set.done||set.isWarmup)continue;
      const warmupsBefore=exercise.sets.filter((item,idx)=>idx<setIndex&&item.isWarmup).length;
      const setLabel=set.isAmrap?i18nText('workout.max_short','MAX'):String(setIndex+1-warmupsBefore);
      return{
        exerciseIndex,
        setIndex,
        exerciseName:displayExerciseName(exercise.name),
        setLabel,
        reps:set.reps,
        weight:set.weight
      };
    }
  }
  return null;
}

function getRemainingWorkExerciseEntries(workoutLike){
  if(!workoutLike?.exercises)return [];
  return workoutLike.exercises.map((exercise,exerciseIndex)=>({
    exercise,
    exerciseIndex,
    remainingSets:getRemainingSetCount(exercise),
    priority:getExercisePriority(exercise)
  })).filter(item=>item.remainingSets>0);
}

function getActiveWorkoutFinishPoint(workoutLike){
  const activeLike=workoutLike||activeWorkout;
  const remainingEntries=getRemainingWorkExerciseEntries(activeLike);
  if(!remainingEntries.length)return null;
  const decision=activeLike?.planningDecision||{};
  const nextTarget=getActiveWorkoutNextTarget();
  const currentEntry=nextTarget?remainingEntries.find(item=>item.exerciseIndex===nextTarget.exerciseIndex):remainingEntries[0];
  const essentialEntries=remainingEntries.filter(item=>item.priority>=2);
  const targetEntry=(essentialEntries.length?essentialEntries[essentialEntries.length-1]:remainingEntries[0])||currentEntry;
  const sportAware=decision.restrictionFlags?.includes('avoid_heavy_legs');
  if(!targetEntry)return null;
  if(remainingEntries.length===1||targetEntry.exerciseIndex===currentEntry?.exerciseIndex){
    return{
      title:i18nText(
        sportAware?'workout.runner.sport_finish_title':'workout.runner.stop_after_this',
        sportAware?'Good finish point after this lift':'You can stop after this lift'
      ),
      copy:i18nText(
        sportAware?'workout.runner.sport_finish_copy':'workout.runner.stop_after_this_copy',
        sportAware
          ? 'Sport load is high enough that finishing after this lift is a smart call today.'
          : 'Once this lift is done, you have already kept the high-value work in the session.'
      )
    };
  }
  const targetName=displayExerciseName(targetEntry.exercise?.name||'');
  return{
    title:i18nText('workout.runner.stop_after_target','You can stop after {target}',{target:targetName}),
    copy:i18nText(
      sportAware?'workout.runner.sport_finish_copy':'workout.runner.stop_after_target_copy',
      sportAware
        ? 'Sport load is high enough that ending after the key work is a smart call today.'
        : 'That leaves the important work in place and turns the rest into optional volume.'
    )
  };
}

function getLastWorkSetIndex(exercise){
  if(!exercise?.sets?.length)return -1;
  for(let index=exercise.sets.length-1;index>=0;index--){
    if(!exercise.sets[index]?.isWarmup)return index;
  }
  return -1;
}

function shouldPromptForSetRIR(exercise,setIndex){
  if((activeWorkout?.programMode||'sets')!=='rir')return false;
  if(!exercise||exercise.isAccessory)return false;
  return setIndex===getLastWorkSetIndex(exercise);
}

function showSetRIRPrompt(exerciseIndex,setIndex){
  const exercise=activeWorkout?.exercises?.[exerciseIndex];
  const set=exercise?.sets?.[setIndex];
  if(!exercise||!set)return;
  const exerciseName=displayExerciseName(exercise.name);
  const currentValue=set.rir!==undefined&&set.rir!==null&&set.rir!==''?String(set.rir):'';
  const options=['0','1','2','3','4','5+'];
  const buttons=options.map(value=>{
    const normalizedValue=value==='5+'?'5':value;
    const isActive=currentValue===normalizedValue;
    return `<button class="btn btn-secondary${isActive?' active':''}" type="button" onclick="applySetRIR(${exerciseIndex},${setIndex},'${normalizedValue}')">${escapeHtml(value)}</button>`;
  }).join('');
  showCustomModal(
    escapeHtml(i18nText('workout.rir_prompt_title','Last set check-in')),
    `<div style="font-size:13px;line-height:1.5;color:var(--muted);margin-bottom:12px">${escapeHtml(i18nText('workout.rir_prompt_body','How many reps did you still have left after the last work set of {exercise}?',{exercise:exerciseName}))}</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${buttons}</div>
    <button class="btn btn-secondary" style="margin-top:12px;width:100%" type="button" onclick="skipSetRIRPrompt()">${escapeHtml(i18nText('workout.rir_prompt_skip','Skip for now'))}</button>`
  );
}

function applySetRIR(exerciseIndex,setIndex,rirValue){
  const set=activeWorkout?.exercises?.[exerciseIndex]?.sets?.[setIndex];
  if(!set)return;
  set.rir=rirValue;
  closeCustomModal();
  showToast(i18nText('workout.rir_saved','RIR saved'),'var(--blue)');
}

function skipSetRIRPrompt(){
  closeCustomModal();
}

function trimExerciseRemainingSets(exercise,keepUndoneCount){
  if(!Array.isArray(exercise?.sets))return false;
  const nextSets=[];
  let keptUndone=0;
  let changed=false;
  exercise.sets.forEach(set=>{
    if(set.done||set.isWarmup){
      nextSets.push(set);
      return;
    }
    if(keptUndone<keepUndoneCount){
      nextSets.push(set);
      keptUndone++;
      return;
    }
    changed=true;
  });
  if(changed)exercise.sets=nextSets;
  return changed;
}

function reduceRemainingSetTarget(set){
  if(!set||set.done||set.isWarmup)return false;
  const numericReps=parseLoggedRepCount(set.reps);
  if(Number.isFinite(numericReps)&&numericReps>3){
    set.reps=Math.max(3,numericReps-1);
  }
  const numericWeight=parseFloat(set.weight);
  if(Number.isFinite(numericWeight)&&numericWeight>0){
    const rounding=getCurrentWorkoutRounding();
    set.weight=Math.max(0,Math.round((numericWeight*0.95)/rounding)*rounding);
    return true;
  }
  return Number.isFinite(numericReps)&&numericReps>3;
}

function dropTrailingUnstartedExercise(exercises){
  if(!Array.isArray(exercises)||exercises.length<=1)return false;
  for(let index=exercises.length-1;index>=0;index--){
    const exercise=exercises[index];
    const hasDoneWork=Array.isArray(exercise?.sets)&&exercise.sets.some(set=>set.done&&!set.isWarmup);
    const hasUndoneWork=Array.isArray(exercise?.sets)&&exercise.sets.some(set=>!set.done&&!set.isWarmup);
    if(hasDoneWork||!hasUndoneWork)continue;
    exercises.splice(index,1);
    return true;
  }
  return false;
}

function cleanupAdjustedWorkoutExercises(exercises){
  return(exercises||[]).filter(exercise=>{
    const sets=Array.isArray(exercise?.sets)?exercise.sets:[];
    if(!sets.length)return false;
    const hasUndoneWork=sets.some(set=>!set.done&&!set.isWarmup);
    const hasCompletedWork=sets.some(set=>set.done&&!set.isWarmup);
    const hasWarmupsOnly=sets.every(set=>set.isWarmup);
    if(hasWarmupsOnly)return false;
    return hasUndoneWork||hasCompletedWork;
  });
}

function getExerciseMinimumWorkSetTarget(exercise,mode){
  if(mode==='lighten'){
    if(exercise.isAccessory)return 1;
    if(exercise.isAux)return 1;
    return 2;
  }
  return 0;
}

function trimExerciseToWorkSetFloor(exercise,mode){
  const minimumTotal=getExerciseMinimumWorkSetTarget(exercise,mode);
  const completed=getCompletedSetCount(exercise);
  const keepUndone=Math.max(0,minimumTotal-completed);
  return trimExerciseRemainingSets(exercise,keepUndone);
}

function trimOneExtraRemainingSet(exercise,mode){
  const minimumTotal=getExerciseMinimumWorkSetTarget(exercise,mode);
  const completed=getCompletedSetCount(exercise);
  const remaining=getRemainingSetCount(exercise);
  if(remaining<=0)return false;
  const minimumRemaining=Math.max(0,minimumTotal-completed);
  if(remaining<=minimumRemaining)return false;
  return trimExerciseRemainingSets(exercise,remaining-1);
}

function getRunnerAdjustmentLabel(adjustment){
  const map={
    shorten:i18nText('workout.runner.shorten','Shortened session'),
    lighten:i18nText('workout.runner.lighten','Lightened session')
  };
  return map[adjustment?.type]||i18nText('workout.runner.adjusted','Adjusted session');
}

function getRunnerUndoAvailable(workoutLike){
  return !!(workoutLike?.runnerState?.undoSnapshot);
}

function getQuickAdjustmentPreview(mode){
  if(mode==='shorten'){
    return{
      title:i18nText('workout.runner.shorten_confirm_title','Shorten this session?'),
      body:i18nText('workout.runner.shorten_confirm_body','Choose how aggressively to trim the remaining work based on how much time you need to save.')
    };
  }
  return{
    title:i18nText('workout.runner.light_confirm_title','Go lighter this session?'),
    body:i18nText('workout.runner.light_confirm_body','This keeps the session structure mostly intact, but lowers the remaining load and trims a little volume when useful. Use this when recovery feels off.')
  };
}

function showShortenAdjustmentOptions(){
  const preview=getQuickAdjustmentPreview('shorten');
  showCustomModal(
    escapeHtml(preview.title),
    `<div style="font-size:13px;line-height:1.5;color:var(--muted);margin-bottom:14px">${escapeHtml(preview.body)}</div>
    <div style="display:grid;gap:10px">
      <button class="btn btn-secondary" type="button" onclick="selectShortenAdjustment('light')">${escapeHtml(i18nText('workout.runner.shorten_option_light','Save ~5 min'))}</button>
      <div style="font-size:12px;color:var(--muted);margin-top:-4px">${escapeHtml(i18nText('workout.runner.shorten_option_light_body','Remove accessory work only and keep the rest of the structure intact.'))}</div>
      <button class="btn btn-secondary" type="button" onclick="selectShortenAdjustment('medium')">${escapeHtml(i18nText('workout.runner.shorten_option_medium','Save ~10 min'))}</button>
      <div style="font-size:12px;color:var(--muted);margin-top:-4px">${escapeHtml(i18nText('workout.runner.shorten_option_medium_body','Keep at least two work sets per remaining exercise and cut lower-priority volume.'))}</div>
      <button class="btn btn-secondary" type="button" onclick="selectShortenAdjustment('hard')">${escapeHtml(i18nText('workout.runner.shorten_option_hard','Save ~15 min'))}</button>
      <div style="font-size:12px;color:var(--muted);margin-top:-4px">${escapeHtml(i18nText('workout.runner.shorten_option_hard_body','Trim harder: keep two work sets per exercise and drop the last unstarted lift if needed.'))}</div>
    </div>`
  );
}

function selectShortenAdjustment(level){
  closeCustomModal();
  executeQuickWorkoutAdjustment('shorten',level||'medium');
}

function getRunnerPlanSummary(activeLike){
  const workoutLike=activeLike||activeWorkout;
  if(!workoutLike)return null;
  const decision=workoutLike.planningDecision||{};
  const action=workoutLike.runnerState?.mode||decision.action||'train';
  const nextTarget=getActiveWorkoutNextTarget();
  const finishPoint=getActiveWorkoutFinishPoint(workoutLike);
  const completedSets=getWorkoutCompletedWorkSets();
  const remainingSets=getWorkoutRemainingWorkSets();
  let title=i18nText('workout.runner.normal_title','Normal session flow');
  let copy=i18nText('workout.runner.normal_copy','Stay on the main work and move through the remaining sets in order.');
  if(action==='shorten'){
    title=i18nText('workout.runner.shorten_title','Shortened session');
    copy=i18nText('workout.runner.shorten_copy','Accessories and extra volume were cut so you can finish the essential work faster.');
  }else if(action==='train_light'||action==='lighten'||action==='deload'){
    title=i18nText('workout.runner.light_title','Lighter session');
    copy=i18nText('workout.runner.light_copy','Keep the session moving, but leave more in the tank and stop earlier than usual.');
  }else if(decision.restrictionFlags?.includes('avoid_heavy_legs')){
    title=i18nText('workout.runner.sport_title','Sport-aware session');
    copy=i18nText('workout.runner.sport_copy','Leg-heavy work is being kept under control because of surrounding sport load.');
  }
  return{
    title,
    copy,
    completedSets,
    remainingSets,
    nextTarget,
    finishPoint,
    adjustments:workoutLike.runnerState?.adjustments||[]
  };
}

function renderActiveWorkoutPlanPanel(){
  const container=document.getElementById('active-session-plan');
  if(!container)return;
  if(!activeWorkout){
    container.innerHTML='';
    return;
  }
  const summary=getRunnerPlanSummary(activeWorkout);
  const elapsed=getWorkoutElapsedSeconds();
  const minutes=Math.floor(elapsed/60);
  const nextTargetText=summary?.nextTarget
    ? `${summary.nextTarget.exerciseName} · ${i18nText('rpe.set','Set')} ${summary.nextTarget.setLabel}${summary.nextTarget.weight!==''&&summary.nextTarget.weight!==undefined?` · ${summary.nextTarget.weight}kg`:''}${summary.nextTarget.reps!==''&&summary.nextTarget.reps!==undefined?` × ${summary.nextTarget.reps}`:''}`
    : i18nText('workout.runner.done','Main work is done. You can finish here or wrap up optional work.');
  const adjustments=(summary?.adjustments||[]).slice(-3);
  container.innerHTML=`<div class="active-session-plan-card">
    <div class="active-session-plan-top">
      <div>
        <div class="active-session-plan-kicker">${escapeHtml(i18nText('workout.runner.kicker','Session plan'))}</div>
        <div class="active-session-plan-title">${escapeHtml(summary?.title||i18nText('common.session','Session'))}</div>
        <div class="active-session-plan-copy">${escapeHtml(summary?.copy||'')}</div>
      </div>
    </div>
    <div class="active-session-plan-meta">
      <div class="active-session-plan-pill">${escapeHtml(i18nText('workout.runner.completed','{count} sets done',{count:summary?.completedSets||0}))}</div>
      <div class="active-session-plan-pill">${escapeHtml(i18nText('workout.runner.remaining','{count} sets left',{count:summary?.remainingSets||0}))}</div>
      <div class="active-session-plan-pill">${escapeHtml(i18nText('workout.runner.elapsed','{count} min elapsed',{count:minutes}))}</div>
    </div>
    <div class="active-session-progress">
      <div class="active-session-next">${escapeHtml(i18nText('workout.runner.next','Next: {target}',{target:nextTargetText}))}</div>
      ${summary?.finishPoint?`<div class="active-session-finish-point">
        <div class="active-session-finish-title">${escapeHtml(summary.finishPoint.title||'')}</div>
        <div class="active-session-finish-copy">${escapeHtml(summary.finishPoint.copy||'')}</div>
      </div>`:''}
      ${adjustments.length?`<div class="active-session-adjustments">${adjustments.map(item=>`<div class="active-session-adjustment">• ${escapeHtml(item.label||getRunnerAdjustmentLabel(item))}</div>`).join('')}</div>`:''}
    </div>
    <div class="active-session-plan-actions">
      <button class="btn btn-secondary btn-sm" type="button" onclick="applyQuickWorkoutAdjustment('shorten')">${escapeHtml(i18nText('workout.runner.shorten_btn','Shorten'))}</button>
      <button class="btn btn-secondary btn-sm" type="button" onclick="applyQuickWorkoutAdjustment('lighten')">${escapeHtml(i18nText('workout.runner.lighten_btn','Go lighter'))}</button>
      ${getRunnerUndoAvailable(activeWorkout)?`<button class="btn btn-secondary btn-sm btn-full" type="button" onclick="undoQuickWorkoutAdjustment()">${escapeHtml(i18nText('workout.runner.undo_btn','Undo adjustment'))}</button>`:''}
    </div>
  </div>`;
}

function applySportReadinessAdjustments(adjusted,sportContext){
  const changes=[];
  const stressLevel=getSportStressLevel(sportContext);
  if(!stressLevel)return{exercises:adjusted,changes};
  let changed=false;
  adjusted.forEach(ex=>{
    if(!isLowerBodyExercise(ex))return;
    if(ex.isAccessory){
      return;
    }
    if(Array.isArray(ex.sets)&&ex.sets.length){
      const currentCount=ex.sets.length;
      let targetCount=currentCount;
      if(ex.isAux){
        targetCount=stressLevel>=2?Math.min(currentCount,2):Math.min(currentCount,3);
      }else{
        const trimBy=stressLevel>=3?2:1;
        targetCount=Math.max(3,currentCount-trimBy);
      }
      if(targetCount<currentCount){
        ex.sets=ex.sets.slice(0,targetCount);
        changed=true;
      }
    }
  });
  if(changed){
    const keyMap={
      1:['workout.pref_adjustment.sport_tomorrow','Tomorrow looks leg-heavy, so lower-body work was kept slightly lighter.'],
      2:['workout.pref_adjustment.sport_yesterday','Yesterday was leg-heavy, so lower-body work was kept lighter today.'],
      3:['workout.pref_adjustment.sport_both','Leg-heavy sport sits on both sides of this session, so lower-body work was trimmed.']
    };
    const [key,fallback]=keyMap[stressLevel]||keyMap[1];
    changes.push(i18nText(key,fallback));
  }
  return{exercises:adjusted,changes};
}

// Generate warm-up ramp sets for a given working weight.
// 40-59 kg → 1 set (50%×5), 60-79 kg → 2 sets (+70%×3), 80+ kg → 3 sets (+85%×2).
function generateWarmupSets(workingWeight,rounding){
  if(!workingWeight||workingWeight<=0)return[];
  const r=rounding||2.5;
  const snap=v=>Math.max(0,Math.round(v/r)*r);
  const sets=[];
  if(workingWeight>=40)sets.push({weight:snap(workingWeight*0.5),reps:5,done:false,rpe:null,isWarmup:true});
  if(workingWeight>=60)sets.push({weight:snap(workingWeight*0.7),reps:3,done:false,rpe:null,isWarmup:true});
  if(workingWeight>=80)sets.push({weight:snap(workingWeight*0.85),reps:2,done:false,rpe:null,isWarmup:true});
  return sets;
}

// Prepend warm-up sets to main (non-aux, non-accessory) exercises that have a working weight.
function injectWarmupSets(exercises){
  const rounding=getCurrentWorkoutRounding();
  exercises.forEach(ex=>{
    if(ex.isAux||ex.isAccessory||!Array.isArray(ex.sets)||!ex.sets.length)return;
    const firstWeight=parseFloat(ex.sets[0].weight)||ex.tm||0;
    if(firstWeight<=0)return;
    const warmups=generateWarmupSets(firstWeight,rounding);
    if(warmups.length)ex.sets.unshift(...warmups);
  });
}

function applyTrainingPreferencesToExercises(exercises,sportContext){
  if(typeof buildPlanningContext==='function'&&typeof getTodayTrainingDecision==='function'&&typeof buildAdaptiveSessionPlan==='function'){
    const prog=typeof getActiveProgram==='function'?getActiveProgram():null;
    const state=typeof getActiveProgramState==='function'?getActiveProgramState():{};
    const context=buildPlanningContext({
      profile,
      schedule,
      workouts,
      activeProgram:prog,
      activeProgramState:state,
      fatigue:typeof computeFatigue==='function'?computeFatigue():null,
      sportContext
    });
    const decision=getTodayTrainingDecision(context);
    const adapted=buildAdaptiveSessionPlan({programId:prog?.id,baseSession:exercises,context,decision});
    return{
      exercises:adapted.exercises||cloneWorkoutExercises(exercises),
      changes:[...(adapted.adaptationReasons||[])],
      equipmentHint:adapted.equipmentHint||''
    };
  }
  const prefs=normalizeTrainingPreferences(profile);
  const next=cloneWorkoutExercises(exercises);
  const changes=[];

  let adjusted=next;

  if(prefs.goal==='sport_support'){
    const beforeLen=adjusted.length;
    adjusted=adjusted.filter(ex=>!ex.isAccessory);
    if(adjusted.length!==beforeLen){
      changes.push(i18nText('workout.pref_adjustment.sport_support','Accessory work removed to keep the session sharper for sport support.'));
    }
    adjusted.forEach(ex=>{
      if(ex.isAux&&!ex.isAccessory&&Array.isArray(ex.sets)&&ex.sets.length>3){
        ex.sets=ex.sets.slice(0,3);
      }
    });
  }

  if(prefs.sessionMinutes<=45){
    const beforeLen=adjusted.length;
    adjusted=adjusted.filter(ex=>!ex.isAccessory);
    if(adjusted.length!==beforeLen&&!changes.includes(i18nText('workout.pref_adjustment.accessories','Accessory work trimmed for a shorter session.'))){
      changes.push(i18nText('workout.pref_adjustment.accessories','Accessory work trimmed for a shorter session.'));
    }
  }

  if(prefs.sessionMinutes<=30){
    let auxTrimmed=false;
    adjusted.forEach(ex=>{
      if(ex.isAux&&!ex.isAccessory&&Array.isArray(ex.sets)&&ex.sets.length>2){
        ex.sets=ex.sets.slice(0,2);
        auxTrimmed=true;
      }
    });
    if(auxTrimmed){
      changes.push(i18nText('workout.pref_adjustment.aux_volume','Auxiliary volume reduced to fit your time cap.'));
    }
  }else if(prefs.sessionMinutes<=45){
    let auxTrimmed=false;
    adjusted.forEach(ex=>{
      if(ex.isAux&&!ex.isAccessory&&Array.isArray(ex.sets)&&ex.sets.length>3){
        ex.sets=ex.sets.slice(0,3);
        auxTrimmed=true;
      }
    });
    if(auxTrimmed){
      changes.push(i18nText('workout.pref_adjustment.aux_volume','Auxiliary volume reduced to fit your time cap.'));
    }
  }

  const sportAdjusted=applySportReadinessAdjustments(adjusted,sportContext);
  adjusted=sportAdjusted.exercises;
  sportAdjusted.changes.forEach(change=>changes.push(change));

  return{
    exercises:adjusted,
    changes:[...new Set(changes)],
    equipmentHint:(prefs.equipmentAccess==='basic_gym'||prefs.equipmentAccess==='home_gym'||prefs.equipmentAccess==='minimal')
      ? i18nText('workout.pref_adjustment.swap_hint','Use exercise swap freely if your setup does not match the planned lift exactly.')
      : ''
  };
}

function getWorkoutDecisionSummary(decision,context){
  if(!decision||!context)return null;
  const sportName=context.sportLoad?.sportName||i18nText('common.sport','Sport');
  if(decision.action==='deload'){
    return{
      title:i18nText('workout.plan.deload','Deload recommendation'),
      copy:i18nText('workout.plan.deload_copy','Recovery is low, so keep today lighter than normal and reduce grinding.'),
      reasons:decision.reasonCodes||[]
    };
  }
  if(decision.action==='train_light'){
    return{
      title:i18nText('workout.plan.train_light','Conservative training day'),
      copy:i18nText('workout.plan.train_light_copy','Train today, but keep the effort conservative and let the session breathe.'),
      reasons:decision.reasonCodes||[]
    };
  }
  if(decision.action==='shorten'){
    return{
      title:i18nText('workout.plan.shorten','Short session plan'),
      copy:i18nText('workout.plan.shorten_copy','Main work first. Accessories will be trimmed to fit your time cap.'),
      reasons:decision.reasonCodes||[]
    };
  }
  if(decision.restrictionFlags.includes('avoid_heavy_legs')){
    return{
      title:i18nText('workout.plan.sport_load','Sport-aware session'),
      copy:i18nText('workout.plan.sport_load_copy','{sport} load is high around today, so heavier leg work may be trimmed.',{sport:sportName}),
      reasons:decision.reasonCodes||[]
    };
  }
  return{
    title:i18nText('workout.plan.normal','Normal training day'),
    copy:i18nText('workout.plan.normal_copy','Your plan can run normally today.'),
    reasons:decision.reasonCodes||[]
  };
}

function renderWorkoutDecisionPreview(decision,context){
  const summary=getWorkoutDecisionSummary(decision,context);
  if(!summary)return'';
  const reasonMap={
    low_recovery:i18nText('dashboard.reason.low_recovery','Low recovery'),
    conservative_recovery:i18nText('dashboard.reason.conservative','Recovery caution'),
    tight_time_budget:i18nText('dashboard.reason.time_budget','35 min cap'),
    sport_load:i18nText('dashboard.reason.sport_load','Sport load'),
    equipment_constraint:i18nText('dashboard.reason.equipment','Equipment'),
    progression_stall:i18nText('dashboard.reason.stall','Progress stall'),
    guided_beginner:i18nText('dashboard.reason.guided','Guided path'),
    week_complete:i18nText('dashboard.reason.complete','Week complete')
  };
  const reasons=(summary.reasons||[]).map(code=>reasonMap[code]).filter(Boolean);
  return `<div class="workout-decision-card">
    <div class="workout-decision-kicker">${escapeHtml(i18nText('workout.plan.kicker',"Today's decision"))}</div>
    <div class="workout-decision-title">${escapeHtml(summary.title)}</div>
    <div class="workout-decision-copy">${escapeHtml(summary.copy)}</div>
    ${reasons.length?`<div class="workout-decision-reasons">${reasons.map(reason=>`<div class="workout-decision-chip">${escapeHtml(reason)}</div>`).join('')}</div>`:''}
  </div>`;
}

// escapeHtml() is defined globally in i18n-layer.js (loaded first)

function displayExerciseName(input){
  if(window.EXERCISE_LIBRARY&&EXERCISE_LIBRARY.getDisplayName)return EXERCISE_LIBRARY.getDisplayName(input);
  return String(input||'');
}

function displaySportName(input){
  const raw=String(input||'').trim();
  if(!raw)return raw;
  const locale=window.I18N&&I18N.getLanguage?I18N.getLanguage():'en';
  if(locale==='fi'&&raw.toLowerCase()==='hockey')return 'Jääkiekko';
  if(locale==='fi'&&raw.toLowerCase()==='cardio')return 'Kestävyys';
  if(locale==='en'&&raw.toLowerCase()==='kestävyys')return 'Cardio';
  return raw;
}

function getExerciseGuide(ex){
  if(!ex||!window.EXERCISE_LIBRARY||!EXERCISE_LIBRARY.getExerciseGuidance){
    return null;
  }
  const guide=EXERCISE_LIBRARY.getExerciseGuidance(ex.exerciseId||ex.name,window.I18N&&I18N.getLanguage?I18N.getLanguage():'en');
  if(!guide){
    return null;
  }
  return guide;
}

function renderActiveExerciseGuideModal(){
  const exercise=activeGuideExerciseKey?getExerciseByUiKey(activeGuideExerciseKey):null;
  const guide=getExerciseGuide(exercise);
  if(!exercise||!guide)return;
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
  const titleEl=document.getElementById('exercise-guide-modal-title');
  const subEl=document.getElementById('exercise-guide-modal-sub');
  const bodyEl=document.getElementById('exercise-guide-modal-body');
  if(titleEl)titleEl.textContent=displayExerciseName(exercise.name);
  if(subEl)subEl.textContent=i18nText('guidance.title','Movement Guide');
  if(bodyEl){
    bodyEl.innerHTML=`
      <div class="exercise-guide-grid">
        <div><div class="exercise-guide-title">${escapeHtml(i18nText('guidance.setup','Setup'))}</div><div class="exercise-guide-text">${escapeHtml(guide.setup||'')}</div></div>
        <div><div class="exercise-guide-title">${escapeHtml(i18nText('guidance.execution','Execution'))}</div><ol class="exercise-guide-list">${execRows}</ol></div>
        <div><div class="exercise-guide-title">${escapeHtml(i18nText('guidance.cues','Key cues'))}</div><ul class="exercise-guide-list">${cueRows}</ul></div>
        <div><div class="exercise-guide-title">${escapeHtml(i18nText('guidance.safety','Safety'))}</div><div class="exercise-guide-text">${escapeHtml(guide.safety||'')}</div></div>
        ${mediaHtml}
      </div>`;
  }
  document.getElementById('exercise-guide-modal')?.classList.add('active');
}

function refreshExerciseGuideModal(){
  const modal=document.getElementById('exercise-guide-modal');
  if(!modal?.classList.contains('active'))return;
  const exercise=activeGuideExerciseKey?getExerciseByUiKey(activeGuideExerciseKey):null;
  if(!exercise||!getExerciseGuide(exercise)){
    closeExerciseGuide();
    return;
  }
  renderActiveExerciseGuideModal();
}

function openExerciseGuide(exerciseRef){
  const exercise=typeof exerciseRef==='string'
    ? getExerciseByUiKey(exerciseRef)
    : activeWorkout?.exercises?.[exerciseRef];
  const guide=getExerciseGuide(exercise);
  if(!exercise||!guide)return;
  activeGuideExerciseKey=ensureExerciseUiKey(exercise);
  renderActiveExerciseGuideModal();
}

function closeExerciseGuide(event){
  if(event&&event.target!==event.currentTarget)return;
  activeGuideExerciseKey=null;
  document.getElementById('exercise-guide-modal')?.classList.remove('active');
}

function renderExerciseGuideButton(exercise){
  if(!getExerciseGuide(exercise))return'';
  return `<button class="btn btn-blue btn-sm exercise-guide-open-btn" type="button" data-action="open-guide">${escapeHtml(i18nText('guidance.title','Movement Guide'))}</button>`;
}

function renderExerciseCollapsedSummary(exercise){
  const counts=getExerciseCompletionCounts(exercise);
  return `
    <button class="exercise-collapse-summary" type="button" data-action="expand-exercise">
      <div class="exercise-collapse-main">
        <div class="exercise-collapse-name">${escapeHtml(displayExerciseName(exercise.name))}</div>
        <div class="exercise-collapse-meta">${escapeHtml(i18nText('workout.completed_sets','{completed}/{total} sets done',{completed:counts.completed,total:counts.total}))}</div>
      </div>
      <div class="exercise-collapse-status">
        <span class="exercise-collapse-badge">${escapeHtml(i18nText('common.done','Done'))}</span>
      </div>
    </button>`;
}

function expandCompletedExercise(exerciseRef){
  const exercise=typeof exerciseRef==='string'
    ? getExerciseByUiKey(exerciseRef)
    : activeWorkout?.exercises?.[exerciseRef];
  if(!exercise)return;
  setExerciseCardCollapsed(exercise,false);
  updateExerciseCard(ensureExerciseUiKey(exercise));
}

function getExerciseSetsId(exercise){
  return `sets-${ensureExerciseUiKey(exercise)}`;
}

function getSetInputId(exerciseRef,setIndex,field){
  const uiKey=typeof exerciseRef==='string'?exerciseRef:ensureExerciseUiKey(exerciseRef);
  return `set-input-${uiKey}-${setIndex}-${field}`;
}

function getSetRowSelector(setIndex){
  return `.set-row[data-set-index="${setIndex}"]`;
}

function buildSetGridHeader(){
  return `
    <div class="set-grid-header">
      <span class="set-grid-spacer" aria-hidden="true"></span>
      <div class="set-col-label">${escapeHtml(i18nText('workout.weight_placeholder','kg'))}</div>
      <div class="set-col-label">${escapeHtml(i18nText('workout.reps_placeholder','reps'))}</div>
      <span class="set-grid-spacer" aria-hidden="true"></span>
    </div>`;
}

function buildSetRow(exercise,exerciseIndex,setIndex,set){
  const uiKey=ensureExerciseUiKey(exercise);
  const isAmrap=set.isAmrap;
  const warmupsBefore=exercise.sets.filter((s,i)=>i<setIndex&&s.isWarmup).length;
  const setLabel=set.isWarmup?'W':isAmrap?i18nText('workout.max_short','MAX'):String(setIndex+1-warmupsBefore);
  const repVal=isAmrap&&set.reps==='AMRAP'?'':set.reps;
  const rowClass=['set-row'];
  if(set.isWarmup)rowClass.push('set-warmup');
  if(set.done)rowClass.push('is-done');
  if(isAmrap)rowClass.push('set-amrap');
  return `
    <div class="${rowClass.join(' ')}" data-set-index="${setIndex}">
      <span class="set-num"${isAmrap?' style="color:var(--purple);font-weight:800"':''}>${setLabel}</span>
      <input id="${getSetInputId(uiKey,setIndex,'weight')}" class="set-input" type="number" inputmode="decimal" min="0" max="999" step="any" data-field="weight" data-set-index="${setIndex}" data-exercise-index="${exerciseIndex}" placeholder="${escapeHtml(i18nText('workout.weight_placeholder','kg'))}" value="${escapeHtml(String(set.weight??''))}">
      <input id="${getSetInputId(uiKey,setIndex,'reps')}" class="set-input" type="number" inputmode="numeric" min="0" max="999" data-field="reps" data-set-index="${setIndex}" data-exercise-index="${exerciseIndex}" placeholder="${escapeHtml(isAmrap?i18nText('workout.reps_hit','reps hit'):i18nText('workout.reps_placeholder','reps'))}" value="${escapeHtml(String(repVal??''))}"${isAmrap?' style="border-color:var(--purple)"':''}>
      <button class="set-check ${set.done?'done':''}" type="button" data-action="toggle-set" data-set-index="${setIndex}" data-exercise-index="${exerciseIndex}">✓</button>
    </div>`;
}

function getExercisesContainer(){
  return document.getElementById('exercises-container');
}

function getExerciseCardElement(uiKey){
  const container=getExercisesContainer();
  if(!container||!uiKey)return null;
  return container.querySelector(`.exercise-block[data-ui-key="${uiKey}"]`);
}

function syncExerciseCardIndexes(){
  const container=getExercisesContainer();
  if(!container)return;
  Array.from(container.querySelectorAll('.exercise-block[data-ui-key]')).forEach(card=>{
    const index=getExerciseIndexByUiKey(card.dataset.uiKey||'');
    if(index>=0)card.dataset.exerciseIndex=String(index);
  });
}

function createExerciseCardElement(exercise,exerciseIndex){
  const uiKey=ensureExerciseUiKey(exercise);
  const prev=getPreviousSets(exercise);
  const prevText=prev?i18nText('workout.last_prefix','Last:')+' '+prev.map(set=>set.weight+'kg×'+set.reps).join(', '):i18nText('workout.no_previous_data','No previous data');
  const suggested=getSuggested(exercise);
  const isComplete=isExerciseComplete(exercise);
  const isCollapsed=isExerciseCardCollapsed(exercise);
  const block=document.createElement('div');
  block.className='exercise-block'+(isComplete?' exercise-block-complete':'')+(isCollapsed?' is-collapsed':'');
  block.dataset.uiKey=uiKey;
  block.dataset.exerciseIndex=String(exerciseIndex);

  if(isCollapsed){
    block.innerHTML=renderExerciseCollapsedSummary(exercise);
    return block;
  }

  let badges='';
  if(suggested)badges+=`<div class="suggest-badge">📈 ${i18nText('workout.last_best','Last best: {weight}kg',{weight:suggested})}</div>`;
  const guideButtonHtml=renderExerciseGuideButton(exercise);
  let swapBtn='';
  if(exercise.isAux&&exercise.auxSlotIdx>=0){
    swapBtn=`<button class="btn btn-secondary exercise-action-btn exercise-swap-btn" type="button" data-action="swap-aux" title="${escapeHtml(i18nText('workout.swap','Swap'))}" aria-label="${escapeHtml(i18nText('workout.swap','Swap'))}">${escapeHtml(i18nText('workout.swap','Swap'))}</button>`;
  }
  if(exercise.isAccessory){
    swapBtn=`<button class="btn btn-secondary exercise-action-btn exercise-swap-btn" type="button" data-action="swap-back" title="${escapeHtml(i18nText('workout.swap_back','Swap back exercise'))}" aria-label="${escapeHtml(i18nText('workout.swap_back','Swap back exercise'))}">${escapeHtml(i18nText('workout.swap','Swap'))}</button>`;
  }
  const typeLabel=exercise.isAux?`<span class="exercise-chip">${escapeHtml(i18nText('workout.aux','AUX'))}</span>`:exercise.isAccessory?`<span class="exercise-chip exercise-chip-blue">${escapeHtml(i18nText('workout.back','BACK'))}</span>`:'';
  const badgesHtml=badges?`<div class="exercise-badges">${badges}</div>`:'';
  const guideRowHtml=guideButtonHtml?`<div class="exercise-secondary-row">${guideButtonHtml}</div>`:'';
  const setsHtml=buildSetGridHeader()+exercise.sets.map((set,setIndex)=>buildSetRow(exercise,exerciseIndex,setIndex,set)).join('');

  block.innerHTML=`
    <div class="exercise-top">
      <div class="exercise-header">
        <div class="exercise-title-stack">
          <div class="exercise-title-row">
            <div class="exercise-name">${escapeHtml(displayExerciseName(exercise.name))}</div>
            ${typeLabel}
          </div>
          <div class="last-session">${prevText}</div>
        </div>
        <div class="exercise-action-row">${swapBtn}<button class="btn btn-icon btn-secondary exercise-action-btn exercise-remove-btn" type="button" data-action="remove-exercise" title="${escapeHtml(i18nText('workout.remove_exercise','Remove exercise'))}" aria-label="${escapeHtml(i18nText('workout.remove_exercise','Remove exercise'))}">✕</button></div>
      </div>
      ${badgesHtml}
    </div>
    ${guideRowHtml}
    <div id="${getExerciseSetsId(exercise)}" class="exercise-sets">${setsHtml}</div>
    <button class="btn btn-sm btn-secondary" style="margin-top:8px" type="button" data-action="add-set">${i18nText('workout.add_set','+ Set')}</button>`;
  return block;
}

function renderExercises(){
  if(!activeWorkout)return;
  ensureActiveWorkoutExerciseUiKeys();
  ensureExerciseListInteractions();
  const container=getExercisesContainer();
  if(!container)return;
  const fragment=document.createDocumentFragment();
  activeWorkout.exercises.forEach((exercise,exerciseIndex)=>{
    fragment.appendChild(createExerciseCardElement(exercise,exerciseIndex));
  });
  container.replaceChildren(fragment);
  syncExerciseCardIndexes();
  renderActiveWorkoutPlanPanel();
  refreshExerciseGuideModal();
}

function updateExerciseCard(uiKey){
  const exercise=getExerciseByUiKey(uiKey);
  const container=getExercisesContainer();
  if(!exercise||!container)return null;
  const exerciseIndex=getExerciseIndexByUiKey(uiKey);
  const nextCard=createExerciseCardElement(exercise,exerciseIndex);
  const currentCard=getExerciseCardElement(uiKey);
  if(currentCard)currentCard.replaceWith(nextCard);
  else{
    const beforeNode=container.children[exerciseIndex]||null;
    container.insertBefore(nextCard,beforeNode);
  }
  syncExerciseCardIndexes();
  refreshExerciseGuideModal();
  return nextCard;
}

function appendExerciseCard(exercise){
  const container=getExercisesContainer();
  if(!container)return null;
  const card=createExerciseCardElement(exercise,getExerciseIndexByUiKey(ensureExerciseUiKey(exercise)));
  container.appendChild(card);
  syncExerciseCardIndexes();
  refreshExerciseGuideModal();
  return card;
}

function insertExerciseCard(exerciseIndex,exercise){
  const container=getExercisesContainer();
  if(!container)return null;
  const card=createExerciseCardElement(exercise,exerciseIndex);
  const beforeNode=container.children[exerciseIndex]||null;
  container.insertBefore(card,beforeNode);
  syncExerciseCardIndexes();
  refreshExerciseGuideModal();
  return card;
}

function removeExerciseCard(uiKey){
  const card=getExerciseCardElement(uiKey);
  if(card)card.remove();
  syncExerciseCardIndexes();
  if(activeGuideExerciseKey===uiKey)closeExerciseGuide();
}

function getExerciseActionContext(target){
  const card=target.closest('.exercise-block[data-ui-key]');
  if(!card)return null;
  const uiKey=card.dataset.uiKey||'';
  const exerciseIndex=getExerciseIndexByUiKey(uiKey);
  if(exerciseIndex<0)return null;
  const row=target.closest('.set-row[data-set-index]');
  const setIndexRaw=row?.dataset?.setIndex??target.dataset?.setIndex;
  const setIndex=setIndexRaw===undefined?-1:parseInt(setIndexRaw,10);
  return{
    card,
    uiKey,
    exerciseIndex,
    setIndex,
    exercise:activeWorkout.exercises[exerciseIndex]
  };
}

function handleExerciseListClick(event){
  const actionTarget=event.target.closest('[data-action]');
  if(!actionTarget)return;
  const action=actionTarget.dataset.action;
  const context=getExerciseActionContext(actionTarget);
  if(!context)return;
  if(action==='open-guide'){openExerciseGuide(context.uiKey);return;}
  if(action==='expand-exercise'){expandCompletedExercise(context.uiKey);return;}
  if(action==='toggle-set'&&context.setIndex>=0){toggleSet(context.exerciseIndex,context.setIndex);return;}
  if(action==='add-set'){addSet(context.exerciseIndex);return;}
  if(action==='remove-exercise'){removeEx(context.exerciseIndex);return;}
  if(action==='swap-aux'){swapAuxExercise(context.exerciseIndex);return;}
  if(action==='swap-back'){swapBackExercise(context.exerciseIndex);}
}

function handleExerciseListChange(event){
  const input=event.target.closest('.set-input[data-field]');
  if(!input)return;
  const context=getExerciseActionContext(input);
  if(!context||context.setIndex<0)return;
  updateSet(context.exerciseIndex,context.setIndex,input.dataset.field,event.target.value);
}

function handleExerciseListKeydown(event){
  const input=event.target.closest('.set-input[data-field]');
  if(!input)return;
  const context=getExerciseActionContext(input);
  if(!context||context.setIndex<0)return;
  handleSetInputKey(event,context.uiKey,context.setIndex,input.dataset.field);
}

function ensureExerciseListInteractions(){
  if(exerciseListInteractionsBound)return;
  const container=getExercisesContainer();
  if(!container)return;
  container.addEventListener('click',handleExerciseListClick);
  container.addEventListener('change',handleExerciseListChange);
  container.addEventListener('keydown',handleExerciseListKeydown);
  exerciseListInteractionsBound=true;
}

// WORKOUT STARTER
function startWorkout(){
  const prefs=normalizeTrainingPreferences(profile);
  if(prefs.sportReadinessCheckEnabled){
    beginWorkoutStart(getPendingSportReadinessContext());
    return;
  }
  beginWorkoutStart(null);
}

function beginWorkoutStart(sportContext){
  const prog=getActiveProgram();
  const state=getActiveProgramState();
  let selectedOption=document.getElementById('program-day-select')?.value;
  const fatigue=typeof computeFatigue==='function'?computeFatigue():null;
  const planningContext=typeof buildPlanningContext==='function'
    ? buildPlanningContext({profile,schedule,workouts,activeProgram:prog,activeProgramState:state,fatigue,sportContext})
    : null;
  const trainingDecision=typeof getTodayTrainingDecision==='function'
    ? getTodayTrainingDecision(planningContext)
    : null;
  if(!selectedOption&&trainingDecision?.recommendedSessionOption)selectedOption=trainingDecision.recommendedSessionOption;

  const builtExercises=ensureWorkoutExerciseUiKeys((prog.buildSession(selectedOption,state)||[]).map(withResolvedExerciseId));
  const sessionPrefs=applyTrainingPreferencesToExercises(builtExercises,sportContext);
  const exercises=sessionPrefs.exercises;
  const prefs=normalizeTrainingPreferences(profile);
  if(prefs.warmupSetsEnabled)injectWarmupSets(exercises);
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
    sportContext:sportContext||undefined,
    planningDecision:trainingDecision||undefined,
    planningContext:planningContext||undefined,
    adaptationReasons:sessionPrefs.changes||[],
    runnerState:{
      mode:trainingDecision?.action||'train',
      adjustments:[],
      initialDecision:trainingDecision||undefined
    },
    sessionDescription,
    exercises:ensureWorkoutExerciseUiKeys(exercises),
    startTime:Date.now()
  };
  resetActiveWorkoutUIState();

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
  const progName=(window.I18N&&I18N.t)?I18N.t('program.'+prog.id+'.name',null,prog.name||'Training'):(prog.name||'Training');
  showToast(bi.isDeload?i18nText('workout.deload_light','Deload - keep it light'):progName,bi.isDeload?'var(--blue)':'var(--purple)');
  const decisionSummary=getWorkoutDecisionSummary(trainingDecision,planningContext);
  if(decisionSummary&&trainingDecision&&(trainingDecision.action!=='train'||trainingDecision.restrictionFlags?.includes('avoid_heavy_legs'))){
    setTimeout(()=>showToast(decisionSummary.title,'var(--blue)'),700);
  }
  if(sessionPrefs.changes.length){
    setTimeout(()=>showToast(sessionPrefs.changes[0],'var(--blue)'),trainingDecision&&(trainingDecision.action!=='train'||trainingDecision.restrictionFlags?.includes('avoid_heavy_legs'))?1800:900);
  }
  if(sessionPrefs.equipmentHint){
    const baseDelay=sessionPrefs.changes.length?2600:900;
    const decisionDelay=trainingDecision&&(trainingDecision.action!=='train'||trainingDecision.restrictionFlags?.includes('avoid_heavy_legs'))?900:0;
    setTimeout(()=>showToast(sessionPrefs.equipmentHint,'var(--blue)'),baseDelay+decisionDelay);
  }

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
    const workout={id:Date.now(),date:new Date().toISOString(),type:'sport',subtype:'extra',duration:5400,exercises:[],rpe:7,sets:0};
    workouts.push(workout);
    await upsertWorkoutRecord(workout);
    await saveWorkouts();
    showToast(i18nText('workout.extra_logged','Extra {sport} logged!',{sport:sportName}),'var(--accent)');
    updateDashboard();
  });
}
function quickLogHockey(){quickLogSport();}



// WORKOUT LOGGING
function getWorkoutElapsedSeconds(){
  if(!activeWorkout?.startTime)return 0;
  return Math.max(0,Math.floor((Date.now()-activeWorkout.startTime)/1000));
}

function renderWorkoutTimer(){
  workoutSeconds=getWorkoutElapsedSeconds();
  const m=String(Math.floor(workoutSeconds/60)).padStart(2,'0');
  const s=String(workoutSeconds%60).padStart(2,'0');
  const timerEl=document.getElementById('active-session-timer');
  if(timerEl)timerEl.textContent=m+':'+s;
}

function clearWorkoutTimer(){
  if(workoutTimer){
    clearInterval(workoutTimer);
    workoutTimer=null;
  }
}

function startWorkoutTimer(){
  clearWorkoutTimer();
  renderWorkoutTimer();
  workoutTimer=setInterval(renderWorkoutTimer,1000);
}

document.addEventListener('visibilitychange',()=>{if(!document.hidden)renderWorkoutTimer();});
window.addEventListener('pageshow',renderWorkoutTimer);

const EXERCISE_CATALOG_FILTERS={
  movement:[
    {value:'squat',labelKey:'catalog.filter.movement.squat',fallback:'Squat'},
    {value:'hinge',labelKey:'catalog.filter.movement.hinge',fallback:'Hinge'},
    {value:'horizontal_press',labelKey:'catalog.filter.movement.horizontal_press',fallback:'Horizontal Press'},
    {value:'vertical_press',labelKey:'catalog.filter.movement.vertical_press',fallback:'Vertical Press'},
    {value:'horizontal_pull',labelKey:'catalog.filter.movement.horizontal_pull',fallback:'Horizontal Pull'},
    {value:'vertical_pull',labelKey:'catalog.filter.movement.vertical_pull',fallback:'Vertical Pull'},
    {value:'single_leg',labelKey:'catalog.filter.movement.single_leg',fallback:'Single-Leg'},
    {value:'core',labelKey:'catalog.filter.movement.core',fallback:'Core'}
  ],
  muscle:[
    {value:'chest',labelKey:'dashboard.muscle_group.chest',fallback:'Chest'},
    {value:'back',labelKey:'dashboard.muscle_group.back',fallback:'Back'},
    {value:'shoulders',labelKey:'dashboard.muscle_group.shoulders',fallback:'Shoulders'},
    {value:'biceps',labelKey:'dashboard.muscle_group.biceps',fallback:'Biceps'},
    {value:'triceps',labelKey:'dashboard.muscle_group.triceps',fallback:'Triceps'},
    {value:'quads',labelKey:'dashboard.muscle_group.quads',fallback:'Quads'},
    {value:'hamstrings',labelKey:'dashboard.muscle_group.hamstrings',fallback:'Hamstrings'},
    {value:'glutes',labelKey:'dashboard.muscle_group.glutes',fallback:'Glutes'},
    {value:'core',labelKey:'dashboard.muscle_group.core',fallback:'Core'}
  ],
  equipment:[
    {value:'barbell',labelKey:'catalog.filter.equipment.barbell',fallback:'Barbell'},
    {value:'dumbbell',labelKey:'catalog.filter.equipment.dumbbell',fallback:'Dumbbell'},
    {value:'machine',labelKey:'catalog.filter.equipment.machine',fallback:'Machine'},
    {value:'cable',labelKey:'catalog.filter.equipment.cable',fallback:'Cable'},
    {value:'bodyweight',labelKey:'catalog.filter.equipment.bodyweight',fallback:'Bodyweight'},
    {value:'pullup_bar',labelKey:'catalog.filter.equipment.pullup_bar',fallback:'Pull-up Bar'},
    {value:'band',labelKey:'catalog.filter.equipment.band',fallback:'Band'},
    {value:'trap_bar',labelKey:'catalog.filter.equipment.trap_bar',fallback:'Trap Bar'}
  ]
};

let exerciseCatalogState=null;
let exerciseCatalogListenersBound=false;

function mergeExerciseCatalogFilterGroup(baseValues,selectedValue){
  const base=arrayify(baseValues).filter(Boolean);
  if(!selectedValue)return base;
  if(!base.length)return [selectedValue];
  return base.includes(selectedValue)?[selectedValue]:['__no_match__'];
}

function getExerciseCatalogUserFilters(){
  return{
    movementTags:exerciseCatalogState?.movementTag?[exerciseCatalogState.movementTag]:[],
    muscleGroups:exerciseCatalogState?.muscleGroup?[exerciseCatalogState.muscleGroup]:[],
    equipmentTags:exerciseCatalogState?.equipmentTag?[exerciseCatalogState.equipmentTag]:[]
  };
}

function getExerciseCatalogFilterPayload(){
  const base=exerciseCatalogState?.baseFilters||{};
  const ui=getExerciseCatalogUserFilters();
  return{
    categories:arrayify(base.categories),
    includeIds:arrayify(base.includeIds),
    excludeIds:arrayify(base.excludeIds),
    movementTags:mergeExerciseCatalogFilterGroup(base.movementTags,ui.movementTags[0]||''),
    muscleGroups:mergeExerciseCatalogFilterGroup(base.muscleGroups,ui.muscleGroups[0]||''),
    equipmentTags:mergeExerciseCatalogFilterGroup(base.equipmentTags,ui.equipmentTags[0]||'')
  };
}

function hasExerciseCatalogFilters(){
  return !!(exerciseCatalogState?.movementTag||exerciseCatalogState?.muscleGroup||exerciseCatalogState?.equipmentTag);
}

function isExerciseCatalogSwapMode(){
  return exerciseCatalogState?.mode==='swap'||exerciseCatalogState?.mode==='settings';
}

function mergeExerciseCatalogLists(primary,extra){
  const seen=new Set();
  return [...(primary||[]),...(extra||[])].filter(ex=>{
    const id=ex?.id;
    if(!id||seen.has(id))return false;
    seen.add(id);
    return true;
  });
}

function getExerciseCatalogCandidateExercises(filters){
  const candidateIds=arrayify(exerciseCatalogState?.candidateIds);
  if(!candidateIds.length||!window.EXERCISE_LIBRARY?.getExerciseList)return [];
  return EXERCISE_LIBRARY.getExerciseList({
    sort:'featured',
    filters:{
      ...filters,
      includeIds:candidateIds,
      excludeIds:arrayify(exerciseCatalogState?.baseFilters?.excludeIds)
    }
  });
}

function getExerciseCatalogRecent(limit){
  const ids=[];
  const seen=new Set();
  workouts.slice().sort((a,b)=>new Date(b.date)-new Date(a.date)).forEach(workout=>{
    (workout?.exercises||[]).forEach(ex=>{
      const resolved=window.EXERCISE_LIBRARY?.resolveExerciseId?(EXERCISE_LIBRARY.resolveExerciseId(ex.exerciseId||ex.name)):null;
      if(!resolved||seen.has(resolved))return;
      seen.add(resolved);
      ids.push(resolved);
    });
  });
  return ids.slice(0,limit).map(id=>EXERCISE_LIBRARY.getExercise(id)).filter(Boolean);
}

function getExerciseCatalogFeatured(limit,filters){
  if(!window.EXERCISE_LIBRARY||!EXERCISE_LIBRARY.getExerciseList)return [];
  return EXERCISE_LIBRARY.getExerciseList({sort:'featured',filters:{...filters,featuredOnly:true}}).slice(0,limit);
}

function getExerciseCatalogAll(filters){
  if(!window.EXERCISE_LIBRARY||!EXERCISE_LIBRARY.getExerciseList)return [];
  return EXERCISE_LIBRARY.getExerciseList({sort:'name',filters});
}

function getExerciseCatalogResults(){
  if(!window.EXERCISE_LIBRARY)return [];
  const search=exerciseCatalogState?.search||'';
  const filters=getExerciseCatalogFilterPayload();
  const userFilters=getExerciseCatalogUserFilters();
  if(search){
    const baseResults=EXERCISE_LIBRARY.searchExercises(search,{...filters,limit:120});
    const candidateResults=getExerciseCatalogCandidateExercises({...userFilters,limit:120});
    const searchedCandidates=search?EXERCISE_LIBRARY.searchExercises(search,{
      ...userFilters,
      includeIds:candidateResults.map(ex=>ex.id),
      excludeIds:arrayify(exerciseCatalogState?.baseFilters?.excludeIds),
      limit:120
    }):candidateResults;
    return mergeExerciseCatalogLists(baseResults,searchedCandidates).slice(0,120);
  }
  return mergeExerciseCatalogLists(getExerciseCatalogAll(filters),getExerciseCatalogCandidateExercises(userFilters));
}

function getExerciseCatalogMetaLine(exercise){
  const parts=[];
  const firstMovement=exercise?.movementTags?.[0];
  const firstMuscle=exercise?.displayMuscleGroups?.[0];
  const firstEquipment=exercise?.equipmentTags?.[0];
  if(firstMovement)parts.push(i18nText('catalog.filter.movement.'+firstMovement,firstMovement));
  if(firstMuscle)parts.push(i18nText('dashboard.muscle_group.'+firstMuscle,firstMuscle));
  if(firstEquipment)parts.push(i18nText('catalog.filter.equipment.'+firstEquipment,firstEquipment));
  return parts.join(' · ');
}

function renderExerciseCatalogSection(titleKey,fallback,items,emptyCopy){
  if(!items.length&&emptyCopy===false)return'';
  const body=items.length
    ? items.map(ex=>`<button type="button" class="catalog-item" onclick="selectExerciseCatalogExercise('${escapeHtml(ex.id)}')"><span class="catalog-item-main">${escapeHtml(displayExerciseName(ex.name))}</span><span class="catalog-item-meta">${escapeHtml(getExerciseCatalogMetaLine(ex))}</span></button>`).join('')
    : `<div class="catalog-section-empty">${escapeHtml(emptyCopy||i18nText('catalog.section.empty','No exercises in this section yet.'))}</div>`;
  return`<section class="catalog-section"><div class="catalog-section-title">${escapeHtml(i18nText(titleKey,fallback))}</div>${body}</section>`;
}

function renderExerciseCatalogFilters(){
  const wrap=document.getElementById('exercise-catalog-filters');
  if(!wrap)return;
  const groups=[
    {id:'movement',labelKey:'catalog.filter_group.movement',fallback:'Movement',active:exerciseCatalogState?.movementTag||'',options:EXERCISE_CATALOG_FILTERS.movement},
    {id:'muscle',labelKey:'catalog.filter_group.muscle',fallback:'Muscle',active:exerciseCatalogState?.muscleGroup||'',options:EXERCISE_CATALOG_FILTERS.muscle},
    {id:'equipment',labelKey:'catalog.filter_group.equipment',fallback:'Equipment',active:exerciseCatalogState?.equipmentTag||'',options:EXERCISE_CATALOG_FILTERS.equipment}
  ];
  wrap.innerHTML=groups.map(group=>{
    const selectId='catalog-filter-'+group.id;
    const selectOptions=[
      `<option value="">${escapeHtml(i18nText('catalog.filter.all','All'))}</option>`,
      ...group.options.map(option=>`<option value="${escapeHtml(option.value)}"${group.active===option.value?' selected':''}>${escapeHtml(i18nText(option.labelKey,option.fallback))}</option>`)
    ];
    return`<div class="catalog-filter-group"><label class="catalog-filter-label" for="${selectId}">${escapeHtml(i18nText(group.labelKey,group.fallback))}</label><div class="catalog-filter-select-wrap"><select id="${selectId}" class="catalog-filter-select" onchange="setExerciseCatalogFilter('${group.id}',this.value)">${selectOptions.join('')}</select></div></div>`;
  }).join('');
}

function refreshExerciseCatalogCopy(){
  const titleEl=document.getElementById('name-modal-title');
  const subEl=document.getElementById('exercise-catalog-sub');
  if(titleEl)titleEl.textContent=i18nText(exerciseCatalogState?.titleKey||'catalog.title.add',exerciseCatalogState?.titleFallback||'Add Exercise',exerciseCatalogState?.titleParams);
  if(subEl)subEl.textContent=i18nText(exerciseCatalogState?.subtitleKey||'catalog.sub',exerciseCatalogState?.subtitleFallback||'Pick an exercise from the library or search by name.',exerciseCatalogState?.subtitleParams);
}

function renderExerciseCatalog(){
  refreshExerciseCatalogCopy();
  renderExerciseCatalogFilters();
  const content=document.getElementById('exercise-catalog-content');
  const empty=document.getElementById('exercise-catalog-empty');
  const clearBtn=document.getElementById('catalog-clear-btn');
  if(!content||!empty)return;
  if(clearBtn)clearBtn.style.visibility=(exerciseCatalogState?.search||hasExerciseCatalogFilters())?'visible':'hidden';
  const search=exerciseCatalogState?.search||'';
  const filters=getExerciseCatalogFilterPayload();
  const userFilters=getExerciseCatalogUserFilters();
  if(search||hasExerciseCatalogFilters()){
    const results=search?getExerciseCatalogResults():mergeExerciseCatalogLists(getExerciseCatalogAll(filters),getExerciseCatalogCandidateExercises(userFilters));
    content.innerHTML=renderExerciseCatalogSection('catalog.section.results','Results',results,false);
    empty.style.display=results.length?'none':'block';
    return;
  }
  if(isExerciseCatalogSwapMode()){
    const results=getExerciseCatalogResults();
    content.innerHTML=renderExerciseCatalogSection('catalog.section.swap','Available options',results,false);
    empty.style.display=results.length?'none':'block';
    return;
  }
  const recent=getExerciseCatalogRecent(8);
  const featured=getExerciseCatalogFeatured(10,{});
  const all=getExerciseCatalogAll({});
  content.innerHTML=
    renderExerciseCatalogSection('catalog.section.recent','Recently used',recent,i18nText('catalog.section.recent_empty','Log a few workouts and your recent exercises will show up here.'))+
    renderExerciseCatalogSection('catalog.section.featured','Popular basics',featured,false)+
    renderExerciseCatalogSection('catalog.section.all','All exercises',all,false);
  empty.style.display='none';
}

function ensureExerciseCatalogListeners(){
  if(exerciseCatalogListenersBound)return;
  const modal=document.getElementById('name-modal');
  const input=document.getElementById('name-modal-input');
  if(modal){
    modal.addEventListener('click',e=>{if(e.target===modal)closeNameModal();});
  }
  if(input){
    input.addEventListener('input',e=>{
      if(!exerciseCatalogState)return;
      exerciseCatalogState.search=e.target.value||'';
      renderExerciseCatalog();
    });
    input.addEventListener('keydown',e=>{
      if(e.key==='Escape'){closeNameModal();return;}
      if(e.key!=='Enter')return;
      const first=getExerciseCatalogResults()[0];
      if(first)selectExerciseCatalogExercise(first.id);
    });
  }
  exerciseCatalogListenersBound=true;
}

function resolveExerciseSelection(input){
  const raw=typeof input==='object'?(input?.name||input?.exerciseId||''):input;
  const resolved=window.EXERCISE_LIBRARY?.getExercise?(EXERCISE_LIBRARY.getExercise(input)||EXERCISE_LIBRARY.getExercise(exerciseIdForName(raw))):null;
  return{
    exerciseId:resolved?.id||exerciseIdForName(raw),
    name:resolved?.name||String(raw||'').trim()
  };
}

function inferExerciseCatalogSwapFilters(exercise,category){
  const meta=window.EXERCISE_LIBRARY?.getExerciseMeta?EXERCISE_LIBRARY.getExerciseMeta(exercise?.exerciseId||exercise?.name||exercise):null;
  const categoryFilters={
    squat:{movementTags:['squat'],equipmentTags:['barbell','dumbbell','machine','bodyweight'],muscleGroups:['quads','glutes']},
    bench:{movementTags:['horizontal_press'],equipmentTags:['barbell','dumbbell','machine','bodyweight'],muscleGroups:['chest','triceps','shoulders']},
    deadlift:{movementTags:['hinge'],equipmentTags:['barbell','trap_bar','dumbbell','machine','bodyweight'],muscleGroups:['hamstrings','glutes','back']},
    ohp:{movementTags:['vertical_press'],equipmentTags:['barbell','dumbbell','machine','bodyweight'],muscleGroups:['shoulders','triceps']},
    back:{movementTags:['horizontal_pull','vertical_pull'],equipmentTags:['barbell','dumbbell','cable','machine','pullup_bar','bodyweight'],muscleGroups:['back','biceps']},
    core:{movementTags:['core'],equipmentTags:['bodyweight','cable','band','pullup_bar'],muscleGroups:['core']},
    pressing:{movementTags:['horizontal_press','vertical_press'],equipmentTags:['barbell','dumbbell','machine','bodyweight','cable'],muscleGroups:['chest','shoulders','triceps']},
    triceps:{movementTags:['isolation','horizontal_press','vertical_press'],equipmentTags:['bodyweight','cable','dumbbell','barbell'],muscleGroups:['triceps']},
    'single-leg':{movementTags:['single_leg','squat'],equipmentTags:['dumbbell','bodyweight','machine'],muscleGroups:['quads','glutes']},
    'upper back':{movementTags:['horizontal_pull'],equipmentTags:['barbell','dumbbell','cable','machine'],muscleGroups:['back','biceps']},
    'posterior chain':{movementTags:['hinge'],equipmentTags:['barbell','machine','bodyweight'],muscleGroups:['hamstrings','glutes','back']},
    'vertical pull':{movementTags:['vertical_pull'],equipmentTags:['pullup_bar','bodyweight','cable','machine'],muscleGroups:['back','biceps']}
  };
  if(categoryFilters[category])return categoryFilters[category];
  return{
    movementTags:(meta?.movementTags||[]).slice(0,2),
    equipmentTags:(meta?.equipmentTags||[]).slice(0,3),
    muscleGroups:(meta?.displayMuscleGroups||[]).slice(0,2)
  };
}

function getResolvedCatalogOptionExercises(options){
  const seen=new Set();
  return arrayify(options).map(option=>{
    const resolved=window.EXERCISE_LIBRARY?.getExercise?(
      EXERCISE_LIBRARY.getExercise(option)||
      EXERCISE_LIBRARY.getExercise(exerciseIdForName(option))||
      (window.EXERCISE_LIBRARY?.registerExercise?EXERCISE_LIBRARY.registerExercise({name:option}):null)
    ):null;
    if(!resolved||seen.has(resolved.id))return null;
    seen.add(resolved.id);
    return resolved;
  }).filter(Boolean);
}

function openExerciseCatalogPicker(config){
  const next=config||{};
  ensureExerciseCatalogListeners();
  const intent=next.intent||'add';
  const input=document.getElementById('name-modal-input');
  if(intent==='add'){
    nameModalCallback=next.onSubmit||next.callback||nameModalCallback||addExerciseByName;
    exerciseCatalogState={
      mode:'add',
      search:'',
      movementTag:'',
      muscleGroup:'',
      equipmentTag:'',
      baseFilters:{},
      candidateIds:[],
      titleKey:'catalog.title.add',
      titleFallback:next.title||'Add Exercise',
      titleParams:next.titleParams||null,
      subtitleKey:'catalog.sub',
      subtitleFallback:next.subtitle||'Pick an exercise from the library or search by name.',
      subtitleParams:next.subtitleParams||null,
      onSelect:null
    };
    if(input)input.value='';
    renderExerciseCatalog();
    document.getElementById('name-modal')?.classList.add('active');
    setTimeout(()=>input?.focus(),80);
    return true;
  }

  const exercise=next.exercise||activeWorkout?.exercises?.[next.exerciseIndex];
  if(!exercise)return false;
  const info=Array.isArray(next.swapInfo)?{options:next.swapInfo}:next.swapInfo||{};
  const current=resolveExerciseSelection(exercise);
  const fallbackOptions=getResolvedCatalogOptionExercises(next.options||info.options||[]);
  const configuredFilters=next.filters||info.filters||null;
  const baseFilters={...(configuredFilters||inferExerciseCatalogSwapFilters(exercise,info.category||next.category||''))};
  const excludeIds=arrayify(info.excludeIds);
  if(intent==='swap'&&current.exerciseId)excludeIds.push(current.exerciseId);
  baseFilters.excludeIds=uniqueList(excludeIds);
  const candidateIds=uniqueList([...(arrayify(info.includeIds)),...fallbackOptions.map(ex=>ex.id)]);
  const defaultSubtitle=intent==='settings'
    ? 'Choose the exercise variant this program should use.'
    : 'Showing options limited by the current exercise and program rules.';
  exerciseCatalogState={
    mode:intent,
    search:'',
    movementTag:'',
    muscleGroup:'',
    equipmentTag:'',
    baseFilters,
    candidateIds,
    titleKey:intent==='settings'?'catalog.title.settings':'catalog.title.swap',
    titleFallback:next.title||(intent==='settings'?'Choose Exercise':'Swap Exercise'),
    titleParams:next.titleParams||null,
    subtitleKey:intent==='settings'?'catalog.sub.settings':'catalog.sub.swap',
    subtitleFallback:next.subtitle||defaultSubtitle,
    subtitleParams:next.subtitleParams||(intent==='swap'?{name:displayExerciseName(current.name)}:null),
    onSelect:next.onSelect||null
  };
  if(input)input.value='';
  renderExerciseCatalog();
  document.getElementById('name-modal')?.classList.add('active');
  setTimeout(()=>input?.focus(),80);
  return true;
}

function openExerciseCatalogForAdd(title,cb){
  return openExerciseCatalogPicker({intent:'add',title,callback:cb});
}

function openExerciseCatalogForSwap(config){
  return openExerciseCatalogPicker({...config,intent:'swap'});
}

function openExerciseCatalogForSettings(config){
  return openExerciseCatalogPicker({...config,intent:'settings'});
}

function setExerciseCatalogFilter(group,value){
  if(!exerciseCatalogState)return;
  if(group==='movement')exerciseCatalogState.movementTag=value||'';
  if(group==='muscle')exerciseCatalogState.muscleGroup=value||'';
  if(group==='equipment')exerciseCatalogState.equipmentTag=value||'';
  renderExerciseCatalog();
}

function clearExerciseCatalogFilters(){
  if(!exerciseCatalogState)return;
  exerciseCatalogState.search='';
  exerciseCatalogState.movementTag='';
  exerciseCatalogState.muscleGroup='';
  exerciseCatalogState.equipmentTag='';
  const input=document.getElementById('name-modal-input');
  if(input)input.value='';
  renderExerciseCatalog();
  input?.focus();
}

function resetExerciseCatalogState(){
  exerciseCatalogState=null;
}

function selectExerciseCatalogExercise(exerciseId){
  if(!window.EXERCISE_LIBRARY)return;
  const exercise=EXERCISE_LIBRARY.getExercise(exerciseId);
  if(!exercise)return;
  document.getElementById('name-modal')?.classList.remove('active');
  const onSelect=exerciseCatalogState?.onSelect||null;
  const cb=nameModalCallback;
  nameModalCallback=null;
  exerciseCatalogState=null;
  if(onSelect){onSelect(exercise);return;}
  if(cb)cb(exercise.name);
}

function submitExerciseCatalogSelection(){
  const first=getExerciseCatalogResults()[0];
  if(first)selectExerciseCatalogExercise(first.id);
}

function addExerciseByName(name){
  if(!activeWorkout)return;
  const resolved=resolveExerciseSelection(name);
  const exerciseId=resolved.exerciseId;
  const canonicalName=resolved.name;
  const suggested=getSuggested({name:canonicalName,exerciseId});
  const exercise=ensureWorkoutExerciseUiKeys([{
    id:Date.now()+Math.random(),exerciseId,name:canonicalName,note:'',sets:[
      {weight:suggested||'',reps:5,done:false,rpe:null},
      {weight:suggested||'',reps:5,done:false,rpe:null},
      {weight:suggested||'',reps:5,done:false,rpe:null}
    ]
  }])[0];
  activeWorkout.exercises.push(exercise);
  appendExerciseCard(exercise);
  renderActiveWorkoutPlanPanel();
}

function sanitizeSetValue(field,raw){
  if(field==='weight'){const n=parseFloat(raw);return isNaN(n)?'':Math.max(0,Math.min(999,Math.round(n*10)/10));}
  if(field==='reps'){const n=parseInt(raw,10);return isNaN(n)?'':Math.max(0,Math.min(999,n));}
  if(field==='rir')return raw;
  return raw;
}

function getCurrentWorkoutRounding(){
  const state=typeof getActiveProgramState==='function'?getActiveProgramState():null;
  const rounding=parseFloat(state?.rounding);
  return Number.isFinite(rounding)&&rounding>0?rounding:2.5;
}

function parseLoggedRepCount(raw){
  const reps=parseInt(raw,10);
  return Number.isFinite(reps)&&reps>=0?reps:null;
}

function updateSet(ei,si,f,v){
  const exercise=activeWorkout.exercises[ei];
  const set=exercise?.sets?.[si];
  if(!set)return;
  const sanitizedValue=sanitizeSetValue(f,v);
  set[f]=sanitizedValue;
  if(f!=='weight')return;
  if(set.isWarmup)return;
  const exerciseUiKey=ensureExerciseUiKey(exercise);
  for(let nextIndex=si+1;nextIndex<exercise.sets.length;nextIndex++){
    const nextSet=exercise.sets[nextIndex];
    if(nextSet.done||nextSet.isWarmup)continue;
    nextSet.weight=sanitizedValue;
    const weightInput=document.getElementById(getSetInputId(exerciseUiKey,nextIndex,'weight'));
    if(weightInput)weightInput.value=sanitizedValue;
  }
}

function findNextEditableSetInput(exerciseUiKey,setIndex,field){
  const exerciseIndex=getExerciseIndexByUiKey(exerciseUiKey);
  if(exerciseIndex<0)return null;
  if(field==='weight'){
    return document.getElementById(getSetInputId(exerciseUiKey,setIndex,'reps'));
  }
  for(let nextSetIndex=setIndex+1;nextSetIndex<(activeWorkout?.exercises?.[exerciseIndex]?.sets||[]).length;nextSetIndex++){
    const nextSet=activeWorkout.exercises[exerciseIndex].sets[nextSetIndex];
    if(nextSet?.isWarmup)continue;
    const input=document.getElementById(getSetInputId(exerciseUiKey,nextSetIndex,'weight'));
    if(input)return input;
  }
  for(let nextExerciseIndex=exerciseIndex+1;nextExerciseIndex<(activeWorkout?.exercises?.length||0);nextExerciseIndex++){
    const nextExercise=activeWorkout.exercises[nextExerciseIndex];
    const firstWorkIndex=nextExercise?.sets?.findIndex(set=>!set.isWarmup)??-1;
    if(firstWorkIndex<0)continue;
    const input=document.getElementById(getSetInputId(ensureExerciseUiKey(nextExercise),firstWorkIndex,'weight'));
    if(input)return input;
  }
  return null;
}

function handleSetInputKey(event,exerciseUiKey,setIndex,field){
  if(event.key!=='Enter')return;
  event.preventDefault();
  const exerciseIndex=getExerciseIndexByUiKey(exerciseUiKey);
  if(exerciseIndex<0)return;
  updateSet(exerciseIndex,setIndex,field,event.target.value);
  const nextInput=findNextEditableSetInput(exerciseUiKey,setIndex,field);
  if(nextInput)nextInput.focus();
}

function tryHaptic(pattern){
  try{if(navigator.vibrate&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches)navigator.vibrate(pattern);}catch(e){}
}

function toggleSet(ei,si){
  const exercise=activeWorkout.exercises[ei];
  const set=exercise?.sets?.[si];
  if(!exercise||!set)return;
  const exerciseUiKey=ensureExerciseUiKey(exercise);
  if(!set.done){
    set.done=true;
    tryHaptic(40);
    const row=getExerciseCardElement(exerciseUiKey)?.querySelector(getSetRowSelector(si));
    const check=row?.querySelector('.set-check');
    if(row)row.classList.add('is-done','set-done-anim');
    if(check){
      check.classList.add('done','set-done-anim');
      check.addEventListener('animationend',()=>check.classList.remove('set-done-anim'),{once:true});
    }
    if(row){
      row.addEventListener('animationend',()=>row.classList.remove('set-done-anim'),{once:true});
    }
    if(isExerciseComplete(exercise)){
      setExerciseCardCollapsed(exercise,true);
      window.setTimeout(()=>{
        const currentExercise=getExerciseByUiKey(exerciseUiKey);
        if(currentExercise&&isExerciseComplete(currentExercise))updateExerciseCard(exerciseUiKey);
      },260);
    }
    startRestTimer();
    if(shouldPromptForSetRIR(exercise,si))showSetRIRPrompt(ei,si);
  }else{
    set.done=false;
    set.rir=undefined;
    delete collapsedExerciseCardState[exerciseUiKey];
    updateExerciseCard(exerciseUiKey);
    renderActiveWorkoutPlanPanel();
    return;
  }
  renderActiveWorkoutPlanPanel();
}

function addSet(ei){
  const exercise=activeWorkout.exercises[ei];
  if(!exercise)return;
  const lastSet=exercise.sets[exercise.sets.length-1];
  const exerciseUiKey=ensureExerciseUiKey(exercise);
  delete collapsedExerciseCardState[exerciseUiKey];
  exercise.sets.push({weight:lastSet?.weight||'',reps:lastSet?.reps||5,done:false,rpe:null});
  updateExerciseCard(exerciseUiKey);
  renderActiveWorkoutPlanPanel();
  const newSetIndex=exercise.sets.length-1;
  const weightInput=document.getElementById(getSetInputId(exerciseUiKey,newSetIndex,'weight'));
  if(weightInput)weightInput.focus();
}

function removeEx(ei){
  const removed=activeWorkout.exercises.splice(ei,1)[0];
  const removedUiKey=removed?.uiKey||null;
  if(removedUiKey)delete collapsedExerciseCardState[removedUiKey];
  if(removedUiKey)removeExerciseCard(removedUiKey);
  renderActiveWorkoutPlanPanel();
  if(removed){
    showToast(escapeHtml(i18nText('workout.exercise_removed','{name} removed',{name:displayExerciseName(removed.name)})),'var(--muted)',()=>{
      ensureExerciseUiKey(removed);
      activeWorkout.exercises.splice(ei,0,removed);
      insertExerciseCard(ei,removed);
      renderActiveWorkoutPlanPanel();
    });
  }
}

function swapAuxExercise(ei){
  const exercise=activeWorkout.exercises[ei];
  if(!exercise||exercise.auxSlotIdx<0)return;
  const exerciseUiKey=ensureExerciseUiKey(exercise);
  const prog=getActiveProgram();
  const swapInfo=prog.getAuxSwapOptions?prog.getAuxSwapOptions(exercise):null;
  if(!swapInfo)return;
  const cat=swapInfo.category||'';
  const title=cat?i18nText('workout.swap_aux_category','Swap {cat} auxiliary',{cat:cat.charAt(0).toUpperCase()+cat.slice(1)}):i18nText('workout.swap_exercise','Swap exercise');
  openExerciseCatalogForSwap({
    exerciseIndex:ei,
    exercise,
    swapInfo,
    title,
    onSelect:selected=>doAuxSwap(exerciseUiKey,selected.name,exercise.auxSlotIdx)
  });
}

function doAuxSwap(exerciseUiKey,newName,slotIdx){
  const exerciseIndex=getExerciseIndexByUiKey(exerciseUiKey);
  if(exerciseIndex<0)return;
  const resolved=resolveExerciseSelection(newName);
  activeWorkout.exercises[exerciseIndex].name=resolved.name;
  activeWorkout.exercises[exerciseIndex].exerciseId=resolved.exerciseId;
  const prog=getActiveProgram(),state=getActiveProgramState();
  const newState=prog.onAuxSwap?prog.onAuxSwap(slotIdx,resolved.name,state):state;
  setProgramState(prog.id,newState);
  saveProfileData({programIds:[prog.id]});
  updateExerciseCard(exerciseUiKey);
  renderActiveWorkoutPlanPanel();
  showToast(i18nText('workout.swapped_to','Swapped to {name}',{name:displayExerciseName(resolved.name)}),'var(--purple)');
}

function swapBackExercise(ei){
  const exercise=activeWorkout.exercises[ei];
  if(!exercise)return;
  const exerciseUiKey=ensureExerciseUiKey(exercise);
  const prog=getActiveProgram();
  const swapInfo=prog.getBackSwapOptions?prog.getBackSwapOptions(exercise):[];
  if(!swapInfo)return;
  openExerciseCatalogForSwap({
    exerciseIndex:ei,
    exercise,
    swapInfo,
    title:i18nText('workout.swap_back_title','Swap Back Exercise'),
    onSelect:selected=>doBackSwap(exerciseUiKey,selected.name)
  });
}

function doBackSwap(exerciseUiKey,newName){
  const exerciseIndex=getExerciseIndexByUiKey(exerciseUiKey);
  if(exerciseIndex<0)return;
  const resolved=resolveExerciseSelection(newName);
  activeWorkout.exercises[exerciseIndex].name=resolved.name;
  activeWorkout.exercises[exerciseIndex].exerciseId=resolved.exerciseId;
  const prog=getActiveProgram(),state=getActiveProgramState();
  const newState=prog.onBackSwap?prog.onBackSwap(resolved.name,state):state;
  setProgramState(prog.id,newState);
  saveProfileData({programIds:[prog.id]});
  updateExerciseCard(exerciseUiKey);
  renderActiveWorkoutPlanPanel();
  showToast(i18nText('workout.swapped_to','Swapped to {name}',{name:displayExerciseName(resolved.name)}),'var(--purple)');
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

function showSessionSummary(summaryData){
  return new Promise(resolve=>{
    const {duration,exerciseCount,completedSets,totalSets,tonnage,rpe,programLabel}=summaryData;
    const mins=Math.floor(duration/60);
    const secs=duration%60;
    const timeStr=mins>0?(mins+'m '+(secs>0?secs+'s':'')):(secs+'s');
    const tonnageStr=tonnage>=1000?((tonnage/1000).toFixed(1)+' t'):(Math.round(tonnage)+' kg');
    const content=document.getElementById('summary-modal-content');
    content.innerHTML=`
      <div style="font-size:32px;margin-bottom:4px">&#9889;</div>
      <div style="font-size:20px;font-weight:900;margin-bottom:4px">${escapeHtml(i18nText('workout.session_complete','Session Complete'))}</div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:4px">${escapeHtml(programLabel)}</div>
      <div class="summary-stats">
        <div class="summary-stat"><div class="summary-stat-value">${escapeHtml(timeStr)}</div><div class="summary-stat-label">${escapeHtml(i18nText('workout.summary_duration','Duration'))}</div></div>
        <div class="summary-stat"><div class="summary-stat-value green">${completedSets}/${totalSets}</div><div class="summary-stat-label">${escapeHtml(i18nText('workout.summary_sets','Sets Done'))}</div></div>
        <div class="summary-stat"><div class="summary-stat-value gold">${escapeHtml(tonnageStr)}</div><div class="summary-stat-label">${escapeHtml(i18nText('workout.summary_volume','Volume'))}</div></div>
        <div class="summary-stat"><div class="summary-stat-value purple">${rpe||'--'}</div><div class="summary-stat-label">${escapeHtml(i18nText('workout.summary_rpe','RPE'))}</div></div>
      </div>
      <button class="btn btn-primary" style="margin-top:8px" onclick="closeSummaryModal()">${escapeHtml(i18nText('common.done','Done'))}</button>`;
    document.getElementById('summary-modal').classList.add('active');
    window._summaryResolve=resolve;
  });
}
function closeSummaryModal(){
  document.getElementById('summary-modal').classList.remove('active');
  if(window._summaryResolve){window._summaryResolve();window._summaryResolve=null;}
}

function applyQuickWorkoutAdjustment(mode){
  if(mode==='shorten'){
    showShortenAdjustmentOptions();
    return;
  }
  const preview=getQuickAdjustmentPreview(mode);
  showConfirm(preview.title,preview.body,()=>executeQuickWorkoutAdjustment(mode));
}

function executeQuickWorkoutAdjustment(mode,detailLevel){
  if(!activeWorkout?.exercises?.length)return;
  const previousSnapshot={
    exercises:cloneWorkoutExercises(activeWorkout.exercises),
    mode:activeWorkout.runnerState?.mode||activeWorkout.planningDecision?.action||'train',
    adjustments:(activeWorkout.runnerState?.adjustments||[]).map(item=>({...item})),
    adaptationReasons:[...(activeWorkout.adaptationReasons||[])]
  };
  const exercises=cloneWorkoutExercises(activeWorkout.exercises);
  let changed=false;
  if(mode==='shorten'){
    const level=detailLevel||'medium';
    if(level==='light'){
      exercises.forEach(exercise=>{
        if(exercise.isAccessory&&trimExerciseRemainingSets(exercise,0))changed=true;
      });
    }else{
      exercises.forEach(exercise=>{
        if(exercise.isAccessory){
          if(trimExerciseRemainingSets(exercise,0))changed=true;
          return;
        }
        if(trimExerciseRemainingSets(exercise,Math.max(0,2-getCompletedSetCount(exercise))))changed=true;
      });
      if(level==='hard'&&dropTrailingUnstartedExercise(exercises))changed=true;
    }
  }else if(mode==='lighten'){
    exercises.forEach(exercise=>{
      if(trimOneExtraRemainingSet(exercise,'lighten'))changed=true;
      (exercise.sets||[]).forEach(set=>{
        if(reduceRemainingSetTarget(set))changed=true;
      });
    });
  }
  const cleanedExercises=cleanupAdjustedWorkoutExercises(exercises);
  if(changed){
    activeWorkout.exercises=cleanedExercises;
    activeWorkout.runnerState=activeWorkout.runnerState||{mode:'train',adjustments:[]};
    activeWorkout.runnerState.mode=mode==='lighten'?'lighten':'shorten';
    activeWorkout.runnerState.undoSnapshot=previousSnapshot;
    activeWorkout.runnerState.adjustments.push({
      type:mode,
      at:new Date().toISOString(),
      detailLevel:detailLevel||undefined,
      label:getRunnerAdjustmentLabel({type:mode})
    });
    activeWorkout.adaptationReasons=[...(activeWorkout.adaptationReasons||[])];
    if(mode==='shorten'){
      activeWorkout.adaptationReasons.push(i18nText('workout.runner.shorten_copy','Lower-priority work was cut so you can finish the essential work faster.'));
      showToast(i18nText('workout.runner.shorten_toast','Session shortened to the essential work'),'var(--blue)');
    }else{
      activeWorkout.adaptationReasons.push(i18nText('workout.runner.light_copy','Keep the session moving, but leave more in the tank with slightly lighter remaining work.'));
      showToast(i18nText('workout.runner.light_toast','Remaining work lightened'),'var(--blue)');
    }
    renderExercises();
    return;
  }
  showToast(i18nText('workout.runner.no_change','No remaining work needed adjustment'),'var(--muted)');
}

function undoQuickWorkoutAdjustment(){
  const snapshot=activeWorkout?.runnerState?.undoSnapshot;
  if(!snapshot||!activeWorkout)return;
  activeWorkout.exercises=cloneWorkoutExercises(snapshot.exercises);
  activeWorkout.adaptationReasons=[...(snapshot.adaptationReasons||[])];
  activeWorkout.runnerState=activeWorkout.runnerState||{};
  activeWorkout.runnerState.mode=snapshot.mode||activeWorkout.planningDecision?.action||'train';
  activeWorkout.runnerState.adjustments=(snapshot.adjustments||[]).map(item=>({...item}));
  delete activeWorkout.runnerState.undoSnapshot;
  renderExercises();
  showToast(i18nText('workout.runner.undo_toast','Last adjustment undone'),'var(--blue)');
}

async function finishWorkout(){
  if(!activeWorkout.exercises.length){showToast(i18nText('workout.add_at_least_one','Add at least one exercise!'),'var(--orange)');return;}
  clearWorkoutTimer();
  renderWorkoutTimer();
  skipRest();
  activeWorkout.exercises=activeWorkout.exercises.map(withResolvedExerciseId);
  // Sanitize all set values before persisting (preserve AMRAP sentinel)
  activeWorkout.exercises.forEach(e=>{
    e.sets.forEach(s=>{
      s.weight=sanitizeSetValue('weight',s.weight);
      if(s.reps!=='AMRAP')s.reps=sanitizeSetValue('reps',s.reps);
    });
  });
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
  let programMeta;
  try{programMeta=prog.getWorkoutMeta?prog.getWorkoutMeta(state):{week:state.week,cycle:state.cycle};}
  catch(e){logWarn('getWorkoutMeta',e);programMeta={week:state.week,cycle:state.cycle};}
  const workoutId=Date.now();
  const workoutDate=new Date().toISOString();

  // Push workout record with canonical program metadata fields only.
  const savedWorkout={id:workoutId,date:workoutDate,
    program:prog.id,type:prog.id,
    programOption:activeWorkout.programOption,
    programDayNum:activeWorkout.programDayNum,
    programLabel:activeWorkout.programLabel||'',
    sportContext:activeWorkout.sportContext||undefined,
    programMeta,
    sessionDescription:activeWorkout.sessionDescription||'',
    adaptationReasons:(activeWorkout.adaptationReasons||[]).slice(),
    planningDecision:activeWorkout.planningDecision||undefined,
    runnerState:activeWorkout.runnerState?{
      mode:activeWorkout.runnerState.mode,
      adjustments:(activeWorkout.runnerState.adjustments||[]).slice()
    }:undefined,
    programStateBefore:stateBeforeSession,
    duration:getWorkoutElapsedSeconds(),exercises:activeWorkout.exercises,rpe:sessionRPE,sets:totalSets};
  workouts.push(savedWorkout);

  // Program state adjustment — wrapped in try/catch so a program bug never loses the workout.
  // If anything throws, the workout is already in the array and will be saved below.
  let advancedState=state;
  let programHookFailed=false;
  try{
    // Adjust program state (TMs, weights, failures, etc.)
    // Strip warm-up sets so program progression logic only sees working sets
    const exercisesForProgression=activeWorkout.exercises.map(ex=>({
      ...ex,sets:(ex.sets||[]).filter(s=>!s.isWarmup)
    }));
    let newState=prog.adjustAfterSession?prog.adjustAfterSession(exercisesForProgression,state,activeWorkout.programOption):state;

    // Count sessions this week for advanceState
    const now=new Date(),sow=getWeekStart(now);
    const sessionsThisWeek=workouts.filter(w=>(w.program===prog.id||(!w.program&&w.type===prog.id))&&new Date(w.date)>=sow).length;

    // Advance program state (week, cycle, A/B, etc.)
    advancedState=prog.advanceState?prog.advanceState(newState,sessionsThisWeek):newState;
    if(savedWorkout)savedWorkout.programStateAfter=JSON.parse(JSON.stringify(advancedState));

    // Toast on week or cycle advance (any program)
    if(advancedState.cycle!==undefined&&advancedState.cycle!==(newState.cycle)){
      const bi=prog.getBlockInfo?prog.getBlockInfo(advancedState):{name:''};
      setTimeout(()=>showToast(i18nText('workout.next_cycle','{program} - cycle {cycle} starts now.',{program:programName,cycle:advancedState.cycle}),'var(--purple)'),500);
    } else if(advancedState.week!==undefined&&advancedState.week!==newState.week){
      const bi=prog.getBlockInfo?prog.getBlockInfo(advancedState):{name:'',weekLabel:''};
      setTimeout(()=>showToast(i18nText('workout.next_week','{program} - {label} up next!',{program:programName,label:(bi.name||('Week '+advancedState.week))}),'var(--purple)'),500);
    }
  }catch(e){
    logWarn('finishWorkout program hooks',e);
    programHookFailed=true;
  }

  setProgramState(prog.id,advancedState);
  saveProfileData({programIds:[prog.id]});
  await upsertWorkoutRecord(savedWorkout);
  await saveWorkouts();
  buildExerciseIndex();

  // Compute summary before clearing activeWorkout
  let tonnage=0,completedSets=0;
  activeWorkout.exercises.forEach(ex=>{
    ex.sets.forEach(s=>{
      if(s.done&&!s.isWarmup){
        completedSets++;
        tonnage+=(parseFloat(s.weight)||0)*(parseLoggedRepCount(s.reps)||0);
      }
    });
  });
  const summaryData={
    duration:getWorkoutElapsedSeconds(),
    exerciseCount:activeWorkout.exercises.length,
    completedSets,totalSets,tonnage,
    rpe:sessionRPE,
    programLabel:activeWorkout.programLabel||''
  };

  resetActiveWorkoutUIState();
  activeWorkout=null;
  document.getElementById('workout-not-started').style.display='block';
  document.getElementById('workout-active').style.display='none';
  resetNotStartedView();
  updateDashboard();

  if(programHookFailed)showToast(i18nText('workout.program_error','Session saved, but program state may need review.'),'var(--orange)');
  await showSessionSummary(summaryData);
}

function cancelWorkout(){
  clearWorkoutTimer();skipRest();
  resetActiveWorkoutUIState();
  activeWorkout=null;
  document.getElementById('workout-not-started').style.display='block';
  document.getElementById('workout-active').style.display='none';
  resetNotStartedView();
  showToast(i18nText('workout.session_discarded','Workout discarded.'));
}
