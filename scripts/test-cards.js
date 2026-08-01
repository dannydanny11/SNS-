// 모듈 ③ 시안 테스트: 실제 선정 상품으로 3가지 디자인의 카드를 렌더링하고
// 한 장의 비교 이미지(out/시안비교.png)를 만든다.
//   실행:  npm run test:cards
import { selectProducts } from '../src/selectProducts.js';
import { THEMES } from '../src/cards/theme.js';
import { buildCover, buildProduct, buildCta } from '../src/cards/templates.js';
import { renderCard, closeBrowser } from '../src/cards/render.js';
import { mkdirSync, writeFileSync } from 'node:fs';

const HEADLINES = {
  desk: '책상 위가\n바뀌는 템',
  home: '자취방\n필수 가전',
  it: '없으면\n불편한 IT템',
  value: '이 가격에\n이 퀄리티',
};

async function main() {
  console.log('\n[1/3] 상품 선정...');
  const { category, products } = await selectProducts();
  if (products.length < 3) throw new Error('샘플 상품이 부족합니다.');
  console.log(`  카테고리: ${category.name}, 상품 ${products.length}개`);

  const headline = HEADLINES[category.id] || category.name;
  const outDir = 'out';
  mkdirSync(outDir, { recursive: true });

  // 각 시안별로 표지·제품·CTA 렌더링
  const designs = {};
  for (const key of ['A', 'B', 'C']) {
    const theme = THEMES[key];
    console.log(`[2/3] 시안 ${key} (${theme.label}) 렌더링...`);
    const cover = await renderCard(
      buildCover(theme, { headline, category: category.name, total: products.length })
    );
    const prod = await renderCard(
      buildProduct(theme, { index: 1, total: products.length, product: products[0] })
    );
    const cta = await renderCard(buildCta(theme, { category: category.name }));

    // 개별 파일 저장 (실제 출력 검증)
    const dir = `${outDir}/design-${key}`;
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/1-cover.png`, cover);
    writeFileSync(`${dir}/2-product.png`, prod);
    writeFileSync(`${dir}/3-cta.png`, cta);

    designs[key] = { theme, cover, prod, cta };
  }

  // 비교 시트 HTML 구성 (각 시안 = 한 행, 카드 3장 썸네일)
  console.log('[3/3] 비교 이미지 합성...');
  const row = (key) => {
    const d = designs[key];
    return `<div class="row">
      <div class="tag">시안 ${key}<br><span>${d.theme.label}</span></div>
      <img src="design-${key}/1-cover.png"><img src="design-${key}/2-product.png"><img src="design-${key}/3-cta.png">
    </div>`;
  };
  const sheet = `<!doctype html><html><head><meta charset="utf-8"><style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:#e9e9e9;font-family:'Noto Sans KR','Malgun Gothic',sans-serif;padding:40px}
    .row{display:flex;align-items:center;gap:24px;margin-bottom:40px}
    .tag{width:200px;font-size:34px;font-weight:900;color:#222;text-align:center}
    .tag span{font-size:26px;font-weight:600;color:#777}
    img{width:300px;height:300px;border-radius:16px;box-shadow:0 8px 24px rgba(0,0,0,.15)}
  </style></head><body>${row('A')}${row('B')}${row('C')}</body></html>`;
  writeFileSync(`${outDir}/sheet.html`, sheet);

  // 디스크 PNG 를 상대경로로 참조하므로 file:// 로 로드
  const puppeteer = (await import('puppeteer')).default;
  const { pathToFileURL } = await import('node:url');
  const { resolve } = await import('node:path');
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1180, height: 1100 });
  await page.goto(pathToFileURL(resolve(`${outDir}/sheet.html`)).href, {
    waitUntil: 'networkidle0',
  });
  const buf = await page.screenshot({ type: 'png', fullPage: true });
  writeFileSync(`${outDir}/시안비교.png`, buf);
  await browser.close();
  await closeBrowser();

  console.log('\n✅ 완료. out/시안비교.png 및 out/design-A|B|C/ 확인.\n');
}

main().catch(async (err) => {
  await closeBrowser();
  console.error('\n❌ 실패:', err.message, '\n');
  process.exitCode = 1;
});
