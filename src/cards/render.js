// HTML → 1080×1080 PNG 렌더링 (Puppeteer).
import puppeteer from 'puppeteer';
import { writeFileSync, mkdirSync } from 'node:fs';

const SIZE = 1080;

let _browser = null;
async function getBrowser() {
  if (!_browser) {
    _browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
  return _browser;
}

export async function closeBrowser() {
  if (_browser) {
    await _browser.close();
    _browser = null;
  }
}

/**
 * HTML 한 장을 PNG 버퍼로 렌더링.
 * @param {string} html
 * @returns {Promise<Buffer>}
 */
export async function renderCard(html) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: SIZE, height: SIZE, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    // 이미지 로딩 대기 (상품 이미지가 외부 URL)
    await page.evaluate(async () => {
      const imgs = Array.from(document.images);
      await Promise.all(
        imgs.map((img) =>
          img.complete
            ? Promise.resolve()
            : new Promise((res) => {
                img.onload = img.onerror = res;
              })
        )
      );
    });
    return await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: SIZE, height: SIZE } });
  } finally {
    await page.close();
  }
}

/** HTML 여러 장을 파일로 저장 */
export async function renderToFiles(items, outDir) {
  mkdirSync(outDir, { recursive: true });
  const paths = [];
  for (const { html, filename } of items) {
    const buf = await renderCard(html);
    const path = `${outDir}/${filename}`;
    writeFileSync(path, buf);
    paths.push(path);
  }
  return paths;
}
