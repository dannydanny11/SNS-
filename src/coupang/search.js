// 상품 검색 + 골드박스 조회 (모듈 ① 상품 선정이 사용).
import { coupangRequest } from './client.js';

/**
 * 키워드로 상품 검색.
 * @param {string} keyword
 * @param {number} [limit=20]  최대 100
 * @returns {Promise<Array>} productData 배열
 */
export async function searchProducts(keyword, limit = 20) {
  const json = await coupangRequest('GET', '/products/search', {
    query: { keyword, limit },
  });
  return json?.data?.productData ?? [];
}

/**
 * 골드박스(오늘의 특가) 상품 목록.
 * @returns {Promise<Array>}
 */
export async function getGoldbox() {
  const json = await coupangRequest('GET', '/products/goldbox');
  return json?.data ?? [];
}
