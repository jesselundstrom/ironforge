import { useEffect, useState } from 'react';
import { useStore } from 'zustand';
import { workoutStore } from '../stores/workout-store';
import { programStore } from '../stores/program-store';
import { dataStore } from '../stores/data-store';
import { profileStore } from '../stores/profile-store';
import { t } from './services/i18n';

function StartView() {
  const programState = useStore(programStore, (state) => state);
  const workouts = useStore(dataStore, (state) => state.workouts);
  const schedule = useStore(profileStore, (state) => state.schedule);
  const [selectedOption, setSelectedOption] = useState('');

  const options =
    typeof programState.activeProgram?.getSessionOptions === 'function'
      ? programState.activeProgram.getSessionOptions(
          programState.activeProgramState || {},
          workouts || [],
          schedule || {}
        )
      : [];

  useEffect(() => {
    if (selectedOption) return;
    const nextOption =
      options.find((option) => option.isRecommended)?.value ||
      options.find((option) => option.done !== true)?.value ||
      options[0]?.value ||
      '';
    setSelectedOption(nextOption);
  }, [options, selectedOption]);

  return (
    <div className="grid gap-4" id="log-start-react-root">
      <div id="workout-not-started" className="grid gap-4">
      <section className="rounded-card border border-border bg-surface p-4 shadow-card">
        <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
          {t('log.program.kicker', 'Current Program')}
        </div>
        <div className="text-2xl font-black tracking-[-0.04em] text-text">
          {programState.activeProgram?.name || 'Forge'}
        </div>
        <div className="mt-2 text-sm leading-6 text-muted">
          {programState.activeProgram?.description ||
            t(
              'log.program.sub',
              'Choose today’s session and start logging from the React runtime.'
            )}
        </div>
      </section>

      <section className="rounded-card border border-border bg-surface p-4 shadow-card">
        <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
          {t('log.start.kicker', 'Pick Today’s Session')}
        </div>
        <div className="grid gap-3" id="program-day-options">
          {(options.length ? options : [{ value: '1', label: 'Session 1' }]).map((option) => {
            const active = selectedOption === option.value;
            return (
              <button
                key={option.value}
                type="button"
                data-option-value={option.value}
                className={`program-day-option rounded-2xl border p-4 text-left transition ${
                  active
                    ? 'border-accent bg-[rgba(245,130,31,0.10)]'
                    : 'border-border bg-white/[0.02]'
                }`}
                onClick={() => setSelectedOption(option.value)}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-base font-bold text-text">{option.label}</div>
                  {option.isRecommended ? (
                    <span className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
                      {t('log.recommended', 'Recommended')}
                    </span>
                  ) : null}
                </div>
                {option.preferenceReasons?.length ? (
                  <div className="mt-2 text-sm text-muted">
                    {option.preferenceReasons.join(' · ')}
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
        <button
          data-ui="training-start-button"
          className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-[linear-gradient(180deg,#ff983d,#f5821f)] px-4 py-3 font-condensed text-base font-bold uppercase tracking-[0.05em] text-white"
          type="button"
          onClick={() => workoutStore.getState().startWorkout(selectedOption)}
        >
          {t('log.start_now', 'Start Workout')}
        </button>
      </section>
      </div>
    </div>
  );
}

function ActiveWorkoutView() {
  const workout = useStore(workoutStore, (state) => state.activeWorkout);
  const restDuration = useStore(workoutStore, (state) => state.restDuration);
  const restSecondsLeft = useStore(workoutStore, (state) => state.restSecondsLeft);
  const [newExerciseName, setNewExerciseName] = useState('');

  if (!workout) return null;

  return (
    <div className="grid gap-4" id="log-active-react-root">
      <div className="grid gap-4" id="workout-active">
      <section className="rounded-card border border-border bg-surface p-4 shadow-card">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
              {t('log.active.kicker', 'In Progress')}
            </div>
            <div className="active-session-title mt-1 text-2xl font-black tracking-[-0.04em] text-text">
              {workout.sessionDescription || workout.programLabel || 'Workout'}
            </div>
          </div>
          {restSecondsLeft > 0 ? (
            <div className="rounded-2xl border border-accent/30 bg-accent/10 px-3 py-2 text-right">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
                {t('workout.rest_timer', 'Rest')}
              </div>
              <div className="text-lg font-black text-text">{restSecondsLeft}s</div>
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {[60, 90, 120, 180].map((value) => (
            <button
              key={value}
              type="button"
              className={`rounded-full border px-3 py-2 text-sm font-bold ${
                restDuration === value
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border bg-white/[0.02] text-text'
              }`}
              onClick={() => workoutStore.getState().updateRestDuration(value)}
            >
              {value === 60
                ? '1 min'
                : value === 90
                  ? '90 s'
                  : value === 120
                    ? '2 min'
                    : '3 min'}
            </button>
          ))}
          <button
            type="button"
            className="rounded-full border border-border bg-white/[0.02] px-3 py-2 text-sm font-bold text-text"
            onClick={() => workoutStore.getState().skipRest()}
          >
            {t('common.skip', 'Skip')}
          </button>
        </div>
      </section>

      <div className="grid gap-4">
        {workout.exercises.map((exercise, exerciseIndex) => (
          <section
            key={`${exercise.name}-${exerciseIndex}`}
            className="exercise-block rounded-card border border-border bg-surface p-4 shadow-card"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-bold text-text">{exercise.name}</div>
                {exercise.note ? (
                  <div className="mt-1 text-sm text-muted">{exercise.note}</div>
                ) : null}
              </div>
              <button
                type="button"
                className="text-sm font-bold text-red"
                onClick={() => workoutStore.getState().removeExercise(exerciseIndex)}
              >
                {t('common.delete', 'Delete')}
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              {exercise.sets.map((set, setIndex) => (
                <div
                  key={`${exerciseIndex}-${setIndex}`}
                  className="grid grid-cols-[50px_1fr_1fr_72px] gap-2"
                >
                  <div className="flex items-center text-sm font-bold text-muted">
                    {setIndex + 1}
                  </div>
                  <input
                    data-field="weight"
                    className="h-12 rounded-xl border border-border bg-white/[0.03] px-3 text-text"
                    type="number"
                    inputMode="decimal"
                    placeholder={t('workout.weight', 'kg')}
                    value={String(set.weight ?? '')}
                    onChange={(event) =>
                      workoutStore
                        .getState()
                        .updateSet(exerciseIndex, setIndex, 'weight', event.target.value)
                    }
                  />
                  <input
                    data-field="reps"
                    className="h-12 rounded-xl border border-border bg-white/[0.03] px-3 text-text"
                    type="number"
                    inputMode="numeric"
                    placeholder={t('workout.reps', 'reps')}
                    value={String(set.reps ?? '')}
                    onChange={(event) =>
                      workoutStore
                        .getState()
                        .updateSet(exerciseIndex, setIndex, 'reps', event.target.value)
                    }
                  />
                  <button
                    type="button"
                    className={`set-check h-12 rounded-xl border px-3 text-sm font-bold ${
                      set.done
                        ? 'done border-green bg-green/15 text-green'
                        : 'border-border bg-white/[0.03] text-text'
                    }`}
                    onClick={() => workoutStore.getState().toggleSet(exerciseIndex, setIndex)}
                  >
                    {set.done ? t('common.done', 'Done') : t('common.mark', 'Mark')}
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              data-action="add-set"
              className="mt-4 rounded-xl border border-border bg-white/[0.03] px-4 py-3 text-sm font-bold text-text"
              onClick={() => workoutStore.getState().addSet(exerciseIndex)}
            >
              {t('workout.add_set', 'Add Set')}
            </button>
          </section>
        ))}
      </div>

      <section className="rounded-card border border-border bg-surface p-4 shadow-card">
        <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
          {t('workout.add_exercise', 'Add Exercise')}
        </div>
        <div className="flex gap-2">
          <input
            data-field="exercise-name"
            className="h-12 flex-1 rounded-xl border border-border bg-white/[0.03] px-3 text-text"
            type="text"
            placeholder={t('workout.exercise_name', 'Exercise name')}
            value={newExerciseName}
            onChange={(event) => setNewExerciseName(event.target.value)}
          />
          <button
            type="button"
            className="rounded-xl border border-border bg-white/[0.03] px-4 py-3 text-sm font-bold text-text"
            onClick={() => {
              if (!newExerciseName.trim()) return;
              workoutStore.getState().addExerciseByName(newExerciseName.trim());
              setNewExerciseName('');
            }}
          >
            {t('common.add', 'Add')}
          </button>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-[linear-gradient(180deg,#ff983d,#f5821f)] px-4 py-3 font-condensed text-base font-bold uppercase tracking-[0.05em] text-white"
          type="button"
          onClick={() => void workoutStore.getState().finishWorkout()}
        >
          {t('workout.finish', 'Finish Workout')}
        </button>
        <button
          className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-border bg-white/[0.03] px-4 py-3 font-condensed text-base font-bold uppercase tracking-[0.05em] text-text"
          type="button"
          onClick={() => workoutStore.getState().cancelWorkout()}
        >
          {t('workout.cancel', 'Discard Workout')}
        </button>
      </div>
      </div>
    </div>
  );
}

export default function TrainingPage() {
  const hasActiveWorkout = useStore(workoutStore, (state) => state.hasActiveWorkout);
  return hasActiveWorkout ? <ActiveWorkoutView /> : <StartView />;
}
