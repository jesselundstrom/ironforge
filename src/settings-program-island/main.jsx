import React from 'react';
import { useRuntimeStore } from '../app/store/runtime-store.ts';
import { t } from '../app/services/i18n.ts';
import {
  openProgramSetupSheet,
  saveSimpleProgramSettings,
  switchProgram,
} from '../app/services/settings-actions.ts';
import { runProgramSettingsInlineAction } from '../app/services/program-settings-actions.ts';

function getSnapshot() {
  return {
    labels: {
      statusBar: '',
      basicsTitle: 'Program Basics',
      trainingProgram: 'Training Program',
      advancedTitle: 'Advanced Setup',
      advancedHelp:
        'Exercise swaps, cycle controls, peak block, and program-specific options.',
    },
    values: {
      programId: 'forge',
      basicsVisible: false,
      basicsSummary: '',
      basicsTree: [],
      basicsRenderKey: 'forge',
      trainingProgramSummary: '',
      switcher: {
        helper: '',
        cards: [],
      },
    },
  };
}

function runInlineHandler(code, event) {
  runProgramSettingsInlineAction(code, event);
}

function SettingsTreeNode({ node }) {
  if (!node) return null;
  if (node.type === 'text') {
    return node.text;
  }

  const { tag, attrs = {}, children = [] } = node;
  const props = {};

  Object.entries(attrs).forEach(([key, value]) => {
    if (key === 'onClickCode' || key === 'onChangeCode') return;
    if (key === 'defaultValue' || key === 'defaultChecked') {
      props[key] = value;
      return;
    }
    if (key.startsWith('data-') || key.startsWith('aria-')) {
      props[key] = value;
      return;
    }
    if (key === 'className' || key === 'id' || key === 'type' || key === 'min' || key === 'max' || key === 'step' || key === 'placeholder' || key === 'htmlFor' || key === 'style' || key === 'role' || key === 'hidden' || key === 'value') {
      props[key] = value;
    }
  });

  if (tag === 'input') {
    delete props.value;
  }
  if (tag === 'select' || tag === 'textarea') {
    delete props.value;
  }

  if (attrs.onClickCode) {
    props.onClick = (event) => {
      runInlineHandler(attrs.onClickCode, event);
      if (String(attrs.className || '').includes('sl-basic-next-btn')) {
        saveSimpleProgramSettings();
      }
    };
  }

  if (tag === 'input' || tag === 'select' || tag === 'textarea') {
    props.onChange = (event) => {
      runInlineHandler(attrs.onChangeCode, event);
      saveSimpleProgramSettings();
    };
  }

  const childNodes = children.map((child, index) => (
    <SettingsTreeNode
      key={`${tag}-${attrs.id || attrs.className || 'node'}-${index}`}
      node={child}
    />
  ));
  const voidTags = new Set(['input', 'img', 'br', 'hr', 'meta', 'link']);
  return voidTags.has(tag)
    ? React.createElement(tag, props)
    : React.createElement(tag, props, childNodes);
}

function ProgramSwitcher({ switcher }) {
  return (
    <div id="program-switcher-container">
      {switcher.helper ? <div className="program-switcher-note">{switcher.helper}</div> : null}
      {switcher.cards.map((card) => (
        <button
          aria-pressed={card.active}
          aria-label={
            t(
              card.active ? 'program.card.active' : 'program.card.switch_to',
              card.active ? 'Active program: {name}' : 'Switch to {name}',
              { name: card.name }
            )
          }
          className={`program-card${card.active ? ' active' : ''}`}
          data-program-id={card.id}
          data-state={card.active ? 'active' : 'inactive'}
          data-ui="program-card"
          key={card.id}
          type="button"
          onClick={() => switchProgram(card.id)}
        >
          <div className="program-card-icon">{card.icon}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="program-card-name">{card.name}</div>
            <div className="program-card-desc">{card.description}</div>
            <div className="program-card-meta">
              <span
                className={`program-card-difficulty program-card-difficulty-${
                  card.difficultyTone || 'intermediate'
                }`}
              >
                {card.difficultyLabel}
              </span>
              <span
                className={`program-card-fit ${
                  card.fitTone === 'ok'
                    ? 'program-card-fit-ok'
                    : 'program-card-fit-fallback'
                }`}
              >
                {card.fitLabel}
              </span>
            </div>
          </div>
          {card.active ? (
            <div className="program-card-badge">{card.activeLabel}</div>
          ) : null}
        </button>
      ))}
    </div>
  );
}

function SettingsProgramIsland() {
  useRuntimeStore((state) => state.ui.languageVersion);
  const [difficultyFilter, setDifficultyFilter] = React.useState('all');
  const snapshot =
    useRuntimeStore((state) => state.pages.settingsProgramView) || getSnapshot();
  const cards = snapshot.values.switcher.cards || [];
  const difficultyOptions = [
    {
      key: 'all',
      label: t('program.filter.all', 'All'),
      count: cards.length,
    },
    {
      key: 'beginner',
      label: t('program.filter.beginner', 'Beginner'),
      count: cards.filter((card) => card.difficultyTone === 'beginner').length,
    },
    {
      key: 'intermediate',
      label: t('program.filter.intermediate', 'Intermediate'),
      count: cards.filter((card) => card.difficultyTone === 'intermediate').length,
    },
    {
      key: 'advanced',
      label: t('program.filter.advanced', 'Advanced'),
      count: cards.filter((card) => card.difficultyTone === 'advanced').length,
    },
  ];
  const visibleCards =
    difficultyFilter === 'all'
      ? cards
      : cards.filter(
          (card) => card.difficultyTone === difficultyFilter || card.active
        );
  const showDifficultyFilter = cards.length > 1;

  return (
    <>
      <div className="settings-status-bar" id="program-status-bar">
        {snapshot.labels.statusBar}
      </div>

      <details
        className="settings-panel"
        id="program-basics-panel"
        style={{ display: snapshot.values.basicsVisible ? '' : 'none' }}
        open
      >
        <summary className="settings-panel-summary">
          <div>
            <div className="settings-panel-title">{snapshot.labels.basicsTitle}</div>
            <div className="settings-panel-sub" id="program-basics-summary">
              {snapshot.values.basicsSummary}
            </div>
          </div>
          <div className="settings-panel-chevron">⌄</div>
        </summary>
        <div className="settings-panel-body">
          <div id="program-basics-container" key={snapshot.values.basicsRenderKey}>
            {snapshot.values.basicsTree.map((node, index) => (
              <SettingsTreeNode
                key={`basics-${snapshot.values.programId}-${index}`}
                node={node}
              />
            ))}
          </div>
        </div>
      </details>

      <details className="settings-panel" id="training-program-panel" open>
        <summary className="settings-panel-summary">
          <div>
            <div className="settings-panel-title">{snapshot.labels.trainingProgram}</div>
            <div className="settings-panel-sub" id="training-program-summary">
              {snapshot.values.trainingProgramSummary}
            </div>
          </div>
          <div className="settings-panel-chevron">⌄</div>
        </summary>
        <div className="settings-panel-body">
          {showDifficultyFilter ? (
            <div className="program-filter-header">
              <div className="settings-panel-title" style={{ marginBottom: 0 }}>
                {t('program.filter.title', 'Filter by level')}
              </div>
              <div
                className="program-filter-row"
                role="toolbar"
                aria-label="Filter programs by difficulty"
              >
                {difficultyOptions.map((option) => (
                  <button
                    aria-pressed={difficultyFilter === option.key}
                    className={`program-filter-chip${
                      difficultyFilter === option.key ? ' active' : ''
                    }`}
                    data-difficulty={option.key}
                    data-state={difficultyFilter === option.key ? 'active' : 'inactive'}
                    data-ui="program-filter-chip"
                    key={option.key}
                    type="button"
                    onClick={() => setDifficultyFilter(option.key)}
                  >
                    <span>{option.label}</span>
                    <span className="program-filter-chip-count">{option.count}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <ProgramSwitcher switcher={{ ...snapshot.values.switcher, cards: visibleCards }} />
        </div>
      </details>

      {!snapshot.values.simpleMode ? (
        <button
          className="settings-panel settings-panel-static program-advanced-card"
          data-ui="program-advanced-trigger"
          id="program-advanced-panel"
          type="button"
          onClick={() => openProgramSetupSheet()}
        >
          <div className="settings-panel-summary settings-panel-summary-static">
            <div>
              <div className="settings-panel-title">{snapshot.labels.advancedTitle}</div>
              <div className="settings-panel-sub">{snapshot.labels.advancedHelp}</div>
            </div>
            <div className="program-advanced-chevron">&#8250;</div>
          </div>
        </button>
      ) : null}
    </>
  );
}

export { SettingsProgramIsland };
