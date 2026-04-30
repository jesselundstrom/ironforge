const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const scanRoots = ['app.js', 'core', 'src', 'tests'];
const allowedExtensions = new Set(['.js', '.jsx', '.ts', '.tsx']);

const knownOwners = new Map([
  ['__IRONFORGE_APP_RUNTIME__', 'src/app/services/app-runtime.ts'],
  ['__IRONFORGE_AUTH_RUNTIME__', 'src/app/services/auth-runtime.ts'],
  ['__IRONFORGE_RUNTIME_BRIDGE__', 'src/app/services/legacy-runtime.ts'],
  ['__IRONFORGE_SYNC_RUNTIME__', 'src/app/services/sync-runtime.ts'],
  ['__IRONFORGE_WORKOUT_RUNTIME__', 'src/app/services/workout-runtime.ts'],
  [
    '__IRONFORGE_WORKOUT_PERSISTENCE_RUNTIME__',
    'src/app/services/workout-persistence-runtime.ts',
  ],
  ['__IRONFORGE_STORES__', 'src/app/services/test-stores.ts'],
  ['setSelectedNutritionAction', 'src/stores/nutrition-store.ts'],
  ['submitNutritionMessage', 'src/stores/nutrition-store.ts'],
  ['submitNutritionTextMessage', 'src/stores/nutrition-store.ts'],
  ['handleNutritionPhoto', 'src/stores/nutrition-store.ts'],
  ['retryLastNutritionMessage', 'src/stores/nutrition-store.ts'],
  ['clearNutritionHistory', 'src/stores/nutrition-store.ts'],
  ['clearNutritionLocalData', 'src/stores/nutrition-store.ts'],
  ['setNutritionSessionContext', 'src/stores/nutrition-store.ts'],
  ['updateDashboard', 'src/stores/dashboard-store.ts'],
  ['toggleDayDetail', 'src/stores/dashboard-store.ts'],
  ['renderHistory', 'src/stores/history-store.ts'],
  ['computeFatigue', 'src/app/services/planning-runtime.ts'],
  ['showRPEPicker', 'src/app/services/workout-ui-actions.ts'],
  ['selectRPE', 'src/app/services/workout-ui-actions.ts'],
  ['skipRPE', 'src/app/services/workout-ui-actions.ts'],
  ['showSessionSummary', 'src/app/services/workout-ui-actions.ts'],
  ['startWorkout', 'src/stores/workout-store.ts'],
  ['updateRestDuration', 'src/stores/workout-store.ts'],
  ['syncRestTimer', 'src/stores/workout-store.ts'],
  ['startRestTimer', 'src/stores/workout-store.ts'],
  ['skipRest', 'src/stores/workout-store.ts'],
  ['setRestBarActiveState', 'src/stores/workout-store.ts'],
  ['showSetRIRPrompt', 'src/stores/workout-store.ts'],
  ['applySetRIR', 'src/stores/workout-store.ts'],
  ['finishWorkout', 'src/stores/workout-store.ts'],
  ['cancelWorkout', 'src/stores/workout-store.ts'],
  ['toggleSet', 'src/stores/workout-store.ts'],
  ['updateSet', 'src/stores/workout-store.ts'],
  ['addSet', 'src/stores/workout-store.ts'],
  ['removeEx', 'src/stores/workout-store.ts'],
]);

const references = new Map();

function shouldScan(filePath) {
  if (!fs.statSync(filePath).isFile()) return false;
  if (filePath.endsWith('.d.ts')) return true;
  return allowedExtensions.has(path.extname(filePath));
}

function walk(entryPath) {
  const fullPath = path.resolve(rootDir, entryPath);
  if (!fs.existsSync(fullPath)) return;
  const stat = fs.statSync(fullPath);
  if (stat.isFile()) {
    if (shouldScan(fullPath)) scanFile(fullPath);
    return;
  }
  for (const entry of fs.readdirSync(fullPath, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    walk(path.join(entryPath, entry.name));
  }
}

function record(name, kind, filePath, lineNumber, line) {
  const key = name.startsWith('__IRONFORGE_') ? name : `window.${name}`;
  if (!references.has(key)) {
    references.set(key, {
      name,
      key,
      owner: knownOwners.get(name) || 'unknown',
      reads: 0,
      writes: 0,
      locations: [],
    });
  }
  const entry = references.get(key);
  if (kind === 'write') entry.writes += 1;
  else entry.reads += 1;
  entry.locations.push({
    kind,
    file: path.relative(rootDir, filePath).replace(/\\/g, '/'),
    lineNumber,
    line,
  });
}

function scanFile(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  source.split(/\r?\n/).forEach((line, index) => {
    const dotPattern = /\bwindow\.([A-Za-z_$][\w$]*)/g;
    let match;
    while ((match = dotPattern.exec(line))) {
      const after = line.slice(match.index + match[0].length);
      const kind = /^\s*=/.test(after) ? 'write' : 'read';
      record(match[1], kind, filePath, index + 1, line.trim());
    }

    const bracketPattern = /\bwindow\[['"]([^'"]+)['"]\]/g;
    while ((match = bracketPattern.exec(line))) {
      const after = line.slice(match.index + match[0].length);
      const kind = /^\s*=/.test(after) ? 'write' : 'read';
      record(match[1], kind, filePath, index + 1, line.trim());
    }

    const ironforgePattern = /\b(__IRONFORGE_[A-Z0-9_]+)/g;
    while ((match = ironforgePattern.exec(line))) {
      record(match[1], 'read', filePath, index + 1, line.trim());
    }
  });
}

scanRoots.forEach(walk);

const sorted = [...references.values()].sort((a, b) =>
  a.key.localeCompare(b.key)
);

console.log(`# Ironforge window.* inventory (${sorted.length} surfaces)`);
for (const entry of sorted) {
  console.log(
    `\n${entry.key} | owner: ${entry.owner} | reads: ${entry.reads} | writes: ${entry.writes}`
  );
  for (const location of entry.locations.slice(0, 8)) {
    console.log(
      `  - ${location.kind} ${location.file}:${location.lineNumber} ${location.line}`
    );
  }
  if (entry.locations.length > 8) {
    console.log(`  - ... ${entry.locations.length - 8} more`);
  }
}
