// 모듈 ① 상품 자동 선정.
//   1) 오늘의 카테고리 선택 (로테이션 + 수수료 tier 균형: high 60%+ 유지)
//   2) 카테고리 키워드로 검색 → 후보 수집
//   3) 최근 30일 게시 상품 제외 (posted_log.json)
//   4) 품질 필터(로켓배송/가격대) 후 상위 N개 선정
import { CATEGORIES } from './categories.js';
import { searchProducts } from './coupang/search.js';
import { recentProductIds, recentTierCounts } from './postedLog.js';

const PRICE_MIN = 5000;
const PRICE_MAX = 200000;

/**
 * 오늘 사용할 카테고리 결정.
 * 로테이션 순서를 따르되, low tier(전자기기성) 비중이 40%를 넘지 않도록 보정.
 */
export function pickCategory(now = Date.now()) {
  // 날짜 기반 로테이션 인덱스 (매일 다음 카테고리로)
  const dayIndex = Math.floor(now / (24 * 60 * 60 * 1000));
  const start = dayIndex % CATEGORIES.length;

  const { low, total } = recentTierCounts(10);
  // 최근 게시물 중 low 비중이 이미 40% 이상이면 low 카테고리를 회피
  const avoidLow = total >= 3 && low / total >= 0.4;

  for (let i = 0; i < CATEGORIES.length; i++) {
    const cat = CATEGORIES[(start + i) % CATEGORIES.length];
    if (avoidLow && cat.tier === 'low') continue;
    return cat;
  }
  return CATEGORIES[start];
}

/** 품질 기준으로 상품 후보를 점수화 (높을수록 우선) */
function scoreProduct(p) {
  let s = 0;
  if (p.isRocket) s += 3; // 로켓배송 우대
  if (p.productPrice >= 10000 && p.productPrice <= 80000) s += 2; // 충동구매 가격대
  if (p.productImage) s += 1; // 이미지 있는 것만 카드 제작 가능
  return s;
}

/**
 * 오늘의 상품 세트 선정.
 * @param {object} [opts]
 * @param {number} [opts.count=5] 선정할 상품 수
 * @param {object} [opts.category] 카테고리 강제 지정(테스트용)
 * @returns {Promise<{category:object, products:Array}>}
 */
export async function selectProducts(opts = {}) {
  const count = opts.count ?? 5;
  const category = opts.category ?? pickCategory();
  const excluded = recentProductIds(30);

  const seen = new Set();
  const candidates = [];

  for (const keyword of category.keywords) {
    let results = [];
    try {
      results = await searchProducts(keyword, 10);
    } catch (e) {
      // 개별 키워드 실패는 건너뛰고 계속
      console.warn(`  (검색 실패: ${keyword} — ${e.message})`);
      continue;
    }
    for (const p of results) {
      const id = String(p.productId);
      if (seen.has(id)) continue; // 중복 상품
      if (excluded.has(id)) continue; // 최근 30일 게시됨
      if (p.productPrice < PRICE_MIN || p.productPrice > PRICE_MAX) continue;
      if (!p.productImage) continue;
      seen.add(id);
      candidates.push({ ...p, _keyword: keyword, _score: scoreProduct(p) });
    }
  }

  // 키워드별로 그룹화 후 각 그룹 내 점수 정렬
  const byKeyword = new Map();
  for (const c of candidates) {
    if (!byKeyword.has(c._keyword)) byKeyword.set(c._keyword, []);
    byKeyword.get(c._keyword).push(c);
  }
  for (const list of byKeyword.values()) {
    list.sort((a, b) => b._score - a._score);
  }

  // 라운드로빈: 서로 다른 키워드에서 하나씩 뽑아 다양성 확보
  const products = [];
  const groups = [...byKeyword.values()];
  let round = 0;
  while (products.length < count) {
    let added = false;
    for (const list of groups) {
      if (list[round]) {
        products.push(list[round]);
        added = true;
        if (products.length >= count) break;
      }
    }
    if (!added) break; // 더 이상 뽑을 후보 없음
    round++;
  }

  return { category, products };
}
