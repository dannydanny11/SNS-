// POC — 모션덱 릴스 vs 현재(정지 카드+켄번스) 릴스 비교 생성.
//
//   node scripts/poc-motion-reel.js            상품 0번으로 두 버전 모두 생성
//   node scripts/poc-motion-reel.js --i 3      풀의 3번 상품으로
//   node scripts/poc-motion-reel.js --stills   영상 없이 미리보기 스틸만 (디자인 확인용, 빠름)
//   node scripts/poc-motion-reel.js --motion   모션덱만
//   node scripts/poc-motion-reel.js --legacy   현재 버전만
//
// 결과: published/poc/<runId>/motion.mp4 · legacy.mp4 · deck.html · stills/
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import puppeteer from 'puppeteer';
import { buildMotionReel } from '../src/motion/renderMotionReel.js';
import { buildMotionDeckHtml } from '../src/motion/deck.js';
import { buildSingleReelCards } from '../src/cards/build.js';
import { closeBrowser } from '../src/cards/render.js';
import { buildReel } from '../src/reel.js';

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d) => {
  const i = argv.indexOf(f);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};

const idx = Number(val('--i', '0'));
const onlyStills = has('--stills');
const onlyMotion = has('--motion');
const onlyLegacy = has('--legacy');

const pool = JSON.parse(readFileSync('data/week-pool.json', 'utf8'));
const product = pool.products[idx];
if (!product) throw new Error(`week-pool.json 에 products[${idx}] 가 없습니다.`);

const benefits = (product.narration?.length ? product.narration : [product.copy]).slice(0, 4);
const rest = pool.products.filter((_, i) => i !== idx);
const others = rest.slice(0, 4);
const category = product.category?.name || '';
const hook = product.hook;

const runId = `p${idx}`;
const dir = `published/poc/${runId}`;
mkdirSync(dir, { recursive: true });

console.log(`상품: ${product.productName}`);
console.log(`훅  : ${hook}`);
console.log(`장점: ${benefits.length}개 → 씬 ${benefits.length + 2}개\n`);

const bgmPath = existsSync('assets/reel-bgm.mp3') ? 'assets/reel-bgm.mp3' : undefined;

/** 영상 없이 디자인만 빠르게 확인 — 씬별 대표 프레임 캡처 */
async function stills() {
  // 씬 길이를 TTS 없이 가정(디자인 확인용): 표지 2.6 / 장점 3.2 / CTA 4.4
  const durations = [2.6, ...benefits.map(() => 3.2), 4.4];
  const toDataUri = async (u) => {
    try {
      const r = await fetch(u);
      const b = Buffer.from(await r.arrayBuffer());
      return `data:${r.headers.get('content-type') || 'image/jpeg'};base64,${b.toString('base64')}`;
    } catch { return u; }
  };
  const [image, ...otherImages] = await Promise.all([
    toDataUri(product.productImage),
    ...others.map((p) => toDataUri(p.productImage)),
  ]);
  const html = buildMotionDeckHtml({ product, image, hook, category, benefits, otherImages, durations });
  writeFileSync(join(dir, 'deck.html'), html);

  const outDir = join(dir, 'stills');
  mkdirSync(outDir, { recursive: true });
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1920 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.images).map((i) =>
      i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; })));
  });

  // 씬마다: 등장 중(+0.45s) / 완성(끝-0.6s) 2장씩
  let acc = 0;
  let n = 0;
  for (let s = 0; s < durations.length; s++) {
    const start = acc;
    acc += durations[s];
    for (const [tag, t] of [['in', start + 0.45], ['full', acc - 0.6]]) {
      await page.evaluate((ms) => window.__seek(ms), t * 1000);
      const p = join(outDir, `${String(n++).padStart(2, '0')}-s${s}-${tag}.jpg`);
      await page.screenshot({ path: p, type: 'jpeg', quality: 92 });
      console.log('  ' + p);
    }
  }
  await browser.close();
  console.log(`\n스틸 ${n}장 저장 → ${outDir}`);
  console.log(`브라우저로 열어 실시간 확인: ${join(dir, 'deck.html')}`);
}

async function motion() {
  console.log('▶ 모션덱 렌더 시작…');
  const r = await buildMotionReel({
    product, hook, category, benefits, others,
    outPath: `${dir}/motion.mp4`,
    bgmPath,
    keepHtml: true, // 브라우저로 애니메이션 직접 확인용
  });
  console.log(`  길이 ${r.total.toFixed(1)}s / ${r.frames}프레임`);
  console.log(`  TTS ${(r.ms.tts / 1000).toFixed(1)}s · 이미지 ${(r.ms.images / 1000).toFixed(1)}s · ` +
              `캡처 ${(r.ms.capture / 1000).toFixed(1)}s · 인코딩 ${(r.ms.encode / 1000).toFixed(1)}s`);
  console.log(`  ⇒ 총 ${(r.ms.totalMs / 1000).toFixed(1)}s · ${r.outPath}\n`);
  return r;
}

async function legacy() {
  console.log('▶ 현재 버전 렌더 시작…');
  const t0 = Date.now();
  const cards = await buildSingleReelCards(`${dir}/legacy-cards`, {
    product, hook, category, benefits, others, buyHook: product.buyHook,
  });
  await closeBrowser();
  const narration = [
    hook.replace(/\s*\n\s*/g, ' '),
    ...benefits,
    '마음에 들면 프로필 링크에서 바로 구매하세요',
  ];
  const out = await buildReel(cards, { outPath: `${dir}/legacy.mp4`, bgmPath, narration });
  const ms = Date.now() - t0;
  console.log(`  ⇒ 총 ${(ms / 1000).toFixed(1)}s · ${out}\n`);
  return { ms };
}

if (onlyStills) {
  await stills();
} else {
  const m = onlyLegacy ? null : await motion();
  const l = onlyMotion ? null : await legacy();
  if (m && l) {
    console.log('─ 비교 ─────────────────────────────');
    console.log(`모션덱  : ${(m.ms.totalMs / 1000).toFixed(1)}s (${m.frames}프레임 캡처)`);
    console.log(`현재버전: ${(l.ms / 1000).toFixed(1)}s`);
    console.log(`배율    : ${(m.ms.totalMs / l.ms).toFixed(1)}배`);
    console.log(`\n두 mp4 를 나란히 보고 결정하세요:\n  ${dir}/motion.mp4\n  ${dir}/legacy.mp4`);
  }
}
