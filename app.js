import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword, updatePassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, addDoc, collection, getDocs, query, where, deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig, EMAIL_DOMAIN, MAX_DIST_M } from "./firebase-config.js";
import { UNITS, NEEDS, SITES, START, MIN_DATE, SURVEY_GOAL, ITEMS, PROBS, PROB_NAME, REASONS, SITE_ST, LABELS, FIELDS, AGE, num, total, TOTAL_TARGET, unitById, SITES_BY_UNIT,
  nf, pct, fmtD, rateOf, CHECKS, CHECK_NAME, isoOf, haversine, calc, alertsFor, reportText, analyzeVisits, surveyAgg, supState } from "./logic.js";

const app = initializeApp(firebaseConfig), auth = getAuth(app), db = getFirestore(app);
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)], root = $("#app");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const today = () => isoOf(new Date());
function toast(m) { const t = $("#toast"); t.textContent = m; t.style.display = "block"; clearTimeout(toast.h); toast.h = setTimeout(() => t.style.display = "none", 4000); }
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
const lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } }, lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { } };

/* ---------- state + live data ---------- */
let profile = null, unsubs = [], S = {}, cur = null, tabs = [], pending = false;
function resetState() { unsubs.forEach(u => u()); unsubs = []; S = { reports: {}, visits: {}, sites: {}, supplies: {}, survey: {}, geo: {} }; }
function sub(key, ref, kind) {
  unsubs.push(onSnapshot(ref, snap => {
    if (kind === "doc") { S[key] = {}; if (snap.exists()) S[key][snap.id] = snap.data(); } else { S[key] = {}; snap.docs.forEach(d => S[key][d.id] = d.data()); }
    schedule(); }, e => { toast("تعذّر تحميل " + key + ": " + errMsg(e)); }));
}
function schedule() { clearTimeout(schedule.h); schedule.h = setTimeout(refresh, 200); }
function refresh() { if (!cur || cur.k === "a") return; const a = document.activeElement; if (a && a.closest && a.closest("#tb") && a.matches("input,textarea,select")) { pending = true; return; } renderTab(true); }
document.addEventListener("focusout", () => setTimeout(() => { if (pending) { pending = false; refresh(); } }, 300));
function renderTab(keep) {
  const tb = $("#tb"); if (!tb || !cur) return; const saved = {};
  if (keep) $$("#tb input[id],#tb select[id],#tb textarea[id]").forEach(el => saved[el.id] = el.type === "checkbox" ? el.checked : el.value);
  const sy = window.scrollY; tb.innerHTML = cur.render();
  Object.keys(saved).forEach(id => { const el = document.getElementById(id); if (el && !el.dataset.noKeep) { if (el.type === "checkbox") el.checked = saved[id]; else el.value = saved[id]; } });
  cur.after && cur.after(); if (keep) window.scrollTo(0, sy);
}
function setTab(k) { cur = tabs.find(t => t.k === k) || tabs[0]; $$(".tabs button").forEach(b => b.classList.toggle("on", b.dataset.t === cur.k)); lsSet("mr.tab." + profile.role, cur.k); renderTab(false); }
function shell(sub, tabList) {
  tabs = tabList;
  root.innerHTML = `<div class="bar"><div><h1>حملة الحصبة والحصبة الألمانية</h1><div class="mut">${esc(sub)}</div></div><div><button class="ghost" id="pw">كلمة المرور</button> <button class="ghost" id="out">خروج</button></div></div>
  <div class="tabs">${tabs.map(t => `<button data-t="${t.k}">${t.label}</button>`).join("")}</div><div id="tb"></div>`;
  $("#out").onclick = () => signOut(auth);
  $("#pw").onclick = async () => { const p = prompt("اكتب كلمة المرور الجديدة (6 أحرف على الأقل)"); if (!p) return;
    try { await updatePassword(auth.currentUser, p); toast("تم تغيير كلمة المرور"); } catch (e) { toast(e.code === "auth/requires-recent-login" ? "اخرج وادخل من جديد ثم أعد المحاولة" : "تعذّر التغيير (6 أحرف على الأقل)"); } };
  $(".tabs").onclick = e => { const b = e.target.closest("button[data-t]"); if (b) setTab(b.dataset.t); };
  $("#tb").onclick = e => cur && cur.click && cur.click(e);
  $("#tb").onchange = e => cur && cur.change && cur.change(e);
  $("#tb").oninput = e => cur && cur.input && cur.input(e);
  const last = lsGet("mr.tab." + profile.role); setTab(tabs.some(t => t.k === last) ? last : tabs[0].k);
}

/* ---------- auth ---------- */
onAuthStateChanged(auth, async u => {
  resetState(); cur = null;
  if (!u) { profile = null; return loginView(); }
  try { const s = await getDoc(doc(db, "users", u.uid)); if (!s.exists()) throw 0; profile = { uid: u.uid, ...s.data() }; }
  catch { toast("حسابك غير مفعّل، كلّم الإدارة"); await signOut(auth); return; }
  ({ unit: unitView, supervisor: supView, admin: adminView }[profile.role] || loginView)();
});
function loginView() {
  root.innerHTML = `<div class="card"><h1>تسجيل الدخول</h1><form id="f"><label>اسم المستخدم</label><input id="u" autocomplete="username" autocapitalize="none" required>
  <label>كلمة المرور</label><input id="p" type="password" autocomplete="current-password" required><p><button>دخول</button></p></form></div>`;
  $("#f").onsubmit = async e => { e.preventDefault();
    try { await signInWithEmailAndPassword(auth, $("#u").value.trim().toLowerCase() + "@" + EMAIL_DOMAIN, $("#p").value); }
    catch { toast("اسم المستخدم أو كلمة المرور غير صحيحة"); } };
}

/* ---------- shared panels: sites ---------- */
let siteFilter = "all";
function sitesHtml(unit, editable) {
  const list = SITES_BY_UNIT[unit] || []; let T = 0, V = 0, nd = 0, nr = 0, nn = 0; const rows = [];
  list.forEach((s, i) => { const d = S.sites["s" + unit + "_" + i], st = d && d.status ? d.status : "none", v = d ? num(d.vacc) : 0;
    T += s[3]; V += v; if (st === "done") nd++; else if (st === "revisit") nr++; else nn++; if (siteFilter === "all" || siteFilter === st) rows.push({ i, s, st, v }); });
  return `<div class="card"><div class="row"><span>مطعّمون في المدارس والحضانات</span><b>${nf(V)}</b></div><div class="meter"><i style="width:${Math.min(100, T ? V / T * 100 : 0)}%"></i></div>
  <div class="row mut"><span>المستهدف ${nf(T)} (${pct(T ? V / T * 100 : 0)})</span><span>تم ${nd} · إعادة ${nr} · لم تُزَر ${nn}</span></div></div>
  <div class="tabs sm">${[["all", "الكل"], ["none", "لم تُزَر"], ["done", "تم"], ["revisit", "إعادة زيارة"]].map(f => `<button data-sf="${f[0]}"${siteFilter === f[0] ? ' class="on"' : ""}>${f[1]}</button>`).join("")}</div>
  ${rows.map(r => `<div class="card site" data-i="${r.i}"><div class="bar"><b>${esc(r.s[1])}</b><span class="pill">${esc(r.s[2])}</span></div><div class="mut">المستهدف ${nf(r.s[3])}</div>
  ${editable ? `<div class="seg">${["none", "done", "revisit"].map(k => `<button data-st="${k}"${r.st === k ? ' class="on"' : ""}>${SITE_ST[k]}</button>`).join("")}</div>
  <label>عدد المطعّمين في الموقع</label><input data-site="${r.i}" type="number" inputmode="numeric" min="0" placeholder="0" value="${r.v || ""}" data-no-keep="1">` : `<div>${SITE_ST[r.st]} · مطعّمون ${nf(r.v)}</div>`}</div>`).join("") || '<div class="mut">لا توجد مواقع بهذه الحالة.</div>'}`;
}
async function setSite(unit, i, patch) {
  const id = "s" + unit + "_" + i, c = S.sites[id] || {}, d = { unit, i, status: c.status || "none", vacc: num(c.vacc), ts: new Date().toISOString(), uid: profile.uid, ...patch };
  if (d.status === "none" && d.vacc > 0) d.status = "done";
  try { await setDoc(doc(db, "sites", id), d); S.sites[id] = d; schedule(); } catch (e) { toast("تعذّر الحفظ: " + errMsg(e)); }
}
function siteEvents(unit) { return {
  click(e) { const f = e.target.closest("[data-sf]"); if (f) { siteFilter = f.dataset.sf; return renderTab(true); }
    const b = e.target.closest("[data-st]"); if (b) setSite(unit(), +b.closest(".site").dataset.i, { status: b.dataset.st }); },
  change(e) { const i = e.target.dataset.site; if (i == null) return; const v = intOrNull(e.target.value); if (v === null) return toast("اكتب رقمًا صحيحًا"); setSite(unit(), +i, { vacc: v }); } }; }

/* ---------- shared panels: supplies ---------- */
function supHtml(unit, editable) {
  const n = NEEDS[unit] || [], dd = (S.supplies["p" + unit] || {}).d || {}, st = supState(unit, dd);
  return `<div class="card"><div class="bar"><b>${esc(unitById(unit).name)}</b><span class="pill ${st === "full" ? "ok" : st === "part" ? "warn" : ""}">${st === "full" ? "مكتمل" : st === "part" ? "ناقص" : "لم يُسلَّم شيء"}</span></div>
  <div class="tw"><table><tr><th>الصنف</th><th>المطلوب</th><th>المُسلَّم</th><th>المتبقي</th></tr>${ITEMS.map((it, i) => { const v = num(dd[it[0]]), rem = n[i] - v;
    return `<tr><td>${it[1]}</td><td>${nf(n[i])}</td><td>${editable ? `<input class="cell" id="sd_${it[0]}" data-sd="${it[0]}" type="number" inputmode="numeric" min="0" value="${v || ""}" placeholder="0">` : nf(v)}</td><td class="${rem < 0 ? "bad" : ""}">${rem < 0 ? nf(-rem) + " زيادة" : nf(rem)}</td></tr>`; }).join("")}</table></div>
  ${editable ? '<p><button id="supSave">حفظ المستلزمات</button></p>' : ""}</div>`;
}
async function saveSup(unit) {
  const d = {}; let bad = false; ITEMS.forEach(it => { const v = intOrNull($("#sd_" + it[0]).value); if (v === null) bad = true; else d[it[0]] = v; });
  if (bad) return toast("الأعداد لازم تكون أرقامًا صحيحة");
  try { await setDoc(doc(db, "supplies", "p" + unit), { unit, d, ts: new Date().toISOString(), uid: profile.uid }); toast("تم حفظ المستلزمات"); } catch (e) { toast("تعذّر الحفظ: " + errMsg(e)); }
}
function supOverview() {
  const tot = ITEMS.map(() => [0, 0]), cnt = { full: 0, part: 0, none: 0 }, nm = { part: [], none: [] };
  UNITS.forEach(u => { const dd = (S.supplies["p" + u.id] || {}).d || {}, n = NEEDS[u.id] || []; ITEMS.forEach((it, i) => { tot[i][0] += n[i]; tot[i][1] += num(dd[it[0]]); }); const s = supState(u.id, dd); cnt[s]++; if (s !== "full") nm[s].push(u.name); });
  return `<div class="card"><h2>موقف المستلزمات في الإدارة</h2><div class="stats">${stat("مكتملة", cnt.full)}${stat("ناقصة", cnt.part)}${stat("لم تستلم", cnt.none)}</div>
  <div class="tw"><table><tr><th>الصنف</th><th>المطلوب</th><th>المُسلَّم</th><th>النسبة</th></tr>${ITEMS.map((it, i) => `<tr><td>${it[1]}</td><td>${nf(tot[i][0])}</td><td>${nf(tot[i][1])}</td><td>${pct(tot[i][0] ? tot[i][1] / tot[i][0] * 100 : 0)}</td></tr>`).join("")}</table></div>
  ${nm.part.length ? `<details><summary>وحدات ناقصة (${nm.part.length})</summary><p>${esc(nm.part.join("، "))}</p></details>` : ""}${nm.none.length ? `<details><summary>وحدات لم تستلم بعد (${nm.none.length})</summary><p>${esc(nm.none.join("، "))}</p></details>` : ""}</div>`;
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
  try { await setDoc(doc(db, "survey", "j" + u + "_" + d), { unit: u, date: d, ...v, ts: new Date().toISOString(), uid: profile.uid }); toast("تم حفظ نتيجة الجَشني"); } catch (e) { toast("تعذّر الحفظ: " + errMsg(e)); }
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

/* ---------- unit ---------- */
function unitView() {
  const uid = profile.unit; sub("reports", query(collection(db, "reports"), where("unit", "==", uid))); sub("sites", query(collection(db, "sites"), where("unit", "==", uid)));
  sub("supplies", doc(db, "supplies", "p" + uid), "doc"); sub("geo", doc(db, "unitGeo", String(uid)), "doc");
  const geo = () => S.geo[String(uid)], se = siteEvents(() => uid);
  shell(unitById(uid).name, [
    { k: "r", label: "تقرير اليوم", render() {
        const g = geo(), hist = vals(S.reports).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
        return `<div class="card"><h2>موقع الوحدة</h2>${g ? `<span class="ok">مسجَّل</span> · ${mapLink(g)}` : `<span class="warn">لم يُسجَّل بعد.</span> افتح الصفحة وأنت داخل الوحدة واضغط: <button id="setGeo">تسجيل موقع الوحدة</button>`}</div>
        <div class="card"><h2>تقرير اليوم</h2><label>تاريخ العمل</label><input type="date" id="d" value="${today()}" min="${MIN_DATE}" max="${today()}">
        <label>رقم التشغيلة (اختياري)</label><input id="f_lot" maxlength="30" placeholder="مثال: ABC123">
        <div class="grid">${FIELDS.map(k => `<div><label>${LABELS[k]}</label><input type="number" inputmode="numeric" min="0" step="1" data-k="${k}" id="f_${k}" placeholder="0"></div>`).join("")}</div>
        <p><button id="save">حفظ التقرير</button></p><div class="mut">سيُسجَّل موقعك وقت الحفظ. الحفظ مرة ثانية لنفس اليوم يستبدل التقرير.</div></div>
        <div class="card"><h2>آخر تقاريرك</h2><div class="tw"><table><tr><th>التاريخ</th><th>المطعّمون</th><th>الزجاجات المستهلكة</th><th>أطفال/زجاجة</th></tr>${hist.map(r => `<tr><td>${r.date}</td><td>${r.total}</td><td>${num(r.used)}</td><td>${rateOf(r.total, num(r.used)) ?? "—"}</td></tr>`).join("") || '<tr><td colspan="4">لا شيء بعد</td></tr>'}</table></div></div>`; },
      async click(e) {
        if (e.target.id === "setGeo") { try { const p = await getPos(); await setDoc(doc(db, "unitGeo", String(uid)), { ...p, uid: profile.uid, ts: new Date().toISOString() }); toast("تم تسجيل موقع الوحدة"); } catch (er) { toast(errMsg(er)); } }
        if (e.target.id === "save") {
          const d = $("#d").value; if (!d || d > today() || d < MIN_DATE) return toast("اختر تاريخًا صحيحًا لا يتجاوز اليوم");
          const r = { unit: uid, date: d, uid: profile.uid }; let bad = false; FIELDS.forEach(k => { const v = intOrNull($("#f_" + k).value); if (v === null) bad = true; else r[k] = v; });
          if (bad) return toast("كل الأرقام لازم تكون أعدادًا صحيحة 0 أو أكثر"); if (r.used < r.dmg) return toast("التالف أكبر من المستهلك، راجع الأرقام"); if (r.mvac > r.missed && !confirm("المتطعمون من المتخلفين (" + r.mvac + ") أكبر من المتخلفين اليوم (" + r.missed + "). قد يكونون من أيام سابقة. حفظ؟")) return; r.lot = ($("#f_lot").value || "").trim().slice(0, 30);
          const btn = e.target; btn.disabled = true;
          try { try { r.loc = await getPos(); } catch (er) { r.loc = null; toast(er.message + " — سيُحفظ التقرير بدون موقع"); }
            const g = geo(); if (r.loc && g) r.dist = haversine(r.loc, g); r.total = total(r); r.ts = new Date().toISOString();
            await setDoc(doc(db, "reports", `u${uid}_${d}`), r); FIELDS.forEach(k => $("#f_" + k).value = ""); $("#f_lot").value = ""; toast("تم حفظ التقرير"); }
          catch (er) { toast("تعذّر الحفظ: " + errMsg(er)); } btn.disabled = false; } } },
    { k: "t", label: "مدارسي وحضاناتي", render: () => sitesHtml(uid, true), ...se },
    { k: "p", label: "المستلزمات", render: () => supHtml(uid, false) } ]);
}

/* ---------- supervisor ---------- */
function supView() {
  sub("visits", query(collection(db, "visits"), where("uid", "==", profile.uid))); sub("supplies", collection(db, "supplies")); sub("survey", collection(db, "survey")); sub("reports", collection(db, "reports")); sub("geo", collection(db, "unitGeo"));
  const mine = (profile.assigned && profile.assigned.length ? UNITS.filter(u => profile.assigned.includes(u.id)) : UNITS);
  let supUnit = +(lsGet("mr.supUnit") || mine[0].id); if (!mine.some(u => u.id === supUnit)) supUnit = mine[0].id;
  shell("مشرف: " + profile.name, [
    { k: "v", label: "زيارة", render() {
        const my = vals(S.visits), last = {}; my.forEach(v => { if (!last[v.unit] || v.date > last[v.unit]) last[v.unit] = v.date; }); const t = today();
        const status = u => { if (t < START) return '<span class="pill">لم تبدأ الحملة</span>'; const l = last[u.id]; if (!l) return '<span class="pill bad">لم تُزَر</span>'; const n = Math.round((new Date(t) - new Date(l)) / 864e5); return n >= 3 ? `<span class="pill warn">مضى ${n} يوم</span>` : `<span class="pill ok">زيارة ${fmtD(l)}</span>`; };
        return `<div class="card"><h2>تسجيل زيارة إشرافية</h2><label>الوحدة</label>${unitSel("vu", mine, supUnit)}<label>التاريخ</label><input type="date" id="vd" value="${t}" max="${t}">
        <div class="grid"><div><label>حرارة الثلاجة °م (كما شاهدتها)</label><input id="vt" type="number" step="0.1"></div><div><label>عدد الفرق الموجودة</label><input id="vm" type="number" inputmode="numeric" min="0"></div><div><label>عدد الزجاجات (عدّ فعلي)</label><input id="vv" type="number" inputmode="numeric" min="0"></div></div>
        <label>استمارة مرور الإشراف (بنود الوزارة)</label>${["وحدة", "فريق"].map(g => `<div class="mut">${g === "وحدة" ? "أثناء التنفيذ بالوحدة الصحية" : "المرور على الفرق"}</div>` + CHECKS.filter(c => c[1] === g).map(c => `<div class="row chkrow"><span>${c[2]}</span><select id="vc_${c[0]}"><option value="">—</option><option value="1">مستوفى</option><option value="0">غير مستوفى</option></select></div>`).join("")).join("")}
        <label>مشاكل أخرى لاحظتها</label>${PROBS.map(p => `<label class="chk"><input type="checkbox" id="vp_${p[0]}"> ${p[1]}</label>`).join("")}
        <label>ملاحظات (اختياري)</label><textarea id="vn" rows="2" maxlength="200"></textarea><p><button id="vs">تسجيل الزيارة وموقعي</button></p><div class="mut">يجب أن تكون داخل الوحدة وقت التسجيل (الحد ${MAX_DIST_M} م من موقعها المسجّل).</div></div>
        <div class="card"><h2>${profile.assigned && profile.assigned.length ? "وحداتي" : "الوحدات"}</h2><div class="tw"><table><tr><th>الوحدة</th><th>الحالة</th></tr>${mine.map(u => `<tr><td>${esc(u.name)}</td><td>${status(u)}</td></tr>`).join("")}</table></div></div>
        <div class="card"><h2>زياراتي</h2><div class="tw"><table><tr><th>الوحدة</th><th>التاريخ</th><th>المسافة</th></tr>${my.sort((a, b) => (b.ts || "").localeCompare(a.ts || "")).slice(0, 20).map(v => `<tr><td>${esc(unitById(v.unit).name)}</td><td>${v.date}</td><td>${v.dist == null ? "؟" : v.dist + " م"}</td></tr>`).join("") || '<tr><td colspan="3">لا شيء بعد</td></tr>'}</table></div></div>`; },
      change(e) { if (e.target.id === "vu") lsSet("mr.supUnit", e.target.value); },
      async click(e) { if (e.target.id !== "vs") return;
        const unit = +$("#vu").value, t = parseFloat($("#vt").value), tm = parseInt($("#vm").value, 10), vl = parseInt($("#vv").value, 10), d = $("#vd").value;
        if (!d || d > today() || d < MIN_DATE || isNaN(t) || isNaN(tm) || isNaN(vl) || tm < 0 || vl < 0) return toast("اكتب الحرارة والفرق والزجاجات كما شاهدتها");
        const probs = {}, checks = {}; PROBS.forEach(p => { if ($("#vp_" + p[0]).checked) probs[p[0]] = true; }); CHECKS.forEach(c => { const v = $("#vc_" + c[0]).value; if (v !== "") checks[c[0]] = +v; }); const btn = e.target; btn.disabled = true;
        try { const loc = await getPos(), g = S.geo[String(unit)], dist = g ? haversine(loc, g) : null;
          await addDoc(collection(db, "visits"), { uid: profile.uid, name: profile.name, unit, date: d, temp: t, teams: tm, vials: vl, probs, checks, note: $("#vn").value.trim().slice(0, 200), loc, dist, ts: new Date().toISOString() });
          ["vt", "vm", "vv", "vn"].forEach(i => $("#" + i).value = ""); CHECKS.forEach(c => $("#vc_" + c[0]).value = ""); PROBS.forEach(p => $("#vp_" + p[0]).checked = false);
          toast(dist == null ? "تم التسجيل (الوحدة لم تسجّل موقعها بعد)" : dist > MAX_DIST_M ? `تم التسجيل لكن أنت بعيد ${dist} م عن الوحدة` : "تم تسجيل الزيارة"); }
        catch (er) { toast(er.message || "تعذّر التسجيل"); } btn.disabled = false; } },
    { k: "p", label: "المستلزمات", render: () => `<div class="card"><label>الوحدة</label>${unitSel("su", mine, supUnit)}</div><div id="supBox">${supHtml(supUnit, true)}</div>`,
      change(e) { if (e.target.id === "su") { supUnit = +e.target.value; lsSet("mr.supUnit", String(supUnit)); renderTab(false); } },
      click(e) { if (e.target.id === "supSave") saveSup(supUnit); } },
    { k: "j", label: "الجَشني", render: () => surveyForm(mine) + surveyResults(), click(e) { if (e.target.id === "svSave") saveSurvey(); } } ]);
}

/* ---------- admin ---------- */
function adminView() {
  ["reports", "visits", "sites", "supplies", "survey"].forEach(k => sub(k, collection(db, k))); sub("geo", collection(db, "unitGeo"));
  let ref = today(), repOpen = false, siteUnit = UNITS[0].id, supUnit = UNITS[0].id; const se = siteEvents(() => siteUnit);
  const maxRef = () => { const t = today(); return t; };
  shell("إدارة الصحة بالمنشاة", [
    { k: "s", label: "ملخص", render() {
        const c = calc(vals(S.reports), ref), al = alertsFor(c.list, ref, today(), vals(S.sites), vals(S.visits)); let cumT = 0, dayT = 0; c.list.forEach(p => { cumT += p.cum; dayT += p.day; });
        return `<div class="card"><label>اليوم المعروض</label><input type="date" id="refd" value="${ref}" min="${MIN_DATE}" max="${maxRef()}">
        <div class="stats">${stat("مطعّمو اليوم", nf(dayT))}${stat("الإجمالي", nf(cumT))}${stat("المستهدف", nf(TOTAL_TARGET))}${stat("التغطية", pct(cumT / TOTAL_TARGET * 100))}</div></div>
        <div class="card"><h2>تنبيهات</h2>${al.length ? al.map(a => `<div class="alert ${a.cls}"><b>${esc(a.t)}</b>${a.x ? `<span>${esc(a.x)}</span>` : ""}</div>`).join("") : '<div class="ok">لا توجد تنبيهات الآن.</div>'}</div>
        <div class="card"><h2>بلاغ اليوم للمديرية</h2>${repOpen ? `<textarea id="repTxt" rows="16" readonly data-no-keep="1">${esc(reportText(c.list, ref))}</textarea><p><button id="repCopy">نسخ النص</button> <button class="ghost" id="repHide">إخفاء</button></p>` : `<div class="mut">نص جاهز بأرقام يوم ${fmtD(ref)}، تنسخه وتبعته.</div><p><button class="ghost" id="repShow">تجهيز النص</button></p>`}</div>
        <div class="card tw"><table><tr><th>الوحدة</th><th>اليوم</th><th>الإجمالي</th><th>المستهدف</th><th>%</th><th>رصيد الطعوم</th><th>أطفال/زجاجة</th></tr>${c.list.map(p => `<tr><td>${esc(p.u.name)}${p.rep ? "" : ' <span class="pill warn">لم تبلّغ</span>'}</td><td>${nf(p.day)}</td><td>${nf(p.cum)}</td><td>${nf(p.u.target)}</td><td>${pct(p.cum / p.u.target * 100)}</td><td class="${p.recv - p.used < 0 ? "bad" : ""}">${nf(p.recv - p.used)}</td><td>${rateOf(p.cum, p.used) ?? "—"}</td></tr>`).join("")}</table></div>`; },
      change(e) { if (e.target.id === "refd" && e.target.value) { ref = e.target.value; renderTab(false); } },
      click(e) { const id = e.target.id; if (id === "repShow") { repOpen = true; renderTab(true); } if (id === "repHide") { repOpen = false; renderTab(true); }
        if (id === "repCopy") { const t = $("#repTxt"); t.select(); (navigator.clipboard ? navigator.clipboard.writeText(t.value) : Promise.reject()).then(() => toast("تم النسخ"), () => { document.execCommand("copy"); toast("تم النسخ"); }); } } },
    { k: "v", label: "الزيارات", render() {
        const A = analyzeVisits(vals(S.visits), vals(S.reports), S.geo, MAX_DIST_M), seen = {}, per = {}; let review = 0;
        A.forEach(o => { seen[o.v.unit] = 1; const k = o.v.uid || "none", p = per[k] || (per[k] = { n: 0, u: {}, name: o.v.name || "غير معروف" }); p.n++; p.u[o.v.unit] = 1; if (o.flags.some(f => f.c !== "info")) review++; });
        const un = UNITS.filter(u => !seen[u.id]).map(u => u.name);
        return `<div class="card"><div class="stats">${stat("زيارات", A.length)}${stat("وحدات تمت زيارتها", (UNITS.length - un.length) + "/" + UNITS.length)}${stat("تحتاج مراجعة", review, review ? "bad" : "")}</div>
        ${un.length ? `<details><summary>وحدات لم تُزَر بعد (${un.length})</summary><p>${esc(un.join("، "))}</p></details>` : ""}
        ${Object.keys(per).length ? `<div class="tw"><table><tr><th>المشرف</th><th>زيارات</th><th>وحدات مختلفة</th></tr>${Object.keys(per).sort((a, b) => per[b].n - per[a].n).map(k => `<tr><td>${esc(per[k].name)}</td><td>${per[k].n}</td><td>${Object.keys(per[k].u).length}</td></tr>`).join("")}</table></div>` : ""}</div>
        ${A.slice(0, 40).map(o => { const v = o.v, ps = Object.keys(v.probs || {}).filter(k => PROB_NAME[k]).map(k => `<span class="pill bad">${PROB_NAME[k]}</span>`).join("") + Object.keys(v.checks || {}).filter(k => v.checks[k] === 0 && CHECK_NAME[k]).map(k => `<span class="pill bad">${CHECK_NAME[k]}: غير مستوفى</span>`).join("");
          return `<div class="card"><div class="bar"><b>${esc(unitById(v.unit).name)}</b><span class="mut">${fmtD(v.date)}</span></div><div class="mut">المشرف: ${esc(v.name || "غير معروف")} · ثلاجة ${v.temp}°م · فرق ${v.teams} · زجاجات ${nf(v.vials)} · ${o.dist == null ? "المسافة ؟" : o.dist + " م"} · ${mapLink(v.loc)}</div>
          <div class="pills">${ps || '<span class="pill ok">بدون مشاكل مبلّغ عنها</span>'}</div>${o.flags.length ? `<div class="pills">${o.flags.map(f => `<span class="pill ${f.c === "info" ? "" : f.c}">${esc(f.t)}</span>`).join("")}</div>` : ""}${v.note ? `<p>${esc(v.note)}</p>` : ""}</div>`; }).join("") || '<div class="card mut">لا توجد زيارات مسجّلة بعد.</div>'}`; } },
    { k: "t", label: "المواقع", render() {
        const all = vals(S.sites); let dn = 0, rv = 0; const re = {}; all.forEach(d => { if (d.status === "done") dn++; else if (d.status === "revisit") { rv++; re[d.unit] = (re[d.unit] || 0) + 1; } });
        const nm = Object.keys(re).map(u => unitById(u).name + " (" + re[u] + ")");
        return `<div class="card"><div class="stats">${stat("مواقع", SITES.length)}${stat("تم", dn)}${stat("إعادة زيارة", rv)}${stat("لم تُزَر", Math.max(0, SITES.length - dn - rv))}</div>${nm.length ? `<details><summary>وحدات فيها مواقع تحتاج إعادة (${nm.length})</summary><p>${esc(nm.join("، "))}</p></details>` : ""}</div>
        <div class="card"><label>الوحدة</label>${unitSel("stu", UNITS, siteUnit)}</div>${sitesHtml(siteUnit, true)}`; },
      ...{ click(e) { se.click(e); }, change(e) { if (e.target.id === "stu") { siteUnit = +e.target.value; renderTab(false); } else se.change(e); } } },
    { k: "p", label: "المستلزمات", render: () => supOverview() + `<div class="card"><label>تسجيل تسليم لوحدة</label>${unitSel("su", UNITS, supUnit)}</div>${supHtml(supUnit, true)}`,
      change(e) { if (e.target.id === "su") { supUnit = +e.target.value; renderTab(false); } }, click(e) { if (e.target.id === "supSave") saveSup(supUnit); } },
    { k: "j", label: "الجَشني", render: () => surveyResults() + surveyForm(UNITS), click(e) { if (e.target.id === "svSave") saveSurvey(); } },
    { k: "g", label: "مواقع الوحدات", render: () => `<div class="card tw"><table><tr><th>الوحدة</th><th>الموقع</th><th></th></tr>${UNITS.map(u => `<tr><td>${esc(u.name)}</td><td>${S.geo[u.id] ? mapLink(S.geo[u.id]) : '<span class="warn">غير مسجّل</span>'}</td><td>${S.geo[u.id] ? `<button class="ghost" data-del="${u.id}">مسح</button>` : ""}</td></tr>`).join("")}</table></div><div class="mut">مسح الموقع يسمح للوحدة بتسجيله من جديد.</div>`,
      async click(e) { const id = e.target.dataset.del; if (!id || !confirm("مسح موقع هذه الوحدة؟")) return; try { await deleteDoc(doc(db, "unitGeo", id)); } catch (er) { toast(errMsg(er)); } } },
    { k: "a", label: "الحسابات", render: () => '<div id="acc" class="mut">جارٍ التحميل…</div>', after: accounts } ]);
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
    <div class="mut">كلمات المرور تظهر مرة واحدة بعد الإنشاء مع تنزيل CSV تلقائي. احفظها فورًا.</div><div id="cr"></div></div>
    <div class="card"><h2>إسناد الوحدات للمشرفين</h2>${sups.length ? `<label>المشرف</label><select id="as">${sups.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join("")}</select>
      <div id="asu" class="checks"></div><p><button id="asSave">حفظ الإسناد</button></p><div class="mut">لو لم تُسنَد وحدات لمشرف تظهر له كل الوحدات.</div>` : '<div class="mut">أضف مشرفًا أولًا.</div>'}</div>
    <div class="card tw"><table><tr><th>الدور</th><th>الاسم</th><th>اسم الدخول</th><th></th></tr>${us.sort((a, b) => (a.login || "") > (b.login || "") ? 1 : -1).map(u => `<tr><td>${u.role}</td><td>${esc(u.name)}</td><td dir="ltr">${esc(u.login || "")}</td><td>${u.role === "admin" ? "" : `<button class="ghost" data-re="${u.id}">إعادة إصدار</button>`}</td></tr>`).join("")}</table></div>
    <div class="mut">«إعادة إصدار» تعطّل الحساب القديم وتنشئ حسابًا جديدًا باسم دخول جديد وكلمة جديدة.</div>`;
    const show2 = out => { if (!out.length) return; $("#cr").innerHTML = `<div class="card"><b>احفظ الآن:</b><div class="tw"><table><tr><th>الاسم</th><th>الدخول</th><th>كلمة المرور</th></tr>${out.map(r => `<tr><td>${esc(r.name)}</td><td dir="ltr">${r.login}</td><td dir="ltr">${r.pw}</td></tr>`).join("")}</table></div><p><button id="dl">تنزيل CSV</button></p></div>`; $("#dl").onclick = () => csvDl(out); csvDl(out); };
    const fail = (u, e) => { $("#cr").innerHTML = `<div class="card bad">فشل عند ${esc(u)}: ${esc(e.code || e.message)}</div>`; };
    $("#mkU").onclick = async () => { $("#mkU").disabled = true; const out = []; for (const u of miss) { try { out.push(await mk("unit" + u.id, "unit", u.name, u.id)); } catch (e) { fail(u.name, e); break; } } show2(out); };
    $("#reAll").onclick = async () => { if (!confirm("سيتم تعطيل كل الحسابات (عدا الإدارة) وإنشاء حسابات جديدة بكلمات جديدة. متأكد؟")) return; $("#reAll").disabled = true; const out = [];
      for (const u of us.filter(x => x.role !== "admin")) { try { const base = (u.login || (u.role === "unit" ? "unit" + u.unit : "sup")).replace(/(-r\d+)+$/, ""); out.push(await mk(base + "-r" + Math.floor(Math.random() * 900 + 100), u.role, u.name, u.unit, u.assigned)); await deleteDoc(doc(db, "users", u.id)); } catch (e) { fail(u.name, e); break; } } show2(out); };
    $("#mkS").onclick = async () => { const n = $("#sn").value.trim(); if (!n) return toast("اكتب اسم المشرف"); try { show2([await mk("sup" + (sups.length + 1) + "-" + Math.floor(Math.random() * 90 + 10), "supervisor", n)]); } catch (e) { fail(n, e); } };
    if (sups.length) { const paint = () => { const s = sups.find(x => x.id === $("#as").value) || {}; $("#asu").innerHTML = UNITS.map(u => `<label class="chk"><input type="checkbox" data-u="${u.id}"${(s.assigned || []).includes(u.id) ? " checked" : ""}> ${esc(u.name)}</label>`).join(""); };
      $("#as").onchange = paint; paint();
      $("#asSave").onclick = async () => { const id = $("#as").value, a = $$("#asu input:checked").map(i => +i.dataset.u); const s = sups.find(x => x.id === id);
        try { await setDoc(doc(db, "users", id), { role: s.role, name: s.name, login: s.login || "", assigned: a }); s.assigned = a; toast("تم حفظ الإسناد (" + a.length + " وحدة)"); } catch (e) { toast(errMsg(e)); } }; }
    $("#acc").onclick = async e => { const id = e.target.dataset.re; if (!id) return; const u = us.find(x => x.id === id); if (!confirm("إعادة إصدار حساب " + u.name + "؟")) return;
      try { const base = (u.login || "x").replace(/(-r\d+)+$/, ""); const r = await mk(base + "-r" + Math.floor(Math.random() * 900 + 100), u.role, u.name, u.unit, u.assigned); await deleteDoc(doc(db, "users", id)); accounts.busy = false; await accounts(); show2([r]); } catch (er) { fail(u.name, er); } };
  } catch (e) { const b = $("#acc"); if (b) b.textContent = "تعذّر تحميل الحسابات: " + errMsg(e); } finally { accounts.busy = false; }
}
