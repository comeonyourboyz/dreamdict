# dreamdict — 꿈 해몽 사전

광고 수익용 정적 사이트. 꿈 키워드마다 개별 페이지를 만들어 롱테일 검색 유입을 노린다.

- 사이트: https://dreamdict.web.app
- 호스팅: Firebase Hosting (프로젝트 `dreamdict`)
- 소스: https://github.com/comeonyourboys/dreamdict

## 구조

```
data/src/*.txt        키워드 원본 (카테고리별, id|키워드[|slug])
data/keywords.json    빌드 산출물 — 키워드 인덱스 (npm run keywords)
data/schema.json      해몽 항목 JSON Schema
data/entries/*.json   AI 생성 해몽 데이터 (카테고리별 배열, 스키마 준수)
scripts/              빌드·검증 스크립트
public/               배포 산출물 (npm run build 가 생성)
```

## URL 규칙

| 페이지 | 경로 | 예 |
|---|---|---|
| 메인 | `/` | |
| 카테고리 | `/category/<categoryId>/` | `/category/animals/` |
| 꿈 상세 | `/dream/<slug>/` | `/dream/뱀/`, `/dream/이빨-빠지는/` |

slug 규칙
1. 표시 키워드에서 끝의 ` 꿈`을 뗀다. `뱀 꿈` → `뱀`
2. 남은 공백은 하이픈으로. `이빨 빠지는 꿈` → `이빨-빠지는`
3. 한글은 그대로 둔다(검색어와 일치시키기 위함). 예외가 필요하면 `data/src` 3번째 컬럼에 직접 지정
4. `id`는 ASCII(소문자·숫자·하이픈)로 파일명·내부 링크·향후 다국어 확장에 쓴다. URL에는 쓰지 않는다

## 명령

```
npm run keywords   # data/src → data/keywords.json (중복·형식 검사 포함)
npm run validate   # data/entries/*.json 을 schema + keywords 기준으로 검증
npm run build      # public/ 정적 페이지·sitemap 생성
npm run deploy     # build 후 firebase deploy
```
