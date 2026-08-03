// 모듈 ③ — 게시물 1건의 전체 카드 세트 생성.
// 확정 시안: C (소프트 크림).  표지 1 + 제품 N + CTA 1.
import { THEMES } from './theme.js';
import { buildCover, buildProduct, buildCta } from './templates.js';
import { buildReelCover, buildReelProduct, buildReelCta } from './reelTemplates.js';
import { renderCard, renderReel } from './render.js';
import { writeFileSync, mkdirSync } from 'node:fs';

export const CONFIRMED_THEME = 'C';

/**
 * 게시물 카드 세트를 렌더링해 파일로 저장.
 * @param {{category:object, products:Array}} post
 * @param {string} outDir  카드 PNG 저장 폴더
 * @returns {Promise<string[]>} 순서대로 정렬된 카드 파일 경로 배열
 */
export async function buildPostCards(post, outDir, opts = {}) {
  const theme = THEMES[CONFIRMED_THEME];
  const { category, products } = post;
  const total = products.length;
  const headline = opts.headline || category.headline || category.name;

  mkdirSync(outDir, { recursive: true });
  const files = [];

  // 1) 표지
  const coverHtml = buildCover(theme, {
    headline,
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

/**
 * 릴스용 9:16(1080×1920) 카드 세트 렌더링 → 파일 저장.
 * @returns {Promise<string[]>} 순서대로 정렬된 세로 카드 경로
 */
export async function buildReelCards(post, outDir, opts = {}) {
  const theme = THEMES[CONFIRMED_THEME];
  const { category, products } = post;
  const total = products.length; // 표지엔 전체 개수(BEST N) 유지
  const headline = opts.headline || category.headline || category.name;
  // 릴스는 짧게 — 제품 일부만 노출(티저). 전체는 피드 캐러셀에.
  const shown = products.slice(0, opts.maxProducts || products.length);
  mkdirSync(outDir, { recursive: true });
  const files = [];

  const cover = buildReelCover(theme, { headline, category: category.name, total, products });
  const coverPath = `${outDir}/01-cover.jpg`;
  writeFileSync(coverPath, await renderReel(cover));
  files.push(coverPath);

  for (let i = 0; i < shown.length; i++) {
    const html = buildReelProduct(theme, { index: i + 1, total: shown.length, product: shown[i] });
    const p = `${outDir}/${String(i + 2).padStart(2, '0')}-product.jpg`;
    writeFileSync(p, await renderReel(html));
    files.push(p);
  }

  const ctaPath = `${outDir}/${String(products.length + 2).padStart(2, '0')}-cta.jpg`;
  writeFileSync(ctaPath, await renderReel(buildReelCta(theme)));
  files.push(ctaPath);

  return files;
}
