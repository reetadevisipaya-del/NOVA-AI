/* NOVA built-in calendar: local CRUD + ICS import/export + Add to Google Calendar. */
(() => {
  'use strict';

  let editingEventId = null;

  function requireUser() {
    if (currentUser) return true;
    openAuth('login');
    return false;
  }

  function ensureEventFields() {
    const card = eventModal?.querySelector('.modal-card');
    const eventNoticeEl = $('eventNotice');
    if (!card || !eventNoticeEl) return;

    const heading = card.querySelector('h2');
    if (heading && !heading.id) heading.id = 'eventModalTitle';

    if (!$('eventLocation')) {
      eventNoticeEl.insertAdjacentHTML('beforebegin',
        '<div class="field"><label>Location <span class="muted">(optional)</span></label><input id="eventLocation" placeholder="e.g. Library / Online"></div>' +
        '<div class="field"><label>Notes <span class="muted">(optional)</span></label><input id="eventDescription" placeholder="Add context for this event"></div>'
      );
    }

    const actions = card.querySelector('.modal-actions');
    if (actions && !$('deleteEventBtn')) {
      actions.insertAdjacentHTML('afterbegin', '<button id="deleteEventBtn" class="btn danger" style="display:none;margin-right:auto">Delete</button>');
    }
    if (actions && !$('googleEventBtn')) {
      actions.insertAdjacentHTML('afterbegin', '<button id="googleEventBtn" class="btn secondary" style="display:none">Add to Google Calendar</button>');
    }
  }

  function ensureToolsModal() {
    if ($('calendarToolsModal')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div id="calendarToolsModal" class="modal" aria-hidden="true">
        <div class="modal-card">
          <div class="inline">
            <div>
              <h2>Calendar</h2>
              <p>Your NOVA calendar works without connecting a Google account.</p>
            </div>
            <button id="closeCalendarTools" class="btn secondary">Close</button>
          </div>
          <div style="display:grid;gap:10px;margin-top:18px">
            <button id="importIcsBtn" class="btn secondary">Import Calendar (.ics)</button>
            <button id="exportIcsBtn" class="btn secondary">Export Calendar (.ics)</button>
            <button id="newCalendarEventBtn" class="btn primary">+ Add NOVA event</button>
          </div>
          <p style="margin-top:14px">Import works with standard iCalendar files from Google Calendar, Apple Calendar, Outlook and other calendar apps. Export creates a standard .ics file you can import elsewhere.</p>
          <div id="calendarToolsNotice" class="notice"></div>
          <input id="icsFileInput" type="file" accept=".ics,text/calendar" style="display:none">
        </div>
      </div>`);

    $('closeCalendarTools').onclick = () => $('calendarToolsModal').classList.remove('open');
    $('newCalendarEventBtn').onclick = () => {
      $('calendarToolsModal').classList.remove('open');
      openCalendarEvent();
    };
    $('importIcsBtn').onclick = () => $('icsFileInput').click();
    $('exportIcsBtn').onclick = () => exportCalendar();
    $('icsFileInput').onchange = async event => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      await importCalendarFile(file);
    };
  }

  function showCalendarTools() {
    if (!requireUser()) return;
    ensureToolsModal();
    clearNotice($('calendarToolsNotice'));
    $('calendarToolsModal').classList.add('open');
  }

  renderCalendarButton = function () {
    if (!calendarBtn) return;
    calendarBusy = false;
    calendarConnected = false;
    calendarBtn.disabled = false;
    calendarBtn.textContent = 'Calendar';
    calendarBtn.title = 'Import, export or manage your NOVA calendar';
  };

  refreshCalendarStatus = async function () {
    calendarConnected = false;
    renderCalendarButton();
  };

  calendarBtn.onclick = showCalendarTools;

  async function getFullEvent(id) {
    if (!requireUser()) throw new Error('Please sign in.');
    const { data, error } = await sb.from('calendar_events').select('*').eq('id', id).eq('user_id', currentUser.id).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Calendar event not found.');
    return data;
  }

  function openCalendarEvent(event = null) {
    if (!requireUser()) return;
    ensureEventFields();
    editingEventId = event?.id || null;
    const title = $('eventModalTitle');
    if (title) title.textContent = event ? 'Edit calendar event' : 'Add calendar event';
    const helper = eventModal.querySelector('.modal-card > p');
    if (helper) helper.textContent = 'Saved directly in your NOVA calendar. Google connection is not required.';
    $('eventTitle').value = event?.title || '';
    $('eventStart').value = isoLocalInput(event?.starts_at || new Date());
    $('eventEnd').value = isoLocalInput(event?.ends_at || new Date(Date.now() + 60 * 60000));
    $('eventLocation').value = event?.location || '';
    $('eventDescription').value = event?.description || '';
    $('deleteEventBtn').style.display = event ? 'inline-block' : 'none';
    $('googleEventBtn').style.display = event ? 'inline-block' : 'none';
    clearNotice($('eventNotice'));
    eventModal.classList.add('open');
  }

  addEventBtn.onclick = () => openCalendarEvent();
  $('closeEvent').onclick = () => eventModal.classList.remove('open');

  $('saveEvent').onclick = async () => {
    if (!requireUser()) return;
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
      is_fixed: true,
      sync_status: 'local',
    };

    $('saveEvent').disabled = true;
    notice($('eventNotice'), editingEventId ? 'Saving changes…' : 'Saving in NOVA…');
    try {
      if (editingEventId) {
        const { error } = await sb.from('calendar_events')
          .update(payload)
          .eq('id', editingEventId)
          .eq('user_id', currentUser.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from('calendar_events').insert({
          user_id: currentUser.id,
          ...payload,
          provider: 'manual',
        });
        if (error) throw error;
      }
      eventModal.classList.remove('open');
      editingEventId = null;
      await loadDashboard();
      calendarNotice('Calendar event saved in NOVA.');
    } catch (error) {
      notice($('eventNotice'), error?.message || 'Could not save the calendar event.', true);
    } finally {
      $('saveEvent').disabled = false;
    }
  };

  function googleCalendarUrl(event) {
    const clean = value => String(value || '');
    const stamp = value => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const url = new URL('https://calendar.google.com/calendar/render');
    url.searchParams.set('action', 'TEMPLATE');
    url.searchParams.set('text', clean(event.title));
    url.searchParams.set('dates', `${stamp(event.starts_at)}/${stamp(event.ends_at)}`);
    if (event.description) url.searchParams.set('details', clean(event.description));
    if (event.location) url.searchParams.set('location', clean(event.location));
    return url.toString();
  }

  async function addEventToGoogle(id) {
    try {
      const fullEvent = await getFullEvent(id);
      window.open(googleCalendarUrl(fullEvent), '_blank', 'noopener,noreferrer');
    } catch (error) {
      calendarNotice(error?.message || 'Could not open Google Calendar.', true);
    }
  }

  $('googleEventBtn').onclick = async () => {
    if (!editingEventId) return;
    await addEventToGoogle(editingEventId);
  };

  document.addEventListener('click', async event => {
    const deleteButton = event.target.closest?.('#deleteEventBtn');
    if (deleteButton) {
      if (!editingEventId || !confirm('Delete this calendar event from NOVA?')) return;
      deleteButton.disabled = true;
      try {
        const { error } = await sb.from('calendar_events').delete().eq('id', editingEventId).eq('user_id', currentUser.id);
        if (error) throw error;
        eventModal.classList.remove('open');
        editingEventId = null;
        await loadDashboard();
        calendarNotice('Calendar event deleted from NOVA.');
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
      return;
    }

    const googleButton = event.target.closest?.('[data-event-google]');
    if (googleButton) {
      await addEventToGoogle(googleButton.dataset.eventGoogle);
    }
  });

  function unescapeIcsText(value = '') {
    return value
      .replace(/\\n/gi, '\n')
      .replace(/\\,/g, ',')
      .replace(/\\;/g, ';')
      .replace(/\\\\/g, '\\');
  }

  function parseProperty(line) {
    const colon = line.indexOf(':');
    if (colon < 0) return null;
    const left = line.slice(0, colon);
    const value = line.slice(colon + 1);
    const pieces = left.split(';');
    const name = pieces.shift().toUpperCase();
    const params = {};
    for (const piece of pieces) {
      const eq = piece.indexOf('=');
      if (eq > 0) params[piece.slice(0, eq).toUpperCase()] = piece.slice(eq + 1).replace(/^"|"$/g, '');
    }
    return { name, params, value };
  }

  function zonedTimeToUtc(parts, timeZone) {
    let utc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
      });
      for (let i = 0; i < 3; i++) {
        const observed = {};
        for (const p of formatter.formatToParts(new Date(utc))) {
          if (p.type !== 'literal') observed[p.type] = Number(p.value);
        }
        const observedUtc = Date.UTC(observed.year, observed.month - 1, observed.day, observed.hour, observed.minute, observed.second);
        const desiredUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
        const diff = desiredUtc - observedUtc;
        utc += diff;
        if (!diff) break;
      }
    } catch (_) {}
    return new Date(utc);
  }

  function parseIcsDate(value, params = {}) {
    const dateOnly = params.VALUE === 'DATE' || /^\d{8}$/.test(value);
    if (dateOnly) {
      const y = Number(value.slice(0, 4));
      const m = Number(value.slice(4, 6));
      const d = Number(value.slice(6, 8));
      return { date: new Date(y, m - 1, d), allDay: true };
    }

    const match = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/);
    if (!match) return null;
    const parts = {
      year: Number(match[1]), month: Number(match[2]), day: Number(match[3]),
      hour: Number(match[4]), minute: Number(match[5]), second: Number(match[6] || 0),
    };
    if (match[7] === 'Z') {
      return { date: new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)), allDay: false };
    }
    if (params.TZID) return { date: zonedTimeToUtc(parts, params.TZID), allDay: false };
    return { date: new Date(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second), allDay: false };
  }

  function parseIcs(text) {
    const unfolded = text.replace(/\r?\n[ \t]/g, '');
    const lines = unfolded.split(/\r?\n/);
    const events = [];
    let current = null;

    for (const raw of lines) {
      const line = raw.trimEnd();
      if (line === 'BEGIN:VEVENT') {
        current = {};
        continue;
      }
      if (line === 'END:VEVENT') {
        if (current?.DTSTART) {
          const start = parseIcsDate(current.DTSTART.value, current.DTSTART.params);
          const end = current.DTEND ? parseIcsDate(current.DTEND.value, current.DTEND.params) : null;
          if (start?.date && !Number.isNaN(start.date.getTime())) {
            let endDate = end?.date;
            if (!endDate || Number.isNaN(endDate.getTime())) {
              endDate = new Date(start.date.getTime() + (start.allDay ? 86400000 : 3600000));
            }
            events.push({
              uid: current.UID ? unescapeIcsText(current.UID.value) : null,
              title: current.SUMMARY ? unescapeIcsText(current.SUMMARY.value) : 'Imported event',
              description: current.DESCRIPTION ? unescapeIcsText(current.DESCRIPTION.value) : null,
              location: current.LOCATION ? unescapeIcsText(current.LOCATION.value) : null,
              starts_at: start.date.toISOString(),
              ends_at: endDate.toISOString(),
            });
          }
        }
        current = null;
        continue;
      }
      if (!current) continue;
      const prop = parseProperty(line);
      if (!prop) continue;
      if (['UID', 'SUMMARY', 'DESCRIPTION', 'LOCATION', 'DTSTART', 'DTEND'].includes(prop.name)) current[prop.name] = prop;
    }
    return events;
  }

  async function importCalendarFile(file) {
    if (!requireUser()) return;
    const status = $('calendarToolsNotice');
    notice(status, `Reading ${file.name}…`);
    try {
      const text = await file.text();
      const parsed = parseIcs(text);
      if (!parsed.length) throw new Error('No valid calendar events were found in this .ics file.');

      let added = 0;
      let updated = 0;
      for (const item of parsed) {
        const record = {
          user_id: currentUser.id,
          title: item.title,
          description: item.description,
          location: item.location,
          starts_at: item.starts_at,
          ends_at: item.ends_at,
          is_fixed: true,
          provider: 'ics',
          sync_status: 'local',
          calendar_id: 'ics-import',
          external_event_id: item.uid,
        };

        if (item.uid) {
          const { data: existing, error: lookupError } = await sb.from('calendar_events')
            .select('id')
            .eq('user_id', currentUser.id)
            .eq('provider', 'ics')
            .eq('calendar_id', 'ics-import')
            .eq('external_event_id', item.uid)
            .maybeSingle();
          if (lookupError) throw lookupError;
          if (existing?.id) {
            const { user_id, ...changes } = record;
            const { error } = await sb.from('calendar_events').update(changes).eq('id', existing.id).eq('user_id', currentUser.id);
            if (error) throw error;
            updated++;
            continue;
          }
        }

        const { error } = await sb.from('calendar_events').insert(record);
        if (error) throw error;
        added++;
      }

      await loadDashboard();
      notice(status, `Calendar imported · ${added} added${updated ? ` · ${updated} updated` : ''}.`);
      calendarNotice(`Imported ${added + updated} calendar event${added + updated === 1 ? '' : 's'} into NOVA.`);
    } catch (error) {
      notice(status, error?.message || 'Could not import this calendar file.', true);
    }
  }

  function escapeIcsText(value = '') {
    return String(value)
      .replace(/\\/g, '\\\\')
      .replace(/\r?\n/g, '\\n')
      .replace(/,/g, '\\,')
      .replace(/;/g, '\\;');
  }

  function icsStamp(value) {
    return new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  }

  async function exportCalendar() {
    if (!requireUser()) return;
    const status = $('calendarToolsNotice');
    notice(status, 'Preparing calendar export…');
    try {
      const { data: events, error } = await sb.from('calendar_events')
        .select('id,title,description,location,starts_at,ends_at,external_event_id')
        .eq('user_id', currentUser.id)
        .order('starts_at', { ascending: true });
      if (error) throw error;
      if (!events?.length) throw new Error('There are no NOVA calendar events to export yet.');

      const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//NOVA//Focus Planner//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
      for (const event of events) {
        lines.push('BEGIN:VEVENT');
        lines.push(`UID:${escapeIcsText(event.external_event_id || `nova-${event.id}@nova`)}`);
        lines.push(`DTSTAMP:${icsStamp(new Date())}`);
        lines.push(`DTSTART:${icsStamp(event.starts_at)}`);
        lines.push(`DTEND:${icsStamp(event.ends_at)}`);
        lines.push(`SUMMARY:${escapeIcsText(event.title)}`);
        if (event.description) lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
        if (event.location) lines.push(`LOCATION:${escapeIcsText(event.location)}`);
        lines.push('END:VEVENT');
      }
      lines.push('END:VCALENDAR');

      const blob = new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/calendar;charset=utf-8' });
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = `nova-calendar-${new Date().toISOString().slice(0, 10)}.ics`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
      notice(status, `Exported ${events.length} event${events.length === 1 ? '' : 's'} as .ics.`);
    } catch (error) {
      notice(status, error?.message || 'Could not export your calendar.', true);
    }
  }

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
      if (!actions) continue;
      if (!actions.querySelector('[data-event-edit]')) {
        const edit = document.createElement('button');
        edit.className = 'mini';
        edit.dataset.eventEdit = candidate.id;
        edit.textContent = 'Edit';
        edit.title = 'Edit this NOVA calendar event';
        actions.appendChild(edit);
      }
      if (!actions.querySelector('[data-event-google]')) {
        const google = document.createElement('button');
        google.className = 'mini';
        google.dataset.eventGoogle = candidate.id;
        google.textContent = 'Google';
        google.title = 'Add this event to Google Calendar';
        actions.appendChild(google);
      }
    }
  };

  ensureEventFields();
  ensureToolsModal();
  renderCalendarButton();
  calendarConnected = false;

  sb.auth.onAuthStateChange((_event, session) => {
    setTimeout(() => {
      renderCalendarButton();
      if (!session?.user) $('calendarToolsModal')?.classList.remove('open');
    }, 0);
  });
})();
