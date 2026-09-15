/* NOVA Outlook Calendar handoff: create Outlook events without OAuth. */
(() => {
  'use strict';

  let selectedEventId = null;

  function requireSignedIn() {
    if (currentUser) return true;
    openAuth('login');
    return false;
  }

  async function getCalendarEvent(id) {
    if (!requireSignedIn()) throw new Error('Please sign in.');
    const { data, error } = await sb
      .from('calendar_events')
      .select('id,title,description,location,starts_at,ends_at,all_day')
      .eq('id', id)
      .eq('user_id', currentUser.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Calendar event not found.');
    return data;
  }

  function outlookDate(value) {
    return new Date(value).toISOString().replace(/\.\d{3}Z$/, 'Z');
  }

  function outlookCalendarUrl(event) {
    const url = new URL('https://outlook.live.com/calendar/0/deeplink/compose');
    url.searchParams.set('path', '/calendar/action/compose');
    url.searchParams.set('rru', 'addevent');
    url.searchParams.set('allday', event.all_day ? 'true' : 'false');
    url.searchParams.set('subject', String(event.title || 'NOVA event'));
    url.searchParams.set('startdt', outlookDate(event.starts_at));
    url.searchParams.set('enddt', outlookDate(event.ends_at));
    if (event.description) url.searchParams.set('body', String(event.description));
    if (event.location) url.searchParams.set('location', String(event.location));
    return url.toString();
  }

  async function addToOutlook(id) {
    try {
      const event = await getCalendarEvent(id);
      window.open(outlookCalendarUrl(event), '_blank', 'noopener,noreferrer');
    } catch (error) {
      calendarNotice(error?.message || 'Could not open Outlook Calendar.', true);
    }
  }

  function ensureOutlookModalButton() {
    const actions = eventModal?.querySelector('.modal-actions');
    if (!actions || document.getElementById('outlookEventBtn')) return;

    const button = document.createElement('button');
    button.id = 'outlookEventBtn';
    button.className = 'btn secondary';
    button.type = 'button';
    button.textContent = 'Add to Outlook Calendar';
    button.title = 'Open Outlook with this NOVA event pre-filled';
    button.style.display = 'none';

    const googleButton = document.getElementById('googleEventBtn');
    if (googleButton) googleButton.insertAdjacentElement('afterend', button);
    else actions.insertBefore(button, actions.lastElementChild || null);

    button.onclick = async () => {
      if (!selectedEventId) return;
      await addToOutlook(selectedEventId);
    };
  }

  function refreshOutlookModalButton() {
    ensureOutlookModalButton();
    const button = document.getElementById('outlookEventBtn');
    if (!button) return;
    const modalOpen = eventModal?.classList.contains('open');
    button.style.display = modalOpen && selectedEventId ? 'inline-block' : 'none';
  }

  document.addEventListener('click', event => {
    const edit = event.target.closest?.('[data-event-edit]');
    if (edit?.dataset.eventEdit) {
      selectedEventId = edit.dataset.eventEdit;
      setTimeout(refreshOutlookModalButton, 0);
      return;
    }

    const outlook = event.target.closest?.('[data-event-outlook]');
    if (outlook?.dataset.eventOutlook) {
      event.preventDefault();
      event.stopPropagation();
      addToOutlook(outlook.dataset.eventOutlook);
      return;
    }

    if (event.target.closest?.('#addEventBtn') || event.target.closest?.('#newCalendarEventBtn')) {
      selectedEventId = null;
      setTimeout(refreshOutlookModalButton, 0);
    }

    if (event.target.closest?.('#closeEvent') || event.target.closest?.('#deleteEventBtn')) {
      setTimeout(() => {
        if (!eventModal?.classList.contains('open')) selectedEventId = null;
        refreshOutlookModalButton();
      }, 0);
    }
  }, true);

  const previousRenderPlan = renderPlan;
  renderPlan = function () {
    previousRenderPlan();
    const rows = Array.from(planList?.querySelectorAll('.plan') || []);
    for (const row of rows) {
      const edit = row.querySelector('[data-event-edit]');
      const actions = row.querySelector('.plan-actions');
      if (!edit?.dataset.eventEdit || !actions || actions.querySelector('[data-event-outlook]')) continue;

      const button = document.createElement('button');
      button.className = 'mini';
      button.dataset.eventOutlook = edit.dataset.eventEdit;
      button.textContent = 'Outlook';
      button.title = 'Add this event to Outlook Calendar';
      actions.appendChild(button);
    }
  };

  const observer = new MutationObserver(refreshOutlookModalButton);
  if (eventModal) observer.observe(eventModal, { attributes: true, attributeFilter: ['class'] });

  ensureOutlookModalButton();
  refreshOutlookModalButton();
})();
