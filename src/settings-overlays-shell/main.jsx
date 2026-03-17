import { mountIsland } from '../island-runtime/index.jsx';

function SettingsOverlaysShell() {
  return (
    <>
      <div className="modal-overlay" id="onboarding-modal">
        <div className="modal-sheet onboarding-sheet">
          <div className="modal-handle" />
          <div id="onboarding-content" className="onboarding-scroll" />
        </div>
      </div>

      <div
        className="modal-overlay"
        id="program-setup-sheet"
        onClick={(event) => window.closeProgramSetupSheet?.(event)}
      >
        <div className="modal-sheet sheet-scroll-body">
          <div className="modal-handle" />
          <div className="sheet-header">
            <div
              className="modal-title"
              id="program-setup-sheet-title"
              data-i18n="settings.program_setup"
            >
              Program Setup
            </div>
            <button
              className="sheet-close-btn"
              type="button"
              onClick={() => window.closeProgramSetupSheet?.()}
              data-i18n="common.done"
            >
              Done
            </button>
          </div>
          <div id="program-settings-container" />
        </div>
      </div>
    </>
  );
}

mountIsland({
  mountId: 'settings-overlays-shell-react-root',
  legacyShellId: ['onboarding-modal', 'program-setup-sheet'],
  mountedFlag: '__IRONFORGE_SETTINGS_OVERLAYS_SHELL_MOUNTED__',
  eventName: 'ironforge:settings-overlays-shell-mounted',
  Component: SettingsOverlaysShell,
});
