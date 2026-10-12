import { UNITS } from "./units.js";
import { NEEDS, SITES } from "./data.js";
export { UNITS, NEEDS, SITES };
export const START = "2026-10-25", MIN_DATE = "2026-10-01", SURVEY_GOAL = 95;
export const ITEMS = [["vials", "طعوم (زجاجات)"], ["ad", "سرنجات حقن 0.5 مل"], ["dil", "سرنجات إذابة 5 مل"], ["box", "صناديق أمان"], ["car", "حوامل طعوم"], ["pack", "أكياس تبريد"], ["kit", "مستلزمات الآثار الجانبية"], ["book", "كراسات الحملة"]];
export const PROBS = [["cold", "مشكلة في سلسلة التبريد"], ["stock", "نقص في الطعوم أو المستلزمات"], ["teams", "نقص أو غياب في الفرق"], ["safety", "مخالفة في سلامة الحقن"], ["waste", "مخالفة في التخلص الآمن من النفايات"], ["records", "أخطاء في التسجيل"]];
export const PROB_NAME = Object.fromEntries(PROBS);
export const REASONS = [["ref", "رفض الأهل"], ["abs", "غياب الطفل"], ["unaw", "لم يعلموا بالحملة"], ["sick", "مانع صحي"], ["oth", "أسباب أخرى"]];
export const CHECKS = [
  ["u1", "وحدة", "المسؤولون عن خروج الفرق والاتصال بالمنسقين محدّدون"], ["u2", "وحدة", "المسؤول عن السيارات لتوزيع ونقل الفرق محدّد"], ["u3", "وحدة", "تمت مراجعة خطة إشراف المديرية/الإدارة/الوحدة"],
  ["u4", "وحدة", "عدد السيارات كافٍ لنقل الفرق"], ["u5", "وحدة", "يوجد بيان بطعوم الحملة على ثلاجة التطعيمات"], ["u6", "وحدة", "تتم مطابقة البلاغات بحركة الطعوم اليومية"],
  ["t1", "فريق", "كمية الطعوم والمستلزمات كافية للمستهدف اليومي للفريق"], ["t2", "فريق", "الطعوم والمذيبات موضوعة في الكولمن بطريقة صحيحة"], ["t3", "فريق", "يوجد كولمن إضافي يُستخدم كثلاجة للفريق"],
  ["t4", "فريق", "الممرضة تذيب الطعوم بطريقة صحيحة"], ["t5", "فريق", "الممرضة تحقن بطريقة صحيحة"], ["t6", "فريق", "التخلص من النفايات بطريقة آمنة"], ["t7", "فريق", "التنسيق والدعاية كافيان أثناء العمل بالنقاط الثابتة"]];
export const CHECK_NAME = Object.fromEntries(CHECKS.map(c => [c[0], c[2]]));
export const SITE_ST = { none: "لم تُزَر", done: "تم", revisit: "إعادة زيارة" };
export const LABELS = {
  eg1: "مصريون - من 9 شهور إلى أقل من سنة", eg2: "مصريون - من سنة إلى أقل من 5 سنوات", eg3: "مصريون - من 5 سنوات إلى 10 سنوات",
  ne1: "غير مصريين - من 9 شهور إلى أقل من سنة", ne2: "غير مصريين - من سنة إلى أقل من 5 سنوات", ne3: "غير مصريين - من 5 سنوات إلى 10 سنوات",
  fs: "مواقع ثابتة عملت اليوم", fc: "مطعّمون في المواقع الثابتة", sv: "مدارس ومعاهد تمت زيارتها", sc: "مطعّمون في المدارس والمعاهد",
  nv: "حضانات تمت زيارتها", nc: "مطعّمون في الحضانات", missed: "متخلفون عن التطعيم", mvac: "المتطعمون من المتخلفين", side: "آثار جانبية خطيرة (عدد الحالات)",
  teams: "فرق عملت اليوم", recv: "زجاجات وصلت اليوم", used: "زجاجات استُهلكت اليوم", dmg: "منها تالفة أو مفقودة" };
export const FIELDS = Object.keys(LABELS);
export const AGE = ["eg1", "eg2", "eg3", "ne1", "ne2", "ne3"];
export const num = v => { v = Number(v); return isFinite(v) ? v : 0; };
export const total = r => AGE.reduce((s, k) => s + num(r[k]), 0);
export const TOTAL_TARGET = UNITS.reduce((s, u) => s + u.target, 0), TOTAL_TEAMS = UNITS.reduce((s, u) => s + u.teams, 0);
export const unitById = id => UNITS.find(u => u.id === +id) || { id: +id, name: "وحدة " + id, teams: 0, target: 0 };
export const SITES_BY_UNIT = {}; SITES.forEach(s => (SITES_BY_UNIT[s[0]] = SITES_BY_UNIT[s[0]] || []).push(s));
export const nf = n => Math.round(num(n)).toLocaleString("en-US");
export const pct = x => (isFinite(x) ? Math.round(x) : 0) + "%";
export const pad = n => String(n).padStart(2, "0");
export const isoOf = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
export const fmtD = iso => { try { return new Date(iso + "T00:00:00").toLocaleDateString("ar-EG", { day: "numeric", month: "long" }); } catch (e) { return iso; } };
export const dayDiff = (a, b) => Math.round((new Date(a + "T00:00:00") - new Date(b + "T00:00:00")) / 864e5);
export function haversine(a, b) { const R = 6371000, r = x => x * Math.PI / 180, dLa = r(b.lat - a.lat), dLo = r(b.lng - a.lng);
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLo / 2) ** 2; return Math.round(2 * R * Math.asin(Math.sqrt(h))); }
export const rateOf = (kids, vials) => vials > 0 ? Math.round(kids / vials * 10) / 10 : null;
export const wasteOf = p => p.used > 0 ? Math.max(0, (p.used * 10 - p.cum) / (p.used * 10) * 100) : null;

/* reports: array of docs. returns {list:[per-unit], per:{id:..}} */
export function calc(reports, ref) {
  const per = {}; UNITS.forEach(u => per[u.id] = { u, rep: false, dd: {}, cum: 0, recv: 0, used: 0, dmg: 0, side: 0, day: 0, missed: 0, mvac: 0 });
  reports.forEach(r => { const p = per[r.unit]; if (!p || r.date > ref) return;
    p.cum += total(r); p.recv += num(r.recv); p.used += num(r.used); p.dmg += num(r.dmg); p.side += num(r.side); p.missed += num(r.missed); p.mvac += num(r.mvac);
    if (r.date === ref) { p.rep = true; p.dd = r; p.day = total(r); } });
  return { per, list: UNITS.map(u => per[u.id]) };
}
const names = a => a.slice(0, 10).join("، ") + (a.length > 10 ? " وغيرها" : "");
export function stockInfo(reports, ref) {
  const by = {}; reports.forEach(r => { if (r.date <= ref) (by[r.unit] = by[r.unit] || []).push(r); });
  const out = {};
  UNITS.forEach(u => { const L = (by[u.id] || []).sort((a, b) => a.date.localeCompare(b.date)); if (!L.length) return;
    const recv = L.reduce((s, r) => s + num(r.recv), 0), used = L.reduce((s, r) => s + num(r.used), 0), last = L.slice(-3), avg = last.reduce((s, r) => s + num(r.used), 0) / last.length, bal = recv - used;
    out[u.id] = { bal, avg, recv, days: avg > 0 ? bal / avg : null }; });
  return out; }
export function stockFlag(s) {
  if (!s || s.recv <= 0) return null; if (s.bal < 0) return { cls: "bad", t: "رصيد طعوم سالب" };
  if (s.days !== null && s.days < 1) return { cls: "bad", t: "الطعوم تكفي أقل من يوم" };
  if (s.days !== null && s.days < 2) return { cls: "warn", t: "الطعوم تكفي حوالي " + (Math.round(s.days * 10) / 10) + " يوم" }; return null; }
export const CAMPAIGN_DAYS = 14;
export const dayDate = i => { const t = new Date(START + "T00:00:00"); t.setDate(t.getDate() + i); return isoOf(t); };
export const END = dayDate(CAMPAIGN_DAYS - 1);
export const campaignDay = ref => ref < START ? 0 : Math.min(CAMPAIGN_DAYS, dayDiff(ref, START) + 1);
export function rankRows(list, ref) { const el = ref >= START ? dayDiff(ref, START) + 1 : 0, left = Math.max(1, CAMPAIGN_DAYS - el);
  return list.map(p => { const pc = p.u.target ? p.cum / p.u.target * 100 : 0, avg = p.cum / Math.max(1, el), rem = Math.max(0, p.u.target - p.cum); return { p, pc, avg, rem, need: Math.ceil(rem / left), days: avg > 0 ? Math.ceil(rem / avg) : null }; }); }
/* نماذج الوزارة: صفوف الأيام 1..14. unitSet = Set أرقام الوحدات أو null لكل المنشاة */
export function dayTable(reports, unitSet, todayIso) {
  const K = AGE.concat(["missed", "mvac", "side"]), by = {}; let preR = 0, preU = 0;
  reports.forEach(r => { if (unitSet && !unitSet.has(+r.unit)) return; if (r.date < START) { preR += num(r.recv); preU += num(r.used); return; }
    const o = by[r.date] || (by[r.date] = { recv: 0, used: 0 }); K.forEach(k => o[k] = (o[k] || 0) + num(r[k])); o.recv += num(r.recv); o.used += num(r.used); });
  const cum = { tot: 0 }; K.forEach(k => cum[k] = 0); let cr = preR, cu = preU; const rows = [];
  for (let i = 0; i < CAMPAIGN_DAYS; i++) { const date = dayDate(i), o = by[date] || {}, day = {}; K.forEach(k => { day[k] = o[k] || 0; cum[k] += day[k]; });
    day.tot = AGE.reduce((s, k) => s + day[k], 0); cum.tot = AGE.reduce((s, k) => s + cum[k], 0); cr += o.recv || 0; cu += o.used || 0;
    rows.push({ n: i + 1, date, show: date <= todayIso, day: Object.assign({}, day), cum: Object.assign({}, cum), recv: o.recv || 0, used: o.used || 0, rem: cr - cu, rate: (o.used || 0) > 0 ? rateOf(day.tot, o.used) : null }); }
  return rows; }
export function alertsFor(list, ref, today, sites, visits, reports) {
  const a = [];
  if (ref >= START && ref <= today) { const miss = list.filter(p => !p.rep).map(p => p.u.name);
    if (miss.length) a.push({ cls: ref < today ? "bad" : "warn", t: miss.length + " وحدة لم تسجّل تقرير " + (ref === today ? "اليوم" : fmtD(ref)), x: names(miss) }); }
  const SI = stockInfo(reports || [], ref), bad = [], warn = [], hw = []; let side = 0;
  list.forEach(p => { side += p.side; const f = stockFlag(SI[p.u.id]);
    if (f) (f.cls === "bad" ? bad : warn).push(p.u.name + " (" + nf(SI[p.u.id].bal) + " زجاجة)");
    const w = wasteOf(p); if (p.used >= 3 && w !== null && w > 20) hw.push(p.u.name + " " + pct(w)); });
  if (bad.length) a.push({ cls: "bad", t: "الطعوم على وشك النفاد (أقل من يوم) أو سالبة في " + bad.length + " وحدة", x: names(bad) });
  if (warn.length) a.push({ cls: "warn", t: "رصيد الطعوم يكفي أقل من يومين في " + warn.length + " وحدة", x: names(warn) });
  if (hw.length) a.push({ cls: "warn", t: "فاقد طعوم مرتفع (أكثر من 20%) في " + hw.length + " وحدة", x: names(hw) });
  const rv = sites.filter(s => s.status === "revisit").length; if (rv) a.push({ cls: "warn", t: rv + " موقع (مدرسة أو حضانة) يحتاج إعادة زيارة", x: "التفاصيل في تبويب المواقع." });
  if (side) a.push({ cls: "info", t: "آثار جانبية مسجّلة: " + nf(side) + " حالة", x: "" });
  if (ref >= START) { const seen = {}; visits.forEach(v => seen[v.unit] = 1); const nv = UNITS.filter(u => !seen[u.id]).length; if (nv) a.push({ cls: "info", t: nv + " وحدة بدون زيارة إشرافية حتى الآن", x: "" }); }
  return a;
}
export function reportText(list, ref) {
  const D = {}; FIELDS.forEach(k => D[k] = 0); let cum = 0, repN = 0; const miss = [];
  list.forEach(p => { cum += p.cum; if (p.rep) repN++; else miss.push(p.u.name); FIELDS.forEach(k => D[k] += num(p.dd[k])); });
  const dayT = AGE.reduce((s, k) => s + D[k], 0), L = []; let cMiss = 0, cMv = 0, cSide = 0, cUsed = 0; list.forEach(p => { cMiss += p.missed; cMv += p.mvac; cSide += p.side; cUsed += p.used; });
  const r1 = rateOf(dayT, D.used), r2 = rateOf(cum, cUsed);
  L.push("بلاغ حملة التطعيم ضد الحصبة والحصبة الألمانية (MR)", "إدارة المنشاة الصحية · يوم " + fmtD(ref), "",
    "إجمالي المطعّمين اليوم: " + nf(dayT),
    "المصريون: " + nf(D.eg1) + " (9 شهور–أقل من سنة) | " + nf(D.eg2) + " (سنة–أقل من 5) | " + nf(D.eg3) + " (5–10 سنوات)",
    "غير المصريين: " + nf(D.ne1) + " | " + nf(D.ne2) + " | " + nf(D.ne3),
    "مواقع ثابتة: عمل " + nf(D.fs) + " موقع، مطعّمون " + nf(D.fc),
    "مدارس ومعاهد: زيارة " + nf(D.sv) + "، مطعّمون " + nf(D.sc),
    "حضانات: زيارة " + nf(D.nv) + "، مطعّمون " + nf(D.nc),
    "فرق عملت: " + nf(D.teams) + " من " + TOTAL_TEAMS,
    "المتخلفون عن التطعيم: اليوم " + nf(D.missed) + " | حتى اليوم " + nf(cMiss),
    "المتطعمون من المتخلفين: اليوم " + nf(D.mvac) + " | حتى اليوم " + nf(cMv),
    "آثار جانبية خطيرة: اليوم " + nf(D.side) + " | حتى اليوم " + nf(cSide),
    "الطعوم (زجاجات): وصل " + nf(D.recv) + " | استُهلك " + nf(D.used) + " | تالف " + nf(D.dmg) + " | المتبقي (تراكمي) " + nf(list.reduce((s, p) => s + p.recv - p.used, 0)),
    "معدل الزجاجة (أطفال/زجاجة): اليوم " + (r1 === null ? "—" : r1) + " | حتى اليوم " + (r2 === null ? "—" : r2), "",
    "الإجمالي التراكمي: " + nf(cum) + " من " + nf(TOTAL_TARGET) + " (" + pct(cum / TOTAL_TARGET * 100) + ")",
    "وحدات سجّلت: " + repN + " من " + UNITS.length);
  if (miss.length) L.push("لم تسجّل: " + miss.join("، "));
  return L.join("\n");
}
/* visits: array; reports: array; geo: {unit:{lat,lng}} */
export function analyzeVisits(visits, reports, geo, maxDist) {
  const arr = visits.slice().sort((a, b) => ((b.date || "") + (b.ts || "")).localeCompare((a.date || "") + (a.ts || "")));
  const out = arr.map(v => ({ v, flags: [] }));
  out.forEach(o => { const v = o.v, u = unitById(v.unit); let rv = 0, us = 0, hasDay = false;
    reports.forEach(r => { if (+r.unit !== +v.unit) return; if (r.date <= v.date) { rv += num(r.recv); us += num(r.used); } if (r.date === v.date) hasDay = true; });
    if (typeof v.temp === "number" && (v.temp < 2 || v.temp > 8)) o.flags.push({ c: "bad", t: "حرارة الثلاجة " + v.temp + "°م خارج 2–8" });
    if (typeof v.vials === "number") { if (rv > 0) { const bal = rv - us, diff = v.vials - bal; if (Math.abs(diff) > Math.max(2, Math.round(Math.abs(bal) * 0.1))) o.flags.push({ c: "warn", t: "عدّ الزجاجات " + nf(v.vials) + " يختلف عن رصيد تسجيل الوحدة " + nf(bal) }); } else o.flags.push({ c: "info", t: "الوحدة لم تسجّل وارد طعوم للمقارنة" }); }
    if (typeof v.teams === "number" && u.teams && v.teams < Math.ceil(u.teams / 2)) o.flags.push({ c: "warn", t: "فرق موجودة " + v.teams + " من " + u.teams + " مخططة" });
    const g = geo[v.unit]; o.dist = g && v.loc ? haversine(v.loc, g) : null;
    if (!v.loc) o.flags.push({ c: "bad", t: "بدون موقع" }); else if (o.dist == null) o.flags.push({ c: "info", t: "موقع الوحدة غير مسجّل للمقارنة" }); else if (o.dist > maxDist) o.flags.push({ c: "bad", t: "بعيد " + nf(o.dist) + " م عن الوحدة" });
    if (v.loc && v.loc.acc > 200) o.flags.push({ c: "info", t: "دقة الموقع ضعيفة (" + v.loc.acc + " م)" });
    if (v.date >= START && !hasDay) o.flags.push({ c: "info", t: "لا يوجد تقرير للوحدة في يوم الزيارة" });
    const late = v.ts ? dayDiff(isoOf(new Date(v.ts)), v.date) : 0; if (late >= 2) o.flags.push({ c: "info", t: "سُجّلت بعد الزيارة بـ " + late + " يوم" }); });
  const by = {}; out.forEach(o => { if (o.v.uid && o.v.ts) (by[o.v.uid] = by[o.v.uid] || []).push(o); });
  Object.keys(by).forEach(k => { const L = by[k].slice().sort((a, b) => new Date(a.v.ts) - new Date(b.v.ts));
    L.forEach((o, i) => { const seen = {}; let n = 0, j; for (j = i; j < L.length && (new Date(L[j].v.ts) - new Date(o.v.ts)) <= 15 * 60000; j++) if (!seen[L[j].v.unit]) { seen[L[j].v.unit] = 1; n++; }
      if (n >= 3) for (j = i; j < L.length && (new Date(L[j].v.ts) - new Date(o.v.ts)) <= 15 * 60000; j++) if (!L[j]._b) { L[j]._b = 1; L[j].flags.push({ c: "warn", t: "3 وحدات أو أكثر سُجّلت خلال 15 دقيقة" }); } }); });
  return out;
}
export function surveyAgg(survey, reports) {
  const rc = {}; reports.forEach(r => rc[r.unit] = (rc[r.unit] || 0) + total(r));
  const agg = {}, why = {}; let S = 0, V = 0;
  survey.forEach(x => { const a = agg[x.unit] || (agg[x.unit] = { s: 0, v: 0 }); a.s += num(x.sampled); a.v += num(x.vacc); S += num(x.sampled); V += num(x.vacc); REASONS.forEach(r => why[r[0]] = (why[r[0]] || 0) + num(x[r[0]])); });
  return { agg, why, S, V, rc };
}
export function supState(unit, dd) { const n = NEEDS[unit] || [];  let any = false, all = true;
  ITEMS.forEach((it, i) => { const v = num(dd && dd[it[0]]); if (v > 0) any = true; if (v < n[i]) all = false; }); return all && any ? "full" : any ? "part" : "none"; }
