/* NOVA journal workflow: unified task/event entry, color coding, readable notebook controls. */
(() => {
  'use strict';

  const palette = [
    { value: '#6F927A', label: 'Sage' },
    { value: '#6E8FAF', label: 'Blue' },
    { value: '#C29355', label: 'Amber' },
    { value: '#B87983', label: 'Rose' },
    { value: '#8B80A4', label: 'Lavender' },
    { value: '#647A73', label: 'Slate' }
  ];

  let entryType = 'task';
  let entryColor = palette[0].value;
  let legacyTaskColor = palette[0].value;

  const byId = id => document.getElementById(id);
  const safe = value => typeof esc === 'function' ? esc(value) : String(value || '');

  function roundToNextHalfHour(date = new Date()) {
    const d = new Date(date);
    d.setSeconds(0, 0);
    const mins = d.getMinutes();
    d.setMinutes(mins < 30 ? 30 : 60);
    return d;
  }

  function renderColorButtons(container, selected, onPick) {
    if (!container) return;
    container.innerHTML = palette.map(item =>
      `<button type="button" class="entry-color${item.value === selected ? ' active' : ''}" data-color="${item.value}" title="${item.label}" aria-label="${item.label}" style="background:${item.value}"></button>`
    ).join('');
    container.querySelectorAll('[data-color]').forEach(button => {
      button.onclick = () => {
        onPick(button.dataset.color);
        renderColorButtons(container, button.dataset.color, onPick);
      };
    });
  }

  function ensureJournalControls() {
    const openPages = document.querySelector('.openpages');
    if (!openPages) return;

    if (!byId('journalEntryToolbar')) {
      const toolbar = document.createElement('div');
      toolbar.id = 'journalEntryToolbar';
      toolbar.className = 'journal-entry-toolbar';
      toolbar.innerHTML = `
        <div class="journal-copy">
          <strong>Add something to today</strong>
          Task or event — NOVA will arrange tasks around fixed events.
        </div>
        <button id="journalAddEntryBtn" class="btn primary" type="button">+ Add task / event</button>`;
      openPages.insertBefore(toolbar, openPages.firstChild);
      byId('journalAddEntryBtn').onclick = () => openEntryComposer('task');
    }

    if (!byId('journalFooter')) {
      const footer = document.createElement('div');
      footer.id = 'journalFooter';
      footer.className = 'journal-footer';
      footer.innerHTML = `
        <div class="journal-footer-copy">
          <strong>Ready when you are.</strong>
          Add everything first, then let NOVA build the day.
        </div>
        <button id="journalAddAgain" class="btn secondary journal-add-again" type="button">+ Add another task / event</button>`;
      openPages.appendChild(footer);
      byId('journalAddAgain').onclick = () => openEntryComposer('task');

      if (typeof generateBtn !== 'undefined' && generateBtn) {
        generateBtn.textContent = "Generate today's plan";
        footer.appendChild(generateBtn);
      }
    }
  }

  function ensureEntryModal() {
    if (byId('journalEntryModal')) return;

    document.body.insertAdjacentHTML('beforeend', `
      <div id="journalEntryModal" class="modal" aria-hidden="true">
        <div class="modal-card">
          <div class="inline">
            <div>
              <h2>Add to your journal</h2>
              <p>Choose whether this is a flexible task or a fixed event.</p>
            </div>
            <button id="closeJournalEntry" class="btn secondary" type="button">Close</button>
          </div>

          <div class="entry-type-tabs" role="tablist" aria-label="Entry type">
            <button id="entryTaskTab" class="entry-tab active" type="button" role="tab" aria-selected="true">Task</button>
            <button id="entryEventTab" class="entry-tab" type="button" role="tab" aria-selected="false">Event</button>
          </div>

          <div class="field">
            <label for="journalEntryTitle">Title</label>
            <input id="journalEntryTitle" autocomplete="off" placeholder="What needs your attention?">
          </div>

          <div id="entryTaskFields" class="entry-section">
            <div class="entry-grid">
              <div class="field">
                <label for="journalTaskDue">Due date <span class="muted">(optional)</span></label>
                <input id="journalTaskDue" type="datetime-local">
              </div>
              <div class="field">
                <label for="journalTaskPriority">Priority</label>
                <select id="journalTaskPriority">
                  <option value="low">Low</option>
                  <option value="medium" selected>Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div class="field">
                <label for="journalTaskMinutes">Estimated time</label>
                <select id="journalTaskMinutes">
                  <option value="15">15 minutes</option>
                  <option value="30" selected>30 minutes</option>
                  <option value="45">45 minutes</option>
                  <option value="60">1 hour</option>
                  <option value="90">1.5 hours</option>
                  <option value="120">2 hours</option>
                </select>
              </div>
              <div class="field">
                <label for="journalTaskProject">Project <span class="muted">(optional)</span></label>
                <select id="journalTaskProject"><option value="">No project</option></select>
              </div>
              <div class="field wide">
                <label for="journalTaskGoal">Goal <span class="muted">(optional)</span></label>
                <select id="journalTaskGoal"><option value="">No goal</option></select>
              </div>
            </div>
            <label class="checkrow"><input id="journalTaskFlexible" type="checkbox" checked> NOVA may move this task to a better open focus window.</label>
          </div>

          <div id="entryEventFields" class="entry-section" hidden>
            <div class="entry-grid">
              <div class="field">
                <label for="journalEventStart">Starts</label>
                <input id="journalEventStart" type="datetime-local">
              </div>
              <div class="field">
                <label for="journalEventEnd">Ends</label>
                <input id="journalEventEnd" type="datetime-local">
              </div>
              <div class="field wide">
                <label for="journalEventLocation">Location <span class="muted">(optional)</span></label>
                <input id="journalEventLocation" placeholder="Library, office, online…">
              </div>
              <div class="field wide">
                <label for="journalEventNotes">Notes <span class="muted">(optional)</span></label>
                <input id="journalEventNotes" placeholder="Anything useful to remember">
              </div>
            </div>
          </div>

          <div class="field">
            <label>Colour code</label>
            <div id="journalEntryColors" class="entry-colors" aria-label="Colour code"></div>
            <div class="entry-help">Your colour appears beside this task or event in the journal.</div>
          </div>

          <div id="journalEntryNotice" class="notice"></div>
          <div class="modal-actions">
            <button id="cancelJournalEntry" class="btn secondary" type="button">Cancel</button>
            <button id="saveJournalEntry" class="btn primary" type="button">Add task</button>
          </div>
        </div>
      </div>`);

    byId('closeJournalEntry').onclick = closeEntryComposer;
    byId('cancelJournalEntry').onclick = closeEntryComposer;
    byId('entryTaskTab').onclick = () => setEntryType('task');
    byId('entryEventTab').onclick = () => setEntryType('event');
    byId('saveJournalEntry').onclick = saveJournalEntry;
    byId('journalEntryModal').onclick = event => {
      if (event.target === byId('journalEntryModal')) closeEntryComposer();
    };
    renderColorButtons(byId('journalEntryColors'), entryColor, color => { entryColor = color; });
  }

  function setEntryType(type) {
    entryType = type === 'event' ? 'event' : 'task';
    const task = entryType === 'task';
    byId('entryTaskTab').classList.toggle('active', task);
    byId('entryEventTab').classList.toggle('active', !task);
    byId('entryTaskTab').setAttribute('aria-selected', task ? 'true' : 'false');
    byId('entryEventTab').setAttribute('aria-selected', task ? 'false' : 'true');
    byId('entryTaskFields').hidden = !task;
    byId('entryEventFields').hidden = task;
    byId('saveJournalEntry').textContent = task ? 'Add task' : 'Add event';
    byId('journalEntryTitle').placeholder = task ? 'What needs your attention?' : 'What is happening?';
  }

  async function populateTaskMeta() {
    try {
      if (typeof loadMeta === 'function') await loadMeta();
      const projectSelect = byId('journalTaskProject');
      const goalSelect = byId('journalTaskGoal');
      projectSelect.innerHTML = '<option value="">No project</option>' + (currentProjects || []).map(x => `<option value="${x.id}">${safe(x.name)}</option>`).join('');
      goalSelect.innerHTML = '<option value="">No goal</option>' + (currentGoals || []).map(x => `<option value="${x.id}">${safe(x.title)}</option>`).join('');
    } catch (_) {}
  }

  async function openEntryComposer(type = 'task') {
    if (!currentUser) {
      openAuth('login');
      return;
    }
    ensureEntryModal();
    setEntryType(type);
    entryColor = palette[0].value;
    renderColorButtons(byId('journalEntryColors'), entryColor, color => { entryColor = color; });
    byId('journalEntryTitle').value = '';
    byId('journalTaskDue').value = '';
    byId('journalTaskPriority').value = 'medium';
    byId('journalTaskMinutes').value = '30';
    byId('journalTaskFlexible').checked = true;
    byId('journalEventLocation').value = '';
    byId('journalEventNotes').value = '';
    const start = roundToNextHalfHour();
    const end = new Date(start.getTime() + 60 * 60000);
    byId('journalEventStart').value = isoLocalInput(start);
    byId('journalEventEnd').value = isoLocalInput(end);
    clearNotice(byId('journalEntryNotice'));
    await populateTaskMeta();
    byId('journalEntryModal').classList.add('open');
    byId('journalEntryModal').setAttribute('aria-hidden', 'false');
    setTimeout(() => byId('journalEntryTitle').focus(), 60);
  }

  function closeEntryComposer() {
    const modal = byId('journalEntryModal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }

  async function saveJournalEntry() {
    if (!currentUser) return openAuth('login');
    const noticeEl = byId('journalEntryNotice');
    const title = byId('journalEntryTitle').value.trim();
    if (!title) return notice(noticeEl, 'Add a title first.', true);

    const saveButton = byId('saveJournalEntry');
    saveButton.disabled = true;
    notice(noticeEl, entryType === 'task' ? 'Adding task…' : 'Adding event…');

    try {
      if (entryType === 'task') {
        const due = byId('journalTaskDue').value;
        const row = {
          user_id: currentUser.id,
          title,
          project_id: byId('journalTaskProject').value || null,
          goal_id: byId('journalTaskGoal').value || null,
          due_at: due ? new Date(due).toISOString() : null,
          priority: byId('journalTaskPriority').value,
          estimated_minutes: Number(byId('journalTaskMinutes').value) || 30,
          is_flexible: byId('journalTaskFlexible').checked,
          color: entryColor
        };
        const { error } = await sb.from('tasks').insert(row);
        if (error) throw error;
      } else {
        const start = byId('journalEventStart').value;
        const end = byId('journalEventEnd').value;
        if (!start || !end) throw new Error('Add a start and end time.');
        if (new Date(end) <= new Date(start)) throw new Error('End must be after start.');
        const { error } = await sb.from('calendar_events').insert({
          user_id: currentUser.id,
          title,
          starts_at: new Date(start).toISOString(),
          ends_at: new Date(end).toISOString(),
          location: byId('journalEventLocation').value.trim() || null,
          description: byId('journalEventNotes').value.trim() || null,
          is_fixed: true,
          provider: 'manual',
          sync_status: 'local',
          color: entryColor
        });
        if (error) throw error;
      }

      await loadDashboard();
      closeEntryComposer();
      const again = byId('journalAddAgain');
      if (again) {
        again.classList.add('show');
        again.textContent = '+ Add another task / event';
      }
      const footerCopy = document.querySelector('.journal-footer-copy');
      if (footerCopy) footerCopy.innerHTML = `<strong>${entryType === 'task' ? 'Task added.' : 'Event added.'}</strong>Add another item, or generate today’s plan when you are ready.`;
      if (typeof calendarNotice === 'function') calendarNotice(`${entryType === 'task' ? 'Task' : 'Event'} added to NOVA.`);
    } catch (error) {
      notice(noticeEl, error?.message || 'Could not add this item.', true);
    } finally {
      saveButton.disabled = false;
    }
  }

  function decoratePlanColors() {
    document.querySelectorAll('#planList .plan').forEach(row => {
      const title = row.querySelector('b')?.textContent?.trim();
      if (!title) return;
      const task = (currentTasks || []).find(item => item.title === title);
      const event = (currentEvents || []).find(item => item.title === title);
      const color = task?.color || event?.color || (task ? palette[0].value : '#6E8FAF');
      const bar = row.querySelector('.bar');
      if (bar) bar.style.background = color;
    });
  }

  function decorateManageColors() {
    document.querySelectorAll('#manageList .taskrow').forEach(row => {
      const title = row.querySelector('b')?.textContent?.trim();
      const task = (currentTasks || []).find(item => item.title === title);
      if (!task || row.querySelector('.task-color-chip')) return;
      const chip = document.createElement('span');
      chip.className = 'task-color-chip';
      chip.style.background = task.color || palette[0].value;
      row.querySelector('b')?.prepend(chip);
    });
  }

  /* Load task/event colour data without disturbing the existing dashboard logic. */
  const previousLoadDashboard = loadDashboard;
  loadDashboard = async function(render = true) {
    await previousLoadDashboard(false);
    if (currentUser) {
      try {
        const today = localDateString();
        const start = new Date(today + 'T00:00:00').toISOString();
        const end = new Date(today + 'T23:59:59').toISOString();
        const [taskColors, eventColors] = await Promise.all([
          sb.from('tasks').select('id,color').eq('user_id', currentUser.id).neq('status', 'done'),
          sb.from('calendar_events').select('id,color').eq('user_id', currentUser.id).gte('starts_at', start).lte('starts_at', end)
        ]);
        const taskMap = new Map((taskColors.data || []).map(item => [item.id, item.color]));
        const eventMap = new Map((eventColors.data || []).map(item => [item.id, item.color]));
        currentTasks = (currentTasks || []).map(item => ({ ...item, color: taskMap.get(item.id) || item.color || palette[0].value }));
        currentEvents = (currentEvents || []).map(item => ({ ...item, color: eventMap.get(item.id) || item.color || '#6E8FAF' }));
      } catch (_) {}
    }
    if (render) renderPlan();
    ensureJournalControls();
  };

  const previousRenderPlan = renderPlan;
  renderPlan = function() {
    previousRenderPlan();
    decoratePlanColors();
    ensureJournalControls();
  };

  const previousRenderManage = renderManage;
  renderManage = function() {
    previousRenderManage();
    decorateManageColors();
  };

  /* Add colour selection when editing an existing task. */
  function ensureLegacyTaskColorField() {
    if (byId('legacyTaskColorField')) return;
    const noticeEl = byId('taskNotice');
    if (!noticeEl) return;
    const field = document.createElement('div');
    field.id = 'legacyTaskColorField';
    field.className = 'field';
    field.innerHTML = '<label>Colour code</label><div id="legacyTaskColors" class="entry-colors"></div>';
    noticeEl.parentNode.insertBefore(field, noticeEl);
    renderColorButtons(byId('legacyTaskColors'), legacyTaskColor, color => { legacyTaskColor = color; });
  }

  const previousOpenTask = openTask;
  openTask = function(task = null) {
    legacyTaskColor = task?.color || palette[0].value;
    previousOpenTask(task);
    ensureLegacyTaskColorField();
    renderColorButtons(byId('legacyTaskColors'), legacyTaskColor, color => { legacyTaskColor = color; });
  };

  const previousSaveTask = byId('saveTask')?.onclick;
  if (previousSaveTask) {
    byId('saveTask').onclick = async () => {
      const taskId = editingTaskId;
      await previousSaveTask();
      if (taskId && currentUser && !taskModal.classList.contains('open')) {
        await sb.from('tasks').update({ color: legacyTaskColor }).eq('id', taskId).eq('user_id', currentUser.id);
        await loadDashboard();
      }
    };
  }

  /* Replace the two separate dashboard entry actions with the notebook composer. */
  addTaskBtn.onclick = () => openEntryComposer('task');
  addEventBtn.onclick = () => openEntryComposer('event');
  const calendarNewEvent = byId('newCalendarEventBtn');
  if (calendarNewEvent) {
    calendarNewEvent.onclick = () => {
      byId('calendarToolsModal')?.classList.remove('open');
      openEntryComposer('event');
    };
  }

  /* Branded confirmation state. Supabase remains the account confirmation authority. */
  const authSubmit = byId('submitAuth');
  const previousAuthSubmit = authSubmit?.onclick;
  if (authSubmit && previousAuthSubmit) {
    authSubmit.onclick = async () => {
      const modeBefore = authMode;
      const emailBefore = byId('authEmail').value.trim();
      await previousAuthSubmit();
      const authNotice = byId('authNotice');
      if (modeBefore === 'signup' && authNotice?.classList.contains('show') && !authNotice.classList.contains('err') && /check your email/i.test(authNotice.textContent || '')) {
        authNotice.innerHTML = `<strong style="font-weight:500">NOVA AI sent your confirmation email.</strong><br>Open the message sent to <span>${safe(emailBefore)}</span>, confirm your email, then return here to sign in.<br><button id="resendNovaConfirmation" class="btn secondary" type="button" style="margin-top:10px">Resend confirmation</button>`;
        byId('resendNovaConfirmation').onclick = async () => {
          const button = byId('resendNovaConfirmation');
          button.disabled = true;
          button.textContent = 'Sending…';
          try {
            const { error } = await sb.auth.resend({
              type: 'signup',
              email: emailBefore,
              options: { emailRedirectTo: 'https://reetadevisipaya-del.github.io/NOVA-AI/' }
            });
            if (error) throw error;
            button.textContent = 'Confirmation resent';
          } catch (error) {
            button.textContent = 'Try again';
            notice(authNotice, error?.message || 'Could not resend the confirmation email.', true);
          } finally {
            button.disabled = false;
          }
        };
      }
    };
  }

  ensureEntryModal();
  ensureJournalControls();
  ensureLegacyTaskColorField();

  sb.auth.onAuthStateChange((_event, session) => {
    setTimeout(() => {
      ensureJournalControls();
      if (!session?.user) closeEntryComposer();
    }, 0);
  });
})();
