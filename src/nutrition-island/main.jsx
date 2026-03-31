import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { t } from '../app/services/i18n.ts';
import { useNutritionStore } from '../stores/nutrition-store';
import {
  clearNutritionHistory,
  handleNutritionPhoto,
  openNutritionLogin,
  openNutritionSettings,
  retryLastNutritionMessage,
  selectNutritionAction,
  submitNutritionTextMessage,
} from '../app/services/nutrition-coach';

const initialSnapshot = {
  values: {
    canUseNutrition: false,
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
  return initialSnapshot;
}

function handleClear() {
  clearNutritionHistory();
}

function handleRetry() {
  retryLastNutritionMessage();
}

function handleActionSelect(actionId) {
  selectNutritionAction(actionId);
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

function NutritionHeader({ messagesState }) {
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
      {messagesState === 'thread' && (
        <button
          className="nutrition-clear-btn"
          type="button"
          onClick={handleClear}
          aria-label={t('nutrition.clear.btn', 'Clear conversation')}
        >
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
      )}
    </div>
  );
}

function ContextBanner({ banner }) {
  if (!banner) return null;
  return (
    <div className="nutrition-context-banner">
      {banner.kind === 'personalized' ? (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ) : (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
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
        <div className="nc-today-label">
          {t('nutrition.today.label', 'Today')}
        </div>
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
          <strong>{card.protein.value}g</strong>{' '}
          {t('nutrition.macro.protein', 'P')}
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
      <div className="card-title">
        {t('nutrition.setup.title', 'Setup Required')}
      </div>
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
          'Sign in to use Nutrition Coach. Claude requests are routed through Ironforge securely, and no Claude API key is stored on this device.'
        )}
      </div>
      <button
        className="btn btn-primary"
        type="button"
        onClick={() => openNutritionLogin()}
      >
        {t('nutrition.setup.sign_in', 'Sign in to continue')}
      </button>
      <div
        className="nutrition-setup-desc"
        style={{ marginTop: 12, fontSize: 12 }}
      >
        {t(
          'nutrition.setup.help',
          'Nutrition Coach is available to signed-in users only. Your daily history stays on this device.'
        )}
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
            <img
              className="nutrition-msg-photo-thumb"
              src={message.imageDataUrl}
              alt=""
            />
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
                <button
                  className="nutrition-retry-btn"
                  onClick={handleRetry}
                  type="button"
                >
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
    snapshot.values.showCorrectionInput ? (
      <CorrectionRow key="correction-row" />
    ) : null,
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

function NutritionTextSheet({
  open,
  onClose,
  onSend,
  title,
  placeholder,
  inputId,
  sendAriaLabel,
}) {
  const [text, setText] = useState('');
  const inputRef = useRef(null);
  const sheetRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const viewport = window.visualViewport;
    function reposition() {
      const sheet = sheetRef.current;
      if (!sheet || !viewport) return;
      const keyboardOffset =
        window.innerHeight - viewport.height - viewport.offsetTop;
      sheet.style.transform = `translateY(-${Math.max(0, keyboardOffset)}px)`;
    }

    if (viewport) {
      viewport.addEventListener('resize', reposition);
      viewport.addEventListener('scroll', reposition);
    }
    reposition();

    const raf = requestAnimationFrame(() => inputRef.current?.focus());

    return () => {
      if (viewport) {
        viewport.removeEventListener('resize', reposition);
        viewport.removeEventListener('scroll', reposition);
      }
      cancelAnimationFrame(raf);
    };
  }, [open]);

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend?.(trimmed);
    setText('');
    onClose?.();
  }

  function handleClose() {
    setText('');
    onClose?.();
  }

  if (!open) return null;

  return createPortal(
    <div className="nc-correction-overlay">
      <div className="nc-correction-backdrop" onClick={handleClose} />
      <div className="nc-correction-sheet" ref={sheetRef}>
        <div className="nc-correction-header">
          <div className="nc-correction-label">{title}</div>
          <button
            className="nc-correction-close"
            type="button"
            onClick={handleClose}
            aria-label={t('common.cancel', 'Cancel')}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="nc-correction-inputs">
          <textarea
            className="nc-correction-input"
            id={inputId}
            ref={inputRef}
            rows={2}
            placeholder={placeholder}
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
            aria-label={sendAriaLabel}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Correction trigger — renders a small button in the message list.
// Tapping it opens a bottom sheet portal that tracks the iOS visual viewport
// so the sheet stays above the software keyboard.
function CorrectionRow() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="nc-correction-trigger"
        type="button"
        onClick={() => setOpen(true)}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
        <span>
          {t('nutrition.correction.label', 'Correct the food analysis')}
        </span>
      </button>
      <NutritionTextSheet
        open={open}
        onClose={() => setOpen(false)}
        onSend={(trimmed) => submitNutritionTextMessage(trimmed, true)}
        title={t('nutrition.correction.label', 'Correct the food analysis')}
        placeholder={t(
          'nutrition.correction.placeholder',
          'e.g. That was 2 portions, not 1...'
        )}
        inputId="nutrition-text-input"
        sendAriaLabel={t(
          'nutrition.correction.send_aria',
          'Send correction'
        )}
      />
    </>
  );
}

const ACTION_ICONS = {
  plan_today: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="nc-action-icon"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="14" x2="16" y2="14" />
      <line x1="8" y1="18" x2="13" y2="18" />
    </svg>
  ),
  next_meal: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="nc-action-icon"
    >
      <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
      <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
      <line x1="6" y1="1" x2="6" y2="4" />
      <line x1="10" y1="1" x2="10" y2="4" />
      <line x1="14" y1="1" x2="14" y2="4" />
    </svg>
  ),
  review_today: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="nc-action-icon"
    >
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  ),
  photo: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="nc-action-icon"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  ),
  camera: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="nc-action-icon"
    >
      <path d="M4 8h3l2-2h6l2 2h3a1 1 0 0 1 1 1v9a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13" r="3.25" />
    </svg>
  ),
  library: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="nc-action-icon"
    >
      <rect x="3" y="4" width="14" height="14" rx="2" ry="2" />
      <path d="M7 13l2.5-2.5L13 14" />
      <circle cx="11" cy="9" r="1.2" />
      <path d="M17 8h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2v-2" />
    </svg>
  ),
  text: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="nc-action-icon"
    >
      <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 3v-3H6a2 2 0 0 1-2-2z" />
      <line x1="8" y1="9" x2="16" y2="9" />
      <line x1="8" y1="13" x2="13" y2="13" />
    </svg>
  ),
};

function Composer({ snapshot }) {
  const hidden = !snapshot.values.canUseNutrition;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [textEntryOpen, setTextEntryOpen] = useState(false);
  const cameraInputRef = useRef(null);
  const libraryInputRef = useRef(null);

  function openPicker() {
    setPickerOpen(true);
  }

  function closePicker() {
    setPickerOpen(false);
  }

  function triggerPhotoInput(inputRef) {
    inputRef.current?.click();
    setPickerOpen(false);
  }

  function openTextEntry() {
    setPickerOpen(false);
    setTextEntryOpen(true);
  }

  return (
    <div className={`nutrition-composer${hidden ? ' nc-hidden' : ''}`}>
      <button
        className="nc-photo-cta"
        type="button"
        onClick={openPicker}
        aria-haspopup="dialog"
        aria-expanded={pickerOpen}
      >
        {ACTION_ICONS.photo}
        <span>{t('nutrition.photo.cta', 'Snap your meal')}</span>
      </button>
      <input
        ref={cameraInputRef}
        type="file"
        id="nutrition-photo-camera-input"
        accept="image/*"
        capture="environment"
        onChange={(event) => handleNutritionPhoto(event)}
        className="file-input-hidden"
      />
      <input
        ref={libraryInputRef}
        type="file"
        id="nutrition-photo-library-input"
        accept="image/*"
        onChange={(event) => handleNutritionPhoto(event)}
        className="file-input-hidden"
      />
      <div className="nutrition-action-grid" id="nutrition-action-grid">
        {snapshot.values.actions.map((action) => (
          <button
            className="nutrition-prompt-chip nutrition-action-card"
            type="button"
            data-nc-action={action.id}
            key={action.id}
            onClick={() => handleActionSelect(action.id)}
          >
            {ACTION_ICONS[action.id] || null}
            <span>{t(action.labelKey, action.fallbackLabel)}</span>
          </button>
        ))}
      </div>
      {pickerOpen
        ? createPortal(
            <div className="nc-photo-picker-overlay">
              <div className="nc-photo-picker-backdrop" onClick={closePicker} />
              <div className="nc-photo-picker-sheet">
                <div className="nc-photo-picker-header">
                  <div className="nc-photo-picker-label">
                    {t('nutrition.photo.menu.title', 'Add your meal')}
                  </div>
                  <button
                    className="nc-photo-picker-close"
                    type="button"
                    onClick={closePicker}
                    aria-label={t('common.cancel', 'Cancel')}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
                <div className="nc-photo-picker-options">
                  <button
                    className="nc-photo-picker-option"
                    type="button"
                    onClick={() => triggerPhotoInput(cameraInputRef)}
                  >
                    {ACTION_ICONS.camera}
                    <span>
                      {t('nutrition.photo.menu.camera', 'Picture food')}
                    </span>
                  </button>
                  <button
                    className="nc-photo-picker-option"
                    type="button"
                    onClick={() => triggerPhotoInput(libraryInputRef)}
                  >
                    {ACTION_ICONS.library}
                    <span>
                      {t(
                        'nutrition.photo.menu.library',
                        'Use photo from library'
                      )}
                    </span>
                  </button>
                  <button
                    className="nc-photo-picker-option"
                    type="button"
                    onClick={openTextEntry}
                  >
                    {ACTION_ICONS.text}
                    <span>{t('nutrition.food_entry.label', 'Type the food')}</span>
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
      <NutritionTextSheet
        open={textEntryOpen}
        onClose={() => setTextEntryOpen(false)}
        onSend={(trimmed) => submitNutritionTextMessage(trimmed)}
        title={t('nutrition.food_entry.label', 'Type the food')}
        placeholder={t(
          'nutrition.food_entry.placeholder',
          'e.g. Chicken rice bowl with a yogurt on the side'
        )}
        inputId="nutrition-food-text-input"
        sendAriaLabel={t('nutrition.food_entry.send_aria', 'Send meal')}
      />
    </div>
  );
}

function NutritionIsland() {
  const snapshot = useNutritionStore((state) => state.view) || getSnapshot();

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
      <NutritionHeader messagesState={snapshot.values.messagesState} />
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

export { NutritionIsland };
