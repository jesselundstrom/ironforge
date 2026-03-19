import { useEffect, useRef, useState } from 'react';
import { t } from '../core/i18n.js';
import { mountIsland, useIslandSnapshot } from '../island-runtime/index.jsx';

const NUTRITION_EVENT =
  window.__IRONFORGE_NUTRITION_ISLAND_EVENT__ ||
  'ironforge:nutrition-updated';
const LANGUAGE_EVENT = 'ironforge:language-changed';

const initialSnapshot = {
  values: {
    hasApiKey: false,
    menuOpen: false,
    loading: {
      visible: false,
      text: '',
    },
    selectedActionId: 'plan_today',
    actions: [],
    contextBanner: null,
    todayCard: null,
    messagesState: 'setup',
    messages: [],
    scrollVersion: 0,
  },
};

function getSnapshot() {
  if (typeof window.getNutritionReactSnapshot === 'function') {
    return window.getNutritionReactSnapshot() || initialSnapshot;
  }
  return initialSnapshot;
}

function openNutritionSettings() {
  const navButton =
    document.querySelector('.nav-btn[data-page="settings"]') ||
    document.querySelectorAll('.nav-btn')[3];
  window.showPage?.('settings', navButton);
}

function handleSetupSave() {
  window.saveNutritionSetupKey?.();
}


function handleClear() {
  window.clearNutritionHistory?.();
  window.toggleNutritionMenu?.();
}

function handleRetry() {
  window.retryLastNutritionMessage?.();
}

function handleActionSelect(actionId) {
  window.setSelectedNutritionAction?.(actionId);
}

function formatInline(text, keyPrefix) {
  const nodes = [];
  const pattern = /(\*\*.*?\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match;
  let partIndex = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      nodes.push(
        <strong key={`${keyPrefix}-bold-${partIndex++}`}>
          {token.slice(2, -2)}
        </strong>
      );
    } else {
      nodes.push(
        <span className="nc-code" key={`${keyPrefix}-code-${partIndex++}`}>
          {token.slice(1, -1)}
        </span>
      );
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function renderFormattedText(text) {
  const lines = String(text || '').split('\n');
  const blocks = [];
  let listItems = [];
  let listType = null;
  let blockIndex = 0;

  const flushList = () => {
    if (!listItems.length) return;
    const Tag = listType === 'ordered' ? 'ol' : 'ul';
    blocks.push(
      <Tag className="nc-list" key={`list-${blockIndex++}`}>
        {listItems}
      </Tag>
    );
    listItems = [];
    listType = null;
  };

  lines.forEach((rawLine, lineIndex) => {
    const line = rawLine || '';
    if (/^###\s+/.test(line)) {
      flushList();
      blocks.push(
        <div className="nc-h3" key={`h3-${blockIndex++}`}>
          {formatInline(line.replace(/^###\s+/, ''), `h3-${lineIndex}`)}
        </div>
      );
      return;
    }
    if (/^##\s+/.test(line) || /^#\s+/.test(line)) {
      flushList();
      blocks.push(
        <div className="nc-h2" key={`h2-${blockIndex++}`}>
          {formatInline(line.replace(/^#{1,2}\s+/, ''), `h2-${lineIndex}`)}
        </div>
      );
      return;
    }
    if (/^[-*]\s+/.test(line)) {
      if (listType !== 'unordered') {
        flushList();
        listType = 'unordered';
      }
      listItems.push(
        <li key={`ul-${lineIndex}`}>
          {formatInline(line.replace(/^[-*]\s+/, ''), `ul-${lineIndex}`)}
        </li>
      );
      return;
    }
    if (/^\d+[.)]\s+/.test(line)) {
      if (listType !== 'ordered') {
        flushList();
        listType = 'ordered';
      }
      listItems.push(
        <li key={`ol-${lineIndex}`}>
          {formatInline(line.replace(/^\d+[.)]\s+/, ''), `ol-${lineIndex}`)}
        </li>
      );
      return;
    }
    if (!line.trim()) {
      flushList();
      blocks.push(<div className="nc-break" key={`break-${blockIndex++}`} />);
      return;
    }

    flushList();
    blocks.push(
      <p className="nc-p" key={`p-${blockIndex++}`}>
        {formatInline(line, `p-${lineIndex}`)}
      </p>
    );
  });

  flushList();
  return blocks;
}

function NutritionHeader({ menuOpen }) {
  return (
    <div className="nutrition-page-header">
      <div className="nutrition-page-heading">
        <div className="nutrition-page-kicker">
          {t('nutrition.empty.kicker', 'AI NUTRITION COACH')}
        </div>
        <div className="nutrition-page-title">
          {t('nutrition.page.title', 'Nutrition Coach')}
        </div>
      </div>
      <div className="nutrition-overflow-wrap">
        <button
          className="nutrition-overflow-btn"
          type="button"
          onClick={() => window.toggleNutritionMenu?.()}
          aria-label="Menu"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
            <circle cx="12" cy="5" r="1.5" />
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="12" cy="19" r="1.5" />
          </svg>
        </button>
        <div
          className={`nutrition-overflow-menu${menuOpen ? ' open' : ''}`}
          id="nutrition-overflow-menu"
        >
          <button type="button" onClick={handleClear}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              width="16"
              height="16"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
              <path d="M9 6V4h6v2" />
            </svg>
            <span>{t('nutrition.clear.btn', 'Clear conversation')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function ContextBanner({ banner }) {
  if (!banner) return null;
  return (
    <div className="nutrition-context-banner">
      {banner.kind === 'personalized' ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      )}
      <span>
        {banner.kind === 'personalized' ? (
          <>
            {banner.text} · {banner.details}
          </>
        ) : (
          <>
            {banner.text}{' '}
            <a
              href="#settings"
              onClick={(event) => {
                event.preventDefault();
                openNutritionSettings();
              }}
            >
              {banner.linkText} →
            </a>
          </>
        )}
      </span>
    </div>
  );
}

function TodayCard({ card }) {
  if (!card) return null;
  const calorieText = card.calories.target
    ? `${card.calories.value} / ${card.calories.target} kcal`
    : `${card.calories.value} kcal`;
  return (
    <div className="nutrition-today-card">
      <div className="nc-today-header">
        <div className="nc-today-label">{t('nutrition.today.label', 'Today')}</div>
        <div className="nc-today-cal">
          <strong>{calorieText}</strong>
        </div>
      </div>
      {card.calories.target ? (
        <div className="nc-today-bar">
          <div
            className="nc-today-bar-fill"
            style={{ width: `${card.calories.progress}%` }}
          />
        </div>
      ) : null}
      {card.protein.target ? (
        <div className="nc-today-bar nc-today-bar-pro">
          <div
            className="nc-today-bar-fill nc-today-bar-fill-pro"
            style={{ width: `${card.protein.progress}%` }}
          />
        </div>
      ) : null}
      <div className="nc-today-macros">
        <div className="nc-today-macro nc-macro-pro">
          <strong>{card.protein.value}g</strong> {t('nutrition.macro.protein', 'P')}
        </div>
        <div className="nc-today-macro nc-macro-carb">
          <strong>{card.carbs}g</strong> {t('nutrition.macro.carbs', 'C')}
        </div>
        <div className="nc-today-macro nc-macro-fat">
          <strong>{card.fat}g</strong> {t('nutrition.macro.fat', 'F')}
        </div>
      </div>
    </div>
  );
}

function SetupCard() {
  return (
    <div className="nutrition-setup-card">
      <div className="card-title">{t('nutrition.setup.title', 'Setup Required')}</div>
      <div className="nutrition-setup-icon">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          width="24"
          height="24"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>
      <div className="nutrition-setup-desc">
        {t(
          'nutrition.setup.body',
          'Add your Claude API key to use the Nutrition Coach. Your key is stored only on this device.'
        )}
      </div>
      <div className="account-field">
        <label>{t('settings.claude_api_key.label', 'Claude API Key')}</label>
        <input
          type="password"
          id="nutrition-setup-key-input"
          placeholder="sk-ant-..."
          autoComplete="off"
          spellCheck="false"
        />
      </div>
      <button className="btn btn-primary" type="button" onClick={handleSetupSave}>
        {t('nutrition.setup.save', 'Save & Start')}
      </button>
      <div className="nutrition-setup-desc" style={{ marginTop: 12, fontSize: 12 }}>
        {t('nutrition.setup.help', 'Get your API key at console.anthropic.com')}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="nutrition-empty">
      <div className="nutrition-empty-kicker">
        {t('nutrition.empty.kicker', 'AI NUTRITION COACH')}
      </div>
      <div className="nutrition-empty-orb">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          width="36"
          height="36"
        >
          <path d="M17 8c.7-3.4-.8-6.2-3-7.5C12.3 3 11.5 5.4 12 8" />
          <path d="M12 8c-4 0-7 2.5-7 6 0 4.5 3 8 7 8s7-3.5 7-8c0-3.5-3-6-7-6z" />
        </svg>
      </div>
      <div className="nutrition-empty-title">
        {t('nutrition.empty.title', 'Your daily nutrition coach')}
      </div>
      <div className="nutrition-empty-sub">
        {t(
          'nutrition.empty.body',
          'Pick a guided action below and get personalised nutrition advice for today.'
        )}
      </div>
      <div className="nutrition-empty-reset">
        {t('nutrition.empty.reset', 'Resets automatically each day.')}
      </div>
    </div>
  );
}

function MacroCard({ macros }) {
  if (!macros) return null;
  return (
    <div className="nutrition-macro-card">
      {macros.calories ? (
        <div className="nutrition-macro-item nc-macro-cal">
          <div className="nutrition-macro-value">{macros.calories}</div>
          <div className="nutrition-macro-label">kcal</div>
        </div>
      ) : null}
      {macros.protein ? (
        <div className="nutrition-macro-item nc-macro-pro">
          <div className="nutrition-macro-value">{macros.protein}g</div>
          <div className="nutrition-macro-label">
            {t('nutrition.macro.protein', 'Protein')}
          </div>
        </div>
      ) : null}
      {macros.carbs ? (
        <div className="nutrition-macro-item nc-macro-carb">
          <div className="nutrition-macro-value">{macros.carbs}g</div>
          <div className="nutrition-macro-label">
            {t('nutrition.macro.carbs', 'Carbs')}
          </div>
        </div>
      ) : null}
      {macros.fat ? (
        <div className="nutrition-macro-item nc-macro-fat">
          <div className="nutrition-macro-value">{macros.fat}g</div>
          <div className="nutrition-macro-label">
            {t('nutrition.macro.fat', 'Fat')}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MessageList({ snapshot }) {
  if (snapshot.values.messagesState === 'setup') {
    return <SetupCard />;
  }
  if (snapshot.values.messagesState === 'empty') {
    return <EmptyState />;
  }

  return [
    ...snapshot.values.messages.map((message) => {
    if (message.kind === 'photo') {
      return (
        <div className="nutrition-msg-photo-tag" key={message.id}>
          <img className="nutrition-msg-photo-thumb" src={message.imageDataUrl} alt="" />
        </div>
      );
    }

    if (message.kind === 'action') {
      return (
        <div className="nutrition-msg-action-tag" key={message.id}>
          <span>{message.text}</span>
        </div>
      );
    }

    return (
      <div
        className={`nutrition-msg nutrition-msg-coach${
          message.isError ? ' nutrition-msg-error' : ''
        }`}
        key={message.id}
      >
        <div className="nutrition-coach-avatar">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            width="14"
            height="14"
          >
            <path d="M17 8c.7-3.4-.8-6.2-3-7.5C12.3 3 11.5 5.4 12 8" />
            <path d="M12 8c-4 0-7 2.5-7 6 0 4.5 3 8 7 8s7-3.5 7-8c0-3.5-3-6-7-6z" />
          </svg>
        </div>
        <div className="nutrition-msg-body">
          <MacroCard macros={message.macros} />
          <div className="nutrition-msg-text">
            {renderFormattedText(message.text)}
            {message.isStreaming ? <span className="nc-cursor" /> : null}
          </div>
          {message.isError ? (
            <div className="nutrition-msg-text">
              <button className="nutrition-retry-btn" onClick={handleRetry} type="button">
                {t('nutrition.retry', 'Try again')}
              </button>
            </div>
          ) : null}
          <div className="nutrition-msg-time">
            {message.timestamp}
            {message.modelTag}
          </div>
        </div>
      </div>
    );
  }),
  snapshot.values.showCorrectionInput
    ? <CorrectionRow key="correction-row" />
    : null,
  ];
}

function LoadingRow({ loading }) {
  return (
    <div
      className="nutrition-loading"
      id="nutrition-loading"
      style={{ display: loading.visible ? 'flex' : 'none' }}
    >
      <div className="nutrition-coach-avatar">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          width="16"
          height="16"
        >
          <path d="M17 8c.7-3.4-.8-6.2-3-7.5C12.3 3 11.5 5.4 12 8" />
          <path d="M12 8c-4 0-7 2.5-7 6 0 4.5 3 8 7 8s7-3.5 7-8c0-3.5-3-6-7-6z" />
        </svg>
      </div>
      <div className="nutrition-loading-content">
        <div className="nutrition-loading-text" id="nutrition-loading-text">
          {loading.text}
        </div>
        <div className="nutrition-loading-dots">
          <span className="nutrition-dot" />
          <span className="nutrition-dot" />
          <span className="nutrition-dot" />
        </div>
      </div>
    </div>
  );
}

// Inline correction row — lives in the message list and keeps itself visible
// inside the message scroller when the iOS keyboard changes the viewport.
function CorrectionRow() {
  const [text, setText] = useState('');
  const inputRef = useRef(null);

  function keepInputVisible(behavior = 'auto') {
    const field = inputRef.current;
    const messages = document.getElementById('nutrition-messages');
    const shell = document.getElementById('nutrition-shell');
    const composer = document.querySelector('#nutrition-shell .nutrition-composer');
    const viewportHeight = window.visualViewport?.height || window.innerHeight || 0;
    if (!(field instanceof HTMLElement) || !messages || !shell) return;

    const fieldRect = field.getBoundingClientRect();
    const messagesRect = messages.getBoundingClientRect();
    const shellRect = shell.getBoundingClientRect();
    const composerRect = composer?.getBoundingClientRect();
    const topLimit = Math.max(shellRect.top + 12, messagesRect.top + 8);
    const bottomLimit = Math.min(
      messagesRect.bottom - 12,
      composerRect ? composerRect.top - 12 : viewportHeight - 12,
      viewportHeight - 12
    );

    if (fieldRect.bottom > bottomLimit) {
      messages.scrollTo({
        top: messages.scrollTop + (fieldRect.bottom - bottomLimit),
        behavior,
      });
      return;
    }

    if (fieldRect.top < topLimit) {
      messages.scrollTo({
        top: Math.max(0, messages.scrollTop - (topLimit - fieldRect.top)),
        behavior,
      });
    }
  }

  useEffect(() => {
    const field = inputRef.current;
    if (!(field instanceof HTMLElement)) return undefined;

    let scheduled = [];
    const syncDelays = [0, 80, 180, 320, 480];
    const clearScheduled = () => {
      scheduled.forEach((handle) => window.clearTimeout(handle));
      scheduled = [];
    };
    const syncWhileFocused = () => {
      if (document.activeElement !== field) return;
      keepInputVisible('auto');
    };
    const scheduleSync = () => {
      clearScheduled();
      syncDelays.forEach((delay) => {
        const handle = window.setTimeout(syncWhileFocused, delay);
        scheduled.push(handle);
      });
    };
    const handleFocus = () => scheduleSync();
    const handleViewportChange = () => syncWhileFocused();
    const viewport = window.visualViewport;

    field.addEventListener('focus', handleFocus);
    window.addEventListener('resize', handleViewportChange);
    if (viewport) {
      viewport.addEventListener('resize', handleViewportChange);
      viewport.addEventListener('scroll', handleViewportChange);
    }

    return () => {
      clearScheduled();
      field.removeEventListener('focus', handleFocus);
      window.removeEventListener('resize', handleViewportChange);
      if (viewport) {
        viewport.removeEventListener('resize', handleViewportChange);
        viewport.removeEventListener('scroll', handleViewportChange);
      }
    };
  }, []);

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed) return;
    window.submitNutritionTextMessage?.(trimmed);
    setText('');
  }

  return (
    <div className="nc-correction-row">
      <div className="nc-correction-label">
        {t('nutrition.correction.label', 'Correct the food analysis')}
      </div>
      <div className="nc-correction-inputs">
        <textarea
          className="nc-correction-input"
          id="nutrition-text-input"
          ref={inputRef}
          rows={2}
          placeholder={t('nutrition.correction.placeholder', 'e.g. That was 2 portions, not 1...')}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <button
          className="nc-correction-send"
          type="button"
          onClick={handleSend}
          disabled={!text.trim()}
          aria-label="Send correction"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function Composer({ snapshot }) {
  const hidden = !snapshot.values.hasApiKey;

  return (
    <div className={`nutrition-composer${hidden ? ' nc-hidden' : ''}`}>
      <div className="nutrition-action-grid" id="nutrition-action-grid">
        {snapshot.values.actions.map((action) => (
          <button
            className={`nutrition-prompt-chip nutrition-action-card${
              action.selected ? ' active' : ''
            }`}
            type="button"
            data-nc-action={action.id}
            key={action.id}
            onClick={() => handleActionSelect(action.id)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
            <span>{t(action.labelKey, action.fallbackLabel)}</span>
          </button>
        ))}
      </div>
      <div className={`nutrition-input-bar${hidden ? ' nc-hidden' : ''}`}>
        <label className="nutrition-photo-btn" htmlFor="nutrition-photo-input" aria-label="Add photo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          <input
            type="file"
            id="nutrition-photo-input"
            accept="image/*"
            capture="environment"
            onChange={(event) => window.handleNutritionPhoto?.(event)}
            className="file-input-hidden"
          />
        </label>
      </div>
    </div>
  );
}

function NutritionIsland() {
  const snapshot = useIslandSnapshot(
    [NUTRITION_EVENT, LANGUAGE_EVENT],
    getSnapshot
  );

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const container = document.getElementById('nutrition-messages');
      if (!container) return;
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'auto',
      });
    });
    return () => cancelAnimationFrame(id);
  }, [snapshot.values.scrollVersion]);

  return (
    <div id="nutrition-shell">
      <NutritionHeader menuOpen={snapshot.values.menuOpen} />
      <div className="nutrition-meta-stack" id="nutrition-meta-stack">
        <ContextBanner banner={snapshot.values.contextBanner} />
        <TodayCard card={snapshot.values.todayCard} />
      </div>
      <div className="nutrition-stage">
        <div
          className={`nutrition-messages nutrition-messages-${snapshot.values.messagesState}`}
          id="nutrition-messages"
        >
          <MessageList snapshot={snapshot} />
        </div>
        <LoadingRow loading={snapshot.values.loading} />
      </div>
      <Composer snapshot={snapshot} />
    </div>
  );
}

const mounted = mountIsland({
  mountId: 'nutrition-react-root',
  legacyShellId: 'nutrition-legacy-shell',
  mountedFlag: '__IRONFORGE_NUTRITION_ISLAND_MOUNTED__',
  eventName: NUTRITION_EVENT,
  Component: NutritionIsland,
});

if (mounted) {
  requestAnimationFrame(() => {
    const page = document.getElementById('page-nutrition');
    if (
      page?.classList.contains('active') &&
      typeof window.initNutritionPage === 'function'
    ) {
      window.initNutritionPage();
    }
  });
}
