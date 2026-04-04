import {
  FATIGUE_CONFIG as DEFAULT_FATIGUE_CONFIG,
  MUSCLE_LOAD_CONFIG as DEFAULT_MUSCLE_LOAD_CONFIG,
} from './config';
import type {
  FatigueResult,
  PlanningDecision,
  Profile,
  SportSchedule,
  WorkoutRecord,
} from './types';
import { dataStore } from '../stores/data-store';
import { profileStore } from '../stores/profile-store';

export type MutableRecord = Record<string, unknown>;

export type ProgramDifficultyMeta = {
  key: string;
  labelKey: string;
  fallback: string;
};

export type ProgramCapabilities = Record<string, unknown> & {
  difficulty?: string;
  frequencyRange?: {
    min: number;
    max: number;
  };
  recommendationScore?: (
    days: number,
    preferences?: Record<string, unknown>
  ) => number;
};

export type PlanningContextInput = Record<string, unknown> & {
  profile?: Profile | Record<string, unknown> | null;
  schedule?: SportSchedule | Record<string, unknown> | null;
  workouts?: WorkoutRecord[];
  activeProgram?: Record<string, unknown> | null;
  activeProgramState?: Record<string, unknown> | null;
  fatigue?: FatigueResult | Record<string, unknown> | null;
  sportContext?: Record<string, unknown> | null;
};

export type TrainingDecision = PlanningDecision &
  Record<string, unknown> & {
    action: string;
    restrictionFlags: string[];
    reasonCodes: string[];
    timeBudgetMinutes?: number;
    recommendedSessionOption?: string;
  };

export type CoachingInsights = Record<string, unknown> & {
  recommendation?: Record<string, unknown> | null;
};

export type InitialPlanRecommendation = Record<string, unknown> & {
  programId?: string;
  why?: string[];
  fitReasons?: string[];
  weekTemplate?: Array<Record<string, unknown>>;
  initialAdjustments?: string[];
};

export type WeekPlanPreview = Record<string, unknown>;

export type ComputeFatigueInput = {
  workouts?: WorkoutRecord[];
  schedule?: SportSchedule | Record<string, unknown> | null;
};

export type PlanningWindow = Window & {
  I18N?: {
    t?: (
      key: string,
      params?: Record<string, unknown> | null,
      fallback?: string
    ) => string;
  };
  FATIGUE_CONFIG?: typeof DEFAULT_FATIGUE_CONFIG;
  MUSCLE_LOAD_CONFIG?: typeof DEFAULT_MUSCLE_LOAD_CONFIG;
  DAY_NAMES?: string[];
  getWeekStart?: (date: Date) => Date;
  getRecentDisplayMuscleLoads?: (days?: number) => Record<string, number>;
  getTrainingGoalLabel?: (goal?: unknown) => string;
  __IRONFORGE_GET_LEGACY_RUNTIME_STATE__?: () => Record<string, unknown> | null;
  workouts?: WorkoutRecord[];
  profile?: Record<string, unknown> | null;
  schedule?: Record<string, unknown> | null;
};

const PROGRAM_ID_ALIASES: Record<string, string> = {
  w531: 'wendler531',
};

export function cloneJson<T>(value: T): T {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

export function getPlanningWindow(): PlanningWindow | null {
  if (typeof window === 'undefined') return null;
  return window as unknown as PlanningWindow;
}

export function trPlan(
  key: string,
  fallback: string,
  params?: Record<string, unknown> | null
) {
  const runtimeWindow = getPlanningWindow();
  if (runtimeWindow?.I18N?.t) {
    return runtimeWindow.I18N.t(key, params || null, fallback);
  }
  return fallback;
}

export function clampPlanningValue(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function toPlanList<T>(value: T | T[] | null | undefined | ''): T[] {
  if (Array.isArray(value)) return value.filter(Boolean) as T[];
  if (value === undefined || value === null || value === '') return [];
  return [value];
}

export function getCanonicalProgramId(programId?: unknown) {
  const raw = String(programId || '').trim();
  if (!raw) return '';
  const normalized = raw.toLowerCase();
  if (PROGRAM_ID_ALIASES[normalized]) return PROGRAM_ID_ALIASES[normalized];
  return normalized;
}

export function getWeekStart(date: Date) {
  const runtimeWindow = getPlanningWindow();
  if (typeof runtimeWindow?.getWeekStart === 'function') {
    return runtimeWindow.getWeekStart(new Date(date));
  }
  const next = new Date(date);
  const offset = (next.getDay() + 6) % 7;
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() - offset);
  return next;
}

export function getDayNames() {
  return (
    getPlanningWindow()?.DAY_NAMES || [
      'Sun',
      'Mon',
      'Tue',
      'Wed',
      'Thu',
      'Fri',
      'Sat',
    ]
  );
}

export function getDefaultTrainingGoalLabel(goal?: unknown) {
  const normalized = String(goal || '').trim();
  if (normalized === 'hypertrophy') return 'Hypertrophy';
  if (normalized === 'sport_support') return 'Sport Support';
  if (normalized === 'general_fitness') return 'General Fitness';
  return 'Strength';
}

export function getStoredProfileRecord() {
  const runtimeWindow = getPlanningWindow();
  const legacyRuntime = runtimeWindow?.__IRONFORGE_GET_LEGACY_RUNTIME_STATE__?.() || null;
  return (
    cloneJson(
      (legacyRuntime?.profile as MutableRecord | null) ||
        runtimeWindow?.profile ||
        (profileStore.getState().profile as MutableRecord | null) ||
        (dataStore.getState().profile as MutableRecord | null) ||
        null
    ) || {}
  );
}

export function getStoredScheduleRecord() {
  const runtimeWindow = getPlanningWindow();
  const legacyRuntime = runtimeWindow?.__IRONFORGE_GET_LEGACY_RUNTIME_STATE__?.() || null;
  return (
    cloneJson(
      (legacyRuntime?.schedule as MutableRecord | null) ||
        runtimeWindow?.schedule ||
        (profileStore.getState().schedule as MutableRecord | null) ||
        (dataStore.getState().schedule as MutableRecord | null) ||
        null
    ) || {}
  );
}

export function getStoredWorkouts() {
  const runtimeWindow = getPlanningWindow();
  const legacyRuntime = runtimeWindow?.__IRONFORGE_GET_LEGACY_RUNTIME_STATE__?.() || null;
  return cloneJson(
    ((legacyRuntime?.workouts as WorkoutRecord[]) ||
      runtimeWindow?.workouts ||
      dataStore.getState().workouts ||
      []) as WorkoutRecord[]
  );
}
