// 상품 1개 → 완성 쇼츠 1개 조립.
//   대본 → 슬라이드 렌더 → TTS → ffmpeg 영상 → meta.json / upload.txt 저장.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateShortsScript, DISCLOSURE_YT } from './script.js';
import { getTheme, buildHook, buildProduct, buildPoint, buildCta } from './slides.js';
import { renderSlides } from './renderSlides.js';
import { synthesize } from './tts.js';
import { buildVideo } from './renderVideo.js';
import { pickBgm } from './bgm.js';
import { optionalEnv } from '../config.js';

function slideToHtml(t, slide, product, category) {
  switch (slide.kind) {
    case 'hook':
      return buildHook(t, { category: category?.name || '', caption: slide.caption });
    case 'product':
      return buildProduct(t, { product, caption: slide.caption });
    case 'point':
      return buildPoint(t, { product, index: slide.index, caption: slide.caption });
    case 'cta':
      return buildCta(t, { caption: slide.caption, disclosure: DISCLOSURE_YT });
    default:
      return buildHook(t, { category: '', caption: slide.caption });
  }
}

function buildDescription(yt, deeplinkUrl) {
  return [
    yt.description || '',
    '',
    '▼ 구매 링크 (쿠팡)',
    deeplinkUrl || '',
    '',
    DISCLOSURE_YT,
    '',
    (yt.hashtags || []).join(' '),
  ].join('\n').trim();
}

/**
 * 쇼츠 1개 빌드.
 * @param {object} opts
 * @param {object} opts.product      쿠팡 상품
 * @param {object} opts.category
 * @param {string} opts.deeplinkUrl  파트너스 제휴 링크
 * @param {string} opts.outDir       이 쇼츠 전용 출력 폴더
 * @param {string} [opts.themeId]    슬라이드 테마(A/B/C, 기본 B)
 * @param {string} [opts.bgm]        BGM mp3 경로(선택)
 * @returns {Promise<{video:string, meta:object}>}
 */
export async function buildShort({ product, category, deeplinkUrl, outDir, themeId, bgm }) {
  mkdirSync(outDir, { recursive: true });
  const t = getTheme(themeId || optionalEnv('SHORTS_THEME') || 'B');

  // 1) 대본
  const script = await generateShortsScript(product, category);

  // 2) 슬라이드 HTML → PNG
  const htmls = script.slides.map((s) => slideToHtml(t, s, product, category));
  const framesDir = join(outDir, 'frames');
  const slidePaths = await renderSlides(htmls, framesDir);

  // 3) TTS
  const audioDir = join(outDir, 'audio');
  const audios = await synthesize(script.narration, audioDir);

  // 4) 클립 구성 → 영상
  const clips = script.slides.map((s, i) => ({
    image: slidePaths[i],
    audio: audios[i]?.file || null,
    duration: audios[i]?.duration || 0,
  }));
  const video = join(outDir, 'video.mp4');
  const chosenBgm = pickBgm(bgm); // 폴더면 랜덤 1곡, 파일이면 고정, 없으면 null
  const { duration } = await buildVideo({
    clips,
    outFile: video,
    tmpDir: join(outDir, 'tmp'),
    bgm: chosenBgm,
  });

  // 5) 업로드 메타 저장 (수동 업로드용)
  const description = buildDescription(script.yt, deeplinkUrl);
  const meta = {
    productId: product.productId,
    productName: product.productName,
    price: product.productPrice,
    category: category?.name,
    deeplinkUrl,
    scriptSource: script.source,
    bgm: chosenBgm ? chosenBgm.split(/[\\/]/).pop() : null,
    durationSec: duration,
    title: script.yt.title,
    description,
    hashtags: script.yt.hashtags,
    createdAt: new Date().toISOString(),
  };
  writeFileSync(join(outDir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n', 'utf8');
  writeFileSync(
    join(outDir, 'upload.txt'),
    `제목:\n${meta.title}\n\n설명:\n${description}\n`,
    'utf8'
  );

  return { video, meta };
}
