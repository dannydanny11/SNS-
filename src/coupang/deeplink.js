// 파트너스 제휴 딥링크 생성 (모듈 ②의 핵심).
import { coupangRequest } from './client.js';

/**
 * 쿠팡 상품 URL 들을 파트너스 제휴(추적) 링크로 변환.
 * @param {string[]} coupangUrls  일반 쿠팡 상품 URL 배열 (최대 여러 개)
 * @returns {Promise<Array<{originalUrl:string, shortenUrl:string, landingUrl:string}>>}
 */
export async function createDeeplinks(coupangUrls) {
  if (!Array.isArray(coupangUrls) || coupangUrls.length === 0) {
    throw new Error('createDeeplinks: 변환할 URL 이 없습니다.');
  }
  const json = await coupangRequest('POST', '/deeplink', {
    body: { coupangUrls },
  });
  return json?.data ?? [];
}
