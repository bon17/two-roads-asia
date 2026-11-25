"use strict";
/* ============================================================
   역사 티볼 리그 — 학생 화면과 교사(TV) 화면이 한 파일에 있다.
   주소 끝에 #host 가 있으면 교사 화면, 없으면 학생 화면.
   ============================================================ */
const $ = s => document.querySelector(s);
const IS_HOST = location.hash === "#host" || new URLSearchParams(location.search).has("host");
const LIMITS = [10, 15, 20, 30];   // 선생님이 고르는 문제 시간(초)
const ORDER_BONUS = 5;            // 순서 문제는 5초 더
const QS = window.QUESTIONS || [];
const QBY = Object.fromEntries(QS.map(q => [q.id, q]));
const IMG = n => (window.__IMG && window.__IMG[n]) || ("img/" + n + ".webp");
document.querySelectorAll("[data-img]").forEach(e => { e.src = IMG(e.dataset.img); });
const IS_TEST = new URLSearchParams(location.search).has("test");
const IN_FRAME = window.top !== window;

const TEAM = {
  // 내부 키(cn=빨강, jp=파랑)는 저장 데이터용이라 그대로 두고, 화면 이름만 바꾼다.
  cn: { name: "불꽃팀", short: "불꽃", cls: "cn", img: "team_cn" },
  jp: { name: "파도팀", short: "파도", cls: "jp", img: "team_jp" },
};
const other = t => (t === "cn" ? "jp" : "cn");
const VERDICT = {
  out:  { t: "아웃!", n: 0 },
  "1B": { t: "안타!", n: 1 },
  "2B": { t: "2루타!", n: 2 },
  "3B": { t: "3루타!", n: 3 },
  HR:   { t: "홈런!", n: 4 },
  void: { t: "판정 무효!", n: 0 },
};
const isHit = v => v === "1B" || v === "2B" || v === "3B" || v === "HR";
const TCARDS = {
  consul: { name: "영사 재판권", img: "card_consul", effect: "상대 안타를 무효로!", need: "상대가 안타를 쳤을 때",
    right: "상대 나라 사람이 죄를 지어도 그 나라 영사가 재판한다",
    wrong: ["다른 나라가 받는 좋은 조건을 저절로 똑같이 받는다", "수입품에 매기는 세금을 혼자 정하지 못한다"] },
  tariff: { name: "관세 협의", img: "card_tariff", effect: "상대 점수 1점 가져오기", need: "상대 점수가 1점 이상일 때",
    right: "수입품에 매기는 세금(관세)을 혼자 정하지 못한다",
    wrong: ["상대 나라 사람이 죄를 지어도 그 나라 영사가 재판한다", "항구 5개를 열고 공행을 없앤다"] },
  mfn:    { name: "최혜국 대우", img: "card_mfn", effect: "다음 공격 때 우리도 주자 1명", need: "상대가 안타를 쳤을 때",
    right: "상대가 다른 나라에 주는 좋은 조건을 우리도 저절로 똑같이 받는다",
    wrong: ["수입품에 매기는 세금을 혼자 정하지 못한다", "상대 나라 군대가 수도에 머물 수 있다"] },
};
const CARD_KEYS = ["consul", "tariff", "mfn"];

/* ---------- 작은 도구 ---------- */
function hashStr(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function shuffled(arr, seed) { const r = rng(seed), a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function mk(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function show(id, on) { const e = typeof id === "string" ? $(id) : id; if (e) e.classList.toggle("hidden", !on); }
// 연습/테스트 모드와 실제 수업(Firebase)의 저장 공간을 나눈다(실제 방 번호를 덮어쓰지 않게).
const NS = () => (new URLSearchParams(location.search).has("local") || !window.FIREBASE_CONFIG) ? "tball-local:" : "tball:";
const store = {
  get(k, d) { try { const v = localStorage.getItem(NS() + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(NS() + k, JSON.stringify(v)); } catch (e) { } },
};
function correctText(q) {
  if (q.type === "mc") return q.options[q.answer];
  if (q.type === "ox") return q.answer;
  return q.items.join(" → ");
}

/* ---------- 소리 ---------- */
let ac = null;
function tone(f, d, type = "sine", v = .15, slide = 0, delay = 0) {
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + delay;
    o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(f * slide, t + d);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + d);
    o.connect(g).connect(ac.destination); o.start(t); o.stop(t + d);
  } catch (e) { }
}
const SND = {
  hit() { tone(900, .08, "square", .2, .4); [523, 659, 784].forEach((f, i) => tone(f, .25, "triangle", .14, 0, .12 + i * .1)); },
  hr() { tone(900, .08, "square", .2, .4); [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, .3, "triangle", .16, 0, .12 + i * .11)); },
  out() { tone(220, .35, "sawtooth", .1, .6); },
  card() { tone(660, .15, "square", .1, 1.5); tone(990, .2, "sine", .12, 1, .12); },
  start() { tone(440, .12, "sine", .12); tone(660, .15, "sine", .12, 1, .12); },
};

/* ============================================================
   데이터 연결: Firebase(실제 수업) 또는 연습 모드(같은 브라우저 탭끼리)
   ============================================================ */
function LocalDB() {
  // 값 하나하나를 localStorage의 키 하나로 저장한다(탭 여러 개가 동시에 써도 서로 덮어쓰지 않게).
  const PRE = "tbdb:";
  let listeners = [], timer = null;
  const norm = p => p.split("/").filter(Boolean).join("/");
  const keysUnder = p => { const out = [], k0 = PRE + p; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k === k0 || k.startsWith(k0 + "/")) out.push(k); } return out; };
  const toArr = o => { if (o && typeof o === "object") { for (const k in o) o[k] = toArr(o[k]); const ks = Object.keys(o); if (ks.length && ks.every((k, i) => k === String(i))) return ks.map(k => o[k]); } return o; };
  function read(p) {
    p = norm(p); let root;
    for (const k of keysUnder(p)) {
      const rel = k.slice((PRE + p).length).split("/").filter(Boolean);
      let v; try { v = JSON.parse(localStorage.getItem(k)); } catch (e) { continue; }
      if (!rel.length) return v;
      if (root === undefined || typeof root !== "object") root = {};
      let o = root; for (let i = 0; i < rel.length - 1; i++) { if (typeof o[rel[i]] !== "object" || o[rel[i]] === null) o[rel[i]] = {}; o = o[rel[i]]; }
      o[rel[rel.length - 1]] = v;
    }
    return root === undefined ? null : toArr(root);
  }
  function write(p, v) {
    p = norm(p);
    for (const k of keysUnder(p)) localStorage.removeItem(k);
    const walk = (path, val) => {
      if (val === null || val === undefined) return;
      if (typeof val === "object") { for (const k of Object.keys(val)) walk(path + "/" + k, val[k]); }
      else localStorage.setItem(PRE + path, JSON.stringify(val));
    };
    walk(p, v);
  }
  const notify = () => {
    for (const l of listeners.slice()) { const v = read(l.p), s = JSON.stringify(v); if (s !== l.last) { l.last = s; l.cb(JSON.parse(s)); } }
  };
  const soon = () => { clearTimeout(timer); timer = setTimeout(notify, 30); };
  window.addEventListener("storage", e => { if (!e.key || e.key.startsWith(PRE)) soon(); });
  return {
    mode: "local", uid: "local",
    async set(p, v) { write(p, v); notify(); },
    async update(p, o) { for (const k in o) write(p + "/" + k, o[k]); notify(); },
    async get(p) { return read(p); },
    async remove(p) { write(p, null); notify(); },
    on(p, cb) { const l = { p, cb, last: undefined }; listeners.push(l); setTimeout(notify, 0); return () => { listeners = listeners.filter(x => x !== l); }; },
    presence() { return () => { }; },
    now() { return Date.now(); },
  };
}
async function FirebaseDB(cfg) {
  const F = window.FB;
  const app = F.initializeApp(cfg), auth = F.getAuth(app);
  await F.signInAnonymously(auth);
  const db = F.getDatabase(app); let offset = 0;
  F.onValue(F.ref(db, ".info/serverTimeOffset"), s => { offset = s.val() || 0; });
  return {
    mode: "firebase", uid: auth.currentUser.uid,
    set: (p, v) => F.set(F.ref(db, p), v),
    update: (p, o) => F.update(F.ref(db, p), o),
    get: async p => (await F.get(F.ref(db, p))).val(),
    remove: p => F.remove(F.ref(db, p)),
    on: (p, cb) => F.onValue(F.ref(db, p), s => cb(s.val())),
    presence(p) {
      const r = F.ref(db, p);
      const un = F.onValue(F.ref(db, ".info/connected"), s => { if (s.val()) { F.onDisconnect(r).set(false); F.set(r, true); } });
      return () => { un(); F.onDisconnect(r).cancel(); };
    },
    now: () => Date.now() + offset,
  };
}
const FORCE_LOCAL = new URLSearchParams(location.search).has("local");
function withTimeout(p, ms, msg) { return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(msg)), ms))]); }
function explain(e) {
  const m = String((e && (e.code || e.message)) || e);
  if (/admin-restricted|operation-not-allowed/.test(m)) return "Firebase에서 '익명 로그인'이 꺼져 있어요. 안내서 2단계를 확인해 주세요.";
  if (/permission|PERMISSION_DENIED/i.test(m)) return "Firebase 규칙이 막고 있어요. 안내서 3단계의 규칙을 그대로 붙여 넣고 '게시'했는지 확인해 주세요.";
  if (/network|timeout|시간/i.test(m)) return "Firebase 서버에 닿지 않아요. 인터넷 연결이나 학교 네트워크 차단을 확인해 주세요.";
  return "Firebase 연결 오류: " + m;
}
async function connect() {
  if (window.FIREBASE_CONFIG && window.FB && !FORCE_LOCAL) {
    const db = await withTimeout(FirebaseDB(window.FIREBASE_CONFIG), 12000, "timeout: 로그인 서버 응답 없음");
    await withTimeout(db.get("rooms/0000/meta"), 12000, "timeout: 데이터베이스 응답 없음");  // 연결과 규칙을 함께 확인
    return db;
  }
  if (!IS_HOST) show("#modeBanner", true);   // 교사 화면은 아래 조작 줄에 따로 표시
  return LocalDB();
}

/* 상태를 늘 같은 모양으로 (Firebase는 빈 배열·빈 객체를 지운다) */
function normState(s) {
  s = s || {};
  const cards = t => Object.assign({ consul: 0, tariff: 0, mfn: 0 }, (s.cards || {})[t] || {});
  return {
    phase: s.phase || "lobby", started: !!s.started, practice: !!s.practice,
    inning: s.inning || 1, half: s.half || 0, outs: s.outs || 0,
    bases: [0, 1, 2].map(i => ((s.bases || [])[i] ? 1 : 0)),
    score: { cn: (s.score || {}).cn || 0, jp: (s.score || {}).jp || 0 },
    pitchNo: s.pitchNo || 0, q: s.q || null, result: s.result || null,
    captain: { cn: (s.captain || {}).cn || "", jp: (s.captain || {}).jp || "" },
    cards: { cn: cards("cn"), jp: cards("jp") },
    cardPlay: s.cardPlay || null, pending: { cn: (s.pending || {}).cn || 0, jp: (s.pending || {}).jp || 0 },
    finalReq: !!s.finalReq, asked: Object.values(s.asked || {}), prev: s.prev || null,
    msg: s.msg || "", final: s.final || null, limit: LIMITS.includes(s.limit) ? s.limit : 15,
  };
}
const offenseOf = st => (st.half === 0 ? "cn" : "jp");
const ansKey = st => (st.practice ? "x" : "p") + st.pitchNo;

/* ============================================================
   교사(TV) 화면 — 경기 진행의 기준(모든 판정은 여기서)
   ============================================================ */
const H = { db: null, code: "", st: normState(null), players: {}, answers: {}, unAns: null, order: [], busy: false };

async function hostMain() {
  show("#host", true);
  try { await hostStart(); }
  catch (e) {
    $("#hCode").textContent = "연결 실패";
    $("#hUrl").textContent = explain(e);
    $("#hUrl").style.cssText = "font-size:1.6em;color:#d62828;opacity:1";
  }
}
async function hostStart() {
  H.db = await connect();
  // 방 번호: 이 브라우저가 만든 방이 있으면 이어서, 없으면 새로
  let code = store.get("hostRoom", "");
  if (code) {
    const meta = await H.db.get(`rooms/${code}/meta`);
    if (!meta || meta.host !== H.db.uid) code = "";
  }
  if (!code) {
    for (let i = 0; i < 20; i++) {
      const c = String(1000 + Math.floor(Math.random() * 9000));
      if (!(await H.db.get(`rooms/${c}/meta`))) { code = c; break; }
    }
    await H.db.set(`rooms/${code}/meta`, { host: H.db.uid, createdAt: H.db.now() });
    await H.db.set(`rooms/${code}/state`, { phase: "lobby" });
    store.set("hostRoom", code);
  }
  H.code = code;
  H.order = shuffled(QS.map(q => q.id), hashStr(code + ":" + Date.now()));
  renderJoin();
  H.db.on(`rooms/${code}/state`, v => { H.st = normState(v); watchAnswers(); renderHost(); });
  H.db.on(`rooms/${code}/players`, v => { H.players = Object.fromEntries(Object.entries(v || {}).filter(([, p]) => p && p.joinedAt)); assignTeams(); renderHost(); });
  H.db.on(`rooms/${code}/cardReq`, v => { if (v) handleCardReq(v); });
  setInterval(hostTick, 250);
  setupRules();
  setTimeout(() => { if (H.st.phase === "lobby" && !IN_FRAME) openRules(0); }, 700);
}
const R = p => `rooms/${H.code}/${p}`;
async function putState(patch) {
  Object.assign(H.st, patch);
  const s = H.st;
  await H.db.set(R("state"), JSON.parse(JSON.stringify(Object.assign({}, s, { asked: s.asked.length ? s.asked : null }))));
}

function teamList(t) { return Object.entries(H.players).filter(([, p]) => p.team === t).map(([id, p]) => ({ id, ...p })); }
function present(t) { return teamList(t).filter(p => p.online !== false); }

async function assignTeams() {
  // 새로 들어온 학생: 인원이 적은 팀으로, 같으면 무작위
  const ups = {};
  let cn = teamList("cn").length, jp = teamList("jp").length;
  const fresh = Object.entries(H.players).filter(([, p]) => !p.team).sort((a, b) => (a[1].joinedAt || 0) - (b[1].joinedAt || 0));
  for (const [id] of fresh) {
    const t = cn < jp ? "cn" : jp < cn ? "jp" : (Math.random() < .5 ? "cn" : "jp");
    ups[`${id}/team`] = t; if (t === "cn") cn++; else jp++;
    H.players[id].team = t;
  }
  if (Object.keys(ups).length) await H.db.update(R("players"), ups);
}
function moveTeam(id) {
  const p = H.players[id]; if (!p) return;
  H.db.update(R("players"), { [`${id}/team`]: other(p.team) });
}
async function kickPlayer(id) {
  if (!confirm(`${id} 학생을 내보낼까요?\n그 학생 태블릿은 학번 입력 화면으로 돌아가서 다시 입장해요.`)) return;
  const p = H.players[id];
  await H.db.remove(R(`players/${id}`));
  delete H.players[id];
  // 수비 주장이었으면 같은 팀에서 새로 뽑는다
  const s = H.st;
  if (p && p.team && s.started && s.captain[p.team] === id) await putState({ captain: Object.assign({}, s.captain, { [p.team]: randomCaptain(p.team) }) });
}

function watchAnswers() {
  const key = H.st.q ? ansKey(H.st) : "";
  if (key === H.ansKeyNow) return;
  H.ansKeyNow = key;
  if (H.unAns) { H.unAns(); H.unAns = null; }
  H.answers = {};
  if (key) H.unAns = H.db.on(R("answers/" + key), v => { H.answers = v || {}; renderHost(); });
}

function nextQuestionId() {
  const used = new Set(H.st.asked);
  let id = H.order.find(x => !used.has(x));
  if (id == null) { H.order = shuffled(QS.map(q => q.id), Date.now()); id = H.order[0]; }
  return id;
}
function randomCaptain(t) { const ps = present(t); return ps.length ? ps[Math.floor(Math.random() * ps.length)].id : ""; }

async function startPitch(practice) {
  if (H.busy) return; H.busy = true;
  try {
    const s = H.st, id = nextQuestionId(), now = H.db.now();
    const patch = {
      phase: "pitch", practice: !!practice, pitchNo: s.pitchNo + 1,
      q: { id, startedAt: now, endsAt: now + (s.limit + (QBY[id] && QBY[id].type === "order" ? ORDER_BONUS : 0)) * 1000, seed: Math.floor(Math.random() * 1e9) },
      result: null, cardPlay: null, msg: "",
      prev: { bases: s.bases.slice(), score: Object.assign({}, s.score), outs: s.outs },
      asked: s.asked.concat([id]),
    };
    if (!practice && !s.started) {
      Object.assign(patch, { started: true, inning: 1, half: 0, outs: 0, bases: [0, 0, 0], score: { cn: 0, jp: 0 },
        cards: { cn: { consul: 1, tariff: 1, mfn: 1 }, jp: { consul: 1, tariff: 1, mfn: 1 } },
        pending: { cn: 0, jp: 0 }, captain: { cn: "", jp: randomCaptain("jp") } });
    }
    SND.start();
    await putState(patch);
  } finally { H.busy = false; }
}

function teamStats(t) {
  const total = present(t).length;
  let ans = 0, ok = 0;
  for (const [id, a] of Object.entries(H.answers)) { const p = H.players[id]; if (p && p.team === t) { ans++; if (a.c) ok++; } }
  return { total, ans, ok, acc: total ? ok / total : 0 };
}
function hostTick() {
  const s = H.st;
  if (s.phase !== "pitch" || !s.q || H.busy) { renderTimer(); return; }
  const cn = teamStats("cn"), jp = teamStats("jp");
  const all = cn.total + jp.total > 0 && cn.ans >= cn.total && jp.ans >= jp.total;
  if (H.db.now() >= s.q.endsAt || all) closePitch();
  renderTimer();
}

/* 판정: 공격 정답률이 50% 미만이거나 수비 정답률 이상이면 아웃. 그 밖에는 공격 정답률로 안타 종류. */
function judge(a, d) {
  if (a < .5 || d >= a) return "out";
  if (a >= .95) return "HR";
  if (a >= .85) return "3B";
  if (a >= .70) return "2B";
  return "1B";
}
function advance(bases, n) {
  let runs = 0; const nb = [0, 0, 0];
  for (let i = 2; i >= 0; i--) if (bases[i]) { const to = i + n; if (to >= 3) runs++; else nb[to] = 1; }
  if (n >= 4) runs++; else nb[n - 1] = 1;
  return { bases: nb, runs };
}
async function closePitch() {
  if (H.busy) return; H.busy = true;
  try {
    const s = H.st, off = offenseOf(s), def = other(off);
    const st = { cn: teamStats("cn"), jp: teamStats("jp") };
    const v = judge(st[off].acc, st[def].acc);
    const result = { verdict: v, off, acc: { cn: st.cn.acc, jp: st.jp.acc }, ans: { cn: st.cn.ans, jp: st.jp.ans }, total: { cn: st.cn.total, jp: st.jp.total }, runs: 0 };
    const patch = { phase: "reveal", result };
    if (!s.practice && s.started) {
      if (v === "out") { patch.outs = s.outs + 1; SND.out(); }
      else {
        const a = advance(s.bases, VERDICT[v].n);
        patch.bases = a.bases; result.runs = a.runs;
        patch.score = Object.assign({}, s.score, { [off]: s.score[off] + a.runs });
        if (v === "HR") SND.hr(); else SND.hit();
      }
    } else { v === "out" ? SND.out() : SND.hit(); }
    await putState(patch);
  } finally { H.busy = false; }
}

async function nextAfterReveal() {
  const s = H.st;
  if (s.practice || !s.started) { await putState({ phase: s.started ? "ready" : "lobby", practice: false, q: null, result: null, msg: "" }); return; }
  if (s.outs >= 3) {
    const wasBottom = s.half === 1;
    if (s.finalReq && wasBottom) return finishGame();
    const half = s.half ^ 1, inning = s.inning + (wasBottom ? 1 : 0), off = half === 0 ? "cn" : "jp", def = other(off);
    // 최혜국 대우로 받은 주자를 1루부터 채움
    const bases = [0, 0, 0]; let pend = s.pending[off];
    for (let i = 0; i < 3 && pend > 0; i++) { bases[i] = 1; pend--; }
    const pending = Object.assign({}, s.pending, { [off]: 0 });
    const captain = Object.assign({}, s.captain, { [def]: randomCaptain(def), [off]: "" });
    const got = s.pending[off] ? ` 최혜국 대우로 받은 주자 ${s.pending[off]}명이 나가요.` : "";
    await putState({ phase: "ready", half, inning, outs: 0, bases, pending, captain, q: null, result: null, cardPlay: null,
      msg: `공수 교대! ${TEAM[off].name} 공격.${got}` });
    return;
  }
  return startPitch(false);
}

async function finishGame() {
  const all = (await H.db.get(R("answers"))) || {};
  const per = {}, perQ = [];
  for (const [key, ans] of Object.entries(all)) {
    if (!key.startsWith("p")) continue;
    let n = 0, ok = 0;
    for (const [id, a] of Object.entries(ans || {})) {
      per[id] = per[id] || { id, ok: 0, n: 0, t: 0 };
      per[id].n++; per[id].t += a.t || 0; n++;
      if (a.c) { per[id].ok++; ok++; }
    }
    if (n >= 3) perQ.push({ qid: (ans && Object.values(ans)[0] && Object.values(ans)[0].q) || null, key, wrong: 1 - ok / n });
  }
  const top = Object.values(per).sort((a, b) => b.ok - a.ok || (b.ok / b.n) - (a.ok / a.n) || a.t / a.n - b.t / b.n).slice(0, 3)
    .map(p => ({ id: p.id, ok: p.ok, n: p.n }));
  const missed = perQ.filter(x => x.qid != null).sort((a, b) => b.wrong - a.wrong).slice(0, 3).map(x => ({ qid: x.qid, wrong: Math.round(x.wrong * 100) }));
  const s = H.st;
  const winner = s.score.cn === s.score.jp ? "draw" : (s.score.cn > s.score.jp ? "cn" : "jp");
  await putState({ phase: "over", final: { top, missed, winner }, q: null, result: null });
}

/* 조약 카드 처리 */
function cardAllowed(st, team, card) {
  if (st.phase !== "reveal" || st.practice || !st.started || st.cardPlay || !st.result) return false;
  if (team !== other(offenseOf(st)) || !st.cards[team][card]) return false;
  const off = offenseOf(st);
  if (card === "tariff") return st.score[off] >= 1;
  return isHit(st.result.verdict);
}
async function handleCardReq(req) {
  await H.db.remove(R("cardReq"));
  const s = H.st, team = req.team, card = req.card;
  if (req.pitchNo !== s.pitchNo || req.by !== s.captain[team] || !TCARDS[card] || !cardAllowed(s, team, card)) return;
  const off = offenseOf(s);
  const patch = { cards: JSON.parse(JSON.stringify(s.cards)), cardPlay: { team, card, by: req.by, ok: !!req.ok } };
  patch.cards[team][card] = 0;                         // 맞히든 틀리든 카드는 사용됨
  if (req.ok) {
    SND.card();
    if (card === "consul") {
      patch.bases = s.prev.bases; patch.outs = s.prev.outs;
      patch.score = Object.assign({}, s.score, { [off]: s.prev.score[off] });
      patch.result = Object.assign({}, s.result, { verdict: "void", runs: 0 });
      patch.msg = `⚖️ ${TEAM[team].name} 영사 재판권! 이번 안타는 무효예요.`;
    } else if (card === "tariff") {
      patch.score = Object.assign({}, s.score, { [off]: s.score[off] - 1, [team]: s.score[team] + 1 });
      patch.msg = `💰 ${TEAM[team].name} 관세 협의! ${TEAM[off].name}의 1점을 가져왔어요.`;
    } else if (card === "mfn") {
      patch.pending = Object.assign({}, s.pending, { [team]: s.pending[team] + 1 });
      patch.msg = `🎁 ${TEAM[team].name} 최혜국 대우! 다음 공격 때 주자 1명을 받아요.`;
    }
  } else {
    patch.msg = `😵 ${TEAM[team].name} 주장이 ${TCARDS[card].name}의 뜻을 틀려서 카드가 사라졌어요.`;
  }
  await putState(patch);
}

/* ============================================================
   게임 방법 창 (TV에 띄워 학생에게 설명) — 글은 모두 이 파일에서 만든 것이라 innerHTML로 넣는다
   ============================================================ */
function rulePages() {
  const T = TEAM, img = n => IMG(n);
  const card = k => { const c = TCARDS[k]; return `<div><img src="${img(c.img)}" alt=""><h3>${c.name}</h3>
    <p>📜 진짜 뜻: ${c.right}</p><p>🎮 게임 효과: <b>${c.effect}</b></p><p>⏰ 쓸 수 있을 때: ${c.need}</p></div>`; };
  return [
    `<h2>⚾ 역사 티볼 리그</h2>
     <p>오늘 배운 <b>아시아의 국민 국가 건설 운동</b>을 문제로 풀면서 티볼 경기를 해요.</p>
     <div class="teams2"><div><img src="${img("team_cn")}" alt=""><span class="t-cn">🔥 ${T.cn.name}</span></div><div style="font-size:3em">VS</div>
       <div><img src="${img("team_jp")}" alt=""><span class="t-jp">🌊 ${T.jp.name}</span></div></div>
     <p>모두 <b>자기 태블릿</b>으로 답하고, 점수판은 TV에 나와요. 문제를 잘 맞힐수록 <b>안타·홈런</b>으로 점수를 내요!</p>`,
    `<h2>📱 입장하기</h2>
     <ol><li>TV의 <b>QR</b>을 태블릿 카메라로 찍어요. (또는 주소로 들어가 <b>방 번호 4자리</b>를 눌러요)</li>
     <li><b>내 학번 4자리</b>를 눌러요. 예: 2211</li>
     <li>팀은 <b>자동</b>으로 정해져요. 두 팀 인원이 맞게 나뉘어요.</li>
     <li>태블릿에 내 팀(🔥 ${T.cn.name} / 🌊 ${T.jp.name})이 보이면 준비 끝!</li></ol>`,
    `<h2>❓ 한 타석 = 문제 1개</h2>
     <ul><li>선생님이 <b>⚾ 투구</b>를 누르면 모든 태블릿에 같은 문제가 떠요. <b>⏱ ${H.st.limit}초!</b> (순서 문제는 ${H.st.limit + ORDER_BONUS}초)</li>
     <li>공격 팀만 푸는 게 아니에요. <b>수비 팀도 같은 문제</b>를 풀어요.</li>
     <li>보기 순서는 <b>사람마다 달라요</b>. 옆 친구가 누르는 자리를 따라 하면 틀려요!</li>
     <li>답은 <b>한 번만</b> 낼 수 있어요. 시간 안에 안 내면 틀린 것으로 쳐요.</li>
     <li>정답이 공개되면 <b>💡 해설</b>이 떠요. 꼭 읽어 봐요!</li></ul>`,
    `<h2>🏏 안타·홈런은 어떻게 쳐요?</h2>
     <p>우리 팀 <b>정답률</b> = 우리 팀에서 맞힌 사람 ÷ 우리 팀 사람 수</p>
     <p>공격 팀이 안타를 치려면 ① 정답률 <b>50% 이상</b>, 그리고 ② <b>수비 팀보다 정답률이 높아야</b> 해요. 아니면 <b>아웃!</b></p>
     <div class="ladder">
       <span>50~69%</span><div class="lb" style="width:40%;background:#7bc96f">안타 (1루까지)</div>
       <span>70~84%</span><div class="lb" style="width:60%;background:#3fb0e8">2루타</div>
       <span>85~94%</span><div class="lb" style="width:80%;background:#9b6bff">3루타</div>
       <span>95% 이상</span><div class="lb" style="width:100%;background:#ff8a00">홈런! 🎉</div></div>
     <p>주자가 홈까지 돌아오면 <b>1점</b>. <b>아웃 3개</b>면 공격과 수비가 바뀌어요.</p>
     <div class="ex2"><div>예) 🔥공격 <b>80%</b> vs 🌊수비 60%<br>→ <b>2루타!</b></div><div>예) 🔥공격 80% vs 🌊수비 <b>85%</b><br>→ 수비 성공, <b>아웃!</b></div></div>`,
    `<h2>📜 불평등 조약 카드</h2>
     <p>오늘 배운 <b>불평등 조약</b>의 내용 세 가지를 카드로 만들었어요. 팀마다 3장, <b>한 경기에 한 번씩</b>만!</p>
     <p>수비할 때 <b>🧢 수비 주장</b>(회마다 무작위)이 판정 직후에 써요. <b>진짜 뜻</b>을 맞혀야 효과가 나고, 틀리면 카드가 사라져요!</p>
     <div class="cardrow">${card("consul")}${card("tariff")}${card("mfn")}</div>`,
    `<h2>🏆 경기 끝</h2>
     <ul><li>선생님이 <b>🏁 마지막 회</b>를 누르면, 그 회까지 하고 경기가 끝나요.</li>
     <li>TV에 나오는 것: <b>승리 팀</b>, <b>정답왕 3명</b>(학번), <b>우리 반이 많이 틀린 문제 3개</b></li>
     <li>많이 틀린 문제는 해설과 함께 다시 보며 복습해요.</li>
     <li>점수보다 중요한 건 오늘 배운 내용을 다시 떠올리는 거예요! 😊</li></ul>`,
    `<h2>👩‍🏫 선생님 버튼 안내 <span class="tag">선생님용</span></h2>
     <table class="btntable">
      <tr><td>📖 게임 방법</td><td>지금 이 설명 창을 열어요</td><td>언제나</td></tr>
      <tr><td>🧪 테스트 모드</td><td>학생 6명이 자동으로 답하는 시험 창 (실제 수업 방과 무관)</td><td>시작 전</td></tr>
      <tr><td>연습 문제</td><td>점수에 들어가지 않는 문제 1개로 연습</td><td>시작 전</td></tr>
      <tr><td>⚾ 경기 시작</td><td>1회 초부터 시작 (두 팀 모두 1명 이상 있어야 켜져요)</td><td>시작 전</td></tr>
      <tr><td>⏱ 문제 시간</td><td>누를 때마다 10초 → 15초 → 20초 → 30초 (순서 문제는 +5초)</td><td>투구 전</td></tr>
      <tr><td>⏱ 바로 마감</td><td>시간이 끝나기 전에 문제를 닫고 판정</td><td>문제 푸는 중</td></tr>
      <tr><td>💡 해설</td><td>해설 창을 닫거나 다시 열어요</td><td>판정 뒤</td></tr>
      <tr><td>다음 투구 ▶</td><td>다음 문제 (아웃 3개면 '공수 교대 ▶'로 바뀌어요)</td><td>판정 뒤</td></tr>
      <tr><td>⚾ 투구</td><td>공수 교대 뒤 첫 문제를 내요</td><td>공수 교대 뒤</td></tr>
      <tr><td>👥 학생 관리</td><td>이름표를 누르면 팀 이동, 옆의 ✕를 누르면 내보내기(학생이 다시 입장)</td><td>언제나</td></tr>
      <tr><td>🏁 마지막 회</td><td>이번 회가 끝나면 경기 종료 (다시 누르면 취소)</td><td>경기 중</td></tr>
      <tr><td>경기 끝</td><td>바로 끝내고 결과 보기</td><td>경기 중</td></tr>
      <tr><td>새 경기</td><td>점수를 지우고 다시 (학생은 그대로)</td><td>끝난 뒤</td></tr>
     </table>`,
  ];
}
let rulesAt = 0;
function openRules(i) { rulesAt = i || 0; show("#hRules", true); renderRules(); }
function closeRules() { show("#hRules", false); }
function renderRules() {
  const pages = rulePages(); rulesAt = Math.max(0, Math.min(pages.length - 1, rulesAt));
  $("#hRulesPage").innerHTML = pages[rulesAt];
  const d = $("#hRulesDots"); d.textContent = "";
  pages.forEach((_, i) => { const b = mk("button", i === rulesAt ? "on" : ""); b.setAttribute("aria-label", `${i + 1}쪽`); b.onclick = () => { rulesAt = i; renderRules(); }; d.append(b); });
  $("#hRulesPrev").disabled = rulesAt === 0;
  $("#hRulesNext").textContent = rulesAt === pages.length - 1 ? "닫기 ✓" : "다음 ▶";
}
function setupRules() {
  $("#hRulesX").onclick = closeRules;
  $("#hRulesPrev").onclick = () => { rulesAt--; renderRules(); };
  $("#hRulesNext").onclick = () => { if (rulesAt >= rulePages().length - 1) closeRules(); else { rulesAt++; renderRules(); } };
  window.addEventListener("keydown", e => {
    if ($("#hRules").classList.contains("hidden")) return;
    if (e.key === "ArrowRight") $("#hRulesNext").click(); else if (e.key === "ArrowLeft" && rulesAt > 0) $("#hRulesPrev").click(); else if (e.key === "Escape") closeRules();
  });
}

/* 해설 팝업 (TV): 판정이 먼저 보이고 잠시 뒤 뜬다 */
function renderExplainHost() {
  const s = H.st, box = $("#hExplain");
  if (s.phase !== "reveal" || !s.q) { H.exOpen = false; show(box, false); return; }
  if (H.exAuto !== s.pitchNo) {
    H.exAuto = s.pitchNo; H.exOpen = false; const pn = s.pitchNo;
    setTimeout(() => { if (H.st.phase === "reveal" && H.st.pitchNo === pn) { H.exOpen = true; renderExplainHost(); renderCtrl(); } }, 1400);
  }
  show(box, H.exOpen);
  if (!H.exOpen) return;
  const q = QBY[s.q.id]; if (!q) return;
  box.textContent = "";
  box.append(mk("h2", "", "💡 해설"), mk("div", "q", (q.type === "order" ? "[순서] " : "") + q.q),
    mk("div", "ans", "✔ 정답: " + correctText(q)), mk("div", "txt", q.explain || q.note || ""));
  const b = mk("button", "btn gold", "닫기"); b.onclick = () => { H.exOpen = false; renderExplainHost(); renderCtrl(); }; box.append(b);
}

/* ---------- 교사 화면 그리기 ---------- */
function renderJoin() {
  const url = location.origin + location.pathname + "?room=" + H.code;
  $("#hCode").textContent = H.code;
  $("#hUrl").textContent = location.protocol.startsWith("http") ? url : "(연습 모드: 같은 컴퓨터에서 학생 탭을 열어 방 번호를 넣어요)";
  try {
    const qr = qrcode(0, "M"); qr.addData(url); qr.make();
    $("#hQR").innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
  } catch (e) { $("#hQR").textContent = "QR을 만들 수 없어요"; }
}
function chip(p) {
  const w = mk("span", "chipwrap");
  const b = mk("button", "chip" + (p.online === false ? " off" : ""), p.id);
  b.title = "다른 팀으로 옮기기"; b.onclick = () => moveTeam(p.id);
  const x = mk("button", "chipx", "✕"); x.title = "내보내기 (다시 입장)"; x.setAttribute("aria-label", `${p.id} 내보내기`);
  x.onclick = () => kickPlayer(p.id);
  w.append(b, x); return w;
}
function renderRoster() {
  for (const t of ["cn", "jp"]) {
    const list = teamList(t).sort((a, b) => a.id.localeCompare(b.id));
    const box = $(t === "cn" ? "#hCnList" : "#hJpList"); box.textContent = "";
    list.forEach(p => box.appendChild(chip(p)));
    $(t === "cn" ? "#hCnCount" : "#hJpCount").textContent = present(t).length;
  }
}
function ctrlButton(text, cls, fn, disabled) {
  const b = mk("button", "btn " + (cls || ""), text); b.disabled = !!disabled; b.onclick = fn; return b;
}
function renderCtrl() {
  const s = H.st, c = $("#hCtrl"); c.textContent = "";
  if (H.db && H.db.mode === "local") c.append(mk("div", "modepill", "연습 모드"));
  const n = present("cn").length + present("jp").length;
  if (s.phase === "lobby") {
    c.append(mk("div", "info", `접속 ${n}명 · 방 ${H.code}`), mk("div", "sp"));
    c.append(ctrlButton("📖 게임 방법", "", () => openRules(0)));
    c.append(timeButton());
    if (!IN_FRAME) c.append(ctrlButton("🧪 테스트 모드", "", () => window.open(location.pathname + "?test", "_blank")));
    c.append(ctrlButton("연습 문제", "", () => startPitch(true), n === 0),
      ctrlButton("⚾ 경기 시작", "gold", () => startPitch(false), present("cn").length === 0 || present("jp").length === 0));
  } else if (s.phase === "ready") {
    c.append(mk("div", "info", s.finalReq ? "🏁 마지막 회 진행 중" : `접속 ${n}명`), mk("div", "sp"),
      ctrlButton("📖 게임 방법", "", () => openRules(3)),
      timeButton(),
      ctrlButton("👥 학생 관리", "", toggleRoster),
      ctrlButton(s.finalReq ? "🏁 마지막 회 취소" : "🏁 마지막 회", "", () => putState({ finalReq: !s.finalReq })),
      ctrlButton("⚾ 투구", "gold", () => startPitch(false)));
  } else if (s.phase === "pitch") {
    c.append(mk("div", "info", s.practice ? "연습 문제예요 (점수에 들어가지 않아요)" : ""), mk("div", "sp"),
      ctrlButton("⏱ 바로 마감", "", closePitch));
  } else if (s.phase === "reveal") {
    const waitCard = !s.practice && s.started && !s.cardPlay && s.captain[other(offenseOf(s))] &&
      CARD_KEYS.some(k => cardAllowed(s, other(offenseOf(s)), k));
    c.append(mk("div", "info", waitCard ? `🧢 수비 주장 ${s.captain[other(offenseOf(s))]}이(가) 조약 카드를 쓸 수 있어요` : ""), mk("div", "sp"),
      ctrlButton(H.exOpen ? "💡 해설 닫기" : "💡 해설", "", () => { H.exOpen = !H.exOpen; renderExplainHost(); renderCtrl(); }),
      ctrlButton("👥 학생 관리", "", toggleRoster));
    if (s.started && !s.practice) c.append(ctrlButton(s.finalReq ? "🏁 마지막 회 취소" : "🏁 마지막 회", "", () => putState({ finalReq: !s.finalReq })));
    c.append(ctrlButton(s.practice || !s.started ? "확인 ▶" : (s.outs >= 3 ? "공수 교대 ▶" : "다음 투구 ▶"), "gold", nextAfterReveal));
  } else if (s.phase === "over") {
    c.append(mk("div", "sp"), ctrlButton("새 경기", "", async () => {
      if (!confirm("점수를 지우고 새 경기를 시작할까요? (학생들은 그대로 남아요)")) return;
      await H.db.remove(R("answers")); await H.db.set(R("state"), { phase: "lobby" });
    }));
  }
  if (s.phase !== "lobby" && s.phase !== "over") {
    c.append(ctrlButton("경기 끝", "", () => { if (confirm("지금 경기를 끝내고 결과를 볼까요?")) finishGame(); }));
  }
}
function timeButton() {
  const s = H.st;
  return ctrlButton(`⏱ 문제 시간 ${s.limit}초`, "", () => putState({ limit: LIMITS[(LIMITS.indexOf(s.limit) + 1) % LIMITS.length] }));
}
let rosterOpen = false;
function toggleRoster() { rosterOpen = !rosterOpen; renderHost(); }

function renderHost() {
  const s = H.st;
  const lobbyView = s.phase === "lobby" || rosterOpen;
  show("#hLobby", lobbyView && s.phase !== "over");
  show("#hScore", !lobbyView && s.phase !== "over");
  show("#hMain", !lobbyView && s.phase !== "over");
  show("#hFinal", s.phase === "over");
  renderRoster();
  renderCtrl();
  if (rosterOpen && s.phase !== "lobby") {
    const c = $("#hCtrl"); c.prepend(ctrlButton("← 경기 화면", "gold", toggleRoster));
  }
  // 점수판
  $("#hPtsCn").textContent = s.score.cn; $("#hPtsJp").textContent = s.score.jp;
  const off = offenseOf(s);
  $("#hInn").textContent = s.started ? `${s.inning}회 ${s.half === 0 ? "초" : "말"} · ${TEAM[off].name} 공격` : "경기 전";
  const outs = $("#hOuts"); outs.textContent = ""; outs.append(mk("span", "", "아웃"));
  for (let i = 0; i < 3; i++) outs.append(mk("i", i < s.outs ? "on" : ""));
  for (const t of ["cn", "jp"]) {
    const box = $(t === "cn" ? "#hCardsCn" : "#hCardsJp"); box.textContent = "";
    if (s.started) for (const k of CARD_KEYS) { const im = mk("img", s.cards[t][k] ? "" : "used"); im.src = IMG(TCARDS[k].img); im.alt = TCARDS[k].name; im.title = TCARDS[k].name; box.append(im); }
    const cap = $(t === "cn" ? "#hCapCn" : "#hCapJp");
    cap.textContent = s.started && t !== off && s.captain[t] ? `🧢 수비 주장 ${s.captain[t]}` : (s.started && t === off ? "공격 중" : "");
  }
  renderField(); renderPanel(); renderFinal(); renderExplainHost();
}
const BASE_POS = [[86, 48], [50, 14], [14, 48]];  // 1루, 2루, 3루 (운동장 그림 위 % 위치)
function renderField() {
  const f = $("#hField"), s = H.st;
  f.querySelectorAll(".base-runner,.msg,.stamp").forEach(e => e.remove());
  const off = offenseOf(s);
  s.bases.forEach((on, i) => {
    if (!on) return;
    const r = mk("div", "base-runner"); r.style.left = BASE_POS[i][0] + "%"; r.style.top = BASE_POS[i][1] + "%";
    r.style.background = off === "cn" ? "var(--cn)" : "var(--jp)";
    const im = mk("img"); im.src = IMG(TEAM[off].img); im.alt = TEAM[off].name + " 주자"; r.append(im); f.append(r);
  });
  if (s.phase === "reveal" && s.result) {
    const v = s.result.verdict;
    let t = VERDICT[v].t;
    if (isHit(v) && s.result.runs) t += ` +${s.result.runs}점`;
    if (s.practice) t = "연습 " + t;
    const st = mk("div", "stamp", t); st.style.color = v === "out" ? "#ff5a5a" : v === "void" ? "#b47cff" : "#ffd23f"; f.append(st);
  }
  const msg = s.msg || (s.phase === "ready" ? "선생님이 ⚾ 투구를 누르면 문제가 나와요" : "");
  if (msg) f.append(mk("div", "msg", msg));
}
function renderPanel() {
  const p = $("#hPanel"), s = H.st; p.textContent = "";
  if (s.phase === "ready") {
    p.append(mk("h2", "", "다음 타석을 준비해요"));
    const off = offenseOf(s);
    p.append(mk("div", "q", `${TEAM[off].name}이 공격, ${TEAM[other(off)].name}이 수비예요. 두 팀 모두 같은 문제를 풀어요!`));
    p.append(mk("div", "qmeta", "공격 팀 정답률이 50% 이상이고 수비 팀보다 높으면 안타! 정답률이 높을수록 장타예요."));
    return;
  }
  if (!s.q) return;
  const q = QBY[s.q.id]; if (!q) return;
  p.append(mk("div", "qmeta", (s.practice ? "연습 문제 · " : "") + `${q.part}${q.extra ? " · 보충" : ""}`));
  p.append(mk("div", "q", q.type === "order" ? `[순서] ${q.q}` : q.q));
  const reveal = s.phase === "reveal";
  if (q.type === "mc") {
    const ul = mk("ul"); q.options.forEach((o, i) => ul.append(mk("li", reveal && i === q.answer ? "right" : "", o))); p.append(ul);
  } else if (q.type === "ox") {
    const d = mk("div", "oxbig"); ["O", "X"].forEach(x => d.append(mk("span", reveal && x === q.answer ? "right" : "", x))); p.append(d);
  } else {
    const ul = mk("ul");
    (reveal ? q.items : shuffled(q.items, s.q.seed)).forEach((o, i) => ul.append(mk("li", reveal ? "right" : "", (reveal ? (i + 1) + ". " : "• ") + o)));
    p.append(ul);
  }
  if (reveal && q.note) p.append(mk("div", "qmeta", "💡 " + q.note));
  // 진행 막대
  const prog = mk("div", "prog");
  for (const t of ["cn", "jp"]) {
    const stt = reveal && s.result ? { ans: s.result.ans[t], total: s.result.total[t], acc: s.result.acc[t] } : teamStats(t);
    const bar = mk("div", "bar " + t), i = mk("i");
    i.style.width = Math.round((reveal ? stt.acc : (stt.total ? stt.ans / stt.total : 0)) * 100) + "%"; bar.append(i);
    prog.append(mk("span", "t-" + t, TEAM[t].name), bar,
      mk("span", "", reveal ? `정답률 ${Math.round(stt.acc * 100)}%` : `${stt.ans}/${stt.total} 답함`));
  }
  p.append(prog);
  if (!reveal) { const tm = mk("div", "timer"); tm.id = "hTimer"; p.append(tm); renderTimer(); }
}
function renderTimer() {
  const e = $("#hTimer"); if (!e || !H.st.q) return;
  e.textContent = "⏱ " + Math.max(0, Math.ceil((H.st.q.endsAt - H.db.now()) / 1000)) + "초";
}
function renderFinal() {
  const s = H.st; if (s.phase !== "over" || !s.final) return;
  const f = s.final;
  $("#hWinner").textContent = f.winner === "draw" ? "🤝 무승부!" : `🎉 ${TEAM[f.winner].name} 승리!`;
  const sl = $("#hScoreLine"); sl.textContent = "";
  for (const t of ["cn", "jp"]) { const d = mk("div"); d.append(mk("span", "t-" + t, TEAM[t].name), mk("span", "", s.score[t] + "점")); sl.append(d); }
  const top = $("#hTop"); top.textContent = "";
  (f.top || []).forEach((p, i) => { const d = mk("div"); d.append(mk("span", "", ["🥇", "🥈", "🥉"][i] + " " + p.id), mk("span", "", `${p.ok}/${p.n} 정답`)); top.append(d); });
  if (!(f.top || []).length) top.append(mk("div", "", "기록이 없어요"));
  const ms = $("#hMissed"); ms.textContent = "";
  (f.missed || []).forEach(m => {
    const q = QBY[m.qid]; if (!q) return;
    const li = mk("li"); li.append(mk("div", "", `${q.type === "order" ? "[순서] " : ""}${q.q} (오답 ${m.wrong}%)`));
    const b = mk("b", "", "✔ " + correctText(q)); li.append(b);
    if (q.explain) li.append(mk("div", "", "💡 " + q.explain));
    ms.append(li);
  });
  if (!(f.missed || []).length) ms.append(mk("li", "", "많이 틀린 문제가 없어요. 훌륭해요!"));
}

/* ============================================================
   학생 화면
   ============================================================ */
const S = { db: null, code: "", id: "", st: normState(null), me: null, myAns: null, unAns: null, ansKey: "", orderPick: [], players: {} };

function studentMain() {
  show("#student", true);
  const qs = new URLSearchParams(location.search);
  const urlRoom = qs.get("room") || "";
  S.fromQR = /^\d{4}$/.test(urlRoom);
  S.roomIn = S.fromQR ? urlRoom : "";
  // 학번은 같은 방에 다시 들어올 때만 미리 채운다(기기를 돌려 쓰는 경우 대비)
  S.id = S.fromQR && store.get("room", "") === urlRoom ? store.get("sid", "") : "";
  S.step = S.fromQR ? "id" : "room";
  const kp = $("#sKeypad");
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "←", "0", "✓"].forEach(k => {
    const b = mk("button", "", k);
    b.setAttribute("aria-label", k === "←" ? "지우기" : k === "✓" ? "다음" : k);
    b.onclick = () => keyIn(k);
    kp.append(b);
  });
  // 컴퓨터 자판으로도 입력
  window.addEventListener("keydown", e => {
    if (!$("#sJoin") || $("#sJoin").classList.contains("hidden")) return;
    if (/^\d$/.test(e.key)) keyIn(e.key); else if (e.key === "Backspace") keyIn("←"); else if (e.key === "Enter") keyIn("✓");
  });
  $("#sNext").onclick = () => keyIn("✓");
  $("#sBack").onclick = () => { S.step = "room"; S.fromQR = false; $("#sErr").textContent = ""; renderJoinStep(); };
  $("#sOrderReset").onclick = () => { S.orderPick = []; renderQuestion(); };
  $("#sOrderSend").onclick = sendOrder;
  $("#sCmCancel").onclick = () => show("#sCardModal", false);
  $("#sExOk").onclick = () => show("#sExModal", false);
  $("#sRulesBtn").onclick = openStudentRules;
  $("#sRulesOk").onclick = () => show("#sRulesModal", false);
  renderJoinStep();
  // 테스트 모드: 학번을 받아 바로 입장
  const auto = qs.get("autoid");
  if (FORCE_LOCAL && S.fromQR && /^\d{4}$/.test(auto || "")) { S.id = auto; join(); }
}
function keyIn(k) {
  if (S.busyJoin) return;
  const f = S.step === "room" ? "roomIn" : "id";
  if (k === "←") S[f] = S[f].slice(0, -1);
  else if (k === "✓") return S.step === "room" ? checkRoom() : join();
  else if (S[f].length < 4) S[f] += k;
  $("#sErr").textContent = "";
  renderJoinStep();
}
function renderJoinStep() {
  const room = S.step === "room";
  $("#sStep1").className = room ? "on" : "done";
  $("#sStep2").className = room ? "" : "on";
  $("#sAsk").textContent = room ? "선생님 TV에 나온 방 번호 4자리를 눌러요" : "내 학번 4자리를 눌러요 (예: 2211)";
  $("#sView").textContent = ((room ? S.roomIn : S.id) + "____").slice(0, 4);
  $("#sNext").textContent = room ? "다음 ›" : "입장하기";
  show("#sRoomChip", !room); $("#sRoomChip").textContent = "✅ 방 " + S.roomIn;
  show("#sBack", !room);
}
async function openRoom(code) {
  S.db = S.db || await connect();
  return await S.db.get(`rooms/${code}/meta`);
}
async function checkRoom() {
  const err = $("#sErr");
  if (!/^\d{4}$/.test(S.roomIn)) { err.textContent = "방 번호 4자리를 모두 눌러 주세요"; return; }
  S.busyJoin = true; $("#sNext").disabled = true;
  try {
    if (!(await openRoom(S.roomIn))) { err.textContent = "그런 방이 없어요. 선생님 TV의 번호를 다시 확인해요"; return; }
    S.step = "id"; S.id = store.get("room", "") === S.roomIn ? store.get("sid", "") : ""; renderJoinStep();
  } catch (e) { S.db = null; err.textContent = "연결에 실패했어요. 다시 눌러 주세요. (" + explain(e) + ")"; }
  finally { S.busyJoin = false; $("#sNext").disabled = false; }
}
async function join() {
  const code = S.roomIn, id = S.id, err = $("#sErr");
  if (!/^\d{4}$/.test(id)) { err.textContent = "학번 4자리를 모두 눌러 주세요 (예: 2211)"; return; }
  S.busyJoin = true; $("#sNext").disabled = true;
  try {
    if (!(await openRoom(code))) { err.textContent = "그런 방이 없어요. 방 번호를 다시 넣어 주세요"; S.step = "room"; renderJoinStep(); return; }
    S.code = code; store.set("room", code); store.set("sid", id);
    await S.db.update(`rooms/${code}/players/${id}`, { online: true, joinedAt: S.db.now() });
    S.stopPres = S.db.presence(`rooms/${code}/players/${id}/online`);
    S.seen = false;
    show("#sJoin", false); show("#sTop", true); show("#sNotice", false);
    S.unP = S.db.on(`rooms/${code}/players`, v => {
      S.players = v || {}; const mine = S.players[id];
      if (mine && mine.joinedAt) { S.seen = true; S.me = mine; }
      else if (S.seen) { kicked(mine); return; }
      else S.me = null;
      renderStudent();
    });
    S.unS = S.db.on(`rooms/${code}/state`, v => { S.st = normState(v); watchMyAnswer(); renderStudent(); });
    S.tick = setInterval(tickStudent, 250);
  } catch (e) {
    S.db = null;
    err.textContent = "연결에 실패했어요. 다시 눌러 주세요. (" + explain(e) + ")";
  } finally { S.busyJoin = false; $("#sNext").disabled = false; }
}
const SR = p => `rooms/${S.code}/${p}`;
/* 선생님이 내보냈을 때: 연결을 정리하고 학번 입력 화면으로 */
function kicked(ghost) {
  const code = S.code, id = S.id;
  try { S.stopPres && S.stopPres(); } catch (e) { }
  [S.unP, S.unS, S.unAns].forEach(u => { try { u && u(); } catch (e) { } });
  clearInterval(S.tick);
  if (ghost) S.db.remove(`rooms/${code}/players/${id}`).catch(() => { });   // 연결이 끊겼다 이어지며 남은 빈 이름표 정리
  Object.assign(S, { code: "", me: null, seen: false, players: {}, st: normState(null), myAns: null, ansKey: "", unP: null, unS: null, unAns: null, stopPres: null, orderPick: [] });
  ["#sWait", "#sQ", "#sSent", "#sReveal", "#sOver", "#sTop", "#sExModal", "#sCardModal", "#sRulesModal"].forEach(x => show(x, false));
  store.set("sid", "");
  S.id = ""; S.step = "id"; show("#sJoin", true); renderJoinStep();
  $("#sNotice").textContent = "🔄 선생님이 다시 입장하라고 했어요. 내 학번을 다시 눌러 주세요."; show("#sNotice", true);
}
function watchMyAnswer() {
  const key = S.st.q ? ansKey(S.st) : "";
  if (key === S.ansKey) return;
  S.ansKey = key; S.orderPick = [];
  if (S.unAns) { S.unAns(); S.unAns = null; }
  S.myAns = null; S.answersCount = 0;
  if (key) S.unAns = S.db.on(SR(`answers/${key}`), v => { v = v || {}; S.myAns = v[S.id] || null; S.answersCount = Object.keys(v).length; renderStudent(); });
}
function myTeam() { return S.me && S.me.team; }
function screens(id) { ["#sWait", "#sQ", "#sSent", "#sReveal", "#sOver"].forEach(x => show(x, x === id)); }

function renderStudent() {
  const s = S.st, t = myTeam();
  if (s.phase !== "reveal") show("#sExModal", false);
  // 위쪽 띠
  if (t) { $("#sEmblem").src = IMG(TEAM[t].img); $("#sWho").textContent = `${S.id} · ${TEAM[t].name}`; $("#sWho").className = "who t-" + t; }
  else { $("#sEmblem").src = IMG("ball"); $("#sWho").textContent = `${S.id} · 팀 배정 중…`; }
  $("#sScore").textContent = s.started ? `${TEAM.cn.short} ${s.score.cn} : ${s.score.jp} ${TEAM.jp.short}\n${s.inning}회 ${s.half ? "말" : "초"} · ${s.outs}아웃` : "";
  $("#sScore").style.whiteSpace = "pre-line";
  if (!t || s.phase === "lobby" || s.phase === "ready") {
    screens("#sWait");
    $("#sWaitEmblem").src = IMG(t ? TEAM[t].img : "ball");
    $("#sWaitTeam").textContent = t ? TEAM[t].name : "팀 배정 중…";
    $("#sWaitTeam").className = "team-name" + (t ? " t-" + t : "");
    $("#sWaitText").textContent = !t ? "선생님 화면에서 팀이 정해지고 있어요" :
      s.phase === "ready" ? (s.msg || "다음 문제를 기다려요") : "선생님이 시작하면 문제가 나와요. 화면을 보고 있어요!";
    const cap = s.started && t && s.captain[t] === S.id;
    show("#sCapInfo", cap);
    if (cap) $("#sCapInfo").textContent = "🧢 이번 회에 내가 수비 주장이에요! 판정이 나오면 불평등 조약 카드를 쓸 수 있어요.";
    return;
  }
  if (s.phase === "pitch") {
    if (S.myAns) { screens("#sSent"); $("#sSentCount").textContent = `지금까지 ${S.answersCount}명 제출`; }
    else { screens("#sQ"); renderQuestion(); }
    return;
  }
  if (s.phase === "reveal") { screens("#sReveal"); renderReveal(); renderExplainStudent(); return; }
  if (s.phase === "over") { screens("#sOver"); renderOver(); }
}

function myOptionOrder(q) {
  const seed = (S.st.q.seed ^ hashStr(S.id)) >>> 0;
  if (q.type === "mc") return shuffled([0, 1, 2, 3], seed);
  if (q.type === "order") return shuffled(q.items.map((_, i) => i), seed);
  return [0, 1];
}
let lastQRender = "";
function renderQuestion() {
  const s = S.st, q = QBY[s.q.id]; if (!q) return;
  const sig = s.pitchNo + ":" + S.orderPick.join(",");
  if (sig === lastQRender && $("#sOpts").childElementCount) return;
  lastQRender = sig;
  $("#sQText").textContent = (s.practice ? "[연습] " : "") + (q.type === "order" ? `[순서] ${q.q}` : q.q);
  const box = $("#sOpts"); box.textContent = ""; box.className = "opts" + (q.type === "ox" ? " ox" : "");
  show("#sOrderTools", q.type === "order");
  const order = myOptionOrder(q);
  if (q.type === "mc") {
    order.forEach((oi, k) => {
      const b = mk("button", "opt"); b.append(mk("span", "num", String(k + 1)), mk("span", "", q.options[oi]));
      b.onclick = () => submit(oi === q.answer); box.append(b);
    });
  } else if (q.type === "ox") {
    ["O", "X"].forEach(x => { const b = mk("button", "opt", x); b.onclick = () => submit(x === q.answer); box.append(b); });
  } else {
    order.forEach(oi => {
      const pos = S.orderPick.indexOf(oi);
      const b = mk("button", "opt" + (pos >= 0 ? " picked" : ""));
      b.append(mk("span", "num", pos >= 0 ? String(pos + 1) : ""), mk("span", "", q.items[oi]));
      b.disabled = pos >= 0;
      b.onclick = () => { if (S.orderPick.length < q.items.length) { S.orderPick.push(oi); renderQuestion(); } };
      box.append(b);
    });
    $("#sOrderSend").disabled = S.orderPick.length !== q.items.length;
  }
}
function sendOrder() {
  const q = QBY[S.st.q.id];
  if (S.orderPick.length !== q.items.length) return;
  submit(S.orderPick.every((v, i) => v === i));
}
async function submit(correct) {
  const s = S.st; if (s.phase !== "pitch" || S.myAns) return;
  const t = myTeam();
  S.myAns = { c: correct };
  screens("#sSent");
  try {
    await S.db.set(SR(`answers/${ansKey(s)}/${S.id}`), { c: !!correct, t: Math.max(0, S.db.now() - s.q.startedAt), team: t || "", q: s.q.id });
  } catch (e) { /* 이미 냈으면 규칙상 거절될 수 있음 */ }
}
function tickStudent() {
  const s = S.st;
  if (S.bot) botTick();
  if (s.phase === "pitch" && s.q) {
    const left = Math.max(0, s.q.endsAt - (S.db ? S.db.now() : Date.now()));
    $("#sTimer").style.width = (left / Math.max(1, s.q.endsAt - s.q.startedAt) * 100) + "%";
    $("#sTimeLeft").textContent = "⏱ " + Math.ceil(left / 1000) + "초";
  }
}
function renderReveal() {
  const s = S.st, q = QBY[s.q.id], t = myTeam(), r = s.result; if (!q || !r) return;
  const mine = S.myAns;
  $("#sMine").textContent = !mine ? "⏰ 시간 초과" : mine.c ? "✅ 맞았어요!" : "❌ 아쉬워요";
  $("#sAnswer").textContent = "정답: " + correctText(q) + (q.note && q.type !== "order" ? ` (${q.note})` : "");
  const off = r.off, v = r.verdict;
  let tv;
  if (v === "void") tv = "⚖️ 판정 무효!";
  else if (t === off) tv = v === "out" ? "😢 우리 팀 아웃" : `🎉 우리 팀 ${VERDICT[v].t}`;
  else tv = v === "out" ? "🛡️ 수비 성공!" : `😮 상대 ${VERDICT[v].t}`;
  if (s.practice) tv = "(연습) " + tv;
  $("#sTeamVerdict").textContent = tv;
  // 조약 카드
  const def = other(off);
  const isCap = !s.practice && s.started && t === def && s.captain[def] === S.id;
  const canAny = isCap && !s.cardPlay && CARD_KEYS.some(k => s.cards[def][k]);
  show("#sCardBox", canAny);
  if (canAny) {
    const box = $("#sCards"); box.textContent = "";
    for (const k of CARD_KEYS) {
      const c = TCARDS[k], have = s.cards[def][k], ok = have && cardAllowed(s, def, k);
      const b = mk("button", "tcard"); const im = mk("img"); im.src = IMG(c.img); im.alt = "";
      const tx = mk("div"); tx.append(mk("span", "", c.name), mk("small", "", !have ? "이미 썼어요" : ok ? c.effect : c.need + " 쓸 수 있어요")); b.append(im, tx);
      b.disabled = !ok; b.onclick = () => openCardQuiz(k); box.append(b);
    }
  }
  const cp = s.cardPlay;
  $("#sCardResult").textContent = cp ? (s.msg || "") : "";
  if (!canAny) show("#sCardModal", false);
}
function openCardQuiz(k) {
  const c = TCARDS[k], s = S.st;
  $("#sCmImg").src = IMG(c.img); $("#sCmTitle").textContent = `${c.name}: ${c.effect}`;
  const box = $("#sCmOpts"); box.textContent = "";
  shuffled([c.right, ...c.wrong], Date.now()).forEach((txt, i) => {
    const b = mk("button", "opt"); b.append(mk("span", "num", String(i + 1)), mk("span", "", txt));
    b.onclick = async () => {
      show("#sCardModal", false);
      await S.db.set(SR("cardReq"), { team: myTeam(), card: k, by: S.id, ok: txt === c.right, pitchNo: s.pitchNo });
    };
    box.append(b);
  });
  show("#sCardModal", true);
}
function renderOver() {
  const s = S.st, f = s.final || {}, t = myTeam();
  $("#sOverWin").textContent = f.winner === "draw" ? "🤝 무승부!" : f.winner ? `${f.winner === t ? "🎉 우리 팀" : "😮 " + TEAM[f.winner].name} 승리!` : "";
  $("#sOverWin").className = "team-name" + (f.winner && f.winner !== "draw" ? " t-" + f.winner : "");
  $("#sOverScore").textContent = `${TEAM.cn.name} ${s.score.cn} : ${s.score.jp} ${TEAM.jp.name}`;
  const rank = (f.top || []).findIndex(p => p.id === S.id);
  $("#sOverMe").textContent = rank >= 0 ? `${["🥇", "🥈", "🥉"][rank]} 정답왕 ${rank + 1}등! (${f.top[rank].ok}/${f.top[rank].n})` : "수고했어요! 오늘 배운 내용, 다시 한 번 떠올려 봐요.";
}

/* 학생: 해설 팝업과 규칙 */
function renderExplainStudent() {
  const s = S.st;
  if (s.phase !== "reveal" || !s.q) { show("#sExModal", false); return; }
  if (S.exShown === s.pitchNo) return;
  S.exShown = s.pitchNo;
  if (S.bot) return;                                  // 테스트 봇은 팝업 없이
  const q = QBY[s.q.id]; if (!q) return;
  const mine = S.myAns;
  $("#sExRes").textContent = !mine ? "⏰ 시간 초과" : mine.c ? "✅ 맞았어요!" : "❌ 아쉬워요";
  $("#sExAns").textContent = "정답: " + correctText(q);
  $("#sExTxt").textContent = "💡 " + (q.explain || q.note || "");
  const t = myTeam(), def = s.result ? other(s.result.off) : "";
  $("#sExOk").textContent = (!s.practice && t === def && s.captain[def] === S.id && !s.cardPlay) ? "확인 (조약 카드 쓰러 가기)" : "확인";
  show("#sExModal", true);
}
function openStudentRules() {
  const b = $("#sRulesBody"); b.textContent = "";
  const ul = mk("ul");
  [`선생님이 ⚾ 투구를 누르면 문제가 떠요. ${S.st.limit}초 안에 답해요(순서 문제는 ${S.st.limit + ORDER_BONUS}초). 답은 한 번만!`,
   "두 팀이 같은 문제를 동시에 풀어요. 보기 순서는 사람마다 달라요.",
   "공격 팀 정답률이 50% 이상이고 수비 팀보다 높으면 안타! 높을수록 2루타·3루타·홈런(95% 이상).",
   "아니면 아웃. 아웃 3개면 공수 교대. 주자가 홈에 들어오면 1점.",
   "수비할 때 🧢 수비 주장은 불평등 조약 카드를 쓸 수 있어요. 카드의 진짜 뜻을 맞혀야 효과가 나요!"].forEach(t => ul.append(mk("li", "", t)));
  b.append(ul);
  for (const k of CARD_KEYS) {
    const c = TCARDS[k], d = mk("div", "tcard"), im = mk("img"); im.src = IMG(c.img); im.alt = "";
    const tx = mk("div"); tx.append(mk("span", "", `${c.name} → ${c.effect}`), mk("small", "", "뜻: " + c.right)); d.append(im, tx); b.append(d);
  }
  show("#sRulesModal", true);
}

/* ---------- 테스트용 자동 학생(봇) ---------- */
function botTick() {
  const s = S.st;
  if (S.botSkill == null) S.botSkill = .55 + Math.random() * .35;
  if (s.phase === "pitch" && s.q && !S.myAns && S.botPitch !== s.pitchNo) {
    S.botPitch = s.pitchNo; const pn = s.pitchNo;
    setTimeout(() => { if (S.bot && S.st.phase === "pitch" && S.st.pitchNo === pn && !S.myAns) submit(Math.random() < S.botSkill); }, 1500 + Math.random() * 5500);
  }
  if (s.phase === "reveal" && S.botCard !== s.pitchNo) {
    S.botCard = s.pitchNo;
    const t = myTeam();
    if (t && s.captain[t] === S.id && !s.cardPlay && Math.random() < .6) {
      const ok = CARD_KEYS.filter(k => cardAllowed(s, t, k));
      if (ok.length) {
        const k = ok[Math.floor(Math.random() * ok.length)], pn = s.pitchNo;
        setTimeout(() => { if (S.bot && S.st.pitchNo === pn && !S.st.cardPlay) S.db.set(SR("cardReq"), { team: t, card: k, by: S.id, ok: Math.random() < .75, pitchNo: pn }); }, 1800);
      }
    }
  }
}

/* ============================================================
   테스트 모드 창: 왼쪽 TV 화면 + 오른쪽 학생 6명 (Firebase와 무관, 이 컴퓨터 안에서만)
   ============================================================ */
function testMain() {
  show("#test", true);
  const base = location.pathname;
  const host = $("#tHost"); host.src = base + "?local#host";
  const ids = ["9901", "9902", "9903", "9904", "9905", "9906"];
  const frames = [];
  const fit = () => {
    const g = $("#tStudents"), r = g.getBoundingClientRect();
    const cw = (r.width - 2 * 10) / 3, ch = (r.height - 10) / 2, sc = Math.min(cw / 390, ch / 844);
    frames.forEach(f => { f.wrap.style.width = 390 * sc + "px"; f.wrap.style.height = 844 * sc + "px"; f.el.style.transform = `scale(${sc})`; });
  };
  const setBot = () => frames.forEach(f => { try { f.el.contentWindow.__tb.S.bot = $("#tBot").checked; } catch (e) { } });
  const wait = setInterval(() => {
    let code = "";
    try { const h = host.contentWindow.__tb && host.contentWindow.__tb.H; code = h && h.code; } catch (e) { }
    if (!/^\d{4}$/.test(code || "")) return;
    clearInterval(wait);
    ids.forEach(id => {
      const wrap = mk("div", "tphone"), el = mk("iframe");
      el.src = base + "?local&room=" + code + "&autoid=" + id; el.title = "학생 " + id;
      el.addEventListener("load", () => setTimeout(setBot, 300));
      wrap.append(el, mk("div", "tlabel", "학생 " + id)); $("#tStudents").append(wrap); frames.push({ wrap, el });
    });
    fit();
  }, 300);
  new ResizeObserver(fit).observe($("#tStudents"));
  $("#tBot").onchange = setBot;
  setInterval(setBot, 2000);
  $("#tReset").onclick = () => {
    if (!confirm("테스트 기록을 모두 지우고 처음부터 할까요? (실제 수업 방에는 영향이 없어요)")) return;
    try { Object.keys(localStorage).filter(k => k.startsWith("tbdb:") || k.startsWith("tball-local:")).forEach(k => localStorage.removeItem(k)); } catch (e) { }
    location.reload();
  };
}

/* ---------- 시작 ---------- */
document.querySelectorAll("[data-team]").forEach(e => { e.textContent = TEAM[e.dataset.team].name; });
if (IS_TEST) testMain(); else if (IS_HOST) hostMain(); else studentMain();
window.addEventListener("hashchange", () => location.reload());
// 자동 점검에서만 쓰는 손잡이
window.__tb = { H, S, judge, advance, normState };
