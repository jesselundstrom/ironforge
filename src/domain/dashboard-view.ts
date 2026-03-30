import type { DashboardNutritionSummary } from './nutrition-view';
import {
  buildDashboardPlanStructuredSnapshot,
  getDashboardDayDetailData,
  getDashboardLabels,
  getDashboardRecoverySnapshot,
  getDashboardTrainingMaxData,
  getDashboardWeekLegendItems,
} from './dashboard-runtime';
import type { Profile, WorkoutRecord } from './types';

export type DashboardWeekDayView = {
  index: number;
  key: string;
  label: string;
  dayNumber: number;
  isToday: boolean;
  isSportDay: boolean;
  hasLift: boolean;
  hasSport: boolean;
  isLogged: boolean;
  isActive: boolean;
  variant: string;
  markers: string[];
  tooltip: string;
};

export type DashboardViewModel = {
  simpleMode: boolean;
  labels: Record<string, string>;
  hero: Record<string, any>;
  week: {
    days: DashboardWeekDayView[];
    legend: Array<{ id: string; tone: string; label: string }>;
    activeDayIndex: number | null;
    detailVisible: boolean;
    detail: {
      items: Array<{ kind: string; text: string }>;
    };
    status: {
      tone: string;
      text: string;
    };
  };
  plan: {
    headerSub: string;
    progress: Record<string, any>;
    sections: Array<Record<string, any>>;
  };
  recovery: Record<string, any>;
  nutrition: DashboardNutritionSummary;
  trainingMaxesTitle: string;
  trainingMaxes: Array<Record<string, any>>;
};

export type BuildDashboardViewInput = {
  workouts: WorkoutRecord[];
  profile: Profile | null;
  schedule: { sportName?: string; sportDays?: number[] } | null;
  activeProgram: Record<string, any> | null;
  activeProgramState: Record<string, any> | null;
  fatigue: Record<string, any>;
  activeDayIndex: number | null;
  nutrition: DashboardNutritionSummary;
};

type DashboardWindow = Window & {
  getWeekStart?: (date: Date) => Date;
  isSportWorkout?: (workout: unknown) => boolean;
};

function getDashboardWindow(): DashboardWindow | null {
  if (typeof window === 'undefined') return null;
  return window as DashboardWindow;
}

function getWeekStart(date: Date) {
  const runtimeWindow = getDashboardWindow();
  if (typeof runtimeWindow?.getWeekStart === 'function') {
    return runtimeWindow.getWeekStart(new Date(date));
  }
  const value = new Date(date);
  const day = value.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  value.setDate(value.getDate() + diff);
  value.setHours(0, 0, 0, 0);
  return value;
}

function isSportWorkout(workout: WorkoutRecord) {
  const runtimeWindow = getDashboardWindow();
  if (typeof runtimeWindow?.isSportWorkout === 'function') {
    return runtimeWindow.isSportWorkout(workout) === true;
  }
  return workout?.type === 'sport' || workout?.type === 'hockey';
}

function getDayLabel(date: Date) {
  return date
    .toLocaleDateString(undefined, { weekday: 'short' })
    .replace('.', '')
    .slice(0, 3);
}

function getStatusText(
  workouts: WorkoutRecord[],
  schedule: { sportName?: string; sportDays?: number[] } | null
) {
  const today = new Date();
  const todayDow = today.getDay();
  const todayLogged = workouts.filter(
    (workout) => new Date(workout.date).toDateString() === today.toDateString()
  );
  const hasLift = todayLogged.some((workout) => !isSportWorkout(workout));
  const hasSport = todayLogged.some((workout) => isSportWorkout(workout));
  const sportName = schedule?.sportName || 'Sport';

  if (hasLift && hasSport) return { tone: 'success', text: `Workout + ${sportName} logged` };
  if (hasLift) return { tone: 'success', text: 'Workout logged' };
  if (hasSport) return { tone: 'info', text: `${sportName} logged` };
  if (schedule?.sportDays?.includes(todayDow)) return { tone: 'info', text: `${sportName} day` };
  return { tone: 'neutral', text: 'No session logged' };
}

export function isSimpleMode(profile: Profile | null) {
  if (!profile || typeof profile !== 'object') return false;
  const preferences = (profile.preferences || {}) as Record<string, unknown>;
  if (preferences.detailedView === true) return false;
  if (preferences.detailedView === false) return true;
  const coaching = (profile.coaching || {}) as Record<string, unknown>;
  return (
    coaching.guidanceMode === 'guided' ||
    (coaching.guidanceMode === 'balanced' && coaching.experienceLevel === 'beginner')
  );
}

export function buildDashboardViewModel(
  input: BuildDashboardViewInput
): DashboardViewModel {
  const labels = getDashboardLabels();
  const simpleMode = isSimpleMode(input.profile);
  const status = getStatusText(input.workouts, input.schedule);
  const plan = buildDashboardPlanStructuredSnapshot({
    activeProgram: input.activeProgram,
    activeProgramState: input.activeProgramState,
    fatigue: input.fatigue || {},
    profile: input.profile,
    schedule: (input.schedule as any) || null,
    workouts: input.workouts,
    status,
  });
  const recovery = getDashboardRecoverySnapshot(input.fatigue || {}, input.profile);
  const tmData = getDashboardTrainingMaxData(
    input.activeProgram || {},
    input.activeProgramState || {}
  );

  const today = new Date();
  const weekStart = getWeekStart(today);
  const sportName = input.schedule?.sportName || 'Sport';
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    const dow = date.getDay();
    const logged = input.workouts.filter(
      (workout) => new Date(workout.date).toDateString() === date.toDateString()
    );
    const hasLift = logged.some((workout) => !isSportWorkout(workout));
    const hasSport = logged.some((workout) => isSportWorkout(workout));
    const isLogged = hasLift || hasSport;
    const isSportDay = !!input.schedule?.sportDays?.includes(dow);
    const tooltipParts = [`${getDayLabel(date)} ${date.getDate()}.`];
    if (hasLift) tooltipParts.push('Workout logged');
    if (hasSport) tooltipParts.push(`${sportName} logged`);
    if (!hasSport && isSportDay) tooltipParts.push(`Scheduled ${sportName}`);
    if (!isLogged && !isSportDay) tooltipParts.push('No session logged');
    return {
      index,
      key: date.toISOString(),
      label: getDayLabel(date),
      dayNumber: date.getDate(),
      isToday: date.toDateString() === today.toDateString(),
      isSportDay,
      hasLift,
      hasSport,
      isLogged,
      isActive: input.activeDayIndex === index,
      variant:
        date.toDateString() === today.toDateString()
          ? 'today'
          : isLogged
            ? 'logged'
            : isSportDay
              ? 'scheduled'
              : 'free',
      markers: [
        ...(hasLift ? ['lift'] : []),
        ...(!hasLift && isSportDay ? ['scheduled'] : []),
        ...(hasSport ? ['sport'] : []),
      ],
      tooltip: tooltipParts.join(' - '),
    };
  });

  const detailItems =
    input.activeDayIndex !== null
      ? (() => {
          const date = new Date(weekStart);
          date.setDate(weekStart.getDate() + input.activeDayIndex);
          return getDashboardDayDetailData(input.workouts, (input.schedule as any) || null, date);
        })()
      : [];

  return {
    simpleMode,
    labels,
    hero: plan.hero,
    week: {
      days,
      legend: getDashboardWeekLegendItems(),
      activeDayIndex: input.activeDayIndex,
      detailVisible: input.activeDayIndex !== null,
      detail: {
        items: detailItems,
      },
      status,
    },
    plan: {
      headerSub: plan.headerSub,
      progress: plan.progress,
      sections: plan.sections,
    },
    recovery,
    nutrition: input.nutrition,
    trainingMaxesTitle: tmData.title,
    trainingMaxes: tmData.items,
  };
}
