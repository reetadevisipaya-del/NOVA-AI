/* NOVA universal built-in calendar UI. Loaded after calendar-sync.js. */
(() => {
  'use strict';

  const setupCalendar = document.querySelector('.permission[data-app="Calendar"]');
  const setupCalendarStatusId = 'setupCalendarStatus';

  function updateUniversalCalendarUI() {
    const signedIn = !!currentUser;
    if (calendarBtn) {
      calendarBtn.style.display = signedIn ? 'inline-block' : 'none';
      calendarBtn.setAttribute('aria-hidden', signedIn ? 'false' : 'true');
      calendarBtn.textContent = 'Calendar';
      calendarBtn.title = 'Import, export or manage your NOVA calendar';
    }
    if (!setupCalendar) return;
    setupCalendar.classList.toggle('active', signedIn);
    setupCalendar.setAttribute('aria-pressed', signedIn ? 'true' : 'false');
    const status = document.getElementById(setupCalendarStatusId);
    if (status) status.textContent = signedIn
      ? 'Built-in NOVA calendar · no Google connection required'
      : 'Available to every NOVA user · sign in to use';
  }

  if (setupCalendar) {
    const label = setupCalendar.querySelector('span:first-child');
    if (label) label.innerHTML = '<b>NOVA Calendar</b><small id="' + setupCalendarStatusId + '">Available to every NOVA user · sign in to use</small>';
    setupCalendar.onclick = event => {
      event.preventDefault();
      event.stopPropagation();
      if (!currentUser) return openAuth('login');
      calendarBtn?.click();
    };
  }

  const priorRenderCalendarButton = renderCalendarButton;
  renderCalendarButton = function () {
    priorRenderCalendarButton();
    updateUniversalCalendarUI();
  };

  sb.auth.onAuthStateChange(() => setTimeout(updateUniversalCalendarUI, 0));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') updateUniversalCalendarUI();
  });
  updateUniversalCalendarUI();
})();

/* NOVA personal inspiration image + readability polish. */
(() => {
  'use strict';

  const STYLE_ID = 'novaPersonalShelfStyles';
  const CARD_ID = 'novaPersonalImageCard';
  const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
  let loadedUserId = '__unset__';
  let loadingImage = false;

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .nova-inspiration-row{
        grid-template-columns:minmax(0,1.45fr) minmax(190px,.62fr) minmax(210px,.68fr)!important;
        gap:16px!important;
        align-items:stretch!important;
        padding:4px 0 10px;
      }
      .nova-quote-card,.nova-art-card,.nova-profile-card{
        min-height:190px!important;
        border-radius:24px!important;
        border:1px solid rgba(173,159,201,.28)!important;
        box-shadow:0 16px 34px rgba(83,71,112,.09)!important;
      }
      .nova-quote-card{
        padding:22px 24px!important;
        background:radial-gradient(circle at 12% 10%,rgba(255,255,255,.78),transparent 25%),linear-gradient(135deg,#fff1bd 0%,#fff8dd 48%,#ffe4d6 100%)!important;
      }
      .nova-quote-card:before{content:"";position:absolute;inset:12px;border:1px dashed rgba(122,108,168,.14);border-radius:17px;pointer-events:none}
      .nova-quote-label{font-size:11px!important;letter-spacing:.14em!important;color:#76677f!important}
      .nova-daily-quote{font-size:21px!important;line-height:1.48!important;font-weight:650!important;letter-spacing:-.012em!important;color:#3f3a4a!important;max-width:96%!important;position:relative;z-index:1}
      .nova-quote-meta{position:relative;z-index:1}
      .nova-quote-meta select,.nova-quote-meta button{height:36px!important;border-radius:11px!important;background:rgba(255,255,255,.68)!important;backdrop-filter:blur(8px)}

      .nova-profile-card{
        position:relative;
        overflow:hidden;
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        text-align:center;
        padding:24px 18px 18px;
        background:radial-gradient(circle at 88% 12%,rgba(255,255,255,.74),transparent 24%),linear-gradient(145deg,#f7dcea 0%,#efe7ff 52%,#ddeaff 100%);
      }
      .nova-profile-card:before{content:"PERSONAL SHELF";position:absolute;left:16px;top:14px;font-size:10px;line-height:1;font-weight:700;letter-spacing:.14em;color:#776987}
      .nova-profile-frame{position:relative;width:104px;height:104px;border-radius:20px;overflow:visible;margin:8px auto 12px;background:rgba(255,255,255,.66);border:5px solid rgba(255,255,255,.88);box-shadow:0 12px 28px rgba(96,80,127,.14),0 0 0 1px rgba(122,108,168,.12);transform:rotate(-1deg)}
      .nova-profile-frame:after{content:"";position:absolute;left:12px;right:12px;bottom:-9px;height:10px;border-radius:50%;background:rgba(77,65,104,.08);filter:blur(5px);z-index:-1}
      .nova-profile-frame img{width:100%;height:100%;display:block;object-fit:cover;border-radius:15px}
      .nova-profile-placeholder{width:100%;height:100%;border-radius:15px;display:grid;place-items:center;padding:13px;color:#756d80;font-size:12px;line-height:1.35;background:linear-gradient(145deg,rgba(255,255,255,.7),rgba(237,231,255,.7))}
      .nova-profile-plus{position:absolute;right:-10px;bottom:-10px;width:36px;height:36px;padding:0!important;border:3px solid #fff!important;border-radius:50%!important;display:grid;place-items:center;background:linear-gradient(135deg,#75659f,#9a8bc4)!important;color:#fff!important;font-size:23px!important;font-weight:500!important;line-height:1!important;box-shadow:0 8px 16px rgba(90,72,129,.24)!important;cursor:pointer}
      .nova-profile-plus:hover{transform:translateY(-1px) scale(1.04)!important}
      .nova-profile-title{font-size:15px;font-weight:700;color:#433d50;line-height:1.25}
      .nova-profile-copy{font-size:11px;line-height:1.45;color:#746d7e;margin-top:4px;max-width:180px}
      .nova-profile-actions{display:flex;align-items:center;gap:8px;margin-top:8px}
      .nova-profile-remove{border:0;background:transparent;color:#a25f73;font-size:11px;font-weight:700;padding:4px 6px;cursor:pointer}
      .nova-profile-status{font-size:10px;color:#6e6878;min-height:14px;margin-top:3px}

      /* Once a user adds an image, it becomes the entire card. */
      .nova-profile-card.has-image{padding:0!important;background:#e8e1ef!important}
      .nova-profile-card.has-image:before{display:none!important}
      .nova-profile-card.has-image .nova-profile-frame{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;margin:0!important;border:0!important;border-radius:24px!important;box-shadow:none!important;transform:none!important;overflow:hidden!important;background:#ddd!important}
      .nova-profile-card.has-image .nova-profile-frame:after{display:none!important}
      .nova-profile-card.has-image .nova-profile-frame img{width:100%!important;height:100%!important;object-fit:cover!important;border-radius:24px!important}
      .nova-profile-card.has-image .nova-profile-title,.nova-profile-card.has-image .nova-profile-copy,.nova-profile-card.has-image .nova-profile-status{display:none!important}
      .nova-profile-card.has-image .nova-profile-actions{position:absolute!important;top:12px!important;right:12px!important;z-index:5!important;margin:0!important}
      .nova-profile-card.has-image .nova-profile-remove{display:block!important;background:rgba(255,255,255,.84)!important;color:#755c70!important;border:1px solid rgba(255,255,255,.8)!important;border-radius:999px!important;padding:6px 10px!important;box-shadow:0 6px 16px rgba(43,35,56,.12)!important;backdrop-filter:blur(8px)}
      .nova-profile-card.has-image .nova-profile-plus{right:14px!important;bottom:14px!important;z-index:6!important;box-shadow:0 8px 20px rgba(54,42,79,.28)!important}

      .nova-art-card{background:linear-gradient(145deg,rgba(255,255,255,.25),transparent 34%),linear-gradient(145deg,#e8e1ff,#dfeaff 52%,#f8dbe7)!important}
      .nova-art-card:before{content:"READING ROOM";position:absolute;left:14px;top:12px;font-size:10px;font-weight:700;letter-spacing:.14em;color:#776d90;opacity:.8}
      .nova-art-note{font-size:10px!important;letter-spacing:.02em}
      .nova-inspiration-row:after{content:"";grid-column:1/-1;height:7px;margin-top:-6px;border-radius:999px;background:linear-gradient(90deg,#d3c4ef 0 20%,#bdd1f0 20% 43%,#f3bfd4 43% 66%,#f1d993 66% 82%,#bfe1d0 82%);box-shadow:0 4px 9px rgba(86,75,112,.08);opacity:.68}

      /* Diary: bolder, cleaner and less crowded. */
      .openpages{line-height:1.65!important}
      .date{font-size:30px!important;font-weight:700!important;line-height:1.2!important;margin-bottom:10px!important;letter-spacing:-.03em!important}
      .plan-note{font-size:14px!important;font-weight:500!important;line-height:1.65!important;margin-bottom:18px!important;max-width:92%!important}
      .plan{min-height:82px!important;gap:14px!important;padding:8px 0!important}
      .plan b{font-size:16px!important;font-weight:700!important;line-height:1.35!important;letter-spacing:-.01em!important}
      .plan small{font-size:13px!important;font-weight:500!important;line-height:1.5!important;margin-top:4px!important}
      .plan time{font-size:13px!important;font-weight:600!important}
      .whybox{font-size:13px!important;line-height:1.6!important;padding:10px 12px!important;margin-top:7px!important}
      .journal-entry-toolbar{padding:16px 18px!important;margin-bottom:20px!important}
      .journal-entry-toolbar .journal-copy{font-size:14px!important;font-weight:500!important;line-height:1.55!important}
      .journal-entry-toolbar .journal-copy strong{font-size:16px!important;font-weight:700!important;line-height:1.35!important;margin-bottom:3px!important}
      .journal-footer{padding-top:18px!important;margin-top:22px!important}
      .journal-footer-copy{font-size:14px!important;font-weight:500!important;line-height:1.55!important}
      .journal-footer-copy strong{font-size:16px!important;font-weight:700!important;margin-bottom:3px!important}
      .focus{margin-top:20px!important;padding:18px 20px!important}
      .focus b{font-size:16px!important;font-weight:700!important;line-height:1.4!important}
      .focus small{font-size:12.5px!important;font-weight:500!important;line-height:1.5!important}
      .stats{margin-top:18px!important;gap:12px!important}
      .stat{padding:16px!important}.stat b{font-weight:700!important}.stat small{font-size:12.5px!important;font-weight:500!important}

      /* Assistant: more readable hierarchy and breathing room. */
      .assistant{padding:30px!important}
      .assistant-head{padding-bottom:20px!important}
      .assistant-head h2{font-size:29px!important;font-weight:700!important;line-height:1.25!important;letter-spacing:-.025em!important}
      .assistant-head p{font-size:14px!important;font-weight:500!important;line-height:1.65!important;margin-top:7px!important}
      .messages{gap:12px!important;padding:20px 0!important;max-height:520px!important}
      .msg{font-size:15px!important;font-weight:500!important;line-height:1.65!important;padding:13px 15px!important;max-width:92%!important}
      .quick{gap:8px!important;margin-bottom:13px!important}
      .quick button{font-size:12.5px!important;font-weight:600!important;padding:8px 11px!important}
      .chat{gap:9px!important}
      .chat input{font-size:15px!important;font-weight:500!important;padding:0 14px!important;height:48px!important}
      .chat button{height:48px!important;width:48px!important;font-size:17px!important}

      body.dark .nova-profile-card{background:linear-gradient(145deg,#573e4d,#403a56 52%,#35465e)}
      body.dark .nova-profile-title{color:#f6f1ff}.nova-profile-copy{color:var(--muted)}
      body.dark .nova-profile-placeholder{background:rgba(255,255,255,.07);color:#d7cfe4}

      @media(max-width:1180px){
        .nova-inspiration-row{grid-template-columns:minmax(0,1.3fr) minmax(190px,.7fr)!important}
        .nova-art-card{grid-column:1/-1;min-height:145px!important}
      }
      @media(max-width:760px){
        .nova-inspiration-row{grid-template-columns:1fr!important}
        .nova-profile-card,.nova-art-card{grid-column:auto!important;min-height:190px!important}
        .nova-daily-quote{font-size:19px!important}
        .assistant{padding:20px!important}
        .msg{font-size:14px!important}
        .plan{min-height:76px!important}
        .plan b{font-size:15px!important}
      }
    `;
    document.head.appendChild(style);
  }

  function frameMarkup(dataUrl) {
    return dataUrl
      ? `<img src="${dataUrl}" alt="Your personal inspiration image">`
      : '<div class="nova-profile-placeholder">Add a photo, artwork, place, or anything that makes this space feel like yours.</div>';
  }

  function ensurePlusButton() {
    const frame = document.getElementById('novaProfileFrame');
    if (!frame || frame.querySelector('.nova-profile-plus')) return;
    const plus = document.createElement('button');
    plus.type = 'button';
    plus.className = 'nova-profile-plus';
    plus.setAttribute('aria-label', 'Add or change your personal image');
    plus.title = 'Add or change your image';
    plus.textContent = '+';
    plus.onclick = () => {
      if (!currentUser) return typeof openAuth === 'function' && openAuth('login');
      document.getElementById('novaProfileUpload')?.click();
    };
    frame.appendChild(plus);
  }

  function setImageState(hasImage) {
    const card = document.getElementById(CARD_ID);
    if (card) card.classList.toggle('has-image', !!hasImage);
  }

  async function loadStoredImage(force = false) {
    const frame = document.getElementById('novaProfileFrame');
    const remove = document.getElementById('novaProfileRemove');
    const status = document.getElementById('novaProfileStatus');
    if (!frame || loadingImage) return;

    const userId = currentUser?.id || null;
    if (!force && loadedUserId === userId && frame.dataset.ready === '1') return;
    loadingImage = true;

    try {
      if (!userId) {
        frame.innerHTML = frameMarkup('');
        setImageState(false);
        if (remove) remove.style.display = 'none';
        if (status) status.textContent = 'Sign in to save your image.';
        loadedUserId = null;
        frame.dataset.ready = '1';
        ensurePlusButton();
        return;
      }

      if (status) status.textContent = 'Loading your shelf…';
      const { data, error } = await sb.from('profiles').select('avatar_url').eq('id', userId).maybeSingle();
      if (error) throw error;
      const image = data?.avatar_url || '';
      frame.innerHTML = frameMarkup(image);
      setImageState(!!image);
      if (remove) remove.style.display = image ? 'inline-block' : 'none';
      if (status) status.textContent = image ? '' : 'Tap + to add your image.';
      loadedUserId = userId;
      frame.dataset.ready = '1';
      ensurePlusButton();
    } catch (error) {
      frame.innerHTML = frameMarkup('');
      setImageState(false);
      if (remove) remove.style.display = 'none';
      if (status) status.textContent = 'Could not load image.';
      loadedUserId = userId;
      frame.dataset.ready = '1';
      ensurePlusButton();
    } finally {
      loadingImage = false;
    }
  }

  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        try {
          const sourceW = img.naturalWidth || img.width;
          const sourceH = img.naturalHeight || img.height;
          const side = Math.min(sourceW, sourceH);
          const sx = Math.max(0, (sourceW - side) / 2);
          const sy = Math.max(0, (sourceH - side) / 2);
          const output = Math.min(900, side);
          const canvas = document.createElement('canvas');
          canvas.width = output;
          canvas.height = output;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, sx, sy, side, side, 0, 0, output, output);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.84);
          URL.revokeObjectURL(objectUrl);
          resolve(dataUrl);
        } catch (error) {
          URL.revokeObjectURL(objectUrl);
          reject(error);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Could not read this image.'));
      };
      img.src = objectUrl;
    });
  }

  async function handleUpload(file) {
    const status = document.getElementById('novaProfileStatus');
    if (!currentUser) return typeof openAuth === 'function' && openAuth('login');
    if (!file || !file.type.startsWith('image/')) {
      if (status) status.textContent = 'Choose an image file.';
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      if (status) status.textContent = 'Choose an image smaller than 8 MB.';
      return;
    }

    try {
      if (status) status.textContent = 'Saving your image…';
      const dataUrl = await compressImage(file);
      const { error } = await sb.from('profiles').upsert({
        id: currentUser.id,
        avatar_url: dataUrl,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
      if (error) throw error;
      loadedUserId = '__refresh__';
      document.getElementById('novaProfileFrame')?.removeAttribute('data-ready');
      await loadStoredImage(true);
    } catch (error) {
      if (status) status.textContent = error?.message || 'Could not save image.';
    }
  }

  async function removeImage() {
    if (!currentUser) return;
    const status = document.getElementById('novaProfileStatus');
    try {
      if (status) status.textContent = 'Removing image…';
      const { error } = await sb.from('profiles').update({
        avatar_url: null,
        updated_at: new Date().toISOString()
      }).eq('id', currentUser.id);
      if (error) throw error;
      loadedUserId = '__refresh__';
      document.getElementById('novaProfileFrame')?.removeAttribute('data-ready');
      await loadStoredImage(true);
    } catch (error) {
      if (status) status.textContent = error?.message || 'Could not remove image.';
    }
  }

  function mountPersonalShelf() {
    ensureStyles();
    const row = document.getElementById('novaInspirationRow');
    if (!row) return;

    let card = document.getElementById(CARD_ID);
    let created = false;
    if (!card) {
      created = true;
      card = document.createElement('section');
      card.id = CARD_ID;
      card.className = 'nova-profile-card';
      card.setAttribute('aria-label', 'Personal inspiration image');
      card.innerHTML = `
        <div id="novaProfileFrame" class="nova-profile-frame"></div>
        <div class="nova-profile-title">Your visual note</div>
        <div class="nova-profile-copy">Keep one image beside today’s quote — a memory, place, artwork or goal.</div>
        <div class="nova-profile-actions"><button id="novaProfileRemove" class="nova-profile-remove" type="button" style="display:none">Remove</button></div>
        <div id="novaProfileStatus" class="nova-profile-status"></div>
        <input id="novaProfileUpload" type="file" accept="image/*" hidden>`;
      const art = row.querySelector('.nova-art-card');
      if (art) row.insertBefore(card, art); else row.appendChild(card);

      document.getElementById('novaProfileUpload').addEventListener('change', event => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (file) void handleUpload(file);
      });
      document.getElementById('novaProfileRemove').onclick = () => void removeImage();
    }

    if (created || loadedUserId !== (currentUser?.id || null)) void loadStoredImage();
    else ensurePlusButton();
  }

  ensureStyles();
  setTimeout(mountPersonalShelf, 320);
  setTimeout(mountPersonalShelf, 900);

  const observer = new MutationObserver(() => {
    if (document.getElementById('novaInspirationRow') && !document.getElementById(CARD_ID)) mountPersonalShelf();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  sb.auth.onAuthStateChange(() => {
    loadedUserId = '__auth-change__';
    const frame = document.getElementById('novaProfileFrame');
    if (frame) frame.removeAttribute('data-ready');
    setTimeout(mountPersonalShelf, 80);
  });
})();
