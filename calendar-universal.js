/* NOVA final UI layer.
   Loads the last stable personal-shelf/calendar enhancement bundle, then applies
   the simplified action model requested for the final portfolio build. */
(() => {
  'use strict';

  const STYLE_ID = 'novaFinalActionStyles';
  const CREATE_MODAL_ID = 'novaCreateChoiceModal';

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      /* Remove Calendar and Schedule from the top bar completely. */
      #calendarBtn,#novaScheduleBtn{display:none!important}
      #addEventBtn,#addTaskBtn{display:none!important}

      /* Bold, pastel, high-contrast action styling. */
      .nova-create-btn,.nova-add-calendar-btn{
        font-weight:800!important;
        letter-spacing:.01em;
        border:1px solid rgba(113,96,151,.26)!important;
        box-shadow:0 9px 22px rgba(81,68,116,.11)!important;
        transition:transform .16s ease,box-shadow .16s ease;
      }
      .nova-create-btn{
        background:linear-gradient(135deg,#f5dceb 0%,#eadfff 48%,#dceaff 100%)!important;
        color:#4c4059!important;
      }
      .nova-add-calendar-btn{
        background:linear-gradient(135deg,#fff0b9 0%,#ffe0d1 52%,#ead9ff 100%)!important;
        color:#4a4054!important;
      }
      .nova-create-btn:hover,.nova-add-calendar-btn:hover{
        transform:translateY(-1px);
        box-shadow:0 12px 28px rgba(81,68,116,.16)!important;
      }

      .nova-create-overlay{position:fixed;inset:0;z-index:10020;display:none;place-items:center;padding:18px;background:rgba(24,20,31,.58);backdrop-filter:blur(8px)}
      .nova-create-overlay.open{display:grid}
      .nova-create-card{width:min(470px,100%);padding:24px;border:1px solid rgba(124,108,158,.24);border-radius:26px;background:var(--surface,#fff);box-shadow:0 28px 75px rgba(45,35,65,.24)}
      .nova-create-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:18px}
      .nova-create-head h2{font-size:29px!important;font-weight:800!important;letter-spacing:-.025em}
      .nova-create-head p{margin-top:5px!important;font-size:12px!important;font-weight:600!important;line-height:1.55!important;color:var(--muted,#777)!important}
      .nova-create-close{width:38px;height:38px;border:0;border-radius:12px;background:#efe7f7;color:#57496a;font-size:20px;font-weight:800;cursor:pointer}
      .nova-create-options{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      .nova-create-option{min-height:128px;padding:18px;text-align:left;border-radius:19px;border:1px solid rgba(121,104,155,.2);cursor:pointer;transition:.16s;box-shadow:0 9px 20px rgba(87,72,119,.07)}
      .nova-create-option:hover{transform:translateY(-2px);box-shadow:0 13px 26px rgba(87,72,119,.12)}
      .nova-create-option.task{background:linear-gradient(145deg,#e6ddff,#dbe9ff)}
      .nova-create-option.event{background:linear-gradient(145deg,#ffe2d3,#fff0b8)}
      .nova-create-option .nova-option-icon{width:38px;height:38px;border-radius:12px;display:grid;place-items:center;margin-bottom:13px;background:rgba(255,255,255,.76);font-size:18px;font-weight:900;color:#51435f}
      .nova-create-option b{display:block;font-size:15px;font-weight:800;color:#41364d;margin-bottom:4px}
      .nova-create-option small{display:block;font-size:11px;font-weight:600;line-height:1.5;color:#706477}

      /* Make key interface text stronger without losing the pastel aesthetic. */
      .topbar .actions .btn,.dashbuttons .btn,.kicker,.value b,.stat b,.assistant-head h2,.date,.plan b{font-weight:800!important}
      .quick button,.mini{font-weight:700!important}

      body.dark .nova-create-btn{background:linear-gradient(135deg,#533f55,#463b68)!important;color:#fff4fb!important}
      body.dark .nova-add-calendar-btn{background:linear-gradient(135deg,#65513c,#5a4056)!important;color:#fff5ea!important}
      body.dark .nova-create-option.task{background:linear-gradient(145deg,#493e63,#384d68)}
      body.dark .nova-create-option.event{background:linear-gradient(145deg,#654638,#64543b)}
      body.dark .nova-create-option b,body.dark .nova-create-option small{color:#f6f0ff}
      body.dark .nova-create-close{background:#40364b;color:#fff}

      @media(max-width:620px){
        .nova-create-options{grid-template-columns:1fr}
        .nova-create-option{min-height:112px}
      }
    `;
    document.head.appendChild(style);
  }

  function closeCreateChoice() {
    const modal = document.getElementById(CREATE_MODAL_ID);
    if (modal) modal.classList.remove('open');
    document.body.style.overflow = '';
  }

  function ensureCreateModal() {
    let modal = document.getElementById(CREATE_MODAL_ID);
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = CREATE_MODAL_ID;
    modal.className = 'nova-create-overlay';
    modal.setAttribute('role','dialog');
    modal.setAttribute('aria-modal','true');
    modal.setAttribute('aria-label','Add task or event');
    modal.innerHTML = `
      <div class="nova-create-card">
        <div class="nova-create-head">
          <div><h2>Add something</h2><p>Choose what you want to add to your NOVA day.</p></div>
          <button class="nova-create-close" type="button" aria-label="Close">×</button>
        </div>
        <div class="nova-create-options">
          <button id="novaChooseTask" class="nova-create-option task" type="button">
            <span class="nova-option-icon">✓</span><b>Add task</b><small>Create work NOVA can prioritise and place into your day.</small>
          </button>
          <button id="novaChooseEvent" class="nova-create-option event" type="button">
            <span class="nova-option-icon">◷</span><b>Add event</b><small>Add a fixed calendar commitment that protects that time.</small>
          </button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    modal.querySelector('.nova-create-close').onclick = closeCreateChoice;
    modal.onclick = event => { if (event.target === modal) closeCreateChoice(); };
    modal.querySelector('#novaChooseTask').onclick = () => {
      closeCreateChoice();
      if (typeof addTaskBtn !== 'undefined' && addTaskBtn) addTaskBtn.click();
    };
    modal.querySelector('#novaChooseEvent').onclick = () => {
      closeCreateChoice();
      if (typeof addEventBtn !== 'undefined' && addEventBtn) addEventBtn.click();
    };
    return modal;
  }

  function openCreateChoice() {
    if (typeof currentUser !== 'undefined' && !currentUser) {
      if (typeof openAuth === 'function') openAuth('login');
      return;
    }
    ensureCreateModal().classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function syncTopControls() {
    ensureStyles();

    if (typeof calendarBtn !== 'undefined' && calendarBtn) {
      calendarBtn.style.setProperty('display','none','important');
      calendarBtn.setAttribute('aria-hidden','true');
    }
    document.getElementById('novaScheduleBtn')?.remove();

    if (typeof addEventBtn === 'undefined' || typeof addTaskBtn === 'undefined') return;
    addEventBtn.style.setProperty('display','none','important');
    addTaskBtn.style.setProperty('display','none','important');

    const actions = document.querySelector('.topbar .actions');
    if (!actions) return;

    let combined = document.getElementById('novaCreateBtn');
    if (!combined) {
      combined = document.createElement('button');
      combined.id = 'novaCreateBtn';
      combined.type = 'button';
      combined.className = 'btn nova-create-btn';
      combined.textContent = '+ Event / Task';
      combined.title = 'Add a task or calendar event';
      combined.onclick = openCreateChoice;
      const anchor = document.getElementById('manageBtn') || document.getElementById('authBtn');
      actions.insertBefore(combined, anchor || actions.firstChild);
    }
    combined.style.display = (typeof currentUser !== 'undefined' && currentUser) ? 'inline-block' : 'none';
  }

  function syncTodayCalendarButton() {
    ensureStyles();
    document.getElementById('novaScheduleTodayBtn')?.remove();

    const dashButtons = document.querySelector('.dashbuttons');
    if (!dashButtons) return;

    let button = document.getElementById('novaAddCalendarTodayBtn');
    if (!button) {
      button = document.createElement('button');
      button.id = 'novaAddCalendarTodayBtn';
      button.type = 'button';
      button.className = 'btn nova-add-calendar-btn';
      button.textContent = 'Add to calendar';
      button.title = 'Open NOVA calendar, Cal.com and .ics options';
      button.onclick = () => {
        if (typeof currentUser !== 'undefined' && !currentUser) {
          if (typeof openAuth === 'function') openAuth('login');
          return;
        }
        if (typeof calendarBtn !== 'undefined' && calendarBtn) calendarBtn.click();
      };
      dashButtons.appendChild(button);
    }
  }

  function initRefinement() {
    ensureStyles();
    syncTopControls();
    syncTodayCalendarButton();

    setTimeout(syncTopControls,120);
    setTimeout(syncTodayCalendarButton,140);
    setTimeout(syncTopControls,650);
    setTimeout(syncTodayCalendarButton,700);

    // The dashboard/topbar already exist in the document, so initial sync + auth
    // updates are enough. A document-wide observer here can retrigger itself while
    // adding/removing controls and lock the main thread.
    const attachUiAuthHook = client => client?.auth?.onAuthStateChange?.(() => setTimeout(syncTopControls,0));
    if (typeof ensureBackend === 'function') {
      ensureBackend().then(attachUiAuthHook).catch(error => console.warn('NOVA action auth hook unavailable', error));
    } else if (typeof sb !== 'undefined' && sb?.auth) {
      attachUiAuthHook(sb);
    }

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeCreateChoice();
    });
  }

  initRefinement();
})();
