/**
 * 설치 확인 · 현지 통신사 바꾸기 · 나라별 현지 통신사 문안(client-guide-check spec S-1~S-4 · S-6) — spec §⑤ 글자 그대로.
 * 옛 가이드 사이트 글(Maya 시절)을 설치 가이드 2609 경로 · 문체로 옮겼다. 옛 글과 다른 곳은 spec «옛 글 → 사이트» 표에만 적는다.
 * 문장 안 표기는 설치 가이드와 같은 `inline.ts`. 요금 경고 두 줄은 가이드 STEP 3 의 같은 객체를 쓴다(글자가 갈라지지 않게).
 */
import { OPERATOR_NOTE } from '../product-detail'
import { ANDROID_GUIDE } from './android'
import { AFTER_CHECK_OS, GUIDE_BARE, GUIDE_CARRIERS, GUIDE_NETWORK, GUIDE_PAGES } from './common'
import { IOS_GUIDE } from './ios'
import type {
  GuideCheckContent,
  GuideContent,
  GuideNote,
} from './types'

/** 가이드 STEP 3 의 요금 경고(한국 회선 데이터 로밍 · 전환 허용 끄기 — 불변식 «경고 두 줄») */
function stepThreeWarn(g: GuideContent): GuideNote {
  const warn = g.step3.notes.find((n) => n.tone === 'warn')
  if (!warn) throw new Error(`${g.os} 가이드 STEP 3 경고가 없다`)
  return warn
}

/** 다른 여행용 eSIM 은 꺼 두기 · 지우지 않기(spec D-6 — 이름으로 가려내지 않는다) */
const OTHER_ESIM: GuideNote = {
  tone: 'warn',
  lines: [
    '**다른 여행용 eSIM이 더 보이나요?** 이번에 설치한 것 말고 다른 여행용 eSIM은 꺼 두세요. 지우지 않아도 돼요.',
    '어느 회선인지 모르겠으면 **지우지 말고** 고객센터로 문의해 주세요. 한 번 지운 eSIM은 다시 설치할 수 없어요.',
  ],
}

const CHECK_HINT = '화면의 빨간 테두리가 확인할 곳이에요.'
const END_TITLE = '그래도 연결이 안 되나요?'
const END_LEDE = '연결이 불안정하면 현지 통신사를 바꿔 보세요.'
const CHANGE_WAIT = '잠시 기다리면 고를 수 있는 통신사 목록이 나와요.'
const CHANGE_DONE_SUB =
  '연결까지 길게는 10분 정도 걸릴 수 있어요. 바로 연결되지 않아도 잠시 기다려 주세요.'

/** 문의 블록 설명 — 설치 가이드는 «설치 화면», 이 페이지들은 «설정 화면» */
export const CHECK_CONTACT_LEDE = '설정 화면을 캡처해 보내 주시면 더 빨리 도와드릴 수 있어요.'

const helpCard = (g: GuideContent) => ({
  label: '설치 가이드 문제 해결',
  sub: `자주 받는 문의 ${g.help.faqs.length}가지`,
  icon: 'help' as const,
  page: `${GUIDE_PAGES[g.os].to}#help`,
  bare: `${GUIDE_BARE[g.os]}#help`,
})

// ---------------------------------------------------------------- S-1 아이폰 설치 확인
export const CHECK_IOS: GuideCheckContent = {
  key: 'check-ios',
  eyebrow: 'Install check · iOS',
  title: '아이폰 eSIM 설치 확인',
  lede: [
    '현지에 도착해 여행용 eSIM을 켠 뒤, 아래 화면과 비교해 확인해 주세요.',
    {
      before: '설치 방법은 ',
      link: { label: '아이폰 설치 가이드', page: GUIDE_PAGES.ios.to, bare: GUIDE_BARE.ios },
      after: '에서 볼 수 있어요.',
    },
  ],
  os: 'ios',
  chips: [
    { id: 'cellular', step: '확인 1', label: '셀룰러' },
    { id: 'line', step: '확인 2', label: '회선' },
    { id: 'data', step: '확인 3', label: '데이터' },
    { id: 'signal', step: '확인 4', label: '신호' },
  ],
  hint: CHECK_HINT,
  sections: [
    {
      id: 'cellular',
      badge: '확인 1',
      title: '셀룰러 화면',
      alt: false,
      lede: '[[설정 › 셀룰러]]를 열어 세 가지를 확인해요.',
      points: [
        '{{셀룰러 데이터}}가 여행용 회선이에요.',
        'SIMs의 메인과 여행용 회선이 모두 **켬**이에요.',
        '{{기본 음성 회선}}은 **메인**이에요.',
      ],
      figures: ['ios-cellular-arrival'],
      notes: [
        {
          tone: 'info',
          lines: [
            '**여행용 회선 이름은 폰이 붙여요.** ‘여행’ · ‘보조’처럼 폰마다 달라도 괜찮아요.',
            '한국에서는 여행용 회선이 ‘활성화 중…’으로 보이고 셀룰러 데이터는 메인이에요. 정상이에요.',
          ],
        },
        OTHER_ESIM,
      ],
    },
    {
      id: 'line',
      badge: '확인 2',
      title: '여행용 회선 설정',
      alt: true,
      lede: '셀룰러 화면에서 여행용 회선을 눌러 세부 화면을 열어요.',
      points: [
        '{{이 회선 켜기}}가 켜져 있어요.',
        '{{음성 및 데이터}}는 **5G 자동**이에요. 5G를 지원하지 않는 아이폰(11 이하 · SE 2세대)은 **LTE**로 보여요.',
        '{{데이터 로밍}}이 켜져 있어요. **가장 중요해요.**',
      ],
      figures: ['ios-line-check'],
    },
    {
      id: 'data',
      badge: '확인 3',
      title: '셀룰러 데이터',
      alt: false,
      lede: '[[설정 › 셀룰러 › 셀룰러 데이터]]를 열어요.',
      points: ['여행용 회선에 체크 표시가 있어요.', '{{셀룰러 데이터 전환 허용}}은 꺼져 있어요.'],
      figures: ['ios-celldata-travel'],
      notes: [stepThreeWarn(IOS_GUIDE)],
    },
    {
      id: 'signal',
      badge: '확인 4',
      title: '신호 표시',
      alt: true,
      lede: '화면 맨 위 상태 표시줄을 봐요.',
      points: [
        '신호 표시가 위아래 두 칸으로 나뉘어 있어요.',
        'Wi-Fi를 끄면 신호 옆에 **5G**나 **LTE**가 떠요.',
      ],
      status: 'ios',
      notes: [
        {
          tone: 'info',
          lines: [
            '**신호가 한 칸뿐인가요?** 여행용 회선이 꺼져 있거나 설치되지 않은 거예요. 확인 1부터 다시 봐 주세요.',
          ],
        },
      ],
    },
  ],
  end: {
    alt: false,
    title: END_TITLE,
    lede: END_LEDE,
    cards: [
      {
        label: '현지 통신사 바꾸기',
        sub: '설정에서 통신사를 직접 골라요',
        icon: 'network',
        page: `${GUIDE_NETWORK.page}#ios`,
        bare: `${GUIDE_NETWORK.bare}#ios`,
      },
      helpCard(IOS_GUIDE),
    ],
  },
}

// ---------------------------------------------------------------- S-2 안드로이드 설치 확인
export const CHECK_ANDROID: GuideCheckContent = {
  key: 'check-android',
  eyebrow: 'Install check · Android',
  title: '안드로이드 eSIM 설치 확인',
  lede: [
    '현지에 도착해 모바일 데이터를 ((eSIM 1))로 바꾼 뒤, 아래 화면과 비교해 확인해 주세요.',
    {
      before: '갤럭시 화면으로 안내해요. 설치 방법은 ',
      link: {
        label: '안드로이드 설치 가이드',
        page: GUIDE_PAGES.android.to,
        bare: GUIDE_BARE.android,
      },
      after: '에서 볼 수 있어요.',
    },
  ],
  os: 'android',
  chips: [
    { id: 'sim', step: '확인 1', label: 'SIM 관리자' },
    { id: 'roaming', step: '확인 2', label: '데이터 로밍' },
  ],
  hint: CHECK_HINT,
  sections: [
    {
      id: 'sim',
      badge: '확인 1',
      title: 'SIM 관리자',
      alt: false,
      lede: '[[설정 › 연결 › SIM 관리자]]를 열어요.',
      points: [
        '여행용 eSIM(((eSIM 1)))이 켜져 있어요.',
        '주 사용 SIM 카드의 {{모바일 데이터}}가 ((eSIM 1))이에요.',
        '같은 화면 아래 {{데이터 전환}}은 꺼져 있어요.',
      ],
      figures: ['aos-sim-esim1', 'aos-sim-arrival-data'],
      notes: [
        {
          tone: 'info',
          lines: [
            '**eSIM 이름은 폰마다 달라요.** 여행용 eSIM 이름과 모바일 데이터에 고른 이름이 같으면 돼요.',
          ],
        },
        OTHER_ESIM,
      ],
    },
    {
      id: 'roaming',
      badge: '확인 2',
      title: '데이터 로밍',
      alt: true,
      lede: '[[설정 › 연결 › 해외 로밍]]을 열어요.',
      points: ['{{데이터 로밍 eSIM 1}}이 켜져 있어요.', '{{데이터 로밍 SIM 1}}은 꺼져 있어요.'],
      figures: ['aos-roaming-esim'],
      notes: [
        {
          tone: 'info',
          lines: [
            '**SKT 폰은 메뉴가 달라요.** [[설정 › T로밍 › 로밍 상세 설정]]에서 데이터 로밍을 확인해 주세요.',
          ],
        },
        stepThreeWarn(ANDROID_GUIDE),
      ],
    },
  ],
  end: {
    alt: false,
    title: END_TITLE,
    lede: END_LEDE,
    cards: [
      {
        label: '현지 통신사 바꾸기',
        sub: '설정에서 통신사를 직접 골라요',
        icon: 'network',
        page: `${GUIDE_NETWORK.page}#android`,
        bare: `${GUIDE_NETWORK.bare}#android`,
      },
      helpCard(ANDROID_GUIDE),
    ],
  },
}

// ---------------------------------------------------------------- S-3 현지 통신사 바꾸기

export const NETWORK_GUIDE: GuideCheckContent = {
  key: 'network',
  eyebrow: 'Change network',
  title: '현지 통신사 바꾸기',
  lede: [
    '나라와 지역에 따라 잘 잡히는 통신사가 달라요.',
    '연결이 불안정하면 다른 통신사로 바꿔 보세요.',
  ],
  chips: [
    { id: 'ios', label: '아이폰' },
    { id: 'android', label: '안드로이드' },
  ],
  hint: '화면의 빨간 테두리는 설명이 가리키는 곳이에요.',
  intro: [
    {
      tone: 'tip',
      lines: [
        '**여행용 eSIM은 나라에 따라 여러 통신사에 연결할 수 있어요.** 통신사마다 잘 잡히는 곳이 달라, 신호가 약한 곳에서는 바꾸면 나아질 수 있어요.',
      ],
      link: {
        before: '나라별로 연결할 수 있는 통신사는 ',
        link: { label: '나라별 현지 통신사', page: GUIDE_CARRIERS.page, bare: GUIDE_CARRIERS.bare },
        after: '에서 볼 수 있어요.',
      },
    },
  ],
  sections: [
    {
      id: 'ios',
      badge: '아이폰',
      title: '아이폰에서 바꾸기',
      alt: true,
      steps: [
        {
          text: '[[설정 › 셀룰러]]에서 여행용 회선을 누르고 {{네트워크 선택}}을 눌러요.',
          figure: 'ios-line-network',
        },
        { text: '{{자동}}을 꺼요.', sub: CHANGE_WAIT, figure: 'ios-network-auto' },
        { text: '목록에서 다른 통신사를 골라요.', sub: CHANGE_DONE_SUB },
      ],
      notes: [
        {
          tone: 'info',
          lines: [
            '고른 통신사로도 안 되면 다시 자동으로 돌려 주세요.',
            '다른 나라로 옮기기 전에는 {{자동}}을 다시 켜 두세요. 자동이면 폰이 그 나라 통신사로 알아서 바꿔요.',
          ],
        },
      ],
    },
    {
      id: 'android',
      badge: '안드로이드',
      title: '안드로이드에서 바꾸기',
      alt: false,
      lede: '갤럭시 화면으로 안내해요. 다른 안드로이드 폰은 메뉴 이름이 조금 다를 수 있어요.',
      steps: [
        {
          text: '[[설정 › 연결 › 모바일 네트워크 › 로밍 이동통신사 선택]]을 눌러요.',
          sub: 'SKT 폰은 [[설정 › T로밍 › 로밍 이동통신사 선택]]에 있어요.',
        },
        {
          text: '위 탭에서 {{eSIM 1}}을 누르고 {{자동 선택}}을 꺼요.',
          sub: CHANGE_WAIT,
          figure: 'aos-carrier-auto',
        },
        { text: '목록에서 다른 통신사를 골라요.', sub: CHANGE_DONE_SUB },
      ],
      notes: [
        {
          tone: 'info',
          lines: [
            '고른 통신사로도 안 되면 다시 자동 선택으로 돌려 주세요.',
            '다른 나라로 옮기기 전에는 {{자동 선택}}을 다시 켜 두세요. 자동이면 폰이 그 나라 통신사로 알아서 바꿔요.',
          ],
        },
      ],
    },
  ],
  end: {
    alt: true,
    after: [{ title: '설치 확인하기', sub: '설정을 화면과 비교해요.', buttons: AFTER_CHECK_OS }],
    cards: [
      {
        label: '나라별 현지 통신사',
        sub: '나라마다 연결할 수 있는 통신사',
        icon: 'carriers',
        page: GUIDE_CARRIERS.page,
        bare: GUIDE_CARRIERS.bare,
      },
    ],
  },
}

// ---------------------------------------------------------------- S-4 나라별 현지 통신사(머리 · 안내 — 목록은 카탈로그 데이터를 본문 슬롯에)
export const CARRIERS_GUIDE: GuideCheckContent = {
  key: 'carriers',
  eyebrow: 'Carriers',
  title: '나라별 현지 통신사',
  lede: [
    '여행용 eSIM이 나라마다 연결할 수 있는 통신사예요.',
    '연결이 불안정하면 이 중 다른 통신사로 바꿔 보세요.',
  ],
  chips: [],
  hint: '',
  intro: [
    {
      tone: 'info',
      lines: [OPERATOR_NOTE],
      link: {
        before: '',
        link: {
          label: '통신사 바꾸는 방법 보기',
          page: GUIDE_NETWORK.page,
          bare: GUIDE_NETWORK.bare,
        },
        after: '',
      },
    },
  ],
  sections: [],
  end: { alt: true, cards: [] },
}
