# 배포 가이드 — Cupcake Provider Manager

## 리모트 구조

| 리모트 | 레포 | Vercel 도메인 | 용도 |
|--------|------|---------------|------|
| `test` | `ruyari-cupcake/cupcake-plugin-manager-test` | `cupcake-plugin-manager-test.vercel.app` | **기본 배포 (테스트)** |
| `origin` | `ruyari-cupcake/cupcake-plugin-manager` | `cupcake-plugin-manager.vercel.app` | 프로덕션 (요청 시에만) |

---

## 기본 배포 (test) — 평소 작업

```bash
# 1. 코드 수정 후 테스트
npm test

# 2. 빌드
npm run build
copy dist\provider-manager.js provider-manager.js

# 3. 커밋 & push
git add -A
git commit -m "feat: 설명"
git push test main

# 4. 릴리즈 (선택)
git tag v1.xx.x-test.N
git push test v1.xx.x-test.N
# → GitHub Actions가 빌드+테스트 후 Release 자동 생성
```

---

## 프로덕션 배포 (origin) — 요청 시에만

### 1단계: URL을 프로덕션으로 전환

**변경할 파일 3개, 총 4곳:**

| 파일 | 변경 내용 |
|------|-----------|
| `src/plugin-header.js` (5행) | `cupcake-plugin-manager-test.vercel.app` → `cupcake-plugin-manager.vercel.app` |
| `src/lib/sub-plugin-manager.js` VERSIONS_URL | `cupcake-plugin-manager-test.vercel.app` → `cupcake-plugin-manager.vercel.app` |
| `src/lib/sub-plugin-manager.js` MAIN_UPDATE_URL | `cupcake-plugin-manager-test.vercel.app` → `cupcake-plugin-manager.vercel.app` |
| `src/lib/sub-plugin-manager.js` UPDATE_BUNDLE_URL | `cupcake-plugin-manager-test.vercel.app` → `cupcake-plugin-manager.vercel.app` |

**테스트 파일 1곳:**

| 파일 | 변경 내용 |
|------|-----------|
| `tests/main-plugin-update-regression.test.js` (40행) | `cupcake-plugin-manager-test.vercel.app` → `cupcake-plugin-manager.vercel.app` |

### 2단계: 빌드 & 테스트 & 릴리즈

```bash
npm run build
copy dist\provider-manager.js provider-manager.js
npm test
node scripts/release.cjs        # 또는 수동으로:
git add -A
git commit -m "release: provider-manager vX.XX.X"
git push origin main
git tag vX.XX.X
git push origin vX.XX.X
```

### 3단계: URL을 다시 테스트로 복원

1단계의 역순으로 모든 URL을 `cupcake-plugin-manager-test.vercel.app`으로 되돌린다.

```bash
npm run build
copy dist\provider-manager.js provider-manager.js
npm test
git add -A
git commit -m "chore: restore test domain URLs"
git push test main
```

---

## 주의사항

- **origin에는 절대 test URL이 포함된 코드를 push하지 않는다**
- **test에는 절대 production URL이 포함된 코드를 push하지 않는다**
- 프로덕션 배포 후 반드시 3단계(URL 복원)를 수행한다
- `origin` push 전에 반드시 전체 테스트(1331개)를 통과시킨다
