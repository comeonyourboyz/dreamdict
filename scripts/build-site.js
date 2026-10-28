// 정적 사이트 빌드: data/keywords.json + data/entries/*.json → public/
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'public');
const SITE = {
  url: 'https://dreamdict.web.app',
  name: '꿈해몽 사전',
  nameEn: 'DreamDict',
  desc: '꿈에 나온 것을 검색하면 길몽·흉몽 판정과 상황별 해몽을 바로 알려드리는 꿈해몽 사전입니다.',
  ogImage: 'https://dreamdict.web.app/og-image.png',
  launch: '2026-09-10',
  kakaoKey: '20fa9624337a5f9b11b0fe995708b754',
  adsense: 'ca-pub-5479403345572412', // 2026-10-13 애드센스 승인. 자동 광고라 스크립트만 둔다
  gsv: ['8nUCFYxTph7TOTN0ZC0zWvamYgyQMd026qCLSBL9YgE', 'WjzFs7iu4kDSzcJKM5QyAqGDAqx9J1P0uj-Ry4z1_NU'], // Search Console 인증 토큰(계정별). 어느 계정으로도 인증되게 모두 둔다
};
const TODAY = new Date().toISOString().slice(0, 10);
const ASSET_V = createHash('md5').update(readFileSync(join(root, 'site', 'style.css')) ).update(readFileSync(join(root, 'site', 'app.js'))).digest('hex').slice(0, 8);
// 제목 픽셀폭 근사(한글 16px, 그 외 8px) — 모바일 잘림선 485px 안에 맞춘다.
const titlePx = (s) => [...s].reduce((a, c) => a + (c.codePointAt(0) > 0x1100 ? 16 : 8), 0);
const fitTitle = (t, budget = 485) => {
  if (titlePx(t) <= budget) return t;
  const i = t.indexOf(' — ');
  if (i > 0 && titlePx(t.slice(0, i)) <= budget) return t.slice(0, i);
  return t;
};

const VERDICT = { good: '길몽', bad: '흉몽', mixed: '상황에 따라', neutral: '중립' };
const POPULAR = ['snake','teeth-falling','poop','dead-person','fire','water','money','pig','fish','baby','ex-lover','flying','chased','blood','dragon','gold','car-accident','wedding','pregnancy','hair-falling','tiger','house','ghost','exam','falling'];

// ---------- load ----------
const { keywords, categories } = JSON.parse(readFileSync(join(root, 'data', 'keywords.json'), 'utf8'));
const catById = new Map(categories.map((c) => [c.id, c]));
const entries = [];
const warnings = [];
const entriesDir = join(root, 'data', 'entries');
if (existsSync(entriesDir)) for (const f of readdirSync(entriesDir).filter((f) => f.endsWith('.json')).sort()) {
  try { for (const e of JSON.parse(readFileSync(join(entriesDir, f), 'utf8'))) entries.push(e); }
  catch (err) { warnings.push(`${f}: JSON 파싱 실패 → 건너뜀 (${err.message.split('\n')[0]})`); }
}
const byId = new Map(entries.map((e) => [e.id, e]));
const ko = (a, b) => a.keyword.localeCompare(b.keyword, 'ko');
entries.sort(ko);
const byCat = new Map(categories.map((c) => [c.id, entries.filter((e) => e.category === c.id)]));

// ---------- helpers ----------
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const urlDream = (e) => encodeURI(`/dream/${e.slug}/`);
// 목록형 허브 중 고유 서술이 거의 없는 경로는 색인에서 뺀다(링크는 따라가게 둠).
// 2026-10 salaryrank '가치가 별로 없는 콘텐츠' 거절 후 같은 기준으로 진단해 고른 경로.
const NOINDEX_PATHS = ['/category/'];
const isNoindex = (p) => NOINDEX_PATHS.some((x) => p.startsWith(x));
const urlCat = (c) => `/category/${c.id}/`;
const urlTag = (t) => encodeURI(`/tag/${t}/`);
const urlVerdict = (v) => `/verdict/${v}/`;
const abs = (p) => SITE.url + p;
// 판정 표기: 색은 길몽 세이지·흉몽 장밋빛·상황에 따라 라벤더·중립 회청(style.css 토큰)
const VC = { good: 'g', bad: 'b', mixed: 'm', neutral: 'n' };
const VORDER = ['good', 'bad', 'mixed', 'neutral'];
const vtext = (v) => `<span class="v v-${VC[v]}">${VERDICT[v]}</span>`;
const vpill = (v) => `<span class="verdict v-${VC[v]}"><i class="dot" aria-hidden="true"></i>${VERDICT[v]}</span>`;
const short = (kw) => kw.replace(/\s꿈$/, '');
const paras = (t) => t.split(/\n{2,}/).map((p) => `<p>${esc(p.trim())}</p>`).join('');
const jsonld = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;
let htmlPages = 0;
const write = (rel, html) => { const p = join(OUT, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, html); if (rel.endsWith('.html') && rel !== '404.html') htmlPages++; };
const countV = (list) => { const o = {}; for (const x of list) o[x.verdict] = (o[x.verdict] ?? 0) + 1; return o; };
// 판정 분포 막대 + 범례. label 은 스크린리더용 설명 앞부분
function tally(list, label, linked = false) {
  const c = countV(list); const vs = VORDER.filter((v) => c[v]);
  const desc = `${label} ${list.length}개 중 ${vs.map((v) => `${VERDICT[v]} ${c[v]}`).join(', ')}`;
  return `<div class="tally" role="img" aria-label="${esc(desc)}">${vs.map((v) => `<i style="flex:${c[v]}" class="bg-${VC[v]}"></i>`).join('')}</div>
<div class="tally-l">${vs.map((v) => linked ? `<a class="v-${VC[v]}" href="${urlVerdict(v)}">${VERDICT[v]} ${c[v]}</a>` : `<span class="v-${VC[v]}">${VERDICT[v]} ${c[v]}</span>`).join('')}</div>`;
}
// 꿈 카드(요약 포함) — 목록·다른 꿈 섹션 공용
const cards = (list, cls = '') => `<div class="cards${cls}">${list.map((e) => `<a href="${urlDream(e)}"><span class="row"><span class="ttl">${esc(e.keyword)}</span>${vtext(e.verdict)}</span><span class="sm">${esc(e.summary)}</span></a>`).join('')}</div>`;
const leaders = (list, cur) => list.map((e) => `<li><a href="${urlDream(e)}"${e === cur ? ' aria-current="page" class="is-cur"' : ''}><span class="nm">${esc(short(e.keyword))}</span><span class="ld" aria-hidden="true"></span>${vtext(e.verdict)}</a></li>`).join('');
const SEARCH_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
const searchBox = (cls, ph, id) => `<div class="srch ${cls}" role="search"><label class="sr" for="${id}">꿈 검색</label>${SEARCH_ICON}<input id="${id}" type="search" placeholder="${ph}" autocomplete="off"><div class="dd"></div></div>`;

// 왼쪽 색인: 카테고리 + (현재 카테고리의 꿈 | 판정·주제 바로가기)
function sideIndex({ cat = null, entry = null } = {}) {
  let h = `<div class="idx-h">카테고리 <span>${entries.length}</span></div>
<ul class="cats">${categories.map((c) => `<li><a href="${urlCat(c)}"${cat && c.id === cat.id ? ' aria-current="true"' : ''}>${esc(c.name)}<span class="n">${(byCat.get(c.id) ?? []).length}</span></a></li>`).join('')}</ul>`;
  if (cat && entry) {
    const list = byCat.get(cat.id) ?? []; const c = countV(list);
    h += `<div class="idx-h">${esc(cat.name)}의 꿈 <span>${list.length}</span></div>
<div class="vfilter">${VORDER.filter((v) => c[v]).map((v) => `<span><i class="dot bg-${VC[v]}" aria-hidden="true"></i> ${VERDICT[v]} ${c[v]}</span>`).join('')}</div>
<ul class="dlist">${leaders(list, entry)}</ul>
<a class="dl-all" href="${urlCat(cat)}">${esc(cat.name)} 꿈 ${list.length}개 모두 보기</a>`;
  } else {
    h += `<div class="idx-h">판정별 <span>${entries.length}</span></div>
<ul class="cats">${VORDER.map((v) => `<li><a href="${urlVerdict(v)}"><i class="dot bg-${VC[v]}" aria-hidden="true"></i>${VERDICT[v]}<span class="n">${(byVerdict.get(v) ?? []).length}</span></a></li>`).join('')}</ul>
<div class="idx-h">주제별</div>
<div class="taglist">${TAGS.filter((t) => byTag.get(t).length).map((t) => `<a href="${urlTag(t)}">#${t} <span>${byTag.get(t).length}</span></a>`).join('')}</div>`;
  }
  return `<nav class="index" aria-label="꿈 색인">${h}</nav>`;
}

const VERDICT_DESC = {
  good: '재물·행운·좋은 인연을 예고한다고 전해지는 길몽들을 모았습니다.',
  bad: '경고나 주의를 뜻하는 흉몽들을 모았습니다. 흉몽은 대개 "지금 마음을 돌아보라"는 신호입니다.',
  mixed: '꿈속 상황에 따라 길몽도 흉몽도 될 수 있는 꿈들입니다. 상세 페이지의 상황별 해몽을 꼭 확인하세요.',
  neutral: '특별한 길흉보다 현재 심리 상태를 비추는 중립적인 꿈들입니다.',
};
const TAGS = ['재물', '건강', '연애', '가족', '직장', '학업', '인간관계', '변화', '경고', '행운', '심리', '태몽'];
const byTag = new Map(TAGS.map((t) => [t, entries.filter((e) => e.tags.includes(t))]));
const byVerdict = new Map(Object.keys(VERDICT).map((v) => [v, entries.filter((e) => e.verdict === v)]));

// 게시자 콘텐츠가 없거나 적은 화면(404·개인정보처리방침·문의·소개)에는 광고 스크립트를 넣지 않는다(애드센스 정책).
// 계정 소유 확인은 google-adsense-account 메타로 모든 페이지에 유지한다.
const NO_AD_PATHS = ['/404.html', '/privacy/', '/contact/', '/about/'];
const TOOLS = [
  ['꿈해몽 사전', 'https://dreamdict.web.app'], ['내 연봉 순위', 'https://salaryrank.web.app'], ['오늘의 운세', 'https://todays-fortune-app.vercel.app'],
  ['My Korean Name', 'https://mykoreanname.web.app'], ['Tangerine 10', 'https://tangerin10.web.app'], ['선물 룰렛', 'https://giftwheel.web.app'],
  ['실내식물 사전', 'https://plantdict.web.app'], ['사자성어·속담 사전', 'https://idiomdict.web.app'],
];
// body 는 가운데 열, index 는 왼쪽 색인(기본: 판정·주제 바로가기), aside 는 오른쪽 열(없으면 2단)
function layout({ title, desc, path, body, ld = [], type = 'website', share, index, aside = '', asideCls = '', after = '', home = false }) {
  const url = abs(path);
  const shareObj = share ?? { title, desc, url, image: SITE.ogImage, kakaoKey: SITE.kakaoKey };
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta name="robots" content="${isNoindex(path) ? 'noindex, follow' : 'index, follow'}">
<meta name="theme-color" content="#121a2b">
<meta name="color-scheme" content="dark">
${SITE.gsv.map((t) => `<meta name="google-site-verification" content="${t}">`).join('\n')}
<meta name="google-adsense-account" content="${SITE.adsense}">
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="${SITE.name}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE.ogImage}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="꿈해몽 사전">
<meta property="og:locale" content="ko_KR">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${SITE.ogImage}">
<link rel="icon" href="/favicon.ico" sizes="any"><link rel="icon" type="image/png" href="/favicon.png" sizes="512x512"><link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&display=swap">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css">
<link rel="stylesheet" href="/assets/style.css?v=${ASSET_V}">
${ld.map(jsonld).join('\n')}
${NO_AD_PATHS.includes(path) ? '' : `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${SITE.adsense}" crossorigin="anonymous"></script>\n`}<script src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js"></script>
</head>
<body>
<a class="skip" href="#main">본문 바로가기</a>
<header class="top${home ? ' is-home' : ''}"><div class="wrap">
  <a class="brand" href="/">${SITE.name} <small>${SITE.nameEn}</small></a>
  ${searchBox('hdr-srch', '어젯밤 꿈에 나온 것을 검색 — 뱀, 이빨, 돈', 'q-top')}
  <div class="top-meta"><span>${entries.length.toLocaleString()}개의 꿈 · ${categories.length}개 카테고리</span><button type="button" class="linkish" data-rand>아무 꿈이나 하나 보기</button></div>
</div></header>
<div class="wrap">
<div class="page${aside ? (asideCls === 'toc' ? ' has-toc' : '') : ' no-aside'}">
${index ?? sideIndex()}
<main class="article" id="main">
${body}
</main>
${aside ? `<aside class="aside${asideCls ? ` ${asideCls}` : ''}"${asideCls === 'toc' ? ' aria-label="이 페이지의 내용"' : ''}>${aside}</aside>` : ''}
</div>
${after}
</div>
<footer class="foot"><div class="wrap foot-grid">
  <div>
    <a class="brand" href="/">${SITE.name}</a>
    <div class="foot-links"><a href="/privacy/">개인정보처리방침</a><a href="/about/">사이트 소개</a><a href="/contact/">문의하기</a></div>
    <div class="foot-cats"><a href="/">홈</a>${categories.map((c) => `<a href="${urlCat(c)}">${esc(c.name)}</a>`).join('')}</div>
  </div>
  <div>
    <p class="tools-h">comeonyourboyz가 만든 다른 도구</p>
    <ul class="tools">${TOOLS.map(([n, u]) => `<li><a href="${u}"${u === SITE.url ? ' aria-current="page"' : ''}>${n}</a></li>`).join('')}</ul>
    <p>해몽은 전통 민속과 심리학적 해석을 참고한 것으로 재미로 보아 주세요. © ${TODAY.slice(0, 4)} ${SITE.name}</p>
  </div>
</div></footer>
<script>window.__SHARE__=${JSON.stringify(shareObj).replace(/</g, '\\u003c')};</script>
<script src="/assets/app.js?v=${ASSET_V}" defer></script>
</body>
</html>`;
}

// ---------- pages ----------
function pageIndex() {
  const popular = POPULAR.map((id) => byId.get(id)).filter(Boolean);
  const fill = entries.filter((e) => !popular.includes(e)).slice(0, Math.max(0, 20 - popular.length));
  const pop = [...popular, ...fill].slice(0, 20);
  const body = `
<section class="hero">
  <h1>어젯밤 꿈, 무슨 뜻일까?</h1>
  <p class="sub">꿈에 나온 것을 검색하면 길몽·흉몽 판정과 상황별 해몽을 바로 알려드려요.</p>
  ${searchBox('big', '예: 뱀, 이빨 빠지는, 똥', 'q-hero')}
  <div class="hero-meta"><button class="linkish" id="randBtn" type="button" data-rand>아무 꿈이나 하나 보기</button><span>${entries.length.toLocaleString()}개의 꿈 · ${categories.length}개 카테고리</span></div>
</section>
<h2>많이 찾는 꿈</h2>
<p class="h2-note">사람들이 자주 찾아보는 꿈부터 모았습니다.</p>
<ul class="rel cols">${pop.map((e) => `<li><a href="${urlDream(e)}"><span class="nm">${esc(e.keyword)}</span><span class="ld" aria-hidden="true"></span>${vtext(e.verdict)}</a></li>`).join('')}</ul>
<h2>카테고리</h2>
<p class="h2-note">카테고리마다 길몽·흉몽 비율이 다릅니다.</p>
<ol class="catlist">${categories.map((c) => { const l = byCat.get(c.id) ?? []; return `<li><a href="${urlCat(c)}"><span class="cn">${esc(c.name)}</span><span class="cc">${l.length}개의 꿈</span><span class="cb">${tally(l, c.name)}</span></a></li>`; }).join('')}</ol>
<h2>꿈 해몽, 이렇게 보세요</h2>
<div class="body"><p>같은 뱀 꿈이라도 뱀이 나를 물었는지, 집으로 들어왔는지, 색이 무엇이었는지에 따라 해석이 갈립니다. 이 사전은 꿈 하나마다 기본 해석과 함께 <b>상황별 변형</b>을 따로 정리해, 내 꿈에 가장 가까운 풀이를 찾을 수 있게 했습니다.</p>
<p>해몽은 전통 민속의 상징 풀이와 현대 심리학의 해석을 함께 담았습니다. 길몽이라 해서 로또를 사거나, 흉몽이라 해서 걱정하실 필요는 없습니다. 지금 내 마음이 어디에 머물러 있는지 들여다보는 계기로 가볍게 활용해 주세요.</p></div>`;
  const aside = `<section><h2 class="a-h">길몽·흉몽 모아보기</h2>${tally(entries, '전체 꿈', true)}
<ul class="glance">${VORDER.map((v) => `<li><a href="${urlVerdict(v)}">${VERDICT[v]} 모아보기<span class="v v-${VC[v]}">${(byVerdict.get(v) ?? []).length}개</span></a></li>`).join('')}</ul></section>
<section><h2 class="a-h">주제별</h2><div class="taglist">${TAGS.filter((t) => byTag.get(t).length).map((t) => `<a href="${urlTag(t)}">#${t} <span>${byTag.get(t).length}</span></a>`).join('')}</div></section>`;
  const ld = [
    { '@context': 'https://schema.org', '@type': 'WebSite', name: SITE.name, alternateName: ['꿈해몽사전', 'DreamDict'], url: `${SITE.url}/`, description: SITE.desc, inLanguage: 'ko',
      potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: `${SITE.url}/?q={search_term_string}` }, 'query-input': 'required name=search_term_string' } },
  ];
  return layout({ title: `${SITE.name} — 뱀 꿈, 이빨 빠지는 꿈, 똥 꿈 해몽 검색`, desc: SITE.desc, path: '/', body, ld, aside, home: true,
    index: `<nav class="index home-index" aria-label="꿈 색인"><div class="idx-h">카테고리 <span>${entries.length}</span></div><ul class="cats">${categories.map((c) => `<li><a href="${urlCat(c)}">${esc(c.name)}<span class="n">${(byCat.get(c.id) ?? []).length}</span></a></li>`).join('')}</ul></nav>` });
}

// 목록형 화면(카테고리·태그·판정) 공용 본문
const listBody = ({ crumbs, kicker, h1, lead, list }) => `
<nav class="crumb" aria-label="현재 위치">${crumbs}</nav>
${kicker ? `<div class="kicker">${kicker}</div>` : ''}
<h1>${h1}</h1>
<p class="lead">${esc(lead)}</p>
${list.length ? cards(list, ' two') : '<div class="empty">준비 중입니다.</div>'}`;
const SEP = '<span class="sep" aria-hidden="true">›</span>';

function pageCategory(c) {
  const list = byCat.get(c.id) ?? [];
  const body = listBody({ crumbs: `<a href="/">홈</a>${SEP}<span>${esc(c.name)}</span>`, kicker: `<span>${list.length}개의 꿈</span>`, h1: `${esc(c.name)} 꿈 해몽`,
    lead: `${c.name} 관련 꿈 ${list.length}개의 해몽을 모았습니다. 길몽·흉몽 판정을 먼저 확인하고, 상세 페이지에서 상황별 풀이를 살펴보세요.`, list });
  const aside = `<section><h2 class="a-h">${esc(c.name)} 판정 한눈에</h2>${tally(list, `${c.name} 꿈`)}</section>
<section><h2 class="a-h">길몽·흉몽 모아보기</h2><ul class="glance">${VORDER.map((v) => `<li><a href="${urlVerdict(v)}">${VERDICT[v]} 모아보기<span class="v v-${VC[v]}">${(byVerdict.get(v) ?? []).length}개</span></a></li>`).join('')}</ul></section>`;
  const ld = [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: `${c.name} 꿈 해몽`, url: abs(urlCat(c)), inLanguage: 'ko',
    hasPart: list.slice(0, 50).map((e) => ({ '@type': 'Article', headline: e.title, url: abs(urlDream(e)) })) },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: '홈', item: SITE.url + '/' }, { '@type': 'ListItem', position: 2, name: c.name, item: abs(urlCat(c)) }] }];
  return layout({ title: `${c.name} 꿈 해몽 ${list.length}개`, desc: `${c.name} 관련 꿈 해몽 ${list.length}개. ${list.slice(0, 6).map((e) => e.keyword).join(', ')} 등 길몽·흉몽 판정과 상황별 해석.`, path: urlCat(c), body, ld, aside, index: sideIndex({ cat: c }) });
}

function pageDream(e) {
  const c = catById.get(e.category);
  const related = e.related.map((id) => byId.get(id)).filter(Boolean);
  const sameCat = (byCat.get(e.category) ?? []).filter((x) => x.id !== e.id);
  const idx = sameCat.findIndex((x) => x.keyword.localeCompare(e.keyword, 'ko') > 0);
  const around = idx < 0 ? sameCat.slice(-6) : sameCat.slice(Math.max(0, idx - 3), idx + 3);
  const path = urlDream(e);
  const isDreamWord = /꿈$/.test(e.keyword); // 예지몽·태몽·악몽 등은 "해몽"을 덧붙이지 않음
  const h1 = isDreamWord ? `${e.keyword} 해몽` : e.keyword;
  const h2 = isDreamWord ? `상황별 ${e.keyword} 해몽` : `${e.keyword} 상황별 풀이`;
  const sub = e.title.includes(' — ') ? e.title.split(' — ').slice(1).join(' — ') : '';
  const body = `
<nav class="crumb" aria-label="현재 위치"><a href="/">홈</a>${SEP}<a href="${urlCat(c)}">${esc(c.name)}</a>${SEP}<span>${esc(e.keyword)}</span></nav>
<div class="kicker">${vpill(e.verdict)}<a href="${urlCat(c)}">${esc(c.name)}</a></div>
<h1>${esc(h1)}</h1>
${sub ? `<p class="sub">${esc(sub)}</p>` : ''}
<p class="lead">${esc(e.summary)}</p>
<div class="prose"><section class="part" aria-label="해몽 풀이"><div class="part-l">해몽 풀이</div><div>${paras(e.meaning)}</div></section></div>
<h2 id="cases">${esc(h2)}</h2>
<p class="h2-note">같은 꿈이라도 장면에 따라 판정이 달라집니다.</p>
<ol class="cases">${e.variants.map((v, i) => `<li class="case" id="c${i + 1}"><div class="case-v v-${VC[v.verdict]}"><i class="dot" aria-hidden="true"></i>${VERDICT[v.verdict]}</div><div><h3>${esc(v.situation)}</h3><p>${esc(v.meaning)}</p></div></li>`).join('')}</ol>
<div class="tags">${e.tags.map((t) => `<a href="${urlTag(t)}">#${esc(t)}</a>`).join('')}<a class="more" href="${urlVerdict(e.verdict)}">${VERDICT[e.verdict]} 모아보기</a></div>
<div class="share" aria-label="공유하기">
  <button class="sh" type="button" onclick="shareKakao()" aria-label="카카오톡 공유">카카오톡</button>
  <button class="sh" type="button" onclick="shareX()" aria-label="X 공유">X</button>
  <button class="sh" type="button" onclick="shareFB()" aria-label="페이스북 공유">페이스북</button>
  <button class="sh" type="button" onclick="copyLink()" aria-label="링크 복사">링크 복사</button>
</div>`;
  const aside = `<section><h2 class="a-h">상황별 판정 한눈에</h2>${tally(e.variants, '상황')}
<ul class="glance">${e.variants.map((v, i) => `<li><a href="#c${i + 1}">${esc(v.situation)}${vtext(v.verdict)}</a></li>`).join('')}</ul></section>
${related.length ? `<section><h2 class="a-h">함께 보는 꿈</h2><ul class="rel">${related.map((r) => `<li><a href="${urlDream(r)}"><span class="nm">${esc(r.keyword)}</span><span class="ld" aria-hidden="true"></span>${vtext(r.verdict)}</a></li>`).join('')}</ul></section>` : ''}`;
  const after = around.length ? `<section class="more-sec" aria-labelledby="more-h"><div class="more-head"><h2 id="more-h">${esc(c.name)}의 다른 꿈</h2><a href="${urlCat(c)}">${esc(c.name)} 전체 보기</a></div>${cards(around)}</section>` : '';
  const ld = [
    { '@context': 'https://schema.org', '@type': 'Article', headline: e.title, description: e.summary, inLanguage: 'ko', mainEntityOfPage: abs(path), image: SITE.ogImage,
      datePublished: SITE.launch, dateModified: TODAY, author: { '@type': 'Organization', name: SITE.name, url: SITE.url }, publisher: { '@type': 'Organization', name: SITE.name, url: SITE.url }, keywords: e.searchTerms.join(', '), articleSection: c.name },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: e.variants.map((v) => ({ '@type': 'Question', name: `${v.situation}은 무슨 뜻인가요?`, acceptedAnswer: { '@type': 'Answer', text: v.meaning } })) },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: '홈', item: SITE.url + '/' }, { '@type': 'ListItem', position: 2, name: c.name, item: abs(urlCat(c)) }, { '@type': 'ListItem', position: 3, name: e.keyword, item: abs(path) }] },
  ];
  return layout({ title: fitTitle(e.title), desc: e.summary, path, body, ld, type: 'article', aside, after, index: sideIndex({ cat: c, entry: e }),
    share: { title: `${e.keyword} 해몽 — ${VERDICT[e.verdict]}`, desc: e.summary, url: abs(path), image: SITE.ogImage, kakaoKey: SITE.kakaoKey } });
}

function pageList({ path, crumb, kicker, h1, lead, list, title, desc, aside }) {
  const body = listBody({ crumbs: `<a href="/">홈</a>${SEP}<span>${esc(crumb)}</span>`, kicker, h1, lead, list });
  const ld = [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: crumb, url: abs(path), inLanguage: 'ko',
    hasPart: list.slice(0, 50).map((e) => ({ '@type': 'Article', headline: e.title, url: abs(urlDream(e)) })) }];
  return layout({ title, desc, path, body, ld, aside });
}
const pageTag = (t) => pageList({ path: urlTag(t), crumb: `#${t}`, kicker: `<span>주제 · ${byTag.get(t).length}개의 꿈</span>`, h1: `#${esc(t)} 관련 꿈 해몽`, lead: `${t} 관련 꿈 ${byTag.get(t).length}개입니다. 길몽·흉몽 판정을 확인하고 상세 해몽을 살펴보세요.`, list: byTag.get(t),
  aside: `<section><h2 class="a-h">#${esc(t)} 판정 한눈에</h2>${tally(byTag.get(t), `#${t} 꿈`)}</section>`,
  title: `${t} 관련 꿈 해몽 ${byTag.get(t).length}개`, desc: `${t}에 관한 꿈 해몽 ${byTag.get(t).length}개. ${byTag.get(t).slice(0, 6).map((e) => e.keyword).join(', ')} 등.` });
const pageVerdict = (v) => pageList({ path: urlVerdict(v), crumb: `${VERDICT[v]} 모아보기`, kicker: `${vpill(v)}<span>${byVerdict.get(v).length}개의 꿈</span>`, h1: `${VERDICT[v]} 모아보기`, lead: VERDICT_DESC[v], list: byVerdict.get(v),
  aside: `<section><h2 class="a-h">전체 판정 분포</h2>${tally(entries, '전체 꿈', true)}</section>`,
  title: `${VERDICT[v]} 꿈 ${byVerdict.get(v).length}개`, desc: `${VERDICT_DESC[v]} ${byVerdict.get(v).slice(0, 6).map((e) => e.keyword).join(', ')} 등 ${byVerdict.get(v).length}개.` });

// 소개·방침·문의: 넓은 화면에서 오른쪽 단이 비지 않게 본문 소제목으로 목차를 만든다(1180px 이하에서는 숨김)
function pageStatic(path, title, desc, inner) {
  const heads = [];
  const html = inner.replace(/<h2>(.*?)<\/h2>/g, (_, h) => { heads.push(h); return `<h2 id="s${heads.length}">${h}</h2>`; });
  const aside = heads.length >= 2 ? `<section><h2 class="a-h">이 페이지의 내용</h2><ul class="glance">${heads.map((h, i) => `<li><a href="#s${i + 1}">${h}</a></li>`).join('')}</ul></section>` : '';
  return layout({ title: `${title}`, desc, path, aside, asideCls: 'toc', body: `<nav class="crumb" aria-label="현재 위치"><a href="/">홈</a>${SEP}<span>${esc(title)}</span></nav><h1>${esc(title)}</h1><div class="body doc">${html}</div>` });
}

// ---------- build ----------
rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'assets'), { recursive: true });
cpSync(join(root, 'site', 'style.css'), join(OUT, 'assets', 'style.css'));
cpSync(join(root, 'site', 'app.js'), join(OUT, 'assets', 'app.js'));
if (existsSync(join(root, 'site', 'static'))) cpSync(join(root, 'site', 'static'), OUT, { recursive: true });

write('index.html', pageIndex());
for (const c of categories) write(`category/${c.id}/index.html`, pageCategory(c));
for (const e of entries) write(`dream/${e.slug}/index.html`, pageDream(e));
const tagsUsed = TAGS.filter((t) => byTag.get(t).length);
for (const t of tagsUsed) write(`tag/${t}/index.html`, pageTag(t));
for (const v of Object.keys(VERDICT)) write(`verdict/${v}/index.html`, pageVerdict(v));
write('privacy/index.html', pageStatic('/privacy/', '개인정보처리방침', `꿈해몽 사전이 수집하는 정보, Google 광고 쿠키와 맞춤 광고 거부 방법, 검색어 저장 여부를 정리했습니다. 회원가입 없이 이용하며 검색 기록은 서버에 저장하지 않습니다.`, `
<p><b>${SITE.name}</b>(dreamdict.web.app)은 회원가입 없이 이용하는 정보 제공 사이트입니다. 운영자는 이름·이메일 등 개인정보를 직접 수집하지 않으며, 검색창에 입력한 검색어도 서버로 보내거나 저장하지 않습니다. 다만 아래와 같이 광고·호스팅 서비스를 제공하는 제3자가 쿠키나 접속 로그로 일부 정보를 수집할 수 있습니다.</p>
<h2>광고와 쿠키</h2>
<p>이 사이트에는 Google AdSense 광고가 게재됩니다.</p>
<p>Google을 포함한 제3자 공급업체는 쿠키를 사용하여 사용자가 이 웹사이트나 다른 웹사이트를 이전에 방문한 기록을 바탕으로 광고를 게재합니다.</p>
<p>Google은 광고 쿠키를 사용하여 Google과 파트너가 이 사이트 또는 인터넷의 다른 사이트 방문 기록을 바탕으로 사용자에게 맞춤 광고를 게재할 수 있도록 합니다.</p>
<p>사용자는 <a href="https://adssettings.google.com" target="_blank" rel="noopener">Google 광고 설정(https://adssettings.google.com)</a>에서 맞춤 광고를 사용 중지할 수 있습니다. 또한 <a href="https://www.aboutads.info/choices" target="_blank" rel="noopener">www.aboutads.info/choices</a>에서 제3자 공급업체가 맞춤 광고에 쿠키를 사용하는 것을 거부할 수 있습니다.</p>
<p>Google이 이 정보를 어떻게 사용하는지는 <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener">Google 파트너 사이트 데이터 사용 안내</a>에서 확인할 수 있습니다. 브라우저 설정에서 쿠키를 차단하거나 삭제할 수도 있습니다.</p>
<h2>그 밖의 정보</h2>
<p><b>호스팅</b> — Firebase Hosting(Google)을 사용하며, 접속 로그(IP, 브라우저 정보)가 서비스 운영 목적으로 자동 수집될 수 있습니다.</p>
<p><b>공유 기능</b> — 카카오톡·X·페이스북 공유 버튼은 각 서비스의 정책을 따릅니다.</p>
<p><b>문의</b> — 개인정보 처리에 관한 문의는 <a href="/contact/">문의하기</a> 페이지의 이메일로 보내 주세요.</p>
<p>최종 수정: ${TODAY}</p>`));
write('contact/index.html', pageStatic('/contact/', '문의하기', '꿈해몽 사전 운영자에게 문의·제보·해몽 오류 신고를 보내는 방법입니다. 잘못된 해몽이나 빠진 꿈이 있으면 알려주세요.', `
<p><b>꿈해몽 사전</b>은 개인이 혼자 만들고 운영하는 사이트입니다. 회사나 팀이 아니라 한 사람이 관리하기 때문에 답변이 며칠 걸릴 수 있습니다.</p>

<h2>이메일</h2>
<p><a href="mailto:comeonyourboyz@gmail.com">comeonyourboyz@gmail.com</a></p>
<p>해몽 내용이 이상하거나, 찾는 꿈이 없거나, 출처가 궁금하실 때 편하게 보내주세요.</p>

<h2>이런 연락이 특히 도움이 됩니다</h2>
<p><b>내용 오류 제보</b> — 가장 반가운 연락입니다. 어느 페이지의 어떤 부분이 왜 잘못됐는지 적어주시면 확인 후 고치겠습니다. 근거가 될 자료가 있으면 함께 보내주시면 더 빠릅니다.</p>
<p><b>빠진 항목 요청</b> — 찾으셨는데 없던 것을 알려주시면 추가 우선순위에 올립니다.</p>
<p><b>버그 신고</b> — 화면이 깨지거나 기능이 동작하지 않으면 쓰시는 기기와 브라우저를 같이 알려주세요.</p>

<h2>답변이 어려운 것</h2>
<p>개인적인 상담이나 1:1 조언은 드리기 어렵습니다. 이 사이트는 참고용 정보를 정리해 두는 곳이고, 운영자는 해당 분야의 전문가가 아닙니다.</p>
<p>광고·제휴 제안은 확인은 하지만 대부분 답장을 드리지 못합니다.</p>

<h2>운영자 정보</h2>
<p>서울에서 일하는 소프트웨어 개발자가 업무 외 시간에 만들고 있습니다. 사업자 등록을 한 상업 사이트가 아니며, 운영 비용은 광고 수익으로 충당합니다.</p>
<p>사이트가 어떤 자료를 근거로 만들어졌는지는 <a href="/about/">사이트 소개</a>에, 수집하는 정보는 <a href="/privacy/">개인정보처리방침</a>에 정리해 두었습니다.</p>
`));
write('about/index.html', pageStatic('/about/', '사이트 소개', `꿈해몽 사전의 해몽을 어떻게 만들었는지(AI 초안과 형식 검사), 길몽·흉몽 판정 기준은 무엇인지, 어떤 한계가 있는지 밝힙니다. 꿈 ${entries.length}개를 ${categories.length}개 카테고리로 정리했습니다.`, `
<p><b>${SITE.name}</b>은 꿈에 나온 것을 검색하면 길몽·흉몽 판정과 상황별 해몽을 바로 확인할 수 있는 꿈 해몽 사전입니다. 지금 ${entries.length}개의 꿈을 ${categories.map((c) => esc(c.name)).join(', ')} ${categories.length}개 카테고리로 나눠 정리했습니다.</p>

<h2>한 페이지에 담은 것</h2>
<p>꿈 하나마다 한 줄 요약, 판정, 전체 의미 풀이, 그리고 <b>상황별 해몽</b>을 둡니다. 같은 뱀 꿈이라도 뱀에게 물리는 꿈, 뱀을 죽이는 꿈, 뱀에게 쫓기는 꿈, 흰 뱀 꿈은 풀이가 서로 다르기 때문에 상황을 나눠 따로 적었습니다. 페이지 아래에는 함께 찾아보면 좋은 관련 꿈과 태그를 붙였습니다.</p>

<h2>어떻게 만들었나</h2>
<p>해몽 문장은 운영자가 직접 쓰거나 해몽 전문가가 감수한 것이 <b>아닙니다</b>. 운영자가 사람들이 많이 찾는 꿈 키워드 목록과 카테고리를 먼저 정하고, 항목마다 요약·판정·풀이·상황별 해몽을 어떤 형식과 길이로 쓸지 규칙을 정한 뒤, <b>AI(대형 언어 모델)</b>에게 그 규칙에 맞춰 초안을 쓰게 했습니다. AI는 우리나라에서 널리 전해지는 민속적 상징 풀이와 심리학적 해석을 바탕으로 문장을 만들었습니다.</p>
<p>초안은 검사 스크립트로 빠진 항목, 글자 수, 판정 값, 관련 꿈 링크가 실제로 있는 꿈인지 같은 <b>형식</b>만 확인했습니다. 해몽 문장 하나하나를 특정 해몽 문헌과 대조해 검증하지는 않았습니다. 해몽은 원래 정답이 정해진 정보가 아니고 책이나 지역마다 풀이가 다르니, 이 사이트의 풀이도 여러 해석 가운데 하나로 읽어 주세요. 잘못된 풀이를 알려 주시면 확인해 고칩니다.</p>

<h2>판정은 어떻게 정했나</h2>
<p>판정은 길몽·흉몽·상황에 따라·중립 네 가지입니다. 지금 수록된 꿈 가운데 <b>상황에 따라</b>가 ${entries.filter((e) => e.verdict === 'mixed').length}개로 가장 많고, 길몽 ${entries.filter((e) => e.verdict === 'good').length}개, 흉몽 ${entries.filter((e) => e.verdict === 'bad').length}개, 중립 ${entries.filter((e) => e.verdict === 'neutral').length}개입니다.</p>
<p>'상황에 따라'가 절반을 넘는 것은 의도한 결과입니다. 같은 상징이 꿈속 상황에 따라 정반대로 풀리는 경우가 많아서, 한 단어로 좋다 나쁘다를 단정하면 오히려 틀린 풀이가 됩니다. 이런 꿈은 상황별 해몽을 먼저 읽어 주세요.</p>
<p>흉몽 표시는 실제로 나쁜 일이 생긴다는 예언이 아닙니다. 전통적으로 조심하라는 뜻으로 읽어 온 꿈이라는 표시이고, 심리학에서는 불안이나 피로가 꿈으로 드러난 것으로 보기도 합니다.</p>

<h2>어떻게 찾나</h2>
<p>검색창에 꿈에 나온 것(이빨, 돈, 물처럼)을 입력하면 됩니다. 무엇을 찾아야 할지 모르겠다면 판정별 목록이나 태그에서 둘러보거나, '아무 꿈이나 하나 보기'를 눌러 보세요.</p>

<h2>한계</h2>
<p>해몽은 과학적으로 검증된 정보가 아닙니다. 특정 종교나 미신을 권하지 않으며, 의학·법률·투자 같은 중요한 판단의 근거로 쓸 수 없습니다. 반복되는 악몽이나 수면 문제가 일상에 지장을 준다면 해몽보다 전문의 상담을 권합니다.</p>
<h2>누가 운영하나</h2>
<p>서울에서 일하는 소프트웨어 개발자가 업무 외 시간에 혼자 만들고 운영합니다. 사업자 등록을 한 상업 사이트가 아니며, 운영 비용은 광고 수익으로 충당합니다.</p>
<p>잘못된 풀이나 빠진 꿈을 발견하셨다면 <a href="/contact/">문의하기</a>로 알려 주세요. 수집하는 정보는 <a href="/privacy/">개인정보처리방침</a>에 정리해 두었습니다.</p>
`));
write('404.html', layout({ title: `페이지를 찾을 수 없어요`, desc: SITE.desc, path: '/404.html', body: `<div class="nf"><p class="kicker">404</p><h1>그런 꿈은 아직 없어요</h1><p class="sub">위 검색창에서 다른 단어로 찾아보거나, 카테고리에서 둘러보세요.</p><p><a class="more-link" href="/">홈으로</a></p></div>` }));

// 검색 인덱스: k=keyword, u=url, c=category name, s=searchTerms
writeFileSync(join(OUT, 'search-index.json'), JSON.stringify(entries.map((e) => ({ k: e.keyword, u: urlDream(e), c: catById.get(e.category).name, s: e.searchTerms }))));

// sitemap
const urls = [
  { loc: '/', p: '1.0', f: 'daily' },
  ...categories.map((c) => ({ loc: urlCat(c), p: '0.8', f: 'weekly' })),
  ...entries.map((e) => ({ loc: urlDream(e), p: '0.7', f: 'monthly' })),
  ...tagsUsed.map((t) => ({ loc: urlTag(t), p: '0.6', f: 'weekly' })),
  ...Object.keys(VERDICT).map((v) => ({ loc: urlVerdict(v), p: '0.6', f: 'weekly' })),
  { loc: '/about/', p: '0.3', f: 'yearly' }, { loc: '/contact/', p: '0.3', f: 'yearly' }, { loc: '/privacy/', p: '0.2', f: 'yearly' },
];
writeFileSync(join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.filter((u) => !isNoindex(u.loc)).map((u) => `  <url><loc>${abs(u.loc)}</loc><lastmod>${TODAY}</lastmod><changefreq>${u.f}</changefreq><priority>${u.p}</priority></url>`).join('\n')}\n</urlset>\n`);

// 리포트
console.log(`✔ 빌드 완료 → public/`);
console.log(`  꿈 ${entries.length} / 카테고리 ${categories.length} / 태그 ${tagsUsed.length} / 길흉 ${Object.keys(VERDICT).length} / 정적 3 → HTML ${htmlPages}개 (+404)`);
console.log(`  sitemap 항목 ${urls.length}`);
console.log(`  키워드 대비 커버리지 ${entries.length}/${keywords.length}`);
for (const w of warnings) console.warn('  ⚠ ' + w);
if (htmlPages !== urls.length) { console.error(`✖ HTML 페이지 수(${htmlPages})와 sitemap 항목 수(${urls.length}) 불일치`); process.exit(1); }
