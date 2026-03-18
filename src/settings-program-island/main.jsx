import React from 'react';
import { mountIsland, useIslandSnapshot } from '../island-runtime/index.jsx';

const SETTINGS_PROGRAM_EVENT =
  window.__IRONFORGE_SETTINGS_PROGRAM_ISLAND_EVENT__ ||
  'ironforge:settings-program-updated';
const LANGUAGE_EVENT = 'ironforge:language-changed';

function getSnapshot() {
  if (typeof window.getSettingsProgramReactSnapshot === 'function') {
    return window.getSettingsProgramReactSnapshot();
  }

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
  if (!code) return;
  const checkedValue = event?.target?.checked ? 'true' : 'false';
  const expression = String(code).replace(/\bthis\.checked\b/g, checkedValue);
  window.eval?.(expression);
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
        window.saveSimpleProgramSettings?.();
      }
    };
  }

  if (tag === 'input' || tag === 'select' || tag === 'textarea') {
    props.onChange = (event) => {
      runInlineHandler(attrs.onChangeCode, event);
      window.saveSimpleProgramSettings?.();
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
        <div
          className={`program-card${card.active ? ' active' : ''}`}
          key={card.id}
          onClick={() => window.switchProgram?.(card.id)}
        >
          <div className="program-card-icon">{card.icon}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="program-card-name">{card.name}</div>
            <div className="program-card-desc">{card.description}</div>
            <div className="program-card-meta">
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
        </div>
      ))}
    </div>
  );
}

function SettingsProgramIsland() {
  const snapshot = useIslandSnapshot(
    [SETTINGS_PROGRAM_EVENT, LANGUAGE_EVENT],
    getSnapshot
  );

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
          <ProgramSwitcher switcher={snapshot.values.switcher} />
        </div>
      </details>

      <div
        className="settings-panel settings-panel-static program-advanced-card"
        id="program-advanced-panel"
        onClick={() => window.openProgramSetupSheet?.()}
        style={{ cursor: 'pointer' }}
      >
        <div className="settings-panel-summary settings-panel-summary-static">
          <div>
            <div className="settings-panel-title">{snapshot.labels.advancedTitle}</div>
            <div className="settings-panel-sub">{snapshot.labels.advancedHelp}</div>
          </div>
          <div className="program-advanced-chevron">&#8250;</div>
        </div>
      </div>
    </>
  );
}

mountIsland({
  mountId: 'settings-program-react-root',
  legacyShellId: 'settings-program-legacy-shell',
  mountedFlag: '__IRONFORGE_SETTINGS_PROGRAM_ISLAND_MOUNTED__',
  eventName: SETTINGS_PROGRAM_EVENT,
  Component: SettingsProgramIsland,
});
