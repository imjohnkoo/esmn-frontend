/* ====================================================================
   screens.js — 설치가이드 재구성 화면 (iOS 26~27 · One UI 7~8 · 우리 발급 화면)

   원본: design/install-guide/shared/screens.js @ eb96d75 («설치가이드 2609 v1» · 브랜치
   imjohnkoo/smartstore-assets). 사이트 가이드(client-guide spec)용 사본이다 — 바꾼 곳은
   «우리 발급 화면» 3종(web-qr · web-codes-ios · web-codes-aos)과 길게 누르기 화면의 주소창뿐이다
   (spec D-4 — 지금 발급 화면 /view/{orderId} 의 글자 · 배치와 맞춘다).
   이 파일은 render.mjs 가 harness.html 에서 읽어 PNG 로 굽는다 — 사이트가 직접 싣지 않는다.

   <figure class="shot" data-screen="ios-cellular" data-state="pre"
           data-hl="esim-add" data-ar="0.8" data-focus="60" data-zoom="1.2"></figure>

   - data-screen  아래 SCREENS 의 키
   - data-state   화면 변형 (예: 셀룰러 화면의 설치 전 · 후 · 도착 후)
   - data-hl      강조할 요소 키. 템플릿의 data-k 와 맞춘다. 여러 개면 쉼표로 구분
   - data-ar · data-focus · data-zoom · data-fx 는 창 비율 · 세로 초점(%) · 배율 · 가로 초점(%)

   화면별 근거 (원본 refs.html 의 참고 이미지):
   - iOS 설정 흐름: 도시락 iOS 26 가이드 · Holafly iOS 26 · Apple 한국 지원 문서 iOS 26 화면
   - iOS 도착 후 흐름: Apple 지원 문서 118227 (여행용 eSIM 켜기)
   - One UI: 삼성닷컴 eSIM 안내 · kt M모바일 Mobi · 도시락 갤럭시 가이드
   ==================================================================== */
;(function () {
  // ------------------------------------------------------------------ 아이콘 (직접 그림)
  const I = {
    chev: '<svg class="i-chev" viewBox="0 0 9 14" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 1.5L7 7l-5.5 5.5"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    close:
      '<svg viewBox="0 0 24 24" fill="none" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    check:
      '<svg class="i-check" viewBox="0 0 24 24" fill="none" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    ant: '<svg class="i-ant" viewBox="0 0 64 64" fill="none" stroke-width="4" stroke-linecap="round"><circle cx="32" cy="24" r="4.5" fill="currentColor" stroke="none" style="color:#0088ff"/><path d="M32 29v24"/><path d="M21 13a16 16 0 0 0 0 22M43 13a16 16 0 0 1 0 22"/><path d="M13 6a27 27 0 0 0 0 36M51 6a27 27 0 0 1 0 36"/></svg>',
    wifi: '<svg class="i-wifi" viewBox="0 0 17 12" fill="#000"><path d="M8.5 2.3c2.3 0 4.4.9 6 2.4l1.2-1.3A10.4 10.4 0 0 0 8.5.5 10.4 10.4 0 0 0 1.3 3.4l1.2 1.3a8.6 8.6 0 0 1 6-2.4Z"/><path d="M8.5 5.6c1.4 0 2.7.5 3.7 1.4l1.2-1.3a7.2 7.2 0 0 0-9.8 0L4.8 7c1-.9 2.3-1.4 3.7-1.4Z"/><path d="M8.5 8.8c.6 0 1.2.2 1.6.6L8.5 11.2 6.9 9.4c.4-.4 1-.6 1.6-.6Z"/></svg>',
    qr: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2"/></svg>',
    phoneIn:
      '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="3" width="11" height="18" rx="2.5"/><path d="M3 12h8M8 9l3 3-3 3"/></svg>',
    phone:
      '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="6.5" y="3" width="11" height="18" rx="2.5"/><path d="M11 18h2"/></svg>',
    plane:
      '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 10h4a2 2 0 0 1 0 4h-4l-4 7h-3l2-7H7l-2 2H2l2-4-2-4h3l2 2h4L9 3h3z"/></svg>',
    share:
      '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11H5v10h14V11h-1"/></svg>',
    save: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M8 11l4 4 4-4"/><path d="M5 19h14"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>',
    antSmall:
      '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="9" r="1.8" fill="#0088ff" stroke="none"/><path d="M12 11v9M7.5 5a6.5 6.5 0 0 0 0 8M16.5 5a6.5 6.5 0 0 1 0 8"/></svg>',
    // One UI
    aBack:
      '<svg viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    aSim: '<svg class="a-flow__ico" viewBox="0 0 32 32" fill="none" stroke-width="2" stroke-linejoin="round"><rect x="4" y="7" width="24" height="18" rx="3"/><rect x="10" y="12" width="12" height="8" rx="1.5"/><path d="M14 12v8M18 12v8"/></svg>',
    aPlus:
      '<svg class="a-plus" viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    aTorch:
      '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3h8v4l-2 3v11h-4V10L8 7z"/><path d="M12 13v3"/></svg>',
    aImg: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="M4 18l5-5 4 4 3-3 4 4"/></svg>',
    aSig: '<svg class="a-sig" viewBox="0 0 15 15" fill="currentColor"><path d="M14 1v13H1z" opacity=".95"/></svg>',
    aWifi:
      '<svg class="a-sig" viewBox="0 0 24 24" fill="currentColor"><path d="M12 20.5 1.2 8.1A15.5 15.5 0 0 1 12 4a15.5 15.5 0 0 1 10.8 4.1z"/></svg>',
  }

  // ------------------------------------------------------------------ 가짜 QR (예시 · 스캔되지 않음)
  function fakeQr(seed) {
    const n = 25
    let s = seed || 7
    const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280
    const cells = []
    const finder = (x, y) =>
      `<rect x="${x}" y="${y}" width="7" height="7" fill="#000"/><rect x="${x + 1}" y="${y + 1}" width="5" height="5" fill="#fff"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3" fill="#000"/>`
    const inFinder = (x, y) => (x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9)
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++)
        if (!inFinder(x, y) && rnd() > 0.52)
          cells.push(`<rect x="${x}" y="${y}" width="1" height="1"/>`)
    return `<svg class="qr" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="#fff"/><g fill="#000">${cells.join('')}</g>${finder(0, 0)}${finder(n - 7, 0)}${finder(0, n - 7)}</svg>`
  }

  // ------------------------------------------------------------------ 공통 조각
  const iStatus = (o = {}) =>
    `<div class="i-sb"><span>9:41</span><span class="i-sb__r">${
      o.dual
        ? '<span class="i-dual"><b></b><b></b><b></b><b></b></span>'
        : '<span class="i-sig"><b></b><b></b><b></b><b></b></span>'
    }${o.net ? `<span class="i-net">${o.net}</span>` : I.wifi}<span class="i-bat"></span></span></div>`
  const iNav = (title, right = '') =>
    `<div class="i-nav"><span class="i-circle">${I.back}</span><span class="i-nav__t">${title}</span>${right || '<span></span>'}</div>`
  const iRow = (t, v = '', o = {}) =>
    `<div class="i-row"${o.k ? ` data-k="${o.k}"` : ''}><span class="i-row__t${o.link ? ' i-link' : ''}">${t}${o.sub ? `<span class="i-row__sub">${o.sub}</span>` : ''}</span>${v ? `<span class="i-row__v">${v}</span>` : ''}${o.sw != null ? `<span class="i-sw${o.sw ? ' on' : ''}"></span>` : ''}${o.check ? I.check : ''}${o.chev ? I.chev : ''}</div>`
  const sheetHead = (btn = 'close') =>
    `<span class="i-circle">${btn === 'back' ? I.back : I.close}</span>${I.ant}`
  const aStatus = () =>
    `<div class="a-sb"><span>12:45</span><span class="a-sb__r">${I.aWifi}${I.aSig}<span class="a-bat"></span></span></div>`
  const aHead = (t) => `<div class="a-head">${I.aBack}<span>${t}</span></div>`
  const aRow = (t, o = {}) =>
    `<div class="a-row"${o.k ? ` data-k="${o.k}"` : ''}>${o.ico || ''}<span class="a-row__t">${t}${o.sub ? `<span class="a-row__sub${o.blue ? ' blue' : ''}">${o.sub}</span>` : ''}</span>${o.sw != null ? `${o.bar ? '<span class="a-vbar"></span>' : ''}<span class="a-sw${o.sw ? ' on' : ''}"></span>` : ''}</div>`
  const MASK = '010-****-****'

  // ------------------------------------------------------------------ iOS 화면
  const iosCellular = (state) => {
    const after = state === 'after' || state === 'arrival'
    const newLine =
      state === 'arrival'
        ? iRow('‘여행’(으)로 사용함', '켬', {
            sub: '전화번호 없음',
            chev: true,
            k: 'new-line',
          })
        : iRow('‘여행’(으)로 사용함', '활성화 중…', {
            sub: '전화번호 없음',
            chev: true,
            k: 'new-line',
          })
    return `${iStatus({ dual: after, net: after ? '' : '5G' })}${iNav('셀룰러')}
      <div class="i-group">${iRow('셀룰러 데이터', after && state === 'arrival' ? '여행' : '메인', { chev: true, k: 'cell-data' })}${iRow('개인용 핫스팟', '끔', { chev: true })}</div>
      ${after ? `<div class="i-group">${iRow('기본 음성 회선', '메인', { chev: true })}</div>` : ''}
      <div class="i-cap">SIMs</div>
      <div class="i-group">${iRow('<span class="i-tag">메인</span>메인', '켬', { sub: MASK, chev: true })}${after ? newLine : ''}${iRow('eSIM 추가', '', { link: true, k: 'esim-add' })}</div>`
  }

  const SCREENS = {
    'ios-cellular': { os: 'ios', build: (st) => iosCellular(st || 'pre') },

    'ios-transfer': {
      os: 'ios',
      cls: 'bg-white',
      build: () => `${iStatus()}<div class="i-sheet">${sheetHead()}
        <h3 class="i-h">전화번호 전송</h3>
        <p class="i-p">다른 iPhone에서 전화번호를 전송할 수 있습니다.</p>
        <p class="i-p">전화번호를 이 iPhone으로 전송하면 다른 iPhone의 물리 SIM은 더 이상 사용할 수 없게 됩니다.</p>
        <div class="i-opts" style="margin-top:18px"><div class="i-opt">${I.phoneIn}<span class="i-row__t">iPhone에서 전송<span class="i-row__sub">${MASK}</span></span>${I.chev}</div></div>
        <div class="i-bottom"><div class="i-btn i-btn--gray" data-k="more">기타 옵션</div></div></div>`,
    },

    'ios-esim-setup': {
      os: 'ios',
      cls: 'bg-white',
      build: () => `${iStatus()}<div class="i-sheet">${sheetHead('back')}
        <h3 class="i-h">eSIM 설정</h3>
        <p class="i-p">근처에 있는 전화기에서 전화번호를 전송하거나, 이동통신사에서 제공한 QR 코드를 스캔하십시오.</p>
        <div class="i-more"><i>i</i>더 알아보기</div>
        <div class="i-opts">
          <div class="i-opt">${I.phoneIn}<span class="i-row__t">근처에 있는 iPhone에서 전송</span>${I.chev}</div>
          <div class="i-opt" data-k="use-qr">${I.qr}<span class="i-row__t">QR 코드 사용</span>${I.chev}</div>
          <div class="i-opt">${I.phone}<span class="i-row__t">Android에서 전송</span>${I.chev}</div>
          <div class="i-opt">${I.plane}<span class="i-row__t">여행 옵션 보기</span>${I.chev}</div>
        </div></div>`,
    },

    'ios-qr-scan': {
      os: 'ios',
      cls: 'bg-white',
      build: () => `${iStatus()}<div class="i-sheet"><div style="height:44px"></div>
        <div class="i-cam">${fakeQr(11)}</div>
        <h3 class="i-h">QR 코드 스캔</h3>
        <p class="i-p">이동통신사의 QR 코드를 프레임에 맞게 놓으십시오.</p>
        <div class="i-more"><i>i</i>더 알아보기</div>
        <div class="i-bottom"><div class="i-btn i-btn--gray" data-k="manual">세부사항 직접 입력</div></div></div>`,
    },

    'ios-manual': {
      os: 'ios',
      cls: 'bg-white',
      build: () => `${iStatus()}<div class="i-sheet" style="padding-top:10px">
        <div class="i-nav" style="padding:0"><span class="i-circle">${I.back}</span><span></span><span class="i-nav__btn" data-k="next">다음</span></div>
        ${I.ant.replace('margin: 28px auto 30px', '')}
        <h3 class="i-h">활성화 코드 입력</h3>
        <p class="i-p">사용자의 이동통신사로부터 받은 활성화 정보를 입력하십시오.</p>
        <div class="i-fields" data-k="fields">
          <div class="i-field"><span class="i-field__ph">SM-DP+ 주소</span></div>
          <div class="i-field"><span class="i-field__ph">활성화 코드</span></div>
        </div></div>`,
    },

    'ios-activate-alert': {
      os: 'ios',
      build: () => `${iosCellular('pre')}<div class="i-dim"></div>
        <div class="i-alert" style="top:360px"><p class="i-alert__t">eSIM 활성화</p>
        <p class="i-alert__m">eSIM을 활성화하기 위해 iPhone이 사용자의 EID를 이동통신사 또는 제공업체와 공유합니다. 이 작업을 위해 iPhone이 일시적으로 네트워크에 연결될 수 있습니다.</p>
        <div class="i-alert__btns"><span class="i-btn i-btn--gray">취소</span><span class="i-btn i-btn--blue hl-round" data-k="activate">활성화</span></div></div>`,
    },

    'ios-activate-ready': {
      os: 'ios',
      cls: 'bg-white',
      build: () => `${iStatus()}<div class="i-sheet">${sheetHead()}
        <h3 class="i-h">eSIM 활성화</h3>
        <p class="i-p">새로운 eSIM을 활성화할 준비가 되었습니다.</p>
        <div class="i-bottom"><div class="i-btn i-btn--blue" data-k="continue">계속</div></div></div>`,
    },

    'ios-where': {
      os: 'ios',
      cls: 'bg-white',
      build: () => `${iStatus()}<div class="i-sheet">${sheetHead('back')}
        <h3 class="i-h">이 eSIM을 사용할 위치 선택</h3>
        <p class="i-p" style="margin-bottom:22px">이 eSIM을 사용할 위치를 선택하십시오.</p>
        <div class="i-choice"><span class="i-choice__t">홈<span>거주하는 국가 또는 지역에서 이 eSIM을 사용합니다.</span></span><span class="i-radio"></span></div>
        <div class="i-choice" data-k="abroad"><span class="i-choice__t">해외<span>해외 여행 중에 이 eSIM을 사용합니다.</span></span><span class="i-radio on"></span></div>
        <div class="i-bottom"><div class="i-btn i-btn--blue" data-k="continue">계속</div></div></div>`,
    },

    'ios-plan': {
      os: 'ios',
      cls: 'bg-white',
      build: () => `${iStatus()}<div class="i-sheet">${sheetHead('back')}
        <h3 class="i-h">어떤 요금제를 사용하고 있습니까?</h3>
        <p class="i-p" style="margin-bottom:22px">여행용 eSIM에 어떤 유형의 데이터 요금제가 있는지 선택하십시오.</p>
        <div class="i-choice" data-k="data-only"><span class="i-choice__t">데이터 전용<span>통화 및 문자 메시지는 제외되지만, 웹 브라우징, 경로 찾기 및 기타 앱 사용이 가능합니다.</span></span><span class="i-radio on"></span></div>
        <div class="i-choice"><span class="i-choice__t">음성 및 데이터<span>통화, 문자 메시지, 웹 브라우징, 경로 찾기 및 기타 앱 사용이 가능합니다.</span></span><span class="i-radio"></span></div>
        <div class="i-bottom"><div class="i-btn i-btn--blue" data-k="continue">계속</div></div></div>`,
    },

    'ios-done': {
      os: 'ios',
      cls: 'bg-white',
      build: () => `${iStatus()}<div class="i-sheet">${sheetHead()}
        <h3 class="i-h">여행용 eSIM 설정 완료</h3>
        <p class="i-p">eSIM을 사용할 준비가 되었습니다. 사용자가 해외에 있는데 이 요금제를 아직 켜지 않은 경우 iPhone이 이를 감지하여 켜도록 알려줍니다.</p>
        <div class="i-bottom"><div class="i-btn i-btn--blue" data-k="done">완료</div></div></div>`,
    },

    'ios-longpress': {
      os: 'ios',
      cls: 'i-safari',
      build:
        () => `${iStatus({ net: '5G' })}<div class="w-page w-page--behind" style="filter:blur(2px);opacity:.55">${webQrBody()}</div>
        <div class="i-dim" style="background:rgba(0,0,0,.18)"></div>
        <div style="position:absolute;z-index:4;left:95px;top:150px;width:200px;height:200px;padding:14px;border-radius:18px;background:#fff;box-shadow:0 18px 40px rgba(0,0,0,.25)">${fakeQr(5).replace('class="qr"', 'style="width:100%;height:100%"')}</div>
        <div class="i-menu" style="left:70px;top:372px">
          <div class="i-menu__i">공유…${I.share}</div>
          <div class="i-menu__i">'사진' 앱에 저장${I.save}</div>
          <div class="i-menu__i">복사${I.copy}</div>
          <div class="i-menu__i" data-k="add-esim">eSIM 추가<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="9" r="1.8" fill="#000" stroke="none"/><path d="M12 11v9M7.5 5a6.5 6.5 0 0 0 0 8M16.5 5a6.5 6.5 0 0 1 0 8"/></svg></div>
        </div><div class="i-urlbar">app.esimmany.com</div>`,
    },

    'ios-lock-noti': {
      os: 'ios',
      cls: 'i-lock',
      build:
        () => `<div class="i-sb" style="color:#fff">${'<span>9:41</span>'}<span class="i-sb__r"><span class="i-dual" style="filter:invert(1)"><b></b><b></b><b></b><b></b></span><span class="i-bat" style="filter:invert(1)"></span></span></div>
        <div class="i-lock__date">9월 20일 일요일</div><div class="i-lock__time">9:41</div>
        <div class="i-noti" data-k="noti"><span class="i-noti__ico">${I.antSmall}</span><span class="i-noti__t">여행용 eSIM 켜기</span></div>`,
    },

    'ios-travel-choice': {
      os: 'ios',
      cls: 'bg-white',
      build: () => `${iStatus({ dual: true })}<div class="i-sheet">${sheetHead()}
        <h3 class="i-h">여행용 eSIM 켜기</h3>
        <div style="height:18px"></div>
        <div class="i-choice"><span class="i-choice__t">여행용 eSIM 전용</span><span class="i-radio"></span></div>
        <div class="i-choice" data-k="both"><span class="i-choice__t">여행용 SIM 및 현재 eSIM</span><span class="i-radio on"></span></div>
        <div class="i-bottom"><div class="i-btn i-btn--blue" data-k="continue">계속</div></div></div>`,
    },

    'ios-lowdata': {
      os: 'ios',
      cls: 'bg-white',
      build: () => `${iStatus({ dual: true })}<div class="i-sheet">${sheetHead()}
        <h3 class="i-h">저데이터 모드</h3>
                <div class="i-bottom" style="display:grid;gap:12px"><div class="i-btn i-btn--blue" data-k="lowdata-on">저데이터 모드 켜기</div><div class="i-btn i-btn--gray" data-k="not-now">지금 안 함</div></div></div>`,
    },

    'ios-line': {
      os: 'ios',
      build: () => `${iStatus({ dual: true })}${iNav('여행')}
        <div class="i-group">${iRow('이 회선 켜기', '', { sw: true, k: 'line-on' })}</div>
        <div class="i-cap">여행</div>
        <div class="i-group">${iRow('네트워크 선택', '자동', { chev: true, k: 'network' })}${iRow('셀룰러 요금제 레이블', '여행', { chev: true })}${iRow('음성 및 데이터', '5G', { chev: true })}${iRow('데이터 로밍', '', { sw: true, k: 'roaming' })}</div>`,
    },

    'ios-celldata': {
      os: 'ios',
      build: () => `${iStatus({ dual: true })}${iNav('셀룰러 데이터')}
        <div class="i-group">${iRow('끔')}${iRow('<span class="i-tag">메인</span>메인', '', { sub: MASK })}${iRow('<span class="i-tag">여행</span>여행', '', { sub: '전화번호 없음', check: true, k: 'travel' })}</div>
        <div class="i-group" style="margin-top:26px">${iRow('셀룰러 데이터 전환 허용', '', { sw: false, k: 'switch' })}</div>
        <p class="i-foot">이 기능을 켜면 적용 범위 및 가용성에 따라 양쪽 회선의 셀룰러 데이터가 전화기에 사용됩니다.</p>`,
    },

    'ios-network': {
      os: 'ios',
      build: () => `${iStatus({ dual: true })}${iNav('네트워크 선택')}
        <div class="i-group">${iRow('자동', '', { sw: false, k: 'auto' })}</div>
        <div class="i-group" style="margin-top:22px">${iRow('통신사 A', '', { check: true })}${iRow('통신사 B')}${iRow('통신사 C')}</div>`,
    },

    'ios-error': {
      os: 'ios',
      build: () => `${iosCellular('after')}<div class="i-dim"></div>
        <div class="i-alert i-alert--center" style="top:320px"><p class="i-alert__t">eSIM을 활성화할 수 없음</p>
        <p class="i-alert__m">다시 시도하거나, 이동통신사에 연락하여 도움을 요청하십시오.</p>
        <div class="i-btn i-btn--gray" style="height:48px">확인</div></div>`,
    },

    // ---------------------------------------------------------------- 우리 발급 화면
    'web-qr': {
      os: 'web',
      cls: 'i-safari',
      build: (st) =>
        `${st === 'aos' ? aStatus() : iStatus({ net: '5G' })}<div class="w-page">${webQrBody()}</div>`,
    },
    'web-codes-ios': {
      os: 'web',
      cls: 'i-safari',
      build: () => `${iStatus({ net: '5G' })}<div class="w-page">${webCodes('ios')}</div>`,
    },
    'web-codes-aos': {
      os: 'web',
      cls: 'i-safari',
      build: () => `${aStatus()}<div class="w-page">${webCodes('aos')}</div>`,
    },

    // ---------------------------------------------------------------- One UI
    'aos-connections': {
      os: 'aos',
      build: () => `${aStatus()}${aHead('연결')}
        <div class="a-group">${aRow('Wi-Fi', { sw: true, bar: true })}${aRow('블루투스', { sw: true, bar: true })}${aRow('NFC 및 비접촉 결제', { sw: false, bar: true })}</div>
        <div class="a-group">${aRow('비행기 탑승 모드', { sw: false })}</div>
        <div class="a-group">${aRow('SIM 관리자', { k: 'sim' })}${aRow('모바일 네트워크')}${aRow('데이터 사용')}${aRow('모바일 핫스팟 및 테더링')}</div>
        <div class="a-group">${aRow('해외 로밍', { k: 'roaming' })}</div>`,
    },

    'aos-sim': {
      os: 'aos',
      build: (st) => {
        const after = st === 'after' || st === 'arrival'
        const data = st === 'arrival' ? 'eSIM 1' : 'SIM 1'
        return `${aStatus()}${aHead('SIM 관리자')}
        <div class="a-cap">SIM 카드</div>
        <div class="a-group">${aRow('SIM 1', { ico: '<span class="a-simico">1</span>', sub: MASK, sw: true, bar: true })}</div>
        <div class="a-cap">eSIM</div>
        <div class="a-group">${after ? aRow('eSIM 1', { ico: '<span class="a-simico">e1</span>', sub: '여행', sw: true, bar: true, k: 'esim1' }) : ''}${aRow('eSIM 추가', { ico: I.aPlus, sub: '실물 SIM 카드 없이 모바일 네트워크에 연결하려면 eSIM을 다운로드하세요.', k: 'esim-add' })}</div>
        <div class="a-cap">주 사용 SIM 카드</div>
        <div class="a-group" data-k="primary">${aRow('통화', { sub: 'SIM 1', blue: true })}${aRow('메시지', { sub: 'SIM 1', blue: true })}${aRow('모바일 데이터', { sub: data, blue: true, k: 'mobile-data' })}</div>
        <p class="a-foot">새 메시지나 모바일 데이터, 전화 걸기에 사용할 SIM을 선택하세요.</p>
        <div class="a-group">${aRow('데이터 전환', { sub: '모바일 데이터용 SIM으로 모바일 데이터를 사용할 수 없을 때 다른 SIM으로 전환합니다.', sw: false, bar: true, k: 'switch' })}</div>`
      },
    },

    'aos-method': {
      os: 'aos',
      build:
        () => `${aStatus()}<div class="a-flow">${I.aSim}<h3 class="a-flow__t">eSIM 추가 방법 선택</h3>
        <div class="a-list"><div class="a-list__i">다른 기기에서 SIM 이동</div><div class="a-list__i" data-k="scan">QR 코드 스캔</div><div class="a-list__i">eSIM 검색</div></div></div>`,
    },

    'aos-scan': {
      os: 'aos',
      cls: 'bg-dark',
      build:
        () => `${aStatus()}<div class="a-scan"><p class="a-scan__p">이동통신사에게서 받은 QR 코드를 스캔하세요.</p>
        <div class="a-scan__frame">${fakeQr(19)}</div>
        <span class="a-scan__link" data-k="code">활성화 코드 입력</span>
        <div class="a-scan__btns"><span class="a-scan__btn">${I.aTorch}</span><span class="a-scan__btn hl-round" data-k="gallery">${I.aImg}</span></div></div>`,
    },

    'aos-code': {
      os: 'aos',
      build:
        () => `${aStatus()}<div class="a-flow">${I.aSim}<h3 class="a-flow__t">활성화 코드 입력</h3>
        <div class="a-input" data-k="input">LPA:1$…</div>
        <div class="a-hint">코드는 다음과 같이 표시됩니다.<br />• LPA:1$••••$••••<br />• https://••••</div>
        <span class="a-pill hl-round" data-k="done">완료</span></div>`,
    },

    'aos-confirm': {
      os: 'aos',
      build: () => `${aStatus()}<div class="a-flow">${I.aSim}<h3 class="a-flow__t">eSIM 추가</h3>
        <p class="a-flow__p">휴대전화를 네트워크에 연결합니다.</p>
        <span class="a-pill hl-round" data-k="add">추가</span></div>`,
    },

    'aos-data-sheet': {
      os: 'aos',
      build: () => `${SCREENS['aos-sim'].build('after')}<div class="a-dim"></div>
        <div class="a-sheet"><p class="a-sheet__t">모바일 데이터</p>
        <div class="a-opt"><span class="a-opt__r"></span>SIM 1</div>
        <div class="a-opt" data-k="esim-opt"><span class="a-opt__r on"></span>eSIM 1</div>
        <div class="a-sheet__btn">취소</div></div>`,
    },

    'aos-roaming': {
      os: 'aos',
      build: () => `${aStatus()}${aHead('해외 로밍')}
        <div class="a-group">${aRow('데이터 로밍 SIM 1', { sw: false })}${aRow('데이터 로밍 eSIM 1', { sw: true, k: 'roam-esim' })}</div>
        <div class="a-group">${aRow('데이터 네트워크 방식')}</div>`,
    },

    'aos-carrier': {
      os: 'aos',
      build: () => `${aStatus()}${aHead('로밍 이동통신사 선택')}
        <div class="a-tabs"><span>SIM 1</span><span class="on">eSIM 1</span></div>
        <div class="a-group" style="margin-top:16px">${aRow('자동 선택', { sw: false, k: 'auto' })}</div>
        <div class="a-cap">네트워크</div>
        <div class="a-group">${aRow('통신사 A')}${aRow('통신사 B')}${aRow('통신사 C')}</div>`,
    },
  }

  // 우리 발급 화면 (/view/{orderId}) — 글자는 지금 화면 그대로(spec D-4), 값은 가린다
  const W_STEP = '<div class="w-step"><span class="w-step__bar"><b></b></span><span class="w-step__t">4 / 4 발급 완료</span></div>'
  function webQrBody() {
    return `${W_STEP}<p class="w-eyebrow">eSIM QR 코드 발급</p><h3 class="w-title">eSIM 발급이<br />완료됐어요</h3>
      <div class="w-card"><span class="w-pill"><i></i>발급완료</span>
      <div class="w-qr">${fakeQr(3).replace('class="qr"', 'style="width:100%;height:100%"')}</div>
      <span class="w-btn" data-k="download">${I.save}QR 코드 다운로드</span>
      <p class="w-hint">다운로드가 안 되면 스크린샷으로 저장해 주세요.</p></div>`
  }
  const wRow = (k, v) =>
    `<div class="w-code"><span class="w-code__t"><span class="w-code__k">${k}</span><span class="w-code__v">${v}</span></span><span class="w-copy">${I.copy}복사</span></div>`
  // 발급 화면 아래쪽: 수동 설치 코드 두 묶음 — 강조는 OS 에 맞는 묶음
  function webCodes(os) {
    // 값은 가린다 — 공급사 주소처럼 보이는 조각(도메인 · 접두)도 넣지 않는다(spec 불변식 «공급사 값 미기재»)
    const ios = `<div class="w-divider"><span>아이폰 수동 설치</span></div>${wRow('SM-DP+ 주소', '••••••••••••••')}${wRow('활성화 코드', '••••-••••-••••-••••')}`
    const aos = `<div class="w-divider"><span>안드로이드 수동 설치</span></div>${wRow('LPA 전체', 'LPA:1$••••••••••$••••-••••')}`
    return `<div class="w-card w-card--codes"><div${os === 'ios' ? ' data-k="codes"' : ''}>${ios}</div><div${os === 'aos' ? ' data-k="codes"' : ''}>${aos}</div></div>`
  }

  // 화면별 근거와 확인 필요 항목 (허브 index.html 이 표로 보여 준다)
  //   ref   : 모양·문구를 맞춘 참고 이미지 (refs.html 에서 볼 수 있다)
  //   check : 참고 이미지로 확정하지 못해 실기기로 확인할 것 (없으면 빈 문자열)
  window.IG_SCREEN_META = {
    'ios-cellular': { ref: 'Apple 지원 109317 iOS 26 · 도시락 iOS 26 (SIMs 목록, ‘보조’(으)로 사용함)', check: '새 회선 이름은 폰마다 ‘여행’ · ‘보조’ 등으로 다르게 붙는다' },
    'ios-transfer': { ref: '도시락 iOS 26 (dosirak-ios-03)', check: '' },
    'ios-esim-setup': { ref: 'Apple 지원 118669 iOS 26 · 도시락 iOS 26', check: '' },
    'ios-qr-scan': { ref: 'Holafly iOS 26 (holafly-ios-07) · 도시락 iOS 17 한국어 문구', check: 'iOS 26 한국어 안내 문장' },
    'ios-manual': { ref: 'Holafly iOS 26 (holafly-ios-09) · 도시락 한국어 문구', check: '입력칸 이름 (SM-DP+ 주소 · 활성화 코드)' },
    'ios-activate-alert': { ref: '도시락 iOS 26 (dosirak-ios-05)', check: '' },
    'ios-activate-ready': { ref: '도시락 iOS 26 (dosirak-ios-06)', check: '통신사 이름 자리에 무엇이 뜨는지 (Sparks 프로필 이름)' },
    'ios-where': { ref: '도시락 iOS 26 (dosirak-ios-07)', check: '' },
    'ios-plan': { ref: '도시락 iOS 26 (dosirak-ios-08)', check: '' },
    'ios-done': { ref: '로밍도깨비 iOS 26 (rokebi-ios-07)', check: '' },
    'ios-longpress': { ref: 'Apple 지원 118669 (iOS 17.4 길게 누르기) · Holafly 메일 앱 메뉴', check: '우리 발급 화면 QR 을 길게 눌렀을 때 ‘eSIM 추가’가 뜨는지 · 메뉴 항목 이름' },
    'ios-lock-noti': { ref: 'Apple 지원 118227 (‘여행용 eSIM 켜기’ 알림)', check: '알림 모양과 본문 문구 (참고 이미지 없음)' },
    'ios-travel-choice': { ref: 'Apple 지원 118227 (여행용 eSIM 전용 · 여행용 SIM 및 현재 eSIM)', check: '화면 모양 · 유심 사용자는 ‘현재 SIM’으로 뜨는지' },
    'ios-lowdata': { ref: 'Apple 지원 118227 (저데이터 모드 켜기 · 지금 안 함)', check: '화면 모양과 제목' },
    'ios-line': { ref: '도시락 iOS 17–18 회선 상세 · kt M모바일 iOS 26', check: 'iOS 26 듀얼 회선에서 데이터 로밍 위치 (회선 상세 또는 셀룰러 데이터 옵션)' },
    'ios-celldata': { ref: 'Apple 지원 109317 iOS 26 (sim-settings-cellular-cellular-data)', check: '' },
    'ios-network': { ref: 'Holafly iOS 26 · 도시락 네트워크 선택', check: '' },
    'ios-error': { ref: '로밍도깨비 iOS 26 오류 팝업 (rokebi-ios-05 · 12)', check: '' },
    'web-qr': { ref: 'apps/client/app/pages/view/[orderId].vue @ 49ac21d', check: '' },
    'web-codes-ios': { ref: 'apps/client/app/pages/view/[orderId].vue @ 49ac21d', check: '' },
    'web-codes-aos': { ref: 'apps/client/app/pages/view/[orderId].vue @ 49ac21d', check: '' },
    'aos-connections': { ref: '삼성닷컴 eSIM 안내 One UI 7/8 (samsung-android-03)', check: '' },
    'aos-sim': { ref: '삼성닷컴 (samsung-android-04) · kt M모바일 One UI 7+', check: '' },
    'aos-method': { ref: '도시락 갤럭시 (dosirak-android-03) · Holafly 한국어 갤럭시', check: '' },
    'aos-scan': { ref: '도시락 갤럭시 (dosirak-android-04)', check: '' },
    'aos-code': { ref: '도시락 · 유심사 · Holafly 갤럭시 (활성화 코드 입력 · 완료)', check: '' },
    'aos-confirm': { ref: '도시락 · Holafly 갤럭시 (‘OO eSIM 추가’ · 추가)', check: '통신사 이름 자리에 무엇이 뜨는지' },
    'aos-data-sheet': { ref: 'kt M모바일 · 로밍도깨비 갤럭시 (모바일 데이터 eSIM 1)', check: '선택 창 모양' },
    'aos-roaming': { ref: 'kt M모바일 One UI 7+ (데이터 로밍 SIM 1 · eSIM 1)', check: '' },
    'aos-carrier': { ref: '로밍도깨비 One UI 8 · 도시락 로밍 이동통신사 선택', check: '' },
  }

  window.IG_SCREENS = SCREENS

  // ------------------------------------------------------------------ 렌더러 (shots.js 가 부른다)
  const num = (v, d) => {
    const n = parseFloat(v)
    return Number.isFinite(n) ? n : d
  }

  function place(win, scr, fig) {
    const zoom = num(fig.dataset.zoom, 1)
    const focus = num(fig.dataset.focus, 0)
    const fx = num(fig.dataset.fx, 50)
    const W = win.clientWidth
    const H = win.clientHeight
    if (!W) return
    const s = (W * zoom) / 390
    const w = 390 * s
    const h = scr.offsetHeight * s
    const top = Math.min(0, Math.max(H - h, H / 2 - (focus / 100) * h))
    // 배율이 1보다 작아 화면이 창보다 좁으면 가운데 둔다 (창 배경은 화면 배경색과 같게 칠해 둔다)
    const left = w <= W ? (W - w) / 2 : Math.min(0, Math.max(W - w, W / 2 - (fx / 100) * w))
    scr.style.transform = `translate(${left}px, ${top}px) scale(${s})`
  }

  window.IG_renderScreen = function (fig, win) {
    const def = SCREENS[fig.dataset.screen]
    if (!def) return false
    const scr = document.createElement('div')
    scr.className = `scr scr-${def.os === 'aos' ? 'aos' : 'ios'} ${def.cls || ''}`
    // 정적 템플릿 (사용자 입력 없음)
    scr.innerHTML = def.build(fig.dataset.state)
    ;(fig.dataset.hl || '')
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean)
      .forEach((k) =>
        scr.querySelectorAll(`[data-k="${k}"]`).forEach((el) => {
          el.classList.add('is-hl')
          const ring = document.createElement('span')
          ring.className = 'hl-ring'
          el.appendChild(ring)
        }),
      )
    win.appendChild(scr)
    win.style.background = getComputedStyle(scr).backgroundColor
    place(win, scr, fig)
    new ResizeObserver(() => place(win, scr, fig)).observe(win)
    fig.classList.add('is-ready', 'is-screen')
    return true
  }
})()
