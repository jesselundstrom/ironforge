// Shared HTML-escape utility (available to all layers)
function escapeHtml(text) {
  return String(text ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// Shared date utilities (available to all layers)
const MS_PER_DAY = 864e5;
function getWeekStart(date) {
  const d = new Date(date || new Date());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  d.setHours(0, 0, 0, 0);
  return d;
}
function daysSince(dateStr) {
  return (Date.now() - new Date(dateStr).getTime()) / MS_PER_DAY;
}

// Lightweight runtime i18n helper with per-string fallback.
(function () {
  'use strict';

  const FALLBACK_LOCALE = 'en';
  const SUPPORTED_LOCALES = ['en', 'fi'];
  const STORAGE_KEY = 'ic_lang';

  const STRINGS = {
    en: {
      'common.undo': 'Undo',
      'common.reload': 'Reload',
      'common.confirm': 'Confirm',
      'common.cancel': 'Cancel',
      'common.add': 'Add',
      'common.save': 'Save',
      'common.done': 'Done',
      'common.delete': 'Delete',
      'common.off': 'Off',
      'common.skip': 'Skip',
      'common.sets': 'sets',
      'common.loading': 'Loading...',
      'common.today': 'Today',
      'common.session': 'Session',
      'common.workout': 'Workout',
      'common.sport': 'Sport',
      'common.cardio': 'Cardio',
      'common.log': 'Log',
      'nav.dashboard': 'Dashboard',
      'nav.train': 'Train',
      'nav.log': 'Log',
      'nav.history': 'History',
      'nav.settings': 'Settings',
      'login.email': 'Email',
      'login.password': 'Password',
      'login.sign_in': 'Sign In',
      'login.create_account': 'Create Account',
      'login.enter_credentials': 'Enter your email and password.',
      'login.password_short': 'Password must be at least 6 characters.',
      'login.checking_session': 'Checking your session...',
      'login.signing_in': 'Signing in...',
      'login.creating_account': 'Creating account...',
      'login.account_created':
        'Account created! Check your email to confirm, then sign in.',
      'login.finish_error': 'Unable to finish signing in right now.',
      'login.sign_in_error': 'Unable to sign in right now.',
      'login.sign_up_error': 'Unable to create account right now.',
      'login.sign_out_error': 'Unable to sign out right now.',
      'pwa.update.available': 'A new version of Ironforge is ready.',
      'pwa.update.refresh': 'Refresh',
      'pwa.update.refreshing': 'Refreshing...',
      'pwa.update.applying': 'Updating Ironforge...',
      'modal.confirm.title': 'Confirm',
      'modal.confirm.ok': 'Confirm',
      'modal.confirm.cancel': 'Cancel',
      'modal.confirm.message': 'Are you sure?',
      'shell.error.title': 'Something went wrong.',
      'shell.header.loading': 'Forge Protocol · Loading...',
      'modal.name.title': 'Add Exercise',
      'modal.name.sub': 'Enter the exercise name',
      'modal.name.placeholder': 'e.g. Back Squat',
      'modal.name.add': 'Add',
      'catalog.title.add': 'Add Exercise',
      'catalog.title.swap': 'Swap Exercise',
      'catalog.sub': 'Pick an exercise from the library or search by name.',
      'catalog.sub.swap':
        'Showing options limited by {name} and the current program rules.',
      'catalog.search.placeholder': 'Search exercises',
      'catalog.clear_filters': 'Clear',
      'catalog.empty': 'No exercises matched your filters.',
      'catalog.section.empty': 'No exercises in this section yet.',
      'catalog.section.recent': 'Recently Used',
      'catalog.section.recent_empty':
        'Log a few workouts and your recent exercises will show up here.',
      'catalog.section.featured': 'Popular Basics',
      'catalog.section.all': 'All Exercises',
      'catalog.section.results': 'Results',
      'catalog.section.swap': 'Available Options',
      'catalog.filter.all': 'All',
      'catalog.filter_group.movement': 'Movement',
      'catalog.filter_group.muscle': 'Muscle',
      'catalog.filter_group.equipment': 'Equipment',
      'catalog.filter.movement.squat': 'Squat',
      'catalog.filter.movement.hinge': 'Hinge',
      'catalog.filter.movement.horizontal_press': 'Horizontal Press',
      'catalog.filter.movement.vertical_press': 'Vertical Press',
      'catalog.filter.movement.horizontal_pull': 'Horizontal Pull',
      'catalog.filter.movement.vertical_pull': 'Vertical Pull',
      'catalog.filter.movement.single_leg': 'Single-Leg',
      'catalog.filter.movement.core': 'Core',
      'catalog.filter.equipment.barbell': 'Barbell',
      'catalog.filter.equipment.dumbbell': 'Dumbbell',
      'catalog.filter.equipment.machine': 'Machine',
      'catalog.filter.equipment.cable': 'Cable',
      'catalog.filter.equipment.bodyweight': 'Bodyweight',
      'catalog.filter.equipment.pullup_bar': 'Pull-up Bar',
      'catalog.filter.equipment.band': 'Band',
      'catalog.filter.equipment.trap_bar': 'Trap Bar',
      'dashboard.today_plan': "Today's Plan",
      'dashboard.nutrition': 'Nutrition',
      'dashboard.nutrition.calories': 'Calories',
      'dashboard.nutrition.protein': 'Protein',
      'dashboard.nutrition.empty': 'No meals tracked today',
      'dashboard.nutrition.log_meal': 'Log a meal',
      'dashboard.nutrition.meals': '{count} meals tracked',
      'dashboard.recovery': 'Recovery',
      'dashboard.muscular': 'Muscular',
      'dashboard.nervous': 'Nervous',
      'dashboard.overall': 'Overall',
      'dashboard.recovery.simple_good': "You're well recovered",
      'dashboard.recovery.simple_moderate': 'Moderate — listen to your body',
      'dashboard.recovery.simple_low': 'Take it easy today',
      'dashboard.log_to_see': 'Log workouts to see data',
      'dashboard.maxes': 'Maxes',
      'dashboard.fully_recovered': 'Fully Recovered',
      'dashboard.mostly_recovered': 'Mostly Recovered',
      'dashboard.partially_fatigued': 'Partially Fatigued',
      'dashboard.high_fatigue': 'High Fatigue',
      'dashboard.badge.go': 'GO',
      'dashboard.badge.caution': 'Moderate',
      'dashboard.badge.rest': 'REST',
      'dashboard.status.workout_plus_sport_logged': 'Workout + {sport} logged',
      'dashboard.status.workout_logged': 'Workout logged',
      'dashboard.status.sport_logged': '{sport} logged',
      'dashboard.status.sport_day': '{sport} day',
      'dashboard.no_session_logged': 'No session logged',
      'dashboard.training_maxes': 'Training Maxes',
      'dashboard.sessions': '{done}/{total} sessions',
      'dashboard.sessions_done': 'All {total} sessions done. Rest up.',
      'dashboard.week_complete': 'Week complete!',
      'dashboard.high_fatigue_title': 'High fatigue - rest or deload',
      'dashboard.recovery_pct': 'Recovery {recovery}%',
      'dashboard.sport_day_advice':
        'Pick an upper-body day on the Log tab, or rest.',
      'dashboard.post_sport': 'Post-{sport}',
      'dashboard.post_sport_advice':
        'Legs may be fatigued. The Log tab will suggest an upper-focused day.',
      'dashboard.deload_week': 'Deload week',
      'dashboard.training_day': 'Training day',
      'dashboard.feeling_fresh': 'feeling fresh, push it',
      'dashboard.moderate_effort': 'moderate effort',
      'dashboard.start_session': 'Start Session',
      'dashboard.simple.start': 'Start Your Workout',
      'dashboard.header_sub':
        '{program} - {block} - {week} - Recovery {recovery}%',
      'dashboard.plan.deload':
        'Recovery is lagging, so keep today light and treat it like a deload. {count} sessions remain this week.',
      'dashboard.plan.train_light': 'Train lighter today',
      'dashboard.plan.train_light_body':
        'You can still train, but keep the effort conservative and avoid unnecessary grinding. {count} sessions remain this week.',
      'dashboard.plan.shorten': 'Short session today',
      'dashboard.plan.shorten_body':
        'Use your main work first and trim accessories to stay inside your time cap. {count} sessions remain this week.',
      'dashboard.plan.avoid_legs':
        'Sport load is high around today, so bias the session away from heavy leg work when possible. {count} sessions remain this week.',
      'dashboard.plan.train':
        'Recovery looks good enough to train normally today. {count} sessions remain this week.',
      'dashboard.today_done': "Today's work is done",
      'dashboard.today_done_badge': 'Done for today',
      'dashboard.today_done_coach_title': 'Nice work',
      'dashboard.today_done_coach_body':
        "Today's main work is already handled. Let recovery do its job and come back fresh for the next session.",
      'dashboard.today_done_body':
        "Today's lifting session is already logged. Nice work. Let recovery do its job and come back sharp for the next session.",
      'dashboard.today_done_body_multi':
        "You've already logged {count} lifting sessions today. Nice work. Let recovery do its job and come back fresh for the next one.",
      'dashboard.today_done_with_sport':
        "Today's lifting session and sport work are already logged. Strong day. Give recovery some room to do its job now.",
      'common.program': 'Program',
      'training.commentary.workout.kicker': "Today's decision",
      'training.commentary.rest.title': 'Week complete!',
      'training.commentary.rest.dashboard_summary':
        'All planned sessions are already done this week. Rest and recover.',
      'training.commentary.rest.dashboard_focus_support':
        'All planned sessions are already done this week. Rest and recover.',
      'training.commentary.rest.dashboard_coach':
        'All planned sessions are already done this week. Rest and recover.',
      'training.commentary.rest.workout_summary':
        'This week is already covered. Keep today for recovery.',
      'training.commentary.rest.workout_start_toast': 'Week complete!',
      'training.commentary.rest.program_warning':
        'The planned work for this week is already complete. Recovery is the better call today.',
      'training.commentary.deload.title': 'Deload recommendation',
      'training.commentary.deload.dashboard_summary':
        'Recovery is lagging, so keep today light and treat it like a deload. {count} sessions remain this week.',
      'training.commentary.deload.dashboard_focus_support':
        'Recovery is lagging, so keep today light and treat it like a deload. {count} sessions remain this week.',
      'training.commentary.deload.dashboard_coach':
        'Recovery is lagging, so keep today light and treat it like a deload. {count} sessions remain this week.',
      'training.commentary.deload.workout_summary':
        'Recovery is low, so keep today lighter than normal and reduce grinding.',
      'training.commentary.deload.workout_start_toast': 'Deload recommendation',
      'training.commentary.deload.program_warning':
        'Recovery is low enough that a lighter option is the safer call today.',
      'training.commentary.train_light.title': 'Conservative training day',
      'training.commentary.train_light.dashboard_summary':
        'You can still train, but keep the effort conservative and avoid unnecessary grinding. {count} sessions remain this week.',
      'training.commentary.train_light.dashboard_focus_support':
        'You can still train, but keep the effort conservative and avoid unnecessary grinding. {count} sessions remain this week.',
      'training.commentary.train_light.dashboard_coach':
        'You can still train, but keep the effort conservative and avoid unnecessary grinding. {count} sessions remain this week.',
      'training.commentary.train_light.workout_summary':
        'Train today, but keep the effort conservative and let the session breathe.',
      'training.commentary.train_light.workout_start_toast':
        'Conservative training day',
      'training.commentary.train_light.program_warning':
        'You can still train, but keep the physiological cost conservative today.',
      'training.commentary.shorten.title': 'Short session plan',
      'training.commentary.shorten.dashboard_summary':
        'Use your main work first and trim accessories to stay inside your time cap. {count} sessions remain this week.',
      'training.commentary.shorten.dashboard_focus_support':
        'Use your main work first and trim accessories to stay inside your time cap. {count} sessions remain this week.',
      'training.commentary.shorten.dashboard_coach':
        'Use your main work first and trim accessories to stay inside your time cap. {count} sessions remain this week.',
      'training.commentary.shorten.workout_summary':
        'Main work first. Accessories will be trimmed to fit your time cap.',
      'training.commentary.shorten.workout_start_toast': 'Short session plan',
      'training.commentary.shorten.program_warning':
        'Stay on the high-value work first and let accessories flex if time gets tight.',
      'training.commentary.sport_aware.title': 'Sport-aware session',
      'training.commentary.sport_aware.dashboard_summary':
        'Sport load is high around today, so bias the session away from heavy leg work when possible. {count} sessions remain this week.',
      'training.commentary.sport_aware.dashboard_focus_support':
        'Sport load is high around today, so bias the session away from heavy leg work when possible. {count} sessions remain this week.',
      'training.commentary.sport_aware.dashboard_coach':
        'Sport load is high around today, so bias the session away from heavy leg work when possible. {count} sessions remain this week.',
      'training.commentary.sport_aware.workout_summary':
        '{sport} load is high around today, so heavier leg work may be trimmed.',
      'training.commentary.sport_aware.workout_start_toast':
        'Sport-aware session',
      'training.commentary.sport_aware.program_warning':
        'Sport load is high enough that heavy lower-body work should stay under control today.',
      'training.commentary.train.title': 'Training day',
      'training.commentary.train.dashboard_summary':
        'Recovery looks good enough to train normally today. {count} sessions remain this week.',
      'training.commentary.train.dashboard_focus_support':
        'Recovery looks good enough to train normally today. {count} sessions remain this week.',
      'training.commentary.train.dashboard_coach':
        'Recovery looks good enough to train normally today. {count} sessions remain this week.',
      'training.commentary.train.workout_summary':
        'Your plan can run normally today.',
      'training.commentary.train.workout_start_toast': 'Training day',
      'training.commentary.train.program_warning':
        'Training can run normally today.',
      'training.reason.low_recovery.label': 'Low recovery',
      'training.reason.conservative_recovery.label': 'Recovery caution',
      'training.reason.tight_time_budget.label': '35 min cap',
      'training.reason.sport_load.label': 'Sport load',
      'training.reason.equipment_constraint.label': 'Equipment',
      'training.reason.progression_stall.label': 'Progress stall',
      'training.reason.guided_beginner.label': 'Guided path',
      'training.reason.week_complete.label': 'Week complete',
      'training.reason.session_feedback_hard.label': 'Felt hard',
      'training.reason.session_feedback_easy.label': 'Felt easy',
      'training.reason.duration_friction.label': 'Running long',
      'training.adjustment.short_session_accessories_trimmed.body':
        'Accessory work trimmed for a shorter session.',
      'training.adjustment.aux_volume_reduced.body':
        'Auxiliary volume reduced to fit your time cap.',
      'training.adjustment.sport_support_trimmed.body':
        'Accessory work removed to keep the session sharper for sport support.',
      'training.adjustment.sport_today.body':
        "Keeps lower-body work more manageable around today's sport.",
      'training.adjustment.sport_tomorrow.body':
        'Tomorrow looks leg-heavy, so lower-body work was kept slightly lighter.',
      'training.adjustment.sport_yesterday.body':
        'Yesterday was leg-heavy, so lower-body work was kept lighter today.',
      'training.adjustment.sport_both.body':
        'Leg-heavy sport sits on both sides of this session, so lower-body work was trimmed.',
      'training.adjustment.exercise_replaced_equipment.body':
        'Swapped {from} to {to} to match your available equipment.',
      'training.adjustment.exercise_replaced_limit.body':
        'Swapped {from} to {to} to respect your current limits.',
      'training.adjustment.exercise_removed_limit.body':
        'Removed {exercise} because it conflicts with your current limits.',
      'training.adjustment.program_sport_trimmed.body':
        '{program} trimmed lower-body auxiliary work first because sport load is close.',
      'training.adjustment.program_shoulder_trimmed.body':
        'Shoulder-sensitive vertical assistance was deprioritized for this session.',
      'training.adjustment.runner_shorten.body':
        'Lower-priority work was cut so you can finish the essential work faster.',
      'training.adjustment.runner_lighten.body':
        'Keep the session moving, but leave more in the tank with slightly lighter remaining work.',
      'training.equipment.swap_hint.body':
        'Use exercise swap freely if your setup does not match the planned lift exactly.',
      'training.equipment.same_pattern_swaps.body':
        '{program} will prioritize same-pattern substitutions before dropping work.',
      'training.runner.kicker': 'Session plan',
      'training.runner.normal.title': 'Normal session flow',
      'training.runner.normal.copy':
        'Stay on the main work and move through the remaining sets in order.',
      'training.runner.shorten.title': 'Shortened session',
      'training.runner.shorten.copy':
        'Lower-priority work was cut so you can finish the essential work faster.',
      'training.runner.shorten.toast':
        'Session shortened to the essential work',
      'training.runner.lighten.title': 'Lighter session',
      'training.runner.lighten.copy':
        'Keep the session moving, but leave more in the tank with slightly lighter remaining work.',
      'training.runner.lighten.toast': 'Remaining work lightened',
      'training.runner.sport_aware.title': 'Sport-aware session',
      'training.runner.sport_aware.copy':
        'Leg-heavy work is being kept under control because of surrounding sport load.',
      'training.runner.undo.toast': 'Last adjustment undone',
      'training.runner.no_change.toast': 'No remaining work needed adjustment',
      'dashboard.reason.low_recovery': 'Low recovery',
      'dashboard.reason.conservative': 'Recovery caution',
      'dashboard.reason.time_budget': '35 min cap',
      'dashboard.reason.sport_load': 'Sport load',
      'dashboard.reason.equipment': 'Equipment',
      'dashboard.reason.stall': 'Progress stall',
      'dashboard.reason.guided': 'Guided path',
      'dashboard.reason.complete': 'Week complete',
      'dashboard.insights.title': 'Coach note',
      'dashboard.insights.keep_going': 'Keep going',
      'dashboard.insights.adherence': '30d adherence',
      'dashboard.insights.best_days': 'Best days',
      'dashboard.insights.best_days_line': 'You naturally land most sessions on {days}.',
      'dashboard.insights.sessions_90': '90d sessions',
      'dashboard.insights.friction': 'Friction flags',
      'dashboard.insights.state.continue': 'On track',
      'dashboard.insights.state.shorten': 'Shorten',
      'dashboard.insights.state.lighten': 'Lighten',
      'dashboard.insights.state.deload': 'Deload',
      'dashboard.insights.state.switch_block': 'Switch block',
      'dashboard.insights.show_more': 'Show details',
      'dashboard.insights.show_less': 'Hide details',
      'dashboard.weekly_sessions': 'Weekly sessions',
      'dashboard.week_plan.title': 'Week Preview',
      'dashboard.week_plan.train': 'Train',
      'dashboard.week_plan.sport': 'Sport',
      'dashboard.week_plan.rest': 'Rest',
      'dashboard.week_plan.missed': 'Missed',
      'dashboard.week_plan.done': 'Done',
      'rest_day.head': 'Recovery',
      'rest_day.category.sleep': 'Sleep',
      'rest_day.category.hydration': 'Hydration',
      'rest_day.category.mobility': 'Mobility',
      'rest_day.category.active_recovery': 'Active recovery',
      'rest_day.category.mental': 'Mental reset',
      'rest_day.tip.1': "Protect tonight's sleep and let recovery lead.",
      'rest_day.tip.2': 'A steady bedtime makes tomorrow feel easier.',
      'rest_day.tip.3': 'Trade late scrolling for a quieter evening.',
      'rest_day.tip.4': 'Good recovery is often just food, calm, and sleep.',
      'rest_day.tip.5': 'Start the day with water and stay ahead of thirst.',
      'rest_day.tip.6': 'Sip through the day instead of catching up at night.',
      'rest_day.tip.7':
        'After a hard session, extra fluids help more than you think.',
      'rest_day.tip.8': 'Keep a bottle nearby and make hydration automatic.',
      'rest_day.tip.9': 'Five easy minutes of mobility is enough today.',
      'rest_day.tip.10':
        'Move gently and finish feeling better than you started.',
      'rest_day.tip.11': 'Pick one tight area and give it focused attention.',
      'rest_day.tip.12': 'Use long exhales to relax into each position.',
      'rest_day.tip.13': 'A short walk is plenty for active recovery.',
      'rest_day.tip.14': 'Light movement usually beats doing nothing.',
      'rest_day.tip.15': 'Keep today easy enough that energy comes back.',
      'rest_day.tip.16': 'Recovery work should feel almost too easy.',
      'rest_day.tip.17': 'Rest days count. They are part of the plan.',
      'rest_day.tip.18': 'Use today to notice what worked this week.',
      'rest_day.tip.19': 'Discipline also means skipping junk fatigue.',
      'rest_day.tip.20':
        'Progress comes from training well and recovering on purpose.',
      'dashboard.progress_complete': 'Week target complete',
      'dashboard.progress_remaining_one': '1 session left this week',
      'dashboard.progress_remaining_many': '{count} sessions left this week',
      'dashboard.sport_sessions_week':
        '{count} {sport} sessions logged this week',
      'dashboard.calendar.legend_lift': 'Workout logged',
      'dashboard.calendar.legend_sport': 'Sport session logged',
      'dashboard.calendar.legend_scheduled': 'Scheduled sport day',
      'dashboard.calendar.legend_hint': 'Tap a day for details',
      'onboarding.kicker': 'Guided Setup',
      'onboarding.action.use_plan': 'Use This Plan',
      'onboarding.action.not_now': 'Not now',
      'onboarding.action.continue': 'Continue',
      'onboarding.action.back': 'Back',
      'onboarding.step.0.title': 'Build your starting point',
      'onboarding.step.0.sub':
        'This gives the assistant enough signal to recommend the right starting plan.',
      'onboarding.step.1.title': 'Set your training envelope',
      'onboarding.step.1.sub':
        'These limits drive frequency, session trimming, and program fit.',
      'onboarding.step.2.title': 'Add sport and constraints',
      'onboarding.step.2.sub':
        'Tell the assistant what has to be respected, especially your regular sport and real constraints.',
      'onboarding.step.3.title': 'Choose your guidance level',
      'onboarding.step.3.sub':
        'This sets how opinionated the app should be when making decisions.',
      'onboarding.step.4.title': 'Start from a real plan',
      'onboarding.step.4.sub':
        'You should leave onboarding with a clear program, first week, and first session.',
      'onboarding.field.goal': 'Primary Goal',
      'onboarding.field.experience': 'Experience Level',
      'onboarding.field.frequency': 'Training Frequency',
      'onboarding.field.duration': 'Session Length',
      'onboarding.field.equipment': 'Equipment Access',
      'onboarding.field.sport': 'Sport or Cardio',
      'onboarding.field.sport_placeholder': 'e.g. Hockey, Running, Soccer',
      'onboarding.field.sport_help':
        'Add your regular sport or other recurring hobby here if it affects recovery during the week.',
      'onboarding.field.sport_sessions': 'Sessions / Week',
      'onboarding.field.in_season': 'In season',
      'onboarding.field.in_season_help':
        'Use a more conservative starting point when sport is a real load right now.',
      'onboarding.field.joints': 'Joint Flags',
      'onboarding.field.movements': 'Avoid Movement Patterns',
      'onboarding.field.avoid_exercises': 'Avoided Exercises',
      'onboarding.field.avoid_exercises_placeholder':
        'Comma-separated exercise names',
      'onboarding.field.avoid_exercises_help':
        'Used to exclude obvious no-go exercises from the first recommendation and future session adaptation.',
      'onboarding.goal.strength': 'Strength',
      'onboarding.goal.strength_desc': 'Improve main lifts and progression.',
      'onboarding.goal.hypertrophy': 'Hypertrophy',
      'onboarding.goal.hypertrophy_desc':
        'Bias training toward muscle gain and volume.',
      'onboarding.goal.general_fitness': 'General Fitness',
      'onboarding.goal.general_fitness_desc':
        'Keep training sustainable and broadly useful.',
      'onboarding.goal.sport_support': 'Sport Support',
      'onboarding.goal.sport_support_desc':
        'Fit lifting around outside sport or cardio load.',
      'onboarding.experience.beginner': 'Beginner',
      'onboarding.experience.beginner_desc':
        'You want simple defaults and low complexity.',
      'onboarding.experience.returning': 'Previously Trained',
      'onboarding.experience.returning_desc':
        'You have trained before and want a stable rhythm back in.',
      'onboarding.experience.intermediate': 'Intermediate',
      'onboarding.experience.intermediate_desc':
        'You can handle a bit more structure and moderate autoregulation.',
      'onboarding.experience.advanced': 'Advanced',
      'onboarding.experience.advanced_desc':
        'You want a higher ceiling, more nuance, and more planning freedom.',
      'onboarding.frequency_value': '{count} sessions / week',
      'onboarding.duration_value': '{count} min',
      'onboarding.equipment.full_gym': 'Full Gym',
      'onboarding.equipment.basic_gym': 'Basic Gym',
      'onboarding.equipment.home_gym': 'Home Gym',
      'onboarding.equipment.minimal': 'Minimal Equipment',
      'onboarding.guidance.guided': 'Tell me what to do',
      'onboarding.guidance.guided_desc':
        'Strong default recommendations, less manual decision-making.',
      'onboarding.guidance.balanced': 'Balanced',
      'onboarding.guidance.balanced_desc':
        'Good defaults, but still leaves room to steer the plan.',
      'onboarding.guidance.self_directed': 'Give me control',
      'onboarding.guidance.self_directed_desc':
        'Lighter guidance and more room for manual choices.',
      'onboarding.joint.shoulder': 'Shoulder',
      'onboarding.joint.knee': 'Knee',
      'onboarding.joint.low_back': 'Low Back',
      'onboarding.movement.squat': 'Squat',
      'onboarding.movement.hinge': 'Hinge',
      'onboarding.movement.vertical_press': 'Overhead Press',
      'onboarding.movement.single_leg': 'Single-Leg',
      'onboarding.recommend.kicker': 'Recommended Program',
      'onboarding.recommend.sub':
        'This is the best starting point based on your goal, schedule, sport load, and desired guidance level.',
      'onboarding.recommend.week1': 'Week 1',
      'onboarding.recommend.sessions': '{count} sessions',
      'onboarding.recommend.level': 'Level',
      'onboarding.recommend.start_here': 'Start here',
      'onboarding.recommend.time_target': 'Time target',
      'onboarding.recommend.first_step_kicker': 'First move',
      'onboarding.recommend.first_step_with_time':
        'Start with {session} today. Keep it around {time}.',
      'onboarding.recommend.first_step_default':
        'Start with {session} today. Follow the first week below as your starting map.',
      'onboarding.fit.title': 'Why it fits you',
      'onboarding.fit.goal.hypertrophy': 'Goal: Hypertrophy',
      'onboarding.fit.goal.strength': 'Goal: Strength',
      'onboarding.fit.goal.general_fitness': 'Goal: General fitness',
      'onboarding.fit.goal.sport_support': 'Goal: Sport support',
      'onboarding.fit.frequency': '{count} sessions / week',
      'onboarding.fit.guided': 'Guided',
      'onboarding.fit.self_directed': 'Flexible',
      'onboarding.fit.in_season': 'In-season aware',
      'onboarding.recommend.why_title': 'Why this is your best start',
      'onboarding.recommend.week_title': 'Your first week',
      'onboarding.recommend.start_title': 'Start with this session',
      'onboarding.recommend.start_body':
        'This gives you the clearest on-ramp into the plan and keeps the first week realistic.',
      'onboarding.first_session_label': 'Session {value}',
      'onboarding.first_session_default': 'Session 1',
      'onboarding.complete_toast': 'Plan created and onboarding completed',
      'onboarding.why.hypertrophy':
        'Supports your hypertrophy goal without forcing a strength-first setup.',
      'onboarding.why.sport_support':
        'Balances lifting with outside sport load and keeps recovery manageable.',
      'onboarding.why.goal_match': 'Matches your main goal: {goal}.',
      'onboarding.why.guided':
        'Keeps the decision-making load low and gives you a clearer default path.',
      'onboarding.why.in_season':
        'Accounts for in-season constraints and keeps weekly stress more realistic.',
      'onboarding.adjustment.short_session':
        'The first session will be trimmed to match your time cap.',
      'onboarding.adjustment.sport':
        'The assistant will steer you away from leg-heavy work when sport load is high.',
      'plan.week.day_label': 'Day {day}',
      'plan.week.type.main_lift': 'Main lift day',
      'plan.week.type.split': 'Split session',
      'plan.week.type.full_body': 'Full body',
      'plan.week.type.strength': 'Strength day',
      'plan.week.type.workout_a': 'Workout A',
      'plan.week.type.workout_b': 'Workout B',
      'history.empty_title': 'No sessions yet',
      'history.empty_sub':
        'Complete your first workout to start building your training history.',
      'history.subtitle': 'Your training record',
      'history.start_today': "Start Today's Workout",
      'history.current_phase': 'Current Phase',
      'history.no_streak': 'No streak yet',
      'history.lifts_per_week': 'lifts/wk',
      'history.legend.lift': 'Lift',
      'history.legend.both': 'Both',
      'history.sport': 'Sport',
      'history.extra_sport_session': 'Extra {sport} Session',
      'history.sport_session': '{sport} Session',
      'history.total_volume': '{tons} t total volume',
      'history.activity_title': 'ACTIVITY · {weeks} WK',
      'history.total_volume_label': 'total volume',
      'history.streak_unit': 'wk',
      'history.streak_label': 'streak',
      'history.card.week_day': 'Week {week} · Day {day}',
      'history.card.volume': 'Volume',
      'history.card.exercises': 'Exercises',
      'history.card.notes': 'Notes',
      'history.week_label': 'WEEK {week}',
      'history.block_label': '{program} – {block} (Wk {start}-{end})',
      'history.rep_pr': 'Rep PR',
      'history.delete_workout': 'Delete Workout',
      'history.remove_workout_from': 'Remove workout from {date}?',
      'history.delete_sport': 'Delete {sport} Session',
      'history.remove_sport_from': 'Remove {sport} session from {date}?',
      'history.session_deleted': 'Session deleted',
      'history.session_restored': 'Session restored!',
      'history.stats_empty_title': 'No stats yet',
      'history.stats_empty_sub':
        'Complete a few workouts to see your training trends.',
      'settings.tabs.schedule': 'Schedule',
      'settings.tabs.preferences': 'Preferences',
      'settings.tabs.program': 'Program',
      'settings.tabs.account': 'Account',
      'settings.tabs.sport': 'Sport',
      'settings.tabs.my_sport': 'My Sport',
      'settings.tabs.training': 'Training',
      'settings.tabs.app_data': 'App & Data',
      'settings.tabs.app': 'App',
      'settings.sport_card': 'Sport / Cardio',
      'settings.sport_load.title': 'My Sport',
      'settings.sport_load.subtitle':
        'Set the sport or cardio that most affects your training week.',
      'settings.sport_load.section.activity': 'Sport',
      'settings.sport_load.section.activity_sub':
        'Name the recurring sport or cardio that affects your training week.',
      'settings.sport_load.section.profile': 'Load profile',
      'settings.sport_load.section.profile_sub':
        'Shape how strongly sport load should push training away from hard lower-body work.',
      'settings.sport_load.section.guidance': 'Guidance in training',
      'settings.sport_load.section.guidance_sub':
        'Use a quick check-in on training day to steer session selection around sport load.',
      'settings.activity_name': 'Activity name',
      'settings.activity_placeholder': 'e.g. Hockey, Soccer, Running',
      'settings.status.generic_sport': 'Sport / cardio',
      'settings.intensity': 'Intensity',
      'settings.intensity.easy': 'Easy',
      'settings.intensity.moderate': 'Moderate',
      'settings.intensity.hard': 'Hard',
      'settings.leg_heavy': 'Leg-heavy',
      'settings.leg_heavy_sub': 'Warns when scheduling legs after sport',
      'settings.regular_sport_days': 'Regular Sport Days',
      'settings.training_program': 'Training Program',
      'settings.program_basics': 'Quick Setup',
      'settings.program_advanced_title': 'Advanced Setup',
      'settings.program_advanced_help':
        'Exercise swaps, cycle controls, peak block, and program-specific options.',
      'settings.open_program_setup': 'Open Advanced Setup',
      'settings.default_rest': 'Default Rest Timer',
      'settings.training_defaults': 'Training Defaults',
      'settings.preferences.title': 'Training Preferences',
      'settings.preferences.help':
        'These preferences shape future smart recommendations and AI-generated training.',
      'settings.preferences.goal': 'Primary Goal',
      'settings.preferences.goal.strength': 'Strength',
      'settings.preferences.goal.hypertrophy': 'Hypertrophy',
      'settings.preferences.goal.general_fitness': 'General Fitness',
      'settings.preferences.goal.sport_support': 'Sport Support',
      'settings.preferences.training_days': 'Target Training Frequency',
      'settings.preferences.training_days_value': '{count} sessions / week',
      'settings.preferences.session_duration': 'Target Session Length',
      'settings.preferences.duration_value': '{minutes} min',
      'settings.preferences.duration_value.30': '30 min',
      'settings.preferences.duration_value.45': '45 min',
      'settings.preferences.duration_value.60': '60 min',
      'settings.preferences.duration_value.75': '75 min',
      'settings.preferences.duration_value.90': '90 min',
      'settings.preferences.equipment': 'Equipment Access',
      'settings.preferences.equipment.full_gym': 'Full Gym',
      'settings.preferences.equipment.basic_gym': 'Basic Gym',
      'settings.preferences.equipment.home_gym': 'Home Gym',
      'settings.preferences.equipment.minimal': 'Minimal Equipment',
      'settings.preferences.sport_check': 'Pre-workout sport check-in',
      'settings.preferences.sport_check_help':
        'Ask about sport load around today before recommending the session.',
      'settings.preferences.warmup_sets': 'Automatic warm-up sets',
      'settings.preferences.warmup_sets_help':
        'Prepend warm-up ramp sets (50%-85%) to main compound lifts at the start of each workout.',
      'settings.preferences.notes': 'Notes, limitations, preferences',
      'settings.preferences.notes_placeholder':
        'e.g. Avoid high-impact jumps, prefer barbell compounds, 60 min cap',
      'settings.preferences.detailed_view': 'Show detailed metrics',
      'settings.preferences.detailed_view_help':
        'Show advanced stats like individual fatigue gauges and training maxes on the dashboard.',
      'settings.preferences.restart_onboarding': 'Run Guided Setup Again',
      'settings.preferences.restart_onboarding_active':
        'Finish or discard the active workout before reopening guided setup.',
      'settings.preferences.section.goals': 'Goals & Volume',
      'settings.preferences.section.equipment': 'Equipment & Session Prep',
      'settings.preferences.section.session': 'Session Settings',
      'settings.preferences.save': 'Save Preferences',
      'settings.edit_program': 'Edit Program Setup',
      'settings.edit_program_advanced': 'Advanced Program Setup',
      'settings.data_backup': 'Data Backup',
      'settings.export': 'Export',
      'settings.import': 'Import',
      'settings.backup_help':
        'Export saves all data as a JSON file. Import replaces all current data.',
      'settings.backup_context': '{count} workouts since {date}',
      'settings.backup_empty': 'No workouts recorded yet.',
      'settings.danger': 'Danger Zone',
      'settings.status.no_days': 'No days set',
      'settings.danger_desc':
        'This permanently deletes all your workouts, programs, and settings. This cannot be undone.',
      'settings.danger_type_confirm': 'Type DELETE to confirm',
      'settings.sign_out': 'Sign Out',
      'settings.clear_all': 'Clear All Data',
      'settings.clear_all_confirm': 'Permanently Delete All Data',
      'settings.program_setup': 'Program Setup',
      'settings.account_section': 'Account',
      'settings.sync.syncing': 'Syncing changes...',
      'settings.sync.synced': 'Synced to cloud',
      'settings.sync.error':
        'Cloud sync issue. Local changes are kept on this device.',
      'settings.sync.offline': 'Offline. Changes will sync when you reconnect.',
      'workout.log_extra': 'Log Extra {sport}',
      'workout.log_extra_sport': 'Log Extra Sport',
      'workout.unscheduled_session': 'Unscheduled {sport} session',
      'workout.unscheduled_sport_session': 'Unscheduled sport session',
      'workout.training_session': 'Training Session',
      'workout.start_session': 'Start a Session',
      'workout.training_day': 'Training Day',
      'workout.simple.your_workout': 'Your Workout',
      'workout.simple.start': 'Start Workout',
      'workout.day': 'Day',
      'workout.start_workout': 'Start Workout',
      'workout.today.kicker': "Today's focus",
      'workout.today.focus': 'Train sharp and keep the main work crisp.',
      'workout.warning.title': 'Training warning',
      'workout.warning.low_recovery': 'Low recovery',
      'workout.warning.low_recovery_copy':
        'Consider resting. If you train, Day {day} is the safer option.',
      'workout.add_exercise': 'Add Exercise',
      'workout.rest_timer': 'Rest timer',
      'workout.finish_session': 'Save Session',
      'workout.cancel_session': 'Discard Workout',
      'workout.discard_session':
        "Discard this in-progress workout? Sets won't be saved.",
      'workout.session_discarded': 'Workout discarded.',
      'workout.no_previous_data': 'No previous data',
      'workout.last_prefix': 'Last:',
      'workout.last_best': 'Last best: {weight}kg',
      'workout.remove_exercise': 'Remove exercise',
      'workout.weight_placeholder': 'kg',
      'workout.reps_placeholder': 'reps',
      'workout.reps_hit': 'reps hit',
      'workout.rir': 'RIR',
      'workout.rir_prompt_title': 'Last set check-in',
      'workout.rir_prompt_body':
        'How many reps did you still have left after the last work set of {exercise}?',
      'workout.rir_prompt_skip': 'Skip for now',
      'workout.rir_saved': 'RIR saved',
      'workout.max_short': 'MAX',
      'workout.swap': 'Swap',
      'workout.back': 'BACK',
      'workout.aux': 'AUX',
      'workout.add_set': '+ Set',
      'workout.add_at_least_one': 'Add at least one exercise!',
      'workout.deload_light': 'Deload - keep it light',
      'workout.exercise_removed': '{name} removed',
      'workout.session_saved': 'Session saved!',
      'workout.session_complete': 'Session Complete',
      'workout.summary.notes_label': 'Session notes',
      'workout.summary.notes_placeholder': 'Any notes about this session?',
      'workout.summary.feedback_label': 'How did it feel?',
      'workout.summary.feedback_good': 'Good',
      'workout.summary.feedback_too_easy': 'Too easy',
      'workout.summary.feedback_too_hard': 'Too hard',
      'workout.summary.log_post_workout_meal': 'Log post-workout meal',
      'workout.summary_duration': 'Duration',
      'workout.summary_sets': 'Sets Done',
      'workout.summary_volume': 'Volume',
      'workout.summary_rpe': 'RPE',
      'workout.completed_sets': '{completed}/{total} sets done',
      'workout.program_error':
        'Session saved, but program state may need review.',
      'workout.sport_legs_warning':
        '{sport} legs - consider fewer sets or swapping day order',
      'workout.extra_logged': 'Extra {sport} logged!',
      'workout.next_cycle': '{program} - cycle {cycle} starts now.',
      'workout.next_week': '{program} - {label} up next!',
      'workout.coach_note.pr_single': 'New PR on {exercise}! Keep going.',
      'workout.coach_note.pr_multi': 'New PRs on {exercises}! Great session.',
      'workout.coach_note.tm_increase':
        'Strength up: {lift} +{delta}kg → now {tm}kg',
      'workout.coach_note.tm_adjustment_up': '{lift} TM ↑ {tm} kg (+{delta})',
      'workout.coach_note.tm_adjustment_down':
        '{lift} TM ↓ {tm} kg (-{delta})',
      'workout.coach_note.week_advance': 'Week {week} starts now. Build on it.',
      'workout.coach_note.cycle_advance':
        'Cycle {cycle} starts — new progression block.',
      'workout.coach_note.tough_session':
        'Tough session — rest well and come back strong.',
      'workout.coach_note.partial_session':
        'Partial session logged. Any training counts — consistency wins.',
      'workout.coach_note.clean': 'All sets done. Solid work.',
      'workout.plan.kicker': "Today's decision",
      'workout.plan.deload': 'Deload recommendation',
      'workout.plan.deload_copy':
        'Recovery is low, so keep today lighter than normal and reduce grinding.',
      'workout.plan.train_light': 'Conservative training day',
      'workout.plan.train_light_copy':
        'Train today, but keep the effort conservative and let the session breathe.',
      'workout.plan.shorten': 'Short session plan',
      'workout.plan.shorten_copy':
        'Main work first. Accessories will be trimmed to fit your time cap.',
      'workout.plan.sport_load': 'Sport-aware session',
      'workout.plan.sport_load_copy':
        '{sport} load is high around today, so heavier leg work may be trimmed.',
      'workout.plan.normal': 'Normal training day',
      'workout.plan.normal_copy': 'Your plan can run normally today.',
      'workout.start_override.recommended': 'Lightened session',
      'workout.start_override.recommended_copy':
        "Follow today's recovery recommendation and keep the session lighter.",
      'workout.start_override.normal': 'Normal session',
      'workout.start_override.normal_copy':
        'Keep the original plan and train without the automatic lightening.',
      'workout.session_mode.auto': 'Auto',
      'workout.session_mode.auto_copy_light':
        "Follow today's light-session recommendation automatically.",
      'workout.session_mode.auto_copy_normal':
        "Follow today's normal-session recommendation automatically.",
      'workout.session_mode.normal': 'Normal session',
      'workout.session_mode.normal_copy':
        'Keep the original plan and suppress the automatic lightening.',
      'workout.session_mode.light': 'Light session',
      'workout.session_mode.light_copy':
        'Start with the lighter session version even if today would otherwise be normal.',
      'workout.energy.title': 'How do you feel?',
      'workout.energy.low': 'Low energy',
      'workout.energy.normal': 'Normal',
      'workout.energy.strong': 'Feeling strong',
      'workout.bonus.label': 'Bonus Workout',
      'workout.bonus.subtitle': 'Extra session targeting what you missed this week',
      'workout.bonus.kicker': 'Week complete',
      'workout.bonus.start': 'Start Bonus Workout',
      'workout.bonus.preview_title': 'Bonus Session',
      'workout.bonus.note': 'Complementary work \u00b7 3 sets \u00d7 10-12',
      'workout.bonus.toast_started': 'Bonus workout — let\u2019s go!',
      'workout.bonus.toast_saved': 'Bonus workout saved!',
      'workout.bonus.duration.quick': '~20 min',
      'workout.bonus.duration.standard': '~35 min',
      'workout.bonus.duration.full': '~50 min',
      'history.bonus_badge': 'Bonus',
      'muscle.chest': 'Chest',
      'muscle.back': 'Back',
      'muscle.shoulders': 'Shoulders',
      'muscle.quads': 'Quads',
      'muscle.hamstrings': 'Hamstrings',
      'muscle.glutes': 'Glutes',
      'muscle.core': 'Core',
      'muscle.biceps': 'Biceps',
      'muscle.triceps': 'Triceps',
      'workout.setup.kicker': 'Session setup',
      'workout.setup.advanced_toggle': 'Fine-tune: {mode}',
      'workout.setup.advanced_hint':
        'Use this only if you want to override the usual recommendation.',
      'workout.tm_updated_single': '{lift} TM updated: {old} → {next} kg',
      'workout.tm_updated_multi': 'TMs updated: {changes}',
      'workout.runner.kicker': 'Session plan',
      'workout.runner.normal': 'Normal session',
      'workout.runner.lighten': 'Lightened session',
      'workout.runner.shorten': 'Shortened session',
      'workout.runner.adjusted': 'Adjusted session',
      'workout.runner.normal_title': 'Normal session flow',
      'workout.runner.normal_copy':
        'Stay on the main work and move through the remaining sets in order.',
      'workout.runner.shorten_title': 'Shortened session',
      'workout.runner.shorten_copy':
        'Lower-priority work was cut so you can finish the essential work faster.',
      'workout.runner.light_title': 'Lighter session',
      'workout.runner.light_copy':
        'Keep the session moving, but leave more in the tank with slightly lighter remaining work.',
      'workout.runner.sport_title': 'Sport-aware session',
      'workout.runner.sport_copy':
        'Leg-heavy work is being kept under control because of surrounding sport load.',
      'workout.runner.done':
        'Main work is done. You can finish here or wrap up optional work.',
      'workout.runner.completed': '{count} sets done',
      'workout.runner.remaining': '{count} sets left',
      'workout.runner.elapsed': '{count} min elapsed',
      'workout.runner.next': 'Next: {target}',
      'workout.runner.stop_after_this': 'You can stop after this lift',
      'workout.runner.stop_after_this_copy':
        'Once this lift is done, you have already kept the high-value work in the session.',
      'workout.runner.stop_after_target': 'You can stop after {target}',
      'workout.runner.stop_after_target_copy':
        'That leaves the important work in place and turns the rest into optional volume.',
      'workout.runner.sport_finish_title': 'Good finish point after this lift',
      'workout.runner.sport_finish_copy':
        'Sport load is high enough that finishing after the key work is a smart call today.',
      'workout.runner.shorten_btn': 'Shorten',
      'workout.runner.lighten_btn': 'Go lighter',
      'workout.runner.undo_btn': 'Undo adjustment',
      'workout.runner.shorten_toast': 'Session shortened to the essential work',
      'workout.runner.light_toast': 'Remaining work lightened',
      'workout.runner.no_change': 'No remaining work needed adjustment',
      'workout.runner.undo_toast': 'Last adjustment undone',
      'workout.runner.shorten_confirm_title': 'Shorten this session?',
      'workout.runner.shorten_confirm_body':
        'Choose how aggressively to trim the remaining work based on how much time you need to save.',
      'workout.runner.light_confirm_title': 'Go lighter this session?',
      'workout.runner.light_confirm_body':
        'This keeps the session structure mostly intact, but lowers the remaining load and trims a little volume when useful. Use this when recovery feels off.',
      'workout.runner.shorten_option_light': 'Save ~5 min',
      'workout.runner.shorten_option_light_body':
        'Remove accessory work only and keep the rest of the structure intact.',
      'workout.runner.shorten_option_medium': 'Save ~10 min',
      'workout.runner.shorten_option_medium_body':
        'Keep at least two work sets per remaining exercise and cut lower-priority volume.',
      'workout.runner.shorten_option_hard': 'Save ~15 min',
      'workout.runner.shorten_option_hard_body':
        'Trim harder: keep two work sets per exercise and drop the last unstarted lift if needed.',
      'workout.quick_fill_suggested': 'Use {weight}kg',
      'workout.quick_fill_copy': 'Copy first set down',
      'workout.quick_fill_copy_toast':
        'Filled the remaining sets from the first work set',
      'workout.quick_fill_suggested_toast':
        'Applied the suggested load to the remaining sets',
      'program.switch_to': 'Switch to {name}',
      'program.switch_msg':
        'Your current program is paused. {name} will start where you left off.',
      'program.switched': 'Switched to {name}',
      'program.switch_estimated_loads':
        'Starting loads estimated from your recent training: {changes}. Adjust in Settings if needed.',
      'program.setup_saved': 'Program setup saved!',
      'program.active': 'Active',
      'program.recommended': 'Recommended',
      'program.simple.next': 'Next',
      'program.done': 'Done',
      'program.future': 'Upcoming',
      'program.leg_heavy': 'Leg-heavy',
      'program.recommend_reason.title': 'Why this session',
      'program.recommend_reason.starred_title':
        'Why the recommended session is suggested',
      'program.recommend_reason.progression':
        'Matches your normal training order.',
      'program.recommend_reason.short_session':
        'Fits your shorter session target.',
      'program.recommend_reason.lower_volume':
        'Keeps total session volume more manageable today.',
      'program.recommend_reason.sport_support_upper':
        'Keeps leg fatigue lower for sport support.',
      'program.recommend_reason.fresh_muscles':
        'Targets fresher muscle groups: {groups}.',
      'program.recommend_reason.sport_context_yesterday':
        "Keeps lower-body work more manageable after yesterday's leg-heavy sport.",
      'program.recommend_reason.sport_context_today':
        "Keeps lower-body work more manageable around today's sport.",
      'program.recommend_reason.sport_context_tomorrow':
        "Keeps lower-body work more manageable before tomorrow's sport.",
      'program.recommend_reason.sport_context_both':
        'Keeps lower-body work more manageable with sport load on both sides.',
      'program.recommend_reason.sport_context_upper':
        'Keeps the focus away from already busy legs.',
      'program.global_frequency_hint':
        'Uses your Training preference: {value}.',
      'program.frequency_notice.kicker': 'Program fit',
      'program.frequency_notice.title':
        'Selected weekly frequency no longer fits this program',
      'program.frequency_notice.body':
        '{name} does not support {requested}. It is currently using {effective}.',
      'program.frequency_notice.suggestion':
        'For {requested}, switch to a program that supports it directly.',
      'program.frequency_notice.toast':
        '{name} now uses {effective}. Open Program to switch for {requested}.',
      'program.frequency_filter.showing':
        'Showing programs that fit {value}. Your current program stays visible if it needs a fallback.',
      'program.filter.title': 'Filter by level',
      'program.filter.all': 'All',
      'program.filter.beginner': 'Beginner',
      'program.filter.intermediate': 'Intermediate',
      'program.filter.advanced': 'Advanced',
      'program.frequency_card.fit': 'Fits {value}',
      'program.frequency_card.fallback': 'Uses {value}',
      'program.difficulty.beginner': 'Beginner-friendly',
      'program.difficulty.intermediate': 'Intermediate',
      'program.difficulty.advanced': 'Advanced',
      'program.card.switch_to': 'Switch to {name}',
      'program.card.active': 'Active program: {name}',
      'program.week_info': '{icon} {name} - {block} - {week}',
      'program.training_max_pct': '{pct}% of Training Max',
      'toast.rest_updated': 'Rest timer updated',
      'toast.preferences_saved': 'Training preferences saved',
      'toast.schedule_saved': 'Schedule saved!',
      'toast.backup_exported': 'Backup exported!',
      'toast.data_imported': 'Data imported! Reloading...',
      'toast.could_not_read_file': 'Could not read file',
      'toast.all_data_cleared': 'All data cleared',
      'toast.synced_other_device': 'Synced latest changes from another device',
      'toast.sync_issue':
        'Cloud sync failed. Changes stay on this device for now.',
      'import.invalid_file': 'Invalid backup file',
      'import.invalid_workout_data': 'Backup file has invalid workout data',
      'import.malformed_entries': 'Backup file has malformed workout entries',
      'import.invalid_profile_data': 'Backup file has invalid profile data',
      'import.file_too_large': 'Backup file is too large to import safely',
      'import.duplicate_workout_ids':
        'Backup file contains duplicate workout IDs',
      'import.invalid_workout_dates':
        'Backup file has invalid workout dates',
      'import.title': 'Import Data',
      'import.replace_with_backup': 'Replace all data with backup from {date}?',
      'confirm.clear_all_title': 'Clear All Data',
      'confirm.clear_all_msg':
        'Delete ALL training data? This cannot be undone.',
      'history.tab.log': 'Workout Log',
      'history.tab.stats': 'Stats',
      'history.total_sessions': 'Total Sessions',
      'history.sport_sessions': 'Sport Sessions',
      'history.sets_this_month': 'Sets This Month',
      'history.avg_rpe': 'Avg Session RPE',
      'history.stats.volume': 'Weekly Volume',
      'history.stats.strength': 'Strength Progress',
      'history.stats.e1rm': 'Estimated 1RM',
      'history.stats.tm_history': 'Training Max Trend',
      'history.stats.milestones': 'Milestones',
      'history.stats.range.8w': '8W',
      'history.stats.range.16w': '16W',
      'history.stats.range.all': 'All',
      'history.stats.week_prefix': 'W',
      'history.stats.lift.squat': 'Squat',
      'history.stats.lift.bench': 'Bench',
      'history.stats.lift.deadlift': 'Deadlift',
      'history.stats.lift.ohp': 'OH Press',
      'history.milestone.bench_bw': 'Bodyweight Bench',
      'history.milestone.squat_1_5x': '1.5x BW Squat',
      'history.milestone.deadlift_2x': '2x BW Deadlift',
      'history.milestone.date': 'Unlocked {date}',
      'day.sun.short': 'Sun',
      'day.mon.short': 'Mon',
      'day.tue.short': 'Tue',
      'day.wed.short': 'Wed',
      'day.thu.short': 'Thu',
      'day.fri.short': 'Fri',
      'day.sat.short': 'Sat',
      'rpe.set': 'Set',
      'rpe.session_title': 'How hard was this session?',
      'rpe.session_subtitle': 'Rate overall effort (6 = easy, 10 = max)',
      'rpe.session_prompt': 'Rate overall session effort (6 = easy, 10 = max)',
      'rpe.desc.6': 'Could keep going easily',
      'rpe.desc.7': 'Comfortable effort',
      'rpe.desc.8': 'Challenging but controlled',
      'rpe.desc.9': 'Maybe 1 rep left',
      'rpe.desc.10': 'Nothing left',
      'settings.program_setup_suffix': 'Setup',
      'workout.log_extra_confirm': 'Log an extra {sport} session for today?',
      'workout.swap_back': 'Swap back exercise',
      'workout.swap_back_title': 'Swap Back Exercise',
      'workout.swap_aux_category': 'Swap {cat} auxiliary',
      'workout.swap_exercise': 'Swap exercise',
      'workout.swapped_to': 'Swapped to {name}',
      'workout.sport_check.title': 'Sport check-in',
      'workout.sport_check.sub':
        'What sport load are you working around today?',
      'workout.sport_check.none': 'No sport load',
      'workout.sport_check.light': 'Light sport load',
      'workout.sport_check.heavy': 'Heavy sport load',
      'workout.sport_check.today': 'Today',
      'workout.sport_check.yesterday': 'Yesterday',
      'workout.sport_check.tomorrow': 'Tomorrow',
      'workout.sport_check.both': 'Both days',
      'workout.sport_check.enabled_hint':
        'Sport check-in is enabled. You will be asked about leg-heavy sport before the workout starts.',
      'workout.sport_check.inline_title': 'Sport load check-in',
      'workout.sport_check.inline_sub':
        'Tell the app the sport load around today so the session recommendation can account for it.',
      'workout.sport_check.level_title':
        'How much sport load are you working around?',
      'workout.sport_check.timing_title': 'When is it?',
      'workout.sport_check.today_hint':
        'Today is marked as a regular sport day, so timing was preselected.',
      'workout.pref_adjustment.accessories':
        'Accessory work trimmed for a shorter session.',
      'workout.pref_adjustment.aux_volume':
        'Auxiliary volume reduced to fit your time cap.',
      'workout.pref_adjustment.sport_support':
        'Accessory work removed to keep the session sharper for sport support.',
      'workout.pref_adjustment.sport_today':
        "Keeps lower-body work more manageable around today's sport.",
      'workout.pref_adjustment.sport_tomorrow':
        'Tomorrow looks leg-heavy, so lower-body work was kept slightly lighter.',
      'workout.pref_adjustment.sport_yesterday':
        'Yesterday was leg-heavy, so lower-body work was kept lighter today.',
      'workout.pref_adjustment.sport_both':
        'Leg-heavy sport sits on both sides of this session, so lower-body work was trimmed.',
      'workout.pref_adjustment.swap_hint':
        'Use exercise swap freely if your setup does not match the planned lift exactly.',
      'plan.adjustment.replaced_equipment':
        'Swapped {from} to {to} to match your available equipment.',
      'plan.adjustment.replaced_limit':
        'Swapped {from} to {to} to respect your current limits.',
      'plan.adjustment.removed_exercise':
        'Removed {exercise} because it conflicts with your current limits.',
      'plan.insight.forge_progress':
        '{count} main lift TMs are up over your recent block, led by +{delta}kg.',
      'plan.insight.forge_stable':
        'Forge training maxes are stable right now - keep execution crisp.',
      'plan.insight.w531_stalled':
        'Cycle {cycle}, week {week}. {count} lift needs a lighter runway.',
      'plan.insight.w531_cycle':
        'Cycle {cycle}, week {week} is moving without stall flags.',
      'plan.insight.hs_primary':
        'Recent hypertrophy work is anchored by {exercise}.',
      'plan.insight.stalls':
        'Progression has at least one stall signal right now.',
      'plan.insight.stable':
        'Progression looks stable - stay with the current path.',
      'plan.insight.skipped_accessories':
        'Accessories most often dropped: {names}.',
      'plan.insight.swap_preferences':
        'You keep gravitating toward these swaps: {names}.',
      'plan.insight.sport_collision':
        'Lower-body work keeps colliding with sport load in your recent sessions.',
      'plan.insight.adherence_30':
        '30-day adherence: {done}/{expected} planned sessions ({rate}%).',
      'plan.insight.best_days': 'You train most often on {days}.',
      'plan.recommend.continue': 'Stay the course',
      'plan.recommend.continue_body':
        'Your current setup looks sustainable - keep stacking consistent sessions.',
      'plan.recommend.shorten': 'Shorten this week',
      'plan.recommend.shorten_body':
        'Time friction is showing up, so bias this week toward shorter but complete sessions.',
      'plan.recommend.lighten': 'Run a lighter week',
      'plan.recommend.lighten_body':
        'Recovery signals are climbing, so keep the structure but lower the physiological cost.',
      'plan.recommend.deload': 'Take the deload',
      'plan.recommend.deload_body':
        'Fatigue and stall signals justify a lighter runway before pushing again.',
      'plan.recommend.switch': 'Switch to a better-fit block',
      'plan.recommend.switch_body':
        'The current setup is fighting your schedule or recovery pattern. A simpler block is likely a better fit.',
      'dashboard.good_deload_timing': 'Good timing - deload!',
      'dashboard.consider_rest': 'Consider resting today.',
      'dashboard.preferences_context':
        'Goal: {goal} · {days} · {minutes} · {equipment}',
      'dashboard.pref.goal.strength':
        'Today, prioritize crisp top sets and solid bar speed.',
      'dashboard.pref.goal.hypertrophy':
        'Today, chase quality volume and controlled reps.',
      'dashboard.pref.goal.general_fitness':
        'Today, keep the session sustainable and leave a little in the tank.',
      'dashboard.pref.goal.sport_support':
        'Today, keep the work athletic and avoid grinding reps.',
      'dashboard.pref.focus_label': "Today's focus",
      'dashboard.pref.time.short':
        'Time cap is tight, so focus on the main work first and treat accessories as optional.',
      'dashboard.pref.time.long':
        'You have room for a fuller session today, so complete the accessory work if recovery stays good.',
      'dashboard.pref.equipment.basic_gym':
        'If a planned lift is not available, use exercise swap to stay close to the movement pattern.',
      'dashboard.pref.equipment.home_gym':
        'Home gym setup may call for swaps today, so favor practical variations you can load well.',
      'dashboard.pref.equipment.minimal':
        'Equipment is limited, so treat today as a minimum effective dose and swap freely when needed.',
      'workout.today.coach_note': 'Coach note',
      'workout.today.block_stats': 'Training rhythm',
      'workout.today.last_30_days': 'How the last 30 days have looked',
      'workout.today.recovery_status': 'Recovery status',
      'workout.today.stats.progress': 'PR growth',
      'dashboard.trends.primary.label': 'On-plan days',
      'dashboard.trends.primary.sublabel_fallback':
        'Keep stacking ordinary weeks and the picture will sharpen.',
      'dashboard.trends.progress_up': 'Strength moving',
      'dashboard.trends.progress_down': 'Strength dipped',
      'dashboard.trends.progress_flat': 'Strength steady',
      'dashboard.trends.sessions': 'Recent sessions',
      'dashboard.trends.best_days': 'Most natural days',
      'dashboard.trends.friction': 'Friction points',
      'dashboard.trends.summary.building.title': 'Your routine is still taking shape',
      'dashboard.trends.summary.building.body':
        'There is enough here to start reading your pattern, but a few steadier weeks will tell a much clearer story.',
      'dashboard.trends.summary.stable.title': 'Your training rhythm is working',
      'dashboard.trends.summary.stable.body':
        'You are showing up often enough to build momentum, and the recent signals point in the right direction.',
      'dashboard.trends.summary.fragile.title':
        'There is good work here, but the rhythm is fragile',
      'dashboard.trends.summary.fragile.body':
        'The base is there, but the recent pattern still looks uneven enough that consistency matters more than pushing harder.',
      'dashboard.muscle_load.recent': 'Recent muscle load',
      'dashboard.muscle_load.light': 'Light',
      'dashboard.muscle_load.moderate': 'Moderate',
      'dashboard.muscle_load.high': 'High',
      'dashboard.muscle_group.chest': 'Chest',
      'dashboard.muscle_group.back': 'Back',
      'dashboard.muscle_group.shoulders': 'Shoulders',
      'dashboard.muscle_group.biceps': 'Biceps',
      'dashboard.muscle_group.triceps': 'Triceps',
      'dashboard.muscle_group.forearms': 'Forearms',
      'dashboard.muscle_group.quads': 'Quads',
      'dashboard.muscle_group.hamstrings': 'Hamstrings',
      'dashboard.muscle_group.glutes': 'Glutes',
      'dashboard.muscle_group.calves': 'Calves',
      'dashboard.muscle_group.core': 'Core',
      'dashboard.session_left': 'session left',
      'dashboard.sessions_left': 'sessions left',
      'history.other_sessions': 'Other Sessions',
      'program.season.off': 'Off-Season',
      'program.season.in': 'In-Season',
      'program.w531.wave5': '5s Wave',
      'program.w531.wave3': '3s Wave',
      'program.w531.week531': '5/3/1 Week',
      'program.w531.tm_test': 'TM Test',
      'program.w531.deload': 'Deload',
      'program.w531.tm_test_week': 'TM Test Week',
      'program.w531.off_short': "5's PRO + BBB",
      'program.w531.in_short': 'Min Reps + Triumvirate',
      'program.w531.next_cycle': 'Cycle {cycle} starts - TMs update!',
      'program.w531.next_week': 'Week {week} ({label}) up next.',
      'program.w531.week_done': 'Week {week} done! {next}',
      'program.w531.banner_leg_heavy': 'recommended session is leg-heavy.',
      'program.w531.banner_consider_upper':
        'Consider <strong>{label}</strong> instead.',
      'program.w531.banner_only_legs':
        'Only leg sessions remain - go lighter or rest today.',
      'program.w531.save_setup': 'Save Program Setup',
      'program.w531.tm_test_enabled':
        'TM Test Week enabled - will replace next Deload',
      'program.w531.tm_test_enable': 'Enable TM Test Week instead of Deload',
      'program.w531.name': '5/3/1 (Wendler)',
      'program.w531.description':
        '4-week strength cycles with automatic weight progression.',
      'program.sl.name': 'StrongLifts 5x5',
      'program.sl.description':
        'Beginner strength program with steady weight increases.',
      'program.sl.workout': 'Workout',
      'program.sl.linear_progression': 'Linear Progression',
      'program.sl.is_next': 'is next',
      'program.sl.squat': 'Squat',
      'program.sl.banner_sport_warning':
        'Both workouts include Squat. Consider going lighter or resting today.',
      'program.sl.failed_sessions': 'failed sessions',
      'program.sl.split_overview':
        'A: Squat+Bench+Row - B: Squat+Overhead Press+Deadlift - alternating 3 sessions/week',
      'program.sl.session_completed_next':
        'Session {count} completed - Next: Workout {workout}',
      'program.sl.weight_rounding': 'Weight Rounding (kg)',
      'program.sl.working_weights': 'Working Weights (kg)',
      'program.sl.progression_help':
        'Add +2.5kg (+5kg deadlift) after successful sessions. 3 failed sessions trigger a 10% deload.',
      'program.sl.next_workout': 'Next Workout',
      'program.sl.workout_a': 'Workout A',
      'program.sl.workout_b': 'Workout B',
      'program.sl.save_setup': 'Save Program Setup',
      'program.sl.accessories_short': 'Accessories',
      'program.sl.accessories_title': 'Optional Accessories',
      'program.sl.acc_toggle': 'Include accessories after main lifts',
      'program.sl.acc_rationale':
        'Adds vertical pulling, core work, and lateral delts to balance the main compounds.',
      'program.sl.acc_help':
        'Accessories are removed automatically for short sessions or sport-support goal.',
      'program.sl.acc_swap_hint':
        'Use the Swap button during a workout to change accessories.',
      'program.sl.acc_pull_note': 'Vertical pull · 3×8',
      'program.sl.acc_core_note': 'Core stability · 3×10',
      'program.sl.acc_iso_note': 'Lateral delts · 3×12',
      'program.sl.simple.overview_title': 'Training flow',
      'program.sl.simple.overview':
        'Adjust the core lift weights, rounding, and whether StrongLifts should add optional accessories after the main work.',
      'program.sl.simple.save': 'Save StrongLifts Basics',
      'program.sl.simple.summary': 'Workout {next} next · accessories: {acc}',
      'program.cfb.name': 'Gym Basics',
      'program.cfb.description':
        'Easy gym program with rotating full-body sessions. No maxes or planning needed.',
      'program.cfb.session_stats': 'Session Stats',
      'program.cfb.week_streak_short': '{count}-wk streak',
      'program.cfb.week_streak_long': '{count}-week streak',
      'program.cfb.week_streak_exclaim': '{count}-week streak!',
      'program.cfb.week_count_one': '{count} week',
      'program.cfb.week_count_many': '{count} weeks',
      'program.cfb.session_label': 'Gym Basics · Session {count}',
      'program.cfb.block_name': 'Gym Basics',
      'program.cfb.block_label': 'Session {count}',
      'program.cfb.note_main': '3 sets x 8-12 reps',
      'program.cfb.note_accessory': 'Accessory - 3 sets x 8-12 reps',
      'program.cfb.stats.sessions': 'Sessions',
      'program.cfb.stats.week_streak': 'Week Streak',
      'program.cfb.none': '-',
      'program.cfb.banner_sport_warning':
        'Session includes squats and hip hinges. Consider going lighter or resting today.',
      'program.cfb.last_session': 'Last session',
      'program.cfb.more': 'more',
      'program.cfb.next_rotates': 'next session picks different exercises',
      'program.cfb.freq_per_week': '{count}x per week',
      'program.cfb.no_sessions_yet': 'No sessions logged yet',
      'program.cfb.setup_summary':
        'Low-planning full-body training - 3 sets x 8-12 reps - Exercises rotate automatically',
      'program.cfb.target_frequency': 'Target Frequency',
      'program.cfb.freq_reference':
        'Reference only. This program does not auto-schedule sessions.',
      'program.cfb.movement_pools': 'Movement Pattern Pools',
      'program.cfb.pool_help':
        'Each session picks one exercise per slot and avoids last session choices.',
      'program.cfb.slot5_accessories':
        'Slot 5 - Accessories (2 picked per session)',
      'program.cfb.no_tm_needed':
        'No Training Max setup needed. Add weight when 12 reps feels easy.',
      'program.cfb.save_setup': 'Save Program Setup',
      'program.cfb.simple.overview_title': 'Weekly rhythm',
      'program.cfb.simple.overview':
        'Gym Basics is the easy default: show up, train a balanced full-body session, and let the exercise rotation handle the planning. Weekly frequency now comes from Training Preferences.',
      'program.cfb.simple.stats_help':
        'Exercise choices rotate automatically, so the main setup decision is simply how often you want to train.',
      'program.cfb.simple.save': 'Save Gym Basics',
      'program.cfb.simple.summary':
        '{count} sessions/week · balanced full-body training',
      'program.forge.name': 'Forge Protocol',
      'program.forge.description':
        '21-week strength cycle: hypertrophy, strength, and peaking.',
      'program.forge.day_label': 'Day {day}: {label}',
      'program.forge.week_label': 'Week {week}',
      'program.forge.session_label': 'W{week} Day {day} - {block} [{mode}]',
      'program.forge.banner_all_done':
        'All {count} sessions done this week! Rest up and recover.',
      'program.forge.banner_upper_recommended':
        'recommending <strong>Day {day}</strong> (upper-focused). Spare those legs.',
      'program.forge.banner_legs_only_left':
        '{sport} legs but only leg days remain. Go lighter or rest today.',
      'program.forge.banner_low_recovery':
        'Recovery {recovery}% - consider resting. If training, <strong>Day {day}</strong> is next.',
      'program.forge.banner_recommended':
        'Recommended: <strong>Day {day}</strong> - {left} sessions left this week - Recovery {recovery}%',
      'program.forge.plan.sport_trim':
        'Forge trimmed lower-body auxiliary work first because sport load is close.',
      'program.forge.plan.equipment_hint':
        'Forge will prioritize same-pattern swaps for your current setup.',
      'program.forge.save_setup': 'Save Program Setup',
      'settings.language.title': 'Language',
      'settings.language.label': 'App language',
      'settings.language.help':
        'UI and exercise guidance use this language when available.',
      'settings.language.option.en': 'English',
      'settings.language.option.fi': 'Finnish',
      'settings.language.saved': 'Language updated',
      'guidance.title': 'Movement Guide',
      'guidance.none': 'No guidance is available for this exercise yet.',
      'guidance.setup': 'Setup',
      'guidance.execution': 'Execution',
      'guidance.cues': 'Key cues',
      'guidance.safety': 'Safety',
      'guidance.media.video': 'Open video',
      'guidance.media.image': 'Open image',
      'session.description': 'Session focus',
      'program.forge.block.hypertrophy': 'Hypertrophy',
      'program.forge.block.strength': 'Strength',
      'program.forge.block.peaking': 'Peaking',
      'program.forge.block.deload': 'Deload',
      'program.forge.mode.sets.name': 'Sets Completed',
      'program.forge.mode.sets.desc':
        'Do sets until RIR cutoff. TM adjusts by total sets.',
      'program.forge.mode.sets.short': 'Sets',
      'program.forge.mode.rtf.name': 'Reps to Failure',
      'program.forge.mode.rtf.desc':
        'Normal sets + AMRAP last set. TM adjusts by reps hit.',
      'program.forge.mode.rtf.short': 'RTF',
      'program.forge.mode.rir.name': 'Last Set RIR',
      'program.forge.mode.rir.desc':
        'Fixed sets, report RIR on last set. Best for athletes.',
      'program.forge.mode.rir.short': 'RIR',
      'program.forge.note.deload': '{reps}×{weight}kg — easy, 5 sets',
      'program.forge.note.rtf':
        '{weight}kg × {reps} reps for {normalSets} sets, then go all-out on set {amrapSet} (target {repOutTarget}+ reps)',
      'program.forge.note.rir':
        '{weight}kg × {reps} for {fixedSets} sets — on the last set, note how many reps you had left (target RIR ≤{rir})',
      'program.forge.note.sets':
        '{weight}kg × {reps} reps — stop when RIR ≤{rir} (aim for {setLow}-{setHigh} sets)',
      'program.forge.blockinfo.deload': 'Light week — 60% TM, 5 easy sets.',
      'program.forge.blockinfo.sets':
        'Do sets of {reps} until RIR ≤{rir}. Aim for 4-6 sets.',
      'program.forge.blockinfo.rtf':
        '{reps} reps × 4 sets, then AMRAP last set (target {target}+).',
      'program.forge.blockinfo.rir':
        '5 sets of {reps}. Note reps left in tank on last set.',
      'program.forge.blockinfo.skip_peak':
        ' Peak block skipped — program restarts from Hypertrophy after this deload.',
      'program.forge.back.note_weight':
        '{weight}kg × 3 sets of 8-10 — hit 3×10 then increase weight',
      'program.forge.back.note_empty':
        'Set a working weight in Settings for auto-fill',
      'program.forge.settings.overview':
        '21-week strength cycle: Hypertrophy → Strength → Peaking.',
      'program.forge.settings.mode': 'Program Mode',
      'program.forge.settings.week': 'Current Week (1-21)',
      'program.forge.settings.peak_title': 'Peak Block (Weeks 15–20)',
      'program.forge.settings.peak_optional': 'optional',
      'program.forge.settings.peak_help':
        'The highest-intensity phase. Skip it to loop back to Hypertrophy after the Strength deload — runs as a continuous 14-week cycle.',
      'program.forge.settings.skip_peak_on':
        '🏃 Peak Block skipped — program loops to Hypertrophy after Strength',
      'program.forge.settings.skip_peak_off':
        '🏔️ Skip Peak Block — loop back after Strength instead of peaking',
      'program.forge.settings.terms':
        '<strong>Terms:</strong> TM = Training Max. RIR = reps left before failure. AMRAP = as many reps as possible.',
      'program.forge.settings.main_lifts': 'Main Lifts (Training Max in kg)',
      'program.forge.settings.aux_lifts':
        'Auxiliary Lifts (Training Max in kg)',
      'program.forge.settings.aux_help':
        'Choose the supporting variations you want Forge to rotate through during the week.',
      'program.forge.settings.back_exercise': 'Back Exercise (every session)',
      'program.forge.settings.working_weight': 'Working Weight (kg)',
      'program.forge.settings.back_prog': '3×8 → 3×10, then increase',
      'program.forge.settings.rounding': 'Weight Rounding (kg)',
      'program.forge.settings.sessions_pw': 'Sessions Per Week',
      'program.forge.settings.split_legend':
        '<strong>Bold</strong> = main lift · <span style="color:var(--purple)">Purple</span> = auxiliary',
      'program.forge.settings.day_num': 'Day {day}:',
      'program.forge.settings.control_title': 'Cycle Controls',
      'program.forge.settings.preview_title': 'Weekly Split Preview',
      'program.forge.settings.library_hint':
        'Library-backed selection with same-pattern suggestions first.',
      'program.forge.settings.aux_picker_hint':
        'Starts from the old Forge shortlist, but you can browse the full library.',
      'program.forge.settings.back_picker_hint':
        'Recommended rows and pull variations are shown first.',
      'program.forge.simple.overview':
        'Set your core lifts here. Weekly frequency now comes from Training Preferences, and daily adjustments still follow the rest of your Training settings.',
      'program.forge.simple.schedule': 'Weekly Rhythm',
      'program.forge.simple.days_help':
        'Choose how often you want to run Forge during a normal week.',
      'program.forge.simple.days_value': '{count} sessions / week',
      'program.forge.simple.summary':
        '{count} sessions / week · {back} every session',
      'program.forge.simple.main_lifts': 'Main Lifts',
      'program.forge.simple.main_help':
        'Pick the four core lifts and set a training max for each one.',
      'program.forge.simple.back_work': 'Back Work',
      'program.forge.simple.back_help':
        'This movement appears every session as your repeat back exercise.',
      'program.forge.simple.save': 'Save Forge Basics',
      'program.forge.lift.sq': 'Squat (SQ)',
      'program.forge.lift.bp': 'Bench Press (BP)',
      'program.forge.lift.dl': 'Deadlift (DL)',
      'program.forge.lift.ohp': 'Overhead Press (OHP)',
      'program.forge.lift.sq1': 'Squat Variant 1 (SQ-1)',
      'program.forge.lift.sq2': 'Squat Variant 2 (SQ-2)',
      'program.forge.lift.bp1': 'Bench Variant 1 (BP-1)',
      'program.forge.lift.bp2': 'Bench Variant 2 (BP-2)',
      'program.forge.lift.dlv': 'Deadlift Variant (DL)',
      'program.forge.lift.ohpv': 'Overhead Press Variant (OHP)',
      'program.w531.scheme.5s': '5s Week',
      'program.w531.scheme.3s': '3s Week',
      'program.w531.scheme.531': '1+ Week',
      'program.w531.scheme.deload': 'Deload',
      'program.w531.note.test':
        '🔬 TM TEST · {tm}kg × AMRAP — 3-5 reps → normal cycle; 1-2 reps → TM recalculates to 90% estimated 1RM',
      'program.w531.note.deload':
        '🌊 Deload · {tm}kg TM · {pcts} · easy 5s — recovery week',
      'program.w531.note.off':
        "{tm}kg TM · {pcts} · {reps} (5's PRO — strict 5 reps all sets, no AMRAP)",
      'program.w531.note.in':
        '{tm}kg TM · {pcts} · {reps} (minimum required reps — conserve energy)',
      'program.w531.note.recovery': 'Light recovery · {sets}×{reps}',
      'program.w531.note.bbb':
        'Boring But Big · 5×10 @ {weight}kg (50% of {name} TM: {tm}kg)',
      'program.w531.note.triumvirate': 'Triumvirate · 3 sets × 10-15 reps',
      'program.w531.settings.overview':
        '4-week cycles · +5kg lower / +2.5kg upper each cycle · plateau tracking',
      'program.w531.settings.terms':
        '<strong>Terms:</strong> TM = Training Max. 1RM = one-rep max. AMRAP = as many reps as possible.',
      'program.w531.settings.cycle_week': 'Cycle {cycle} · Week {week} of 4',
      'program.w531.settings.stalled':
        '⚠️ {name} plateaued — Training Max will drop 10% at cycle end',
      'program.w531.settings.plateau_badge': '⚠️ plateaued',
      'program.w531.settings.freq.2':
        '2×/week — Combined (Squat+Bench  /  Deadlift+Overhead Press)',
      'program.w531.settings.freq.3':
        '3×/week — Rotating (4 lifts across 3 days)',
      'program.w531.settings.freq.4': '4×/week — Standard (one lift per day)',
      'program.w531.settings.season': 'Season Mode',
      'program.w531.settings.off_label': '🏗️ Off-Season',
      'program.w531.settings.off_desc': "5's PRO + BBB (5x10 assistance)",
      'program.w531.settings.in_label': '🏒 In-Season',
      'program.w531.settings.in_desc': 'Minimum reps + 2 accessory lifts',
      'program.w531.settings.sessions_pw': 'Sessions Per Week',
      'program.w531.settings.rounding': 'Weight Rounding (kg)',
      'program.w531.settings.week_current': 'Current Week in Cycle (1–4)',
      'program.w531.settings.tm_test_title': 'TM Test Week',
      'program.w531.settings.tm_test_help':
        'Replaces the next Deload with a 100% TM AMRAP test. 1–2 reps: recalculate TM. 3+ reps: keep normal progression.',
      'program.w531.settings.training_max': 'Training Max (kg)',
      'program.w531.settings.tm_hint':
        'Set to about 90% of your 1RM. Auto increases and resets apply each cycle.',
      'program.w531.settings.pick_exercise': 'Pick exercise',
      'program.w531.settings.in_season_accessories':
        'In-Season Accessory Exercises',
      'program.w531.settings.in_season_help':
        'Pick 2 accessory exercises per in-season session (3 sets × 10–15 reps each).',
      'program.w531.simple.overview_title': 'Cycle rhythm',
      'program.w531.simple.overview':
        'Set the season mode and current cycle week here. Weekly frequency now comes from Training Preferences, and accessory exercise selection stays in Advanced Setup.',
      'program.w531.simple.tm_help':
        'Update the current training maxes for the four main lifts. Assistance work stays in Advanced Setup.',
      'program.w531.simple.save': 'Save Wendler Basics',
      'program.w531.simple.summary':
        '{season} · {freq} sessions/week · Week {week}',
      'program.w531.lift.sq': 'Squat (SQ)',
      'program.w531.lift.bp': 'Bench Press (BP)',
      'program.w531.lift.dl': 'Deadlift (DL)',
      'program.w531.lift.ohp': 'Overhead Press (OHP)',
      'program.w531.day.sq': 'Squat Day',
      'program.w531.day.bp': 'Bench Day',
      'program.w531.day.dl': 'Deadlift Day',
      'program.w531.day.ohp': 'OHP Day',
      'program.w531.banner.readiness': 'Session readiness:',
      'program.w531.readiness.default': '💪 Full session',
      'program.w531.readiness.light': '🌿 Light recovery',
      'program.w531.readiness.none': '😴 Lifts only',
      'program.w531.banner.stalled': ' · ⚠️ {count} lift stalled',
      'program.w531.banner.stalled_pl': ' · ⚠️ {count} lifts stalled',
      'program.w531.banner.next': ' · Next: <strong>{label}</strong>',
      'program.w531.banner.session_left': ' · {left} session left',
      'program.w531.banner.sessions_left': ' · {left} sessions left',
      'program.w531.banner.cycleweek': 'C{cycle} W{week}',
      'program.w531.plan.sport_trim':
        'Wendler trimmed lower-body assistance first because sport load is high.',
      'program.w531.plan.shoulder_trim':
        'Shoulder-sensitive vertical assistance was deprioritized for this session.',
      'program.w531.plan.equipment_hint':
        'Wendler will favor same-pattern substitutions before dropping work.',
      'program.w531.block.week_label': 'Cycle {cycle} · Week {week} · {season}',

      /* ── Hypertrophy Split ─────────────────────────────────────── */
      'program.hs.name': 'Hypertrophy Split',
      'program.hs.description':
        'Adaptive hypertrophy program that scales from 2 to 6 days per week.',
      'program.hs.session.push': 'Push',
      'program.hs.session.pull': 'Pull',
      'program.hs.session.legs': 'Legs',
      'program.hs.session.upper': 'Upper',
      'program.hs.session.lower': 'Lower',
      'program.hs.session.upper_b': 'Upper B',
      'program.hs.session.lower_b': 'Lower B',
      'program.hs.split.2': 'Upper / Lower',
      'program.hs.split.3': 'Push / Pull / Legs',
      'program.hs.split.4': 'Upper / Lower × 2',
      'program.hs.split.5': 'PPL + Upper + Lower',
      'program.hs.split.6': 'Push / Pull / Legs × 2',
      'program.hs.week_label': 'W{week}',
      'program.hs.cycle_short': 'C{cycle}',
      'program.hs.deload_easy': 'easy',
      'program.hs.block.ramp_up': 'Ramp-up',
      'program.hs.block.build': 'Build',
      'program.hs.block.push': 'Push',
      'program.hs.block.deload': 'Deload',
      'program.hs.blockinfo.deload':
        'Light week — reduced volume and intensity for recovery.',
      'program.hs.blockinfo.normal':
        'T1: {sets}×{reps} @{pct}% TM · T2 lighter · Accessories {accSets}×12-15',
      'program.hs.banner_all_done': '✅ All sessions done this week! Rest up.',
      'program.hs.banner_upper_rec':
        'recommending <strong>{session}</strong> (upper-focused).',
      'program.hs.banner_legs_only':
        '{sport} — only leg sessions remain. Go lighter or rest.',
      'program.hs.banner_low_recovery':
        '⚠️ Recovery {recovery}% — consider resting.',
      'program.hs.banner_default':
        '<strong>{session}</strong> next · {block} W{week} · {left} left · Recovery {recovery}%',
      'program.hs.settings.cycle_title': 'Cycle Controls',
      'program.hs.settings.overview':
        '8-week mesocycle: Ramp-up → Build → Push → Deload. TM adjusts automatically on Push weeks.',
      'program.hs.settings.cycle_week': 'Cycle & Week',
      'program.hs.settings.cycle_value':
        'Cycle {cycle} · Week {week} of {total}',
      'program.hs.settings.week_override': 'Override Week (1-8)',
      'program.hs.settings.rounding': 'Weight Rounding (kg)',
      'program.hs.settings.sessions_pw': 'Sessions Per Week',
      'program.hs.settings.tms': 'Training Maxes (kg)',
      'program.hs.settings.tm_help':
        'Weights are auto-calculated as a percentage of these values each week.',
      'program.hs.settings.legend':
        '<strong>Bold</strong> = T1 · <span style="color:var(--purple)">Purple</span> = T2 · <span style="color:var(--muted)">Grey</span> = accessory',
      'program.hs.simple.schedule': 'Weekly Rhythm',
      'program.hs.simple.overview':
        'Training frequency now comes from Training Preferences. The split adapts automatically, while you set the current training maxes here.',
      'program.hs.save_setup': 'Save Program Setup',
      'program.hs.simple.save': 'Save Basics',
      'program.hs.simple.summary': '{count} sessions/week · {split}',

      /* ── Body settings tab ───────────────────────────────────────── */
      'settings.tabs.body': 'Body',
      'settings.body.metrics_title': 'Body Metrics',
      'settings.body.metrics_help':
        'Used by the AI Nutrition Coach to personalise advice. All weights in kg.',
      'settings.body.weight': 'Current weight (kg)',
      'settings.body.height': 'Height (cm)',
      'settings.body.age': 'Age',
      'settings.body.target_weight': 'Target weight (kg)',
      'settings.body.goal_title': 'Body Composition Goal',
      'settings.body.goal_label': 'What are you working towards?',
      'settings.body.goal_none': '\u2014 select \u2014',
      'settings.body.goal.lose_fat': 'Lose fat',
      'settings.body.goal.gain_muscle': 'Gain muscle',
      'settings.body.goal.recomp': 'Body recomp (lose fat + gain muscle)',
      'settings.body.goal.maintain': 'Maintain',
      'settings.body.sex': 'Sex',
      'settings.body.sex_none': '\u2014 select \u2014',
      'settings.body.sex_male': 'Male',
      'settings.body.sex_female': 'Female',
      'settings.body.activity': 'Activity level',
      'settings.body.activity_none': '\u2014 select \u2014',
      'settings.body.activity_sedentary': 'Sedentary',
      'settings.body.activity_light': 'Lightly active',
      'settings.body.activity_moderate': 'Active',
      'settings.body.activity_very': 'Very active',
      'settings.body.save': 'Save',
      'settings.body.saved': 'Body metrics saved',

      /* ── Nutrition Coach ──────────────────────────────────────────── */
      'nav.nutrition': 'Nutrition',
      'nutrition.page.title': 'Nutrition Coach',
      'nutrition.clear.btn': 'Clear today',
      'nutrition.clear.title': "Clear today's session",
      'nutrition.clear.body':
        "This will delete today's nutrition session and meal coaching.",
      'nutrition.empty.kicker': 'AI NUTRITION COACH',
      'nutrition.empty.title': 'Your daily nutrition coach',
      'nutrition.empty.body':
        'Pick a guided action below and get personalised nutrition advice for today.',
      'nutrition.empty.reset': 'Resets automatically each day.',
      'nutrition.default_prompt': 'What can you tell me about this food?',
      'nutrition.action.plan_today': 'Build my food plan for today',
      'nutrition.action.next_meal': 'What should I eat next?',
      'nutrition.action.review_today': 'Review today so far',
      'nutrition.action.analyze_photo': 'Analyze this food photo',
      'nutrition.composer.kicker': 'Daily coaching',
      'nutrition.composer.title': 'Pick a nutrition action for today',
      'nutrition.composer.hint': 'Tap an action to get started',
      'nutrition.setup.title': 'Setup Required',
      'nutrition.setup.body':
        'Sign in to use Nutrition Coach. Claude requests are routed through Ironforge securely, and no Claude API key is stored on this device.',
      'nutrition.setup.sign_in': 'Sign in to continue',
      'nutrition.setup.help':
        'Nutrition Coach is available to signed-in users only. Your daily history stays on this device.',
      'nutrition.loading.thinking': 'Thinking...',
      'nutrition.loading.analyzing': 'Analyzing your meal...',
      'nutrition.error.auth_required': 'Sign in to use Nutrition Coach.',
      'nutrition.error.auth': 'Your session expired. Sign in again to continue.',
      'nutrition.error.rate_limit':
        'Rate limit reached \u2014 wait a moment and try again.',
      'nutrition.error.server': 'Nutrition Coach is temporarily unavailable.',
      'nutrition.error.api': 'Something went wrong. Try again in a moment.',
      'nutrition.error.offline':
        'You are offline. Connect to the internet and try again.',
      'nutrition.error.timeout':
        'Nutrition Coach took too long to respond. Try again.',
      'nutrition.error.photo_too_large':
        'That photo is too large. Choose a smaller image and try again.',
      'nutrition.error.invalid_photo':
        'Please choose an image file for meal analysis.',
      'nutrition.retry': 'Try again',
      'nutrition.time.yesterday': 'Yesterday',
      'nutrition.macro.protein': 'Protein',
      'nutrition.macro.carbs': 'Carbs',
      'nutrition.macro.fat': 'Fat',
      'nutrition.banner.personalized': 'Personalised',
      'nutrition.banner.setup_body':
        'Set up your body profile for personalised advice',
      'nutrition.banner.settings_link': 'Settings',
      'nutrition.today.label': 'Today',
      'nutrition.goal.lose_fat': 'fat loss',
      'nutrition.goal.gain_muscle': 'muscle gain',
      'nutrition.goal.recomp': 'recomp',
      'nutrition.goal.maintain': 'maintain',
      'settings.nutrition_coach.title': 'AI Nutrition Coach',
      'settings.nutrition_coach.help_ready':
        'Nutrition Coach is ready on this account. Claude requests are routed through Ironforge securely, and no Claude API key is stored on this device.',
      'settings.nutrition_coach.help_signed_out':
        'Sign in to use Nutrition Coach. Claude requests are routed through Ironforge securely, and no Claude API key is stored on this device.',
      'settings.claude_api_key.title': 'AI Nutrition Coach',
      'settings.claude_api_key.label': 'Claude API Key',
      'settings.claude_api_key.placeholder': 'sk-ant-...',
      'settings.claude_api_key.help':
        'Get your API key at console.anthropic.com. It stays on this device, and nutrition requests are sent directly from this browser to Anthropic. Use a personal key and avoid shared devices.',
      'settings.claude_api_key.save': 'Save Key',
      'settings.claude_api_key.saved_hint':
        'A key is already saved on this device. Enter a new one only if you want to replace it.',
      'settings.claude_api_key.clear': 'Remove Key',
      'settings.claude_api_key.invalid': 'Enter a valid Claude API key',
      'settings.claude_api_key.saved': 'API key saved',
      'settings.claude_api_key.cleared': 'API key removed',
      'nutrition.correction.label': 'Correct the food analysis',
      'nutrition.correction.placeholder': 'e.g. That was 2 portions, not 1...',
      'nutrition.correction.send_aria': 'Send correction',
      'nutrition.photo.label': 'Add photo',
      'nutrition.photo.cta': 'Snap your meal',
      'nutrition.photo.menu.title': 'Add your meal',
      'nutrition.photo.menu.camera': 'Picture food',
      'nutrition.photo.menu.library': 'Use photo from library',
      'nutrition.food_entry.label': 'Type the food',
      'nutrition.food_entry.placeholder':
        'e.g. Chicken rice bowl with a yogurt on the side',
      'nutrition.food_entry.send_aria': 'Send meal',
      'nutrition.setup.body':
        'Sign in to use Nutrition Coach. Claude requests are routed through Ironforge securely, and no Claude API key is stored on this device.',
      'nutrition.setup.sign_in': 'Sign in to continue',
      'nutrition.setup.help':
        'Nutrition Coach is available to signed-in users only. Your daily history stays on this device.',
      'nutrition.error.auth_required': 'Sign in to use Nutrition Coach.',
      'nutrition.error.auth': 'Your session expired. Sign in again to continue.',
      'nutrition.error.server': 'Nutrition Coach is temporarily unavailable.',
      'nutrition.error.api': 'Something went wrong. Try again in a moment.',
      'nutrition.error.timeout':
        'Nutrition Coach took too long to respond. Try again.',
      'nutrition.error.photo_too_large':
        'That photo is too large. Choose a smaller image and try again.',
      'nutrition.error.invalid_photo':
        'Please choose an image file for meal analysis.',
      'settings.nutrition_coach.title': 'AI Nutrition Coach',
      'settings.nutrition_coach.help_ready':
        'Nutrition Coach is ready on this account. Claude requests are routed through Ironforge securely, and no Claude API key is stored on this device.',
      'settings.nutrition_coach.help_signed_out':
        'Sign in to use Nutrition Coach. Claude requests are routed through Ironforge securely, and no Claude API key is stored on this device.',

      /* ── Session character badge & pre-session note ───────────────── */
      'program.forge.character.deload':
        'Deload — lighter loads, recovery focus',
      'program.forge.character.heavy': 'Heavy — top sets at {pct}% TM',
      'program.forge.character.strength':
        'Strength — {pct}% TM, controlled volume',
      'program.forge.character.volume': 'Hypertrophy — {pct}% TM, build volume',
      'program.forge.note.deload':
        'Week {week} of {total} — deload. Light and easy, let recovery happen.',
      'program.forge.note.default': 'Week {week} of {total} — {block}. {hint}',
      'program.forge.note.sets_hint': 'Stop sets when form breaks down.',
      'program.forge.note.rtf_hint': 'Push the last set for max reps.',
      'program.forge.note.rir_hint': 'Note reps left in tank on the last set.',

      'program.w531.character.test': 'TM Test — validate your training maxes',
      'program.w531.character.deload': 'Deload — light recovery week',
      'program.w531.character.amrap':
        '1+ Week — push AMRAP on last set at {pct}%',
      'program.w531.character.heavy': '3s Week — working sets at {pct}% TM',
      'program.w531.character.volume': '5s Week — moderate volume at {pct}% TM',
      'program.w531.note.test':
        'Cycle {cycle}, TM Test — push for max reps to validate training maxes.',
      'program.w531.note.deload':
        'Cycle {cycle}, Deload — easy sets, focus on recovery.',
      'program.w531.note.amrap':
        'Cycle {cycle}, {scheme} — push for max reps on every AMRAP set.',
      'program.w531.note.default':
        'Cycle {cycle}, {scheme} — complete all prescribed sets cleanly.',

      'program.sl.character.normal': 'Linear 5×5 — add weight on success',
      'program.sl.note.default':
        'Session {count} · Workout {next}. Add weight if all 5×5 completed last time.',

      'program.cfb.character.normal': 'Full body — varied exercises',
      'program.cfb.note.default':
        'Session {count}{streak}. Focus on effort and form.',

      'program.hs.character.deload': 'Deload — reduced volume, recovery focus',
      'program.hs.character.heavy': 'Push — T1 at {pct}% TM',
      'program.hs.character.build': 'Build — T1 at {pct}% TM, growing volume',
      'program.hs.character.ramp': 'Ramp-up — T1 at {pct}% TM, moderate start',
      'program.hs.note.deload':
        'Cycle {cycle}, Week {week} — deload. Lighter loads, let your body recover.',
      'program.hs.note.default':
        'Cycle {cycle}, Week {week} of 8 — {block} phase. Stay consistent with prescribed volume.',
    },
    fi: {
      'common.undo': 'Kumoa',
      'common.reload': 'Lataa uudelleen',
      'common.confirm': 'Vahvista',
      'common.cancel': 'Peruuta',
      'common.add': 'Lisää',
      'common.save': 'Tallenna',
      'common.done': 'Valmis',
      'common.delete': 'Poista',
      'common.off': 'Pois',
      'common.skip': 'Ohita',
      'common.loading': 'Ladataan...',
      'common.today': 'Tänään',
      'common.session': 'Treeni',
      'common.workout': 'Treeni',
      'common.sport': 'Urheilu',
      'common.cardio': 'Kestävyys',
      'common.log': 'Kirjaa',
      'nav.dashboard': 'Yhteenveto',
      'nav.train': 'Treeni',
      'nav.log': 'Kirjaus',
      'nav.history': 'Historia',
      'nav.settings': 'Asetukset',
      'login.email': 'Sähköposti',
      'login.password': 'Salasana',
      'login.sign_in': 'Kirjaudu',
      'login.create_account': 'Luo tili',
      'login.enter_credentials': 'Anna sÃ¤hkÃ¶posti ja salasana.',
      'login.password_short': 'Salasanassa pitÃ¤Ã¤ olla vÃ¤hintÃ¤Ã¤n 6 merkkiÃ¤.',
      'login.checking_session': 'Tarkistetaan istuntoa...',
      'login.signing_in': 'Kirjaudutaan...',
      'login.creating_account': 'Luodaan tiliÃ¤...',
      'login.account_created':
        'Tili luotiin! Vahvista sÃ¤hkÃ¶posti ja kirjaudu sitten sisÃ¤Ã¤n.',
      'login.finish_error': 'Kirjautumista ei voitu viimeistellÃ¤ juuri nyt.',
      'login.sign_in_error': 'Kirjautuminen ei onnistunut juuri nyt.',
      'login.sign_up_error': 'Tilin luominen ei onnistunut juuri nyt.',
      'login.sign_out_error': 'Uloskirjautuminen ei onnistunut juuri nyt.',
      'pwa.update.available': 'Ironforgesta on uusi versio valmiina.',
      'pwa.update.refresh': 'PÃ¤ivitÃ¤',
      'pwa.update.refreshing': 'PÃ¤ivitetÃ¤Ã¤n...',
      'pwa.update.applying': 'PÃ¤ivitetÃ¤Ã¤n Ironforgea...',
      'modal.confirm.title': 'Vahvista',
      'modal.confirm.ok': 'Vahvista',
      'modal.confirm.cancel': 'Peruuta',
      'modal.confirm.message': 'Oletko varma?',
      'shell.error.title': 'Jokin meni pieleen.',
      'shell.header.loading': 'Forge Protocol · Ladataan...',
      'modal.name.title': 'Lisää liike',
      'modal.name.sub': 'Syötä liikkeen nimi',
      'modal.name.placeholder': 'esim. Takakyykky',
      'modal.name.add': 'Lisää',
      'catalog.title.add': 'Lisää liike',
      'catalog.title.swap': 'Vaihda liike',
      'catalog.sub': 'Valitse liike kirjastosta tai hae nimellä.',
      'catalog.sub.swap':
        'Näytetään vaihtoehdot, jotka on rajattu liikkeen {name} ja ohjelman sääntöjen perusteella.',
      'catalog.search.placeholder': 'Hae liikkeitä',
      'catalog.clear_filters': 'Tyhjennä',
      'catalog.empty': 'Yksikään liike ei vastannut hakua tai filttereitä.',
      'catalog.section.empty': 'Tässä osiossa ei ole vielä liikkeitä.',
      'catalog.section.recent': 'Viimeksi käytetyt',
      'catalog.section.recent_empty':
        'Kirjaa muutama treeni, niin viimeksi käytetyt liikkeet näkyvät tässä.',
      'catalog.section.featured': 'Perusliikkeet',
      'catalog.section.all': 'Kaikki liikkeet',
      'catalog.section.results': 'Tulokset',
      'catalog.section.swap': 'Sallitut vaihtoehdot',
      'catalog.filter.all': 'Kaikki',
      'catalog.filter_group.movement': 'Liikemalli',
      'catalog.filter_group.muscle': 'Päälihasryhmä',
      'catalog.filter_group.equipment': 'Väline',
      'catalog.filter.movement.squat': 'Kyykky',
      'catalog.filter.movement.hinge': 'Lantionojennus',
      'catalog.filter.movement.horizontal_press': 'Vaakapunnerrus',
      'catalog.filter.movement.vertical_press': 'Pystypunnerrus',
      'catalog.filter.movement.horizontal_pull': 'Vaakaveto',
      'catalog.filter.movement.vertical_pull': 'Pystyveto',
      'catalog.filter.movement.single_leg': 'Yksijalkainen',
      'catalog.filter.movement.core': 'Keskivartalo',
      'catalog.filter.equipment.barbell': 'Levytanko',
      'catalog.filter.equipment.dumbbell': 'Käsipainot',
      'catalog.filter.equipment.machine': 'Laite',
      'catalog.filter.equipment.cable': 'Kaapeli',
      'catalog.filter.equipment.bodyweight': 'Kehonpaino',
      'catalog.filter.equipment.pullup_bar': 'Leuanvetotanko',
      'catalog.filter.equipment.band': 'Vastusnauha',
      'catalog.filter.equipment.trap_bar': 'Trap bar',
      'dashboard.today_plan': 'Tämän päivän suunnitelma',
      'dashboard.nutrition': 'Ravitsemus',
      'dashboard.nutrition.calories': 'Kalorit',
      'dashboard.nutrition.protein': 'Proteiini',
      'dashboard.nutrition.empty': 'Ei aterioita kirjattu tänään',
      'dashboard.nutrition.log_meal': 'Kirjaa ateria',
      'dashboard.nutrition.meals': '{count} ateriaa kirjattu',
      'dashboard.recovery': 'Palautuminen',
      'dashboard.muscular': 'Lihaksisto',
      'dashboard.nervous': 'Hermosto',
      'dashboard.overall': 'Yhteensä',
      'dashboard.recovery.simple_good': 'Olet palautunut hyvin',
      'dashboard.recovery.simple_moderate': 'Kohtalainen — kuuntele kehoasi',
      'dashboard.recovery.simple_low': 'Ota tänään rauhallisesti',
      'dashboard.log_to_see': 'Kirjaa treenejä, niin data tulee näkyviin',
      'dashboard.maxes': 'Maksimit',
      'dashboard.fully_recovered': 'Palautunut hyvin',
      'dashboard.mostly_recovered': 'Enimmäkseen palautunut',
      'dashboard.partially_fatigued': 'Osittain väsynyt',
      'dashboard.high_fatigue': 'Korkea kuormitus',
      'dashboard.badge.go': 'Valmis treenaamaan',
      'dashboard.badge.caution': 'Kohtalainen',
      'dashboard.badge.rest': 'Lepo',
      'dashboard.status.workout_plus_sport_logged': 'Treeni + {sport} kirjattu',
      'dashboard.status.workout_logged': 'Treeni kirjattu',
      'dashboard.status.sport_logged': '{sport} kirjattu',
      'dashboard.status.sport_day': '{sport}-päivä',
      'dashboard.no_session_logged': 'Ei kirjattua treeniä',
      'dashboard.training_maxes': 'Treenimaksimit',
      'dashboard.sessions': '{done}/{total} treeniä',
      'dashboard.sessions_done':
        'Kaikki {total} treeniä tehty. Lepää ja palaudu.',
      'dashboard.week_complete': 'Viikko valmis!',
      'dashboard.high_fatigue_title': 'Korkea kuormitus - lepää tai kevennä',
      'dashboard.recovery_pct': 'Palautuminen {recovery}%',
      'dashboard.sport_day_advice':
        'Valitse Kirjaus-välilehdeltä ylävartalopainotteinen päivä tai lepää.',
      'dashboard.post_sport': '{sport}n jälkeen',
      'dashboard.post_sport_advice':
        'Jalat voivat olla väsyneet. Kirjaus-välilehti ehdottaa yläpainotteista päivää.',
      'dashboard.deload_week': 'Kevyt viikko',
      'dashboard.training_day': 'Treenipäivä',
      'dashboard.feeling_fresh': 'olo on tuore, anna mennä',
      'dashboard.moderate_effort': 'ota maltilla',
      'dashboard.start_session': 'Aloita treeni',
      'dashboard.simple.start': 'Aloita treeni',
      'dashboard.header_sub':
        '{program} - {block} - {week} - Palautuminen {recovery}%',
      'dashboard.plan.deload':
        'Palautuminen laahaa, joten pidä päivä kevyenä ja käsittele se kevennyksenä. {count} treeniä on jäljellä tällä viikolla.',
      'dashboard.plan.train_light': 'Treenaa tänään kevyemmin',
      'dashboard.plan.train_light_body':
        'Voit silti treenata, mutta pidä rasitus maltillisena ja vältä turhaa grindia. {count} treeniä on jäljellä tällä viikolla.',
      'dashboard.plan.shorten': 'Lyhyt treeni tänään',
      'dashboard.plan.shorten_body':
        'Tee päätyö ensin ja karsi apuliikkeitä pysyäksesi aikaraamissa. {count} treeniä on jäljellä tällä viikolla.',
      'dashboard.plan.avoid_legs':
        'Lajikuorma on tänään korkea, joten suuntaa treeni pois raskaasta jalkatyöstä aina kun mahdollista. {count} treeniä on jäljellä tällä viikolla.',
      'dashboard.plan.train':
        'Palautuminen näyttää riittävän hyvältä normaaliin treeniin tänään. {count} treeniä on jäljellä tällä viikolla.',
      'dashboard.today_done': 'Päivän työ tehty',
      'dashboard.today_done_badge': 'Päivä hoidettu',
      'dashboard.today_done_coach_title': 'Hyvä työ',
      'dashboard.today_done_coach_body':
        'Tämän päivän päätyö on jo kasassa. Anna palautumiselle työrauha ja tule seuraavaan treeniin tuoreena.',
      'dashboard.today_done_body':
        'Salitreeni on jo kirjattu tälle päivälle. Hyvä työ. Anna palautumiselle tilaa ja tule seuraavaan treeniin terävänä.',
      'dashboard.today_done_body_multi':
        'Olet kirjannut tälle päivälle jo {count} salitreeniä. Hyvä työ. Sulje päivä rauhassa ja tule seuraavaan treeniin tuoreena.',
      'dashboard.today_done_with_sport':
        'Salitreeni ja lajitreeni on jo kirjattu tälle päivälle. Vahva päivä. Anna nyt palautumiselle tilaa tehdä työnsä.',
      'common.program': 'Ohjelma',
      'training.commentary.workout.kicker': 'Tämän päivän päätös',
      'training.commentary.rest.title': 'Viikko valmis!',
      'training.commentary.rest.dashboard_summary':
        'Kaikki suunnitellut treenit on jo tehty tälle viikolle. Lepää ja palaudu.',
      'training.commentary.rest.dashboard_focus_support':
        'Kaikki suunnitellut treenit on jo tehty tälle viikolle. Lepää ja palaudu.',
      'training.commentary.rest.dashboard_coach':
        'Kaikki suunnitellut treenit on jo tehty tälle viikolle. Lepää ja palaudu.',
      'training.commentary.rest.workout_summary':
        'Tämän viikon treenit on jo hoidettu. Pidä päivä palautumiselle.',
      'training.commentary.rest.workout_start_toast': 'Viikko valmis!',
      'training.commentary.rest.program_warning':
        'Tämän viikon suunniteltu työ on jo tehty. Palautuminen on tänään parempi ratkaisu.',
      'training.commentary.deload.title': 'Kevennyssuositus',
      'training.commentary.deload.dashboard_summary':
        'Palautuminen laahaa, joten pidä päivä kevyenä ja käsittele se kevennyksenä. {count} treeniä on jäljellä tällä viikolla.',
      'training.commentary.deload.dashboard_focus_support':
        'Palautuminen laahaa, joten pidä päivä kevyenä ja käsittele se kevennyksenä. {count} treeniä on jäljellä tällä viikolla.',
      'training.commentary.deload.dashboard_coach':
        'Palautuminen laahaa, joten pidä päivä kevyenä ja käsittele se kevennyksenä. {count} treeniä on jäljellä tällä viikolla.',
      'training.commentary.deload.workout_summary':
        'Palautuminen on heikkoa, joten pidä tämä treeni tavallista kevyempänä ja vältä grindia.',
      'training.commentary.deload.workout_start_toast': 'Kevennyssuositus',
      'training.commentary.deload.program_warning':
        'Palautuminen on nyt niin matala, että kevyempi vaihtoehto on turvallisempi ratkaisu.',
      'training.commentary.train_light.title': 'Maltillinen treenipäivä',
      'training.commentary.train_light.dashboard_summary':
        'Voit silti treenata, mutta pidä rasitus maltillisena ja vältä turhaa grindia. {count} treeniä on jäljellä tällä viikolla.',
      'training.commentary.train_light.dashboard_focus_support':
        'Voit silti treenata, mutta pidä rasitus maltillisena ja vältä turhaa grindia. {count} treeniä on jäljellä tällä viikolla.',
      'training.commentary.train_light.dashboard_coach':
        'Voit silti treenata, mutta pidä rasitus maltillisena ja vältä turhaa grindia. {count} treeniä on jäljellä tällä viikolla.',
      'training.commentary.train_light.workout_summary':
        'Voit treenata tänään, mutta pidä kuormitus varovaisempana ja anna treenin hengittää.',
      'training.commentary.train_light.workout_start_toast':
        'Maltillinen treenipäivä',
      'training.commentary.train_light.program_warning':
        'Voit edelleen treenata, mutta pidä päivän fysiologinen kuorma maltillisena.',
      'training.commentary.shorten.title': 'Lyhyt treenisuunnitelma',
      'training.commentary.shorten.dashboard_summary':
        'Tee päätyö ensin ja karsi apuliikkeitä pysyäksesi aikaraamissa. {count} treeniä on jäljellä tällä viikolla.',
      'training.commentary.shorten.dashboard_focus_support':
        'Tee päätyö ensin ja karsi apuliikkeitä pysyäksesi aikaraamissa. {count} treeniä on jäljellä tällä viikolla.',
      'training.commentary.shorten.dashboard_coach':
        'Tee päätyö ensin ja karsi apuliikkeitä pysyäksesi aikaraamissa. {count} treeniä on jäljellä tällä viikolla.',
      'training.commentary.shorten.workout_summary':
        'Tee päätyö ensin. Lisätyötä leikataan, jotta pysyt aikarajassa.',
      'training.commentary.shorten.workout_start_toast':
        'Lyhyt treenisuunnitelma',
      'training.commentary.shorten.program_warning':
        'Pidä korkean arvon työ ensin sisällä ja anna apuliikkeiden joustaa, jos aika käy tiukaksi.',
      'training.commentary.sport_aware.title': 'Lajikuorman huomioiva treeni',
      'training.commentary.sport_aware.dashboard_summary':
        'Lajikuorma on tänään korkea, joten suuntaa treeni pois raskaasta jalkatyöstä aina kun mahdollista. {count} treeniä on jäljellä tällä viikolla.',
      'training.commentary.sport_aware.dashboard_focus_support':
        'Lajikuorma on tänään korkea, joten suuntaa treeni pois raskaasta jalkatyöstä aina kun mahdollista. {count} treeniä on jäljellä tällä viikolla.',
      'training.commentary.sport_aware.dashboard_coach':
        'Lajikuorma on tänään korkea, joten suuntaa treeni pois raskaasta jalkatyöstä aina kun mahdollista. {count} treeniä on jäljellä tällä viikolla.',
      'training.commentary.sport_aware.workout_summary':
        '{sport}-kuormaa on paljon tämän päivän ympärillä, joten raskaampaa jalkatyötä voidaan leikata.',
      'training.commentary.sport_aware.workout_start_toast':
        'Lajikuorman huomioiva treeni',
      'training.commentary.sport_aware.program_warning':
        'Lajikuorma on nyt niin korkea, että raskas alavartalotyö pitää pitää kurissa tänään.',
      'training.commentary.train.title': 'Normaali treenipäivä',
      'training.commentary.train.dashboard_summary':
        'Palautuminen näyttää riittävän hyvältä normaaliin treeniin tänään. {count} treeniä on jäljellä tällä viikolla.',
      'training.commentary.train.dashboard_focus_support':
        'Palautuminen näyttää riittävän hyvältä normaaliin treeniin tänään. {count} treeniä on jäljellä tällä viikolla.',
      'training.commentary.train.dashboard_coach':
        'Palautuminen näyttää riittävän hyvältä normaaliin treeniin tänään. {count} treeniä on jäljellä tällä viikolla.',
      'training.commentary.train.workout_summary':
        'Voit treenata normaalisti tänään.',
      'training.commentary.train.workout_start_toast': 'Normaali treenipäivä',
      'training.commentary.train.program_warning':
        'Treeni voi mennä normaalisti tänään.',
      'training.reason.low_recovery.label': 'Heikko palautuminen',
      'training.reason.conservative_recovery.label': 'Palautumisvaroitus',
      'training.reason.tight_time_budget.label': '35 min raja',
      'training.reason.sport_load.label': 'Lajikuorma',
      'training.reason.equipment_constraint.label': 'Välineet',
      'training.reason.progression_stall.label': 'Eteneminen jumissa',
      'training.reason.guided_beginner.label': 'Ohjattu polku',
      'training.reason.week_complete.label': 'Viikko valmis',
      'training.reason.session_feedback_hard.label': 'Tuntui raskaalta',
      'training.reason.session_feedback_easy.label': 'Tuntui kevyeltä',
      'training.reason.duration_friction.label': 'Treenit venyneet',
      'training.adjustment.short_session_accessories_trimmed.body':
        'Apuliikkeitä karsittiin lyhyempää treeniä varten.',
      'training.adjustment.aux_volume_reduced.body':
        'Apuliikkeiden volyymia vähennettiin aikakattoon sopivaksi.',
      'training.adjustment.sport_support_trimmed.body':
        'Apuliikkeitä poistettiin, jotta treeni pysyy terävämpänä lajin tukemista varten.',
      'training.adjustment.sport_today.body':
        'Pitää alavartalotyön hallittavampana tämän päivän lajin ympärillä.',
      'training.adjustment.sport_tomorrow.body':
        'Huomenna on jalat kuormittavaa lajia, joten alavartalotyötä kevennettiin hieman.',
      'training.adjustment.sport_yesterday.body':
        'Eilen oli jaloille raskasta lajia, joten alavartalotyötä kevennettiin tälle päivälle.',
      'training.adjustment.sport_both.body':
        'Jalkoja kuormittavaa lajia on tämän treenin molemmin puolin, joten alavartalotyötä karsittiin.',
      'training.adjustment.exercise_replaced_equipment.body':
        'Vaihdettu liike {from} -> {to}, jotta se sopii käytettävissä olevaan kalustoon.',
      'training.adjustment.exercise_replaced_limit.body':
        'Vaihdettu liike {from} -> {to}, jotta nykyiset rajoitteet huomioidaan.',
      'training.adjustment.exercise_removed_limit.body':
        'Poistettu liike {exercise}, koska se on ristiriidassa nykyisten rajoitteiden kanssa.',
      'training.adjustment.program_sport_trimmed.body':
        '{program} karsi ensin alavartalon lisätyötä, koska lajikuorma on lähellä.',
      'training.adjustment.program_shoulder_trimmed.body':
        'Olkapäälle herkkää pystysuuntaista avustavaa työtä priorisoitiin alemmaksi tässä treenissä.',
      'training.adjustment.runner_shorten.body':
        'Matalamman prioriteetin työtä leikattiin, jotta saat olennaisen tehtyä nopeammin.',
      'training.adjustment.runner_lighten.body':
        'Pidä treeni liikkeessä, mutta tee jäljellä oleva työ hieman kevyempänä ja jätä enemmän varaa tankkiin.',
      'training.equipment.swap_hint.body':
        'Käytä exercise swapia vapaasti, jos käytössä oleva kalusto ei vastaa suunniteltua liikettä.',
      'training.equipment.same_pattern_swaps.body':
        '{program} suosii ensin saman liikemallin vaihtoja ennen kuin työtä pudotetaan pois.',
      'training.runner.kicker': 'Treenisuunnitelma',
      'training.runner.normal.title': 'Normaali treenin kulku',
      'training.runner.normal.copy':
        'Pidä fokus päätyössä ja etene jäljellä olevat sarjat normaalissa järjestyksessä.',
      'training.runner.shorten.title': 'Lyhennetty treeni',
      'training.runner.shorten.copy':
        'Matalamman prioriteetin työtä leikattiin, jotta saat olennaisen tehtyä nopeammin.',
      'training.runner.shorten.toast': 'Treeni lyhennettiin olennaiseen työhön',
      'training.runner.lighten.title': 'Kevennetty treeni',
      'training.runner.lighten.copy':
        'Pidä treeni liikkeessä, mutta tee jäljellä oleva työ hieman kevyempänä ja jätä enemmän varaa tankkiin.',
      'training.runner.lighten.toast': 'Jäljellä oleva työ kevennettiin',
      'training.runner.sport_aware.title': 'Lajikuorman huomioiva treeni',
      'training.runner.sport_aware.copy':
        'Jalkapainotteista työtä pidetään kurissa ympäröivän lajikuorman takia.',
      'training.runner.undo.toast': 'Viimeisin säätö peruttiin',
      'training.runner.no_change.toast':
        'Jäljellä oleva työ ei vaatinut säätöä',
      'dashboard.reason.low_recovery': 'Heikko palautuminen',
      'dashboard.reason.conservative': 'Palautumisvaroitus',
      'dashboard.reason.time_budget': '35 min raja',
      'dashboard.reason.sport_load': 'Lajikuorma',
      'dashboard.reason.equipment': 'Välineet',
      'dashboard.reason.stall': 'Eteneminen jumissa',
      'dashboard.reason.guided': 'Ohjattu polku',
      'dashboard.reason.complete': 'Viikko valmis',
      'dashboard.insights.title': 'Valmentajan huomio',
      'dashboard.insights.keep_going': 'Jatka samalla linjalla',
      'dashboard.insights.adherence': '30 pv toteuma',
      'dashboard.insights.best_days': 'Parhaat päivät',
      'dashboard.insights.best_days_line': 'Treenit osuvat luontevimmin {days}.',
      'dashboard.insights.sessions_90': '90 pv treenit',
      'dashboard.insights.friction': 'Kitkasignaalit',
      'dashboard.insights.state.continue': 'Raiteilla',
      'dashboard.insights.state.shorten': 'Lyhennä',
      'dashboard.insights.state.lighten': 'Kevennä',
      'dashboard.insights.state.deload': 'Kevennys',
      'dashboard.insights.state.switch_block': 'Vaihda blokkia',
      'dashboard.insights.show_more': 'Näytä nostot',
      'dashboard.insights.show_less': 'Piilota nostot',
      'dashboard.weekly_sessions': 'Viikon treenit',
      'dashboard.week_plan.title': 'Viikon näkymä',
      'dashboard.week_plan.train': 'Treeni',
      'dashboard.week_plan.sport': 'Laji',
      'dashboard.week_plan.rest': 'Lepo',
      'dashboard.week_plan.missed': 'Väliin jäi',
      'dashboard.week_plan.done': 'Tehty',
      'rest_day.head': 'Palautuminen',
      'rest_day.category.sleep': 'Uni',
      'rest_day.category.hydration': 'Nesteytys',
      'rest_day.category.mobility': 'Liikkuvuus',
      'rest_day.category.active_recovery': 'Aktiivinen palautuminen',
      'rest_day.category.mental': 'Mieli',
      'rest_day.tip.1': 'Suojaa yöuni ja anna palautumisen tehdä työnsä.',
      'rest_day.tip.2': 'Tasainen nukkumaanmenoaika helpottaa huomista.',
      'rest_day.tip.3': 'Vaihda myöhäinen selailu rauhallisempaan iltaan.',
      'rest_day.tip.4':
        'Usein hyvä palautuminen on vain ruokaa, rauhaa ja unta.',
      'rest_day.tip.5': 'Aloita päivä vedellä ja pysy janon edellä.',
      'rest_day.tip.6':
        'Juot pitkin päivää mieluummin kuin kurot illalla kiinni.',
      'rest_day.tip.7':
        'Kovan treenin jälkeen lisäneste auttaa yllättävän paljon.',
      'rest_day.tip.8': 'Pidä pullo lähellä ja tee juomisesta automaattista.',
      'rest_day.tip.9': 'Viisi helppoa minuuttia liikkuvuutta riittää tänään.',
      'rest_day.tip.10':
        'Liiku rauhallisesti ja lopeta paremmalla tunteella kuin aloitit.',
      'rest_day.tip.11': 'Valitse yksi kireä kohta ja anna sille huomiota.',
      'rest_day.tip.12':
        'Pitkät uloshengitykset auttavat rentoutumaan asentoihin.',
      'rest_day.tip.13':
        'Lyhyt kävely riittää hyvin aktiiviseksi palautumiseksi.',
      'rest_day.tip.14': 'Kevyt liike voittaa usein täyden paikallaanolon.',
      'rest_day.tip.15': 'Pidä päivä niin kevyenä, että energia alkaa palata.',
      'rest_day.tip.16':
        'Palauttavan liikkeen pitäisi tuntua melkein liian helpolta.',
      'rest_day.tip.17': 'Lepopäiväkin kuuluu ohjelmaan.',
      'rest_day.tip.18': 'Huomaa tänään, mikä tällä viikolla toimi hyvin.',
      'rest_day.tip.19': 'Kurinalaisuus on myös turhan väsymyksen välttämistä.',
      'rest_day.tip.20':
        'Kehitys syntyy hyvästä treenistä ja tarkoituksellisesta palautumisesta.',
      'dashboard.progress_complete': 'Viikon tavoite täynnä',
      'dashboard.progress_remaining_one': '1 treeni jäljellä tällä viikolla',
      'dashboard.progress_remaining_many':
        '{count} treeniä jäljellä tällä viikolla',
      'dashboard.sport_sessions_week':
        'Tällä viikolla kirjattu {count} {sport}-treeniä',
      'dashboard.calendar.legend_lift': 'Treeni kirjattu',
      'dashboard.calendar.legend_sport': 'Lajitreeni kirjattu',
      'dashboard.calendar.legend_scheduled': 'Suunniteltu lajipäivä',
      'dashboard.calendar.legend_hint': 'Napauta päivää nähdäksesi tiedot',
      'onboarding.kicker': 'Ohjattu aloitus',
      'onboarding.action.use_plan': 'Käytä tätä suunnitelmaa',
      'onboarding.action.not_now': 'Ei nyt',
      'onboarding.action.continue': 'Jatka',
      'onboarding.action.back': 'Takaisin',
      'onboarding.step.0.title': 'Rakenna lähtöpisteesi',
      'onboarding.step.0.sub':
        'Tämä antaa avustajalle tarpeeksi signaalia oikean aloitussuunnitelman suositteluun.',
      'onboarding.step.1.title': 'Aseta treenin raamit',
      'onboarding.step.1.sub':
        'Nämä rajat ohjaavat taajuutta, treenin lyhentämistä ja ohjelman sopivuutta.',
      'onboarding.step.2.title': 'Lisää laji ja rajoitteet',
      'onboarding.step.2.sub':
        'Kerro avustajalle mitä on kunnioitettava, erityisesti säännöllinen lajikuormasi ja todelliset rajoitteesi.',
      'onboarding.step.3.title': 'Valitse ohjauksen taso',
      'onboarding.step.3.sub':
        'Tämä määrittää kuinka voimakkaasti appin kannattaa tehdä puolestasi päätöksiä.',
      'onboarding.step.4.title': 'Aloita oikeasta suunnitelmasta',
      'onboarding.step.4.sub':
        'Ohjatun aloituksen jälkeen sinulla pitäisi olla selkeä ohjelma, ensimmäinen viikko ja ensimmäinen treeni.',
      'onboarding.field.goal': 'Päätavoite',
      'onboarding.field.experience': 'Kokemustaso',
      'onboarding.field.frequency': 'Treenitaajuus',
      'onboarding.field.duration': 'Treenin pituus',
      'onboarding.field.equipment': 'Välineet käytössä',
      'onboarding.field.sport': 'Laji tai kestävyys',
      'onboarding.field.sport_placeholder':
        'esim. Jääkiekko, juoksu, jalkapallo',
      'onboarding.field.sport_help':
        'Lisää tähän säännöllinen lajisi tai muu toistuva harrastus, jos se vaikuttaa viikon palautumiseen.',
      'onboarding.field.sport_sessions': 'Treeniä / viikko',
      'onboarding.field.in_season': 'Kilpailukaudella',
      'onboarding.field.in_season_help':
        'Käytä hieman konservatiivisempaa aloitusta, kun laji kuormittaa jo oikeasti arjessa.',
      'onboarding.field.joints': 'Nivelrajoitteet',
      'onboarding.field.movements': 'Vältettävät liikemallit',
      'onboarding.field.avoid_exercises': 'Vältettävät liikkeet',
      'onboarding.field.avoid_exercises_placeholder':
        'Pilkuilla erotellut liikenimet',
      'onboarding.field.avoid_exercises_help':
        'Tätä käytetään sulkemaan selvät no-go-liikkeet pois ensisuosituksesta ja tulevasta treenin adaptoinnista.',
      'onboarding.goal.strength': 'Voima',
      'onboarding.goal.strength_desc': 'Paranna pääliikkeitäsi ja etenemistä.',
      'onboarding.goal.hypertrophy': 'Hypertrofia',
      'onboarding.goal.hypertrophy_desc': 'Suosi lihaskasvua ja volyymia.',
      'onboarding.goal.general_fitness': 'Yleiskunto',
      'onboarding.goal.general_fitness_desc':
        'Pidä treenaaminen kestävänä ja laajasti hyödyllisenä.',
      'onboarding.goal.sport_support': 'Lajin tukeminen',
      'onboarding.goal.sport_support_desc':
        'Sovita voimaharjoittelu ulkoisen laji- tai kestävyyskuorman ympäri.',
      'onboarding.experience.beginner': 'Aloittelija',
      'onboarding.experience.beginner_desc':
        'Haluat yksinkertaiset oletukset ja matalan monimutkaisuuden.',
      'onboarding.experience.returning': 'Aiemmin treenannut',
      'onboarding.experience.returning_desc':
        'Olet treenannut ennen ja haluat löytää taas vakaan rytmin.',
      'onboarding.experience.intermediate': 'Jatkotaso',
      'onboarding.experience.intermediate_desc':
        'Pärjäät jo rakenteellisemman ohjelman ja maltillisen autoregulaation kanssa.',
      'onboarding.experience.advanced': 'Edistynyt',
      'onboarding.experience.advanced_desc':
        'Haluat enemmän säätövaraa, korkeampaa kattoa ja hienovaraisempaa suunnittelua.',
      'onboarding.frequency_value': '{count} treeniä / viikko',
      'onboarding.duration_value': '{count} min',
      'onboarding.equipment.full_gym': 'Täysi kuntosali',
      'onboarding.equipment.basic_gym': 'Peruskuntosali',
      'onboarding.equipment.home_gym': 'Kotisali',
      'onboarding.equipment.minimal': 'Minimivarusteet',
      'onboarding.guidance.guided': 'Kerro mitä teen',
      'onboarding.guidance.guided_desc':
        'Vahvat oletussuositukset, vähemmän manuaalisia päätöksiä.',
      'onboarding.guidance.balanced': 'Tasapainoinen',
      'onboarding.guidance.balanced_desc':
        'Hyvät oletukset, mutta jättää silti tilaa ohjata suunnitelmaa.',
      'onboarding.guidance.self_directed': 'Anna kontrolli',
      'onboarding.guidance.self_directed_desc':
        'Keveämpi ohjaus ja enemmän tilaa omille valinnoille.',
      'onboarding.joint.shoulder': 'Olkapää',
      'onboarding.joint.knee': 'Polvi',
      'onboarding.joint.low_back': 'Alaselkä',
      'onboarding.movement.squat': 'Kyykky',
      'onboarding.movement.hinge': 'Lantionojennus',
      'onboarding.movement.vertical_press': 'Pystypunnerrus',
      'onboarding.movement.single_leg': 'Yhden jalan liike',
      'onboarding.recommend.kicker': 'Suositeltu ohjelma',
      'onboarding.recommend.sub':
        'Tämä on paras aloituspiste tavoitteesi, aikataulusi, lajikuormasi ja halutun ohjaustason perusteella.',
      'onboarding.recommend.week1': 'Viikko 1',
      'onboarding.recommend.sessions': '{count} treeniä',
      'onboarding.recommend.level': 'Taso',
      'onboarding.recommend.start_here': 'Aloita tästä',
      'onboarding.recommend.time_target': 'Aikatavoite',
      'onboarding.recommend.first_step_kicker': 'Ensimmäinen askel',
      'onboarding.recommend.first_step_with_time':
        'Aloita tänään treenillä {session}. Pidä se noin {time}.',
      'onboarding.recommend.first_step_default':
        'Aloita tänään treenillä {session}. Käytä ensimmäistä viikkoa karttana.',
      'onboarding.fit.title': 'Miksi tämä sopii sinulle',
      'onboarding.fit.goal.hypertrophy': 'Tavoite: lihaskasvu',
      'onboarding.fit.goal.strength': 'Tavoite: voima',
      'onboarding.fit.goal.general_fitness': 'Tavoite: yleiskunto',
      'onboarding.fit.goal.sport_support': 'Tavoite: lajin tuki',
      'onboarding.fit.frequency': '{count} treeniä / viikko',
      'onboarding.fit.guided': 'Ohjattu',
      'onboarding.fit.self_directed': 'Joustava',
      'onboarding.fit.in_season': 'Kausi huomioitu',
      'onboarding.recommend.why_title': 'Miksi tämä on paras aloitus',
      'onboarding.recommend.week_title': 'Ensimmäinen viikkosi',
      'onboarding.recommend.start_title': 'Aloita tällä treenillä',
      'onboarding.recommend.start_body':
        'Tämä antaa selkeimmän rampin sisään suunnitelmaan ja pitää ensimmäisen viikon realistisena.',
      'onboarding.first_session_label': 'Treeni {value}',
      'onboarding.first_session_default': 'Treeni 1',
      'onboarding.complete_toast':
        'Suunnitelma luotu ja ohjattu aloitus valmis',
      'onboarding.why.hypertrophy':
        'Tukee hypertrofiatavoitettasi ilman että aloitus pakotetaan voimapainotteiseksi.',
      'onboarding.why.sport_support':
        'Tasapainottaa salitreenin muun lajikuorman kanssa ja pitää palautumisen hallittavampana.',
      'onboarding.why.goal_match': 'Vastaa päätavoitettasi: {goal}.',
      'onboarding.why.guided':
        'Pitää päätöksenteon kuorman matalana ja antaa selkeämmän oletuspolun.',
      'onboarding.why.in_season':
        'Huomioi kilpailukauden rajoitteet ja pitää viikkokuorman realistisempana.',
      'onboarding.adjustment.short_session':
        'Ensimmäistä treeniä lyhennetään aikarajasi mukaan.',
      'onboarding.adjustment.sport':
        'Avustaja ohjaa pois jalkapainotteisesta työstä, kun lajikuorma on korkea.',
      'plan.week.day_label': 'Päivä {day}',
      'plan.week.type.main_lift': 'Pääliikepäivä',
      'plan.week.type.split': 'Jako-ohjelman treeni',
      'plan.week.type.full_body': 'Kokovartalotreeni',
      'plan.week.type.strength': 'Voimapäivä',
      'plan.week.type.workout_a': 'Treeni A',
      'plan.week.type.workout_b': 'Treeni B',
      'history.empty_title': 'Ei vielä treenejä',
      'history.empty_sub':
        'Tee ensimmäinen treeni, niin historia alkaa kertymään.',
      'history.subtitle': 'Treenihistoriasi',
      'history.start_today': 'Aloita tämän päivän treeni',
      'history.current_phase': 'Nykyinen vaihe',
      'history.no_streak': 'Ei putkea vielä',
      'history.lifts_per_week': 'nostoa/vko',
      'history.legend.lift': 'Nosto',
      'history.legend.both': 'Molemmat',
      'history.sport': 'Urheilu',
      'history.rep_pr': 'Toistoennätys',
      'history.activity_title': 'AKTIIVISUUS · {weeks} VK',
      'history.total_volume_label': 'kokonaisvolyymi',
      'history.streak_unit': 'vk',
      'history.streak_label': 'putki',
      'history.card.week_day': 'Viikko {week} · Päivä {day}',
      'history.card.volume': 'Volyymi',
      'history.card.exercises': 'Liikkeet',
      'history.card.notes': 'Muistiinpanot',
      'history.week_label': 'VIIKKO {week}',
      'history.block_label': '{program} – {block} (Vk {start}-{end})',
      'history.remove_workout_from': 'Poista treeni päivältä {date}?',
      'history.delete_workout': 'Poista treeni',
      'history.delete_sport': 'Poista {sport}-treeni',
      'history.remove_sport_from': 'Poista {sport}-treeni päivältä {date}?',
      'history.session_deleted': 'Treeni poistettu',
      'history.session_restored': 'Treeni palautettu!',
      'history.stats_empty_title': 'Ei vielä tilastoja',
      'history.stats_empty_sub':
        'Suorita muutama treeni nähdäksesi kehityksesi.',
      'settings.tabs.schedule': 'Aikataulu',
      'settings.tabs.preferences': 'Preferenssit',
      'settings.tabs.program': 'Ohjelma',
      'settings.tabs.account': 'Tili',
      'settings.tabs.sport': 'Urheilu',
      'settings.tabs.my_sport': 'Lajini',
      'settings.tabs.training': 'Treeni',
      'settings.tabs.app_data': 'Sovellus & data',
      'settings.tabs.app': 'Sovellus',
      'settings.sport_card': 'Urheilu / Cardio',
      'settings.sport_load.title': 'Lajini',
      'settings.sport_load.subtitle':
        'Aseta laji tai cardio, joka vaikuttaa eniten treeniviikkoosi.',
      'settings.sport_load.section.activity': 'Laji',
      'settings.sport_load.section.activity_sub':
        'Nimeä toistuva laji tai cardio, joka vaikuttaa treeniviikkoosi.',
      'settings.sport_load.section.profile': 'Kuormitusprofiili',
      'settings.sport_load.section.profile_sub':
        'Määritä kuinka vahvasti lajikuorma ohjaa treeniä pois raskaasta alavartalotyöstä.',
      'settings.sport_load.section.guidance': 'Ohjaus treenissä',
      'settings.sport_load.section.guidance_sub':
        'Käytä nopeaa check-inia treenipäivänä, jotta treenin valinta reagoi lajikuormaan.',
      'settings.activity_name': 'Lajin nimi',
      'settings.activity_placeholder': 'esim. Jääkiekko, jalkapallo, juoksu',
      'settings.status.generic_sport': 'Laji / cardio',
      'settings.intensity': 'Intensiteetti',
      'settings.intensity.easy': 'Kevyt',
      'settings.intensity.moderate': 'Kohtalainen',
      'settings.intensity.hard': 'Kova',
      'settings.leg_heavy': 'Jalkapainotteinen',
      'settings.leg_heavy_sub': 'Varoittaa jalkatreenistä urheilun jälkeen',
      'settings.regular_sport_days': 'Säännölliset urheilupäivät',
      'settings.training_program': 'Treeniohjelma',
      'settings.program_basics': 'Pika-asetukset',
      'settings.program_advanced_title': 'Lisäasetukset',
      'settings.program_advanced_help':
        'Liikevalinnat, syklihallinta, huippuvaihe ja ohjelmakohtaiset asetukset.',
      'settings.open_program_setup': 'Avaa lisäasetukset',
      'settings.default_rest': 'Oletus lepoajastin',
      'settings.training_defaults': 'Harjoittelun oletukset',
      'settings.preferences.title': 'Harjoituspreferenssit',
      'settings.preferences.help':
        'Nämä asetukset ohjaavat tulevia älykkäitä suosituksia ja myöhempää AI-treenin generointia.',
      'settings.preferences.goal': 'Päätavoite',
      'settings.preferences.goal.strength': 'Voima',
      'settings.preferences.goal.hypertrophy': 'Hypertrofia',
      'settings.preferences.goal.general_fitness': 'Yleiskunto',
      'settings.preferences.goal.sport_support': 'Lajin tukeminen',
      'settings.preferences.training_days': 'Tavoiteltu treenitaajuus',
      'settings.preferences.training_days_value': '{count} treeniä / viikko',
      'settings.preferences.session_duration': 'Tavoitetreenin pituus',
      'settings.preferences.duration_value': '{minutes} min',
      'settings.preferences.duration_value.30': '30 min',
      'settings.preferences.duration_value.45': '45 min',
      'settings.preferences.duration_value.60': '60 min',
      'settings.preferences.duration_value.75': '75 min',
      'settings.preferences.duration_value.90': '90 min',
      'settings.preferences.equipment': 'Välineet käytössä',
      'settings.preferences.equipment.full_gym': 'Täysi kuntosali',
      'settings.preferences.equipment.basic_gym': 'Peruskuntosali',
      'settings.preferences.equipment.home_gym': 'Kotisali',
      'settings.preferences.equipment.minimal': 'Minimivälineet',
      'settings.preferences.sport_check': 'Lajikuorman check-in ennen treeniä',
      'settings.preferences.sport_check_help':
        'Kysy lajikuormasta tämän päivän ympärillä ennen treenin suosittelua.',
      'settings.preferences.warmup_sets': 'Automaattiset lämmittelysarjat',
      'settings.preferences.warmup_sets_help':
        'Lisää pääliikkeisiin lämmittelyrampin (50–85 %) ennen työsarjoja.',
      'settings.preferences.notes': 'Muistiinpanot, rajoitteet ja mieltymykset',
      'settings.preferences.notes_placeholder':
        'esim. Vältä korkeita hyppyjä, suosi levytankoliikkeitä, 60 min maksimi',
      'settings.preferences.detailed_view': 'Näytä tarkat mittarit',
      'settings.preferences.detailed_view_help':
        'Näytä edistyneet tilastot, kuten yksittäiset väsymysmittarit ja treenimaksimit etusivulla.',
      'settings.preferences.restart_onboarding':
        'Aja ohjattu aloitus uudelleen',
      'settings.preferences.restart_onboarding_active':
        'Viimeistele tai keskeytä aktiivinen treeni ennen kuin avaat ohjatun aloituksen uudelleen.',
      'settings.preferences.section.goals': 'Tavoitteet ja volyymi',
      'settings.preferences.section.equipment': 'Varusteet ja treenivalmistelu',
      'settings.preferences.section.session': 'Treeniasetukset',
      'settings.preferences.save': 'Tallenna preferenssit',
      'settings.edit_program': 'Muokkaa ohjelmaa',
      'settings.edit_program_advanced': 'Ohjelman lisäasetukset',
      'settings.data_backup': 'Varmuuskopio',
      'settings.export': 'Vie',
      'settings.import': 'Tuo',
      'settings.backup_help':
        'Vienti tallentaa kaiken datan JSON-tiedostoon. Tuonti korvaa kaiken nykyisen datan.',
      'settings.backup_context': '{count} treeni\u00e4 alkaen {date}',
      'settings.backup_empty': 'Ei viel\u00e4 tallennettuja treenej\u00e4.',
      'settings.danger': 'Vaara-alue',
      'settings.status.no_days': 'Ei p\u00e4ivi\u00e4 asetettu',
      'settings.danger_desc':
        'T\u00e4m\u00e4 poistaa pysyv\u00e4sti kaikki treenisi, ohjelmasi ja asetuksesi. T\u00e4t\u00e4 ei voi perua.',
      'settings.danger_type_confirm': 'Kirjoita DELETE vahvistaaksesi',
      'settings.sign_out': 'Kirjaudu ulos',
      'settings.clear_all': 'Tyhjenn\u00e4 kaikki data',
      'settings.clear_all_confirm': 'Poista kaikki data pysyv\u00e4sti',
      'settings.clear_all': 'Tyhjennä kaikki data',
      'settings.program_setup': 'Ohjelman asetukset',
      'settings.account_section': 'Tili',
      'settings.sync.syncing': 'Synkataan muutoksia...',
      'settings.sync.synced': 'Synkattu pilveen',
      'settings.sync.error':
        'Pilvisynkassa on ongelma. Muutokset ovat tallessa tällä laitteella.',
      'settings.sync.offline':
        'Offline-tila. Muutokset synkataan, kun yhteys palautuu.',
      'workout.log_extra': 'Kirjaa ylimääräinen {sport}-treeni',
      'workout.unscheduled_session': 'Aikatauluttamaton {sport}-treeni',
      'workout.training_session': 'Treeni',
      'workout.log_extra_sport': 'Kirjaa ylimääräinen urheilutreeni',
      'workout.unscheduled_sport_session': 'Aikatauluttamaton urheilutreeni',
      'workout.start_session': 'Aloita treeni',
      'workout.training_day': 'Treenipäivä',
      'workout.simple.your_workout': 'Treenisi',
      'workout.simple.start': 'Aloita treeni',
      'workout.day': 'Päivä',
      'workout.start_workout': 'Aloita treeni',
      'workout.today.kicker': 'Tänään painota',
      'workout.today.focus': 'Pidä päätyö terävänä ja treeni napakkana.',
      'workout.warning.title': 'Treenivaroitus',
      'workout.warning.low_recovery': 'Heikko palautuminen',
      'workout.warning.low_recovery_copy':
        'Harkitse lepoa. Jos treenaat, Päivä {day} on turvallisempi vaihtoehto.',
      'workout.add_exercise': 'Lisää liike',
      'workout.rest_timer': 'Lepoajastin',
      'workout.finish_session': 'Tallenna treeni',
      'workout.cancel_session': 'Keskeytä treeni',
      'workout.discard_session':
        'Hylätäänkö käynnissä oleva treeni? Sarjoja ei tallenneta.',
      'workout.session_discarded': 'Treeni keskeytettiin.',
      'workout.no_previous_data': 'Ei aiempaa dataa',
      'workout.last_prefix': 'Edellinen:',
      'workout.last_best': 'Edellinen paras: {weight}kg',
      'workout.remove_exercise': 'Poista liike',
      'workout.weight_placeholder': 'kg',
      'workout.reps_placeholder': 'toistot',
      'workout.reps_hit': 'tehdyt',
      'workout.rir': 'RIR',
      'workout.rir_prompt_title': 'Viimeisen sarjan kysymys',
      'workout.rir_prompt_body':
        'Kuinka monta toistoa sinulle jäi varastoon liikkeen {exercise} viimeisen työsarjan jälkeen?',
      'workout.rir_prompt_skip': 'Ohita nyt',
      'workout.rir_saved': 'RIR tallennettu',
      'workout.max_short': 'MAX',
      'workout.swap': 'Vaihda',
      'workout.add_set': '+ Sarja',
      'workout.add_at_least_one': 'Lisää vähintään yksi liike!',
      'workout.deload_light': 'Kevyt viikko - pidetään kevyenä',
      'workout.exercise_removed': '{name} poistettu',
      'workout.session_saved': 'Treeni tallennettu!',
      'workout.session_complete': 'Treeni valmis',
      'workout.summary.notes_label': 'Treenimuistiinpanot',
      'workout.summary.notes_placeholder':
        'Jäikö tästä treenistä jotain muistiin?',
      'workout.summary.feedback_label': 'Miltä tuntui?',
      'workout.summary.feedback_good': 'Hyvä',
      'workout.summary.feedback_too_easy': 'Liian helppo',
      'workout.summary.feedback_too_hard': 'Liian raskas',
      'workout.summary.log_post_workout_meal':
        'Kirjaa treenin jälkeinen ateria',
      'workout.summary_duration': 'Kesto',
      'workout.summary_sets': 'Sarjat',
      'workout.summary_volume': 'Volyymi',
      'workout.summary_rpe': 'RPE',
      'workout.completed_sets': '{completed}/{total} sarjaa tehty',
      'workout.program_error':
        'Treeni tallennettiin, mutta ohjelman tila kannattaa tarkistaa.',
      'workout.extra_logged': 'Ylimääräinen {sport} kirjattu!',
      'workout.next_cycle': '{program} - sykli {cycle} alkaa nyt.',
      'workout.next_week': '{program} - seuraavaksi {label}!',
      'workout.coach_note.pr_single':
        'Uusi ennätys, {exercise}! Jatka samaan malliin.',
      'workout.coach_note.pr_multi':
        'Uusia ennätyksiä, {exercises}! Loistava treeni.',
      'workout.coach_note.tm_increase':
        'Voima kasvaa: {lift} +{delta}kg → nyt {tm}kg',
      'workout.coach_note.tm_adjustment_up':
        '{lift} TM ↑ {tm} kg (+{delta})',
      'workout.coach_note.tm_adjustment_down':
        '{lift} TM ↓ {tm} kg (-{delta})',
      'workout.coach_note.week_advance':
        'Viikko {week} alkaa nyt. Rakenna sen päälle.',
      'workout.coach_note.cycle_advance':
        'Sykli {cycle} alkaa — uusi progressiolohko.',
      'workout.coach_note.tough_session':
        'Kova treeni — lepää hyvin ja palaa vahvempana.',
      'workout.coach_note.partial_session':
        'Osittainen treeni kirjattu. Mikä tahansa treeni lasketaan — jatkuvuus ratkaisee.',
      'workout.coach_note.clean': 'Kaikki sarjat tehty. Hyvää työtä.',
      'workout.plan.kicker': 'Tämän päivän päätös',
      'workout.plan.deload': 'Kevennyssuositus',
      'workout.plan.deload_copy':
        'Palautuminen on heikkoa, joten pidä tämä treeni tavallista kevyempänä ja vältä grindia.',
      'workout.plan.train_light': 'Maltillinen treenipäivä',
      'workout.plan.train_light_copy':
        'Voit treenata tänään, mutta pidä kuormitus varovaisempana ja anna treenin hengittää.',
      'workout.plan.shorten': 'Lyhyt treenisuunnitelma',
      'workout.plan.shorten_copy':
        'Tee päätyö ensin. Lisätyötä leikataan, jotta pysyt aikarajassa.',
      'workout.plan.sport_load': 'Lajikuorman huomioiva treeni',
      'workout.plan.sport_load_copy':
        '{sport}-kuormaa on paljon tämän päivän ympärillä, joten raskaampaa jalkatyötä voidaan leikata.',
      'workout.plan.normal': 'Normaali treenipäivä',
      'workout.plan.normal_copy': 'Voit treenata normaalisti tänään.',
      'workout.start_override.recommended': 'Kevennetty treeni',
      'workout.start_override.recommended_copy':
        'Noudata tämän päivän palautumissuositusta ja pidä treeni kevyempänä.',
      'workout.start_override.normal': 'Normaali treeni',
      'workout.start_override.normal_copy':
        'Pidä alkuperäinen suunnitelma ja treenaa ilman automaattista kevennystä.',
      'workout.session_mode.auto': 'Auto',
      'workout.session_mode.auto_copy_light':
        'Noudata tämän päivän kevennyssuositusta automaattisesti.',
      'workout.session_mode.auto_copy_normal':
        'Noudata tämän päivän normaalia treenisuositusta automaattisesti.',
      'workout.session_mode.normal': 'Normaali treeni',
      'workout.session_mode.normal_copy':
        'Pidä alkuperäinen suunnitelma ja ohita automaattinen kevennys.',
      'workout.session_mode.light': 'Kevyt treeni',
      'workout.session_mode.light_copy':
        'Aloita kevyempi treenivaihtoehto, vaikka päivä muuten olisi normaali.',
      'workout.energy.title': 'Miltä olo tuntuu?',
      'workout.energy.low': 'Vähän energiaa',
      'workout.energy.normal': 'Normaali',
      'workout.energy.strong': 'Vahva olo',
      'workout.bonus.label': 'Bonustreeni',
      'workout.bonus.subtitle': 'Lis\u00e4treeni viikolta puuttuviin lihasryhmiin',
      'workout.bonus.kicker': 'Viikko kasassa',
      'workout.bonus.start': 'Aloita bonustreeni',
      'workout.bonus.preview_title': 'Bonussessio',
      'workout.bonus.note': 'T\u00e4ydent\u00e4v\u00e4 ty\u00f6 \u00b7 3 sarjaa \u00d7 10\u201312',
      'workout.bonus.toast_started': 'Bonustreeni k\u00e4yntiin \u2014 tsemppi\u00e4!',
      'workout.bonus.toast_saved': 'Bonustreeni tallennettu!',
      'workout.bonus.duration.quick': '~20 min',
      'workout.bonus.duration.standard': '~35 min',
      'workout.bonus.duration.full': '~50 min',
      'history.bonus_badge': 'Bonus',
      'muscle.chest': 'Rinta',
      'muscle.back': 'Selk\u00e4',
      'muscle.shoulders': 'Olkap\u00e4\u00e4t',
      'muscle.quads': 'Etureisi',
      'muscle.hamstrings': 'Takareisi',
      'muscle.glutes': 'Pakarat',
      'muscle.core': 'Keskivartalo',
      'muscle.biceps': 'Hauikset',
      'muscle.triceps': 'Ojentajat',
      'workout.setup.kicker': 'Treenin säädöt',
      'workout.setup.advanced_toggle': 'Hienosäätö: {mode}',
      'workout.setup.advanced_hint':
        'Käytä tätä vain jos haluat ohittaa tavallisen suosituksen.',
      'workout.tm_updated_single':
        '{lift} TM päivitetty: {old} → {next} kg',
      'workout.tm_updated_multi': 'TM:t päivitetty: {changes}',
      'workout.runner.kicker': 'Treenisuunnitelma',
      'workout.runner.normal': 'Normaali treeni',
      'workout.runner.lighten': 'Kevennetty treeni',
      'workout.runner.shorten': 'Lyhennetty treeni',
      'workout.runner.adjusted': 'Säädetty treeni',
      'workout.runner.normal_title': 'Normaali treenin kulku',
      'workout.runner.normal_copy':
        'Pidä fokus päätyössä ja etene jäljellä olevat sarjat normaalissa järjestyksessä.',
      'workout.runner.shorten_title': 'Lyhennetty treeni',
      'workout.runner.shorten_copy':
        'Matalamman prioriteetin työtä leikattiin, jotta saat olennaisen tehtyä nopeammin.',
      'workout.runner.light_title': 'Kevennetty treeni',
      'workout.runner.light_copy':
        'Pidä treeni liikkeessä, mutta tee jäljellä oleva työ hieman kevyempänä ja jätä enemmän varaa tankkiin.',
      'workout.runner.sport_title': 'Lajikuorman huomioiva treeni',
      'workout.runner.sport_copy':
        'Jalkapainotteista työtä pidetään kurissa ympäröivän lajikuorman takia.',
      'workout.runner.done':
        'Päätyö on tehty. Voit lopettaa tähän tai tehdä vielä valinnaista työtä.',
      'workout.runner.completed': '{count} sarjaa tehty',
      'workout.runner.remaining': '{count} sarjaa jäljellä',
      'workout.runner.elapsed': '{count} min kulunut',
      'workout.runner.next': 'Seuraavaksi: {target}',
      'workout.runner.stop_after_this': 'Voit lopettaa tämän liikkeen jälkeen',
      'workout.runner.stop_after_this_copy':
        'Kun tämä liike on tehty, treenin tärkein työ on jo kasassa.',
      'workout.runner.stop_after_target':
        'Voit lopettaa liikkeen {target} jälkeen',
      'workout.runner.stop_after_target_copy':
        'Näin tärkeä työ jää sisään ja loppu muuttuu valinnaiseksi lisävolyymiksi.',
      'workout.runner.sport_finish_title':
        'Hyvä lopetuskohta tämän liikkeen jälkeen',
      'workout.runner.sport_finish_copy':
        'Lajikuorma on nyt sen verran korkea, että lopettaminen avaintyön jälkeen on fiksu ratkaisu tänään.',
      'workout.runner.shorten_btn': 'Lyhennä',
      'workout.runner.lighten_btn': 'Kevennä',
      'workout.runner.undo_btn': 'Peru säätö',
      'workout.runner.shorten_toast': 'Treeni lyhennettiin olennaiseen työhön',
      'workout.runner.light_toast': 'Jäljellä oleva työ kevennettiin',
      'workout.runner.no_change': 'Jäljellä oleva työ ei vaatinut säätöä',
      'workout.runner.undo_toast': 'Viimeisin säätö peruttiin',
      'workout.runner.shorten_confirm_title': 'Lyhennetäänkö treeniä?',
      'workout.runner.shorten_confirm_body':
        'Valitse kuinka aggressiivisesti jäljellä olevaa työtä lyhennetään sen mukaan paljonko aikaa haluat säästää.',
      'workout.runner.light_confirm_title': 'Kevennetäänkö treeniä?',
      'workout.runner.light_confirm_body':
        'Tämä pitää treenin rakenteen pääosin samana, mutta keventää jäljellä olevaa kuormaa ja leikkaa hieman volyymia tarvittaessa. Käytä tätä kun palautuminen tuntuu heikolta.',
      'workout.runner.shorten_option_light': 'Säästä ~5 min',
      'workout.runner.shorten_option_light_body':
        'Poista vain accessory-työ ja pidä muu rakenne ennallaan.',
      'workout.runner.shorten_option_medium': 'Säästä ~10 min',
      'workout.runner.shorten_option_medium_body':
        'Jätä jokaiseen jäljellä olevaan liikkeeseen vähintään kaksi työsarjaa ja leikkaa matalamman prioriteetin volyymia.',
      'workout.runner.shorten_option_hard': 'Säästä ~15 min',
      'workout.runner.shorten_option_hard_body':
        'Lyhennä kovemmin: jätä kaksi työsarjaa per liike ja pudota viimeinen aloittamaton liike pois tarvittaessa.',
      'workout.quick_fill_suggested': 'Käytä {weight}kg',
      'workout.quick_fill_copy': 'Kopioi ensimmäinen sarja alas',
      'workout.quick_fill_copy_toast':
        'Jäljellä olevat sarjat täytettiin ensimmäisen työsarjan mukaan',
      'workout.quick_fill_suggested_toast':
        'Suositeltu kuorma asetettiin jäljellä oleviin sarjoihin',
      'program.active': 'Aktiivinen',
      'program.setup_saved': 'Ohjelman asetukset tallennettu!',
      'program.switch_to': 'Vaihda ohjelmaan {name}',
      'program.switch_msg':
        'Nykyinen ohjelma keskeytetään. {name} jatkaa siitä mihin jäit.',
      'program.switched': 'Vaihdettu ohjelmaan {name}',
      'program.switch_estimated_loads':
        'Aloituskuormat arvioitiin viimeaikaisesta treenistäsi: {changes}. Voit säätää niitä asetuksissa.',
      'program.recommended': 'Suositeltu',
      'program.simple.next': 'Seuraava',
      'program.done': 'Tehty',
      'program.leg_heavy': 'Jalkapainotteinen',
      'program.recommend_reason.title': 'Miksi juuri tämä treeni',
      'program.recommend_reason.starred_title':
        'Miksi suositeltu treeni on ehdotettu',
      'program.recommend_reason.progression':
        'Sopii ohjelman normaaliin etenemisjärjestykseen.',
      'program.recommend_reason.short_session':
        'Sopii lyhyempään treenitavoitteeseesi.',
      'program.recommend_reason.lower_volume':
        'Pitää kokonaistreenin hallittavampana tänään.',
      'program.recommend_reason.sport_support_upper':
        'Säästää jalkakuormaa lajin tukemista varten.',
      'program.recommend_reason.fresh_muscles':
        'Osuu tuoreempiin lihasryhmiin: {groups}.',
      'program.recommend_reason.sport_context_yesterday':
        'Pitää alavartalotyön hallittavampana eilisen raskaan lajikuorman jälkeen.',
      'program.recommend_reason.sport_context_today':
        'Pitää alavartalotyön hallittavampana tämän päivän lajin ympärillä.',
      'program.recommend_reason.sport_context_tomorrow':
        'Pitää alavartalotyön hallittavampana ennen huomisen lajia.',
      'program.recommend_reason.sport_context_both':
        'Pitää alavartalotyön hallittavampana, kun lajikuormaa on molemmin puolin.',
      'program.recommend_reason.sport_context_upper':
        'Pitää fokuksen poissa jo valmiiksi kuormittuneista jaloista.',
      'program.global_frequency_hint':
        'Käyttää Treeni-preferenssiäsi: {value}.',
      'program.frequency_notice.kicker': 'Ohjelman sopivuus',
      'program.frequency_notice.title':
        'Valittu viikkotaajuus ei enää sovi tähän ohjelmaan',
      'program.frequency_notice.body':
        '{name} ei tue asetusta {requested}. Ohjelma käyttää nyt arvoa {effective}.',
      'program.frequency_notice.suggestion':
        'Jos haluat treenata {requested}, vaihda ohjelmaan joka tukee sitä suoraan.',
      'program.frequency_notice.toast':
        '{name} käyttää nyt arvoa {effective}. Avaa Ohjelma-välilehti vaihtaaksesi ohjelmaan, joka tukee asetusta {requested}.',
      'program.frequency_filter.showing':
        'Näytetään ohjelmat, jotka sopivat rytmiin {value}. Nykyinen ohjelmasi pidetään näkyvissä, jos se käyttää fallbackia.',
      'program.filter.title': 'Suodata tason mukaan',
      'program.filter.all': 'Kaikki',
      'program.filter.beginner': 'Aloittelija',
      'program.filter.intermediate': 'Keskitaso',
      'program.filter.advanced': 'Edistynyt',
      'program.frequency_card.fit': 'Sopii: {value}',
      'program.frequency_card.fallback': 'Käyttää: {value}',
      'program.difficulty.beginner': 'Aloittelijaystävällinen',
      'program.difficulty.intermediate': 'Keskitaso',
      'program.difficulty.advanced': 'Edistynyt',
      'program.card.switch_to': 'Vaihda ohjelmaan {name}',
      'program.card.active': 'Aktiivinen ohjelma: {name}',
      'program.week_info': '{icon} {name} - {block} - {week}',
      'program.training_max_pct': '{pct}% harjoittelumaksimista',
      'toast.rest_updated': 'Lepoajastin päivitetty',
      'toast.preferences_saved': 'Harjoituspreferenssit tallennettu',
      'toast.schedule_saved': 'Aikataulu tallennettu!',
      'toast.backup_exported': 'Varmuuskopio vietiin!',
      'toast.data_imported': 'Data tuotu! Ladataan uudelleen...',
      'toast.could_not_read_file': 'Tiedostoa ei voitu lukea',
      'toast.all_data_cleared': 'Kaikki data poistettu',
      'toast.synced_other_device':
        'Uusimmat muutokset synkattiin toiselta laitteelta',
      'toast.sync_issue':
        'Pilvisynkka epäonnistui. Muutokset ovat toistaiseksi vain tällä laitteella.',
      'import.invalid_file': 'Virheellinen varmuuskopio',
      'import.invalid_workout_data': 'Varmuuskopion treenidata on virheellinen',
      'import.malformed_entries':
        'Varmuuskopiossa on virheellisiä treenimerkintöjä',
      'import.invalid_profile_data':
        'Varmuuskopion profiilidata on virheellinen',
      'import.file_too_large':
        'Varmuuskopio on liian suuri turvalliseen tuontiin',
      'import.duplicate_workout_ids':
        'Varmuuskopiossa on päällekkäisiä treeni-ID:itä',
      'import.invalid_workout_dates':
        'Varmuuskopiossa on virheellisiä treenipäiviä',
      'import.title': 'Tuo data',
      'confirm.clear_all_title': 'Tyhjennä kaikki data',
      'confirm.clear_all_msg':
        'Poistetaanko KAIKKI treenidata? Toimintoa ei voi perua.',
      'history.tab.log': 'Treeniloki',
      'history.tab.stats': 'Tilastot',
      'history.total_sessions': 'Treenit yhteensä',
      'history.sport_sessions': 'Urheilutreenit',
      'history.sets_this_month': 'Sarjat tässä kuussa',
      'history.avg_rpe': 'Keskim. treeni RPE',
      'history.stats.volume': 'Viikkovolyymi',
      'history.stats.strength': 'Voimakehitys',
      'history.stats.e1rm': 'Arvioitu 1RM',
      'history.stats.tm_history': 'Treenimaksimin trendi',
      'history.stats.milestones': 'Merkkipaalut',
      'history.stats.range.8w': '8 vkoa',
      'history.stats.range.16w': '16 vkoa',
      'history.stats.range.all': 'Kaikki',
      'history.stats.week_prefix': 'Vk',
      'history.stats.lift.squat': 'Kyykky',
      'history.stats.lift.bench': 'Penkki',
      'history.stats.lift.deadlift': 'Maastaveto',
      'history.stats.lift.ohp': 'Pystypunnerrus',
      'history.milestone.bench_bw': 'Kehonpainopenkki',
      'history.milestone.squat_1_5x': '1,5x kehonpaino kyykyssä',
      'history.milestone.deadlift_2x': '2x kehonpaino maastavedossa',
      'history.milestone.date': 'Avattu {date}',
      'day.sun.short': 'Su',
      'day.mon.short': 'Ma',
      'day.tue.short': 'Ti',
      'day.wed.short': 'Ke',
      'day.thu.short': 'To',
      'day.fri.short': 'Pe',
      'day.sat.short': 'La',
      'rpe.set': 'Sarja',
      'rpe.session_title': 'Kuinka raskaalta tämä treeni tuntui?',
      'rpe.session_subtitle': 'Arvioi kokonaisrasitus (6 = helppo, 10 = maksimi)',
      'rpe.session_prompt':
        'Arvioi treenin rasittavuus (6 = kevyt, 10 = maksimi)',
      'rpe.desc.6': 'Jaksaisi jatkaa helposti',
      'rpe.desc.7': 'Mukava ponnistus',
      'rpe.desc.8': 'Haastava mutta hallinnassa',
      'rpe.desc.9': 'Ehkä 1 toisto jäljellä',
      'rpe.desc.10': 'Ei mitään jäljellä',
      'settings.program_setup_suffix': 'Asetukset',
      'workout.log_extra_confirm':
        'Kirjataanko ylimääräinen {sport}-treeni tänne päivälle?',
      'workout.swap_back': 'Vaihda selkaliike',
      'workout.swap_back_title': 'Vaihda selkaliike',
      'workout.swap_aux_category': 'Vaihda {cat} apuliike',
      'workout.swap_exercise': 'Vaihda liike',
      'workout.swapped_to': 'Vaihdettu liikkeeseen {name}',
      'workout.sport_check.title': 'Lajikuorman check-in',
      'workout.sport_check.sub': 'Minkä lajikuorman ympärillä treenaat tänään?',
      'workout.sport_check.none': 'Ei lajikuormaa',
      'workout.sport_check.light': 'Kevyt lajikuorma',
      'workout.sport_check.heavy': 'Raskas lajikuorma',
      'workout.sport_check.today': 'Tänään',
      'workout.sport_check.yesterday': 'Eilen',
      'workout.sport_check.tomorrow': 'Huomenna',
      'workout.sport_check.both': 'Molempina',
      'workout.sport_check.enabled_hint':
        'Lajikuorman check-in on käytössä. Sinulta kysytään jaloille raskaasta lajista ennen treenin aloitusta.',
      'workout.sport_check.inline_title': 'Lajikuorman check-in',
      'workout.sport_check.inline_sub':
        'Kerro päivän lajikuorma, niin treenisuositus osaa huomioida sen.',
      'workout.sport_check.level_title': 'Kuinka paljon lajikuormaa on mukana?',
      'workout.sport_check.timing_title': 'Milloin se on?',
      'workout.sport_check.today_hint':
        'Tänään on merkitty säännölliseksi lajipäiväksi, joten ajoitus esivalittiin.',
      'workout.pref_adjustment.accessories':
        'Apuliikkeitä karsittiin lyhyempää treeniä varten.',
      'workout.pref_adjustment.aux_volume':
        'Apuliikkeiden volyymia vähennettiin aikakattoon sopivaksi.',
      'workout.pref_adjustment.sport_support':
        'Apuliikkeitä poistettiin, jotta treeni pysyy terävämpänä lajin tukemista varten.',
      'workout.pref_adjustment.sport_today':
        'Pitää alavartalotyön hallittavampana tämän päivän lajin ympärillä.',
      'workout.pref_adjustment.sport_tomorrow':
        'Huomenna on jalat kuormittavaa lajia, joten alavartalotyötä kevennettiin hieman.',
      'workout.pref_adjustment.sport_yesterday':
        'Eilen oli jaloille raskasta lajia, joten alavartalotyötä kevennettiin tälle päivälle.',
      'workout.pref_adjustment.sport_both':
        'Jalkoja kuormittavaa lajia on tämän treenin molemmin puolin, joten alavartalotyötä karsittiin.',
      'workout.pref_adjustment.swap_hint':
        'Käytä exercise swapia vapaasti, jos käytössä oleva kalusto ei vastaa suunniteltua liikettä.',
      'plan.adjustment.replaced_equipment':
        'Vaihdettiin {from} liikkeeseen {to}, jotta se sopii kaytettavissa olevaan kalustoon.',
      'plan.adjustment.replaced_limit':
        'Vaihdettiin {from} liikkeeseen {to}, jotta nykyiset rajoitteesi huomioidaan.',
      'plan.adjustment.removed_exercise':
        'Poistettiin {exercise}, koska se ei sovi nykyisiin rajoitteisiisi.',
      'plan.insight.forge_progress':
        '{count} pääliikkeen TM on noussut viime blokissa, parhaimmillaan +{delta}kg.',
      'plan.insight.forge_stable':
        'Forgen treenimaksimit ovat nyt vakaat - pidä suoritus terävänä.',
      'plan.insight.w531_stalled':
        'Sykli {cycle}, viikko {week}. {count} nosto tarvitsee kevyemman runwayn.',
      'plan.insight.w531_cycle':
        'Sykli {cycle}, viikko {week} etenee ilman stall-lippuja.',
      'plan.insight.hs_primary':
        'Viimeaikainen hypertrofiatyö on ankkuroitunut liikkeeseen {exercise}.',
      'plan.insight.stalls':
        'Progressiossa on nyt ainakin yksi stall-signaali.',
      'plan.insight.stable':
        'Progressio näyttää vakaalta - jatka nykyistä polkua.',
      'plan.insight.skipped_accessories':
        'Useimmin kesken jäävät apuliikkeet: {names}.',
      'plan.insight.swap_preferences':
        'Näihin vaihtoliikkeisiin palaat usein: {names}.',
      'plan.insight.sport_collision':
        'Alavartalotyö törmää toistuvasti lajikuormaan viime treeneissäsi.',
      'plan.insight.adherence_30':
        '30 päivän toteuma: {done}/{expected} suunniteltua treeniä ({rate}%).',
      'plan.insight.best_days': 'Treenaat useimmiten {days}.',
      'plan.recommend.continue': 'Jatka samalla linjalla',
      'plan.recommend.continue_body':
        'Nykyinen setup näyttää kestävältä - jatka tasaisia onnistuneita treenejä.',
      'plan.recommend.shorten': 'Lyhennä tätä viikkoa',
      'plan.recommend.shorten_body':
        'Aikakitkaa näkyy nyt, joten suosi tällä viikolla lyhyempiä mutta valmiita treenejä.',
      'plan.recommend.lighten': 'Aja kevyempi viikko',
      'plan.recommend.lighten_body':
        'Palautumissignaalit nousevat, joten pidä rakenne mutta laske fysiologista kustannusta.',
      'plan.recommend.deload': 'Ota kevennys',
      'plan.recommend.deload_body':
        'Väsymys- ja stall-signaalit puoltavat kevyempää runwayta ennen uutta puskua.',
      'plan.recommend.switch': 'Vaihda paremmin sopivaan blokkiin',
      'plan.recommend.switch_body':
        'Nykyinen setup taistelee aikatauluasi tai palautumistasi vastaan. Yksinkertaisempi blokki sopisi todennäköisesti paremmin.',
      'dashboard.good_deload_timing': 'Hyvä hetki keventää.',
      'dashboard.consider_rest': 'Harkitse lepopäivää.',
      'dashboard.preferences_context':
        'Tavoite: {goal} · {days} · {minutes} · {equipment}',
      'dashboard.pref.goal.strength':
        'Tänään painota teräviä pääsarjoja ja hyvää tangon nopeutta.',
      'dashboard.pref.goal.hypertrophy':
        'Tänään painota laadukasta volyymia ja hallittuja toistoja.',
      'dashboard.pref.goal.general_fitness':
        'Pidä treeni tänään kestävänä ja jätä hieman varaa tankkiin.',
      'dashboard.pref.goal.sport_support':
        'Pidä työ tänään urheilullisena ja vältä grindattuja toistoja.',
      'dashboard.pref.focus_label': 'Tämän päivän painotus',
      'dashboard.pref.time.short':
        'Aikakatto on tiukka, joten tee päätyö ensin ja pidä apuliikkeet tarvittaessa valinnaisina.',
      'dashboard.pref.time.long':
        'Tänään on aikaa täydemmälle treenille, joten tee apuliikkeetkin jos palautuminen pysyy hyvänä.',
      'dashboard.pref.equipment.basic_gym':
        'Jos jokin suunniteltu liike ei ole saatavilla, käytä exercise swapia ja pysy lähellä samaa liikemallia.',
      'dashboard.pref.equipment.home_gym':
        'Kotisali voi vaatia vaihtoja tänään, joten suosi käytännöllisiä variaatioita joita pystyt kuormaamaan hyvin.',
      'dashboard.pref.equipment.minimal':
        'Välineitä on vähän, joten pidä treeni minimitehokkaana annoksena ja vaihda liikkeitä vapaasti tarvittaessa.',
      'workout.today.coach_note': 'Valmentajan huomio',
      'workout.today.block_stats': 'Treenirytmi',
      'workout.today.last_30_days': 'Miltä viimeiset 30 päivää näyttävät',
      'workout.today.recovery_status': 'Palautumistilanne',
      'workout.today.stats.progress': 'PR-kasvu',
      'dashboard.trends.primary.label': 'Suunnitelmassa pysyminen',
      'dashboard.trends.primary.sublabel_fallback':
        'Kun saat alle vielä pari tasaista viikkoa, suunta alkaa näkyä kunnolla.',
      'dashboard.trends.progress_up': 'Voima menossa eteenpäin',
      'dashboard.trends.progress_down': 'Voima sakkasi vähän',
      'dashboard.trends.progress_flat': 'Voima pysynyt tasaisena',
      'dashboard.trends.sessions': 'Treenejä viime aikoina',
      'dashboard.trends.best_days': 'Luontevimmat treenipäivät',
      'dashboard.trends.friction': 'Kitkakohtia',
      'dashboard.trends.summary.building.title': 'Rutiini on vielä rakenteilla',
      'dashboard.trends.summary.building.body':
        'Data alkaa jo kertoa jotain, mutta muutama tasaisempi viikko tekee rytmistä paljon selkeämmän.',
      'dashboard.trends.summary.stable.title': 'Treenirytmi näyttää toimivan',
      'dashboard.trends.summary.stable.body':
        'Saat treenejä kasaan tarpeeksi usein, ja viime aikojen merkit tukevat hyvää suuntaa.',
      'dashboard.trends.summary.fragile.title':
        'Hyvää tekemistä näkyy, mutta rytmi horjuu vielä',
      'dashboard.trends.summary.fragile.body':
        'Pohja on olemassa, mutta viime viikkojen kuvio on vielä sen verran epätasainen, että tasaisuus ratkaisee enemmän kuin lisäpaino.',
      'dashboard.muscle_load.recent': 'Viimeaikainen lihaskuorma',
      'dashboard.muscle_load.light': 'Kevyt',
      'dashboard.muscle_load.moderate': 'Kohtalainen',
      'dashboard.muscle_load.high': 'Korkea',
      'dashboard.muscle_group.chest': 'Rinta',
      'dashboard.muscle_group.back': 'Selkä',
      'dashboard.muscle_group.shoulders': 'Olkapäät',
      'dashboard.muscle_group.biceps': 'Hauikset',
      'dashboard.muscle_group.triceps': 'Ojentajat',
      'dashboard.muscle_group.forearms': 'Kyynärvarret',
      'dashboard.muscle_group.quads': 'Etureidet',
      'dashboard.muscle_group.hamstrings': 'Takareidet',
      'dashboard.muscle_group.glutes': 'Pakarat',
      'dashboard.muscle_group.calves': 'Pohkeet',
      'dashboard.muscle_group.core': 'Keskivartalo',
      'dashboard.session_left': 'treeni jäljellä',
      'dashboard.sessions_left': 'treeniä jäljellä',
      'history.other_sessions': 'Muut treenit',
      'program.season.off': 'Off-Season',
      'program.season.in': 'In-Season',
      'program.w531.wave5': '5s aalto',
      'program.w531.wave3': '3s aalto',
      'program.w531.week531': '5/3/1 viikko',
      'program.w531.tm_test': 'TM testi',
      'program.w531.deload': 'Kevyt viikko',
      'program.w531.tm_test_week': 'TM testiviikko',
      'program.w531.off_short': "5's PRO + BBB",
      'program.w531.in_short': 'Minimitoistot + Triumvirate',
      'program.w531.next_cycle': 'Sykli {cycle} alkaa - TM päivittyy!',
      'program.w531.next_week': 'Viikko {week} ({label}) seuraavaksi.',
      'program.w531.week_done': 'Viikko {week} valmis! {next}',
      'program.w531.banner_leg_heavy':
        'suositeltu treeni kuormittaa jalkoja paljon.',
      'program.w531.banner_consider_upper':
        'Harkitse vaihtoehtoa <strong>{label}</strong>.',
      'program.w531.banner_only_legs':
        'Jalkapäivät jäljellä - kevennä tai lepää tänään.',
      'program.w531.save_setup': 'Tallenna ohjelman asetukset',
      'program.w531.tm_test_enabled':
        'TM testiviikko käytössä - korvaa seuraavan kevennysviikon',
      'program.w531.tm_test_enable':
        'Ota TM testiviikko käyttöön kevennysviikon sijaan',
      'program.w531.name': '5/3/1 (Wendler)',
      'program.w531.description':
        '4 viikon voimasykli automaattisella painon nousulla.',
      'program.sl.name': 'StrongLifts 5x5',
      'program.sl.description':
        'Aloittelijan voimaharjoitus, jossa kuorma nousee tasaisesti.',
      'program.sl.workout': 'Treeni',
      'program.sl.linear_progression': 'Lineaarinen progressio',
      'program.sl.is_next': 'on seuraava',
      'program.sl.squat': 'Kyykky',
      'program.sl.banner_sport_warning':
        'Molemmat treenit sisältävät kyykyn. Kevennä tai pidä lepopäivä tarvittaessa.',
      'program.sl.failed_sessions': 'epäonnistuneet treenit',
      'program.sl.split_overview':
        'A: Kyykky+Penkki+Soutu - B: Kyykky+Pystypunnerrus+Maastaveto - vuorotellen 3 treeniä/viikko',
      'program.sl.session_completed_next':
        'Treeni {count} valmis - Seuraava: Treeni {workout}',
      'program.sl.weight_rounding': 'Painon pyöristys (kg)',
      'program.sl.working_weights': 'Työpainot (kg)',
      'program.sl.progression_help':
        'Lisää +2.5kg (+5kg maastavedossa) onnistuneen treenin jälkeen. 3 epäonnistunutta treeniä käynnistää 10% kevennyksen.',
      'program.sl.next_workout': 'Seuraava treeni',
      'program.sl.workout_a': 'Treeni A',
      'program.sl.workout_b': 'Treeni B',
      'program.sl.save_setup': 'Tallenna ohjelman asetukset',
      'program.sl.accessories_short': 'Apuliikkeet',
      'program.sl.accessories_title': 'Valinnaiset apuliikkeet',
      'program.sl.acc_toggle': 'Lisää apuliikkeet pääliikkeiden jälkeen',
      'program.sl.acc_rationale':
        'Lisää pystyveto, keskivartalo ja sivuolkapäät tasapainottamaan pääliikkeitä.',
      'program.sl.acc_help':
        'Apuliikkeet poistetaan automaattisesti lyhyissä treeneissä tai urheilutukitavoitteella.',
      'program.sl.acc_swap_hint':
        'Käytä Vaihda-painiketta treenin aikana vaihtaaksesi apuliikkeitä.',
      'program.sl.acc_pull_note': 'Pystyveto · 3×8',
      'program.sl.acc_core_note': 'Keskivartalo · 3×10',
      'program.sl.acc_iso_note': 'Sivuolkapäät · 3×12',
      'program.sl.simple.overview_title': 'Harjoitusrytmi',
      'program.sl.simple.overview':
        'Säädä pääliikkeiden työpainot, painojen pyöristys ja tulevatko valinnaiset apuliikkeet mukaan pääsarjojen jälkeen.',
      'program.sl.simple.save': 'Tallenna StrongLiftsin perusasetukset',
      'program.sl.simple.summary':
        'Treeni {next} seuraavaksi · apuliikkeet: {acc}',
      'program.cfb.name': 'Salin perusteet',
      'program.cfb.description':
        'Helppo saliohjelma pyörivillä kokovartalotreeneillä. Ei maksimeja tai suunnittelua.',
      'program.cfb.session_stats': 'Treenitilastot',
      'program.cfb.week_streak_short': '{count} vk putki',
      'program.cfb.week_streak_long': '{count} viikon putki',
      'program.cfb.week_streak_exclaim': '{count} viikon putki!',
      'program.cfb.week_count_one': '{count} viikko',
      'program.cfb.week_count_many': '{count} viikkoa',
      'program.cfb.session_label': 'Salin perusteet · Treeni {count}',
      'program.cfb.block_name': 'Salin perusteet',
      'program.cfb.block_label': 'Treeni {count}',
      'program.cfb.note_main': '3 sarjaa x 8-12 toistoa',
      'program.cfb.note_accessory': 'Apuliike - 3 sarjaa x 8-12 toistoa',
      'program.cfb.stats.sessions': 'Treenit',
      'program.cfb.stats.week_streak': 'Viikkoputki',
      'program.cfb.none': '-',
      'program.cfb.banner_sport_warning':
        'Treenissä on kyykkyjä ja lantionojennuksia. Kevennä tai lepää tarvittaessa.',
      'program.cfb.last_session': 'Edellinen treeni',
      'program.cfb.more': 'lisää',
      'program.cfb.next_rotates': 'seuraava treeni vaihtaa liikkeitä',
      'program.cfb.freq_per_week': '{count}x viikossa',
      'program.cfb.no_sessions_yet': 'Ei kirjattuja treenejä vielä',
      'program.cfb.setup_summary':
        'Matalan kynnyksen kokovartalotreeni - 3 sarjaa x 8-12 toistoa - liikkeet vaihtuvat automaattisesti',
      'program.cfb.target_frequency': 'Tavoitetaajuus',
      'program.cfb.freq_reference':
        'Vain viitteellinen. Tämä ohjelma ei aikatauluta treenejä automaattisesti.',
      'program.cfb.movement_pools': 'Liikemallien vaihtoehdot',
      'program.cfb.pool_help':
        'Jokainen treeni valitsee yhden liikkeen per paikka ja välttää edellisen treenin valintoja.',
      'program.cfb.slot5_accessories':
        'Paikka 5 - Apuliikkeet (2 valitaan per treeni)',
      'program.cfb.no_tm_needed':
        'Training Max -asetusta ei tarvita. Lisää painoa kun 12 toistoa tuntuu helpolta.',
      'program.cfb.save_setup': 'Tallenna ohjelman asetukset',
      'program.cfb.simple.overview_title': 'Viikkorytmi',
      'program.cfb.simple.overview':
        'Salin perusteet on helppo oletusohjelma: tule salille, tee tasapainoinen kokovartalotreeni ja anna liikevaihtelun hoitaa suunnittelu. Viikkotaajuus tulee nyt Treeni-preferensseistä.',
      'program.cfb.simple.stats_help':
        'Liikevalinnat vaihtuvat automaattisesti, joten tärkein päätös asetuksissa on vain se, kuinka usein haluat treenata.',
      'program.cfb.simple.save': 'Tallenna Salin perusteet',
      'program.cfb.simple.summary':
        '{count} treeniä/viikko · tasapainoinen kokovartalotreeni',
      'program.forge.name': 'Forge Protocol',
      'program.forge.description':
        '21 viikon voimasykli: hypertrofia, voima ja huipennus.',
      'program.forge.day_label': 'Päivä {day}: {label}',
      'program.forge.week_label': 'Viikko {week}',
      'program.forge.session_label': 'V{week} P{day} - {block} [{mode}]',
      'program.forge.banner_all_done':
        'Kaikki {count} treeniä tehty tällä viikolla! Palaudu rauhassa.',
      'program.forge.banner_upper_recommended':
        'suositus <strong>Päivä {day}</strong> (ylävartalopainotteinen). Säästä jalkoja.',
      'program.forge.banner_legs_only_left':
        '{sport}-jalat kuormittuneet ja jalkapäiviä jäljellä. Kevennä tai lepää tänään.',
      'program.forge.banner_low_recovery':
        'Palautuminen {recovery}% - harkitse lepoa. Jos treenaat, <strong>Päivä {day}</strong> on seuraava.',
      'program.forge.banner_recommended':
        'Suositus: <strong>Päivä {day}</strong> - {left} treeniä jäljellä tällä viikolla - Palautuminen {recovery}%',
      'program.forge.plan.sport_trim':
        'Forge karsi ensin alavartalon apuliikkeitä, koska lajikuorma on lähellä.',
      'program.forge.plan.equipment_hint':
        'Forge suosii nykyisellä setupillasi ensin saman liikemallin vaihtoja.',
      'program.forge.save_setup': 'Tallenna ohjelman asetukset',
      'settings.language.title': 'Kieli',
      'settings.language.label': 'Sovelluksen kieli',
      'settings.language.help':
        'Käyttöliittymä ja liikeohjeet käyttävät tätä kieltä, kun se on saatavilla.',
      'settings.language.option.en': 'Englanti',
      'settings.language.option.fi': 'Suomi',
      'settings.language.saved': 'Kieli päivitetty',
      'guidance.title': 'Liikeohje',
      'guidance.none': 'Tälle liikkeelle ei ole vielä ohjetta.',
      'guidance.setup': 'Alkuasento',
      'guidance.execution': 'Suoritus',
      'guidance.cues': 'Tärkeät vihjeet',
      'guidance.safety': 'Turvallisuus',
      'guidance.media.video': 'Avaa video',
      'guidance.media.image': 'Avaa kuva',
      'session.description': 'Harjoituksen tavoite',
      'program.forge.block.hypertrophy': 'Hypertrofia',
      'program.forge.block.strength': 'Voima',
      'program.forge.block.peaking': 'Huipennus',
      'program.forge.block.deload': 'Kevyt viikko',
      'program.forge.mode.sets.name': 'Sarjat tehty',
      'program.forge.mode.sets.desc':
        'Tee sarjoja RIR-rajaan asti. TM säätyy tehtyjen sarjojen mukaan.',
      'program.forge.mode.sets.short': 'Sarjat',
      'program.forge.mode.rtf.name': 'Toistot loppuun',
      'program.forge.mode.rtf.desc':
        'Normaalit sarjat + AMRAP viimeinen sarja. TM säätyy toistojen mukaan.',
      'program.forge.mode.rtf.short': 'RTF',
      'program.forge.mode.rir.name': 'Viimeinen sarja RIR',
      'program.forge.mode.rir.desc':
        'Kiinteä sarjamäärä, kirjaa RIR viimeisestä sarjasta. Paras urheilijoille.',
      'program.forge.mode.rir.short': 'RIR',
      'program.forge.note.deload': '{reps}×{weight}kg — kevyt, 5 sarjaa',
      'program.forge.note.rtf':
        '{weight}kg × {reps} toistoa {normalSets} sarjaa, sitten maksimiyritykseen sarjassa {amrapSet} (tavoite {repOutTarget}+ toistoa)',
      'program.forge.note.rir':
        '{weight}kg × {reps} {fixedSets} sarjassa — viimeisessä sarjassa kirjaa kuinka monta toistoa jäit (tavoite RIR ≤{rir})',
      'program.forge.note.sets':
        '{weight}kg × {reps} toistoa — lopeta kun RIR ≤{rir} (tavoite {setLow}-{setHigh} sarjaa)',
      'program.forge.blockinfo.deload':
        'Kevyt viikko — 60% TM, 5 helppoa sarjaa.',
      'program.forge.blockinfo.sets':
        'Tee {reps} toiston sarjoja kunnes RIR ≤{rir}. Tavoite 4-6 sarjaa.',
      'program.forge.blockinfo.rtf':
        '{reps} toistoa × 4 sarjaa, sitten AMRAP viimeinen sarja (tavoite {target}+).',
      'program.forge.blockinfo.rir':
        '5 sarjaa × {reps} toistoa. Kirjaa jäljellä olevat toistot viimeisestä sarjasta.',
      'program.forge.blockinfo.skip_peak':
        ' Huipennusblokki ohitettu — ohjelma alkaa alusta hypertrofiasta tämän kevennysviikon jälkeen.',
      'program.forge.back.note_weight':
        '{weight}kg × 3 sarjaa × 8-10 toistoa — tee 3×10, sitten kasvata painoa',
      'program.forge.back.note_empty':
        'Aseta työpaino asetuksissa automaattitäytöksi',
      'program.forge.settings.overview':
        '21 viikon voimasykli: Hypertrofia → Voima → Huipennus.',
      'program.forge.settings.mode': 'Ohjelmamodi',
      'program.forge.settings.week': 'Nykyinen viikko (1-21)',
      'program.forge.settings.peak_title': 'Huipennusblokki (viikot 15–20)',
      'program.forge.settings.peak_optional': 'valinnainen',
      'program.forge.settings.peak_help':
        'Korkein intensiteettivaihe. Ohita se palataksesi hypertrofiaan voiman kevennysviikon jälkeen — toimii 14 viikon jatkuvana syklina.',
      'program.forge.settings.skip_peak_on':
        '🏃 Huipennusblokki ohitettu — ohjelma palaa hypertrofiaan voiman jälkeen',
      'program.forge.settings.skip_peak_off':
        '🏔️ Ohita huipennusblokki — palaa takaisin voiman jälkeen peaking-vaiheen sijaan',
      'program.forge.settings.terms':
        '<strong>Termit:</strong> TM = treeninmaksimi. RIR = toistot jäljellä ennen uupumusta. AMRAP = niin monta toistoa kuin mahdollista.',
      'program.forge.settings.main_lifts': 'Pääliikkeet (treeninmaksimi kg)',
      'program.forge.settings.aux_lifts': 'Apuliikkeet (treeninmaksimi kg)',
      'program.forge.settings.aux_help':
        'Valitse tukevat variaatiot, joita Forge kierrättää viikon aikana.',
      'program.forge.settings.back_exercise': 'Selkäharjoitus (joka treenissä)',
      'program.forge.settings.working_weight': 'Työpaino (kg)',
      'program.forge.settings.back_prog': '3×8 → 3×10, sitten kasvata',
      'program.forge.settings.rounding': 'Painon pyoristys (kg)',
      'program.forge.settings.sessions_pw': 'Treenejä viikossa',
      'program.forge.settings.split_legend':
        '<strong>Lihavoitu</strong> = pääliike · <span style="color:var(--purple)">Violetti</span> = apuliike',
      'program.forge.settings.day_num': 'Päivä {day}:',
      'program.forge.settings.control_title': 'Syklin hallinta',
      'program.forge.settings.preview_title': 'Viikkorytmin esikatselu',
      'program.forge.settings.library_hint':
        'Valinta tulee liikekirjastosta ja suosii ensin samaa liikemallia.',
      'program.forge.settings.aux_picker_hint':
        'Aukeaa vanhasta Forge-listasta, mutta voit selata koko liikekirjastoa.',
      'program.forge.settings.back_picker_hint':
        'Soutuja ja vetovariaatioita suositellaan ensin.',
      'program.forge.simple.overview':
        'Aseta pääliikkeet täällä. Viikkotaajuus tulee nyt Treeni-preferensseistä, ja päivittäiset sovitukset seuraavat muita treeniasetuksiasi.',
      'program.forge.simple.schedule': 'Viikkorytmi',
      'program.forge.simple.days_help':
        'Valitse kuinka usein haluat tehdä Forgea tavallisella viikolla.',
      'program.forge.simple.days_value': '{count} treeniä / viikko',
      'program.forge.simple.summary':
        '{count} treeniä / viikko · {back} joka treenissä',
      'program.forge.simple.main_lifts': 'Pääliikkeet',
      'program.forge.simple.main_help':
        'Valitse neljä pääliikettä ja aseta niille treeninmaksimit.',
      'program.forge.simple.back_work': 'Selkätyö',
      'program.forge.simple.back_help':
        'Tämä liike tulee jokaisen treenin lopussa toistuvana selkäliikkeenä.',
      'program.forge.simple.save': 'Tallenna Forge-perusasetukset',
      'program.forge.lift.sq': 'Kyykky (SQ)',
      'program.forge.lift.bp': 'Penkki (BP)',
      'program.forge.lift.dl': 'Maastaveto (DL)',
      'program.forge.lift.ohp': 'Pystypunnerrus (OHP)',
      'program.forge.lift.sq1': 'Kyykkyvariantti 1 (SQ-1)',
      'program.forge.lift.sq2': 'Kyykkyvariantti 2 (SQ-2)',
      'program.forge.lift.bp1': 'Penkkivariantti 1 (BP-1)',
      'program.forge.lift.bp2': 'Penkkivariantti 2 (BP-2)',
      'program.forge.lift.dlv': 'Maastavetovariantti (DL)',
      'program.forge.lift.ohpv': 'Pystypunnerrusvariantti (OHP)',
      'program.w531.scheme.5s': '5 toiston viikko',
      'program.w531.scheme.3s': '3 toiston viikko',
      'program.w531.scheme.531': '1+ viikko',
      'program.w531.scheme.deload': 'Kevyt viikko',
      'program.w531.note.test':
        '🔬 TM TESTI · {tm}kg × AMRAP — 3-5 toistoa → normaali sykli; 1-2 toistoa → TM lasketaan uudelleen 90% arvioidusta 1RM:sta',
      'program.w531.note.deload':
        '🌊 Kevyt viikko · {tm}kg TM · {pcts} · helpot 5t — palautumisviikko',
      'program.w531.note.off':
        "{tm}kg TM · {pcts} · {reps} (5's PRO — tiukat 5 toistoa kaikki sarjat, ei AMRAP)",
      'program.w531.note.in':
        '{tm}kg TM · {pcts} · {reps} (vaaditut minimisuoritukset — säästä energiaa)',
      'program.w531.note.recovery': 'Kevyt palautumisharjoitus · {sets}×{reps}',
      'program.w531.note.bbb':
        'Boring But Big · 5×10 @ {weight}kg (50% {name} TM:sta: {tm}kg)',
      'program.w531.note.triumvirate': 'Triumvirate · 3 sarjaa × 10-15 toistoa',
      'program.w531.settings.overview':
        '4 viikon syklit · +5kg alavartaloon / +2.5kg ylävartaloon per sykli · pysähtymisseuranta',
      'program.w531.settings.terms':
        '<strong>Termit:</strong> TM = treeninmaksimi. 1RM = yhden toiston maksimi. AMRAP = niin monta toistoa kuin mahdollista.',
      'program.w531.settings.cycle_week': 'Sykli {cycle} · Viikko {week}/4',
      'program.w531.settings.stalled':
        '⚠️ {name} pysähtyi — treeninmaksimi laskee 10% syklin lopussa',
      'program.w531.settings.plateau_badge': '⚠️ pysähtynyt',
      'program.w531.settings.freq.2':
        '2×/viikko — Yhdistetty (Kyykky+Penkki / Maastaveto+Pystypunnerrus)',
      'program.w531.settings.freq.3':
        '3×/viikko — Kiertävä (4 nostoa 3 päivän syklissä)',
      'program.w531.settings.freq.4':
        '4×/viikko — Standardi (yksi nosto per päivä)',
      'program.w531.settings.season': 'Kausiasetus',
      'program.w531.settings.off_label': '🏗️ Off-Season',
      'program.w531.settings.off_desc': "5's PRO + BBB (5x10 apuliikkeet)",
      'program.w531.settings.in_label': '🏒 In-Season',
      'program.w531.settings.in_desc': 'Minimisuoritukset + 2 apuliiketta',
      'program.w531.settings.sessions_pw': 'Treenejä viikossa',
      'program.w531.settings.rounding': 'Painon pyoristys (kg)',
      'program.w531.settings.week_current': 'Nykyinen viikko syklissä (1–4)',
      'program.w531.settings.tm_test_title': 'TM testiviikko',
      'program.w531.settings.tm_test_help':
        'Korvaa seuraavan kevennysviikon 100% TM AMRAP-testilla. 1–2 toistoa: laske TM uudelleen. 3+ toistoa: jatka normaalia progressiota.',
      'program.w531.settings.training_max': 'Treeninmaksimi (kg)',
      'program.w531.settings.tm_hint':
        'Aseta noin 90% 1RM:stasi. Automaattiset nousut ja nollaukset tapahtuvat joka syklissä.',
      'program.w531.settings.pick_exercise': 'Valitse liike',
      'program.w531.settings.in_season_accessories': 'Sisäkauden apuliikkeet',
      'program.w531.settings.in_season_help':
        'Valitse 2 apuliiketta per treeni (3 sarjaa × 10–15 toistoa kutakin).',
      'program.w531.simple.overview_title': 'Syklirytmi',
      'program.w531.simple.overview':
        'Aseta kausimoodi ja nykyinen sykliviikko täällä. Viikkotaajuus tulee nyt Treeni-preferensseistä, ja apuliikkeiden valinta pysyy lisäasetuksissa.',
      'program.w531.simple.tm_help':
        'Päivitä neljän pääliikkeen tämänhetkiset treeninmaksimit. Apuliiketyö pysyy lisäasetuksissa.',
      'program.w531.simple.save': 'Tallenna Wendlerin perusasetukset',
      'program.w531.simple.summary':
        '{season} · {freq} treeniä/viikko · Viikko {week}',
      'program.w531.lift.sq': 'Kyykky (SQ)',
      'program.w531.lift.bp': 'Penkki (BP)',
      'program.w531.lift.dl': 'Maastaveto (DL)',
      'program.w531.lift.ohp': 'Pystypunnerrus (OHP)',
      'program.w531.day.sq': 'Kyykkypäivä',
      'program.w531.day.bp': 'Penkkipäivä',
      'program.w531.day.dl': 'Maastavetopäivä',
      'program.w531.day.ohp': 'Pystypunnerruspäivä',
      'program.w531.banner.readiness': 'Treenivalmius:',
      'program.w531.readiness.default': '💪 Täysi treeni',
      'program.w531.readiness.light': '🌿 Kevyt palautuminen',
      'program.w531.readiness.none': '😴 Vain nostot',
      'program.w531.banner.stalled': ' · ⚠️ {count} nosto pysähtynyt',
      'program.w531.banner.stalled_pl': ' · ⚠️ {count} nostoa pysähtynyt',
      'program.w531.banner.next': ' · Seuraava: <strong>{label}</strong>',
      'program.w531.banner.session_left': ' · {left} treeni jäljellä',
      'program.w531.banner.sessions_left': ' · {left} treeniä jäljellä',
      'program.w531.banner.cycleweek': 'S{cycle} V{week}',
      'program.w531.plan.sport_trim':
        'Wendler karsi ensin alavartalon avustavaa työtä, koska lajikuorma on korkea.',
      'program.w531.plan.shoulder_trim':
        'Olkapäälle herkkä pystysuuntainen avustava työ priorisoitiin pois tästä treenistä.',
      'program.w531.plan.equipment_hint':
        'Wendler suosii ensin saman liikemallin korvaajia ennen työn pudottamista.',
      'program.w531.block.week_label':
        'Sykli {cycle} · Viikko {week} · {season}',

      /* ── Hypertrophy Split ─────────────────────────────────────── */
      'program.hs.name': 'Hypertrofiasplitti',
      'program.hs.description':
        'Mukautuva hypertrofiaohjelma, joka skaalautuu 2–6 treenipäivään viikossa.',
      'program.hs.session.push': 'Työntö',
      'program.hs.session.pull': 'Veto',
      'program.hs.session.legs': 'Jalat',
      'program.hs.session.upper': 'Yläkroppa',
      'program.hs.session.lower': 'Alakroppa',
      'program.hs.session.upper_b': 'Yläkroppa B',
      'program.hs.session.lower_b': 'Alakroppa B',
      'program.hs.split.2': 'Yläkroppa / Alakroppa',
      'program.hs.split.3': 'Työntö / Veto / Jalat',
      'program.hs.split.4': 'Yläkroppa / Alakroppa × 2',
      'program.hs.split.5': 'TVJ + Yläkroppa + Alakroppa',
      'program.hs.split.6': 'Työntö / Veto / Jalat × 2',
      'program.hs.week_label': 'V{week}',
      'program.hs.cycle_short': 'S{cycle}',
      'program.hs.deload_easy': 'kevyt',
      'program.hs.block.ramp_up': 'Nosto',
      'program.hs.block.build': 'Rakennus',
      'program.hs.block.push': 'Panostus',
      'program.hs.block.deload': 'Kevennys',
      'program.hs.blockinfo.deload':
        'Kevyt viikko — alennettu volyymi ja intensiteetti palautumiseksi.',
      'program.hs.blockinfo.normal':
        'T1: {sets}×{reps} @{pct}% TM · T2 kevyempi · Apuliikkeet {accSets}×12-15',
      'program.hs.banner_all_done':
        '✅ Kaikki treenit tehty tällä viikolla! Lepää.',
      'program.hs.banner_upper_rec':
        'suositellaan <strong>{session}</strong> (yläkroppapainotteinen).',
      'program.hs.banner_legs_only':
        '{sport} — vain jalkatreenejä jäljellä. Kevyemmin tai lepää.',
      'program.hs.banner_low_recovery':
        '⚠️ Palautuminen {recovery}% — harkitse lepoa.',
      'program.hs.banner_default':
        '<strong>{session}</strong> seuraavaksi · {block} V{week} · {left} jäljellä · Palautuminen {recovery}%',
      'program.hs.settings.cycle_title': 'Syklin hallinta',
      'program.hs.settings.overview':
        '8 viikon mesosykli: Nosto → Rakennus → Panostus → Kevennys. TM mukautuu automaattisesti panostusviikkoina.',
      'program.hs.settings.cycle_week': 'Sykli ja viikko',
      'program.hs.settings.cycle_value':
        'Sykli {cycle} · Viikko {week}/{total}',
      'program.hs.settings.week_override': 'Vaihda viikko (1-8)',
      'program.hs.settings.rounding': 'Painon pyöristys (kg)',
      'program.hs.settings.sessions_pw': 'Treenit viikossa',
      'program.hs.settings.tms': 'Treenimaksimit (kg)',
      'program.hs.settings.tm_help':
        'Painot lasketaan automaattisesti prosenttiosuuksina näistä arvoista joka viikko.',
      'program.hs.settings.legend':
        '<strong>Lihavoitu</strong> = T1 · <span style="color:var(--purple)">Violetti</span> = T2 · <span style="color:var(--muted)">Harmaa</span> = apuliike',
      'program.hs.simple.schedule': 'Viikkorytmi',
      'program.hs.simple.overview':
        'Viikkotaajuus tulee nyt Treeni-preferensseistä. Jako mukautuu automaattisesti, ja täällä säädät vain tämänhetkiset treenimaksimit.',
      'program.hs.save_setup': 'Tallenna ohjelman asetukset',
      'program.hs.simple.save': 'Tallenna perusasetukset',
      'program.hs.simple.summary': '{count} treeniä/viikko · {split}',
      'common.sets': 'sarjaa',
      'program.future': 'Tuleva',

      /* ── Body settings tab ───────────────────────────────────────── */
      'settings.tabs.body': 'Keho',
      'settings.body.metrics_title': 'Kehon mittasuhteet',
      'settings.body.metrics_help':
        'AI-ravintocoach k\u00e4ytt\u00e4\u00e4 n\u00e4it\u00e4 tietoja neuvojen r\u00e4\u00e4t\u00e4l\u00f6imiseen. Kaikki painot kilogrammoina.',
      'settings.body.weight': 'Nykyinen paino (kg)',
      'settings.body.height': 'Pituus (cm)',
      'settings.body.age': 'Ik\u00e4',
      'settings.body.target_weight': 'Tavoitepaino (kg)',
      'settings.body.goal_title': 'Kehonkoostumustavoite',
      'settings.body.goal_label': 'Mihin t\u00e4ht\u00e4\u00e4t?',
      'settings.body.goal_none': '\u2014 valitse \u2014',
      'settings.body.goal.lose_fat': 'Rasvanpoltto',
      'settings.body.goal.gain_muscle': 'Lihasmassan kasvatus',
      'settings.body.goal.recomp':
        'Kehon rekomp (rasvaa pois + lihasta lis\u00e4\u00e4)',
      'settings.body.goal.maintain': 'Yllapito',
      'settings.body.sex': 'Sukupuoli',
      'settings.body.sex_none': '\u2014 valitse \u2014',
      'settings.body.sex_male': 'Mies',
      'settings.body.sex_female': 'Nainen',
      'settings.body.activity': 'Aktiivisuustaso',
      'settings.body.activity_none': '\u2014 valitse \u2014',
      'settings.body.activity_sedentary': 'Istuva',
      'settings.body.activity_light': 'Kevyesti aktiivinen',
      'settings.body.activity_moderate': 'Aktiivinen',
      'settings.body.activity_very': 'Eritt\u00e4in aktiivinen',
      'settings.body.save': 'Tallenna',
      'settings.body.saved': 'Kehon tiedot tallennettu',

      /* ── Nutrition Coach ──────────────────────────────────────────── */
      'nav.nutrition': 'Ravinto',
      'nutrition.page.title': 'Ravintocoach',
      'nutrition.clear.btn': 'Tyhjenn\u00e4 t\u00e4m\u00e4 p\u00e4iv\u00e4',
      'nutrition.clear.title':
        'Tyhjenn\u00e4 t\u00e4m\u00e4n p\u00e4iv\u00e4n sessio',
      'nutrition.clear.body':
        'T\u00e4m\u00e4 poistaa t\u00e4m\u00e4n p\u00e4iv\u00e4n ravintosession ja ateriacoachauksen.',
      'nutrition.empty.kicker': 'AI-RAVINTOCOACH',
      'nutrition.empty.title': 'P\u00e4ivitt\u00e4inen ravintocoachisi',
      'nutrition.empty.body':
        'Valitse toiminto alta ja saat räätälöityjä ravintoneuvoja tälle päivälle.',
      'nutrition.empty.reset': 'Nollautuu automaattisesti joka päivä.',
      'nutrition.default_prompt':
        'Mit\u00e4 voit kertoa t\u00e4st\u00e4 ruoasta?',
      'nutrition.action.plan_today': 'Tee ruokasuunnitelma tälle päivälle',
      'nutrition.action.next_meal': 'Mitä syön seuraavaksi?',
      'nutrition.action.review_today': 'Arvioi tämän päivän syömiseni',
      'nutrition.action.analyze_photo': 'Analysoi tämä ruokakuva',
      'nutrition.composer.kicker': 'Päivän ohjaus',
      'nutrition.composer.title': 'Valitse toiminto tälle päivälle',
      'nutrition.composer.hint': 'Napauta toimintoa aloittaaksesi',
      'nutrition.setup.title': 'Asetukset vaaditaan',
      'nutrition.setup.body':
        'Lis\u00e4\u00e4 Claude API -avaimesi k\u00e4ytt\u00e4\u00e4ksesi ravintocoachia. Avain pysyy t\u00e4ll\u00e4 laitteella, ja ravintopyynn\u00f6t l\u00e4hetet\u00e4\u00e4n t\u00e4st\u00e4 selaimesta suoraan Anthropiciin.',
      'nutrition.setup.save': 'Tallenna ja aloita',
      'nutrition.setup.help':
        'Hanki API-avain osoitteesta console.anthropic.com. K\u00e4yt\u00e4 omaa avainta ja v\u00e4lt\u00e4 jaettuja laitteita.',
      'nutrition.setup.empty': 'Sy\u00f6t\u00e4 API-avain',
      'nutrition.loading.thinking': 'Miettii...',
      'nutrition.loading.analyzing': 'Analysoi ateriaasi...',
      'nutrition.error.no_key':
        'Lisää Claude API -avaimesi kohdassa Asetukset \u2192 Tili käyttääksesi ravintocoachia.',
      'nutrition.error.auth': 'API-avain on virheellinen tai vanhentunut.',
      'nutrition.error.rate_limit':
        'Pyyntöraja saavutettu \u2014 odota hetki ja yritä uudelleen.',
      'nutrition.error.server': 'Claude API ei ole tilapäisesti saatavilla.',
      'nutrition.error.api':
        'Jokin meni pieleen. Tarkista API-avaimesi ja yritä uudelleen.',
      'nutrition.error.offline':
        'Olet offline-tilassa. Yhdistä internetiin ja yritä uudelleen.',
      'nutrition.retry': 'Yrit\u00e4 uudelleen',
      'nutrition.time.yesterday': 'Eilen',
      'nutrition.macro.protein': 'Proteiini',
      'nutrition.macro.carbs': 'Hiilihydraatit',
      'nutrition.macro.fat': 'Rasva',
      'nutrition.banner.personalized': 'Räätälöity',
      'nutrition.banner.setup_body':
        'Aseta kehoprofiilisi räätälöityjä neuvoja varten',
      'nutrition.banner.settings_link': 'Asetukset',
      'nutrition.today.label': 'Tänään',
      'nutrition.goal.lose_fat': 'rasvanpudotus',
      'nutrition.goal.gain_muscle': 'lihasmassan kasvu',
      'nutrition.goal.recomp': 'kehon koostumus',
      'nutrition.goal.maintain': 'ylläpito',
      'settings.claude_api_key.title': 'AI-ravintocoach',
      'settings.claude_api_key.label': 'Claude API -avain',
      'settings.claude_api_key.placeholder': 'sk-ant-...',
      'settings.claude_api_key.help':
        'Hanki API-avain osoitteesta console.anthropic.com. Avain pysyy t\u00e4ll\u00e4 laitteella, ja ravintopyynn\u00f6t l\u00e4hetet\u00e4\u00e4n t\u00e4st\u00e4 selaimesta suoraan Anthropiciin. K\u00e4yt\u00e4 omaa avainta ja v\u00e4lt\u00e4 jaettuja laitteita.',
      'settings.claude_api_key.save': 'Tallenna avain',
      'settings.claude_api_key.saved_hint':
        'Avain on jo tallennettu t\u00e4lle laitteelle. Sy\u00f6t\u00e4 uusi vain jos haluat korvata sen.',
      'settings.claude_api_key.clear': 'Poista avain',
      'settings.claude_api_key.invalid':
        'Sy\u00f6t\u00e4 kelvollinen Claude API -avain',
      'settings.claude_api_key.saved': 'API-avain tallennettu',
      'settings.claude_api_key.cleared': 'API-avain poistettu',
      'nutrition.correction.label': 'Korjaa ruoka-analyysi',
      'nutrition.correction.placeholder': 'esim. Se oli 2 annosta, ei 1...',
      'nutrition.photo.label': 'Lisää kuva',
      'nutrition.photo.cta': 'Kirjaa ateriasi',
      'nutrition.correction.send_aria': 'Lähetä korjaus',
      'nutrition.photo.menu.title': 'Lisää ateria',
      'nutrition.photo.menu.camera': 'Kuvaa ruoka',
      'nutrition.photo.menu.library': 'Valitse kuva kirjastosta',
      'nutrition.food_entry.label': 'Kirjoita ruoka',
      'nutrition.food_entry.placeholder':
        'esim. Kana-riisikulho ja jogurtti kylkeen',
      'nutrition.food_entry.send_aria': 'Lähetä ateria',

      /* ── Session character badge & pre-session note ───────────────── */
      'program.forge.character.deload':
        'Palautusviikko — kevyemmät painot, palautuminen',
      'program.forge.character.heavy': 'Raskas — huippu\u00adsarjat {pct} % TM',
      'program.forge.character.strength':
        'Voima — {pct} % TM, hallittu volyymi',
      'program.forge.character.volume':
        'Hypertrofia — {pct} % TM, volyymin kasvatus',
      'program.forge.note.deload':
        'Viikko {week}/{total} — palautus. Kevyesti, anna palautumisen tapahtua.',
      'program.forge.note.default': 'Viikko {week}/{total} — {block}. {hint}',
      'program.forge.note.sets_hint': 'Lopeta sarjat kun tekniikka pettää.',
      'program.forge.note.rtf_hint': 'Paina viimeinen sarja maksimitoistoihin.',
      'program.forge.note.rir_hint':
        'Huomioi jäljelle jäävät toistot viimeisessä sarjassa.',

      'program.w531.character.test': 'TM-testi — vahvista treenimaksimit',
      'program.w531.character.deload':
        'Palautusviikko — kevyt palautumisviikko',
      'program.w531.character.amrap':
        '1+ viikko — AMRAP viimeisessä sarjassa, {pct} %',
      'program.w531.character.heavy': '3s viikko — työsarjat {pct} % TM',
      'program.w531.character.volume':
        '5s viikko — kohtalainen volyymi, {pct} % TM',
      'program.w531.note.test':
        'Sykli {cycle}, TM-testi — paina maksimitoistot jokaisessa nostossa.',
      'program.w531.note.deload':
        'Sykli {cycle}, palautus — kevyet sarjat, keskity palautumiseen.',
      'program.w531.note.amrap':
        'Sykli {cycle}, {scheme} — paina maksimitoistot jokaisessa AMRAP-sarjassa.',
      'program.w531.note.default':
        'Sykli {cycle}, {scheme} — suorita kaikki sarjat puhtaasti.',

      'program.sl.character.normal':
        'Lineaarinen 5×5 — lisää painoa onnistuessa',
      'program.sl.note.default':
        'Treeni {count} · Ohjelma {next}. Lisää painoa jos viimeksi kaikki 5×5 onnistui.',

      'program.cfb.character.normal': 'Kokovartalo — vaihtelevat liikkeet',
      'program.cfb.note.default':
        'Treeni {count}{streak}. Keskity tekniikkaan ja intensiteettiin.',

      'program.hs.character.deload':
        'Palautusviikko — vähennetty volyymi, palautuminen',
      'program.hs.character.heavy': 'Push — T1 {pct} % TM',
      'program.hs.character.build': 'Build — T1 {pct} % TM, volyymi kasvaa',
      'program.hs.character.ramp': 'Aloitus — T1 {pct} % TM, maltillinen alku',
      'program.hs.note.deload':
        'Sykli {cycle}, viikko {week} — palautus. Kevyemmät painot, anna kehon palautua.',
      'program.hs.note.default':
        'Sykli {cycle}, viikko {week}/8 — {block}-vaihe. Pysy johdonmukaisena volyymissa.',
    },
  };

  function normalizeLocale(value) {
    const v = String(value || '')
      .trim()
      .toLowerCase();
    if (!v) return FALLBACK_LOCALE;
    const base = v.split('-')[0];
    return SUPPORTED_LOCALES.includes(base) ? base : FALLBACK_LOCALE;
  }

  function detectInitialLocale() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return normalizeLocale(saved);
    } catch (_) {}
    if (typeof navigator !== 'undefined' && navigator.language) {
      return normalizeLocale(navigator.language);
    }
    return FALLBACK_LOCALE;
  }

  let currentLocale = detectInitialLocale();

  function interpolate(template, params) {
    if (!params || typeof params !== 'object') return template;
    return Object.keys(params).reduce(
      (out, key) => out.replaceAll('{' + key + '}', String(params[key])),
      template
    );
  }

  function t(key, params, fallback) {
    const active = STRINGS[currentLocale] || {};
    const fallbackStrings = STRINGS[FALLBACK_LOCALE] || {};
    const raw = active[key] ?? fallbackStrings[key] ?? fallback ?? key;
    return interpolate(raw, params);
  }

  function extendStrings(locale, entries) {
    const loc = normalizeLocale(locale);
    if (!STRINGS[loc]) STRINGS[loc] = {};
    Object.assign(STRINGS[loc], entries || {});
  }

  function applyTranslations(root) {
    const scope = root || document;
    if (!scope || !scope.querySelectorAll) return;

    scope.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (!key) return;
      let params = null;
      const rawParams = el.getAttribute('data-i18n-params');
      if (rawParams) {
        try {
          params = JSON.parse(rawParams);
        } catch (_) {}
      }
      el.textContent = t(key, params);
    });

    scope.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (!key) return;
      el.setAttribute('placeholder', t(key));
    });
  }

  function notifyLanguageChange() {
    if (typeof window.updateLanguageDependentUI === 'function') {
      try {
        window.updateLanguageDependentUI();
      } catch (_) {}
    }
  }

  function setLanguage(locale, opts) {
    const options = opts || {};
    currentLocale = normalizeLocale(locale);
    if (options.persist !== false) {
      try {
        localStorage.setItem(STORAGE_KEY, currentLocale);
      } catch (_) {}
    }
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.setAttribute('lang', currentLocale);
    }
    applyTranslations(document);
    if (
      typeof window !== 'undefined' &&
      typeof window.dispatchEvent === 'function'
    ) {
      window.dispatchEvent(
        new CustomEvent('ironforge:language-changed', {
          detail: { locale: currentLocale },
        })
      );
    }
    if (options.notify !== false) notifyLanguageChange();
    return currentLocale;
  }

  function getLanguage() {
    return currentLocale;
  }

  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.setAttribute('lang', currentLocale);
  }

  window.I18N = {
    t,
    extendStrings,
    setLanguage,
    getLanguage,
    applyTranslations,
    normalizeLocale,
    fallbackLocale: FALLBACK_LOCALE,
    supportedLocales: SUPPORTED_LOCALES.slice(),
  };
})();
