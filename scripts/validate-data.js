// data/entries/*.json 을 data/schema.json + data/keywords.json 기준으로 검증한다.
// 외부 의존성 없음: schema.json 이 쓰는 JSON Schema 부분집합만 구현.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const schema = JSON.parse(readFileSync(join(root, 'data', 'schema.json'), 'utf8'));
const { keywords, categories } = JSON.parse(readFileSync(join(root, 'data', 'keywords.json'), 'utf8'));
const byId = new Map(keywords.map((k) => [k.id, k]));
const entriesDir = join(root, 'data', 'entries');

const errors = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const len = (s) => [...s].length; // 코드포인트 기준(한글 1자 = 1)

function check(value, sch, path) {
  if (sch.type === 'object') {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return err(path, '객체여야 함');
    for (const k of sch.required ?? []) if (!(k in value)) err(path, `필수 필드 누락: ${k}`);
    if (sch.additionalProperties === false)
      for (const k of Object.keys(value)) if (!(k in sch.properties)) err(path, `허용되지 않은 필드: ${k}`);
    for (const [k, sub] of Object.entries(sch.properties ?? {})) if (k in value) check(value[k], sub, `${path}.${k}`);
    return;
  }
  if (sch.type === 'array') {
    if (!Array.isArray(value)) return err(path, '배열이어야 함');
    if (sch.minItems != null && value.length < sch.minItems) err(path, `최소 ${sch.minItems}개 (현재 ${value.length})`);
    if (sch.maxItems != null && value.length > sch.maxItems) err(path, `최대 ${sch.maxItems}개 (현재 ${value.length})`);
    if (sch.uniqueItems && new Set(value.map((v) => JSON.stringify(v))).size !== value.length) err(path, '중복 항목');
    value.forEach((v, i) => check(v, sch.items, `${path}[${i}]`));
    return;
  }
  if (sch.type === 'string') {
    if (typeof value !== 'string') return err(path, '문자열이어야 함');
    const n = len(value);
    if (sch.minLength != null && n < sch.minLength) err(path, `최소 ${sch.minLength}자 (현재 ${n})`);
    if (sch.maxLength != null && n > sch.maxLength) err(path, `최대 ${sch.maxLength}자 (현재 ${n})`);
    if (sch.pattern && !new RegExp(sch.pattern, 'u').test(value)) err(path, `패턴 불일치 ${sch.pattern}`);
    if (sch.enum && !sch.enum.includes(value)) err(path, `허용값 아님: "${value}" (허용: ${sch.enum.join(', ')})`);
  }
}

const seen = new Map();
let total = 0;
const perCategory = new Map(categories.map((c) => [c.id, 0]));

if (!existsSync(entriesDir)) { console.error('data/entries 없음'); process.exit(1); }
for (const file of readdirSync(entriesDir).filter((f) => f.endsWith('.json')).sort()) {
  let arr;
  try { arr = JSON.parse(readFileSync(join(entriesDir, file), 'utf8')); }
  catch (e) { err(file, `JSON 파싱 실패: ${e.message}`); continue; }
  if (!Array.isArray(arr)) { err(file, '최상위는 배열이어야 함'); continue; }
  arr.forEach((entry, i) => {
    const where = `${file}[${i}]${entry?.id ? ' (' + entry.id + ')' : ''}`;
    check(entry, schema, where);
    if (!entry?.id) return;
    if (seen.has(entry.id)) err(where, `id 중복 (먼저: ${seen.get(entry.id)})`);
    seen.set(entry.id, where);
    const kw = byId.get(entry.id);
    if (!kw) return err(where, `keywords.json 에 없는 id`);
    if (kw.slug !== entry.slug) err(where, `slug 불일치: keywords="${kw.slug}" entry="${entry.slug}"`);
    if (kw.keyword !== entry.keyword) err(where, `keyword 불일치: keywords="${kw.keyword}" entry="${entry.keyword}"`);
    if (kw.category !== entry.category) err(where, `category 불일치: keywords="${kw.category}" entry="${entry.category}"`);
    if (file !== `${kw.category}.json`) err(where, `파일 위치 불일치: ${kw.category}.json 에 있어야 함`);
    for (const r of entry.related ?? []) {
      if (r === entry.id) err(where, `related 에 자기 자신 포함`);
      else if (!byId.has(r)) err(where, `related 에 없는 id: ${r}`);
    }
    perCategory.set(entry.category, (perCategory.get(entry.category) ?? 0) + 1);
    total++;
  });
}

console.log(`검증 항목 ${total}개 / 키워드 ${keywords.length}개 (커버리지 ${((total / keywords.length) * 100).toFixed(1)}%)`);
for (const c of categories) console.log(`  ${c.emoji} ${c.name}: ${perCategory.get(c.id) ?? 0}/${c.count}`);
if (errors.length) {
  console.error(`\n✖ ${errors.length}개 오류`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log('✔ 오류 없음');
