// Builds the animated SVGs in assets/ for the GitHub profile README.
// GitHub strips CSS/JS from READMEs, but SVGs loaded as images keep their
// own <style> animations, so all the demoscene stuff lives in here.
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

const TAGLINE = "> reverse engineering, game internals & tools";

const ABOUT = [
  ["Hey, I'm ", ["ickza", "hi"], ". I write code, break things,"],
  ["and sometimes write about it on ", ["ickza.top", "link"], "."],
  ["Mostly (trying to) reverse engineer, game internals"],
  ["and whatever tool I'm building that week."],
];

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
  ["site", "1", "SITE"],
  ["blog", "2", "BLOG"],
  ["discord", "3", "DISCORD"],
  ["uc", "4", "UC"],
  ["coffee", "5", "COFFEE"],
  ["email", "6", "EMAIL"],
];

const SCROLLER =
  "*** WELCOME TO ICKZA ON GITHUB *** REVERSE ENGINEERING * GAME INTERNALS * TOOLS " +
  "*** POSTS, PROJECTS AND MORE AT ICKZA.TOP *** HIT THE DISCORD IF YOU WANNA TALK SHOP " +
  "*** GREETZ TO EVERYONE AT UNKNOWNCHEATS *** MADE BY HAND, NO TEMPLATES ***";

// ---------- palette / fonts (same as ickza.top) ----------

const C = {
  bg: "#05030c",
  panel: "#08051a",
  text: "#d9d4f5",
  dim: "#6f6a96",
  cyan: "#3ff6ff",
  magenta: "#ff3fa4",
  yellow: "#ffe23f",
  green: "#5dff6b",
};

const font = (name, file) =>
  `@font-face{font-family:${name};src:url(data:font/woff2;base64,${readFileSync(
    new URL(`./assets/fonts/${file}`, import.meta.url)
  ).toString("base64")}) format("woff2")}`;
const PIXEL = font("px", "ps2p.woff2");
const TERM = font("term", "vt323.woff2");

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// deterministic random so rebuilds don't churn the diff
let seed = 1337;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

const svg = (w, h, body, title) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}" shape-rendering="crispEdges">
<title>${esc(title)}</title>
${body}
</svg>
`;

const scanlines = (w, h) => `
<defs>
  <pattern id="scan" width="4" height="3" patternUnits="userSpaceOnUse"><rect y="2" width="4" height="1" fill="#000" fill-opacity=".28"/></pattern>
  <radialGradient id="vig" cx=".5" cy=".5" r=".75"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".65"/></radialGradient>
</defs>
<rect width="${w}" height="${h}" fill="url(#scan)"/>
<rect width="${w}" height="${h}" fill="url(#vig)"/>`;

const stars = (w, h, n) => {
  const cols = ["#ffffff", "#ffffff", "#b4aaff", C.cyan, C.magenta, C.yellow];
  let out = "";
  for (let i = 0; i < n; i++) {
    const big = rnd() < 0.08;
    const c = cols[rnd() < 0.7 ? Math.floor(rnd() * 3) : 3 + Math.floor(rnd() * 3)];
    const d = (0.7 + rnd() * 2).toFixed(2);
    const dl = (-rnd() * 3).toFixed(2);
    out += `<rect class="st" x="${Math.floor(rnd() * w)}" y="${Math.floor(rnd() * h)}" width="${big ? 2 : 1}" height="${big ? 2 : 1}" fill="${c}" style="animation-duration:${d}s;animation-delay:${dl}s"/>`;
  }
  return out;
};
const STAR_CSS = `.st{animation:tw 2s ease-in-out infinite alternate}@keyframes tw{from{opacity:.25}to{opacity:1}}`;
const STILL_CSS = `@media (prefers-reduced-motion:reduce){*{animation:none!important}}`;

// ---------- header ----------

const LOGO = [
  "██╗ ██████╗██╗  ██╗███████╗ █████╗ ",
  "██║██╔════╝██║ ██╔╝╚══███╔╝██╔══██╗",
  "██║██║     █████╔╝   ███╔╝ ███████║",
  "██║██║     ██╔═██╗  ███╔╝  ██╔══██║",
  "██║╚██████╗██║  ██╗███████╗██║  ██║",
  "╚═╝ ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝",
];

function logo(x0, y0, W, H) {
  const ax = 0.3 * W, bx = 0.7 * W, ay = 0.38 * H, by = 0.62 * H;
  // double-line box glyphs as polylines inside one cell
  const glyph = {
    "═": [[[0, ay], [W, ay]], [[0, by], [W, by]]],
    "║": [[[ax, 0], [ax, H]], [[bx, 0], [bx, H]]],
    "╗": [[[0, ay], [bx, ay], [bx, H]], [[0, by], [ax, by], [ax, H]]],
    "╔": [[[W, ay], [ax, ay], [ax, H]], [[W, by], [bx, by], [bx, H]]],
    "╝": [[[0, by], [bx, by], [bx, 0]], [[0, ay], [ax, ay], [ax, 0]]],
    "╚": [[[W, by], [ax, by], [ax, 0]], [[W, ay], [bx, ay], [bx, 0]]],
  };
  let blocks = "", lines = "";
  LOGO.forEach((row, r) => {
    const chars = [...row];
    for (let c = 0; c < chars.length; c++) {
      const x = x0 + c * W, y = y0 + r * H;
      if (chars[c] === "█") {
        let n = 1;
        while (chars[c + n] === "█") n++;
        blocks += `<rect x="${x}" y="${y}" width="${n * W}" height="${H}"/>`;
        c += n - 1;
      } else if (glyph[chars[c]]) {
        for (const p of glyph[chars[c]])
          lines += `<polyline points="${p.map(([px, py]) => `${x + px},${y + py}`).join(" ")}"/>`;
      }
    }
  });
  return { blocks, lines, w: [...LOGO[0]].length * W, h: LOGO.length * H };
}

function header() {
  const w = 840, h = 290;
  const W = 17, H = 27;
  const size = logo(0, 0, W, H);
  const lx = Math.round((w - size.w) / 2) + 6, ly = 34;
  const lg = logo(lx, ly, W, H);
  // VT323 is monospace at 0.4em, so the cursor can step along with the typing
  const tagChars = [...TAGLINE], tfs = 28, adv = tfs * 0.4, step = 0.055, start = 1.1;
  const tx = Math.round((w - (tagChars.length + 1) * adv) / 2), tyY = ly + lg.h + 58;
  const body = `
<style>${TERM}${STAR_CSS}
.crt{transform-box:view-box;transform-origin:420px 145px;animation:on .8s cubic-bezier(.2,.9,.3,1) both}
@keyframes on{0%{transform:scale(1,.004);opacity:0}40%{transform:scale(1,.004);opacity:1}70%{transform:scale(1,1.04)}100%{transform:none}}
.cb{animation:cb 3.2s ease-in-out infinite alternate}
@keyframes cb{from{transform:translateY(0)}to{transform:translateY(${lg.h + 40 - 16}px)}}
.tag{font:${tfs}px term,monospace;fill:${C.green}}
.mv{animation:mv ${(tagChars.length * step).toFixed(3)}s steps(${tagChars.length}, end) ${start}s forwards}
@keyframes mv{to{transform:translateX(${(tagChars.length * adv).toFixed(1)}px)}}
.cur{animation:bl 1s steps(1) infinite}@keyframes bl{50%{opacity:0}}
.top{font:9px px,monospace;fill:${C.dim};letter-spacing:1px}
${STILL_CSS}</style>
<defs>
  <linearGradient id="shim" gradientUnits="userSpaceOnUse" x1="0" y1="${ly}" x2="0" y2="${ly + lg.h * 3}" spreadMethod="repeat">
    <stop offset="0" stop-color="#fff"/><stop offset=".22" stop-color="${C.yellow}"/><stop offset=".5" stop-color="${C.magenta}"/><stop offset=".78" stop-color="${C.cyan}"/><stop offset="1" stop-color="#fff"/>
    <animateTransform attributeName="gradientTransform" type="translate" from="0 0" to="0 ${lg.h * 3}" dur="4s" repeatCount="indefinite"/>
  </linearGradient>
  ${[C.magenta, C.cyan, C.yellow, C.green]
    .map((c, i) => `<linearGradient id="cu${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000"/><stop offset=".3" stop-color="${c}"/><stop offset=".5" stop-color="#fff"/><stop offset=".7" stop-color="${c}"/><stop offset="1" stop-color="#000"/></linearGradient>`)
    .join("\n  ")}
  <filter id="logofx" x="-10%" y="-20%" width="120%" height="150%">
    <feDropShadow dx="0" dy="0" stdDeviation="6" flood-color="${C.magenta}" flood-opacity=".55"/>
    <feDropShadow dx="4" dy="4" stdDeviation="0" flood-color="#000" flood-opacity="1"/>
  </filter>
  <filter id="glow" x="-5%" y="-50%" width="110%" height="200%">
    <feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <clipPath id="typeclip"><rect class="mv" x="${tx - tagChars.length * adv}" y="${tyY - 30}" width="${tagChars.length * adv}" height="40"/></clipPath>
  <clipPath id="cuclip"><rect x="0" y="${ly - 20}" width="${w}" height="${lg.h + 40}"/></clipPath>
</defs>
<rect width="${w}" height="${h}" fill="${C.bg}"/>
<g class="crt">
  ${stars(w, h, 170)}
  <g clip-path="url(#cuclip)" opacity=".72">
    ${[0, 1, 2, 3].map((i) => `<rect class="cb" x="0" y="${ly - 20}" width="${w}" height="16" fill="url(#cu${i})" style="animation-delay:${-0.8 * i}s"/>`).join("\n    ")}
  </g>
  <g filter="url(#logofx)">
    <g fill="url(#shim)">${lg.blocks}</g>
    <g fill="none" stroke="url(#shim)" stroke-width="2.5" shape-rendering="geometricPrecision">${lg.lines}</g>
  </g>
  <g filter="url(#glow)">
    <text class="tag" x="${tx}" y="${tyY}" clip-path="url(#typeclip)">${esc(TAGLINE)}</text>
    <g class="mv"><rect class="cur" x="${tx + 2}" y="${tyY - 21}" width="${Math.round(tfs * 0.5)}" height="${Math.round(tfs * 0.85)}" fill="${C.green}"/></g>
  </g>
  <text class="top" x="14" y="18">ICKZA.TOP</text>
  <text class="top" x="${w - 14}" y="18" text-anchor="end">EST. 2026</text>
</g>
${scanlines(w, h)}`;
  return svg(w, h, body, "ickza: reverse engineering, game internals & tools");
}

// ---------- NFO-style panels ----------

function panel(title, height, inner) {
  const w = 840, h = height;
  return svg(w, h, `
<style>${PIXEL}${TERM}
.t{font:23px term,monospace;fill:${C.text}}
.hi{fill:${C.yellow}}.link{fill:${C.cyan}}.dim{fill:${C.dim}}.ok{fill:${C.green}}
.k{font:23px term,monospace;fill:${C.yellow};text-transform:uppercase}
.v{font:23px term,monospace;fill:${C.cyan}}
.mask{paint-order:stroke;stroke:${C.panel};stroke-width:14px;stroke-linejoin:miter}
.h2{font:12px px,monospace;fill:${C.yellow};letter-spacing:1px}
.pulse{animation:pu 3s ease-in-out infinite alternate}@keyframes pu{from{opacity:.35}to{opacity:.9}}
${STILL_CSS}</style>
<defs><filter id="g" x="-5%" y="-10%" width="110%" height="120%"><feGaussianBlur stdDeviation="7"/></filter></defs>
<rect class="pulse" x="8" y="18" width="${w - 16}" height="${h - 30}" fill="none" stroke="${C.cyan}" stroke-width="4" filter="url(#g)"/>
<rect x="7" y="17" width="${w - 14}" height="${h - 28}" fill="${C.bg}" stroke="${C.cyan}" stroke-width="2"/>
<rect x="13" y="23" width="${w - 26}" height="${h - 40}" fill="${C.panel}" stroke="${C.magenta}" stroke-width="2"/>
<rect x="22" y="12" width="${(title.length + 2) * 13 + 18}" height="18" fill="${C.bg}"/>
<text class="h2" x="32" y="27"><tspan fill="${C.magenta}">» </tspan>${esc(title.toUpperCase())}</text>
${inner}`, title);
}

const rows = (list, y0, keyCls = "k", valCls = "v") =>
  list
    .map(([k, v], i) => {
      const y = y0 + i * 30;
      return `<line x1="40" y1="${y - 5}" x2="800" y2="${y - 5}" stroke="${C.dim}" stroke-width="2" stroke-dasharray="2 4"/>
<text class="${keyCls} mask" x="40" y="${y}">${esc(k)}</text>
<text class="${valCls} mask" x="800" y="${y}" text-anchor="end">${esc(v)}</text>`;
    })
    .join("\n");

function about() {
  const text = ABOUT.map(
    (parts, i) =>
      `<text class="t" x="40" y="${70 + i * 30}">${parts
        .map((p) => (Array.isArray(p) ? `<tspan class="${p[1]}">${esc(p[0])}</tspan>` : esc(p)))
        .join("")}</text>`
  ).join("\n");
  const y0 = 70 + ABOUT.length * 30 + 30;
  return panel("about", y0 + NFO.length * 30 + 20, text + "\n" + rows(NFO, y0));
}

const posts = () => panel("latest posts", 70 + POSTS.length * 30 + 20, rows(POSTS, 72));

const projects = () =>
  panel("projects", 112, `<text class="t dim" x="40" y="72">Nothing released yet. <tspan class="link">Watch this space.</tspan></text>`);

// ---------- live github panels ----------

const ADV = 9.2; // VT323 at 23px is monospace, 0.4em per char

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
    const list = await gh(`/repos/${r.full_name}/commits?per_page=10`, pub).catch(() => []);
    for (const c of list) {
      if (c.author?.login?.endsWith("[bot]")) continue;
      commits.push({ sha: c.sha.slice(0, 7), repo: r.name, msg: c.commit.message.split("\n")[0], date: c.commit.author.date });
    }
  }
  commits.sort((a, b) => new Date(b.date) - new Date(a.date));
  return { bytes, commits: commits.slice(0, 6) };
}

function gitlog(commits) {
  const y0 = 108;
  const lines = commits.length
    ? commits
        .map((c, i) => {
          const y = y0 + i * 30;
          const msgX = 40 + (8 + c.repo.length + 1) * ADV;
          const max = Math.floor((800 - 12 * ADV - msgX) / ADV);
          const msg = c.msg.length > max ? c.msg.slice(0, max - 1) + "…" : c.msg;
          return `<text class="t" x="40" y="${y}"><tspan fill="${C.magenta}">${c.sha}</tspan> <tspan class="link">${esc(c.repo)}</tspan> ${esc(msg)}</text>
<text class="t dim" x="800" y="${y}" text-anchor="end">${c.date.slice(0, 10)}</text>`;
        })
        .join("\n")
    : `<text class="t dim" x="40" y="${y0}">nothing pushed yet.</text>`;
  const n = Math.max(1, commits.length);
  return panel("git log", y0 + (n - 1) * 30 + 48, `
<text class="t ok" x="40" y="72">${GH_USER}@github:~$ <tspan class="hi">git log --oneline -n 6</tspan></text>
${lines}`);
}

function langs(bytes) {
  const cols = [C.cyan, C.magenta, C.yellow, C.green, "#b4aaff", "#ff8a3f"];
  const total = Object.values(bytes).reduce((a, b) => a + b, 0);
  let list = Object.entries(bytes).sort((a, b) => b[1] - a[1]);
  if (list.length > 6) list = [...list.slice(0, 5), ["other", list.slice(5).reduce((a, [, v]) => a + v, 0)]];
  if (!total) return panel("languages", 112, `<text class="t dim" x="40" y="72">no code yet.</text>`);

  // stacked bar, grows in from the left
  let x = 40, bar = "";
  list.forEach(([, v], i) => {
    const w = i === list.length - 1 ? 800 - x : Math.round((v / total) * 760);
    bar += `<rect x="${x}" y="54" width="${w}" height="18" fill="${cols[i]}"/>`;
    x += w;
  });

  // two columns of name ... pct
  const y0 = 112, half = Math.ceil(list.length / 2);
  const rowsSvg = list
    .map(([k, v], i) => {
      const col = i < half ? 0 : 1, y = y0 + (i % half) * 30;
      const x0 = col ? 440 : 40, x1 = col ? 800 : 400;
      const pct = ((v / total) * 100).toFixed(1) + "%";
      return `<line x1="${x0}" y1="${y - 5}" x2="${x1}" y2="${y - 5}" stroke="${C.dim}" stroke-width="2" stroke-dasharray="2 4"/>
<rect x="${x0}" y="${y - 15}" width="14" height="14" fill="${cols[i]}"/>
<text class="k mask" x="${x0 + 22}" y="${y}">${esc(k)}</text>
<text class="v mask" x="${x1}" y="${y}" text-anchor="end">${pct}</text>`;
    })
    .join("\n");

  return panel("languages", y0 + (half - 1) * 30 + 48, `
<style>.grow{transform-box:view-box;transform-origin:40px 0;animation:gr 1.2s steps(16) both}@keyframes gr{from{transform:scaleX(0)}}</style>
<rect x="38" y="52" width="764" height="22" fill="none" stroke="${C.dim}" stroke-width="2"/>
<g class="grow">${bar}</g>
${rowsSvg}`);
}

// ---------- nav buttons ----------

function button(num, label) {
  // Press Start 2P is a square monospace font: advance = font-size
  const fs = 12, pad = 14, txt = `${num} ${label}`;
  const bw = txt.length * fs + pad * 2, bh = 40, sh = 5;
  return svg(bw + sh + 2, bh + sh + 2, `
<style>${PIXEL}
.b{font:${fs}px px,monospace;fill:${C.cyan}}
.sh{animation:sh 2.4s steps(1) infinite}@keyframes sh{50%{fill:${C.cyan}}}
${STILL_CSS}</style>
<rect class="sh" x="${1 + sh}" y="${1 + sh}" width="${bw}" height="${bh}" fill="${C.magenta}" style="animation-delay:${-0.4 * Number(num)}s"/>
<rect x="1" y="1" width="${bw}" height="${bh}" fill="${C.panel}" stroke="${C.cyan}" stroke-width="2"/>
<text class="b" x="${1 + pad}" y="${1 + bh / 2 + fs / 2}"><tspan fill="${C.yellow}">${num}</tspan> ${esc(label)}</text>`, label);
}

// ---------- sine scroller footer ----------

function footer() {
  const w = 840, h = 150, fs = 26, cw = fs;
  const chars = [...SCROLLER];
  const tw = chars.length * cw;
  const speed = 130; // px per second
  const dur = ((w + tw) / speed).toFixed(2);
  const letters = chars
    .map((ch, i) => (ch === " " ? "" : `<text x="${i * cw}" y="70" style="animation-delay:${(-i * 0.09).toFixed(2)}s">${esc(ch)}</text>`))
    .join("");
  const body = `
<style>${PIXEL}${TERM}${STAR_CSS}
.sc{animation:sc ${dur}s linear infinite}@keyframes sc{from{transform:translateX(${w}px)}to{transform:translateX(${-tw}px)}}
.sc text{font:${fs}px px,monospace;fill:#fff;animation:wv 1.6s ease-in-out infinite alternate}
@keyframes wv{from{transform:translateY(-20px)}to{transform:translateY(20px)}}
.ft{font:21px term,monospace;fill:${C.dim}}
.hu{animation:hu 6s linear infinite}@keyframes hu{from{transform:translateX(0)}to{transform:translateX(-${w}px)}}
${STILL_CSS}</style>
<defs>
  <linearGradient id="rb" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${w}" y2="0" spreadMethod="repeat">
    <stop offset="0" stop-color="${C.cyan}"/><stop offset=".25" stop-color="${C.magenta}"/><stop offset=".5" stop-color="${C.yellow}"/><stop offset=".75" stop-color="${C.green}"/><stop offset="1" stop-color="${C.cyan}"/>
  </linearGradient>
  <mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}"><g class="sc">${letters}</g></mask>
  <filter id="sd" x="-5%" y="-30%" width="110%" height="160%"><feDropShadow dx="3" dy="3" stdDeviation="0" flood-color="#000"/><feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="${C.magenta}" flood-opacity=".5"/></filter>
</defs>
<rect width="${w}" height="${h}" fill="${C.bg}"/>
${stars(w, h, 70)}
<rect y="8" width="${w}" height="2" fill="url(#rb)" opacity=".8"/>
<g filter="url(#sd)"><g mask="url(#m)"><rect class="hu" x="0" y="0" width="${w * 2}" height="${h}" fill="url(#rb)"/></g></g>
<rect y="${h - 44}" width="${w}" height="2" fill="url(#rb)" opacity=".8"/>
<text class="ft" x="${w / 2}" y="${h - 14}" text-anchor="middle">(c) 2026 ickza · made by hand <tspan fill="${C.magenta}">&lt;3</tspan></text>
${scanlines(w, h)}`;
  return svg(w, h, body, "ickza footer scroller");
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
for (const [file, num, label] of BUTTONS) out(`btn-${file}.svg`, button(num, label));
out("footer.svg", footer());

// a failed fetch keeps the last committed gitlog/langs instead of blanking them
try {
  const { bytes, commits } = await fetchGitHub();
  out("gitlog.svg", gitlog(commits));
  out("langs.svg", langs(bytes));
} catch (e) {
  console.warn(`github fetch failed, kept old gitlog/langs: ${e.message}`);
}
