'use strict';
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lab = s => esc(String(s ?? '').replace(/_/g, ' '));
const zmw = n => 'ZMW ' + Number(n || 0).toFixed(2);
const TOKEN_RATE = 2; // 1 token = half a 1 ZMW (0.50 ZMW) -> 2 tokens = 1 ZMW
const toTokens = n => Math.round(Number(n || 0) * TOKEN_RATE);
const fromTokens = t => (Number(t || 0) / TOKEN_RATE);
const fmtTokens = t => Number(t || 0).toLocaleString() + ' Tokens';
const dt = s => esc(String(s || '').slice(0, 16));
const BASE = new URL(document.currentScript.src).pathname.replace(/\/assets\/js\/app\.js$/, '');
let csrf = null, me = null, unread = 0;

async function api(p, { m = 'GET', b, f } = {}) {
  const h = {};
  if (m !== 'GET') { if (!csrf) csrf = (await (await fetch(BASE + '/api/auth/csrf')).json()).data.csrf_token; h['X-CSRF-Token'] = csrf; }
  if (b) h['Content-Type'] = 'application/json';
  const r = await fetch(BASE + '/api' + p, { method: m, headers: h, body: f || (b ? JSON.stringify(b) : undefined) });
  const j = await r.json().catch(() => ({ message: 'Server error' }));
  if (!r.ok) { const e = new Error(j.message || 'Request failed'); e.status = r.status; e.errors = j.errors; throw e; }
  if (j.data && j.data.csrf_token) csrf = j.data.csrf_token;
  return j.data;
}
const post = (p, b, m = 'POST') => api(p, { m, b });
function toast(msg, err) { const t = $('#toast'); t.textContent = msg; t.className = err ? 'err' : ''; t.style.display = 'block'; clearTimeout(toast.t); toast.t = setTimeout(() => t.style.display = 'none', 3500); }
async function act(fn, ok) {
  try { const r = await fn(); if (ok) toast(ok); return r === undefined ? true : r; }
  catch (e) { toast(e.message + (e.errors ? ': ' + Object.values(e.errors).join(', ') : ''), 1); return null; }
}
function enhancePwFields(root = document) {
  root.querySelectorAll('input[type="password"]').forEach(inp => {
    if (inp.closest('.pw-wrap')) return;
    const wrap = document.createElement('div');
    wrap.className = 'pw-wrap';
    inp.parentNode.insertBefore(wrap, inp);
    wrap.appendChild(inp);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pw-toggle';
    btn.setAttribute('aria-label', 'Show password');
    btn.setAttribute('title', 'Show password');
    btn.innerHTML = '<i class="fa-solid fa-eye"></i>';
    wrap.appendChild(btn);
  });
}
function enhanceUploadFields(root = document) {
  root.querySelectorAll('[data-upload-zone]').forEach(zone => {
    if (zone.dataset.enhanced) return;
    zone.dataset.enhanced = '1';
    const input = zone.querySelector('.upload-input');
    const drop = zone.querySelector('.upload-drop');
    const previewGrid = zone.querySelector('.upload-preview-grid');
    const titleSpan = zone.querySelector('.upload-title');
    const subSpan = zone.querySelector('.upload-sub');
    const defaultTitle = titleSpan ? titleSpan.innerHTML : '';
    const defaultSub = subSpan ? subSpan.innerHTML : '';

    const updatePreviews = () => {
      const files = Array.from(input.files || []);
      previewGrid.innerHTML = '';
      if (!files.length) {
        previewGrid.style.display = 'none';
        if (titleSpan) titleSpan.innerHTML = defaultTitle;
        if (subSpan) subSpan.innerHTML = defaultSub;
        drop.classList.remove('has-files');
        return;
      }
      previewGrid.style.display = 'grid';
      drop.classList.add('has-files');
      if (titleSpan) {
        titleSpan.innerHTML = `<i class="fa-solid fa-circle-check" style="color:var(--g2);margin-right:4px"></i> <b>${files.length} ${files.length === 1 ? 'file' : 'files'} selected</b>`;
      }
      if (subSpan) {
        subSpan.innerHTML = 'Tap anytime to change selection';
      }

      files.forEach(file => {
        const card = document.createElement('div');
        card.className = 'upload-thumb-card';
        const isImg = file.type.startsWith('image/');
        const sz = file.size > 1048576 ? (file.size / 1048576).toFixed(1) + ' MB' : Math.round(file.size / 1024) + ' KB';

        if (isImg) {
          const img = document.createElement('img');
          img.src = URL.createObjectURL(file);
          img.alt = file.name;
          card.appendChild(img);
        } else {
          const docIcon = document.createElement('div');
          docIcon.className = 'upload-doc-tile';
          docIcon.innerHTML = `<i class="fa-solid fa-file-pdf"></i><span>${esc(file.name.slice(0, 14))}</span>`;
          card.appendChild(docIcon);
        }

        const tag = document.createElement('span');
        tag.className = 'upload-thumb-tag';
        tag.textContent = sz;
        card.appendChild(tag);

        previewGrid.appendChild(card);
      });
    };

    input.addEventListener('change', updatePreviews);

    ['dragenter', 'dragover'].forEach(ename => {
      drop.addEventListener(ename, e => {
        e.preventDefault();
        e.stopPropagation();
        drop.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(ename => {
      drop.addEventListener(ename, e => {
        e.preventDefault();
        e.stopPropagation();
        drop.classList.remove('dragover');
      });
    });

    drop.addEventListener('drop', e => {
      const dt = e.dataTransfer;
      if (dt && dt.files && dt.files.length) {
        input.files = dt.files;
        updatePreviews();
      }
    });
  });
}
const view = h => { $('#view').innerHTML = h; scrollTo(0, 0); enhancePwFields($('#view')); enhanceUploadFields($('#view')); };
const go = p => { location.hash = '#' + p; };
const back = () => route();

function fld(f) {
  const v = f.v ?? '', req = f.r ? ' required' : '';
  let i;
  if (f.t === 'select') i = `<select name="${f.n}">${f.o.map(([a, b]) => `<option value="${esc(a)}"${String(v) === String(a) ? ' selected' : ''}>${esc(b)}</option>`).join('')}</select>`;
  else if (f.t === 'textarea') i = `<textarea name="${f.n}" rows="3"${req}>${esc(v)}</textarea>`;
  else if (f.t === 'check') i = `<input type="checkbox" name="${f.n}" value="1">`;
  else if (f.t === 'file') {
    const isPdf = f.a && f.a.includes('pdf');
    const isMulti = f.n.endsWith('[]');
    const uid = 'up_' + Math.random().toString(36).slice(2, 9);
    i = `<div class="upload-zone" data-upload-zone>
      <input type="file" name="${f.n}" accept="${f.a || 'image/*'}"${isMulti ? ' multiple' : ''}${req} class="upload-input" id="${uid}">
      <label for="${uid}" class="upload-drop">
        <div class="upload-icon-wrap">
          <i class="fa-solid ${isPdf ? 'fa-file-arrow-up' : 'fa-cloud-arrow-up'}"></i>
        </div>
        <div class="upload-texts">
          <span class="upload-title"><b>Choose ${isPdf ? 'document' : (isMulti ? 'photos' : 'photo')}</b> or drag &amp; drop</span>
          <span class="upload-sub">${isPdf ? 'PDF or images · Max 5 MB' : (isMulti ? 'PNG, JPG, WebP · Up to 5 photos' : 'PNG, JPG, WebP · Max 5 MB')}</span>
        </div>
      </label>
      <div class="upload-preview-grid" style="display:none"></div>
    </div>`;
  }
  else if (f.t === 'password') i = `<div class="pw-wrap"><input name="${f.n}" type="password" value="${esc(v)}"${req}><button type="button" class="pw-toggle" aria-label="Show password" title="Show password"><i class="fa-solid fa-eye"></i></button></div>`;
  else i = `<input name="${f.n}" type="${f.t || 'text'}" value="${esc(v)}"${req}${f.s ? ` step="${f.s}"` : ''}>`;
  return `<label>${esc(f.l)}${i}</label>`;
}
function ask(title, fields, btn = 'Submit', note = '') {
  return new Promise(res => {
    const d = $('#dlg');
    const noteHtml = note ? (note.startsWith('<') ? note : `<p class="meta">${esc(note)}</p>`) : '';
    d.innerHTML = `<form id="af"><h3>${esc(title)}</h3>${noteHtml}${fields.map(fld).join('')}<div class="acts"><button type="button" class="btn sec" id="ac">Cancel</button><button class="btn pri">${esc(btn)}</button></div></form>`;
    enhancePwFields(d);
    enhanceUploadFields(d);
    d.onclose = () => res(null); $('#ac').onclick = () => d.close();
    $('#af').onsubmit = e => { e.preventDefault(); const fd = new FormData(e.target); res(fd); d.close(); };
    d.showModal();
  });
}
const obj = fd => Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === 'string'));
const confirmBox = async (t, btn = 'Confirm') => !!(await ask(t, [], btn));

const item = o => {
  const inner = `<div class="row"><b>${o.href ? `<a href="#${o.href}">${esc(o.t)}</a>` : esc(o.t)}</b>${o.badge ? `<span class="badge b-${esc(o.badge)}">${lab(o.badge)}</span>` : ''}</div>${o.m ? `<div class="meta">${o.m}</div>` : ''}${o.acts ? `<div class="acts">${o.acts.map(([l, a, id, c]) => `<button class="btn ${c || 'sec'}" data-a="${a}" data-id="${esc(id)}">${l}</button>`).join('')}</div>` : ''}`;
  let media = '';
  if (o.thumb) media = `<img class="item-thumb" src="${esc(o.thumb)}" alt="${esc(o.t)}" loading="lazy">`;
  else if (o.icon) media = `<div class="item-thumb-placeholder"><i class="fa-solid fa-${esc(o.icon)}"></i></div>`;
  if (media) return `<div class="item with-thumb">${media}<div class="item-content">${inner}</div></div>`;
  return `<div class="item">${inner}</div>`;
};
const seg = (items, cur) => `<div class="seg">${items.map(([h, l]) => `<a href="#${h}" class="${h === cur ? 'on' : ''}">${l}</a>`).join('')}</div>`;
const empty = t => `<p class="state"><i class="fa-regular fa-folder-open"></i><br>${esc(t)}</p>`;
const curPath = () => location.hash.slice(1).split('?')[0] || '/';
async function listPage(title, url, fn, { head = '', emptyText = 'Nothing here yet' } = {}) {
  const pg = +(new URLSearchParams(location.hash.split('?')[1] || '').get('p') || 1);
  const d = await api(url + (url.includes('?') ? '&' : '?') + 'page=' + pg);
  const pages = Math.ceil(d.total / d.per_page), base = '#' + curPath();
  view(`<h1>${esc(title)}</h1>${head}${d.items.map(fn).join('') || empty(emptyText)}${pages > 1 ? `<div class="acts">${pg > 1 ? `<a class="btn sec" href="${base}?p=${pg - 1}">Previous</a>` : ''}${pg < pages ? `<a class="btn sec" href="${base}?p=${pg + 1}">Next</a>` : ''}</div>` : ''}`);
}
const needRole = (...r) => { if (!me) { go('/login'); throw new Error('Please log in'); } if (r.length && !r.includes(me.role)) throw new Error('You do not have access to this page'); };

/* ---------- navigation ---------- */
const NAV = {
  guest: [['/', 'house', 'Home'], ['/explore/auctions', 'gavel', 'Market'], ['/how', 'circle-info', 'How it works'], ['/login', 'right-to-bracket', 'Login']],
  customer: [['/', 'house', 'Home'], ['/explore/auctions', 'gavel', 'Market'], ['/eco', 'leaf', 'Eco Action', 1], ['/orders/repairs', 'box', 'Orders'], ['/profile', 'user', 'Profile']],
  partner: [['/partner/jobs', 'screwdriver-wrench', 'Jobs'], ['/partner/waste', 'recycle', 'E-Waste'], ['/explore/auctions', 'gavel', 'Market'], ['/partner/earnings', 'wallet', 'Earnings'], ['/partner/profile', 'store', 'Shop']],
  courier: [['/courier', 'truck', 'Jobs'], ['/profile', 'user', 'Profile']],
  admin: [['/admin', 'chart-pie', 'Overview'], ['/admin/repairs', 'screwdriver-wrench', 'Repairs'], ['/admin/auctions', 'gavel', 'Market'], ['/admin/users', 'users', 'People'], ['/admin/more', 'ellipsis', 'More']]
};

const ADMIN_NAV = [
  {
    group: 'Management',
    items: [
      ['/admin', 'chart-pie', 'Dashboard Overview'],
      ['/admin/auctions', 'gavel', 'Market & Listings'],
      ['/admin/repairs', 'screwdriver-wrench', 'Repair Orders'],
      ['/admin/quotes', 'file-invoice-dollar', 'Quotation Review']
    ]
  },
  {
    group: 'Operations',
    items: [
      ['/admin/recycling', 'recycle', 'E-Waste Returns'],
      ['/admin/partners', 'store', 'Partner Shops'],
      ['/admin/couriers', 'truck-fast', 'Courier Jobs'],
      ['/admin/users', 'users', 'People & Wallets']
    ]
  },
  {
    group: 'Finance & System',
    items: [
      ['/admin/payments', 'credit-card', 'Payments'],
      ['/admin/finance', 'coins', 'Commissions & Reports'],
      ['/admin/settings', 'sliders', 'Platform Settings'],
      ['/admin/audit', 'clock-rotate-left', 'Audit Log']
    ]
  }
];

function renderAdminSidebar(cur) {
  const sb = $('#admin-sidebar');
  if (!sb) return;
  const groupsHtml = ADMIN_NAV.map(g => `
    <div class="admin-nav-group">
      <div class="admin-group-title">${esc(g.group)}</div>
      ${g.items.map(([p, icon, label]) => {
        const isActive = cur === p || (p !== '/admin' && cur.startsWith(p));
        return `<a href="#${p}" class="admin-nav-item${isActive ? ' active' : ''}">
          <i class="fa-solid fa-${icon}"></i>
          <span>${esc(label)}</span>
        </a>`;
      }).join('')}
    </div>
  `).join('');

  sb.innerHTML = `
    <div class="admin-sidebar-head">
      <a class="admin-brand-link" href="#/admin">
        <div class="admin-logo-icon"><i class="fa-solid fa-shield-halved"></i></div>
        <div class="admin-brand-text">
          <b>Techback</b>
          <span class="admin-brand-badge">ADMIN CONSOLE</span>
        </div>
      </a>
      <a class="admin-store-link" href="#/explore/auctions" title="View Marketplace storefront">
        <i class="fa-solid fa-store"></i> <span>Storefront</span>
      </a>
    </div>
    <div class="admin-sidebar-scroll">
      ${groupsHtml}
    </div>
    <div class="admin-sidebar-footer">
      <div class="admin-user-card">
        <div class="admin-user-avatar"><i class="fa-solid fa-user-shield"></i></div>
        <div class="admin-user-info">
          <div class="admin-user-name">${esc(me?.full_name || 'Administrator')}</div>
          <div class="admin-user-email">${esc(me?.email || '')}</div>
        </div>
      </div>
      <div class="admin-footer-acts">
        <a href="#/profile" class="admin-icon-btn" title="Admin profile & settings"><i class="fa-solid fa-gear"></i></a>
        <button type="button" class="admin-icon-btn dng" data-a="logout" title="Sign out"><i class="fa-solid fa-right-from-bracket"></i></button>
      </div>
    </div>
  `;
}

async function refreshUnread() { if (!me) { unread = 0; return; } try { unread = (await api('/notifications?per_page=1')).unread; } catch { unread = 0; } }

function chrome() {
  const cur = curPath(), isAdmin = me?.role === 'admin';
  const tokens = toTokens(me?.credit);
  const tokenLabel = isAdmin ? `${fmtTokens(tokens)} <small style="opacity:.85;font-weight:normal">(${zmw(me.credit || 0)})</small>` : fmtTokens(tokens);
  const tokenTitle = isAdmin ? `${fmtTokens(tokens)} (${zmw(me.credit || 0)} @ 1 token = half a 1 ZMW / 0.50 ZMW)` : `${fmtTokens(tokens)}`;

  if (isAdmin) {
    document.body.classList.add('is-admin');
    renderAdminSidebar(cur);
    $('#top').innerHTML = `
      <div class="bar admin-bar">
        <div class="admin-top-left">
          <button type="button" class="admin-menu-toggle" aria-label="Toggle Admin Navigation">
            <i class="fa-solid fa-bars"></i>
          </button>
          <div class="admin-top-title">
            <span class="admin-title-prefix"><i class="fa-solid fa-shield-halved"></i> Admin Portal</span>
          </div>
        </div>
        <div class="tools">
          <a class="ib" href="#/notifications" aria-label="Notifications">
            <i class="fa-solid fa-bell"></i>${unread ? `<i class="dot">${unread}</i>` : ''}
          </a>
          <a class="credit-pill admin-pill" href="#/admin/finance" title="${tokenTitle}" aria-label="Platform revenue">
            <i class="fa-solid fa-coins"></i><span>${tokenLabel}</span>
          </a>
        </div>
      </div>
    `;
  } else {
    document.body.classList.remove('is-admin', 'sidebar-open');
    const items = NAV[me ? me.role : 'guest'];
    const on = p => cur === p || (p !== '/' && cur.startsWith(p.split('/').slice(0, 2).join('/')) && p.split('/').length > 2 ? cur.startsWith(p.split('/').slice(0, 3).join('/')) : cur === p);
    $('#top').innerHTML = `<div class="bar"><a class="brand" href="#/"><i class="fa-solid fa-recycle"></i> Techback</a><nav aria-label="Main">${items.map(([p, i, l, pr]) => `<a href="#${p}" class="${on(p) ? 'on' : ''}${pr ? ' prim' : ''}"><i class="fa-solid fa-${i}"></i><span>${l}</span></a>`).join('')}</nav>
    <div class="tools">${me ? `<a class="ib" href="#/notifications" aria-label="Notifications"><i class="fa-solid fa-bell"></i>${unread ? `<i class="dot">${unread}</i>` : ''}</a><a class="credit-pill" href="${me.role === 'partner' ? '#/partner/waste' : '#/profile'}" title="${tokenTitle}" aria-label="Tokens"><i class="fa-solid fa-coins"></i><span>${tokenLabel}</span></a>` : `<a class="ib" href="#/register" aria-label="Register"><i class="fa-solid fa-user-plus"></i></a>`}</div></div>`;
  }
}

/* ---------- public pages ---------- */
const svc = [
  ['screwdriver-wrench', 'Repair a device', 'Vetted shops. Free collection for students on campus, Yango Deli off-campus. Fair quotes & tokens.', '/eco'],
  ['gavel', 'Auction a device or part', 'Sell dead devices or donor parts. Only drop off to our agents for verification. Paid when it sells.', '/eco'],
  ['recycle', 'Hand in for recycling', 'Hand in batteries, screens & scrap. Free for students on campus, drop off to agents off-campus. Earn tokens.', '/eco']
];
const pages = {
  how: ['How Techback works', `<div class="card">
    <b>1. Submit a Device</b>
    <p>Upload photos and describe your device to start tracking its journey.</p>
    <b>2. Collection &amp; Hand-over Rules</b>
    <p><b>Repairs:</b> Free collection and return for students on campus premises; Yango Deli for individuals off campus.</p>
    <p><b>Auctions:</b> Only drop off to our agents for physical inspection and verification before going live.</p>
    <p><b>Hand-in (Recycling):</b> Free collection for on-campus students; drop off to agents for off-campus individuals.</p>
    <b>3. Fair Review &amp; Quotation</b>
    <p>Techback reviews repair prices and verifies listing authenticity before work begins or auctions go live.</p>
    <b>4. Recover Value</b>
    <p>Get your repaired device back, get paid when your auction closes, or earn discount tokens for recycling.</p>
  </div>`],
  repair: ['Repair services', `<div class="card">
    <p>Send your device to certified partner shops working under verified data-protection standards.</p>
    <p><b>Collection Terms:</b> <b style="color:var(--g)">Free for students on campus premises</b>. <b style="color:#1a4d7d">Yango Deli</b> courier service applies for individuals who are off campus premises. Or drop it off directly at the partner shop or agent.</p>
  </div>`],
  'auction-info': ['Auctions', `<div class="card">
    <p><b style="color:#8a5006"><i class="fa-solid fa-store"></i> Only drop off to our agents:</b> Devices and spare parts submitted for auction must be dropped off to an authorized Techback agent for physical inspection and condition testing before going live on the marketplace.</p>
    <a class="btn pri" href="#/explore/auctions">View live auctions</a>
  </div>`],
  'recycle-info': ['Recycling and discount credits', `<div class="card">
    <p>Hand in dead batteries, broken screens, and electronic scrap. Earn discount tokens for your next repair!</p>
    <p><b>Collection Terms:</b> <b style="color:var(--g)">Free for students on campus premises</b>. <b style="color:#8a5006">Drop off to our agents</b> for individuals who are off campus.</p>
  </div>`],
  about: ['About Techback', `<div class="card"><p>Techback is a circular electronics marketplace for campus communities in Zambia. It cuts repair costs, supplies local technicians with parts and keeps e-waste out of open dumpsites.</p></div>`]
};
async function home() {
  if (me && me.role !== 'customer') return go(me.role === 'admin' ? '/admin' : me.role === 'partner' ? '/partner/jobs' : '/courier');
  let extra = '';
  if (me) { const d = await api('/repairs?per_page=3'); extra = `<h2>Your recent repairs</h2>${d.items.map(r => item({ t: `${r.brand} ${r.model}`, badge: r.status, href: '/repair/' + r.id, m: dt(r.created_at) })).join('') || empty('No repairs yet')}`; }
  view(`<div class="hero"><h1>Repair it. Circulate it. Recycle it.</h1><p>Never throw it away. Turn broken electronics into value and keep e-waste out of dumpsites.</p>
  <div style="display:flex;gap:.7rem;justify-content:center;flex-wrap:wrap"><a class="btn sec" href="${me ? '#/eco' : '#/register'}">${me ? 'Start now' : 'Get started'}</a><a class="btn pri" href="mvp-demo.html" target="_blank" style="background:#165e3e;font-weight:700"><i class="fa-solid fa-play"></i> View MVP Demo</a></div></div>
  <div class="grid">${svc.map(s => `<a class="card svc" href="#${me ? s[3] : '/register'}"><i class="fa-solid fa-${s[0]}"></i><h3>${s[1]}</h3><span class="meta">${s[2]}</span></a>`).join('')}</div>${extra}
  <div class="acts"><a class="btn sec" href="#/how">How it works</a><a class="btn sec" href="#/explore/auctions">Browse Market</a><a class="btn sec" href="#/contact">Contact</a></div>`);
}
async function contact() {
  view(`<h1>Contact</h1>
  <div class="card" style="text-align:center;max-width:520px;margin:.6rem auto">
    <p style="margin:.2rem 0;font-weight:700;color:var(--g)">eXchange Limited</p>
    <p style="margin:.3rem 0"><i class="fa-solid fa-phone" style="color:var(--g2);margin-right:6px"></i><a href="tel:0776840567">0776840567</a></p>
    <p style="margin:.3rem 0"><i class="fa-solid fa-envelope" style="color:var(--g2);margin-right:6px"></i><a href="mailto:voxreadstudio@gmail.com">voxreadstudio@gmail.com</a></p>
  </div>
  <form class="card" data-f="contact"><label>Name<input name="name" required></label><label>Email<input name="email" type="email" required></label><label>Message<textarea name="message" rows="4" required></textarea></label><button class="btn pri blk">Send message</button></form>`);
}
async function loginPage() { view(`<h1>Log in</h1><form class="card" data-f="login"><label>Email<input name="email" type="email" required autocomplete="username"></label><label>Password<div class="pw-wrap"><input name="password" type="password" required autocomplete="current-password"><button type="button" class="pw-toggle" aria-label="Show password" title="Show password"><i class="fa-solid fa-eye"></i></button></div></label><button class="btn pri blk">Log in</button><p class="meta">New here? <a href="#/register">Create an account</a></p></form>`); }
async function registerPage() { view(`<h1>Create account</h1><form class="card" data-f="register"><label>Full name<input name="full_name" required></label><label>Email<input name="email" type="email" required autocomplete="username"></label><label>Password (10+ characters)<div class="pw-wrap"><input name="password" type="password" minlength="10" required autocomplete="new-password"><button type="button" class="pw-toggle" aria-label="Show password" title="Show password"><i class="fa-solid fa-eye"></i></button></div></label><label>I am a<select name="account_type"><option value="customer">Customer (student or device owner)</option><option value="partner">Repair shop (partner application)</option></select></label><button class="btn pri blk">Register</button><p class="meta">Repair shops must submit documents and be approved by Techback before taking jobs.</p></form>`); }
async function pwPage() { view(`<h1>Change password</h1>${me?.must_change_password ? '<p class="card">You must set a new password before continuing.</p>' : ''}<form class="card" data-f="pw"><label>Current password<div class="pw-wrap"><input name="current_password" type="password" required><button type="button" class="pw-toggle" aria-label="Show password" title="Show password"><i class="fa-solid fa-eye"></i></button></div></label><label>New password (10+ characters)<div class="pw-wrap"><input name="new_password" type="password" minlength="10" required><button type="button" class="pw-toggle" aria-label="Show password" title="Show password"><i class="fa-solid fa-eye"></i></button></div></label><button class="btn pri blk">Update password</button></form>`); }

/* ---------- explore / listings ---------- */
const listingCard = l => {
  const isFixed = l.listing_type === 'refurbished' || l.listing_type === 'part';
  const defIcon = l.listing_type === 'part' ? 'puzzle-piece' : (l.listing_type === 'refurbished' ? 'mobile-screen-button' : (l.listing_type === 'component' ? 'microchip' : 'gavel'));
  return item({
    t: l.title,
    href: '/listing/' + l.id,
    thumb: l.photo_count ? `${BASE}/api/files/listings/${l.id}/0` : '',
    icon: defIcon,
    badge: l.status !== 'live' ? l.status : (l.listing_type === 'part' ? 'Spare Part' : lab(l.listing_type)),
    m: isFixed
      ? `${zmw(l.starting_price)}${l.warranty_days ? ' - ' + l.warranty_days + ' day warranty' : ''}`
      : `${l.current_bid ? 'Current bid ' + zmw(l.current_bid) : 'Starts at ' + zmw(l.starting_price)} - ${l.bid_count} bids${l.closes_at ? ' - closes ' + dt(l.closes_at) : ''}`
  });
};
async function explore(tab = 'auctions') {
  const qType = tab === 'parts' || tab === 'part' ? 'parts' : (tab === 'refurbished' ? 'refurbished' : 'auction');
  const d = await api('/auctions?type=' + qType);
  const partnerBar = me?.role === 'partner' ? `
    <div class="acts" style="justify-content:center;margin-bottom:1rem">
      <button class="btn pri" data-a="newPart"><i class="fa-solid fa-puzzle-piece"></i> List a Spare Part</button>
      <button class="btn sec" data-a="newRefurb"><i class="fa-solid fa-mobile-screen"></i> List Refurbished</button>
      <a class="btn sec" href="#/partner/listings"><i class="fa-solid fa-boxes-stacked"></i> My Listings</a>
    </div>` : '';
  view(`<h1>Market</h1>${seg([['/explore/auctions', 'Auctions'], ['/explore/refurbished', 'Refurbished Devices'], ['/explore/parts', 'Spare Parts']], '/explore/' + (tab === 'part' ? 'parts' : tab))}${partnerBar}${d.items.map(listingCard).join('') || empty('No live listings in this category right now')}`);
}
async function refurbished() { return explore('refurbished'); }
async function listing(id) {
  const l = await api('/auctions/' + id), isFixed = l.listing_type === 'refurbished' || l.listing_type === 'part';
  const defIcon = l.listing_type === 'part' ? 'puzzle-piece' : (l.listing_type === 'refurbished' ? 'mobile-screen-button' : (l.listing_type === 'component' ? 'microchip' : 'gavel'));
  let a = '';
  if (me?.role === 'partner' && l.status === 'live' && !isFixed) a = `<button class="btn pri blk" data-a="bid" data-id="${id}" data-min="${l.min_next_bid}">Place bid (min ${zmw(l.min_next_bid)})</button>`;
  if (me && isFixed && l.status === 'live' && me.id !== l.seller_id) a = `<button class="btn pri blk" data-a="inquire" data-id="${id}">I am interested / Inquire to buy</button>`;
  if (!me && l.status === 'live') a = `<a class="btn pri blk" href="#/login">Log in to ${isFixed ? 'inquire / buy' : 'bid'}</a>`;
  const gallery = l.photo_count ? `
    <div class="photos" style="margin:.9rem 0;justify-content:center">
      ${Array.from({ length: l.photo_count }, (_, i) => `<a target="_blank" rel="noopener" href="${BASE}/api/files/listings/${l.id}/${i}"><img src="${BASE}/api/files/listings/${l.id}/${i}" alt="Photo ${i + 1}" style="width:105px;height:105px;object-fit:cover;border-radius:10px;border:1px solid var(--bei)"></a>`).join('')}
    </div>` : `
    <div style="margin:.9rem auto;width:96px;height:96px;border-radius:16px;background:var(--s2);display:flex;align-items:center;justify-content:center;color:var(--g);font-size:2.2rem;border:1px solid var(--bei);box-shadow:inset 0 0 12px rgba(22,94,62,.06)">
      <i class="fa-solid fa-${defIcon}"></i>
    </div>`;
  view(`<h1>${esc(l.title)}</h1><div class="card" style="text-align:center">
    <div style="margin-bottom:.5rem"><span class="badge b-${esc(l.status)}">${lab(l.listing_type === 'part' ? 'Spare part' : l.listing_type)} - ${lab(l.status)}</span></div>
    ${gallery}
    <p style="text-align:left;margin:.9rem 0">${esc(l.description) || '<span class="meta">No description</span>'}</p>
    <p style="font-size:1.25rem;margin:.6rem 0"><b>${isFixed ? 'Price: ' + zmw(l.starting_price) : (l.current_bid ? 'Current bid ' + zmw(l.current_bid) : 'Starting price ' + zmw(l.starting_price))}</b></p>
    ${l.closes_at ? `<p class="meta">Closes ${dt(l.closes_at)}</p>` : ''}
    ${l.warranty_days ? `<p class="meta">${l.warranty_days} day warranty return period</p>` : ''}
    <div style="margin-top:1.1rem">${a}</div>
  </div>
  ${isFixed ? '' : `<h2>Bid history</h2>${l.bids.map(b => item({
    t: zmw(b.amount),
    badge: b.apply_token_discount == 1 ? (b.tokens_deducted > 0 ? `${b.token_discount_pct}% Discount (-${fmtTokens(b.tokens_deducted)})` : 'Token Discount: apply 1') : null,
    m: dt(b.created_at) + (b.shop_name ? ' - ' + esc(b.shop_name) : '')
  })).join('') || empty('No bids yet')}`}`);
}

/* ---------- customer: sell, orders, profile ---------- */
async function sell() {
  needRole('customer');
  const dv = await api('/customers/devices');

  const achievementHtml = d => {
    if (d.repair_id) {
      const isDone = ['repaired', 'delivered', 'completed'].includes(d.repair_status);
      const isWorking = ['in_transit', 'repairing'].includes(d.repair_status);
      return `<div class="device-achievement">
        <span class="achieve-step done"><i class="fa-solid fa-circle-check"></i> 1. Registered</span>
        <span class="achieve-divider done"></span>
        <span class="achieve-step done"><i class="fa-solid fa-circle-check"></i> 2. Repair Booked</span>
        <span class="achieve-divider ${isDone || isWorking ? 'done' : ''}"></span>
        <span class="achieve-step ${isDone ? 'done' : 'active'}"><i class="fa-solid ${isDone ? 'fa-circle-check' : 'fa-screwdriver-wrench'}"></i> 3. ${lab(d.repair_status)}</span>
        <a class="achieve-link" href="#/repair/${d.repair_id}">Track Repair &rarr;</a>
      </div>`;
    }
    if (d.auction_id) {
      const isSold = d.auction_status === 'sold' || d.auction_status === 'closed';
      const isLive = d.auction_status === 'live';
      return `<div class="device-achievement">
        <span class="achieve-step done"><i class="fa-solid fa-circle-check"></i> 1. Registered</span>
        <span class="achieve-divider done"></span>
        <span class="achieve-step done"><i class="fa-solid fa-circle-check"></i> 2. Market Listing</span>
        <span class="achieve-divider ${isSold || isLive ? 'done' : ''}"></span>
        <span class="achieve-step ${isSold ? 'done' : (isLive ? 'done' : 'active')}"><i class="fa-solid ${isSold ? 'fa-trophy' : (isLive ? 'fa-gavel' : 'fa-clock')}"></i> 3. ${lab(d.auction_status)}</span>
        <a class="achieve-link" href="#/listing/${d.auction_id}">View Listing &rarr;</a>
      </div>`;
    }
    return `<div class="device-achievement">
      <span class="achieve-step done"><i class="fa-solid fa-circle-check"></i> 1. Device Profile Registered</span>
      <span class="achieve-divider done"></span>
      <span class="achieve-step ready"><i class="fa-solid fa-circle-dot"></i> 2. Ready in Inventory (Repair, Auction or Recycle)</span>
    </div>`;
  };

  view(`<h1><i class="fa-solid fa-leaf" style="color:var(--g)"></i> Eco Action Hub</h1>
  <p class="meta" style="margin-top:-.4rem;margin-bottom:1.4rem">Circular Electronics &amp; Green Impact · Repair devices, auction donor parts, or hand in e-waste to earn tokens and protect the environment.</p>
  <div class="grid">
    <div class="card svc-card">
      <div class="svc-icon"><i class="fa-solid fa-screwdriver-wrench"></i></div>
      <b>Repair a device</b>
      <div class="svc-highlights">
        <span class="hl-badge hl-green"><i class="fa-solid fa-graduation-cap"></i> Free for Students</span>
        <span class="hl-badge hl-blue"><i class="fa-solid fa-motorcycle"></i> Yango Deli Off-Campus</span>
      </div>
      <button class="btn pri blk" data-a="sellRepair"><i class="fa-solid fa-screwdriver-wrench"></i> Book Repair</button>
    </div>
    <div class="card svc-card">
      <div class="svc-icon"><i class="fa-solid fa-gavel"></i></div>
      <b>Auction a device or part</b>
      <div class="svc-highlights">
        <span class="hl-badge hl-amber"><i class="fa-solid fa-store"></i> Only Drop off to our Agents</span>
        <span class="hl-subtext"><i class="fa-solid fa-shield-halved"></i> Agent inspection &amp; verification</span>
      </div>
      <button class="btn pri blk" data-a="sellAuction"><i class="fa-solid fa-gavel"></i> Submit Auction</button>
    </div>
    <div class="card svc-card">
      <div class="svc-icon"><i class="fa-solid fa-recycle"></i></div>
      <b>Hand in for recycling</b>
      <div class="svc-highlights">
        <span class="hl-badge hl-green"><i class="fa-solid fa-graduation-cap"></i> Free for Students</span>
        <span class="hl-badge hl-amber"><i class="fa-solid fa-person-walking-arrow-right"></i> Drop off to Agents (Off-Campus)</span>
      </div>
      <button class="btn pri blk" data-a="sellRecycle"><i class="fa-solid fa-recycle"></i> Hand in for Points</button>
    </div>
  </div>
  <div style="margin:1.2rem 0 2rem">
    <button class="card svc btn blk" data-a="addDevice" style="border:2px dashed var(--g);background:var(--s2);padding:1.15rem 1.4rem;display:flex;align-items:center;justify-content:center;gap:.9rem;font-size:1.02rem;text-align:left">
      <i class="fa-solid fa-cloud-arrow-up" style="font-size:1.6rem;color:var(--g);flex-shrink:0"></i>
      <div>
        <b style="color:var(--g);display:block;font-size:1.05rem">Upload / Register a Device</b>
        <span class="meta" style="font-weight:normal;display:block;font-size:.85rem;margin-top:2px">Upload photos and specs to begin · Free for students, Yango Deli off-campus, Auctions drop-off to agents only</span>
      </div>
    </button>
  </div>
  <h2>My registered devices</h2>
  ${dv.map(d => {
    const badgeClass = d.repair_status || d.auction_status || 'registered';
    return item({
      t: `${d.brand} ${d.model}`,
      thumb: d.photo_count ? `${BASE}/api/files/devices/${d.id}/0` : '',
      icon: 'mobile-screen',
      badge: badgeClass,
      m: `${d.condition_notes ? esc(d.condition_notes) + ' · ' : ''}Registered ${dt(d.created_at)}${achievementHtml(d)}`
    });
  }).join('') || empty('No devices registered yet. Upload a device above to begin tracking its process!')}`);
}
const catOpts = async kind => (await api('/categories')).filter(c => !kind || c.kind === kind).map(c => [c.id, c.name]);
const devOpts = async () => (await api('/customers/devices')).map(d => [d.id, `${d.brand} ${d.model}`]);
async function orders(tab) {
  needRole('customer'); const t = seg([['/orders/repairs', 'Repairs'], ['/orders/auctions', 'Auctions'], ['/orders/recycling', 'Recycling']], '/orders/' + tab);
  if (tab === 'repairs') return listPage('Orders', '/repairs', r => item({ t: `${r.brand} ${r.model}`, href: '/repair/' + r.id, icon: 'screwdriver-wrench', badge: r.status, m: `${dt(r.created_at)}${r.final_amount !== null ? ' - due ' + zmw(r.final_amount) : r.quote_amount ? ' - quote ' + zmw(r.quote_amount) : ''}` }), { head: t, emptyText: 'No repair requests yet' });
  if (tab === 'auctions') return listPage('Orders', '/auctions?mine=1', l => item({ t: l.title, href: '/listing/' + l.id, thumb: l.photo_count ? `${BASE}/api/files/listings/${l.id}/0` : '', icon: l.listing_type === 'part' ? 'puzzle-piece' : (l.listing_type === 'refurbished' ? 'mobile-screen-button' : 'gavel'), badge: l.status, m: l.current_bid ? 'Top bid ' + zmw(l.current_bid) : 'No bids yet' }), { head: t, emptyText: 'No auction submissions yet' });
  return listPage('Orders', '/recycling', r => item({ t: `${r.category} x${r.quantity}`, icon: 'recycle', badge: r.status, m: dt(r.created_at) + (r.credit_awarded ? ' - credit ' + zmw(r.credit_awarded) : '') }), { head: t, emptyText: 'No hand-ins yet' });
}
async function repairDetail(id) {
  needRole('customer', 'partner', 'admin'); const r = await api('/repairs/' + id), q = r.quotes[0];
  const photos = Array.from({ length: r.photo_count }, (_, i) => `<img src="${BASE}/api/files/devices/${r.device_id}/${i}" alt="Device photo ${i + 1}">`).join('');
  let acts = [], s = r.status;
  if (me.role === 'customer') {
    if (s === 'quoted') acts = [['Approve quotation', 'decide', id, 'pri'], ['Reject', 'reject', id, 'sec']];
    if (s === 'delivered') acts = [['Pay and complete', 'complete', id, 'pri']];
    if (s === 'completed' && !r.review) acts = [['Rate the shop', 'review', id, 'pri']];
    if (['unrepairable', 'rejected'].includes(s)) acts = [['Auction it', 'sellAuction', id, 'pri'], ['Recycle it', 'sellRecycle', id, 'sec']];
  } else if (me.role === 'partner') {
    if (s === 'awaiting_inspection') acts = [['Submit inspection', 'inspect', id, 'pri']];
    if (['inspected', 'price_review', 'submitted'].includes(s) && (s !== 'submitted' || r.fault_known == 1)) acts = [['Submit quotation', 'quote', id, 'pri']];
    if (['approved', 'in_transit'].includes(s)) acts = [['Start repair', 'st:repairing', id, 'pri']];
    if (s === 'repairing') acts = [['Mark repaired', 'st:repaired', id, 'pri'], ['Cannot be repaired', 'st:unrepairable', id, 'dng']];
    if (s === 'repaired' && r.handover === 'dropoff') acts = [['Handed back to customer', 'st:delivered', id, 'pri']];
  } else {
    if (!['completed', 'cancelled', 'unrepairable'].includes(s)) acts.push([r.assigned_shop_id ? 'Reassign shop' : 'Assign shop', 'assign', id, r.assigned_shop_id ? 'sec' : 'pri']);
    if (s === 'awaiting_inspection' && r.inspected_by === 'techback') acts.push(['Record inspection', 'inspect', id, 'pri']);
    if (['inspected', 'price_review'].includes(s) || (s === 'submitted' && r.fault_known == 1)) acts.push(['Set quotation', 'quote', id, 'sec']);
    if (['approved', 'in_transit'].includes(s)) acts.push(['Start repair', 'st:repairing', id, 'sec']);
    if (s === 'repairing') acts.push(['Mark repaired', 'st:repaired', id, 'sec']);
  }
  const shopMeta = r.shop_name
    ? `<span style="color:var(--g);font-weight:600"><i class="fa-solid fa-store"></i> Assigned Shop: ${esc(r.shop_name)}</span>`
    : '<span style="color:#d97706;font-weight:600"><i class="fa-solid fa-circle-exclamation"></i> No Shop Assigned Yet</span>';
  let tokenMeta = '';
  if (r.apply_token_discount == 1) {
    if (r.tokens_deducted > 0) {
      tokenMeta = `<br><span style="color:var(--g);font-weight:600"><i class="fa-solid fa-coins"></i> Token Discount Applied: ${r.token_discount_pct}% (-${fmtTokens(r.tokens_deducted)} / ${zmw(r.token_discount_amount)} saved) • Admin 5% Cut: ${zmw(r.token_admin_commission)}</span>`;
    } else {
      tokenMeta = `<br><span style="color:#047857;font-weight:600"><i class="fa-solid fa-coins"></i> Token Discount Requested: apply 1 (Customer Tokens: ${fmtTokens(r.customer_tokens || 0)})</span>`;
    }
  }
  const custMeta = r.customer ? `<div class="meta" style="margin-top:.3rem"><b>Customer:</b> ${esc(r.customer.full_name)} (${esc(r.customer.email)})${r.customer.phone ? ' • Phone: ' + esc(r.customer.phone) : ''}</div>` : '';
  view(`<h1>${esc(r.brand)} ${esc(r.model)}</h1><div class="card"><div class="row"><span>Repair #${r.id}</span><span class="badge b-${esc(s)}">${lab(s)}</span></div><p>${esc(r.fault_description)}</p><p class="meta">${shopMeta} • ${r.fault_known == 1 ? 'Known fault' : 'Unknown fault - inspection fee ' + zmw(r.inspection_fee)} • ${r.handover === 'courier' ? 'Courier' : 'Drop-off'}${tokenMeta}</p>${custMeta}<div class="photos">${photos}</div>${acts.length ? `<div class="acts">${acts.map(([l, a, i, c]) => `<button class="btn ${c}" data-a="${a}" data-id="${i}">${l}</button>`).join('')}</div>` : ''}</div>
  ${r.quotes.length ? `<h2>Quotations</h2>${r.quotes.map(x => item({ t: zmw(x.amount), badge: x.review_status, m: `Part discount ${zmw(x.part_discount)}${x.final_amount !== null ? ' - final ' + zmw(x.final_amount) : ''}${x.review_note ? ' - ' + esc(x.review_note) : ''}` })).join('')}` : ''}
  ${r.inspections.length ? `<h2>Inspection</h2>${r.inspections.map(x => item({ t: x.repairable == 1 ? 'Repairable' : 'Not repairable', m: esc(x.findings) })).join('')}` : ''}
  ${r.deliveries.length ? `<h2>Courier</h2>${r.deliveries.map(x => item({ t: lab(x.job_type), badge: x.status, m: `${esc(x.pickup_location)} to ${esc(x.destination_location)}` })).join('')}` : ''}
  <h2>Progress</h2><div class="tl">${r.history.map(h => `<div><b>${lab(h.status)}</b> <span class="meta">${dt(h.created_at)}${h.note ? ' - ' + esc(h.note) : ''}</span></div>`).join('')}</div>`);
}
async function profile() {
  needRole(); let h = `<h1>Profile</h1><div class="card" style="text-align:center"><b>${esc(me.full_name)}</b><div class="meta">${esc(me.email)} - ${lab(me.role)}</div></div>`;
  if (me.role === 'customer') {
    const [p, w, pay] = await Promise.all([api('/customers/profile'), api('/customers/wallet'), api('/customers/payments?per_page=10')]);
    if (w?.balance !== undefined) { me.credit = w.balance; chrome(); }
    const balTokens = toTokens(w.balance);
    const isAdmin = me.role === 'admin';
    const titleVal = isAdmin ? `Tokens: ${fmtTokens(balTokens)} <span class="meta">(${zmw(w.balance)} @ 1 token = half a 1 ZMW / 0.50 ZMW)</span>` : `Tokens: ${fmtTokens(balTokens)}`;
    h += `<div class="card" style="text-align:center"><div class="meta">${esc(p.phone || 'No phone')} - ${esc(p.address || 'No address')}</div><div class="acts"><button class="btn sec" data-a="editProfile">Edit profile</button></div></div>
    <h2>${titleVal}</h2>${w.transactions.map(t => item({ t: (t.amount > 0 ? '+' : '') + fmtTokens(toTokens(t.amount)) + (isAdmin ? ` (${(t.amount > 0 ? '+' : '') + zmw(t.amount)})` : ''), m: `${esc(t.reason)} - balance ${fmtTokens(toTokens(t.balance_after))} - ${dt(t.created_at)}` })).join('') || empty('No token activity yet')}
    <h2>Payments</h2>${pay.items.map(x => item({ t: zmw(x.amount), badge: x.status, m: `${lab(x.purpose)} - ${dt(x.created_at)}` })).join('') || empty('No payments yet')}`;
  }
  view(h + `<div class="acts"><a class="btn sec" href="#/change-password">Change password</a><a class="btn sec" href="#/about">About</a><a class="btn sec" href="#/contact">Contact</a><button class="btn dng" data-a="logout">Log out</button></div>`);
}
async function notifications() {
  needRole(); const d = await api('/notifications?per_page=30'); await post('/notifications/read'); unread = 0; chrome();
  view(`<h1>Notifications</h1>${d.items.map(n => item({ t: n.title, href: n.link ? n.link.slice(1) : '', m: `${esc(n.body)} ${dt(n.created_at)}` })).join('') || empty('No notifications')}`);
}

/* ---------- partner ---------- */
async function partnerJobs() { needRole('partner'); return listPage('Jobs', '/repairs', r => item({ t: `${r.brand} ${r.model}`, href: '/repair/' + r.id, badge: r.status, m: dt(r.created_at) }), { emptyText: 'No jobs assigned yet' }); }
async function partnerListings() {
  needRole('partner'); const d = await api('/auctions?mine=1');
  view(`<h1>Shop Listings (Parts & Refurbished)</h1>
  <div class="acts" style="justify-content:center;margin-bottom:1.2rem">
    <button class="btn pri" data-a="newPart"><i class="fa-solid fa-puzzle-piece"></i> List a Spare Part</button>
    <button class="btn sec" data-a="newRefurb"><i class="fa-solid fa-mobile-screen"></i> List Refurbished Device</button>
  </div>
  ${d.items.map(listingCard).join('') || empty('No shop listings yet. List spare parts or refurbished devices to start selling!')}`);
}
async function partnerEarnings() {
  needRole('partner'); const [e, b] = await Promise.all([api('/partners/earnings'), api('/partners/bids?per_page=10').catch(() => ({ items: [] }))]);
  const c = (l, v, h) => `<a class="card stat" ${h ? `href="#${h}"` : ''}><b>${v}</b>${l}</a>`;
  view(`<h1>Earnings & Points</h1><div class="grid">${c('Repair earnings paid', zmw(e.repair_earnings_paid))}${c('Repair earnings pending', zmw(e.repair_earnings_pending))}${c('Inspection fee shares', zmw(e.inspection_fee_shares))}${c('Completed jobs', e.completed_jobs)}${c('E-waste tokens', fmtTokens(toTokens(me?.credit || 0)), '/partner/waste')}${c('Auction purchases', zmw(e.auction_purchases))}</div><h2>My bids</h2>${b.items.map(x => item({ t: x.title, href: '/listing/' + x.listing_id, badge: x.leading == 1 ? 'leading' : x.status, m: `${zmw(x.amount)} - ${dt(x.created_at)}` })).join('') || empty('No bids yet')}`);
}
async function partnerWaste() {
  needRole('partner');
  const d = await api('/recycling');
  const totalPoints = toTokens(me?.credit || 0);
  view(`<h1>E-Waste Returns & Points</h1>
  <div class="card stat" style="max-width:480px;margin:.6rem auto"><b><i class="fa-solid fa-coins" style="color:#f5c518"></i> ${fmtTokens(totalPoints)}</b>Total Points / Tokens Earned</div>
  <p class="meta">Return broken device parts, dead batteries, and electronic scrap. Admin inspects and approves your return, awarding points directly to your wallet!</p>
  <button class="btn pri blk" data-a="returnWaste"><i class="fa-solid fa-recycle"></i> Return E-Waste for Points</button>
  <h2>My E-Waste Returns</h2>${d.items.map(r => item({
    t: `${r.category} x${r.quantity}`,
    badge: r.status,
    m: `${esc(r.description || 'No description')}<br>${r.credit_awarded ? '<b style="color:var(--g)">+' + fmtTokens(toTokens(r.credit_awarded)) + ' awarded</b>' : 'Awaiting admin approval'} - ${dt(r.created_at)}`
  })).join('') || empty('No e-waste returns yet')}`);
}
async function partnerProfile() {
  needRole('partner'); const s = await api('/partners/profile');
  view(`<h1>Shop profile</h1><div class="card"><div class="row"><b>${esc(s.shop_name)}</b><span class="badge b-${esc(s.status)}">${lab(s.status)}</span></div><div class="meta">${esc(s.address || 'No address set')}</div>${s.status !== 'verified' ? '<p class="meta">Submit a business registration and a signed data-protection agreement. An administrator reviews your application.</p>' : ''}<div class="acts"><button class="btn sec" data-a="editShop">Edit profile</button><button class="btn pri" data-a="uploadDoc">Upload document</button><a class="btn sec" href="#/partner/listings"><i class="fa-solid fa-boxes-stacked"></i> Shop Listings</a><a class="btn sec" href="#/partner/waste"><i class="fa-solid fa-recycle"></i> E-Waste & Points (${fmtTokens(toTokens(me?.credit || 0))})</a></div></div><h2>Documents</h2>${s.documents.map(d => item({ t: lab(d.doc_type), badge: d.status, m: dt(d.created_at) })).join('') || empty('No documents submitted')}<div class="acts"><a class="btn sec" href="#/change-password">Change password</a><button class="btn dng" data-a="logout">Log out</button></div>`);
}
async function courierJobs() {
  needRole('courier'); return listPage('Delivery jobs', '/couriers/assignments', a => {
    const n = { assigned: [['Picked up', 'cs:picked_up']], picked_up: [['In transit', 'cs:in_transit'], ['Delivered', 'cs:delivered']], in_transit: [['Delivered', 'cs:delivered']] }[a.status] || [];
    return item({ t: `${lab(a.job_type)} #${a.ref_id}`, badge: a.status, m: `From ${esc(a.pickup_location)}<br>To ${esc(a.destination_location)}`, acts: [...n.map(([l, x]) => [l, x, a.id, 'pri']), ...(['assigned', 'picked_up', 'in_transit'].includes(a.status) ? [['Failed', 'cs:failed', a.id, 'dng']] : [])] });
  }, { emptyText: 'No assignments' });
}

/* ---------- admin ---------- */
async function adminHome() {
  needRole('admin'); const s = await api('/admin/stats'); const c = (l, v, h) => `<a class="card stat" href="#${h}"><b>${v}</b>${l}</a>`;
  view(`<h1>Dashboard</h1><div class="grid">${c('Customers', s.customers, '/admin/users')}${c('Verified shops', s.verified_shops, '/admin/partners')}${c('Pending applications', s.pending_partners, '/admin/partners')}${c('Active repairs', s.active_repairs, '/admin/repairs')}${c('Pending quotations', s.pending_quotations, '/admin/quotes')}${c('Active auctions', s.active_auctions, '/admin/auctions')}${c('Completed auctions', s.completed_auctions, '/admin/auctions')}${c('Recycling requests', s.recycling_requests, '/admin/recycling')}${c('Pending couriers', s.pending_couriers, '/admin/couriers')}${c('Platform revenue', `${fmtTokens(toTokens(s.platform_revenue))} (${zmw(s.platform_revenue)})`, '/admin/finance')}${c('Admin commission', '5% coins on products', '/admin/settings')}</div>`);
}
const adminMore = () => { needRole('admin'); view(`<h1>More</h1>${[['/admin/quotes', 'Quotation review'], ['/admin/recycling', 'Recycling'], ['/admin/partners', 'Partner shops'], ['/admin/couriers', 'Couriers'], ['/admin/payments', 'Payments'], ['/admin/finance', 'Commissions and reports'], ['/admin/settings', 'Platform settings'], ['/admin/audit', 'Audit log'], ['/profile', 'My account']].map(([h, l]) => item({ t: l, href: h })).join('')}`); };
const adminRepairs = () => {
  needRole('admin');
  return listPage('Repair Orders', '/repairs', r => {
    const shopBadge = r.shop_name
      ? `<span class="badge" style="background:rgba(22,94,62,.1);color:var(--g);border:1px solid rgba(22,94,62,.2)"><i class="fa-solid fa-store"></i> ${esc(r.shop_name)}</span>`
      : `<span class="badge" style="background:rgba(217,119,6,.1);color:#d97706;border:1px solid rgba(217,119,6,.2)"><i class="fa-solid fa-circle-exclamation"></i> Unassigned</span>`;
    
    let tokenBadge = '';
    if (r.apply_token_discount == 1) {
      if (r.tokens_deducted > 0) {
        tokenBadge = `<span class="badge b-approved" style="font-weight:600"><i class="fa-solid fa-coins"></i> ${r.token_discount_pct}% Discount (-${fmtTokens(r.tokens_deducted)})</span>`;
      } else {
        tokenBadge = `<span class="badge" style="background:#ecfdf5;color:#047857;border:1px solid #a7f3d0;font-weight:600"><i class="fa-solid fa-coins"></i> Apply: 1 (${fmtTokens(r.customer_tokens || 0)} avail)</span>`;
      }
    }

    const cust = r.customer_name ? ` • Customer: <b>${esc(r.customer_name)}</b>` : '';
    const desc = r.fault_description ? `<div style="margin-top:.35rem;color:var(--t2);font-size:.88rem;line-height:1.3">${esc(r.fault_description)}</div>` : '';
    const price = r.final_amount !== null ? ` • Due: ${zmw(r.final_amount)}` : (r.quote_amount ? ` • Quote: ${zmw(r.quote_amount)}` : '');
    const isTerminal = ['completed', 'cancelled', 'unrepairable'].includes(r.status);
    const acts = [];
    if (!isTerminal) {
      acts.push([r.assigned_shop_id ? 'Reassign Shop' : 'Assign Shop', 'assign', r.id, r.assigned_shop_id ? 'sec' : 'pri']);
    }
    return item({
      t: `#${r.id} ${r.brand} ${r.model}`,
      href: '/repair/' + r.id,
      icon: 'screwdriver-wrench',
      badge: r.status,
      m: `<div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin:.25rem 0">${shopBadge}${tokenBadge}<span>${dt(r.created_at)}</span>${cust}${price}</div>${desc}`,
      acts: acts.length ? acts : null
    });
  }, { emptyText: 'No repair orders found' });
};
const adminQuotes = () => { needRole('admin'); return listPage('Quotation review', '/admin/quotes?review_status=pending', q => item({ t: `Repair #${q.repair_id}: ${zmw(q.amount)}`, m: `${esc(q.shop_name || 'Techback')} - discount ${zmw(q.part_discount)}`, acts: [['Review', 'qreview', q.id, 'pri']] }), { emptyText: 'No quotations awaiting review' }); };
async function adminAuctions() {
  needRole('admin'); const [p, l, t] = await Promise.all([api('/auctions?status=pending_inspection'), api('/auctions?status=live'), api('/admin/transactions?per_page=10')]);
  const defIcon = x => x.listing_type === 'part' ? 'puzzle-piece' : (x.listing_type === 'refurbished' ? 'mobile-screen-button' : (x.listing_type === 'component' ? 'microchip' : 'gavel'));
  view(`<h1>Market & Listings</h1><h2>Awaiting inspection</h2>${p.items.map(x => item({ t: x.title, thumb: x.photo_count ? `${BASE}/api/files/listings/${x.id}/0` : '', icon: defIcon(x), badge: x.listing_type === 'part' ? 'Spare part' : (x.listing_type === 'refurbished' ? 'Refurbished' : x.listing_type), m: 'Seller price ' + zmw(x.starting_price), acts: [['Approve', 'aapprove:' + x.listing_type, x.id, 'pri'], ['Reject', 'areject', x.id, 'dng']] })).join('') || empty('Nothing pending')}
  <h2>Live</h2>${l.items.map(x => {
    const isFixed = x.listing_type === 'refurbished' || x.listing_type === 'part';
    const desc = x.listing_type === 'part' ? 'Spare part ' + zmw(x.starting_price) : (x.listing_type === 'refurbished' ? 'Refurbished ' + zmw(x.starting_price) : `${x.bid_count} bids - top ${zmw(x.current_bid)} - closes ${dt(x.closes_at)}`);
    return item({ t: x.title, thumb: x.photo_count ? `${BASE}/api/files/listings/${x.id}/0` : '', icon: defIcon(x), href: '/listing/' + x.id, m: desc, acts: isFixed ? [['Remove', 'acancel', x.id, 'dng']] : [['Close now', 'aclose', x.id, 'sec'], ...(x.bid_count == 0 ? [['Cancel', 'acancel', x.id, 'dng']] : [])] });
  }).join('') || empty('No live listings')}
  <h2>Sales and payouts</h2>${t.items.map(x => item({ t: `${x.title}: ${zmw(x.sale_amount)}`, badge: x.payout_status, m: `${esc(x.seller)} receives ${zmw(x.seller_payout)} (5% coin commission: ${fmtTokens(toTokens(x.commission_amount))} / ${zmw(x.commission_amount)}) - buyer ${esc(x.buyer)}`, acts: x.payout_status === 'pending' ? [['Record payout', 'payout', x.id, 'pri']] : null })).join('') || empty('No completed sales')}`);
}
const adminRecycling = () => {
  needRole('admin');
  return listPage('E-Waste & Recycling', '/recycling', r => {
    const submitter = r.submitter_type === 'partner' ? `[Repair Shop] ${esc(r.submitter_name || r.customer)}` : `[Customer] ${esc(r.customer)}`;
    const pointsInfo = r.credit_awarded ? ` - <b style="color:var(--g)">+${fmtTokens(toTokens(r.credit_awarded))} awarded</b>` : ' - Awaiting approval';
    return item({
      t: `${r.category} x${r.quantity} - ${submitter}`,
      badge: r.status,
      m: `${esc(r.description || 'No description')}${pointsInfo} - ${dt(r.created_at)}`,
      acts: ['submitted', 'collected'].includes(r.status) ? [['Approve & Award Points', 'rinspect', r.id, 'pri']] : null
    });
  });
};
const adminPartners = () => { needRole('admin'); return listPage('Partner shops', '/admin/partners', s => item({ t: s.shop_name, badge: s.status, m: `${esc(s.email)} - ${s.documents} documents - rating ${Number(s.rating_avg).toFixed(1)} (${s.rating_count})`, acts: [['View documents', 'pdocs', s.id], ...(s.status !== 'verified' ? [['Verify', 'pv:verified', s.id, 'pri']] : [['Suspend', 'pv:suspended', s.id, 'dng']]), ...(s.status === 'pending' ? [['Reject', 'pv:rejected', s.id, 'dng']] : [])] })); };
const adminUsers = () => { needRole('admin'); const q = new URLSearchParams(location.hash.split('?')[1] || '').get('role') || ''; return listPage('People', '/admin/users' + (q ? '?role=' + q : ''), u => item({ t: u.full_name, badge: u.status, m: `${esc(u.email)} - ${lab(u.role)}`, acts: u.role === 'admin' ? null : [[u.status === 'active' ? 'Suspend' : 'Activate', 'ustatus:' + (u.status === 'active' ? 'suspended' : 'active'), u.id, 'sec'], ...(u.role === 'customer' ? [['Adjust tokens', 'uadjust', u.id]] : [])] }), { head: `${seg([['/admin/users', 'All'], ['/admin/users?role=customer', 'Customers'], ['/admin/users?role=courier', 'Couriers']], '/admin/users' + (q ? '?role=' + q : ''))}<button class="btn pri blk" data-a="newCourier">Add courier account</button>` }); };
const adminCouriers = () => { needRole('admin'); return listPage('Courier jobs', '/couriers/assignments', a => item({ t: `${lab(a.job_type)} - ${a.ref_type} #${a.ref_id}`, badge: a.status, m: `${esc(a.pickup_location)} to ${esc(a.destination_location)}<br>${a.courier ? esc(a.courier) + ' (' + esc(a.provider) + ')' : 'Unassigned'}`, acts: ['pending', 'assigned'].includes(a.status) ? [['Assign courier', 'cassign', a.id, 'pri']] : null }), { head: '<button class="btn sec blk" data-a="newJob">Create courier job</button>' }); };
const adminPayments = () => { needRole('admin'); return listPage('Payments', '/admin/payments', p => item({ t: zmw(p.amount), badge: p.status, m: `${lab(p.purpose)} - ${esc(p.payer)} - ${esc(p.method || '')} ${dt(p.created_at)}`, acts: p.status === 'pending' ? [['Confirm received', 'pconfirm', p.id, 'pri']] : null })); };
async function adminFinance() {
  needRole('admin'); const [r, c] = await Promise.all([api('/admin/reports'), api('/admin/commissions?per_page=15')]);
  view(`<h1>Revenue & Commissions</h1>
  <div class="card"><b>Admin Product Commission:</b> <span class="badge b-approved">5% Coins Cut</span><p class="meta">Ratio: 1 token = half a 1 ZMW (ZMW 0.50 per token; 2 tokens = 1 ZMW). Admin earns 5% commission in coins on completed product sales.</p></div>
  <h2>Revenue by fee type</h2>${r.revenue_by_fee.map(x => item({ t: lab(x.fee_type), m: `${x.entries} entries - gross ${zmw(x.gross)} - partner share ${zmw(x.partner_share)} - Techback cut: ${fmtTokens(toTokens(x.platform))} (${zmw(x.platform)})` })).join('') || empty('No revenue yet')}
  <h2>Repairs by status</h2>${r.repairs_by_status.map(x => item({ t: lab(x.status), m: x.total })).join('') || empty('No repairs')}
  <h2>Auctions by status</h2>${r.auctions_by_status.map(x => item({ t: lab(x.status), m: x.total })).join('') || empty('No auctions')}
  <h2>Tokens issued</h2>${item({ t: `${fmtTokens(toTokens(r.credits_issued[0]?.total))} (${zmw(r.credits_issued[0]?.total)})` })}
  <h2>Recent commissions (5% product cut)</h2>${c.items.map(x => item({ t: `${lab(x.fee_type)}: ${fmtTokens(toTokens(x.platform_amount))} (${zmw(x.platform_amount)})`, m: `Gross: ${fmtTokens(toTokens(x.gross_amount))} (${zmw(x.gross_amount)}) - ${dt(x.created_at)}` })).join('')}`);
}
async function adminSettings() {
  needRole('admin'); const s = await api('/admin/settings');
  view(`<h1>Platform settings</h1><form class="card" data-f="settings">${s.map(x => `<label>${esc(x.description)}<input name="${esc(x.setting_key)}" type="number" step="0.01" min="0" value="${esc(x.setting_value)}" required></label>`).join('')}<button class="btn pri blk">Save settings</button></form>`);
}
const adminAudit = () => { needRole('admin'); return listPage('Audit log', '/admin/audit', a => item({ t: a.action, m: `${esc(a.actor || 'system')} - ${esc(a.entity_type || '')} ${a.entity_id || ''} - ${dt(a.created_at)}` })); };

/* ---------- actions ---------- */
const A = {
  async logout() {
    await act(() => post('/auth/logout'));
    csrf = null; me = null; unread = 0;
    document.body.classList.remove('is-admin', 'sidebar-open');
    go('/'); route();
  },
  async addDevice() {
    const fd = await ask('Upload & Add Device', [
      { n: 'category_id', l: 'Device Type', t: 'select', o: await catOpts('device') },
      { n: 'brand', l: 'Brand (e.g. Apple, Samsung, HP)', r: 1 },
      { n: 'model', l: 'Model (e.g. iPhone 13, Galaxy S21)' },
      { n: 'condition_notes', l: 'Condition Notes & Appearance', t: 'textarea' },
      { n: 'photos[]', l: 'Device Photos (up to 5)', t: 'file', a: 'image/*' }
    ], 'Save Device', '<div class="dlg-notice"><i class="fa-solid fa-circle-info"></i> <b>Service Terms:</b> Repairs &amp; recycling are <b>Free for students on campus</b>, <b>Yango Deli</b> for off-campus individuals. Auctions are <b>Only drop-off to our agents</b>.</div>');
    if (fd && await act(() => api('/customers/devices', { m: 'POST', f: fd }), 'Device registered successfully')) back();
  },
  async sellRepair(devId) {
    const dv = await devOpts(); if (!dv.length) return toast('Add a device first', 1);
    const chosen = devId && dv.some(([val]) => String(val) === String(devId)) ? devId : undefined;
    const userTokens = toTokens(me?.credit || 0);
    const fields = [
      { n: 'device_id', l: 'Device', t: 'select', o: dv, v: chosen },
      { n: 'fault_known', l: 'Do you know what is wrong?', t: 'select', o: [['no', 'No - inspect it first (inspection fee applies)'], ['yes', 'Yes - give me a fixed price']] },
      { n: 'fault_description', l: 'Describe the fault', t: 'textarea', r: 1 },
      { n: 'handover', l: 'Collection & Hand-over', t: 'select', o: [['courier', 'Courier Collection (Free on campus for students · Yango Deli off campus)'], ['dropoff', 'I will drop it off at the shop or agent']] }
    ];
    if (userTokens > 0) {
      fields.push({ n: 'apply_token_discount', l: `Apply for Token Discount (You have ${fmtTokens(userTokens)} available)`, t: 'check' });
    }
    const noteHtml = `<div class="dlg-notice dlg-green"><i class="fa-solid fa-graduation-cap"></i> <b>Repairs: Free for students</b> on campus premises. <b>Yango Deli</b> courier applies for individuals off campus.${userTokens > 0 ? `<br><br><i class="fa-solid fa-coins"></i> <b>You have ${fmtTokens(userTokens)} available!</b> Check "Apply for Token Discount" to request an admin token discount on this repair order.` : ''}</div>`;
    const fd = await ask('Repair request', fields, 'Submit', noteHtml);
    if (!fd) return;
    const o = obj(fd);
    o.fault_known = o.fault_known === 'yes';
    o.apply_token_discount = o.apply_token_discount === '1' ? 1 : 0;
    const r = await act(() => post('/repairs', o), 'Repair request submitted' + (o.apply_token_discount ? ' (Token discount requested: apply 1)' : ''));
    if (r) go('/repair/' + r.id);
  },
  async sellAuction(devId) {
    const [dv, cat] = await Promise.all([devOpts(), catOpts('component')]);
    const chosen = devId && dv.some(([val]) => String(val) === String(devId)) ? devId : undefined;
    const fd = await ask('Submit Item to Market', [
      { n: 'listing_type', l: 'Listing Type', t: 'select', o: [['full_device', 'Full device'], ['component', 'A part or component']] },
      { n: 'device_id', l: 'Device (for full device)', t: 'select', o: dv.length ? dv : [['', 'No devices added']], v: chosen },
      { n: 'category_id', l: 'Category (for a part)', t: 'select', o: cat },
      { n: 'title', l: 'Title', r: 1 },
      { n: 'description', l: 'Description', t: 'textarea' },
      { n: 'photos[]', l: 'Photos (up to 5)', t: 'file', a: 'image/*' },
      { n: 'starting_price', l: 'Starting price (ZMW)', t: 'number', s: '0.01', r: 1 }
    ], 'Submit', '<div class="dlg-notice dlg-amber"><i class="fa-solid fa-store"></i> <b>Auctions: Only drop off to our agents.</b> Devices and spare parts must be dropped off to an authorized Techback agent for physical inspection and verification before going live.</div>');
    if (fd && await act(() => api('/auctions', { m: 'POST', f: fd }), 'Submitted for inspection')) go('/orders/auctions');
  },
  async sellRecycle() {
    const fd = await ask('Hand in for recycling', [
      { n: 'category_id', l: 'Category', t: 'select', o: await catOpts() },
      { n: 'quantity', l: 'Quantity', t: 'number', v: 1 },
      { n: 'description', l: 'Description', t: 'textarea' },
      { n: 'handover', l: 'Hand-over method', t: 'select', o: [['courier', 'Free Collection (On-campus students)'], ['dropoff', 'Drop off to our Agents (Off-campus individuals)']] },
      { n: 'pickup_address', l: 'Pickup address (if on-campus student courier collection)' }
    ], 'Submit', '<div class="dlg-notice dlg-green"><i class="fa-solid fa-recycle"></i> <b>E-Waste Recycling: Free for students</b> on campus premises. <b>Drop off to our agents</b> for individuals who are off campus.</div>');
    if (fd && await act(() => post('/recycling', obj(fd)), 'Hand-in submitted')) go('/orders/recycling');
  },
  async editProfile() { const p = await api('/customers/profile'); const fd = await ask('Edit profile', [{ n: 'full_name', l: 'Full name', v: p.full_name, r: 1 }, { n: 'phone', l: 'Phone', v: p.phone, t: 'tel' }, { n: 'student_number', l: 'Student number', v: p.student_number }, { n: 'address', l: 'Pickup address', v: p.address }], 'Save'); if (fd && await act(() => post('/customers/profile', obj(fd), 'PUT'), 'Profile updated')) { me.full_name = obj(fd).full_name; back(); } },
  async decide(id) {
    const r = await api('/repairs/' + id), q = r.quotes[0], w = await api('/customers/wallet');
    const maxTokens = toTokens(w.balance);
    const fd = await ask('Approve quotation', [
      { n: 'handin', l: `I will hand in the damaged part (saves ${zmw(q.part_discount)})`, t: 'check' },
      { n: 'tokens', l: `Use discount tokens (available: ${fmtTokens(maxTokens)})`, t: 'number', s: '1', v: 0 },
      ...(r.handover === 'courier' ? [{ n: 'pickup_address', l: 'Pickup address (leave blank to use your profile address)' }] : [])
    ], 'Approve ' + zmw(q.amount));
    if (fd) {
      const o = obj(fd);
      o.decision = 'approved';
      o.handin = o.handin === '1';
      const tok = Math.max(0, parseInt(o.tokens || 0, 10));
      o.credit = fromTokens(tok);
      if (await act(() => post(`/repairs/${id}/decision`, o), 'Quotation approved')) {
        try { me = await api('/auth/me'); chrome(); } catch {}
        back();
      }
    }
  },
  async reject(id) { if (await confirmBox('Reject this quotation?', 'Reject') && await act(() => post(`/repairs/${id}/decision`, { decision: 'rejected' }), 'Quotation rejected')) back(); },
  async complete(id) { const fd = await ask('Pay and complete', [{ n: 'payment_method', l: 'Payment method', t: 'select', o: [['mobile_money', 'Mobile money'], ['cash', 'Cash'], ['card', 'Card']] }], 'Confirm', 'Payments are recorded and confirmed by Techback. No online payment gateway is connected yet.'); if (fd && await act(() => post(`/repairs/${id}/complete`, obj(fd)), 'Repair completed')) back(); },
  async review(id) { const fd = await ask('Rate the shop', [{ n: 'rating', l: 'Rating (1-5)', t: 'select', o: [5, 4, 3, 2, 1].map(x => [x, x + ' of 5']) }, { n: 'comment', l: 'Comment', t: 'textarea' }], 'Submit'); if (fd) { const o = obj(fd); o.rating = +o.rating; if (await act(() => post(`/repairs/${id}/review`, o), 'Thank you')) back(); } },
  async inspect(id) { const fd = await ask('Inspection report', [{ n: 'findings', l: 'Findings', t: 'textarea', r: 1 }, { n: 'repairable', l: 'Device can be repaired', t: 'check' }, { n: 'extra_damage', l: 'Extra damage found', t: 'check' }], 'Submit'); if (fd) { const o = obj(fd); o.repairable = o.repairable === '1'; o.extra_damage = o.extra_damage === '1'; if (await act(() => post(`/repairs/${id}/inspection`, o), 'Inspection recorded')) back(); } },
  async quote(id) { const fd = await ask('Repair quotation', [{ n: 'amount', l: 'Repair price (ZMW)', t: 'number', s: '0.01', r: 1 }, { n: 'part_discount', l: 'Discount if customer hands in the damaged part (ZMW)', t: 'number', s: '0.01', v: 0 }], 'Submit', me.role === 'partner' ? 'Techback reviews every quotation for fairness before the customer sees it.' : ''); if (fd && await act(() => post(`/repairs/${id}/quotes`, obj(fd)), 'Quotation saved')) back(); },
  async assign(id) {
    const [res, r] = await Promise.all([
      api('/admin/partners?per_page=100'),
      api('/repairs/' + id)
    ]);
    const all = res.items || [];
    const verified = all.filter(s => s.status === 'verified');
    const list = verified.length ? verified : all;
    if (!list.length) return toast('No partner shops found. Please register or verify a shop first.', 1);

    const fields = [
      { n: 'shop_id', l: 'Select Partner Shop', t: 'select', o: list.map(s => [s.id, `${s.shop_name}${s.status !== 'verified' ? ' (' + lab(s.status) + ')' : ''}`]), v: r.assigned_shop_id || undefined },
      { n: 'inspected_by', l: 'Inspection Managed By', t: 'select', o: [['partner', 'Partner Shop (Shop conducts inspection)'], ['techback', 'Techback Hub (Techback conducts inspection)']], v: r.inspected_by || 'partner' }
    ];

    let noteHtml = '';
    if (r.apply_token_discount == 1) {
      const custTokens = r.customer_tokens || 0;
      noteHtml = `<div class="dlg-notice dlg-green" style="margin-bottom:.8rem">
        <i class="fa-solid fa-coins"></i> <b>Customer Requested Token Discount: apply 1</b><br>
        Customer Available Tokens: <b>${fmtTokens(custTokens)}</b> (${zmw(r.customer_token_balance || 0)}).<br>
        Enter discount % below. Customer tokens will be deducted, and <b>Admin earns 5% commission</b> on those tokens!
      </div>`;
      fields.push(
        { n: 'token_discount_pct', l: 'Apply Token Discount (%)', t: 'number', s: '1', v: r.token_discount_pct || 10 },
        { n: 'repair_estimate', l: 'Base Amount to Discount Against (ZMW)', t: 'number', s: '0.01', v: r.final_amount || r.quote_amount || r.inspection_fee || 100 }
      );
    }

    const fd = await ask('Assign Repair Order to Shop', fields, 'Assign Repair Order', noteHtml);
    if (fd && await act(() => post(`/repairs/${id}/assign`, obj(fd)), 'Repair job assigned and token discount processed!')) back();
  },
  async bid(id, b) {
    const userTokens = toTokens(me?.credit || 0);
    const fields = [
      { n: 'amount', l: 'Your bid (ZMW)', t: 'number', s: '0.01', v: b.dataset.min, r: 1 }
    ];
    if (userTokens > 0) {
      fields.push({ n: 'apply_token_discount', l: `Apply for Token Discount (${fmtTokens(userTokens)} available in your wallet)`, t: 'check' });
    }
    const note = userTokens > 0 ? '<div class="dlg-notice dlg-green"><i class="fa-solid fa-coins"></i> <b>Token Discount Available:</b> Check the box to apply for an admin token discount on your winning bid.</div>' : '';
    const fd = await ask('Place bid', fields, 'Bid', note);
    if (fd) {
      const o = obj(fd);
      o.amount = +o.amount;
      o.apply_token_discount = o.apply_token_discount === '1' ? 1 : 0;
      if (await act(() => post('/bids/' + id, o), 'Bid placed' + (o.apply_token_discount ? ' with token discount request (apply: 1)' : ''))) back();
    }
  },
  async inquire(id) { if (await act(() => post(`/auctions/${id}/inquire`, {}), 'The shop has been notified')) back(); },
  async newPart() {
    const cat = await catOpts('component');
    const fd = await ask('List Spare Part for Sale', [
      { n: 'category_id', l: 'Part Category', t: 'select', o: cat },
      { n: 'title', l: 'Part Title (e.g. iPhone 11 Display, Dell 65W Type-C Charger)', r: 1 },
      { n: 'starting_price', l: 'Sale Price (ZMW)', t: 'number', s: '0.01', r: 1 },
      { n: 'warranty_days', l: 'Warranty Days (0 for none)', t: 'number', v: 7 },
      { n: 'photos[]', l: 'Part Photos (up to 5)', t: 'file', a: 'image/*' },
      { n: 'description', l: 'Condition & Details (original, pulled from donor device, tested, etc.)', t: 'textarea' }
    ], 'Submit Part', 'An administrator reviews and approves the part before it goes live on the marketplace.');
    if (fd && await act(() => api('/partners/parts', { m: 'POST', f: fd }), 'Part submitted for admin review and approval!')) back();
  },
  async newRefurb() {
    const fd = await ask('List Refurbished Device', [
      { n: 'title', l: 'Device Title (e.g. Samsung Galaxy S21 128GB)', r: 1 },
      { n: 'starting_price', l: 'Price (ZMW)', t: 'number', s: '0.01', r: 1 },
      { n: 'warranty_days', l: 'Warranty Days', t: 'number', v: 30 },
      { n: 'photos[]', l: 'Device Photos (up to 5)', t: 'file', a: 'image/*' },
      { n: 'description', l: 'Condition, battery health & specifications', t: 'textarea' }
    ], 'Submit', 'An administrator approves listings before they appear on the marketplace.');
    if (fd && await act(() => api('/partners/refurbished', { m: 'POST', f: fd }), 'Submitted for approval')) back();
  },
  async editShop() { const s = await api('/partners/profile'); const fd = await ask('Shop profile', [{ n: 'shop_name', l: 'Shop name', v: s.shop_name, r: 1 }, { n: 'address', l: 'Address', v: s.address }], 'Save'); if (fd && await act(() => post('/partners/profile', obj(fd), 'PUT'), 'Saved')) back(); },
  async uploadDoc() { const fd = await ask('Upload document', [{ n: 'doc_type', l: 'Type', t: 'select', o: [['business_registration', 'Business registration'], ['dpa', 'Signed data-protection agreement'], ['id', 'Owner ID'], ['other', 'Other']] }, { n: 'file', l: 'File (image or PDF, max 5 MB)', t: 'file', a: 'image/*,application/pdf', r: 1 }], 'Upload'); if (fd && await act(() => api('/partners/documents', { m: 'POST', f: fd }), 'Document submitted')) back(); },
  async qreview(id) { const fd = await ask('Fair-price review', [{ n: 'review_status', l: 'Decision', t: 'select', o: [['approved', 'Approve price'], ['adjusted', 'Adjust price'], ['flagged_high', 'Flag as too high'], ['flagged_low', 'Flag as too low']] }, { n: 'amount', l: 'Adjusted price (only if adjusting)', t: 'number', s: '0.01' }, { n: 'note', l: 'Note' }], 'Save'); if (fd && await act(() => post(`/admin/quotes/${id}/review`, obj(fd)), 'Review saved')) back(); },
  async aapprove(id, b) { const isFixed = b.dataset.a.endsWith('refurbished') || b.dataset.a.endsWith('part'); const fd = await ask('Approve listing', [...(isFixed ? [] : [{ n: 'closes_at', l: 'Auction closes', t: 'datetime-local', r: 1 }, { n: 'listing_type', l: 'List as', t: 'select', o: [['full_device', 'Full device'], ['component', 'Parts']] }]), { n: 'starting_price', l: 'Starting price (ZMW, blank keeps seller price)', t: 'number', s: '0.01' }], 'Approve'); if (fd) { const o = obj(fd); o.decision = 'approve'; if (await act(() => post(`/admin/auctions/${id}/decision`, o), 'Listing is live')) back(); } },
  async areject(id) { if (await confirmBox('Reject this submission?', 'Reject') && await act(() => post(`/admin/auctions/${id}/decision`, { decision: 'reject' }), 'Rejected')) back(); },
  async acancel(id) { if (await confirmBox('Remove this listing?', 'Remove') && await act(() => post(`/admin/auctions/${id}/decision`, { decision: 'cancel' }), 'Listing removed')) back(); },
  async aclose(id) {
    const l = await api('/auctions/' + id);
    const topBid = l.bids && l.bids[0];
    if (topBid && topBid.apply_token_discount == 1) {
      const fd = await ask('Close Auction & Review Token Discount', [
        { n: 'token_discount_pct', l: 'Token Discount (%) for Winning Bid', t: 'number', s: '1', v: 10 }
      ], 'Close Auction', '<div class="dlg-notice dlg-green"><i class="fa-solid fa-coins"></i> <b>Winning bidder requested Token Discount (apply: 1)</b><br>Tokens will be deducted from the bidder, and <b>Admin earns 5% commission</b> in coins on the tokens deducted!</div>');
      if (fd) {
        const o = obj(fd);
        if (await act(() => post(`/admin/auctions/${id}/close`, o), 'Auction closed with token discount applied')) back();
      }
      return;
    }
    if (await confirmBox('Close this auction now and determine the winner?', 'Close') && await act(() => post(`/admin/auctions/${id}/close`, {}), 'Auction closed')) back();
  },
  async payout(id) { if (await confirmBox('Record that the seller has been paid out?', 'Record payout') && await act(() => post(`/admin/transactions/${id}/payout`, {}), 'Payout recorded')) back(); },
  async returnWaste() {
    const cat = await catOpts();
    const s = await api('/partners/profile').catch(() => ({}));
    const fd = await ask('Return E-Waste for Points', [
      { n: 'category_id', l: 'Waste Category', t: 'select', o: cat },
      { n: 'quantity', l: 'Quantity (pieces/units)', t: 'number', v: 1, r: 1 },
      { n: 'description', l: 'Description of waste (e.g. faulty screens, dead boards, scrap parts)', t: 'textarea', r: 1 },
      { n: 'handover', l: 'Hand-over method', t: 'select', o: [['dropoff', 'I will drop it off at collection point'], ['courier', 'Courier pickup from my shop']] },
      { n: 'pickup_address', l: 'Pickup address (if courier)', v: s.address || '' }
    ], 'Submit E-Waste', 'Admin will inspect and award points/tokens directly to your wallet upon approval.');
    if (fd && await act(() => post('/recycling', obj(fd)), 'E-waste return submitted! Awaiting admin approval.')) {
      try { me = await api('/auth/me'); chrome(); } catch {}
      back();
    }
  },
  async rinspect(id) {
    const rc = await api('/admin/recyclers');
    const fd = await ask('Approve E-Waste & Award Points', [
      { n: 'route', l: 'Route', t: 'select', o: [['recycler', 'Send to certified recycler'], ['auction', 'Reusable parts: list for auction'], ['reject', 'Reject return']] },
      { n: 'recycler_id', l: 'Recycler (if sending to recycler)', t: 'select', o: rc.length ? rc.map(r => [r.id, r.name]) : [['', 'Add a recycler first']] },
      { n: 'tokens_amount', l: 'Points / Tokens to award (1 token = half a 1 ZMW / 0.50 ZMW)', t: 'number', s: '1', v: 20, r: 1 },
      { n: 'title', l: 'Auction title (only if auction)' },
      { n: 'starting_price', l: 'Auction starting price (only if auction)', t: 'number', s: '0.01' }
    ], 'Approve & Award Points', 'Admin approval: the awarded points/tokens will be credited directly to the submitter\'s wallet.');
    if (fd) {
      const o = obj(fd);
      o.credit_amount = fromTokens(parseInt(o.tokens_amount || 0, 10));
      if (await act(() => post(`/admin/recycling/${id}/inspect`, o), 'E-waste approved and points awarded!')) back();
    }
  },
  async pdocs(id) { const d = await api(`/admin/partners/${id}/documents`); $('#dlg').innerHTML = `<h3>Documents</h3>${d.map(x => `<p><a target="_blank" rel="noopener" href="${BASE}/api/files/documents/${x.id}">${lab(x.doc_type)}</a> <span class="badge">${lab(x.status)}</span></p>`).join('') || '<p class="meta">None submitted</p>'}<button class="btn sec blk" id="ac">Close</button>`; $('#ac').onclick = () => $('#dlg').close(); $('#dlg').onclose = null; $('#dlg').showModal(); },
  async ustatus(id, b) { if (await act(() => post(`/admin/users/${id}/status`, { status: b.dataset.a.split(':')[1] }), 'User updated')) back(); },
  async uadjust(id) { const fd = await ask('Adjust tokens', [{ n: 'tokens', l: 'Tokens to adjust (positive to add, negative to deduct)', t: 'number', s: '1', r: 1 }, { n: 'reason', l: 'Reason (recorded in ledger)', r: 1 }], 'Apply', 'Ratio: 1 token = half a 1 ZMW (ZMW 0.50 per token; 2 tokens = 1 ZMW)'); if (fd) { const o = obj(fd); const tAmt = parseInt(o.tokens, 10) || 0; const zmwAmt = fromTokens(tAmt); if (await act(() => post('/admin/wallets/adjust', { user_id: +id, amount: zmwAmt, reason: `${o.reason} (${tAmt > 0 ? '+' : ''}${tAmt} tokens)` }), 'Tokens adjusted')) back(); } },
  async newCourier() { const fd = await ask('Add courier account', [{ n: 'full_name', l: 'Name', r: 1 }, { n: 'email', l: 'Email', t: 'email', r: 1 }, { n: 'password', l: 'Temporary password (10+ characters)', t: 'password', r: 1 }], 'Create', 'The courier must change this password on first login.'); if (fd && await act(() => post('/admin/couriers', obj(fd)), 'Courier account created')) back(); },
  async cassign(id) { const cs = (await api('/admin/users?role=courier&per_page=50')).items.filter(u => u.status === 'active'); if (!cs.length) return toast('Create a courier account first', 1); const fd = await ask('Assign courier', [{ n: 'courier_user_id', l: 'Courier', t: 'select', o: cs.map(c => [c.id, c.full_name]) }, { n: 'provider', l: 'Provider label', v: 'internal' }], 'Assign', 'External providers such as Yango are not connected. This records an internal assignment.'); if (fd && await act(() => post(`/admin/couriers/${id}/assign`, obj(fd)), 'Courier assigned')) back(); },
  async newJob() { const fd = await ask('Create courier job', [{ n: 'job_type', l: 'Type', t: 'select', o: ['auction_pickup', 'recycling_pickup', 'shop_to_recycler', 'repair_pickup', 'repair_return'].map(x => [x, x.replace(/_/g, ' ')]) }, { n: 'ref_type', l: 'Reference (repair, auction, recycling)', r: 1 }, { n: 'ref_id', l: 'Reference number', t: 'number', r: 1 }, { n: 'pickup_location', l: 'Collection location', r: 1 }, { n: 'destination_location', l: 'Destination', r: 1 }], 'Create'); if (fd && await act(() => post('/admin/couriers/jobs', obj(fd)), 'Job created')) back(); },
  async pconfirm(id) { if (await act(() => post(`/admin/payments/${id}/confirm`, {}), 'Payment confirmed')) back(); }
};
document.addEventListener('click', async e => {
  if (e.target.closest('.admin-menu-toggle')) {
    e.preventDefault();
    document.body.classList.toggle('sidebar-open');
    return;
  }
  if (e.target.closest('#admin-backdrop') || (e.target.closest('#admin-sidebar a') && window.innerWidth < 900)) {
    document.body.classList.remove('sidebar-open');
  }
  const pwt = e.target.closest('.pw-toggle');
  if (pwt) {
    e.preventDefault();
    const inp = pwt.closest('.pw-wrap')?.querySelector('input');
    if (inp) {
      const show = inp.type === 'password';
      inp.type = show ? 'text' : 'password';
      const ic = pwt.querySelector('i');
      if (ic) ic.className = show ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
      pwt.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      pwt.setAttribute('title', show ? 'Hide password' : 'Show password');
    }
    return;
  }
  const b = e.target.closest('[data-a]'); if (!b) return; const [k, arg] = b.dataset.a.split(':'), id = b.dataset.id;
  if (k === 'st') { const note = arg === 'unrepairable' ? await ask('Cannot be repaired', [{ n: 'note', l: 'Reason', t: 'textarea', r: 1 }], 'Confirm') : {}; if (arg === 'unrepairable' && !note) return; if (await act(() => post(`/repairs/${id}/status`, { status: arg, note: note?.get?.('note') }), 'Status updated')) back(); return; }
  if (k === 'pv') { if (await confirmBox(`Mark this shop as ${arg}?`) && await act(() => post(`/admin/partners/${id}/decision`, { decision: arg }), 'Partner updated')) back(); return; }
  if (k === 'cs') { const fd = await ask('Update delivery', [{ n: 'note', l: 'Note (optional)' }], 'Confirm ' + arg.replace(/_/g, ' ')); if (fd && await act(() => post(`/couriers/assignments/${id}/status`, { status: arg, note: fd.get('note') }), 'Delivery updated')) back(); return; }
  if (A[k]) A[k](id, b);
});
const F = {
  async login(f) { const o = obj(new FormData(f)); const r = await act(() => post('/auth/login', o)); if (!r) return; me = await api('/auth/me'); await refreshUnread(); go(me.must_change_password ? '/change-password' : '/'); route(); },
  async register(f) { const o = obj(new FormData(f)); if (await act(() => post('/auth/register', o), 'Account created. Please log in.')) go('/login'); },
  async contact(f) { if (await act(() => post('/contact', obj(new FormData(f))), 'Message sent')) f.reset(); },
  async pw(f) { if (await act(() => post('/auth/change-password', obj(new FormData(f))), 'Password updated')) { me = await api('/auth/me'); go('/'); route(); } },
  async settings(f) { if (await act(() => post('/admin/settings', { settings: obj(new FormData(f)) }, 'PUT'), 'Settings saved')) back(); }
};
document.addEventListener('submit', e => { const f = e.target.closest('form[data-f]'); if (f) { e.preventDefault(); F[f.dataset.f](f); } });

/* ---------- routing ---------- */
const R = [[/^\/$/, home], [/^\/how$/, () => pg('how')], [/^\/repair-services$/, () => pg('repair')], [/^\/auction-info$/, () => pg('auction-info')], [/^\/recycle-info$/, () => pg('recycle-info')], [/^\/about$/, () => pg('about')],
[/^\/contact$/, contact], [/^\/login$/, loginPage], [/^\/register$/, registerPage], [/^\/change-password$/, pwPage], [/^\/refurbished$/, refurbished], [/^\/explore\/(auctions|refurbished|parts|part)$/, explore], [/^\/explore$/, () => go('/explore/auctions')],
[/^\/listing\/(\d+)$/, listing], [/^\/(sell|eco|eco-action)$/, sell], [/^\/orders\/(repairs|auctions|recycling)$/, orders], [/^\/orders$/, () => go('/orders/repairs')], [/^\/repair\/(\d+)$/, repairDetail], [/^\/profile$/, profile], [/^\/notifications$/, notifications],
[/^\/partner\/jobs$/, partnerJobs], [/^\/partner\/waste$/, partnerWaste], [/^\/partner\/listings$/, partnerListings], [/^\/partner\/earnings$/, partnerEarnings], [/^\/partner\/profile$/, partnerProfile], [/^\/courier$/, courierJobs],
[/^\/admin$/, adminHome], [/^\/admin\/more$/, adminMore], [/^\/admin\/repairs$/, adminRepairs], [/^\/admin\/quotes$/, adminQuotes], [/^\/admin\/auctions$/, adminAuctions], [/^\/admin\/recycling$/, adminRecycling],
[/^\/admin\/partners$/, adminPartners], [/^\/admin\/users$/, adminUsers], [/^\/admin\/couriers$/, adminCouriers], [/^\/admin\/payments$/, adminPayments], [/^\/admin\/finance$/, adminFinance], [/^\/admin\/settings$/, adminSettings], [/^\/admin\/audit$/, adminAudit]];
const pg = k => view(`<h1>${esc(pages[k][0])}</h1>${pages[k][1]}`);
async function route() {
  const path = curPath();
  if (me?.must_change_password && path !== '/change-password') return go('/change-password');
  for (const [re, fn] of R) {
    const m = path.match(re); if (!m) continue;
    $('#view').innerHTML = '<p class="state"><i class="fa-solid fa-spinner fa-spin"></i> Loading</p>';
    try { await fn(...m.slice(1)); } catch (e) { if (e.status === 401) { me = null; go('/login'); } else if (e.message !== 'Please log in') view(`<p class="state err">${esc(e.message)}</p>`); }
    return chrome();
  }
  view(empty('Page not found')); chrome();
}
addEventListener('hashchange', route);
addEventListener('keydown', e => { if (e.key === 'Escape' && document.body.classList.contains('sidebar-open')) document.body.classList.remove('sidebar-open'); });
(async () => { try { me = await api('/auth/me'); await refreshUnread(); } catch { me = null; } route(); })();
