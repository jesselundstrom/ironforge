// ── 5/3/1 (WENDLER) — HOCKEY EDITION ────────────────────────────────────────
// Off-season: 5's PRO + Boring But Big
// In-season:  Minimum Required Reps + Triumvirate
// Supports 2 / 3 / 4 days per week with stall tracking, TM test week,
// daily readiness override, and full hockey-aware scheduling.
(function(){
'use strict';

function trW531(key,fallback,params){
  if(window.I18N)return I18N.t(key,params,fallback);
  return fallback;
}

function w531ExName(name){
  if(window.EXERCISE_LIBRARY&&EXERCISE_LIBRARY.getDisplayName)return EXERCISE_LIBRARY.getDisplayName(name);
  return name;
}

function normalizeW531Week(rawWeek){
  const week=parseInt(rawWeek,10);
  if(!Number.isFinite(week)||week<1)return 1;
  return Math.min(4,week);
}

function getW531LoggedRepCount(raw){
  const reps=parseInt(raw,10);
  return Number.isFinite(reps)&&reps>=0?reps:null;
}

function getW531SchemeName(week){
  const keyMap={1:'program.w531.scheme.5s',2:'program.w531.scheme.3s',3:'program.w531.scheme.531',4:'program.w531.scheme.deload'};
  const k=keyMap[week];const label=(W531.weekScheme[week]||{}).label||'';
  return k?trW531(k,label):label;
}

// ─── INTERNAL CONSTANTS & HELPERS ────────────────────────────────────────────
const W531 = {
  seasons: {
    off: { name:trW531('program.season.off','Off-Season'),  short:trW531('program.w531.off_short','5\'s PRO + BBB') },
    in:  { name:trW531('program.season.in','In-Season'),   short:trW531('program.w531.in_short','Min Reps + Triumvirate') }
  },

  // 4-week scheme: percentages of TM and label
  weekScheme: {
    1: { pcts:[0.65,0.75,0.85], label:'5s Week',  isDeload:false },
    2: { pcts:[0.70,0.80,0.90], label:'3s Week',  isDeload:false },
    3: { pcts:[0.75,0.85,0.95], label:'1+ Week',  isDeload:false },
    4: { pcts:[0.40,0.50,0.60], label:'Deload',   isDeload:true  }
  },

  // Rep targets per set index (0-2) for a given week and season
  // Off-season = 5's PRO: always 5, no AMRAP.
  // In-season  = minimum required reps only.
  getReps(week, season, setIdx) {
    if (week === 4) return 5;                       // deload always 5
    if (season === 'off') return 5;                 // 5's PRO
    const table = { 1:[5,5,5], 2:[3,3,3], 3:[5,3,1] };
    return (table[week] || [5,5,5])[setIdx] ?? 5;
  },

  // BBB: opposite lift index pairing — Squat(0)↔DL(2), Bench(1)↔OHP(3)
  bbbPair: [2, 3, 0, 1],

  // In-season Triumvirate defaults (2 exercises per main-lift day)
  defaultTriumvirate: {
    0: ['Bulgarian Split Squats', 'Weighted Planks'],      // Squat day
    1: ['Dumbbell Rows',          'DB Incline Press'],     // Bench day
    2: ['Romanian Deadlifts (RDL)','Ab Wheel Rollouts'],   // Deadlift day
    3: ['Chin-ups',               'Dips']                  // OHP day
  },

  triumvirateSwapOptions: {
    '0-0': {
      category: 'single-leg',
      filters: {movementTags:['single_leg','squat'],equipmentTags:['dumbbell','bodyweight','machine'],muscleGroups:['quads','glutes']},
      options: ['Bulgarian Split Squats', 'Walking Lunges', 'Reverse Lunges', 'Step-Ups', 'Leg Press']
    },
    '0-1': {
      category: 'core',
      filters: {movementTags:['core'],equipmentTags:['bodyweight','cable','band','pullup_bar'],muscleGroups:['core']},
      options: ['Weighted Planks', 'Ab Wheel Rollouts', 'Hanging Leg Raises', 'Cable Crunches', 'Pallof Press']
    },
    '1-0': {
      category: 'upper back',
      filters: {movementTags:['horizontal_pull'],equipmentTags:['dumbbell','barbell','cable','machine'],muscleGroups:['back','biceps']},
      options: ['Dumbbell Rows', 'Chest-Supported Rows', 'Seated Cable Rows', 'Barbell Rows', 'Machine Rows']
    },
    '1-1': {
      category: 'pressing',
      filters: {movementTags:['horizontal_press','vertical_press'],equipmentTags:['dumbbell','bodyweight','machine','barbell'],muscleGroups:['chest','triceps','shoulders']},
      options: ['DB Incline Press', 'Machine Chest Press', 'Push-ups', 'Close-Grip Bench Press', 'Dips']
    },
    '2-0': {
      category: 'posterior chain',
      filters: {movementTags:['hinge'],equipmentTags:['barbell','machine','bodyweight'],muscleGroups:['hamstrings','glutes','back']},
      options: ['Romanian Deadlifts (RDL)', 'Back Extensions', '45° Hip Extensions', 'Hamstring Curls', 'Good Mornings']
    },
    '2-1': {
      category: 'core',
      filters: {movementTags:['core'],equipmentTags:['bodyweight','cable','band','pullup_bar'],muscleGroups:['core']},
      options: ['Ab Wheel Rollouts', 'Weighted Planks', 'Hanging Leg Raises', 'Cable Crunches', 'Dead Bugs']
    },
    '3-0': {
      category: 'vertical pull',
      filters: {movementTags:['vertical_pull'],equipmentTags:['pullup_bar','bodyweight','cable','machine'],muscleGroups:['back','biceps']},
      options: ['Chin-ups', 'Lat Pulldowns', 'Neutral-Grip Pull-ups', 'Assisted Chin-ups', 'Pull-ups']
    },
    '3-1': {
      category: 'triceps',
      filters: {movementTags:['isolation','horizontal_press','vertical_press'],equipmentTags:['bodyweight','cable','dumbbell','barbell'],muscleGroups:['triceps']},
      options: ['Dips', 'Cable Triceps Pressdowns', 'Close-Grip Push-ups', 'Skull Crushers', 'Overhead Triceps Extensions']
    }
  },

  // Light-recovery circuit substituted when readiness === 'light'
  recoveryCircuit: [
    { name:'Band Pull-Aparts',   sets:3, reps:20    },
    { name:'Bodyweight Squats',  sets:3, reps:15    },
    { name:'Push-ups',           sets:3, reps:15    },
    { name:'Dead Hangs',         sets:3, reps:'30s' }
  ],

  rnd(v, inc) { return Math.round(v / inc) * inc; },

  getTriumvirateSlot(slotIdx) {
    return { liftIdx: Math.floor(slotIdx / 2), slot: slotIdx % 2 };
  },

  getTriumvirateSwapInfo(slotIdx, currentName) {
    const { liftIdx, slot } = this.getTriumvirateSlot(slotIdx);
    const key = liftIdx + '-' + slot;
    const swapInfo = this.triumvirateSwapOptions[key];
    if (!swapInfo) return null;
    const options = swapInfo.options.slice();
    if (currentName && !options.includes(currentName)) options.unshift(currentName);
    return { category: swapInfo.category, filters: swapInfo.filters||{}, options };
  },

  // Epley estimated 1RM from a performed set
  epley1RM(weight, reps) {
    return reps === 1 ? weight : Math.round((weight * reps * 0.0333 + weight) * 10) / 10;
  }
};

// Per-session readiness override — module-level, intentionally NOT persisted.
// Resets to 'default' each page load, which is the right UX.
let _readiness = 'default'; // 'default' | 'light' | 'none'
let _w531SettingsTriumvirate = null;

function cloneW531TriumvirateState(source){
  const next={};
  [0,1,2,3].forEach(liftIdx=>{
    const row=Array.isArray(source?.[liftIdx])?source[liftIdx]:(W531.defaultTriumvirate[liftIdx]||[]);
    next[liftIdx]=[
      String(row?.[0]||'').trim(),
      String(row?.[1]||'').trim()
    ];
  });
  return next;
}

function getW531TriumvirateSlotValue(liftIdx,slotIdx){
  const tri=_w531SettingsTriumvirate||cloneW531TriumvirateState(W531.defaultTriumvirate);
  return tri?.[liftIdx]?.[slotIdx]||'';
}

function setW531TriumvirateSlotValue(liftIdx,slotIdx,name){
  if(!_w531SettingsTriumvirate)_w531SettingsTriumvirate=cloneW531TriumvirateState(W531.defaultTriumvirate);
  if(!Array.isArray(_w531SettingsTriumvirate[liftIdx]))_w531SettingsTriumvirate[liftIdx]=['',''];
  _w531SettingsTriumvirate[liftIdx][slotIdx]=String(name||'').trim();
}

function getW531TriumvirateDisplayLabel(name){
  const raw=String(name||'').trim();
  return raw?w531ExName(raw):trW531('program.w531.settings.pick_exercise','Pick exercise');
}

function getW531DaysPerWeek(){
  return typeof getProgramTrainingDaysPerWeek==='function'
    ? getProgramTrainingDaysPerWeek('wendler531')
    : 4;
}

function syncW531TriumvirateSlotUI(liftIdx,slotIdx){
  const value=getW531TriumvirateSlotValue(liftIdx,slotIdx);
  const label=document.getElementById(`w531-tri-value-${liftIdx}-${slotIdx}`);
  const hidden=document.getElementById(`w531-tri-input-${liftIdx}-${slotIdx}`);
  if(label){
    label.textContent=getW531TriumvirateDisplayLabel(value);
    label.style.color=value?'var(--text)':'var(--muted)';
  }
  if(hidden)hidden.value=value||'';
}

function getW531SettingsSwapInfo(liftIdx,slotIdx){
  const slotKey=liftIdx*2+slotIdx;
  const currentName=getW531TriumvirateSlotValue(liftIdx,slotIdx);
  return W531.getTriumvirateSwapInfo(slotKey,currentName);
}

// ─── PROGRAM OBJECT ───────────────────────────────────────────────────────────
const WENDLER_531 = {
  id:   'wendler531',
  name: trW531('program.w531.name','5/3/1 (Wendler)'),
  description: trW531('program.w531.description',"4-week strength cycles with automatic weight progression."),
  icon: '💪',

  // Leg-containing lifts for hockey fatigue awareness
  legLifts: [
    'squat','deadlift',
    'romanian deadlifts (rdl)','romanian deadlift',
    'bulgarian split squats','bulgarian split squat'
  ],

  // ─── State ────────────────────────────────────────────────────────────────
  getInitialState() {
    return {
      week:1, cycle:1,
      daysPerWeek:4,
      season:'off',           // 'off' | 'in'
      rounding:2.5,
      testWeekPending:false,  // replace next deload with AMRAP test
      tmTestedThisCycle:false,// skip standard increment when true
      stalledLifts:{},        // { liftIdx: true } — stalled during this cycle
      lifts:{
        main:[
          { name:'Squat',       tm:100, category:'legs'  },
          { name:'Bench Press', tm:80,  category:'upper' },
          { name:'Deadlift',    tm:120, category:'legs'  },
          { name:'OHP',         tm:50,  category:'upper' }
        ]
      },
      triumvirate: JSON.parse(JSON.stringify(W531.defaultTriumvirate))
    };
  },

  // ─── Internal helpers ─────────────────────────────────────────────────────
  // Returns the lift indexes involved in a session day given the frequency.
  _dayLifts(dayNum, freq) {
    if (freq === 2) return dayNum === 1 ? [0,1] : [2,3]; // combined days
    return [dayNum - 1];  // 3 or 4 day: one lift per session (dayNum 1-4)
  },

  // Sessions required in a scheme week before it advances
  _weekSessions(freq) {
    if (freq === 2) return 2;
    return 4;
  },

  _normalizeWeekSessionIndex(rawIndex) {
    const parsed = parseInt(rawIndex, 10);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return parsed % 4;
  },

  _getRollingLiftOrder(state) {
    const startIdx = this._normalizeWeekSessionIndex(state?.weekSessionIndex);
    return Array.from({ length: 4 }, (_, offset) => (startIdx + offset) % 4);
  },

  // ─── Session Options ──────────────────────────────────────────────────────
  getSessionOptions(state, workouts) {
    const week   = state.week || 1;
    const freq   = getW531DaysPerWeek();
    const season = state.season || 'off';
    const lifts  = (state.lifts && state.lifts.main) || this.getInitialState().lifts.main;
    const scheme = W531.weekScheme[week] || W531.weekScheme[1];

    // Workouts logged this calendar week
    const now = new Date(), sow = getWeekStart(now);
    const doneNums = workouts
      .filter(w => w.program==='wendler531' && new Date(w.date)>=sow)
      .map(w => w.programDayNum);

    const pct    = Math.round(scheme.pcts[2]*100);
    const topRep = W531.getReps(week, season, 2);

    if (freq === 2) {
      // 2 days: Day 1 = Squat+Bench, Day 2 = DL+OHP
      return [1,2].map(d => {
        const names = this._dayLifts(d, 2).map(i => w531ExName(lifts[i]?.name||'')).join(' + ');
        const done  = doneNums.includes(d);
        const isNext = !done && doneNums.length === d-1;
        return {
          value: String(d),
          label: (done?'✅ ':(isNext?'⭐ ':'')+names+' · '+pct+'%×'+topRep),
          isRecommended: isNext && !done, done
        };
      });
    }

    if (freq === 3) {
      const rollingOrder = this._getRollingLiftOrder(state);
      return rollingOrder.map((liftIdx, orderIdx) => {
        const lift = lifts[liftIdx];
        const isRecommended = orderIdx === 0;
        return {
          value: String(liftIdx + 1),
          label: (isRecommended ? '⭐ ' : '') + w531ExName(lift?.name || '') + ' · ' + pct + '%×' + topRep,
          isRecommended,
          done: false,
          liftIdx,
          category: lift?.category
        };
      });
    }

    // 3 or 4 day: all 4 lifts available, user picks in order
    return lifts.map((l, i) => {
      const done       = doneNums.includes(i+1);
      const prevsDone  = lifts.slice(0,i).every((_,j) => doneNums.includes(j+1));
      const isRecommended = !done && prevsDone;
      return {
        value: String(i+1),
        label: (done?'✅ ':(isRecommended?'⭐ ':'')+w531ExName(l.name)+' · '+pct+'%×'+topRep),
        isRecommended, done, liftIdx:i, category:l.category
      };
    });
  },

  // ─── Build Session ────────────────────────────────────────────────────────
  buildSession(selectedOption, state, context) {
    const dayNum   = parseInt(selectedOption) || 1;
    const week     = state.week || 1;
    const freq     = getW531DaysPerWeek();
    const season   = state.season || 'off';
    const rounding = state.rounding || 2.5;
    const lifts    = state.lifts.main;
    const requestedSessionMode=context?.sessionMode||'auto';
    const effectiveSessionMode=context?.effectiveSessionMode==='light'?'light':'normal';
    const energyBoost=context?.energyBoost===true;
    const suppressProgramDeload=effectiveSessionMode==='normal'&&(W531.weekScheme[week] || W531.weekScheme[1])?.isDeload&&!state.testWeekPending;
    const schemeWeek=suppressProgramDeload?Math.max(1,week-1):week;
    const scheme   = W531.weekScheme[schemeWeek] || W531.weekScheme[1];
    const isDeload = scheme.isDeload && !state.testWeekPending;
    const isTest   = week === 4 && !!state.testWeekPending;
    const previewMode=!!context?.preview;
    let readiness = _readiness;
    if(requestedSessionMode==='normal')readiness='default';
    else if(requestedSessionMode==='light')readiness='light';
    if(!previewMode)_readiness = 'default'; // reset after capturing — prevents stale readiness leaking into next session
    const exercises = [];

    this._dayLifts(dayNum, freq).forEach(liftIdx => {
      const lift = lifts[liftIdx];
      if (!lift) return;

      // ── Main Lift Sets ──────────────────────────────────────────────────
      let sets, note;

      if (isTest) {
        // TM Test: single AMRAP set at 100% TM
        const w = W531.rnd(lift.tm, rounding);
        sets = [{
          weight:w, reps:'AMRAP', done:false, rpe:null,
          isAmrap:true, repOutTarget:5,
          isTestSet:true, isLastHeavySet:false
        }];
        note = trW531('program.w531.note.test',
          '🔬 TM TEST · '+lift.tm+'kg × AMRAP — 3-5 reps → normal cycle; 1-2 reps → TM recalculates to 90% estimated 1RM',
          {tm:lift.tm});

      } else {
        sets = scheme.pcts.map((pct, si) => {
          const weight = W531.rnd(lift.tm * pct, rounding);
          const reps   = W531.getReps(schemeWeek, season, si);
          const isLast = si === scheme.pcts.length - 1;
          return { weight, reps, done:false, rpe:null, isLastHeavySet: isLast && !isDeload };
        });
        if (energyBoost && !isDeload) {
          sets.push({
            weight: W531.rnd(lift.tm * 0.7, rounding),
            reps: 5,
            done: false,
            rpe: null,
            isLastHeavySet: false,
            isEnergyBoostSet: true
          });
        }
        const pctStr = scheme.pcts.map(p => Math.round(p*100)+'%').join('/');
        const repStr = sets.map(s => s.reps).join('/');
        if (isDeload)
          note = trW531('program.w531.note.deload',
            '🌊 Deload · '+lift.tm+'kg TM · '+pctStr+' · easy 5s — recovery week',
            {tm:lift.tm,pcts:pctStr});
        else if (season === 'off')
          note = trW531('program.w531.note.off',
            lift.tm+'kg TM · '+pctStr+' · '+repStr+" (5's PRO — strict 5 reps all sets, no AMRAP)",
            {tm:lift.tm,pcts:pctStr,reps:repStr});
        else
          note = trW531('program.w531.note.in',
            lift.tm+'kg TM · '+pctStr+' · '+repStr+' (minimum required reps — conserve energy)',
            {tm:lift.tm,pcts:pctStr,reps:repStr});
      }

      exercises.push({
        id: Date.now()+Math.random(), name:lift.name, note,
        isAux:false, tm:lift.tm, auxSlotIdx:-1, liftIdx, sets
      });

      // ── Assistance Work ─────────────────────────────────────────────────
      if (isDeload || readiness === 'none') return; // no assistance on deload or "lifts only"

      if (readiness === 'light') {
        // Light recovery circuit — bodyweight/band work only
        W531.recoveryCircuit.forEach(rc => {
          exercises.push({
            id: Date.now()+Math.random(), name:rc.name,
            note: trW531('program.w531.note.recovery','Light recovery · {sets}×{reps}',{sets:rc.sets,reps:rc.reps}),
            isAux:true, isAccessory:false, tm:0, auxSlotIdx:-1,
            sets: Array.from({length:rc.sets}, () => ({weight:0, reps:rc.reps, done:false, rpe:null}))
          });
        });
        return;
      }

      if (season === 'off') {
        // Boring But Big: 5×10 at 50% TM of the OPPOSITE main lift
        const oppIdx = W531.bbbPair[liftIdx];
        const opp    = lifts[oppIdx];
        if (opp) {
          const bw = W531.rnd(opp.tm * 0.5, rounding);
          exercises.push({
            id: Date.now()+Math.random(),
            name: opp.name+' (BBB)',
            note: trW531('program.w531.note.bbb','Boring But Big · 5×10 @ {weight}kg (50% of {name} TM: {tm}kg)',{weight:bw,name:opp.name,tm:opp.tm}),
            isAux:true, isAccessory:false, tm:opp.tm, auxSlotIdx:-1,
            sets: Array.from({length:5}, () => ({weight:bw, reps:10, done:false, rpe:null}))
          });
        }

      } else {
        // Triumvirate: exactly 2 exercises, 3×10-15 reps
        const tri      = state.triumvirate || W531.defaultTriumvirate;
        const exNames  = tri[liftIdx] || W531.defaultTriumvirate[liftIdx] || [];
        exNames.slice(0,2).forEach((exName, triSlotIdx) => {
          if (!exName) return;
          exercises.push({
            id: Date.now()+Math.random(), name:exName,
            note: trW531('program.w531.note.triumvirate','Triumvirate · 3 sets × 10-15 reps'),
            isAux:true, isAccessory:false, tm:0, auxSlotIdx: liftIdx * 2 + triSlotIdx,
            sets: Array.from({length:3}, () => ({weight:'', reps:12, done:false, rpe:null}))
          });
        });
      }
    });

    return exercises;
  },

  // ─── Labels & Info ────────────────────────────────────────────────────────
  getSessionLabel(selectedOption, state, context) {
    const dayNum = parseInt(selectedOption) || 1;
    const week   = state.week || 1;
    const cycle  = state.cycle || 1;
    const freq   = getW531DaysPerWeek();
    const season = state.season || 'off';
    const effectiveSessionMode=context?.effectiveSessionMode==='light'?'light':'normal';
    const suppressProgramDeload=effectiveSessionMode==='normal'&&(W531.weekScheme[week] || W531.weekScheme[1])?.isDeload&&!state.testWeekPending;
    const schemeWeek=suppressProgramDeload?Math.max(1,week-1):week;
    const scheme = W531.weekScheme[schemeWeek] || W531.weekScheme[1];
    const isTest = week===4 && !!state.testWeekPending;
    const names  = this._dayLifts(dayNum, freq)
                       .map(i => state.lifts.main[i]?.name||'').join('+');
    const icon   = isTest ? '🔬' : scheme.isDeload ? '🌊' : season==='off' ? '🏗️' : '🏒';
    const tag    = isTest ? trW531('program.w531.tm_test','TM Test') : getW531SchemeName(schemeWeek);
    return icon+' C'+cycle+' W'+schemeWeek+' · '+names+' ['+tag+']';
  },

  getSessionModeRecommendation(state) {
    const week=state?.week||1;
    const scheme=W531.weekScheme[week]||W531.weekScheme[1];
    if((scheme.isDeload&&!state?.testWeekPending)||_readiness==='light'||_readiness==='none')return'light';
    return'normal';
  },

  getBlockInfo(state) {
    const week   = state.week || 1;
    const cycle  = state.cycle || 1;
    const season = state.season || 'off';
    const scheme = W531.weekScheme[week] || W531.weekScheme[1];
    const isTest = week===4 && !!state.testWeekPending;
    return {
      name:      isTest ? trW531('program.w531.tm_test_week','TM Test Week') : getW531SchemeName(week),
      weekLabel: trW531('program.w531.block.week_label','Cycle {cycle} · Week {week} · {season}',{cycle,week,season:trW531('program.season.'+season,season)}),
      pct:       Math.round((scheme.pcts[2]||0.85)*100),
      isDeload:  scheme.isDeload && !isTest,
      totalWeeks: null,
      stalledCount: Object.keys(state.stalledLifts||{}).length
    };
  },

  getSessionCharacter(selectedOption,state){
    const week=normalizeW531Week(state.week);
    const scheme=W531.weekScheme[week]||W531.weekScheme[1];
    const isTest=week===4&&!!state.testWeekPending;
    const pct=Math.round((scheme.pcts[2]||0.85)*100);
    if(isTest){
      return{tone:'test',icon:'🔬',labelKey:'program.w531.character.test',labelFallback:trW531('program.w531.character.test','TM Test — validate your training maxes'),labelParams:{}};
    }
    if(scheme.isDeload){
      return{tone:'deload',icon:'🌊',labelKey:'program.w531.character.deload',labelFallback:trW531('program.w531.character.deload','Deload — light recovery week'),labelParams:{}};
    }
    if(week===3){
      return{tone:'amrap',icon:'🎯',labelKey:'program.w531.character.amrap',labelFallback:trW531('program.w531.character.amrap','1+ Week — push AMRAP on last set at {pct}%',{pct}),labelParams:{pct}};
    }
    if(week===2){
      return{tone:'heavy',icon:'🔥',labelKey:'program.w531.character.heavy',labelFallback:trW531('program.w531.character.heavy','3s Week — working sets at {pct}% TM',{pct}),labelParams:{pct}};
    }
    return{tone:'volume',icon:'📈',labelKey:'program.w531.character.volume',labelFallback:trW531('program.w531.character.volume','5s Week — moderate volume at {pct}% TM',{pct}),labelParams:{pct}};
  },

  getPreSessionNote(selectedOption,state){
    const week=normalizeW531Week(state.week);
    const cycle=state.cycle||1;
    const isTest=week===4&&!!state.testWeekPending;
    const schemeName=getW531SchemeName(week);
    if(isTest){
      return trW531('program.w531.note.test','Cycle {cycle}, TM Test — push for max reps to validate training maxes.',{cycle});
    }
    if((W531.weekScheme[week]||{}).isDeload){
      return trW531('program.w531.note.deload','Cycle {cycle}, Deload — easy sets, focus on recovery.',{cycle});
    }
    if(week===3){
      return trW531('program.w531.note.amrap','Cycle {cycle}, {scheme} — push for max reps on every AMRAP set.',{cycle,scheme:schemeName});
    }
    return trW531('program.w531.note.default','Cycle {cycle}, {scheme} — complete all prescribed sets cleanly.',{cycle,scheme:schemeName});
  },

  // ─── Adjust After Session ─────────────────────────────────────────────────
  adjustAfterSession(exercises, state) {
    const newState = JSON.parse(JSON.stringify(state));
    const week     = normalizeW531Week(state.week);
    const season   = state.season || 'off';
    const scheme   = W531.weekScheme[week] || W531.weekScheme[1];
    const isTest   = week===4 && !!state.testWeekPending;

    // True deload: no changes
    if (scheme.isDeload && !isTest) return newState;

    exercises.forEach(ex => {
      if (ex.isAccessory || ex.isAux) return;
      const liftIdx = ex.liftIdx;
      if (liftIdx === undefined || liftIdx < 0) return;
      const lift = newState.lifts.main[liftIdx];
      if (!lift) return;

      // ── TM Test Week ─────────────────────────────────────────────────────
      if (isTest) {
        const testSet = ex.sets.find(s => s.isTestSet && s.done);
        if (testSet) {
          const reps = getW531LoggedRepCount(testSet.reps) || 0;
          if (reps >= 1 && reps <= 2) {
            // Poor result → recalculate TM: 90% of Epley 1RM from this set
            const est1RM = W531.epley1RM(testSet.weight, reps);
            lift.tm = Math.round(est1RM * 0.9 * 10) / 10;
            console.log('[W531 Test] '+lift.name+' weak test ('+reps+' reps) → new TM '+lift.tm+'kg');
          }
          // 3+ reps = strong enough → normal cycle increment applies at cycle end
        }
        newState.testWeekPending  = false;
        newState.tmTestedThisCycle = true;
        return;
      }

      // ── Stall Detection ───────────────────────────────────────────────────
      const lastHeavy = ex.sets.find(s => s.isLastHeavySet);
      if (!lastHeavy) return;

      const minReps = W531.getReps(week, season, 2);  // minimum reps for this week
      const repsHit = getW531LoggedRepCount(lastHeavy.reps) || 0;
      const stalled = !lastHeavy.done || repsHit < minReps;
      if (stalled) {
        newState.stalledLifts = newState.stalledLifts || {};
        newState.stalledLifts[liftIdx] = true;
        console.log('[W531] '+lift.name+' stalled (hit '+repsHit+', needed '+minReps+')');
      }

      // ── RPE / RIR Logging ────────────────────────────────────────────────
      const rpe = lastHeavy.rpe;
      if (rpe !== null && rpe !== undefined && rpe !== '') {
        if (!newState.rpeLog) newState.rpeLog = {};
        if (!newState.rpeLog[liftIdx]) newState.rpeLog[liftIdx] = [];
        newState.rpeLog[liftIdx].push({
          week, cycle:state.cycle||1, rpe, date:new Date().toISOString()
        });
        if (newState.rpeLog[liftIdx].length > 24) newState.rpeLog[liftIdx].shift();
      }
    });

    return newState;
  },

  // ─── Advance State ────────────────────────────────────────────────────────
  advanceState(state, sessionsThisWeek) {
    const freq   = getW531DaysPerWeek();
    const week   = state.week || 1;
    const cycle  = state.cycle || 1;
    const needed = this._weekSessions(freq);

    if (freq === 3) {
      const nextIndex = this._normalizeWeekSessionIndex(state.weekSessionIndex) + 1;
      if (nextIndex >= needed) {
        if (week >= 4) {
          const newState = JSON.parse(JSON.stringify(state));
          if (!newState.tmTestedThisCycle) {
            newState.lifts.main.forEach((l, i) => {
              if (newState.stalledLifts?.[i]) {
                l.tm = Math.round(l.tm * 0.9 * 10) / 10;
                console.log('[W531] '+l.name+' stalled -> TM reset to '+l.tm+'kg');
              } else {
                const incr = l.category === 'legs' ? 5 : 2.5;
                l.tm = Math.round((l.tm + incr) * 10) / 10;
              }
            });
          }
          newState.stalledLifts = {};
          newState.testWeekPending = false;
          newState.tmTestedThisCycle = false;
          newState.week = 1;
          newState.cycle = cycle + 1;
          newState.weekSessionIndex = 0;
          return newState;
        }
        return { ...state, week: week + 1, weekSessionIndex: 0 };
      }
      return { ...state, weekSessionIndex: nextIndex };
    }

    if (sessionsThisWeek >= needed) {
      if (week >= 4) {
        // ── Cycle complete ──────────────────────────────────────────────────
        const newState = JSON.parse(JSON.stringify(state));
        if (!newState.tmTestedThisCycle) {
          // Standard progression — or 10% reduction for stalled lifts
          newState.lifts.main.forEach((l, i) => {
            if (newState.stalledLifts?.[i]) {
              l.tm = Math.round(l.tm * 0.9 * 10) / 10;
              console.log('[W531] '+l.name+' stalled → TM reset to '+l.tm+'kg');
            } else {
              const incr = l.category === 'legs' ? 5 : 2.5;
              l.tm = Math.round((l.tm + incr) * 10) / 10;
            }
          });
        }
        newState.stalledLifts      = {};
        newState.testWeekPending   = false;
        newState.tmTestedThisCycle = false;
        newState.week  = 1;
        newState.cycle = cycle + 1;
        newState.weekSessionIndex = 0;
        return newState;
      }
      return { ...state, week: week+1, weekSessionIndex: 0 };
    }
    return { ...state, weekSessionIndex: 0 };
  },

  dateCatchUp: null,   // 5/3/1 advances by sessions, not calendar weeks

  // ─── State Migration (called on load for existing users missing new fields) ─
  // Safe to call multiple times — only fills in absent keys, never overwrites.
  migrateState(state) {
    const s = state;
    s.week = normalizeW531Week(s.week);
    s.daysPerWeek = getW531DaysPerWeek();
    if (s.cycle === undefined) s.cycle = 1;
    if (s.rounding === undefined || s.rounding <= 0) s.rounding = 2.5;
    if (s.season        === undefined) s.season           = 'off';
    if (s.stalledLifts  === undefined) s.stalledLifts      = {};
    if (s.testWeekPending=== undefined) s.testWeekPending  = false;
    if (s.tmTestedThisCycle===undefined) s.tmTestedThisCycle = false;
    s.weekSessionIndex = this._normalizeWeekSessionIndex(s.weekSessionIndex);
    if (s.triumvirate   === undefined) s.triumvirate       = JSON.parse(JSON.stringify(W531.defaultTriumvirate));
    // Ensure each main lift has a category (old state stored name+tm only)
    if (s.lifts?.main) {
      const legNames = ['squat','deadlift'];
      s.lifts.main.forEach(l => {
        if (!l.category) l.category = legNames.some(n => l.name.toLowerCase().includes(n)) ? 'legs' : 'upper';
      });
    }
    return s;
  },

  // ─── Workout Metadata Snapshot (saved with each workout record) ────────────
  // Captures structured state at session time — allows history/analytics queries
  // without parsing the human-readable programLabel string.
  getWorkoutMeta(state) {
    return {
      week:            state.week    || 1,
      cycle:           state.cycle   || 1,
      season:          state.season  || 'off',
      testWeekPending: !!state.testWeekPending,
      weekSessionIndex:this._normalizeWeekSessionIndex(state.weekSessionIndex),
      daysPerWeek:     getW531DaysPerWeek()
    };
  },

  // ─── Aux/Back Swap ────────────────────────────────────────────────────────
  getAuxSwapOptions(exercise) {
    if (!exercise || exercise.auxSlotIdx === undefined || exercise.auxSlotIdx < 0) return null;
    return W531.getTriumvirateSwapInfo(exercise.auxSlotIdx, exercise.name);
  },
  getBackSwapOptions() { return []; },
  onAuxSwap(slotIdx, newName, state) {
    const { liftIdx, slot } = W531.getTriumvirateSlot(slotIdx);
    const nextState = JSON.parse(JSON.stringify(state));
    const tri = nextState.triumvirate || JSON.parse(JSON.stringify(W531.defaultTriumvirate));
    if (!Array.isArray(tri[liftIdx])) tri[liftIdx] = (W531.defaultTriumvirate[liftIdx] || []).slice(0, 2);
    tri[liftIdx][slot] = newName;
    nextState.triumvirate = tri;
    return nextState;
  },
  onBackSwap(_n, s)    { return s; },
  getProgramConstraints(state) {
    const nextState=state&&state.lifts?state:this.getInitialState();
    const overrides={};
    const mainOptionsByIndex={
      0:{filters:{movementTags:['squat','single_leg'],equipmentTags:['barbell','dumbbell','machine','bodyweight'],muscleGroups:['quads','glutes']},options:['Squat','Front Squat','Leg Press','Bulgarian Split Squats','Step-Ups']},
      1:{filters:{movementTags:['horizontal_press'],equipmentTags:['barbell','dumbbell','machine','bodyweight'],muscleGroups:['chest','triceps','shoulders']},options:['Bench Press','DB Bench','Machine Chest Press','Push-ups','Close-Grip Bench']},
      2:{filters:{movementTags:['hinge'],equipmentTags:['barbell','trap_bar','machine','bodyweight','dumbbell'],muscleGroups:['hamstrings','glutes','back']},options:['Deadlift','Trap Bar Deadlift','Romanian Deadlift','Back Extensions','Hamstring Curls']},
      3:{filters:{movementTags:['vertical_press','horizontal_press'],equipmentTags:['barbell','dumbbell','machine','bodyweight'],muscleGroups:['shoulders','triceps','chest']},options:['OHP','DB OHP','Push Press','Incline Press','Machine Chest Press']}
    };
    (nextState.lifts?.main||[]).forEach((lift,idx)=>{
      const info=mainOptionsByIndex[idx]||mainOptionsByIndex[0];
      overrides[String(lift?.name||'').trim().toLowerCase()]={filters:info.filters,options:info.options,clearWeightOnSwap:true};
      overrides[String((lift?.name||'')+' (BBB)').trim().toLowerCase()]={filters:info.filters,options:info.options,clearWeightOnSwap:true};
    });
    const tri=nextState.triumvirate||W531.defaultTriumvirate;
    [0,1,2,3].forEach(liftIdx=>{
      [0,1].forEach(slotIdx=>{
        const currentName=tri?.[liftIdx]?.[slotIdx]||'';
        const info=W531.getTriumvirateSwapInfo(liftIdx*2+slotIdx,currentName);
        if(currentName&&info)overrides[String(currentName).trim().toLowerCase()]={filters:info.filters,options:info.options,clearWeightOnSwap:true};
      });
    });
    return{exerciseOverrides:overrides};
  },
  adaptSession(baseSession,planningContext,decision) {
    const exercises=JSON.parse(JSON.stringify(baseSession||[]));
    const adaptationEvents=[];
    let changed=false;
    if((planningContext?.limitations?.jointFlags||[]).includes('shoulder')){
      const removedBefore=exercises.length;
      const kept=exercises.filter(exercise=>{
        const meta=window.EXERCISE_LIBRARY?.getExerciseMeta?(EXERCISE_LIBRARY.getExerciseMeta(exercise.exerciseId||exercise.name)):null;
        const tags=meta?.movementTags||[];
        return !exercise.isAux||!tags.includes('vertical_press');
      });
      if(kept.length!==removedBefore){
        changed=true;
        if(typeof createTrainingCommentaryEvent==='function'){
          adaptationEvents.push(createTrainingCommentaryEvent('program_shoulder_trimmed',{programId:'wendler531',programName:'Wendler 5/3/1'}));
        }
      }
      return{
        exercises:kept,
        adaptationEvents,
        equipmentHint:(planningContext?.equipmentAccess==='home_gym'||planningContext?.equipmentAccess==='minimal')
          ? (typeof createTrainingCommentaryEvent==='function'
            ? createTrainingCommentaryEvent('same_pattern_swaps',{programId:'wendler531',programName:'Wendler 5/3/1'})
            : null)
          : null
      };
    }
    return{
      exercises,
      adaptationEvents,
      equipmentHint:(planningContext?.equipmentAccess==='home_gym'||planningContext?.equipmentAccess==='minimal')
        ? (typeof createTrainingCommentaryEvent==='function'
          ? createTrainingCommentaryEvent('same_pattern_swaps',{programId:'wendler531',programName:'Wendler 5/3/1'})
          : null)
        : null
    };
  },

  // ─── Dashboard TMs ────────────────────────────────────────────────────────
  getDashboardTMs(state) {
    const stalled = state.stalledLifts || {};
    return (state.lifts?.main || []).map((l,i) => ({
      name:  l.name,
      value: l.tm + 'kg',
      stalled: !!stalled[i]
    }));
  },

  // ─── Dashboard Banner ─────────────────────────────────────────────────────
  getBannerHTML(options, state, schedule, workouts) {
    const week   = state.week || 1;
    const cycle  = state.cycle || 1;
    const freq   = getW531DaysPerWeek();
    const season = state.season || 'off';
    const isTest = week===4 && !!state.testWeekPending;
    const needed = this._weekSessions(freq);
    const doneCount = options.filter(o => o.done).length;
    const left      = needed - doneCount;
    const bestOpt   = options.find(o => o.isRecommended) || options[0];
    const stalled   = Object.keys(state.stalledLifts||{}).length;
    const stalledStr = stalled
      ? trW531(stalled>1?'program.w531.banner.stalled_pl':'program.w531.banner.stalled',' · ⚠️ {count} lift'+(stalled>1?'s':'')+' stalled',{count:stalled})
      : '';

    // All sessions done this week
    if (doneCount >= needed) {
      const nextWeek = week >= 4 ? 1 : week+1;
      const nextLabel = week >= 4
        ? trW531('program.w531.next_cycle','Cycle {cycle} starts — TMs update!',{cycle:(cycle+1)})+stalledStr
        : trW531('program.w531.next_week','Week {week} ({label}) up next.',{week:nextWeek,label:getW531SchemeName(nextWeek)});
      return {
        style:'rgba(34,197,94,0.1)', border:'rgba(34,197,94,0.25)', color:'var(--green)',
        html:trW531('program.w531.week_done','✅ Week {week} done! {next}',{week,next:nextLabel})
      };
    }

    // Sport awareness — warn if recommended session is leg-heavy
    const todayDow = new Date().getDay();
    const sportDays = schedule?.sportDays||[];
    const legsHeavy = schedule?.sportLegsHeavy!==false;
    const recentHours = {easy:18,moderate:24,hard:30}[schedule?.sportIntensity||'hard'];
    const sportName = schedule?.sportName||trW531('common.sport','Sport');
    const isSportDay = sportDays.includes(todayDow);
    const hadSportRecently = workouts?.some(w =>
      (w.type==='sport'||w.type==='hockey') && (Date.now()-new Date(w.date).getTime())/3600000 <= recentHours
    );
    if ((isSportDay||hadSportRecently) && legsHeavy && bestOpt) {
      const liftIdxes = this._dayLifts(parseInt(bestOpt.value), freq);
      const hasLegs   = liftIdxes.some(i => state.lifts?.main?.[i]?.category==='legs');
      if (hasLegs) {
        const upperOpt = options.find(o => !o.done &&
          this._dayLifts(parseInt(o.value),freq).every(i => state.lifts?.main?.[i]?.category==='upper')
        );
        const sportLabel = isSportDay ? sportName+' day' : 'Post-'+sportName.toLowerCase();
        return {
          style:'rgba(59,130,246,0.1)', border:'rgba(59,130,246,0.25)', color:'var(--blue)',
          html: '🏃 '+sportLabel
              +' — '+trW531('program.w531.banner_leg_heavy','recommended session is leg-heavy. ')
              +(upperOpt
                ? trW531('program.w531.banner_consider_upper','Consider <strong>{label}</strong> instead.',{label:upperOpt.label})
                : trW531('program.w531.banner_only_legs','Only leg sessions remain — go lighter or rest today.'))
        };
      }
    }

    // Readiness override selector
    const rBtns = [
      ['default', trW531('program.w531.readiness.default','💪 Full session')],
      ['light',   trW531('program.w531.readiness.light','🌿 Light recovery')],
      ['none',    trW531('program.w531.readiness.none','😴 Lifts only')]
    ].map(([m, label]) => {
      const active = _readiness === m;
      return `<button class="btn btn-sm ${active?'btn-primary':'btn-secondary'}" `
           + `id="w531-r-${m}" onclick="window._w531SetReadiness('${m}')" `
           + `style="font-size:11px;padding:4px 8px">${label}</button>`;
    }).join('');

    const seasonLabel = season==='off'
      ? '🏗️ '+trW531('program.season.off','Off-Season')
      : '🏒 '+trW531('program.season.in','In-Season');
    const testLabel   = isTest ? ' · 🔬 '+trW531('program.w531.tm_test_week','TM Test Week') : '';
    const cycleWeekStr = trW531('program.w531.banner.cycleweek','C{cycle} W{week}',{cycle,week});
    const nextStr = bestOpt ? trW531('program.w531.banner.next',' · Next: <strong>{label}</strong>',{label:bestOpt.label}) : '';
    const leftStr = left===1
      ? trW531('program.w531.banner.session_left',' · {left} session left',{left})
      : trW531('program.w531.banner.sessions_left',' · {left} sessions left',{left});
    return {
      style:'rgba(167,139,250,0.08)', border:'rgba(167,139,250,0.15)', color:'var(--purple)',
      html: '💪 '+seasonLabel+testLabel
          + ' · '+cycleWeekStr
          + nextStr
          + leftStr
          + stalledStr
          + '<div style="margin-top:8px">'
          +   '<div style="font-size:11px;color:var(--muted);margin-bottom:4px">'+trW531('program.w531.banner.readiness','Session readiness:')+'</div>'
          +   '<div style="display:flex;gap:6px;flex-wrap:wrap">'+rBtns+'</div>'
          + '</div>'
    };
  },

  // ─── Settings ─────────────────────────────────────────────────────────────
  renderSettings(state, container) {
    const week        = state.week || 1;
    const cycle       = state.cycle || 1;
    const freq        = getW531DaysPerWeek();
    const season      = state.season || 'off';
    const rounding    = state.rounding || 2.5;
    const testPending = !!state.testWeekPending;
    const lifts       = (state.lifts && state.lifts.main) || this.getInitialState().lifts.main;
    const stalled     = state.stalledLifts || {};
    _w531SettingsTriumvirate = cloneW531TriumvirateState(state.triumvirate || W531.defaultTriumvirate);

    const freqOpts = [
      [2, trW531('program.w531.settings.freq.2','2×/week — Combined (Squat+Bench  /  Deadlift+Overhead Press)')],
      [3, trW531('program.w531.settings.freq.3','3×/week — Rotating (4 lifts across 3 days)')],
      [4, trW531('program.w531.settings.freq.4','4×/week — Standard (one lift per day)')]
    ].map(([n,l]) => `<option value="${n}"${n===freq?' selected':''}>${l}</option>`).join('');

    const roundOpts = [1,2.5,5]
      .map(n => `<option value="${n}"${n===rounding?' selected':''}>${n} kg</option>`).join('');

    const stalledAlerts = Object.keys(stalled).map(i => {
      const l = lifts[parseInt(i)];
      return l ? `<div style="color:var(--orange);font-size:11px;margin-top:2px">`
               + trW531('program.w531.settings.stalled','⚠️ {name} plateaued — Training Max will drop 10% at cycle end',{name:escapeHtml(w531ExName(l.name))})
               + `</div>` : '';
    }).join('');

    const liftLabels=[trW531('program.w531.lift.sq','Squat (SQ)'),trW531('program.w531.lift.bp','Bench Press (BP)'),trW531('program.w531.lift.dl','Deadlift (DL)'),trW531('program.w531.lift.ohp','Overhead Press (OHP)')];
    const liftRows = lifts.map((l,i) => {
      const stalledBadge = stalled[i]
        ? ' <span style="color:var(--orange);font-size:11px">'+trW531('program.w531.settings.plateau_badge','⚠️ plateaued')+'</span>' : '';
      return `<div class="lift-row">
        <span class="lift-label">${liftLabels[i]||'#'+(i+1)}</span>
        <span style="flex:1;font-size:13px;padding:4px 0;color:var(--text)">${escapeHtml(w531ExName(l.name))}${stalledBadge}</span>
        <input type="number" value="${l.tm}"
          onchange="updateProgramLift('main',${i},'tm',parseFloat(this.value)||0)">
      </div>`;
    }).join('');

    const dayLabels   = [trW531('program.w531.day.sq','Squat Day'),trW531('program.w531.day.bp','Bench Day'),trW531('program.w531.day.dl','Deadlift Day'),trW531('program.w531.day.ohp','OHP Day')];
    const triRows = [0,1,2,3].map(i => {
      const exs = _w531SettingsTriumvirate[i] || W531.defaultTriumvirate[i] || [];
      return `<div style="margin-bottom:10px">
        <div style="font-size:12px;color:var(--muted);margin-bottom:4px">${dayLabels[i]}</div>
        ${[0,1].map(slotIdx => {
          const rawName=exs[slotIdx]||'';
          return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:${slotIdx===0?4:0}px">
            <div style="flex:1;min-width:0;padding:11px 12px;border-radius:12px;border:1px solid var(--border);background:rgba(255,255,255,0.03)">
              <div style="font-size:10px;letter-spacing:0.9px;text-transform:uppercase;color:var(--muted);font-weight:800;margin-bottom:4px">${trW531('program.w531.settings.exercise_slot','Exercise')} ${slotIdx+1}</div>
              <div id="w531-tri-value-${i}-${slotIdx}" style="font-size:13px;color:${rawName?'var(--text)':'var(--muted)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(getW531TriumvirateDisplayLabel(rawName))}</div>
              <input type="hidden" id="w531-tri-input-${i}-${slotIdx}" value="${escapeHtml(rawName)}">
            </div>
            <button class="btn btn-secondary btn-sm" type="button" onclick="window._w531PickTriumvirate(${i},${slotIdx})" style="width:auto;white-space:nowrap">${trW531('workout.swap','Swap')}</button>
          </div>`;
        }).join('')}
      </div>`;
    }).join('');

    container.innerHTML = `
      <div style="font-size:12px;color:var(--muted);margin-bottom:12px;background:rgba(167,139,250,0.08);padding:8px 12px;border-radius:8px">
        ${trW531('program.w531.settings.overview','4-week cycles · +5kg lower / +2.5kg upper each cycle · plateau tracking')}
      </div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:10px;padding:8px 10px;background:rgba(255,255,255,0.03);border-radius:6px;line-height:1.5">
        ${trW531('program.w531.settings.terms','<strong>Terms:</strong> TM = Training Max. 1RM = one-rep max. AMRAP = as many reps as possible.')}
      </div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:4px">${trW531('program.w531.settings.cycle_week','Cycle {cycle} · Week {week} of 4',{cycle,week})}</div>
      ${stalledAlerts}

      <label style="margin-top:14px">${trW531('program.w531.settings.season','Season Mode')}</label>
      <div style="display:flex;gap:8px;margin-top:6px;margin-bottom:14px">
        <button class="btn ${season==='off'?'btn-primary':'btn-secondary'}" id="w531-s-off"
          onclick="window._w531SeasonUI('off')"
          style="flex:1;line-height:1.5;padding:10px 8px">
          ${trW531('program.w531.settings.off_label','🏗️ Off-Season')}<br><small style="opacity:.7">${trW531('program.w531.settings.off_desc',"5's PRO + BBB (5x10 assistance)")}</small>
        </button>
        <button class="btn ${season==='in'?'btn-primary':'btn-secondary'}" id="w531-s-in"
          onclick="window._w531SeasonUI('in')"
          style="flex:1;line-height:1.5;padding:10px 8px">
          ${trW531('program.w531.settings.in_label','🏒 In-Season')}<br><small style="opacity:.7">${trW531('program.w531.settings.in_desc','Minimum reps + 2 accessory lifts')}</small>
        </button>
      </div>
      <input type="hidden" id="prog-season" value="${season}">

      <div class="settings-row-note">${trW531('program.global_frequency_hint','Uses your Training preference: {value}.',{value:(typeof getTrainingDaysPerWeekLabel==='function'?getTrainingDaysPerWeekLabel(freq):freq+' sessions / week')})}</div>

      <label style="margin-top:12px">${trW531('program.w531.settings.rounding','Weight Rounding (kg)')}</label>
      <select id="prog-rounding">${roundOpts}</select>

      <label style="margin-top:12px">${trW531('program.w531.settings.week_current','Current Week in Cycle (1–4)')}</label>
      <div style="display:flex;gap:8px;align-items:center">
        <input type="number" id="prog-week" min="1" max="4" value="${week}" style="flex:1">
        <button class="btn btn-sm btn-secondary"
          onclick="document.getElementById('prog-week').value=1"
          style="width:auto">Reset</button>
      </div>

      <label style="margin-top:14px">${trW531('program.w531.settings.tm_test_title','TM Test Week')} <span style="font-weight:400;color:var(--muted)">(${trW531('program.forge.settings.peak_optional','optional')})</span></label>
      <div style="font-size:11px;color:var(--muted);margin-bottom:8px">
        ${trW531('program.w531.settings.tm_test_help','Replaces the next Deload with a 100% TM AMRAP test. 1–2 reps: recalculate TM. 3+ reps: keep normal progression.')}
      </div>
      <input type="hidden" id="prog-test-week" value="${testPending?'1':'0'}">
      <button class="btn ${testPending?'btn-primary':'btn-secondary'}" id="w531-test-btn"
        onclick="window._w531ToggleTestWeek()"
        style="width:100%;text-align:left;padding:10px 14px">
        ${testPending?trW531('program.w531.tm_test_enabled','🔬 TM Test Week enabled — will replace next Deload'):trW531('program.w531.tm_test_enable','🔬 Enable TM Test Week instead of Deload')}
      </button>

      <div class="divider-label" style="margin-top:18px"><span>${trW531('program.w531.settings.training_max','Training Max (kg)')}</span></div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:8px">
        ${trW531('program.w531.settings.tm_hint','Set to about 90% of your 1RM. Auto increases and resets apply each cycle.')}
      </div>
      ${liftRows}

      <div class="divider-label" style="margin-top:14px"><span>${trW531('program.w531.settings.in_season_accessories','In-Season Accessory Exercises')}</span></div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:8px">
        ${trW531('program.w531.settings.in_season_help','Pick 2 accessory exercises per in-season session (3 sets × 10–15 reps each).')}
      </div>
      ${triRows}

      <button class="btn btn-purple" style="margin-top:16px" onclick="saveProgramSetup()">
        ${trW531('program.w531.save_setup','Save Program Setup')}
      </button>
    `;
  },

  renderSimpleSettings(state,container){
    const week=state.week||1;
    const freq=getW531DaysPerWeek();
    const season=state.season||'off';
    const rounding=state.rounding||2.5;
    const lifts=(state.lifts&&state.lifts.main)||this.getInitialState().lifts.main;
    const freqOpts=[
      [2,trW531('program.w531.settings.freq.2','2×/week — Combined (Squat+Bench / Deadlift+Overhead Press)')],
      [3,trW531('program.w531.settings.freq.3','3×/week — Rotating (4 lifts across 3 days)')],
      [4,trW531('program.w531.settings.freq.4','4×/week — Standard (one lift per day)')]
    ].map(([n,label])=>`<option value="${n}"${n===freq?' selected':''}>${label}</option>`).join('');
    const roundOpts=[1,2.5,5].map(n=>`<option value="${n}"${n===rounding?' selected':''}>${n} kg</option>`).join('');
    const seasonOpts=[
      ['off',trW531('program.w531.settings.off_label','Off-Season')],
      ['in',trW531('program.w531.settings.in_label','In-Season')]
    ].map(([value,label])=>`<option value="${value}"${value===season?' selected':''}>${label}</option>`).join('');
    const liftLabels=[trW531('program.w531.lift.sq','Squat (SQ)'),trW531('program.w531.lift.bp','Bench Press (BP)'),trW531('program.w531.lift.dl','Deadlift (DL)'),trW531('program.w531.lift.ohp','Overhead Press (OHP)')];
    const tmRows=lifts.map((lift,idx)=>`
      <div class="lift-row">
        <span class="lift-label">${escapeHtml(liftLabels[idx]||('#'+(idx+1)))}</span>
        <span style="flex:1;font-size:13px;color:var(--text)">${escapeHtml(w531ExName(lift.name))}</span>
        <input type="number" id="w531-basic-tm-${idx}" value="${lift.tm}" min="0" step="0.1">
      </div>`).join('');
    container.innerHTML=`
      <div class="program-settings-grid">
        <div class="settings-section-card">
          <div class="settings-section-title">${trW531('program.w531.simple.overview_title','Cycle rhythm')}</div>
          <div class="settings-section-sub">${trW531('program.w531.simple.overview','Set the season mode and current cycle week here. Weekly frequency now comes from Training Preferences, and accessory exercise selection stays in Advanced Setup.')}</div>
          <label>${trW531('program.w531.settings.season','Season Mode')}</label>
          <select id="w531-basic-season">${seasonOpts}</select>
          <div class="settings-row-note">${trW531('program.global_frequency_hint','Uses your Training preference: {value}.',{value:(typeof getTrainingDaysPerWeekLabel==='function'?getTrainingDaysPerWeekLabel(freq):freq+' sessions / week')})}</div>
          <label style="margin-top:12px">${trW531('program.w531.settings.rounding','Weight Rounding (kg)')}</label>
          <select id="w531-basic-rounding">${roundOpts}</select>
          <label style="margin-top:12px">${trW531('program.w531.settings.week_current','Current Week in Cycle (1–4)')}</label>
          <input type="number" id="w531-basic-week" min="1" max="4" value="${week}">
        </div>
        <div class="settings-section-card">
          <div class="settings-section-title">${trW531('program.w531.settings.training_max','Training Max (kg)')}</div>
          <div class="settings-section-sub">${trW531('program.w531.simple.tm_help','Update the current training maxes for the four main lifts. Assistance work stays in Advanced Setup.')}</div>
          <div>${tmRows}</div>
        </div>
      </div>
    `;
  },

  getSimpleSettingsSummary(state){
    const season=state.season||'off';
    const freq=getW531DaysPerWeek();
    const week=state.week||1;
    const seasonLabel=season==='in'
      ? trW531('program.w531.settings.in_label','In-Season')
      : trW531('program.w531.settings.off_label','Off-Season');
    return trW531('program.w531.simple.summary','{season} · {freq} sessions/week · Week {week}',{season:seasonLabel,freq,week});
  },

  saveSettings(state) {
    const week         = parseInt(document.getElementById('prog-week')?.value) || 1;
    const rounding     = parseFloat(document.getElementById('prog-rounding')?.value) || 2.5;
    const testWeekPending = document.getElementById('prog-test-week')?.value === '1';
    const season       = document.getElementById('prog-season')?.value || 'off';
    const triumvirate = cloneW531TriumvirateState(_w531SettingsTriumvirate || state.triumvirate || W531.defaultTriumvirate);
    [0,1,2,3].forEach(liftIdx => {
      [0,1].forEach(slotIdx => {
        const rawName=triumvirate[liftIdx]?.[slotIdx]||'';
        const resolved=(typeof resolveExerciseSelection==='function')?resolveExerciseSelection(rawName):{name:rawName};
        triumvirate[liftIdx][slotIdx]=String(resolved?.name||rawName||'').trim();
      });
    });

    return { ...state, week, rounding, testWeekPending, season, triumvirate };
  },

  saveSimpleSettings(state){
    const next=JSON.parse(JSON.stringify(state||this.getInitialState()));
    next.season=document.getElementById('w531-basic-season')?.value||next.season||'off';
    next.rounding=parseFloat(document.getElementById('w531-basic-rounding')?.value)||next.rounding||2.5;
    next.week=parseInt(document.getElementById('w531-basic-week')?.value,10)||next.week||1;
    if(!next.lifts||!Array.isArray(next.lifts.main))next.lifts=this.getInitialState().lifts;
    next.lifts.main=(next.lifts.main||[]).map((lift,idx)=>({
      ...lift,
      tm:parseFloat(document.getElementById(`w531-basic-tm-${idx}`)?.value)||0
    }));
    return next;
  }
};

// ─── WINDOW HELPERS (called from rendered HTML onclick handlers) ───────────────

// Readiness selector — updates button highlight and module-level var
window._w531SetReadiness = function(mode) {
  _readiness = mode;
  ['default','light','none'].forEach(m => {
    const btn = document.getElementById('w531-r-'+m);
    if (!btn) return;
    btn.className = 'btn btn-sm ' + (m===mode ? 'btn-primary' : 'btn-secondary');
    btn.style.cssText = 'font-size:11px;padding:4px 8px';
  });
};

// TM Test Week toggle button
window._w531ToggleTestWeek = function() {
  const hidden = document.getElementById('prog-test-week');
  const btn    = document.getElementById('w531-test-btn');
  if (!hidden || !btn) return;
  const next = hidden.value !== '1';
  hidden.value = next ? '1' : '0';
  btn.className = 'btn ' + (next ? 'btn-primary' : 'btn-secondary');
  btn.style.cssText = 'width:100%;text-align:left;padding:10px 14px';
  btn.textContent = next
    ? trW531('program.w531.tm_test_enabled','TM Test Week enabled - will replace next Deload')
    : trW531('program.w531.tm_test_enable','Enable TM Test Week instead of Deload');
};

// Season toggle in Settings — updates hidden input + button classes
window._w531SeasonUI = function(season) {
  const hidden = document.getElementById('prog-season');
  if (hidden) hidden.value = season;
  ['off','in'].forEach(s => {
    const btn = document.getElementById('w531-s-'+s);
    if (btn) btn.className = 'btn ' + (s===season ? 'btn-primary' : 'btn-secondary');
  });
};

window._w531PickTriumvirate = function(liftIdx,slotIdx) {
  const swapInfo=getW531SettingsSwapInfo(liftIdx,slotIdx);
  if(!swapInfo||typeof window.openExerciseCatalogForSettings!=='function')return;
  const currentName=getW531TriumvirateSlotValue(liftIdx,slotIdx);
  const title=swapInfo.category
    ? trW531('catalog.title.settings_aux','Choose {cat} accessory',{cat:swapInfo.category.charAt(0).toUpperCase()+swapInfo.category.slice(1)})
    : trW531('catalog.title.settings','Choose Exercise');
  window.openExerciseCatalogForSettings({
    exercise:{name:currentName||swapInfo.options?.[0]||''},
    swapInfo,
    title,
    subtitle:trW531('catalog.sub.settings','Choose the exercise variant this program should use.'),
    onSelect:(exercise)=>{
      const resolved=(typeof window.resolveExerciseSelection==='function')?window.resolveExerciseSelection(exercise):{name:exercise?.name||''};
      setW531TriumvirateSlotValue(liftIdx,slotIdx,resolved?.name||'');
      syncW531TriumvirateSlotUI(liftIdx,slotIdx);
    }
  });
};

registerProgram(WENDLER_531);
})();
