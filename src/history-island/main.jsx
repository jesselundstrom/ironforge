import { startTransition, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

const HISTORY_EVENT =
  window.__IRONFORGE_HISTORY_ISLAND_EVENT__ || 'ironforge:history-updated';

function getSnapshot() {
  if (typeof window.getHistoryReactSnapshot === 'function') {
    return window.getHistoryReactSnapshot();
  }
  return {
    tab: 'log',
    labels: { log: 'Workout Log', stats: 'Stats' },
    heatmapHtml: '',
    logHtml: '',
    stats: {
      numbersHtml: '',
      volumeHtml: '',
      volumeVisible: false,
      strengthHtml: '',
      strengthVisible: false,
    },
  };
}

function HistoryIsland() {
  const [snapshot, setSnapshot] = useState(() => getSnapshot());
  const isStatsTab = snapshot.tab === 'stats';

  useEffect(() => {
    const handleChange = () => {
      startTransition(() => {
        setSnapshot(getSnapshot());
      });
    };
    window.addEventListener(HISTORY_EVENT, handleChange);
    return () => window.removeEventListener(HISTORY_EVENT, handleChange);
  }, []);

  useEffect(() => {
    document
      .querySelectorAll('#history-react-root .hist-card')
      .forEach((card, index) => {
        card.style.setProperty('--i', String(Math.min(index, 10)));
      });
  }, [snapshot.logHtml]);

  return (
    <>
      <div
        id="history-heatmap"
        dangerouslySetInnerHTML={{ __html: snapshot.heatmapHtml }}
      />
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
      <div
        id="history-log"
        style={{ display: isStatsTab ? 'none' : 'block' }}
      >
        <div
          id="history-list"
          dangerouslySetInnerHTML={{ __html: snapshot.logHtml }}
        />
      </div>
      <div
        id="history-stats"
        style={{ display: isStatsTab ? 'block' : 'none' }}
      >
        <div
          className="stats-numbers-grid"
          id="stats-numbers-grid"
          dangerouslySetInnerHTML={{ __html: snapshot.stats.numbersHtml }}
        />
        <div
          className="card stats-chart-card"
          id="stats-volume-wrap"
          style={{ display: snapshot.stats.volumeVisible ? 'block' : 'none' }}
          dangerouslySetInnerHTML={{ __html: snapshot.stats.volumeHtml }}
        />
        <div
          className="card stats-chart-card"
          id="stats-strength-wrap"
          style={{ display: snapshot.stats.strengthVisible ? 'block' : 'none' }}
          dangerouslySetInnerHTML={{ __html: snapshot.stats.strengthHtml }}
        />
      </div>
    </>
  );
}

const mountNode = document.getElementById('history-react-root');

if (mountNode) {
  document.getElementById('history-legacy-shell')?.remove();
  window.__IRONFORGE_HISTORY_ISLAND_MOUNTED__ = true;
  createRoot(mountNode).render(<HistoryIsland />);
  window.dispatchEvent(new CustomEvent(HISTORY_EVENT));
}
