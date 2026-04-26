import { PROFILE_DOCUMENT_KEYS } from '../../domain/config';
import { normalizeTrainingPreferences } from '../../domain/normalizers';
import { getCanonicalProgramId } from '../../domain/planning-utils';
import { dataStore } from '../../stores/data-store';
import { profileStore } from '../../stores/profile-store';
import { programStore } from '../../stores/program-store';
import { programDocKey } from './profile-documents';
import { t } from './i18n';
import { callLegacyWindowFunction, readLegacyWindowValue } from './legacy-call';

type MutableRecord = Record<string, unknown>;
type ProgramLike = MutableRecord & {
  id?: string;
  name?: string;
  getInitialState?: () => MutableRecord;
  saveSettings?: (state?: MutableRecord | null) => MutableRecord;
  getBlockInfo?: (
    state?: MutableRecord | null,
    context?: MutableRecord | null
  ) => MutableRecord | null;
  migrateState?: (
    state?: MutableRecord | null,
    context?: MutableRecord | null
  ) => MutableRecord;
  adjustAfterSession?: (
    exercises?: Array<MutableRecord>,
    state?: MutableRecord | null,
    programOption?: unknown,
    context?: MutableRecord | null
  ) => MutableRecord;
  advanceState?: (
    state?: MutableRecord | null,
    sessionsThisWeek?: number,
    context?: MutableRecord | null
  ) => MutableRecord;
  dateCatchUp?: (state: MutableRecord) => MutableRecord;
  _previewSplit?: (frequency: number, lifts?: unknown) => unknown;
  _updateModeDesc?: (mode: string) => unknown;
  _names?: Record<string, string>;
};

type EstimateTarget = {
  key: string;
  label: string;
  rounding: number;
};

export type ProgramFrequencyCompatibility = {
  requested: number;
  effective: number;
  range: { min: number; max: number };
  supportsExact: boolean;
};

export type ProgramFrequencyMismatch = ProgramFrequencyCompatibility & {
  prog: ProgramLike;
  requestedLabel: string;
  effectiveLabel: string;
  suggestions: ProgramLike[];
};

export type ProgramSwitchResult = {
  switched: boolean;
  programId: string | null;
  estimatedLoads: Array<{ lift: string; value: number }>;
};

type ProgramRuntimeDeps = {
  confirm?: (title: string, message: string, onConfirm: () => void) => unknown;
  saveProfileData?: (options?: Record<string, unknown>) => unknown;
  closeProgramSetupSheet?: () => unknown;
  initSettings?: () => unknown;
  updateDashboard?: () => unknown;
  updateProgramDisplay?: () => unknown;
  showToast?: (message: string, color?: string) => unknown;
  setTimeout?: (callback: () => void, delayMs: number) => unknown;
  now?: () => number;
  getWeekStart?: (date: Date) => Date;
  getElementValue?: (id: string) => string;
  openExerciseCatalogForSettings?: (config: Record<string, unknown>) => unknown;
  resolveExerciseSelection?: (input: unknown) => { name?: string } | null;
  parseLoggedRepCount?: (value: unknown) => number;
  getProgramSessionBuildContext?: (
    input?: Record<string, unknown>
  ) => Record<string, unknown> | null;
  t?: (
    key: string,
    fallback: string,
    params?: Record<string, unknown>
  ) => string;
};

function cloneJson<T>(value: T): T {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

function getProfileRecord(profileLike?: MutableRecord | null) {
  return (
    profileLike ||
    (profileStore.getState().profile as MutableRecord | null) ||
    (dataStore.getState().profile as MutableRecord | null) ||
    {}
  );
}

function getWorkoutRecords(workoutsLike?: Array<MutableRecord> | null) {
  return (
    workoutsLike ||
    (dataStore.getState().workouts as Array<MutableRecord>) ||
    readLegacyWindowValue<Array<MutableRecord>>('workouts') ||
    []
  );
}

function getActiveProgramIdFromProfile(profileLike?: MutableRecord | null) {
  const profile = getProfileRecord(profileLike);
  return getCanonicalProgramId(profile.activeProgram) || 'forge';
}

function getTrainingDaysLabel(value: number) {
  const fallback = `${value} sessions / week`;
  const label = t('settings.preferences.training_days_value', fallback, {
    count: value,
  });
  return label.includes('{count}') ? fallback : label;
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function translate(
  key: string,
  fallback: string,
  params?: Record<string, unknown>,
  deps?: ProgramRuntimeDeps
) {
  const translated =
    deps?.t?.(key, fallback, params) || t(key, fallback, params);
  if (!params) return translated;
  return Object.entries(params).reduce(
    (text, [paramKey, value]) =>
      text.replace(`{${paramKey}}`, String(value ?? '')),
    translated
  );
}

function formatEstimatedWeight(value: unknown) {
  const rounded = Math.round((Number(value) || 0) * 100) / 100;
  if (!Number.isFinite(rounded)) return '0';
  return String(rounded)
    .replace(/\.00$/, '')
    .replace(/(\.\d)0$/, '$1');
}

function roundEstimatedWeight(value: number, increment: number) {
  const step = Number(increment) > 0 ? Number(increment) : 2.5;
  return Math.round(value / step) * step;
}

function getDefaultDeps(): ProgramRuntimeDeps {
  return {
    confirm: (title, message, onConfirm) => {
      if (
        callLegacyWindowFunction('showConfirm', title, message, onConfirm) !==
        undefined
      ) {
        return;
      }
      onConfirm();
    },
    saveProfileData: (options) =>
      callLegacyWindowFunction('saveProfileData', options),
    closeProgramSetupSheet: () =>
      callLegacyWindowFunction('closeProgramSetupSheet'),
    initSettings: () => callLegacyWindowFunction('initSettings'),
    updateDashboard: () => callLegacyWindowFunction('updateDashboard'),
    updateProgramDisplay: () =>
      callLegacyWindowFunction('updateProgramDisplay'),
    showToast: (message, color) =>
      callLegacyWindowFunction('showToast', message, color),
    setTimeout: (callback, delayMs) => {
      if (typeof window !== 'undefined')
        return window.setTimeout(callback, delayMs);
      return setTimeout(callback, delayMs);
    },
    getWeekStart: (date) =>
      readLegacyWindowValue<(value: Date) => Date>('getWeekStart')?.(date) ||
      new Date(date.getFullYear(), date.getMonth(), date.getDate()),
    getElementValue: (id) => {
      if (typeof document === 'undefined') return '';
      const element = document.getElementById(id) as {
        value?: string | number | null;
      } | null;
      const value = element?.value;
      return typeof value === 'string' || typeof value === 'number'
        ? String(value)
        : '';
    },
    openExerciseCatalogForSettings: (config) =>
      readLegacyWindowValue<(value: Record<string, unknown>) => unknown>(
        'openExerciseCatalogForSettings'
      )?.(config),
    resolveExerciseSelection: (input) =>
      readLegacyWindowValue<(value: unknown) => { name?: string } | null>(
        'resolveExerciseSelection'
      )?.(input) || null,
    parseLoggedRepCount: (value) =>
      readLegacyWindowValue<(raw: unknown) => number>('parseLoggedRepCount')?.(
        value
      ) || Number.NaN,
    getProgramSessionBuildContext: (input) =>
      readLegacyWindowValue<
        (value?: Record<string, unknown>) => Record<string, unknown> | null
      >('getProgramSessionBuildContext')?.(input) || null,
  };
}

function resolveDeps(deps?: ProgramRuntimeDeps) {
  return {
    ...getDefaultDeps(),
    ...(deps || {}),
  };
}

export function getProgramFrequencyCompatibility(
  programId?: string | null,
  profileLike?: MutableRecord | null
): ProgramFrequencyCompatibility {
  const profile = getProfileRecord(profileLike);
  const prefs = normalizeTrainingPreferences(profile);
  const requested = Number(prefs.trainingDaysPerWeek) || 3;
  const store = programStore.getState();
  const range = store.getProgramTrainingDaysRange(programId);
  const effective = store.getEffectiveProgramFrequency(programId, profile);
  return {
    requested,
    effective,
    range,
    supportsExact: requested >= range.min && requested <= range.max,
  };
}

export function getRegisteredPrograms() {
  return programStore.getState().programs as ProgramLike[];
}

export function hasRegisteredPrograms() {
  return getRegisteredPrograms().length > 0;
}

export function getProgramById(programId?: string | null) {
  return programStore
    .getState()
    .getProgramById(programId) as ProgramLike | null;
}

export function getProgramInitialState(programId?: string | null) {
  return programStore.getState().getProgramInitialState(programId);
}

export function getActiveProgramId() {
  const store = programStore.getState();
  return store.activeProgramId || getActiveProgramIdFromProfile();
}

export function getActiveProgram() {
  return (
    (programStore.getState().activeProgram as ProgramLike | null) ||
    getProgramById(getActiveProgramId()) ||
    getProgramById('forge') ||
    getRegisteredPrograms()[0] ||
    null
  );
}

export function getActiveProgramState() {
  const activeProgramId = getActiveProgramId();
  const profile = getProfileRecord();
  const programs =
    profile.programs && typeof profile.programs === 'object'
      ? (profile.programs as MutableRecord)
      : {};
  const currentState = programs[activeProgramId || ''];
  if (currentState && typeof currentState === 'object') {
    return currentState as MutableRecord;
  }
  return (
    getProgramInitialState(activeProgramId) ||
    getProgramInitialState('forge') ||
    {}
  );
}

export function setProgramState(programId?: string | null, state?: unknown) {
  const canonicalId = getCanonicalProgramId(programId);
  if (!canonicalId) return null;
  const savedState = profileStore
    .getState()
    .setProgramState(canonicalId, cloneJson((state || {}) as MutableRecord));
  programStore.getState().syncFromLegacy();
  return savedState;
}

function getWorkoutProgramId(workout?: MutableRecord | null) {
  if (!workout) return null;
  if (workout.program) return getCanonicalProgramId(workout.program);
  if (!workout.type || workout.type === 'sport' || workout.type === 'hockey') {
    return null;
  }
  return getCanonicalProgramId(workout.type);
}

function stripWarmupSetsFromExercises(exercises: Array<MutableRecord>) {
  return cloneJson(exercises || []).map((exercise) => ({
    ...exercise,
    sets: Array.isArray(exercise?.sets)
      ? (exercise.sets as Array<MutableRecord>).filter((set) => !set?.isWarmup)
      : [],
  }));
}

function buildReplayContext(
  prog: ProgramLike,
  workout: MutableRecord | null,
  stateForContext: MutableRecord,
  deps: ProgramRuntimeDeps
) {
  const savedContext =
    workout?.sessionSnapshot &&
    typeof workout.sessionSnapshot === 'object' &&
    (workout.sessionSnapshot as MutableRecord).buildContext &&
    typeof (workout.sessionSnapshot as MutableRecord).buildContext === 'object'
      ? cloneJson(
          (workout.sessionSnapshot as MutableRecord)
            .buildContext as MutableRecord
        )
      : null;
  const runtime = {
    ...((savedContext?.programRuntime &&
    typeof savedContext.programRuntime === 'object'
      ? savedContext.programRuntime
      : {}) as MutableRecord),
  };
  const savedDaysPerWeek = Number(
    runtime.daysPerWeek ??
      (workout?.programMeta as MutableRecord | undefined)?.daysPerWeek ??
      (workout?.programStateUsedForBuild as MutableRecord | undefined)
        ?.daysPerWeek ??
      (workout?.programStateBefore as MutableRecord | undefined)?.daysPerWeek
  );
  if (Number.isFinite(savedDaysPerWeek) && savedDaysPerWeek > 0) {
    runtime.daysPerWeek = savedDaysPerWeek;
  }
  const workoutWeekStart =
    workout?.date && deps.getWeekStart
      ? deps.getWeekStart(new Date(String(workout.date)))
      : null;
  if (
    workoutWeekStart &&
    Number.isFinite(workoutWeekStart.getTime()) &&
    !runtime.weekStartDate
  ) {
    runtime.weekStartDate = workoutWeekStart.toISOString();
  }
  if (savedContext) {
    savedContext.programRuntime = runtime;
    return savedContext;
  }
  return (
    deps.getProgramSessionBuildContext?.({
      prog,
      state: stateForContext,
      sessionModeBundle: {
        selectedSessionMode:
          (workout?.runnerState as MutableRecord | undefined)
            ?.selectedSessionMode || 'auto',
        effectiveSessionMode:
          (workout?.runnerState as MutableRecord | undefined)
            ?.effectiveSessionMode || 'normal',
      },
      preview: false,
      programRuntime: runtime,
    }) || { programRuntime: runtime }
  );
}

export function recomputeProgramStateFromWorkouts(
  programId?: string | null,
  workoutsLike?: Array<MutableRecord> | null,
  deps?: ProgramRuntimeDeps
) {
  const resolvedDeps = resolveDeps(deps);
  const canonicalId = getCanonicalProgramId(programId);
  const prog = getProgramById(canonicalId);
  if (!canonicalId || !prog) return null;

  const programWorkouts = getWorkoutRecords(workoutsLike)
    .filter((workout) => getWorkoutProgramId(workout) === canonicalId)
    .sort((a, b) => {
      const dateDiff =
        new Date(String(a.date || '')).getTime() -
        new Date(String(b.date || '')).getTime();
      if (dateDiff !== 0) return dateDiff;
      return Number(a.id || 0) - Number(b.id || 0);
    });

  const firstWorkout = programWorkouts[0];
  let state = firstWorkout?.programStateUsedForBuild
    ? cloneJson(firstWorkout.programStateUsedForBuild as MutableRecord)
    : firstWorkout?.programStateBefore
      ? cloneJson(firstWorkout.programStateBefore as MutableRecord)
      : prog.getInitialState
        ? cloneJson(prog.getInitialState())
        : {};
  const initialContext = buildReplayContext(
    prog,
    firstWorkout || null,
    state,
    resolvedDeps
  );
  if (typeof prog.migrateState === 'function') {
    state = prog.migrateState(state, initialContext);
  }

  programWorkouts.forEach((workout, index) => {
    const progressionContext = buildReplayContext(
      prog,
      workout,
      state,
      resolvedDeps
    );
    const exercises = stripWarmupSetsFromExercises(
      Array.isArray(workout.exercises)
        ? (workout.exercises as Array<MutableRecord>)
        : []
    );
    if (typeof prog.adjustAfterSession === 'function') {
      state = prog.adjustAfterSession(
        exercises,
        state,
        workout.programOption,
        progressionContext
      );
    }
    if (typeof prog.advanceState === 'function') {
      const workoutDate = new Date(String(workout.date || ''));
      const runtime =
        progressionContext?.programRuntime &&
        typeof progressionContext.programRuntime === 'object'
          ? (progressionContext.programRuntime as MutableRecord)
          : {};
      const runtimeWeekStart = runtime.weekStartDate
        ? new Date(String(runtime.weekStartDate))
        : null;
      const startOfWeek =
        runtimeWeekStart && Number.isFinite(runtimeWeekStart.getTime())
          ? runtimeWeekStart
          : resolvedDeps.getWeekStart?.(workoutDate) || workoutDate;
      const sessionsThisWeek = programWorkouts
        .slice(0, index + 1)
        .filter(
          (sessionWorkout) =>
            new Date(String(sessionWorkout.date || '')).getTime() >=
            startOfWeek.getTime()
        ).length;
      state = prog.advanceState(state, sessionsThisWeek, progressionContext);
    }
  });

  return setProgramState(canonicalId, state);
}

export function applyProgramDateCatchUp(programId?: string | null) {
  const canonicalId = getCanonicalProgramId(programId);
  const prog = getProgramById(canonicalId);
  const profile = getProfileRecord();
  const currentPrograms =
    profile.programs && typeof profile.programs === 'object'
      ? (profile.programs as MutableRecord)
      : {};
  const currentState = canonicalId
    ? (currentPrograms[canonicalId] as MutableRecord | null)
    : null;
  if (!canonicalId || !prog || !currentState || !prog.dateCatchUp) {
    return false;
  }
  const caughtState = prog.dateCatchUp(currentState);
  if (
    !caughtState ||
    JSON.stringify(caughtState) === JSON.stringify(currentState)
  ) {
    return false;
  }
  setProgramState(canonicalId, caughtState);
  return true;
}

export function cleanProgramOptionLabel(label?: unknown) {
  return String(label || '')
    .replace(/^([\u2b50\u2705\ud83c\udfc3\u26a0\ufe0f]+\s*)+/u, '')
    .trim();
}

export function getProgramOptionDayNumber(option?: MutableRecord | null) {
  const fromValue = String(option?.value || '').match(/\d+/);
  if (fromValue) return fromValue[0];
  const fromLabel = String(cleanProgramOptionLabel(option?.label || '')).match(
    /\d+/
  );
  return fromLabel ? fromLabel[0] : '';
}

export function getProgramPreviewExerciseMeta(
  exercise?: MutableRecord | null,
  deps?: ProgramRuntimeDeps
) {
  const workSets = (Array.isArray(exercise?.sets) ? exercise.sets : []).filter(
    (setLike) => !(setLike as MutableRecord)?.isWarmup
  ) as MutableRecord[];
  const reps = workSets.map((set) => String(set.reps ?? '')).filter(Boolean);
  const sameReps =
    reps.length && reps.every((rep) => rep === reps[0]) ? reps[0] : '';
  const pattern = workSets.length
    ? sameReps
      ? `${workSets.length}\u00d7${sameReps}`
      : `${workSets.length} ${translate('common.sets', 'sets', undefined, deps)}`
    : '';
  const weightRaw =
    exercise?.prescribedWeight ??
    workSets.find(
      (set) =>
        set.weight !== undefined && set.weight !== null && set.weight !== ''
    )?.weight;
  const weightNum = parseFloat(String(weightRaw ?? ''));
  const weight = Number.isFinite(weightNum) ? `${weightNum} kg` : '';
  return { pattern, weight };
}

export function getProgramPreviewHeaderChips(
  prog?: ProgramLike | null,
  state?: MutableRecord | null,
  session?: Array<MutableRecord> | null,
  buildContext?: MutableRecord | null,
  deps?: ProgramRuntimeDeps
) {
  const resolvedDeps = resolveDeps(deps);
  const chips: string[] = [];
  const previewContext =
    buildContext ||
    resolvedDeps.getProgramSessionBuildContext?.({
      prog,
      state,
      preview: true,
    }) ||
    null;
  const blockInfo =
    prog && typeof prog.getBlockInfo === 'function'
      ? (
          prog.getBlockInfo as (
            state?: MutableRecord | null,
            context?: MutableRecord | null
          ) => MutableRecord | null
        )(state, previewContext)
      : null;
  if (blockInfo?.pct) chips.push(`${blockInfo.pct}% 1RM`);
  const primary =
    (session || []).find((exercise) => !exercise.isAccessory) ||
    (session || [])[0];
  if (primary) {
    const meta = getProgramPreviewExerciseMeta(primary, resolvedDeps);
    if (meta.pattern) chips.push(meta.pattern);
    if (
      state?.mode === 'rir' &&
      primary.rirCutoff !== undefined &&
      primary.rirCutoff !== null
    ) {
      chips.push(`RIR ${primary.rirCutoff}`);
    }
  }
  return chips.slice(0, 3);
}

export function getProgramTodayMuscleTags(
  planningContext?: MutableRecord | null,
  deps?: ProgramRuntimeDeps
) {
  const loadMap =
    planningContext?.recentMuscleLoad &&
    typeof planningContext.recentMuscleLoad === 'object'
      ? (planningContext.recentMuscleLoad as Record<string, number>)
      : {};
  return Object.entries(loadMap)
    .map(([name, load]) => {
      let level = 'light';
      if (Number(load) >= 8) level = 'high';
      else if (Number(load) >= 4) level = 'moderate';
      return {
        name: translate(
          'dashboard.muscle_group.' + name,
          name,
          undefined,
          deps
        ),
        level,
        label: translate(
          `dashboard.muscle_load.${level}`,
          level,
          undefined,
          deps
        ),
      };
    })
    .sort((a, b) => {
      const order: Record<string, number> = { high: 0, moderate: 1, light: 2 };
      return order[a.level] - order[b.level];
    })
    .slice(0, 3);
}

export function saveProgramSetup(deps?: ProgramRuntimeDeps) {
  const resolvedDeps = resolveDeps(deps);
  const prog = getActiveProgram();
  if (!prog?.id) return null;
  const state = getActiveProgramState();
  const nextState =
    typeof prog.saveSettings === 'function' ? prog.saveSettings(state) : state;
  const savedState = setProgramState(prog.id, nextState);
  resolvedDeps.saveProfileData?.({ programIds: [String(prog.id)] });
  resolvedDeps.closeProgramSetupSheet?.();
  resolvedDeps.showToast?.(
    translate('program.setup_saved', 'Program setup saved!', undefined, deps),
    'var(--purple)'
  );
  resolvedDeps.updateProgramDisplay?.();
  return savedState;
}

export function resolveProgramExerciseName(
  input?: unknown,
  deps?: ProgramRuntimeDeps
) {
  const resolvedDeps = resolveDeps(deps);
  if (resolvedDeps.resolveExerciseSelection) {
    const resolved = resolvedDeps.resolveExerciseSelection(input);
    return String(resolved?.name || '').trim();
  }
  return String(
    typeof input === 'object' && input
      ? (input as MutableRecord).name || ''
      : input || ''
  ).trim();
}

export function openProgramExercisePicker(
  config?: MutableRecord | null,
  deps?: ProgramRuntimeDeps
) {
  const resolvedDeps = resolveDeps(deps);
  if (typeof resolvedDeps.openExerciseCatalogForSettings !== 'function') {
    return false;
  }
  const next = config || {};
  const exerciseLike =
    next.exercise && typeof next.exercise === 'object'
      ? (next.exercise as MutableRecord)
      : {};
  const currentName = resolveProgramExerciseName(
    next.currentName || exerciseLike.name || '',
    resolvedDeps
  );
  const swapInfo = {
    category: next.category || '',
    filters:
      next.filters && typeof next.filters === 'object'
        ? { ...(next.filters as MutableRecord) }
        : {},
    options: Array.isArray(next.options)
      ? (next.options as Array<unknown>).slice()
      : [],
  };
  return resolvedDeps.openExerciseCatalogForSettings({
    exercise: {
      name:
        currentName || String(next.fallbackName || swapInfo.options[0] || ''),
    },
    swapInfo,
    title:
      next.title ||
      translate('catalog.title.settings', 'Choose Exercise', undefined, deps),
    subtitle:
      next.subtitle ||
      translate(
        'catalog.sub.settings',
        'Choose the exercise variant this program should use.',
        undefined,
        deps
      ),
    titleParams: next.titleParams || null,
    onSelect: (exercise: unknown) => {
      const resolvedName = resolveProgramExerciseName(exercise, resolvedDeps);
      if (typeof next.onSelect === 'function') {
        (next.onSelect as (name: string, exercise?: unknown) => void)(
          resolvedName,
          exercise
        );
      }
    },
  });
}

function clampProgramLoad(value: unknown) {
  const numeric = parseFloat(String(value ?? ''));
  return Number.isNaN(numeric)
    ? 0
    : Math.max(0, Math.min(999, Math.round(numeric * 10) / 10));
}

export function updateProgramLift(
  array?: string | null,
  index?: number,
  field?: string | null,
  value?: unknown
) {
  const prog = getActiveProgram();
  const state = getActiveProgramState();
  const lifts =
    state.lifts && typeof state.lifts === 'object'
      ? (state.lifts as MutableRecord)
      : null;
  const liftArray = lifts?.[String(array || '')];
  const idx = Number(index);
  if (!prog?.id || !Array.isArray(liftArray) || !liftArray[idx]) return null;
  const nextState = cloneJson(state);
  const nextLifts = nextState.lifts as Record<string, Array<MutableRecord>>;
  nextLifts[String(array || '')][idx][String(field || '')] =
    field === 'tm' || field === 'weight' ? clampProgramLoad(value) : value;
  return setProgramState(prog.id, nextState);
}

export function updateSLLift(key?: string | null, value?: unknown) {
  const prog = getActiveProgram();
  const state = getActiveProgramState();
  if (!prog?.id) return null;
  const nextState = cloneJson(state);
  const lifts =
    nextState.lifts && typeof nextState.lifts === 'object'
      ? (nextState.lifts as MutableRecord)
      : null;
  const lift =
    lifts?.[String(key || '')] && typeof lifts[String(key || '')] === 'object'
      ? (lifts[String(key || '')] as MutableRecord)
      : null;
  if (lift) {
    lift.weight = clampProgramLoad(value);
  }
  return setProgramState(prog.id, nextState);
}

export function setSLNextWorkout(
  workoutKey?: string | null,
  deps?: ProgramRuntimeDeps
) {
  const prog = getActiveProgram();
  if (!prog?.id) return null;
  const savedState = setProgramState(prog.id, {
    ...getActiveProgramState(),
    nextWorkout: workoutKey,
  });
  resolveDeps(deps).initSettings?.();
  return savedState;
}

export function previewProgramSplit(deps?: ProgramRuntimeDeps) {
  const resolvedDeps = resolveDeps(deps);
  const prog = getActiveProgram();
  const state = getActiveProgramState();
  if (!prog || typeof prog._previewSplit !== 'function') return false;
  const inputFrequency = parseInt(
    resolvedDeps.getElementValue?.('prog-days') || '',
    10
  );
  const effectiveFrequency = programStore
    .getState()
    .getEffectiveProgramFrequency(String(prog.id || ''), getProfileRecord());
  const frequency =
    inputFrequency || effectiveFrequency || Number(state.daysPerWeek) || 3;
  prog._previewSplit(frequency, state.lifts);
  return true;
}

export function updateForgeModeSetting(deps?: ProgramRuntimeDeps) {
  const prog = getActiveProgram();
  if (!prog || typeof prog._updateModeDesc !== 'function') return false;
  const mode = resolveDeps(deps).getElementValue?.('prog-mode') || 'sets';
  prog._updateModeDesc(mode);
  return true;
}

function getProgramsSupportingTrainingDays(days: number) {
  const store = programStore.getState();
  return (store.programs || []).filter((prog) => {
    const range = store.getProgramTrainingDaysRange(String(prog.id || ''));
    return days >= range.min && days <= range.max;
  });
}

function scoreProgramForTrainingDays(
  prog: ProgramLike,
  days: number,
  prefs: Record<string, unknown>
) {
  const capabilities = programStore
    .getState()
    .getProgramCapabilities(String(prog.id || ''));
  if (typeof capabilities.recommendationScore === 'function') {
    return capabilities.recommendationScore(days, prefs);
  }
  return 0;
}

export function getSuggestedProgramsForTrainingDays(
  days: number,
  profileLike?: MutableRecord | null
) {
  const prefs = normalizeTrainingPreferences(getProfileRecord(profileLike));
  return getProgramsSupportingTrainingDays(Number(days) || 3)
    .map((prog) => ({
      prog: prog as ProgramLike,
      score: scoreProgramForTrainingDays(
        prog as ProgramLike,
        Number(days) || 3,
        prefs as Record<string, unknown>
      ),
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        String(a.prog.name || '').localeCompare(String(b.prog.name || ''))
    )
    .map((entry) => entry.prog);
}

export function getActiveProgramFrequencyMismatch(
  profileLike?: MutableRecord | null
): ProgramFrequencyMismatch | null {
  const profile = getProfileRecord(profileLike);
  const activeId = getCanonicalProgramId(profile.activeProgram) || 'forge';
  const prog = programStore
    .getState()
    .getProgramById(activeId) as ProgramLike | null;
  if (!prog) return null;
  const compatibility = getProgramFrequencyCompatibility(activeId, profile);
  if (compatibility.supportsExact) return null;
  const suggestions = getSuggestedProgramsForTrainingDays(
    compatibility.requested,
    profile
  ).filter((candidate) => candidate.id !== activeId);
  return {
    prog,
    ...compatibility,
    requestedLabel: getTrainingDaysLabel(compatibility.requested),
    effectiveLabel: getTrainingDaysLabel(compatibility.effective),
    suggestions,
  };
}

export function getProgramFrequencyNoticeHTML(
  programId?: string | null,
  profileLike?: MutableRecord | null
) {
  const mismatch = getActiveProgramFrequencyMismatch(profileLike);
  if (!mismatch || mismatch.prog.id !== programId) return '';
  const programName = t(
    `program.${String(mismatch.prog.id || '')}.name`,
    String(mismatch.prog.name || '')
  );
  const body = t(
    'program.frequency_notice.body',
    '{name} does not support {requested}. It is currently using {effective}.',
    {
      name: programName,
      requested: mismatch.requestedLabel,
      effective: mismatch.effectiveLabel,
    }
  );
  const suggestionLine = mismatch.suggestions.length
    ? `<div class="program-frequency-note">${escapeHtml(
        t(
          'program.frequency_notice.suggestion',
          'For {requested}, switch to a program that supports it directly.',
          { requested: mismatch.requestedLabel }
        )
      )}</div>`
    : '';
  const actions = mismatch.suggestions
    .slice(0, 3)
    .map((candidate) => {
      const name = t(
        `program.${String(candidate.id || '')}.name`,
        String(candidate.name || '')
      );
      return `<button type="button" class="btn btn-secondary program-frequency-action" onclick="switchProgram('${escapeHtml(
        candidate.id
      )}')">${escapeHtml(name)}</button>`;
    })
    .join('');
  return `
    <div class="program-frequency-notice">
      <div class="program-frequency-kicker">${escapeHtml(
        t('program.frequency_notice.kicker', 'Program fit')
      )}</div>
      <div class="program-frequency-title">${escapeHtml(
        t(
          'program.frequency_notice.title',
          'Selected weekly frequency no longer fits this program'
        )
      )}</div>
      <div class="program-frequency-body">${escapeHtml(body)}</div>
      ${suggestionLine}
      ${actions ? `<div class="program-frequency-actions">${actions}</div>` : ''}
    </div>
  `;
}

function normalizeEstimateExerciseName(
  input: unknown,
  deps: ProgramRuntimeDeps
) {
  const raw = String(
    typeof input === 'object' && input
      ? (input as MutableRecord).name || ''
      : input || ''
  ).trim();
  if (!raw) return '';
  const resolved = deps.resolveExerciseSelection?.(raw);
  return String(resolved?.name || raw)
    .trim()
    .toLowerCase();
}

function parseEstimateRepCount(value: unknown, deps: ProgramRuntimeDeps) {
  const parsed = deps.parseLoggedRepCount?.(value);
  if (Number.isFinite(parsed)) return Number(parsed);
  const raw = parseFloat(String(value ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(raw) ? raw : 0;
}

function getProgramEstimateTargets(programId: string | null): EstimateTarget[] {
  const program = programStore
    .getState()
    .getProgramById(programId) as ProgramLike | null;
  const initialState = program?.getInitialState?.() || {};
  const rounding = Number(initialState.rounding) || 2.5;
  const lifts = initialState.lifts as unknown;
  if (Array.isArray((lifts as MutableRecord | undefined)?.main)) {
    return ((lifts as MutableRecord).main as Array<MutableRecord>).map(
      (lift) => ({
        key: String(lift.name || ''),
        label: String(lift.name || ''),
        rounding,
      })
    );
  }
  if (lifts && typeof lifts === 'object') {
    return Object.keys(lifts as MutableRecord).map((key) => ({
      key,
      label:
        String(program?._names?.[key] || '') ||
        key.charAt(0).toUpperCase() + key.slice(1),
      rounding,
    }));
  }
  return [];
}

export function estimateTMsFromHistory(
  targetProgramId?: string | null,
  workoutsLike?: Array<MutableRecord> | null,
  deps?: ProgramRuntimeDeps
) {
  const resolvedDeps = resolveDeps(deps);
  const targets = getProgramEstimateTargets(
    getCanonicalProgramId(targetProgramId)
  );
  if (!targets.length) return {};
  const now = resolvedDeps.now?.() || Date.now();
  const lookbackMs = 60 * 864e5;
  const recentWorkouts = getWorkoutRecords(workoutsLike).filter(
    (workout) =>
      workout &&
      workout.type !== 'sport' &&
      workout.type !== 'hockey' &&
      Array.isArray(workout.exercises) &&
      now - new Date(String(workout.date || '')).getTime() <= lookbackMs
  );
  const estimates: Record<string, number> = {};

  targets.forEach((target) => {
    const targetName = normalizeEstimateExerciseName(
      target.label || target.key,
      resolvedDeps
    );
    if (!targetName) return;
    const matchedSessions = new Set<string>();
    let bestWeight = 0;
    let bestReps = 0;

    recentWorkouts.forEach((workout, workoutIndex) => {
      const workoutTag = String(
        workout.id || `${String(workout.date || '')}:${workoutIndex}`
      );
      (workout.exercises as Array<MutableRecord>).forEach((exercise) => {
        if (
          normalizeEstimateExerciseName(exercise, resolvedDeps) !== targetName
        )
          return;
        let matchedInWorkout = false;
        (Array.isArray(exercise.sets) ? exercise.sets : []).forEach(
          (setLike) => {
            const set = setLike as MutableRecord;
            if (!set?.done || set?.isWarmup) return;
            const weight = Number(set.weight);
            const reps = parseEstimateRepCount(set.reps, resolvedDeps);
            if (!Number.isFinite(weight) || weight <= 0 || reps <= 0) return;
            matchedInWorkout = true;
            if (
              weight > bestWeight ||
              (weight === bestWeight && reps > bestReps)
            ) {
              bestWeight = weight;
              bestReps = reps;
            }
          }
        );
        if (matchedInWorkout) matchedSessions.add(workoutTag);
      });
    });

    if (matchedSessions.size < 2 || bestWeight <= 0 || bestReps <= 0) return;
    const estimatedOneRepMax = bestWeight * (1 + bestReps / 30);
    const cappedTrainingMax = Math.min(bestWeight, estimatedOneRepMax * 0.85);
    const rounded = roundEstimatedWeight(cappedTrainingMax, target.rounding);
    const finalValue = Math.min(bestWeight, rounded);
    if (finalValue > 0) estimates[target.key] = finalValue;
  });

  return Object.keys(estimates).length >= 2 ? estimates : {};
}

function applyEstimatedLoadsToInitialState(
  program: ProgramLike,
  initialState: MutableRecord,
  estimates: Record<string, number>
) {
  const nextState = cloneJson(initialState) || {};
  const estimatedLoads: Array<{ lift: string; value: number }> = [];
  const lifts = nextState.lifts as unknown;
  if (Array.isArray((lifts as MutableRecord | undefined)?.main)) {
    ((lifts as MutableRecord).main as Array<MutableRecord>).forEach((lift) => {
      const liftName = String(lift.name || '');
      if (estimates[liftName] === undefined) return;
      lift.tm = estimates[liftName];
      estimatedLoads.push({ lift: liftName, value: estimates[liftName] });
    });
  } else if (lifts && typeof lifts === 'object') {
    Object.keys(lifts as MutableRecord).forEach((key) => {
      if (estimates[key] === undefined) return;
      const lift = (lifts as MutableRecord)[key] as MutableRecord;
      lift.weight = estimates[key];
      estimatedLoads.push({
        lift:
          String(program._names?.[key] || '') ||
          key.charAt(0).toUpperCase() + key.slice(1),
        value: estimates[key],
      });
    });
  }
  return { nextState, estimatedLoads };
}

export function switchProgram(
  programId?: string | null,
  deps?: ProgramRuntimeDeps
): ProgramSwitchResult {
  const resolvedDeps = resolveDeps(deps);
  const canonicalId = getCanonicalProgramId(programId);
  const profile = getProfileRecord();
  const activeId = getCanonicalProgramId(profile.activeProgram) || 'forge';
  if (!canonicalId || canonicalId === activeId) {
    return { switched: false, programId: canonicalId, estimatedLoads: [] };
  }
  const program = programStore
    .getState()
    .getProgramById(canonicalId) as ProgramLike | null;
  if (!program) {
    return { switched: false, programId: canonicalId, estimatedLoads: [] };
  }
  const programName = t(
    `program.${String(program.id || '')}.name`,
    String(program.name || '')
  );
  let result: ProgramSwitchResult = {
    switched: false,
    programId: canonicalId,
    estimatedLoads: [],
  };

  resolvedDeps.confirm?.(
    t('program.switch_to', 'Switch to {name}', { name: programName }),
    t(
      'program.switch_msg',
      'Your current program is paused. {name} will start where you left off.',
      { name: programName }
    ),
    () => {
      profileStore.getState().setActiveProgram(canonicalId);
      const currentProfile = getProfileRecord();
      const currentPrograms =
        currentProfile.programs && typeof currentProfile.programs === 'object'
          ? (currentProfile.programs as MutableRecord)
          : {};
      let estimatedLoads: Array<{ lift: string; value: number }> = [];
      if (!currentPrograms[canonicalId]) {
        const initialState = cloneJson(program.getInitialState?.() || {});
        const estimates = estimateTMsFromHistory(
          canonicalId,
          getWorkoutRecords(),
          resolvedDeps
        );
        const applied = applyEstimatedLoadsToInitialState(
          program,
          initialState,
          estimates
        );
        estimatedLoads = applied.estimatedLoads;
        profileStore.getState().setProgramState(canonicalId, applied.nextState);
      }

      const latestProfile = getProfileRecord();
      const programState =
        latestProfile.programs && typeof latestProfile.programs === 'object'
          ? ((latestProfile.programs as MutableRecord)[
              canonicalId
            ] as MutableRecord | null)
          : null;
      if (programState && typeof program.dateCatchUp === 'function') {
        const caughtState = program.dateCatchUp(programState);
        if (
          caughtState &&
          JSON.stringify(caughtState) !== JSON.stringify(programState)
        ) {
          profileStore.getState().setProgramState(canonicalId, caughtState);
        }
      }

      programStore.getState().syncFromLegacy();
      resolvedDeps.saveProfileData?.({
        docKeys: [PROFILE_DOCUMENT_KEYS.core, programDocKey(canonicalId)],
      });
      resolvedDeps.initSettings?.();
      resolvedDeps.updateDashboard?.();
      resolvedDeps.showToast?.(
        t('program.switched', 'Switched to {name}', { name: programName }),
        'var(--purple)'
      );
      if (estimatedLoads.length) {
        const changes = estimatedLoads
          .map((item) => `${item.lift} ${formatEstimatedWeight(item.value)} kg`)
          .join(', ');
        resolvedDeps.setTimeout?.(() => {
          resolvedDeps.showToast?.(
            t(
              'program.switch_estimated_loads',
              'Starting loads estimated from your recent training: {changes}. Adjust in Settings if needed.',
              { changes }
            ),
            'var(--blue)'
          );
        }, 500);
      }
      result = { switched: true, programId: canonicalId, estimatedLoads };
    }
  );

  return result;
}
