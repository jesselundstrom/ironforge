export type LanguageCode = 'en' | 'fi';

export type SyncState = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

export type TrainingGoal =
  | 'strength'
  | 'hypertrophy'
  | 'general_fitness'
  | 'sport_support';

export type EquipmentAccess =
  | 'full_gym'
  | 'basic_gym'
  | 'home_gym'
  | 'minimal';

export type TrainingDaysPerWeek = 2 | 3 | 4 | 5 | 6;

export type SessionMinutes = 30 | 45 | 60 | 75 | 90;

export type WorkoutType = 'training' | 'sport' | 'hockey' | string;

export type PlanningAction =
  | 'train'
  | 'shorten'
  | 'train_light'
  | 'deload'
  | 'rest'
  | string;

export type SyncStatus = {
  state: SyncState;
  updatedAt: string | null;
};

export type ExerciseSet = {
  weight: number | string;
  reps: number | string;
  done: boolean;
  isWarmup?: boolean;
  rpe?: number | null;
  rir?: number | string | null;
  loggedReps?: number | null;
  notes?: string;
  isAmrap?: boolean;
  repOutTarget?: number;
};

export type WorkoutExercise = {
  id?: string | number;
  name: string;
  exerciseId?: string | null;
  note?: string;
  notes?: string;
  sets: ExerciseSet[];
  isAux?: boolean;
  isAccessory?: boolean;
  auxSlotIdx?: number;
  tm?: number;
  prescribedWeight?: number;
  prescribedReps?: number | string;
  rirCutoff?: number | null;
  isDeload?: boolean;
  repOutTarget?: number;
};

export type SessionOption = {
  value: string;
  label: string;
  done?: boolean;
  hasLegs?: boolean;
  isRecommended?: boolean;
  preferenceReasons?: string[];
  [key: string]: unknown;
};

export type PlanningDecision = {
  action: PlanningAction;
  restrictionFlags: string[];
  reasonCodes: string[];
  decisionCode?: string;
};

export type WorkoutCommentaryEvent = {
  code: string;
  text?: string;
  params?: Record<string, unknown>;
};

export type WorkoutCommentary = {
  version: number;
  decisionCode: string;
  reasonCodes: string[];
  restrictionFlags: string[];
  adaptationEvents: WorkoutCommentaryEvent[];
  equipmentHint: WorkoutCommentaryEvent | null;
  runnerEvents: WorkoutCommentaryEvent[];
};

export type WorkoutRecord = {
  id: string | number;
  date: string;
  program?: string | null;
  type: WorkoutType;
  subtype?: string | null;
  programDayNum?: number;
  programMeta?: Record<string, unknown> | null;
  programLabel?: string;
  programOption?: string;
  programStateBefore?: Record<string, unknown> | null;
  programStateUsedForBuild?: Record<string, unknown> | null;
  duration?: number;
  durationSignal?: string | null;
  rpe?: number | null;
  exercises: WorkoutExercise[];
  sessionFeedback?: string | null;
  planningDecision?: PlanningDecision | null;
  commentary?: WorkoutCommentary | null;
  notes?: string;
  [key: string]: unknown;
};

export type ActiveWorkout = {
  id: string | number;
  date: string;
  program?: string | null;
  type: WorkoutType;
  subtype?: string | null;
  programDayNum?: number;
  programLabel?: string;
  programOption?: string;
  programStateBefore?: Record<string, unknown> | null;
  planningDecision?: PlanningDecision | null;
  notes?: string;
  exercises: WorkoutExercise[];
  startTime?: number;
  startedAt?: string | number;
  sessionDescription?: string;
  [key: string]: unknown;
};

export type WorkoutStartSnapshot = {
  signature?: string;
  programId?: string | null;
  selectedOption?: string;
  buildContext?: Record<string, unknown> | null;
  buildState?: Record<string, unknown> | null;
  exercises: WorkoutExercise[];
  sessionDescription?: string;
  programLabel?: string;
  effectiveDecision?: PlanningDecision | null;
  trainingDecision?: PlanningDecision | null;
  changes?: Array<Record<string, unknown>>;
  equipmentHint?: string;
  commentary?: WorkoutCommentary | Record<string, unknown> | null;
  [key: string]: unknown;
};

export type TrainingPreferences = {
  goal: TrainingGoal;
  trainingDaysPerWeek: TrainingDaysPerWeek;
  sessionMinutes: SessionMinutes;
  equipmentAccess: EquipmentAccess;
  sportReadinessCheckEnabled: boolean;
  warmupSetsEnabled: boolean;
  detailedView?: boolean;
  notes: string;
};

export type BodyMetrics = {
  sex?: string | null;
  activityLevel?: string | null;
  weight?: number | null;
  height?: number | null;
  age?: number | null;
  targetWeight?: number | null;
  bodyGoal?: string | null;
};

export type CoachingProfile = {
  experienceLevel?: string | null;
  guidanceMode?: string | null;
  sportProfile?: {
    name?: string;
    inSeason?: boolean;
    sessionsPerWeek?: number;
    [key: string]: unknown;
  };
  limitations?: {
    jointFlags?: string[];
    avoidMovementTags?: string[];
    avoidExerciseIds?: string[];
    [key: string]: unknown;
  };
  exercisePreferences?: {
    preferredExerciseIds?: string[];
    excludedExerciseIds?: string[];
    [key: string]: unknown;
  };
  behaviorSignals?: {
    avoidedExerciseIds?: string[];
    skippedAccessoryExerciseIds?: string[];
    preferredSwapExerciseIds?: string[];
    [key: string]: unknown;
  };
  onboardingCompleted?: boolean;
  onboardingSeen?: boolean;
  [key: string]: unknown;
};

export type ProgramStateMap = Record<string, Record<string, unknown>>;

export type ProfileSyncMeta = Record<string, unknown>;

export type Profile = {
  defaultRest: number;
  language: LanguageCode | string;
  activeProgram?: string;
  programs?: ProgramStateMap;
  preferences: TrainingPreferences;
  coaching: CoachingProfile;
  bodyMetrics?: BodyMetrics;
  syncMeta?: ProfileSyncMeta;
  [key: string]: unknown;
};

export type SportSchedule = {
  sportName: string;
  sportDays: number[];
  sportIntensity: 'easy' | 'moderate' | 'hard' | string;
  sportLegsHeavy: boolean;
};

export type FatigueResult = {
  muscular: number;
  cns: number;
  overall: number;
  computedAt?: string;
};

export type NutritionMessage = {
  role: 'user' | 'assistant' | 'system' | string;
  content: string;
  timestamp: string;
  [key: string]: unknown;
};

export type NutritionTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type NutritionEntry = {
  date: string;
  history: NutritionMessage[];
  totals: NutritionTotals;
};
