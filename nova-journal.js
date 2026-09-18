/* NOVA journal workflow: unified task/event entry, color coding, readable notebook controls. */
(() => {
  'use strict';

  const palette = [
    { value: '#B9A7E8', label: 'Lavender' },
    { value: '#AFC9EE', label: 'Powder blue' },
    { value: '#E9B7CC', label: 'Blush' },
    { value: '#F4C5A8', label: 'Peach' },
    { value: '#EFD88C', label: 'Butter' },
    { value: '#B9DFC9', label: 'Mint' }
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
      const color = task?.color || event?.color || (task ? palette[0].value : '#AFC9EE');
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
        currentEvents = (currentEvents || []).map(item => ({ ...item, color: eventMap.get(item.id) || item.color || '#AFC9EE' }));
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

  addTaskBtn.onclick = () => openEntryComposer('task');
  addEventBtn.onclick = () => openEntryComposer('event');
  const calendarNewEvent = byId('newCalendarEventBtn');
  if (calendarNewEvent) {
    calendarNewEvent.onclick = () => {
      byId('calendarToolsModal')?.classList.remove('open');
      openEntryComposer('event');
    };
  }

  const authSubmit = byId('submitAuth');
  const previousAuthSubmit = authSubmit?.onclick;
  if (authSubmit && previousAuthSubmit) {
    authSubmit.onclick = async () => {
      const modeBefore = authMode;
      const emailBefore = byId('authEmail').value.trim();
      await previousAuthSubmit();
      const authNotice = byId('authNotice');
      if (modeBefore === 'signup' && authNotice?.classList.contains('show') && !authNotice.classList.contains('err') && /check your email/i.test(authNotice.textContent || '')) {
        authNotice.innerHTML = `<strong style="font-weight:600">NOVA AI sent your confirmation email.</strong><br>Open the message sent to <span>${safe(emailBefore)}</span>, confirm your email, then return here to sign in.<br><button id="resendNovaConfirmation" class="btn secondary" type="button" style="margin-top:10px">Resend confirmation</button>`;
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

  const attachJournalAuth = client => client?.auth?.onAuthStateChange?.((_event, session) => {
    setTimeout(() => {
      ensureJournalControls();
      if (!session?.user) closeEntryComposer();
    }, 0);
  });
  if (typeof ensureBackend === 'function') {
    ensureBackend().then(attachJournalAuth).catch(error => console.warn('Journal auth hook unavailable', error));
  } else if (typeof sb !== 'undefined' && sb?.auth) {
    attachJournalAuth(sb);
  }
})();

/* NOVA inspiration shelf: personalized daily quotes + lightweight original art. */
(() => {
  'use strict';

  const QUOTES = {
    focus: [
      'Choose one clear thing, then give it your full attention.',
      'A small finished task creates more momentum than a perfect plan.',
      'Protect the next thirty minutes and the rest of the day gets easier.',
      'Clarity grows when the next action is visible.',
      'Make the important thing easy to begin.',
      'Your attention is a workspace. Keep only what matters on the desk.'
    ],
    calm: [
      'A calm plan can still be an ambitious plan.',
      'Leave a little white space in the day for being human.',
      'You do not need to rush to make meaningful progress.',
      'Gentle structure is still structure.',
      'A quieter pace can reveal the clearest next step.',
      'Rest and focus belong in the same well-designed day.'
    ],
    creativity: [
      'Curiosity turns an ordinary task into a doorway.',
      'Make room for the idea that was not on the schedule.',
      'Beautiful work often begins as a playful draft.',
      'Collect small sparks. They become larger ideas later.',
      'A fresh angle is sometimes more useful than more effort.',
      'Your planner can hold both discipline and imagination.'
    ],
    courage: [
      'Begin before the confidence arrives.',
      'A difficult task becomes smaller the moment you start it.',
      'Progress does not have to look dramatic to be real.',
      'Do the next brave, practical thing.',
      'You can revise a first attempt; you cannot revise a blank page.',
      'Consistency is courage repeated quietly.'
    ]
  };

  let shuffleOffset = 0;
  const $q = id => document.getElementById(id);

  function userKey() {
    const id = typeof currentUser !== 'undefined' && currentUser?.id ? currentUser.id : 'guest';
    return `novaQuotePrefs:${id}`;
  }

  function loadPrefs() {
    const fallback = { category: 'focus', includeOwn: true, own: [] };
    try {
      const parsed = JSON.parse(localStorage.getItem(userKey()) || 'null');
      return { ...fallback, ...(parsed || {}), own: Array.isArray(parsed?.own) ? parsed.own : [] };
    } catch (_) { return fallback; }
  }

  function savePrefs(prefs) {
    localStorage.setItem(userKey(), JSON.stringify(prefs));
  }

  function dayHash(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    return Math.abs(hash);
  }

  function quotePool(prefs) {
    const base = QUOTES[prefs.category] || QUOTES.focus;
    return prefs.includeOwn && prefs.own.length ? base.concat(prefs.own) : base;
  }

  function quoteForToday(prefs) {
    const pool = quotePool(prefs);
    const day = new Date().toISOString().slice(0, 10);
    const idx = (dayHash(`${day}:${prefs.category}:${userKey()}`) + shuffleOffset) % pool.length;
    return pool[idx];
  }

  function ensureBookshelf() {
    const dash = document.querySelector('.dash');
    if (!dash || dash.querySelector('.nova-bookshelf')) return;
    const shelf = document.createElement('div');
    shelf.className = 'nova-bookshelf';
    shelf.setAttribute('aria-hidden', 'true');
    shelf.innerHTML = '<i></i><i></i><i></i><i></i>';
    dash.appendChild(shelf);
  }

  function ensureQuoteModal() {
    if ($q('novaQuoteModal')) return;
    const modal = document.createElement('div');
    modal.id = 'novaQuoteModal';
    modal.className = 'modal';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
      <div class="modal-card">
        <div class="inline">
          <div><h2>Your inspiration shelf</h2><p>Choose the kind of reminder you want NOVA to rotate each day, or add your own.</p></div>
          <button id="novaQuoteClose" class="btn secondary" type="button">Close</button>
        </div>
        <div class="field">
          <label for="novaQuoteCategory">Daily quote theme</label>
          <select id="novaQuoteCategory">
            <option value="focus">Focus</option>
            <option value="calm">Calm</option>
            <option value="creativity">Creativity</option>
            <option value="courage">Courage</option>
          </select>
        </div>
        <label class="nova-quote-toggle"><input id="novaIncludeOwn" type="checkbox"> Mix my quotes into the daily rotation</label>
        <div class="field">
          <label for="novaQuoteText">Add your own quote</label>
          <textarea id="novaQuoteText" class="nova-quote-textarea" maxlength="240" placeholder="Write a line you want NOVA to bring back to you on future days…"></textarea>
        </div>
        <div class="modal-actions"><button id="novaAddQuote" class="btn primary" type="button">Add quote</button></div>
        <div id="novaOwnQuoteList" class="nova-quote-list"></div>
      </div>`;
    document.body.appendChild(modal);
    $q('novaQuoteClose').onclick = closeQuoteModal;
    modal.onclick = e => { if (e.target === modal) closeQuoteModal(); };
    $q('novaQuoteCategory').onchange = () => {
      const prefs = loadPrefs(); prefs.category = $q('novaQuoteCategory').value; savePrefs(prefs); shuffleOffset = 0; renderQuote();
    };
    $q('novaIncludeOwn').onchange = () => {
      const prefs = loadPrefs(); prefs.includeOwn = $q('novaIncludeOwn').checked; savePrefs(prefs); shuffleOffset = 0; renderQuote();
    };
    $q('novaAddQuote').onclick = () => {
      const textarea = $q('novaQuoteText');
      const value = textarea.value.trim();
      if (!value) return;
      const prefs = loadPrefs();
      if (!prefs.own.includes(value)) prefs.own.unshift(value);
      prefs.own = prefs.own.slice(0, 40);
      savePrefs(prefs); textarea.value = ''; renderOwnQuotes(); renderQuote();
    };
  }

  function renderOwnQuotes() {
    const list = $q('novaOwnQuoteList');
    if (!list) return;
    const prefs = loadPrefs();
    list.innerHTML = '';
    if (!prefs.own.length) {
      const empty = document.createElement('div');
      empty.className = 'muted'; empty.style.fontSize = '13px'; empty.textContent = 'No personal quotes yet.'; list.appendChild(empty); return;
    }
    prefs.own.forEach((text, index) => {
      const row = document.createElement('div'); row.className = 'nova-own-quote';
      const span = document.createElement('span'); span.textContent = text;
      const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Remove';
      button.onclick = () => { const latest = loadPrefs(); latest.own.splice(index, 1); savePrefs(latest); renderOwnQuotes(); renderQuote(); };
      row.append(span, button); list.appendChild(row);
    });
  }

  function openQuoteModal() {
    ensureQuoteModal();
    const prefs = loadPrefs();
    $q('novaQuoteCategory').value = prefs.category;
    $q('novaIncludeOwn').checked = prefs.includeOwn;
    renderOwnQuotes();
    $q('novaQuoteModal').classList.add('open');
    $q('novaQuoteModal').setAttribute('aria-hidden', 'false');
  }

  function closeQuoteModal() {
    $q('novaQuoteModal')?.classList.remove('open');
    $q('novaQuoteModal')?.setAttribute('aria-hidden', 'true');
  }

  function renderQuote() {
    const quote = $q('novaDailyQuote');
    const category = $q('novaQuoteQuickCategory');
    if (!quote || !category) return;
    const prefs = loadPrefs();
    quote.textContent = `“${quoteForToday(prefs)}”`;
    category.value = prefs.category;
  }

  function mountInspiration() {
    const dash = document.querySelector('.dash');
    const openstage = dash?.querySelector('.openstage');
    if (!dash || !openstage) return;
    ensureBookshelf();
    ensureQuoteModal();
    if (!$q('novaInspirationRow')) {
      const row = document.createElement('div');
      row.id = 'novaInspirationRow';
      row.className = 'nova-inspiration-row';
      row.innerHTML = `
        <section class="nova-quote-card" aria-label="Daily inspiration">
          <div><div class="nova-quote-label">Today’s shelf note</div><div id="novaDailyQuote" class="nova-daily-quote"></div></div>
          <div class="nova-quote-meta">
            <select id="novaQuoteQuickCategory" aria-label="Quote theme">
              <option value="focus">Focus</option><option value="calm">Calm</option><option value="creativity">Creativity</option><option value="courage">Courage</option>
            </select>
            <button id="novaShuffleQuote" type="button">Shuffle</button>
            <button id="novaCustomizeQuotes" type="button">My quotes</button>
          </div>
        </section>
        <section class="nova-art-card" aria-label="Decorative library art">
          <svg viewBox="0 0 240 140" role="img" aria-label="Pastel books and botanical line art">
            <rect x="25" y="101" width="188" height="7" rx="3.5" fill="#7b7096" opacity=".42"/>
            <rect x="43" y="45" width="28" height="56" rx="5" fill="#d9b0c3"/>
            <rect x="74" y="34" width="35" height="67" rx="5" fill="#a9c2ea"/>
            <rect x="112" y="52" width="27" height="49" rx="5" fill="#edd68f"/>
            <rect x="142" y="40" width="34" height="61" rx="5" fill="#b7ddca"/>
            <path d="M179 100 C187 77 197 64 214 55" fill="none" stroke="#776d90" stroke-width="3" stroke-linecap="round"/>
            <path d="M195 77 C188 68 185 60 187 52 C197 55 202 63 195 77Z" fill="#e7b6cb"/>
            <path d="M204 66 C207 54 213 47 222 44 C224 54 219 63 204 66Z" fill="#c6b9ed"/>
            <circle cx="31" cy="29" r="12" fill="#f4c8ac" opacity=".8"/>
            <path d="M25 29h12M31 23v12" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <span class="nova-art-note">make space for ideas</span>
        </section>`;
      dash.insertBefore(row, openstage);
      $q('novaQuoteQuickCategory').onchange = () => {
        const prefs = loadPrefs(); prefs.category = $q('novaQuoteQuickCategory').value; savePrefs(prefs); shuffleOffset = 0; renderQuote();
      };
      $q('novaShuffleQuote').onclick = () => { shuffleOffset += 1; renderQuote(); };
      $q('novaCustomizeQuotes').onclick = openQuoteModal;
    }
    renderQuote();
  }

  mountInspiration();
  setTimeout(mountInspiration, 250);
  const attachInspirationAuth = client => client?.auth?.onAuthStateChange?.(() => setTimeout(() => { mountInspiration(); renderQuote(); }, 50));
  if (typeof ensureBackend === 'function') {
    ensureBackend().then(attachInspirationAuth).catch(error => console.warn('Inspiration auth hook unavailable', error));
  } else if (typeof sb !== 'undefined' && sb?.auth) {
    attachInspirationAuth(sb);
  }
  const observer = new MutationObserver(() => {
    if (document.querySelector('#s3.screen.active')) mountInspiration();
  });
  observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['class'] });
})();
