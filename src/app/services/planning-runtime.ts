import {
  buildOnboardingRecommendation,
  buildPlanningContext,
  buildTrainingCommentaryState,
  computeFatigue,
  getCoachingInsights,
  getInitialPlanRecommendation,
  getProgramCapabilities,
  getProgramDifficultyMeta,
  getTodayTrainingDecision,
  getWeekPlanPreview,
  presentTrainingCommentary,
} from '../../domain/planning';
import type { WorkoutRecord } from '../../domain/types';
import { dataStore } from '../../stores/data-store';
import { profileStore } from '../../stores/profile-store';
import { programStore } from '../../stores/program-store';

type PlanningWindow = Window & {
  computeFatigue?: () => Record<string, unknown>;
  buildPlanningContext?: (
    input?: Record<string, unknown>
  ) => Record<string, unknown> | null;
  getTodayTrainingDecision?: (
    context?: Record<string, unknown> | null
  ) => Record<string, unknown> | null;
  getCoachingInsights?: (
    input?: Record<string, unknown>
  ) => Record<string, unknown> | null;
  getInitialPlanRecommendation?: (
    input?: Record<string, unknown>
  ) => Record<string, unknown> | null;
  buildOnboardingRecommendation?: (
    draft?: Record<string, unknown>
  ) => Record<string, unknown> | null;
  getWeekPlanPreview?: (
    planningContext?: Record<string, unknown> | null,
    workoutList?: WorkoutRecord[],
    scheduleLike?: Record<string, unknown> | null,
    programLike?: Record<string, unknown> | null,
    programState?: Record<string, unknown> | null
  ) => Record<string, unknown> | null;
  buildTrainingCommentaryState?: (
    input?: Record<string, unknown>
  ) => Record<string, unknown> | null;
  presentTrainingCommentary?: (
    state?: Record<string, unknown>,
    surface?: string
  ) => Record<string, unknown> | null;
  getProgramCapabilities?: (programId?: string | null) => Record<string, unknown>;
  getProgramDifficultyMeta?: (
    programId?: string | null
  ) => Record<string, unknown> | null;
  getProgramById?: (programId?: string | null) => Record<string, unknown> | null;
  getProgramInitialState?: (
    programId?: string | null
  ) => Record<string, unknown> | null;
};

export function installPlanningWindowBindings() {
  if (typeof window === 'undefined') return;
  const runtimeWindow = window as PlanningWindow;
  runtimeWindow.computeFatigue = () =>
    computeFatigue({
      workouts: (dataStore.getState().workouts || []) as WorkoutRecord[],
      schedule: profileStore.getState().schedule,
    });
  runtimeWindow.buildPlanningContext = (input) => buildPlanningContext(input) || null;
  runtimeWindow.getTodayTrainingDecision = (context) =>
    getTodayTrainingDecision(context) || null;
  runtimeWindow.getCoachingInsights = (input) => getCoachingInsights(input) || null;
  runtimeWindow.getInitialPlanRecommendation = (input) =>
    getInitialPlanRecommendation(input) || null;
  runtimeWindow.buildOnboardingRecommendation = (draft) =>
    buildOnboardingRecommendation(draft) || null;
  runtimeWindow.getWeekPlanPreview = (
    planningContext,
    workoutList,
    scheduleLike,
    programLike,
    programState
  ) =>
    getWeekPlanPreview(
      planningContext,
      workoutList,
      scheduleLike,
      programLike,
      programState
    ) || null;
  runtimeWindow.buildTrainingCommentaryState = (input) =>
    buildTrainingCommentaryState(input) || null;
  runtimeWindow.presentTrainingCommentary = (state, surface) =>
    presentTrainingCommentary(state, surface) || null;
  runtimeWindow.getProgramCapabilities = (programId) =>
    getProgramCapabilities(programId);
  runtimeWindow.getProgramDifficultyMeta = (programId) =>
    getProgramDifficultyMeta(programId) || null;
  runtimeWindow.getProgramById = (programId) =>
    (programStore.getState().getProgramById(programId) as Record<string, unknown> | null) ||
    null;
  runtimeWindow.getProgramInitialState = (programId) =>
    (programStore.getState().getProgramInitialState(programId) as
      | Record<string, unknown>
      | null) || null;
}
