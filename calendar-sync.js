/* NOVA Google Calendar enhancements: sync + CRUD, loaded after the main app script. */
(() => {
  'use strict';

  let editingEventId = null;
  let lastCalendarSyncAt = 0;
  let calendarSyncPromise = null;

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  async function calendarApi(action, payload = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const { data: sessionData, error: sessionError } = await sb.auth.getSession();
      if (sessionError || !sessionData.session) throw new Error('Please sign in again, then try your calendar action.');
      const response = await fetch(SUPABASE_URL + '/functions/v1/google-calendar-connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: 'Bearer ' + sessionData.session.access_token,
        },
        body: JSON.stringify({ action, ...payload }),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => null);
      if (response.status === 401) throw new Error('Your NOVA session expired. Please sign in again.');
      if (!response.ok || data?.error) throw new Error(data?.error || 'Google Calendar is unavailable.');
      if (!data) throw new Error('Google Calendar returned an incomplete response.');
      return data;
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('Google Calendar took too long to respond. Please try again.');
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  function setCalendarConnected(value) {
    calendarConnected = !!value;
    renderCalendarButton();
  }

  renderCalendarButton = function () {
    if (!calendarBtn) return;
    calendarBtn.disabled = calendarBusy;
    calendarBtn.textContent = calendarBusy
      ? (calendarConnected ? 'Syncing…' : 'Connecting…')
      : (calendarConnected ? '↻ Sync Calendar' : 'Connect Calendar');
    calendarBtn.title = calendarConnected
      ? 'Sync Google Calendar events with NOVA'
      : 'Connect your Google Calendar';
  };

  async function syncGoogleCalendar({ quiet = false } = {}) {
    if (!currentUser || !calendarConnected) return null;
    if (calendarSyncPromise) return calendarSyncPromise;

    calendarSyncPromise = (async () => {
      const wasBusy = calendarBusy;
      calendarBusy = true;
      renderCalendarButton();
      if (!quiet) calendarNotice('Syncing Google Calendar…');
      try {
        const result = await calendarApi('sync');
        lastCalendarSyncAt = Date.now();
        await loadDashboard();
        if (!quiet) {
          const removed = result.removed ? ` · ${result.removed} removed` : '';
          calendarNotice(`Google Calendar synced · ${result.synced || 0} events${removed}`);
        }
        return result;
      } catch (error) {
        const message = error?.message || 'Could not sync Google Calendar.';
        if (/reconnect|authorization expired|not connected/i.test(message)) setCalendarConnected(false);
        if (!quiet) calendarNotice(message, true);
        console.error('Google Calendar sync error:', error);
        throw error;
      } finally {
        calendarBusy = wasBusy;
        renderCalendarButton();
        calendarSyncPromise = null;
      }
    })();

    return calendarSyncPromise;
  }

  refreshCalendarStatus = async function () {
    if (!currentUser) return;
    const userId = currentUser.id;
    const version = ++calendarStatusVersion;
    try {
      const data = await calendarApi('status');
      if (version !== calendarStatusVersion || currentUser?.id !== userId) return;
      setCalendarConnected(data.connected === true);
      if (calendarConnected) {
        const justConnected = calendarReturnStatus === 'connected';
        if (justConnected) calendarNotice('Google Calendar connected. Importing your events…');
        await syncGoogleCalendar({ quiet: !justConnected });
        if (justConnected) {
          calendarNotice('Google Calendar connected and synced successfully.');
          calendarReturnStatus = null;
        }
      } else if (calendarReturnStatus === 'connected') {
        calendarNotice('The Google Calendar connection could not be confirmed. Please connect again.', true);
        calendarReturnStatus = null;
      }
    } catch (error) {
      if (version !== calendarStatusVersion || currentUser?.id !== userId) return;
      calendarNotice('Could not check Google Calendar. ' + (error?.message || ''), true);
    }
  };

  calendarBtn.onclick = async () => {
    if (!currentUser) {
      openAuth('login');
      return;
    }
    if (calendarBusy) return;

    if (calendarConnected) {
      try { await syncGoogleCalendar(); } catch (_) {}
      return;
    }

    const userId = currentUser.id;
    calendarBusy = true;
    renderCalendarButton();
    clearNotice($('calendarNotice'));
    try {
      const data = await calendarApi('connect');
      if (currentUser?.id !== userId) return;
      const url = new URL(data.url);
      if (url.origin !== 'https://accounts.google.com' || url.pathname !== '/o/oauth2/v2/auth') {
        throw new Error('Google authorization URL was not returned correctly.');
      }
      window.location.assign(url.href);
    } catch (error) {
      if (currentUser?.id === userId) calendarNotice(error?.message || 'Could not start Google Calendar connection.', true);
      calendarBusy = false;
      renderCalendarButton();
    }
  };

  function ensureEventFields() {
    const card = eventModal?.querySelector('.modal-card');
    const eventNoticeEl = $('eventNotice');
    if (!card || !eventNoticeEl) return;

    const heading = card.querySelector('h2');
    if (heading && !heading.id) heading.id = 'eventModalTitle';

    if (!$('eventLocation')) {
      eventNoticeEl.insertAdjacentHTML('beforebegin',
        '<div class="field"><label>Location <span class="muted">(optional)</span></label><input id="eventLocation" placeholder="e.g. Library / Google Meet"></div>' +
        '<div class="field"><label>Notes <span class="muted">(optional)</span></label><input id="eventDescription" placeholder="Add context for this event"></div>'
      );
    }

    const actions = card.querySelector('.modal-actions');
    if (actions && !$('deleteEventBtn')) {
      actions.insertAdjacentHTML('afterbegin', '<button id="deleteEventBtn" class="btn danger" style="display:none;margin-right:auto">Delete</button>');
    }
  }

  async function getFullEvent(id) {
    const { data, error } = await sb.from('calendar_events').select('*').eq('id', id).eq('user_id', currentUser.id).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Calendar event not found.');
    return data;
  }

  function openCalendarEvent(event = null) {
    ensureEventFields();
    editingEventId = event?.id || null;
    const title = $('eventModalTitle');
    if (title) title.textContent = event ? 'Edit calendar event' : 'Add calendar event';
    const helper = eventModal.querySelector('.modal-card > p');
    if (helper) helper.textContent = calendarConnected
      ? 'This event will stay synced with your Google Calendar.'
      : 'Connect Google Calendar to sync events automatically. Until then, it stays in NOVA.';
    $('eventTitle').value = event?.title || '';
    $('eventStart').value = isoLocalInput(event?.starts_at || new Date());
    $('eventEnd').value = isoLocalInput(event?.ends_at || new Date(Date.now() + 60 * 60000));
    $('eventLocation').value = event?.location || '';
    $('eventDescription').value = event?.description || '';
    $('deleteEventBtn').style.display = event ? 'inline-block' : 'none';
    clearNotice($('eventNotice'));
    eventModal.classList.add('open');
  }

  addEventBtn.onclick = () => openCalendarEvent();
  $('closeEvent').onclick = () => eventModal.classList.remove('open');

  $('saveEvent').onclick = async () => {
    const title = $('eventTitle').value.trim();
    const startValue = $('eventStart').value;
    const endValue = $('eventEnd').value;
    if (!title || !startValue || !endValue) return notice($('eventNotice'), 'Add title, start and end.', true);
    if (new Date(endValue) <= new Date(startValue)) return notice($('eventNotice'), 'End must be after start.', true);

    const payload = {
      title,
      starts_at: new Date(startValue).toISOString(),
      ends_at: new Date(endValue).toISOString(),
      location: $('eventLocation').value.trim() || null,
      description: $('eventDescription').value.trim() || null,
    };

    $('saveEvent').disabled = true;
    notice($('eventNotice'), editingEventId ? 'Saving changes…' : (calendarConnected ? 'Adding to Google Calendar…' : 'Saving in NOVA…'));
    try {
      if (editingEventId) {
        await calendarApi('update_event', { event_id: editingEventId, ...payload });
      } else if (calendarConnected) {
        await calendarApi('create_event', payload);
      } else {
        const { error } = await sb.from('calendar_events').insert({
          user_id: currentUser.id,
          title: payload.title,
          description: payload.description,
          location: payload.location,
          starts_at: payload.starts_at,
          ends_at: payload.ends_at,
          is_fixed: true,
          provider: 'manual',
          sync_status: 'local',
        });
        if (error) throw error;
      }
      eventModal.classList.remove('open');
      editingEventId = null;
      await loadDashboard();
      calendarNotice(calendarConnected ? 'Calendar event saved and synced.' : 'Calendar event saved in NOVA.');
    } catch (error) {
      notice($('eventNotice'), error?.message || 'Could not save the calendar event.', true);
    } finally {
      $('saveEvent').disabled = false;
    }
  };

  document.addEventListener('click', async event => {
    const deleteButton = event.target.closest?.('#deleteEventBtn');
    if (deleteButton) {
      if (!editingEventId || !confirm('Delete this calendar event?')) return;
      deleteButton.disabled = true;
      try {
        await calendarApi('delete_event', { event_id: editingEventId });
        eventModal.classList.remove('open');
        editingEventId = null;
        await loadDashboard();
        calendarNotice('Calendar event deleted.');
      } catch (error) {
        notice($('eventNotice'), error?.message || 'Could not delete the calendar event.', true);
      } finally {
        deleteButton.disabled = false;
      }
      return;
    }

    const editButton = event.target.closest?.('[data-event-edit]');
    if (editButton) {
      try {
        const fullEvent = await getFullEvent(editButton.dataset.eventEdit);
        openCalendarEvent(fullEvent);
      } catch (error) {
        calendarNotice(error?.message || 'Could not open the calendar event.', true);
      }
    }
  });

  const baseRenderPlan = renderPlan;
  renderPlan = function () {
    baseRenderPlan();
    if (!currentEvents?.length) return;
    const planRows = Array.from(planList.querySelectorAll('.plan'));
    for (const row of planRows) {
      const titleText = row.querySelector('b')?.textContent || '';
      const timeText = row.querySelector('time')?.textContent || '';
      const candidate = currentEvents.find(e => e.title === titleText && fmtTime(e.starts_at) === timeText);
      if (!candidate) continue;
      const actions = row.querySelector('.plan-actions');
      if (actions && !actions.querySelector('[data-event-edit]')) {
        const edit = document.createElement('button');
        edit.className = 'mini';
        edit.dataset.eventEdit = candidate.id;
        edit.textContent = 'Edit';
        edit.title = 'Edit this calendar event';
        actions.appendChild(edit);
      }
    }
  };

  async function initializeEnhancedCalendar() {
    ensureEventFields();
    renderCalendarButton();
    for (let i = 0; i < 20 && !currentUser; i++) await sleep(100);
    if (currentUser) await refreshCalendarStatus();
  }

  sb.auth.onAuthStateChange((_event, session) => {
    if (!session?.user) return;
    setTimeout(() => refreshCalendarStatus(), 250);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && currentUser && calendarConnected && Date.now() - lastCalendarSyncAt > 5 * 60 * 1000) {
      syncGoogleCalendar({ quiet: true }).catch(() => {});
    }
  });

  initializeEnhancedCalendar().catch(error => console.error('Calendar initialization error:', error));
})();
