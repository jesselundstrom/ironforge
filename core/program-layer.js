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

function getProgramPreferenceRecommendation(prog,options,state){
  const prefs=normalizeTrainingPreferences(profile);
  const activeOptions=(options||[]).filter(o=>!o.done);
  if(activeOptions.length<=1)return null;
  let best=null;
  activeOptions.forEach((option,idx)=>{
    let score=option.isRecommended?20:0;
    let shape={totalSets:0,accessoryCount:0,auxCount:0,hasLegs:false,exerciseCount:0};
    try{
      shape=analyzeProgramSessionShape(prog,cloneProgramSession(prog.buildSession?prog.buildSession(option.value,state):[]));
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
    if(best===null||score>best.score||(score===best.score&&idx===0))best={value:option.value,score};
  });
  return best?.value||null;
}

function applyPreferenceRecommendation(prog,options,state){
  const preferredValue=getProgramPreferenceRecommendation(prog,options,state);
  if(!preferredValue)return options;
  return(options||[]).map(option=>({
    ...option,
    isRecommended:!option.done&&option.value===preferredValue
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

function updateProgramDisplay(){
  const prog=getActiveProgram(),state=getActiveProgramState();
  const ds=document.getElementById('program-day-select');if(!ds)return;
  // Preserve any selection the user has already made before rebuilding the list
  const prevVal=ds.value;
  const rawOptions=prog.getSessionOptions?prog.getSessionOptions(state,workouts,schedule):[];
  const options=applyPreferenceRecommendation(prog,rawOptions,state);
  ds.innerHTML='';
  const recommended=options.find(o=>o.isRecommended)||options[0];
  // Use user's current pick if it still exists in the option list; otherwise recommend
  const hasMatch=prevVal&&options.some(o=>o.value===prevVal);
  options.forEach(o=>{
    const opt=document.createElement('option');
    opt.value=o.value;opt.textContent=o.label;
    if(hasMatch?o.value===prevVal:o===recommended)opt.selected=true;
    if(o.done)opt.style.color='var(--muted)';
    ds.appendChild(opt);
  });
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
    prefBanner.innerHTML=guidance.length
      ? guidance.map(line=>`<div style="margin-top:4px">${escapeHtml(line)}</div>`).join('')
      : `<div>${escapeHtml(getTrainingPreferencesSummary(profile))}</div>`;
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
