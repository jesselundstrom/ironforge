import { mountIsland, useIslandSnapshot } from '../island-runtime/index.jsx';

const HISTORY_EVENT =
  window.__IRONFORGE_HISTORY_ISLAND_EVENT__ || 'ironforge:history-updated';
const LANGUAGE_EVENT = 'ironforge:language-changed';

function getSnapshot() {
  if (typeof window.getHistoryReactSnapshot === 'function') {
    return window.getHistoryReactSnapshot();
  }
  return {
    tab: 'log',
    labels: { log: 'Workout Log', stats: 'Stats', sessions: 'sessions', session: 'session', delete: 'Delete', prBadge: 'NEW PR', volume: 'Volume', exercises: 'Exercises' },
    heatmap: { isOpen: false, weeks: 14, cells: [], weekNums: [], dayLabels: [], stats: { weekStreak: 0, perWeek: '0.0', totalVolume: 0 }, sportName: 'Sport', labels: {} },
    log: { empty: true, labels: { kicker: 'Activity', title: 'No sessions yet', sub: '', cta: 'Start', currentPhase: '' }, phase: null },
    stats: { numbers: [], volume: { title: '', weeks: [], visible: false }, strength: { title: '', lifts: [], nWeeks: 16, visible: false } },
  };
}

/* ── Heatmap ───────────────────────────────────────────────── */

function Heatmap({ data }) {
  const { cells, weekNums, dayLabels, stats, sportName, labels, isOpen } = data;

  const cellClass = (c) => {
    let cls = 'heatmap-cell';
    if (c.isFuture) cls += ' future';
    else if (c.lift && c.sport) cls += ' both';
    else if (c.lift) cls += ' lift';
    else if (c.sport) cls += ' sport';
    if (c.isToday) cls += ' today';
    return cls;
  };

  const volStr = (stats.totalVolume / 1000).toFixed(1);

  const streakNode = stats.weekStreak > 0
    ? <span className="heatmap-stat"><span className="heatmap-stat-val">{stats.weekStreak}vk</span> putki</span>
    : <span className="heatmap-stat heatmap-stat-muted">{labels.noStreak}</span>;

  return (
    <div className={`heatmap-wrap${isOpen ? ' open' : ''}`}>
      <div className="heatmap-title-row" onClick={() => window.toggleHeatmap?.()}>
        <span className="heatmap-title">
          {labels.title} <span className="heatmap-toggle-chevron">{'\u25BC'}</span>
        </span>
        <div className="heatmap-inline-stats">
          {streakNode}
          <span className="heatmap-stat"><span className="heatmap-stat-val">{stats.perWeek}</span> {labels.liftsPerWeek}</span>
          <span className="heatmap-stat"><span className="heatmap-stat-val">{volStr}t</span> {labels.totalVolumeLabel}</span>
        </div>
        <div className="heatmap-legend">
          <div className="heatmap-legend-item"><div className="heatmap-legend-dot heatmap-legend-dot-lift" />{labels.lift}</div>
          <div className="heatmap-legend-item"><div className="heatmap-legend-dot heatmap-legend-dot-sport" />{sportName}</div>
        </div>
      </div>
      <div className="heatmap-collapsible"><div className="heatmap-collapsible-inner">
        <div className="heatmap-board">
          <div />
          <div className="heatmap-week-labels">
            {weekNums.map((n, i) => <div key={i} className="heatmap-week-label">{n}</div>)}
          </div>
          <div className="heatmap-day-labels">
            {dayLabels.map((l, i) => <div key={i} className="heatmap-day-label">{l}</div>)}
          </div>
          <div className="heatmap-grid heatmap-grid-cells">
            {cells.map((c) => <div key={c.key} className={cellClass(c)} />)}
          </div>
        </div>
        <div className="heatmap-foot">
          <div className="heatmap-stats">
            {streakNode}
            <span className="heatmap-stat"><span className="heatmap-stat-val">{stats.perWeek}</span> {labels.liftsPerWeek}</span>
            <span className="heatmap-stat"><span className="heatmap-stat-val">{volStr}t</span> {labels.totalVolumeLabel}</span>
          </div>
        </div>
      </div></div>
    </div>
  );
}

/* ── Workout Card ──────────────────────────────────────────── */

function WorkoutCard({ card, labels, style }) {
  if (card.isSport) {
    return (
      <div className="hist-card hist-sport-card" data-wid={card.id} style={style}>
        <div className="hist-card-header">
          <div className="hist-card-left">
            <span className="hist-lift-icon hist-icon-sport">{card.iconLabel}</span>
            <div>
              <div className="hist-card-title">{card.title}</div>
              <div className="hist-card-date">{card.date}</div>
              {card.duration > 0 && <div className="hist-sport-duration">{card.duration} min</div>}
            </div>
          </div>
          <button
            className="hist-delete-btn"
            type="button"
            onClick={() => window.deleteWorkout?.(card.id)}
            title={card.title}
            aria-label={card.title}
          >{labels.delete}</button>
        </div>
      </div>
    );
  }

  const volStr = card.tonnage > 0 ? (card.tonnage / 1000).toFixed(1) + 't' : '0t';

  return (
    <div className="hist-card" data-wid={card.id} style={style}>
      <div className="hist-card-header">
        <div className="hist-card-left">
          <span className="hist-lift-icon">{card.liftIcon}</span>
          <div className="hist-card-copy">
            <div className="hist-card-title">
              {card.title}
              {card.isPR && <span className="hist-pr-badge">{labels.prBadge}</span>}
              {card.recoveryStyle && (
                <span
                  className="hist-recovery-tag"
                  style={{ background: card.recoveryStyle.bg, color: card.recoveryStyle.color, borderColor: card.recoveryStyle.border }}
                >{card.recovery}%</span>
              )}
              {card.duration > 0 && <span className="hist-meta-tag">{card.duration}min</span>}
            </div>
            <div className="hist-card-date">{card.sub}</div>
          </div>
        </div>
        <button
          className="hist-delete-btn"
          type="button"
          onClick={() => window.deleteWorkout?.(card.id)}
          title={card.deleteTitle}
          aria-label={card.deleteTitle}
        >{labels.delete}</button>
      </div>
      {card.exercises.length > 0 && (
        <div className="hist-exercises">
          {card.exercises.map((ex, i) => (
            <div key={i} className="hist-exercise-row">
              <span>{ex.name}</span>
              <span className="hist-exercise-vol">
                {ex.setCount}{'\u00D7'}{ex.maxKg > 0 ? ex.maxKg + 'kg' : 'bw'}
                {ex.amrapReps && <span className="hist-amrap-reps"> - {ex.amrapReps}+ reps</span>}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="hist-card-footer">
        <span className="hist-footer-stat">{labels.volume} <span className="hist-footer-val">{volStr}</span></span>
        <span className="hist-footer-stat">{labels.exercises} <span className="hist-footer-val">{card.exerciseCount}</span></span>
        <span className="hist-footer-stat">RPE <span className="hist-footer-val">{card.rpe || '\u2014'}</span></span>
      </div>
    </div>
  );
}

/* ── Week Group ────────────────────────────────────────────── */

function WeekGroup({ week, labels, isFirst }) {
  if (!week.weekLabel) {
    return week.cards.map((card, i) => (
      <WorkoutCard key={card.id} card={card} labels={labels} style={{ '--i': Math.min(i, 10) }} />
    ));
  }

  const countLabel = week.count !== 1 ? labels.sessions : labels.session;

  return (
    <details className="hist-week-details" open={isFirst || undefined}>
      <summary className="hist-week-toggle">
        <div className="hist-week-toggle-left">
          <span className="hist-week-chevron">v</span>
          <span className="hist-week-label">{week.weekLabel}</span>
        </div>
        <span className="hist-week-count">{week.count} {countLabel}</span>
      </summary>
      <div className="hist-week-body">
        {week.cards.map((card, i) => (
          <WorkoutCard key={card.id} card={card} labels={labels} style={{ '--i': Math.min(i, 10) }} />
        ))}
      </div>
    </details>
  );
}

/* ── Cycle Group ───────────────────────────────────────────── */

function CycleGroup({ group, labels }) {
  const countLabel = group.total !== 1 ? labels.sessions : labels.session;

  return (
    <div className="hist-cycle-group">
      <div className="hist-cycle-header">
        <span className="hist-cycle-icon">{group.groupIcon}</span>
        <div>
          <div className="hist-cycle-label">{group.groupLabel}</div>
          <div className="hist-cycle-sub">{group.total} {countLabel}</div>
        </div>
      </div>
      {group.weeks.map((wk, i) => (
        <WeekGroup key={wk.weekKey} week={wk} labels={labels} isFirst={i === 0} />
      ))}
    </div>
  );
}

/* ── Empty State ───────────────────────────────────────────── */

function EmptyState({ log }) {
  const { labels, phase } = log;

  return (
    <div className="hist-empty">
      <div className="hist-empty-kicker">{labels.kicker}</div>
      <div className="hist-empty-orb"><div className="hist-empty-icon">LOG</div></div>
      <div className="hist-empty-title">{labels.title}</div>
      <div className="hist-empty-sub">{labels.sub}</div>
      <button
        className="btn btn-primary hist-empty-cta"
        type="button"
        onClick={() => window.showPage?.('log', document.querySelectorAll('.nav-btn')[1])}
      >{labels.cta}</button>
      {phase && (
        <div className="hist-phase-card">
          <div className="hist-phase-card-label">{labels.currentPhase}</div>
          <div className="hist-phase-card-name">{phase.name}</div>
          {phase.desc && <div className="hist-phase-card-desc">{phase.desc}</div>}
        </div>
      )}
    </div>
  );
}

/* ── Stats: Numbers Grid ───────────────────────────────────── */

function StatsNumbers({ numbers }) {
  return numbers.map((n, i) => (
    <div key={i} className="stats-num-card" style={{ '--c': n.color }}>
      <div className="stats-num-label">{n.label}</div>
      <div className="stats-num-val">{n.value}</div>
    </div>
  ));
}

/* ── Stats: Volume Chart ───────────────────────────────────── */

function VolumeChart({ data }) {
  if (!data.visible) return null;
  const { weeks, title } = data;
  const W = 300, H = 90, padX = 4, bottomH = 18, topPad = 12;
  const chartH = H - bottomH - topPad;
  const n = weeks.length;
  const gap = 2;
  const barW = Math.floor((W - padX * 2 - (n - 1) * gap) / n);
  const maxVol = Math.max(...weeks.map(w => w.vol), 1);
  const maxLabel = maxVol >= 1000 ? (maxVol / 1000).toFixed(0) + 't' : Math.round(maxVol) + 'kg';

  return (
    <>
      <div className="stats-chart-title">{title}</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="stats-svg">
        <text x={W - padX} y="9" textAnchor="end" className="stats-axis-top">{maxLabel}</text>
        {weeks.map((wk, i) => {
          const x = padX + i * (barW + gap);
          const h = Math.max(2, Math.round((wk.vol / maxVol) * chartH));
          const y = topPad + chartH - h;
          const op = (wk.vol > 0 ? (0.3 + 0.7 * (i / (n - 1))) : 0.1).toFixed(2);
          const fill = wk.isCurrent ? 'var(--orange)' : '#c46a10';
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={h} rx="2" fill={fill} style={{ '--bar-op': op }} className={`stats-bar stats-bar-${i}`} />
              <text x={x + barW / 2} y={H - 2} textAnchor="middle" className="stats-wlabel">{wk.label}</text>
            </g>
          );
        })}
      </svg>
    </>
  );
}

/* ── Stats: Strength Chart ─────────────────────────────────── */

function StrengthChart({ data }) {
  if (!data.visible) return null;
  const { lifts, nWeeks, title } = data;
  const active = lifts.filter(l => l.pts.length >= 1);
  if (!active.length) return null;

  const W = 300, H = 160, padX = 10, padY = 10;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today); cutoff.setDate(today.getDate() - nWeeks * 7);
  const xRange = today.getTime() - cutoff.getTime() || 1;
  const allW = active.flatMap(l => l.pts.map(p => p.weight));
  const minW = Math.min(...allW) * 0.96, maxW = Math.max(...allW) * 1.02;
  const wRange = maxW - minW || 1;
  const chartW = W - padX * 2, chartH = H - padY * 2;
  const tx = (d) => padX + Math.round(((new Date(d).getTime() - cutoff.getTime()) / xRange) * chartW);
  const ty = (w) => padY + Math.round((1 - (w - minW) / wRange) * chartH);

  const rawStep = wRange / 6;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep || 1)));
  const res = rawStep / mag;
  const step = mag * (res <= 1.5 ? 1 : res <= 3 ? 2 : res <= 7 ? 5 : 10);
  const gridStart = Math.ceil(minW / step) * step;
  const gridLines = [];
  for (let kg = gridStart; kg <= maxW; kg += step) gridLines.push(kg);

  const activeLegend = lifts.filter(l => l.pts.length > 0);

  return (
    <>
      <div className="stats-chart-title">{title}</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="stats-svg">
        {gridLines.map((kg, i) => {
          const y = ty(kg);
          return (
            <g key={i}>
              <line x1={padX} y1={y} x2={W - padX} y2={y} stroke="var(--border)" strokeWidth="0.5" strokeDasharray="2 4" />
              <text x={padX} y={y - 2} className="stats-axis-top">{Math.round(kg)} kg</text>
            </g>
          );
        })}
        {active.map((l, li) => {
          const dots = l.pts.map((p, pi) => (
            <circle key={pi} cx={tx(p.date)} cy={ty(p.weight)} r={l.pts.length === 1 ? 4 : 2.5} fill={l.color} />
          ));
          if (l.pts.length === 1) return <g key={li}>{dots}</g>;
          const pts = l.pts.map(p => `${tx(p.date)},${ty(p.weight)}`).join(' ');
          return (
            <g key={li}>
              <polyline points={pts} fill="none" stroke={l.color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" opacity="0.9" />
              {dots}
            </g>
          );
        })}
      </svg>
      <div className="stats-chart-legend">
        {activeLegend.map((l, i) => (
          <span key={i} className="stats-legend-item" style={{ color: l.color }}>
            <span className="stats-legend-dot" style={{ background: l.color }} />{l.label}
          </span>
        ))}
      </div>
    </>
  );
}

/* ── Main ──────────────────────────────────────────────────── */

function HistoryIsland() {
  const snapshot = useIslandSnapshot([HISTORY_EVENT, LANGUAGE_EVENT], getSnapshot);
  const isStatsTab = snapshot.tab === 'stats';

  return (
    <>
      <div id="history-heatmap">
        <Heatmap data={snapshot.heatmap} />
      </div>
      <div className="tabs" role="tablist" aria-label="History sections">
        <button
          className={`tab${!isStatsTab ? ' active' : ''}`}
          type="button"
          role="tab"
          aria-selected={!isStatsTab ? 'true' : 'false'}
          onClick={() => window.switchHistoryTab?.('log')}
        >
          {snapshot.labels.log}
        </button>
        <button
          className={`tab${isStatsTab ? ' active' : ''}`}
          type="button"
          role="tab"
          aria-selected={isStatsTab ? 'true' : 'false'}
          onClick={() => window.switchHistoryTab?.('stats')}
        >
          {snapshot.labels.stats}
        </button>
      </div>
      <div id="history-log" style={{ display: isStatsTab ? 'none' : 'block' }}>
        <div id="history-list">
          {snapshot.log.empty
            ? <EmptyState log={snapshot.log} />
            : snapshot.log.groups.map(g => <CycleGroup key={g.key} group={g} labels={snapshot.labels} />)
          }
        </div>
      </div>
      <div id="history-stats" style={{ display: isStatsTab ? 'block' : 'none' }}>
        <div className="stats-numbers-grid" id="stats-numbers-grid">
          <StatsNumbers numbers={snapshot.stats.numbers} />
        </div>
        <div
          className="card stats-chart-card"
          id="stats-volume-wrap"
          style={{ display: snapshot.stats.volume.visible ? 'block' : 'none' }}
        >
          <VolumeChart data={snapshot.stats.volume} />
        </div>
        <div
          className="card stats-chart-card"
          id="stats-strength-wrap"
          style={{ display: snapshot.stats.strength.visible ? 'block' : 'none' }}
        >
          <StrengthChart data={snapshot.stats.strength} />
        </div>
      </div>
    </>
  );
}

mountIsland({
  mountId: 'history-react-root',
  legacyShellId: 'history-legacy-shell',
  mountedFlag: '__IRONFORGE_HISTORY_ISLAND_MOUNTED__',
  eventName: HISTORY_EVENT,
  Component: HistoryIsland,
});
