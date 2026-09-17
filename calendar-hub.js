/* NOVA unified calendar hub: one entry point for NOVA calendar, Cal.com and .ics tools. */
(() => {
  'use strict';

  const CAL_URL = 'https://cal.com/reeta-devi-op8mu0';
  const HUB_ID = 'novaCalendarHub';
  const STYLE_ID = 'novaCalendarHubStyles';

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #novaScheduleBtn,#novaScheduleTodayBtn{display:none!important}
      .nova-hub-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:18px}
      .nova-hub-option{display:flex;align-items:flex-start;gap:11px;text-align:left;padding:14px;border:1px solid var(--line);border-radius:16px;background:var(--surface);color:var(--ink);cursor:pointer;transition:.18s}
      .nova-hub-option:hover{transform:translateY(-1px);border-color:color-mix(in srgb,var(--accent) 45%,var(--line));box-shadow:0 8px 24px rgba(65,55,88,.08)}
      .nova-hub-option.primary-option{background:linear-gradient(135deg,#efe7ff,#dfeaff);border-color:rgba(120,105,160,.22)}
      .nova-hub-icon{width:34px;height:34px;display:grid;place-items:center;flex:0 0 34px;border-radius:11px;background:var(--soft);color:var(--accent);font-weight:800;font-size:12px}
      .nova-hub-option b{display:block;font-size:12px;margin-bottom:3px}.nova-hub-option small{display:block;font-size:10px;line-height:1.45;color:var(--muted)}
      .nova-hub-note{margin-top:14px;padding:11px 12px;border-radius:13px;background:var(--surface2);font-size:10px;line-height:1.5;color:var(--muted)}
      body.dark .nova-hub-option.primary-option{background:linear-gradient(135deg,#413650,#35465d)}
      @media(max-width:600px){.nova-hub-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function hideLegacyScheduleButtons() {
    document.getElementById('novaScheduleBtn')?.remove();
    document.getElementById('novaScheduleTodayBtn')?.remove();
  }

  function openCal() {
    const legacy = document.getElementById('novaScheduleBtn');
    if (legacy) return legacy.click();
    window.open(CAL_URL, '_blank', 'noopener,noreferrer');
  }

  function enhanceCalendarTools() {
    const modal = document.getElementById('calendarToolsModal');
    if (!modal || modal.querySelector('#' + HUB_ID)) return;
    const card = modal.querySelector('.modal-card');
    if (!card) return;

    const heading = card.querySelector('h2');
    if (heading) heading.textContent = 'Add to calendar';
    const intro = card.querySelector('.inline p');
    if (intro) intro.textContent = 'Choose how you want to schedule, import, export or manage calendar time.';

    const oldActions = Array.from(card.querySelectorAll('#importIcsBtn,#exportIcsBtn,#newCalendarEventBtn'));
    oldActions.forEach(btn => { const p = btn.parentElement; if (p && p.children.length <= 3) p.style.display = 'none'; });

    const hub = document.createElement('div');
    hub.id = HUB_ID;
    hub.innerHTML = `
      <div class="nova-hub-grid">
        <button type="button" class="nova-hub-option primary-option" id="hubNovaEvent"><span class="nova-hub-icon">N</span><span><b>NOVA Calendar</b><small>Add a fixed event directly to your NOVA planner.</small></span></button>
        <button type="button" class="nova-hub-option" id="hubCal"><span class="nova-hub-icon">C</span><span><b>Cal.com</b><small>Book or share available meeting times.</small></span></button>
        <button type="button" class="nova-hub-option" id="hubImport"><span class="nova-hub-icon">↓</span><span><b>Import .ics</b><small>Bring events in from Google, Apple, Outlook or another calendar.</small></span></button>
        <button type="button" class="nova-hub-option" id="hubExport"><span class="nova-hub-icon">↑</span><span><b>Export .ics</b><small>Download your NOVA calendar for use in another calendar app.</small></span></button>
      </div>
      <div class="nova-hub-note"><b>Google Calendar:</b> create or open a NOVA event, then choose <b>Add to Google Calendar</b>. This keeps Google handoff simple without requiring full account sync.</div>`;

    const notice = card.querySelector('#calendarToolsNotice');
    card.insertBefore(hub, notice || null);

    hub.querySelector('#hubNovaEvent').onclick = () => document.getElementById('newCalendarEventBtn')?.click();
    hub.querySelector('#hubCal').onclick = () => openCal();
    hub.querySelector('#hubImport').onclick = () => document.getElementById('importIcsBtn')?.click();
    hub.querySelector('#hubExport').onclick = () => document.getElementById('exportIcsBtn')?.click();
  }

  function unifyMainButton() {
    ensureStyles();
    hideLegacyScheduleButtons();
    if (typeof calendarBtn !== 'undefined' && calendarBtn) {
      calendarBtn.textContent = 'Add to calendar';
      calendarBtn.title = 'Calendar, Cal.com and .ics options';
      calendarBtn.setAttribute('aria-label', 'Add to calendar');
      calendarBtn.addEventListener('click', () => setTimeout(enhanceCalendarTools, 0));
    }
    enhanceCalendarTools();
  }

  unifyMainButton();
  setTimeout(unifyMainButton, 300);
  setTimeout(unifyMainButton, 1000);

  const observer = new MutationObserver(() => {
    hideLegacyScheduleButtons();
    enhanceCalendarTools();
    if (typeof calendarBtn !== 'undefined' && calendarBtn && calendarBtn.textContent !== 'Add to calendar') {
      calendarBtn.textContent = 'Add to calendar';
      calendarBtn.title = 'Calendar, Cal.com and .ics options';
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();