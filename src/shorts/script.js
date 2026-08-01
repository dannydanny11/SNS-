// 쇼츠 대본 생성.
//   · slides 별 캡션(화면 자막) + narration(TTS 대사) + 유튜브 제목/설명/해시태그
//   · Claude 사용, ANTHROPIC_API_KEY 없거나 실패 시 템플릿 폴백으로 자동 전환
//   · "직접 써봤다" 류 허위 후기 표현 금지(공정위/신뢰)
import Anthropic from '@anthropic-ai/sdk';
import { optionalEnv } from '../config.js';

// 유튜브용 대가성 필수 문구(공정위).
export const DISCLOSURE_YT =
  '이 영상은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.';

const FORBIDDEN = ['직접 써', '직접 사용', '내돈내산', '제가 써보', '사용해보니', '후기'];

function shortName(name = '') {
  return name.split(',')[0].replace(/\|/g, ' ').trim();
}
function won(n) {
  return typeof n === 'number' ? n.toLocaleString('ko-KR') + '원' : String(n);
}
function hasForbidden(s = '') {
  return FORBIDDEN.some((b) => s.includes(b));
}

const SYSTEM_PROMPT = `너는 한국 유튜브 쇼츠 채널 'atoztem'의 대본 작가다.
쿠팡에서 찾은 가성비 제품 1개를 30~40초 세로 쇼츠로 소개한다.

규칙(반드시):
- 톤: "이런 제품이 있다 / 이런 사람에게 좋다" 식 담백한 정보 큐레이션. 과장·낚시·허위 금지.
- 금지 표현: "직접 써봤다","사용해보니","내돈내산","후기" 등 본인이 쓰거나 샀다는 뉘앙스.
- 캡션(화면 자막)은 짧고 강하게. 나레이션(대사)은 말맛 있게, 각 1~2문장.
- points 는 제품의 실제 셀링포인트(용도/편의/가성비). 스펙을 지어내지 말 것.
- 이모지 남발 금지.

반드시 아래 JSON 만 출력:
{
  "hook_caption": "훅 자막 (한 줄, 12자 내외)",
  "hook_line": "훅 나레이션",
  "product_caption": "상품슬라이드 짧은 태그라인 (8자 내외, 없으면 빈문자열)",
  "product_line": "상품 소개 나레이션",
  "points": [ {"caption":"포인트 자막(한 줄)","line":"포인트 나레이션"}, ... 정확히 2개 ],
  "cta_caption": "마무리 자막 (한 줄)",
  "cta_line": "마무리 나레이션",
  "title": "유튜브 제목 (해시태그 없이, 40자 내외)",
  "description": "유튜브 설명 본문 2~3줄 (링크/고지문구 제외)",
  "hashtags": ["#쇼츠","#가성비", ... 8~12개]
}`;

/** 템플릿 폴백 대본 (LLM 없이) */
export function templateScript(product, category) {
  const name = shortName(product.productName);
  const price = won(product.productPrice);
  const cat = category?.name || '가성비템';
  return {
    hook_caption: `이 가격 실화?`,
    hook_line: `요즘 ${cat} 찾는다면 이거 한 번 보세요.`,
    product_caption: category?.tier === 'high' ? '가성비 甲' : '',
    product_line: `${name}, 가격은 ${price}대예요.`,
    points: [
      { caption: '일상에서 매일 씀', line: `${cat} 중에서도 활용도가 높은 편이에요.` },
      { caption: '이 가격이면 부담 없죠', line: `부담 없는 가격이라 처음 들이기 좋아요.` },
    ],
    cta_caption: '마음에 들었다면',
    cta_line: `구매 링크는 아래에 남겨둘게요.`,
    title: `${name} | ${cat} 가성비템`,
    description: `${cat} 찾는 분들을 위한 ${name} 소개 영상입니다.\n가격대와 특징을 짧게 정리했어요.`,
    hashtags: ['#쇼츠', '#가성비', '#쿠팡', `#${cat.replace(/[^가-힣a-zA-Z0-9]/g, '')}`, '#추천템', '#자취템', '#꿀템', '#atoztem'],
  };
}

async function llmScript(product, category) {
  const apiKey = optionalEnv('ANTHROPIC_API_KEY');
  if (!apiKey) return null;
  const client = new Anthropic({ apiKey });
  const userMsg = `카테고리: ${category?.name || ''}
상품명: ${shortName(product.productName)}
가격: ${won(product.productPrice)}
로켓배송: ${product.isRocket ? '예' : '아니오'}

이 상품 1개로 쇼츠 대본을 만들어줘.`;

  const res = await client.messages.create({
    model: 'claude-opus-5',
    max_tokens: 1500,
    output_config: { effort: 'low' },
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMsg }],
  });
  const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
  const json = text.replace(/```json\s*|\s*```/g, '').trim();
  const parsed = JSON.parse(json);

  // 허위 후기 표현 검사
  const allText = [parsed.hook_line, parsed.product_line, parsed.cta_line, ...(parsed.points || []).map((p) => p.line)].join(' ');
  if (hasForbidden(allText)) throw new Error('금지 표현 감지 — 폴백 사용');
  return parsed;
}

/**
 * 쇼츠 대본 생성 (LLM → 실패 시 템플릿).
 * @returns {Promise<{slides:Array, narration:string[], yt:object, source:'llm'|'template'}>}
 */
export async function generateShortsScript(product, category) {
  let raw = null;
  let source = 'template';
  try {
    raw = await llmScript(product, category);
    if (raw) source = 'llm';
  } catch (e) {
    console.warn(`  (대본 LLM 실패 → 템플릿 사용: ${e.message})`);
  }
  if (!raw) raw = templateScript(product, category);

  const points = (raw.points || []).slice(0, 2);
  while (points.length < 2) points.push({ caption: '', line: '' });

  // 슬라이드 정의(렌더 순서) + 슬라이드별 나레이션
  const slides = [
    { kind: 'hook', caption: raw.hook_caption, narration: raw.hook_line },
    { kind: 'product', caption: raw.product_caption, narration: raw.product_line },
    { kind: 'point', index: 1, caption: points[0].caption, narration: points[0].line },
    { kind: 'point', index: 2, caption: points[1].caption, narration: points[1].line },
    { kind: 'cta', caption: raw.cta_caption, narration: raw.cta_line },
  ];
  const narration = slides.map((s) => s.narration || '');

  const hashtags = (raw.hashtags || [])
    .map((h) => (String(h).startsWith('#') ? h : '#' + h))
    .slice(0, 12);

  return {
    slides,
    narration,
    yt: { title: raw.title, description: raw.description, hashtags },
    source,
  };
}
