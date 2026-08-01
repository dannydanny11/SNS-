// 카테고리 정의 + 검색 키워드 풀.
//
// tier:
//   'high' = 수수료 3~5% 카테고리 (생활/가전/데스크) — 이 비중을 60% 이상으로 유지
//   'low'  = 전자기기성(수수료 1%에 가까운) 카테고리 — 편중 방지 대상
export const CATEGORIES = [
  {
    id: 'desk',
    name: '데스크셋업템',
    tier: 'high',
    headline: '책상 위가\n바뀌는 템',
    keywords: [
      '모니터 받침대',
      '데스크 매트',
      '무선 충전 패드',
      'LED 무드등',
      '케이블 정리',
      '모니터암',
    ],
  },
  {
    id: 'home',
    name: '자취·생활가전',
    tier: 'high',
    headline: '자취방\n필수 가전',
    keywords: [
      '미니 가습기',
      '무선 핸디청소기',
      '전기 포트',
      '미니 제습기',
      '멀티탭',
      'led 스탠드',
    ],
  },
  {
    id: 'it',
    name: 'IT 액세서리',
    tier: 'low',
    headline: '없으면\n불편한 IT템',
    keywords: [
      '무선 마우스',
      '기계식 키보드',
      'USB 허브',
      '노트북 거치대',
      '블루투스 이어폰',
    ],
  },
  {
    id: 'value',
    name: '생활 갓성비템',
    tier: 'high',
    headline: '이 가격에\n이 퀄리티',
    keywords: [
      '주방 수납',
      '욕실 정리',
      '차량용 거치대',
      '보온 텀블러',
      '수납 정리함',
      '빨래 건조대',
    ],
  },
];

export function getCategory(id) {
  return CATEGORIES.find((c) => c.id === id);
}
