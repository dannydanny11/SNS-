// 모듈 ③ — 게시물 1건의 전체 카드 세트 생성.
// 확정 시안: C (소프트 크림).  표지 1 + 제품 N + CTA 1.
import { THEMES } from './theme.js';
import { buildCover, buildProduct, buildCta } from './templates.js';
import { renderCard } from './render.js';
import { writeFileSync, mkdirSync } from 'node:fs';

export const CONFIRMED_THEME = 'C';

/**
 * 게시물 카드 세트를 렌더링해 파일로 저장.
 * @param {{category:object, products:Array}} post
 * @param {string} outDir  카드 PNG 저장 폴더
 * @returns {Promise<string[]>} 순서대로 정렬된 카드 파일 경로 배열
 */
export async function buildPostCards(post, outDir) {
  const theme = THEMES[CONFIRMED_THEME];
  const { category, products } = post;
  const total = products.length;

  mkdirSync(outDir, { recursive: true });
  const files = [];

  // 1) 표지
  const coverHtml = buildCover(theme, {
    headline: category.headline || category.name,
    category: category.name,
    total,
    products,
  });
  const coverPath = `${outDir}/01-cover.jpg`;
  writeFileSync(coverPath, await renderCard(coverHtml));
  files.push(coverPath);

  // 2) 제품 카드들
  for (let i = 0; i < products.length; i++) {
    const html = buildProduct(theme, {
      index: i + 1,
      total,
      product: products[i],
    });
    const p = `${outDir}/${String(i + 2).padStart(2, '0')}-product.jpg`;
    writeFileSync(p, await renderCard(html));
    files.push(p);
  }

  // 3) CTA
  const ctaHtml = buildCta(theme, { category: category.name });
  const ctaPath = `${outDir}/${String(products.length + 2).padStart(2, '0')}-cta.jpg`;
  writeFileSync(ctaPath, await renderCard(ctaHtml));
  files.push(ctaPath);

  return files;
}
