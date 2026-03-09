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
  const decisionCard=renderWorkoutDecisionPreview(trainingDecision,planningContext);
  document.getElementById('workout-not-started').innerHTML=`
    <div class="divider-label"><span>${escapeHtml((prog.icon||'Lift')+' '+progName+' '+i18nText('common.session','Session'))}</span></div>
    <div class="card" style="padding:20px">
      <div style="font-weight:800;font-size:16px;margin-bottom:4px">${i18nText('workout.start_session','Start a Session')}</div>
      <label style="margin-top:8px">${i18nText('workout.training_day','Training Day')}</label>
      <input type="hidden" id="program-day-select" value="">
      <div id="program-day-options" class="program-day-options"></div>
      <div id="program-week-display" style="margin-top:14px;background:rgba(167,139,250,0.08);border:1px solid rgba(167,139,250,0.2);border-radius:10px;padding:10px 12px;font-size:12px;color:var(--purple)"></div>
      ${sportCheckControls}
      ${decisionCard}
      <div style="margin-top:18px"><button class="btn btn-primary" onclick="startWorkout()">${i18nText('workout.start_workout','Start Workout')}</button></div>
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
  return(exercises||[]).map(ex=>({
    ...ex,
    sets:Array.isArray(ex?.sets)?ex.sets.map(set=>({...set})):ex?.sets
  }));
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
  exercises.forEach(ex=>{
    if(ex.isAux||ex.isAccessory||!Array.isArray(ex.sets)||!ex.sets.length)return;
    const firstWeight=parseFloat(ex.sets[0].weight)||ex.tm||0;
    if(firstWeight<=0)return;
    const warmups=generateWarmupSets(firstWeight);
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

  const builtExercises=(prog.buildSession(selectedOption,state)||[]).map(withResolvedExerciseId);
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
  activeWorkout.exercises.push({id:Date.now()+Math.random(),exerciseId,name:canonicalName,note:'',sets:[
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
      const row=document.createElement('div');row.className='set-row'+(set.isWarmup?' set-warmup':'');
      const isAmrap=set.isAmrap;
      const mode=activeWorkout?.programMode||'sets';
      const isLastSet=si===ex.sets.length-1;
      const showRir=mode==='rir'&&isLastSet&&!ex.isAccessory;
      const warmupsBefore=ex.sets.filter((s,i)=>i<si&&s.isWarmup).length;
      const setLabel=set.isWarmup?'W':isAmrap?i18nText('workout.max_short','MAX'):String(si+1-warmupsBefore);
      const repVal=isAmrap&&set.reps==='AMRAP'?'':set.reps;
      if(isAmrap)row.style.cssText='background:rgba(167,139,250,0.12);border-radius:8px;padding:2px 0';
      row.innerHTML=`
        <span class="set-num"${isAmrap?' style="color:var(--purple);font-weight:800"':''}>${setLabel}</span>
        <input class="set-input" type="number" inputmode="decimal" min="0" max="999" step="any" placeholder="${escapeHtml(i18nText('workout.weight_placeholder','kg'))}" value="${set.weight}" onchange="updateSet(${ei},${si},'weight',this.value)">
        <input class="set-input" type="number" inputmode="numeric" min="0" max="999" placeholder="${escapeHtml(isAmrap?i18nText('workout.reps_hit','reps hit'):i18nText('workout.reps_placeholder','reps'))}" value="${repVal}" onchange="updateSet(${ei},${si},'reps',this.value)"${isAmrap?' style="border-color:var(--purple)"':''}>
        ${showRir?`<select class="set-rir" onchange="updateSet(${ei},${si},'rir',this.value)">
          <option value="">${escapeHtml(i18nText('workout.rir','RIR'))}</option><option value="0"${set.rir==='0'||set.rir===0?' selected':''}>0</option><option value="1"${set.rir==='1'||set.rir===1?' selected':''}>1</option><option value="2"${set.rir==='2'||set.rir===2?' selected':''}>2</option><option value="3"${set.rir==='3'||set.rir===3?' selected':''}>3</option><option value="4"${set.rir==='4'||set.rir===4?' selected':''}>4</option><option value="5"${set.rir==='5'||set.rir===5?' selected':''}>5+</option>
        </select>`:''}
        <div class="set-check ${set.done?'done':''}" onclick="toggleSet(${ei},${si})">✓</div>`;
      sc.appendChild(row);
    });
  });
}

function sanitizeSetValue(field,raw){
  if(field==='weight'){const n=parseFloat(raw);return isNaN(n)?'':Math.max(0,Math.min(999,Math.round(n*10)/10));}
  if(field==='reps'){const n=parseInt(raw,10);return isNaN(n)?'':Math.max(0,Math.min(999,n));}
  if(field==='rir')return raw;
  return raw;
}

function updateSet(ei,si,f,v){
  const exercise=activeWorkout.exercises[ei];
  const set=exercise?.sets?.[si];
  if(!set)return;
  const sanitizedValue=sanitizeSetValue(f,v);
  set[f]=sanitizedValue;
  if(f!=='weight')return;
  for(let nextIndex=si+1;nextIndex<exercise.sets.length;nextIndex++){
    const nextSet=exercise.sets[nextIndex];
    if(nextSet.done)continue;
    nextSet.weight=sanitizedValue;
  }
  const rows=document.querySelectorAll(`#sets-${ei} .set-row`);
  for(let nextIndex=si+1;nextIndex<rows.length;nextIndex++){
    if(exercise.sets[nextIndex]?.done)continue;
    const weightInput=rows[nextIndex]?.querySelector('input');
    if(weightInput)weightInput.value=sanitizedValue;
  }
}

function tryHaptic(pattern){
  try{if(navigator.vibrate&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches)navigator.vibrate(pattern);}catch(e){}
}

function toggleSet(ei,si){
  const set=activeWorkout.exercises[ei].sets[si];
  if(!set.done){
    set.done=true;
    tryHaptic(40);
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
function removeEx(ei){
  const removed=activeWorkout.exercises.splice(ei,1)[0];
  renderExercises();
  if(removed){
    showToast(escapeHtml(i18nText('workout.exercise_removed','{name} removed',{name:displayExerciseName(removed.name)})),'var(--muted)',()=>{
      activeWorkout.exercises.splice(ei,0,removed);
      renderExercises();
    });
  }
}

function swapAuxExercise(ei){
  const ex=activeWorkout.exercises[ei];
  if(ex.auxSlotIdx<0)return;
  const prog=getActiveProgram();
  const swapInfo=prog.getAuxSwapOptions?prog.getAuxSwapOptions(ex):null;
  if(!swapInfo)return;
  const cat=swapInfo.category||'';
  const title=cat?i18nText('workout.swap_aux_category','Swap {cat} auxiliary',{cat:cat.charAt(0).toUpperCase()+cat.slice(1)}):i18nText('workout.swap_exercise','Swap exercise');
  openExerciseCatalogForSwap({
    exerciseIndex:ei,
    exercise:ex,
    swapInfo,
    title,
    onSelect:selected=>doAuxSwap(ei,selected.name,ex.auxSlotIdx)
  });
}

function doAuxSwap(ei,newName,slotIdx){
  const resolved=resolveExerciseSelection(newName);
  activeWorkout.exercises[ei].name=resolved.name;
  activeWorkout.exercises[ei].exerciseId=resolved.exerciseId;
  const prog=getActiveProgram(),state=getActiveProgramState();
  const newState=prog.onAuxSwap?prog.onAuxSwap(slotIdx,resolved.name,state):state;
  setProgramState(prog.id,newState);
  saveProfileData({programIds:[prog.id]});
  renderExercises();
  showToast(i18nText('workout.swapped_to','Swapped to {name}',{name:displayExerciseName(resolved.name)}),'var(--purple)');
}

function swapBackExercise(ei){
  const prog=getActiveProgram();
  const swapInfo=prog.getBackSwapOptions?prog.getBackSwapOptions(activeWorkout.exercises[ei]):[];
  if(!swapInfo)return;
  openExerciseCatalogForSwap({
    exerciseIndex:ei,
    exercise:activeWorkout.exercises[ei],
    swapInfo,
    title:i18nText('workout.swap_back_title','Swap Back Exercise'),
    onSelect:selected=>doBackSwap(ei,selected.name)
  });
}

function doBackSwap(ei,newName){
  const resolved=resolveExerciseSelection(newName);
  activeWorkout.exercises[ei].name=resolved.name;
  activeWorkout.exercises[ei].exerciseId=resolved.exerciseId;
  const prog=getActiveProgram(),state=getActiveProgramState();
  const newState=prog.onBackSwap?prog.onBackSwap(resolved.name,state):state;
  setProgramState(prog.id,newState);
  saveProfileData({programIds:[prog.id]});
  renderExercises();
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
      if(s.done&&!s.isWarmup){completedSets++;tonnage+=(parseFloat(s.weight)||0)*(parseInt(s.reps)||0);}
    });
  });
  const summaryData={
    duration:getWorkoutElapsedSeconds(),
    exerciseCount:activeWorkout.exercises.length,
    completedSets,totalSets,tonnage,
    rpe:sessionRPE,
    programLabel:activeWorkout.programLabel||''
  };

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
  activeWorkout=null;
  document.getElementById('workout-not-started').style.display='block';
  document.getElementById('workout-active').style.display='none';
  resetNotStartedView();
  showToast(i18nText('workout.session_discarded','Workout discarded.'));
}
