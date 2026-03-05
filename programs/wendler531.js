// ── 5/3/1 (WENDLER) — HOCKEY EDITION ────────────────────────────────────────
// Off-season: 5's PRO + Boring But Big
// In-season:  Minimum Required Reps + Triumvirate
// Supports 2 / 3 / 4 days per week with stall tracking, TM test week,
// daily readiness override, and full hockey-aware scheduling.
(function(){
'use strict';

// ─── INTERNAL CONSTANTS & HELPERS ────────────────────────────────────────────
const W531 = {
  seasons: {
    off: { name:'Off-Season',  short:'5\'s PRO + BBB' },
    in:  { name:'In-Season',   short:'Min Reps + Triumvirate' }
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

  // Light-recovery circuit substituted when readiness === 'light'
  recoveryCircuit: [
    { name:'Band Pull-Aparts',   sets:3, reps:20    },
    { name:'Bodyweight Squats',  sets:3, reps:15    },
    { name:'Push-ups',           sets:3, reps:15    },
    { name:'Dead Hangs',         sets:3, reps:'30s' }
  ],

  rnd(v, inc) { return Math.round(v / inc) * inc; },

  // Epley estimated 1RM from a performed set
  epley1RM(weight, reps) {
    return reps === 1 ? weight : Math.round((weight * reps * 0.0333 + weight) * 10) / 10;
  }
};

// Per-session readiness override — module-level, intentionally NOT persisted.
// Resets to 'default' each page load, which is the right UX.
let _readiness = 'default'; // 'default' | 'light' | 'none'

// ─── PROGRAM OBJECT ───────────────────────────────────────────────────────────
const WENDLER_531 = {
  id:   'wendler531',
  name: '5/3/1 (Wendler)',
  description: "4-week strength cycles with automatic weight progression.",
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
    if (freq === 3) return 3;
    return 4;
  },

  // ─── Session Options ──────────────────────────────────────────────────────
  getSessionOptions(state, workouts) {
    const week   = state.week || 1;
    const freq   = state.daysPerWeek || 4;
    const season = state.season || 'off';
    const lifts  = (state.lifts && state.lifts.main) || this.getInitialState().lifts.main;
    const scheme = W531.weekScheme[week] || W531.weekScheme[1];

    // Workouts logged this calendar week
    const now = new Date(), sow = new Date(now);
    sow.setDate(now.getDate() - ((now.getDay()+6) % 7));
    sow.setHours(0,0,0,0);
    const doneNums = workouts
      .filter(w => w.program==='wendler531' && new Date(w.date)>=sow)
      .map(w => w.programDayNum);

    const pct    = Math.round(scheme.pcts[2]*100);
    const topRep = W531.getReps(week, season, 2);

    if (freq === 2) {
      // 2 days: Day 1 = Squat+Bench, Day 2 = DL+OHP
      return [1,2].map(d => {
        const names = this._dayLifts(d, 2).map(i => lifts[i]?.name||'').join(' + ');
        const done  = doneNums.includes(d);
        const isNext = !done && doneNums.length === d-1;
        return {
          value: String(d),
          label: (done?'✅ ':(isNext?'⭐ ':'')+names+' · '+pct+'%×'+topRep),
          isRecommended: isNext && !done, done
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
        label: (done?'✅ ':(isRecommended?'⭐ ':'')+l.name+' · '+pct+'%×'+topRep),
        isRecommended, done, liftIdx:i, category:l.category
      };
    });
  },

  // ─── Build Session ────────────────────────────────────────────────────────
  buildSession(selectedOption, state) {
    const dayNum   = parseInt(selectedOption) || 1;
    const week     = state.week || 1;
    const freq     = state.daysPerWeek || 4;
    const season   = state.season || 'off';
    const rounding = state.rounding || 2.5;
    const lifts    = state.lifts.main;
    const scheme   = W531.weekScheme[week] || W531.weekScheme[1];
    const isDeload = scheme.isDeload && !state.testWeekPending;
    const isTest   = week === 4 && !!state.testWeekPending;
    const readiness = _readiness;
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
        note = '🔬 TM TEST · '+lift.tm+'kg × AMRAP — '
             + '3-5 reps → normal cycle; 1-2 reps → TM recalculates to 90% estimated 1RM';

      } else {
        sets = scheme.pcts.map((pct, si) => {
          const weight = W531.rnd(lift.tm * pct, rounding);
          const reps   = W531.getReps(week, season, si);
          const isLast = si === scheme.pcts.length - 1;
          return { weight, reps, done:false, rpe:null, isLastHeavySet: isLast && !isDeload };
        });
        const pctStr = scheme.pcts.map(p => Math.round(p*100)+'%').join('/');
        const repStr = sets.map(s => s.reps).join('/');
        if (isDeload)
          note = '🌊 Deload · '+lift.tm+'kg TM · '+pctStr+' · easy 5s — recovery week';
        else if (season === 'off')
          note = lift.tm+'kg TM · '+pctStr+' · '+repStr+" (5's PRO — strict 5 reps all sets, no AMRAP)";
        else
          note = lift.tm+'kg TM · '+pctStr+' · '+repStr+' (minimum required reps — conserve energy)';
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
            note: 'Light recovery · '+rc.sets+'×'+rc.reps,
            isAux:true, isAccessory:true, tm:0, auxSlotIdx:-1,
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
            note: 'Boring But Big · 5×10 @ '+bw+'kg (50% of '+opp.name+' TM: '+opp.tm+'kg)',
            isAux:true, isAccessory:true, tm:opp.tm, auxSlotIdx:-1,
            sets: Array.from({length:5}, () => ({weight:bw, reps:10, done:false, rpe:null}))
          });
        }

      } else {
        // Triumvirate: exactly 2 exercises, 3×10-15 reps
        const tri      = state.triumvirate || W531.defaultTriumvirate;
        const exNames  = tri[liftIdx] || W531.defaultTriumvirate[liftIdx] || [];
        exNames.slice(0,2).forEach(exName => {
          if (!exName) return;
          exercises.push({
            id: Date.now()+Math.random(), name:exName,
            note: 'Triumvirate · 3 sets × 10-15 reps',
            isAux:true, isAccessory:true, tm:0, auxSlotIdx:-1,
            sets: Array.from({length:3}, () => ({weight:'', reps:12, done:false, rpe:null}))
          });
        });
      }
    });

    return exercises;
  },

  // ─── Labels & Info ────────────────────────────────────────────────────────
  getSessionLabel(selectedOption, state) {
    const dayNum = parseInt(selectedOption) || 1;
    const week   = state.week || 1;
    const cycle  = state.cycle || 1;
    const freq   = state.daysPerWeek || 4;
    const season = state.season || 'off';
    const scheme = W531.weekScheme[week] || W531.weekScheme[1];
    const isTest = week===4 && !!state.testWeekPending;
    const names  = this._dayLifts(dayNum, freq)
                       .map(i => state.lifts.main[i]?.name||'').join('+');
    const icon   = isTest ? '🔬' : scheme.isDeload ? '🌊' : season==='off' ? '🏗️' : '🏒';
    const tag    = isTest ? 'TM Test' : scheme.label;
    return icon+' C'+cycle+' W'+week+' · '+names+' ['+tag+']';
  },

  getBlockInfo(state) {
    const week   = state.week || 1;
    const cycle  = state.cycle || 1;
    const season = state.season || 'off';
    const scheme = W531.weekScheme[week] || W531.weekScheme[1];
    const isTest = week===4 && !!state.testWeekPending;
    return {
      name:      isTest ? 'TM Test Week' : scheme.label,
      weekLabel: 'Cycle '+cycle+' · Week '+week+' · '+(W531.seasons[season]?.name||season),
      pct:       Math.round((scheme.pcts[2]||0.85)*100),
      isDeload:  scheme.isDeload && !isTest,
      totalWeeks: null,
      stalledCount: Object.keys(state.stalledLifts||{}).length
    };
  },

  // ─── Adjust After Session ─────────────────────────────────────────────────
  adjustAfterSession(exercises, state) {
    const newState = JSON.parse(JSON.stringify(state));
    const week     = state.week || 1;
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
          const reps = parseInt(testSet.reps) || 0;
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
      const repsHit = parseInt(lastHeavy.reps) || 0;
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
    const freq   = state.daysPerWeek || 4;
    const week   = state.week || 1;
    const cycle  = state.cycle || 1;
    const needed = this._weekSessions(freq);

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
        return newState;
      }
      return { ...state, week: week+1 };
    }
    return state;
  },

  dateCatchUp: null,   // 5/3/1 advances by sessions, not calendar weeks

  // ─── State Migration (called on load for existing users missing new fields) ─
  // Safe to call multiple times — only fills in absent keys, never overwrites.
  migrateState(state) {
    const s = state;
    if (s.season        === undefined) s.season           = 'off';
    if (s.stalledLifts  === undefined) s.stalledLifts      = {};
    if (s.testWeekPending=== undefined) s.testWeekPending  = false;
    if (s.tmTestedThisCycle===undefined) s.tmTestedThisCycle = false;
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
      daysPerWeek:     state.daysPerWeek || 4
    };
  },

  // ─── Aux/Back Swap (not used by this program) ─────────────────────────────
  getAuxSwapOptions() { return null; },
  getBackSwapOptions() { return []; },
  onAuxSwap(_si, _n, s) { return s; },
  onBackSwap(_n, s)    { return s; },

  // ─── Dashboard TMs ────────────────────────────────────────────────────────
  getDashboardTMs(state) {
    const stalled = state.stalledLifts || {};
    return (state.lifts?.main || []).map((l,i) => ({
      name:  l.name + (stalled[i] ? ' ⚠️' : ''),
      value: l.tm + 'kg'
    }));
  },

  // ─── Dashboard Banner ─────────────────────────────────────────────────────
  getBannerHTML(options, state, schedule, workouts) {
    const week   = state.week || 1;
    const cycle  = state.cycle || 1;
    const freq   = state.daysPerWeek || 4;
    const season = state.season || 'off';
    const isTest = week===4 && !!state.testWeekPending;
    const needed = this._weekSessions(freq);
    const doneCount = options.filter(o => o.done).length;
    const left      = needed - doneCount;
    const bestOpt   = options.find(o => o.isRecommended) || options[0];
    const stalled   = Object.keys(state.stalledLifts||{}).length;
    const stalledStr = stalled ? ' · ⚠️ '+stalled+' lift'+(stalled>1?'s':'')+' stalled' : '';

    // All sessions done this week
    if (doneCount >= needed) {
      const nextWeek = week >= 4 ? 1 : week+1;
      const nextLabel = week >= 4
        ? 'Cycle '+(cycle+1)+' starts — TMs update!'+stalledStr
        : 'Week '+nextWeek+' ('+((W531.weekScheme[nextWeek]||{}).label||'')+') up next.';
      return {
        style:'rgba(34,197,94,0.1)', border:'rgba(34,197,94,0.25)', color:'var(--green)',
        html:'✅ Week '+week+' done! '+nextLabel
      };
    }

    // Sport awareness — warn if recommended session is leg-heavy
    const todayDow = new Date().getDay();
    const sportDays = schedule?.sportDays||schedule?.hockeyDays||[];
    const legsHeavy = schedule?.sportLegsHeavy!==false;
    const recentHours = {easy:18,moderate:24,hard:30}[schedule?.sportIntensity||'hard'];
    const sportName = schedule?.sportName||'Sport';
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
              +' — recommended session is leg-heavy. '
              +(upperOpt?'Consider <strong>'+upperOpt.label+'</strong> instead.':'Only leg sessions remain — go lighter or rest today.')
        };
      }
    }

    // Readiness override selector
    const rBtns = [
      ['default', '💪 Full session',   'Full workout as prescribed'],
      ['light',   '🌿 Light recovery', 'Replace assistance with bodyweight circuit'],
      ['none',    '😴 Lifts only',     'Main lifts only — skip all assistance']
    ].map(([m, label]) => {
      const active = _readiness === m;
      return `<button class="btn btn-sm ${active?'btn-primary':'btn-secondary'}" `
           + `id="w531-r-${m}" onclick="window._w531SetReadiness('${m}')" `
           + `style="font-size:11px;padding:4px 8px">${label}</button>`;
    }).join('');

    const seasonLabel = season==='off' ? '🏗️ Off-Season' : '🏒 In-Season';
    const testLabel   = isTest ? ' · 🔬 TM Test Week' : '';
    return {
      style:'rgba(167,139,250,0.08)', border:'rgba(167,139,250,0.15)', color:'var(--purple)',
      html: '💪 '+seasonLabel+testLabel
          + ' · C'+cycle+' W'+week
          + (bestOpt ? ' · Next: <strong>'+bestOpt.label+'</strong>' : '')
          + ' · '+left+' session'+(left!==1?'s':'')+' left'
          + stalledStr
          + '<div style="margin-top:8px">'
          +   '<div style="font-size:11px;color:var(--muted);margin-bottom:4px">Session readiness:</div>'
          +   '<div style="display:flex;gap:6px;flex-wrap:wrap">'+rBtns+'</div>'
          + '</div>'
    };
  },

  // ─── Settings ─────────────────────────────────────────────────────────────
  renderSettings(state, container) {
    const week        = state.week || 1;
    const cycle       = state.cycle || 1;
    const freq        = state.daysPerWeek || 4;
    const season      = state.season || 'off';
    const rounding    = state.rounding || 2.5;
    const testPending = !!state.testWeekPending;
    const lifts       = (state.lifts && state.lifts.main) || this.getInitialState().lifts.main;
    const stalled     = state.stalledLifts || {};

    const freqOpts = [
      [2, '2×/week — Combined (Squat+Bench  /  Deadlift+Overhead Press)'],
      [3, '3×/week — Rotating (4 lifts across 3 days)'],
      [4, '4×/week — Standard (one lift per day)']
    ].map(([n,l]) => `<option value="${n}"${n===freq?' selected':''}>${l}</option>`).join('');

    const roundOpts = [1,2.5,5]
      .map(n => `<option value="${n}"${n===rounding?' selected':''}>${n} kg</option>`).join('');

    const stalledAlerts = Object.keys(stalled).map(i => {
      const l = lifts[parseInt(i)];
      return l ? `<div style="color:var(--orange);font-size:11px;margin-top:2px">`
               + `⚠️ ${l.name} plateaued — Training Max will drop 10% at cycle end</div>` : '';
    }).join('');

    const liftRows = lifts.map((l,i) => {
      const stalledBadge = stalled[i]
        ? ' <span style="color:var(--orange);font-size:11px">⚠️ plateaued</span>' : '';
      return `<div class="lift-row">
        <span class="lift-label">${['Squat (SQ)','Bench Press (BP)','Deadlift (DL)','Overhead Press (OHP)'][i]||'#'+(i+1)}</span>
        <span style="flex:1;font-size:13px;padding:4px 0;color:var(--text)">${l.name}${stalledBadge}</span>
        <input type="number" value="${l.tm}"
          onchange="updateProgramLift('main',${i},'tm',parseFloat(this.value)||0)">
      </div>`;
    }).join('');

    const triumvirate = state.triumvirate || W531.defaultTriumvirate;
    const dayLabels   = ['Squat Day','Bench Day','Deadlift Day','OHP Day'];
    const triRows = [0,1,2,3].map(i => {
      const exs = triumvirate[i] || W531.defaultTriumvirate[i] || [];
      return `<div style="margin-bottom:10px">
        <div style="font-size:12px;color:var(--muted);margin-bottom:4px">${dayLabels[i]}</div>
        <input type="text" id="w531-tri-${i}-0" value="${exs[0]||''}"
          placeholder="Exercise 1 (e.g. ${W531.defaultTriumvirate[i]?.[0]||''})"
          style="width:100%;margin-bottom:4px">
        <input type="text" id="w531-tri-${i}-1" value="${exs[1]||''}"
          placeholder="Exercise 2 (e.g. ${W531.defaultTriumvirate[i]?.[1]||''})"
          style="width:100%">
      </div>`;
    }).join('');

    container.innerHTML = `
      <div style="font-size:12px;color:var(--muted);margin-bottom:12px;background:rgba(167,139,250,0.08);padding:8px 12px;border-radius:8px">
        4-week cycles · +5kg lower / +2.5kg upper each cycle · plateau tracking
      </div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:10px;padding:8px 10px;background:rgba(255,255,255,0.03);border-radius:6px;line-height:1.5">
        <strong>Terms:</strong> TM = Training Max. 1RM = one-rep max. AMRAP = as many reps as possible.
      </div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:4px">Cycle ${cycle} · Week ${week} of 4</div>
      ${stalledAlerts}

      <label style="margin-top:14px">Season Mode</label>
      <div style="display:flex;gap:8px;margin-top:6px;margin-bottom:14px">
        <button class="btn ${season==='off'?'btn-primary':'btn-secondary'}" id="w531-s-off"
          onclick="window._w531SeasonUI('off')"
          style="flex:1;line-height:1.5;padding:10px 8px">
          🏗️ Off-Season<br><small style="opacity:.7">5's PRO + BBB (5x10 assistance)</small>
        </button>
        <button class="btn ${season==='in'?'btn-primary':'btn-secondary'}" id="w531-s-in"
          onclick="window._w531SeasonUI('in')"
          style="flex:1;line-height:1.5;padding:10px 8px">
          🏒 In-Season<br><small style="opacity:.7">Minimum reps + 2 accessory lifts</small>
        </button>
      </div>
      <input type="hidden" id="prog-season" value="${season}">

      <label>Sessions Per Week</label>
      <select id="prog-days">${freqOpts}</select>

      <label style="margin-top:12px">Weight Rounding (kg)</label>
      <select id="prog-rounding">${roundOpts}</select>

      <label style="margin-top:12px">Current Week in Cycle (1–4)</label>
      <div style="display:flex;gap:8px;align-items:center">
        <input type="number" id="prog-week" min="1" max="4" value="${week}" style="flex:1">
        <button class="btn btn-sm btn-secondary"
          onclick="document.getElementById('prog-week').value=1"
          style="width:auto">Reset</button>
      </div>

      <label style="margin-top:14px">TM Test Week <span style="font-weight:400;color:var(--muted)">(optional)</span></label>
      <div style="font-size:11px;color:var(--muted);margin-bottom:8px">
        Replaces the next Deload with a 100% TM AMRAP test.
        1–2 reps: recalculate TM. 3+ reps: keep normal progression.
      </div>
      <input type="hidden" id="prog-test-week" value="${testPending?'1':'0'}">
      <button class="btn ${testPending?'btn-primary':'btn-secondary'}" id="w531-test-btn"
        onclick="window._w531ToggleTestWeek()"
        style="width:100%;text-align:left;padding:10px 14px">
        ${testPending?'🔬 TM Test Week enabled — will replace next Deload':'🔬 Enable TM Test Week instead of Deload'}
      </button>

      <div class="divider-label" style="margin-top:18px"><span>Training Max (kg)</span></div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:8px">
        Set to about 90% of your 1RM. Auto increases and resets apply each cycle.
      </div>
      ${liftRows}

      <div class="divider-label" style="margin-top:14px"><span>In-Season Accessory Exercises</span></div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:8px">
        Pick 2 accessory exercises per in-season session (3 sets × 10–15 reps each).
      </div>
      ${triRows}

      <button class="btn btn-purple" style="margin-top:16px" onclick="saveProgramSetup()">
        Save Program Setup
      </button>
    `;
  },

  saveSettings(state) {
    const week         = parseInt(document.getElementById('prog-week')?.value) || 1;
    const rounding     = parseFloat(document.getElementById('prog-rounding')?.value) || 2.5;
    const daysPerWeek  = parseInt(document.getElementById('prog-days')?.value) || 4;
    const testWeekPending = document.getElementById('prog-test-week')?.value === '1';
    const season       = document.getElementById('prog-season')?.value || 'off';

    // Read Triumvirate inputs
    const triumvirate = {};
    [0,1,2,3].forEach(i => {
      const a = document.getElementById('w531-tri-'+i+'-0')?.value?.trim() || '';
      const b = document.getElementById('w531-tri-'+i+'-1')?.value?.trim() || '';
      triumvirate[i] = [a, b];
    });

    return { ...state, week, rounding, daysPerWeek, testWeekPending, season, triumvirate };
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
    ? '🔬 TM Test Week enabled — will replace next Deload'
    : '🔬 Enable TM Test Week instead of Deload';
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

registerProgram(WENDLER_531);
})();
