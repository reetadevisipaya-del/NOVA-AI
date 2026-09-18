/* NOVA unified calendar: local CRUD + Cal.com + ICS import/export + Google handoff. */
(() => {
  'use strict';

  const CAL_URL = 'https://cal.com/reeta-devi-op8mu0';
  let editingEventId = null;

  function requireUser() {
    if (currentUser) return true;
    openAuth('login');
    return false;
  }

  function addUnifiedStyles() {
    if (document.getElementById('novaUnifiedCalendarStyles')) return;
    const style = document.createElement('style');
    style.id = 'novaUnifiedCalendarStyles';
    style.textContent = `
      #novaScheduleBtn,#novaScheduleTodayBtn{display:none!important}
      .nova-calendar-options{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:18px}
      .nova-calendar-option{display:flex;align-items:flex-start;gap:11px;text-align:left;padding:14px;border:1px solid var(--line);border-radius:16px;background:var(--surface);color:var(--ink);cursor:pointer;transition:.18s}
      .nova-calendar-option:hover{transform:translateY(-1px);border-color:color-mix(in srgb,var(--accent) 45%,var(--line));box-shadow:0 8px 24px rgba(65,55,88,.08)}
      .nova-calendar-option.featured{background:linear-gradient(135deg,#efe7ff,#dfeaff);border-color:rgba(120,105,160,.22)}
      .nova-calendar-option .cal-icon{width:34px;height:34px;display:grid;place-items:center;flex:0 0 34px;border-radius:11px;background:var(--soft);color:var(--accent);font-weight:800;font-size:12px}
      .nova-calendar-option b{display:block;font-size:12px;margin-bottom:3px}.nova-calendar-option small{display:block;font-size:10px;line-height:1.45;color:var(--muted)}
      .nova-calendar-note{margin-top:14px;padding:11px 12px;border-radius:13px;background:var(--surface2);font-size:10px;line-height:1.5;color:var(--muted)}
      body.dark .nova-calendar-option.featured{background:linear-gradient(135deg,#413650,#35465d)}
      @media(max-width:600px){.nova-calendar-options{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function forceUnifiedButton() {
    if (!calendarBtn) return;
    calendarBtn.disabled = false;
    calendarBtn.textContent = 'Add to calendar';
    calendarBtn.title = 'Calendar, Cal.com and .ics options';
    calendarBtn.setAttribute('aria-label', 'Add to calendar');
    document.getElementById('novaScheduleBtn')?.remove();
    document.getElementById('novaScheduleTodayBtn')?.remove();
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
    if (actions && !$('deleteEventBtn')) actions.insertAdjacentHTML('afterbegin', '<button id="deleteEventBtn" class="btn danger" style="display:none;margin-right:auto">Delete</button>');
    if (actions && !$('googleEventBtn')) actions.insertAdjacentHTML('afterbegin', '<button id="googleEventBtn" class="btn secondary" style="display:none">Add to Google Calendar</button>');
  }

  function ensureToolsModal() {
    if ($('calendarToolsModal')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div id="calendarToolsModal" class="modal" aria-hidden="true">
        <div class="modal-card">
          <div class="inline">
            <div>
              <h2>Add to calendar</h2>
              <p>Choose how you want to schedule, import, export or manage calendar time.</p>
            </div>
            <button id="closeCalendarTools" class="btn secondary">Close</button>
          </div>
          <div class="nova-calendar-options">
            <button id="newCalendarEventBtn" class="nova-calendar-option featured" type="button"><span class="cal-icon">N</span><span><b>NOVA Calendar</b><small>Add a fixed event directly to your NOVA planner.</small></span></button>
            <button id="calComBtn" class="nova-calendar-option" type="button"><span class="cal-icon">C</span><span><b>Cal.com</b><small>Book or share available meeting times.</small></span></button>
            <button id="importIcsBtn" class="nova-calendar-option" type="button"><span class="cal-icon">↓</span><span><b>Import .ics</b><small>Bring events in from Google, Apple, Outlook or another calendar.</small></span></button>
            <button id="exportIcsBtn" class="nova-calendar-option" type="button"><span class="cal-icon">↑</span><span><b>Export .ics</b><small>Download your NOVA events for use in another calendar app.</small></span></button>
          </div>
          <div class="nova-calendar-note"><b>Google Calendar:</b> create or open a NOVA event, then choose <b>Add to Google Calendar</b>. This keeps the handoff simple without requiring full account sync.</div>
          <div id="calendarToolsNotice" class="notice"></div>
          <input id="icsFileInput" type="file" accept=".ics,text/calendar" style="display:none">
        </div>
      </div>`);

    $('closeCalendarTools').onclick = () => $('calendarToolsModal').classList.remove('open');
    $('newCalendarEventBtn').onclick = () => {
      $('calendarToolsModal').classList.remove('open');
      openCalendarEvent();
    };
    $('calComBtn').onclick = () => window.open(CAL_URL, '_blank', 'noopener,noreferrer');
    $('importIcsBtn').onclick = () => $('icsFileInput').click();
    $('exportIcsBtn').onclick = () => exportCalendar();
    $('icsFileInput').onchange = async event => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (file) await importCalendarFile(file);
    };
  }

  function showCalendarTools() {
    if (!requireUser()) return;
    ensureToolsModal();
    clearNotice($('calendarToolsNotice'));
    $('calendarToolsModal').classList.add('open');
  }

  renderCalendarButton = function () {
    calendarConnected = false;
    calendarBusy = false;
    forceUnifiedButton();
  };

  refreshCalendarStatus = async function () {
    calendarConnected = false;
    forceUnifiedButton();
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
      sync_status: 'local'
    };

    $('saveEvent').disabled = true;
    notice($('eventNotice'), editingEventId ? 'Saving changes…' : 'Saving in NOVA…');
    try {
      if (editingEventId) {
        const { error } = await sb.from('calendar_events').update(payload).eq('id', editingEventId).eq('user_id', currentUser.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from('calendar_events').insert({ user_id: currentUser.id, ...payload, provider: 'manual' });
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
    const stamp = value => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const url = new URL('https://calendar.google.com/calendar/render');
    url.searchParams.set('action', 'TEMPLATE');
    url.searchParams.set('text', String(event.title || ''));
    url.searchParams.set('dates', `${stamp(event.starts_at)}/${stamp(event.ends_at)}`);
    if (event.description) url.searchParams.set('details', String(event.description));
    if (event.location) url.searchParams.set('location', String(event.location));
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
    if (editingEventId) await addEventToGoogle(editingEventId);
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
      try { openCalendarEvent(await getFullEvent(editButton.dataset.eventEdit)); }
      catch (error) { calendarNotice(error?.message || 'Could not open the calendar event.', true); }
      return;
    }

    const googleButton = event.target.closest?.('[data-event-google]');
    if (googleButton) await addEventToGoogle(googleButton.dataset.eventGoogle);
  });

  function unescapeIcsText(value = '') {
    return value.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
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

  function parseIcsDate(value, params = {}) {
    if (params.VALUE === 'DATE' || /^\d{8}$/.test(value)) {
      const y = Number(value.slice(0,4)), m = Number(value.slice(4,6)), d = Number(value.slice(6,8));
      return { date: new Date(y, m - 1, d), allDay: true };
    }
    const match = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/);
    if (!match) return null;
    const y=+match[1],m=+match[2],d=+match[3],h=+match[4],min=+match[5],s=+(match[6]||0);
    return { date: match[7] === 'Z' ? new Date(Date.UTC(y,m-1,d,h,min,s)) : new Date(y,m-1,d,h,min,s), allDay:false };
  }

  function parseIcs(text) {
    const lines = text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
    const events = [];
    let current = null;
    for (const raw of lines) {
      const line = raw.trimEnd();
      if (line === 'BEGIN:VEVENT') { current = {}; continue; }
      if (line === 'END:VEVENT') {
        if (current?.DTSTART) {
          const start = parseIcsDate(current.DTSTART.value, current.DTSTART.params);
          const end = current.DTEND ? parseIcsDate(current.DTEND.value, current.DTEND.params) : null;
          if (start?.date && !Number.isNaN(start.date.getTime())) {
            const endDate = end?.date && !Number.isNaN(end.date.getTime()) ? end.date : new Date(start.date.getTime() + (start.allDay ? 86400000 : 3600000));
            events.push({
              uid: current.UID ? unescapeIcsText(current.UID.value) : null,
              title: current.SUMMARY ? unescapeIcsText(current.SUMMARY.value) : 'Imported event',
              description: current.DESCRIPTION ? unescapeIcsText(current.DESCRIPTION.value) : null,
              location: current.LOCATION ? unescapeIcsText(current.LOCATION.value) : null,
              starts_at: start.date.toISOString(),
              ends_at: endDate.toISOString()
            });
          }
        }
        current = null;
        continue;
      }
      if (!current) continue;
      const prop = parseProperty(line);
      if (prop && ['UID','SUMMARY','DESCRIPTION','LOCATION','DTSTART','DTEND'].includes(prop.name)) current[prop.name] = prop;
    }
    return events;
  }

  async function importCalendarFile(file) {
    if (!requireUser()) return;
    const status = $('calendarToolsNotice');
    notice(status, `Reading ${file.name}…`);
    try {
      const parsed = parseIcs(await file.text());
      if (!parsed.length) throw new Error('No valid calendar events were found in this .ics file.');
      let added = 0, updated = 0;
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
          external_event_id: item.uid
        };
        if (item.uid) {
          const { data: existing, error: lookupError } = await sb.from('calendar_events').select('id').eq('user_id', currentUser.id).eq('provider','ics').eq('calendar_id','ics-import').eq('external_event_id', item.uid).maybeSingle();
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
    return String(value).replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
  }

  function icsStamp(value) {
    return new Date(value).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
  }

  async function exportCalendar() {
    if (!requireUser()) return;
    const status = $('calendarToolsNotice');
    notice(status, 'Preparing calendar export…');
    try {
      const { data: events, error } = await sb.from('calendar_events').select('id,title,description,location,starts_at,ends_at,external_event_id').eq('user_id',currentUser.id).order('starts_at',{ascending:true});
      if (error) throw error;
      if (!events?.length) throw new Error('There are no NOVA calendar events to export yet.');
      const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//NOVA//Focus Planner//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH'];
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
      const blob = new Blob([lines.join('\r\n') + '\r\n'], {type:'text/calendar;charset=utf-8'});
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = `nova-calendar-${new Date().toISOString().slice(0,10)}.ics`;
      document.body.appendChild(a); a.click(); a.remove();
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
        edit.className = 'mini'; edit.dataset.eventEdit = candidate.id; edit.textContent = 'Edit'; edit.title = 'Edit this NOVA calendar event';
        actions.appendChild(edit);
      }
      if (!actions.querySelector('[data-event-google]')) {
        const google = document.createElement('button');
        google.className = 'mini'; google.dataset.eventGoogle = candidate.id; google.textContent = 'Google'; google.title = 'Add this event to Google Calendar';
        actions.appendChild(google);
      }
    }
  };

  addUnifiedStyles();
  ensureEventFields();
  ensureToolsModal();
  forceUnifiedButton();
  calendarConnected = false;

  setTimeout(forceUnifiedButton, 250);
  setTimeout(forceUnifiedButton, 800);

  // Do not observe and rewrite the whole DOM here. That caused a self-triggering
  // MutationObserver loop which could freeze NOVA and make every control unresponsive.
  const attachCalendarAuthHook = client => client?.auth?.onAuthStateChange?.((_event, session) => {
    setTimeout(() => {
      forceUnifiedButton();
      if (!session?.user) $('calendarToolsModal')?.classList.remove('open');
    }, 0);
  });
  if (typeof ensureBackend === 'function') {
    ensureBackend().then(attachCalendarAuthHook).catch(error => console.warn('Calendar auth hook unavailable', error));
  } else if (typeof sb !== 'undefined' && sb?.auth) {
    attachCalendarAuthHook(sb);
  }
})();