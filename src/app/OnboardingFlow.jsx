import { useEffect, useRef, useState } from 'react';
import { cn } from './utils/cn.ts';
import { programStore } from '../stores/program-store.ts';
import { buildOnboardingRecommendation } from '../domain/planning.ts';
import { t } from './services/i18n.ts';

const ONBOARDING_EVENT = 'ironforge:onboarding-updated';
const LANGUAGE_EVENT = 'ironforge:language-changed';
const STEP_COUNT = 5;

const JOINT_FLAGS = [
  { value: 'shoulder', key: 'onboarding.joint.shoulder', fallback: 'Shoulder' },
  { value: 'knee', key: 'onboarding.joint.knee', fallback: 'Knee' },
  { value: 'low_back', key: 'onboarding.joint.low_back', fallback: 'Low Back' },
];

const MOVEMENT_TAGS = [
  { value: 'squat', key: 'onboarding.movement.squat', fallback: 'Squat' },
  { value: 'hinge', key: 'onboarding.movement.hinge', fallback: 'Hinge' },
  { value: 'vertical_press', key: 'onboarding.movement.vertical_press', fallback: 'Overhead Press' },
  { value: 'single_leg', key: 'onboarding.movement.single_leg', fallback: 'Single-Leg' },
];

const GOAL_OPTIONS = [
  { value: 'strength', key: 'onboarding.goal.strength', fallback: 'Strength', descKey: 'onboarding.goal.strength_desc', descFallback: 'Improve main lifts and progression.' },
  { value: 'hypertrophy', key: 'onboarding.goal.hypertrophy', fallback: 'Hypertrophy', descKey: 'onboarding.goal.hypertrophy_desc', descFallback: 'Bias training toward muscle gain and volume.' },
  { value: 'general_fitness', key: 'onboarding.goal.general_fitness', fallback: 'General Fitness', descKey: 'onboarding.goal.general_fitness_desc', descFallback: 'Keep training sustainable and broadly useful.' },
  { value: 'sport_support', key: 'onboarding.goal.sport_support', fallback: 'Sport Support', descKey: 'onboarding.goal.sport_support_desc', descFallback: 'Fit lifting around outside sport or cardio load.' },
];

const EXPERIENCE_OPTIONS = [
  { value: 'beginner', key: 'onboarding.experience.beginner', fallback: 'Beginner', descKey: 'onboarding.experience.beginner_desc', descFallback: 'You want simple defaults and low complexity.' },
  { value: 'returning', key: 'onboarding.experience.returning', fallback: 'Returning', descKey: 'onboarding.experience.returning_desc', descFallback: 'You have trained before, but want a stable ramp back in.' },
  { value: 'intermediate', key: 'onboarding.experience.intermediate', fallback: 'Intermediate', descKey: 'onboarding.experience.intermediate_desc', descFallback: 'You can handle more structure and moderate autoregulation.' },
  { value: 'advanced', key: 'onboarding.experience.advanced', fallback: 'Advanced', descKey: 'onboarding.experience.advanced_desc', descFallback: 'You want a higher ceiling and more nuanced planning.' },
];

const GUIDANCE_OPTIONS = [
  { value: 'guided', key: 'onboarding.guidance.guided', fallback: 'Tell me what to do', descKey: 'onboarding.guidance.guided_desc', descFallback: 'Strong default recommendations, less manual decision-making.' },
  { value: 'balanced', key: 'onboarding.guidance.balanced', fallback: 'Balanced', descKey: 'onboarding.guidance.balanced_desc', descFallback: 'Good defaults, but still leaves room to steer the plan.' },
  { value: 'self_directed', key: 'onboarding.guidance.self_directed', fallback: 'Give me control', descKey: 'onboarding.guidance.self_directed_desc', descFallback: 'Lighter guidance and more room for manual choices.' },
];

const EQUIPMENT_OPTIONS = [
  { value: 'full_gym', key: 'onboarding.equipment.full_gym', fallback: 'Full Gym' },
  { value: 'basic_gym', key: 'onboarding.equipment.basic_gym', fallback: 'Basic Gym' },
  { value: 'home_gym', key: 'onboarding.equipment.home_gym', fallback: 'Home Gym' },
  { value: 'minimal', key: 'onboarding.equipment.minimal', fallback: 'Minimal Equipment' },
];

const cardTitleClass =
  "mb-2.5 text-[11px] font-bold uppercase tracking-[1.2px] text-muted before:mr-1 before:align-middle before:text-[7px] before:text-accent/50 before:content-['\\25C6']";
const onboardingGridClass = 'grid gap-3';
const onboardingOptionGridClass = 'grid gap-2.5';
const onboardingOptionButtonBaseClass =
  'w-full rounded-[14px] border border-white/8 bg-white/[0.03] p-3.5 text-left text-text';
const onboardingChipBaseClass =
  'rounded-full border border-white/8 bg-white/[0.03] px-3 py-2.5 text-xs font-bold text-text';
const onboardingCardClass =
  'rounded-2xl border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-3.5';
const onboardingRecommendationPillClass =
  'grid min-w-0 gap-1 rounded-xl border border-white/8 bg-white/[0.04] px-[11px] py-[9px]';
const onboardingFitTitleClass =
  'mb-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[rgba(255,210,169,0.92)] font-condensed';
const secondaryButtonClass =
  'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-white/[0.02] px-[18px] py-3 font-condensed text-base font-bold uppercase tracking-[0.04em] text-text transition-[transform,opacity,box-shadow,background-color,border-color,color] duration-200 hover:bg-white/[0.05] active:scale-[0.97] active:opacity-90';
const primaryButtonClass =
  'inline-flex min-h-[54px] w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-[linear-gradient(180deg,#ff983d,#f5821f)] px-[18px] py-3 font-condensed text-base font-bold uppercase tracking-[0.04em] text-white shadow-[0_12px_30px_rgba(245,130,31,0.22)] transition-[transform,box-shadow,background-color] duration-150 hover:bg-[#ff922f] active:scale-[0.96] active:shadow-[0_4px_16px_rgba(245,130,31,0.3)]';

function getStepTitle(step) {
  const titles = [
    t('onboarding.step.0.title', 'Build your starting point'),
    t('onboarding.step.1.title', 'Set your training envelope'),
    t('onboarding.step.2.title', 'Add sport and constraints'),
    t('onboarding.step.3.title', 'Choose your guidance level'),
    t('onboarding.step.4.title', 'Start from a real plan'),
  ];
  return titles[step] || t('onboarding.kicker', 'Guided Setup');
}

function getStepSub(step) {
  const subs = [
    t('onboarding.step.0.sub', 'This gives the engine enough signal to recommend the right starting plan.'),
    t('onboarding.step.1.sub', 'These limits drive frequency, session trimming, and program fit.'),
    t('onboarding.step.2.sub', 'Tell the assistant what has to be respected, especially your regular sport and real constraints.'),
    t('onboarding.step.3.sub', 'This sets how opinionated the app should be when making decisions.'),
    t('onboarding.step.4.sub', 'You should leave onboarding with a clear program, first week, and first session.'),
  ];
  return subs[step] || '';
}

function ProgressPills({ step }) {
  return (
    <div className="flex gap-2" data-ui="onboarding-progress">
      {Array.from({ length: STEP_COUNT }, (_, idx) => (
        <div
          key={idx}
          className={cn(
            'h-1.5 flex-1 overflow-hidden rounded-full bg-white/8',
            idx <= step && 'bg-[linear-gradient(90deg,var(--accent),var(--gold))]'
          )}
          data-state={idx <= step ? 'active' : 'inactive'}
        />
      ))}
    </div>
  );
}

function OptionButton({ active, title, description, onClick }) {
  return (
    <button
      type="button"
      className={cn(
        onboardingOptionButtonBaseClass,
        active &&
          'border-[rgba(255,122,58,0.42)] bg-[linear-gradient(180deg,rgba(255,122,58,0.13),rgba(255,122,58,0.05))]'
      )}
      onClick={onClick}
      data-state={active ? 'active' : 'inactive'}
    >
      <div className="text-sm font-extrabold">{title}</div>
      <div className="mt-1 text-xs leading-[1.45] text-muted">{description}</div>
    </button>
  );
}

function ChipRow({ items, selected, onToggle }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          className={cn(
            onboardingChipBaseClass,
            selected.includes(item.value) &&
              'border-[rgba(59,130,246,0.32)] bg-[rgba(59,130,246,0.14)] text-[#d9e7ff]'
          )}
          onClick={() => onToggle(item.value)}
          data-state={selected.includes(item.value) ? 'active' : 'inactive'}
        >
          {t(item.key, item.fallback)}
        </button>
      ))}
    </div>
  );
}

function StepGoalExperience({ draft, setField }) {
  return (
    <div className={onboardingGridClass}>
      <div>
        <label>{t('onboarding.field.goal', 'Primary Goal')}</label>
        <div className={onboardingOptionGridClass}>
          {GOAL_OPTIONS.map((opt) => (
            <OptionButton
              key={opt.value}
              active={draft.goal === opt.value}
              title={t(opt.key, opt.fallback)}
              description={t(opt.descKey, opt.descFallback)}
              onClick={() => setField('goal', opt.value)}
            />
          ))}
        </div>
      </div>
      <div>
        <label>{t('onboarding.field.experience', 'Experience Level')}</label>
        <div className={onboardingOptionGridClass}>
          {EXPERIENCE_OPTIONS.map((opt) => (
            <OptionButton
              key={opt.value}
              active={draft.experienceLevel === opt.value}
              title={t(opt.key, opt.fallback)}
              description={t(opt.descKey, opt.descFallback)}
              onClick={() => setField('experienceLevel', opt.value)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function StepTrainingEnvelope({ draft, setField }) {
  return (
    <div className={onboardingGridClass}>
      <div className="grid grid-cols-2 gap-2.5 max-[480px]:grid-cols-1">
        <div>
          <label>{t('onboarding.field.frequency', 'Training Frequency')}</label>
          <select
            value={String(draft.trainingDaysPerWeek)}
            onChange={(event) =>
              setField('trainingDaysPerWeek', parseInt(event.target.value, 10))
            }
          >
            {[2, 3, 4, 5, 6].map((value) => (
              <option key={value} value={value}>
                {t('onboarding.frequency_value', '{count} sessions / week', {
                  count: value,
                })}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>{t('onboarding.field.duration', 'Session Length')}</label>
          <select
            value={String(draft.sessionMinutes)}
            onChange={(event) =>
              setField('sessionMinutes', parseInt(event.target.value, 10))
            }
          >
            {[30, 45, 60, 75, 90].map((value) => (
              <option key={value} value={value}>
                {t('onboarding.duration_value', '{count} min', { count: value })}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label>{t('onboarding.field.equipment', 'Equipment Access')}</label>
        <select
          value={draft.equipmentAccess}
          onChange={(event) => setField('equipmentAccess', event.target.value)}
        >
          {EQUIPMENT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {t(opt.key, opt.fallback)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function StepSportConstraints({ draft, setField, toggleArrayValue }) {
  return (
    <div className={onboardingGridClass}>
      <div className="grid grid-cols-2 gap-2.5 max-[480px]:grid-cols-1">
        <div>
          <label>{t('onboarding.field.sport', 'Sport or Cardio')}</label>
          <input
            type="text"
            value={draft.sportName || ''}
            placeholder={t(
              'onboarding.field.sport_placeholder',
              'e.g. Hockey, Running, Soccer'
            )}
            onInput={(event) => setField('sportName', event.target.value)}
          />
          <div className="mt-[-4px] text-[11px] leading-[1.5] text-muted">
            {t(
              'onboarding.field.sport_help',
              'Add your regular sport or other recurring hobby here if it affects recovery during the week.'
            )}
          </div>
        </div>
        <div>
          <label>{t('onboarding.field.sport_sessions', 'Sessions / Week')}</label>
          <select
            value={String(draft.sportSessionsPerWeek)}
            onChange={(event) =>
              setField('sportSessionsPerWeek', parseInt(event.target.value, 10))
            }
          >
            {[0, 1, 2, 3, 4, 5, 6, 7].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label className="toggle-row" style={{ marginTop: 0 }}>
        <div>
          <div className="toggle-row-title">
            {t('onboarding.field.in_season', 'In season')}
          </div>
          <div className="toggle-row-sub">
            {t(
              'onboarding.field.in_season_help',
              'Use a more conservative starting point when sport is a real load right now.'
            )}
          </div>
        </div>
        <div className="toggle-switch">
          <input
            type="checkbox"
            checked={draft.inSeason || false}
            onChange={(event) => setField('inSeason', event.target.checked)}
          />
          <span className="toggle-track">
            <span className="toggle-thumb" />
          </span>
        </div>
      </label>

      <div>
        <label>{t('onboarding.field.joints', 'Joint Flags')}</label>
        <ChipRow
          items={JOINT_FLAGS}
          selected={draft.jointFlags || []}
          onToggle={(value) => toggleArrayValue('jointFlags', value)}
        />
      </div>

      <div>
        <label>{t('onboarding.field.movements', 'Avoid Movement Patterns')}</label>
        <ChipRow
          items={MOVEMENT_TAGS}
          selected={draft.avoidMovementTags || []}
          onToggle={(value) => toggleArrayValue('avoidMovementTags', value)}
        />
      </div>

      <div>
        <label>{t('onboarding.field.avoid_exercises', 'Avoided Exercises')}</label>
        <textarea
          rows={3}
          placeholder={t(
            'onboarding.field.avoid_exercises_placeholder',
            'Comma-separated exercise names'
          )}
          value={draft.avoidExercisesText || ''}
          onInput={(event) => setField('avoidExercisesText', event.target.value)}
        />
        <div className="mt-[-4px] text-[11px] leading-[1.5] text-muted">
          {t(
            'onboarding.field.avoid_exercises_help',
            'Used to exclude obvious no-go exercises from the first recommendation and future session adaptation.'
          )}
        </div>
      </div>
    </div>
  );
}

function StepGuidance({ draft, setField }) {
  return (
    <div className={onboardingGridClass}>
      <div className={onboardingOptionGridClass}>
        {GUIDANCE_OPTIONS.map((opt) => (
          <OptionButton
            key={opt.value}
            active={draft.guidanceMode === opt.value}
            title={t(opt.key, opt.fallback)}
            description={t(opt.descKey, opt.descFallback)}
            onClick={() => setField('guidanceMode', opt.value)}
          />
        ))}
      </div>
    </div>
  );
}

function StepRecommendation({ draft }) {
  const recommendation = buildOnboardingRecommendation(draft);
  const getProgramById = programStore.getState().getProgramById;
  const getProgramDifficultyMeta = programStore.getState().getProgramDifficultyMeta;

  if (!recommendation) {
    return (
      <div className="onboarding-grid">
        <p>Loading recommendation...</p>
      </div>
    );
  }

  const programId = recommendation.programId || '';
  const program = getProgramById(programId);
  const programName = t('program.' + programId + '.name', program?.name || programId);
  const programDescription = t(
    'program.' + programId + '.description',
    program?.description || ''
  );
  const difficultyMeta = getProgramDifficultyMeta(programId);
  const difficultyLabel = difficultyMeta
    ? t(difficultyMeta.labelKey, difficultyMeta.fallback)
    : '';
  const weekCount = (recommendation.weekTemplate || []).length;
  const firstDuration = recommendation.weekTemplate?.[0]?.durationHint || '';
  const firstSessionLabel = /^\d+$/.test(String(recommendation.firstSessionOption || ''))
    ? t('onboarding.first_session_label', 'Session {value}', {
        value: recommendation.firstSessionOption,
      })
    : String(
        recommendation.firstSessionOption ||
          t('onboarding.first_session_default', 'Session 1')
      );
  const firstStepText = firstDuration
    ? t(
        'onboarding.recommend.first_step_with_time',
        'Start with {session} today. Keep it around {time}.',
        { session: firstSessionLabel, time: firstDuration }
      )
    : t(
        'onboarding.recommend.first_step_default',
        'Start with {session} today. Follow the first week below as your starting map.',
        { session: firstSessionLabel }
      );
  const fitReasons = (recommendation.fitReasons || []).slice(0, 3);
  const whyItems = (recommendation.why || []).slice(0, 2);
  const adjustments = (recommendation.initialAdjustments || []).slice(0, 2);

  return (
    <div className="onboarding-grid">
      <div className="onboarding-card onboarding-recommendation-hero">
        <div className="onboarding-kicker">
          {t('onboarding.recommend.kicker', 'Recommended Program')}
        </div>
        <div className="onboarding-title" style={{ fontSize: 20 }}>
          {programName}
        </div>
        <div className="onboarding-sub" style={{ marginTop: 8 }}>
          {programDescription ||
            t(
              'onboarding.recommend.sub',
              'This is the best starting point based on your goal, schedule, sport load, and desired guidance level.'
            )}
        </div>
        <div className="onboarding-recommendation-pills">
          {difficultyLabel && (
            <div className="onboarding-recommendation-pill">
              <span>{t('onboarding.recommend.level', 'Level')}</span>
              <strong>
                <span
                  className={`program-card-difficulty program-card-difficulty-${
                    difficultyMeta?.key || 'intermediate'
                  }`}
                >
                  {difficultyLabel}
                </span>
              </strong>
            </div>
          )}
          <div className="onboarding-recommendation-pill">
            <span>{t('onboarding.recommend.week1', 'Week 1')}</span>
            <strong>
              {t('onboarding.recommend.sessions', '{count} sessions', {
                count: weekCount,
              })}
            </strong>
          </div>
          <div className="onboarding-recommendation-pill">
            <span>{t('onboarding.recommend.start_here', 'Start here')}</span>
            <strong>{firstSessionLabel}</strong>
          </div>
          {firstDuration && (
            <div className="onboarding-recommendation-pill">
              <span>{t('onboarding.recommend.time_target', 'Time target')}</span>
              <strong>{firstDuration}</strong>
            </div>
          )}
        </div>
        {fitReasons.length > 0 && (
          <div className="onboarding-fit-block">
            <div className="onboarding-fit-title">
              {t('onboarding.fit.title', 'Why it fits you')}
            </div>
            <div className="onboarding-chip-row">
              {fitReasons.map((reason, idx) => (
                <div key={idx} className="onboarding-chip onboarding-fit-chip">
                  {reason}
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="onboarding-next-step">
          <div className="onboarding-next-step-kicker">
            {t('onboarding.recommend.first_step_kicker', 'First move')}
          </div>
          <div className="onboarding-next-step-body">{firstStepText}</div>
        </div>
        {adjustments.length > 0 && (
          <div className="onboarding-note" style={{ marginTop: 12 }}>
            {adjustments.join(' · ')}
          </div>
        )}
      </div>
      <div className="onboarding-card">
        <div className="card-title" style={{ marginBottom: 10 }}>
          {t('onboarding.recommend.why_title', 'Why this is your best start')}
        </div>
        <div className="onboarding-why-list">
          {whyItems.map((item, idx) => (
            <div key={idx} className="onboarding-why-item">
              {'• '}
              {item}
            </div>
          ))}
        </div>
      </div>
      <div className="onboarding-card">
        <div className="card-title" style={{ marginBottom: 10 }}>
          {t('onboarding.recommend.week_title', 'Your first week')}
        </div>
        <div className="onboarding-week-list">
          {(recommendation.weekTemplate || []).map((item, idx) => (
            <div key={idx} className="onboarding-week-item">
              <span>
                {item.dayLabel} · {item.type}
              </span>
              <span className="onboarding-week-meta">{item.durationHint}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function OnboardingFlow() {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(null);
  const [, setLanguageTick] = useState(0);
  const scrollRef = useRef(null);

  useEffect(() => {
    const onLanguage = () => setLanguageTick((value) => value + 1);
    window.addEventListener(LANGUAGE_EVENT, onLanguage);
    return () => window.removeEventListener(LANGUAGE_EVENT, onLanguage);
  }, []);

  useEffect(() => {
    const onEvent = () => {
      const snapshot =
        typeof window.getOnboardingDefaultDraft === 'function'
          ? window.getOnboardingDefaultDraft()
          : null;
      if (snapshot) {
        setDraft({ ...snapshot });
        setStep(0);
      }
    };

    onEvent();
    window.addEventListener(ONBOARDING_EVENT, onEvent);
    return () => window.removeEventListener(ONBOARDING_EVENT, onEvent);
  }, []);

  if (!draft) return null;

  const setField = (key, value) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const toggleArrayValue = (key, value) => {
    setDraft((prev) => {
      const current = new Set(prev[key] || []);
      if (current.has(value)) current.delete(value);
      else current.add(value);
      return { ...prev, [key]: [...current] };
    });
  };

  const goToStep = (nextStep) => {
    const clamped = Math.max(0, Math.min(STEP_COUNT - 1, nextStep));
    setStep(clamped);
    scrollRef.current?.scrollTo({ top: 0 });
  };

  const handlePrimary = () => {
    if (step === STEP_COUNT - 1) {
      window.completeOnboarding?.(draft);
      return;
    }
    goToStep(step + 1);
  };

  const handleSecondary = () => {
    if (step === 0) {
      window.dismissOnboardingModal?.();
      return;
    }
    goToStep(step - 1);
  };

  const primaryLabel =
    step === STEP_COUNT - 1
      ? t('onboarding.action.use_plan', 'Use This Plan')
      : t('onboarding.action.continue', 'Continue');
  const secondaryLabel =
    step === 0
      ? t('onboarding.action.not_now', 'Not now')
      : t('onboarding.action.back', 'Back');

  let stepContent = null;
  switch (step) {
    case 0:
      stepContent = <StepGoalExperience draft={draft} setField={setField} />;
      break;
    case 1:
      stepContent = <StepTrainingEnvelope draft={draft} setField={setField} />;
      break;
    case 2:
      stepContent = (
        <StepSportConstraints
          draft={draft}
          setField={setField}
          toggleArrayValue={toggleArrayValue}
        />
      );
      break;
    case 3:
      stepContent = <StepGuidance draft={draft} setField={setField} />;
      break;
    case 4:
      stepContent = <StepRecommendation draft={draft} />;
      break;
    default:
      stepContent = null;
  }

  return (
    <div className="grid min-h-0 gap-4" ref={scrollRef} data-ui="onboarding-flow">
      <ProgressPills step={step} />
      <div>
        <div className="text-[10px] font-extrabold uppercase tracking-[1.2px] text-gold">
          {t('onboarding.kicker', 'Guided Setup')}
        </div>
        <div className="text-2xl leading-[1.1] font-black tracking-[-0.04em] max-[480px]:text-[21px]">
          {getStepTitle(step)}
        </div>
        <div className="text-[13px] leading-[1.55] text-muted">{getStepSub(step)}</div>
      </div>
      {stepContent}
      <div className="sticky bottom-0 grid grid-cols-2 gap-2.5 bg-[linear-gradient(180deg,rgba(11,14,22,0),rgba(11,14,22,0.92)_22%,rgba(11,14,22,0.98))] pt-2.5 max-[480px]:pb-[calc(6px+var(--sab))]">
        <button className={secondaryButtonClass} type="button" onClick={handleSecondary}>
          {secondaryLabel}
        </button>
        <button className={primaryButtonClass} type="button" onClick={handlePrimary}>
          {primaryLabel}
        </button>
      </div>
    </div>
  );
}
