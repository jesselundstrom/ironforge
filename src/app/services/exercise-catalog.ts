import { workoutStore } from '../../stores/workout-store';
import type { ExerciseCatalogView } from '../constants';
import { useRuntimeStore } from '../store/runtime-store';
import { t } from './i18n';

type ExerciseDefinition = Record<string, unknown>;
type ExerciseCatalogIntent = 'add' | 'swap' | 'settings';

type ExerciseCatalogConfig = {
  intent?: ExerciseCatalogIntent;
  title?: string;
  titleParams?: Record<string, unknown> | null;
  subtitle?: string;
  subtitleParams?: Record<string, unknown> | null;
  callback?: (name: string) => void;
  onSubmit?: (name: string) => void;
  onSelect?: (exercise: ExerciseDefinition) => void;
  exercise?: ExerciseDefinition | null;
  exerciseIndex?: number;
  swapInfo?: Record<string, unknown> | unknown[];
  options?: unknown[];
  filters?: Record<string, unknown> | null;
  category?: string;
};

type ExerciseCatalogState = {
  mode: ExerciseCatalogIntent;
  search: string;
  movementTag: string;
  muscleGroup: string;
  equipmentTag: string;
  baseFilters: Record<string, unknown>;
  candidateIds: string[];
  titleKey: string;
  titleFallback: string;
  titleParams: Record<string, unknown> | null;
  subtitleKey: string;
  subtitleFallback: string;
  subtitleParams: Record<string, unknown> | null;
  onSelect: ((exercise: ExerciseDefinition) => void) | null;
  onSubmit: ((name: string) => void) | null;
};

type RuntimeWindow = Window & {
  activeWorkout?: Record<string, unknown> | null;
  closeNameModal?: () => void;
  getRegisteredExercise?: (input: unknown) => ExerciseDefinition | null;
  resolveRegisteredExerciseId?: (input: unknown) => string | null;
  getExerciseMetadata?: (
    input: unknown,
    locale?: string
  ) => ExerciseDefinition | null;
  getExerciseDisplayName?: (input: unknown, locale?: string) => string;
  listRegisteredExercises?: (options?: Record<string, unknown>) => ExerciseDefinition[];
  searchRegisteredExercises?: (
    query: string,
    filters?: Record<string, unknown>
  ) => ExerciseDefinition[];
  registerCustomExercise?: (
    definition: Record<string, unknown>
  ) => ExerciseDefinition | null;
  __IRONFORGE_LEGACY_RUNTIME_ACCESS__?: {
    read?: (name: string) => unknown;
  };
  openExerciseCatalogPicker?: (config?: ExerciseCatalogConfig) => boolean;
  openExerciseCatalogForAdd?: (
    title?: string,
    callback?: (name: string) => void
  ) => boolean;
  openExerciseCatalogForSwap?: (config?: ExerciseCatalogConfig) => boolean;
  openExerciseCatalogForSettings?: (config?: ExerciseCatalogConfig) => boolean;
  renderExerciseCatalog?: () => void;
  resetExerciseCatalogState?: () => void;
  submitExerciseCatalogSelection?: () => void;
  setExerciseCatalogSearch?: (value: string) => void;
  setExerciseCatalogFilter?: (group: string, value: string) => void;
  clearExerciseCatalogFilters?: () => void;
  selectExerciseCatalogExercise?: (exerciseId: string) => void;
};

const EXERCISE_CATALOG_FILTERS = {
  movement: [
    ['squat', 'catalog.filter.movement.squat', 'Squat'],
    ['hinge', 'catalog.filter.movement.hinge', 'Hinge'],
    ['horizontal_press', 'catalog.filter.movement.horizontal_press', 'Horizontal Press'],
    ['vertical_press', 'catalog.filter.movement.vertical_press', 'Vertical Press'],
    ['horizontal_pull', 'catalog.filter.movement.horizontal_pull', 'Horizontal Pull'],
    ['vertical_pull', 'catalog.filter.movement.vertical_pull', 'Vertical Pull'],
    ['single_leg', 'catalog.filter.movement.single_leg', 'Single-Leg'],
    ['core', 'catalog.filter.movement.core', 'Core'],
  ],
  muscle: [
    ['chest', 'dashboard.muscle_group.chest', 'Chest'],
    ['back', 'dashboard.muscle_group.back', 'Back'],
    ['shoulders', 'dashboard.muscle_group.shoulders', 'Shoulders'],
    ['biceps', 'dashboard.muscle_group.biceps', 'Biceps'],
    ['triceps', 'dashboard.muscle_group.triceps', 'Triceps'],
    ['quads', 'dashboard.muscle_group.quads', 'Quads'],
    ['hamstrings', 'dashboard.muscle_group.hamstrings', 'Hamstrings'],
    ['glutes', 'dashboard.muscle_group.glutes', 'Glutes'],
    ['core', 'dashboard.muscle_group.core', 'Core'],
  ],
  equipment: [
    ['barbell', 'catalog.filter.equipment.barbell', 'Barbell'],
    ['dumbbell', 'catalog.filter.equipment.dumbbell', 'Dumbbell'],
    ['machine', 'catalog.filter.equipment.machine', 'Machine'],
    ['cable', 'catalog.filter.equipment.cable', 'Cable'],
    ['bodyweight', 'catalog.filter.equipment.bodyweight', 'Bodyweight'],
    ['pullup_bar', 'catalog.filter.equipment.pullup_bar', 'Pull-up Bar'],
    ['band', 'catalog.filter.equipment.band', 'Band'],
    ['trap_bar', 'catalog.filter.equipment.trap_bar', 'Trap Bar'],
  ],
} as const;

let exerciseCatalogState: ExerciseCatalogState | null = null;

function getRuntimeWindow() {
  if (typeof window === 'undefined') return null;
  return window as RuntimeWindow;
}

function arrayify(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (value === undefined || value === null || value === '') return [];
  return [String(value)];
}

function uniqueList(items: unknown[]) {
  return Array.from(new Set(items.map(String).filter(Boolean)));
}

function readLegacyRuntimeValue<T>(name: string): T | undefined {
  return getRuntimeWindow()?.__IRONFORGE_LEGACY_RUNTIME_ACCESS__?.read?.(
    name
  ) as T | undefined;
}

function translateCatalogText(
  key: string,
  fallback: string,
  params?: Record<string, unknown> | null
) {
  return t(key, fallback, params || null);
}

function displayExerciseName(input: unknown) {
  return getRuntimeWindow()?.getExerciseDisplayName?.(input) || String(input || '');
}

function resolveExerciseId(input: unknown) {
  return getRuntimeWindow()?.resolveRegisteredExerciseId?.(input) || null;
}

function getWorkoutExercise(input: unknown) {
  if (!input) return null;
  return getRuntimeWindow()?.getRegisteredExercise?.(input) || null;
}

function getWorkoutExerciseMeta(input: unknown) {
  return getRuntimeWindow()?.getExerciseMetadata?.(input) || null;
}

function getWorkoutExerciseList(options: Record<string, unknown>) {
  return getRuntimeWindow()?.listRegisteredExercises?.(options) || [];
}

function searchWorkoutExercises(query: string, filters: Record<string, unknown>) {
  return getRuntimeWindow()?.searchRegisteredExercises?.(query, filters) || [];
}

function registerWorkoutExercise(definition: Record<string, unknown>) {
  return getRuntimeWindow()?.registerCustomExercise?.(definition) || null;
}

function mergeExerciseCatalogFilterGroup(
  baseValues: unknown,
  selectedValue: string
) {
  const base = arrayify(baseValues).filter(Boolean);
  if (!selectedValue) return base;
  if (!base.length) return [selectedValue];
  return base.includes(selectedValue) ? [selectedValue] : ['__no_match__'];
}

function getExerciseCatalogUserFilters() {
  return {
    movementTags: exerciseCatalogState?.movementTag
      ? [exerciseCatalogState.movementTag]
      : [],
    muscleGroups: exerciseCatalogState?.muscleGroup
      ? [exerciseCatalogState.muscleGroup]
      : [],
    equipmentTags: exerciseCatalogState?.equipmentTag
      ? [exerciseCatalogState.equipmentTag]
      : [],
  };
}

function getExerciseCatalogFilterPayload() {
  const base = exerciseCatalogState?.baseFilters || {};
  const ui = getExerciseCatalogUserFilters();
  return {
    categories: arrayify(base.categories),
    includeIds: arrayify(base.includeIds),
    excludeIds: arrayify(base.excludeIds),
    movementTags: mergeExerciseCatalogFilterGroup(
      base.movementTags,
      ui.movementTags[0] || ''
    ),
    muscleGroups: mergeExerciseCatalogFilterGroup(
      base.muscleGroups,
      ui.muscleGroups[0] || ''
    ),
    equipmentTags: mergeExerciseCatalogFilterGroup(
      base.equipmentTags,
      ui.equipmentTags[0] || ''
    ),
  };
}

function hasExerciseCatalogFilters() {
  return !!(
    exerciseCatalogState?.movementTag ||
    exerciseCatalogState?.muscleGroup ||
    exerciseCatalogState?.equipmentTag
  );
}

function isExerciseCatalogSwapMode() {
  return (
    exerciseCatalogState?.mode === 'swap' ||
    exerciseCatalogState?.mode === 'settings'
  );
}

function mergeExerciseCatalogLists(
  primary: ExerciseDefinition[],
  extra: ExerciseDefinition[]
) {
  const seen = new Set<string>();
  return [...(primary || []), ...(extra || [])].filter((exercise) => {
    const id = String(exercise?.id || '');
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function getExerciseCatalogCandidateExercises(filters: Record<string, unknown>) {
  const candidateIds = arrayify(exerciseCatalogState?.candidateIds);
  if (!candidateIds.length) return [];
  return getWorkoutExerciseList({
    sort: 'featured',
    filters: {
      ...filters,
      includeIds: candidateIds,
      excludeIds: arrayify(exerciseCatalogState?.baseFilters?.excludeIds),
    },
  });
}

function getExerciseCatalogRecent(limit: number) {
  const workouts =
    readLegacyRuntimeValue<Array<Record<string, unknown>>>('workouts') || [];
  const ids: string[] = [];
  const seen = new Set<string>();
  workouts
    .slice()
    .sort(
      (a, b) =>
        new Date(String(b.date || '')).getTime() -
        new Date(String(a.date || '')).getTime()
    )
    .forEach((workout) => {
      const exercises = Array.isArray(workout?.exercises)
        ? workout.exercises
        : [];
      exercises.forEach((exercise) => {
        const ex = exercise as Record<string, unknown>;
        const resolved = resolveExerciseId(ex.exerciseId || ex.name);
        if (!resolved || seen.has(resolved)) return;
        seen.add(resolved);
        ids.push(resolved);
      });
    });
  return ids
    .slice(0, limit)
    .map((id) => getWorkoutExercise(id))
    .filter(Boolean) as ExerciseDefinition[];
}

function getExerciseCatalogFeatured(
  limit: number,
  filters: Record<string, unknown>
) {
  return getWorkoutExerciseList({
    sort: 'featured',
    filters: { ...filters, featuredOnly: true },
  }).slice(0, limit);
}

function getExerciseCatalogAll(filters: Record<string, unknown>) {
  return getWorkoutExerciseList({ sort: 'name', filters });
}

function getExerciseCatalogResults() {
  const search = exerciseCatalogState?.search || '';
  const filters = getExerciseCatalogFilterPayload();
  const userFilters = getExerciseCatalogUserFilters();
  if (search) {
    const baseResults = searchWorkoutExercises(search, {
      ...filters,
      limit: 120,
    });
    const candidateResults = getExerciseCatalogCandidateExercises({
      ...userFilters,
      limit: 120,
    });
    const searchedCandidates = searchWorkoutExercises(search, {
      ...userFilters,
      includeIds: candidateResults.map((exercise) => exercise.id),
      excludeIds: arrayify(exerciseCatalogState?.baseFilters?.excludeIds),
      limit: 120,
    });
    return mergeExerciseCatalogLists(baseResults, searchedCandidates).slice(
      0,
      120
    );
  }
  return mergeExerciseCatalogLists(
    getExerciseCatalogAll(filters),
    getExerciseCatalogCandidateExercises(userFilters)
  );
}

function getExerciseCatalogMetaLine(exercise: ExerciseDefinition) {
  const parts: string[] = [];
  const firstMovement = arrayify(exercise?.movementTags)[0];
  const firstMuscle = arrayify(exercise?.displayMuscleGroups)[0];
  const firstEquipment = arrayify(exercise?.equipmentTags)[0];
  if (firstMovement) {
    parts.push(
      translateCatalogText(
        `catalog.filter.movement.${firstMovement}`,
        firstMovement
      )
    );
  }
  if (firstMuscle) {
    parts.push(
      translateCatalogText(`dashboard.muscle_group.${firstMuscle}`, firstMuscle)
    );
  }
  if (firstEquipment) {
    parts.push(
      translateCatalogText(
        `catalog.filter.equipment.${firstEquipment}`,
        firstEquipment
      )
    );
  }
  return parts.join(' · ');
}

function buildExerciseCatalogFilterGroups() {
  const groups = [
    {
      id: 'movement',
      labelKey: 'catalog.filter_group.movement',
      fallback: 'Movement',
      active: exerciseCatalogState?.movementTag || '',
      options: EXERCISE_CATALOG_FILTERS.movement,
    },
    {
      id: 'muscle',
      labelKey: 'catalog.filter_group.muscle',
      fallback: 'Muscle',
      active: exerciseCatalogState?.muscleGroup || '',
      options: EXERCISE_CATALOG_FILTERS.muscle,
    },
    {
      id: 'equipment',
      labelKey: 'catalog.filter_group.equipment',
      fallback: 'Equipment',
      active: exerciseCatalogState?.equipmentTag || '',
      options: EXERCISE_CATALOG_FILTERS.equipment,
    },
  ];
  return groups.map((group) => ({
    id: group.id,
    label: translateCatalogText(group.labelKey, group.fallback),
    activeValue: group.active,
    options: [
      {
        value: '',
        label: translateCatalogText('catalog.filter.all', 'All'),
      },
      ...group.options.map(([value, labelKey, fallback]) => ({
        value,
        label: translateCatalogText(labelKey, fallback),
      })),
    ],
  }));
}

function toExerciseCatalogItems(items: ExerciseDefinition[]) {
  return items.map((exercise) => ({
    id: String(exercise.id || ''),
    name: displayExerciseName(exercise.name),
    meta: getExerciseCatalogMetaLine(exercise),
  }));
}

function buildExerciseCatalogView(): ExerciseCatalogView {
  if (!exerciseCatalogState) {
    return {
      open: false,
      mode: 'add',
      title: '',
      subtitle: '',
      search: '',
      clearVisible: false,
      emptyVisible: false,
      emptyCopy: translateCatalogText(
        'catalog.empty',
        'No exercises matched your filters.'
      ),
      filters: [],
      sections: [],
    };
  }

  const title = translateCatalogText(
    exerciseCatalogState.titleKey,
    exerciseCatalogState.titleFallback,
    exerciseCatalogState.titleParams
  );
  const subtitle = translateCatalogText(
    exerciseCatalogState.subtitleKey,
    exerciseCatalogState.subtitleFallback,
    exerciseCatalogState.subtitleParams
  );
  const search = exerciseCatalogState.search || '';
  const filters = buildExerciseCatalogFilterGroups();
  const clearVisible = !!(search || hasExerciseCatalogFilters());
  const emptyCopy = translateCatalogText(
    'catalog.empty',
    'No exercises matched your filters.'
  );
  const payloadFilters = getExerciseCatalogFilterPayload();
  const userFilters = getExerciseCatalogUserFilters();
  let sections: ExerciseCatalogView['sections'] = [];
  let emptyVisible = false;

  if (search || hasExerciseCatalogFilters()) {
    const results = search
      ? getExerciseCatalogResults()
      : mergeExerciseCatalogLists(
          getExerciseCatalogAll(payloadFilters),
          getExerciseCatalogCandidateExercises(userFilters)
        );
    sections = results.length
      ? [
          {
            id: 'results',
            title: translateCatalogText('catalog.section.results', 'Results'),
            items: toExerciseCatalogItems(results),
          },
        ]
      : [];
    emptyVisible = !results.length;
  } else if (isExerciseCatalogSwapMode()) {
    const results = getExerciseCatalogResults();
    sections = results.length
      ? [
          {
            id: 'swap',
            title: translateCatalogText(
              'catalog.section.swap',
              'Available options'
            ),
            items: toExerciseCatalogItems(results),
          },
        ]
      : [];
    emptyVisible = !results.length;
  } else {
    const recent = getExerciseCatalogRecent(8);
    const featured = getExerciseCatalogFeatured(10, {});
    const all = getExerciseCatalogAll({});
    sections = [
      {
        id: 'recent',
        title: translateCatalogText('catalog.section.recent', 'Recently used'),
        items: toExerciseCatalogItems(recent),
        emptyCopy: translateCatalogText(
          'catalog.section.recent_empty',
          'Log a few workouts and your recent exercises will show up here.'
        ),
      },
      {
        id: 'featured',
        title: translateCatalogText('catalog.section.featured', 'Popular basics'),
        items: toExerciseCatalogItems(featured),
      },
      {
        id: 'all',
        title: translateCatalogText('catalog.section.all', 'All exercises'),
        items: toExerciseCatalogItems(all),
      },
    ];
  }

  return {
    open: true,
    mode: exerciseCatalogState.mode || 'add',
    title,
    subtitle,
    search,
    clearVisible,
    emptyVisible,
    emptyCopy,
    filters,
    sections,
  };
}

function pushExerciseCatalogView() {
  useRuntimeStore.getState().setExerciseCatalogView(buildExerciseCatalogView());
}

function resolveExerciseSelection(input: unknown) {
  const raw =
    input && typeof input === 'object'
      ? (input as Record<string, unknown>).name ||
        (input as Record<string, unknown>).exerciseId ||
        ''
      : input;
  const resolved = getWorkoutExercise(input) || getWorkoutExercise(resolveExerciseId(raw));
  return {
    exerciseId: String(resolved?.id || resolveExerciseId(raw) || '').trim(),
    name: String(resolved?.name || raw || '').trim(),
  };
}

function inferExerciseCatalogSwapFilters(
  exercise: ExerciseDefinition | null | undefined,
  category: unknown
) {
  const meta = getWorkoutExerciseMeta(
    exercise?.exerciseId || exercise?.name || exercise
  );
  const categoryFilters: Record<string, Record<string, string[]>> = {
    squat: {
      movementTags: ['squat'],
      equipmentTags: ['barbell', 'dumbbell', 'machine', 'bodyweight'],
      muscleGroups: ['quads', 'glutes'],
    },
    bench: {
      movementTags: ['horizontal_press'],
      equipmentTags: ['barbell', 'dumbbell', 'machine', 'bodyweight'],
      muscleGroups: ['chest', 'triceps', 'shoulders'],
    },
    deadlift: {
      movementTags: ['hinge'],
      equipmentTags: ['barbell', 'trap_bar', 'dumbbell', 'machine', 'bodyweight'],
      muscleGroups: ['hamstrings', 'glutes', 'back'],
    },
    ohp: {
      movementTags: ['vertical_press'],
      equipmentTags: ['barbell', 'dumbbell', 'machine', 'bodyweight'],
      muscleGroups: ['shoulders', 'triceps'],
    },
    back: {
      movementTags: ['horizontal_pull', 'vertical_pull'],
      equipmentTags: [
        'barbell',
        'dumbbell',
        'cable',
        'machine',
        'pullup_bar',
        'bodyweight',
      ],
      muscleGroups: ['back', 'biceps'],
    },
    core: {
      movementTags: ['core'],
      equipmentTags: ['bodyweight', 'cable', 'band', 'pullup_bar'],
      muscleGroups: ['core'],
    },
    pressing: {
      movementTags: ['horizontal_press', 'vertical_press'],
      equipmentTags: ['barbell', 'dumbbell', 'machine', 'bodyweight', 'cable'],
      muscleGroups: ['chest', 'shoulders', 'triceps'],
    },
    triceps: {
      movementTags: ['isolation', 'horizontal_press', 'vertical_press'],
      equipmentTags: ['bodyweight', 'cable', 'dumbbell', 'barbell'],
      muscleGroups: ['triceps'],
    },
    'single-leg': {
      movementTags: ['single_leg', 'squat'],
      equipmentTags: ['dumbbell', 'bodyweight', 'machine'],
      muscleGroups: ['quads', 'glutes'],
    },
    'upper back': {
      movementTags: ['horizontal_pull'],
      equipmentTags: ['barbell', 'dumbbell', 'cable', 'machine'],
      muscleGroups: ['back', 'biceps'],
    },
    'posterior chain': {
      movementTags: ['hinge'],
      equipmentTags: ['barbell', 'machine', 'bodyweight'],
      muscleGroups: ['hamstrings', 'glutes', 'back'],
    },
    'vertical pull': {
      movementTags: ['vertical_pull'],
      equipmentTags: ['pullup_bar', 'bodyweight', 'cable', 'machine'],
      muscleGroups: ['back', 'biceps'],
    },
  };
  const categoryKey = String(category || '');
  if (categoryFilters[categoryKey]) return categoryFilters[categoryKey];
  return {
    movementTags: arrayify(meta?.movementTags).slice(0, 2),
    equipmentTags: arrayify(meta?.equipmentTags).slice(0, 3),
    muscleGroups: arrayify(meta?.displayMuscleGroups).slice(0, 2),
  };
}

function getResolvedCatalogOptionExercises(options: unknown) {
  const seen = new Set<string>();
  return arrayify(options)
    .map((option) => {
      const resolved =
        getWorkoutExercise(option) ||
        getWorkoutExercise(resolveExerciseId(option)) ||
        registerWorkoutExercise({ name: option });
      const id = String(resolved?.id || '');
      if (!resolved || !id || seen.has(id)) return null;
      seen.add(id);
      return resolved;
    })
    .filter(Boolean) as ExerciseDefinition[];
}

function getConfigExercise(config: ExerciseCatalogConfig) {
  if (config.exercise) return config.exercise;
  const activeWorkout =
    getRuntimeWindow()?.activeWorkout ||
    readLegacyRuntimeValue<Record<string, unknown> | null>('activeWorkout') ||
    null;
  const exercises = Array.isArray(activeWorkout?.exercises)
    ? (activeWorkout.exercises as ExerciseDefinition[])
    : [];
  return exercises[Number(config.exerciseIndex)] || null;
}

export function openExerciseCatalogPicker(config: ExerciseCatalogConfig = {}) {
  const next = config || {};
  const intent = next.intent || 'add';
  if (intent === 'add') {
    exerciseCatalogState = {
      mode: 'add',
      search: '',
      movementTag: '',
      muscleGroup: '',
      equipmentTag: '',
      baseFilters: {},
      candidateIds: [],
      titleKey: 'catalog.title.add',
      titleFallback: next.title || 'Add Exercise',
      titleParams: next.titleParams || null,
      subtitleKey: 'catalog.sub',
      subtitleFallback:
        next.subtitle || 'Pick an exercise from the library or search by name.',
      subtitleParams: next.subtitleParams || null,
      onSelect: null,
      onSubmit:
        next.onSubmit ||
        next.callback ||
        ((name: string) => workoutStore.getState().addExerciseByName(name)),
    };
    pushExerciseCatalogView();
    window.setTimeout(() => document.getElementById('name-modal-input')?.focus(), 80);
    return true;
  }

  const exercise = getConfigExercise(next);
  if (!exercise) return false;
  const info = Array.isArray(next.swapInfo)
    ? { options: next.swapInfo }
    : ((next.swapInfo || {}) as Record<string, unknown>);
  const current = resolveExerciseSelection(exercise);
  const fallbackOptions = getResolvedCatalogOptionExercises(
    next.options || info.options || []
  );
  const configuredFilters = next.filters || (info.filters as Record<string, unknown>) || null;
  const baseFilters = {
    ...(configuredFilters ||
      inferExerciseCatalogSwapFilters(exercise, info.category || next.category || '')),
  };
  const excludeIds = arrayify(info.excludeIds);
  if (intent === 'swap' && current.exerciseId) excludeIds.push(current.exerciseId);
  baseFilters.excludeIds = uniqueList(excludeIds);
  const candidateIds = uniqueList([
    ...arrayify(info.includeIds),
    ...fallbackOptions.map((item) => item.id),
  ]);
  const defaultSubtitle =
    intent === 'settings'
      ? 'Choose the exercise variant this program should use.'
      : 'Showing options limited by the current exercise and program rules.';

  exerciseCatalogState = {
    mode: intent,
    search: '',
    movementTag: '',
    muscleGroup: '',
    equipmentTag: '',
    baseFilters,
    candidateIds,
    titleKey:
      intent === 'settings' ? 'catalog.title.settings' : 'catalog.title.swap',
    titleFallback:
      next.title ||
      (intent === 'settings' ? 'Choose Exercise' : 'Swap Exercise'),
    titleParams: next.titleParams || null,
    subtitleKey:
      intent === 'settings' ? 'catalog.sub.settings' : 'catalog.sub.swap',
    subtitleFallback: next.subtitle || defaultSubtitle,
    subtitleParams:
      next.subtitleParams ||
      (intent === 'swap' ? { name: displayExerciseName(current.name) } : null),
    onSelect: next.onSelect || null,
    onSubmit: null,
  };
  pushExerciseCatalogView();
  window.setTimeout(() => document.getElementById('name-modal-input')?.focus(), 80);
  return true;
}

export function openExerciseCatalogForAdd(
  title?: string,
  callback?: (name: string) => void
) {
  return openExerciseCatalogPicker({ intent: 'add', title, callback });
}

export function openExerciseCatalogForSwap(config: ExerciseCatalogConfig = {}) {
  return openExerciseCatalogPicker({ ...config, intent: 'swap' });
}

export function openExerciseCatalogForSettings(
  config: ExerciseCatalogConfig = {}
) {
  return openExerciseCatalogPicker({ ...config, intent: 'settings' });
}

export function renderExerciseCatalog() {
  pushExerciseCatalogView();
}

export function setExerciseCatalogFilter(group: string, value: string) {
  if (!exerciseCatalogState) return;
  if (group === 'movement') exerciseCatalogState.movementTag = value || '';
  if (group === 'muscle') exerciseCatalogState.muscleGroup = value || '';
  if (group === 'equipment') exerciseCatalogState.equipmentTag = value || '';
  pushExerciseCatalogView();
}

export function setExerciseCatalogSearch(value: string) {
  if (!exerciseCatalogState) return;
  exerciseCatalogState.search = value || '';
  pushExerciseCatalogView();
}

export function clearExerciseCatalogFilters() {
  if (!exerciseCatalogState) return;
  exerciseCatalogState.search = '';
  exerciseCatalogState.movementTag = '';
  exerciseCatalogState.muscleGroup = '';
  exerciseCatalogState.equipmentTag = '';
  pushExerciseCatalogView();
  document.getElementById('name-modal-input')?.focus();
}

export function resetExerciseCatalogState() {
  exerciseCatalogState = null;
  pushExerciseCatalogView();
}

export function closeExerciseCatalog() {
  const closeNameModal = getRuntimeWindow()?.closeNameModal;
  if (typeof closeNameModal === 'function') {
    closeNameModal();
    return;
  }
  resetExerciseCatalogState();
}

export function selectExerciseCatalogExercise(exerciseId: string) {
  const exercise = getWorkoutExercise(exerciseId);
  if (!exercise || !exerciseCatalogState) return;
  const onSelect = exerciseCatalogState.onSelect;
  const onSubmit = exerciseCatalogState.onSubmit;
  resetExerciseCatalogState();
  if (onSelect) {
    onSelect(exercise);
  } else {
    onSubmit?.(String(exercise.name || ''));
  }
  getRuntimeWindow()?.closeNameModal?.();
}

export function submitExerciseCatalogSelection() {
  const first = getExerciseCatalogResults()[0];
  if (first) selectExerciseCatalogExercise(String(first.id || ''));
}

export function installExerciseCatalogBridge() {
  const runtimeWindow = getRuntimeWindow();
  if (!runtimeWindow) return;
  runtimeWindow.openExerciseCatalogPicker = openExerciseCatalogPicker;
  runtimeWindow.openExerciseCatalogForAdd = openExerciseCatalogForAdd;
  runtimeWindow.openExerciseCatalogForSwap = openExerciseCatalogForSwap;
  runtimeWindow.openExerciseCatalogForSettings = openExerciseCatalogForSettings;
  runtimeWindow.renderExerciseCatalog = renderExerciseCatalog;
  runtimeWindow.resetExerciseCatalogState = resetExerciseCatalogState;
  runtimeWindow.submitExerciseCatalogSelection = submitExerciseCatalogSelection;
  runtimeWindow.setExerciseCatalogSearch = setExerciseCatalogSearch;
  runtimeWindow.setExerciseCatalogFilter = setExerciseCatalogFilter;
  runtimeWindow.clearExerciseCatalogFilters = clearExerciseCatalogFilters;
  runtimeWindow.selectExerciseCatalogExercise = selectExerciseCatalogExercise;
}
