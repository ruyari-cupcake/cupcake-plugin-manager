# cupcake-plugin-manager

**Cupcake Provider Manager (CPM)** is a RisuAI V3 plugin that acts as a meta-framework for managing multiple AI provider backends (OpenAI, Anthropic, Gemini, Vertex AI, AWS Bedrock, DeepSeek, OpenRouter, GitHub Copilot, etc.) via sub-plugins.

## Features

- Multi-provider management via sub-plugin architecture
- Key rotation with automatic failover (429/529/503)
- Auxiliary slot system (translation, emotion, memory, etc.)
- Dynamic model fetching from provider APIs
- Settings backup & persistence across reinstalls
- SSE streaming helpers & message formatting utilities
- Hot-reload for sub-plugins without restarting RisuAI

## Security & Safety

> **TL;DR — CPM은 RisuAI V3 iframe 샌드박스 안에서 실행되며, 사용자의 시스템이나 브라우저 데이터에 접근할 수 없습니다.**

CPM은 `eval()`을 사용하여 서브 플러그인을 로드합니다. 이에 대한 보안 분석 결과를 투명하게 공개합니다:

### RisuAI V3 다중 보안 레이어

| Layer | Protection |
|-------|-----------|
| **iframe Sandbox** | `allow-same-origin` 미포함 → null origin, 호스트 DOM/쿠키/localStorage 접근 불가 |
| **CSP** | `connect-src 'none'` → 직접 네트워크 요청(fetch, XHR, WebSocket) 전면 차단 |
| **RPC Bridge** | 모든 API 호출은 postMessage 기반 RPC Proxy를 통해 직렬화됨 |
| **Host API Restrictions** | URL 블랙리스트, SafeElement 래핑, 권한 검사 적용 |

### eval()이 안전한 이유

1. **iframe 안에서 실행** — eval()은 이미 격리된 sandbox iframe 내부에서 실행됩니다. 추가적인 sandbox 탈출 경로를 열지 않습니다.
2. **RisuAI 자체도 eval() 사용** — RisuAI의 `GUEST_BRIDGE_SCRIPT`에서 `eval()`을 공식적으로 사용하며, iframe 내 eval()은 허용된 패턴입니다.
3. **사용자 동의 기반** — 모든 서브 플러그인은 사용자가 직접 설치(파일 업로드 또는 업데이트 버튼 클릭)한 코드만 실행합니다.
4. **업데이트 안전장치** — 원격 코드의 `@name`이 대상 플러그인과 일치하지 않으면 업데이트가 차단됩니다.

### eval() 코드 vs 일반 코드 비교

| 항목 | eval() 코드 | 일반 iframe 코드 |
|------|------------|----------------|
| 호스트 DOM 접근 | ❌ 불가 | ❌ 불가 |
| 호스트 localStorage | ❌ 불가 | ❌ 불가 |
| 직접 fetch() | ❌ CSP 차단 | ❌ CSP 차단 |
| window.parent 접근 | ❌ cross-origin 차단 | ❌ cross-origin 차단 |

> 📄 전체 보안 분석 보고서: [Issue #4 — CPM eval() Security Analysis Report](https://github.com/ruyari-cupcake/cupcake-plugin-manager/issues/4)

## Documentation

- [PLUGIN_GUIDE.md](PLUGIN_GUIDE.md) — Sub-plugin development guide (CPM API reference, examples, architecture)

## Development

### Prerequisites

- **Node.js** 20 or 22 (CI tested on both)
- **npm** 9+

### Setup

```bash
git clone https://github.com/ruyari-cupcake/cupcake-plugin-manager.git
cd cupcake-plugin-manager
npm ci            # Install dependencies (lockfile-based, deterministic)
```

### Scripts

| Command | Description |
|---------|-------------|
| `npm run lint` | ESLint 검사 (src/ + tests/) |
| `npm run lint:fix` | ESLint 자동 수정 |
| `npm run typecheck` | TypeScript 타입 검사 (checkJs, noEmit) |
| `npm test` | Vitest 테스트 실행 |
| `npm run test:watch` | Vitest watch 모드 |
| `npm run test:coverage` | 테스트 커버리지 리포트 |
| `npm run build` | Rollup → `dist/provider-manager.js` (IIFE 번들) |
| `npm run verify` | build + test 통합 실행 |
| `npm run bundle` | 서브 플러그인 update-bundle.json 생성 |

### Build Output

`npm run build` 실행 시 `dist/provider-manager.js` 에 단일 IIFE 번들이 생성됩니다.  
이 파일을 RisuAI → 설정 → 플러그인 → + 버튼으로 설치하면 됩니다.

### Deployment (Vercel)

프로젝트 루트에 `vercel.json`이 포함되어 있어 Vercel에 직접 배포 가능합니다.

```bash
npx vercel          # Preview 배포
npx vercel --prod   # Production 배포
```

서버리스 함수:
- `/api/versions` — 경량 버전 매니페스트 (자동 업데이트 알림용)
- `/api/update-bundle` — 전체 업데이트 번들 (버전 + 코드)

### Pre-commit Hooks

Husky + lint-staged가 설정되어 있어, 커밋 시 변경된 `.js` 파일에 대해 자동으로 ESLint가 실행됩니다.

## License

See individual plugin files for license information.