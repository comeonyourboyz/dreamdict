// 정적 사이트 빌드: data/keywords.json + data/entries/*.json → public/
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'public');
const SITE = {
  url: 'https://dreamdict.web.app',
  name: '꿈해몽 사전',
  nameEn: 'DreamDict',
  desc: '뱀 꿈, 이빨 빠지는 꿈, 똥 꿈… 꿈에 나온 것을 검색하면 길몽·흉몽 판정과 상황별 해몽을 바로 알려주는 꿈 해몽 사전.',
  ogImage: 'https://dreamdict.web.app/og-image.png',
  launch: '2026-09-10',
  adsense: 'ca-pub-5479403345572412',
  kakaoKey: '455b415360c00b8af8c31a830fc33ef3',
  coupang: { tracking: 'AF7330023', side: 1024318, bottom: 1017186 },
  gsv: '8nUCFYxTph7TOTN0ZC0zWvamYgyQMd026qCLSBL9YgE', // Search Console (tangerin10과 동일 계정 토큰; 속성 추가는 콘솔에서)
};
const TODAY = new Date().toISOString().slice(0, 10);
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
const urlCat = (c) => `/category/${c.id}/`;
const urlTag = (t) => encodeURI(`/tag/${t}/`);
const urlVerdict = (v) => `/verdict/${v}/`;
const abs = (p) => SITE.url + p;
const badge = (v) => `<span class="badge ${v}">${VERDICT[v]}</span>`;
const paras = (t) => t.split(/\n{2,}/).map((p) => `<p>${esc(p.trim())}</p>`).join('');
const jsonld = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;
let htmlPages = 0;
const write = (rel, html) => { const p = join(OUT, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, html); if (rel.endsWith('.html') && rel !== '404.html') htmlPages++; };
const rows = (list) => list.map((e) => `<a class="row" href="${urlDream(e)}"><div style="flex:1"><div class="kw">${esc(e.keyword)}</div><div class="sm">${esc(e.summary)}</div></div>${badge(e.verdict)}</a>`).join('');

const VERDICT_DESC = {
  good: '재물·행운·좋은 인연을 예고한다고 전해지는 길몽들을 모았습니다.',
  bad: '경고나 주의를 뜻하는 흉몽들을 모았습니다. 흉몽은 대개 "지금 마음을 돌아보라"는 신호입니다.',
  mixed: '꿈속 상황에 따라 길몽도 흉몽도 될 수 있는 꿈들입니다. 상세 페이지의 상황별 해몽을 꼭 확인하세요.',
  neutral: '특별한 길흉보다 현재 심리 상태를 비추는 중립적인 꿈들입니다.',
};
const TAGS = ['재물', '건강', '연애', '가족', '직장', '학업', '인간관계', '변화', '경고', '행운', '심리', '태몽'];
const byTag = new Map(TAGS.map((t) => [t, entries.filter((e) => e.tags.includes(t))]));
const byVerdict = new Map(Object.keys(VERDICT).map((v) => [v, entries.filter((e) => e.verdict === v)]));

function layout({ title, desc, path, body, ld = [], type = 'website', share }) {
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
<meta name="robots" content="index, follow">
<meta name="theme-color" content="#1a1a2e">
${SITE.gsv ? `<meta name="google-site-verification" content="${SITE.gsv}">` : ''}
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="${SITE.name}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE.ogImage}">
<meta property="og:locale" content="ko_KR">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${SITE.ogImage}">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🌙</text></svg>">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css">
<link rel="stylesheet" href="/assets/style.css">
${ld.map(jsonld).join('\n')}
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${SITE.adsense}" crossorigin="anonymous"></script>
<script src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js"></script>
</head>
<body>
<header class="hdr"><div class="wrap">
  <a class="logo" href="/">🌙 ${SITE.name} <span class="en">${SITE.nameEn}</span></a>
  <div class="srch"><input type="search" placeholder="꿈에 뭐가 나왔나요? 예: 뱀, 이빨" aria-label="꿈 검색" autocomplete="off"><span class="ico">🔍</span><div class="dd"></div></div>
</div></header>
<aside class="ad-side" id="adL"><script src="https://ads-partners.coupang.com/g.js"></script><script>new PartnersCoupang.G({"id":${SITE.coupang.side},"template":"carousel","trackingCode":"${SITE.coupang.tracking}","width":"160","height":"600","tsource":""});</script></aside>
<aside class="ad-side" id="adR"><script src="https://ads-partners.coupang.com/g.js"></script><script>new PartnersCoupang.G({"id":${SITE.coupang.side},"template":"carousel","trackingCode":"${SITE.coupang.tracking}","width":"160","height":"600","tsource":""});</script></aside>
<main class="wrap">
${body}
<div class="ad-box"><div style="width:100%"><script src="https://ads-partners.coupang.com/g.js"></script><script>new PartnersCoupang.G({"id":${SITE.coupang.bottom},"template":"carousel","trackingCode":"${SITE.coupang.tracking}","width":"100%","height":"140","tsource":""});</script></div></div>
<p class="disclose">이 페이지는 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.</p>
</main>
<footer class="ftr"><div class="wrap">
  <div><a href="/">홈</a>·${categories.map((c) => `<a href="${urlCat(c)}">${esc(c.name)}</a>`).join('·')}</div>
  <div><a href="/privacy/">개인정보처리방침</a>·<a href="/about/">사이트 소개</a></div>
  <div>해몽은 전통 민속과 심리학적 해석을 참고한 것으로 재미로 보아 주세요. © ${TODAY.slice(0, 4)} ${SITE.name}</div>
</div></footer>
<script>window.__SHARE__=${JSON.stringify(shareObj).replace(/</g, '\\u003c')};</script>
<script src="/assets/app.js" defer></script>
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
  <p>꿈에 나온 것을 검색하면 길몽·흉몽 판정과 상황별 해몽을 바로 알려드려요.</p>
  <div class="srch big"><input type="search" placeholder="예: 뱀, 이빨 빠지는, 똥" aria-label="꿈 검색" autocomplete="off"><span class="ico">🔍</span><div class="dd"></div></div>
  <button class="rand" id="randBtn" type="button">🎲 아무 꿈이나 하나 보기</button>
  <div class="stat">${entries.length.toLocaleString()}개의 꿈 · ${categories.length}개 카테고리</div>
</section>
<section class="sec"><h2>🔥 많이 찾는 꿈</h2><div class="chips">${pop.map((e) => `<a class="chip" href="${urlDream(e)}">${esc(e.keyword)} ${badge(e.verdict)}</a>`).join('')}</div></section>
<section class="sec"><h2>📚 카테고리</h2><div class="grid">${categories.map((c) => `<a class="cat-card" href="${urlCat(c)}"><div class="em">${c.emoji}</div><div class="nm">${esc(c.name)}</div><div class="ct">${(byCat.get(c.id) ?? []).length}개의 꿈</div></a>`).join('')}</div></section>
<section class="sec"><h2>🔮 길몽·흉몽 모아보기</h2><div class="chips">${Object.keys(VERDICT).map((v) => `<a class="chip" href="${urlVerdict(v)}">${badge(v)} ${(byVerdict.get(v) ?? []).length}개</a>`).join('')}</div></section>
<section class="sec"><h2>🏷 주제별</h2><div class="chips">${TAGS.filter((t) => byTag.get(t).length).map((t) => `<a class="chip" href="${urlTag(t)}">#${t} <span style="color:var(--muted);font-weight:600">${byTag.get(t).length}</span></a>`).join('')}</div></section>
<section class="sec"><h2>🌙 꿈 해몽, 이렇게 보세요</h2>
<div class="body"><p>같은 뱀 꿈이라도 뱀이 나를 물었는지, 집으로 들어왔는지, 색이 무엇이었는지에 따라 해석이 갈립니다. 이 사전은 꿈 하나마다 기본 해석과 함께 <b>상황별 변형</b>을 따로 정리해, 내 꿈에 가장 가까운 풀이를 찾을 수 있게 했습니다.</p>
<p>해몽은 전통 민속의 상징 풀이와 현대 심리학의 해석을 함께 담았습니다. 길몽이라 해서 로또를 사거나, 흉몽이라 해서 걱정하실 필요는 없습니다. 지금 내 마음이 어디에 머물러 있는지 들여다보는 계기로 가볍게 활용해 주세요.</p></div></section>`;
  const ld = [
    { '@context': 'https://schema.org', '@type': 'WebSite', name: SITE.name, url: SITE.url, description: SITE.desc, inLanguage: 'ko',
      potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: `${SITE.url}/?q={search_term_string}` }, 'query-input': 'required name=search_term_string' } },
  ];
  return layout({ title: `${SITE.name} — 뱀 꿈, 이빨 빠지는 꿈, 똥 꿈 해몽 검색`, desc: SITE.desc, path: '/', body, ld });
}

function pageCategory(c) {
  const list = byCat.get(c.id) ?? [];
  const body = `
<nav class="crumb"><a href="/">홈</a> › <span>${esc(c.name)}</span></nav>
<article>
<h1>${c.emoji} ${esc(c.name)} 꿈 해몽</h1>
<p class="lead">${esc(c.name)} 관련 꿈 ${list.length}개의 해몽을 모았습니다. 길몽·흉몽 판정을 먼저 확인하고, 상세 페이지에서 상황별 풀이를 살펴보세요.</p>
<div class="nav-cat">${categories.map((x) => `<a class="chip" href="${urlCat(x)}"${x.id === c.id ? ' style="border-color:var(--accent);color:var(--accent)"' : ''}>${x.emoji} ${esc(x.name)}</a>`).join('')}</div>
<div class="list" style="margin-top:18px">${list.length ? list.map((e) => `<a class="row" href="${urlDream(e)}"><div style="flex:1"><div class="kw">${esc(e.keyword)}</div><div class="sm">${esc(e.summary)}</div></div>${badge(e.verdict)}</a>`).join('') : '<div class="empty">준비 중입니다.</div>'}</div>
</article>`;
  const ld = [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: `${c.name} 꿈 해몽`, url: abs(urlCat(c)), inLanguage: 'ko',
    hasPart: list.slice(0, 50).map((e) => ({ '@type': 'Article', headline: e.title, url: abs(urlDream(e)) })) },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: '홈', item: SITE.url + '/' }, { '@type': 'ListItem', position: 2, name: c.name, item: abs(urlCat(c)) }] }];
  return layout({ title: `${c.name} 꿈 해몽 모음 (${list.length}개) — ${SITE.name}`, desc: `${c.name} 관련 꿈 해몽 ${list.length}개. ${list.slice(0, 6).map((e) => e.keyword).join(', ')} 등 길몽·흉몽 판정과 상황별 해석.`, path: urlCat(c), body, ld });
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
  const body = `
<nav class="crumb"><a href="/">홈</a> › <a href="${urlCat(c)}">${esc(c.name)}</a> › <span>${esc(e.keyword)}</span></nav>
<article>
<h1>${esc(h1)} ${badge(e.verdict)}</h1>
<p class="lead">${esc(e.summary)}</p>
<div class="body">${paras(e.meaning)}</div>
<h2>${esc(h2)}</h2>
${e.variants.map((v) => `<div class="var"><h3>${esc(v.situation)} ${badge(v.verdict)}</h3><p>${esc(v.meaning)}</p></div>`).join('')}
<div class="tags">${e.tags.map((t) => `<a class="tag" href="${urlTag(t)}">#${esc(t)}</a>`).join('')}<a class="tag" href="${urlVerdict(e.verdict)}">${VERDICT[e.verdict]} 모아보기</a></div>
<div class="share">
  <button class="sh k" onclick="shareKakao()" aria-label="카카오톡 공유">💬</button>
  <button class="sh x" onclick="shareX()" aria-label="X 공유">𝕏</button>
  <button class="sh f" onclick="shareFB()" aria-label="페이스북 공유">f</button>
  <button class="sh c" onclick="copyLink()" aria-label="링크 복사">🔗</button>
</div>
${related.length ? `<h2>함께 보는 꿈</h2><div class="chips">${related.map((r) => `<a class="chip" href="${urlDream(r)}">${esc(r.keyword)} ${badge(r.verdict)}</a>`).join('')}</div>` : ''}
${around.length ? `<h2>${c.emoji} ${esc(c.name)}의 다른 꿈</h2><div class="list">${around.map((r) => `<a class="row" href="${urlDream(r)}"><div style="flex:1"><div class="kw">${esc(r.keyword)}</div><div class="sm">${esc(r.summary)}</div></div>${badge(r.verdict)}</a>`).join('')}<a class="chip" style="align-self:flex-start" href="${urlCat(c)}">${esc(c.name)} 전체 보기 →</a></div>` : ''}
</article>`;
  const ld = [
    { '@context': 'https://schema.org', '@type': 'Article', headline: e.title, description: e.summary, inLanguage: 'ko', mainEntityOfPage: abs(path), image: SITE.ogImage,
      datePublished: SITE.launch, dateModified: TODAY, author: { '@type': 'Organization', name: SITE.name, url: SITE.url }, publisher: { '@type': 'Organization', name: SITE.name, url: SITE.url }, keywords: e.searchTerms.join(', '), articleSection: c.name },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: e.variants.map((v) => ({ '@type': 'Question', name: `${v.situation}은 무슨 뜻인가요?`, acceptedAnswer: { '@type': 'Answer', text: v.meaning } })) },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: '홈', item: SITE.url + '/' }, { '@type': 'ListItem', position: 2, name: c.name, item: abs(urlCat(c)) }, { '@type': 'ListItem', position: 3, name: e.keyword, item: abs(path) }] },
  ];
  return layout({ title: `${e.title} | ${SITE.name}`, desc: e.summary, path, body, ld, type: 'article',
    share: { title: `${e.keyword} 해몽 — ${VERDICT[e.verdict]}`, desc: e.summary, url: abs(path), image: SITE.ogImage, kakaoKey: SITE.kakaoKey } });
}

function pageList({ path, crumb, h1, lead, list, title, desc }) {
  const body = `
<nav class="crumb"><a href="/">홈</a> › <span>${esc(crumb)}</span></nav>
<article>
<h1>${h1}</h1>
<p class="lead">${esc(lead)}</p>
<div class="list" style="margin-top:18px">${list.length ? rows(list) : '<div class="empty">준비 중입니다.</div>'}</div>
</article>`;
  const ld = [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: crumb, url: abs(path), inLanguage: 'ko',
    hasPart: list.slice(0, 50).map((e) => ({ '@type': 'Article', headline: e.title, url: abs(urlDream(e)) })) }];
  return layout({ title, desc, path, body, ld });
}
const pageTag = (t) => pageList({ path: urlTag(t), crumb: `#${t}`, h1: `#${esc(t)} 관련 꿈 해몽`, lead: `${t} 관련 꿈 ${byTag.get(t).length}개입니다. 길몽·흉몽 판정을 확인하고 상세 해몽을 살펴보세요.`, list: byTag.get(t),
  title: `${t} 관련 꿈 해몽 모음 (${byTag.get(t).length}개) — ${SITE.name}`, desc: `${t}에 관한 꿈 해몽 ${byTag.get(t).length}개. ${byTag.get(t).slice(0, 6).map((e) => e.keyword).join(', ')} 등.` });
const pageVerdict = (v) => pageList({ path: urlVerdict(v), crumb: `${VERDICT[v]} 모아보기`, h1: `${VERDICT[v]} 모아보기 ${badge(v)}`, lead: VERDICT_DESC[v], list: byVerdict.get(v),
  title: `${VERDICT[v]} 꿈 모음 (${byVerdict.get(v).length}개) — ${SITE.name}`, desc: `${VERDICT_DESC[v]} ${byVerdict.get(v).slice(0, 6).map((e) => e.keyword).join(', ')} 등 ${byVerdict.get(v).length}개.` });

function pageStatic(path, title, desc, inner) {
  return layout({ title: `${title} — ${SITE.name}`, desc, path, body: `<nav class="crumb"><a href="/">홈</a> › <span>${esc(title)}</span></nav><article><h1>${esc(title)}</h1><div class="body">${inner}</div></article>` });
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
write('privacy/index.html', pageStatic('/privacy/', '개인정보처리방침', `${SITE.name} 개인정보처리방침`, `
<p><b>${SITE.name}</b>(dreamdict.web.app)은 회원가입 없이 이용하는 정보 제공 사이트로, 이름·이메일 등 개인정보를 직접 수집하지 않습니다.</p>
<p><b>쿠키 및 광고</b> — Google AdSense와 쿠팡 파트너스 광고가 게재됩니다. 광고 제공자는 관심 기반 광고를 위해 쿠키를 사용할 수 있으며, <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener">Google 광고 설정</a>에서 맞춤 광고를 해제할 수 있습니다.</p>
<p><b>호스팅</b> — Firebase Hosting(Google)을 사용하며, 접속 로그(IP, 브라우저 정보)가 서비스 운영 목적으로 자동 수집될 수 있습니다.</p>
<p><b>공유 기능</b> — 카카오톡·X·페이스북 공유 버튼은 각 서비스의 정책을 따릅니다.</p>
<p><b>문의</b> — <a href="https://github.com/comeonyourboyz/dreamdict" target="_blank" rel="noopener">GitHub 저장소</a>를 통해 연락 주세요.</p>
<p>최종 수정: ${TODAY}</p>`));
write('about/index.html', pageStatic('/about/', '사이트 소개', `${SITE.name} 소개`, `
<p><b>${SITE.name}</b>은 꿈에 나온 것을 검색하면 길몽·흉몽 판정과 상황별 해몽을 바로 확인할 수 있는 꿈 해몽 사전입니다. 현재 ${entries.length}개의 꿈을 ${categories.length}개 카테고리로 정리했습니다.</p>
<p>해몽은 전통 민속의 상징 풀이와 현대 심리학의 해석을 함께 담았습니다. 특정 종교나 미신을 권하지 않으며, 의학·법률·투자 판단의 근거로 사용될 수 없습니다. 재미로, 그리고 내 마음을 돌아보는 계기로 가볍게 활용해 주세요.</p>
<p>잘못된 내용이나 추가하고 싶은 꿈이 있다면 <a href="https://github.com/comeonyourboyz/dreamdict" target="_blank" rel="noopener">GitHub</a>로 알려 주세요.</p>`));
write('404.html', layout({ title: `페이지를 찾을 수 없어요 — ${SITE.name}`, desc: SITE.desc, path: '/404.html', body: `<div class="empty" style="padding:80px 0"><div style="font-size:60px">🌙</div><h1 style="font-size:22px;margin:10px 0">그런 꿈은 아직 없어요</h1><p>위 검색창에서 다른 단어로 찾아보세요.</p><p style="margin-top:16px"><a class="chip" href="/">홈으로</a></p></div>` }));

// 검색 인덱스: k=keyword, u=url, c=category name, s=searchTerms
writeFileSync(join(OUT, 'search-index.json'), JSON.stringify(entries.map((e) => ({ k: e.keyword, u: urlDream(e), c: catById.get(e.category).name, s: e.searchTerms }))));

// sitemap
const urls = [
  { loc: '/', p: '1.0', f: 'daily' },
  ...categories.map((c) => ({ loc: urlCat(c), p: '0.8', f: 'weekly' })),
  ...entries.map((e) => ({ loc: urlDream(e), p: '0.7', f: 'monthly' })),
  ...tagsUsed.map((t) => ({ loc: urlTag(t), p: '0.6', f: 'weekly' })),
  ...Object.keys(VERDICT).map((v) => ({ loc: urlVerdict(v), p: '0.6', f: 'weekly' })),
  { loc: '/about/', p: '0.3', f: 'yearly' }, { loc: '/privacy/', p: '0.2', f: 'yearly' },
];
writeFileSync(join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${abs(u.loc)}</loc><lastmod>${TODAY}</lastmod><changefreq>${u.f}</changefreq><priority>${u.p}</priority></url>`).join('\n')}\n</urlset>\n`);

// 리포트
console.log(`✔ 빌드 완료 → public/`);
console.log(`  꿈 ${entries.length} / 카테고리 ${categories.length} / 태그 ${tagsUsed.length} / 길흉 ${Object.keys(VERDICT).length} / 정적 3 → HTML ${htmlPages}개 (+404)`);
console.log(`  sitemap 항목 ${urls.length}`);
console.log(`  키워드 대비 커버리지 ${entries.length}/${keywords.length}`);
for (const w of warnings) console.warn('  ⚠ ' + w);
if (htmlPages !== urls.length) { console.error(`✖ HTML 페이지 수(${htmlPages})와 sitemap 항목 수(${urls.length}) 불일치`); process.exit(1); }
