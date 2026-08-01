// 파이프라인 코어 — generate(카드+캡션 생성) 와 publish(게시) 를 분리.
// 게시는 카드 이미지를 먼저 공개 URL 로 올린 뒤 진행해야 하므로 2단계로 나눈다.
import { selectProducts } from './selectProducts.js';
import { createDeeplinks } from './coupang/deeplink.js';
import { buildPostCards } from './cards/build.js';
import { generateCaption } from './caption.js';
import { validateCaption } from './validateCaption.js';
import { publishCarousel } from './instagram.js';
import { appendPosted } from './postedLog.js';
import { requireEnv } from './config.js';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { basename } from 'node:path';

// published/ 는 gitignore 되지 않음 — Actions 가 카드를 커밋해 공개 URL 로 게시한다.
const PUB_DIR = 'published';
const MANIFEST = `${PUB_DIR}/latest-manifest.json`;

/**
 * ①~④ : 상품 선정 → 딥링크 → 카드 렌더 → 캡션 생성/검증.
 * 결과를 out/latest-manifest.json 에 기록하고 반환.
 */
export async function generate() {
  const post = await selectProducts();
  const { category, products } = post;
  if (products.length < 3) {
    throw new Error(`선정 상품 부족(${products.length}개) — 이번 회차 건너뜀`);
  }

  // 제휴 딥링크(선택) — productUrl 자체가 제휴 링크라 실패해도 무방
  let deeplinks = [];
  try {
    deeplinks = await createDeeplinks(products.map((p) => p.productUrl));
  } catch {
    /* ignore */
  }

  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  mkdirSync(PUB_DIR, { recursive: true });
  const outDir = `${PUB_DIR}/cards/${runId}`;
  const cardPaths = await buildPostCards(post, outDir);

  const { caption, hashtags } = await generateCaption(post);
  const v = validateCaption(caption);
  if (!v.ok) throw new Error(`캡션 검증 실패: ${v.reason}`);

  const manifest = {
    runId,
    category: { id: category.id, name: category.name, tier: category.tier },
    products: products.map((p) => ({
      productId: p.productId,
      productName: p.productName,
      productPrice: p.productPrice,
      productUrl: p.productUrl,
    })),
    cardFiles: cardPaths.map((p) => basename(p)),
    cardPaths,
    caption,
    hashtags,
    deeplinks,
  };
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
  return manifest;
}

/** manifest 읽기 */
export function readManifest() {
  return JSON.parse(readFileSync(MANIFEST, 'utf8'));
}

/**
 * ⑤~⑥ : 매니페스트의 카드를 공개 URL 로 게시하고 로그 기록.
 * @param {object} manifest
 * @returns {Promise<{postId:string, permalink?:string}>}
 */
export async function publish(manifest) {
  const imageBase = requireEnv('IMAGE_BASE_URL').replace(/\/$/, '');
  const imageUrls = manifest.cardFiles.map(
    (f) => `${imageBase}/${manifest.runId}/${f}`
  );

  const result = await publishCarousel({
    imageUrls,
    caption: manifest.caption,
  });

  // 로그 기록 (tier 포함)
  appendPosted(manifest.products, manifest.category);

  return { postId: result.id, permalink: result.permalink };
}
