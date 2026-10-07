# scripts/guide-screens — 설치 가이드 화면 PNG

`/guide/ios` · `/guide/android` 의 폰 화면 이미지(`public/guide-screens/<키>.v1.png`)를 굽는 도구다(client-guide spec F-3 · D-3).
사이트는 PNG 만 싣는다 — 이 폴더의 파일은 빌드 · 배포에 들어가지 않는다.

| 파일                    | 역할                                                                                                                                                                                     |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `render.mjs`            | 매니페스트(`app/content/guide/figures.ts`)대로 창마다 PNG 하나를 굽는다. 강조(빨간 테두리)가 창 밖으로 잘리면 실패하고 쓰지 않는다                                                       |
| `harness.html`          | 굽는 페이지 — 사이트 글꼴(`public/fonts/PretendardVariable.woff2`)만 쓰고 네트워크를 쓰지 않는다                                                                                         |
| `screens.js` · `ui.css` | 재구성 화면 템플릿 — «설치가이드 2609 v1»(`design/install-guide/shared/` @ eb96d75) 사본. 원본과 다른 곳: «우리 발급 화면» 3종(지금 `/view/{orderId}` 글자 · 모양) · 길게 누르기 화면(주소창 · 뒤 페이지 QR 숨김) · `aos-code-input` 예시 주소 가림 · `ui.css` 글꼴 지정(system-ui 제거) — 원본을 다시 복사해 올 때 되살린다 |

## 다시 굽는 법

```bash
# playwright 는 레포 의존성이 아니다 — 설치된 위치를 준다 (design 생성기와 같은 방식)
export PLAYWRIGHT=<playwright/index.mjs 경로>
node --experimental-strip-types --no-warnings=ExperimentalWarning apps/client/scripts/guide-screens/render.mjs
node --experimental-strip-types --no-warnings=ExperimentalWarning apps/client/scripts/guide-screens/render.mjs --only ios-done,aos-scan
yarn workspace nomacom-client test app/content/guide   # 매니페스트 ↔ PNG 크기 · 고아 파일 검사
```

- 화면 글자 · 모양을 고치면 `screens.js` · `ui.css` 를, 보이는 범위(초점 · 배율)나 강조를 고치면 `figures.ts` 를 고친 뒤 다시 굽는다.
- 이미 배포된 PNG 를 바꾸면 `figures.ts` 의 `FIGURE_VERSION` 을 올린다 — 파일 이름이 바뀌어 CloudFront 캐시 무효화가 필요 없다(Proposal K4). 옛 파일은 지우지 않고 남겨 두면 테스트가 고아 파일로 막으니, 버전을 올릴 때 옛 PNG 정리는 사람 승인 뒤에 한다.
- 이미지 안에는 실제 전화번호 · 코드 · 스캔되는 QR 을 넣지 않는다(`010-****-****` · `••••` · 가짜 무늬). Apple · 삼성 로고 · 아이콘 · SF 글꼴도 쓰지 않는다.
