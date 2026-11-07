# CLAUDE.md (apps/client)

> ESIMmany (이심마니): eSIM QR code issuance web app for Naver Smart Store customers — **4-step 발급 흐름 완전 복원, prod-ready**
> 2026-09-23 부터 같은 배포판이 판매 사이트(`esimmany.com`) shell 도 렌더한다 — 아래 «판매 사이트 shell (W1-2)» 와 «4-step 가드 (K8)».

## 판매 사이트 shell (W1-2 · 2026-09-23)

spec `nomacom-wiki wiki/frontend/specs/client/2026-09-23-client-shell.md` · plan 같은 이름 `-plan.md`. 호스트 판정은 없다 — `esimmany.com`(판매) · `app.esimmany.com`(게스트 발급)이 같은 라우트를 렌더한다(Proposal K3 · 301 금지).

- **프레임** (`app/app.vue`) — 뷰포트 < 560px 전폭, ≥ 560px 가운데 440px(`--shell-frame-max`). ⚠️ `.app-bg` · `.app-frame` 과 그 사이 조상에 `overflow` · `transform` · `contain` 을 주지 말 것 — sticky 헤더 · fixed 탭바가 깨진다. DS `NMobileLayout` 은 content 래퍼 `overflow-y:auto` 때문에 쓰지 않는다(수치만 같음).
- **레이아웃** — `default`(헤더 + 본문 + 푸터 + 하단 탭) · `flow`(헤더·탭 없음 + compact 푸터). 4-step 4페이지와 `/checkout-preview` 가 `flow`. 새 판매 페이지는 기본값(`default`). 본인 확인 화면만 `definePageMeta({ ..., siteFooter: false })` 로 푸터를 뺀다(client-guide D-20 — K5 의 예외 · 다른 페이지에 쓰려면 spec 먼저).
- **쌓임 순서** — 헤더 `--n-z-index-sticky`(1020) < 탭바 `--n-z-index-fixed`(1030) < DS 오버레이(body 포털 1040/1050). 탭바를 1040 이상으로 올리지 말 것.
- **내비 정의 한 곳** — `app/utils/shell-nav.ts`(탭 4 · 전체 메뉴 · 약관 링크 · 활성 판정). 탭 활성 규칙을 바꾸면 `shell-nav.test.ts` 를 같이 고친다.
- **법정 문안 · 사업자정보 = 생성물** — `app/content/legal/*.ts`(약관 · 방침 · 환불 · 푸터 04 1절 줄 · 발급 팝업 05-A · 체크아웃 05-B — `/business` 페이지 · 04 2절 표는 없다, spec D-39). ⛔ **손으로 고치지 말 것** — legal-pages 정본을 고친 뒤 `yarn workspace nomacom-client legal:import --from <정본 폴더>`(규칙 `scripts/legal-posting.ts` — 처음 보는 태그 · 공개 금지어(공급사 명칭 · 자정 기준 등) · 조각 코드 블록에서 고르지도 건너뛰지도 않은 줄이 있으면 가져오기가 실패하고 아무것도 쓰지 않는다). 정본과 다르게 게시하기로 결정한 글자는 규칙의 **게시 수정**(`DocRules.edits` — 약관 8조② 자정 예시 괄호 D-33 · 환불 3항 전화번호 D-41 · 방침 4장 알림톡 수탁자 «솔라피(주)» D-54)과 **값 채움**(`fills` — 정본 값 자리 태그를 결정 글자로: 방침 4장 «AWS» · 솔라피 칸 · 04 1절 호스팅 «AWS» D-54)으로만 — 그 줄 · 글자 · 자리가 정확히 하나일 때만 적용되고 아니면 가져오기가 멈춘다(정본 rev 가 오면 규칙을 지운다 · 생성물 머리에 «게시 수정 N건» · «값 채움 N건»). **공제 문장(3,500원 폐기 비용 · 청약철회 제한)은 정본 그대로**(spec D-28 — 옛 A5 «발급 후 공제 금지» 는 해제됐다). `legal-content.test.ts` 가 핵심 줄을 고정한다. 고객센터 값만 손으로 적은 `app/content/support.ts` — `support.test.ts` 가 생성물 글자와 대조한다. 미확정 값은 `P9_4_PENDING`(화면 «(확정 전)») — 2026-10-03 D-54 로 지금은 0. ⛔ **main 머지 게이트**: `bash .github/scripts/content-pending-gate.sh` 가 0 — 머지할 **커밋** 기준(미커밋 수정은 통과가 아니다). 부르는 곳: finish-branch Step 0 첫 항목 · prod-push-check · CI `content-gate`(알림 — required check 없음). 법정 문서 화면 = `components/legal/LegalMarkdown.vue`(부분집합 렌더러 `utils/legal-render.ts` · v-html 없음).
- **noindex 목록 한 곳** — `shared/utils/robots.ts` 가 meta(`app.vue`) · `X-Robots-Tag`(`nuxt.config` routeRules) · `/robots.txt`(`server/routes/robots.txt.ts`) 세 출력을 만든다. 4-step 은 `Cache-Control: no-store` 도. `public/robots.txt` 를 다시 만들지 말 것(라우트보다 먼저 잡힌다).
- **CORS** — `server/utils/cors-origins.ts`. `esimmany.com` · `app.esimmany.com` 둘 다 있어야 각 호스트의 same-origin POST 가 403 을 피한다. `www` 는 없다.
- **테스트 체크아웃** `/checkout-preview` — 상품 «구매하기» 가 테스트 키일 때 고른 옵션으로 오고(`?option=` · shell D-60 — 키가 비었거나 `live_*` 면 구매 시트 · 스토어), URL 직접은 심사 품목(프랑스 7일)이다. ⚠️ 상품 페이지는 프리렌더라 `useRuntimeConfig()` 가 빌드 값(빈 문자열)으로 굳는다 — 키 판정은 서버 `GET /api/v1/checkout-preview/test-key` 로만, 이동은 전체 문서 이동(`location.assign`)으로만(SPA 이동이면 결제 페이지가 빈 키를 물려받는다). 진입 판정은 `middleware/checkout-preview.ts`(모르는 코드 → `/` · `test_` 아닌 키 → 상품 화면) · noindex(`/checkout-preview` + `/checkout-preview/**`). 결제창 = **토스페이먼츠 결제위젯 v2(주문서형)**(shell D-59 — 2026-11-04 PortOne 에서 교체): 진입 뒤 `loadWidgets` 가 SDK 를 동적 import(SSR 번들 제외 · 정적 import 는 타입만)해 결제수단 · 약관 위젯을 그리고, 버튼 = 키 ∧ 05-B 필수 2 ∧ 위젯 준비 ∧ 토스 필수 약관(`agreementStatusChange`) · `requestPayment` 는 onPay 안 한 곳(리디렉트 — 고객 정보 0). 복귀 `/checkout-preview/success` 는 이 탭(sessionStorage)의 주문번호 ∧ 금액 일치일 때만 `POST /api/v1/checkout-preview/confirm` 1회(주문번호는 confirm **전에** 지운다 — 진행 중 새로고침 중복 confirm 방지 · DONE 아닌 200 은 승인으로 그리지 않는다 · «청구되지 않아요» 는 `test_` 키일 때만) · `/fail` 은 이 탭이 결제를 시작했을 때만 사유. **저장 0** — confirm 은 토스 승인만 하고 6필드만 돌려준다(DB · 쿠키 · 세션 · 로그 0). 상품 값(금액 · 옵션명 = K1 두 칸)은 서버 카탈로그에서 옵션 코드로 찾는다(`item.get.ts` · 코드 없음 = `FRA00U01D07V2`) — confirm 의 금액 대조 기준도 같은 값(shell D-60). 복귀 화면은 이 탭 sessionStorage 의 옵션 코드 · 금액을 쓴다. 기본 옵션이 없으면 빌드 실패. ⚠️ 페이지는 `pages/checkout-preview/index.vue` — 같은 이름의 `checkout-preview.vue` 와 폴더가 함께 있으면 Nuxt 가 부모 라우트로 만들어 success · fail 이 안 보인다. 정적 배선 검사는 `legal-links.test.ts`(SDK 위치 · 버튼 조건 · 동의 블록 스냅샷).

## 카탈로그 — 홈 · 검색 · 국가 · 상품 상세 (W1-3 · 2026-09-23)

spec `nomacom-wiki wiki/frontend/specs/client/2026-09-23-client-catalog-pages.md` · plan 같은 이름 `-plan.md` · 목업 `-mockup.html`. 화면 배치는 **유심사 기준**(밑줄 탭 · 기간 드롭다운 · 용량 가격 카드 · 하단 구매 시트), 색은 브랜드 보라.

- **카탈로그 = `server/data/catalog.json`(K1 · W1-1 export · 손편집 금지)** — 없으면 `catalog.fixture.json`(스냅샷 표본 5 zone · 7 SKU, 빌드 로그 «⚠ FIXTURE»). ⛔ 픽스처로는 main 머지 불가(spec DoD 4). 필드명은 `shared/catalog/adapter.ts` **한 곳**에서만 K1 에 맞춘다. `parseCatalog()`(검증기)가 판매/전시 SALE·ON · usable · 무제한 기간(1~30 빈칸 없음 · 60·90 · 용량마다 같게) · 옵션 코드↔용량/일수(용량 두 자리) · 썸네일/지도 경로 정확 일치 · 네이버 CDN · K2 링크 · 필드 **키 누락**(기본값으로 채우지 않는다) · 나라 중복/불일치 · 핀 어휘/범위 · ISO 생성일을 막는다. 검증은 `modules/catalog.ts`(자동 등록 모듈 — 프리렌더 목록 · 체크아웃 값)가 빌드 · dev 기동 때 하고, 실패하면 멈춘다. `nuxt prepare`(postinstall)는 건너뛴다 — 깨진 카탈로그가 `yarn install` 을 막지 않게.
- **페이지 데이터는 페이지 전용 라우트** `server/api/catalog/*`(home · search-index · countries/[iso3] · zones/[zone]) — 외부 계약 아님(`/api/v1` 밖). 옵션 7,701개 전체를 브라우저 번들 · payload 에 싣지 않으려는 구조다 — 페이지에서 catalog JSON 을 import 하지 말 것.
- **가격은 K1 최종가만**(판매가 119,900 · 즉시할인 · 할인율 · 정가 취소선 금지 — spec D-2) + 보조 «하루 약 N원» / «1GB당 약 N원»(내림). 원화는 `formatWon`(ICU 미사용 — hydration 일치).
- **이미지 = 자사 자산만**(Proposal A6) — `yarn workspace nomacom-client catalog:assets --design <2609 design 폴더>`(W1-0 전에는 smartstore-assets 워크트리 — 읽기만)가 rep-v1 → 400px webp · 지도 SVG 축소 · flag-icons(MIT) 국기를 `public/catalog/{thumbs,maps,flags}/` 에 **해시 파일명**으로 쓰고 매니페스트 `app/content/catalog-assets.json` 을 만든다. K1 의 `images.*` 는 논리 경로 — `shared/catalog/assets.ts` 가 푼다. 실 catalog.json 이 오면 이 스크립트를 다시 돌린다(`assets.test.ts` 가 매니페스트 ↔ 카탈로그 · 파일 해시 불일치를 잡는다). `--design` 상대경로는 리포 루트 기준. ⚠️ rep-v1 PNG(`design/thumbnails/out/`)는 gitignore 라 머지로 옮겨지지 않는다 — main 에서 돌리려면 먼저 `node design/thumbnails/figma-2609/render-v1.mjs` 로 재렌더. 네이버 CDN(`shop-phinf` · `pstatic`) 핫링크 금지 · 이모지 국기 금지(Windows 에서 «CZ»).
- **URL 은 소문자**(`/countries/fra` · `/products/cze00`) — `catalog-path` 미들웨어가 대문자를 301, 판매 안 하는 나라 · 모르는 코드는 404.
- **프리렌더 목록은 명시**(`shared/catalog/seo.ts` `prerenderRoutes` — 와일드카드 routeRules 는 생성하지 않는다). canonical · og:url = `https://esimmany.com`(빌드 상수 · `shared/utils/site.ts`). `/search` 는 noindex(Disallow 7줄) · `sitemap.xml` = 프리렌더 − noindex − 가이드 전용판(canonical 이 사이트판). 정적 11페이지(법정 3 · 가이드 허브 + OS 2 · 지원 기기 · 설치 확인 2 · 통신사 바꾸기 · 나라별 통신사)도 canonical · 설명(`STATIC_DESCRIPTIONS`). ⚠️ 프리렌더된 **모든** 페이지는 `guestAppOrigin` 을 빌드 값으로 굳힌다 — 그래서 주문번호 조회는 루프백(127.0.0.1 · localhost · ::1)에서 열린 페이지면 자기 출처로 보낸다(`resolveGuestOrigin` · catalog D-17). 홈 · 검색 · 나라별 통신사는 데이터 라우트가 실패하면(나라별 통신사는 빈 목록도) 페이지 500 으로 던져 프리렌더를 멈춘다(fail-closed — `useFetch` 는 에러를 삼킨다).
- **구매 = 스토어 이동**(K2) — 상세 «구매하기» → 하단 시트(K2 원문 · 3초 · **같은 탭** `location.assign(naverUrl)` · 옵션 사전선택 없음). 문안은 `app/content/product-detail.ts`, 금지어(«자정» · «iPhone» · «1~90일» · «즉시할인» · 환불 «수수료/3,500/반품») 는 `product-detail.test.ts` 가 **내보낸 문안 전부 + 카탈로그 .vue 템플릿 + 환불 영역**에서 막는다(새 문안 함수는 테스트 `CALLS` 에 넣어야 통과). 가격 리터럴은 `price-literal.test.ts` 가 토큰으로 읽어 막는다(`shared/catalog/test-source.ts` — TS 스캐너 + SFC 파서: 문자열 · 템플릿 글자 · `formatWon(숫자)` · 가격 이름 대입 · `:price="숫자"` · JSON 가격 키). 컴포넌트 테스트(`SearchField` · `PurchaseSheet` · `ProductSections` · `UnderlineTabs` · `OrderLookupForm` · `PlanCards` · `ZoneCard` · `ErrorPanel` — 가격을 그리는 두 컴포넌트는 렌더 글자를 K1 원본과 대조)는 happy-dom — 대상 컴포넌트는 `vue` 에서 명시 import, Nuxt 함수 · `NuxtLink` 는 테스트가 끼운다. 카탈로그 파일 이름은 `shared/catalog/files.ts` 한 곳. 지도 핀 `labelDir` 는 2609 클래스 그대로(`right` = 라벨이 점 왼쪽). 홈 인기 목록 = `app/content/popular.ts`(John 승인 · 실 카탈로그에 없는 코드면 빌드 실패).
- **오류 화면** `app/error.vue`(catalog spec S-7 · F-13) — 404 · 500 을 사이트 틀(440 프레임 · 기본 레이아웃) 안에 한국어로. `app.vue` 대신 그려지므로 프레임 · `lang` · 제목(«{제목} · 이심마니») · noindex 를 스스로 넣는다(app.vue 를 고치면 같이 본다). 갈래(없는 주소 · 준비 중 나라 · 없는 상품 · 잠시 오류)는 `app/utils/error-view.ts` 순수함수, 문안은 `app/content/error-page.ts`, 본문은 `components/shell/ErrorPanel.vue`. 상태 코드는 바꾸지 않는다(준비 중 나라도 404). **서버를 부르지 않는다** — 칩(인기 8 · 아시아 5)은 빌드 때 `modules/catalog.ts` 가 K1 에서 골라 앱 설정 `errorChips` 로 넣는다(검색 빈 화면과 같은 `pickChips` · `shared/catalog/chips.ts` · 나라가 빠지면 빌드 실패). 갈래 · 틀은 **그 오류가 난 주소**(`errorRouteOf` — 오류가 바뀌는 순간의 라우트)로: `useRoute()` 는 오류에서 갱신되지 않고, 라우터 현재 라우트는 떠나는 동안 도착 주소로 먼저 바뀐다. `error.vue` 가 이 라우트를 `ERROR_ROUTE_KEY` 로 내려 주고 하단 탭 · 헤더는 `useShellRoute()` 로 읽는다(셸에서 경로를 읽는 새 코드도 `useShellRoute`). 링크 · 탭을 누르면 Nuxt 클라이언트 이동이 오류를 지운다. curl 로 볼 때는 `-H 'Accept: text/html'`(없으면 Nitro 가 JSON 오류를 준다).

## 설치 가이드 (client-guide · 2026-10-05)

spec `nomacom-wiki wiki/frontend/specs/client/2026-10-05-client-guide.md` · plan 같은 이름 `-plan.md`. `/guide`(허브) · `/guide/ios` · `/guide/android` — 옛 외부 가이드 사이트는 쓰지 않는다(테스트가 `apps/client` 전체에서 막는다). 발급 완료 화면 카드는 같은 가이드를 **하단 시트**로 연다(`components/guide/GuideSheet.vue` — 경로 · QR 화면 그대로, spec D-13). 본인 확인 화면도 약관 링크 아래 · «주문 확인하기» 위에 같은 카드 · 시트(D-19 — 입력한 이름 · 전화 그대로). 본인 확인 화면의 «주문 확인하기» 는 화면 아래에 붙어 있다(D-25 — 페이지 맨 끝(폼 바로 뒤)의 sticky · 버튼은 `form` 속성으로 폼에 이어진다 · 스크롤하면 내용만 움직인다 · 페이지 · 레이아웃 · 앱 프레임 · html · body 에 overflow(hidden · auto · scroll)를 주면 풀린다 · 버튼 줄은 불투명 · 흐림은 위 20px 띠만 누름 통과). 시트(설치 가이드 · 약관)를 닫을 때 reka 의 포커스 복귀가 만든 스크롤은 `app/utils/keep-scroll.ts` 가 닫을 때 자리로 되돌린다(S-4 — 사용자가 직접 움직이면 손을 뗀다). 카드 · 시트 · 주소 상태는 `components/guide/GuideCards.vue` 하나를 두 화면이 쓴다. 카드는 사이트판 링크(새 탭 — 화면 준비 전 · 보조키 클릭)이고 보조키 없는 클릭만 시트(D-17), 시트 상태는 주소 `?guide=<os>` — 휴대폰 뒤로 가기 = 시트 닫기(D-15). 사이트 밖 링크용 **전용판** `/install-guide/ios` · `/install-guide/android` 는 `flow` 레이아웃(헤더 · 하단 탭 없음) · canonical 은 사이트판 하나(noindex 없음 · sitemap 제외 — D-18). 지원 기기도 같은 틀의 전용판 `/install-guide/devices`(D-24 — 본문 = `/supported-devices` 그대로 · 테스트가 두 페이지를 대조) — 전용판 · 시트의 «지원 기기 확인하기» 가 연다(사이트판 가이드는 `/supported-devices`). 전용판 주소 목록은 `GUIDE_BARE_ROUTES`(프리렌더 · sitemap 제외) 한 곳.

- **본문 하나 · 쓰는 곳 셋** — 바로가기 칩은 STEP 1 · 2 · 3 · 문제 해결 4개 한 줄(D-21) · 칩 줄은 머리 밖 칸에서 sticky(D-23 — 사이트판 헤더 아래 · 전용판 0 · 시트 본문 맨 위, 칩으로 이동한 구간이 칩 줄에 가리지 않게 착지 여백 · 시트는 이동 계산에서 칩 줄 높이를 뺀다) · 확인 «지원 기기» 카드에 «지원 기기 확인하기»(D-22) — 세 판 모두 같다. `GuideArticle` 의 `mode`: `page`(사이트 — DOM · CSS 는 골든이 고정) · `bare`(전용판 — OS 전환이 `/install-guide/<os>`) · `sheet`(OS 전환 · 바로가기 = 버튼, 구간 id 접두 `gs-`, «내 eSIM 조회하기» 숨김, «고객센터 전체 보기» 새 탭). 시트 전용 모양은 `GuideSheet.vue` 에만 둔다 — 가이드 컴포넌트 CSS 를 고치면 스타일 골든이 바뀐다.
- **문안 = «설치가이드 2609 v1» 글자 그대로**(`design/install-guide/{ios,android}.html` @ eb96d75) — `app/content/guide/{ios,android,common}.ts`. 바꾼 글자는 spec D-4 표에만. 문장 안 표기는 `inline.ts`(`{{누를 이름}}` · `[[설정 › 셀룰러]]` · `**굵게**` · `((줄바꿈 금지))` — v-html 없음 · 짝 · 표기 안 표기 · 빈 이름은 던진다). 제목 · 배지 · 태그 칸에는 표기를 쓰지 않는다(그대로 그린다 — 테스트).
- **폰 화면 = PNG**(`public/guide-screens/<키>.v1.png`, 창 368px × 3배). 매니페스트 `app/content/guide/figures.ts` 하나를 생성 스크립트와 페이지가 같이 읽는다. 다시 굽기: `scripts/guide-screens/README.md`(Playwright 는 레포 의존성 아님 — `PLAYWRIGHT=` 로 지정). 구운 기록 `figures.lock.json` 이 템플릿 · 글꼴 · 창 값 · PNG 지문을 들고 있어, 고치고 다시 굽지 않으면 `guide.test.ts` 가 실패한다. 이미 배포된 PNG 를 바꾸면 `FIGURE_VERSION` 을 올린다(CloudFront 캐시 무효화 불필요).
- 화면 템플릿(`scripts/guide-screens/screens.js` · `ui.css`)은 2609 사본 — «우리 발급 화면» 3종은 지금 `/view/{orderId}` 글자 · 모양을 따른다. **발급 화면을 고치면 이 3종도 고쳐 다시 굽는다**(«아이폰 수동 설치» · «LPA 전체» · «QR 코드 다운로드» 는 가이드 본문도 쓴다).
- 이미지 안에 실제 전화번호 · 코드 · 공급사 주소 조각 · 스캔되는 QR · Apple/삼성 로고를 넣지 않는다.

### 설치 확인 · 현지 통신사 바꾸기 · 나라별 현지 통신사 (client-guide-check · 2026-10-14)

spec `esmn-wiki wiki/frontend/specs/client/2026-10-14-client-guide-check.md` · plan 같은 이름 `-plan.md`. 옛 가이드 사이트의 «간단 설치 확인» · «통신사 변경» · «국가별 통신사» 를 옮긴 페이지 — 사이트판 `/guide/check/{ios,android}` · `/guide/network`(두 OS 한 페이지) · `/guide/carriers`, 전용판은 같은 이름으로 `/install-guide/…`(flow · canonical = 사이트판 · sitemap 제외).

- **본문 = `GuideCheckArticle`** — 설치 가이드와 같은 틀(머리 · OS 전환 · sticky 칩 줄 · 구간 · 안내 · 화면 · 문의)에 구간 구성만 다르다. 틀 CSS 는 `GuideArticle` 값 **복제** — `guide-frame-css.test.ts` 가 같은 값인지 본다(공용 CSS 로 빼면 설치 가이드 스타일 골든이 바뀐다). 한쪽 틀을 고치면 다른 쪽도.
- **문안 `app/content/guide/check.ts`** — 요금 경고 두 줄은 가이드 STEP 3 객체를 그대로 쓴다. 이름으로 우리 eSIM 을 가려내지 않고(공급사 · 홈망 · 옛 네트워크 이름 0 — 영문 · 한글 음역) eSIM 을 지우라고 하지 않는다(spec D-6 · F-10 — `check.test.ts` 가 콘텐츠 · 새 화면 대체 글 · 새 페이지 · 컴포넌트 소스를 본다, 허용은 «지우지 않아도 돼요» · «지우지 말고» · «한 번 지운 eSIM은 다시 설치할 수 없어요» 뿐). spec §⑤ 문장은 테스트가 글자로 고정한다. 허브 «설치한 뒤에» 문안은 `common.ts`(허브 번들에 본문 문안을 싣지 않게).
- **칩 줄 높이**(`--g-jump-h`)는 칩 수에 따라 — 칩 2 는 늘 53px · «확인 n» 칩 4 는 폭 354 이하 72px · 칩 없음 0(`g-article--chips-N` — guide-frame-css.test 가 허용 목록으로 고정).
- **문제 해결 링크** — `GuideFaq.link.bareTo` 가 있으면 전용판은 그 주소 · 발급/본인 확인 화면 시트는 그 주소를 새 탭으로, 없으면(«내 eSIM 조회하기») 시트에서 숨긴다.
- **나라별 통신사** = 카탈로그 K1 `operators` · `network`(상품 상세 «현지 통신사» 칩과 같은 값)를 페이지 전용 라우트 `server/api/catalog/carriers` 로 — 검증기는 같은 나라의 통신사 · 망이 zone 마다 다르면 빌드를 멈춘다(값 그대로 비교). «(추천)» 은 없다(근거 자료 없음).

## 4-step 가드 (K8 · 2026-09-23)

페이지별 `onMounted` 가드는 없다 — `app/middleware/order-flow.ts` 가 4페이지(`definePageMeta({ middleware: 'order-flow' })`)를 지킨다.

- **흐름 쿠키 `nomacom_flow`** — `{v:1, orderId, fullName, phoneNumber, productOrderId?}` 만. `fullName`·`phoneNumber` 는 verify 에 **사용자가 입력해 통과한 값**(DB 수령인 값 아님). Max-Age 1시간(쓸 때마다 갱신) · SameSite=Lax · Secure(dev 제외) · Path=/ · 호스트 한정 · HttpOnly 아님(클라이언트가 쓴다). 쓰는 곳: verify 통과(`start`) · details 선택 · 취소철회 성공(`select`). ⛔ activationCode · 주문 상세를 넣지 말 것 — 화면 데이터는 늘 서버 verify 로 다시 받는다.
- **미들웨어 순서** — ① 경로 주문번호가 양의 안전 정수가 아니면 `/my-esim` ② verify 는 통과 ③ store 에 이 주문 목록이 없으면 쿠키(같은 주문번호일 때만)의 이름·전화로 `POST /api/v1/verify` 를 **그대로** 불러 복원 — 실패는 `/verify/{id}?reason=reverify`(verify 거절이면 쿠키도 지움) ④ 선택 상품은 쿠키 productOrderId 로 목록에서 ⑤ `app/utils/flow-guard.ts` 판정표.
- **초기 진입에서 두 번 돈다** — 서버(SSR, 이동이면 302) + hydration. 서버가 복원한 Pinia 상태가 페이로드로 넘어가므로 두 번째는 복원을 건너뛴다. SSR HTML 에 주문 정보가 실리므로 4-step 응답은 `no-store` 필수.
- 판정표를 바꾸면 spec §5 S-8 → `flow-guard.test.ts` → 코드 순으로. 복원 결정(`decideRestore`) · 선택(`pickSelection`)도 같은 파일의 순수함수다.
- **라우터는 대소문자를 구분한다**(`app/router.options.ts` `sensitive: true`) — 끄면 `/View/1` 이 가드 · noindex · `no-store` 를 모두 비껴 간다.
- **bfcache** — 외부 이동(주문번호 조회 · 결제창) 뒤 뒤로 오면 JS 상태가 살아 있다. 로딩 플래그는 `pageshow`(persisted)에서 되돌린다.
- **화면 날짜는 `Asia/Seoul` 고정**(`app/utils/date.ts` — `server/utils/date.ts` 의 개통 시각 계산은 고객이 고른 시간대라 건드리지 말 것) — SSR 복원 뒤 서버(UTC)와 브라우저가 다른 날짜를 그리면 hydration mismatch.

## Current Status (2026-08-18)

깡통 단계 종료. 4-step 유저 흐름 (verify → details → select-date → view) 이 토스풍 디자인으로 복원되어 prod-ready 상태 (`9d04e9d` preview seed 제거 완료). 이전 CLAUDE.md 의 "향후 작업 (깡통 복원 단계)" 5단계는 모두 완료됨:

1. ✅ DB / Drizzle / postgres — `server/db/{schema,index}.ts`
2. ✅ Maya API client — `server/utils/maya-api.ts` (Basic auth)
3. ✅ 4-step pages — `app/pages/{verify,details,select-date,view}/[orderId].vue`
4. ✅ Pinia order store — `app/stores/order.ts` (popup 8종은 legacy 로 미사용 — 아래 참고)
5. ✅ env 키 — `DATABASE_URL`, `MAYA_API_*` (process.env 직접 참조)

이후 hardening (branch `imjohnkoo/client-api-hardening`):

- verify / activate 에 **수신자 대조** (orderId 만으로 타인 PII / activationCode 조회 차단)
- activate **재개 (resume) 로직** — 부분 발급 상태에서 재시도 시 부족분만 이어서 발급, 전량 발급 시 idempotent 성공 응답
- activate **in-flight lock** — 같은 productOrderId 동시 요청 직렬화 (단일 인스턴스 전제)
- vitest 유닛 테스트 도입 (`server/utils/verification.test.ts`)

## Tech Stack

| Layer         | Technology                                          | Notes                                                                    |
| ------------- | --------------------------------------------------- | ------------------------------------------------------------------------ |
| Framework     | Nuxt 4.4+                                           | SSR + Nitro. Nuxt 3 → 4 마이그레이션됨 (`app/` srcDir)                   |
| Styling       | Tailwind 4 (`@tailwindcss/vite`)                    | NanumSquareNeo / Pretendard                                              |
| Design System | `@imjohnkoo/design-vue`, `@imjohnkoo/design-tokens` | workspace deps. 페이지는 DS 컴포넌트 (NButton/NAlertDialog 등) 직접 사용 |
| State         | Pinia (`@pinia/nuxt`)                               | `app/stores/order.ts` — orders / singleOrder                             |
| DB            | PostgreSQL + Drizzle (`postgres` driver)            | **prod DB 스키마를 backend (NestJS TypeORM) 와 공유** — 아래 주의        |
| Maya API      | `server/utils/maya-api.ts`                          | Basic auth, `createEsim` 만 사용                                         |
| Tests         | vitest (server · app · shared 순수 로직)            | `yarn workspace nomacom-client test`                                     |
| Deployment    | AWS CodeDeploy + SSM + CloudFront                   | `d3un5i1lmp1eem.cloudfront.net`                                          |

## Directory Structure

```
apps/client/
├── app/
│   ├── app.vue                        # 440px 프레임 + useHead(lang · 제목 템플릿 · noindex meta)
│   ├── assets/css/{main.css, animations.css}
│   ├── layouts/{default,flow}.vue     # 판매(헤더·탭·푸터) / 4-step·체크아웃(푸터만)
│   ├── middleware/order-flow.ts       # 4-step 가드 (K8) — 흐름 쿠키 복원 + 판정표
│   ├── components/shell/              # ShellHeader · ShellMenu · BottomTabBar · SiteFooter
│   ├── components/{order,legal}/      # OrderLookupForm · LegalMarkdown(법정 문서 렌더)
│   ├── components/popup/              # ⚠️ legacy 9종 — 어느 페이지도 import 안 함 (아래 참고)
│   ├── composables/useApi.ts          # verifyOrder / activateOrder ($fetch wrapper)
│   ├── composables/useFlowSession.ts  # 흐름 쿠키 nomacom_flow
│   ├── content/                       # legal/*.ts = 법정 문안 생성물(손으로 고치지 말 것) · support.ts 고객센터 · pending.ts (P9_4_PENDING = 확정 전)
│   ├── pages/
│   │   ├── index.vue                  # 홈 — 검색 진입 · «인기국가 · 다국가» 탭 격자 · 주문번호 조회
│   │   ├── countries/[iso3].vue       # 국가 페이지 — zone 카드 (W1-3)
│   │   ├── products/[zone].vue        # 상품 상세 — 선택기 · 구매 시트 · 안내 6섹션 (W1-3)
│   │   ├── my-esim.vue · my.vue       # 내 eSIM(주문번호 → 발급 호스트) · 마이(고객센터 · 약관)
│   │   ├── terms · privacy · refund .vue              # 법정 3종 (/business 없음 — D-39)
│   │   ├── search.vue                 # 국가 검색(초성 · 영문 · 도시 · 별칭) — noindex
│   │   ├── guide/{index,ios,android}.vue  # 설치 가이드 허브 · 아이폰 · 안드로이드 (client-guide)
│   │   ├── install-guide/{ios,android,devices}.vue # 전용판(가이드 2 · 지원 기기) — flow 레이아웃 · canonical = 사이트판 (client-guide D-14 · D-18 · D-24)
│   │   ├── checkout-preview/{index,success,fail}.vue # 테스트 체크아웃 · 결제 복귀 2 (구매하기 직결 · noindex · 토스 위젯)
│   │   ├── verify/[orderId].vue       # step 1 — 이름 + 전화번호 입력
│   │   ├── details/[orderId].vue      # step 2 — 주문 (상품) 선택
│   │   ├── select-date/[orderId].vue  # step 3 — 시작 국가 + 날짜 선택 → 발급
│   │   └── view/[orderId].vue         # step 4 — QR 표시 (multi-QR accordion)
│   ├── stores/order.ts                # Pinia
│   ├── types/{api,order}.ts
│   └── utils/                         # date · formatter · shell-nav · order-lookup · flow-session · flow-guard · checkout-preview
├── shared/utils/robots.ts             # noindex 목록 단일 출처 (meta · X-Robots-Tag · robots.txt)
├── shared/catalog/                   # 카탈로그 — adapter · validate · derive · picker · search · seo · assets · map-svg · preview (순수 · 테스트) · test-data(테스트 전용)
├── modules/catalog.ts                 # 빌드 모듈(자동 등록) — K1 검증 · 프리렌더 목록 · 체크아웃 상품 값
├── scripts/catalog-assets.ts          # 자산 생성(sharp · flag-icons) — design/ 는 읽기만
├── public/catalog/                    # 생성물 — 해시 파일명 썸네일 · 지도 · 국기
├── server/
│   ├── api/health.get.ts              # /api/health
│   ├── api/v1/{verify,activate,withdraw-cancel}.post.ts
│   ├── api/v1/checkout-preview/confirm.post.ts  # 테스트 체크아웃 토스 승인 1회 · 저장 0
│   ├── db/{index,schema}.ts           # Drizzle (order/esim/plan/plan-type)
│   ├── middleware/{cors,auth}.ts      # cors: /api/** 화이트리스트(utils/cors-origins.ts), auth: placeholder (토큰 추출만)
│   ├── routes/robots.txt.ts           # robots.txt (shared/utils/robots.ts 에서 생성)
│   └── utils/
│       ├── maya-api.ts                # Maya client
│       ├── verification.ts            # 수신자 대조 정규화 (+ .test.ts)
│       ├── string.ts                  # generateEsimTag
│       ├── date.ts                    # createUTCDateTime / createLocalDateTime
│       └── auth.ts, types.ts
├── Dockerfile                         # multi-stage (tokens → vue → client)
├── vitest.config.ts                   # server · app · shared 의 *.test.ts, node env
└── nuxt.config.ts                     # runtimeConfig.public.apiBase = '/api/v1'
```

## 4-Step 발급 흐름

1. **verify** — 고객이 이름 + 전화번호 입력 → `POST /api/v1/verify`. 서버가 주문 연락처와 **정규화 대조** (전화: 숫자만, 이름: NFC + 공백 제거 + 소문자). 매칭은 **군간 AND + 군내 OR** (john 결정 2026-08-19): 이름은 {구매자명, 수령인명} 중 하나, 전화는 {구매자 전화, 수령인 전화} 중 하나 — 선물 주문 (결제자≠수령인, backend 2026-06 CS 이력) 커버. backend `52dbf65` 와 동일 정책 (파리티 확인됨). 불일치 시 `verified:false` 만 반환 (취소 여부도 미노출)
2. **details** — orderId 하위 상품주문 목록에서 선택. 선택 시 store 의 수신자 정보로 재검증 호출 (DB 원본값이므로 대조 통과)
3. **select-date** — 시작 국가 + 날짜 선택 → confirm 모달 → `POST /api/v1/activate`. `startTime: -24` 로 전송 → `timeToBeActivatedInUTC` 가 (선택일 −1일) 00:00 현지시각 = eSIM 사전 활성화 버퍼 (`fa27295`)
4. **view** — 발급된 eSIM QR 표시. quantity > 1 이면 accordion 으로 다중 QR

진입 가드는 `order-flow` 미들웨어 한 곳 — 판정표는 `app/utils/flow-guard.ts`(위 «4-step 가드 (K8)»). 액션 실패 뒤 알림 · 이동은 각 페이지에 그대로 있다.

## API Endpoints

| 경로                      | 메서드 | 동작                                                                                                                                                                                                                                                                   |
| ------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/health`             | GET    | `{ status: 'ok', app: 'nomacom-client', commit, timestamp }`                                                                                                                                                                                                           |
| `/api/v1/verify`          | POST   | 수신자 대조 후 주문 상세 + esims + planType 반환. planTypes 는 `inArray` 일괄 조회 (N+1 없음). `productOrderId` 로 필터 가능                                                                                                                                           |
| `/api/v1/activate`        | POST   | 동의(`consent` 판 · 해시) 검증 400 → 수신자 대조 (403) → provider `spark` 만(그 밖 400) → 새 eSIM 이 생길 요청이면 `consent_log` 1행 → 부족분만 Spark 발급(`utils/spark-issuance.ts` — 원장 · 동시성 규약). 전량 발급돼 있으면 기존 상태로 idempotent 성공(행 0). 같은 주문의 동시 요청은 in-flight lock 직렬화. Maya 분기 코드는 남아 있지만 닿지 않는다 |
| `/api/v1/checkout-preview/confirm` | POST | 테스트 체크아웃 승인(shell D-59) — 본문 `{paymentKey ≤200, orderId(pv-…), amount 정수}` 검증 400 `INVALID_REQUEST` → 빌드 주입 금액과 다르면 400 `AMOUNT_MISMATCH` → 시크릿 없음 503 `NOT_CONFIGURED` → 토스 `POST /v1/payments/confirm`(Basic 시크릿: · 10초) → `{status, orderId, paymentKey, approvedAt, method, totalAmount}` 만(승인 금액 불일치 502) · 토스 4xx 는 같은 상태 `{code, message}` · 네트워크 · 5xx 502 `UPSTREAM`. 저장 0 |
| `/api/v1/withdraw-cancel` | POST   | 수신자 대조 + 취소요청 상태 사전 체크 후 backend 내부 endpoint 에 위임(Naver 발송처리 · DB 갱신은 backend 소유). 내부 env 없으면 503                                                                                                                                   |

### activate 신뢰성 설계 (변경 시 유지할 불변식)

- **발급 동의 기록(client-consent-log · 2026-11-01)** — spec `esmn-wiki wiki/frontend/specs/client/2026-11-01-client-consent-log.md`. `consent_log` INSERT 는 **거절 판정을 모두 지난 뒤 · 벤더 호출 전 한 자리**(provider 가드 뒤 · `existingCount < quantity` 일 때만). INSERT 실패 = 500 `CONSENT_LOG_FAILED` · 벤더 0 — 동의 기록 없는 발급 0. 발급 트랜잭션에 묶지 않는다(동의는 했으므로 발급이 뒤에서 실패해도 행은 남는다 · UNIQUE 없음이 계약). 새 거절 판정을 넣으면 INSERT **앞**에 둔다(거절에는 행 0).
- **동의 판 · 해시 = `shared/consent/issue-consent.ts` 한 곳** — `IssueConsentLabel` 렌더 글자(textContent → NFC → 공백 접기 → trim)의 SHA-256 상수. 글자를 바꾸면 `IssueConsentLabel.hash.dom.test.ts` 가 깨진다 → `textVersion` 과 `textHash` 를 함께 올린다(상수만 고치지 말 것). 고지 줄(`NOTICE_LINES`)은 해시에 넣지 않는다(spec D-20).
- **`ip_hash`** = HMAC-SHA256(`PII_HMAC_KEY` base64 디코드 32바이트, IP) hex — IP 는 `X-Forwarded-For` **맨 오른쪽**(CloudFront 가 붙인 viewer IP · 맨 왼쪽은 고객이 꾸밀 수 있다), 없으면 소켓 주소. 키가 없으면 NULL + `CONSENT_IP_HASH_SKIPPED` 경고(발급은 진행). 평문 IP 는 DB · 로그 0. ⚠️ 원본 `client-origin.esimmany.com:3000` 이 공개라 CloudFront 를 안 거친 요청은 XFF 를 꾸밀 수 있다(증빙 품질 한계).
- **화면** — 서버는 동의 400 · 기록 500 에만 `data.code`(`CONSENT_REQUIRED` · `CONSENT_LOG_FAILED`)를 단다. 발급 확인 팝업은 그 두 코드만 «잠시 후 다시 시도해 주세요» → 팝업 복귀(체크 유지 · 이동 0 — `app/utils/issue-failure.ts`), 그 밖은 기존 «주문 정보를 찾을 수 없어요» → 본인 확인. 체크 상태는 저장하지 않는다(팝업을 열 때마다 다시 체크). mobile 은 동의 UI 가 없어 consent 없이 부른다 → 400(알려진 영향 · mobile 트랙 몫).
- **`consent_log` 스키마 주인은 backend entity + 위키 SQL** — Drizzle 미러(`schema.ts` `consentLog`)는 따라가기만. 로컬 walk DB 는 `client-walk-db.sh consent-sql <위키 migrations>` 로 실 DDL 을 쓴다(`schema` 는 이 표를 만들지 않는다). 행은 5년 보존이라 DROP · DELETE 금지.

- **Maya 발급 성공분은 반드시 즉시 DB 기록** — Maya 호출은 외부 side-effect 라 DB 트랜잭션으로 원자성 확보 불가. 트랜잭션은 esim + plan 쌍 원자화에만 사용
- **재시도 = 재개** — 기존 발급 수 `existingCount` 부터 루프 시작 (`generateEsimTag(order, i)` 의 인덱스 연속성 유지). 중간 실패 후 재시도해도 초과 발급 없음
- **in-flight lock 은 단일 Nitro 인스턴스 전제** — 다중 인스턴스 확장 시 DB advisory lock 등으로 교체 필요. prod DB 스키마가 backend 공유라 unique 제약 추가는 신중히

## DB 주의사항

`server/db/schema.ts` 는 **prod DB (TypeORM camelCase) 에 맞춘 Drizzle 선언** (`350713b`):

- 테이블명: `order`, `esim`, `plan`, `plan-type` (hyphen)
- FK 컬럼: TypeORM 기본 naming — `orderProductOrderId`, `esimEsimId`, `planTypePlanTypeId`
- backend (NestJS) 가 같은 DB 를 사용하므로 **스키마 변경 (drizzle-kit push 등) 금지** — 스키마 변경은 backend 와 합의 후

## 환경 변수

| 키                                                                                                            | 용도                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                                                                | postgres 연결. prod 는 SSL require                                                                                                            |
| `MAYA_API_ENDPOINT` / `MAYA_API_CLIENT_ID` / `MAYA_API_CLIENT_SECRET`                                         | Maya B2B API (Basic auth)                                                                                                                     |
| `SPARK_API_ENDPOINT` · `SPARK_API_TOKEN` · `SPARK_ACCOUNT_ID` · `SPARK_PROXY_ENDPOINT` · `SPARK_PROXY_SECRET` | Spark 발급 (프록시 = backend 화이트리스트 IP 경유)                                                                                            |
| `ESIM_MANAGER_INTERNAL_ENDPOINT` · `ESIM_MANAGER_INTERNAL_SECRET`                                             | 취소철회 backend 위임                                                                                                                         |
| `CORS_EXTRA_ORIGINS`                                                                                          | `/api/**` 허용 origin 추가(쉼표 구분 · `server/utils/cors-origins.ts`). 로컬 walk 는 봉투 스크립트가 `http://127.0.0.1:<port>` 한 값만 넣는다 |
| `NUXT_PUBLIC_GUEST_APP_ORIGIN`                                                                                | runtimeConfig — 주문번호 조회가 보내는 발급 호스트. 기본 `https://app.esimmany.com`, 로컬 walk 는 봉투 스크립트가 `http://127.0.0.1:<port>`(자기 포트)로 넣는다 |
| `NUXT_PUBLIC_TOSS_CLIENT_KEY` · `NUXT_TOSS_SECRET_KEY` | runtimeConfig `public.toss.clientKey` · 서버 전용 `tossSecretKey` — `/checkout-preview` 토스 결제위젯 · confirm(shell D-12 · D-59). SSM `/nomacom/client/` 에 같은 이름(String · SecureString — `after_deploy.sh` 는 `--with-decryption`). 심사 기간 `test_*` · 계약 뒤 같은 이름에 `live_*`(코드 0). 로컬 walk 봉투는 `test_*` 만 받는다 |

서버 키는 `process.env` 직접 참조(토스 시크릿만 runtimeConfig `tossSecretKey` ← `NUXT_TOSS_SECRET_KEY`), `NUXT_PUBLIC_*` 는 runtimeConfig 런타임 덮어쓰기. prod 는 `/nomacom/shared/maya/*`, `/nomacom/shared/db/*`, `/nomacom/client/*` SSM 경로에서 `after_deploy.sh` 가 주입. 상세는 `.claude/rules/ssm-paths.md`.

## Key Commands

```bash
yarn workspace nomacom-client dev          # dev server (--dotenv .env.local)
yarn workspace nomacom-client test         # vitest — server/** · app/** · shared/** 순수 로직
yarn turbo run build --filter=nomacom-client

# 로컬 walk(QA ⑦) — ⛔ prod DB 에 붙이지 않는다 · 벤더 · 내부 env 를 넘기지 않는다(John 지시 2026-09-23).
# 봉투 스크립트가 env -i 허용 목록으로만(yarn 미경유 · 127.0.0.1 · --dotenv /dev/null · CORS 는 자기 포트 값) 띄우고, DB 는 dev 모드의
# 로컬 합성 DB(postgres://<영숫자>:<영숫자>@127.0.0.1:55432/<영숫자> · 55432 리스너가 로컬 컨테이너일 때)만 받는다.
# 워크트리의 apps/client/.env(.local) · 루트 .env(.local) 가 있으면 거부 — worktree-setup 이 만든 .env.local 심링크면 **링크만** 지운다
# (메인 클론 원본은 건드리지 않는다). 브라우저 · curl 은 **http://127.0.0.1:<port>** — localhost 는 ::1 로 먼저 붙어 같은 포트의
# 봉투 밖 서버에 닿을 수 있다(그래서 포트가 어느 주소든 점유돼 있으면 기동 거부). 회귀: bash .claude/scripts/client-walk-server.test.sh
bash .claude/scripts/client-walk-server.sh dev  3005                                             # shell · 비-DB 4-step
bash .claude/scripts/client-walk-server.sh prod 3006                                             # 헤더 · noindex (DB 없음)
# 합성 DB walk(E2E-3 · 4 · 7) — .claude/scripts/client-walk-db.sh(spec D-24 · John 승인): 로컬 Docker postgres nomacom-walk-pg 만 ·
# up → schema → seed(가짜 주문 2건 · 010-0000-xxxx) → 봉투 dev 서버에 그 URL → counts(E2E-7 행 수). 이 스크립트는 **어느 명령도 호스트 55432 에
# 붙지 않는다** — schema 는 drizzle-kit export(DB 연결 없음) SQL 을 컨테이너 안 psql 로 · seed · counts 도 docker exec. 컨테이너는 127.0.0.1:55432 에만 ·
# 원격 docker 거부. 호스트 포트로 붙는 것은 봉투 dev 서버뿐(55432 리스너 판정). 회귀: bash .claude/scripts/client-walk-db.test.sh
# ⛔ drizzle-kit push / db:push 금지(drizzle.config 는 셸의 DATABASE_URL 을 쓴다). 실발급 성공 경로는 prod 승격 당일 operator AC.

# Docker
docker build -f apps/client/Dockerfile -t nomacom-client:test .
```

## Legacy: `app/components/popup/` (9종, 미사용)

`AlertModal, BaseModal, CancelledOrderAlertModal, ConfirmOrderModal, IssueQrCodesModal, LoadingModal, NoOrderAlertModal, PullingOrdersModal, ServerErrorModal` — grep 확인 결과 (2026-08-18) 어느 페이지/컴포넌트도 import 하지 않음. 페이지들이 DS 의 `NAlertDialog` / `NLoaderDialog` / `NBottomSheet` 를 직접 사용하면서 대체됨. **삭제 여부는 별도 판단 필요** (Nuxt auto-import 미사용 확인됨 — 참조 0).

## Maya B2B 정책 (카피/로직 작성 시 준수)

ESIMmany 는 Maya B2B 리셀러로 **자체 정책 통제** — Maya B2C 공식 문서를 fallback 진실로 간주 금지 (메모리 `maya_b2b_policy_control`):

- 사용일수는 자정이 아닌 **첫 연결 시점부터 24h rolling** 차감 — UI 카피 위배 금지
- 다국가 플랜은 개통 후 **자동 로밍** — 국가 간 이동 시 추가 설치/설정 없음
- 소진 후 속도 선택 (128/500/1000 kbps) 등 자체 설정

## 관련 문서

- 루트 `CLAUDE.md` — monorepo 구성, Turbo, Nuxt 4 마이그 노트
- `.claude/rules/deployment.md` — CodeDeploy + GHA + CloudFront 흐름
- `.claude/rules/ssm-paths.md` — SSM 경로 (확정)
- `apps/admin/CLAUDE.md` — admin (dual DB: admin DB / eSIM 메인 DB)
- memory: `maya_b2b_policy_control`, `esim_usage_policy_copy` — 정책 진실 기준
- memory: `future_mobile_app_esim_install` — mobile 앱 Universal Link 흐름
