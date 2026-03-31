type LegacyWindow = Window & Record<string, unknown>;

function getLegacyWindow(): LegacyWindow | null {
  if (typeof window === 'undefined') return null;
  return window as unknown as LegacyWindow;
}

export function callLegacyWindowFunction<T = unknown>(
  name: string,
  ...args: unknown[]
): T | undefined {
  const runtimeWindow = getLegacyWindow();
  const target = runtimeWindow?.[name];
  if (typeof target !== 'function') return undefined;
  return (target as (...callArgs: unknown[]) => T)(...args);
}

export function readLegacyWindowValue<T = unknown>(name: string): T | undefined {
  return getLegacyWindow()?.[name] as T | undefined;
}
