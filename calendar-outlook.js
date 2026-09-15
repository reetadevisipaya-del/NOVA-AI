/* NOVA Outlook Calendar shortcut: open Outlook's new-event composer without OAuth. */
(() => {
  'use strict';

  const OUTLOOK_NEW_EVENT_URL = 'https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent';

  function openOutlookCalendar() {
    window.open(OUTLOOK_NEW_EVENT_URL, '_blank', 'noopener,noreferrer');
  }

  function addOutlookShortcut() {
    const importButton = document.getElementById('importIcsBtn');
    if (!importButton || document.getElementById('openOutlookCalendarBtn')) return;

    const button = document.createElement('button');
    button.id = 'openOutlookCalendarBtn';
    button.type = 'button';
    button.className = 'btn secondary';
    button.textContent = 'Open Outlook Calendar';
    button.title = 'Open Outlook and create a new calendar event';
    button.onclick = openOutlookCalendar;

    importButton.parentElement?.insertBefore(button, importButton);
  }

  addOutlookShortcut();

  const observer = new MutationObserver(addOutlookShortcut);
  observer.observe(document.body, { childList: true, subtree: true });
})();
