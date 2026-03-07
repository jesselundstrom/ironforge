// Program registry + program UI/state helpers extracted from app.js.
function trProg(key,fallback,params){
  if(window.I18N)return I18N.t(key,params,fallback);
  return fallback;
}

function cloneProgramSession(exercises){
  return(exercises||[]).map(ex=>({
    ...ex,
    sets:Array.isArray(ex?.sets)?ex.sets.map(set=>({...set})):ex?.sets
  }));
}

function analyzeProgramSessionShape(prog,session){
  const exercises=Array.isArray(session)?session:[];
  const totalSets=exercises.reduce((sum,ex)=>sum+(Array.isArray(ex.sets)?ex.sets.length:0),0);
  const accessoryCount=exercises.filter(ex=>ex.isAccessory).length;
  const auxCount=exercises.filter(ex=>ex.isAux&&!ex.isAccessory).length;
  const legNames=new Set((prog.legLifts||[]).map(name=>String(name).toLowerCase()));
  const hasLegs=exercises.some(ex=>legNames.has(String(ex.name||'').toLowerCase()));
  return{totalSets,accessoryCount,auxCount,hasLegs,exerciseCount:exercises.length};
}

function getPlannedSessionDisplayMuscleLoad(session){
  const totals={};
  if(!window.EXERCISE_LIBRARY||!EXERCISE_LIBRARY.getExerciseMeta||!EXERCISE_LIBRARY.mapMuscleToDisplayGroup)return totals;
  (Array.isArray(session)?session:[]).forEach(ex=>{
    const meta=EXERCISE_LIBRARY.getExerciseMeta(ex?.exerciseId||ex?.name||ex);
    if(!meta)return;
    const setCount=Array.isArray(ex?.sets)?ex.sets.length:0;
    if(!setCount)return;
    const exerciseScale=ex?.isAccessory?0.6:(ex?.isAux?0.85:1);
    (meta.primaryMuscles||[]).forEach(muscle=>{
      const group=EXERCISE_LIBRARY.mapMuscleToDisplayGroup(muscle);
      if(!group)return;
      totals[group]=(totals[group]||0)+setCount*exerciseScale;
    });
    (meta.secondaryMuscles||[]).forEach(muscle=>{
      const group=EXERCISE_LIBRARY.mapMuscleToDisplayGroup(muscle);
      if(!group)return;
      totals[group]=(totals[group]||0)+setCount*0.5*exerciseScale;
    });
  });
  return totals;
}

function scoreSessionAgainstRecentMuscleLoad(sessionMuscles,recentMuscles){
  let score=0;
  Object.entries(sessionMuscles||{}).forEach(([group,plannedLoad])=>{
    const recentLoad=recentMuscles?.[group]||0;
    const emphasis=plannedLoad>=6?1.4:(plannedLoad>=3?1:0.65);
    if(recentLoad>=8)score-=Math.round(6*emphasis);
    else if(recentLoad>=4)score-=Math.round(3*emphasis);
    else if(recentLoad<1.5)score+=Math.round(3*emphasis);
    else if(recentLoad<4)score+=Math.round(1.5*emphasis);
  });
  return score;
}

function getFreshTargetGroups(sessionMuscles,recentMuscles){
  return Object.entries(sessionMuscles||{})
    .filter(([,plannedLoad])=>plannedLoad>=2)
    .map(([group,plannedLoad])=>({group,plannedLoad,recentLoad:recentMuscles?.[group]||0}))
    .filter(item=>item.recentLoad<4)
    .sort((a,b)=>a.recentLoad-b.recentLoad||b.plannedLoad-a.plannedLoad)
    .slice(0,2)
    .map(item=>item.group);
}

function buildRecommendationReasons(prefs,option,shape,sessionMuscles,recentMuscles){
  const reasons=[];
  if(option?.isRecommended){
    reasons.push(trProg('program.recommend_reason.progression','Matches your normal training order.'));
  }
  if(prefs.sessionMinutes<=30&&shape.totalSets&&shape.totalSets<=14){
    reasons.push(trProg('program.recommend_reason.short_session','Fits your shorter session target.'));
  }else if(prefs.sessionMinutes<=45&&shape.totalSets&&shape.totalSets<=18){
    reasons.push(trProg('program.recommend_reason.lower_volume','Keeps total session volume more manageable today.'));
  }
  if(prefs.goal==='sport_support'&&!shape.hasLegs){
    reasons.push(trProg('program.recommend_reason.sport_support_upper','Keeps leg fatigue lower for sport support.'));
  }
  const freshGroups=getFreshTargetGroups(sessionMuscles,recentMuscles);
  if(freshGroups.length){
    const groups=freshGroups.map(group=>trProg('dashboard.muscle_group.'+group,group)).join(', ');
    reasons.push(trProg('program.recommend_reason.fresh_muscles','Targets fresher muscle groups: {groups}.',{groups}));
  }
  return [...new Set(reasons)].slice(0,2);
}

function getProgramPreferenceRecommendation(prog,options,state){
  const prefs=normalizeTrainingPreferences(profile);
  const activeOptions=(options||[]).filter(o=>!o.done);
  if(activeOptions.length<=1)return null;
  const recentMuscles=(typeof getRecentDisplayMuscleLoads==='function')?getRecentDisplayMuscleLoads(4):{};
  let best=null;
  activeOptions.forEach((option,idx)=>{ 
    let score=option.isRecommended?20:0;
    let shape={totalSets:0,accessoryCount:0,auxCount:0,hasLegs:false,exerciseCount:0};
    let sessionMuscles={};
    try{
      const plannedSession=cloneProgramSession(prog.buildSession?prog.buildSession(option.value,state,{preview:true}):[]);
      shape=analyzeProgramSessionShape(prog,plannedSession);
      sessionMuscles=getPlannedSessionDisplayMuscleLoad(plannedSession);
    }catch(_e){}
    if(prefs.sessionMinutes<=30){
      score+=shape.totalSets<=14?10:-8;
      score-=shape.accessoryCount*5;
      score-=Math.max(0,shape.auxCount-1)*2;
    }else if(prefs.sessionMinutes<=45){
      score+=shape.totalSets<=18?6:-5;
      score-=shape.accessoryCount*3;
      score-=Math.max(0,shape.auxCount-2);
    }
    if(prefs.goal==='sport_support'){
      score+=shape.hasLegs?-6:5;
      score+=shape.totalSets<=16?2:-2;
      score-=shape.accessoryCount*2;
    }
    score+=scoreSessionAgainstRecentMuscleLoad(sessionMuscles,recentMuscles);
    const reasons=buildRecommendationReasons(prefs,option,shape,sessionMuscles,recentMuscles);
    if(best===null||score>best.score||(score===best.score&&idx===0))best={value:option.value,score,reasons};
  });
  return best||null;
}

function applyPreferenceRecommendation(prog,options,state){
  const recommendation=getProgramPreferenceRecommendation(prog,options,state);
  if(!recommendation?.value)return options;
  return(options||[]).map(option=>({
    ...option,
    isRecommended:!option.done&&option.value===recommendation.value,
    preferenceReasons:!option.done&&option.value===recommendation.value?(recommendation.reasons||[]):[]
  }));
}

// Programs (loaded via <script> tags) call registerProgram() to self-register.
const PROGRAMS={};
function registerProgram(p){PROGRAMS[p.id]=p;}
function getActiveProgram(){return PROGRAMS[profile.activeProgram||'forge']||PROGRAMS.forge||Object.values(PROGRAMS)[0]||{};}
function getActiveProgramState(){return profile.programs?.[profile.activeProgram||'forge']||{};}
function setProgramState(id,state){if(!profile.programs)profile.programs={};profile.programs[id]=state;}
function getWorkoutProgramId(w){
  if(!w)return null;
  if(w.program)return w.program;
  if(!w.type||w.type==='sport'||w.type==='hockey')return null;
  return w.type;
}
function recomputeProgramStateFromWorkouts(programId){
  const prog=PROGRAMS[programId];
  if(!prog)return null;
  if(!profile.programs)profile.programs={};

  const programWorkouts=workouts
    .filter(w=>getWorkoutProgramId(w)===programId)
    .sort((a,b)=>{
      const d=new Date(a.date)-new Date(b.date);
      if(d!==0)return d;
      return (a.id||0)-(b.id||0);
    });

  let state=programWorkouts[0]?.programStateBefore
    ? JSON.parse(JSON.stringify(programWorkouts[0].programStateBefore))
    : (prog.getInitialState?prog.getInitialState():{});
  if(prog.migrateState)state=prog.migrateState(state);

  programWorkouts.forEach((w,idx)=>{
    const exercises=Array.isArray(w.exercises)?w.exercises:[];
    if(prog.adjustAfterSession)state=prog.adjustAfterSession(exercises,state,w.programOption);
    if(prog.advanceState){
      const wd=new Date(w.date);
      const sow=getWeekStart(wd);
      const sessionsThisWeek=programWorkouts
        .slice(0,idx+1)
        .filter(sw=>new Date(sw.date)>=sow).length;
      state=prog.advanceState(state,sessionsThisWeek);
    }
  });

  profile.programs[programId]=state;
  return state;
}

function renderProgramSwitcher(){
  const container=document.getElementById('program-switcher-container');if(!container)return;
  const active=profile.activeProgram||'forge';
  container.innerHTML=Object.values(PROGRAMS).map(p=>{
    const pName=trProg('program.'+p.id+'.name',p.name);
    const pDesc=trProg('program.'+p.id+'.description',p.description);
    return`
    <div class="program-card${p.id===active?' active':''}" onclick="switchProgram('${escapeHtml(p.id)}')">
      <div class="program-card-icon">${escapeHtml(p.icon||'🏋️')}</div>
      <div style="flex:1;min-width:0">
        <div class="program-card-name">${escapeHtml(pName)}</div>
        <div class="program-card-desc">${escapeHtml(pDesc)}</div>
      </div>
      ${p.id===active?'<div class="program-card-badge">'+escapeHtml(trProg('program.active','Active'))+'</div>':''}
    </div>`;}).join('');
}

function switchProgram(id){
  if(id===profile.activeProgram)return;
  const prog=PROGRAMS[id];if(!prog)return;
  const progName=trProg('program.'+prog.id+'.name',prog.name);
  showConfirm(trProg('program.switch_to','Switch to {name}',{name:progName}),trProg('program.switch_msg','Your current program is paused. {name} will start where you left off.',{name:progName}),()=>{
    profile.activeProgram=id;
    if(!profile.programs)profile.programs={};
    if(!profile.programs[id])profile.programs[id]=prog.getInitialState();
    saveProfileData({docKeys:[PROFILE_CORE_DOC_KEY,programDocKey(id)]});
    initSettings();
    updateDashboard();
    showToast(trProg('program.switched','Switched to {name}',{name:progName}),'var(--purple)');
  });
}

function saveProgramSetup(){
  const prog=getActiveProgram(),state=getActiveProgramState();
  const newState=prog.saveSettings?prog.saveSettings(state):state;
  setProgramState(prog.id,newState);
  saveProfileData({programIds:[prog.id]});
  closeProgramSetupSheet();
  showToast(trProg('program.setup_saved','Program setup saved!'),'var(--purple)');
  updateProgramDisplay();
}

function updateProgramLift(array,idx,field,val){
  const prog=getActiveProgram(),state=getActiveProgramState();
  if(!state.lifts||!state.lifts[array]||!state.lifts[array][idx])return;
  const newState=JSON.parse(JSON.stringify(state));
  if(field==='tm'||field==='weight'){
    const n=parseFloat(val);
    val=isNaN(n)?0:Math.max(0,Math.min(999,Math.round(n*10)/10));
  }
  newState.lifts[array][idx][field]=val;
  setProgramState(prog.id,newState);
}

function updateSLLift(key,val){
  const prog=getActiveProgram(),state=getActiveProgramState();
  const newState=JSON.parse(JSON.stringify(state));
  if(newState.lifts&&newState.lifts[key]){
    const n=parseFloat(val);
    newState.lifts[key].weight=isNaN(n)?0:Math.max(0,Math.min(999,Math.round(n*10)/10));
  }
  setProgramState(prog.id,newState);
}

function setSLNextWorkout(wk){
  const prog=getActiveProgram(),state=getActiveProgramState();
  setProgramState(prog.id,{...state,nextWorkout:wk});
  initSettings();
}

function previewProgramSplit(){
  const prog=getActiveProgram(),state=getActiveProgramState();
  if(prog._previewSplit){
    const freq=parseInt(document.getElementById('prog-days')?.value)||state.daysPerWeek||3;
    prog._previewSplit(freq,state.lifts);
  }
}

function updateForgeModeSetting(){
  const prog=getActiveProgram();
  const mode=document.getElementById('prog-mode')?.value||'sets';
  if(prog._updateModeDesc)prog._updateModeDesc(mode);
}

function cleanProgramOptionLabel(label){
  return String(label||'')
    .replace(/^([⭐✅🏃⚠️]+\s*)+/u,'')
    .trim();
}

function setProgramDayOption(value){
  const input=document.getElementById('program-day-select');
  if(input)input.value=String(value||'');
  updateProgramDisplay();
}

function updateProgramDisplay(){
  const prog=getActiveProgram(),state=getActiveProgramState();
  const ds=document.getElementById('program-day-select');if(!ds)return;
  const optionWrap=document.getElementById('program-day-options');
  // Preserve any selection the user has already made before rebuilding the list
  const prevVal=ds.value;
  const rawOptions=prog.getSessionOptions?prog.getSessionOptions(state,workouts,schedule):[];
  const options=applyPreferenceRecommendation(prog,rawOptions,state);
  const recommended=options.find(o=>o.isRecommended)||options[0];
  // Use user's current pick if it still exists in the option list; otherwise recommend
  const hasMatch=prevVal&&options.some(o=>o.value===prevVal);
  const selectedValue=String(hasMatch?prevVal:(recommended?.value||options[0]?.value||''));
  ds.value=selectedValue;
  if(optionWrap){
    optionWrap.innerHTML=options.map(o=>{
      const selected=String(o.value)===selectedValue;
      const badges=[];
      if(o.isRecommended&&!o.done)badges.push(`<span class="program-day-badge program-day-badge-recommended">${escapeHtml(trProg('program.recommended','Recommended'))}</span>`);
      if(o.done)badges.push(`<span class="program-day-badge program-day-badge-done">${escapeHtml(trProg('program.done','Done'))}</span>`);
      const warningBadge=(o.sportLegs&&o.hasLegs&&!o.done)
        ? `<span class="program-day-badge program-day-badge-warning">${escapeHtml(trProg('program.leg_heavy','Leg-heavy'))}</span>`
        : '';
      return `<button type="button" class="program-day-option${selected?' active':''}${o.done?' is-done':''}" onclick="setProgramDayOption('${escapeHtml(o.value)}')"><div class="program-day-option-top"><div class="program-day-option-label">${escapeHtml(cleanProgramOptionLabel(o.label))}</div><div class="program-day-option-badges">${badges.join('')}${warningBadge}</div></div></button>`;
    }).join('');
  }
  const info=document.getElementById('program-week-display');
  if(info&&prog.getBlockInfo){
    const bi=prog.getBlockInfo(state);
    const progName=trProg('program.'+prog.id+'.name',prog.name);
    info.innerHTML=`${prog.icon||'Lift'} <strong>${progName}</strong> - ${bi.name} - ${bi.weekLabel}${bi.pct?` - <span style="color:var(--purple)">${trProg('program.training_max_pct','{pct}% of Training Max',{pct:bi.pct})}</span>`:''}${bi.modeName?` - <span style="color:var(--purple)">${bi.modeName}</span>`:''}${bi.modeDesc?`<br><span style="font-size:11px">${bi.modeDesc}</span>`:''}`;
  }
  let prefBanner=document.getElementById('program-preferences-banner');
  if(!prefBanner){
    prefBanner=document.createElement('div');prefBanner.id='program-preferences-banner';
    prefBanner.style.cssText='margin-top:10px;padding:10px 12px;border-radius:10px;font-size:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);color:var(--text)';
    const ref=document.getElementById('program-week-display');
    if(ref)ref.parentNode.insertBefore(prefBanner,ref.nextSibling);
  }
  if(prefBanner){
    const fatigue=computeFatigue();
    const guidance=(typeof getPreferenceGuidance==='function'
      ? getPreferenceGuidance(profile,{canPushVolume:(100-fatigue.overall)>=70})
      : []);
    const selectedOption=(hasMatch?options.find(o=>o.value===prevVal):recommended)||recommended;
    const reasonTitle=selectedOption===recommended
      ? trProg('program.recommend_reason.title','Why this session')
      : trProg('program.recommend_reason.starred_title','Why the recommended session is suggested');
    const reasonLines=recommended?.preferenceReasons||[];
    const reasonHtml=reasonLines.length
      ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.06)"><div style="font-size:10px;letter-spacing:0.9px;text-transform:uppercase;color:var(--muted);font-weight:800;margin-bottom:6px">${escapeHtml(reasonTitle)}</div>${reasonLines.map(line=>`<div style="margin-top:4px;color:var(--text)">${escapeHtml(line)}</div>`).join('')}</div>`
      : '';
    prefBanner.innerHTML=guidance.length
      ? guidance.map(line=>`<div style="margin-top:4px">${escapeHtml(line)}</div>`).join('')
      : `<div>${escapeHtml(getTrainingPreferencesSummary(profile))}</div>`;
    prefBanner.innerHTML+=reasonHtml;
  }
  let banner=document.getElementById('program-recommend-banner');
  if(!banner){
    banner=document.createElement('div');banner.id='program-recommend-banner';
    banner.style.cssText='margin-top:10px;padding:10px 12px;border-radius:10px;font-size:12px';
    const ref=document.getElementById('program-week-display');
    if(ref)ref.parentNode.insertBefore(banner,ref.nextSibling);
  }
  const fatigue=computeFatigue();
  const bHTML=prog.getBannerHTML?prog.getBannerHTML(options,state,schedule,workouts,fatigue):null;
  if(bHTML&&banner){
    banner.style.background=bHTML.style;banner.style.border='1px solid '+bHTML.border;
    // Banner HTML is trusted (first-party program code, not user input).
    // Programs use <strong> and styled spans intentionally.
    banner.style.color=bHTML.color;banner.innerHTML=bHTML.html;
  }
}

function onDaySelectChange(){updateProgramDisplay();}
