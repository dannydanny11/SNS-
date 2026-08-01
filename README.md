# atoztem 인스타그램 무인 수익화 파이프라인

쿠팡 파트너스 상품을 자동 선정 → 제휴 링크 생성 → 캐러셀 카드 제작 → 캡션 작성 → 인스타그램 자동 게시하는 GitHub Actions 기반 파이프라인.

## 구축 진행 현황

| 단계 | 모듈 | 상태 |
|------|------|------|
| 1 | ② 파트너스 API (상품검색 + 딥링크, HMAC 서명) | ✅ 실제 링크 확인 완료 |
| 2 | ① 상품 선정 (카테고리 로테이션·30일중복·다양성) | ✅ 확인 완료 |
| 3 | ③ 카드 템플릿 (확정 시안 **C 소프트 크림**) | ✅ 렌더링 확인 |
| 4 | ④ 캡션 생성 (Claude API) + 대가성 문구 차단 | ✅ 구현 — **Claude 키로 테스트 대기** |
| 5 | ⑤ 인스타 게시 (Graph API 캐러셀) | ✅ 구현 — Phase 0 후 첫 게시 |
| 6 | ⑥ 기록/통지 + GitHub Actions cron | ✅ 구현 완료 |

## 지금 할 일 — 로컬 DRY_RUN 테스트 (①~④ 전체)

Claude API 키만 `.env` 에 넣으면 게시 전까지 전 과정을 로컬에서 검증할 수 있습니다.

1. `.env` 에 `ANTHROPIC_API_KEY=...` 입력 (쿠팡 키는 이미 입력됨)
2. 실행:
   ```bash
   npm run test:caption
   ```
   또는 카드까지 포함한 전체 드라이런:
   ```bash
   DRY_RUN=1 npm run run:pipeline
   ```
3. 캡션 + 대가성 문구 + 해시태그가 출력되고 `published/cards/<시각>/` 에 7장 카드가 생성되면 성공.

## 개별 모듈 테스트

```bash
npm run test:coupang     # ② 상품검색 + 딥링크
npm run test:select      # ① 상품 선정
npm run test:cards       # ③ 카드 시안 렌더링
npm run test:caption     # ④ 캡션 생성 (Claude 키 필요)
```

## 폴더 구조

```
src/
  config.js            환경변수 로딩 (.env / GitHub Secrets)
  categories.js        카테고리·키워드·훅 문구
  selectProducts.js    ① 상품 선정 로직
  postedLog.js         30일 중복·수수료 tier 관리
  coupang/             ② HMAC 서명·검색·딥링크
  cards/               ③ 테마·템플릿·렌더러·카드세트
  caption.js           ④ 캡션 생성 (대가성 문구 강제 삽입)
  validateCaption.js   대가성 문구 없으면 발행 차단
  instagram.js         ⑤ Graph API 캐러셀 게시
  notify.js            ⑥ 텔레그램 통지
  pipeline.js          generate() / publish() 코어
  index.js             로컬 통합 실행기 (DRY_RUN 지원)
scripts/               각 모듈 테스트 + generate/publish 진입점
.github/workflows/     매일 cron 자동 게시
```

## 보안 규칙

- 모든 키·토큰은 로컬 `.env`(개발) 또는 GitHub 저장소 Settings → Secrets(운영)에만 저장.
- 코드·커밋·채팅에 절대 노출하지 않는다.
