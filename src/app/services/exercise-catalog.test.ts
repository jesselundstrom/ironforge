import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRuntimeStore } from '../store/runtime-store';
import {
  clearExerciseCatalogFilters,
  installExerciseCatalogBridge,
  openExerciseCatalogForAdd,
  openExerciseCatalogForSwap,
  selectExerciseCatalogExercise,
  setExerciseCatalogFilter,
  setExerciseCatalogSearch,
} from './exercise-catalog';

type TestExercise = {
  id: string;
  name: string;
  movementTags?: string[];
  displayMuscleGroups?: string[];
  equipmentTags?: string[];
  featured?: boolean;
};

type TestWindow = Record<string, unknown> & {
  closeNameModal?: ReturnType<typeof vi.fn>;
  getRegisteredExercise?: (input: unknown) => TestExercise | null;
  resolveRegisteredExerciseId?: (input: unknown) => string | null;
  getExerciseMetadata?: (input: unknown) => TestExercise | null;
  getExerciseDisplayName?: (input: unknown) => string;
  listRegisteredExercises?: (options?: Record<string, unknown>) => TestExercise[];
  searchRegisteredExercises?: (
    query: string,
    filters?: Record<string, unknown>
  ) => TestExercise[];
  registerCustomExercise?: (definition: Record<string, unknown>) => TestExercise;
  __IRONFORGE_LEGACY_RUNTIME_ACCESS__?: {
    read?: (name: string) => unknown;
  };
  openExerciseCatalogForAdd?: typeof openExerciseCatalogForAdd;
  setExerciseCatalogSearch?: typeof setExerciseCatalogSearch;
  selectExerciseCatalogExercise?: typeof selectExerciseCatalogExercise;
};

const exercises: TestExercise[] = [
  {
    id: 'bench_press',
    name: 'Bench Press',
    movementTags: ['horizontal_press'],
    displayMuscleGroups: ['chest'],
    equipmentTags: ['barbell'],
    featured: true,
  },
  {
    id: 'incline_press',
    name: 'Incline Press',
    movementTags: ['horizontal_press'],
    displayMuscleGroups: ['chest'],
    equipmentTags: ['dumbbell'],
    featured: true,
  },
  {
    id: 'dumbbell_row',
    name: 'Dumbbell Row',
    movementTags: ['horizontal_pull'],
    displayMuscleGroups: ['back'],
    equipmentTags: ['dumbbell'],
  },
];

function slug(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function getExercise(input: unknown) {
  const key =
    input && typeof input === 'object'
      ? String((input as Record<string, unknown>).id || (input as Record<string, unknown>).exerciseId || (input as Record<string, unknown>).name)
      : String(input || '');
  const normalized = slug(key);
  return (
    exercises.find(
      (exercise) => exercise.id === normalized || slug(exercise.name) === normalized
    ) || null
  );
}

function arrayify(value: unknown) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (value === undefined || value === null || value === '') return [];
  return [String(value)];
}

function filterExercises(options: Record<string, unknown> = {}) {
  const filters = (options.filters || {}) as Record<string, unknown>;
  const includeIds = arrayify(filters.includeIds);
  const excludeIds = new Set(arrayify(filters.excludeIds));
  const movementTags = arrayify(filters.movementTags);
  const equipmentTags = arrayify(filters.equipmentTags);
  const muscleGroups = arrayify(filters.muscleGroups);
  return exercises.filter((exercise) => {
    if (includeIds.length && !includeIds.includes(exercise.id)) return false;
    if (excludeIds.has(exercise.id)) return false;
    if (filters.featuredOnly === true && exercise.featured !== true) return false;
    if (
      movementTags.length &&
      !movementTags.some((tag) => exercise.movementTags?.includes(tag))
    ) {
      return false;
    }
    if (
      equipmentTags.length &&
      !equipmentTags.some((tag) => exercise.equipmentTags?.includes(tag))
    ) {
      return false;
    }
    if (
      muscleGroups.length &&
      !muscleGroups.some((group) => exercise.displayMuscleGroups?.includes(group))
    ) {
      return false;
    }
    return true;
  });
}

function installTestWindow() {
  const testWindow = {
    setTimeout,
    closeNameModal: vi.fn(),
    getRegisteredExercise: getExercise,
    resolveRegisteredExerciseId: (input: unknown) => getExercise(input)?.id || null,
    getExerciseMetadata: getExercise,
    getExerciseDisplayName: (input: unknown) => getExercise(input)?.name || String(input || ''),
    listRegisteredExercises: filterExercises,
    searchRegisteredExercises: (query: string, filters?: Record<string, unknown>) =>
      filterExercises({ filters }).filter((exercise) =>
        exercise.name.toLowerCase().includes(query.toLowerCase())
      ),
    registerCustomExercise: (definition: Record<string, unknown>) => ({
      id: slug(definition.name),
      name: String(definition.name || ''),
    }),
    __IRONFORGE_LEGACY_RUNTIME_ACCESS__: {
      read: (name: string) =>
        name === 'workouts'
          ? [
              {
                date: '2026-04-29',
                exercises: [{ name: 'Dumbbell Row' }],
              },
            ]
          : undefined,
    },
  } satisfies TestWindow;
  (globalThis as Record<string, unknown>).window = testWindow;
  (globalThis as Record<string, unknown>).document = {
    getElementById: vi.fn(() => ({ focus: vi.fn() })),
  };
  return testWindow;
}

function currentView() {
  return useRuntimeStore.getState().exerciseCatalog.view;
}

describe('exercise catalog typed service', () => {
  beforeEach(() => {
    installTestWindow();
    useRuntimeStore.getState().setExerciseCatalogView(null);
  });

  afterEach(() => {
    clearExerciseCatalogFilters();
    useRuntimeStore.getState().setExerciseCatalogView(null);
    Reflect.deleteProperty(globalThis as Record<string, unknown>, 'window');
    Reflect.deleteProperty(globalThis as Record<string, unknown>, 'document');
    vi.restoreAllMocks();
  });

  it('installs compatibility globals for legacy callers', () => {
    const runtimeWindow = window as unknown as TestWindow;

    installExerciseCatalogBridge();

    expect(runtimeWindow.openExerciseCatalogForAdd).toBe(openExerciseCatalogForAdd);
    expect(runtimeWindow.setExerciseCatalogSearch).toBe(setExerciseCatalogSearch);
    expect(runtimeWindow.selectExerciseCatalogExercise).toBe(
      selectExerciseCatalogExercise
    );
  });

  it('owns add catalog search and selection state', () => {
    const callback = vi.fn();

    openExerciseCatalogForAdd('Add Lift', callback);

    expect(currentView()?.open).toBe(true);
    expect(currentView()?.title).toBe('Add Lift');
    expect(currentView()?.sections.map((section) => section.id)).toEqual([
      'recent',
      'featured',
      'all',
    ]);

    setExerciseCatalogSearch('row');

    expect(currentView()?.search).toBe('row');
    expect(currentView()?.sections[0]?.id).toBe('results');
    expect(currentView()?.sections[0]?.items).toEqual([
      expect.objectContaining({ id: 'dumbbell_row', name: 'Dumbbell Row' }),
    ]);

    selectExerciseCatalogExercise('dumbbell_row');

    expect(callback).toHaveBeenCalledWith('Dumbbell Row');
    expect(currentView()?.open).toBe(false);
  });

  it('applies swap filters and returns selected exercise objects', () => {
    const onSelect = vi.fn();

    openExerciseCatalogForSwap({
      exercise: { exerciseId: 'bench_press', name: 'Bench Press' },
      swapInfo: { category: 'bench', options: ['Incline Press'] },
      onSelect,
    });

    expect(currentView()?.mode).toBe('swap');
    expect(currentView()?.sections[0]?.items).toEqual([
      expect.objectContaining({ id: 'incline_press', name: 'Incline Press' }),
    ]);

    setExerciseCatalogFilter('equipment', 'dumbbell');
    expect(currentView()?.sections[0]?.items).toEqual([
      expect.objectContaining({ id: 'incline_press' }),
    ]);

    selectExerciseCatalogExercise('incline_press');

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'incline_press', name: 'Incline Press' })
    );
    expect(currentView()?.open).toBe(false);
  });
});
