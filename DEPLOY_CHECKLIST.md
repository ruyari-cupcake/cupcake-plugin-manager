# Cupcake Plugin Manager — 배포 체크리스트

> 매 푸시 전 반드시 확인. 하나라도 실패하면 푸시 금지.

> ## ⛔ AI 에이전트 필독 — 절대 규칙 ⛔
>
> **`origin/main` (본서버)에 절대로 push하지 마라.**
> 모든 작업은 `test/main` (테스트서버)에만 push한다.
> 사용자가 직접 "본서버에 올려"라고 말한 경우에만 `origin/main`에 push 가능.
> **위반 시 자동 업데이트로 다른 사용자에게 버그가 전파된다.**

---

## 1. 배포 대상 파일 (GitHub에 있어야 하는 것)

| 파일 | 설명 |
|------|------|
| `provider-manager.js` | **dist/ 에서 빌드된 메인 플러그인** (root에 복사) |
| `cpm-*.js` (11개) | 서브 플러그인 |
| `versions.json` | 버전 메타데이터 |
| `update-bundle.json` | API용 번들 (generate-bundle.cjs로 생성) |
| `vercel.json` | Vercel 배포 설정 (CORS 헤더만) |
| `api/versions.js` | Vercel serverless — 버전 조회 |
| `api/update-bundle.js` | Vercel serverless — 번들 제공 |
| `PLUGIN_GUIDE.md` | 플러그인 가이드 |
| `README.md` | 리포 설명 |
| `.gitignore` | |

---

## 2. 절대 배포하면 안 되는 것

- [ ] `node_modules/` — git에 추가 금지
- [ ] `src/` — 소스코드. 로컬 전용
- [ ] `dist/` — 빌드 결과물 폴더 자체 (root에 복사한 파일만 배포)
- [ ] `tests/`, `coverage/` — 테스트 관련
- [ ] `package.json` — **Vercel가 Node.js 프로젝트로 인식하고 빌드 시도 → 배포 실패 원인**
- [ ] `package-lock.json`
- [ ] `rollup.config.mjs`, `eslint.config.js`, `vitest.config.js` 등 설정 파일
- [ ] `.github/`, `.husky/` — CI/훅
- [ ] API 키, 모델 가중치, credential 등 민감 정보
- [ ] `*복사본*`, `*.bak`, `*.backup*` — 백업 파일
- [ ] `generate-bundle.cjs` — 번들 생성 스크립트 (로컬 전용)

---

## 3. 버전 업데이트 순서

1. **메인 플러그인 수정** → `src/` 에서 작업 → `npm run build` → `dist/provider-manager.js` 생성
2. **dist → root 복사**: `cp dist/provider-manager.js ./provider-manager.js`
3. **서브 플러그인 수정 시**: 각 `cpm-*.js` 파일 내 `version` 문자열 +1 패치
4. **versions.json 업데이트**: 모든 변경된 파일의 버전을 versions.json에 동기화
5. **update-bundle.json 재생성**: `node generate-bundle.cjs`
   - ⚠ 이거 안 하면 API가 구버전 반환함 (api/versions.js가 update-bundle.json 읽음)
6. **테스트**: `npm test` (506개 전체 통과 확인)
7. **커밋 & 푸시**

---

## 4. 푸시 전 최종 점검

```bash
# 1) 트래킹 파일 확인 (20개여야 함, dev 파일 없어야 함)
git ls-files | sort

# 2) package.json 이 tracked 아닌지 확인 (출력 없어야 정상)
git ls-files | findstr "package.json"

# 3) versions.json 버전 ↔ 실제 파일 내 버전 일치 확인
# 4) update-bundle.json이 최신인지 확인 (generate-bundle.cjs 재실행)
# 5) provider-manager.js가 dist/ 빌드본인지 확인
#    - root와 dist 파일 해시 비교: certutil -hashfile provider-manager.js SHA256
```

---

## 5. vercel.json 주의사항

- `buildCommand`, `installCommand` 넣지 마라 — 정적 배포 기본값 사용
- CORS 헤더 설정만 유지
- package.json 없는 상태가 정상 (Vercel가 빌드 스킵하고 정적 서빙)

---

## 6. 장애 이력 (참고)

| 날짜 | 원인 | 결과 |
|------|------|------|
| 2026-03-09 | .gitignore에 `cpm-*.js`, `provider-manager.js` 추가 | 서브플러그인 diff 누락 |
| 2026-03-09 | package.json (build 스크립트 포함) 커밋 | Vercel 배포 실패 (rollup 빌드 시도) |
| 2026-03-09 | update-bundle.json 미갱신 | API가 구버전 반환 |
| 2026-03-09 | node_modules/ 커밋 | 리포 비대화 |
