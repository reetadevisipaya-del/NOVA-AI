/* NOVA universal built-in calendar UI. Loaded after calendar-sync.js. */
(() => {
  'use strict';

  const setupCalendar = document.querySelector('.permission[data-app="Calendar"]');
  const setupCalendarStatusId = 'setupCalendarStatus';

  function updateUniversalCalendarUI() {
    const signedIn = !!currentUser;

    if (calendarBtn) {
      calendarBtn.style.display = signedIn ? 'inline-block' : 'none';
      calendarBtn.setAttribute('aria-hidden', signedIn ? 'false' : 'true');
      calendarBtn.textContent = 'Calendar';
      calendarBtn.title = 'Import, export or manage your NOVA calendar';
    }

    if (!setupCalendar) return;
    setupCalendar.classList.toggle('active', signedIn);
    setupCalendar.setAttribute('aria-pressed', signedIn ? 'true' : 'false');

    const status = document.getElementById(setupCalendarStatusId);
    if (!status) return;
    status.textContent = signedIn
      ? 'Built-in NOVA calendar · no Google connection required'
      : 'Available to every NOVA user · sign in to use';
  }

  if (setupCalendar) {
    const label = setupCalendar.querySelector('span:first-child');
    if (label) {
      label.innerHTML = '<b>NOVA Calendar</b><small id="' + setupCalendarStatusId + '">Available to every NOVA user · sign in to use</small>';
    }

    setupCalendar.onclick = event => {
      event.preventDefault();
      event.stopPropagation();
      if (!currentUser) {
        openAuth('login');
        return;
      }
      if (calendarBtn) calendarBtn.click();
    };
  }

  const priorRenderCalendarButton = renderCalendarButton;
  renderCalendarButton = function () {
    priorRenderCalendarButton();
    updateUniversalCalendarUI();
  };

  sb.auth.onAuthStateChange(() => setTimeout(updateUniversalCalendarUI, 0));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') updateUniversalCalendarUI();
  });

  updateUniversalCalendarUI();
})();
