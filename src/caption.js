// 모듈 ④ 캡션 생성 (Claude API).
//   · 정보형 큐레이션 톤 ("이런 제품이 있다 / 이런 사람에게 맞다")
//   · "직접 써봤다" 류 허위 후기 표현 금지
//   · 해시태그 10~15개
//   · 대가성 문구 + CTA 는 코드에서 강제 삽입 (모델 누락 방지)
import Anthropic from '@anthropic-ai/sdk';
import { requireEnv } from './config.js';

// 대가성 필수 문구 (공정위 규정) — 반드시 포함.
export const DISCLOSURE =
  '이 게시물은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.';
export const CTA = '👉 링크는 프로필에서 확인하세요';

// 허위 후기로 오해될 수 있는 금지 표현.
const FORBIDDEN = ['직접 써', '직접 사용', '내돈내산', '제가 써보', '사용해보니', '후기'];

function productSummary(products) {
  return products
    .map((p, i) => {
      const name = p.productName.split(',')[0].trim();
      const price = p.productPrice?.toLocaleString('ko-KR');
      return `${i + 1}. ${name} (${price}원)`;
    })
    .join('\n');
}

const SYSTEM_PROMPT = `너는 한국 인스타그램 큐레이션 계정 'atoztem'의 카피라이터다.
쿠팡에서 찾은 가성비 제품을 '정보형 큐레이션' 톤으로 소개한다.

규칙(반드시 지킬 것):
- 표지 훅 문구(headline): 그날 상품들을 아우르는 **긍정적이고 설레는** 한 마디. **매번 다르게, 흥미롭게.** 8~14자, 필요하면 \\n 으로 2줄.
  · 부정어("없으면", "불편한", "힘든", "지친") 금지 → 긍정·기대·발견 톤.
  · 예: "책상이 즐거워지는 템", "오늘의 갓성비 발견", "삶의 질 올려주는 5", "이건 사길 잘했다", "매일 손이 가는 템".
- 톤: "이런 제품이 있다 / 이런 사람에게 맞다" 식의 담백한 정보 제공. 과장·낚시 금지.
- 절대 금지: "직접 써봤다", "사용해보니", "내돈내산", "후기", 효능·건강 단정("통증이 사라져요") 등 허위/과장.
- 제품을 "추천"이 아니라 "소개/정리"하는 관점으로 쓴다.
- 이모지는 3~5개만 적절히. 존댓말.
- 캡션 본문은 4~7줄 이내로 간결하게.
- 해시태그 10~15개(한글 위주, # 포함).
- 릴스 첫 프레임 훅(reelHook): **스크롤을 멈추게 하는 강력한 한 방**(8~16자, \\n 2줄 가능). 이 상품 세트를 아우르되, 아래 검증된 훅 공식을 활용:
  · 호기심("이거 왜 이제 알았지", "다들 산다는 그거")
  · 가치·타깃 지목("자취 필수템만 모았어요", "집이 확 달라지는 5")
  · 비교·의외성("비싼 거 살 필요 없어요")
  → 구체적 가격 단정("다 3만원") 금지(사실확인 불가), 허위후기 금지.
- 각 제품마다 "한 줄 카피"도 만든다(14~26자): **제품 특징에 맞춰 훅 공식을 매번 다르게** 섞어라. 같은 어투 반복 금지.
  · 문제/공감형: "책상 위 선 정리, 이제 그만하고 싶다면"
  · 호기심형: "구멍 안 뚫고 이게 붙어요?"
  · 특징/비교형: "타공 없이 붙이는 욕실선반"
  · 타깃 지목형: "차에서 폰 쓰는 분 필수"
  제품의 성격(수납·신기템·가성비·특정용도)에 맞는 공식을 골라 써라.
  → 효능·건강 단정·허위후기 금지("통증이 사라져요", "직접 써보니" X). 상황·특징·니즈는 OK.

출력은 반드시 아래 JSON 형식만:
{"headline": "캐러셀 표지 훅(긍정·흥미, \\n로 2줄 가능)", "reelHook": "릴스 첫 프레임 스크롤스토퍼 훅(\\n로 2줄 가능)", "body": "캡션 본문", "hashtags": ["#태그1", ...], "copies": ["1번상품 한줄카피(공식 다양)", ...]}`;

/**
 * 캡션 생성.
 * @param {{category:object, products:Array}} post
 * @returns {Promise<{body:string, hashtags:string[], caption:string}>}
 */
export async function generateCaption(post) {
  const apiKey = requireEnv('ANTHROPIC_API_KEY');
  const client = new Anthropic({ apiKey });
  const { category, products } = post;

  const userMsg = `카테고리: ${category.name}
아래 ${products.length}개 제품을 소개하는 인스타 캡션을 써줘.

${productSummary(products)}`;

  const res = await client.messages.create({
    model: 'claude-opus-5',
    max_tokens: 1500,
    output_config: { effort: 'low' },
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMsg }],
  });

  // 응답에서 텍스트 추출
  const text = res.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();

  let parsed;
  try {
    // 코드펜스 등 제거 후 JSON 파싱
    const json = text.replace(/```json\s*|\s*```/g, '').trim();
    parsed = JSON.parse(json);
  } catch {
    throw new Error(`캡션 JSON 파싱 실패: ${text.slice(0, 200)}`);
  }

  let body = String(parsed.body || '').trim();
  let hashtags = Array.isArray(parsed.hashtags) ? parsed.hashtags : [];
  let copies = Array.isArray(parsed.copies) ? parsed.copies.map((c) => String(c).trim()) : [];
  let headline = String(parsed.headline || '').trim();
  let reelHook = String(parsed.reelHook || parsed.headline || '').trim();

  // 금지 표현 검사 (본문 + 카피) — 있으면 재생성 유도
  const checkText = body + ' ' + copies.join(' ');
  for (const bad of FORBIDDEN) {
    if (checkText.includes(bad)) {
      throw new Error(`금지 표현 감지("${bad}") — 재생성 필요`);
    }
  }

  // 해시태그 10~15개로 보정
  hashtags = hashtags
    .map((h) => (h.startsWith('#') ? h : '#' + h))
    .filter((h) => h.length > 1)
    .slice(0, 15);

  // 최종 캡션 조립: 본문 + CTA + 대가성 문구 + 해시태그
  const caption = [
    body,
    '',
    CTA,
    '',
    DISCLOSURE,
    '',
    hashtags.join(' '),
  ].join('\n');

  return { body, hashtags, caption, copies, headline, reelHook };
}
