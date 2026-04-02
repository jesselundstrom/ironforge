import { createElement, useEffect, useState } from 'react';
import { useDashboardStore } from '../stores/dashboard-store';
import {
  animateDashboardPlanMuscleBars,
  toggleDayDetail,
} from '../app/services/dashboard-actions.ts';
import { navigateToPage } from '../app/services/navigation-actions';

const svgCache = new Map();

function getSnapshot() {
  return {
    labels: {
      todayPlan: "Today's Plan",
      weeklySessions: 'Weekly Sessions',
      recovery: 'Recovery',
      maxes: 'Maxes',
    },
    hero: {
      kicker: "Today's Plan",
      status: { text: '', tone: 'neutral' },
      cta: { type: 'none' },
    },
    week: {
      days: [],
      legend: [],
      activeDayIndex: null,
      detailVisible: false,
      detail: { items: [] },
      status: { text: '', tone: 'neutral' },
    },
    plan: {
      headerSub: '',
      progress: {
        percent: 0,
        value: '',
        footer: '',
        sportFooter: '',
      },
      sections: [],
    },
    recovery: {
      overallValue: 0,
      badge: { text: '', tone: 'rest' },
      rows: [],
    },
    trainingMaxesTitle: 'Maxes',
    trainingMaxes: [],
  };
}

function toCamelCase(value) {
  return value.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

function mapSvgAttribute(name) {
  if (name === 'class') return 'className';
  if (name === 'stroke-width') return 'strokeWidth';
  if (name === 'stroke-linecap') return 'strokeLinecap';
  if (name === 'stroke-linejoin') return 'strokeLinejoin';
  if (name === 'text-anchor') return 'textAnchor';
  if (name === 'fill-rule') return 'fillRule';
  if (name === 'clip-rule') return 'clipRule';
  if (name.startsWith('data-') || name.startsWith('aria-')) return name;
  return toCamelCase(name);
}

function parseTmValue(rawValue) {
  const raw = String(rawValue || '').trim();
  const match = raw.match(/^([0-9]+(?:[.,][0-9]+)?)(.*)$/);
  if (!match) return { main: raw, unit: '' };
  return {
    main: match[1],
    unit: (match[2] || '').trim(),
  };
}

function padTmChars(chars, length) {
  const safe = Array.isArray(chars) ? chars : [];
  if (safe.length >= length) return safe;
  return Array.from({ length: length - safe.length }, () => ' ').concat(safe);
}

function convertSvgNode(node, key) {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent || '';
    return text.trim() ? text : null;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  const props = { key };
  Array.from(node.attributes).forEach((attr) => {
    props[mapSvgAttribute(attr.name)] = attr.value;
  });
  const children = Array.from(node.childNodes)
    .map((child, index) => convertSvgNode(child, `${key}-${index}`))
    .filter(Boolean);
  return createElement(node.tagName.toLowerCase(), props, ...children);
}

function getSvgElement(markup, cacheKey) {
  if (!markup) return null;
  if (svgCache.has(cacheKey)) return svgCache.get(cacheKey);
  const doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
  const svgNode = doc.documentElement;
  const element = convertSvgNode(svgNode, cacheKey);
  svgCache.set(cacheKey, element);
  return element;
}

function RichText({ text, className }) {
  const content = String(text || '');
  const parts = content.split(/(<strong>.*?<\/strong>)/gi).filter(Boolean);
  return (
    <span className={className}>
      {parts.map((part, index) => {
        const match = part.match(/^<strong>(.*)<\/strong>$/i);
        if (match) return <strong key={index}>{match[1]}</strong>;
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
}

function HeroCta({ cta }) {
  if (!cta || cta.type === 'none') return null;
  if (cta.type === 'badge') {
    return (
      <div className="dashboard-top-cta">
        <div className={`dashboard-card-head-badge is-${cta.tone || 'positive'}`}>
          {cta.label}
        </div>
      </div>
    );
  }
  return (
    <div className="dashboard-top-cta">
      <button
        className="btn btn-primary cta-btn"
        type="button"
        onClick={() => window[cta.action || 'goToLog']?.()}
      >
        {cta.label}
      </button>
    </div>
  );
}

function WeekStrip({ week }) {
  return (
    <div className="week-strip" id="week-strip">
      {week.days.map((day) => (
        <button
          key={day.key}
          className={`day-pill ${day.variant}${day.isActive ? ' active' : ''}`}
          type="button"
          title={day.tooltip}
          aria-label={day.tooltip}
          onClick={() => toggleDayDetail(day.index)}
        >
          <div className="day-label">{day.label}</div>
          <div className="day-num">{day.dayNumber}</div>
          <div className="day-markers">
            {day.isLogged ? (
              <span className="day-marker is-lift" aria-hidden="true" />
            ) : day.isSportDay ? (
              <span className="day-marker is-scheduled" aria-hidden="true" />
            ) : (
              <span className="day-marker-placeholder" aria-hidden="true" />
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

function WeekLegend({ items }) {
  return (
    <div className="dashboard-week-legend" id="dashboard-week-legend">
      {items.map((item) => (
        <div key={item.id} className="dashboard-week-legend-item">
          <span
            className={`dashboard-week-legend-dot is-${item.tone}`}
            aria-hidden="true"
          />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function DayDetailPanel({ week }) {
  return (
    <div
      id="day-detail-panel"
      style={{ display: week.detailVisible ? 'block' : 'none' }}
      data-active={week.detailVisible ? String(week.activeDayIndex) : ''}
    >
      {week.detail.items.map((item, index) => (
        <div
          key={`${item.kind}-${index}`}
          className={`day-detail-item${
            item.kind === 'sport'
              ? ' day-detail-item-sport'
              : item.kind === 'muted'
                ? ' day-detail-item-muted'
                : ''
          }`}
        >
          {item.text}
        </div>
      ))}
    </div>
  );
}

function SessionProgress({ progress }) {
  return (
    <div id="session-progress" className="dashboard-session-progress" aria-live="polite">
      <div className="dashboard-session-progress-card">
        <div
          className="dashboard-session-progress-ring"
          style={{ '--progress-angle': `${Math.round((progress.percent / 100) * 360)}deg` }}
          aria-hidden="true"
        >
          <div className="dashboard-session-progress-ring-inner">
            {progress.percent}%
          </div>
        </div>
        <div className="dashboard-session-progress-copy">
          <div className="dashboard-session-progress-value">{progress.value}</div>
          <div className="dashboard-session-progress-foot">{progress.footer}</div>
          {progress.sportFooter ? (
            <div className="dashboard-session-progress-foot is-secondary">
              {progress.sportFooter}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CoachSection({ section }) {
  return (
    <section className="dashboard-plan-section dashboard-plan-section-coach">
      <article className="dashboard-plan-card dashboard-plan-coach-card">
        <div className="dashboard-plan-card-head dashboard-plan-card-head-coach">
          <span
            className={`dashboard-plan-head-dot${section.positive ? ' is-positive' : ''}${
              section.restDayTip ? ' is-rest' : ''
            }`}
            aria-hidden="true"
          />
          {section.head}
        </div>
        <div
          className={`dashboard-plan-coach-copy${section.positive ? ' is-positive' : ''}${
            section.restDayTip ? ' is-rest-tip' : ''
          }`}
        >
          <RichText text={section.copy} />
        </div>
        {section.reasonLabels?.length ? (
          <div className="dashboard-plan-coach-reasons">
            {section.reasonLabels.map((label) => (
              <div key={label} className="dashboard-plan-coach-chip">
                {label}
              </div>
            ))}
          </div>
        ) : null}
        {section.completion ? (
          <div className="dashboard-plan-completion">
            <div className={`dashboard-plan-status dashboard-plan-status-${section.completion.tone}`}>
              <div className="dashboard-plan-status-title">{section.completion.title}</div>
              <div className="dashboard-plan-status-body">{section.completion.body}</div>
            </div>
          </div>
        ) : null}
      </article>
    </section>
  );
}

function AdherenceGauge({ value, tone }) {
  const pct = Math.max(0, Math.min(100, parseInt(value, 10) || 0));
  const radius = 40;
  const stroke = 5;
  const center = 48;
  const startAngle = 135;
  const sweepRange = 270;
  const circumference = (sweepRange / 360) * 2 * Math.PI * radius;
  const filled = (pct / 100) * circumference;

  const toneColors = {
    positive: { stroke: '#4caf79', glow: 'rgba(76,175,121,0.35)' },
    caution: { stroke: '#f59e0b', glow: 'rgba(245,158,11,0.35)' },
    neutral: { stroke: '#4a8fe8', glow: 'rgba(74,143,232,0.3)' },
  };
  const colors = toneColors[tone] || toneColors.neutral;

  const polarToCartesian = (cx, cy, r, deg) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };
  const describeArc = (cx, cy, r, start, end) => {
    const s = polarToCartesian(cx, cy, r, start);
    const e = polarToCartesian(cx, cy, r, end);
    const large = end - start > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
  };
  const trackPath = describeArc(center, center, radius, startAngle, startAngle + sweepRange);

  return (
    <div className="stats-gauge">
      <svg viewBox="0 0 96 96" className="stats-gauge-svg" aria-hidden="true">
        <defs>
          <filter id="gauge-glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path
          d={trackPath}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        <path
          d={trackPath}
          fill="none"
          stroke={colors.stroke}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={circumference - filled}
          filter="url(#gauge-glow)"
          className="stats-gauge-fill"
        />
      </svg>
      <div className="stats-gauge-value">{value}</div>
    </div>
  );
}

function StatsSection({ section }) {
  return (
    <section className="dashboard-plan-section dashboard-plan-section-stats">
      <div className="dashboard-plan-section-label">{section.label}</div>
      <article className="dashboard-plan-card dashboard-plan-stats-card">
        <div className="dashboard-plan-card-head dashboard-plan-card-head-stats">
          {section.head}
        </div>
        <div className={`stats-hero is-${section.primaryMetric.tone}`}>
          <AdherenceGauge
            value={section.primaryMetric.value}
            tone={section.primaryMetric.tone}
          />
          <div className="stats-hero-copy">
            <div className="stats-hero-label">{section.primaryMetric.label}</div>
            <RichText className="stats-hero-sublabel" text={section.primaryMetric.sublabel} />
          </div>
        </div>
        <div className={`dashboard-plan-summary dashboard-plan-summary-${section.summary.tone}`}>
          <div className="dashboard-plan-summary-title">{section.summary.title}</div>
          <div className="dashboard-plan-summary-body">{section.summary.body}</div>
        </div>
        {section.supportingMetrics?.length ? (
          <div className="dashboard-plan-supporting-grid">
            {section.supportingMetrics.map((metric, index) => (
              <div
                key={`${metric.label}-${index}`}
                className={`dashboard-plan-support-chip is-${metric.tone}`}
              >
                <span className="dashboard-plan-support-chip-value">{metric.value}</span>
                <span className="dashboard-plan-support-chip-label">{metric.label}</span>
              </div>
            ))}
          </div>
        ) : null}
        {section.insights?.length ? (
          <div className="dashboard-plan-insight-list">
            {section.insights.map((item, index) => (
              <div
                key={`${item.tone}-${index}`}
                className={`dashboard-plan-insight-row is-${item.tone}${
                  index === section.insights.length - 1 ? ' is-last' : ''
                }`}
              >
                <RichText className="dashboard-plan-insight-text" text={item.text} />
              </div>
            ))}
          </div>
        ) : null}
      </article>
    </section>
  );
}

function MuscleSection({ section }) {
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    window.requestAnimationFrame(() => animateDashboardPlanMuscleBars());
  }, [section, flipped]);

  const data = section.body;
  const frontSvg = getSvgElement(data.svg.front, 'muscle-front');
  const backSvg = getSvgElement(data.svg.back, 'muscle-back');

  return (
    <section className="dashboard-plan-section dashboard-plan-section-muscle">
      <div className="dashboard-plan-section-label">{section.label}</div>
      <article className="dashboard-plan-card dashboard-plan-muscle-card">
        <div className="dashboard-plan-card-head">{section.head}</div>
        {data.empty ? (
          <div className="muscle-body-empty">{data.emptyText}</div>
        ) : (
          <div
            className={`muscle-body-wrapper${flipped ? ' is-flipped' : ''}`}
            {...Object.fromEntries(
              Object.entries(data.loads).map(([group, level]) => [
                `data-muscle-${group}`,
                level,
              ])
            )}
          >
            <div className="muscle-body-flip-container">
              <div className="muscle-body-flipper">
                <div className="muscle-body-face muscle-body-front">{frontSvg}</div>
                <div className="muscle-body-face muscle-body-back">{backSvg}</div>
              </div>
            </div>
            <button
              className="muscle-body-flip-btn"
              type="button"
              aria-label={data.flipLabel}
              onClick={() => setFlipped((value) => !value)}
            >
              <span className="muscle-body-flip-label muscle-body-flip-label-front">
                {data.frontLabel}
              </span>
              <span className="muscle-body-flip-label muscle-body-flip-label-back">
                {data.backLabel}
              </span>
            </button>
            <div className="muscle-body-legend">
              {data.legend.map((item) => (
                <div key={item.group} className={`muscle-body-legend-item is-${item.level}`}>
                  <span className="muscle-body-legend-dot" />
                  <span className="muscle-body-legend-name">{item.name}</span>
                  <span className="muscle-body-legend-level">{item.levelText}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </article>
    </section>
  );
}

function PlanCard({ plan }) {
  const coach = plan.sections.find((section) => section.id === 'coach');
  const stats = plan.sections.find((section) => section.id === 'stats');
  const muscle = plan.sections.find((section) => section.id === 'muscle');

  return (
    <div className="dashboard-plan-stack" id="next-session-content">
      {coach ? <CoachSection section={coach} /> : null}
      {stats ? <StatsSection section={stats} /> : null}
      {muscle ? <MuscleSection section={muscle} /> : null}
    </div>
  );
}

function RecoveryCard({ recovery }) {
  return (
    <div className="card dashboard-card dashboard-recovery-card">
      <div className="dashboard-card-body">
        <div className="dashboard-recovery-summary">
          <div>
            <div className="dashboard-recovery-summary-label">
              {recovery.overallLabel}
            </div>
            <div className="dashboard-recovery-summary-badge" id="recovery-badge">
              <span className={`readiness-status rbadge-${recovery.badge.tone}`}>
                <span className="readiness-status-dot" aria-hidden="true" />
                <span className="readiness-status-text">{recovery.badge.text}</span>
              </span>
            </div>
          </div>
          <div className="dashboard-recovery-summary-value" id="recovery-overall-value">
            {recovery.overallValue}%
          </div>
        </div>
        {recovery.simpleSummary ? (
          <div className="dashboard-recovery-simple-summary">
            {recovery.simpleSummary}
          </div>
        ) : null}
        {recovery.rows.length > 0
          ? recovery.rows.map((row) => (
              <div key={row.id} className="fatigue-row">
                <div className="fatigue-label">{row.label}</div>
                <div className="fatigue-bar-wrap">
                  <div
                    className="fatigue-fill"
                    id={`f-${row.id}`}
                    style={{
                      width: `${row.value}%`,
                      '--bar-start': row.gradient.start,
                      '--bar-mid': row.gradient.mid,
                      '--bar-end': row.gradient.end,
                      '--bar-glow': row.gradient.glow,
                    }}
                  />
                </div>
                <div className="fatigue-value" id={`f-${row.id}-val`}>
                  {row.value}%
                </div>
              </div>
            ))
          : null}
      </div>
    </div>
  );
}

function TrainingMaxDigits({ currentValue, previousValue, animate }) {
  const currentChars = String(currentValue || '').split('');
  const previousChars = String(previousValue ?? currentValue ?? '').split('');
  const width = Math.max(currentChars.length, previousChars.length);
  const nextChars = padTmChars(currentChars, width);
  const prevChars = padTmChars(previousChars, width);

  return nextChars.map((char, index) => {
    if (char === ' ') {
      return (
        <span
          key={`spacer-${index}`}
          className="tm-digit-slot is-spacer"
          aria-hidden="true"
        />
      );
    }
    const oldChar = prevChars[index] || ' ';
    const fromRight = nextChars.length - 1 - index;
    const digitDelay = `${fromRight * 80}ms`;
    if (/[0-9]/.test(char) && animate) {
      const startChar = /[0-9]/.test(oldChar) ? oldChar : '0';
      const changed = startChar !== char;
      return (
        <span
          key={`digit-${index}`}
          className={`tm-digit-slot${changed ? ' is-changing' : ''}`}
          style={{ '--digit-delay': digitDelay }}
        >
          <span className={`tm-digit-stack${changed ? ' is-changing' : ''}`}>
            <span className="tm-digit-face is-old">{startChar}</span>
            <span className="tm-digit-face is-new">{char}</span>
          </span>
        </span>
      );
    }
    return (
      <span
        key={`char-${index}`}
        className={/[0-9]/.test(char) ? 'tm-digit-slot' : 'tm-digit-slot tm-digit-sep'}
        style={{ '--digit-delay': digitDelay }}
      >
        <span className="tm-digit-face is-static">{char}</span>
      </span>
    );
  });
}

function NutritionStatus({ nutrition }) {
  if (!nutrition) return null;

  if (nutrition.state === 'empty') {
    return (
      <div className="card dashboard-card dashboard-nutrition-card">
        <div className="dashboard-card-body dashboard-nutrition-body">
          <div className="dashboard-nutrition-empty">
            <span className="dashboard-nutrition-empty-text">{nutrition.labels.empty}</span>
            <button
              className="dashboard-nutrition-log-btn"
              type="button"
              onClick={() => navigateToPage('nutrition')}
            >
              {nutrition.labels.logMeal}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card dashboard-card dashboard-nutrition-card">
      <div className="dashboard-card-body dashboard-nutrition-body">
        <div className="dashboard-nutrition-row">
          <div className="dashboard-nutrition-label">{nutrition.labels.calories}</div>
          <div className="dashboard-nutrition-bar-wrap">
            <div
              className="dashboard-nutrition-bar is-cal"
              style={{ width: `${nutrition.calories.percent}%` }}
            />
          </div>
          <div className="dashboard-nutrition-nums">
            <span className="dashboard-nutrition-current">{nutrition.calories.value}</span>
            <span className="dashboard-nutrition-sep">/</span>
            <span className="dashboard-nutrition-target">{nutrition.calories.target}</span>
            <span className="dashboard-nutrition-unit">{nutrition.labels.kcal}</span>
          </div>
        </div>
        <div className="dashboard-nutrition-row">
          <div className="dashboard-nutrition-label">{nutrition.labels.protein}</div>
          <div className="dashboard-nutrition-bar-wrap">
            <div
              className="dashboard-nutrition-bar is-protein"
              style={{ width: `${nutrition.protein.percent}%` }}
            />
          </div>
          <div className="dashboard-nutrition-nums">
            <span className="dashboard-nutrition-current">{nutrition.protein.value}</span>
            <span className="dashboard-nutrition-sep">/</span>
            <span className="dashboard-nutrition-target">{nutrition.protein.target}</span>
            <span className="dashboard-nutrition-unit">{nutrition.labels.gram}</span>
          </div>
        </div>
        <div className="dashboard-nutrition-foot">{nutrition.labels.meals}</div>
      </div>
    </div>
  );
}

function TrainingMaxes({ title, items }) {
  return (
    <>
      <div className="dashboard-section-label" id="tm-section-title">
        {title}
      </div>
      <div className="card dashboard-card dashboard-maxes-card">
        <div className="dashboard-card-body">
          <div className="lifts-grid" id="tm-grid">
            {items.map((item) => (
              <div
                key={item.id}
                className={`lift-stat${item.changed ? ' tm-updated' : ''}${
                  item.improved ? ' tm-updated-up' : ''
                }`}
                style={{ '--tm-delay': `${item.index * 65}ms` }}
              >
                <div className={`value${item.changed ? ' is-animating' : ''}`}>
                  <TrainingMaxDigits
                    currentValue={item.main}
                    previousValue={parseTmValue(item.previousValue || item.value).main}
                    animate={item.changed}
                  />
                  {item.unit ? <span className="unit">{item.unit}</span> : null}
                </div>
                <div className="label">
                  {item.label}
                  {item.stalled ? <span className="tm-stalled-badge">STALL</span> : null}
                </div>
                {item.delta ? <div className="tm-delta-badge">{item.delta}</div> : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function DashboardIsland() {
  const snapshot = useDashboardStore((state) => state.view) || getSnapshot();

  useEffect(() => {
    window.requestAnimationFrame(() => animateDashboardPlanMuscleBars());
    const headerSub = document.getElementById('header-sub');
    if (headerSub) headerSub.textContent = snapshot.plan.headerSub || '';
  }, [snapshot]);

  return (
    <>
      <div className="dashboard-hero dashboard-animate dashboard-delay-1">
        <div className={`card dashboard-card dashboard-hero-card is-${snapshot.hero.tone || 'rest'}`}>
          <div className="dashboard-card-body dashboard-hero-body">
            <div className="dashboard-hero-copy">
              <div className="dashboard-hero-kicker">{snapshot.hero.kicker}</div>
              <div className="dashboard-hero-status" id="today-status">
                <span className={`dashboard-status-line is-${snapshot.hero.status.tone}`}>
                  {snapshot.hero.status.text}
                </span>
              </div>
            </div>
            <div className="dashboard-hero-cta" id="dashboard-start-session-slot">
              <HeroCta cta={snapshot.hero.cta} />
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-section dashboard-week-section dashboard-animate dashboard-delay-2">
        <div className="dashboard-section-label">{snapshot.labels.weeklySessions}</div>
        <div className="card dashboard-card dashboard-calendar-card">
          <WeekStrip week={snapshot.week} />
          <WeekLegend items={snapshot.week.legend} />
          <DayDetailPanel week={snapshot.week} />
        </div>
        <SessionProgress progress={snapshot.plan.progress} />
      </div>

      <div className="dashboard-section dashboard-animate dashboard-delay-3">
        <div className="dashboard-section-label">{snapshot.labels.todayPlan}</div>
        <PlanCard plan={snapshot.plan} />
      </div>

      <div className="dashboard-section dashboard-section-recovery dashboard-animate dashboard-delay-4">
        <div className="dashboard-section-label">{snapshot.labels.recovery}</div>
        <RecoveryCard recovery={snapshot.recovery} />
      </div>

      {snapshot.nutrition ? (
        <div className="dashboard-section dashboard-section-nutrition dashboard-animate dashboard-delay-5">
          <div className="dashboard-section-label">{snapshot.nutrition.labels.title}</div>
          <NutritionStatus nutrition={snapshot.nutrition} />
        </div>
      ) : null}

      {!snapshot.simpleMode ? (
        <div className="dashboard-section dashboard-section-maxes dashboard-animate dashboard-delay-6">
          <TrainingMaxes
            title={snapshot.trainingMaxesTitle || snapshot.labels.maxes}
            items={snapshot.trainingMaxes}
          />
        </div>
      ) : null}
    </>
  );
}

export { DashboardIsland };
