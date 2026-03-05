// Program registry + program UI/state helpers extracted from app.js.

// Programs (loaded via <script> tags) call registerProgram() to self-register.
const PROGRAMS={};
function registerProgram(p){PROGRAMS[p.id]=p;}
function getActiveProgram(){return PROGRAMS[profile.activeProgram||'forge']||PROGRAMS.forge||Object.values(PROGRAMS)[0]||{};}
function getActiveProgramState(){return profile.programs?.[profile.activeProgram||'forge']||{};}
function setProgramState(id,state){if(!profile.programs)profile.programs={};profile.programs[id]=state;}

function renderProgramSwitcher(){
  const container=document.getElementById('program-switcher-container');if(!container)return;
  const active=profile.activeProgram||'forge';
  container.innerHTML=Object.values(PROGRAMS).map(p=>`
    <div class="program-card${p.id===active?' active':''}" onclick="switchProgram('${p.id}')">
      <div class="program-card-icon">${p.icon||'🏋️'}</div>
      <div style="flex:1;min-width:0">
        <div class="program-card-name">${p.name}</div>
        <div class="program-card-desc">${p.description}</div>
      </div>
      ${p.id===active?'<div class="program-card-badge">Active</div>':''}
    </div>`).join('');
}

function switchProgram(id){
  if(id===profile.activeProgram)return;
  const prog=PROGRAMS[id];if(!prog)return;
  showConfirm('Switch to '+prog.name,'Your current program is paused. '+prog.name+' will start where you left off.',()=>{
    profile.activeProgram=id;
    if(!profile.programs)profile.programs={};
    if(!profile.programs[id])profile.programs[id]=prog.getInitialState();
    saveProfileData();
    initSettings();
    updateDashboard();
    showToast('Switched to '+prog.name,'var(--purple)');
  });
}

function saveProgramSetup(){
  const prog=getActiveProgram(),state=getActiveProgramState();
  const newState=prog.saveSettings?prog.saveSettings(state):state;
  setProgramState(prog.id,newState);
  saveProfileData();
  showToast('Program setup saved!','var(--purple)');
  updateProgramDisplay();
}

function updateProgramLift(array,idx,field,val){
  const prog=getActiveProgram(),state=getActiveProgramState();
  if(!state.lifts||!state.lifts[array]||!state.lifts[array][idx])return;
  const newState=JSON.parse(JSON.stringify(state));
  newState.lifts[array][idx][field]=val;
  setProgramState(prog.id,newState);
}

function updateSLLift(key,val){
  const prog=getActiveProgram(),state=getActiveProgramState();
  const newState=JSON.parse(JSON.stringify(state));
  if(newState.lifts&&newState.lifts[key])newState.lifts[key].weight=val;
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
  const options=prog.getSessionOptions?prog.getSessionOptions(state,workouts,schedule):[];
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
    info.innerHTML=`${prog.icon||'Lift'} <strong>${prog.name}</strong> - ${bi.name} - ${bi.weekLabel}${bi.pct?` - <span style="color:var(--purple)">${bi.pct}% of Training Max</span>`:''}${bi.modeName?` - <span style="color:var(--purple)">${bi.modeName}</span>`:''}${bi.modeDesc?`<br><span style="font-size:11px">${bi.modeDesc}</span>`:''}`;
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
    banner.style.color=bHTML.color;banner.innerHTML=bHTML.html;
  }
}

function onDaySelectChange(){updateProgramDisplay();}
