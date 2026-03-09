// app.js — AI Mail Organizer v4 — reply/ignore, real Gmail labels, scroll-to-load

(function () {
  if (document.getElementById('aimo-root')) return;

  /* ─── Helpers ─────────────────────────────────────────────── */
  const el   = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
  const div  = (cls, txt) => el('div', cls, txt);
  const span = (cls, txt) => el('span', cls, txt);
  const btn  = (cls, txt) => el('button', cls, txt);
  const add  = (parent, ...kids) => { kids.flat(9).forEach(k => k && parent.appendChild(k)); return parent; };
  const $    = id => document.getElementById(id);
  const cap  = s => s ? s[0].toUpperCase() + s.slice(1) : '';
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /* ─── CSS ─────────────────────────────────────────────────── */
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');
    #aimo-root,#aimo-fab{all:initial;font-family:'Nunito',sans-serif!important}
    #aimo-root *,#aimo-fab *{box-sizing:border-box;margin:0;padding:0;font-family:inherit}

    #aimo-root{position:fixed!important;top:0!important;right:-520px!important;width:500px!important;height:100vh!important;z-index:2147483647!important;transition:right .38s cubic-bezier(.4,0,.2,1)!important;filter:drop-shadow(-12px 0 32px rgba(100,60,220,.18))!important}
    #aimo-root.open{right:0!important}
    #aimo-panel{width:100%;height:100%;background:#fff;display:flex;flex-direction:column;overflow:hidden;border-left:3px solid #f0edff}

    #aimo-hdr{padding:18px 20px 14px;background:linear-gradient(135deg,#7c3aed 0%,#a855f7 50%,#ec4899 100%);flex-shrink:0;position:relative;overflow:hidden}
    #aimo-hdr::before{content:'';position:absolute;top:-30px;right:-20px;width:110px;height:110px;background:rgba(255,255,255,.08);border-radius:50%}
    #aimo-hdr-row{display:flex;align-items:center;justify-content:space-between;position:relative;z-index:1}
    #aimo-brand{display:flex;align-items:center;gap:10px}
    #aimo-icon{width:40px;height:40px;background:rgba(255,255,255,.22);border-radius:11px;display:flex;align-items:center;justify-content:center;font-size:20px}
    #aimo-title{font-size:17px;font-weight:900;color:#fff;letter-spacing:-.3px}
    #aimo-sub{font-size:10px;color:rgba(255,255,255,.72);font-weight:700;margin-top:1px}
    #aimo-close{width:30px;height:30px;background:rgba(255,255,255,.18);border:none;border-radius:8px;color:#fff;cursor:pointer;font-size:15px;display:flex;align-items:center;justify-content:center;transition:background .15s}
    #aimo-close:hover{background:rgba(255,255,255,.32)}
    #aimo-status-bar{margin-top:11px;background:rgba(255,255,255,.15);border-radius:20px;padding:5px 13px;display:flex;align-items:center;gap:7px;position:relative;z-index:1}
    .aimo-s-dot{width:7px;height:7px;border-radius:50%;background:#4ade80;flex-shrink:0;animation:aimo-blink 2s infinite}
    #aimo-s-txt{font-size:11px;color:rgba(255,255,255,.92);font-weight:700}

    #aimo-speed{padding:11px 20px;background:#fafbff;border-bottom:2px solid #f0edff;flex-shrink:0;display:flex;align-items:center;gap:10px}
    .aimo-sp-lbl{font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:1px;color:#a78bfa;flex-shrink:0}
    #aimo-tabs{display:flex;background:#f0edff;border-radius:10px;padding:3px;gap:2px;flex:1}
    .aimo-tab{flex:1;background:transparent;border:none;color:#8b5cf6;padding:6px 4px;border-radius:8px;cursor:pointer;font-size:11px;font-weight:800;transition:all .2s;text-align:center}
    .aimo-tab:hover{background:rgba(124,58,237,.1)}
    .aimo-tab.on{background:#7c3aed;color:#fff;box-shadow:0 2px 10px rgba(124,58,237,.35)}

    #aimo-body{flex:1;overflow-y:auto;padding:18px 20px;display:flex;flex-direction:column;gap:20px}
    #aimo-body::-webkit-scrollbar{width:5px}
    #aimo-body::-webkit-scrollbar-thumb{background:#e0d9ff;border-radius:3px}

    .aimo-sh{display:flex;align-items:center;gap:8px;margin-bottom:11px}
    .aimo-sh-ico{font-size:15px}
    .aimo-sh-txt{font-size:10px;font-weight:900;letter-spacing:.8px;text-transform:uppercase;color:#c4b5fd}
    .aimo-sh-line{flex:1;height:1px;background:linear-gradient(90deg,#ede9fe,transparent)}

    /* Email card */
    #aimo-email-wrap{background:#f9f8ff;border:2px solid #ede9fe;border-radius:16px;overflow:hidden;transition:border-color .25s,box-shadow .25s}
    #aimo-email-wrap.live{border-color:#a78bfa;box-shadow:0 4px 20px rgba(124,58,237,.12)}
    .aimo-empty-state{padding:26px 20px;text-align:center}
    .aimo-empty-ico{font-size:34px;margin-bottom:9px;display:block;animation:aimo-float 3s ease-in-out infinite}
    .aimo-empty-h{font-size:14px;font-weight:800;color:#7c3aed;margin-bottom:4px}
    .aimo-empty-d{font-size:12px;color:#a78bfa;line-height:1.65;font-weight:600}
    #aimo-card-head{padding:13px 15px 10px;background:linear-gradient(135deg,#faf5ff,#f5f3ff)}
    #aimo-card-subj{font-size:14px;font-weight:800;color:#1e1b4b;line-height:1.4;margin-bottom:5px}
    #aimo-card-from{display:flex;align-items:center;gap:6px}
    .aimo-avatar{width:20px;height:20px;border-radius:6px;background:linear-gradient(135deg,#7c3aed,#ec4899);display:flex;align-items:center;justify-content:center;font-size:10px;color:#fff;font-weight:800;flex-shrink:0}
    #aimo-from-name{font-size:11px;color:#6d28d9;font-weight:700}
    #aimo-card-foot{padding:11px 15px}
    #aimo-analyze-btn{width:100%;background:linear-gradient(135deg,#7c3aed,#a855f7);border:none;color:#fff;padding:11px 16px;border-radius:12px;cursor:pointer;font-size:13px;font-weight:800;transition:all .2s;letter-spacing:.2px}
    #aimo-analyze-btn:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 5px 18px rgba(124,58,237,.38)}
    #aimo-analyze-btn:disabled{opacity:.55;cursor:default;transform:none!important}
    #aimo-result-area{margin-top:10px}

    /* Result card */
    .aimo-result{background:#fff;border-radius:12px;border:2px solid #ede9fe;overflow:hidden;animation:aimo-popIn .3s cubic-bezier(.34,1.56,.64,1)}
    .aimo-res-top{padding:11px 14px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
    .aimo-cat-pill{display:inline-flex;align-items:center;gap:5px;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:800;border:1.5px solid transparent}
    .aimo-imp{display:flex;align-items:center;gap:4px;margin-left:auto;font-size:10px;font-weight:700;color:#64748b}
    .aimo-imp-dot{width:8px;height:8px;border-radius:50%}
    .aimo-res-body{padding:12px 14px;display:flex;flex-direction:column;gap:10px;background:#fafbff}
    .aimo-field{display:flex;flex-direction:column;gap:3px}
    .aimo-fl{font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:1px;color:#a78bfa}
    .aimo-fv{font-size:12px;color:#1e1b4b;font-weight:600;line-height:1.6}
    .aimo-action-chip{display:inline-flex;align-items:center;gap:5px;background:linear-gradient(135deg,#7c3aed14,#ec489914);color:#7c3aed;padding:5px 12px;border-radius:20px;font-size:11px;font-weight:800;border:1.5px solid #c4b5fd}
    .aimo-why{background:#fffbeb;border:1.5px solid #fde68a;border-radius:10px;padding:10px 12px}
    .aimo-why-lbl{font-size:9px;font-weight:900;letter-spacing:1px;text-transform:uppercase;color:#d97706;margin-bottom:2px}
    .aimo-why-txt{font-size:12px;color:#78350f;font-weight:600;line-height:1.6}

    /* ── Reply / Ignore buttons ── */
    .aimo-actions-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;padding:0 14px 12px}
    .aimo-reply-btn{background:linear-gradient(135deg,#059669,#10b981);border:none;color:#fff;padding:10px 12px;border-radius:11px;cursor:pointer;font-size:12px;font-weight:800;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:6px}
    .aimo-reply-btn:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 5px 16px rgba(5,150,105,.35)}
    .aimo-reply-btn:disabled{opacity:.5;cursor:default;transform:none!important}
    .aimo-ignore-btn{background:#fff;border:2px solid #e2e8f0;color:#64748b;padding:10px 12px;border-radius:11px;cursor:pointer;font-size:12px;font-weight:800;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:6px}
    .aimo-ignore-btn:hover{border-color:#f87171;color:#e11d48;background:#fff1f2}
    .aimo-reply-preview{background:#f0fdf4;border:2px solid #a7f3d0;border-radius:12px;padding:12px 14px;margin:0 14px 12px;animation:aimo-popIn .25s ease}
    .aimo-rp-lbl{font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:1px;color:#059669;margin-bottom:6px;display:flex;align-items:center;gap:5px}
    .aimo-rp-txt{font-size:12px;color:#1e1b4b;line-height:1.65;font-weight:600;white-space:pre-wrap;max-height:180px;overflow-y:auto}
    .aimo-rp-txt::-webkit-scrollbar{width:3px}
    .aimo-rp-txt::-webkit-scrollbar-thumb{background:#a7f3d0;border-radius:2px}
    .aimo-send-btn{width:calc(100% - 28px);margin:0 14px 14px;background:linear-gradient(135deg,#7c3aed,#a855f7);border:none;color:#fff;padding:11px;border-radius:11px;cursor:pointer;font-size:13px;font-weight:800;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:7px}
    .aimo-send-btn:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 5px 18px rgba(124,58,237,.38)}
    .aimo-send-btn:disabled{opacity:.5;cursor:default}

    /* Bulk */
    .aimo-bulk-note{font-size:12px;color:#8b5cf6;font-weight:600;line-height:1.7;margin-bottom:12px;background:#f5f3ff;border-radius:10px;padding:10px 13px;border:1.5px solid #ede9fe}
    #aimo-bulk-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px}
    .aimo-bulk-btn{background:#fff;border:2px solid #ede9fe;border-radius:14px;padding:16px 8px;cursor:pointer;text-align:center;transition:all .22s;display:flex;flex-direction:column;align-items:center;gap:4px}
    .aimo-bulk-btn:hover:not(:disabled){border-color:#7c3aed;background:#faf5ff;transform:translateY(-3px);box-shadow:0 6px 20px rgba(124,58,237,.18)}
    .aimo-bulk-btn:disabled{opacity:.45;cursor:default}
    .aimo-bn{font-size:26px;font-weight:900;color:#7c3aed;line-height:1}
    .aimo-bl{font-size:9px;color:#a78bfa;font-weight:800;letter-spacing:.5px;text-transform:uppercase}
    #aimo-label-btn{width:100%;background:linear-gradient(135deg,#059669,#10b981);border:none;color:#fff;padding:12px;border-radius:12px;cursor:pointer;font-size:12px;font-weight:800;transition:all .2s;display:none;align-items:center;justify-content:center;gap:7px}
    #aimo-label-btn:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 5px 16px rgba(5,150,105,.35)}
    #aimo-label-btn:disabled{opacity:.5;cursor:default;transform:none!important}
    #aimo-label-progress{margin-top:8px;display:none}
    .aimo-lp-bar-wrap{background:#e2e8f0;border-radius:10px;height:6px;overflow:hidden;margin-bottom:5px}
    .aimo-lp-bar{background:linear-gradient(90deg,#7c3aed,#ec4899);height:100%;border-radius:10px;transition:width .4s ease;width:0%}
    .aimo-lp-txt{font-size:10px;color:#7c3aed;font-weight:700;text-align:center}

    /* Groups */
    #aimo-groups{display:flex;flex-direction:column;gap:12px;margin-top:4px}
    .aimo-group{background:#fff;border:2px solid #ede9fe;border-radius:14px;overflow:hidden;animation:aimo-popIn .3s ease}
    .aimo-group-hdr{padding:10px 14px;display:flex;align-items:center;gap:8px;cursor:pointer;transition:background .15s;user-select:none}
    .aimo-group-hdr:hover{background:#f9f8ff}
    .aimo-group-ico{font-size:17px}
    .aimo-group-name{font-size:13px;font-weight:900;flex:1}
    .aimo-group-count{padding:2px 10px;border-radius:20px;font-size:11px;font-weight:800}
    .aimo-group-chev{font-size:11px;color:#c4b5fd;transition:transform .2s}
    .aimo-group-chev.open{transform:rotate(180deg)}
    .aimo-group-list{border-top:1.5px solid #f0edff;max-height:0;overflow:hidden;transition:max-height .35s ease}
    .aimo-group-list.open{max-height:2000px}
    .aimo-email-row{padding:10px 14px;display:flex;align-items:flex-start;gap:10px;border-bottom:1px solid #f5f3ff;transition:background .12s}
    .aimo-email-row:last-child{border-bottom:none}
    .aimo-email-row:hover{background:#faf5ff}
    .aimo-er-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;margin-top:4px}
    .aimo-er-info{flex:1;min-width:0}
    .aimo-er-subj{font-size:12px;font-weight:800;color:#1e1b4b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .aimo-er-from{font-size:10px;color:#8b5cf6;font-weight:700;margin:1px 0}
    .aimo-er-sum{font-size:11px;color:#64748b;line-height:1.5;font-weight:600}
    .aimo-er-act{font-size:10px;color:#7c3aed;font-weight:800;margin-top:2px}
    #aimo-summary-bar{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:11px}
    .aimo-sum-chip{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:16px;font-size:11px;font-weight:800;border:1.5px solid transparent}

    /* Skeletons */
    .aimo-sk{background:linear-gradient(90deg,#f0edff 25%,#e9e4ff 50%,#f0edff 75%);background-size:200% 100%;animation:aimo-shimmer 1.5s infinite;border-radius:6px;height:12px;margin-bottom:8px}
    .sk-f{width:100%}.sk-m{width:65%}.sk-s{width:40%}

    /* Error */
    .aimo-err{padding:12px 14px;background:#fff1f2;border:2px solid #fecdd3;border-radius:12px;color:#e11d48;font-size:12px;font-weight:700;line-height:1.5;margin-top:8px}
    .aimo-retry-btn{display:inline-block;margin-top:8px;background:#e11d48;color:#fff;border:none;padding:6px 14px;border-radius:8px;cursor:pointer;font-size:11px;font-weight:800}

    /* Toast */
    #aimo-toast{position:fixed;bottom:90px;right:28px;background:#1e1b4b;color:#fff;padding:9px 18px;border-radius:20px;font-size:12px;font-weight:800;opacity:0;transition:all .25s;pointer-events:none;z-index:2147483648;transform:translateY(8px)}
    #aimo-toast.show{opacity:1;transform:translateY(0)}

    /* FAB */
    #aimo-fab{position:fixed!important;bottom:28px!important;right:22px!important;width:52px!important;height:52px!important;border-radius:50%!important;background:#fff!important;border:2px solid #ede9fe!important;color:#7c3aed!important;cursor:pointer!important;z-index:2147483646!important;display:flex!important;align-items:center!important;justify-content:center!important;font-size:22px!important;box-shadow:0 4px 24px rgba(124,58,237,.25)!important;transition:all .22s!important}
    #aimo-fab:hover{transform:scale(1.1)!important;box-shadow:0 7px 28px rgba(124,58,237,.35)!important}
    #aimo-fab.on{background:linear-gradient(135deg,#7c3aed,#a855f7)!important;border-color:transparent!important;color:#fff!important}

    @keyframes aimo-blink{0%,100%{opacity:1}50%{opacity:.4}}
    @keyframes aimo-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
    @keyframes aimo-shimmer{0%{background-position:-200% center}100%{background-position:200% center}}
    @keyframes aimo-popIn{0%{opacity:0;transform:scale(.94) translateY(8px)}100%{opacity:1;transform:scale(1) translateY(0)}}
    @keyframes aimo-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
  `;
  document.head.appendChild(styleEl);

  /* ─── Category config ──────────────────────────────────────── */
  const CATS = {
    urgent:      { e:'🚨', l:'Urgent',      c:'#dc2626', bg:'#fef2f2', bd:'#fecaca' },
    security:    { e:'🔒', l:'Security',    c:'#d97706', bg:'#fffbeb', bd:'#fde68a' },
    work:        { e:'💼', l:'Work',        c:'#2563eb', bg:'#eff6ff', bd:'#bfdbfe' },
    newsletters: { e:'📰', l:'Newsletter',  c:'#7c3aed', bg:'#f5f3ff', bd:'#ddd6fe' },
    promotions:  { e:'🏷️', l:'Promotions', c:'#059669', bg:'#ecfdf5', bd:'#a7f3d0' },
    social:      { e:'💬', l:'Social',      c:'#0891b2', bg:'#ecfeff', bd:'#a5f3fc' },
    personal:    { e:'👤', l:'Personal',    c:'#db2777', bg:'#fdf2f8', bd:'#fbcfe8' },
    finance:     { e:'💰', l:'Finance',     c:'#65a30d', bg:'#f7fee7', bd:'#d9f99d' },
    travel:      { e:'✈️', l:'Travel',      c:'#0284c7', bg:'#f0f9ff', bd:'#bae6fd' },
    shopping:    { e:'🛍️', l:'Shopping',   c:'#c026d3', bg:'#fdf4ff', bd:'#f0abfc' },
    health:      { e:'💊', l:'Health',      c:'#dc2626', bg:'#fff1f2', bd:'#fecdd3' },
    education:   { e:'🎓', l:'Education',   c:'#7c3aed', bg:'#faf5ff', bd:'#e9d5ff' },
    events:      { e:'🎉', l:'Events',      c:'#ea580c', bg:'#fff7ed', bd:'#fed7aa' },
    other:       { e:'📁', l:'Other',       c:'#64748b', bg:'#f8fafc', bd:'#e2e8f0' },
  };
  const IMP = { critical:'#dc2626', high:'#f97316', medium:'#10b981', low:'#94a3b8' };

  /* ─── Build UI ─────────────────────────────────────────────── */
  const root  = div(''); root.id  = 'aimo-root';
  const panel = div(''); panel.id = 'aimo-panel';
  root.appendChild(panel);

  // Header
  const hdr = div(''); hdr.id = 'aimo-hdr';
  const hdrRow = div(''); hdrRow.id = 'aimo-hdr-row';
  const brand = div(''); brand.id = 'aimo-brand';
  const icon = div(''); icon.id = 'aimo-icon'; icon.textContent = '✉️';
  const tWrap = div('');
  const titleEl = div(''); titleEl.id = 'aimo-title'; titleEl.textContent = 'Mail Organizer';
  const subEl = div(''); subEl.id = 'aimo-sub'; subEl.textContent = 'Free AI · No API Key';
  add(tWrap, titleEl, subEl); add(brand, icon, tWrap);
  const closeBtn = btn(''); closeBtn.id = 'aimo-close'; closeBtn.textContent = '✕';
  add(hdrRow, brand, closeBtn);
  const sBar = div(''); sBar.id = 'aimo-status-bar';
  const sDot = div('aimo-s-dot');
  const sTxt = span(''); sTxt.id = 'aimo-s-txt'; sTxt.textContent = 'Ready';
  add(sBar, sDot, sTxt);
  add(hdr, hdrRow, sBar);
  panel.appendChild(hdr);

  // Mode tabs
  const speedWrap = div(''); speedWrap.id = 'aimo-speed';
  const spLbl = span('aimo-sp-lbl'); spLbl.textContent = 'Mode';
  const tabsEl = div(''); tabsEl.id = 'aimo-tabs';
  [['quick','⚡ Quick'],['detailed','🔍 Detailed']].forEach(([m,l],i) => {
    const t = btn('aimo-tab'+(i===0?' on':'')); t.dataset.mode = m; t.textContent = l;
    tabsEl.appendChild(t);
  });
  add(speedWrap, spLbl, tabsEl);
  panel.appendChild(speedWrap);

  // Body
  const body = div(''); body.id = 'aimo-body';
  panel.appendChild(body);

  // Toast
  const toast = div(''); toast.id = 'aimo-toast';
  document.body.appendChild(toast);

  // ── Current email section ──
  const emailSec = div('');
  const emailSH = div('aimo-sh');
  add(emailSH, span('aimo-sh-ico','📨'), span('aimo-sh-txt','Current Email'), div('aimo-sh-line'));
  const emailWrap = div(''); emailWrap.id = 'aimo-email-wrap';
  showEmptyEmail(emailWrap);
  add(emailSec, emailSH, emailWrap);
  body.appendChild(emailSec);

  // ── Bulk section ──
  const bulkSec = div('');
  const bulkSH = div('aimo-sh');
  add(bulkSH, span('aimo-sh-ico','📬'), span('aimo-sh-txt','Bulk Organizer'), div('aimo-sh-line'));
  const bulkNote = div('aimo-bulk-note');
  bulkNote.textContent = 'Scans your visible inbox emails, groups them by category, then creates real Gmail labels and applies them automatically.';
  const bulkGrid = div(''); bulkGrid.id = 'aimo-bulk-grid';
  [20,50,100].forEach(n => {
    const b = btn('aimo-bulk-btn'); b.dataset.count = String(n);
    add(b, span('aimo-bn', String(n)), span('aimo-bl','emails'));
    bulkGrid.appendChild(b);
  });
  const labelBtn = btn(''); labelBtn.id = 'aimo-label-btn';
  labelBtn.textContent = '🏷️  Create & Apply Gmail Labels';
  const labelProg = div(''); labelProg.id = 'aimo-label-progress';
  const lpBarWrap = div('aimo-lp-bar-wrap');
  const lpBar = div('aimo-lp-bar'); lpBarWrap.appendChild(lpBar);
  const lpTxt = div('aimo-lp-txt'); lpTxt.textContent = '';
  add(labelProg, lpBarWrap, lpTxt);
  add(bulkSec, bulkSH, bulkNote, bulkGrid, labelBtn, labelProg);
  body.appendChild(bulkSec);

  // ── Results section ──
  const resultsSec = div(''); resultsSec.id = 'aimo-results-sec'; resultsSec.style.display = 'none';
  const resSH = div('aimo-sh');
  const resTitleEl = span('aimo-sh-txt'); resTitleEl.id = 'aimo-res-title'; resTitleEl.textContent = 'Results';
  add(resSH, span('aimo-sh-ico','📊'), resTitleEl, div('aimo-sh-line'));
  const summaryBar = div(''); summaryBar.id = 'aimo-summary-bar';
  const groupsEl = div(''); groupsEl.id = 'aimo-groups';
  add(resultsSec, resSH, summaryBar, groupsEl);
  body.appendChild(resultsSec);

  // FAB
  const fab = btn(''); fab.id = 'aimo-fab'; fab.title = 'AI Mail Organizer'; fab.textContent = '✉️';
  document.body.appendChild(root);
  document.body.appendChild(fab);

  /* ─── State ─────────────────────────────────────────────────── */
  let isOpen       = false;
  let mode         = 'quick';
  let currentEmail = null;
  let lastSubject  = '';
  let analyzing    = false;
  let lastResults  = [];
  let lastEmails   = [];

  const setStatus = t => { $('aimo-s-txt').textContent = t; };
  const showToast = (msg, ms = 2500) => {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), ms);
  };

  /* ─── Empty email state ─────────────────────────────────────── */
  function showEmptyEmail(wrap) {
    wrap.className = ''; wrap.id = 'aimo-email-wrap';
    while (wrap.firstChild) wrap.removeChild(wrap.firstChild);
    const es = div('aimo-empty-state');
    add(es,
      add(span('aimo-empty-ico'), [document.createTextNode('📬')]),
      div('aimo-empty-h','Open any email to analyze it'),
      div('aimo-empty-d','Click an email in Gmail, then hit "Analyze"\nto get a smart summary, category, reply draft,\nand one-click action recommendation.')
    );
    wrap.appendChild(es);
  }

  /* ─── Toggle ────────────────────────────────────────────────── */
  fab.addEventListener('click', () => setOpen(!isOpen));
  closeBtn.addEventListener('click', () => setOpen(false));
  function setOpen(v) {
    isOpen = v;
    root.classList.toggle('open', isOpen);
    fab.classList.toggle('on', isOpen);
  }

  /* ─── Mode tabs ─────────────────────────────────────────────── */
  tabsEl.querySelectorAll('.aimo-tab').forEach(t => {
    t.addEventListener('click', () => {
      tabsEl.querySelectorAll('.aimo-tab').forEach(b => b.classList.remove('on'));
      t.classList.add('on'); mode = t.dataset.mode;
      setStatus('Mode: ' + t.textContent.trim());
    });
  });

  /* ─── Watch Gmail for open emails ───────────────────────────── */
  setInterval(() => {
    const subEl = document.querySelector('h2.hP');
    if (!subEl) {
      if (lastSubject) {
        lastSubject = ''; currentEmail = null;
        const w = $('aimo-email-wrap');
        if (w) showEmptyEmail(w);
      }
      return;
    }
    const subject = subEl.innerText.trim();
    if (!subject || subject === lastSubject) return;
    lastSubject = subject;
    const fromEl = document.querySelector('.gD');
    const bodyEl = document.querySelector('.a3s.aiL');
    currentEmail = {
      subject,
      from: fromEl ? (fromEl.getAttribute('email') || fromEl.innerText.trim()) : 'Unknown',
      body: bodyEl ? bodyEl.innerText.slice(0, 1400) : '',
    };
    renderEmailCard();
  }, 800);

  /* ─── Email card ─────────────────────────────────────────────── */
  function renderEmailCard() {
    const wrap = $('aimo-email-wrap');
    wrap.id = 'aimo-email-wrap'; wrap.className = 'live';
    while (wrap.firstChild) wrap.removeChild(wrap.firstChild);

    const head = div(''); head.id = 'aimo-card-head';
    const subj = div(''); subj.id = 'aimo-card-subj'; subj.textContent = currentEmail.subject;
    const fromRow = div(''); fromRow.id = 'aimo-card-from';
    const initials = (currentEmail.from.split('@')[0] || '?').slice(0,2).toUpperCase();
    const avatar = div('aimo-avatar', initials);
    const fromName = span(''); fromName.id = 'aimo-from-name'; fromName.textContent = currentEmail.from;
    add(fromRow, avatar, fromName); add(head, subj, fromRow);

    const foot = div(''); foot.id = 'aimo-card-foot';
    const aBtn = btn(''); aBtn.id = 'aimo-analyze-btn'; aBtn.textContent = '✨ Analyze with AI';
    const resultArea = div(''); resultArea.id = 'aimo-result-area';
    aBtn.addEventListener('click', () => analyzeEmail(aBtn, resultArea));
    add(foot, aBtn, resultArea);
    add(wrap, head, foot);
  }

  /* ─── Skeleton ──────────────────────────────────────────────── */
  function skeleton() {
    const w = div(''); w.style.marginTop = '10px';
    ['aimo-sk sk-f','aimo-sk sk-m','aimo-sk sk-f','aimo-sk sk-s'].forEach(c => w.appendChild(div(c)));
    return w;
  }

  /* ─── Analyze single email ──────────────────────────────────── */
  async function analyzeEmail(aBtn, resultArea) {
    if (!currentEmail || analyzing) return;
    analyzing = true;
    aBtn.disabled = true; aBtn.textContent = '🔄 Thinking…';
    while (resultArea.firstChild) resultArea.removeChild(resultArea.firstChild);
    resultArea.appendChild(skeleton());
    setStatus('Analyzing your email…');

    const prompt = mode === 'detailed'
      ? `Analyze this email thoroughly. Return a JSON object with these exact keys:
- "category": one of urgent/security/work/newsletters/promotions/social/personal/finance/travel/shopping/health/education/events/other — or a new relevant lowercase word
- "importance": critical/high/medium/low
- "summary": 2-3 sentences — WHO sent it, WHAT they want or are offering, WHY it matters and what the recipient should know
- "action": most important next step in max 8 words (be specific, not generic like "review email")
- "why_it_matters": 1 sentence on the impact if ignored

Email to analyze:
From: ${currentEmail.from}
Subject: ${currentEmail.subject}
Body: ${currentEmail.body}`
      : `Classify this email. Return a JSON object with:
- "category": urgent/security/work/newsletters/promotions/social/personal/finance/travel/shopping/health/education/events/other — or invent a relevant lowercase word
- "importance": critical/high/medium/low
- "summary": 1-2 sentences — who sent it, what they want or offer, the key detail the recipient must know
- "action": specific next step in max 7 words

Email:
From: ${currentEmail.from}
Subject: ${currentEmail.subject}
Body: ${currentEmail.body}`;

    try {
      const raw = await aiRequest(prompt, mode === 'detailed' ? 'deep' : 'normal');
      const r   = parseJSON(raw, false);
      const cat = CATS[r.category] || createCat(r.category);
      const ic  = IMP[r.importance] || IMP.low;
      while (resultArea.firstChild) resultArea.removeChild(resultArea.firstChild);

      const card  = div('aimo-result');
      const rtop  = div('aimo-res-top');
      const pill  = span('aimo-cat-pill');
      pill.style.cssText = `background:${cat.bg};color:${cat.c};border-color:${cat.bd}`;
      pill.textContent = cat.e + ' ' + cat.l;
      const impEl  = span('aimo-imp');
      const impDot = div('aimo-imp-dot'); impDot.style.background = ic;
      add(impEl, impDot, document.createTextNode(cap(r.importance) + ' priority'));
      add(rtop, pill, impEl);

      const rbody = div('aimo-res-body');
      addField(rbody, '📝 Summary', r.summary || '');
      const actField = div('aimo-field');
      add(actField, div('aimo-fl','⚡ Recommended Action'),
        add(div(''), [add(span('aimo-action-chip'), [document.createTextNode('→ ' + (r.action || 'Review email'))])]));
      rbody.appendChild(actField);
      if (r.why_it_matters) {
        const why = div('aimo-why');
        add(why, div('aimo-why-lbl','💡 Why it matters'), div('aimo-why-txt', r.why_it_matters));
        rbody.appendChild(why);
      }
      add(card, rtop, rbody);
      resultArea.appendChild(card);

      // ── Reply / Ignore buttons ──
      const isNoReply = /no.?reply|noreply|donotreply|do.not.reply|mailer.daemon|bounce|notifications?@|alerts?@|automated@/i.test(currentEmail.from);
      const actRow = div('aimo-actions-row');
      const ignoreBtn = btn('aimo-ignore-btn', '✕ Ignore & Go Back');
      if (!isNoReply) {
        const replyBtn = btn('aimo-reply-btn', '↩ Write AI Reply');
        actRow.appendChild(replyBtn);
        replyBtn.addEventListener('click', async () => {
          replyBtn.disabled = true; replyBtn.textContent = '🔄 Writing reply…';
          setStatus('Generating reply…');
          try {
            const replyText = await generateReply(r);
            const prev = resultArea.querySelector('.aimo-reply-preview, .aimo-send-btn');
            if (prev) prev.remove();
            const preview = div('aimo-reply-preview');
            const rpLbl = div('aimo-rp-lbl'); rpLbl.textContent = '✏️ Suggested Reply (editable)';
            const rpTxt = div('aimo-rp-txt'); rpTxt.textContent = replyText;
            rpTxt.contentEditable = 'true'; rpTxt.style.outline = 'none';
            add(preview, rpLbl, rpTxt);
            resultArea.appendChild(preview);
            const sendBtn = btn('aimo-send-btn');
            sendBtn.textContent = '📨 Open Reply in Gmail & Insert Text';
            resultArea.appendChild(sendBtn);
            setStatus('Reply ready — click to inject into Gmail');
            sendBtn.addEventListener('click', async () => {
              sendBtn.disabled = true; sendBtn.textContent = '⏳ Opening reply composer…';
              const finalText = rpTxt.textContent || rpTxt.innerText || replyText;
              const ok = await injectReply(finalText);
              if (ok) {
                sendBtn.textContent = '✓ Reply injected — just click Send!';
                sendBtn.style.background = 'linear-gradient(135deg,#059669,#10b981)';
                showToast('Reply is ready in Gmail — review and click Send! 🚀');
                setStatus('✓ Reply injected — review and send!');
              } else {
                sendBtn.disabled = false; sendBtn.textContent = '📨 Try Again';
                showToast('⚠ Could not find reply button — click Reply in Gmail first');
                setStatus('Reply ready — open Gmail reply manually');
              }
            });
          } catch(e) {
            showToast('⚠ Reply generation failed: ' + e.message);
            setStatus('Error generating reply');
          }
          replyBtn.disabled = false; replyBtn.textContent = '↩ Write AI Reply';
        });
      } else {
        // No-reply sender — show info pill instead
        const noReplyPill = span('');
        noReplyPill.style.cssText = 'display:inline-flex;align-items:center;gap:5px;background:#f1f5f9;color:#94a3b8;padding:10px 12px;border-radius:11px;font-size:11px;font-weight:700;border:1.5px solid #e2e8f0';
        noReplyPill.textContent = '🔕 No-reply sender';
        actRow.appendChild(noReplyPill);
      }
      actRow.appendChild(ignoreBtn);
      resultArea.appendChild(actRow);

      ignoreBtn.addEventListener('click', () => { goBackToInbox(); });

      setStatus('✓ ' + cat.l + ' · ' + cap(r.importance) + ' priority');
    } catch(e) {
      while (resultArea.firstChild) resultArea.removeChild(resultArea.firstChild);
      showError(resultArea, String(e), () => analyzeEmail(aBtn, resultArea));
      setStatus('Error — see details');
    }
    aBtn.disabled = false; aBtn.textContent = '↻ Re-analyze';
    analyzing = false;
  }

  function addField(parent, label, value) {
    const f = div('aimo-field');
    add(f, div('aimo-fl', label), div('aimo-fv', value));
    parent.appendChild(f);
  }

  /* ─── Generate AI reply ─────────────────────────────────────── */
  async function generateReply(analysis) {
    const prompt = `Write a professional, natural reply to this email.

Email details:
- From: ${currentEmail.from}
- Subject: ${currentEmail.subject}
- Body: ${currentEmail.body}
- Category: ${analysis.category}
- Summary: ${analysis.summary}

Write a ready-to-send reply that:
- Starts directly (no "Subject:" line, no "Hi [Name]" placeholder — use their actual name if known from the From field)
- Is professional but warm and natural
- Directly addresses what they asked or offered
- Is concise (3-5 sentences max unless the email requires more detail)
- Ends with a clear next step or sign-off

Return ONLY the reply text, nothing else. No quotes, no "Here is your reply:", just the reply itself.`;

    return await aiRequest(prompt, 'normal');
  }

  /* ─── Inject reply into Gmail composer ─────────────────────── */
  async function injectReply(text) {
    // Try to find and click Gmail's Reply button
    const replySelectors = [
      '[data-tooltip="Reply"]',
      '[aria-label="Reply"]',
      'span[data-tooltip="Reply"]',
      '.ams.bkH[data-tooltip]',
      'div[act="19"]',
    ];
    let replyBtn = null;
    for (const sel of replySelectors) {
      const found = document.querySelectorAll(sel);
      // Get the last one (innermost, closest to the email)
      if (found.length) { replyBtn = found[found.length - 1]; break; }
    }
    if (replyBtn) replyBtn.click();
    await sleep(1200);

    // Find the compose/editable area
    const composeSelectors = [
      'div[contenteditable="true"][aria-label*="Message Body"]',
      'div[contenteditable="true"][aria-label*="message"]',
      'div.Am.Al.editable[contenteditable="true"]',
      'div[g_editable="true"]',
      'div[contenteditable="true"].editable',
      'div[contenteditable="true"].Am',
    ];
    let compose = null;
    for (const sel of composeSelectors) {
      compose = document.querySelector(sel);
      if (compose) break;
    }
    if (!compose) {
      // Last resort: find any empty-ish contenteditable
      const all = document.querySelectorAll('div[contenteditable="true"]');
      for (const el of all) {
        if (el.offsetParent !== null) { compose = el; break; }
      }
    }
    if (!compose) return false;

    compose.focus();
    // Position cursor at very beginning (before quoted text)
    const sel = window.getSelection();
    const range = document.createRange();
    range.setStart(compose, 0);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);

    // Insert text node at start
    const textNode = document.createTextNode(text + '\n\n');
    range.insertNode(textNode);
    // Move cursor after inserted text
    range.setStartAfter(textNode);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);

    // Trigger Gmail to recognize the change
    compose.dispatchEvent(new Event('input', { bubbles: true }));
    compose.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  /* ─── Go back to inbox ──────────────────────────────────────── */
  function goBackToInbox() {
    const backSelectors = [
      '[data-tooltip="Back to Inbox"]',
      '[aria-label="Back to Inbox"]',
      '[data-tooltip="Back"]',
      'div.ar7.T-I',
      'a[href*="#inbox"]',
    ];
    for (const sel of backSelectors) {
      const b = document.querySelector(sel);
      if (b) { b.click(); return; }
    }
    // Keyboard shortcut fallback — 'u' in Gmail goes back to list
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'u', bubbles: true, cancelable: true }));
    // Ultimate fallback
    const inbox = document.querySelector('a[href*="inbox"], a[title*="Inbox"]');
    if (inbox) inbox.click();
  }

  /* ─── Bulk analyze ──────────────────────────────────────────── */
  bulkGrid.querySelectorAll('.aimo-bulk-btn').forEach(b => {
    b.addEventListener('click', () => bulkAnalyze(parseInt(b.dataset.count)));
  });

  labelBtn.addEventListener('click', () => applyGmailLabels(lastResults, lastEmails));

  async function bulkAnalyze(count) {
    if (analyzing) return;
    analyzing = true;
    bulkGrid.querySelectorAll('.aimo-bulk-btn').forEach(b => b.disabled = true);
    labelBtn.style.display = 'none';
    const sec = $('aimo-results-sec'); sec.style.display = 'block';
    const summBar = $('aimo-summary-bar'); while(summBar.firstChild) summBar.removeChild(summBar.firstChild);
    const grpsEl  = $('aimo-groups');    while(grpsEl.firstChild)  grpsEl.removeChild(grpsEl.firstChild);
    for(let i=0;i<3;i++) {
      const r = div(''); r.style.cssText='display:flex;gap:10px;padding:12px;background:#f9f8ff;border-radius:12px;margin-bottom:8px';
      const c = div('aimo-sk'); c.style.cssText='width:22px;height:22px;border-radius:50%;flex-shrink:0;margin:0';
      const inf = div(''); inf.style.flex='1';
      add(inf, div('aimo-sk sk-f'), div('aimo-sk sk-m'));
      add(r, c, inf); grpsEl.appendChild(r);
    }
    setStatus('Reading inbox…');

    try {
      // Scroll to load more emails first
      setStatus('Loading emails from Gmail…');
      const emails = await loadAndReadInbox(count);
      if (!emails.length) throw new Error('No emails found — make sure your Gmail Inbox is visible and loaded');
      setStatus(`Analyzing ${emails.length} emails…`);
      const chunks = [];
      for(let i=0;i<emails.length;i+=4) chunks.push(emails.slice(i,i+4));

      let allResults = [];
      for(let i=0;i<chunks.length;i++) {
        setStatus(`Batch ${i+1} of ${chunks.length} — ${allResults.length} done so far…`);
        const res = await analyzeBatch(chunks[i]);
        allResults = allResults.concat(res);
        renderGroups(allResults, emails);
      }
      lastResults = allResults;
      lastEmails  = emails;
      $('aimo-res-title').textContent = 'Results — ' + allResults.length + ' emails';
      setStatus('Organized ' + allResults.length + ' emails — now applying Gmail labels…');
      sec.scrollIntoView({ behavior:'smooth', block:'start' });
      await sleep(600);
      // Auto-apply labels immediately
      await applyGmailLabels(allResults, emails);
      labelBtn.style.display = 'flex';
    } catch(e) {
      const grps = $('aimo-groups'); while(grps.firstChild) grps.removeChild(grps.firstChild);
      showError(grps, String(e), () => bulkAnalyze(count));
      setStatus('Error — try again');
    }
    bulkGrid.querySelectorAll('.aimo-bulk-btn').forEach(b => b.disabled = false);
    analyzing = false;
  }

  /* ─── Load inbox with scroll-to-load-more ─────────────────── */
  async function loadAndReadInbox(limit) {
    // Gmail renders only ~50 rows at a time via virtual scroll.
    // We scroll the list container in steps to force more rows to render.
    const getScrollable = () =>
      document.querySelector('.AO[jsinstance]') ||
      document.querySelector('div[gh="tl"] .Tm.aeJ') ||
      document.querySelector('.nH .BltHke') ||
      document.querySelector('.aeF') ||
      document.querySelector('.AO');

    let loaded = readInbox(limit);
    if (loaded.length >= limit) return loaded;

    const scrollable = getScrollable();
    if (scrollable) {
      // Scroll down in steps, waiting for Gmail to render more rows each time
      let lastCount = 0;
      for (let attempt = 0; attempt < 6; attempt++) {
        scrollable.scrollTop = scrollable.scrollHeight;
        await sleep(600);
        loaded = readInbox(limit);
        if (loaded.length >= limit) break;
        if (loaded.length === lastCount) break; // no new rows appeared
        lastCount = loaded.length;
      }
      scrollable.scrollTop = 0;
      await sleep(300);
    } else {
      // Fallback: scroll the window
      for (let attempt = 0; attempt < 4; attempt++) {
        window.scrollTo(0, document.body.scrollHeight);
        await sleep(700);
        loaded = readInbox(limit);
        if (loaded.length >= limit) break;
      }
      window.scrollTo(0, 0);
      await sleep(300);
    }
    return loaded;
  }

  function readInbox(limit) {
    const out  = [];
    const seen = new Set();
    const rows = document.querySelectorAll('tr.zA');
    rows.forEach((row, i) => {
      if (out.length >= limit) return;
      // Skip rows that are just spacers/headers (no subject text)
      const subEl  = row.querySelector('.bog span, .y6 span, .bog, .y6');
      const fromEl = row.querySelector('.zF, .yX, .yW');
      const snipEl = row.querySelector('.y2, .Zt');
      const rawId  = row.getAttribute('data-thread-id') || row.id || ('row_' + i);
      // Normalise: Gmail thread IDs sometimes have "#thread-" prefix
      const id = rawId.replace('#thread-', '').replace('thread-', '');
      if (!id || seen.has(id)) return;
      seen.add(id);
      const subject = subEl ? subEl.innerText.trim() : '';
      if (!subject) return; // skip blank rows

      const m = String(rawId).match(/([a-f0-9]{12,})$/i);
      const apiThreadId = m ? m[1].toLowerCase() : null;

      out.push({
        id,
        apiThreadId,
        subject,
        from: fromEl ? fromEl.innerText.trim() : '',
        body: snipEl ? snipEl.innerText.trim() : '',
        rowEl: row,
      });
    });
    return out;
  }

  /* ─── Analyze a batch ───────────────────────────────────────── */
  async function analyzeBatch(emails) {
    // Short input = fewer timeouts on Pollinations
    const input = emails.map(e => ({
      id: e.id,
      from: e.from.slice(0, 60),
      subject: e.subject.slice(0, 80),
      snippet: e.body.slice(0, 120),
    }));
    const prompt = 'Return a JSON array. Each item: {"id":"...","category":"work","importance":"medium","summary":"1 sentence who/what","action":"max 5 words"}. Categories: urgent/security/work/newsletters/promotions/social/personal/finance/travel/shopping/health/education/events/other. Importance: critical/high/medium/low. Input: ' + JSON.stringify(input);
    try {
      const raw = await aiRequest(prompt, 'normal');
      const arr = parseJSON(raw, true);
      return arr.filter(r => r && r.id);
    } catch (e) {
      // Batch failed — fall back to one-by-one
      if (emails.length === 1) throw e;
      const results = [];
      for (const email of emails) {
        try { const r = await analyzeSingle(email); if (r) results.push(r); } catch(_) {}
      }
      return results;
    }
  }

  async function analyzeSingle(email) {
    const prompt = 'Classify this email as JSON: {"id":"' + email.id + '","category":"work","importance":"medium","summary":"1 sentence","action":"max 5 words"}. From: ' + email.from.slice(0,60) + '. Subject: ' + email.subject.slice(0,80);
    const raw = await aiRequest(prompt, 'normal');
    const obj = parseJSON(raw, false);
    return obj;
  }

  /* ─── Render grouped results ────────────────────────────────── */
  function renderGroups(results, emails) {
    const emap = {}; emails.forEach(e => { emap[e.id] = e; });
    const grouped = {};
    results.forEach(r => { const k = r.category||'other'; if(!grouped[k]) grouped[k]=[]; grouped[k].push(r); });
    const order = ['urgent','security','work','personal','finance','health','events','travel','social','education','shopping','newsletters','promotions','other'];
    const keys = Object.keys(grouped).sort((a,b) => (order.indexOf(a)<0?99:order.indexOf(a)) - (order.indexOf(b)<0?99:order.indexOf(b)));

    const summBar = $('aimo-summary-bar');
    while(summBar.firstChild) summBar.removeChild(summBar.firstChild);
    keys.forEach(k => {
      const cat = CATS[k]||createCat(k);
      const chip = span('aimo-sum-chip');
      chip.style.cssText = `background:${cat.bg};color:${cat.c};border-color:${cat.bd}`;
      chip.textContent = `${cat.e} ${cat.l} (${grouped[k].length})`;
      summBar.appendChild(chip);
    });

    const grpsEl = $('aimo-groups');
    while(grpsEl.firstChild) grpsEl.removeChild(grpsEl.firstChild);
    keys.forEach(k => {
      const items = grouped[k];
      const cat   = CATS[k]||createCat(k);
      const group = div('aimo-group');
      const ghdr  = div('aimo-group-hdr');
      ghdr.style.borderLeft = `4px solid ${cat.c}`;
      const gico  = span('aimo-group-ico'); gico.textContent = cat.e;
      const gname = span('aimo-group-name'); gname.textContent = cat.l; gname.style.color = cat.c;
      const gcnt  = span('aimo-group-count'); gcnt.textContent = items.length;
      gcnt.style.cssText = `background:${cat.bg};color:${cat.c}`;
      const gchev = span('aimo-group-chev open'); gchev.textContent = '▼';
      add(ghdr, gico, gname, gcnt, gchev);

      const glist = div('aimo-group-list open');
      items.sort((a,b) => ['critical','high','medium','low'].indexOf(a.importance) - ['critical','high','medium','low'].indexOf(b.importance));
      items.forEach(r => {
        const em   = emap[r.id]||{};
        const row  = div('aimo-email-row');
        const dot  = div('aimo-er-dot'); dot.style.background = IMP[r.importance]||IMP.low;
        const info = div('aimo-er-info');
        add(info,
          add(div('aimo-er-subj'), [document.createTextNode(em.subject||r.id)]),
          add(div('aimo-er-from'), [document.createTextNode(em.from||'')]),
          add(div('aimo-er-sum'),  [document.createTextNode(r.summary||'')]),
          add(div('aimo-er-act'),  [document.createTextNode('→ '+(r.action||''))])
        );
        add(row, dot, info); glist.appendChild(row);
      });
      ghdr.addEventListener('click', () => {
        const open = glist.classList.contains('open');
        glist.classList.toggle('open',!open);
        gchev.classList.toggle('open',!open);
      });
      add(group, ghdr, glist);
      grpsEl.appendChild(group);
    });
  }

  /* ─── Gmail Label System ─────────────────────────────────────── */
  /*
   * FULLY AUTOMATIC — zero user clicks required.
   *
   * We only use Gmail's label picker flow:
   *   Select rows → open picker → search label name.
   *   If label exists, click it.
   *   If missing, trigger picker "Create new label", confirm dialog,
   *   then apply it in the same pass.
   */

  async function applyGmailLabels(results, emails) {
    if (!results.length) return;
    labelBtn.disabled = true;
    labelBtn.textContent = '⏳ Applying labels…';
    const prog = $('aimo-label-progress');
    prog.style.display = 'block';
    lpBar.style.width = '0%';
    lpTxt.textContent = 'Starting…';

    const emailById = new Map((emails || []).map(e => [e.id, e]));
    const grouped = {};
    results.forEach(r => {
      const k = r.category || 'other';
      if (!grouped[k]) grouped[k] = [];
      grouped[k].push(r);
    });

    const categories = Object.keys(grouped);
    let done = 0;

    for (const category of categories) {
      const cat  = CATS[category] || createCat(category);
      const labelName = cat.l;
      const ids  = grouped[category].map(r => r.id);

      lpTxt.textContent = `Ensuring API label "${labelName}"…`;
      lpBar.style.width  = Math.round((done / categories.length) * 100) + '%';
      setStatus('Gmail API: preparing label ' + labelName + '…');
      ids.forEach(id => applyBadge(id, labelName));

      const threadIds = ids
        .map(id => emailById.get(id)?.apiThreadId)
        .filter(Boolean);

      if (!threadIds.length) {
        throw new Error(`No Gmail thread IDs found for "${labelName}". Open inbox list view and retry.`);
      }

      let labelId;
      try {
        const ensured = await gmailRequest('ensureLabel', { labelName });
        labelId = ensured?.labelId;
      } catch (e) {
        throw new Error('Gmail API label creation failed: ' + String(e.message || e));
      }

      if (!labelId) throw new Error('Gmail API returned no label ID for ' + labelName);

      lpTxt.textContent = `Applying API label "${labelName}" (${threadIds.length})…`;
      setStatus('Gmail API: applying ' + labelName + '…');

      const apiResult = await gmailRequest('applyLabelToThreads', { labelId, threadIds });
      const failed = Number(apiResult?.failed || 0);
      if (failed > 0) {
        throw new Error(`Gmail API could not label ${failed} thread(s) in ${labelName}`);
      }

      done++;
      lpBar.style.width = Math.round((done / categories.length) * 100) + '%';
      showToast('✓ ' + labelName + ' → ' + threadIds.length + ' emails', 1800);
      await sleep(180);
    }

    lpBar.style.width = '100%';
    lpTxt.textContent = '✓ Done! ' + categories.length + ' labels applied via Gmail API.';
    labelBtn.disabled = false;
    labelBtn.textContent = '↻ Re-apply Labels';
    setStatus('✓ Gmail API labeling completed');
    showToast('✓ All labels applied via Gmail API!', 3200);
  }


  // ── Phase B: Select emails → toolbar → pick existing label ────
  async function applyLabelBatch(labelName, threadIds) {
    // ── Step 1: Click checkboxes ──
    let selected = 0;
    for (const id of threadIds) {
      const row = findRow(id);
      if (!row) continue;
      row.scrollIntoView({ block: 'nearest' });
      await sleep(40);
      row.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      await sleep(70);
      const cb = row.querySelector('.T-Jo:not(.T-Jo-Jp-I)')
               || row.querySelector('td.oZ-jc > div')
               || row.querySelector('td.oZ-jc > span');
      if (cb) { cb.click(); await sleep(130); selected++; }
    }
    if (selected === 0) return false;
    await sleep(700);

    // ── Step 2: Click "Label" toolbar button ──
    const labelToolBtn = await findLabelToolbarBtn(2500);
    if (!labelToolBtn) { await cleanDeselect(); return false; }
    labelToolBtn.click();
    await sleep(900);

    // ── Step 3: Find picker search input ──
    const input = await waitForVisible([
      'input.aAy', '.bsU input[type="text"]',
      '.J-M.aZ7 input', '.J-M input[type="text"]', '.Ess input',
    ], 2500);
    if (!input) { closeSafely(); await sleep(200); await cleanDeselect(); return false; }

    // ── Step 4: Type label name — use native React setter (most reliable) ──
    await fillReactInput(input, labelName);
    await sleep(1200); // Wait for Gmail's live filter

    // ── Step 5: Click existing label, or create it directly in picker ──
    const assigned = await chooseOrCreateLabelInPicker(labelName);
    if (!assigned) {
      closeSafely();
      await sleep(400);
      await cleanDeselect();
      return false;
    }

    await sleep(300);
    closeSafely();
    await sleep(450);

    await sleep(300);
    await cleanDeselect();
    return true;
  }

  // ── Helpers ────────────────────────────────────────────────────

  // Close any stuck dialog or picker BEFORE starting a new operation.
  // Pressing Escape is SAFE here because no label assignment is in progress.
  async function resetGmailUI() {
    // Close open "Create label" dialogs by clicking their Cancel button
    const cancelBtn = document.querySelector('[name="cancel"]:not([disabled])');
    if (cancelBtn && cancelBtn.offsetParent) { cancelBtn.click(); await sleep(300); }

    // Close open label pickers by clicking a safe neutral area
    if (document.querySelector('.J-M.aZ7, input.aAy')) {
      closeSafely();
      await sleep(350);
    }
  }

  // Find the "Label as" button in Gmail's multi-select toolbar.
  // Tries 14 selectors then falls back to a tooltip text scan.
  async function findLabelToolbarBtn(timeoutMs) {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
      // Known selectors — act="9" and act="3" are internal Gmail button IDs
      const sels = [
        '[data-tooltip="Label as"]', '[data-tooltip="Label"]',
        '[aria-label="Label as"]',   '[aria-label="Label"]',
        '[data-tooltip="Libellé"]',  '[data-tooltip="Etiqueta"]',
        '[data-tooltip*="abel"]',    '[aria-label*="abel"]',
        '.G-atb [act="9"]', '.G-atb [act="3"]',
        '.aeH  [act="9"]',  '.aeH  [act="3"]',
      ];
      for (const sel of sels) {
        try {
          const el = document.querySelector(sel);
          if (el && el.offsetParent !== null) return el;
        } catch(_) {}
      }
      // Tooltip text scan — works for any Gmail language
      const candidate = [...document.querySelectorAll('.G-atb [role="button"], .aeH [role="button"]')]
        .find(b => b.offsetParent && /label|libell|etiquet|beschrift/i.test(
          b.getAttribute('data-tooltip') || b.getAttribute('aria-label') || b.title || ''
        ));
      if (candidate) return candidate;
      await sleep(100);
    }
    return null;
  }

  // fillReactInput — the ONLY reliable way to update React-controlled inputs.
  // Setting .value directly updates the DOM but NOT React's fiber state,
  // so Gmail ignores it. The native property setter bypasses React's override
  // and writing through it still fires the 'input' event that React listens to.
  async function fillReactInput(el, text) {
    el.focus();
    await sleep(80);
    try {
      // Primary method: native React setter trick
      const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      nativeSetter.call(el, '');
      nativeSetter.call(el, text);
      el.dispatchEvent(new Event('input',  { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      if (el.value === text) return;
    } catch(_) {}
    // Fallback: execCommand (works on focused inputs in Chrome)
    try {
      el.select?.();
      document.execCommand('selectAll',   false, null);
      document.execCommand('delete',      false, null);
      document.execCommand('insertText',  false, text);
    } catch(_) {}
    // Last resort: direct assignment
    if (el.value !== text) {
      el.value = text;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  // Close picker/dropdown by clicking a truly neutral part of Gmail's header.
  // NEVER call this while a label assignment is being confirmed — only call it
  // AFTER clicking a label item (which confirms it) or to cancel cleanly.
  function closeSafely() {
    const safe =
      document.querySelector('[gh="s"]')         || // search bar background
      document.querySelector('h2.iY')            || // "Primary" / "Social" tab
      document.querySelector('.BltHke')          || // inbox list container bg
      document.querySelector('.nH .l.NQ')        || // top bar area
      document.querySelector('.aeJ');               // list wrapper
    if (safe) {
      ['mousedown','mouseup','click'].forEach(t =>
        safe.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true }))
      );
      return;
    }
    document.elementFromPoint(100, 20)?.click();
  }

  // Uncheck all selected rows cleanly after labeling.
  async function cleanDeselect() {
    // Best: click each individually-checked row's checkbox to untick it
    const checked = document.querySelectorAll('tr.zA.x7, tr.zA.PE');
    if (checked.length) {
      checked.forEach(row => {
        const cb = row.querySelector('.T-Jo:not(.T-Jo-Jp-I)') || row.querySelector('td.oZ-jc > div');
        if (cb && cb.offsetParent) cb.click();
      });
      await sleep(200);
      return;
    }
    // Fallback: dropdown → "None" option
    const arrow = document.querySelector('.T-Jo-Jp-I');
    if (arrow && arrow.offsetParent) {
      arrow.click();
      await sleep(300);
      const none = [...document.querySelectorAll('.J-JN-M-I, [role="menuitem"]')]
        .find(item => /^(none|aucun|ninguno|keine|nessuno)$/i.test((item.textContent||'').trim()));
      if (none) { none.click(); return; }
      closeSafely();
      await sleep(200);
    }
    // Last resort: double-click select-all to end up with nothing selected
    const selAll = document.querySelector('.T-Jo.J-J5-Ji');
    if (selAll) {
      selAll.click(); await sleep(180);
      if (document.querySelectorAll('tr.zA.x7, tr.zA.PE').length > 2) { selAll.click(); }
    }
  }

  async function waitForVisible(selectors, timeoutMs) {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
      for (const sel of selectors) {
        try {
          const el = document.querySelector(sel);
          if (el && el.offsetParent !== null) return el;
        } catch (_) {}
      }
      await sleep(100);
    }
    return null;
  }

  async function waitForVisibleFn(fn, timeoutMs) {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
      try { const el = fn(); if (el && el.getBoundingClientRect().width > 0) return el; } catch(_) {}
      await sleep(100);
    }
    return null;
  }


  async function chooseOrCreateLabelInPicker(labelName) {
    const norm = v => (v || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const target = norm(labelName);

    const getVisibleItems = () => [...document.querySelectorAll('.J-JN-M-I, [role="menuitemcheckbox"], [role="menuitem"]')]
      .filter(el => el.offsetParent !== null);

    const findExistingItem = () => {
      const items = getVisibleItems();
      return items.find(item => {
        const nameEl = item.querySelector('[role="menuitemcheckbox"], .J-N, .bAq, .aHl') || item;
        const t = norm(nameEl.textContent || item.textContent);
        return t === target || t.endsWith('/' + target) || t.includes(target);
      });
    };

    let existing = await waitForVisibleFn(findExistingItem, 1800);
    if (existing) { existing.click(); return true; }

    const items = getVisibleItems();
    const createItem = [...items].reverse().find(item => {
      const t = norm(item.textContent);
      return t.includes('create') || t.includes('new label') || t.includes('nouveau')
        || t.includes('crear') || t.includes('criar') || t.includes('neu') || t.includes('新しい');
    }) || items[items.length - 1];

    if (!createItem) return false;
    createItem.click();
    await sleep(600);

    const dlgInput = await waitForVisible([
      'input[name="labelName"]', 'input[name="name"]', 'input[name="lname"]',
      '.Kj-JD-Jz input[type="text"]', '.J-M input[type="text"]', 'input[type="text"]'
    ], 2500);
    if (!dlgInput) return false;

    await fillReactInput(dlgInput, labelName);
    await sleep(250);

    const createBtn = [...document.querySelectorAll('[name="ok"], button, [role="button"]')]
      .find(btn => {
        if (!btn.offsetParent) return false;
        const t = norm(btn.textContent || btn.getAttribute('aria-label') || btn.getAttribute('name'));
        return btn.getAttribute('name') === 'ok' || t === 'ok' || t.includes('create') || t.includes('créer')
          || t.includes('crear') || t.includes('criar') || t.includes('erstellen');
      });

    if (createBtn) {
      createBtn.click();
    } else {
      dlgInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
    }

    await sleep(1100);

    existing = await waitForVisibleFn(findExistingItem, 2200);
    if (!existing) return false;
    existing.click();
    return true;
  }

  function findRow(id) {
    return document.querySelector('tr.zA[data-thread-id="' + id + '"]')
        || document.querySelector('tr.zA[id="' + CSS.escape(id) + '"]')
        || document.querySelector('tr.zA[id="' + id + '"]');
  }

  function applyBadge(id, labelName) {
    const row = findRow(id);
    if (!row) return;
    const cat = getCatFromLabel(labelName);
    row.style.setProperty('border-left', '4px solid ' + cat.c, 'important');
    row.style.background = cat.bg;
    if (!row.querySelector('.aimo-badge')) {
      const badge = span('aimo-badge');
      badge.style.cssText = 'display:inline-flex;align-items:center;gap:3px;background:' + cat.bg + ';color:' + cat.c + ';border:1px solid ' + cat.bd + ';padding:1px 7px;border-radius:10px;font-size:10px;font-weight:800;font-family:sans-serif;margin-left:5px;vertical-align:middle;pointer-events:none';
      badge.textContent = cat.e + ' ' + cat.l;
      const subEl = row.querySelector('.bog span, .y6 span, .bog');
      if (subEl) subEl.after(badge);
    }
  }

  function getCatFromLabel(labelName) {
    const lower = labelName.toLowerCase();
    for (const [k, v] of Object.entries(CATS)) {
      if (lower.includes(v.l.toLowerCase()) || lower.includes(k)) return v;
    }
    return CATS.other;
  }


  function createCat(key) {
    if (!key) return CATS.other;
    const palette = [
      { c:'#0891b2', bg:'#ecfeff', bd:'#a5f3fc' },
      { c:'#7c3aed', bg:'#f5f3ff', bd:'#ddd6fe' },
      { c:'#059669', bg:'#ecfdf5', bd:'#a7f3d0' },
      { c:'#db2777', bg:'#fdf2f8', bd:'#fbcfe8' },
      { c:'#d97706', bg:'#fffbeb', bd:'#fde68a' },
      { c:'#2563eb', bg:'#eff6ff', bd:'#bfdbfe' },
    ];
    const pick = palette[Math.abs([...key].reduce((a,c)=>a+c.charCodeAt(0),0))%palette.length];
    const cat = { e:'📂', l:cap(key), ...pick };
    CATS[key] = cat;
    return cat;
  }

  /* ─── Error display ─────────────────────────────────────────── */
  function showError(container, msg, retryFn) {
    const box = div('aimo-err'); box.textContent = msg;
    if (retryFn) {
      const rb = btn('aimo-retry-btn','↻ Retry');
      rb.addEventListener('click', () => { while(container.firstChild) container.removeChild(container.firstChild); retryFn(); });
      box.appendChild(rb);
    }
    container.appendChild(box);
  }

  /* ─── AI request relay ──────────────────────────────────────── */
  let _cid = 0;
  const _pending = {};
  window.addEventListener('message', e => {
    if (e.source !== window || !e.data || e.data.ns !== 'AIMO' || e.data.type !== 'RES') return;
    const cb = _pending[e.data.id];
    if (cb) { delete _pending[e.data.id]; cb(e.data); }
  });

  function bridgeRequest(payload, timeoutMs, timeoutMsg) {
    return new Promise((resolve, reject) => {
      const id = ++_cid;
      const t = setTimeout(() => {
        delete _pending[id];
        reject(new Error(timeoutMsg || 'Request timed out'));
      }, timeoutMs || 90000);
      _pending[id] = res => {
        clearTimeout(t);
        res.ok ? resolve(res) : reject(new Error(res.error || 'Unknown error'));
      };
      window.postMessage({ ns:'AIMO', type:'REQ', id, ...payload }, '*');
    });
  }

  async function aiRequest(prompt, detail = 'normal') {
    const res = await bridgeRequest(
      { prompt, detail },
      90000,
      'Timed out — Pollinations may be busy, please retry'
    );
    return res.text;
  }

  async function gmailRequest(op, payload = {}) {
    const res = await bridgeRequest(
      { req: 'gmail', op, payload },
      120000,
      'Timed out — Gmail API is taking too long, please retry'
    );
    return res.data;
  }

  function parseJSON(raw, expectArray) {
    const clean = raw.replace(/```json|```/g, '').trim();
    const s = clean.indexOf(expectArray ? '[' : '{');
    const e = clean.lastIndexOf(expectArray ? ']' : '}');
    if (s === -1 || e === -1) throw new Error('AI returned invalid JSON — please retry');
    return JSON.parse(clean.slice(s, e + 1));
  }

  /* ─── Popup bridges ─────────────────────────────────────────── */
  document.addEventListener('aimo:toggle',  () => setOpen(!isOpen));
  document.addEventListener('aimo:open',    () => setOpen(true));
  document.addEventListener('aimo:analyze', () => {
    if (currentEmail) { const b=$('aimo-analyze-btn'),r=$('aimo-result-area'); if(b&&r) analyzeEmail(b,r); }
  });
  document.addEventListener('aimo:bulk',    e => bulkAnalyze(e.detail?.count||20));
  document.addEventListener('aimo:model',   e => {
    const m = e.detail?.model;
    if (!m) return;
    mode = m.includes('opus') || m.includes('sonnet') ? 'detailed' : 'quick';
    tabsEl.querySelectorAll('.aimo-tab').forEach(b => b.classList.toggle('on', b.dataset.mode === mode));
  });

})();
