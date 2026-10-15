"use strict";
/* Iglú de Colección — catálogo y tracker del merch de Club Penguin.
   Datos: data/catalog.json (catálogo) y data/mis-fotos.json (fotos propias en el repo).
   Progreso: localStorage; fotos tomadas desde la app: IndexedDB. */

const LS_KEY = "iglu-coleccion-v1";
const UI_KEY = "iglu-ui-v1";
const RANK = { c: 0, p: 1, r: 2, m: 3, x: 4 };
const COLORS = { rosa: "pink", rosado: "pink", azul: "blue", celeste: "blue", rojo: "red", roja: "red", verde: "green", amarillo: "yellow", amarilla: "yellow",
  morado: "purple", morada: "purple", lila: "purple", naranja: "orange", anaranjado: "orange", negro: "black", negra: "black", blanco: "white", blanca: "white",
  cafe: "brown", marron: "brown", dorado: "gold", dorada: "gold", dragon: "dragon", hada: "faery", pirata: "rockhopper", bombero: "firefighter", vaquero: "cowboy" };

const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[m]);
const norm = s => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

let CAT = null, BY_ID = new Map(), REPO_PHOTOS = {};
let store = load(LS_KEY, { owned: {}, notes: {} });
const ui = Object.assign({ cat: "all", own: "all", rar: "", sort: "cat" }, load(UI_KEY, {}));
let query = "";

function load(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d } catch { return d } }
function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(store)) } catch { toast("No se pudo guardar en este navegador") } }
function saveUI() { try { localStorage.setItem(UI_KEY, JSON.stringify(ui)) } catch {} }

/* ---------- fotos ---------- */
function sized(url, w) {
  if (!url) return url;
  url = url.replace("https://questying.files.wordpress.com/", "https://questying.wordpress.com/wp-content/uploads/");
  const u = new URL(url);
  ["fit", "resize", "w", "h"].forEach(p => u.searchParams.delete(p));
  u.searchParams.set("w", w);
  return u.toString();
}
const idb = (() => {
  let p;
  const open = () => p ??= new Promise((res, rej) => {
    const r = indexedDB.open("iglu-fotos", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("photos");
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  const tx = async (mode, fn) => { const db = await open(); return new Promise((res, rej) => {
    const t = db.transaction("photos", mode); const req = fn(t.objectStore("photos"));
    t.oncomplete = () => res(req?.result); t.onerror = () => rej(t.error); }) };
  return { get: id => tx("readonly", s => s.get(id)), set: (id, b) => tx("readwrite", s => s.put(b, id)),
    del: id => tx("readwrite", s => s.delete(id)), keys: () => tx("readonly", s => s.getAllKeys()) };
})();
let LOCAL_PHOTOS = new Set();
async function shrink(file, max = 1400) {
  const img = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return new Promise(r => c.toBlob(r, "image/jpeg", .85));
}

/* ---------- progreso ---------- */
const weight = it => it.total || 1;
function have(it) { const o = store.owned[it.id]; if (!o) return 0; return it.total ? Math.min(o.n || 0, it.total) : 1 }
const complete = it => have(it) >= weight(it);
function sum(list) { let g = 0, t = 0; for (const it of list) { g += have(it); t += weight(it) } return [g, t] }

function setOwned(it, val) {
  if (val) store.owned[it.id] = { ...(store.owned[it.id] || {}), ...val, t: Date.now() };
  else delete store.owned[it.id];
  save(); render(); if (openId === it.id) drawSheet();
}

/* ---------- búsqueda y filtros ---------- */
function tokens(q) {
  return norm(q).split(" ").filter(Boolean).map(t => {
    const s = t.match(/^s(\d{1,2})$/); if (s) return ["series " + s[1]];
    return COLORS[t] ? [t, COLORS[t]] : [t];
  });
}
function matches(it, toks) {
  if (!toks.length) return true;
  return toks.every(alts => alts.some(a => /^series \d+$/.test(a) ? new RegExp(`\\b${a}\\b`).test(it._hay) : it._hay.includes(a)));
}
function visible() {
  const toks = tokens(query);
  return CAT.items.filter(it =>
    (ui.cat === "all" || it.cat === ui.cat) &&
    (ui.own === "all" || (ui.own === "have" ? have(it) > 0 : !complete(it))) &&
    (!ui.rar || (ui.rar === "r+" ? RANK[it.rarity] >= 2 : it.rarity === ui.rar)) &&
    matches(it, toks));
}

/* ---------- render ---------- */
function render() {
  const [g, t] = sum(CAT.items);
  const pct = t ? Math.round(g / t * 1000) / 10 : 0;
  $("#pct").textContent = pct + "%"; $("#bar").style.width = pct + "%";
  $("#progTxt").textContent = `${g.toLocaleString("es")} de ${t.toLocaleString("es")} · ${(n => `${n} ${n === 1 ? "artículo" : "artículos"}`)(CAT.items.filter(i => have(i) > 0).length)}`;

  const nav = $("#cats"); nav.textContent = "";
  [{ id: "all", name: "Todo" }, ...CAT.categories].forEach(c => {
    const [cg, ct] = sum(c.id === "all" ? CAT.items : CAT.items.filter(i => i.cat === c.id));
    const b = document.createElement("button"); b.type = "button"; b.className = "chip";
    b.setAttribute("aria-pressed", ui.cat === c.id);
    b.innerHTML = `${esc(c.name)} <span class="n">${cg}/${ct}</span>`;
    b.onclick = () => { ui.cat = c.id; saveUI(); render(); window.scrollTo({ top: 0 }) };
    nav.appendChild(b);
  });
  document.querySelectorAll("[data-own]").forEach(b => b.setAttribute("aria-pressed", b.dataset.own === ui.own));
  $("#rar").value = ui.rar; $("#sort").value = ui.sort;

  const list = visible();
  const main = $("#main"); main.textContent = "";
  if (!list.length) { main.innerHTML = `<p class="empty">Nada coincide${query ? ` con “${esc(query)}”` : ""}. Prueba con menos filtros.</p>`; return }

  if (ui.sort !== "cat") {
    const sorted = [...list].sort(ui.sort === "az" ? (a, b) => a.name.localeCompare(b.name, "es") : (a, b) => RANK[b.rarity] - RANK[a.rarity] || a.name.localeCompare(b.name, "es"));
    const sec = el("section", "cat");
    sec.innerHTML = `<div class="cat-h"><h2>${ui.sort === "az" ? "A–Z" : "Más raros primero"}</h2><span class="count">${sorted.length} resultados</span></div>`;
    sec.appendChild(grid(sorted, true)); main.appendChild(sec); return;
  }
  for (const c of CAT.categories) {
    const inCat = list.filter(i => i.cat === c.id); if (!inCat.length) continue;
    const [cg, ct] = sum(CAT.items.filter(i => i.cat === c.id));
    const sec = el("section", "cat");
    sec.innerHTML = `<div class="cat-h"><h2>${esc(c.name)}</h2><span class="count">${query ? `${inCat.length} resultados` : `${cg} / ${ct}`}</span></div>${query ? "" : `<p class="cat-note">${esc(c.note)}</p>`}`;
    if (query) { sec.appendChild(grid(inCat, true)); main.appendChild(sec); continue }
    for (const gr of c.groups) {
      const items = inCat.filter(i => i.group === gr.name); if (!items.length) continue;
      const [gg, gt] = sum(CAT.items.filter(i => i.cat === c.id && i.group === gr.name));
      const g = el("div", "grp");
      g.innerHTML = `<div class="grp-h"><h3>${esc(gr.name)}</h3><span class="count">${gg}/${gt}${gg === gt ? ' <span class="bingo">· Bingo</span>' : ""}</span></div>${gr.note && !query ? `<p class="grp-note">${esc(gr.note)}</p>` : ""}`;
      g.appendChild(grid(items, false)); sec.appendChild(g);
    }
    main.appendChild(sec);
  }
}
function el(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e }
function rarColor(r) { return `var(--r-${r})` }
function grid(items, showGroup) {
  const g = el("div", "grid");
  for (const it of items) g.appendChild(card(it, showGroup));
  return g;
}
function card(it, showGroup) {
  const h = have(it), c = el("article", "card" + (complete(it) ? " have" : ""));
  c.style.setProperty("--rc", rarColor(it.rarity));
  const src = LOCAL_PHOTOS.has(it.id) ? null : (REPO_PHOTOS[it.id] || (it.img && sized(it.img, 320)));
  c.innerHTML = `<a class="open" href="#/item/${encodeURIComponent(it.id)}" aria-label="${esc(it.name)}, ${esc(it.group)}. Ver ficha">
    <div class="thumb">${src ? `<img loading="lazy" decoding="async" alt="" src="${esc(src)}">` : `<span class="ph">${LOCAL_PHOTOS.has(it.id) ? "" : esc(it.name.slice(0, 1))}</span>`}</div>
    <div class="info"><span class="nm">${esc(it.name)}</span><span class="sub">${esc(showGroup ? (ui.sort === "cat" ? it.group : `${catName(it.cat)} · ${it.group}`) : (it.note || ""))}</span>
    ${it.total ? `<div class="mini"><i style="width:${h / it.total * 100}%"></i></div>` : ""}
    <span class="rk">${esc(CAT.rarity[it.rarity].label)}</span></div></a>`;
  if (LOCAL_PHOTOS.has(it.id)) idb.get(it.id).then(b => { if (b) { const i = new Image(); i.alt = ""; i.src = URL.createObjectURL(b); $(".thumb", c).replaceChildren(i) } });
  $(".open", c).addEventListener("click", () => { fromList = true });
  const img = $(".thumb img", c); if (img) img.onerror = () => img.replaceWith(Object.assign(el("span", "ph"), { textContent: it.name.slice(0, 1) }));
  if (it.total) {
    const ctr = el("div", "ctr");
    ctr.innerHTML = `<button type="button" aria-label="Quitar uno de ${esc(it.name)}">−</button><output>${h}/${it.total}</output><button type="button" aria-label="Sumar uno a ${esc(it.name)}">+</button>`;
    const [m, p] = ctr.querySelectorAll("button");
    m.onclick = () => bump(it, -1); p.onclick = () => bump(it, 1);
    c.appendChild(ctr);
  } else {
    const b = el("button", "chk"); b.type = "button"; b.textContent = "✓";
    b.setAttribute("aria-pressed", !!h); b.setAttribute("aria-label", `${h ? "Quitar de" : "Agregar a"} mi colección: ${it.name}`);
    b.onclick = () => setOwned(it, h ? null : { have: true });
    c.appendChild(b);
  }
  return c;
}
function bump(it, d) { const n = Math.max(0, Math.min(it.total, have(it) + d)); setOwned(it, n ? { n } : null) }
const catName = id => CAT.categories.find(c => c.id === id)?.name || "";

/* ---------- ficha ---------- */
let openId = null, lastFocus = null, photoView = "auto", fromList = false;
const baseName = n => norm(n.replace(/\(.*?\)/g, ""));
function versionsOf(it) {
  if (!["plush", "puffles", "mixnmatch"].includes(it.cat)) return [];
  const b = baseName(it.name);
  return CAT.items.filter(o => o !== it && o.cat === it.cat && baseName(o.name) === b);
}
function ebayURL(it) {
  const q = `${CAT.categories.find(c => c.id === it.cat).info.ebay} ${it.name.replace(/\(.*?\)/g, "").replace(/[+·,]/g, " ")}`.replace(/\s+/g, " ").trim();
  return "https://www.ebay.com/sch/i.html?LH_Sold=1&LH_Complete=1&_nkw=" + encodeURIComponent(q);
}
const imgURL = it => "https://www.google.com/search?tbm=isch&q=" + encodeURIComponent(`club penguin ${it.group} ${it.name}`);

function route() {
  const m = location.hash.match(/^#\/item\/(.+)$/);
  const id = m && decodeURIComponent(m[1]);
  if (id && BY_ID.has(id)) { if (openId !== id) { lastFocus ??= document.activeElement; openId = id; photoView = "auto"; drawSheet() } }
  else closeSheet(false);
}
function closeSheet(push = true) {
  if (!openId) return; openId = null; $(".sheet-bg")?.remove(); document.body.style.overflow = "";
  if (push && location.hash) { if (fromList) history.back(); else history.replaceState(null, "", location.pathname + location.search) }
  fromList = false;
  lastFocus?.focus?.(); lastFocus = null;
}
async function drawSheet() {
  const it = BY_ID.get(openId); if (!it) return;
  const cat = CAT.categories.find(c => c.id === it.cat), info = cat.info, rar = CAT.rarity[it.rarity];
  const h = have(it), note = store.notes[it.id] || {};
  const localBlob = LOCAL_PHOTOS.has(it.id) ? await idb.get(it.id).catch(() => null) : null;
  const mine = localBlob ? URL.createObjectURL(localBlob) : REPO_PHOTOS[it.id];
  const view = photoView === "auto" ? (mine ? "mine" : "cat") : photoView;
  const srcImg = view === "mine" ? mine : (it.img && sized(it.img, 900));
  const vers = versionsOf(it);
  const old = $(".sheet-bg"); const scroll = old ? $(".sheet", old).scrollTop : 0;
  const bg = el("div", "sheet-bg");
  bg.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sh-t" style="--rc:${rarColor(it.rarity)}">
    <div class="sh-top"><div><div class="crumb">${esc(cat.name)} · ${esc(it.group)}</div><h2 id="sh-t">${esc(it.name)}</h2></div><button class="x" type="button" aria-label="Cerrar ficha">✕</button></div>
    ${mine && it.img ? `<div class="photo-tabs" role="group" aria-label="Foto"><button type="button" data-v="mine" aria-pressed="${view === "mine"}">Mi foto</button><button type="button" data-v="cat" aria-pressed="${view === "cat"}">Catálogo</button></div>` : ""}
    <div class="photo">${srcImg ? `<img alt="${esc(it.name)}" src="${esc(srcImg)}">` : `<div class="ph">Aún no hay foto de esta pieza.<br>Mira ventas reales en eBay o agrega la tuya abajo.</div>`}</div>
    ${view === "cat" && it.img ? `<div class="credit">Foto: <a href="${esc(it.imgSrc)}" target="_blank" rel="noopener">That Penguin Game</a></div>` : ""}
    ${it.desc ? `<p>${esc(it.desc)}</p>` : ""}
    ${it.note ? `<p><b>${esc(it.note)}.</b></p>` : ""}
    <dl class="facts">
      <dt>Rareza</dt><dd style="color:var(--rc);font-weight:800">${esc(rar.label)}</dd>
      <dt>Por qué</dt><dd>${esc(rar.why)}</dd>
      <dt>Fabricante</dt><dd>${esc(info.maker)}</dd>
      ${it.year ? `<dt>Salida</dt><dd>${esc(it.year)}</dd>` : ""}
      <dt>Incluía</dt><dd>${esc(info.incl)}</dd>
      ${vers.length ? `<dt>Otras versiones</dt><dd><div class="vers">${vers.map(v => `<a href="#/item/${encodeURIComponent(v.id)}" class="${have(v) ? "own" : ""}">${esc(v.group)}${have(v) ? " ✓" : ""}</a>`).join("")}</div></dd>` : ""}
    </dl>
    <div class="tip"><b>Cómo saber si es original</b>${esc(info.check)}</div>
    <div class="links">
      ${it.total ? `<div class="ctr" style="padding:0;gap:10px"><button type="button" data-b="-1" aria-label="Quitar uno">−</button><output>${h}/${it.total}</output><button type="button" data-b="1" aria-label="Sumar uno">+</button></div>`
        : `<button type="button" class="btn primary ${h ? "on" : ""}" id="own">${h ? "✓ En mi colección · quitar" : "Agregar a mi colección"}</button>`}
      <a class="btn" href="${ebayURL(it)}" target="_blank" rel="noopener">Vendidos en eBay ↗</a>
      <a class="btn" href="${imgURL(it)}" target="_blank" rel="noopener">Más fotos ↗</a>
    </div>
    <form class="mine" id="mineForm">
      <h3>Mi registro</h3>
      <label>Precio pagado<input id="f-price" inputmode="decimal" placeholder="ej. 25 USD" value="${esc(note.price)}"></label>
      <label>Fecha de compra<input id="f-date" type="date" value="${esc(note.date)}"></label>
      <label class="full">Notas<textarea id="f-note" placeholder="Vendedor, estado, si trae la moneda…">${esc(note.note)}</textarea></label>
      <label class="full">Mi foto
        <span style="display:flex;gap:8px;flex-wrap:wrap"><span class="btn" role="button" tabindex="0" id="addPhoto">${localBlob ? "Cambiar mi foto" : "Agregar foto"}</span>${localBlob ? `<button type="button" class="btn" id="delPhoto">Quitar mi foto</button>` : ""}</span>
        <input type="file" id="photoFile" accept="image/*" hidden>
      </label>
    </form>
  </div>`;
  old?.remove(); document.body.appendChild(bg); document.body.style.overflow = "hidden";
  const sheet = $(".sheet", bg); sheet.scrollTop = scroll;
  bg.addEventListener("click", e => { if (e.target === bg) closeSheet() });
  bg.addEventListener("keydown", e => { if (e.key === "Escape") closeSheet() });
  $(".x", bg).onclick = () => closeSheet();
  bg.querySelectorAll(".vers a").forEach(a => a.onclick = e => { e.preventDefault(); location.replace(a.getAttribute("href")) });
  bg.querySelectorAll("[data-v]").forEach(b => b.onclick = () => { photoView = b.dataset.v; drawSheet() });
  bg.querySelectorAll("[data-b]").forEach(b => b.onclick = () => bump(it, +b.dataset.b));
  const own = $("#own", bg); if (own) own.onclick = () => setOwned(it, h ? null : { have: true });
  const pimg = $(".photo img", bg); if (pimg) pimg.onerror = () => { $(".photo", bg).innerHTML = `<div class="ph">La foto no cargó. Revisa tu conexión o abre la fuente.</div>` };
  let tm; const saveNote = () => { clearTimeout(tm); tm = setTimeout(() => {
    const n = { price: $("#f-price", bg).value.trim(), date: $("#f-date", bg).value, note: $("#f-note", bg).value.trim() };
    if (n.price || n.date || n.note) store.notes[it.id] = n; else delete store.notes[it.id]; save();
  }, 400) };
  ["#f-price", "#f-date", "#f-note"].forEach(s => $(s, bg).addEventListener("input", saveNote));
  $("#mineForm", bg).addEventListener("submit", e => e.preventDefault());
  const file = $("#photoFile", bg), add = $("#addPhoto", bg);
  add.onclick = () => file.click(); add.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); file.click() } };
  file.onchange = async () => {
    const f = file.files[0]; if (!f) return;
    try { await idb.set(it.id, await shrink(f)); LOCAL_PHOTOS.add(it.id); photoView = "mine"; toast("Foto guardada en este dispositivo"); render(); drawSheet() }
    catch { toast("No se pudo guardar la foto") }
  };
  const del = $("#delPhoto", bg); if (del) del.onclick = async () => { await idb.del(it.id); LOCAL_PHOTOS.delete(it.id); photoView = "auto"; render(); drawSheet() };
  if (!old) $(".x", bg).focus();
}

/* ---------- respaldo ---------- */
function exportData() {
  const data = { app: "iglu-coleccion", version: 1, exported: new Date().toISOString(), owned: store.owned, notes: store.notes };
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: "application/json" }));
  a.download = `coleccion-club-penguin-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast("Respaldo descargado (las fotos propias no se incluyen)");
}
async function importData(file) {
  try {
    const d = JSON.parse(await file.text());
    if (d.app !== "iglu-coleccion" || typeof d.owned !== "object") throw 0;
    let added = 0;
    for (const [id, v] of Object.entries(d.owned)) {
      if (!BY_ID.has(id)) continue;
      const cur = store.owned[id];
      if (!cur || (v.t || 0) > (cur.t || 0)) { if (!cur) added++; store.owned[id] = v }
    }
    for (const [id, v] of Object.entries(d.notes || {})) if (BY_ID.has(id) && !store.notes[id]) store.notes[id] = v;
    save(); render(); toast(`Respaldo combinado: ${added} artículos nuevos`);
  } catch { toast("Ese archivo no es un respaldo de esta app") }
}

let toastT;
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 2800) }

/* ---------- arranque ---------- */
async function init() {
  try {
    const [cat, mine] = await Promise.all([
      fetch("data/catalog.json").then(r => r.json()),
      fetch("data/mis-fotos.json").then(r => r.ok ? r.json() : {}).catch(() => ({})),
    ]);
    CAT = cat; REPO_PHOTOS = mine || {};
  } catch { $("#main").innerHTML = `<p class="empty">No se pudo cargar el catálogo. Revisa tu conexión y recarga.</p>`; return }
  for (const it of CAT.items) {
    it._hay = norm([it.name, it.group, catName(it.cat), it.note, CAT.rarity[it.rarity].label, it.year].join(" "));
    BY_ID.set(it.id, it);
  }
  try { LOCAL_PHOTOS = new Set(await idb.keys()) } catch {}
  render(); route();

  let qt; $("#q").addEventListener("input", e => { clearTimeout(qt); qt = setTimeout(() => { query = e.target.value; render() }, 120) });
  document.querySelectorAll("[data-own]").forEach(b => b.onclick = () => { ui.own = b.dataset.own; saveUI(); render() });
  $("#rar").onchange = e => { ui.rar = e.target.value; saveUI(); render() };
  $("#sort").onchange = e => { ui.sort = e.target.value; saveUI(); render() };
  window.addEventListener("hashchange", route);
  document.addEventListener("keydown", e => {
    if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); $("#q").focus() }
  });
  const menu = $("#menu"), mb = $("#menuBtn");
  const setMenu = o => { menu.hidden = !o; mb.setAttribute("aria-expanded", o) };
  mb.onclick = e => { e.stopPropagation(); setMenu(menu.hidden) };
  document.addEventListener("click", e => { if (!menu.hidden && !menu.contains(e.target)) setMenu(false) });
  $("#exportBtn").onclick = () => { setMenu(false); exportData() };
  $("#importFile").onchange = e => { setMenu(false); if (e.target.files[0]) importData(e.target.files[0]); e.target.value = "" };
  $("#aboutBtn").onclick = () => {
    setMenu(false); lastFocus = mb;
    const bg = el("div", "sheet-bg");
    bg.innerHTML = `<div class="sheet about" role="dialog" aria-modal="true" style="--rc:var(--ice)"><div class="sh-top"><div></div><button class="x" type="button" aria-label="Cerrar">✕</button></div>${$("#aboutTpl").innerHTML}<p class="credit">Catálogo actualizado: ${esc(CAT.generated)} · ${CAT.items.length} artículos</p></div>`;
    const close = () => { bg.remove(); document.body.style.overflow = ""; mb.focus() };
    bg.onclick = e => { if (e.target === bg) close() }; bg.onkeydown = e => { if (e.key === "Escape") close() };
    $(".x", bg).onclick = close; document.body.appendChild(bg); document.body.style.overflow = "hidden"; $(".x", bg).focus();
  };
}
init();
if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
