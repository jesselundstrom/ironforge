import { useEffect } from 'react';
import { mountIsland, useIslandSnapshot } from '../island-runtime/index.jsx';

const DASHBOARD_EVENT =
  window.__IRONFORGE_DASHBOARD_ISLAND_EVENT__ || 'ironforge:dashboard-updated';
const LANGUAGE_EVENT = 'ironforge:language-changed';

function getSnapshot() {
  if (typeof window.getDashboardReactSnapshot === 'function') {
    return window.getDashboardReactSnapshot();
  }
  return {
    labels: {
      todayPlan: "Today's Plan",
      weeklySessions: 'Weekly Sessions',
      recovery: 'Recovery',
      maxes: 'Maxes',
    },
    week: {
      stripHtml: '',
      statusHtml: '',
      detailVisible: false,
      detailHtml: '',
    },
    tm: { title: 'Maxes', html: '' },
    plan: {
      headerSub: '',
      startSlotHtml: '',
      sessionProgressHtml: '',
      nextSessionHtml: '',
    },
    recoveryHtml: '',
  };
}

function DashboardIsland() {
  const snapshot = useIslandSnapshot([DASHBOARD_EVENT, LANGUAGE_EVENT], getSnapshot);

  useEffect(() => {
    if (typeof window.animateDashboardPlanMuscleBars === 'function') {
      window.requestAnimationFrame(() => window.animateDashboardPlanMuscleBars());
    }
  }, [snapshot]);

  return (
    <>
      <div className="dashboard-hero dashboard-animate dashboard-delay-1">
        <div className="card dashboard-card dashboard-hero-card">
          <div className="dashboard-card-body dashboard-hero-body">
            <div className="dashboard-hero-copy">
              <div className="dashboard-hero-kicker">{snapshot.labels.todayPlan}</div>
              <div
                className="dashboard-hero-status"
                id="today-status"
                dangerouslySetInnerHTML={{ __html: snapshot.week.statusHtml }}
              />
            </div>
            <div
              className="dashboard-hero-cta"
              id="dashboard-start-session-slot"
              dangerouslySetInnerHTML={{ __html: snapshot.plan.startSlotHtml }}
            />
          </div>
        </div>
      </div>

      <div className="dashboard-section dashboard-week-section dashboard-animate dashboard-delay-2">
        <div className="dashboard-section-label">{snapshot.labels.weeklySessions}</div>
        <div className="card dashboard-card dashboard-calendar-card">
          <div
            className="week-strip"
            id="week-strip"
            dangerouslySetInnerHTML={{ __html: snapshot.week.stripHtml }}
          />
          <div
            className="dashboard-week-legend"
            id="dashboard-week-legend"
            dangerouslySetInnerHTML={{ __html: window.buildDashboardWeekLegendMarkup?.() || '' }}
          />
          <div
            id="day-detail-panel"
            style={{ display: snapshot.week.detailVisible ? 'block' : 'none' }}
            dangerouslySetInnerHTML={{ __html: snapshot.week.detailHtml }}
          />
        </div>
        <div
          id="session-progress"
          className="dashboard-session-progress"
          aria-live="polite"
          dangerouslySetInnerHTML={{ __html: snapshot.plan.sessionProgressHtml }}
        />
      </div>

      <div className="dashboard-section dashboard-animate dashboard-delay-3">
        <div className="dashboard-section-label">{snapshot.labels.todayPlan}</div>
        <div className="card dashboard-card" id="todays-plan-card">
          <div
            className="dashboard-card-body"
            id="next-session-content"
            dangerouslySetInnerHTML={{ __html: snapshot.plan.nextSessionHtml }}
          />
        </div>
      </div>

      <div className="dashboard-section dashboard-section-recovery dashboard-animate dashboard-delay-4">
        <div className="dashboard-section-label">{snapshot.labels.recovery}</div>
        <div
          className="card dashboard-card dashboard-recovery-card"
          dangerouslySetInnerHTML={{ __html: snapshot.recoveryHtml }}
        />
      </div>

      <div className="dashboard-section dashboard-section-maxes dashboard-animate dashboard-delay-5">
        <div className="dashboard-section-label" id="tm-section-title">
          {snapshot.tm.title || snapshot.labels.maxes}
        </div>
        <div className="card dashboard-card dashboard-maxes-card">
          <div className="dashboard-card-body">
            <div
              className="lifts-grid"
              id="tm-grid"
              dangerouslySetInnerHTML={{ __html: snapshot.tm.html }}
            />
          </div>
        </div>
      </div>
    </>
  );
}

mountIsland({
  mountId: 'dashboard-react-root',
  legacyShellId: 'dashboard-legacy-shell',
  mountedFlag: '__IRONFORGE_DASHBOARD_ISLAND_MOUNTED__',
  eventName: DASHBOARD_EVENT,
  Component: DashboardIsland,
});
