import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword, updatePassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, addDoc, collection, getDocs, query, where, orderBy, limit, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig, EMAIL_DOMAIN, MAX_DIST_M } from "./firebase-config.js";
import { UNITS } from "./units.js";

const app = initializeApp(firebaseConfig), auth = getAuth(app), db = getFirestore(app);
const $ = s => document.querySelector(s), root = $("#app");
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const unitName = id => (UNITS.find(u => u.id === +id) || {}).name || ("وحدة " + id);
const pad = n => String(n).padStart(2, "0");
const today = () => { const d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
const START = "2026-10-25";
function toast(m) { const t = $("#toast"); t.textContent = m; t.style.display = "block"; clearTimeout(toast.h); toast.h = setTimeout(() => t.style.display = "none", 3500); }
function haversine(a, b) { const R = 6371000, r = x => x * Math.PI / 180, dLa = r(b.lat - a.lat), dLo = r(b.lng - a.lng);
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLo / 2) ** 2; return Math.round(2 * R * Math.asin(Math.sqrt(h))); }
function getPos() { return new Promise((res, rej) => {
  if (!navigator.geolocation) return rej(new Error("المتصفح لا يدعم تحديد الموقع"));
  navigator.geolocation.getCurrentPosition(p => res({ lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy) }),
    e => rej(new Error(e.code === 1 ? "لازم تسمح للمتصفح بتحديد الموقع ثم أعد المحاولة" : "تعذّر تحديد الموقع، تأكد من تشغيل GPS")), { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }); }); }
const mapLink = l => l ? `<a target="_blank" rel="noopener" href="https://www.google.com/maps?q=${l.lat},${l.lng}">خريطة</a>` : "—";

const LABELS = {
  eg1: "مصريون - من 9 شهور إلى أقل من سنة", eg2: "مصريون - من سنة إلى أقل من 5 سنوات", eg3: "مصريون - من 5 سنوات إلى 10 سنوات",
  ne1: "غير مصريين - من 9 شهور إلى أقل من سنة", ne2: "غير مصريين - من سنة إلى أقل من 5 سنوات", ne3: "غير مصريين - من 5 سنوات إلى 10 سنوات",
  fs: "مواقع ثابتة عملت اليوم", fc: "مطعّمون في المواقع الثابتة", sv: "مدارس ومعاهد تمت زيارتها", sc: "مطعّمون في المدارس والمعاهد",
  nv: "حضانات تمت زيارتها", nc: "مطعّمون في الحضانات", missed: "متخلفون عن التطعيم", side: "آثار جانبية (عدد الحالات)",
  teams: "فرق عملت اليوم", recv: "زجاجات وصلت اليوم", used: "زجاجات استُهلكت اليوم", dmg: "منها تالفة أو مفقودة" };
const AGE = ["eg1", "eg2", "eg3", "ne1", "ne2", "ne3"];
const total = r => AGE.reduce((s, k) => s + (+r[k] || 0), 0);

let profile = null;
onAuthStateChanged(auth, async u => {
  if (!u) { profile = null; return loginView(); }
  try { const s = await getDoc(doc(db, "users", u.uid)); if (!s.exists()) throw 0; profile = { uid: u.uid, ...s.data() }; }
  catch { toast("حسابك غير مفعّل، كلّم الإدارة"); await signOut(auth); return; }
  ({ unit: unitView, supervisor: supView, admin: adminView }[profile.role] || loginView)();
});

function header(sub) { return `<div class="bar"><div><h1>حملة الحصبة والحصبة الألمانية</h1><div class="mut">${esc(sub)}</div></div><div><button class="ghost" id="pw">كلمة المرور</button> <button class="ghost" id="out">خروج</button></div></div>`; }
function bindOut() { $("#out").onclick = () => signOut(auth);
  $("#pw").onclick = async () => { const p = prompt("اكتب كلمة المرور الجديدة (6 أحرف على الأقل)"); if (!p) return;
    try { await updatePassword(auth.currentUser, p); toast("تم تغيير كلمة المرور"); } catch (e) { toast(e.code === "auth/requires-recent-login" ? "اخرج وادخل من جديد ثم أعد المحاولة" : "تعذّر التغيير (6 أحرف على الأقل)"); } }; }

function loginView() {
  root.innerHTML = `<div class="card"><h1>تسجيل الدخول</h1><form id="f"><label>اسم المستخدم</label><input id="u" autocomplete="username" autocapitalize="none" required>
  <label>كلمة المرور</label><input id="p" type="password" autocomplete="current-password" required><p><button>دخول</button></p></form></div>`;
  $("#f").onsubmit = async e => { e.preventDefault();
    try { await signInWithEmailAndPassword(auth, $("#u").value.trim().toLowerCase() + "@" + EMAIL_DOMAIN, $("#p").value); }
    catch { toast("اسم المستخدم أو كلمة المرور غير صحيحة"); } };
}

/* ---------- الوحدة ---------- */
async function unitView() {
  const uid = profile.unit; root.innerHTML = header(unitName(uid)) + `<div id="body" class="mut">جارٍ التحميل…</div>`; bindOut();
  let geo = (await getDoc(doc(db, "unitGeo", String(uid)))).data();
  const fields = Object.keys(LABELS).map(k => `<div><label>${LABELS[k]}</label><input type="number" inputmode="numeric" min="0" step="1" data-k="${k}" value="0"></div>`).join("");
  $("#body").outerHTML = `<div class="card"><h2>موقع الوحدة</h2><div id="geo"></div></div>
  <div class="card"><h2>تقرير اليوم</h2><label>تاريخ العمل</label><input type="date" id="d" value="${today()}" min="2026-10-01" max="${today()}">
  <div class="grid">${fields}</div><p><button id="save">حفظ التقرير</button></p><div class="mut">سيُسجَّل موقعك وقت الحفظ. الحفظ مرة ثانية لنفس اليوم يستبدل التقرير.</div></div>
  <div class="card"><h2>آخر تقاريرك</h2><div id="hist" class="tw"></div></div>`;
  const paintGeo = () => $("#geo").innerHTML = geo ? `<span class="ok">مسجَّل</span> · ${mapLink(geo)}` : `<span class="warn">لم يُسجَّل بعد.</span> افتح الصفحة وأنت داخل الوحدة واضغط: <button id="setGeo">تسجيل موقع الوحدة</button>`;
  paintGeo();
  if (!geo) $("#geo").addEventListener("click", async e => { if (e.target.id !== "setGeo") return;
    try { const p = await getPos(); await setDoc(doc(db, "unitGeo", String(uid)), { ...p, uid: profile.uid, ts: new Date().toISOString() }); geo = p; paintGeo(); toast("تم تسجيل موقع الوحدة"); }
    catch (er) { toast(er.message); } });
  async function hist() { const q = await getDocs(query(collection(db, "reports"), where("unit", "==", uid), orderBy("date", "desc"), limit(10)));
    $("#hist").innerHTML = `<table><tr><th>التاريخ</th><th>المطعّمون</th><th>الزجاجات المستهلكة</th></tr>${q.docs.map(x => { const r = x.data(); return `<tr><td>${r.date}</td><td>${r.total}</td><td>${r.used}</td></tr>`; }).join("") || '<tr><td colspan="3">لا شيء بعد</td></tr>'}</table>`; }
  hist().catch(() => $("#hist").textContent = "تعذّر تحميل السجل (قد تحتاج إنشاء فهرس، راجع README)");
  $("#save").onclick = async () => {
    const d = $("#d").value; if (!d || d > today() || d < "2026-10-01") return toast("اختر تاريخًا صحيحًا لا يتجاوز اليوم");
    const r = { unit: uid, date: d, uid: profile.uid }; let bad = false;
    document.querySelectorAll("[data-k]").forEach(i => { const v = i.value.trim() === "" ? 0 : Number(i.value); if (!Number.isInteger(v) || v < 0) bad = true; r[i.dataset.k] = v; });
    if (bad) return toast("كل الأرقام لازم تكون أعدادًا صحيحة 0 أو أكثر");
    if (r.used < r.dmg) return toast("التالف أكبر من المستهلك، راجع الأرقام");
    $("#save").disabled = true;
    try { try { r.loc = await getPos(); } catch (er) { r.loc = null; toast(er.message + " — سيُحفظ التقرير بدون موقع"); }
      if (r.loc && geo) r.dist = haversine(r.loc, geo);
      r.total = total(r); r.ts = new Date().toISOString();
      await setDoc(doc(db, "reports", `u${uid}_${d}`), r); toast("تم حفظ التقرير"); hist(); }
    catch (er) { toast("تعذّر الحفظ: " + (er.code || er.message)); }
    $("#save").disabled = false; };
}

/* ---------- المشرف ---------- */
async function supView() {
  root.innerHTML = header("مشرف: " + profile.name) + `<div class="card"><h2>تسجيل زيارة إشرافية</h2>
  <label>الوحدة</label><select id="vu">${UNITS.map(u => `<option value="${u.id}">${esc(u.name)}</option>`).join("")}</select>
  <label>التاريخ</label><input type="date" id="vd" value="${today()}" max="${today()}">
  <div class="grid"><div><label>حرارة الثلاجة °م (كما شاهدتها)</label><input id="vt" type="number" step="0.1"></div>
  <div><label>عدد الفرق الموجودة</label><input id="vm" type="number" min="0"></div>
  <div><label>عدد الزجاجات (عدّ فعلي)</label><input id="vv" type="number" min="0"></div></div>
  <label>ملاحظات (اختياري)</label><textarea id="vn" rows="2" maxlength="200"></textarea>
  <p><button id="vs">تسجيل الزيارة وموقعي</button></p><div class="mut">يجب أن تكون داخل الوحدة وقت التسجيل (الحد ${MAX_DIST_M} م من موقعها المسجّل).</div></div>
  <div class="card"><h2>زياراتي</h2><div id="vl" class="tw"></div></div>`; bindOut();
  async function list() { const q = await getDocs(query(collection(db, "visits"), where("uid", "==", profile.uid), orderBy("ts", "desc"), limit(20)));
    $("#vl").innerHTML = `<table><tr><th>الوحدة</th><th>التاريخ</th><th>المسافة</th></tr>${q.docs.map(x => { const v = x.data(); return `<tr><td>${esc(unitName(v.unit))}</td><td>${v.date}</td><td>${v.dist == null ? "؟" : v.dist + " م"}</td></tr>`; }).join("") || '<tr><td colspan="3">لا شيء بعد</td></tr>'}</table>`; }
  list().catch(() => $("#vl").textContent = "تعذّر تحميل السجل (راجع README عن الفهارس)");
  $("#vs").onclick = async () => {
    const unit = +$("#vu").value, t = parseFloat($("#vt").value), tm = parseInt($("#vm").value, 10), vl = parseInt($("#vv").value, 10), d = $("#vd").value;
    if (!d || d > today() || isNaN(t) || isNaN(tm) || isNaN(vl) || tm < 0 || vl < 0) return toast("اكتب الحرارة والفرق والزجاجات كما شاهدتها");
    $("#vs").disabled = true;
    try { const loc = await getPos(); const g = (await getDoc(doc(db, "unitGeo", String(unit)))).data();
      const dist = g ? haversine(loc, g) : null;
      await addDoc(collection(db, "visits"), { uid: profile.uid, name: profile.name, unit, date: d, temp: t, teams: tm, vials: vl, note: $("#vn").value.trim().slice(0, 200), loc, dist, ts: new Date().toISOString() });
      toast(dist == null ? "تم التسجيل (الوحدة لم تسجّل موقعها بعد)" : dist > MAX_DIST_M ? `تم التسجيل لكن أنت بعيد ${dist} م عن الوحدة` : "تم تسجيل الزيارة"); list(); }
    catch (er) { toast(er.message || "تعذّر التسجيل"); }
    $("#vs").disabled = false; };
}

/* ---------- الإدارة ---------- */
async function adminView() {
  root.innerHTML = header("إدارة الصحة بالمنشاة") + `<div class="tabs"><button data-t="s" class="on">ملخص</button><button data-t="v">الزيارات</button><button data-t="g">مواقع الوحدات</button><button data-t="a">الحسابات</button></div><div id="ab" class="mut">جارٍ التحميل…</div>`; bindOut();
  const [rs, vs, gs] = await Promise.all([getDocs(collection(db, "reports")), getDocs(query(collection(db, "visits"), orderBy("ts", "desc"), limit(200))), getDocs(collection(db, "unitGeo"))]);
  const reports = rs.docs.map(x => x.data()), visits = vs.docs.map(x => x.data()), geo = {}; gs.docs.forEach(x => geo[x.id] = x.data());
  const views = {
    s() { const by = {}; reports.forEach(r => { const o = by[r.unit] || (by[r.unit] = { n: 0, c: 0, last: "", u: 0, rv: 0 }); o.n++; o.c += r.total || 0; o.u += r.used || 0; o.rv += r.recv || 0; if (r.date > o.last) o.last = r.date; });
      const t = today(), miss = UNITS.filter(u => t >= START && !reports.some(r => r.unit === u.id && r.date === t));
      return `<div class="card"><b>إجمالي المطعّمين:</b> ${reports.reduce((s, r) => s + (r.total || 0), 0).toLocaleString("ar-EG")}</div>
      ${miss.length ? `<div class="card warn">لم تبلّغ اليوم (${miss.length}): ${esc(miss.map(u => u.name).join("، "))}</div>` : ""}
      <div class="card tw"><table><tr><th>الوحدة</th><th>المطعّمون</th><th>المستهدف</th><th>%</th><th>آخر تقرير</th><th>رصيد الزجاجات</th></tr>${UNITS.map(u => { const o = by[u.id] || { c: 0, last: "—", u: 0, rv: 0 }; return `<tr><td>${esc(u.name)}</td><td>${o.c}</td><td>${u.target}</td><td>${Math.round(o.c / u.target * 100)}</td><td>${o.last}</td><td>${o.rv - o.u}</td></tr>`; }).join("")}</table></div>`; },
    v() { return `<div class="card tw"><table><tr><th>المشرف</th><th>الوحدة</th><th>التاريخ</th><th>الثلاجة</th><th>فرق</th><th>زجاجات</th><th>المسافة</th><th>الموقع</th></tr>${visits.map(v => {
      const g = geo[v.unit], d = g && v.loc ? haversine(v.loc, g) : null, flag = d == null ? "warn" : d > MAX_DIST_M ? "bad" : "ok";
      const tf = v.temp < 2 || v.temp > 8 ? "bad" : "";
      return `<tr><td>${esc(v.name)}</td><td>${esc(unitName(v.unit))}</td><td>${v.date}</td><td class="${tf}">${v.temp}</td><td>${v.teams}</td><td>${v.vials}</td><td class="${flag}">${d == null ? "؟" : d + " م"}</td><td>${mapLink(v.loc)}</td></tr>`; }).join("") || '<tr><td colspan="8">لا زيارات</td></tr>'}</table></div>
      <div class="mut">المسافة تُحسب هنا من إحداثيات الزيارة وموقع الوحدة المسجّل (أحمر = أبعد من ${MAX_DIST_M} م).</div>`; },
    g() { return `<div class="card tw"><table><tr><th>الوحدة</th><th>الموقع</th><th>إجراء</th></tr>${UNITS.map(u => `<tr><td>${esc(u.name)}</td><td>${geo[u.id] ? mapLink(geo[u.id]) : '<span class="warn">غير مسجّل</span>'}</td><td>${geo[u.id] ? `<button class="ghost" data-del="${u.id}">مسح</button>` : ""}</td></tr>`).join("")}</table></div><div class="mut">مسح الموقع يسمح للوحدة بتسجيله من جديد.</div>`; }
  };

  const sec = getApps().find(a => a.name === "sec") || initializeApp(firebaseConfig, "sec"), secAuth = getAuth(sec);
  const rnd = () => { const a = "abcdefghjkmnpqrstuvwxyz23456789", b = crypto.getRandomValues(new Uint8Array(8)); return [...b].map(x => a[x % a.length]).join(""); };
  async function mk(login, role, name, unit) {
    for (let t = 0; t < 3; t++) {
      const lg = t ? login.replace(/-r\d+$/, "") + "-r" + Math.floor(Math.random() * 900 + 100) : login, pw = rnd();
      try {
        const cred = await createUserWithEmailAndPassword(secAuth, lg + "@" + EMAIL_DOMAIN, pw); await signOut(secAuth);
        const d = { role, name, login: lg }; if (unit) d.unit = unit; await setDoc(doc(db, "users", cred.user.uid), d); return { ...d, pw };
      } catch (e) { if (e.code !== "auth/email-already-in-use" || t === 2) throw e; }
    } }
  const csvDl = rows => { const t = "\ufeff" + ["الدور,الاسم,اسم الدخول,كلمة المرور"].concat(rows.map(r => [r.role, r.name, r.login, r.pw].join(","))).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([t], { type: "text/csv" })); a.download = "credentials.csv"; a.click(); };
  async function accounts() {
    const us = (await getDocs(collection(db, "users"))).docs.map(x => ({ id: x.id, ...x.data() }));
    const have = new Set(us.filter(u => u.role === "unit").map(u => u.unit)), miss = UNITS.filter(u => !have.has(u.id));
    $("#ab").innerHTML = `<div class="card"><h2>الحسابات (${us.length})</h2>
    <p><button id="mkU"${miss.length ? "" : " disabled"}>إنشاء حسابات الوحدات الناقصة (${miss.length})</button></p>
    <p><button class="ghost" id="reAll"${us.length > 1 ? "" : " disabled"}>إعادة إصدار كل الحسابات (كلمات جديدة)</button></p>
    <label>إضافة مشرف (الاسم)</label><input id="sn"><p><button id="mkS">إضافة مشرف</button></p>
    <div class="mut">كلمات المرور تظهر مرة واحدة بعد الإنشاء مع زر تنزيل CSV. احفظها فورًا ووزّعها. كل مستخدم يقدر يغيّر كلمته بزر «كلمة المرور».</div><div id="cr"></div></div>
    <div class="card tw"><table><tr><th>الدور</th><th>الاسم</th><th>اسم الدخول</th><th></th></tr>${us.sort((a, b) => a.login > b.login ? 1 : -1).map(u => `<tr><td>${u.role}</td><td>${esc(u.name)}</td><td dir="ltr">${esc(u.login || "")}</td><td>${u.role === "admin" ? "" : `<button class="ghost" data-re="${u.id}">إعادة إصدار</button>`}</td></tr>`).join("")}</table></div>
    <div class="mut">«إعادة إصدار» لو حد نسي كلمته: يعطّل الحساب القديم وينشئ حسابًا جديدًا باسم دخول جديد وكلمة جديدة.</div>`;
    const show2 = out => { if (!out.length) return; $("#cr").innerHTML = `<div class="card"><b>احفظ الآن:</b><div class="tw"><table><tr><th>الاسم</th><th>الدخول</th><th>كلمة المرور</th></tr>${out.map(r => `<tr><td>${esc(r.name)}</td><td dir="ltr">${r.login}</td><td dir="ltr">${r.pw}</td></tr>`).join("")}</table></div><p><button id="dl">تنزيل CSV</button></p></div>`; $("#dl").onclick = () => csvDl(out); };
    $("#mkU").onclick = async () => { $("#mkU").disabled = true; const out = [];
      for (const u of miss) { try { out.push(await mk("unit" + u.id, "unit", u.name, u.id)); } catch (e) { $("#cr").innerHTML = `<div class="card bad">فشل عند ${esc(u.name)}: ${esc(e.code || e.message)}</div>`; break; } }
      if (out.length) { show2(out); csvDl(out); toast("تم إنشاء " + out.length + " حساب وتنزيل الملف"); } else $("#mkU").disabled = false; };
    $("#reAll").onclick = async () => { if (!confirm("سيتم تعطيل كل الحسابات الحالية (عدا الإدارة) وإنشاء حسابات جديدة بكلمات جديدة. متأكد؟")) return;
      $("#reAll").disabled = true; const out = [], olds = us.filter(u => u.role !== "admin");
      for (const u of olds) { try { const base = (u.login || (u.role === "unit" ? "unit" + u.unit : "sup")).replace(/(-r\d+)+$/, "");
          const r = await mk(base + "-r" + Math.floor(Math.random() * 900 + 100), u.role, u.name, u.unit); out.push(r); await deleteDoc(doc(db, "users", u.id)); }
        catch (e) { $("#cr").innerHTML = `<div class="card bad">فشل عند ${esc(u.name)}: ${esc(e.code || e.message)}</div>`; break; } }
      if (out.length) { show2(out); csvDl(out); toast("تم إصدار " + out.length + " حساب وتنزيل الملف"); } $("#reAll").disabled = false; };
    $("#mkS").onclick = async () => { const n = $("#sn").value.trim(); if (!n) return toast("اكتب اسم المشرف");
      const k = us.filter(u => u.role === "supervisor").length + 1; try { show2([await mk("sup" + k + "_" + Math.floor(Math.random() * 90 + 10), "supervisor", n)]); } catch (e) { toast(e.code || e.message); } };
    $("#ab").onclick = async e => { const id = e.target.dataset.re; if (!id) return; const u = us.find(x => x.id === id); if (!confirm("إعادة إصدار حساب " + u.name + "؟")) return;
      try { const nl = (u.login || "x").replace(/_\d+$/, "").replace(/-r\d+$/, "") + "-r" + Math.floor(Math.random() * 900 + 100);
        const r = await mk(nl, u.role, u.name, u.unit); await deleteDoc(doc(db, "users", id)); await accounts(); show2([r]); } catch (er) { toast(er.code || er.message); } };
  }
  const show = t => { if (t === "a") { document.querySelectorAll(".tabs button").forEach(b => b.classList.toggle("on", b.dataset.t === "a")); $("#ab").className = ""; return accounts(); } $("#ab").className = ""; $("#ab").onclick = geoDel; $("#ab").innerHTML = views[t](); document.querySelectorAll(".tabs button").forEach(b => b.classList.toggle("on", b.dataset.t === t)); };
  document.querySelector(".tabs").onclick = e => { const t = e.target.dataset.t; if (t) show(t); };
  const geoDel = async e => { const id = e.target.dataset.del; if (!id || !confirm("مسح موقع هذه الوحدة؟")) return; await deleteDoc(doc(db, "unitGeo", id)); delete geo[id]; show("g"); };
  show("s");
}
