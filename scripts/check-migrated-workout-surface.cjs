const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');

const forbiddenPatterns = [
  'window.startWorkout',
  'window.finishWorkout',
  'window.cancelWorkout',
  'window.toggleSet',
  'window.addSet',
  'window.updateSet',
  'window.addExerciseByName',
  'window.applyQuickWorkoutAdjustment',
  'window.undoQuickWorkoutAdjustment',
  'window.openExerciseGuide',
  'window.closeExerciseGuide',
  'window.showSetRIRPrompt',
  'window.applySetRIR',
  'window.resumeActiveWorkoutUI',
  'window.updateRestDuration',
  'window.syncRestTimer',
  'window.startRestTimer',
  'window.skipRest',
  'window.setRestBarActiveState',
  'window.selectExerciseCatalogExercise',
  'window.eval(',
  'createLegacyProgramAdapter(',
];

const typedSurfaceWriteRules = [
  {
    matcher: /src[\\/](app[\\/]services[\\/](dashboard-actions|history-actions|nutrition-coach)|stores[\\/](dashboard-store|nutrition-store)|domain[\\/]dashboard-runtime)\.(js|jsx|ts|tsx)$/,
    patterns: ['window.workouts =', 'window.profile =', 'window.schedule =', 'window.currentUser ='],
  },
];

const allowedExtensions = new Set(['.js', '.jsx', '.ts', '.tsx']);
const ignoredSuffixes = ['.d.ts'];
const failures = [];
const allowedMatches = [
  {
    matcher: /src[\\/]stores[\\/]data-store\.ts$/,
    patterns: ['window.eval('],
  },
];

function shouldScan(filePath) {
  if (ignoredSuffixes.some((suffix) => filePath.endsWith(suffix))) return false;
  return allowedExtensions.has(path.extname(filePath));
}

function walk(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (!shouldScan(fullPath)) continue;
    scanFile(fullPath);
  }
}

function scanFile(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const lines = source.split(/\r?\n/);
  lines.forEach((line, index) => {
    forbiddenPatterns.forEach((pattern) => {
      if (!line.includes(pattern)) return;
      const allowed = allowedMatches.some(
        (rule) => rule.matcher.test(filePath) && rule.patterns.includes(pattern)
      );
      if (allowed) return;
      failures.push({
        filePath,
        lineNumber: index + 1,
        pattern,
        line: line.trim(),
      });
    });
    typedSurfaceWriteRules.forEach((rule) => {
      if (!rule.matcher.test(filePath)) return;
      rule.patterns.forEach((pattern) => {
        if (!line.includes(pattern)) return;
        failures.push({
          filePath,
          lineNumber: index + 1,
          pattern,
          line: line.trim(),
        });
      });
    });
  });
}

walk(srcDir);

if (!failures.length) {
  console.log('Migration guardrail passed: no forbidden migrated workout globals found in src/.');
  process.exit(0);
}

console.error('Migration guardrail failed. Moved workout surfaces must use stores, not legacy globals:');
failures.forEach((failure) => {
  const relativePath = path.relative(rootDir, failure.filePath).replace(/\\/g, '/');
  console.error(
    `- ${relativePath}:${failure.lineNumber} matched "${failure.pattern}" -> ${failure.line}`
  );
});
process.exit(1);
