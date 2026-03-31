function trPlan(key,fallback,params){
  if(window.I18N&&I18N.t)return I18N.t(key,params,fallback);
  return fallback;
}

function clonePlanValue(value){
  return value===undefined?value:JSON.parse(JSON.stringify(value));
}

function clonePlanSession(session){
  if(typeof cloneProgramSession==='function')return cloneProgramSession(session);
  return clonePlanValue(session)||[];
}

function clampPlan(value,min,max){
  return Math.max(min,Math.min(max,value));
}

function toPlanList(value){
  if(Array.isArray(value))return value.filter(Boolean);
  if(value===undefined||value===null||value==='')return [];
  return [value];
}

function resolvePlanExerciseId(exercise){
  if(!exercise)return '';
  if(exercise.exerciseId)return String(exercise.exerciseId);
  if(typeof window.resolveRegisteredExerciseId==='function'){
    return String(window.resolveRegisteredExerciseId(exercise.name||exercise)||'');
  }
  return '';
}

function getPlanExerciseMeta(exercise){
  if(typeof window.getExerciseMetadata!=='function')return null;
  return window.getExerciseMetadata(resolvePlanExerciseId(exercise)||exercise?.name||exercise)||null;
}

function getPlanExerciseMovementTags(exercise){
  const meta=getPlanExerciseMeta(exercise);
  return toPlanList(meta?.movementTags).map(tag=>String(tag).trim()).filter(Boolean);
}

function isPlanLowerBodyExercise(exercise){
  if(typeof isLowerBodyExercise==='function')return isLowerBodyExercise(exercise);
  const meta=getPlanExerciseMeta(exercise);
  const groups=new Set(toPlanList(meta?.displayMuscleGroups));
  return groups.has('quads')||groups.has('hamstrings')||groups.has('glutes')||groups.has('calves');
}

function isPlanSportWorkout(workout){
  if(typeof isSportWorkout==='function')return isSportWorkout(workout);
  return workout?.type==='sport'||workout?.type==='hockey';
}

function getProgramWorkoutHistory(programId,workoutList,limit){
  const canonicalId=typeof getCanonicalProgramId==='function'?getCanonicalProgramId(programId):String(programId||'');
  return (workoutList||[])
    .filter(workout=>typeof getWorkoutProgramId==='function'?getWorkoutProgramId(workout)===canonicalId:workout?.program===canonicalId)
    .sort((a,b)=>new Date(b.date)-new Date(a.date))
    .slice(0,limit||8);
}

function getCompletedSetRatio(workout){
  const exercises=Array.isArray(workout?.exercises)?workout.exercises:[];
  let total=0;
  let done=0;
  exercises.forEach(exercise=>{
    const sets=Array.isArray(exercise?.sets)?exercise.sets:[];
    total+=sets.length;
    done+=sets.filter(set=>set.done!==false).length;
  });
  if(!total)return 1;
  return done/total;
}

function getPlanningAdherenceSignals(programId,workoutList){
  const recent=getProgramWorkoutHistory(programId,workoutList,6);
  let consecutivePoorSessions=0;
  recent.forEach((workout,idx)=>{
    if(idx!==consecutivePoorSessions)return;
    if(getCompletedSetRatio(workout)<0.7)consecutivePoorSessions++;
  });
  const averageCompletion=recent.length
    ? recent.reduce((sum,workout)=>sum+getCompletedSetRatio(workout),0)/recent.length
    : 1;
  return{
    recentCount:recent.length,
    consecutivePoorSessions,
    averageCompletion:Math.round(averageCompletion*100)/100
  };
}

function getPlanningProgressSignals(activeProgramState){
  const stalledCount=activeProgramState&&activeProgramState.stalledLifts
    ? Object.keys(activeProgramState.stalledLifts).filter(key=>activeProgramState.stalledLifts[key]).length
    : 0;
  return{
    stalledCount,
    hasStalls:stalledCount>0,
    activeWeek:parseInt(activeProgramState?.week,10)||1
  };
}

function normalizePlanToken(value){
  return String(value||'').trim().toLowerCase();
}

function pushUniquePlanValue(list,value){
  if(!value)return;
  if(!list.includes(value))list.push(value);
}

function topPlanIdsByCount(counts,minimumCount){
  return Object.entries(counts||{})
    .sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))
    .filter(([,count])=>count>=(minimumCount||1))
    .slice(0,3)
    .map(([id])=>id);
}

function getWorkoutSwapExerciseIds(workout){
  const swapped=[];
  const programId=typeof getWorkoutProgramId==='function'?getWorkoutProgramId(workout):workout?.program;
  const beforeState=workout?.programStateBefore||{};
  (workout?.exercises||[]).forEach(exercise=>{
    const currentId=resolvePlanExerciseId(exercise);
    if(!currentId)return;
    let plannedName='';
    if(programId==='forge'){
      if(exercise.isAccessory)plannedName=beforeState?.backExercise||'';
      else if(exercise.auxSlotIdx>=0)plannedName=beforeState?.lifts?.aux?.[exercise.auxSlotIdx]?.name||'';
    }else if(programId==='wendler531'&&exercise.auxSlotIdx>=0){
      const liftIdx=Math.floor(exercise.auxSlotIdx/2);
      const slotIdx=exercise.auxSlotIdx%2;
      plannedName=beforeState?.triumvirate?.[liftIdx]?.[slotIdx]||'';
    }
    if(plannedName&&normalizePlanToken(plannedName)!==normalizePlanToken(exercise.name))pushUniquePlanValue(swapped,currentId);
  });
  return swapped;
}

function getPlanningBehaviorSignals(programId,workoutList){
  const recent=getProgramWorkoutHistory(programId,workoutList,12);
  const skippedAccessoryCounts={};
  const swapCounts={};
  let shortenCount=0;
  let lightenCount=0;
  let sportCollisionCount=0;
  recent.forEach(workout=>{
    if((workout?.planningDecision?.restrictionFlags||[]).includes('avoid_heavy_legs'))sportCollisionCount++;
    (workout?.runnerState?.adjustments||[]).forEach(item=>{
      if(item?.type==='shorten')shortenCount++;
      if(item?.type==='lighten')lightenCount++;
    });
    (workout?.exercises||[]).forEach(exercise=>{
      const sets=(exercise?.sets||[]).filter(set=>!set?.isWarmup);
      if(!sets.length)return;
      const doneCount=sets.filter(set=>set.done!==false).length;
      const doneRatio=doneCount/sets.length;
      const exerciseId=resolvePlanExerciseId(exercise);
      if(exercise.isAccessory&&doneRatio<0.5&&exerciseId){
        skippedAccessoryCounts[exerciseId]=(skippedAccessoryCounts[exerciseId]||0)+1;
      }
    });
    getWorkoutSwapExerciseIds(workout).forEach(exerciseId=>{
      swapCounts[exerciseId]=(swapCounts[exerciseId]||0)+1;
    });
  });
  return{
    avoidedExerciseIds:[],
    skippedAccessoryExerciseIds:topPlanIdsByCount(skippedAccessoryCounts,2),
    preferredSwapExerciseIds:topPlanIdsByCount(swapCounts,2),
    shortenCount,
    lightenCount,
    sportCollisionCount
  };
}

function inferDurationSignal(workout){
  const durationSec=parseInt(workout?.duration,10)||0;
  if(!durationSec)return null;
  const durationMin=durationSec/60;
  const prefs=(typeof normalizeTrainingPreferences==='function')
    ? normalizeTrainingPreferences(profile||{})
    : (profile?.preferences||{});
  const targetMin=parseInt(prefs.sessionMinutes,10)||60;
  if(durationMin>targetMin*1.20)return'too_long';
  if(durationMin<targetMin*0.75)return'too_short';
  return'on_target';
}

function getSessionFeedbackSignals(programId,workoutList){
  const recent=getProgramWorkoutHistory(programId,workoutList,5);
  const lastThree=recent.slice(0,3);
  const tooHardCount=lastThree.filter(w=>w.sessionFeedback==='too_hard').length;
  const tooEasyCount=lastThree.filter(w=>w.sessionFeedback==='too_easy').length;
  const goodCount=lastThree.filter(w=>w.sessionFeedback==='good').length;
  const tooLongCount=recent.slice(0,4).filter(w=>w.durationSignal==='too_long').length;
  const tooHardBias=tooHardCount>=2&&lastThree[0]?.sessionFeedback!=='good';
  const tooEasyBias=tooEasyCount>=2;
  const durationFriction=tooLongCount>=2;
  return{tooHardBias,tooEasyBias,durationFriction,tooHardCount,tooEasyCount,goodCount,tooLongCount};
}

function getPlanEquipmentTagsForAccess(equipmentAccess){
  if(equipmentAccess==='basic_gym')return['barbell','dumbbell','machine','cable','bodyweight','pullup_bar','band','general'];
  if(equipmentAccess==='home_gym')return['barbell','dumbbell','bodyweight','pullup_bar','band','trap_bar','general'];
  if(equipmentAccess==='minimal')return['dumbbell','bodyweight','pullup_bar','band','general'];
  return null;
}

function isPlanExerciseEquipmentCompatible(exercise,equipmentAccess){
  const allowed=getPlanEquipmentTagsForAccess(equipmentAccess);
  if(!allowed||!allowed.length)return true;
  const tags=toPlanList(getPlanExerciseMeta(exercise)?.equipmentTags);
  if(!tags.length||tags.includes('general'))return true;
  return tags.some(tag=>allowed.includes(String(tag||'').trim()));
}

function getPlanProgramReplacementInfo(exercise,context){
  const overrides=context?.programConstraints?.exerciseOverrides||{};
  const keys=[
    normalizePlanToken(resolvePlanExerciseId(exercise)),
    normalizePlanToken(exercise?.name)
  ].filter(Boolean);
  for(let i=0;i<keys.length;i++){
    if(overrides[keys[i]])return overrides[keys[i]];
  }
  return null;
}

function getExerciseConflictInfo(exercise,context,decision){
  const excludedIds=new Set(toPlanList(context?.excludedExerciseIds));
  const avoidTags=new Set(toPlanList(context?.limitations?.avoidMovementTags));
  const behaviorAvoidIds=new Set(toPlanList(context?.behaviorSignals?.avoidedExerciseIds));
  const exerciseId=resolvePlanExerciseId(exercise);
  const tags=getPlanExerciseMovementTags(exercise);
  const flags=new Set(toPlanList(decision?.restrictionFlags));
  const currentMeta=getPlanExerciseMeta(exercise);
  const info={
    blocked:false,
    deprioritized:false,
    reasonCode:'',
    exerciseId,
    tags,
    equipmentMismatch:false
  };
  if(exerciseId&&excludedIds.has(exerciseId)){
    info.blocked=true;
    info.reasonCode='excluded';
    return info;
  }
  if(tags.some(tag=>avoidTags.has(tag))){
    info.blocked=true;
    info.reasonCode='movement_limit';
    return info;
  }
  if(flags.has('avoid_overhead')&&tags.includes('vertical_press')){
    info.blocked=true;
    info.reasonCode='joint_limit';
    return info;
  }
  if(flags.has('avoid_heavy_spinal_loading')&&(tags.includes('hinge')||tags.includes('squat'))){
    info.blocked=true;
    info.reasonCode='spinal_limit';
    return info;
  }
  if(flags.has('avoid_knee_dominant_volume')&&(tags.includes('squat')||tags.includes('single_leg'))){
    info.blocked=true;
    info.reasonCode='knee_limit';
    return info;
  }
  if(!isPlanExerciseEquipmentCompatible(exercise,context?.equipmentAccess)){
    info.blocked=true;
    info.reasonCode='equipment';
    info.equipmentMismatch=true;
    return info;
  }
  if(exerciseId&&behaviorAvoidIds.has(exerciseId))info.deprioritized=true;
  if(currentMeta?.displayMuscleGroups?.includes('back')&&flags.has('avoid_heavy_legs')&&tags.includes('hinge'))info.deprioritized=true;
  return info;
}

function getPlanSportLoad(scheduleLike,workoutList,manualContext){
  const auto=typeof getAutomaticSportPreferenceContext==='function'
    ? getAutomaticSportPreferenceContext(scheduleLike||{},workoutList||[])
    : {preferUpper:false,isSportDay:false,hadSportRecently:false,sportName:(scheduleLike?.sportName||'Sport'),legsStress:'none'};
  const merged=typeof mergeSportPreferenceContext==='function'
    ? mergeSportPreferenceContext(auto,manualContext)
    : {...auto,...manualContext};
  const now=Date.now();
  const recent24=(workoutList||[]).filter(workout=>isPlanSportWorkout(workout)&&(now-new Date(workout.date).getTime())<=24*3600000).length;
  const recent48=(workoutList||[]).filter(workout=>isPlanSportWorkout(workout)&&(now-new Date(workout.date).getTime())<=48*3600000).length;
  const recent72=(workoutList||[]).filter(workout=>isPlanSportWorkout(workout)&&(now-new Date(workout.date).getTime())<=72*3600000).length;
  return{
    signal:merged.legsStress||'none',
    level:merged.sportLoadLevel||'none',
    preferUpper:merged.preferUpper===true,
    isSportDay:merged.isSportDay===true,
    hadSportRecently:merged.hadSportRecently===true,
    sportName:merged.sportName||scheduleLike?.sportName||trPlan('common.sport','Sport'),
    recent24h:recent24,
    recent48h:recent48,
    recent72h:recent72
  };
}

function getPlanningRestrictionFlags(context){
  const flags=[];
  const equipment=context.equipmentAccess;
  if(equipment==='minimal'||equipment==='home_gym')flags.push('minimal_equipment');
  if(context.sportLoad.preferUpper||context.sportLoad.signal==='today'||context.sportLoad.signal==='yesterday'||context.sportLoad.signal==='tomorrow'||context.sportLoad.signal==='both'){
    flags.push('avoid_heavy_legs');
  }
  const joints=new Set(toPlanList(context.limitations?.jointFlags));
  if(joints.has('shoulder'))flags.push('avoid_overhead');
  if(joints.has('low_back'))flags.push('avoid_heavy_spinal_loading');
  if(joints.has('knee'))flags.push('avoid_knee_dominant_volume');
  return [...new Set(flags)];
}

function getRecommendedSessionOptionForDecision(context){
  const prog=context.activeProgram;
  if(!prog||typeof prog.getSessionOptions!=='function')return '';
  try{
    const rawOptions=prog.getSessionOptions(context.activeProgramState||{},context.workouts||[],context.schedule||{});
    const effectiveOptions=typeof applyPreferenceRecommendation==='function'
      ? applyPreferenceRecommendation(prog,rawOptions,context.activeProgramState||{},{
        preferUpper:context.sportLoad.preferUpper,
        isSportDay:context.sportLoad.isSportDay,
        hadSportRecently:context.sportLoad.hadSportRecently,
        sportName:context.sportLoad.sportName,
        sportLoadLevel:context.sportLoad.level,
        legsStress:context.sportLoad.signal,
        manualLegsStress:context.sportLoad.signal,
        hasManualLegsStress:context.sportLoad.signal!=='none'
      })
      : rawOptions;
    const recommended=effectiveOptions.find(option=>option.isRecommended&&!option.done)||effectiveOptions.find(option=>!option.done)||effectiveOptions[0];
    return String(recommended?.value||'');
  }catch(_error){
    return '';
  }
}

function getPlanningProgramState(program,rawState){
  const cloned=clonePlanValue(rawState)||{};
  if(typeof program?.migrateState==='function'){
    try{
      return program.migrateState(cloned)||cloned;
    }catch(_error){}
  }
  if((!cloned||typeof cloned!=='object'||!Object.keys(cloned).length)&&typeof program?.getInitialState==='function'){
    try{
      return clonePlanValue(program.getInitialState())||cloned;
    }catch(_error){}
  }
  return cloned;
}

function buildPlanningContext(input){
  const next=input||{};
  const profileLike=next.profile||profile||{};
  const scheduleLike=next.schedule||schedule||{};
  const workoutList=next.workouts||workouts||[];
  const activeProgram=next.activeProgram||((typeof getActiveProgram==='function')?getActiveProgram():null);
  const rawActiveProgramState=next.activeProgramState||((typeof getActiveProgramState==='function')?getActiveProgramState():{});
  const activeProgramState=getPlanningProgramState(activeProgram,rawActiveProgramState);
  const fatigue=next.fatigue||((typeof computeFatigue==='function')?computeFatigue():{overall:0,muscular:0,cns:0});
  const prefs=typeof normalizeTrainingPreferences==='function'
    ? normalizeTrainingPreferences(profileLike)
    : (profileLike.preferences||{});
  const coaching=typeof normalizeCoachingProfile==='function'
    ? normalizeCoachingProfile(profileLike)
    : (profileLike.coaching||{});
  const activeProgramId=typeof getCanonicalProgramId==='function'
    ? getCanonicalProgramId(activeProgram?.id||profileLike.activeProgram||'forge')
    : String(activeProgram?.id||profileLike.activeProgram||'forge');
  const effectiveFrequency=typeof getEffectiveProgramFrequency==='function'
    ? getEffectiveProgramFrequency(activeProgramId,profileLike)
    : parseInt(prefs.trainingDaysPerWeek,10)||3;
  const sportLoad=getPlanSportLoad(scheduleLike,workoutList,next.sportContext);
  const adherence=getPlanningAdherenceSignals(activeProgramId,workoutList);
  const progression=getPlanningProgressSignals(activeProgramState);
  const derivedBehaviorSignals=getPlanningBehaviorSignals(activeProgramId,workoutList);
  const feedbackSignals=getSessionFeedbackSignals(activeProgramId,workoutList);
  const profileBehaviorSignals=coaching.behaviorSignals||{};
  const behaviorSignals={
    avoidedExerciseIds:[...new Set([
      ...toPlanList(profileBehaviorSignals.avoidedExerciseIds),
      ...toPlanList(derivedBehaviorSignals.avoidedExerciseIds)
    ])],
    skippedAccessoryExerciseIds:[...new Set([
      ...toPlanList(profileBehaviorSignals.skippedAccessoryExerciseIds),
      ...toPlanList(derivedBehaviorSignals.skippedAccessoryExerciseIds)
    ])],
    preferredSwapExerciseIds:[...new Set([
      ...toPlanList(profileBehaviorSignals.preferredSwapExerciseIds),
      ...toPlanList(derivedBehaviorSignals.preferredSwapExerciseIds)
    ])],
    shortenCount:Math.max(parseInt(profileBehaviorSignals.shortenCount,10)||0,derivedBehaviorSignals.shortenCount||0),
    lightenCount:Math.max(parseInt(profileBehaviorSignals.lightenCount,10)||0,derivedBehaviorSignals.lightenCount||0),
    sportCollisionCount:Math.max(parseInt(profileBehaviorSignals.sportCollisionCount,10)||0,derivedBehaviorSignals.sportCollisionCount||0)
  };
  const weekStart=typeof getWeekStart==='function'?getWeekStart(new Date()):new Date();
  const sessionsDoneThisWeek=(workoutList||[]).filter(workout=>{
    const ts=new Date(workout.date).getTime();
    if(!Number.isFinite(ts)||ts<weekStart.getTime())return false;
    const workoutProgramId=typeof getWorkoutProgramId==='function'?getWorkoutProgramId(workout):workout?.program;
    return workoutProgramId===activeProgramId;
  }).length;
  const recentMuscleLookback=Math.max(1,parseInt(MUSCLE_LOAD_CONFIG?.lookbackDays,10)||7);
  const recentMuscleLoad=typeof getRecentDisplayMuscleLoads==='function'?getRecentDisplayMuscleLoads(recentMuscleLookback):{};
  const context={
    profile:profileLike,
    schedule:scheduleLike,
    workouts:workoutList,
    activeProgram,
    activeProgramId,
    activeProgramState,
    preferences:prefs,
    coaching,
    goal:prefs.goal,
    effectiveFrequency,
    timeBudgetMinutes:parseInt(prefs.sessionMinutes,10)||60,
    equipmentAccess:prefs.equipmentAccess||'full_gym',
    fatigue,
    recoveryScore:clampPlan(100-(parseInt(fatigue?.overall,10)||0),0,100),
    sportLoad,
    recentMuscleLoad,
    experienceLevel:coaching.experienceLevel||'returning',
    guidanceMode:coaching.guidanceMode||'balanced',
    limitations:coaching.limitations||{},
    exercisePreferences:coaching.exercisePreferences||{},
    behaviorSignals,
    preferredExerciseIds:toPlanList(coaching.exercisePreferences?.preferredExerciseIds),
    excludedExerciseIds:[...new Set([
      ...toPlanList(coaching.exercisePreferences?.excludedExerciseIds),
      ...toPlanList(coaching.limitations?.avoidExerciseIds)
    ])],
    deprioritizedExerciseIds:[...new Set([
      ...toPlanList(behaviorSignals.avoidedExerciseIds),
      ...toPlanList(behaviorSignals.skippedAccessoryExerciseIds)
    ])],
    adherence,
    progression,
    feedbackSignals,
    sessionsDoneThisWeek,
    sessionsRemaining:Math.max(0,effectiveFrequency-sessionsDoneThisWeek),
    recommendedSessionOption:'',
    programConstraints:{}
  };
  context.programConstraints=typeof activeProgram?.getProgramConstraints==='function'
    ? (activeProgram.getProgramConstraints(activeProgramState,context)||{})
    : {};
  context.restrictionFlags=getPlanningRestrictionFlags(context);
  context.recommendedSessionOption=getRecommendedSessionOptionForDecision(context);
  return context;
}

function getTodayTrainingDecision(context){
  const next=context||buildPlanningContext({});
  const reasonCodes=[];
  let action='train';
  if(next.sessionsRemaining<=0){
    action='rest';
    reasonCodes.push('week_complete');
  }else if(next.recoveryScore<=30||(next.adherence.consecutivePoorSessions>=3&&next.progression.hasStalls)){
    action=(next.activeProgram?.getBlockInfo?.(next.activeProgramState||{})?.isDeload)?'train_light':'deload';
    reasonCodes.push('low_recovery');
  }else if(next.recoveryScore<=45||next.adherence.consecutivePoorSessions>=2){
    action='train_light';
    reasonCodes.push('conservative_recovery');
  }else if(next.timeBudgetMinutes<=35){
    action='shorten';
    reasonCodes.push('tight_time_budget');
  }
  if(next.sportLoad.preferUpper)reasonCodes.push('sport_load');
  if(next.equipmentAccess==='minimal'||next.equipmentAccess==='home_gym')reasonCodes.push('equipment_constraint');
  if(next.progression.hasStalls)reasonCodes.push('progression_stall');
  if(next.guidanceMode==='guided'&&next.experienceLevel==='beginner')reasonCodes.push('guided_beginner');
  // Session feedback modulation — only affects the gray zone, never overrides low_recovery or deload
  if(next.feedbackSignals?.tooHardBias){
    if(action==='train'){action='train_light';reasonCodes.push('session_feedback_hard');}
    else if(action==='train_light'||action==='shorten')reasonCodes.push('session_feedback_hard');
  }
  if(next.feedbackSignals?.durationFriction&&action==='train'){
    action='shorten';reasonCodes.push('duration_friction');
  }
  if(next.feedbackSignals?.tooEasyBias&&action==='train_light'
    &&!reasonCodes.includes('low_recovery')&&next.recoveryScore>45){
    action='train';reasonCodes.push('session_feedback_easy');
  }
  const autoregulationLevel=action==='deload'?'deload':(action==='train_light'?'conservative':'normal');
  return{
    action,
    reasonCodes:[...new Set(reasonCodes)],
    recommendedProgramId:next.activeProgramId,
    recommendedSessionOption:next.recommendedSessionOption||'',
    timeBudgetMinutes:next.timeBudgetMinutes,
    restrictionFlags:[...new Set(next.restrictionFlags||[])],
    autoregulationLevel
  };
}

function getWeekPlanDateKey(date){
  if(!(date instanceof Date)||!Number.isFinite(date.getTime()))return '';
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function normalizeWeekPlanLabel(label){
  return String(label||'')
    .replace(/^[\u{1F300}-\u{1FFFF}\u2600-\u27FF]\s*/u,'')
    .replace(/^\u2705\s*/u,'')
    .replace(/\s+/g,' ')
    .trim();
}

function getWeekPlanSessionLabel(program,state,optionValue,context,optionLabel){
  let label='';
  if(typeof program?.getSessionLabel==='function'){
    try{
      label=program.getSessionLabel(optionValue,state||{},context||{})||'';
    }catch(_error){}
  }
  if(!label)label=optionLabel||'';
  return normalizeWeekPlanLabel(label);
}

function getWeekPlanWorkoutLabel(workout,program,fallbackState){
  if(!workout)return '';
  if(typeof program?.getSessionLabel==='function'&&workout.programDayNum!=null){
    try{
      const stateForLabel=clonePlanValue(workout.programStateBefore||fallbackState||{})||{};
      const label=program.getSessionLabel(workout.programDayNum,stateForLabel,{preview:true});
      if(label)return normalizeWeekPlanLabel(label);
    }catch(_error){}
  }
  return normalizeWeekPlanLabel(workout.programLabel||workout.sessionDescription||workout.name||'');
}

function pickDistributedWeekPlanIndices(candidateIndices,count){
  const safeIndices=(candidateIndices||[]).filter(Number.isFinite);
  const target=Math.max(0,parseInt(count,10)||0);
  if(!safeIndices.length||!target)return[];
  if(target>=safeIndices.length)return safeIndices.slice();
  if(target===1)return[safeIndices[Math.floor((safeIndices.length-1)/2)]];
  const picked=[];
  for(let step=0;step<target;step++){
    const rawIndex=Math.round((step*(safeIndices.length-1))/(target-1));
    const candidate=safeIndices[rawIndex];
    if(!picked.includes(candidate))picked.push(candidate);
  }
  safeIndices.forEach(index=>{
    if(picked.length>=target)return;
    if(!picked.includes(index))picked.push(index);
  });
  return picked.sort((a,b)=>a-b);
}

function getWeekPlanPreview(planningContext,workoutList,scheduleLike,programLike,programState){
  const context=planningContext||buildPlanningContext({
    workouts:workoutList,
    schedule:scheduleLike,
    activeProgram:programLike,
    activeProgramState:programState
  });
  const program=programLike||context?.activeProgram||((typeof getActiveProgram==='function')?getActiveProgram():null);
  const state=getPlanningProgramState(
    program,
    programState||context?.activeProgramState||((typeof getActiveProgramState==='function')?getActiveProgramState():{})
  );
  const scheduleData=scheduleLike||context?.schedule||schedule||{};
  const workoutsForPreview=Array.isArray(workoutList)?workoutList:(context?.workouts||workouts||[]);
  if(!program){
    return{visible:false,days:[],title:'',labels:{}};
  }

  const today=new Date();
  const weekStart=typeof getWeekStart==='function'?getWeekStart(today):new Date(today);
  const todayIndex=((today.getDay()+6)%7);
  const activeProgramId=typeof getCanonicalProgramId==='function'
    ? getCanonicalProgramId(program.id||context?.activeProgramId||'')
    : String(program.id||context?.activeProgramId||'');
  const targetSessions=Math.max(0,parseInt(context?.effectiveFrequency,10)||parseInt(context?.sessionsDoneThisWeek,10)||0);
  const weekDays=Array.from({length:7},(_,offset)=>{
    const date=new Date(weekStart);
    date.setDate(weekStart.getDate()+offset);
    const dayDow=date.getDay();
    const dateKey=getWeekPlanDateKey(date);
    const logged=workoutsForPreview.filter(workout=>getWeekPlanDateKey(new Date(workout?.date))===dateKey);
    const loggedLift=logged.find(workout=>{
      if(!workout||isSportWorkout(workout))return false;
      const workoutProgramId=typeof getWorkoutProgramId==='function'?getWorkoutProgramId(workout):workout?.program;
      return workoutProgramId===activeProgramId;
    })||null;
    const loggedSport=logged.some(workout=>isSportWorkout(workout));
    return{
      date,
      dateKey,
      index:offset,
      dow:dayDow,
      isToday:offset===todayIndex,
      isPast:offset<todayIndex,
      isSportDay:Array.isArray(scheduleData?.sportDays)&&scheduleData.sportDays.includes(dayDow),
      loggedLift,
      loggedSport
    };
  });

  const nonSportIndices=weekDays.filter(day=>!day.isSportDay).map(day=>day.index);
  const plannedWeekIndices=pickDistributedWeekPlanIndices(nonSportIndices,targetSessions);
  const optionEntries=typeof program.getSessionOptions==='function'
    ? (program.getSessionOptions(state,workoutsForPreview,scheduleData)||[])
    : [];
  const allPlanLabels=optionEntries.map(option=>getWeekPlanSessionLabel(program,state,option.value,{preview:true},option.label));
  while(allPlanLabels.length<plannedWeekIndices.length){
    const count=allPlanLabels.length+1;
    allPlanLabels.push(
      typeof trPlan==='function'
        ? trPlan('plan.week.day_label','Day {day}',{day:count})
        : `Day ${count}`
    );
  }
  const plannedLabelMap=new Map();
  plannedWeekIndices.forEach((dayIndex,labelIndex)=>{
    plannedLabelMap.set(dayIndex,allPlanLabels[labelIndex]||'');
  });

  const pendingLabels=optionEntries
    .filter(option=>!option.done)
    .map(option=>getWeekPlanSessionLabel(program,state,option.value,{preview:true},option.label));

  const todayHasLift=!!weekDays[todayIndex]?.loggedLift;
  const todayDecision=getTodayTrainingDecision(context);
  const todayNeedsSession=!todayHasLift
    &&(parseInt(context?.sessionsRemaining,10)||0)>0
    &&pendingLabels.length>0
    &&todayDecision.action!=='rest';
  let pendingCursor=todayNeedsSession?1:0;
  const futureCandidateIndices=weekDays
    .filter(day=>day.index>todayIndex&&!day.isSportDay)
    .map(day=>day.index);
  const futurePlannedCount=Math.max(0,(parseInt(context?.sessionsRemaining,10)||0)-(todayNeedsSession?1:0));
  const futurePlannedIndices=pickDistributedWeekPlanIndices(futureCandidateIndices,futurePlannedCount);
  const futurePlannedSet=new Set(futurePlannedIndices);

  const labels={
    title:typeof trPlan==='function'?trPlan('dashboard.week_plan.title','Week Preview'): 'Week Preview',
    train:typeof trPlan==='function'?trPlan('dashboard.week_plan.train','Train'): 'Train',
    sport:typeof trPlan==='function'?trPlan('dashboard.week_plan.sport','Sport'): 'Sport',
    rest:typeof trPlan==='function'?trPlan('dashboard.week_plan.rest','Rest'): 'Rest',
    missed:typeof trPlan==='function'?trPlan('dashboard.week_plan.missed','Missed'): 'Missed',
    done:typeof trPlan==='function'?trPlan('dashboard.week_plan.done','Done'): 'Done'
  };

  const days=weekDays.map(day=>{
    const dayName=typeof DAY_NAMES!=='undefined'&&Array.isArray(DAY_NAMES)?(DAY_NAMES[day.dow]||''):String(day.dow);
    const base={
      dayIndex:day.index,
      dayName,
      dayNumber:day.date.getDate(),
      slot:'rest',
      sessionLabel:'',
      isToday:day.isToday,
      isPast:day.isPast
    };

    if(day.loggedLift){
      return{
        ...base,
        slot:'done',
        sessionLabel:getWeekPlanWorkoutLabel(day.loggedLift,program,state)||labels.done
      };
    }

    if(day.isPast){
      if(plannedLabelMap.has(day.index)){
        return{
          ...base,
          slot:'missed',
          sessionLabel:plannedLabelMap.get(day.index)||labels.missed
        };
      }
      if(day.loggedSport){
        return{...base,slot:'sport',sessionLabel:labels.sport};
      }
      return{...base,slot:'rest',sessionLabel:labels.rest};
    }

    if(day.isToday){
      if(todayNeedsSession){
        return{
          ...base,
          slot:'train',
          sessionLabel:pendingLabels[0]||plannedLabelMap.get(day.index)||labels.train
        };
      }
      if(day.loggedSport||todayDecision.action==='rest'&&day.isSportDay){
        return{...base,slot:'sport',sessionLabel:labels.sport};
      }
      return{...base,slot:'rest',sessionLabel:labels.rest};
    }

    if(futurePlannedSet.has(day.index)){
      const label=pendingLabels[pendingCursor]||plannedLabelMap.get(day.index)||labels.train;
      pendingCursor++;
      return{
        ...base,
        slot:'train',
        sessionLabel:label
      };
    }

    if(day.isSportDay){
      return{...base,slot:'sport',sessionLabel:labels.sport};
    }

    return{...base,slot:'rest',sessionLabel:labels.rest};
  });

  return{
    visible:true,
    title:labels.title,
    labels,
    days
  };
}

function createTrainingCommentaryEvent(code,params){
  if(!code)return null;
  const cleanParams=(params&&typeof params==='object')?JSON.parse(JSON.stringify(params)):{};
  return{code:String(code),params:cleanParams};
}

function normalizeTrainingCommentaryEvent(event){
  if(!event)return null;
  if(typeof event==='string'){
    const text=String(event||'').trim();
    return text?{code:'legacy_text',text,params:{}}:null;
  }
  if(typeof event!=='object')return null;
  const code=String(event.code||'').trim();
  if(!code)return null;
  if(code==='legacy_text'){
    const text=String(event.text||'').trim();
    return text?{code,text,params:{}}:null;
  }
  const params=(event.params&&typeof event.params==='object')?JSON.parse(JSON.stringify(event.params)):{};
  return{code,params};
}

function dedupeTrainingCommentaryEvents(events){
  const seen=new Set();
  const next=[];
  toPlanList(events).forEach(event=>{
    const normalized=normalizeTrainingCommentaryEvent(event);
    if(!normalized)return;
    const key=normalized.code==='legacy_text'
      ? `legacy:${normalized.text}`
      : `${normalized.code}:${JSON.stringify(normalized.params||{})}`;
    if(seen.has(key))return;
    seen.add(key);
    next.push(normalized);
  });
  return next;
}

function getTrainingDecisionCode(decision){
  const next=decision||{};
  if(next.action==='rest')return'rest';
  if(next.action==='deload')return'deload';
  if(next.action==='train_light')return'train_light';
  if(next.action==='shorten')return'shorten';
  if((next.restrictionFlags||[]).includes('avoid_heavy_legs'))return'sport_aware';
  return'train';
}

function getTrainingCommentaryTone(decisionCode){
  const map={
    rest:'positive',
    deload:'warning',
    train_light:'info',
    shorten:'neutral',
    sport_aware:'info',
    train:'neutral'
  };
  return map[decisionCode]||'neutral';
}

function getTrainingProgramLabel(params){
  const programId=params?.programId;
  const fallback=params?.programName||trPlan('common.program','Program');
  if(programId&&window.I18N&&I18N.t)return I18N.t('program.'+programId+'.name',null,fallback);
  return fallback;
}

function getTrainingCommentaryFallback(decisionCode,surface){
  const fallbacks={
    rest:{
      title:'Week complete!',
      dashboard_summary:'All planned sessions are already done this week. Rest and recover.',
      dashboard_focus_support:'All planned sessions are already done this week. Rest and recover.',
      dashboard_coach:'All planned sessions are already done this week. Rest and recover.',
      workout_summary:'This week is already covered. Keep today for recovery.',
      workout_start_toast:'Week complete!',
      program_warning:'The planned work for this week is already complete. Recovery is the better call today.'
    },
    deload:{
      title:'Deload recommendation',
      dashboard_summary:'Recovery is lagging, so keep today light and treat it like a deload. {count} sessions remain this week.',
      dashboard_focus_support:'Recovery is lagging, so keep today light and treat it like a deload. {count} sessions remain this week.',
      dashboard_coach:'Recovery is lagging, so keep today light and treat it like a deload. {count} sessions remain this week.',
      workout_summary:'Recovery is low, so keep today lighter than normal and reduce grinding.',
      workout_start_toast:'Deload recommendation',
      program_warning:'Recovery is low enough that a lighter option is the safer call today.'
    },
    train_light:{
      title:'Conservative training day',
      dashboard_summary:'You can still train, but keep the effort conservative and avoid unnecessary grinding. {count} sessions remain this week.',
      dashboard_focus_support:'You can still train, but keep the effort conservative and avoid unnecessary grinding. {count} sessions remain this week.',
      dashboard_coach:'You can still train, but keep the effort conservative and avoid unnecessary grinding. {count} sessions remain this week.',
      workout_summary:'Train today, but keep the effort conservative and let the session breathe.',
      workout_start_toast:'Conservative training day',
      program_warning:'You can still train, but keep the physiological cost conservative today.'
    },
    shorten:{
      title:'Short session plan',
      dashboard_summary:'Use your main work first and trim accessories to stay inside your time cap. {count} sessions remain this week.',
      dashboard_focus_support:'Use your main work first and trim accessories to stay inside your time cap. {count} sessions remain this week.',
      dashboard_coach:'Use your main work first and trim accessories to stay inside your time cap. {count} sessions remain this week.',
      workout_summary:'Main work first. Accessories will be trimmed to fit your time cap.',
      workout_start_toast:'Short session plan',
      program_warning:'Stay on the high-value work first and let accessories flex if time gets tight.'
    },
    sport_aware:{
      title:'Sport-aware session',
      dashboard_summary:'Sport load is high around today, so bias the session away from heavy leg work when possible. {count} sessions remain this week.',
      dashboard_focus_support:'Sport load is high around today, so bias the session away from heavy leg work when possible. {count} sessions remain this week.',
      dashboard_coach:'Sport load is high around today, so bias the session away from heavy leg work when possible. {count} sessions remain this week.',
      workout_summary:'{sport} load is high around today, so heavier leg work may be trimmed.',
      workout_start_toast:'Sport-aware session',
      program_warning:'Sport load is high enough that heavy lower-body work should stay under control today.'
    },
    train:{
      title:'Training day',
      dashboard_summary:'Recovery looks good enough to train normally today. {count} sessions remain this week.',
      dashboard_focus_support:'Recovery looks good enough to train normally today. {count} sessions remain this week.',
      dashboard_coach:'Recovery looks good enough to train normally today. {count} sessions remain this week.',
      workout_summary:'Your plan can run normally today.',
      workout_start_toast:'Training day',
      program_warning:'Training can run normally today.'
    }
  };
  return fallbacks[decisionCode]?.[surface]||fallbacks.train[surface]||'';
}

function getTrainingCommentaryReasonLabel(code){
  const keyMap={
    low_recovery:['training.reason.low_recovery.label','Low recovery'],
    conservative_recovery:['training.reason.conservative_recovery.label','Recovery caution'],
    tight_time_budget:['training.reason.tight_time_budget.label','35 min cap'],
    sport_load:['training.reason.sport_load.label','Sport load'],
    equipment_constraint:['training.reason.equipment_constraint.label','Equipment'],
    progression_stall:['training.reason.progression_stall.label','Progress stall'],
    guided_beginner:['training.reason.guided_beginner.label','Guided path'],
    week_complete:['training.reason.week_complete.label','Week complete'],
    session_feedback_hard:['training.reason.session_feedback_hard.label','Felt hard'],
    session_feedback_easy:['training.reason.session_feedback_easy.label','Felt easy'],
    duration_friction:['training.reason.duration_friction.label','Running long']
  };
  const pair=keyMap[code];
  return pair?trPlan(pair[0],pair[1]):'';
}

function getTrainingAdjustmentBody(event){
  const next=normalizeTrainingCommentaryEvent(event);
  if(!next)return'';
  if(next.code==='legacy_text')return next.text||'';
  const params=next.params||{};
  if(next.code==='short_session_accessories_trimmed'){
    return trPlan('training.adjustment.short_session_accessories_trimmed.body','Accessory work trimmed for a shorter session.');
  }
  if(next.code==='aux_volume_reduced'){
    return trPlan('training.adjustment.aux_volume_reduced.body','Auxiliary volume reduced to fit your time cap.');
  }
  if(next.code==='sport_support_trimmed'){
    return trPlan('training.adjustment.sport_support_trimmed.body','Accessory work removed to keep the session sharper for sport support.');
  }
  if(next.code==='sport_tomorrow'){
    return trPlan('training.adjustment.sport_tomorrow.body','Tomorrow looks leg-heavy, so lower-body work was kept slightly lighter.');
  }
  if(next.code==='sport_today'){
    return trPlan('training.adjustment.sport_today.body','Keeps lower-body work more manageable around today\'s sport.');
  }
  if(next.code==='sport_yesterday'){
    return trPlan('training.adjustment.sport_yesterday.body','Yesterday was leg-heavy, so lower-body work was kept lighter today.');
  }
  if(next.code==='sport_both'){
    return trPlan('training.adjustment.sport_both.body','Leg-heavy sport sits on both sides of this session, so lower-body work was trimmed.');
  }
  if(next.code==='exercise_replaced_equipment'){
    return trPlan('training.adjustment.exercise_replaced_equipment.body','Swapped {from} to {to} to match your available equipment.',params);
  }
  if(next.code==='exercise_replaced_limit'){
    return trPlan('training.adjustment.exercise_replaced_limit.body','Swapped {from} to {to} to respect your current limits.',params);
  }
  if(next.code==='exercise_removed_limit'){
    return trPlan('training.adjustment.exercise_removed_limit.body','Removed {exercise} because it conflicts with your current limits.',params);
  }
  if(next.code==='program_sport_trimmed'){
    return trPlan('training.adjustment.program_sport_trimmed.body','{program} trimmed lower-body auxiliary work first because sport load is close.',{program:getTrainingProgramLabel(params)});
  }
  if(next.code==='program_shoulder_trimmed'){
    return trPlan('training.adjustment.program_shoulder_trimmed.body','Shoulder-sensitive vertical assistance was deprioritized for this session.');
  }
  if(next.code==='runner_shorten'){
    return trPlan('training.adjustment.runner_shorten.body','Lower-priority work was cut so you can finish the essential work faster.');
  }
  if(next.code==='runner_lighten'){
    return trPlan('training.adjustment.runner_lighten.body','Keep the session moving, but leave more in the tank with slightly lighter remaining work.');
  }
  return'';
}

function getTrainingEquipmentHintBody(event){
  const next=normalizeTrainingCommentaryEvent(event);
  if(!next||next.code==='legacy_text')return'';
  const params=next.params||{};
  if(next.code==='swap_hint'){
    return trPlan('training.equipment.swap_hint.body','Use exercise swap freely if your setup does not match the planned lift exactly.');
  }
  if(next.code==='same_pattern_swaps'){
    return trPlan('training.equipment.same_pattern_swaps.body','{program} will prioritize same-pattern substitutions before dropping work.',{program:getTrainingProgramLabel(params)});
  }
  return'';
}

function getTrainingRunnerFallback(mode,field){
  const fallbacks={
    normal:{title:'Normal session flow',copy:'Stay on the main work and move through the remaining sets in order.'},
    shorten:{title:'Shortened session',copy:'Lower-priority work was cut so you can finish the essential work faster.',toast:'Session shortened to the essential work'},
    lighten:{title:'Lighter session',copy:'Keep the session moving, but leave more in the tank with slightly lighter remaining work.',toast:'Remaining work lightened'},
    sport_aware:{title:'Sport-aware session',copy:'Leg-heavy work is being kept under control because of surrounding sport load.'},
    undo:{toast:'Last adjustment undone'},
    no_change:{toast:'No remaining work needed adjustment'}
  };
  return fallbacks[mode]?.[field]||'';
}

function getTrainingCommentaryLegacyEvents(workout){
  return dedupeTrainingCommentaryEvents(toPlanList(workout?.adaptationReasons));
}

function buildTrainingCommentaryState(input){
  const next=input||{};
  const workout=next.workout||{};
  const decision=next.decision||workout.planningDecision||{};
  const context=next.context||workout.planningContext||{};
  const commentary=(workout.commentary&&typeof workout.commentary==='object')?workout.commentary:(next.commentary||null);
  const decisionCode=commentary?.decisionCode||getTrainingDecisionCode(decision);
  const reasonCodes=[...new Set([
    ...toPlanList(commentary?.reasonCodes),
    ...toPlanList(decision?.reasonCodes)
  ].filter(Boolean))];
  const restrictionFlags=[...new Set([
    ...toPlanList(commentary?.restrictionFlags),
    ...toPlanList(decision?.restrictionFlags)
  ].filter(Boolean))];
  const sportSignal=context?.sportLoad?.signal||workout?.sportContext?.legsStress||'none';
  const adaptationEvents=commentary?.adaptationEvents
    ? dedupeTrainingCommentaryEvents(commentary.adaptationEvents)
    : getTrainingCommentaryLegacyEvents(workout);
  const equipmentHint=normalizeTrainingCommentaryEvent(commentary?.equipmentHint);
  const runnerEvents=commentary?.runnerEvents
    ? dedupeTrainingCommentaryEvents(commentary.runnerEvents)
    : [];
  const runnerMode=workout?.runnerState?.mode||decision?.action||'train';
  const sportName=context?.sportLoad?.sportName||workout?.sportContext?.sportName||trPlan('common.sport','Sport');
  const derived={
    sessionsRemaining:context?.sessionsRemaining||0,
    sportName,
    sportSignal,
    showWarning:decisionCode!=='train'||restrictionFlags.includes('avoid_heavy_legs'),
    showStart:decisionCode!=='rest',
    runnerMode
  };
  return{
    version:1,
    decisionCode,
    tone:getTrainingCommentaryTone(decisionCode),
    reasonCodes,
    restrictionFlags,
    adaptationEvents,
    equipmentHint,
    runnerEvents,
    decision,
    context,
    workout,
    derived
  };
}

function buildTrainingCommentaryRecord(input){
  const state=buildTrainingCommentaryState(input);
  return{
    version:1,
    decisionCode:state.decisionCode,
    reasonCodes:[...state.reasonCodes],
    restrictionFlags:[...state.restrictionFlags],
    adaptationEvents:dedupeTrainingCommentaryEvents(state.adaptationEvents),
    equipmentHint:normalizeTrainingCommentaryEvent(state.equipmentHint),
    runnerEvents:dedupeTrainingCommentaryEvents(state.runnerEvents)
  };
}

function presentTrainingCommentary(state,surface){
  const next=state&&state.decisionCode?state:buildTrainingCommentaryState(state);
  const code=next.decisionCode||'train';
  const params={count:next.derived.sessionsRemaining||0,sport:next.derived.sportName||trPlan('common.sport','Sport')};
  const title=trPlan(`training.commentary.${code}.title`,getTrainingCommentaryFallback(code,'title'),params);
  if(surface==='dashboard_summary'){
    return{
      title,
      body:trPlan(`training.commentary.${code}.dashboard_summary`,getTrainingCommentaryFallback(code,'dashboard_summary'),params),
      tone:next.tone,
      reasons:[...next.reasonCodes],
      reasonLabels:next.reasonCodes.map(getTrainingCommentaryReasonLabel).filter(Boolean)
    };
  }
  if(surface==='dashboard_focus_support'){
    return{
      text:trPlan(`training.commentary.${code}.dashboard_focus_support`,getTrainingCommentaryFallback(code,'dashboard_focus_support'),params)
    };
  }
  if(surface==='dashboard_coach'){
    return{
      title,
      body:trPlan(`training.commentary.${code}.dashboard_coach`,getTrainingCommentaryFallback(code,'dashboard_coach'),params),
      tone:next.tone
    };
  }
  if(surface==='workout_summary'){
    return{
      kicker:trPlan('training.commentary.workout.kicker','Today\'s decision'),
      title,
      copy:trPlan(`training.commentary.${code}.workout_summary`,getTrainingCommentaryFallback(code,'workout_summary'),params),
      tone:next.tone,
      reasons:[...next.reasonCodes],
      reasonLabels:next.reasonCodes.map(getTrainingCommentaryReasonLabel).filter(Boolean)
    };
  }
  if(surface==='workout_start_toast'){
    return{
      text:trPlan(`training.commentary.${code}.workout_start_toast`,getTrainingCommentaryFallback(code,'workout_start_toast'),params),
      tone:next.tone
    };
  }
  if(surface==='workout_adaptation_list'){
    return next.adaptationEvents.map(getTrainingAdjustmentBody).filter(Boolean);
  }
  if(surface==='workout_equipment_hint'){
    return{
      text:getTrainingEquipmentHintBody(next.equipmentHint)
    };
  }
  if(surface==='program_warning'){
    return{
      title,
      copy:trPlan(`training.commentary.${code}.program_warning`,getTrainingCommentaryFallback(code,'program_warning'),params),
      tone:next.tone
    };
  }
  if(surface==='runner_summary'){
    const mode=next.derived.runnerMode==='shorten'
      ? 'shorten'
      : (next.derived.runnerMode==='lighten'||code==='deload'||code==='train_light')
        ? 'lighten'
        : code==='sport_aware'
          ? 'sport_aware'
          : 'normal';
    return{
      kicker:trPlan('training.runner.kicker','Session plan'),
      title:trPlan(`training.runner.${mode}.title`,getTrainingRunnerFallback(mode,'title')),
      copy:trPlan(`training.runner.${mode}.copy`,getTrainingRunnerFallback(mode,'copy'))
    };
  }
  if(surface==='runner_toast'){
    const lastEvent=next.runnerEvents[next.runnerEvents.length-1]||null;
    const codeKey=lastEvent?.code||'runner_no_change';
    const map={
      runner_shorten:['training.runner.shorten.toast',getTrainingRunnerFallback('shorten','toast')],
      runner_lighten:['training.runner.lighten.toast',getTrainingRunnerFallback('lighten','toast')],
      runner_undo:['training.runner.undo.toast',getTrainingRunnerFallback('undo','toast')],
      runner_no_change:['training.runner.no_change.toast',getTrainingRunnerFallback('no_change','toast')]
    };
    const pair=map[codeKey]||map.runner_no_change;
    return{text:trPlan(pair[0],pair[1])};
  }
  return null;
}

function getSharedTrainingDecisionSummary(decision,context,options){
  const opts=options||{};
  const surface=opts.mode==='workout'?'workout_summary':'dashboard_summary';
  const state=buildTrainingCommentaryState({decision,context});
  const summary=presentTrainingCommentary(state,surface);
  if(!summary)return null;
  return{
    title:summary.title,
    body:summary.body||summary.copy||'',
    copy:summary.copy||summary.body||'',
    tone:summary.tone||state.tone,
    reasons:[...state.reasonCodes],
    reasonLabels:[...(summary.reasonLabels||[])]
  };
}

function shouldRemoveExerciseForContext(exercise,context,decision){
  return getExerciseConflictInfo(exercise,context,decision).blocked;
}

function getSportLoadAdjustmentCode(context){
  const signal=context?.sportLoad?.signal||context?.sportContext?.legsStress||'none';
  if(signal==='both')return'sport_both';
  if(signal==='today')return'sport_today';
  if(signal==='tomorrow')return'sport_tomorrow';
  if(signal==='none'&&context?.sportLoad?.isSportDay)return'sport_today';
  return'sport_yesterday';
}

const SPORT_AWARE_SHAPING=Object.freeze({
  mainLoadReductionPct:0.075,
  auxLoadReductionPct:0.1,
  accessoryLoadReductionPct:0.1,
  mainMinSets:3,
  auxMaxSets:2,
  accessoryMaxSets:2
});

function getPlanNumericWeight(value){
  const numeric=parseFloat(value);
  return Number.isFinite(numeric)&&numeric>0?numeric:null;
}

function getPlanRoundingStep(context){
  const step=parseFloat(context?.activeProgramState?.rounding);
  return Number.isFinite(step)&&step>0?step:2.5;
}

function snapPlanWeight(value,step){
  const safeStep=Number.isFinite(step)&&step>0?step:2.5;
  return Math.max(0,Math.round(value/safeStep)*safeStep);
}

function getSportAwareReductionPct(exercise){
  if(exercise?.isAccessory)return SPORT_AWARE_SHAPING.accessoryLoadReductionPct;
  if(exercise?.isAux)return SPORT_AWARE_SHAPING.auxLoadReductionPct;
  return SPORT_AWARE_SHAPING.mainLoadReductionPct;
}

function applySportAwareWeightReduction(exercise,context){
  const rounding=getPlanRoundingStep(context);
  const reductionPct=getSportAwareReductionPct(exercise);
  let changed=false;
  if(Number.isFinite(parseFloat(exercise?.prescribedWeight))){
    exercise.prescribedWeight=snapPlanWeight(parseFloat(exercise.prescribedWeight)*(1-reductionPct),rounding);
    changed=true;
  }
  if(Array.isArray(exercise?.sets)){
    exercise.sets=exercise.sets.map(set=>{
      const weight=getPlanNumericWeight(set?.weight);
      if(weight===null)return set;
      changed=true;
      return{
        ...set,
        weight:snapPlanWeight(weight*(1-reductionPct),rounding)
      };
    });
  }
  return changed;
}

function applySportAwareVolumeReduction(exercise){
  if(!Array.isArray(exercise?.sets)||!exercise.sets.length)return false;
  const currentCount=exercise.sets.length;
  let nextCount=currentCount;
  if(exercise?.isAccessory)nextCount=Math.min(currentCount,SPORT_AWARE_SHAPING.accessoryMaxSets);
  else if(exercise?.isAux)nextCount=Math.min(currentCount,SPORT_AWARE_SHAPING.auxMaxSets);
  else if(currentCount>1)nextCount=Math.max(Math.min(currentCount-1,currentCount),Math.min(SPORT_AWARE_SHAPING.mainMinSets,currentCount));
  if(nextCount>=currentCount)return false;
  exercise.sets=exercise.sets.slice(0,nextCount);
  return true;
}

function trimShortSessionExercises(exercises,events,timeBudgetMinutes){
  let next=exercises.slice();
  const beforeAccessory=next.length;
  next=next.filter(exercise=>!exercise.isAccessory);
  if(next.length!==beforeAccessory)events.push(createTrainingCommentaryEvent('short_session_accessories_trimmed'));
  let trimmedAux=false;
  next.forEach(exercise=>{
    if(!exercise.isAux||exercise.isAccessory||!Array.isArray(exercise.sets))return;
    const targetCount=timeBudgetMinutes<=30?2:3;
    if(exercise.sets.length>targetCount){
      exercise.sets=exercise.sets.slice(0,targetCount);
      trimmedAux=true;
    }
  });
  if(trimmedAux)events.push(createTrainingCommentaryEvent('aux_volume_reduced'));
  return next;
}

function lightenLowerBodyForSport(exercises,events,context){
  let changed=false;
  exercises.forEach(exercise=>{
    if(!isPlanLowerBodyExercise(exercise)||!Array.isArray(exercise.sets))return;
    const weightChanged=applySportAwareWeightReduction(exercise,context);
    const volumeChanged=applySportAwareVolumeReduction(exercise);
    if(weightChanged||volumeChanged)changed=true;
  });
  if(changed)events.push(createTrainingCommentaryEvent(getSportLoadAdjustmentCode(context)));
}

function getConstraintReasonEvent(exercise,replacement,conflict){
  const fromLabel=exercise?.name||trPlan('common.exercise','Exercise');
  const toLabel=replacement?.name||'';
  if(toLabel){
    if(conflict?.reasonCode==='equipment'){
      return createTrainingCommentaryEvent('exercise_replaced_equipment',{from:fromLabel,to:toLabel});
    }
    return createTrainingCommentaryEvent('exercise_replaced_limit',{from:fromLabel,to:toLabel});
  }
  return createTrainingCommentaryEvent('exercise_removed_limit',{exercise:fromLabel});
}

function getExerciseReplacementCandidates(exercise,context,decision,replacementInfo){
  if(
    typeof window.getRegisteredExercise!=='function'||
    typeof window.listRegisteredExercises!=='function'||
    typeof window.searchRegisteredExercises!=='function'
  )return [];
  const excludeIds=[...new Set([
    resolvePlanExerciseId(exercise),
    ...toPlanList(context?.excludedExerciseIds)
  ].filter(Boolean))];
  const records=[];
  const seen=new Set();
  const allowedEquipment=getPlanEquipmentTagsForAccess(context?.equipmentAccess);

  function addRecord(record){
    if(!record?.id||seen.has(record.id))return;
    seen.add(record.id);
    records.push(record);
  }

  toPlanList(replacementInfo?.options).forEach(option=>{
    addRecord(window.getRegisteredExercise(option));
  });
  if(replacementInfo?.filters){
    window.listRegisteredExercises({
      sort:'featured',
      filters:{
        ...replacementInfo.filters,
        excludeIds,
        equipmentTags:replacementInfo.filters.equipmentTags||allowedEquipment||undefined
      }
    }).slice(0,12).forEach(addRecord);
  }
  const baseId=resolvePlanExerciseId(exercise);
  if(baseId&&typeof window.getRelatedRegisteredExercises==='function'){
    window.getRelatedRegisteredExercises(baseId,{
      sameMovement:true,
      sameEquipment:decision?.restrictionFlags?.includes('minimal_equipment')!==true,
      excludeIds,
      limit:10
    }).forEach(addRecord);
  }
  const baseMeta=getPlanExerciseMeta(exercise);
  if(baseMeta){
    window.searchRegisteredExercises('',{
      limit:18,
      excludeIds,
      movementTags:baseMeta.movementTags,
      muscleGroups:baseMeta.displayMuscleGroups,
      equipmentTags:allowedEquipment||undefined
    }).forEach(addRecord);
  }
  return records;
}

function scoreExerciseReplacementCandidate(exercise,candidate,context,decision,replacementInfo){
  if(!candidate?.id)return Number.NEGATIVE_INFINITY;
  const conflict=getExerciseConflictInfo(candidate,context,decision);
  if(conflict.blocked)return Number.NEGATIVE_INFINITY;
  const currentMeta=getPlanExerciseMeta(exercise)||{movementTags:[],displayMuscleGroups:[],equipmentTags:[]};
  const candidateMeta=getPlanExerciseMeta(candidate)||candidate;
  const sharedMovement=(candidateMeta?.movementTags||[]).filter(tag=>currentMeta.movementTags.includes(tag)).length;
  const sharedMuscles=(candidateMeta?.displayMuscleGroups||[]).filter(tag=>currentMeta.displayMuscleGroups.includes(tag)).length;
  const sharedEquipment=(candidateMeta?.equipmentTags||[]).filter(tag=>(currentMeta.equipmentTags||[]).includes(tag)).length;
  let score=sharedMovement*30+sharedMuscles*10+sharedEquipment*8+(candidate.popularity||0)/10+(candidate.featured?6:0);
  const preferredIds=new Set(toPlanList(context?.preferredExerciseIds));
  const preferredSwapIds=new Set(toPlanList(context?.behaviorSignals?.preferredSwapExerciseIds));
  const deprioritizedIds=new Set(toPlanList(context?.deprioritizedExerciseIds));
  if(preferredIds.has(candidate.id))score+=22;
  if(preferredSwapIds.has(candidate.id))score+=16;
  if(deprioritizedIds.has(candidate.id))score-=12;
  if(isPlanExerciseEquipmentCompatible(candidate,context?.equipmentAccess))score+=18;
  if(replacementInfo?.options){
    const idx=toPlanList(replacementInfo.options).findIndex(option=>resolvePlanExerciseId(option)===candidate.id||normalizePlanToken(option)===normalizePlanToken(candidate.name));
    if(idx>=0)score+=40-idx*4;
  }
  return score;
}

function buildExerciseReplacementPlan(input){
  const next=input||{};
  const exercise=next.exercise;
  const context=next.context||{};
  const decision=next.decision||{};
  const conflict=next.conflict||getExerciseConflictInfo(exercise,context,decision);
  if(!conflict.blocked)return{conflict,replacement:null,clearWeight:false,reason:''};
  const replacementInfo=next.replacementInfo||getPlanProgramReplacementInfo(exercise,context);
  const canUseReplacement=exercise?.isAccessory||exercise?.isAux||exercise?.auxSlotIdx>=0||!!replacementInfo;
  if(!canUseReplacement)return{conflict,replacement:null,clearWeight:false,reason:getConstraintReasonEvent(exercise,null,conflict)};
  const candidates=getExerciseReplacementCandidates(exercise,context,decision,replacementInfo);
  const ranked=candidates
    .map(candidate=>({candidate,score:scoreExerciseReplacementCandidate(exercise,candidate,context,decision,replacementInfo)}))
    .filter(item=>Number.isFinite(item.score))
    .sort((a,b)=>b.score-a.score||a.candidate.name.localeCompare(b.candidate.name));
  const replacement=ranked[0]?.candidate||null;
  if(!replacement)return{conflict,replacement:null,clearWeight:false,reason:getConstraintReasonEvent(exercise,null,conflict)};
  const currentMeta=getPlanExerciseMeta(exercise)||{equipmentTags:[]};
  const replacementMeta=getPlanExerciseMeta(replacement)||replacement;
  const sharedEquipment=(replacementMeta?.equipmentTags||[]).filter(tag=>(currentMeta?.equipmentTags||[]).includes(tag)).length;
  return{
    conflict,
    replacement,
    clearWeight:sharedEquipment===0||replacementInfo?.clearWeightOnSwap===true,
    reason:getConstraintReasonEvent(exercise,replacement,conflict)
  };
}

function applyExerciseReplacement(exercise,replacementPlan){
  const replacement=replacementPlan?.replacement;
  if(!replacement)return null;
  const next={...exercise,name:replacement.name,exerciseId:replacement.id};
  if(replacementPlan.clearWeight&&Array.isArray(next.sets)){
    next.sets=next.sets.map(set=>{
      if(set?.done===true)return{...set};
      return{
        ...set,
        weight:(replacement.equipmentTags||[]).includes('bodyweight')?0:''
      };
    });
    if('prescribedWeight' in next)next.prescribedWeight='';
  }
  return next;
}

function resolveSessionConstraints(input){
  const next=input||{};
  const context=next.context||{};
  const decision=next.decision||{};
  const exercises=clonePlanSession(next.exercises||[]);
  const adaptationEvents=[];
  const resolvedExercises=[];
  exercises.forEach(exercise=>{
    const conflict=getExerciseConflictInfo(exercise,context,decision);
    if(!conflict.blocked){
      resolvedExercises.push(exercise);
      return;
    }
    const replacementPlan=buildExerciseReplacementPlan({exercise,context,decision,conflict});
    if(replacementPlan.replacement){
      resolvedExercises.push(applyExerciseReplacement(exercise,replacementPlan));
      adaptationEvents.push(replacementPlan.reason);
      return;
    }
    adaptationEvents.push(replacementPlan.reason||getConstraintReasonEvent(exercise,null,conflict));
  });
  return{
    exercises:resolvedExercises,
    adaptationEvents:dedupeTrainingCommentaryEvents(adaptationEvents)
  };
}

function buildAdaptiveSessionPlan(input){
  const next=input||{};
  const context=next.context||buildPlanningContext({});
  const decision=next.decision||getTodayTrainingDecision(context);
  const decisionImpliesLight=decision?.action==='train_light'||decision?.action==='deload';
  const effectiveSessionMode=next.effectiveSessionMode==='light'
    ? 'light'
    : (decisionImpliesLight?'light':'normal');
  const prog=(typeof getProgramById==='function'?getProgramById(next.programId):null)||(typeof getActiveProgram==='function'?getActiveProgram():null);
  const baseSession=clonePlanSession(next.baseSession||[]);
  let exercises=baseSession;
  const adaptationEvents=[];
  let equipmentHint=null;
  if(typeof prog?.adaptSession==='function'){
    const adapted=prog.adaptSession(baseSession,context,decision);
    if(adapted&&Array.isArray(adapted.exercises||adapted)){
      exercises=Array.isArray(adapted)?adapted:(adapted.exercises||[]);
      adaptationEvents.push(...toPlanList(adapted.adaptationEvents||adapted.changes));
      equipmentHint=normalizeTrainingCommentaryEvent(adapted.equipmentHint)||equipmentHint;
    }
  }
  const resolvedConstraints=resolveSessionConstraints({exercises,context,decision});
  exercises=resolvedConstraints.exercises;
  adaptationEvents.push(...resolvedConstraints.adaptationEvents);
  if(decision.action==='shorten'||decision.timeBudgetMinutes<=35){
    exercises=trimShortSessionExercises(exercises,adaptationEvents,decision.timeBudgetMinutes||context.timeBudgetMinutes);
  }else if(decision.action==='train_light'||effectiveSessionMode==='light'){
    exercises=trimShortSessionExercises(exercises,adaptationEvents,45);
  }
  if(decision.restrictionFlags?.includes('avoid_heavy_legs')){
    lightenLowerBodyForSport(exercises,adaptationEvents,context);
  }
  if(context.goal==='sport_support'&&exercises.some(exercise=>exercise.isAccessory)){
    exercises=exercises.filter(exercise=>!exercise.isAccessory);
    adaptationEvents.push(createTrainingCommentaryEvent('sport_support_trimmed'));
  }
  equipmentHint=equipmentHint||((context.equipmentAccess==='basic_gym'||context.equipmentAccess==='home_gym'||context.equipmentAccess==='minimal')
    ? createTrainingCommentaryEvent('swap_hint')
    : null);
  return{
    exercises,
    adaptationEvents:dedupeTrainingCommentaryEvents(adaptationEvents),
    equipmentHint,
    decision,
    commentary:buildTrainingCommentaryRecord({
      decision,
      context,
      commentary:{
        version:1,
        decisionCode:getTrainingDecisionCode(decision),
        reasonCodes:[...toPlanList(decision?.reasonCodes)],
        restrictionFlags:[...toPlanList(decision?.restrictionFlags)],
        adaptationEvents,
        equipmentHint,
        runnerEvents:[]
      }
    })
  };
}

function getPlanDayCounts(workoutList,programId,daysLookback){
  const counts={};
  const cutoff=Date.now()-Math.max(1,parseInt(daysLookback,10)||60)*86400000;
  (workoutList||[]).forEach(workout=>{
    const ts=new Date(workout?.date).getTime();
    if(!Number.isFinite(ts)||ts<cutoff)return;
    const workoutProgramId=typeof getWorkoutProgramId==='function'?getWorkoutProgramId(workout):workout?.program;
    if(workoutProgramId!==programId)return;
    const day=new Date(ts).getDay();
    counts[day]=(counts[day]||0)+1;
  });
  return counts;
}

function getProgramProgressSummary(context){
  const state=context?.activeProgramState||{};
  const recent=getProgramWorkoutHistory(context?.activeProgramId,context?.workouts,10);
  if(context?.activeProgramId==='forge'){
    const earliest=recent[recent.length-1]?.programStateBefore?.lifts?.main||[];
    if(!earliest.length)return trPlan('plan.insight.forge_stable','Forge training maxes are stable right now - keep execution crisp.',{});
    const current=state?.lifts?.main||[];
    let upCount=0;
    let bestDelta=0;
    current.forEach((lift,idx)=>{
      const oldTm=parseFloat(earliest[idx]?.tm)||0;
      const newTm=parseFloat(lift?.tm)||0;
      const delta=Math.round((newTm-oldTm)*10)/10;
      if(delta>0){
        upCount++;
        if(delta>bestDelta)bestDelta=delta;
      }
    });
    if(upCount>0)return trPlan('plan.insight.forge_progress','{count} main lift TMs are up over your recent block, led by +{delta}kg.',{count:upCount,delta:bestDelta});
    return trPlan('plan.insight.forge_stable','Forge training maxes are stable right now - keep execution crisp.',{});
  }
  if(context?.activeProgramId==='wendler531'){
    const stalledCount=Object.keys(state?.stalledLifts||{}).filter(key=>state?.stalledLifts?.[key]).length;
    if(stalledCount>0)return trPlan('plan.insight.w531_stalled','Cycle {cycle}, week {week}. {count} lift needs a lighter runway.',{cycle:state.cycle||1,week:state.week||1,count:stalledCount});
    return trPlan('plan.insight.w531_cycle','Cycle {cycle}, week {week} is moving without stall flags.',{cycle:state.cycle||1,week:state.week||1});
  }
  if(context?.activeProgramId==='hypertrophysplit'){
    const latest=recent[0]?.exercises?.[0];
    if(latest?.name)return trPlan('plan.insight.hs_primary','Recent hypertrophy work is anchored by {exercise}.',{exercise:latest.name});
  }
  if(context?.progression?.hasStalls)return trPlan('plan.insight.stalls','Progression has at least one stall signal right now.');
  return trPlan('plan.insight.stable','Progression looks stable - stay with the current path.');
}

function getCoachingInsights(input){
  const next=input||{};
  const context=next.context||buildPlanningContext(next);
  const decision=next.decision||getTodayTrainingDecision(context);
  const recentProgramWorkouts=(context.workouts||[]).filter(workout=>{
    const ts=new Date(workout?.date).getTime();
    if(!Number.isFinite(ts)||ts<(Date.now()-30*86400000))return false;
    const workoutProgramId=typeof getWorkoutProgramId==='function'?getWorkoutProgramId(workout):workout?.program;
    return workoutProgramId===context.activeProgramId;
  });
  const recentProgramWorkouts90=(context.workouts||[]).filter(workout=>{
    const ts=new Date(workout?.date).getTime();
    if(!Number.isFinite(ts)||ts<(Date.now()-90*86400000))return false;
    const workoutProgramId=typeof getWorkoutProgramId==='function'?getWorkoutProgramId(workout):workout?.program;
    return workoutProgramId===context.activeProgramId;
  });
  const expectedSessions=Math.max(1,Math.round((context.effectiveFrequency||3)*30/7));
  const adherenceRate30=clampPlan(Math.round((recentProgramWorkouts.length/expectedSessions)*100),0,140);
  const dayCounts=getPlanDayCounts(context.workouts,context.activeProgramId,60);
  const bestDayIndexes=Object.entries(dayCounts)
    .sort((a,b)=>b[1]-a[1]||a[0]-b[0])
    .slice(0,2)
    .map(([day])=>parseInt(day,10))
    .filter(Number.isFinite);
  const skippedNames=toPlanList(context.behaviorSignals?.skippedAccessoryExerciseIds)
    .map(id=>typeof window.getExerciseDisplayName==='function'?window.getExerciseDisplayName(id):id)
    .filter(Boolean)
    .slice(0,2);
  const swapNames=toPlanList(context.behaviorSignals?.preferredSwapExerciseIds)
    .map(id=>typeof window.getExerciseDisplayName==='function'?window.getExerciseDisplayName(id):id)
    .filter(Boolean)
    .slice(0,2);
  const frictionItems=[];
  if(skippedNames.length)frictionItems.push(trPlan('plan.insight.skipped_accessories','Accessories most often dropped: {names}.',{names:skippedNames.join(', ')}));
  if(swapNames.length)frictionItems.push(trPlan('plan.insight.swap_preferences','You keep gravitating toward these swaps: {names}.',{names:swapNames.join(', ')}));
  if((context.behaviorSignals?.sportCollisionCount||0)>=2)frictionItems.push(trPlan('plan.insight.sport_collision','Lower-body work keeps colliding with sport load in your recent sessions.'));
  const progressionSummary=getProgramProgressSummary(context);
  const feedbackSignals=context.feedbackSignals||getSessionFeedbackSignals(context.activeProgramId,context.workouts||[]);
  let recommendationType='continue';
  if(decision.action==='deload')recommendationType='deload';
  else if((context.behaviorSignals?.shortenCount||0)>=3&&adherenceRate30<65)recommendationType='switch_block';
  else if(decision.action==='train_light'||(context.behaviorSignals?.lightenCount||0)>=2)recommendationType='lighten';
  else if(decision.action==='shorten'||(context.behaviorSignals?.shortenCount||0)>=2)recommendationType='shorten';
  if(recommendationType==='continue'&&feedbackSignals.tooHardBias)recommendationType='lighten';
  if(recommendationType==='continue'&&feedbackSignals.durationFriction)recommendationType='shorten';
  const recommendationMap={
    continue:{
      label:trPlan('plan.recommend.continue','Stay the course'),
      body:trPlan('plan.recommend.continue_body','Your current setup looks sustainable - keep stacking consistent sessions.')
    },
    shorten:{
      label:trPlan('plan.recommend.shorten','Shorten this week'),
      body:trPlan('plan.recommend.shorten_body','Time friction is showing up, so bias this week toward shorter but complete sessions.')
    },
    lighten:{
      label:trPlan('plan.recommend.lighten','Run a lighter week'),
      body:trPlan('plan.recommend.lighten_body','Recovery signals are climbing, so keep the structure but lower the physiological cost.')
    },
    deload:{
      label:trPlan('plan.recommend.deload','Take the deload'),
      body:trPlan('plan.recommend.deload_body','Fatigue and stall signals justify a lighter runway before pushing again.')
    },
    switch_block:{
      label:trPlan('plan.recommend.switch','Switch to a better-fit block'),
      body:trPlan('plan.recommend.switch_body','The current setup is fighting your schedule or recovery pattern. A simpler block is likely a better fit.')
    }
  };
  const adherenceSummary=trPlan('plan.insight.adherence_30','30-day adherence: {done}/{expected} planned sessions ({rate}%).',{done:recentProgramWorkouts.length,expected:expectedSessions,rate:adherenceRate30});
  const bestDaysSummary=bestDayIndexes.length
    ? trPlan('plan.insight.best_days','You train most consistently on days {days}.',{days:bestDayIndexes.join(', ')})
    : '';
  return{
    adherenceRate30,
    sessions90:recentProgramWorkouts90.length,
    adherenceSummary,
    bestDayIndexes,
    bestDaysSummary,
    progressionSummary,
    frictionItems,
    frictionCount:frictionItems.length,
    recommendation:{type:recommendationType,...recommendationMap[recommendationType]}
  };
}

function getProgramOnboardingProfile(programId){
  const map={
    casualfullbody:{experience:['beginner','returning','intermediate'],guidedBonus:4,cognitiveLoad:1,sportSupport:5,hypertrophy:1,strength:1,equipmentPenalty:{minimal:-1}},
    forge:{experience:['beginner','returning','intermediate','advanced'],guidedBonus:3,cognitiveLoad:2,sportSupport:3,hypertrophy:1,strength:5,equipmentPenalty:{minimal:-4,home_gym:-2}},
    stronglifts5x5:{experience:['beginner','returning','intermediate'],guidedBonus:3,cognitiveLoad:1,sportSupport:1,hypertrophy:0,strength:4,equipmentPenalty:{minimal:-5,home_gym:-3}},
    wendler531:{experience:['intermediate','advanced','returning'],guidedBonus:0,cognitiveLoad:3,sportSupport:4,hypertrophy:0,strength:5,equipmentPenalty:{minimal:-5,home_gym:-3}},
    hypertrophysplit:{experience:['returning','intermediate','advanced'],guidedBonus:-1,cognitiveLoad:3,sportSupport:0,hypertrophy:6,strength:1,equipmentPenalty:{minimal:-5,home_gym:-3,basic_gym:-1}}
  };
  return map[programId]||{experience:['beginner','returning','intermediate','advanced'],guidedBonus:0,cognitiveLoad:2,sportSupport:0,hypertrophy:0,strength:0,equipmentPenalty:{}};
}

function scoreProgramForOnboarding(programId,profileLike,scheduleLike){
  const prefs=typeof normalizeTrainingPreferences==='function'?normalizeTrainingPreferences(profileLike):profileLike.preferences||{};
  const coaching=typeof normalizeCoachingProfile==='function'?normalizeCoachingProfile(profileLike):profileLike.coaching||{};
  const info=getProgramOnboardingProfile(programId);
  const capabilities=typeof getProgramCapabilities==='function'?getProgramCapabilities(programId):{frequencyRange:{min:2,max:6},recommendationScore(){return 0;}};
  const requestedDays=parseInt(prefs.trainingDaysPerWeek,10)||3;
  const exactFrequency=requestedDays>=capabilities.frequencyRange.min&&requestedDays<=capabilities.frequencyRange.max;
  if(!exactFrequency)return Number.NEGATIVE_INFINITY;
  let score=typeof capabilities.recommendationScore==='function'?capabilities.recommendationScore(requestedDays,prefs):0;
  if(info.experience.includes(coaching.experienceLevel))score+=4;
  else score-=6;
  if(coaching.guidanceMode==='guided')score+=info.guidedBonus||0;
  if(coaching.guidanceMode==='self_directed')score+=Math.max(0,(info.cognitiveLoad||0)-1);
  const goalKey=prefs.goal==='hypertrophy'?'hypertrophy':(prefs.goal==='strength'?'strength':'sportSupport');
  score+=info[goalKey]||0;
  if((prefs.goal==='sport_support'||coaching.sportProfile?.inSeason)&&programId==='casualfullbody')score+=3;
  if((prefs.goal==='strength'&&coaching.guidanceMode==='guided')&&(programId==='forge'||programId==='stronglifts5x5'))score+=2;
  if((prefs.goal==='strength'&&coaching.experienceLevel==='advanced')&&programId==='wendler531')score+=3;
  if((prefs.goal==='hypertrophy'&&requestedDays>=4)&&programId==='hypertrophysplit')score+=3;
  if(coaching.experienceLevel==='beginner'&&coaching.guidanceMode==='guided'){
    if(programId==='casualfullbody')score+=5;
    if(programId==='forge')score-=2;
    if(programId==='hypertrophysplit'&&requestedDays<=3)score-=3;
    if(programId==='wendler531')score-=4;
  }
  if(coaching.experienceLevel==='beginner'&&requestedDays<=3){
    if(programId==='casualfullbody')score+=2;
    if(programId==='forge'&&prefs.goal!=='strength')score-=2;
  }
  score+=info.equipmentPenalty?.[prefs.equipmentAccess]||0;
  if((coaching.limitations?.jointFlags||[]).length&&programId==='wendler531')score-=1;
  if(scheduleLike?.sportLegsHeavy!==false&&coaching.sportProfile?.sessionsPerWeek>=2&&programId==='casualfullbody')score+=2;
  return score;
}

function buildInitialWeekTemplate(programId,frequency,sessionMinutes){
  const rows=[];
  for(let index=0;index<frequency;index++){
    const dayLabel=trPlan('plan.week.day_label','Day {day}',{day:index+1});
    let type=trPlan('common.session','Session');
    if(programId==='wendler531')type=trPlan('plan.week.type.main_lift','Main lift day');
    else if(programId==='hypertrophysplit')type=trPlan('plan.week.type.split','Split session');
    else if(programId==='casualfullbody')type=trPlan('plan.week.type.full_body','Full body');
    else if(programId==='stronglifts5x5')type=index%2===0?trPlan('plan.week.type.workout_a','Workout A'):trPlan('plan.week.type.workout_b','Workout B');
    else if(programId==='forge')type=trPlan('plan.week.type.strength','Strength day');
    rows.push({dayLabel,type,durationHint:trPlan('onboarding.duration_value','{count} min',{count:sessionMinutes})});
  }
  return rows;
}

function buildOnboardingFitReasons(prefs,coaching,scheduleLike){
  const requestedDays=parseInt(prefs.trainingDaysPerWeek,10)||3;
  const reasons=[];
  const goalKey=prefs.goal==='hypertrophy'
    ? 'hypertrophy'
    : (prefs.goal==='strength'
      ? 'strength'
      : (prefs.goal==='sport_support' ? 'sport_support' : 'general_fitness'));
  reasons.push(trPlan('onboarding.fit.goal.'+goalKey,'Goal: {goal}',{goal:getTrainingGoalLabel?.(prefs.goal)||prefs.goal}));
  reasons.push(trPlan('onboarding.fit.frequency','{count} sessions / week',{count:requestedDays}));
  if(coaching?.sportProfile?.inSeason||prefs.goal==='sport_support'){
    reasons.push(trPlan('onboarding.fit.in_season','In-season aware'));
  }else if(coaching?.guidanceMode==='guided'){
    reasons.push(trPlan('onboarding.fit.guided','Guided'));
  }else{
    reasons.push(trPlan('onboarding.fit.self_directed','Flexible'));
  }
  return [...new Set(reasons)].slice(0,3);
}

function getInitialPlanRecommendation(input){
  const next=input||{};
  const profileLike=clonePlanValue(next.profile||profile||{})||{};
  const scheduleLike=clonePlanValue(next.schedule||schedule||{})||{};
  if(typeof normalizeTrainingPreferences==='function')normalizeTrainingPreferences(profileLike);
  if(typeof normalizeCoachingProfile==='function')normalizeCoachingProfile(profileLike);
  const programEntries=(typeof getRegisteredPrograms==='function'&&getRegisteredPrograms().length
    ? getRegisteredPrograms()
    : ['casualfullbody','forge','stronglifts5x5','wendler531','hypertrophysplit'].map(id=>({id,name:id})));
  const ranked=programEntries
    .map(program=>({program,score:scoreProgramForOnboarding(program.id,profileLike,scheduleLike)}))
    .filter(entry=>Number.isFinite(entry.score))
    .sort((a,b)=>b.score-a.score||a.program.name.localeCompare(b.program.name));
  const chosen=(ranked[0]&&ranked[0].program)||programEntries[0]||null;
  const prefs=profileLike.preferences||{};
  const programId=chosen?.id||'forge';
  const why=[];
  const goalLabel=typeof getTrainingGoalLabel==='function'?getTrainingGoalLabel(prefs.goal):prefs.goal;
  if(prefs.goal==='hypertrophy')why.push(trPlan('onboarding.why.hypertrophy','Supports your hypertrophy goal without forcing a strength-first setup.'));
  else if(prefs.goal==='sport_support')why.push(trPlan('onboarding.why.sport_support','Balances lifting with outside sport load and keeps recovery manageable.'));
  else why.push(trPlan('onboarding.why.goal_match','Matches your main goal: {goal}.',{goal:goalLabel}));
  if(profileLike.coaching?.guidanceMode==='guided')why.push(trPlan('onboarding.why.guided','Keeps the decision-making load low and gives you a clearer default path.'));
  if(profileLike.coaching?.sportProfile?.inSeason)why.push(trPlan('onboarding.why.in_season','Accounts for in-season constraints and keeps weekly stress more realistic.'));
  const fitReasons=buildOnboardingFitReasons(prefs,profileLike.coaching||{},scheduleLike);
  const weekTemplate=buildInitialWeekTemplate(programId,parseInt(prefs.trainingDaysPerWeek,10)||3,parseInt(prefs.sessionMinutes,10)||60);
  let firstSessionOption='';
  let initialAdjustments=[];
  const initialState=chosen?.getInitialState?chosen.getInitialState():{};
  if(chosen&&typeof chosen.getSessionOptions==='function'){
    try{
      const tempProfile={...profileLike,activeProgram:programId,programs:{...(profileLike.programs||{}),[programId]:clonePlanValue(initialState)}};
      const context=buildPlanningContext({profile:tempProfile,schedule:scheduleLike,workouts:[],activeProgram:chosen,activeProgramState:initialState});
      const decision=getTodayTrainingDecision(context);
      firstSessionOption=decision.recommendedSessionOption||getRecommendedSessionOptionForDecision(context);
      if(decision.action==='shorten')initialAdjustments.push(trPlan('onboarding.adjustment.short_session','The first session will be trimmed to match your time cap.'));
      if(decision.restrictionFlags.includes('avoid_heavy_legs'))initialAdjustments.push(trPlan('onboarding.adjustment.sport','The engine will steer you away from leg-heavy work when sport load is high.'));
    }catch(_error){}
  }
  if(!firstSessionOption)firstSessionOption='1';
  return{
    programId,
    why:[...new Set(why)],
    fitReasons,
    weekTemplate,
    firstSessionOption,
    initialAdjustments:[...new Set(initialAdjustments)]
  };
}

window.getWeekPlanPreview=getWeekPlanPreview;
