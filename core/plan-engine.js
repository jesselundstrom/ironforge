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
  if(window.EXERCISE_LIBRARY&&EXERCISE_LIBRARY.resolveExerciseId){
    return String(EXERCISE_LIBRARY.resolveExerciseId(exercise.name||exercise)||'');
  }
  return '';
}

function getPlanExerciseMeta(exercise){
  if(!window.EXERCISE_LIBRARY||!EXERCISE_LIBRARY.getExerciseMeta)return null;
  return EXERCISE_LIBRARY.getExerciseMeta(resolvePlanExerciseId(exercise)||exercise?.name||exercise)||null;
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
  if(context.sportLoad.preferUpper||context.sportLoad.signal==='yesterday'||context.sportLoad.signal==='tomorrow'||context.sportLoad.signal==='both'){
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

function buildPlanningContext(input){
  const next=input||{};
  const profileLike=next.profile||profile||{};
  const scheduleLike=next.schedule||schedule||{};
  const workoutList=next.workouts||workouts||[];
  const activeProgram=next.activeProgram||((typeof getActiveProgram==='function')?getActiveProgram():null);
  const activeProgramState=next.activeProgramState||((typeof getActiveProgramState==='function')?getActiveProgramState():{});
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
  const recentMuscleLoad=typeof getRecentDisplayMuscleLoads==='function'?getRecentDisplayMuscleLoads(4):{};
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
  }else if(next.recoveryScore<=35||(next.adherence.consecutivePoorSessions>=3&&next.progression.hasStalls)){
    action=(next.activeProgram?.getBlockInfo?.(next.activeProgramState||{})?.isDeload)?'train_light':'deload';
    reasonCodes.push('low_recovery');
  }else if(next.recoveryScore<=50||next.adherence.consecutivePoorSessions>=2){
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

function shouldRemoveExerciseForContext(exercise,context,decision){
  return getExerciseConflictInfo(exercise,context,decision).blocked;
}

function trimShortSessionExercises(exercises,reasons,timeBudgetMinutes){
  let next=exercises.slice();
  const beforeAccessory=next.length;
  next=next.filter(exercise=>!exercise.isAccessory);
  if(next.length!==beforeAccessory)reasons.push(trPlan('workout.pref_adjustment.accessories','Accessory work trimmed for a shorter session.'));
  let trimmedAux=false;
  next.forEach(exercise=>{
    if(!exercise.isAux||exercise.isAccessory||!Array.isArray(exercise.sets))return;
    const targetCount=timeBudgetMinutes<=30?2:3;
    if(exercise.sets.length>targetCount){
      exercise.sets=exercise.sets.slice(0,targetCount);
      trimmedAux=true;
    }
  });
  if(trimmedAux)reasons.push(trPlan('workout.pref_adjustment.aux_volume','Auxiliary volume reduced to fit your time cap.'));
  return next;
}

function lightenLowerBodyForSport(exercises,reasons){
  let changed=false;
  exercises.forEach(exercise=>{
    if(!isPlanLowerBodyExercise(exercise)||!Array.isArray(exercise.sets)||exercise.isAccessory)return;
    if(exercise.isAux){
      const nextCount=Math.min(exercise.sets.length,2);
      if(nextCount<exercise.sets.length){
        exercise.sets=exercise.sets.slice(0,nextCount);
        changed=true;
      }
      return;
    }
    const nextCount=Math.max(3,exercise.sets.length-1);
    if(nextCount<exercise.sets.length){
      exercise.sets=exercise.sets.slice(0,nextCount);
      changed=true;
    }
  });
  if(changed)reasons.push(trPlan('workout.pref_adjustment.sport_yesterday','Leg-heavy sport sits close to this session, so lower-body work was kept lighter today.'));
}

function getConstraintReasonText(exercise,replacement,conflict){
  const fromLabel=exercise?.name||trPlan('common.exercise','Exercise');
  const toLabel=replacement?.name||'';
  if(toLabel){
    if(conflict?.reasonCode==='equipment'){
      return trPlan('plan.adjustment.replaced_equipment','Swapped {from} to {to} to match your available equipment.',{from:fromLabel,to:toLabel});
    }
    return trPlan('plan.adjustment.replaced_limit','Swapped {from} to {to} to respect your current limits.',{from:fromLabel,to:toLabel});
  }
  return trPlan('plan.adjustment.removed_exercise','Removed {exercise} because it conflicts with your current limits.',{exercise:fromLabel});
}

function getExerciseReplacementCandidates(exercise,context,decision,replacementInfo){
  if(!window.EXERCISE_LIBRARY)return [];
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
    addRecord(EXERCISE_LIBRARY.getExercise(option));
  });
  if(replacementInfo?.filters){
    EXERCISE_LIBRARY.getExerciseList({
      sort:'featured',
      filters:{
        ...replacementInfo.filters,
        excludeIds,
        equipmentTags:replacementInfo.filters.equipmentTags||allowedEquipment||undefined
      }
    }).slice(0,12).forEach(addRecord);
  }
  const baseId=resolvePlanExerciseId(exercise);
  if(baseId&&EXERCISE_LIBRARY.getRelatedExercises){
    EXERCISE_LIBRARY.getRelatedExercises(baseId,{
      sameMovement:true,
      sameEquipment:decision?.restrictionFlags?.includes('minimal_equipment')!==true,
      excludeIds,
      limit:10
    }).forEach(addRecord);
  }
  const baseMeta=getPlanExerciseMeta(exercise);
  if(baseMeta&&EXERCISE_LIBRARY.searchExercises){
    EXERCISE_LIBRARY.searchExercises('',{
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
  if(!canUseReplacement)return{conflict,replacement:null,clearWeight:false,reason:getConstraintReasonText(exercise,null,conflict)};
  const candidates=getExerciseReplacementCandidates(exercise,context,decision,replacementInfo);
  const ranked=candidates
    .map(candidate=>({candidate,score:scoreExerciseReplacementCandidate(exercise,candidate,context,decision,replacementInfo)}))
    .filter(item=>Number.isFinite(item.score))
    .sort((a,b)=>b.score-a.score||a.candidate.name.localeCompare(b.candidate.name));
  const replacement=ranked[0]?.candidate||null;
  if(!replacement)return{conflict,replacement:null,clearWeight:false,reason:getConstraintReasonText(exercise,null,conflict)};
  const currentMeta=getPlanExerciseMeta(exercise)||{equipmentTags:[]};
  const replacementMeta=getPlanExerciseMeta(replacement)||replacement;
  const sharedEquipment=(replacementMeta?.equipmentTags||[]).filter(tag=>(currentMeta?.equipmentTags||[]).includes(tag)).length;
  return{
    conflict,
    replacement,
    clearWeight:sharedEquipment===0||replacementInfo?.clearWeightOnSwap===true,
    reason:getConstraintReasonText(exercise,replacement,conflict)
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
  const adaptationReasons=[];
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
      adaptationReasons.push(replacementPlan.reason);
      return;
    }
    adaptationReasons.push(replacementPlan.reason||getConstraintReasonText(exercise,null,conflict));
  });
  return{
    exercises:resolvedExercises,
    adaptationReasons:[...new Set(adaptationReasons)]
  };
}

function buildAdaptiveSessionPlan(input){
  const next=input||{};
  const context=next.context||buildPlanningContext({});
  const decision=next.decision||getTodayTrainingDecision(context);
  const prog=(window.PROGRAMS&&window.PROGRAMS[next.programId])||(typeof getActiveProgram==='function'?getActiveProgram():null);
  const baseSession=clonePlanSession(next.baseSession||[]);
  let exercises=baseSession;
  const adaptationReasons=[];
  let equipmentHint='';
  if(typeof prog?.adaptSession==='function'){
    const adapted=prog.adaptSession(baseSession,context,decision);
    if(adapted&&Array.isArray(adapted.exercises||adapted)){
      exercises=Array.isArray(adapted)?adapted:(adapted.exercises||[]);
      adaptationReasons.push(...toPlanList(adapted.adaptationReasons||adapted.changes));
      equipmentHint=adapted.equipmentHint||equipmentHint;
    }
  }
  const resolvedConstraints=resolveSessionConstraints({exercises,context,decision});
  exercises=resolvedConstraints.exercises;
  adaptationReasons.push(...resolvedConstraints.adaptationReasons);
  if(decision.action==='shorten'||decision.timeBudgetMinutes<=35){
    exercises=trimShortSessionExercises(exercises,adaptationReasons,decision.timeBudgetMinutes||context.timeBudgetMinutes);
  }else if(decision.action==='train_light'){
    exercises=trimShortSessionExercises(exercises,adaptationReasons,45);
  }
  if(decision.restrictionFlags?.includes('avoid_heavy_legs')){
    lightenLowerBodyForSport(exercises,adaptationReasons);
  }
  if(context.goal==='sport_support'&&exercises.some(exercise=>exercise.isAccessory)){
    exercises=exercises.filter(exercise=>!exercise.isAccessory);
    adaptationReasons.push(trPlan('workout.pref_adjustment.sport_support','Accessory work removed to keep the session sharper for sport support.'));
  }
  equipmentHint=equipmentHint||((context.equipmentAccess==='basic_gym'||context.equipmentAccess==='home_gym'||context.equipmentAccess==='minimal')
    ? trPlan('workout.pref_adjustment.swap_hint','Use exercise swap freely if your setup does not match the planned lift exactly.')
    : '');
  return{
    exercises,
    adaptationReasons:[...new Set(adaptationReasons)],
    equipmentHint,
    decision
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
  const expectedSessions=Math.max(1,Math.round((context.effectiveFrequency||3)*30/7));
  const adherenceRate30=clampPlan(Math.round((recentProgramWorkouts.length/expectedSessions)*100),0,140);
  const dayCounts=getPlanDayCounts(context.workouts,context.activeProgramId,60);
  const bestDayIndexes=Object.entries(dayCounts)
    .sort((a,b)=>b[1]-a[1]||a[0]-b[0])
    .slice(0,2)
    .map(([day])=>parseInt(day,10))
    .filter(Number.isFinite);
  const skippedNames=toPlanList(context.behaviorSignals?.skippedAccessoryExerciseIds)
    .map(id=>window.EXERCISE_LIBRARY?.getDisplayName?EXERCISE_LIBRARY.getDisplayName(id):id)
    .filter(Boolean)
    .slice(0,2);
  const swapNames=toPlanList(context.behaviorSignals?.preferredSwapExerciseIds)
    .map(id=>window.EXERCISE_LIBRARY?.getDisplayName?EXERCISE_LIBRARY.getDisplayName(id):id)
    .filter(Boolean)
    .slice(0,2);
  const frictionItems=[];
  if(skippedNames.length)frictionItems.push(trPlan('plan.insight.skipped_accessories','Accessories most often dropped: {names}.',{names:skippedNames.join(', ')}));
  if(swapNames.length)frictionItems.push(trPlan('plan.insight.swap_preferences','You keep gravitating toward these swaps: {names}.',{names:swapNames.join(', ')}));
  if((context.behaviorSignals?.sportCollisionCount||0)>=2)frictionItems.push(trPlan('plan.insight.sport_collision','Lower-body work keeps colliding with sport load in your recent sessions.'));
  const progressionSummary=getProgramProgressSummary(context);
  let recommendationType='continue';
  if(decision.action==='deload')recommendationType='deload';
  else if((context.behaviorSignals?.shortenCount||0)>=3&&adherenceRate30<65)recommendationType='switch_block';
  else if(decision.action==='train_light'||(context.behaviorSignals?.lightenCount||0)>=2)recommendationType='lighten';
  else if(decision.action==='shorten'||(context.behaviorSignals?.shortenCount||0)>=2)recommendationType='shorten';
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
    adherenceSummary,
    bestDayIndexes,
    bestDaysSummary,
    progressionSummary,
    frictionItems,
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
    else if(programId==='stronglifts5x5')type=index%2===0?'Workout A':'Workout B';
    else if(programId==='forge')type=trPlan('plan.week.type.strength','Strength day');
    rows.push({dayLabel,type,durationHint:sessionMinutes+' min'});
  }
  return rows;
}

function getInitialPlanRecommendation(input){
  const next=input||{};
  const profileLike=clonePlanValue(next.profile||profile||{})||{};
  const scheduleLike=clonePlanValue(next.schedule||schedule||{})||{};
  if(typeof normalizeTrainingPreferences==='function')normalizeTrainingPreferences(profileLike);
  if(typeof normalizeCoachingProfile==='function')normalizeCoachingProfile(profileLike);
  const prefs=profileLike.preferences||{};
  const programEntries=Object.values(window.PROGRAMS||{});
  const ranked=programEntries
    .map(program=>({program,score:scoreProgramForOnboarding(program.id,profileLike,scheduleLike)}))
    .filter(entry=>Number.isFinite(entry.score))
    .sort((a,b)=>b.score-a.score||a.program.name.localeCompare(b.program.name));
  const chosen=(ranked[0]&&ranked[0].program)||programEntries[0]||null;
  const programId=chosen?.id||'forge';
  const why=[];
  const goalLabel=typeof getTrainingGoalLabel==='function'?getTrainingGoalLabel(prefs.goal):prefs.goal;
  if(prefs.goal==='hypertrophy')why.push(trPlan('onboarding.why.hypertrophy','Supports your hypertrophy goal without forcing a strength-first setup.'));
  else if(prefs.goal==='sport_support')why.push(trPlan('onboarding.why.sport_support','Balances lifting with outside sport load and keeps recovery manageable.'));
  else why.push(trPlan('onboarding.why.goal_match','Matches your main goal: {goal}.',{goal:goalLabel}));
  if(profileLike.coaching?.guidanceMode==='guided')why.push(trPlan('onboarding.why.guided','Keeps the decision-making load low and gives you a clearer default path.'));
  if(profileLike.coaching?.sportProfile?.inSeason)why.push(trPlan('onboarding.why.in_season','Accounts for in-season constraints and keeps weekly stress more realistic.'));
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
    weekTemplate,
    firstSessionOption,
    initialAdjustments:[...new Set(initialAdjustments)]
  };
}
