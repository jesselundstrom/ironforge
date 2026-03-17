import { useEffect } from 'react';
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
  const snapshot = useIslandSnapshot([HISTORY_EVENT, LANGUAGE_EVENT], getSnapshot);
  const isStatsTab = snapshot.tab === 'stats';

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

mountIsland({
  mountId: 'history-react-root',
  legacyShellId: 'history-legacy-shell',
  mountedFlag: '__IRONFORGE_HISTORY_ISLAND_MOUNTED__',
  eventName: HISTORY_EVENT,
  Component: HistoryIsland,
});
