import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword, updatePassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager, doc, getDoc, setDoc, updateDoc, addDoc, collection, getDocs, query, where, deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig, EMAIL_DOMAIN, MAX_DIST_M } from "./firebase-config.js";
import { UNITS, NEEDS, SITES, START, MIN_DATE, SURVEY_GOAL, ITEMS, PROBS, PROB_NAME, REASONS, SITE_ST, LABELS, FIELDS, AGE, num, total, TOTAL_TARGET, unitById, SITES_BY_UNIT,
  nf, pct, fmtD, rateOf, CHECKS, CHECK_NAME, isoOf, haversine, calc, alertsFor, reportText, analyzeVisits, surveyAgg, supState, stockInfo, stockFlag, rankRows, dayTable, campaignDay, CAMPAIGN_DAYS, END } from "./logic.js";

const VER = "5.0";
const app = initializeApp(firebaseConfig), auth = getAuth(app);
let db; try { db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }); } catch (e) { db = getFirestore(app); }
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)], root = $("#app");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const today = () => isoOf(new Date());
function toast(m) { const t = $("#toast"); t.textContent = m; t.style.display = "block"; clearTimeout(toast.h); toast.h = setTimeout(() => t.style.display = "none", 4500); }
const errMsg = e => e && e.code === "permission-denied" ? "غير مصرّح لحسابك بهذا الإجراء" : (e && (e.message || e.code)) || "خطأ";
function getPos() { return new Promise((res, rej) => {
  if (!navigator.geolocation) return rej(new Error("المتصفح لا يدعم تحديد الموقع"));
  navigator.geolocation.getCurrentPosition(p => res({ lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy) }),
    e => rej(new Error(e.code === 1 ? "لازم تسمح للمتصفح بتحديد الموقع ثم أعد المحاولة" : "تعذّر تحديد الموقع، تأكد من تشغيل GPS")), { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }); }); }
const mapLink = l => l ? `<a target="_blank" rel="noopener" href="https://www.google.com/maps?q=${l.lat},${l.lng}">خريطة</a>` : "—";
const vals = o => Object.values(o || {});
const intOrNull = raw => { raw = String(raw).trim(); const v = raw === "" ? 0 : Number(raw); return Number.isInteger(v) && v >= 0 ? v : null; };
const unitSel = (id, list, sel) => `<select id="${id}">${list.slice().sort((a, b) => a.name.localeCompare(b.name, "ar")).map(u => `<option value="${u.id}"${+sel === u.id ? " selected" : ""}>${esc(u.name)}</option>`).join("")}</select>`;
const stat = (l, v, c) => `<div class="stat"><span>${l}</span><b${c ? ` class="${c}"` : ""}>${v}</b></div>`;
const lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } }, lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { } }, lsDel = k => { try { localStorage.removeItem(k); } catch { } };
$("#ver").textContent = "إصدار " + VER;

/* حفظ يتحمّل انقطاع النت: لو الخادم ما ردّش خلال 3.5 ثانية يُحفظ على الموبايل ويُرسل تلقائيًا لاحقًا */
async function save(p, okMsg) {
  const r = await Promise.race([p.then(() => 1), new Promise(res => setTimeout(() => res(0), 3500))]);
  if (!r) p.catch(e => toast("تعذّر إرسال بيان محفوظ: " + errMsg(e)));
  if (okMsg !== null) toast(r ? okMsg : "اتحفظ على موبايلك ✅ وهيتبعت أول ما النت يرجع");
  return r;
}
const telOf = unit => ((S.contacts || {})["c" + unit] || {}).tel || "";
const digits = t => String(t || "").replace(/[^\d]/g, "");
const waNum = t => { const d = digits(t); return d.startsWith("0") ? "20" + d.slice(1) : d; };
const callBtns = unit => { const t = telOf(unit); return t ? `<a class="btn sm" href="tel:${digits(t)}">📞 اتصال</a> <a class="btn sm" target="_blank" rel="noopener" href="https://wa.me/${waNum(t)}">واتساب</a>` : '<span class="mut">لا يوجد رقم</span>'; };
function download(name, text, type) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + text], { type: type || "text/csv" })); a.download = name; a.click(); }

/* ---------- PWA / offline / install ---------- */
if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => { });
const netUpd = () => { const n = $("#net"); if (n) n.style.display = navigator.onLine ? "none" : "block"; };
addEventListener("online", netUpd); addEventListener("offline", netUpd); netUpd();
let deferred = null;
const standalone = () => (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone;
addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferred = e; drawAnn(); });
function installHtml() {
  if (standalone() || lsGet("mr.noinst")) return "";
  if (deferred) return `<div class="card inst"><b>📲 ثبّت التطبيق على موبايلك</b><div class="mut">يفتح بضغطة واحدة من الشاشة الرئيسية، ويشتغل حتى لو النت ضعيف.</div><p><button id="inst">تثبيت</button> <button class="ghost" id="noinst">لاحقًا</button></p></div>`;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return `<div class="card inst"><b>📲 ثبّت التطبيق على موبايلك</b><div class="mut">${ios ? "اضغط زر المشاركة ثم «إضافة إلى الشاشة الرئيسية»." : "من قائمة المتصفح (⋮ النقط التلاتة) اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية»."}</div><p><button class="ghost" id="noinst">فهمت</button></p></div>`;
}
document.addEventListener("click", e => { const id = e.target.id;
  if (id === "inst" && deferred) { deferred.prompt(); deferred = null; drawAnn(); const c = e.target.closest(".inst"); if (c) c.remove(); }
  if (id === "noinst") { lsSet("mr.noinst", "1"); const c = e.target.closest(".inst"); if (c) c.remove(); drawAnn(); }
  if (id === "annx") { const n = S.notes && S.notes.current; if (n) lsSet("mr.ann", n.ts); drawAnn(); } });
function drawAnn() {
  const el = $("#ann"); if (!el) return; const n = S.notes && S.notes.current; let h = "";
  if (n && n.text && lsGet("mr.ann") !== n.ts) h += `<div class="card note"><b>📢 إعلان من الإدارة</b><p>${esc(n.text).replace(/\n/g, "<br>")}</p><button id="annx" class="ghost sm">تمام، فهمت</button></div>`;
  el.innerHTML = h + installHtml();
}

/* ---------- state + live data ---------- */
let profile = null, unsubs = [], S = {}, cur = null, tabs = [], pending = false;
function resetState() { unsubs.forEach(u => u()); unsubs = []; S = { reports: {}, visits: {}, sites: {}, supplies: {}, survey: {}, geo: {}, notes: {}, contacts: {}, cases: {} }; }
resetState();
function sub(key, ref, kind) {
  unsubs.push(onSnapshot(ref, { includeMetadataChanges: key === "reports" }, snap => {
    const put = (id, d, m) => { S[key][id] = key === "reports" && m && m.hasPendingWrites ? { ...d, _p: 1 } : d; };
    S[key] = {};
    if (kind === "doc") { if (snap.exists()) put(snap.id, snap.data(), snap.metadata); } else snap.docs.forEach(d => put(d.id, d.data(), d.metadata));
    schedule(); }, e => { toast("تعذّر تحميل " + key + ": " + errMsg(e)); }));
}
function schedule() { clearTimeout(schedule.h); schedule.h = setTimeout(refresh, 200); }
function refresh() { drawAnn(); if (!cur || cur.k === "a") return; const a = document.activeElement; if (a && a.closest && a.closest("#tb") && a.matches("input,textarea,select")) { pending = true; return; } renderTab(true); }
document.addEventListener("focusout", () => setTimeout(() => { if (pending) { pending = false; refresh(); } }, 300));
function renderTab(keep) {
  const tb = $("#tb"); if (!tb || !cur) return; const saved = {};
  if (keep) $$("#tb input[id],#tb select[id],#tb textarea[id]").forEach(el => saved[el.id] = el.type === "checkbox" ? el.checked : el.value);
  const sy = window.scrollY; tb.innerHTML = cur.render();
  Object.keys(saved).forEach(id => { const el = document.getElementById(id); if (el && !el.dataset.noKeep) { if (el.type === "checkbox") el.checked = saved[id]; else el.value = saved[id]; } });
  cur.after && cur.after(); if (keep) window.scrollTo(0, sy);
}
function setTab(k) { cur = tabs.find(t => t.k === k) || tabs[0]; $$(".nav button").forEach(b => b.classList.toggle("on", b.dataset.t === cur.k)); lsSet("mr.tab." + profile.role, cur.k); renderTab(false); window.scrollTo(0, 0); }
function shell(sub, tabList) {
  tabs = tabList;
  root.innerHTML = `<div class="bar top"><div><h1>حملة الحصبة والحصبة الألمانية</h1><div class="mut">${esc(sub)}</div></div><div class="acts"><button class="ghost sm" id="pw">كلمة المرور</button><button class="ghost sm" id="out">خروج</button></div></div>
  <div id="ann"></div><div id="tb"></div><nav class="nav">${tabs.map(t => `<button data-t="${t.k}"><i>${t.icon || "•"}</i><span>${t.label}</span></button>`).join("")}</nav>`;
  $("#out").onclick = () => signOut(auth);
  $("#pw").onclick = async () => { const p = prompt("اكتب كلمة المرور الجديدة (6 أحرف على الأقل)"); if (!p) return;
    try { await updatePassword(auth.currentUser, p); toast("تم تغيير كلمة المرور"); } catch (e) { toast(e.code === "auth/requires-recent-login" ? "اخرج وادخل من جديد ثم أعد المحاولة" : "تعذّر التغيير (6 أحرف على الأقل)"); } };
  $(".nav").onclick = e => { const b = e.target.closest("button[data-t]"); if (b) setTab(b.dataset.t); };
  $("#tb").onclick = e => cur && cur.click && cur.click(e);
  $("#tb").onchange = e => cur && cur.change && cur.change(e);
  $("#tb").oninput = e => cur && cur.input && cur.input(e);
  drawAnn();
  const last = lsGet("mr.tab." + profile.role); setTab(tabs.some(t => t.k === last) ? last : tabs[0].k);
}
const helpCard = (title, steps) => `<details class="card help"><summary>❓ ${title}</summary><ol>${steps.map(s => `<li>${s}</li>`).join("")}</ol></details>`;

/* ---------- auth ---------- */
onAuthStateChanged(auth, async u => {
  resetState(); cur = null;
  if (!u) { profile = null; return loginView(); }
  try { const s = await getDoc(doc(db, "users", u.uid)); if (!s.exists()) throw 0; profile = { uid: u.uid, ...s.data() }; }
  catch { toast("حسابك غير مفعّل، كلّم الإدارة"); await signOut(auth); return; }
  ({ unit: unitView, supervisor: supView, admin: adminView, store: storeView }[profile.role] || loginView)();
});
function loginView() {
  root.innerHTML = `<div class="card login"><div class="logo">💉</div><h1>حملة الحصبة والحصبة الألمانية</h1><div class="mut">إدارة المنشاة الصحية</div>
  <form id="f"><label>اسم المستخدم</label><input id="u" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" required value="${esc(lsGet("mr.login") || "")}">
  <label>كلمة المرور</label><input id="p" type="password" autocomplete="current-password" required>
  <label class="chk"><input type="checkbox" id="sp"> إظهار كلمة المرور</label><p><button class="big">دخول</button></p></form>
  <div class="mut">نسيت بيانات الدخول؟ كلّم الإدارة.</div></div>${installHtml()}`;
  $("#sp").onchange = e => $("#p").type = e.target.checked ? "text" : "password";
  $("#f").onsubmit = async e => { e.preventDefault(); const b = e.target.querySelector("button"); b.disabled = true; const lg = $("#u").value.trim().toLowerCase();
    try { await signInWithEmailAndPassword(auth, lg + "@" + EMAIL_DOMAIN, $("#p").value); lsSet("mr.login", lg); }
    catch (er) { toast(er.code === "auth/network-request-failed" ? "لا يوجد اتصال بالإنترنت" : er.code === "auth/too-many-requests" ? "محاولات كثيرة، استنى دقيقة وحاول تاني" : "اسم المستخدم أو كلمة المرور غير صحيحة"); b.disabled = false; } };
}

/* ---------- shared panels: sites ---------- */
let siteFilter = "all";
const SITE_TYPES = ["موقع ثابت", "وحدة صحية", "مستشفى", "مركز شباب", "أخرى"];
function sitesHtml(unit, editable) {
  const items = (SITES_BY_UNIT[unit] || []).map((s, i) => ({ i: String(i), s, custom: false }))
    .concat(Object.entries(S.sites).filter(([, d]) => d.custom && +d.unit === +unit).sort((x, y) => (x[1].ts || "").localeCompare(y[1].ts || ""))
      .map(([id, d]) => ({ i: id.split("_").slice(1).join("_"), s: [unit, d.name || "", d.type || "موقع ثابت", num(d.target)], custom: true })));
  let T = 0, V = 0, nd = 0, nr = 0, nn = 0; const rows = [];
  items.forEach(it => { const d = S.sites["s" + unit + "_" + it.i], st = d && d.status ? d.status : "none", v = d ? num(d.vacc) : 0;
    T += it.s[3]; V += v; if (st === "done") nd++; else if (st === "revisit") nr++; else nn++; if (siteFilter === "all" || siteFilter === st) rows.push({ ...it, st, v }); });
  return `<div class="card"><div class="row"><span>مطعّمون في مواقع التطعيم (مدارس وحضانات ومواقع ثابتة)</span><b>${nf(V)}</b></div><div class="meter"><i style="width:${Math.min(100, T ? V / T * 100 : 0)}%"></i></div>
  <div class="row mut"><span>المستهدف ${nf(T)} (${pct(T ? V / T * 100 : 0)})</span><span>تم ${nd} · إعادة ${nr} · لم تُزَر ${nn}</span></div></div>
  ${editable ? `<div class="card"><h2>➕ إضافة موقع تطعيم ثابت</h2><div class="mut">للمواقع اللي مش مدارس ولا حضانات (وحدة صحية، مستشفى، مركز شباب، نقطة ثابتة...).</div>
  <label>اسم الموقع</label><input id="ns_name" maxlength="60"><div class="grid"><div><label>النوع</label><select id="ns_type">${SITE_TYPES.map(t => `<option>${t}</option>`).join("")}</select></div><div><label>المستهدف (اختياري)</label><input id="ns_target" type="number" inputmode="numeric" min="0" placeholder="0"></div></div>
  <p><button id="nsAdd">إضافة الموقع</button></p></div>` : ""}
  <div class="tabs sm">${[["all", "الكل"], ["none", "لم تُزَر"], ["done", "تم"], ["revisit", "إعادة زيارة"]].map(f => `<button data-sf="${f[0]}"${siteFilter === f[0] ? ' class="on"' : ""}>${f[1]}</button>`).join("")}</div>
  ${rows.map(r => `<div class="card site" data-i="${esc(r.i)}"><div class="bar"><b>${esc(r.s[1])}</b><span class="pill${r.custom ? " ok" : ""}">${esc(r.s[2])}</span></div><div class="mut">المستهدف ${nf(r.s[3])}</div>
  ${editable ? `<div class="seg">${["none", "done", "revisit"].map(k => `<button data-st="${k}"${r.st === k ? ' class="on"' : ""}>${SITE_ST[k]}</button>`).join("")}</div>
  <label>عدد المطعّمين في الموقع</label><input data-site="${esc(r.i)}" type="number" inputmode="numeric" min="0" placeholder="0" value="${r.v || ""}" data-no-keep="1">${r.custom ? `<p><button class="ghost sm" data-delsite="${esc(r.i)}">حذف الموقع</button></p>` : ""}` : `<div>${SITE_ST[r.st]} · مطعّمون ${nf(r.v)}</div>`}</div>`).join("") || '<div class="mut">لا توجد مواقع بهذه الحالة.</div>'}`;
}
async function setSite(unit, i, patch) {
  const id = "s" + unit + "_" + i, c = S.sites[id] || {}, d = { ...c, unit, i, status: c.status || "none", vacc: num(c.vacc), ts: c.ts && c.custom ? c.ts : new Date().toISOString(), uid: profile.uid, ...patch };
  if (d.status === "none" && d.vacc > 0) d.status = "done";
  try { S.sites[id] = d; schedule(); await save(setDoc(doc(db, "sites", id), d), null); } catch (e) { toast("تعذّر الحفظ: " + errMsg(e)); }
}
function siteEvents(unit) { return {
  async click(e) { const f = e.target.closest("[data-sf]"); if (f) { siteFilter = f.dataset.sf; return renderTab(true); }
    if (e.target.id === "nsAdd") { const name = $("#ns_name").value.trim(), tg = intOrNull($("#ns_target").value); if (!name) return toast("اكتب اسم الموقع"); if (tg === null) return toast("المستهدف لازم يكون رقمًا صحيحًا");
      const u = unit(), i = "f" + Date.now().toString(36), id = "s" + u + "_" + i, d = { unit: u, i, custom: true, name: name.slice(0, 60), type: $("#ns_type").value, target: tg, status: "none", vacc: 0, ts: new Date().toISOString(), uid: profile.uid };
      try { S.sites[id] = d; schedule(); await save(setDoc(doc(db, "sites", id), d), "تمت إضافة الموقع"); $("#ns_name").value = ""; $("#ns_target").value = ""; } catch (er) { delete S.sites[id]; schedule(); toast("تعذّر الحفظ: " + errMsg(er)); } return; }
    const dl = e.target.closest("[data-delsite]"); if (dl) { if (!confirm("حذف هذا الموقع؟")) return; const id = "s" + unit() + "_" + dl.dataset.delsite; try { await save(deleteDoc(doc(db, "sites", id)), "تم الحذف"); delete S.sites[id]; schedule(); } catch (er) { toast("تعذّر الحذف: " + errMsg(er)); } return; }
    const b = e.target.closest("[data-st]"); if (b) setSite(unit(), b.closest(".site").dataset.i, { status: b.dataset.st }); },
  change(e) { const i = e.target.dataset.site; if (i == null) return; const v = intOrNull(e.target.value); if (v === null) return toast("اكتب رقمًا صحيحًا"); setSite(unit(), i, { vacc: v }); } }; }

/* ---------- shared panels: supplies ---------- */
function supHtml(unit, mode) { /* mode: view | store (المخزن يسلّم) | unit (الوحدة تستلم) | admin */
  const n = NEEDS[unit] || [], dc = S.supplies["p" + unit] || {}, dd = dc.d || {}, rr = dc.r || {}, st = supState(unit, dd);
  const eD = mode === "store" || mode === "admin", eR = mode === "unit" || mode === "admin", hasR = !!dc.r;
  const dAny = ITEMS.some(it => num(dd[it[0]]) > 0), pend = dAny && !hasR, diff = hasR && ITEMS.some(it => num(rr[it[0]]) !== num(dd[it[0]]));
  return `<div class="card"><div class="bar"><b>${esc(unitById(unit).name)}</b><span class="pill ${st === "full" ? "ok" : st === "part" ? "warn" : ""}">${st === "full" ? "تسليم مكتمل" : st === "part" ? "تسليم ناقص" : "لم يُسلَّم شيء"}</span></div>
  <div class="pills">${pend ? '<span class="pill warn">⏳ في انتظار تأكيد استلام الوحدة</span>' : diff ? '<span class="pill bad">⚠️ فرق بين التسليم والاستلام</span>' : hasR ? '<span class="pill ok">✔ تم الاستلام</span>' : ""}</div>
  ${mode === "unit" ? '<div class="mut">الأرقام المكتوبة هي اللي سلّمها المخزن. لو اللي استلمته مختلف غيّر الرقم، ثم اضغط «تأكيد الاستلام».</div>' : ""}
  <div class="tw"><table><tr><th>الصنف</th><th>المطلوب</th><th>سلّم المخزن</th><th>استلمت الوحدة</th><th>المتبقي</th></tr>${ITEMS.map((it, i) => { const k = it[0], dv = num(dd[k]), rv = num(rr[k]), rem = n[i] - (hasR ? rv : dv), dif = hasR && rv !== dv;
    return `<tr><td>${it[1]}</td><td>${nf(n[i])}</td><td>${eD ? `<input class="cell" id="sd_${k}" type="number" inputmode="numeric" min="0" value="${dv || ""}" placeholder="0">` : nf(dv)}</td>
    <td class="${dif ? "bad" : ""}">${eR ? `<input class="cell" id="sr_${k}" type="number" inputmode="numeric" min="0" value="${hasR ? (rv || "") : (mode === "unit" ? (dv || "") : "")}" placeholder="0">` : hasR ? nf(rv) : "—"}</td><td class="${rem < 0 ? "bad" : ""}">${rem < 0 ? nf(-rem) + " زيادة" : nf(rem)}</td></tr>`; }).join("")}</table></div>
  ${mode === "store" ? '<p><button id="supSave" class="big">💾 حفظ التسليم</button></p>' : mode === "unit" ? '<p><button id="rcvSave" class="big">✔ تأكيد الاستلام</button></p>' : mode === "admin" ? '<p><button id="supSave">حفظ</button></p>' : ""}</div>`;
}
async function saveSup(unit, mode) {
  let bad = false; const rd = p => { const o = {}; ITEMS.forEach(it => { const v = intOrNull($("#" + p + it[0]).value); if (v === null) bad = true; else o[it[0]] = v; }); return o; };
  const now = new Date().toISOString(), data = { unit };
  if (mode !== "unit") { data.d = rd("sd_"); data.ts = now; data.uid = profile.uid; }
  if (mode === "unit" || (mode === "admin" && (S.supplies["p" + unit] || {}).r || mode === "admin" && ITEMS.some(it => $("#sr_" + it[0]).value !== ""))) { data.r = rd("sr_"); data.rts = now; data.ruid = profile.uid; }
  if (bad) return toast("الأعداد لازم تكون أرقامًا صحيحة");
  try { await save(setDoc(doc(db, "supplies", "p" + unit), data, { merge: true }), mode === "unit" ? "تم تأكيد الاستلام ✅" : "تم حفظ المستلزمات"); } catch (e) { toast("تعذّر الحفظ: " + errMsg(e)); }
}
function supIssues() {
  const pend = [], diff = [];
  UNITS.forEach(u => { const dc = S.supplies["p" + u.id] || {}, dd = dc.d || {}, rr = dc.r || {};
    if (ITEMS.some(it => num(dd[it[0]]) > 0) && !dc.r) pend.push(u.name); else if (dc.r && ITEMS.some(it => num(rr[it[0]]) !== num(dd[it[0]]))) diff.push(u.name); });
  return { pend, diff };
}
function supOverview() {
  const tot = ITEMS.map(() => [0, 0, 0]), cnt = { full: 0, part: 0, none: 0 }, nm = { part: [], none: [] };
  UNITS.forEach(u => { const dc = S.supplies["p" + u.id] || {}, dd = dc.d || {}, rr = dc.r || {}, n = NEEDS[u.id] || []; ITEMS.forEach((it, i) => { tot[i][0] += n[i]; tot[i][1] += num(dd[it[0]]); tot[i][2] += num(rr[it[0]]); }); const s = supState(u.id, dd); cnt[s]++; if (s !== "full") nm[s].push(u.name); });
  const si = supIssues();
  return `<div class="card"><h2>موقف المستلزمات</h2><div class="stats">${stat("تسليم مكتمل", cnt.full)}${stat("تسليم ناقص", cnt.part)}${stat("لم يُسلَّم لها", cnt.none)}${stat("لم تؤكد الاستلام", si.pend.length, si.pend.length ? "bad" : "")}</div>
  <div class="tw"><table><tr><th>الصنف</th><th>المطلوب</th><th>المُسلَّم</th><th>المُستلَم</th><th>نسبة التسليم</th></tr>${ITEMS.map((it, i) => `<tr><td>${it[1]}</td><td>${nf(tot[i][0])}</td><td>${nf(tot[i][1])}</td><td>${nf(tot[i][2])}</td><td>${pct(tot[i][0] ? tot[i][1] / tot[i][0] * 100 : 0)}</td></tr>`).join("")}</table></div>
  ${si.diff.length ? `<div class="alert bad"><b>فرق بين التسليم والاستلام (${si.diff.length})</b><span>${esc(si.diff.join("، "))}</span></div>` : ""}${si.pend.length ? `<details><summary>وحدات لم تؤكد الاستلام (${si.pend.length})</summary><p>${esc(si.pend.join("، "))}</p></details>` : ""}
  ${nm.part.length ? `<details><summary>تسليم ناقص (${nm.part.length})</summary><p>${esc(nm.part.join("، "))}</p></details>` : ""}${nm.none.length ? `<details><summary>لم يُسلَّم لها بعد (${nm.none.length})</summary><p>${esc(nm.none.join("، "))}</p></details>` : ""}</div>`;
}

/* ---------- shared panels: survey ---------- */
const SV_KEYS = ["sampled", "vacc"].concat(REASONS.map(r => r[0]));
function surveyForm(list) { return `<div class="card"><h2>تسجيل نتيجة الجَشني الميداني</h2><p class="mut">عيّنة من الأطفال بعد الحملة: كم منهم تطعّم، وسبب من لم يتطعّم. حسب تعليمات الوزارة: مراقب الوحدة 4 مربعات × 15 منزل، وإشراف الإدارة وحدتان بمربع واحد (30 منزل) لكل وحدة.</p>
  <label>الوحدة</label>${unitSel("svUnit", list, lsGet("mr.svUnit") || list[0].id)}<label>تاريخ الجَشني</label><input type="date" id="svDate" value="${today()}" max="${today()}">
  <div class="grid"><div><label>حجم العيّنة (أطفال)</label><input id="sv_sampled" type="number" inputmode="numeric" min="0"></div><div><label>المطعّمون في العيّنة</label><input id="sv_vacc" type="number" inputmode="numeric" min="0"></div>
  ${REASONS.map(r => `<div><label>غير مطعّم: ${r[1]}</label><input id="sv_${r[0]}" type="number" inputmode="numeric" min="0"></div>`).join("")}</div>
  <div class="mut">الحد المقترح للتغطية ${SURVEY_GOAL}%. مجموع الأسباب يساوي غير المطعّمين.</div><p><button id="svSave">حفظ</button></p></div>`; }
async function saveSurvey() {
  const v = {}; let bad = false; SV_KEYS.forEach(k => { const x = intOrNull($("#sv_" + k).value); if (x === null) bad = true; else v[k] = x; });
  const u = +$("#svUnit").value, d = $("#svDate").value; if (bad) return toast("الأعداد لازم تكون أرقامًا صحيحة");
  if (!d || d > today() || d < MIN_DATE) return toast("اختر تاريخًا صحيحًا لا يتجاوز اليوم");
  if (v.sampled <= 0 || v.vacc > v.sampled) return toast("راجع حجم العيّنة وعدد المطعّمين");
  const rs = REASONS.reduce((s, r) => s + v[r[0]], 0); if (rs !== v.sampled - v.vacc && !confirm("مجموع الأسباب (" + rs + ") لا يساوي غير المطعّمين (" + (v.sampled - v.vacc) + "). حفظ على أي حال؟")) return;
  lsSet("mr.svUnit", String(u));
  try { await save(setDoc(doc(db, "survey", "j" + u + "_" + d), { unit: u, date: d, ...v, ts: new Date().toISOString(), uid: profile.uid }), "تم حفظ نتيجة الجَشني"); } catch (e) { toast("تعذّر الحفظ: " + errMsg(e)); }
}
function surveyResults() {
  const { agg, why, S: Sm, V } = surveyAgg(vals(S.survey), vals(S.reports)), ids = Object.keys(agg);
  if (!ids.length) return '<div class="card"><h2>نتائج الجَشني</h2><div class="mut">لم تُسجَّل أي عيّنة بعد. تُسجَّل بعد انتهاء الحملة.</div></div>';
  ids.sort((a, b) => agg[a].v / agg[a].s - agg[b].v / agg[b].s);
  const top = REASONS.slice().sort((a, b) => (why[b[0]] || 0) - (why[a[0]] || 0)).filter(r => why[r[0]] > 0).map(r => r[1] + " " + nf(why[r[0]])).join(" · ");
  const rc = surveyAgg([], vals(S.reports)).rc;
  return `<div class="card"><h2>نتائج الجَشني</h2><div class="stats">${stat("تغطية كل العيّنات", pct(Sm ? V / Sm * 100 : 0))}${stat("أطفال في العيّنات", nf(Sm))}${stat("وحدات", ids.length)}</div>${top ? `<div class="mut">أسباب عدم التطعيم: ${top}</div>` : ""}
  <div class="tw"><table><tr><th>الوحدة</th><th>العيّنة</th><th>التغطية</th><th>المسجّلة في الحملة</th><th></th></tr>${ids.map(id => { const a = agg[id], u = unitById(id), cov = a.v / a.s * 100;
    return `<tr><td>${esc(u.name)}</td><td>${nf(a.s)}</td><td><b>${pct(cov)}</b></td><td>${pct(u.target ? (rc[id] || 0) / u.target * 100 : 0)}</td><td><span class="pill ${cov >= SURVEY_GOAL ? "ok" : "warn"}">${cov >= SURVEY_GOAL ? "مرضية" : "أقل من " + SURVEY_GOAL + "%"}</span></td></tr>`; }).join("")}</table></div></div>`;
}
/* ---------- جدول البلاغ كما في نموذج الوزارة ---------- */
const AGE_H = ["9 شهور > سنة", "سنة > 5 سنوات", "5 سنوات - 10 سنة"];
function reportTables(unitSet, title) {
  const rows = dayTable(vals(S.reports), unitSet, today()), t = today(), c = v => nf(v);
  const pair = (h, x, y) => `<td>${h ? c(x) : ""}</td><td>${h ? c(y) : ""}</td>`;
  const head = `<tr><th rowspan="4">اليوم</th><th colspan="14">المطعّمون</th><th colspan="2" rowspan="3">المتخلفون</th><th colspan="2" rowspan="3">المتطعمون من المتخلفين</th><th colspan="2" rowspan="3">الآثار الجانبية الخطيرة</th></tr>
  <tr><th colspan="6">المصريون (فئات عمرية)</th><th colspan="6">غير المصريين (فئات عمرية)</th><th colspan="2" rowspan="2">الإجمالي</th></tr>
  <tr>${AGE_H.concat(AGE_H).map(x => `<th colspan="2">${x}</th>`).join("")}</tr><tr>${"<th>اليوم</th><th>حتى اليوم</th>".repeat(10)}</tr>`;
  const body1 = rows.map(r => `<tr${r.date === t ? ' class="today"' : ""}><td>${r.n}</td>${AGE.map(k => pair(r.show, r.day[k], r.cum[k])).join("")}${pair(r.show, r.day.tot, r.cum.tot)}${pair(r.show, r.day.missed, r.cum.missed)}${pair(r.show, r.day.mvac, r.cum.mvac)}${pair(r.show, r.day.side, r.cum.side)}</tr>`).join("");
  const body2 = rows.map(r => `<tr${r.date === t ? ' class="today"' : ""}><td>${r.n}</td><td>${fmtD(r.date)}</td><td>${r.show ? c(r.recv) : ""}</td><td>${r.show ? c(r.used) : ""}</td><td>${r.show ? c(r.rem) : ""}</td><td>${r.show && r.rate !== null ? r.rate : ""}</td></tr>`).join("");
  return `<div class="ptitle">تابع: آلية التسجيل والنماذج<br>${esc(title)} · الحملة من ${fmtD(START)} إلى ${fmtD(END)} (${CAMPAIGN_DAYS} يوم)</div>
  <div class="card tw"><div class="ptitle">البلاغ اليومي للفريق</div><table class="rt"><thead>${head}</thead><tbody>${body1}</tbody></table></div>
  <div class="card tw"><div class="ptitle">بلاغ حركة الطعوم</div><table class="rt v"><thead><tr><th>اليوم</th><th>التاريخ</th><th>عدد الزجاجات المستلمة</th><th>عدد الزجاجات المستهلكة</th><th>عدد الزجاجات المتبقية</th><th>معدل الزجاجة</th></tr></thead><tbody>${body2}</tbody></table></div>
  <div class="mut noprint">«حتى اليوم» = المجموع التراكمي من بداية الحملة. المتبقي = كل الزجاجات المستلمة − المستهلكة. معدل الزجاجة = أطفال ÷ زجاجات مستهلكة في اليوم.</div>
  <div class="card noprint"><button class="ghost" id="prn">🖨️ طباعة / حفظ PDF</button></div>`;
}

/* ---------- unit ---------- */
const GROUPS = [["المطعّمون من المصريين", ["eg1", "eg2", "eg3"]], ["المطعّمون من غير المصريين", ["ne1", "ne2", "ne3"]], ["أماكن التطعيم", ["fs", "fc", "sv", "sc", "nv", "nc"]],
  ["المتخلفون والآثار الجانبية", ["missed", "mvac", "side"]], ["الفرق والطعوم", ["teams", "recv", "used", "dmg"]]];
const canEdit = r => !(r.ts0 || r.ts) || Date.now() - new Date(r.ts0 || r.ts).getTime() < 864e5;
const AGE_NAME = { a: "من 9 شهور لأقل من سنة", b: "من سنة لأقل من 5 سنوات", c: "من 5 سنوات إلى 10 سنوات" };
const CASE_ST = { follow: "تحت المتابعة", hosp: "محوّل للمستشفى", rec: "تحسّنت" };
let edit = null, fillNext = null;
const draftKey = () => "mr.draft." + (profile ? profile.uid : "");
function readForm() { const o = { d: $("#d").value, lot: $("#f_lot").value, f: {} }; FIELDS.forEach(k => o.f[k] = $("#f_" + k).value); return o; }
function liveTotal() { const el = $("#liveTotal"); if (el) el.textContent = nf(AGE.reduce((s, k) => s + num(($("#f_" + k) || {}).value), 0)); }
function fillForm(r) { $("#d").value = r.date; $("#f_lot").value = r.lot || ""; FIELDS.forEach(k => $("#f_" + k).value = r[k] ? r[k] : ""); liveTotal(); }
function clearForm() { FIELDS.forEach(k => $("#f_" + k).value = ""); $("#f_lot").value = ""; liveTotal(); }

function unitView() {
  const uid = profile.unit; edit = null; fillNext = null;
  sub("reports", query(collection(db, "reports"), where("unit", "==", uid))); sub("sites", query(collection(db, "sites"), where("unit", "==", uid)));
  sub("supplies", doc(db, "supplies", "p" + uid), "doc"); sub("geo", doc(db, "unitGeo", String(uid)), "doc"); sub("notes", doc(db, "notes", "current"), "doc");
  sub("contacts", doc(db, "contacts", "c" + uid), "doc"); sub("cases", query(collection(db, "cases"), where("unit", "==", uid)));
  const geo = () => S.geo[String(uid)], se = siteEvents(() => uid);
  shell(unitById(uid).name, [
    { k: "r", label: "تقرير اليوم", icon: "📝", render() {
        const g = geo(), hist = vals(S.reports).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10), anyP = hist.some(r => r._p);
        const grp = GROUPS.map(([t, ks]) => `<div class="grp"><h3>${t}</h3><div class="grid">${ks.map(k => `<div><label>${LABELS[k]}</label><input type="number" inputmode="numeric" min="0" step="1" data-k="${k}" id="f_${k}" placeholder="0"></div>`).join("")}</div></div>${k0(ks)}`).join("");
        function k0(ks) { return ks[0] === "ne1" ? '<div class="tot">إجمالي المطعّمين اليوم: <b id="liveTotal">0</b></div>' : ""; }
        return (supIssues().pend.length ? '<div class="card" style="border-color:var(--warn)"><b>📦 المخزن سجّل تسليم مستلزمات لوحدتك</b><div class="mut">افتح تبويب «المستلزمات» وأكّد الاستلام.</div></div>' : "") + helpCard("إزاي أسجّل تقرير اليوم؟", ["اكتب الأرقام في الخانات (الخانة اللي مفيهاش حاجة سيبها فاضية).", "راجع «إجمالي المطعّمين» إنه صح.", "اضغط «حفظ التقرير» — هتظهر رسالة تأكيد.", "لو النت واقع: اضغط حفظ برضه، هيتبعت لوحده لما النت يرجع."])
        + `<div class="card"><h2>موقع الوحدة</h2>${g ? `<span class="ok">مسجَّل ✔</span> · ${mapLink(g)}` : `<span class="warn">لم يُسجَّل بعد.</span><div class="mut">هيتسجّل <b>تلقائيًا</b> مع أول تقرير تحفظه وانت جوه الوحدة. مش محتاج تعمل حاجة.</div>`}</div>
        <div class="card">${edit ? `<div class="alert warn"><b>✏️ تعديل تقرير يوم ${fmtD(edit)}</b><span>غيّر الأرقام ثم احفظ.</span></div><p><button class="ghost" id="cancelEdit">إلغاء التعديل</button></p>` : "<h2>تقرير اليوم</h2>"}
        <label>تاريخ العمل</label><input type="date" id="d" value="${edit || today()}" min="${MIN_DATE}" max="${today()}"${edit ? " readonly" : ""}>
        <label>رقم التشغيلة (اختياري)</label><input id="f_lot" maxlength="30" placeholder="مثال: ABC123">
        ${grp}<p><button id="save" class="big">💾 حفظ التقرير</button></p><div class="mut">سيُسجَّل موقعك وقت الحفظ. تقدر تعدّل التقرير خلال 24 ساعة من أول حفظ.</div></div>
        <div class="card"><h2>آخر تقاريرك</h2>${anyP ? '<div class="alert warn"><b>⏳ في تقارير لسه ما اتبعتتش</b><span>هتتبعت تلقائيًا لما النت يرجع.</span></div>' : ""}<div class="tw"><table><tr><th>التاريخ</th><th>المطعّمون</th><th>زجاجات</th><th></th></tr>${hist.map(r => `<tr><td>${r._p ? "⏳ " : ""}${r.date}${r.edited ? ' <span class="pill">معدّل</span>' : ""}</td><td>${r.total}</td><td>${num(r.used)}</td><td>${canEdit(r) ? `<button class="ghost sm" data-edit="${r.date}">تعديل</button>` : "🔒"}</td></tr>`).join("") || '<tr><td colspan="4">لا شيء بعد</td></tr>'}</table></div></div>
        <div class="card"><h2>رقم تليفون مسؤول الوحدة</h2><div class="mut">علشان الإدارة والمشرف يوصلوا لك بسرعة.</div><input id="myTel" type="tel" inputmode="tel" value="${esc(telOf(uid))}" placeholder="01xxxxxxxxx"><p><button id="telSave">حفظ الرقم</button></p></div>`; },
      after() {
        if (fillNext) { fillForm(fillNext); fillNext = null; }
        else if (!edit && !$("#f_lot").value && FIELDS.every(k => !$("#f_" + k).value)) {
          try { const dr = JSON.parse(lsGet(draftKey()) || "null"); if (dr && dr.f) { if (dr.d && dr.d <= today() && dr.d >= MIN_DATE) $("#d").value = dr.d; $("#f_lot").value = dr.lot || ""; FIELDS.forEach(k => $("#f_" + k).value = dr.f[k] || ""); toast("تم استرجاع تقرير لم تحفظه"); } } catch { } }
        liveTotal(); },
      input(e) { const id = e.target.id || ""; if (!(id.startsWith("f_") || id === "d")) return; liveTotal(); if (edit) return; const o = readForm();
        if (!o.lot && FIELDS.every(k => !o.f[k])) lsDel(draftKey()); else lsSet(draftKey(), JSON.stringify(o)); },
      async click(e) {
        const eb = e.target.closest("[data-edit]");
        if (eb) { const r = S.reports[`u${uid}_${eb.dataset.edit}`]; if (r && canEdit(r)) { edit = r.date; fillNext = r; renderTab(true); window.scrollTo({ top: 0, behavior: "smooth" }); } else toast("مضى أكثر من 24 ساعة. كلّم الإدارة لفتح التعديل."); return; }
        if (e.target.id === "cancelEdit") { edit = null; fillNext = null; renderTab(true); clearForm(); return; }
        if (e.target.id === "telSave") { try { await save(setDoc(doc(db, "contacts", "c" + uid), { unit: uid, tel: $("#myTel").value.trim().slice(0, 20), ts: new Date().toISOString(), uid: profile.uid }), "تم حفظ الرقم"); } catch (er) { toast(errMsg(er)); } return; }
        if (e.target.id === "setGeo") { try { const p = await getPos(); await save(setDoc(doc(db, "unitGeo", String(uid)), { ...p, uid: profile.uid, ts: new Date().toISOString() }), "تم تسجيل موقع الوحدة"); } catch (er) { toast(errMsg(er)); } }
        if (e.target.id === "save") {
          const d = $("#d").value; if (!d || d > today() || d < MIN_DATE) return toast("اختر تاريخًا صحيحًا لا يتجاوز اليوم");
          const r = { unit: uid, date: d, uid: profile.uid }; let bad = false; FIELDS.forEach(k => { const v = intOrNull($("#f_" + k).value); if (v === null) bad = true; else r[k] = v; });
          if (bad) return toast("كل الأرقام لازم تكون أعدادًا صحيحة 0 أو أكثر"); if (r.used < r.dmg) return toast("التالف أكبر من المستهلك، راجع الأرقام");
          if (r.mvac > r.missed && !confirm("المتطعمون من المتخلفين (" + r.mvac + ") أكبر من المتخلفين اليوم (" + r.missed + "). قد يكونون من أيام سابقة. حفظ؟")) return;
          const old = S.reports[`u${uid}_${d}`];
          if (old && !canEdit(old)) return toast("مضى أكثر من 24 ساعة على هذا التقرير. كلّم الإدارة لفتح التعديل.");
          if (old && edit !== d && !confirm("يوجد تقرير محفوظ ليوم " + d + ". هل تريد استبداله؟")) return;
          r.lot = ($("#f_lot").value || "").trim().slice(0, 30); const btn = e.target; btn.disabled = true;
          try { try { r.loc = await getPos(); } catch (er) { r.loc = null; toast(er.message + " — سيُحفظ التقرير بدون موقع"); }
            const g = geo(); if (r.loc && g) r.dist = haversine(r.loc, g); else if (r.loc && !g && r.loc.acc <= 150) { r.dist = 0; setDoc(doc(db, "unitGeo", String(uid)), { ...r.loc, uid: profile.uid, ts: new Date().toISOString(), auto: true }).catch(() => { }); } r.total = total(r); const now = new Date().toISOString(); r.ts = now;
            r.ts0 = old ? (old.ts0 || old.ts || now) : now; if (old) { r.edited = true; r.edits = num(old.edits) + 1; }
            await save(setDoc(doc(db, "reports", `u${uid}_${d}`), r), "تم حفظ التقرير ✅"); clearForm(); lsDel(draftKey()); edit = null; fillNext = null; renderTab(true); }
          catch (er) { toast("تعذّر الحفظ: " + errMsg(er)); } btn.disabled = false; } } },
    { k: "b", label: "جدول البلاغ", icon: "🗂️", render: () => reportTables(new Set([uid]), unitById(uid).name), click(e) { if (e.target.id === "prn") window.print(); } },
    { k: "t", label: "مواقعي", icon: "📍", render: () => sitesHtml(uid, true), ...se },
    { k: "p", label: "المستلزمات", icon: "📦", render: () => supHtml(uid, "unit"), click(e) { if (e.target.id === "rcvSave") saveSup(uid, "unit"); } },
    { k: "c", label: "بلاغ حالة", icon: "⚠️", render() {
        const my = Object.values(S.cases).sort((a, b) => (b.ts || "").localeCompare(a.ts || ""));
        return `<div class="card"><h2>بلاغ عن أثر جانبي خطير</h2><div class="alert bad"><b>ممنوع كتابة اسم الطفل أو رقمه القومي.</b><span>اكتب العمر والأعراض فقط. وسجّل العدد كمان في تقرير اليوم.</span></div>
        <label>التاريخ</label><input type="date" id="cd" value="${today()}" min="${MIN_DATE}" max="${today()}"><label>الفئة العمرية</label><select id="ca">${Object.entries(AGE_NAME).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select>
        <label>الأعراض (بدون أسماء)</label><textarea id="cs" rows="3" maxlength="300" placeholder="مثال: ارتفاع شديد في الحرارة وتشنج بعد ساعة من التطعيم"></textarea>
        <label>الحالة الآن</label><select id="cst">${Object.entries(CASE_ST).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select><p><button id="cSave" class="big">إرسال البلاغ للإدارة</button></p></div>
        <div class="card"><h2>بلاغاتي</h2>${my.map(c => `<div class="alert ${c.seen ? "" : "warn"}"><b>${fmtD(c.date)} · ${AGE_NAME[c.age] || ""} · ${CASE_ST[c.st] || ""}</b><span>${esc(c.signs)}</span><span>${c.seen ? "✔ اطّلعت عليه الإدارة" + (c.adminNote ? ": " + esc(c.adminNote) : "") : "⏳ في انتظار اطلاع الإدارة"}</span></div>`).join("") || '<div class="mut">لا توجد بلاغات.</div>'}</div>`; },
      async click(e) { if (e.target.id !== "cSave") return; const signs = $("#cs").value.trim(), d = $("#cd").value;
        if (!signs) return toast("اكتب الأعراض"); if (!d || d > today() || d < MIN_DATE) return toast("اختر تاريخًا صحيحًا");
        const btn = e.target; btn.disabled = true;
        try { await save(addDoc(collection(db, "cases"), { unit: uid, unitName: unitById(uid).name, uid: profile.uid, date: d, age: $("#ca").value, signs: signs.slice(0, 300), st: $("#cst").value, seen: false, ts: new Date().toISOString() }), "تم إرسال البلاغ للإدارة"); $("#cs").value = ""; }
        catch (er) { toast("تعذّر الإرسال: " + errMsg(er)); } btn.disabled = false; } } ]);
}

/* ---------- supervisor ---------- */
function supView() {
  sub("visits", query(collection(db, "visits"), where("uid", "==", profile.uid))); sub("supplies", collection(db, "supplies")); sub("survey", collection(db, "survey")); sub("reports", collection(db, "reports")); sub("geo", collection(db, "unitGeo"));
  sub("notes", doc(db, "notes", "current"), "doc"); sub("contacts", collection(db, "contacts"));
  const mine = (profile.assigned && profile.assigned.length ? UNITS.filter(u => profile.assigned.includes(u.id)) : UNITS);
  let supUnit = +(lsGet("mr.supUnit") || mine[0].id), rtU = "all"; if (!mine.some(u => u.id === supUnit)) supUnit = mine[0].id;
  shell("مشرف: " + profile.name, [
    { k: "h", label: "اليوم", icon: "🏠", render() {
        const t = today(), rep = vals(S.reports), c = calc(rep, t), SI = stockInfo(rep, t), last = {}; vals(S.visits).forEach(v => { if (!last[v.unit] || v.date > last[v.unit]) last[v.unit] = v.date; });
        const started = t >= START, list = mine.map(u => c.per[u.id]).sort((a, b) => (started ? a.rep - b.rep : 0) || a.u.name.localeCompare(b.u.name, "ar"));
        const done = list.filter(p => p.rep).length, day = list.reduce((s, p) => s + p.day, 0);
        return helpCard("إزاي أستخدم الصفحة دي؟", ["الوحدات اللي ما بلّغتش النهارده بتظهر أولًا بعلامة حمراء.", "دوس «📞 اتصال» تكلّم الوحدة أو «واتساب».", "دوس «📝 تسجيل زيارة» لما تروح الوحدة."])
        + `<div class="card"><div class="stats">${stat("وحدات بلّغت", started ? done + "/" + list.length : "—")}${stat("مطعّمو اليوم", nf(day))}</div>${started ? "" : `<div class="mut">الحملة تبدأ يوم ${fmtD(START)}.</div>`}</div>`
        + list.map(p => { const f = stockFlag(SI[p.u.id]), l = last[p.u.id], dd = l ? Math.round((new Date(t) - new Date(l)) / 864e5) : null;
          return `<div class="card"><div class="bar"><b>${esc(p.u.name)}</b>${started ? `<span class="pill ${p.rep ? "ok" : "bad"}">${p.rep ? "بلّغت ✔" : "لم تبلّغ"}</span>` : ""}</div>
          <div class="mut">اليوم ${nf(p.day)} · الإجمالي ${nf(p.cum)} (${pct(p.u.target ? p.cum / p.u.target * 100 : 0)}) · رصيد طعوم ${nf(p.recv - p.used)}</div>
          <div class="pills">${f ? `<span class="pill ${f.cls}">${f.t}</span>` : ""}${!l ? '<span class="pill bad">لم تُزَر</span>' : dd >= 3 ? `<span class="pill warn">آخر زيارة من ${dd} يوم</span>` : `<span class="pill ok">زيارة ${fmtD(l)}</span>`}</div>
          <div class="acts2">${callBtns(p.u.id)} <button class="sm" data-visit="${p.u.id}">📝 تسجيل زيارة</button></div></div>`; }).join(""); },
      click(e) { const b = e.target.closest("[data-visit]"); if (b) { supUnit = +b.dataset.visit; lsSet("mr.supUnit", String(supUnit)); setTab("v"); } } },
    { k: "v", label: "زيارة", icon: "📋", render() {
        const my = vals(S.visits), t = today();
        return `<div class="card"><h2>تسجيل زيارة إشرافية</h2><label>الوحدة</label>${unitSel("vu", mine, supUnit)}<label>التاريخ</label><input type="date" id="vd" value="${t}" max="${t}">
        <div class="grid"><div><label>حرارة الثلاجة °م (كما شاهدتها)</label><input id="vt" type="number" step="0.1"></div><div><label>عدد الفرق الموجودة</label><input id="vm" type="number" inputmode="numeric" min="0"></div><div><label>عدد الزجاجات (عدّ فعلي)</label><input id="vv" type="number" inputmode="numeric" min="0"></div></div>
        <label>استمارة مرور الإشراف (بنود الوزارة)</label>${["وحدة", "فريق"].map(g => `<div class="mut">${g === "وحدة" ? "أثناء التنفيذ بالوحدة الصحية" : "المرور على الفرق"}</div>` + CHECKS.filter(c => c[1] === g).map(c => `<div class="row chkrow"><span>${c[2]}</span><select id="vc_${c[0]}"><option value="">—</option><option value="1">مستوفى</option><option value="0">غير مستوفى</option></select></div>`).join("")).join("")}
        <label>مشاكل أخرى لاحظتها</label>${PROBS.map(p => `<label class="chk"><input type="checkbox" id="vp_${p[0]}"> ${p[1]}</label>`).join("")}
        <label>ملاحظات (اختياري)</label><textarea id="vn" rows="2" maxlength="200"></textarea><p><button id="vs" class="big">تسجيل الزيارة وموقعي</button></p><div class="mut">يجب أن تكون داخل الوحدة وقت التسجيل (الحد ${MAX_DIST_M} م من موقعها المسجّل).</div></div>
        <div class="card"><h2>زياراتي</h2><div class="tw"><table><tr><th>الوحدة</th><th>التاريخ</th><th>المسافة</th></tr>${my.sort((a, b) => (b.ts || "").localeCompare(a.ts || "")).slice(0, 20).map(v => `<tr><td>${esc(unitById(v.unit).name)}</td><td>${v.date}</td><td>${v.dist == null ? "؟" : v.dist + " م"}</td></tr>`).join("") || '<tr><td colspan="3">لا شيء بعد</td></tr>'}</table></div></div>`; },
      change(e) { if (e.target.id === "vu") { supUnit = +e.target.value; lsSet("mr.supUnit", e.target.value); } },
      async click(e) { if (e.target.id !== "vs") return;
        const unit = +$("#vu").value, t = parseFloat($("#vt").value), tm = parseInt($("#vm").value, 10), vl = parseInt($("#vv").value, 10), d = $("#vd").value;
        if (!d || d > today() || d < MIN_DATE || isNaN(t) || isNaN(tm) || isNaN(vl) || tm < 0 || vl < 0) return toast("اكتب الحرارة والفرق والزجاجات كما شاهدتها");
        const probs = {}, checks = {}; PROBS.forEach(p => { if ($("#vp_" + p[0]).checked) probs[p[0]] = true; }); CHECKS.forEach(c => { const v = $("#vc_" + c[0]).value; if (v !== "") checks[c[0]] = +v; }); const btn = e.target; btn.disabled = true;
        try { const loc = await getPos(), g = S.geo[String(unit)], dist = g ? haversine(loc, g) : null;
          await save(addDoc(collection(db, "visits"), { uid: profile.uid, name: profile.name, unit, date: d, temp: t, teams: tm, vials: vl, probs, checks, note: $("#vn").value.trim().slice(0, 200), loc, dist, ts: new Date().toISOString() }), null);
          ["vt", "vm", "vv", "vn"].forEach(i => $("#" + i).value = ""); CHECKS.forEach(c => $("#vc_" + c[0]).value = ""); PROBS.forEach(p => $("#vp_" + p[0]).checked = false);
          toast(dist == null ? "تم التسجيل ✅ (هيتم التحقق من الموقع أول ما الوحدة تبعت أول تقرير)" : dist > MAX_DIST_M ? `تم التسجيل لكن أنت بعيد ${dist} م عن الوحدة` : "تم تسجيل الزيارة ✅"); }
        catch (er) { toast(er.message || "تعذّر التسجيل"); } btn.disabled = false; } },
    { k: "b", label: "جدول البلاغ", icon: "🗂️", render() { const sel = rtU === "all" || !mine.some(u => u.id === +rtU) ? "all" : +rtU;
        return `<div class="card noprint"><label>الوحدة</label><select id="rtu"><option value="all">كل وحداتي</option>${mine.slice().sort((a, b) => a.name.localeCompare(b.name, "ar")).map(u => `<option value="${u.id}"${sel === u.id ? " selected" : ""}>${esc(u.name)}</option>`).join("")}</select></div>`
          + reportTables(sel === "all" ? new Set(mine.map(u => u.id)) : new Set([sel]), sel === "all" ? "وحدات المشرف " + profile.name : unitById(sel).name); },
      change(e) { if (e.target.id === "rtu") { rtU = e.target.value; renderTab(false); } }, click(e) { if (e.target.id === "prn") window.print(); } },
    { k: "p", label: "المستلزمات", icon: "📦", render: () => `<div class="card"><label>الوحدة</label>${unitSel("su", mine, supUnit)}</div><div class="mut">للاطلاع فقط. التسليم من أمين المخزن والاستلام من الوحدة.</div>${supHtml(supUnit, "view")}`,
      change(e) { if (e.target.id === "su") { supUnit = +e.target.value; lsSet("mr.supUnit", String(supUnit)); renderTab(false); } } },
    { k: "j", label: "الجَشني", icon: "📊", render: () => surveyForm(mine) + surveyResults(), click(e) { if (e.target.id === "svSave") saveSurvey(); } } ]);
}

/* ---------- store keeper ---------- */
function storeView() {
  sub("supplies", collection(db, "supplies")); sub("notes", doc(db, "notes", "current"), "doc");
  let supUnit = +(lsGet("mr.stUnit") || UNITS[0].id); if (!UNITS.some(u => u.id === supUnit)) supUnit = UNITS[0].id;
  shell("أمين المخزن: " + profile.name, [
    { k: "d", label: "تسليم", icon: "📦", render: () => helpCard("إزاي أسجّل تسليم؟", ["اختار الوحدة اللي سلّمتها.", "اكتب الكميات اللي سلّمتها لكل صنف.", "اضغط «حفظ التسليم». الوحدة هتأكّد الاستلام من عندها."]) + `<div class="card"><label>الوحدة</label>${unitSel("su", UNITS, supUnit)}</div>${supHtml(supUnit, "store")}`,
      change(e) { if (e.target.id === "su") { supUnit = +e.target.value; lsSet("mr.stUnit", String(supUnit)); renderTab(false); } },
      click(e) { if (e.target.id === "supSave") saveSup(supUnit, "store"); } },
    { k: "o", label: "الموقف", icon: "📊", render: supOverview } ]);
}

/* ---------- admin ---------- */
function exportCsv() {
  const q = v => '"' + String(v ?? "").replace(/"/g, '""') + '"', rows = vals(S.reports).sort((a, b) => a.date.localeCompare(b.date) || a.unit - b.unit);
  const head = ["التاريخ", "الوحدة"].concat(FIELDS.map(k => LABELS[k]), ["إجمالي المطعّمين", "رقم التشغيلة", "المسافة عن الوحدة (م)"]);
  download("reports-" + today() + ".csv", [head].concat(rows.map(r => [r.date, unitById(r.unit).name].concat(FIELDS.map(k => num(r[k])), [total(r), r.lot || "", r.dist ?? ""]))).map(l => l.map(q).join(",")).join("\n"));
}
function adminView() {
  ["reports", "visits", "sites", "supplies", "survey", "cases", "contacts"].forEach(k => sub(k, collection(db, k))); sub("geo", collection(db, "unitGeo")); sub("notes", doc(db, "notes", "current"), "doc");
  let ref = today(), repOpen = false, siteUnit = UNITS[0].id, supUnit = UNITS[0].id, rankAsc = true, rtU = "all"; const se = siteEvents(() => siteUnit);
  shell("إدارة الصحة بالمنشاة", [
    { k: "s", label: "ملخص", icon: "📈", render() {
        const R = vals(S.reports), c = calc(R, ref), al = alertsFor(c.list, ref, today(), vals(S.sites), vals(S.visits), R); let cumT = 0, dayT = 0; c.list.forEach(p => { cumT += p.cum; dayT += p.day; });
        { const far = R.filter(r => r.date === ref && r.date >= START && (r.loc ? (r.dist != null && r.dist > MAX_DIST_M) : true)); if (far.length) al.push({ cls: "warn", t: far.length + " تقرير اتسجّل من خارج الوحدة أو بدون موقع", x: far.slice(0, 10).map(r => unitById(r.unit).name + (r.loc ? " (" + nf(r.dist) + " م)" : " (بدون موقع)")).join("، ") }); }
        { const si = supIssues(); if (si.pend.length) al.push({ cls: "warn", t: si.pend.length + " وحدة لم تؤكد استلام المستلزمات", x: si.pend.slice(0, 10).join("، ") }); if (si.diff.length) al.push({ cls: "bad", t: "فرق بين التسليم والاستلام في " + si.diff.length + " وحدة", x: si.diff.slice(0, 10).join("، ") }); }
        const newC = Object.entries(S.cases).filter(([, x]) => !x.seen), miss = ref === today() && ref >= START ? c.list.filter(p => !p.rep) : [];
        return `<div class="card noprint"><label>اليوم المعروض</label><input type="date" id="refd" value="${ref}" min="${MIN_DATE}" max="${today()}"></div>
        ${newC.length ? `<div class="card" style="border-color:var(--bad)"><h2 class="bad">⚠️ ${newC.length} بلاغ أثر جانبي جديد</h2>${newC.map(([, x]) => `<div class="alert bad"><b>${esc(x.unitName || "")} · ${fmtD(x.date)} · ${CASE_ST[x.st] || ""}</b><span>${esc(x.signs)}</span></div>`).join("")}<p class="noprint"><button id="goCases">فتح صفحة الحالات</button></p></div>` : ""}
        <div class="card"><div class="stats">${stat("يوم الحملة", campaignDay(ref) + "/" + CAMPAIGN_DAYS)}${stat("مطعّمو اليوم", nf(dayT))}${stat("الإجمالي", nf(cumT))}${stat("المستهدف", nf(TOTAL_TARGET))}${stat("التغطية", pct(cumT / TOTAL_TARGET * 100))}</div></div>
        <div class="card"><h2>تنبيهات</h2>${al.length ? al.map(a => `<div class="alert ${a.cls}"><b>${esc(a.t)}</b>${a.x ? `<span>${esc(a.x)}</span>` : ""}</div>`).join("") : '<div class="ok">لا توجد تنبيهات الآن.</div>'}</div>
        ${miss.length ? `<div class="card noprint"><h2>لم يبلّغوا اليوم (${miss.length})</h2>${miss.map(p => `<div class="row" style="align-items:center;border-bottom:1px solid var(--line);padding:6px 0"><b>${esc(p.u.name)}</b><span>${callBtns(p.u.id)}</span></div>`).join("")}</div>` : ""}
        <div class="card"><h2>بلاغ اليوم للمديرية</h2>${repOpen ? `<textarea id="repTxt" rows="16" readonly data-no-keep="1">${esc(reportText(c.list, ref))}</textarea><p class="noprint"><a class="btn" id="repWa" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(reportText(c.list, ref))}">إرسال واتساب</a> <button class="ghost" id="repCopy">نسخ النص</button> <button class="ghost" id="repHide">إخفاء</button></p>` : `<div class="mut">نص جاهز بأرقام يوم ${fmtD(ref)}، تنسخه أو تبعته واتساب مباشرة.</div><p class="noprint"><button class="ghost" id="repShow">تجهيز النص</button></p>`}</div>
        <div class="card noprint"><div class="acts2"><button class="ghost" id="exp">📥 تنزيل كل التقارير (Excel)</button><button class="ghost" id="prn">🖨️ طباعة / حفظ PDF</button></div></div>
        <div class="card tw"><table><tr><th>الوحدة</th><th>اليوم</th><th>الإجمالي</th><th>المستهدف</th><th>%</th><th>رصيد الطعوم</th><th>أطفال/زجاجة</th><th class="noprint"></th></tr>${c.list.map(p => `<tr><td>${esc(p.u.name)}${p.rep ? "" : ' <span class="pill warn">لم تبلّغ</span>'}</td><td>${nf(p.day)}</td><td>${nf(p.cum)}</td><td>${nf(p.u.target)}</td><td>${pct(p.cum / p.u.target * 100)}</td><td class="${p.recv - p.used < 0 ? "bad" : ""}">${nf(p.recv - p.used)}</td><td>${rateOf(p.cum, p.used) ?? "—"}</td><td class="noprint">${p.rep ? `<button class="ghost sm" data-unlock="${p.u.id}" title="فتح التعديل 24 ساعة">🔓</button>` : ""}</td></tr>`).join("")}</table></div>`; },
      change(e) { if (e.target.id === "refd" && e.target.value) { ref = e.target.value; renderTab(false); } },
      async click(e) { const id = e.target.id;
        if (id === "goCases") return setTab("c"); if (id === "exp") return exportCsv(); if (id === "prn") return window.print();
        if (id === "repShow") { repOpen = true; renderTab(true); } if (id === "repHide") { repOpen = false; renderTab(true); }
        if (id === "repCopy") { const t = $("#repTxt"); t.select(); (navigator.clipboard ? navigator.clipboard.writeText(t.value) : Promise.reject()).then(() => toast("تم النسخ"), () => { document.execCommand("copy"); toast("تم النسخ"); }); }
        const ub = e.target.closest("[data-unlock]"); if (ub) { const u = +ub.dataset.unlock, k = `u${u}_${ref}`, r = S.reports[k]; if (!r || !confirm("فتح تقرير " + unitById(u).name + " للتعديل 24 ساعة؟")) return;
          const { _p, ...clean } = r; try { await save(setDoc(doc(db, "reports", k), { ...clean, ts0: new Date().toISOString() }), "تم فتح التعديل 24 ساعة"); } catch (er) { toast(errMsg(er)); } } } },
    { k: "b", label: "جدول البلاغ", icon: "🗂️", render() { const sel = rtU === "all" ? "all" : +rtU;
        return `<div class="card noprint"><label>الوحدة</label><select id="rtu"><option value="all">كل وحدات المنشاة</option>${UNITS.slice().sort((a, b) => a.name.localeCompare(b.name, "ar")).map(u => `<option value="${u.id}"${sel === u.id ? " selected" : ""}>${esc(u.name)}</option>`).join("")}</select></div>`
          + reportTables(sel === "all" ? null : new Set([sel]), sel === "all" ? "إدارة المنشاة الصحية — كل الوحدات" : unitById(sel).name); },
      change(e) { if (e.target.id === "rtu") { rtU = e.target.value; renderTab(false); } }, click(e) { if (e.target.id === "prn") window.print(); } },
    { k: "k", label: "الترتيب", icon: "🏆", render() {
        const rows = rankRows(calc(vals(S.reports), today()).list, today()).sort((a, b) => rankAsc ? a.pc - b.pc : b.pc - a.pc);
        return `<div class="card"><h2>ترتيب الوحدات بنسبة التغطية</h2><div class="seg noprint"><button data-rk="1"${rankAsc ? ' class="on"' : ""}>الأضعف أولًا</button><button data-rk="0"${rankAsc ? "" : ' class="on"'}>الأقوى أولًا</button></div>
        <div class="mut">«المطلوب/يوم» = اللي لازم تطعّمه الوحدة يوميًا في باقي أيام الحملة (14 يوم) علشان توصل للمستهدف.</div></div>
        <div class="card tw"><table><tr><th>#</th><th>الوحدة</th><th>التغطية</th><th>متبقي</th><th>معدل/يوم</th><th>المطلوب/يوم</th></tr>${rows.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.p.u.name)}</td><td><b class="${r.pc >= 95 ? "ok" : r.pc < 40 && today() >= START ? "bad" : ""}">${pct(r.pc)}</b><div class="meter"><i style="width:${Math.min(100, r.pc)}%"></i></div></td><td>${nf(r.rem)}</td><td>${nf(r.avg)}</td><td class="${r.need > r.avg * 1.2 && r.rem > 0 && today() >= START ? "bad" : ""}">${r.rem === 0 ? "✔" : nf(r.need)}</td></tr>`).join("")}</table></div>
        <div class="card noprint"><button class="ghost" id="prn">🖨️ طباعة / حفظ PDF</button></div>`; },
      click(e) { const b = e.target.closest("[data-rk]"); if (b) { rankAsc = b.dataset.rk === "1"; renderTab(true); } if (e.target.id === "prn") window.print(); } },
    { k: "v", label: "الزيارات", icon: "📋", render() {
        const A = analyzeVisits(vals(S.visits), vals(S.reports), S.geo, MAX_DIST_M), seen = {}, per = {}; let review = 0;
        A.forEach(o => { seen[o.v.unit] = 1; const k = o.v.uid || "none", p = per[k] || (per[k] = { n: 0, u: {}, name: o.v.name || "غير معروف" }); p.n++; p.u[o.v.unit] = 1; if (o.flags.some(f => f.c !== "info")) review++; });
        const un = UNITS.filter(u => !seen[u.id]).map(u => u.name);
        return `<div class="card"><div class="stats">${stat("زيارات", A.length)}${stat("وحدات تمت زيارتها", (UNITS.length - un.length) + "/" + UNITS.length)}${stat("تحتاج مراجعة", review, review ? "bad" : "")}</div>
        ${un.length ? `<details><summary>وحدات لم تُزَر بعد (${un.length})</summary><p>${esc(un.join("، "))}</p></details>` : ""}
        ${Object.keys(per).length ? `<div class="tw"><table><tr><th>المشرف</th><th>زيارات</th><th>وحدات مختلفة</th></tr>${Object.keys(per).sort((a, b) => per[b].n - per[a].n).map(k => `<tr><td>${esc(per[k].name)}</td><td>${per[k].n}</td><td>${Object.keys(per[k].u).length}</td></tr>`).join("")}</table></div>` : ""}</div>
        ${A.slice(0, 40).map(o => { const v = o.v, ps = Object.keys(v.probs || {}).filter(k => PROB_NAME[k]).map(k => `<span class="pill bad">${PROB_NAME[k]}</span>`).join("") + Object.keys(v.checks || {}).filter(k => v.checks[k] === 0 && CHECK_NAME[k]).map(k => `<span class="pill bad">${CHECK_NAME[k]}: غير مستوفى</span>`).join("");
          return `<div class="card"><div class="bar"><b>${esc(unitById(v.unit).name)}</b><span class="mut">${fmtD(v.date)}</span></div><div class="mut">المشرف: ${esc(v.name || "غير معروف")} · ثلاجة ${v.temp}°م · فرق ${v.teams} · زجاجات ${nf(v.vials)} · ${o.dist == null ? "المسافة ؟" : o.dist + " م"} · ${mapLink(v.loc)}</div>
          <div class="pills">${ps || '<span class="pill ok">بدون مشاكل مبلّغ عنها</span>'}</div>${o.flags.length ? `<div class="pills">${o.flags.map(f => `<span class="pill ${f.c === "info" ? "" : f.c}">${esc(f.t)}</span>`).join("")}</div>` : ""}${v.note ? `<p>${esc(v.note)}</p>` : ""}</div>`; }).join("") || '<div class="card mut">لا توجد زيارات مسجّلة بعد.</div>'}`; } },
    { k: "c", label: "الحالات", icon: "⚠️", render() {
        const L = Object.entries(S.cases).sort((a, b) => (b[1].ts || "").localeCompare(a[1].ts || "")), n = L.filter(([, x]) => !x.seen).length;
        return `<div class="card"><h2>الآثار الجانبية الخطيرة المبلَّغ عنها</h2><div class="stats">${stat("إجمالي", L.length)}${stat("لم يُطّلع عليها", n, n ? "bad" : "")}</div></div>
        ${L.map(([id, x]) => `<div class="card"${x.seen ? "" : ' style="border-color:var(--bad)"'}><div class="bar"><b>${esc(x.unitName || unitById(x.unit).name)}</b><span class="mut">${fmtD(x.date)}</span></div><div class="pills"><span class="pill">${AGE_NAME[x.age] || ""}</span><span class="pill ${x.st === "hosp" ? "bad" : x.st === "rec" ? "ok" : "warn"}">${CASE_ST[x.st] || ""}</span></div><p>${esc(x.signs)}</p>
          ${x.seen ? `<div class="mut">✔ تم الاطلاع${x.adminNote ? ": " + esc(x.adminNote) : ""}</div>` : `<button data-seen="${id}">تم الاطلاع</button>`}</div>`).join("") || '<div class="card mut">لا توجد بلاغات.</div>'}`; },
      async click(e) { const id = e.target.dataset.seen; if (!id) return; const note = prompt("ملاحظة للوحدة (اختياري)") || ""; try { await save(updateDoc(doc(db, "cases", id), { seen: true, adminNote: note.slice(0, 200), seenTs: new Date().toISOString() }), "تم"); } catch (er) { toast(errMsg(er)); } } },
    { k: "t", label: "المواقع", icon: "🏫", render() {
        const all = vals(S.sites); let dn = 0, rv = 0; const re = {}; all.forEach(d => { if (d.status === "done") dn++; else if (d.status === "revisit") { rv++; re[d.unit] = (re[d.unit] || 0) + 1; } });
        const nm = Object.keys(re).map(u => unitById(u).name + " (" + re[u] + ")");
        return `<div class="card"><div class="stats">${stat("مواقع", SITES.length + all.filter(d => d.custom).length)}${stat("تم", dn)}${stat("إعادة زيارة", rv)}${stat("لم تُزَر", Math.max(0, SITES.length + all.filter(d => d.custom).length - dn - rv))}</div>${nm.length ? `<details><summary>وحدات فيها مواقع تحتاج إعادة (${nm.length})</summary><p>${esc(nm.join("، "))}</p></details>` : ""}</div>
        <div class="card"><label>الوحدة</label>${unitSel("stu", UNITS, siteUnit)}</div>${sitesHtml(siteUnit, true)}`; },
      ...{ click(e) { se.click(e); }, change(e) { if (e.target.id === "stu") { siteUnit = +e.target.value; renderTab(false); } else se.change(e); } } },
    { k: "p", label: "المستلزمات", icon: "📦", render: () => supOverview() + `<div class="card"><label>تعديل تسليم/استلام وحدة (الإدارة)</label>${unitSel("su", UNITS, supUnit)}</div>${supHtml(supUnit, "admin")}`,
      change(e) { if (e.target.id === "su") { supUnit = +e.target.value; renderTab(false); } }, click(e) { if (e.target.id === "supSave") saveSup(supUnit, "admin"); } },
    { k: "j", label: "الجَشني", icon: "📊", render: () => surveyResults() + surveyForm(UNITS), click(e) { if (e.target.id === "svSave") saveSurvey(); } },
    { k: "g", label: "الوحدات", icon: "🏥", render() {
        const n = S.notes.current || {};
        return `<div class="card"><h2>📢 إعلان لكل الوحدات والمشرفين</h2><div class="mut">يظهر أول ما يفتحوا التطبيق.</div><textarea id="annTxt" rows="3" maxlength="300" placeholder="مثال: وصلت شحنة جديدة من الطعوم، استلموها من المخزن">${esc(n.text || "")}</textarea><p><button id="annPub">نشر</button> <button class="ghost" id="annClr">مسح الإعلان</button></p></div>
        <div class="card tw"><h2>مواقع وتليفونات الوحدات</h2><table><tr><th>الوحدة</th><th>الموقع</th><th>التليفون</th></tr>${UNITS.map(u => `<tr><td>${esc(u.name)}</td><td>${S.geo[u.id] ? mapLink(S.geo[u.id]) + ` <button class="ghost sm" data-del="${u.id}">مسح</button>` : '<span class="warn">غير مسجّل</span>'}</td><td><input class="cell" style="width:130px" id="ph_${u.id}" data-ph="${u.id}" type="tel" inputmode="tel" value="${esc(telOf(u.id))}" placeholder="01xxxxxxxxx"></td></tr>`).join("")}</table></div><div class="mut">موقع الوحدة بيتسجّل تلقائيًا من أول تقرير. لو اتسجّل غلط امسحه، وهيتسجّل من جديد مع التقرير الجاي. رقم التليفون تقدر تكتبه هنا أو تكتبه الوحدة بنفسها.</div>`; },
      change(e) { const u = e.target.dataset.ph; if (u) save(setDoc(doc(db, "contacts", "c" + u), { unit: +u, tel: e.target.value.trim().slice(0, 20), ts: new Date().toISOString(), uid: profile.uid }), "تم حفظ الرقم").catch(er => toast(errMsg(er))); },
      async click(e) { const id = e.target.dataset.del;
        if (e.target.id === "annPub") { const x = $("#annTxt").value.trim(); if (!x) return toast("اكتب الإعلان"); try { await save(setDoc(doc(db, "notes", "current"), { text: x.slice(0, 300), ts: new Date().toISOString(), by: profile.name }), "تم نشر الإعلان"); } catch (er) { toast(errMsg(er)); } return; }
        if (e.target.id === "annClr") { try { await save(setDoc(doc(db, "notes", "current"), { text: "", ts: new Date().toISOString(), by: profile.name }), "تم مسح الإعلان"); $("#annTxt").value = ""; } catch (er) { toast(errMsg(er)); } return; }
        if (!id || !confirm("مسح موقع هذه الوحدة؟")) return; try { await deleteDoc(doc(db, "unitGeo", id)); } catch (er) { toast(errMsg(er)); } } },
    { k: "a", label: "الحسابات", icon: "👥", render: () => '<div id="acc" class="mut">جارٍ التحميل…</div>', after: accounts } ]);
}

/* ---------- admin: accounts ---------- */
const rnd = () => { const a = "abcdefghjkmnpqrstuvwxyz23456789", b = crypto.getRandomValues(new Uint8Array(8)); return [...b].map(x => a[x % a.length]).join(""); };
async function accounts() {
  if (accounts.busy) return; accounts.busy = true;
  const sec = getApps().find(a => a.name === "sec") || initializeApp(firebaseConfig, "sec"), secAuth = getAuth(sec);
  async function mk(login, role, name, unit, assigned) {
    for (let t = 0; t < 3; t++) { const lg = t ? login.replace(/-r\d+$/, "") + "-r" + Math.floor(Math.random() * 900 + 100) : login, pw = rnd();
      try { const cred = await createUserWithEmailAndPassword(secAuth, lg + "@" + EMAIL_DOMAIN, pw); await signOut(secAuth);
        const d = { role, name, login: lg }; if (unit) d.unit = unit; if (assigned) d.assigned = assigned; await setDoc(doc(db, "users", cred.user.uid), d); return { ...d, pw };
      } catch (e) { if (e.code !== "auth/email-already-in-use" || t === 2) throw e; } } }
  const csvDl = rows => { const t = "﻿" + ["الدور,الاسم,اسم الدخول,كلمة المرور"].concat(rows.map(r => [r.role, r.name, r.login, r.pw].join(","))).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([t], { type: "text/csv" })); a.download = "credentials.csv"; a.click(); };
  try {
    const us = (await getDocs(collection(db, "users"))).docs.map(x => ({ id: x.id, ...x.data() })), sups = us.filter(u => u.role === "supervisor");
    const have = new Set(us.filter(u => u.role === "unit").map(u => u.unit)), miss = UNITS.filter(u => !have.has(u.id)), box = $("#acc"); if (!box) return;
    box.className = ""; box.innerHTML = `<div class="card"><h2>الحسابات (${us.length})</h2>
    <p><button id="mkU"${miss.length ? "" : " disabled"}>إنشاء حسابات الوحدات الناقصة (${miss.length})</button></p>
    <p><button class="ghost" id="reAll"${us.length > 1 ? "" : " disabled"}>إعادة إصدار كل الحسابات (كلمات جديدة)</button></p>
    <label>إضافة مشرف (الاسم)</label><input id="sn" data-no-keep="1"><p><button id="mkS">إضافة مشرف</button></p>
    <label>إضافة أمين مخزن (الاسم)</label><input id="stn" data-no-keep="1"><p><button id="mkT">إضافة أمين مخزن</button></p>
    <div class="mut">كلمات المرور تظهر مرة واحدة بعد الإنشاء مع تنزيل CSV تلقائي. احفظها فورًا.</div><div id="cr"></div></div>
    <div class="card"><h2>إسناد الوحدات للمشرفين</h2>${sups.length ? `<label>المشرف</label><select id="as">${sups.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join("")}</select>
      <div id="asu" class="checks"></div><p><button id="asSave">حفظ الإسناد</button></p><div class="mut">لو لم تُسنَد وحدات لمشرف تظهر له كل الوحدات.</div>` : '<div class="mut">أضف مشرفًا أولًا.</div>'}</div>
    <div class="card tw"><table><tr><th>الدور</th><th>الاسم</th><th>اسم الدخول</th><th></th></tr>${us.sort((a, b) => (a.login || "") > (b.login || "") ? 1 : -1).map(u => `<tr><td>${({ admin: "إدارة", supervisor: "مشرف", unit: "وحدة", store: "مخزن" })[u.role] || u.role}</td><td>${esc(u.name)}</td><td dir="ltr">${esc(u.login || "")}</td><td>${u.role === "admin" ? "" : `<button class="ghost" data-re="${u.id}">إعادة إصدار</button>`}</td></tr>`).join("")}</table></div>
    <div class="mut">«إعادة إصدار» تعطّل الحساب القديم وتنشئ حسابًا جديدًا باسم دخول جديد وكلمة جديدة.</div>`;
    const show2 = out => { if (!out.length) return; $("#cr").innerHTML = `<div class="card"><b>احفظ الآن:</b><div class="tw"><table><tr><th>الاسم</th><th>الدخول</th><th>كلمة المرور</th></tr>${out.map(r => `<tr><td>${esc(r.name)}</td><td dir="ltr">${r.login}</td><td dir="ltr">${r.pw}</td></tr>`).join("")}</table></div><p><button id="dl">تنزيل CSV</button></p></div>`; $("#dl").onclick = () => csvDl(out); csvDl(out); };
    const fail = (u, e) => { $("#cr").innerHTML = `<div class="card bad">فشل عند ${esc(u)}: ${esc(e.code || e.message)}</div>`; };
    $("#mkU").onclick = async () => { $("#mkU").disabled = true; const out = []; for (const u of miss) { try { out.push(await mk("unit" + u.id, "unit", u.name, u.id)); } catch (e) { fail(u.name, e); break; } } show2(out); };
    $("#reAll").onclick = async () => { if (!confirm("سيتم تعطيل كل الحسابات (عدا الإدارة) وإنشاء حسابات جديدة بكلمات جديدة. متأكد؟")) return; $("#reAll").disabled = true; const out = [];
      for (const u of us.filter(x => x.role !== "admin")) { try { const base = (u.login || (u.role === "unit" ? "unit" + u.unit : "sup")).replace(/(-r\d+)+$/, ""); out.push(await mk(base + "-r" + Math.floor(Math.random() * 900 + 100), u.role, u.name, u.unit, u.assigned)); await deleteDoc(doc(db, "users", u.id)); } catch (e) { fail(u.name, e); break; } } show2(out); };
    $("#mkT").onclick = async () => { const n = $("#stn").value.trim(); if (!n) return toast("اكتب اسم أمين المخزن"); try { show2([await mk("store" + (us.filter(u => u.role === "store").length + 1) + "-" + Math.floor(Math.random() * 90 + 10), "store", n)]); } catch (e) { fail(n, e); } };
    $("#mkS").onclick = async () => { const n = $("#sn").value.trim(); if (!n) return toast("اكتب اسم المشرف"); try { show2([await mk("sup" + (sups.length + 1) + "-" + Math.floor(Math.random() * 90 + 10), "supervisor", n)]); } catch (e) { fail(n, e); } };
    if (sups.length) { const paint = () => { const s = sups.find(x => x.id === $("#as").value) || {}; $("#asu").innerHTML = UNITS.map(u => `<label class="chk"><input type="checkbox" data-u="${u.id}"${(s.assigned || []).includes(u.id) ? " checked" : ""}> ${esc(u.name)}</label>`).join(""); };
      $("#as").onchange = paint; paint();
      $("#asSave").onclick = async () => { const id = $("#as").value, a = $$("#asu input:checked").map(i => +i.dataset.u); const s = sups.find(x => x.id === id);
        try { await setDoc(doc(db, "users", id), { role: s.role, name: s.name, login: s.login || "", assigned: a }); s.assigned = a; toast("تم حفظ الإسناد (" + a.length + " وحدة)"); } catch (e) { toast(errMsg(e)); } }; }
    $("#acc").onclick = async e => { const id = e.target.dataset.re; if (!id) return; const u = us.find(x => x.id === id); if (!confirm("إعادة إصدار حساب " + u.name + "؟")) return;
      try { const base = (u.login || "x").replace(/(-r\d+)+$/, ""); const r = await mk(base + "-r" + Math.floor(Math.random() * 900 + 100), u.role, u.name, u.unit, u.assigned); await deleteDoc(doc(db, "users", id)); accounts.busy = false; await accounts(); show2([r]); } catch (er) { fail(u.name, er); } };
  } catch (e) { const b = $("#acc"); if (b) b.textContent = "تعذّر تحميل الحسابات: " + errMsg(e); } finally { accounts.busy = false; }
}
