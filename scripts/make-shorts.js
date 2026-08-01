// 쇼츠 생성 오케스트레이터 (수동 업로드용 mp4 를 out/shorts/ 에 만든다).
//
// 사용법:
//   node scripts/make-shorts.js                 # 오늘의 카테고리에서 3개
//   node scripts/make-shorts.js "무선 마우스"    # 키워드로 검색해 1개
//   node scripts/make-shorts.js "무선 마우스" 2  # 키워드로 2개
//
// 결과: out/shorts/<날짜>-<상품ID>/video.mp4  +  meta.json  +  upload.txt
//   ⚠ 자동 업로드는 하지 않는다. video.mp4 를 확인하고 유튜브에 직접 올린다.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { selectProducts } from '../src/selectProducts.js';
import { searchProducts } from '../src/coupang/search.js';
import { createDeeplinks } from '../src/coupang/deeplink.js';
import { buildShort } from '../src/shorts/build.js';
import { closeBrowser } from '../src/shorts/renderSlides.js';
import { assertFfmpeg } from '../src/shorts/ffmpeg.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_ROOT = join(__dirname, '..', 'out', 'shorts');

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

async function pickProducts(keyword, count) {
  if (keyword) {
    // 쿠팡 검색 API 는 limit 이 크면(예: 20) 빈 결과를 주는 경우가 있어 10 으로 고정
    const results = await searchProducts(keyword, 10);
    const filtered = results.filter((p) => p.productImage && p.productPrice >= 5000);
    return { category: { name: keyword, tier: 'high' }, products: filtered.slice(0, count) };
  }
  return selectProducts({ count });
}

async function main() {
  const keyword = process.argv[2] && !/^\d+$/.test(process.argv[2]) ? process.argv[2] : null;
  const countArg = process.argv.find((a, i) => i >= 2 && /^\d+$/.test(a));
  const count = countArg ? Number(countArg) : keyword ? 1 : 3;

  console.log('■ ffmpeg 확인...');
  await assertFfmpeg();

  console.log(`■ 상품 선정 (${keyword ? `키워드="${keyword}"` : '오늘의 카테고리'}, ${count}개)`);
  const { category, products } = await pickProducts(keyword, count);
  if (products.length === 0) {
    console.error('선정된 상품이 없습니다. 키워드를 바꾸거나 파트너스 API 응답을 확인하세요.');
    process.exit(1);
  }
  console.log(`  → ${products.length}개 선정: ${products.map((p) => p.productId).join(', ')}`);

  // 제휴 딥링크 일괄 생성 → originalUrl 로 매핑
  console.log('■ 제휴 딥링크 생성...');
  const urls = products.map((p) => p.productUrl).filter(Boolean);
  let linkMap = new Map();
  try {
    const links = await createDeeplinks(urls);
    for (const l of links) linkMap.set(l.originalUrl, l.shortenUrl || l.landingUrl);
  } catch (e) {
    console.warn(`  (딥링크 생성 실패: ${e.message}) — 원본 URL 로 대체`);
  }

  const made = [];
  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const deeplinkUrl = linkMap.get(product.productUrl) || product.productUrl;
    const outDir = join(OUT_ROOT, `${stamp()}-${product.productId}`);
    console.log(`\n■ [${i + 1}/${products.length}] 쇼츠 제작: ${product.productName.split(',')[0].slice(0, 30)}`);
    try {
      const { video, meta } = await buildShort({ product, category, deeplinkUrl, outDir });
      console.log(`  ✔ ${video}  (${meta.durationSec}s, 대본:${meta.scriptSource})`);
      made.push({ video, outDir, title: meta.title });
    } catch (e) {
      console.error(`  [X] 실패: ${e.message}`);
    }
  }

  await closeBrowser();

  console.log(`\n===== 완료: ${made.length}/${products.length}개 =====`);
  for (const m of made) {
    console.log(`• ${m.title}`);
    console.log(`  ${m.video}`);
  }
  console.log('\n▶ 각 폴더의 video.mp4 를 확인하고 upload.txt 의 제목/설명으로 유튜브에 직접 업로드하세요.');
}

main().catch((e) => {
  console.error('\n오류:', e.message);
  closeBrowser().finally(() => process.exit(1));
});
