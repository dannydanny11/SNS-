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
쿠팡에서 찾은 가성비 제품 1개를 45~60초 세로 쇼츠로 소개한다.

목표: 시청자가 "오 이거 괜찮네" 하고 링크를 누르게 만든다. 제품의 매력포인트를 구체적으로 살려라.

규칙(반드시):
- 톤: "이런 제품이 있다 / 이런 사람에게 좋다" 식 정보 큐레이션 + 셀링. 과장·낚시·허위는 금지하되, 장점은 매력적으로.
- 금지 표현: "직접 써봤다","사용해보니","내돈내산","후기" 등 본인이 쓰거나 샀다는 뉘앙스.
- 캡션(화면 자막)은 짧고 강하게(한 줄). 나레이션(대사)은 각 2문장으로 충분히 말한다(너무 짧지 않게).
- points 는 3개. 각 포인트는 '무엇이 왜 좋은지'를 구체적으로: 용도/편의/디자인/가성비/이런사람에게 좋음 등. 없는 스펙을 지어내지 말 것.
- hook 은 스크롤을 멈추게: 가격 궁금증·문제상황·"이거 하나면" 류로 강하게.
- cta 는 클릭 유도: "고민되면 링크에서 가격이랑 상세정보 확인" 같이 자연스럽게 행동 유도. ('후기' 라는 단어는 쓰지 말 것)
- 이모지 남발 금지(0~1개).

반드시 아래 JSON 만 출력:
{
  "hook_caption": "훅 자막 (한 줄, 12자 내외)",
  "hook_line": "훅 나레이션 (2문장, 궁금증 유발)",
  "product_caption": "상품슬라이드 짧은 태그라인 (8자 내외, 없으면 빈문자열)",
  "product_line": "상품 소개 나레이션 (2문장, 어떤 제품이고 왜 눈길 가는지)",
  "points": [ {"caption":"포인트 자막(한 줄)","line":"포인트 나레이션(2문장, 구체적 장점)"}, ... 정확히 3개 ],
  "cta_caption": "마무리 자막 (한 줄)",
  "cta_line": "마무리 나레이션 (2문장, 링크 클릭 유도)",
  "title": "유튜브 제목 (해시태그 없이, 40자 내외, 클릭 유도형)",
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
    hook_line: `요즘 ${cat} 하나쯤 찾고 계셨다면 이건 꼭 보세요. 가격 보고 놀라실 수도 있어요.`,
    product_caption: category?.tier === 'high' ? '가성비 甲' : '',
    product_line: `오늘 소개할 건 ${name}예요. 가격은 ${price}대인데 기본기가 탄탄한 편이라 눈길이 갑니다.`,
    points: [
      { caption: '매일 쓰는 실용템', line: `${cat} 중에서도 활용도가 높아 한 번 들이면 매일 손이 가요. 괜히 사놓고 안 쓰는 물건이 아니에요.` },
      { caption: '군더더기 없는 디자인', line: `디자인이 깔끔해서 어디에 둬도 잘 어울려요. 책상이든 가방이든 자리 차지도 적습니다.` },
      { caption: '이 가격이면 부담 zero', line: `${price}대라 처음 들이기에 부담이 없어요. 실패해도 아깝지 않은 가격대라 입문용으로 딱이에요.` },
    ],
    cta_caption: '고민된다면',
    cta_line: `조금이라도 끌렸다면 아래 링크에서 가격이랑 상세정보 확인해 보세요. 지금 가격이 계속 가는 건 아니거든요.`,
    title: `${name} | 이 가격에 이 정도면 ${cat} 가성비 甲`,
    description: `${cat} 찾는 분들을 위한 ${name} 소개 영상입니다.\n어떤 점이 좋은지, 어떤 사람에게 맞는지 짧게 정리했어요.`,
    hashtags: ['#쇼츠', '#가성비', '#쿠팡', `#${cat.replace(/[^가-힣a-zA-Z0-9]/g, '')}`, '#추천템', '#자취템', '#꿀템', '#가성비템', '#atoztem'],
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

  const points = (raw.points || []).slice(0, 3);
  while (points.length < 3) points.push({ caption: '', line: '' });

  // 슬라이드 정의(렌더 순서) + 슬라이드별 나레이션
  const slides = [
    { kind: 'hook', caption: raw.hook_caption, narration: raw.hook_line },
    { kind: 'product', caption: raw.product_caption, narration: raw.product_line },
    { kind: 'point', index: 1, caption: points[0].caption, narration: points[0].line },
    { kind: 'point', index: 2, caption: points[1].caption, narration: points[1].line },
    { kind: 'point', index: 3, caption: points[2].caption, narration: points[2].line },
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
