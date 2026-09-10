// data/src/*.txt -> data/keywords.json
// 형식: 첫 줄 "# <categoryId>|<한글명>|<emoji>", 이후 "id|키워드[|slug]"
// slug 규칙: 3번째 컬럼이 있으면 그대로, 없으면 키워드에서 끝의 " 꿈" 제거 후 공백 → "-"
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'data', 'src');
const out = join(root, 'data', 'keywords.json');

const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const toSlug = (kw) => kw.replace(/\s*꿈$/u, '').trim().replace(/\s+/g, '-');

const categories = [];
const keywords = [];
const errors = [];
const seenId = new Map();
const seenSlug = new Map();

for (const file of readdirSync(srcDir).filter((f) => f.endsWith('.txt')).sort()) {
  const lines = readFileSync(join(srcDir, file), 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
  const header = lines.shift();
  if (!header?.startsWith('#')) { errors.push(`${file}: 헤더(# id|이름|emoji) 없음`); continue; }
  const [catId, catName, emoji] = header.slice(1).split('|').map((s) => s.trim());
  if (!ID_RE.test(catId) || !catName) { errors.push(`${file}: 헤더 형식 오류 "${header}"`); continue; }
  let count = 0;
  lines.forEach((line, i) => {
    const [id, keyword, slugOverride] = line.split('|').map((s) => s.trim());
    const where = `${file}:${i + 2}`;
    if (!id || !keyword) { errors.push(`${where}: "id|키워드" 형식 아님 → "${line}"`); return; }
    if (!ID_RE.test(id)) { errors.push(`${where}: id 규칙 위반(소문자·숫자·하이픈) → "${id}"`); return; }
    const slug = slugOverride || toSlug(keyword);
    if (!slug || /[\/\s?#]/.test(slug)) { errors.push(`${where}: slug 비정상 → "${slug}"`); return; }
    if (seenId.has(id)) { errors.push(`${where}: id 중복 "${id}" (먼저: ${seenId.get(id)})`); return; }
    if (seenSlug.has(slug)) { errors.push(`${where}: slug 중복 "${slug}" (먼저: ${seenSlug.get(slug)})`); return; }
    seenId.set(id, where); seenSlug.set(slug, where);
    keywords.push({ id, slug, keyword, category: catId });
    count++;
  });
  categories.push({ id: catId, name: catName, emoji: emoji || '', count });
}

if (errors.length) {
  console.error(`✖ ${errors.length}개 오류`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}

writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString(), total: keywords.length, categories, keywords }, null, 2) + '\n');
console.log(`✔ ${keywords.length}개 키워드 / ${categories.length}개 카테고리 → data/keywords.json`);
for (const c of categories) console.log(`  ${c.emoji} ${c.name} (${c.id}): ${c.count}`);
