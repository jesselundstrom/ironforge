import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';
import type { ProgramPlugin } from '../domain/program-plugin';
import type { Profile } from '../domain/types';
import { typedProgramRegistry } from '../programs';
import { dataStore } from './data-store';
import { profileStore } from './profile-store';

type AnyProgramPlugin = ProgramPlugin<any>;
type ProgramRegistry = Record<string, AnyProgramPlugin>;

type ProgramCapabilities = Record<string, unknown> & {
  difficulty?: string;
  frequencyRange?: { min: number; max: number };
  recommendationScore?: (
    days: number,
    preferences?: Record<string, unknown>
  ) => number;
};

type ProgramDifficultyMeta = {
  key: string;
  labelKey: string;
  fallback: string;
};

type ProgramStoreState = {
  registry: ProgramRegistry;
  programs: AnyProgramPlugin[];
  activeProgramId: string | null;
  activeProgram: AnyProgramPlugin | null;
  activeProgramState: Record<string, unknown> | null;
  refreshSnapshot: () => ProgramStoreSnapshot;
  getProgramById: (programId?: string | null) => AnyProgramPlugin | null;
  getProgramInitialState: (programId?: string | null) => Record<string, unknown> | null;
  getProgramCapabilities: (programId?: string | null) => ProgramCapabilities;
  getProgramDifficultyMeta: (programId?: string | null) => ProgramDifficultyMeta;
  getProgramTrainingDaysRange: (
    programId?: string | null
  ) => { min: number; max: number };
  getEffectiveProgramFrequency: (
    programId?: string | null,
    profileLike?: Profile | Record<string, unknown> | null
  ) => number;
};

type ProgramStoreSnapshot = Omit<
  ProgramStoreState,
  | 'refreshSnapshot'
  | 'getProgramById'
  | 'getProgramInitialState'
  | 'getProgramCapabilities'
  | 'getProgramDifficultyMeta'
  | 'getProgramTrainingDaysRange'
  | 'getEffectiveProgramFrequency'
>;

const DEFAULT_RANGE = { min: 2, max: 6 };
const DEFAULT_DIFFICULTY: ProgramDifficultyMeta = {
  key: 'intermediate',
  labelKey: 'program.difficulty.intermediate',
  fallback: 'Intermediate',
};
const PROGRAM_ID_ALIASES: Record<string, string> = {
  w531: 'wendler531',
};

let storeInstalled = false;
let unsubscribeProfileStore: (() => void) | null = null;
let unsubscribeDataStore: (() => void) | null = null;
let programStoreRef: StoreApi<ProgramStoreState> | null = null;

function cloneJson<T>(value: T): T {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

function getTypedRegistry() {
  return {
    ...(typedProgramRegistry as unknown as ProgramRegistry),
  };
}

function getCanonicalProgramId(programId?: string | null) {
  const raw = String(programId || '').trim();
  if (!raw) return null;
  const normalized = raw.toLowerCase();
  if (normalized in typedProgramRegistry) return normalized;
  return PROGRAM_ID_ALIASES[normalized] || raw;
}

function getProfileRecord(
  profileLike?: Profile | Record<string, unknown> | null
): Record<string, unknown> {
  return (profileLike && typeof profileLike === 'object'
    ? (profileLike as Record<string, unknown>)
    : {}) as Record<string, unknown>;
}

function getRequestedTrainingDays(
  profileLike?: Profile | Record<string, unknown> | null
) {
  const record = getProfileRecord(profileLike);
  const preferences =
    record.preferences && typeof record.preferences === 'object'
      ? (record.preferences as Record<string, unknown>)
      : {};
  return Number(preferences.trainingDaysPerWeek) || 3;
}

function getActiveProgramPreference(
  profileLike?: Profile | Record<string, unknown> | null
) {
  const record = getProfileRecord(profileLike);
  return String(record.activeProgram || '').trim() || null;
}

function getStoredProgramState(
  profileLike: Profile | Record<string, unknown> | null | undefined,
  programId: string | null
) {
  if (!programId) return null;
  const record = getProfileRecord(profileLike);
  const programs =
    record.programs && typeof record.programs === 'object'
      ? (record.programs as Record<string, unknown>)
      : {};
  const state = programs[programId];
  return state && typeof state === 'object'
    ? cloneJson(state as Record<string, unknown>)
    : null;
}

function getProfileLike() {
  return (
    profileStore.getState().profile ||
    (dataStore.getState().profile as Profile | Record<string, unknown> | null) ||
    null
  );
}

function getProgramsFromRegistry(registry: ProgramRegistry) {
  return Object.values(registry || {}).filter(Boolean);
}

function getProgramByIdFromRegistry(
  registry: ProgramRegistry,
  programId?: string | null
) {
  const canonicalId = getCanonicalProgramId(programId);
  if (!canonicalId) return null;
  return registry?.[canonicalId] || null;
}

function getProgramInitialStateFromRegistry(
  registry: ProgramRegistry,
  programId?: string | null
) {
  const program = getProgramByIdFromRegistry(registry, programId);
  if (typeof program?.getInitialState !== 'function') return null;
  return cloneJson(program.getInitialState() || null);
}

function getProgramCapabilitiesFromRegistry(
  registry: ProgramRegistry,
  programId?: string | null
) {
  const program = getProgramByIdFromRegistry(registry, programId);
  const capabilities =
    ((typeof program?.getCapabilities === 'function'
      ? program.getCapabilities()
      : null) || {}) as ProgramCapabilities;
  if (!capabilities.frequencyRange && typeof program?.getTrainingDaysRange === 'function') {
    capabilities.frequencyRange = cloneJson(program.getTrainingDaysRange());
  }
  if (typeof capabilities.recommendationScore !== 'function') {
    capabilities.recommendationScore = () => 0;
  }
  return capabilities;
}

function getProgramTrainingDaysRangeFromRegistry(
  registry: ProgramRegistry,
  programId?: string | null
) {
  const capabilities = getProgramCapabilitiesFromRegistry(registry, programId);
  const range = capabilities.frequencyRange || DEFAULT_RANGE;
  return {
    min: Number(range.min) || DEFAULT_RANGE.min,
    max: Number(range.max) || DEFAULT_RANGE.max,
  };
}

function getProgramDifficultyMetaFromRegistry(
  registry: ProgramRegistry,
  programId?: string | null
) {
  const difficulty =
    String(getProgramCapabilitiesFromRegistry(registry, programId).difficulty || '').trim() ||
    DEFAULT_DIFFICULTY.key;
  return {
    key: difficulty,
    labelKey: `program.difficulty.${difficulty}`,
    fallback:
      difficulty === 'beginner'
        ? 'Beginner'
        : difficulty === 'advanced'
          ? 'Advanced'
          : DEFAULT_DIFFICULTY.fallback,
  };
}

function getEffectiveProgramFrequencyFromRegistry(
  registry: ProgramRegistry,
  programId?: string | null,
  profileLike?: Profile | Record<string, unknown> | null
) {
  const requested = getRequestedTrainingDays(profileLike);
  const range = getProgramTrainingDaysRangeFromRegistry(registry, programId);
  return Math.max(range.min, Math.min(range.max, requested));
}

function resolveActiveProgramId(
  registry: ProgramRegistry,
  profileLike?: Profile | Record<string, unknown> | null
) {
  const preferredId = getCanonicalProgramId(
    getActiveProgramPreference(profileLike) || 'forge'
  );
  if (preferredId && registry?.[preferredId]) return preferredId;
  if (preferredId === 'forge') return preferredId;
  return Object.keys(registry || {})[0] || preferredId || null;
}

function readProgramSnapshot(): ProgramStoreSnapshot {
  const registry = getTypedRegistry();
  const profileLike = getProfileLike();
  const activeProgramId = resolveActiveProgramId(registry, profileLike);
  const activeProgram = getProgramByIdFromRegistry(registry, activeProgramId);
  const rawState =
    getStoredProgramState(profileLike, activeProgramId) ||
    getProgramInitialStateFromRegistry(registry, activeProgramId) ||
    null;

  return {
    registry,
    programs: getProgramsFromRegistry(registry),
    activeProgramId,
    activeProgram,
    activeProgramState: rawState,
  };
}

function refreshStoreSnapshot() {
  const snapshot = readProgramSnapshot();
  programStoreRef?.setState((state) => ({
    ...state,
    ...snapshot,
  }));
  return snapshot;
}

export const programStore: StoreApi<ProgramStoreState> =
  createStore<ProgramStoreState>(() => ({
    ...readProgramSnapshot(),
    refreshSnapshot: () => refreshStoreSnapshot(),
    getProgramById: (programId) => {
      const registry = (programStoreRef?.getState().registry ||
        getTypedRegistry()) as ProgramRegistry;
      return getProgramByIdFromRegistry(registry, programId);
    },
    getProgramInitialState: (programId) => {
      const registry = (programStoreRef?.getState().registry ||
        getTypedRegistry()) as ProgramRegistry;
      return getProgramInitialStateFromRegistry(registry, programId);
    },
    getProgramCapabilities: (programId) => {
      const registry = (programStoreRef?.getState().registry ||
        getTypedRegistry()) as ProgramRegistry;
      return getProgramCapabilitiesFromRegistry(registry, programId);
    },
    getProgramDifficultyMeta: (programId) => {
      const registry = (programStoreRef?.getState().registry ||
        getTypedRegistry()) as ProgramRegistry;
      return getProgramDifficultyMetaFromRegistry(registry, programId);
    },
    getProgramTrainingDaysRange: (programId) => {
      const registry = (programStoreRef?.getState().registry ||
        getTypedRegistry()) as ProgramRegistry;
      return getProgramTrainingDaysRangeFromRegistry(registry, programId);
    },
    getEffectiveProgramFrequency: (programId, profileLike) => {
      const registry = (programStoreRef?.getState().registry ||
        getTypedRegistry()) as ProgramRegistry;
      return getEffectiveProgramFrequencyFromRegistry(
        registry,
        programId,
        profileLike
      );
    },
  }));

programStoreRef = programStore;

export function installProgramStore() {
  if (storeInstalled) return;
  storeInstalled = true;

  refreshStoreSnapshot();
  unsubscribeProfileStore = profileStore.subscribe(() => {
    refreshStoreSnapshot();
  });
  unsubscribeDataStore = dataStore.subscribe(() => {
    refreshStoreSnapshot();
  });

  if (typeof window !== 'undefined') {
    window.addEventListener('visibilitychange', refreshStoreSnapshot);
    window.addEventListener('focus', refreshStoreSnapshot);
  }
}

export function disposeProgramStore() {
  unsubscribeProfileStore?.();
  unsubscribeDataStore?.();
  unsubscribeProfileStore = null;
  unsubscribeDataStore = null;
  if (typeof window !== 'undefined') {
    window.removeEventListener('visibilitychange', refreshStoreSnapshot);
    window.removeEventListener('focus', refreshStoreSnapshot);
  }
  storeInstalled = false;
}

export function getProgramStoreSnapshot() {
  return programStore.getState().refreshSnapshot();
}
