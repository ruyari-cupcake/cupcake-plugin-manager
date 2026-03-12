# 배포 가이드 — Cupcake Provider Manager

## 리모트 구조

| 리모트 | 레포 | Vercel 도메인 | 용도 |
|--------|------|---------------|------|
| `test` | `ruyari-cupcake/cupcake-plugin-manager-test` | `cupcake-plugin-manager-test.vercel.app` | **기본 배포 (테스트)** |
| `origin` | `ruyari-cupcake/cupcake-plugin-manager` | `cupcake-plugin-manager.vercel.app` | 프로덕션 (요청 시에만) |

---

## 기본 배포 (test) — 평소 작업

### 중요: 메인 자동업데이트 수정 후에는 산출물 동기화까지 반드시 확인

메인 플러그인 자동업데이트는 소스 파일만 맞아서는 안 된다.
실제 배포되는 파일인 [provider-manager.js](provider-manager.js), [update-bundle.json](update-bundle.json), [release-hashes.json](release-hashes.json)까지 같이 갱신되어야 한다.

특히 아래 파일만 고치고 릴리즈 산출물을 재생성하지 않으면, 서버는 **예전 자동업데이트 코드**를 계속 배포할 수 있다.

- [src/lib/sub-plugin-manager.js](src/lib/sub-plugin-manager.js)
- [src/plugin-header.js](src/plugin-header.js)
- [src/lib/shared-state.js](src/lib/shared-state.js)
- [versions.json](versions.json)

가장 안전한 방법은 수동 `build + copy` 대신 아래 `release` 파이프라인을 쓰는 것이다.

```bash
# 1. 코드 수정 후 릴리즈 파이프라인 실행
#    - rollup build
#    - dist → root 복사
#    - versions.json/header 검증
#    - update-bundle.json 재생성
#    - 테스트 실행
#    - release-hashes.json 생성
node scripts/release.cjs

# 2. 커밋 & push
git add -A
git commit -m "feat: 설명"
git push test main

# 3. 릴리즈 (선택)
git tag v1.xx.x-test.N
git push test v1.xx.x-test.N
# → GitHub Actions가 빌드+테스트 후 Release 자동 생성
```

### 배포 전 체크리스트

- [provider-manager.js](provider-manager.js) 헤더 버전이 이번 배포 버전과 일치하는지 확인
- [update-bundle.json](update-bundle.json)에 `provider-manager.js` 최신 코드와 최신 `sha256`이 들어갔는지 확인
- [versions.json](versions.json)의 `Cupcake Provider Manager` 버전/changes가 최신인지 확인
- 메인 자동업데이트 관련 수정이었다면 반드시 `node scripts/release.cjs`를 다시 실행

---

## 프로덕션 배포 (origin) — 요청 시에만

### 1단계: URL을 프로덕션으로 전환

**변경할 파일은 1개만:**

| 파일 | 변경 내용 |
|------|-----------|
| `src/cpm-url.config.js` | `CPM_BASE_URL`를 `https://cupcake-plugin-manager.vercel.app`로 변경 |

`src/lib/endpoints.js`, `src/plugin-header.js`, Rollup 배너, 회귀 테스트는 모두 이 값을 기준으로 동기화된다.

### 2단계: 빌드 & 테스트 & 릴리즈

```bash
# release.cjs를 우선 사용한다.
# 이 단계가 provider-manager.js / update-bundle.json / release-hashes.json 동기화를 보장한다.
node scripts/release.cjs        # 권장

# 정말 필요할 때만 수동 절차:
# npm run build
# copy dist\provider-manager.js provider-manager.js
# npm test
# node scripts/release.cjs --dry-run

git add -A
git commit -m "release: provider-manager vX.XX.X"
git push origin main
git tag vX.XX.X
git push origin vX.XX.X
```

### 3단계: URL을 다시 테스트로 복원

1단계의 역순으로 [src/cpm-url.config.js](src/cpm-url.config.js)의 `CPM_BASE_URL`만 `https://cupcake-plugin-manager-test.vercel.app`으로 되돌린다.

```bash
node scripts/release.cjs
git add -A
git commit -m "chore: restore test domain URLs"
git push test main
```

---

## 주의사항

- **origin에는 절대 test URL이 포함된 코드를 push하지 않는다**
- **test에는 절대 production URL이 포함된 코드를 push하지 않는다**
- 프로덕션 배포 후 반드시 3단계(URL 복원)를 수행한다
- 메인 자동업데이트 관련 수정 후에는 **소스만 커밋하지 말고 반드시 [node scripts/release.cjs](scripts/release.cjs)로 산출물을 재생성한다**
- [provider-manager.js](provider-manager.js)와 [update-bundle.json](update-bundle.json)이 stale이면 메인 자동업데이트는 수정 전 코드를 계속 내려보낼 수 있다
- 푸시 전 Husky가 `npm run verify:release-sync`와 `npm run test:release-sync`를 실행하므로, 산출물 버전/해시/번들 코드가 안 맞으면 푸시가 차단된다
- `origin` push 전에 반드시 전체 테스트를 통과시킨다

---

## 공개 응답 범위 정책

### 왜 이 정책이 필요한가

CPM의 버전 확인/자동업데이트 응답은 웹, 도커, 로컬, 모바일 웹뷰(iOS/Android), iframe sandbox(`null` origin) 등 여러 환경에서 소비된다.

이 때문에 Vercel 응답의 CORS는 현재 `Access-Control-Allow-Origin: *`를 유지한다.
이 설정은 **보안 실수**라기보다 **멀티 플랫폼 호환을 위한 운영상 선택**이다.

대신 아래 원칙을 반드시 지켜야 한다.

### 공개로 취급하는 엔드포인트

다음 응답은 **공개 응답(public response)** 으로 취급한다.

- `versions.json`
- `update-bundle.json`
- `provider-manager.js`
- 기타 Vercel에서 배포하는 버전/업데이트용 JSON, JS 정적 응답

즉, 위 응답은 "누가 읽어도 되는 배포물/버전 정보"여야 한다.

### 절대 포함하면 안 되는 것

공개 응답에는 아래 항목이 절대 들어가면 안 된다.

- 사용자 API 키
- OAuth 토큰, 세션 토큰, 쿠키 값
- 사용자 식별자, 계정 ID, 이메일 등 개인 식별 정보
- 디버그용 내부 상태 덤프
- 비공개 관리자 정보
- 서버 내부 경로, 비공개 설정값, 비공개 feature flag
- 아직 공개되면 안 되는 실험용 비밀 데이터

### 허용되는 것

공개 응답에는 아래 정보만 포함되어야 한다.

- 공개 버전 문자열
- 공개 changelog 요약
- 공개 배포 번들 코드
- 공개 해시값(`sha256` 등)
- 공개 가능한 메타데이터(파일명, 버전명, 배포 시각 등)

### 운영 원칙

1. 자동업데이트 응답은 **공개 CDN 파일처럼 취급**한다.
2. 민감 정보 보호는 CORS가 아니라 **응답 내용 통제**로 보장한다.
3. 업데이트 번들은 항상 무결성 검증(`sha256`)을 통과해야 한다.
4. 새로운 응답 필드를 추가할 때는 "이 값이 공개되어도 되는가?"를 먼저 검토한다.
5. 비밀 데이터가 필요한 기능은 공개 정적 응답에 넣지 말고 별도 보호 경로를 사용한다.

### 리뷰 체크리스트

버전/업데이트 응답을 수정할 때마다 아래를 확인한다.

- [ ] 이 응답은 외부 사이트가 읽어도 문제없는가?
- [ ] 사용자별 데이터가 섞이지 않았는가?
- [ ] 토큰/키/세션/개인정보가 전혀 없는가?
- [ ] 응답이 공개 배포물이라는 전제가 유지되는가?
- [ ] 무결성 검증 경로가 여전히 유효한가?
