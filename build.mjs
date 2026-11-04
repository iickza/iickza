// Builds the SVGs in assets/ for the GitHub profile README.
// GitHub strips CSS/JS from READMEs, but SVGs loaded as images keep their
// own <style> animations, so all the styling lives in here.
//
// The page is laid out as a disassembly listing. The listing is real: strings
// sit at real offsets, the bytes column is their real encoding, and the
// lea/call displacements are worked out from those offsets.
//
//   node build.mjs
//
// Edit the DATA section, run it, commit assets/.
//
// gitlog.svg and langs.svg are pulled live from the GitHub API. The Action in
// .github/workflows/refresh.yml reruns this every few hours and commits them.
// Set GITHUB_TOKEN to dodge rate limits; set GH_STATS_TOKEN (a PAT with repo
// read) to also count private repos in the language stats (never the git log).

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

// ---------- DATA ----------

const GH_USER = "iickza";

const NAME = "ickza";

const TAGLINE = "reverse engineering, game internals & tools";

const ABOUT = [
  ["Hey, I'm ", ["ickza", "hi"], ". I write code, break things,"],
  ["and sometimes write about it on ", ["ickza.top", "link"], "."],
  ["Mostly (trying to) reverse engineer, game internals"],
  ["and whatever tool I'm building that week."],
];

// exactly five: they fill the four win64 arg registers plus one stack slot
const NFO = [
  ["handle", "ickza"],
  ["focus", "reverse engineering"],
  ["playground", "game internals · dma · c++"],
  ["currently", "dayz radar over dma"],
  ["home", "ickza.top"],
];

const POSTS = [
  ["2026-10-22", "ickza: a dayz radar over dma"],
  ["2026-10-22", "new site, who dis"],
];

const BUTTONS = [
  ["site", "jmp", "site"],
  ["blog", "jmp", "blog"],
  ["discord", "call", "discord"],
  ["uc", "call", "uc"],
  ["coffee", "push", "coffee"],
  ["email", "mov", "email"],
];

const GREETZ = "greetz to everyone at unknowncheats";

// ---------- palette / fonts ----------

const C = {
  bg: "#0e1217",
  band: "#141a21",
  line: "#262e38",
  text: "#c9d1d9",
  dim: "#5d6875",
  bytes: "#7f8b98",
  mnem: "#7cb7ff",
  label: "#ff9e7a",
  string: "#e8bb5a",
  note: "#7fa883",
  violet: "#b9a2ff",
};

const font = (weight, file) =>
  `@font-face{font-family:jb;font-weight:${weight};src:url(data:font/woff2;base64,${readFileSync(
    new URL(`./assets/fonts/${file}`, import.meta.url)
  ).toString("base64")}) format("woff2")}`;
const REGULAR = font(400, "jetbrains-mono-latin-400-normal.woff2");
const BOLD = font(700, "jetbrains-mono-latin-700-normal.woff2");

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const svg = (w, h, body, title) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}">
<title>${esc(title)}</title>
${body}
</svg>
`;

// JetBrains Mono is 0.6em wide, so 15px text sits on a 9px character grid
const W = 840, PAD = 24, FS = 15, ADV = 9, LH = 24;
const COLS = (W - 2 * PAD) / ADV;
const col = (n) => PAD + n * ADV;
const BYTES = 11, MNEM = 33, OPS = 39, NOTE = 58;

const BASE_CSS = `text{font-family:jb,ui-monospace,monospace;font-size:${FS}px;font-variant-ligatures:none;white-space:pre;fill:${C.text}}
.a{fill:${C.dim}}.b{fill:${C.bytes}}.m{fill:${C.mnem}}.l{fill:${C.label};font-weight:700}
.s{fill:${C.string}}.c{fill:${C.note}}.d{fill:${C.dim}}
.hi{font-weight:700;fill:${C.label}}.link{fill:${C.mnem}}`;

const card = (h, fill = C.bg) =>
  `<rect x=".5" y=".5" width="${W - 1}" height="${h - 1}" rx="6" fill="${fill}" stroke="${C.line}"/>`;

const text = (x, y, cls, s) => `<text class="${cls}" x="${x}" y="${y}">${esc(s)}</text>`;
const right = (y, cls, s) => `<text class="${cls}" x="${W - PAD}" y="${y}" text-anchor="end">${esc(s)}</text>`;
const fit = (s, max) => (s.length > max ? s.slice(0, max - 1) + "…" : s);

// ---------- the image: where everything lives ----------

const TEXT = 0x140001000, RDATA = 0x140002000, BSS = 0x140003000;
const WHOAMI = 0x140001200;

const addr = (n) => n.toString(16).toUpperCase().padStart(9, "0");
const hex = (bytes) => bytes.map((b) => b.toString(16).toUpperCase().padStart(2, "0")).join(" ");
const le32 = (v) => [0, 8, 16, 24].map((s) => (v >>> s) & 255);
const cstr = (s) => [...Buffer.from(s + "\0")];

// .rdata holds the NFO strings, then the post titles
let rdata = RDATA;
const place = (s) => {
  const at = rdata;
  rdata += cstr(s).length;
  return at;
};
const NFO_AT = NFO.map(([, v]) => place(v));
const POST_AT = POSTS.map(([, title]) => place(title));

// ---------- listing rows: each is a function of its baseline y ----------

const code = (at, bytes, mnem, ops, note, noteCls = "c") => (y) =>
  [
    text(col(0), y, "a", addr(at)),
    text(col(BYTES), y, "b", bytes),
    text(col(MNEM), y, "m", mnem),
    ops ? text(col(OPS), y, "", ops) : "",
    note ? text(col(NOTE), y, noteCls, note) : "",
  ].join("");

const comment = (at, parts) => (y) =>
  text(col(0), y, "a", addr(at)) +
  `<text class="c" x="${col(BYTES)}" y="${y}">; ${parts
    .map((p) => (Array.isArray(p) ? `<tspan class="${p[1]}">${esc(p[0])}</tspan>` : esc(p)))
    .join("")}</text>`;

const label = (at, name, rest = "") => (y) =>
  text(col(0), y, "a", addr(at)) +
  `<text x="${col(BYTES)}" y="${y}"><tspan class="l">${esc(name)}</tspan>${rest ? ` <tspan class="m">${esc(rest)}</tspan>` : ""}</text>`;

// IDA's banner: ; =============== S U B R O U T I N E ===========...
function banner(title, y) {
  const mid = ` ${title.toUpperCase().split("").join(" ")} `;
  return text(col(0), y, "d", `; ${"=".repeat(15)}${mid}${"=".repeat(COLS - 17 - mid.length)}`);
}

function panel(title, rows) {
  const top = 34, y0 = top + LH + 4;
  const h = y0 + (rows.length - 1) * LH + 22;
  const body = rows.map((r, i) => r(y0 + i * LH)).join("\n");
  return svg(W, h, `
<style>${REGULAR}${BOLD}${BASE_CSS}</style>
${card(h)}
${banner(title, top)}
${body}`, title);
}

// ---------- header: a hex view of the tagline ----------

function header() {
  const bytes = [...Buffer.from(`${NAME}: ${TAGLINE}`)];
  const n = bytes.length, rowCount = Math.ceil(n / 16);
  const y0 = 150, h = y0 + (rowCount - 1) * LH + 24;
  const hexCol = (i) => col(BYTES + i * 3 + (i >= 8 ? 1 : 0));
  const asciiCol = (i) => col(BYTES + 50 + i);

  let dump = "";
  for (let r = 0; r < rowCount; r++) {
    const y = y0 + r * LH;
    dump += text(col(0), y, "a", addr(r * 16));
    for (let i = 0; i < 16; i++) {
      const b = bytes[r * 16 + i];
      const on = b !== undefined;
      dump += text(hexCol(i), y, on ? "b" : "d", hex([b ?? 0]));
      dump += text(asciiCol(i), y, on ? "s" : "d", on ? String.fromCharCode(b) : ".");
    }
  }

  // the cursor walks the bytes, lit in both the hex and the ascii pane
  const walk = (name, x) =>
    `@keyframes ${name}{${bytes
      .map((_, i) => `${((i / n) * 100).toFixed(2)}%{transform:translate(${x(i % 16)}px,${Math.floor(i / 16) * LH}px)}`)
      .join("")}}`;
  const dur = (n * 0.2).toFixed(1);
  const css = `.big{font-size:60px;font-weight:700;letter-spacing:-1px}
.hx{animation:hx ${dur}s step-end infinite}.as{animation:as ${dur}s step-end infinite}
${walk("hx", hexCol)}${walk("as", asciiCol)}
.cur{animation:bl 1.1s steps(1) infinite}@keyframes bl{50%{opacity:0}}
@media (prefers-reduced-motion:reduce){.cur{animation:none}.hx,.as{display:none}}`;
  const selY = y0 - 15;

  return svg(W, h, `
<style>${REGULAR}${BOLD}${BASE_CSS}${css}</style>
${card(h)}
<text class="big" x="${PAD - 2}" y="78">${esc(NAME)}</text>
<rect class="cur" x="${PAD + NAME.length * 35 + 6}" y="34" width="26" height="46" fill="${C.label}"/>
${right(34, "d", "ickza.top")}
${text(col(0), 112, "c", `; ${TAGLINE}`)}
<rect class="hx" x="-1" y="${selY}" width="${ADV * 2 + 2}" height="20" fill="${C.string}" fill-opacity=".28"/>
<rect class="as" x="0" y="${selY}" width="${ADV}" height="20" fill="${C.string}" fill-opacity=".28"/>
${dump}`, `${NAME}: ${TAGLINE}`);
}

// ---------- about: a real win64 call ----------

function about() {
  let pc = TEXT;
  const at = (n) => {
    const here = pc;
    pc += n;
    return here;
  };
  const raw = (bytes, mnem, ops, note) => code(at(bytes.length), hex(bytes), mnem, ops, note);

  const LEA = {
    rcx: [0x48, 0x8d, 0x0d],
    rdx: [0x48, 0x8d, 0x15],
    r8: [0x4c, 0x8d, 0x05],
    r9: [0x4c, 0x8d, 0x0d],
    rax: [0x48, 0x8d, 0x05],
  };
  const lea = (reg, i) => {
    const [key, value] = NFO[i];
    const here = at(7);
    const bytes = [...LEA[reg], ...le32(NFO_AT[i] - pc)];
    const name = `a${key[0].toUpperCase()}${key.slice(1)}`;
    return code(here, hex(bytes), "lea", `${reg}, ${name}`, `"${value}"`, "s");
  };

  const start = pc;
  const prologue = raw([0x48, 0x83, 0xec, 0x38], "sub", "rsp, 38h");
  const words = ABOUT.map((parts) => comment(pc, parts));
  const args = ["rcx", "rdx", "r8", "r9", "rax"].map(lea);
  const spill = raw([0x48, 0x89, 0x44, 0x24, 0x20], "mov", "[rsp+20h], rax");
  const callAt = at(5);
  const call = code(callAt, hex([0xe8, ...le32(WHOAMI - pc)]), "call", "whoami");
  const epilogue = raw([0x48, 0x83, 0xc4, 0x38], "add", "rsp, 38h");
  const ret = raw([0xc3], "retn");

  return panel("subroutine", [
    label(start, "about", "proc near"),
    prologue,
    ...words,
    ...args,
    spill,
    call,
    epilogue,
    ret,
    label(pc, "about", "endp"),
  ]);
}

// ---------- posts: strings in .rdata ----------

function posts() {
  const rows = POSTS.map(([date, title], i) => {
    const bytes = cstr(title);
    const shown = hex(bytes.slice(0, 6)) + (bytes.length > 6 ? " .." : "");
    const value = `"${fit(title, COLS - OPS - 18)}",0`;
    return (y) =>
      [
        text(col(0), y, "a", addr(POST_AT[i])),
        text(col(BYTES), y, "b", shown),
        text(col(MNEM), y, "m", "db"),
        text(col(OPS), y, "s", value),
        right(y, "c", `; ${date}`),
      ].join("");
  });
  return panel(".rdata", [label(POST_AT[0], "posts"), ...rows]);
}

// ---------- projects: uninitialised, for now ----------

const projects = () =>
  panel(".bss", [
    label(BSS, "projects"),
    code(BSS, "??", "dq", "?", "; nothing released yet"),
    comment(BSS + 8, [["watch this space", "link"]]),
  ]);

// ---------- live github panels ----------

async function gh(path, token) {
  const headers = { Accept: "application/vnd.github+json", "User-Agent": GH_USER };
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(`https://api.github.com${path}`, { headers });
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
}

async function fetchGitHub() {
  const pub = process.env.GITHUB_TOKEN;
  const priv = process.env.GH_STATS_TOKEN;
  const repos = (
    priv
      ? await gh(`/user/repos?affiliation=owner&per_page=100`, priv)
      : await gh(`/users/${GH_USER}/repos?per_page=100`, pub)
  ).filter((r) => !r.fork && !r.archived);

  // languages: bytes summed across every repo
  const bytes = {};
  for (const r of repos) {
    const langs = await gh(`/repos/${r.full_name}/languages`, priv || pub);
    for (const [k, v] of Object.entries(langs)) bytes[k] = (bytes[k] || 0) + v;
  }

  // git log: latest human commits from the most recently pushed public repos
  const recent = repos
    .filter((r) => !r.private)
    .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at))
    .slice(0, 6);
  const commits = [];
  for (const r of recent) {
    // ?author= misses noreply-email commits, so filter here. The Action's own
    // commits have no linked account, which leaves c.author null for them.
    const list = await gh(`/repos/${r.full_name}/commits?per_page=100`, pub).catch(() => []);
    for (const c of list) {
      if ((c.author?.login ?? c.commit.author.name).endsWith("[bot]")) continue;
      commits.push({ sha: c.sha.slice(0, 7), repo: r.name, msg: c.commit.message.split("\n")[0], date: c.commit.author.date });
    }
  }
  commits.sort((a, b) => new Date(b.date) - new Date(a.date));
  return { bytes, commits: commits.slice(0, 6) };
}

function gitlog(commits) {
  const lines = commits.length
    ? commits.map((c) => (y) => {
        const msgCol = 8 + c.repo.length + 2;
        return (
          text(col(0), y, "a", c.sha) +
          text(col(8), y, "l", c.repo) +
          text(col(msgCol), y, "", fit(c.msg, COLS - msgCol - 13)) +
          right(y, "c", c.date.slice(0, 10))
        );
      })
    : [(y) => text(col(0), y, "d", "; nothing pushed yet.")];
  return panel("git log", [(y) => text(col(0), y, "c", `; ${GH_USER}@github:~$ git log --oneline -n 6`), ...lines]);
}

function langs(bytes) {
  const cols = [C.mnem, C.string, C.label, C.note, C.violet, C.bytes];
  const total = Object.values(bytes).reduce((a, b) => a + b, 0);
  let list = Object.entries(bytes).sort((a, b) => b[1] - a[1]);
  if (list.length > 6) list = [...list.slice(0, 5), ["other", list.slice(5).reduce((a, [, v]) => a + v, 0)]];
  if (!total) return panel("segments", [(y) => text(col(0), y, "d", "; no code yet.")]);

  // the navigation band along the top of a disassembler, one colour per language
  const span = W - 2 * PAD;
  let x = PAD, bar = "";
  list.forEach(([, v], i) => {
    const w = i === list.length - 1 ? W - PAD - x : Math.round((v / total) * span);
    bar += `<rect x="${x}" width="${w}" height="12" fill="${cols[i]}" shape-rendering="crispEdges"/>`;
    x += w;
  });

  const rows = list.map(([k, v], i) => (y) =>
    `<rect x="${col(0)}" y="${y - 11}" width="12" height="12" fill="${cols[i]}" shape-rendering="crispEdges"/>` +
    text(col(3), y, "l", k) +
    text(col(MNEM), y, "b", `0x${v.toString(16).toUpperCase()}`) +
    right(y, "", `${((v / total) * 100).toFixed(1)}%`)
  );

  return panel("segments", [(y) => `<g transform="translate(0 ${y - 12})">${bar}</g>`, ...rows]);
}

// ---------- nav buttons ----------

function button(mnem, label) {
  const fs = 14, adv = fs * 0.6, pad = 14;
  const bw = Math.ceil((mnem.length + 1 + label.length) * adv + pad * 2), bh = 36;
  return svg(bw, bh, `
<style>${REGULAR}
text{font-family:jb,ui-monospace,monospace;font-size:${fs}px;font-variant-ligatures:none;fill:${C.text}}</style>
<rect x=".5" y=".5" width="${bw - 1}" height="${bh - 1}" rx="6" fill="${C.band}" stroke="${C.line}"/>
<text x="${pad}" y="${bh / 2 + 5}"><tspan fill="${C.mnem}">${esc(mnem)}</tspan> ${esc(label)}</text>`, label);
}

// ---------- status bar footer ----------

function footer() {
  const h = 40, y = 25;
  const body = `
<style>${REGULAR}${BASE_CSS}</style>
${card(h, C.band)}
<circle cx="${PAD + 4}" cy="${y - 5}" r="4" fill="${C.note}"/>
${text(PAD + 16, y, "b", "AU: idle")}
${text(col(14), y, "c", `; ${GREETZ}`)}
<text class="d" x="${W - PAD}" y="${y}" text-anchor="end">(c) 2026 ${esc(NAME)} · made by hand <tspan fill="${C.label}">&lt;3</tspan></text>`;
  return svg(W, h, body, "ickza footer");
}

// ---------- write ----------

const out = (name, s) => {
  writeFileSync(new URL(`./assets/${name}`, import.meta.url), s);
  console.log(`assets/${name}  ${(s.length / 1024).toFixed(1)} KB`);
};
mkdirSync(new URL("./assets/", import.meta.url), { recursive: true });
out("header.svg", header());
out("about.svg", about());
out("posts.svg", posts());
out("projects.svg", projects());
for (const [file, mnem, label] of BUTTONS) out(`btn-${file}.svg`, button(mnem, label));
out("footer.svg", footer());

// a failed fetch keeps the last committed gitlog/langs instead of blanking them
try {
  const { bytes, commits } = await fetchGitHub();
  out("gitlog.svg", gitlog(commits));
  out("langs.svg", langs(bytes));
} catch (e) {
  console.warn(`github fetch failed, kept old gitlog/langs: ${e.message}`);
}
