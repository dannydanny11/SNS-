// 모듈 ⑤ 인스타그램 게시 (Instagram API with Instagram Login — 캐러셀).
//   흐름: 각 이미지 컨테이너 생성 → 캐러셀 컨테이너 생성 → publish
//   이미지는 공개 URL 이어야 함(GitHub raw 등). imageUrls 로 전달받는다.
//   Instagram 로그인 API 는 graph.instagram.com 을 사용한다.
import { requireEnv, optionalEnv } from './config.js';

// Instagram 로그인 플로우: graph.instagram.com
// (Facebook 로그인 플로우로 바꾸려면 IG_API_BASE=https://graph.facebook.com/v21.0)
const GRAPH = optionalEnv('IG_API_BASE') || 'https://graph.instagram.com/v21.0';

async function graphPost(path, params) {
  const url = `${GRAPH}/${path}`;
  const body = new URLSearchParams(params);
  const res = await fetch(url, { method: 'POST', body });
  const json = await res.json();
  if (!res.ok || json.error) {
    const msg = json?.error?.message || JSON.stringify(json);
    throw new Error(`Graph API 오류: ${msg}`);
  }
  return json;
}

/**
 * 캐러셀 게시물 발행.
 * @param {{imageUrls:string[], caption:string}} args
 * @returns {Promise<{id:string, permalink?:string}>}
 */
export async function publishCarousel({ imageUrls, caption }) {
  const igUserId = requireEnv('IG_USER_ID');
  const token = requireEnv('IG_ACCESS_TOKEN');

  if (!imageUrls || imageUrls.length < 2) {
    throw new Error('캐러셀은 이미지 2장 이상 필요');
  }
  if (imageUrls.length > 10) {
    imageUrls = imageUrls.slice(0, 10); // 인스타 캐러셀 최대 10장
  }

  // 1) 개별 이미지 컨테이너 생성
  const childIds = [];
  for (const imageUrl of imageUrls) {
    const r = await graphPost(`${igUserId}/media`, {
      image_url: imageUrl,
      is_carousel_item: 'true',
      access_token: token,
    });
    childIds.push(r.id);
  }

  // 2) 캐러셀 컨테이너 생성
  const carousel = await graphPost(`${igUserId}/media`, {
    media_type: 'CAROUSEL',
    children: childIds.join(','),
    caption,
    access_token: token,
  });

  // 3) 발행
  const published = await graphPost(`${igUserId}/media_publish`, {
    creation_id: carousel.id,
    access_token: token,
  });

  // permalink 조회(선택)
  let permalink;
  try {
    const info = await fetch(
      `${GRAPH}/${published.id}?fields=permalink&access_token=${token}`
    ).then((r) => r.json());
    permalink = info.permalink;
  } catch {
    /* permalink 실패는 무시 */
  }

  return { id: published.id, permalink };
}
