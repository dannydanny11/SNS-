// 카드 디자인 시안 3종의 테마 정의 (색·폰트·질감).
// 사용자가 하나를 고르면 그 id 를 확정 템플릿으로 고정한다.
export const THEMES = {
  // 시안 A — 미니멀 화이트: 밝고 신뢰감, 무인양품풍 큐레이션
  A: {
    id: 'A',
    label: '미니멀 화이트',
    bg: '#ffffff',
    fg: '#111111',
    sub: '#8a8a8a',
    accent: '#ff6a3d',
    card: '#f5f5f4',
    priceColor: '#111111',
    font: `'Noto Sans KR','Malgun Gothic',sans-serif`,
    coverBg: '#ffffff',
    coverFg: '#111111',
  },
  // 시안 B — 다크 프리미엄: 테크·프리미엄 톤, 강한 대비
  B: {
    id: 'B',
    label: '다크 프리미엄',
    bg: '#141414',
    fg: '#ffffff',
    sub: '#9a9a9a',
    accent: '#ff7a45',
    card: '#1f1f1f',
    priceColor: '#ff7a45',
    font: `'Noto Sans KR','Malgun Gothic',sans-serif`,
    coverBg: '#141414',
    coverFg: '#ffffff',
  },
  // 시안 C — 소프트 크림: 따뜻하고 아늑한 자취/생활 톤
  C: {
    id: 'C',
    label: '소프트 크림',
    bg: '#fbf6ef',
    fg: '#2b2b2b',
    sub: '#a08e7d',
    accent: '#e07a5f',
    card: '#ffffff',
    priceColor: '#2b2b2b',
    font: `'Noto Sans KR','Malgun Gothic',sans-serif`,
    coverBg: '#f2e7d8',
    coverFg: '#2b2b2b',
  },
};
