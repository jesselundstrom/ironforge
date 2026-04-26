const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const canonicalContract = 'docs/post-migration-consolidation.md';
const canonicalContractPath = path.join(rootDir, canonicalContract);

const requiredReferenceFiles = [
  'AGENTS.md',
  'CLAUDE.md',
  '.github/copilot-instructions.md',
];

const keyInstructionFiles = [
  ...requiredReferenceFiles,
  'docs/migration-ts-zustand.md',
  '.agents/skills/builder-agent/SKILL.md',
  '.agents/skills/ironforge-business-advisor/SKILL.md',
  '.agents/skills/self-auditor/SKILL.md',
];

const requiredHeading = '## Ownership Anti-Drift Contract';
const failures = [];

function readProjectFile(relativePath) {
  const filePath = path.join(rootDir, relativePath);
  if (!fs.existsSync(filePath)) {
    failures.push(`${relativePath} is missing.`);
    return '';
  }
  return fs.readFileSync(filePath, 'utf8');
}

const contractSource = readProjectFile(canonicalContract);
if (!contractSource.includes(requiredHeading)) {
  failures.push(`${canonicalContract} must contain "${requiredHeading}".`);
}

requiredReferenceFiles.forEach((relativePath) => {
  const source = readProjectFile(relativePath);
  if (!source.includes(canonicalContract)) {
    failures.push(`${relativePath} must reference ${canonicalContract}.`);
  }
});

keyInstructionFiles.forEach((relativePath) => {
  const source = readProjectFile(relativePath);
  const lines = source.split(/\r?\n/);

  lines.forEach((line, index) => {
    const lowerLine = line.toLowerCase();
    const namesSourceOfTruth = lowerLine.includes('source of truth');
    const concernsOwnershipCleanup =
      lowerLine.includes('ownership cleanup') ||
      lowerLine.includes('ownership anti-drift') ||
      lowerLine.includes('runtime ownership') ||
      lowerLine.includes('consolidation') ||
      lowerLine.includes('cleanup') ||
      lowerLine.includes('anti-drift') ||
      lowerLine.includes('stabilization');

    if (!namesSourceOfTruth || !concernsOwnershipCleanup) return;
    if (line.includes(canonicalContract)) return;

    failures.push(
      `${relativePath}:${index + 1} appears to define a competing ownership-cleanup source of truth -> ${line.trim()}`
    );
  });
});

if (!fs.existsSync(canonicalContractPath)) {
  failures.push(`${canonicalContract} is missing.`);
}

if (!failures.length) {
  console.log('Instruction drift guardrail passed: ownership cleanup points to the canonical contract.');
  process.exit(0);
}

console.error('Instruction drift guardrail failed:');
failures.forEach((failure) => console.error(`- ${failure}`));
process.exit(1);
