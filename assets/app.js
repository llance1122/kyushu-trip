(() => {
  const CFG = Object.assign({ branch: 'main', dataPath: 'data/itinerary.json' }, window.TRIP_CONFIG || {});
  const COLORS = ['#C2452D', '#3F7D6B', '#C98418', '#3D6A8A', '#7A4E7E', '#5E7F2E', '#A0522D', '#2F6F8F'];
  const TYPES = { spot: '景點', food: '美食', shop: '購物', stay: '住宿', move: '交通' };
  const MODES = { drive: '自駕', transit: '大眾運輸' };

  const S = { data: null, v: 0, day: 'all', tab: 'map', editing: false, token: null, sha: null, dirty: false, active: null, pick: null, locTarget: null };
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const linkify = (s) => esc(s).replace(/https?:\/\/[^\s<>"'）)]+/g, (u) => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`);
  const ver = () => S.data.versions[S.v];
  const color = (d) => COLORS[d % COLORS.length];
  const hasLoc = (s) => typeof s.lat === 'number' && typeof s.lng === 'number';
  const navUrl = (s) => `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`;

  function toast(msg, ms = 3200) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), ms);
  }

  // ---------------- Map ----------------
  const map = L.map('map', { zoomControl: true }).setView([33.2, 130.7], 8);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
  const layer = L.layerGroup().addTo(map);
  let markers = {};
  const routeMem = {};

  async function fetchRoute(pts) {
    const coords = pts.map((p) => `${p[1].toFixed(5)},${p[0].toFixed(5)}`).join(';');
    const key = 'route:' + coords;
    if (routeMem[key]) return routeMem[key];
    try { const c = localStorage.getItem(key); if (c) return (routeMem[key] = JSON.parse(c)); } catch (e) { /* storage unavailable */ }
    try {
      const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`);
      if (!r.ok) return null;
      const j = await r.json();
      if (!j.routes || !j.routes[0]) return null;
      const line = j.routes[0].geometry.coordinates.map((c) => [c[1], c[0]]);
      routeMem[key] = line;
      try { localStorage.setItem(key, JSON.stringify(line)); } catch (e) { /* quota */ }
      return line;
    } catch (e) { return null; }
  }

  function drawRoute(day, pts, c) {
    if (pts.length < 2) return;
    if (day.mode === 'drive') {
      const temp = L.polyline(pts, { color: c, weight: 3, opacity: 0.45, dashArray: '2 8' }).addTo(layer);
      fetchRoute(pts).then((geo) => {
        if (!geo || !layer.hasLayer(temp)) return;
        layer.removeLayer(temp);
        L.polyline(geo, { color: c, weight: 5, opacity: 0.85 }).addTo(layer);
      });
    } else {
      L.polyline(pts, { color: c, weight: 3, opacity: 0.8, dashArray: '6 8' }).addTo(layer);
    }
  }

  function visibleDays() {
    const n = ver().days.length;
    if (S.day === 'all' || S.day >= n) return [...Array(n).keys()];
    return [S.day];
  }

  function renderMap(fit) {
    layer.clearLayers();
    markers = {};
    const all = [];
    visibleDays().forEach((d) => {
      const day = ver().days[d];
      const c = color(d);
      const pts = [];
      let n = 0;
      day.stops.forEach((s, i) => {
        if (!hasLoc(s)) return;
        n++;
        const ll = [s.lat, s.lng];
        pts.push(ll); all.push(ll);
        const icon = L.divIcon({ className: '', html: `<div class="pin" style="--c:${c}"><span>${n}</span></div>`, iconSize: [28, 28], iconAnchor: [14, 34], popupAnchor: [0, -30] });
        const m = L.marker(ll, { icon, title: s.name, keyboard: true }).addTo(layer)
          .bindPopup(`<div class="pop-t">${esc(day.label)}｜${esc(s.time)} ${esc(s.name)}</div>${s.note ? `<div class="pop-n">${esc(s.note)}</div>` : ''}`);
        m.on('click', () => focusStop(d, i, true));
        markers[`${d}-${i}`] = m;
      });
      drawRoute(day, pts, c);
    });
    if (fit && all.length) map.fitBounds(all, { padding: [40, 40], maxZoom: 15 });
  }

  function focusStop(d, i, fromMap) {
    if (S.editing) return;
    S.active = { d, i };
    $$('.stop.active').forEach((el) => el.classList.remove('active'));
    const li = $(`.stop[data-d="${d}"][data-i="${i}"]`);
    if (li) { li.classList.add('active'); li.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    const m = markers[`${d}-${i}`];
    if (m) {
      if (!fromMap) map.flyTo(m.getLatLng(), Math.max(map.getZoom(), 14), { duration: 0.6 });
      m.openPopup();
    }
  }

  // ---------------- Header / chips ----------------
  function renderHeader() {
    $('#tripTitle').textContent = S.data.title || '行程';
    $('#tripRange').textContent = ver().range || '';
    document.title = `${S.data.title}｜${ver().name}`;
    $('#versionSeg').innerHTML = S.data.versions.map((v, i) =>
      `<button type="button" role="tab" aria-selected="${i === S.v}" class="${i === S.v ? 'on' : ''}" data-v="${i}">${esc(v.name)}</button>`).join('');
    $('#editBtn').hidden = S.editing;
  }

  function renderChips() {
    const days = ver().days;
    const chips = [`<button type="button" class="chip ${S.day === 'all' ? 'on' : ''}" data-day="all">全部</button>`]
      .concat(days.map((d, i) => `<button type="button" class="chip ${S.day === i ? 'on' : ''}" data-day="${i}" style="--c:${color(i)}"><span class="dot"></span>${esc(d.label)} ${esc(d.date)}</button>`));
    $('#dayChips').innerHTML = chips.join('');
  }

  // ---------------- Day list ----------------
  function dayRouteUrl(day) {
    const pts = day.stops.filter(hasLoc);
    if (pts.length < 2) return null;
    return 'https://www.google.com/maps/dir/' + pts.map((s) => `${s.lat},${s.lng}`).join('/');
  }

  function renderList() {
    const box = $('#dayList');
    const v = ver();
    if (!v.days.length && !S.editing) { box.innerHTML = '<p class="empty">這個版本還沒有行程。按「編輯行程」新增第一天。</p>'; return; }
    let html = '';
    if (S.editing) {
      html += `<div class="day"><div class="day-edit">
        <label class="full">版本名稱<input class="field" data-scope="ver" data-k="name" value="${esc(v.name)}"></label>
        <label class="full">日期範圍<input class="field" data-scope="ver" data-k="range" value="${esc(v.range)}"></label>
      </div><p class="muted">拖曳左邊的 ⋮⋮ 可以調整順序，也能拖到別天。</p></div>`;
    }
    visibleDays().forEach((d) => {
      const day = v.days[d];
      const c = color(d);
      if (S.editing) {
        html += `<section class="day" style="--c:${c}">
          <div class="day-edit">
            <input class="field" aria-label="天數" data-scope="day" data-d="${d}" data-k="label" value="${esc(day.label)}">
            <input class="field" aria-label="日期" data-scope="day" data-d="${d}" data-k="date" value="${esc(day.date)}">
            <input class="field full" aria-label="當天標題" data-scope="day" data-d="${d}" data-k="title" value="${esc(day.title)}" placeholder="當天標題">
            <select class="field" aria-label="交通方式" data-scope="day" data-d="${d}" data-k="mode">
              ${Object.entries(MODES).map(([k, t]) => `<option value="${k}" ${day.mode === k ? 'selected' : ''}>${t}${k === 'drive' ? '（畫道路路線）' : '（畫虛線）'}</option>`).join('')}
            </select>
            <button type="button" class="btn danger small" data-act="del-day" data-d="${d}">刪除這一天</button>
          </div>
          <ol class="stops" data-d="${d}">
            ${day.stops.map((s, i) => `<li class="stop" data-d="${d}" data-i="${i}">
              <span class="handle" aria-label="拖曳調整順序">⋮⋮</span>
              <div class="fgrid">
                <input class="field" aria-label="時間" data-scope="stop" data-d="${d}" data-i="${i}" data-k="time" value="${esc(s.time)}" placeholder="時間">
                <input class="field" aria-label="名稱" data-scope="stop" data-d="${d}" data-i="${i}" data-k="name" value="${esc(s.name)}" placeholder="名稱">
                <textarea class="field full" aria-label="備註" data-scope="stop" data-d="${d}" data-i="${i}" data-k="note" placeholder="備註">${esc(s.note)}</textarea>
                <div class="frow full">
                  <select class="field" style="width:auto" aria-label="類型" data-scope="stop" data-d="${d}" data-i="${i}" data-k="type">
                    ${Object.entries(TYPES).map(([k, t]) => `<option value="${k}" ${s.type === k ? 'selected' : ''}>${t}</option>`).join('')}
                  </select>
                  <button type="button" class="btn ghost small" data-act="loc" data-d="${d}" data-i="${i}">設定位置</button>
                  <span class="loc ${hasLoc(s) ? '' : 'missing'}">${hasLoc(s) ? '已設定位置' : '沒有位置（不會出現在地圖）'}</span>
                  <button type="button" class="btn danger small" data-act="del-stop" data-d="${d}" data-i="${i}" style="margin-left:auto">刪除</button>
                </div>
              </div>
            </li>`).join('')}
          </ol>
          <div class="add-row"><button type="button" class="btn ghost small" data-act="add-stop" data-d="${d}">新增一站</button></div>
        </section>`;
      } else {
        const url = dayRouteUrl(day);
        let n = 0;
        html += `<section class="day" style="--c:${c}">
          <div class="day-head">
            <span class="day-label">${esc(day.label)}</span><span class="day-date">${esc(day.date)}</span>
            <span class="mode">${MODES[day.mode] || ''}</span>
            <h2 class="day-title">${esc(day.title)}</h2>
          </div>
          ${url ? `<div class="day-tools"><a href="${url}" target="_blank" rel="noopener">在 Google Maps 開啟整天路線</a></div>` : ''}
          <ol class="stops">
            ${day.stops.map((s, i) => {
              const loc = hasLoc(s);
              if (loc) n++;
              return `<li class="stop" data-d="${d}" data-i="${i}" tabindex="0">
                <span class="t">${esc(s.time)}</span>
                <span class="n ${loc ? '' : 'none'}">${loc ? n : ''}</span>
                <div class="body">
                  <p class="name">${esc(s.name)}<span class="type">${TYPES[s.type] || ''}</span></p>
                  ${s.note ? `<p class="note">${linkify(s.note)}</p>` : ''}
                  ${loc ? `<a class="nav" href="${navUrl(s)}" target="_blank" rel="noopener">Google Maps 導航</a>` : ''}
                </div>
                <span class="rail"></span>
              </li>`;
            }).join('')}
          </ol>
        </section>`;
      }
    });
    if (S.editing) html += '<div class="day"><button type="button" class="btn ghost" data-act="add-day">新增一天</button></div>';
    box.innerHTML = html;

    if (S.editing && window.Sortable) {
      $$('#dayList ol.stops').forEach((ol) => Sortable.create(ol, {
        group: 'stops', handle: '.handle', animation: 150,
        onEnd: (e) => {
          const from = +e.from.dataset.d, to = +e.to.dataset.d;
          if (from === to && e.oldIndex === e.newIndex) return;
          const [item] = ver().days[from].stops.splice(e.oldIndex, 1);
          ver().days[to].stops.splice(e.newIndex, 0, item);
          markDirty(); renderList(); renderMap();
        },
      }));
    }
  }

  // ---------------- Pages ----------------
  function field(arr, i, k, label, val, type) {
    if (type === 'check') return `<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-scope="row" data-arr="${arr}" data-i="${i}" data-k="${k}" ${val ? 'checked' : ''}>${label}</label>`;
    if (type === 'area') return `<label>${label}<textarea class="field" data-scope="row" data-arr="${arr}" data-i="${i}" data-k="${k}">${esc(val)}</textarea></label>`;
    return `<label>${label}<input class="field" data-scope="row" data-arr="${arr}" data-i="${i}" data-k="${k}" value="${esc(val)}"></label>`;
  }
  function editCards(arr, fields, addLabel) {
    const list = ver()[arr] || [];
    return list.map((row, i) => `<div class="ecard">${fields.map((f) => field(arr, i, f[0], f[1], row[f[0]], f[2])).join('')}
      <div class="row-end"><button type="button" class="btn danger small" data-act="del-row" data-arr="${arr}" data-i="${i}">刪除</button></div></div>`).join('')
      + `<button type="button" class="btn ghost small" data-act="add-row" data-arr="${arr}">${addLabel}</button>`;
  }

  const FLIGHT_F = [['leg', '去程／回程'], ['date', '日期'], ['flight', '航班'], ['route', '航線'], ['time', '時間'], ['price', '票價（每人）']];
  const HOTEL_F = [['name', '名稱'], ['dates', '日期'], ['room', '房型'], ['price', '價格'], ['note', '備註', 'area']];
  const BUDGET_F = [['item', '項目'], ['amount', 'NT$／人'], ['note', '說明']];
  const CHECK_F = [['title', '標題'], ['text', '說明', 'area'], ['done', '已完成', 'check']];

  function renderPages() {
    const v = ver();
    const flights = v.flights || [], hotels = v.hotels || [], budget = v.budget || [], checks = v.checklist || [];
    $('#view-info').innerHTML = `<div class="page-inner"><h2>航班與住宿</h2><p class="lead">${esc(v.name)}｜${esc(v.range)}</p>
      ${S.editing ? `<h3>航班</h3>${editCards('flights', FLIGHT_F, '新增航班')}<h3>住宿</h3>${editCards('hotels', HOTEL_F, '新增住宿')}` : `
      <div class="flights">${flights.map((f) => `<div class="flight"><div class="leg">${esc(f.leg)}｜${esc(f.date)}｜${esc(f.flight)}</div>
        <div class="time">${esc(f.time)}</div><div class="meta">${esc(f.route)}</div><div class="price">${esc(f.price)} ／人</div></div>`).join('')}</div>
      <h3>住宿</h3>${hotels.map((h) => `<div class="hotel"><h4>${esc(h.name)}</h4><div class="price">${esc(h.price)}</div>
        <p>${esc(h.dates)}｜${esc(h.room)}</p>${h.note ? `<p>${linkify(h.note)}</p>` : ''}</div>`).join('')}`}</div>`;

    $('#view-budget').innerHTML = `<div class="page-inner"><h2>費用推估</h2><p class="lead">每人金額，住宿、租車、油錢以 4 人分攤，不含購物。</p>
      ${S.editing ? `<div class="ecard"><label>每人總額<input class="field" data-scope="ver" data-k="budgetTotal" value="${esc(v.budgetTotal)}"></label></div>${editCards('budget', BUDGET_F, '新增項目')}` : `
      <div class="total"><strong>${esc(v.budgetTotal)}</strong><span>每人預估總花費</span></div>
      <div class="tbl-wrap"><table><thead><tr><th>項目</th><th class="amt">NT$／人</th><th>說明</th></tr></thead><tbody>
      ${budget.map((b) => `<tr><td>${esc(b.item)}</td><td class="amt">${esc(b.amount)}</td><td>${linkify(b.note)}</td></tr>`).join('')}
      </tbody></table></div><p class="footnote">匯率以 ¥1 ≈ NT$0.21 計算。實際價格以訂購當下為準。</p>`}</div>`;

    $('#view-check').innerHTML = `<div class="page-inner"><h2>行前清單</h2><p class="lead">${S.editing ? '勾選「已完成」後記得儲存。' : '完成的項目會劃線；要勾選請進入編輯。'}</p>
      ${S.editing ? editCards('checklist', CHECK_F, '新增項目') : `<ul class="checks">${checks.map((c) => `<li class="${c.done ? 'done' : ''}">
        <input type="checkbox" ${c.done ? 'checked' : ''} disabled aria-label="${esc(c.title)}"><div><div class="ct">${esc(c.title)}</div><p>${linkify(c.text)}</p></div></li>`).join('')}</ul>`}</div>`;
  }

  function renderAll(fit) {
    renderHeader(); renderChips(); renderList(); renderMap(fit); renderPages();
  }

  // ---------------- Tabs & navigation ----------------
  function setTab(t) {
    S.tab = t;
    $$('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
    $$('.view').forEach((v) => v.classList.toggle('on', v.id === `view-${t}`));
    if (t === 'map') setTimeout(() => map.invalidateSize(), 50);
  }
  $('#tabs').addEventListener('click', (e) => { const b = e.target.closest('button[data-tab]'); if (b) setTab(b.dataset.tab); });
  $('#versionSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-v]'); if (!b) return;
    S.v = +b.dataset.v; S.day = 'all';
    history.replaceState(null, '', '#' + ver().id);
    renderAll(true);
  });
  $('#dayChips').addEventListener('click', (e) => {
    const b = e.target.closest('.chip'); if (!b) return;
    S.day = b.dataset.day === 'all' ? 'all' : +b.dataset.day;
    renderChips(); renderList(); renderMap(true);
  });
  $('#dayList').addEventListener('click', (e) => {
    if (S.editing || e.target.closest('a')) return;
    const li = e.target.closest('.stop'); if (li) focusStop(+li.dataset.d, +li.dataset.i);
  });
  $('#dayList').addEventListener('keydown', (e) => {
    if (S.editing || e.key !== 'Enter') return;
    const li = e.target.closest('.stop'); if (li) focusStop(+li.dataset.d, +li.dataset.i);
  });

  // ---------------- Editing: data binding ----------------
  function markDirty() { S.dirty = true; $('#editState').textContent = '編輯中（尚未儲存）'; }
  function bindValue(el) {
    const k = el.dataset.k, v = ver();
    const val = el.type === 'checkbox' ? el.checked : el.value;
    switch (el.dataset.scope) {
      case 'ver': v[k] = val; break;
      case 'day': v.days[+el.dataset.d][k] = val; break;
      case 'stop': v.days[+el.dataset.d].stops[+el.dataset.i][k] = val; break;
      case 'row': v[el.dataset.arr][+el.dataset.i][k] = val; break;
      default: return false;
    }
    markDirty();
    return true;
  }
  document.addEventListener('input', (e) => { if (S.editing && e.target.dataset.scope && e.target.type !== 'checkbox') bindValue(e.target); });
  document.addEventListener('change', (e) => {
    const el = e.target;
    if (!S.editing || !el.dataset.scope) return;
    bindValue(el);
    if (el.dataset.scope === 'ver') renderHeader();
    if (el.dataset.scope === 'day') { renderChips(); renderMap(); }
    if (el.dataset.scope === 'stop') renderMap();
  });

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || !S.editing) return;
    const v = ver(), d = +b.dataset.d, i = +b.dataset.i;
    switch (b.dataset.act) {
      case 'add-stop':
        v.days[d].stops.push({ time: '', name: '新的一站', note: '', type: 'spot', lat: null, lng: null });
        markDirty(); renderList();
        break;
      case 'del-stop':
        if (!confirm(`刪除「${v.days[d].stops[i].name}」？`)) return;
        v.days[d].stops.splice(i, 1); markDirty(); renderList(); renderMap();
        break;
      case 'add-day':
        v.days.push({ label: `Day ${v.days.length + 1}`, date: '', title: '', mode: 'transit', stops: [] });
        markDirty(); renderChips(); renderList();
        break;
      case 'del-day':
        if (!confirm(`刪除 ${v.days[d].label} 和當天所有行程？`)) return;
        v.days.splice(d, 1); S.day = 'all'; markDirty(); renderChips(); renderList(); renderMap(true);
        break;
      case 'loc': openLoc(d, i); break;
      case 'add-row': {
        const arr = b.dataset.arr;
        const blank = { flights: {}, hotels: {}, budget: {}, checklist: { done: false } }[arr] || {};
        (v[arr] = v[arr] || []).push(Object.assign({}, blank));
        markDirty(); renderPages();
        break;
      }
      case 'del-row':
        if (!confirm('刪除這一筆？')) return;
        v[b.dataset.arr].splice(i, 1); markDirty(); renderPages();
        break;
      default:
    }
  });

  // ---------------- Location picking ----------------
  const locDialog = $('#locDialog');
  function openLoc(d, i) {
    S.locTarget = { d, i };
    $('#locQuery').value = ver().days[d].stops[i].name || '';
    $('#locResults').innerHTML = '';
    locDialog.showModal();
  }
  function setLoc(lat, lng) {
    const { d, i } = S.locTarget;
    const s = ver().days[d].stops[i];
    s.lat = lat; s.lng = lng;
    markDirty(); renderList(); renderMap();
    if (lat != null) map.flyTo([lat, lng], Math.max(map.getZoom(), 14), { duration: 0.6 });
  }
  $('#locForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = $('#locQuery').value.trim(); if (!q) return;
    const ul = $('#locResults');
    ul.innerHTML = '<li class="muted">搜尋中…</li>';
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&countrycodes=jp,tw&accept-language=zh-TW,ja&q=${encodeURIComponent(q)}`);
      const list = await r.json();
      ul.innerHTML = list.length ? list.map((p) => `<li><button type="button" data-lat="${p.lat}" data-lng="${p.lon}">${esc(p.display_name)}</button></li>`).join('')
        : '<li class="muted">找不到這個地點。試試日文名稱，或改用點地圖。</li>';
    } catch (err) { ul.innerHTML = '<li class="err">搜尋服務暫時無法使用，請改用點地圖。</li>'; }
  });
  $('#locResults').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-lat]'); if (!b) return;
    locDialog.close(); setLoc(parseFloat(b.dataset.lat), parseFloat(b.dataset.lng));
  });
  $('#locClear').addEventListener('click', () => { locDialog.close(); setLoc(null, null); });
  $('#locClose').addEventListener('click', () => locDialog.close());
  $('#locPick').addEventListener('click', () => {
    locDialog.close();
    S.pick = S.locTarget;
    const s = ver().days[S.pick.d].stops[S.pick.i];
    $('#pickName').textContent = s.name;
    $('#pickHint').hidden = false;
    document.body.classList.add('picking');
    setTab('map');
    if (window.matchMedia('(max-width: 900px)').matches) window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  function endPick() { S.pick = null; $('#pickHint').hidden = true; document.body.classList.remove('picking'); }
  $('#pickCancel').addEventListener('click', endPick);
  map.on('click', (e) => {
    if (!S.pick) return;
    S.locTarget = S.pick; endPick();
    setLoc(+e.latlng.lat.toFixed(6), +e.latlng.lng.toFixed(6));
    toast('位置已更新');
  });

  // ---------------- Edit mode: password, save ----------------
  const pwDialog = $('#pwDialog');
  $('#editBtn').addEventListener('click', () => {
    if (!CFG.enc || !CFG.owner || !CFG.repo) { toast('還沒設定編輯密碼。請先打開 setup.html 完成設定。', 5000); return; }
    $('#pwErr').hidden = true; $('#pwInput').value = '';
    pwDialog.showModal();
  });
  $('#pwCancel').addEventListener('click', () => pwDialog.close());
  $('#pwForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#pwErr'), ok = $('#pwOk');
    ok.disabled = true; err.hidden = true;
    try {
      let token;
      try { token = await TripCrypto.decrypt(CFG.enc, $('#pwInput').value); }
      catch (x) { throw new Error('密碼不正確。'); }
      let f;
      try { f = await GitHub.getFile(CFG, token, CFG.dataPath); }
      catch (x) { throw new Error('密碼正確，但金鑰無法使用（可能已過期）。請重新執行 setup.html。'); }
      if (f) { S.data = JSON.parse(f.text); S.sha = f.sha; }
      if (S.v >= S.data.versions.length) S.v = 0;
      S.token = token; S.editing = true; S.dirty = false;
      document.body.classList.add('editing');
      $('#editbar').hidden = false; $('#editState').textContent = '編輯中';
      pwDialog.close();
      renderAll();
    } catch (x) {
      err.textContent = x.message; err.hidden = false;
    } finally { ok.disabled = false; }
  });

  $('#saveBtn').addEventListener('click', async () => {
    const btn = $('#saveBtn');
    btn.disabled = true; btn.textContent = '儲存中…';
    try {
      S.data.updated = new Date().toISOString().slice(0, 10);
      S.sha = await GitHub.putFile(CFG, S.token, CFG.dataPath, JSON.stringify(S.data, null, 2), S.sha, `更新行程 ${S.data.updated}`);
      S.dirty = false;
      $('#editState').textContent = '編輯中（已儲存）';
      toast('已儲存。大約 1 分鐘後，大家重新整理就會看到新版本。', 5000);
    } catch (x) {
      if (x.code === 'conflict') alert('有其他人剛改過行程，這次沒有存進去。\n請先按「下載備份」保存你的修改，再重新整理頁面、重新編輯。');
      else toast('儲存失敗：' + x.message, 5000);
    } finally { btn.disabled = false; btn.textContent = '儲存到 GitHub'; }
  });

  $('#downloadBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(S.data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'itinerary.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  $('#cancelBtn').addEventListener('click', async () => {
    if (S.dirty && !confirm('有尚未儲存的修改，確定要放棄嗎？')) return;
    if (S.dirty) {
      try { const f = await GitHub.getFile(CFG, S.token, CFG.dataPath); if (f) S.data = JSON.parse(f.text); } catch (x) { await load(true); }
    }
    S.editing = false; S.token = null; S.dirty = false; endPick();
    document.body.classList.remove('editing');
    $('#editbar').hidden = true;
    if (S.v >= S.data.versions.length) S.v = 0;
    renderAll();
  });

  window.addEventListener('beforeunload', (e) => { if (S.dirty) { e.preventDefault(); e.returnValue = ''; } });

  // ---------------- Load ----------------
  async function load(silent) {
    try {
      const r = await fetch(`${CFG.dataPath}?t=${Date.now()}`, { cache: 'no-store' });
      if (!r.ok) throw new Error(r.status);
      S.data = await r.json();
    } catch (e) {
      if (!silent) $('#dayList').innerHTML = '<p class="empty">讀不到行程資料（data/itinerary.json）。請確認檔案有上傳到 repo。</p>';
      return false;
    }
    const id = location.hash.slice(1);
    const idx = S.data.versions.findIndex((v) => v.id === id);
    S.v = idx >= 0 ? idx : 0;
    return true;
  }

  load().then((ok) => {
    if (!ok) return;
    renderAll(true);
    setTimeout(() => map.invalidateSize(), 100);
  });
})();
