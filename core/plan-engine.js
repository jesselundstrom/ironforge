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
    preferredExerciseIds:toPlanList(coaching.exercisePreferences?.preferredExerciseIds),
    excludedExerciseIds:[...new Set([
      ...toPlanList(coaching.exercisePreferences?.excludedExerciseIds),
      ...toPlanList(coaching.limitations?.avoidExerciseIds)
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
  const excludedIds=new Set(toPlanList(context?.excludedExerciseIds));
  const avoidTags=new Set(toPlanList(context?.limitations?.avoidMovementTags));
  const exerciseId=resolvePlanExerciseId(exercise);
  if(exerciseId&&excludedIds.has(exerciseId))return true;
  const tags=getPlanExerciseMovementTags(exercise);
  if(tags.some(tag=>avoidTags.has(tag)))return true;
  const flags=new Set(toPlanList(decision?.restrictionFlags));
  if(flags.has('avoid_overhead')&&tags.includes('vertical_press'))return true;
  if(flags.has('avoid_heavy_spinal_loading')&&(tags.includes('hinge')||tags.includes('squat')))return true;
  if(flags.has('avoid_knee_dominant_volume')&&(tags.includes('squat')||tags.includes('single_leg')))return true;
  return false;
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

function buildAdaptiveSessionPlan(input){
  const next=input||{};
  const context=next.context||buildPlanningContext({});
  const decision=next.decision||getTodayTrainingDecision(context);
  const prog=(window.PROGRAMS&&window.PROGRAMS[next.programId])||(typeof getActiveProgram==='function'?getActiveProgram():null);
  const baseSession=clonePlanSession(next.baseSession||[]);
  if(typeof prog?.adaptSession==='function'){
    const adapted=prog.adaptSession(baseSession,context,decision);
    if(adapted&&Array.isArray(adapted.exercises||adapted)){
      const exercises=Array.isArray(adapted)?adapted:(adapted.exercises||[]);
      return{
        exercises,
        adaptationReasons:toPlanList(adapted.adaptationReasons||adapted.changes),
        equipmentHint:adapted.equipmentHint||'',
        decision
      };
    }
  }
  let exercises=baseSession;
  const adaptationReasons=[];
  exercises=exercises.filter(exercise=>{
    const remove=shouldRemoveExerciseForContext(exercise,context,decision);
    if(remove){
      const label=exercise?.name||trPlan('common.exercise','Exercise');
      adaptationReasons.push(trPlan('plan.adjustment.removed_exercise','Removed {exercise} because it conflicts with your current limits.',{exercise:label}));
    }
    return !remove;
  });
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
  const equipmentHint=(context.equipmentAccess==='basic_gym'||context.equipmentAccess==='home_gym'||context.equipmentAccess==='minimal')
    ? trPlan('workout.pref_adjustment.swap_hint','Use exercise swap freely if your setup does not match the planned lift exactly.')
    : '';
  return{
    exercises,
    adaptationReasons:[...new Set(adaptationReasons)],
    equipmentHint,
    decision
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
