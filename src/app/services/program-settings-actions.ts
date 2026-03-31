import { callLegacyWindowFunction } from './legacy-call';

type ProgramSettingsInlineEvent = {
  target?: {
    checked?: boolean;
    value?: string | number | null;
  } | null;
} | null;

function readCheckedValue(event?: ProgramSettingsInlineEvent) {
  return event?.target?.checked === true;
}

function readTargetValue(event?: ProgramSettingsInlineEvent) {
  const rawValue = event?.target?.value;
  return rawValue === undefined || rawValue === null ? '' : String(rawValue);
}

function setElementValueById(elementId: string, value: string) {
  if (typeof document === 'undefined') return;
  const element = document.getElementById(elementId);
  if (!element || !('value' in element)) return;
  (element as HTMLInputElement | HTMLSelectElement).value = value;
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

function runAllowedLegacyCall(
  code: string,
  event?: ProgramSettingsInlineEvent
) {
  const checked = readCheckedValue(event);
  const targetValue = readTargetValue(event);
  const patterns: Array<{
    matcher: RegExp;
    execute: (match: RegExpMatchArray) => void;
  }> = [
    {
      matcher: /^saveProgramSetup\(\)$/,
      execute: () => {
        callLegacyWindowFunction('saveProgramSetup');
      },
    },
    {
      matcher: /^window\._forgePickMain\('([^']+)',(\d+)\)$/,
      execute: (match) => {
        callLegacyWindowFunction('_forgePickMain', match[1], Number(match[2]));
      },
    },
    {
      matcher: /^window\._forgePickAux\('([^']+)',(\d+)\)$/,
      execute: (match) => {
        callLegacyWindowFunction('_forgePickAux', match[1], Number(match[2]));
      },
    },
    {
      matcher: /^window\._forgePickBack\('([^']+)'\)$/,
      execute: (match) => {
        callLegacyWindowFunction('_forgePickBack', match[1]);
      },
    },
    {
      matcher: /^window\._forgeToggleSkipPeak\(\)$/,
      execute: () => {
        callLegacyWindowFunction('_forgeToggleSkipPeak');
      },
    },
    {
      matcher: /^window\._slPickAccessory\('([^']+)','([^']+)'\)$/,
      execute: (match) => {
        callLegacyWindowFunction('_slPickAccessory', match[1], match[2]);
      },
    },
    {
      matcher: /^window\._slSetNextWorkoutBasic\('([AB])'\)$/,
      execute: (match) => {
        callLegacyWindowFunction('_slSetNextWorkoutBasic', match[1]);
      },
    },
    {
      matcher: /^window\._slToggleAccessoryConfig\('([^']+)',this\.checked\)$/,
      execute: (match) => {
        callLegacyWindowFunction('_slToggleAccessoryConfig', match[1], checked);
      },
    },
    {
      matcher: /^window\._w531PickTriumvirate\((\d+),(\d+)\)$/,
      execute: (match) => {
        callLegacyWindowFunction(
          '_w531PickTriumvirate',
          Number(match[1]),
          Number(match[2])
        );
      },
    },
    {
      matcher: /^window\._w531SeasonUI\('([^']+)'\)$/,
      execute: (match) => {
        callLegacyWindowFunction('_w531SeasonUI', match[1]);
      },
    },
    {
      matcher: /^window\._w531ToggleTestWeek\(\)$/,
      execute: () => {
        callLegacyWindowFunction('_w531ToggleTestWeek');
      },
    },
    {
      matcher: /^updateForgeModeSetting\(\)$/,
      execute: () => {
        callLegacyWindowFunction('updateForgeModeSetting');
      },
    },
    {
      matcher: /^setSLNextWorkout\('([AB])'\)$/,
      execute: (match) => {
        callLegacyWindowFunction('setSLNextWorkout', match[1]);
      },
    },
    {
      matcher: /^updateSLLift\('([^']+)',parseFloat\(this\.value\)\|\|0\)$/,
      execute: (match) => {
        callLegacyWindowFunction('updateSLLift', match[1], targetValue);
      },
    },
    {
      matcher: /^updateProgramLift\('([^']+)',(\d+),'([^']+)',parseFloat\(this\.value\)\|\|0\)$/,
      execute: (match) => {
        callLegacyWindowFunction(
          'updateProgramLift',
          match[1],
          Number(match[2]),
          match[3],
          targetValue
        );
      },
    },
    {
      matcher: /^document\.getElementById\('([^']+)'\)\.value=(\d+)$/,
      execute: (match) => {
        setElementValueById(match[1], match[2]);
      },
    },
  ];

  for (const pattern of patterns) {
    const match = code.match(pattern.matcher);
    if (!match) continue;
    pattern.execute(match);
    return true;
  }

  return false;
}

export function runProgramSettingsInlineAction(
  code?: string | null,
  event?: ProgramSettingsInlineEvent
) {
  const normalizedCode = String(code || '').trim();
  if (!normalizedCode) return true;
  return runAllowedLegacyCall(normalizedCode, event);
}

declare global {
  interface Window {
    __IRONFORGE_RUN_PROGRAM_SETTINGS_INLINE_ACTION__?: (
      code?: string | null,
      event?: ProgramSettingsInlineEvent
    ) => boolean;
  }
}

if (typeof window !== 'undefined') {
  window.__IRONFORGE_RUN_PROGRAM_SETTINGS_INLINE_ACTION__ =
    runProgramSettingsInlineAction;
}
