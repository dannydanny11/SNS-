// 파이프라인 코어 — generate(카드+캡션 생성) 와 publish(게시) 를 분리.
// 게시는 카드 이미지를 먼저 공개 URL 로 올린 뒤 진행해야 하므로 2단계로 나눈다.
import { selectProducts } from './selectProducts.js';
import { createDeeplinks } from './coupang/deeplink.js';
import { buildPostCards, buildReelCards } from './cards/build.js';
import { generateCaption } from './caption.js';
import { validateCaption } from './validateCaption.js';
import { publishCarousel } from './instagram.js';
import { buildLinkPage } from './linkPage.js';
import { buildReel } from './reel.js';
import { publishReel } from './instagram.js';
import { addEntry } from './archive.js';
import { existsSync } from 'node:fs';
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

  // ④ 캡션 + 제품별 한 줄 카피 + 표지 훅 먼저 생성 (카드에 넣어야 하므로 렌더보다 앞)
  const { caption, hashtags, copies, headline } = await generateCaption(post);
  const v = validateCaption(caption);
  if (!v.ok) throw new Error(`캡션 검증 실패: ${v.reason}`);
  products.forEach((p, i) => {
    p.copy = copies[i] || '';
  });

  // ② 제휴 딥링크 — 카드에 보이는 "정확한 옵션(itemId/vendorItemId)"까지 링크에 담아야
  //    링크 눌렀을 때 같은 이미지/옵션이 나온다. productUrl 에서 옵션 파라미터를 추출해 사용.
  let deeplinks = [];
  try {
    const rawUrls = products.map((p) => {
      try {
        const u = new URL(p.productUrl);
        const pk = u.searchParams.get('pageKey') || p.productId;
        const it = u.searchParams.get('itemId');
        const vi = u.searchParams.get('vendorItemId');
        return it && vi
          ? `https://www.coupang.com/vp/products/${pk}?itemId=${it}&vendorItemId=${vi}`
          : `https://www.coupang.com/vp/products/${pk}`;
      } catch {
        return `https://www.coupang.com/vp/products/${p.productId}`;
      }
    });
    deeplinks = await createDeeplinks(rawUrls);
  } catch {
    /* 실패해도 productUrl(제휴태그 포함)로 대체 */
  }

  // 상품별 링크 항목 (링크페이지·아카이브·통지 공용)
  const links = products.map((p, i) => ({
    name: p.productName.split(',')[0].trim(),
    price: p.productPrice,
    image: p.productImage,
    copy: p.copy,
    url: deeplinks[i]?.shortenUrl || p.productUrl,
  }));

  // ③ 카드 렌더 (카피 포함)
  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  mkdirSync(PUB_DIR, { recursive: true });
  const outDir = `${PUB_DIR}/cards/${runId}`;
  const cardPaths = await buildPostCards(post, outDir, { headline });

  // 릴스 영상 생성 — 세로 전용 9:16 카드 렌더 → mp4. 내레이션 + 배경음.
  const reelPath = `${PUB_DIR}/reels/${runId}/reel.mp4`;
  const reelCardPaths = await buildReelCards(post, `${PUB_DIR}/reels/${runId}/cards`, {
    headline,
  });
  const bgmPath = 'assets/reel-bgm.mp3';
  const narration = [
    `오늘은 ${category.name}, ${products.length}가지 골라봤어요`,
    ...products.map(
      (p) => `${p.copy}. ${p.productPrice?.toLocaleString('ko-KR')}원이에요`
    ),
    `마음에 들면 프로필 링크에서 확인하세요`,
  ];
  await buildReel(reelCardPaths, {
    outPath: reelPath,
    bgmPath: existsSync(bgmPath) ? bgmPath : undefined,
    narration,
  });

  const manifest = {
    runId,
    reelFile: `${runId}/reel.mp4`,
    category: { id: category.id, name: category.name, tier: category.tier },
    products: products.map((p) => ({
      productId: p.productId,
      productName: p.productName,
      productPrice: p.productPrice,
      productUrl: p.productUrl,
      productImage: p.productImage,
      copy: p.copy,
    })),
    cardFiles: cardPaths.map((p) => basename(p)),
    cardPaths,
    caption,
    hashtags,
    deeplinks,
    links,
  };
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));

  // 프로필 링크 목록 (복사용 md)
  const linksMd =
    `# ${category.name} — 오늘의 제휴 링크\n\n` +
    links
      .map((l) => `- ${l.name} (${l.price?.toLocaleString('ko-KR')}원)\n  ${l.url}`)
      .join('\n') +
    '\n';
  writeFileSync(`${PUB_DIR}/latest-links.md`, linksMd);

  // 아카이브 갱신(과거 상품도 구매 가능) + 링크 페이지(docs/index.html) 재생성
  const date = runId.slice(0, 10); // YYYY-MM-DD
  const archive = addEntry({ runId, date, category: category.name, products: links });
  buildLinkPage(archive);

  return manifest;
}

/** manifest 읽기 */
export function readManifest() {
  return JSON.parse(readFileSync(MANIFEST, 'utf8'));
}

/** 공개 URL 이 실제로 접근 가능(200, 이미지/영상)해질 때까지 대기 (CDN 전파) */
async function waitForUrl(url, { tries = 30, intervalMs = 6000 } = {}) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { method: 'GET' });
      const ct = r.headers.get('content-type') || '';
      if (r.status === 200 && (ct.includes('image') || ct.includes('video') || ct.includes('octet-stream'))) {
        return;
      }
    } catch {
      /* 네트워크 일시 오류 무시 */
    }
    await new Promise((res) => setTimeout(res, intervalMs));
  }
  throw new Error(`미디어 URL 접근 대기 초과: ${url}`);
}

/**
 * ⑤~⑥ : 매니페스트의 카드를 공개 URL 로 게시하고 로그 기록.
 * @param {object} manifest
 * @returns {Promise<{postId:string, permalink?:string}>}
 */
export async function publish(manifest) {
  const imageBase = requireEnv('IMAGE_BASE_URL').replace(/\/$/, '');
  // 영상 베이스: .../published/cards → .../published
  const pubBase = imageBase.replace(/\/cards$/, '');
  const format = (process.env.POST_FORMAT || 'carousel').toLowerCase(); // carousel | reel | both

  const out = {};

  if (format === 'carousel' || format === 'both') {
    const imageUrls = manifest.cardFiles.map(
      (f) => `${imageBase}/${manifest.runId}/${f}`
    );
    await waitForUrl(imageUrls[0]); // CDN 전파 대기
    const r = await publishCarousel({ imageUrls, caption: manifest.caption });
    out.carousel = { postId: r.id, permalink: r.permalink };
  }

  if (format === 'reel' || format === 'both') {
    const videoUrl = `${pubBase}/reels/${manifest.reelFile}`;
    await waitForUrl(videoUrl); // CDN 전파 대기
    const r = await publishReel({ videoUrl, caption: manifest.caption });
    out.reel = { postId: r.id, permalink: r.permalink };
  }

  // 로그 기록 (tier 포함)
  appendPosted(manifest.products, manifest.category);

  return out;
}
