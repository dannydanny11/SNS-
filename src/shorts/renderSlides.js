// 슬라이드 HTML → 1080×1920 PNG (Puppeteer). 외부 상품 이미지 로딩 대기 포함.
import puppeteer from 'puppeteer';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const W = 1080;
const H = 1920;

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

async function renderOne(html) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
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
    return await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: W, height: H } });
  } finally {
    await page.close();
  }
}

/**
 * 슬라이드 HTML 배열을 PNG 파일로 저장.
 * @param {string[]} htmls
 * @param {string} outDir
 * @returns {Promise<string[]>} 저장된 PNG 경로 배열
 */
export async function renderSlides(htmls, outDir) {
  mkdirSync(outDir, { recursive: true });
  const paths = [];
  for (let i = 0; i < htmls.length; i++) {
    const buf = await renderOne(htmls[i]);
    const p = join(outDir, `slide-${String(i).padStart(2, '0')}.png`);
    writeFileSync(p, buf);
    paths.push(p);
  }
  return paths;
}
