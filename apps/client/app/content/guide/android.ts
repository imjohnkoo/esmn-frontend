/**
 * 안드로이드(갤럭시 기준) 설치 가이드 문안(client-guide spec F-2 · S-3). 원본 = «설치가이드 2609 v1»
 * `design/install-guide/android.html` @ eb96d75 — 글자 그대로 옮기고, 바꾼 곳은 spec D-4 표만
 * (발급 화면 이름 · 버튼 글자 · 다시 조회 · 문의 링크). 표기는 inline.ts.
 */
import { DEVICES_BARE, DEVICES_PAGE } from './common'
import type { GuideContent } from './types'

export const ANDROID_GUIDE: GuideContent = {
  os: 'android',
  eyebrow: 'Install guide · Android',
  title: '안드로이드 eSIM 설치 가이드',
  lede: ['출국 전에 집에서 미리 설치해 두세요.', '설치만으로는 사용일수가 시작되지 않아요.'],

  checks: {
    lede: '갤럭시 화면으로 안내해요. 다른 안드로이드 폰은 메뉴 이름이 조금 다를 수 있어요.',
    items: [
      {
        icon: 'wifi',
        title: '인터넷 연결',
        body: '설치하는 동안 인터넷이 필요해요. ((Wi-Fi나)) 국내 데이터가 연결된 곳에서 설치해 주세요.',
      },
      {
        icon: 'update',
        title: '소프트웨어 업데이트',
        body: '[[설정 › 소프트웨어 업데이트]]에서 최신 버전으로 올린 뒤 설치하면 오류가 줄어요.',
      },
      {
        icon: 'device',
        title: '지원 기기',
        body: '국내판 갤럭시는 S23 · ((Z 플립4)) · ((Z 폴드4)) 이후 모델과 일부 ((A 시리즈))가 eSIM을 지원해요. 통신사 잠금(컨트리락)도 풀려 있어야 해요.',
        link: { to: DEVICES_PAGE, bareTo: DEVICES_BARE, label: '지원 기기 확인하기' },
      },
      {
        icon: 'clean',
        title: '지난 여행 eSIM',
        body: '예전에 쓰던 여행용 eSIM이 켜져 있다면 끄고 설치해 주세요. 회선이 헷갈리지 않아요.',
      },
    ],
    alert: {
      title: '설치한 eSIM은 여행이 끝날 때까지 지우지 마세요',
      body: '한 번 지우면 다시 설치할 수 없고 재발급도 되지 않아요. QR 코드 하나는 폰 한 대에 한 번만 설치돼요.',
    },
  },

  step1: {
    badge: 'STEP 1 · 출국 전',
    title: '집에서 eSIM 설치하기',
    lede: '카카오톡으로 받은 발급 링크에서 QR 코드를 먼저 발급받아 주세요. 그다음 아래 세 가지 중 편한 방법 하나로 설치하면 돼요.',
    methods: [
      {
        tag: '방법 A',
        badge: '가장 쉬워요',
        title: '다른 화면의 QR 코드 스캔하기',
        desc: 'PC나 태블릿, 동행자 폰에 QR 코드를 띄울 수 있을 때 써요.',
        steps: [
          { text: '[[설정 › 연결]]에서 {{SIM 관리자}}를 눌러요.', figure: 'aos-connections-sim' },
          { text: '{{eSIM 추가}}를 눌러요.', figure: 'aos-sim-esim-add' },
          { text: '{{QR 코드 스캔}}을 눌러요.', figure: 'aos-method-scan' },
          { text: '다른 기기에 띄운 QR 코드를 네모 칸 안에 맞춰 비춰요.', figure: 'aos-scan' },
        ],
      },
      {
        tag: '방법 B',
        badge: '폰 한 대로',
        title: 'QR 이미지로 설치하기',
        desc: 'QR 코드를 띄울 다른 기기가 없을 때 써요.',
        steps: [
          {
            text: '발급 화면에서 {{QR 코드 다운로드}}를 눌러 갤러리에 저장해요.',
            sub: '저장이 안 되면 화면을 캡처해도 돼요. 한 주문에 eSIM이 여러 개면 버튼 이름이 ‘QR 다운로드’예요.',
            figure: 'web-qr-aos-download',
          },
          {
            text: '방법 A처럼 QR 스캔 화면까지 들어가 갤러리 아이콘을 눌러 저장한 QR 이미지를 골라요.',
            figure: 'aos-scan-gallery',
          },
        ],
        note: {
          tone: 'info',
          lines: [
            '**갤러리 아이콘이 보이지 않나요?** 폰에 따라 스캔 화면 모양이 조금 달라요. 방법 C로 설치해 주세요.',
          ],
        },
      },
      {
        tag: '방법 C',
        badge: 'QR이 안 될 때',
        title: '코드 직접 입력하기',
        desc: 'QR 코드가 인식되지 않을 때 써요.',
        steps: [
          {
            text: '발급 화면 아래 ‘안드로이드 수동 설치’의 LPA 전체 코드를 복사해요.',
            sub: 'LPA로 시작하는 긴 코드예요.',
            figure: 'web-codes-aos',
          },
          { text: '같은 스캔 화면에서 {{활성화 코드 입력}}을 눌러요.', figure: 'aos-scan-code' },
          { text: '복사한 코드를 붙여 넣고 {{완료}}를 눌러요.', figure: 'aos-code-input' },
        ],
      },
    ],
    notes: [
      {
        tone: 'warn',
        lines: ['**설치하는 동안 취소나 뒤로가기를 누르지 마세요.** 설치에 1분 정도 걸려요.'],
      },
    ],
  },

  step2: {
    badge: 'STEP 2 · 설치 직후',
    title: '이어서 나오는 화면',
    lede: 'QR 코드를 인식하면 아래 화면이 나와요. 마지막 5번까지 해 두면 현지에 도착하자마자 쓸 수 있어요.',
    steps: [
      { text: '‘eSIM 추가’ 화면에서 {{추가}}를 눌러 설치를 마쳐요.', figure: 'aos-confirm-add' },
      {
        text: '[[설정 › 연결 › SIM 관리자]]에 ((eSIM 1))이 켜져 있으면 설치가 끝난 거예요.',
        sub: '꺼져 있다면 켜 두세요.',
        figure: 'aos-sim-esim1',
      },
      {
        text: '주 사용 SIM 카드의 통화, 메시지, 모바일 데이터는 지금은 ((SIM 1)) 그대로 둬요.',
        sub: '여행용 eSIM은 데이터 전용 상품이라 전화와 문자는 지금 쓰는 번호로 받아요.',
        figure: 'aos-sim-primary',
      },
      { text: '같은 화면 아래 {{데이터 전환}}은 꺼 두세요.', figure: 'aos-sim-switch' },
      {
        text: '[[설정 › 연결 › 해외 로밍]]에서 {{데이터 로밍 eSIM 1}}을 미리 켜 두세요.',
        sub: '도착하자마자 바로 연결돼요. 한국에서 켜 두어도 사용일수는 시작되지 않고, 모바일 데이터는 도착할 때까지 ((SIM 1)) 그대로 둬요.',
        figure: 'aos-roaming-esim',
      },
    ],
    notes: [
      {
        tone: 'info',
        lines: [
          '**해외 로밍 메뉴가 보이지 않나요?**',
          'SKT에서 개통한 폰은 [[설정 › T로밍 › 로밍 상세 설정]]에 있어요. 데이터 로밍 ((SIM 1))은 켜지 마세요.',
        ],
      },
      {
        tone: 'tip',
        lines: [
          '**미리 설치해도 사용일수는 시작되지 않아요.** 현지에서 처음 연결된 순간부터 24시간 단위로 차감돼요.',
        ],
      },
    ],
  },

  step3: {
    badge: 'STEP 3 · 현지 도착 후',
    title: '현지에서 데이터 켜기',
    lede: '비행기에서 내리면 모바일 데이터를 ((eSIM 1))로 바꾸고, 데이터 로밍이 켜져 있는지 확인하면 돼요.',
    steps: [
      {
        text: '[[설정 › 연결 › SIM 관리자]]에서 {{모바일 데이터}}를 눌러 ((eSIM 1))을 골라요.',
        sub: '((eSIM 1))이 꺼져 있다면 먼저 켜 주세요.',
        figure: 'aos-data-sheet-esim',
      },
      {
        text: '[[설정 › 연결 › 해외 로밍]]에서 {{데이터 로밍 eSIM 1}}이 켜져 있는지 확인해요.',
        sub: 'STEP 2의 5번을 해 두었다면 그대로 켜져 있어요. 꺼져 있으면 지금 켜 주세요.',
        figure: 'aos-roaming-esim',
      },
      {
        text: '상태 표시줄에 **5G**나 **LTE**가 뜨면 연결된 거예요.',
        sub: '처음 연결에 몇 분 걸릴 수 있어요.',
        status: 'android',
      },
    ],
    notes: [
      {
        tone: 'home',
        lines: [
          '**한국에 돌아오면**',
          '{{모바일 데이터}}를 다시 ((SIM 1))로 바꿔 주세요. 여행용 eSIM은 사용 기간이 끝난 뒤에 지우면 돼요.',
        ],
      },
      {
        tone: 'warn',
        lines: [
          '**데이터 로밍 SIM 1은 꺼 두세요.** 켜져 있으면 통신사 로밍 요금이 나올 수 있어요.',
          '**데이터 전환도 꺼 두세요.** 켜 두면 데이터가 국내 SIM으로 넘어갈 수 있어요.',
        ],
      },
    ],
  },

  help: {
    badge: '문제 해결',
    title: '설치나 연결이 잘 안 되나요?',
    lede: '자주 받는 문의를 모았어요. 대부분 여기서 해결돼요.',
    faqs: [
      {
        q: '‘네트워크 등록에 실패했습니다’ 알림이 떴나요?',
        a: [
          '한국에서 미리 설치하면 여행용 eSIM이 한국 망에 연결되지 않아 뜰 수 있어요. 정상이에요.',
          'SIM 관리자에 ((eSIM 1))이 있으면 설치는 끝났어요. 현지에 도착해 STEP 3을 진행해 주세요.',
        ],
      },
      {
        q: '설치 도중 전화가 오거나 뒤로가기를 눌렀나요?',
        a: [
          '먼저 [[설정 › 연결 › SIM 관리자]]에 ((eSIM 1))이 있는지 확인해 주세요. ((eSIM 1))이 있다면 설치는 끝났어요.',
          '없다면 인터넷 연결을 확인하고 같은 QR 코드로 한 번 더 설치해 주세요. 그래도 안 되면 아래 채널로 문의해 주세요.',
        ],
      },
      {
        q: '현지에서 신호는 뜨는데 인터넷이 안 되나요?',
        a: [
          '모바일 데이터가 ((eSIM 1))로 되어 있는지, {{데이터 로밍 eSIM 1}}이 켜져 있는지 다시 확인해 주세요.',
          '그래도 안 되면 비행기 탑승 모드를 2~3번 켰다 끄고, 폰을 다시 켜 주세요.',
        ],
      },
      {
        q: '연결이 계속 안 되거나 너무 느린가요?',
        a: [
          '현지 통신사를 직접 골라 보세요. [[설정 › 연결 › 모바일 네트워크 › 로밍 이동통신사 선택]]에서 ((eSIM 1)) 탭을 누르고 {{자동 선택}}을 끄면 통신사 목록이 나와요.',
          '고른 통신사로도 안 되면 다시 자동 선택으로 돌려 주세요.',
        ],
        figure: 'aos-carrier-auto',
      },
      {
        q: 'QR 코드를 잃어버렸나요?',
        a: [
          '‘내 eSIM’에서 주문번호로 다시 조회하면 같은 QR 코드를 볼 수 있어요. 다만 이미 설치한 eSIM은 다른 폰으로 옮길 수 없어요.',
        ],
        link: { to: '/my-esim', label: '내 eSIM 조회하기' },
      },
    ],
  },
}
