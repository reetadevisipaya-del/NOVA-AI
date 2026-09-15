/* NOVA universal Google Calendar access UI. Loaded after calendar-sync.js. */
(() => {
  'use strict';

  const setupCalendar = document.querySelector('.permission[data-app="Calendar"]');
  const setupCalendarStatusId = 'setupCalendarStatus';

  function updateUniversalCalendarUI() {
    const signedIn = !!currentUser;

    if (calendarBtn) {
      calendarBtn.style.display = signedIn ? 'inline-block' : 'none';
      calendarBtn.setAttribute('aria-hidden', signedIn ? 'false' : 'true');
    }

    if (!setupCalendar) return;

    setupCalendar.classList.toggle('active', signedIn && !!calendarConnected);
    setupCalendar.setAttribute('aria-pressed', signedIn && calendarConnected ? 'true' : 'false');

    const status = document.getElementById(setupCalendarStatusId);
    if (!status) return;

    if (!signedIn) {
      status.textContent = 'Available to every NOVA user · sign in to connect';
    } else if (calendarConnected) {
      status.textContent = 'Connected to your Google Calendar · click to sync';
    } else {
      status.textContent = 'Connect your own Google Calendar';
    }
  }

  if (setupCalendar) {
    const label = setupCalendar.querySelector('span:first-child');
    if (label) {
      label.innerHTML = '<b>Google Calendar</b><small id="' + setupCalendarStatusId + '">Available to every NOVA user · sign in to connect</small>';
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

  sb.auth.onAuthStateChange(() => {
    setTimeout(updateUniversalCalendarUI, 0);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') updateUniversalCalendarUI();
  });

  updateUniversalCalendarUI();
})();
