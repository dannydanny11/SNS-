// 모션덱 릴스 렌더러 (POC) — 애니메이션 HTML → 프레임 캡처 → mp4.
//
// 기존 src/reel.js 는 라이브 파이프라인이 매일 쓰고 있으므로 건드리지 않는다.
// 채택이 확정되면 그때 TTS/오디오 믹스 부분을 공통 모듈로 뽑아낸다.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFileSync, mkdirSync, existsSync, rmSync, renameSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { cpus } from 'node:os';
import ffmpegPath from 'ffmpeg-static';
import puppeteer from 'puppeteer';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { optionalEnv } from '../config.js';
import { buildMotionDeckHtml } from './deck.js';

const execFileP = promisify(execFile);

const FPS = 30;
// 문장 사이 텀 최소화. Edge TTS 는 음성 앞뒤에 무음을 0.2~0.4초씩 붙여서 내보내는데,
// 그게 "한 문장 끝나고 다음 문장까지 비는" 체감의 주원인이었다.
// → trimSilence 로 앞뒤 무음을 잘라낸 뒤 PAD/LEAD 를 거의 0으로 둔다.
const PAD_AFTER = 0.06; // 대사 뒤 여유(초)
const MIN_SCENE = 1.0;  // 씬 최소 노출(초)
const LEAD = 0;         // 씬 시작 → 대사 시작 간격(초)
const COVER_MIN = 1.6; // 표지 최소 노출 — 훅을 읽을 시간(발화가 짧아도 확보)
const CTA_MAX = 4.2;   // 마지막 CTA 화면 상한 — 여기가 길어지면 그대로 이탈 구간이 된다
const MIN_TOTAL = 20;
const MAX_TOTAL = 26;

async function ff(args) {
  await execFileP(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', ...args], {
    maxBuffer: 1024 * 1024 * 128,
  });
}

async function mediaDuration(file) {
  try {
    await execFileP(ffmpegPath, ['-hide_banner', '-i', resolve(file)]);
  } catch (e) {
    const m = String(e.stderr || '').match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
    if (m) return +m[1] * 3600 + +m[2] * 60 + parseFloat(m[3]);
  }
  return 0;
}

/** 음성 파일 앞뒤의 무음 제거 (뒤쪽은 뒤집어서 같은 필터를 한 번 더 태우는 정석 레시피) */
async function trimSilence(file) {
  const trimmed = file.replace(/\.mp3$/, '-trim.mp3');
  const f = 'silenceremove=start_periods=1:start_duration=0:start_threshold=-45dB:detection=peak';
  try {
    await ff(['-i', resolve(file), '-af', `${f},areverse,${f},areverse`, '-c:a', 'libmp3lame', '-q:a', '3', trimmed]);
    const d = await mediaDuration(trimmed);
    if (d > 0.2) return { file: trimmed, duration: d };
  } catch { /* 실패하면 원본 사용 */ }
  return { file, duration: await mediaDuration(file) };
}

async function narrate(lines, outDir) {
  mkdirSync(outDir, { recursive: true });
  const voice = optionalEnv('TTS_VOICE') || 'ko-KR-SunHiNeural';
  const rate = optionalEnv('TTS_RATE') || '+30%';
  const tts = new MsEdgeTTS();
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const text = String(lines[i] || '').trim();
    if (!text) {
      out.push({ file: null, duration: 0 });
      continue;
    }
    const { audioFilePath } = await tts.toFile(outDir, text, { rate });
    const target = join(outDir, `narr-${String(i).padStart(2, '0')}.mp3`);
    renameSync(audioFilePath, target);
    out.push(await trimSilence(target));
  }
  return out;
}

/** 외부 이미지 URL → data URI (프레임 600장을 그릴 동안 네트워크 재요청 방지) */
async function toDataUri(url) {
  if (!url || url.startsWith('data:')) return url || '';
  try {
    const r = await fetch(url);
    if (!r.ok) return url;
    const buf = Buffer.from(await r.arrayBuffer());
    const ct = r.headers.get('content-type') || 'image/jpeg';
    return `data:${ct};base64,${buf.toString('base64')}`;
  } catch {
    return url;
  }
}

/** 내레이션 길이 → 씬별 길이 */
function sceneDurations(narr, n) {
  const d = Array.from({ length: n }, (_, i) => {
    const s = narr[i]?.duration || 0;
    return s > 0 ? Math.max(s + PAD_AFTER, MIN_SCENE) : 1.8;
  });
  const last = d.length - 1;
  d[0] = Math.max(d[0], COVER_MIN);
  const sum = d.reduce((a, b) => a + b, 0);
  if (sum > MAX_TOTAL) {
    const scale = MAX_TOTAL / sum;
    for (let i = 0; i < d.length; i++) {
      d[i] = Math.max(d[i] * scale, (narr[i]?.duration || 0) + 0.1);
    }
  } else if (sum < MIN_TOTAL && last >= 0) {
    // 부족분은 마지막 CTA 씬에만 — 단 CTA_MAX 까지. 못 채우면 영상이 짧아지는 쪽을 택한다.
    // (무음 텀을 제거한 뒤로는 20초를 채우려면 CTA가 7~8초가 되는데, 그건 그대로 이탈 구간)
    d[last] = Math.min(d[last] + (MIN_TOTAL - sum), CTA_MAX);
  }
  return d;
}

/**
 * 모션덱 릴스 생성.
 * @param {object} o
 * @param {object} o.product
 * @param {string} o.hook
 * @param {string} o.category
 * @param {string[]} o.benefits
 * @param {Array} o.others           CTA 미니모음용 다른 상품들
 * @param {string} o.outPath
 * @param {string} [o.bgmPath]
 * @param {boolean} [o.keepFrames]
 * @returns {Promise<{outPath:string, total:number, frames:number, ms:object, htmlPath:string}>}
 */
export async function buildMotionReel(o) {
  const t0 = Date.now();
  const { product, hook, category = '', benefits = [], others = [], outPath } = o;
  const outDir = resolve(outPath, '..');
  mkdirSync(outDir, { recursive: true });
  const tmp = join(outDir, '_work');
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });

  // 내레이션: 표지=훅 → 장점마다 1문장 → 마지막=구매 유도(CTA 는 여기 한 곳만)
  const narration = [
    String(hook).replace(/\s*\n\s*/g, ' '),
    ...benefits,
    o.ctaLine || '마음에 들면 프로필 링크에서 바로 구매하세요',
  ];
  const narr = await narrate(narration, join(tmp, 'tts'));
  const tTts = Date.now();

  const durations = sceneDurations(narr, narration.length);
  const total = durations.reduce((a, b) => a + b, 0);

  // 이미지 인라인화
  const [image, ...otherImages] = await Promise.all([
    toDataUri(product.productImage),
    ...others.slice(0, 4).map((p) => toDataUri(p.productImage)),
  ]);
  const tImg = Date.now();

  const html = buildMotionDeckHtml({
    product, image, hook, category, benefits, otherImages, durations, buyHook: o.buyHook,
  });
  const htmlPath = join(outDir, 'deck.html');
  writeFileSync(htmlPath, html);

  // ── 프레임 캡처 ────────────────────────────────────────────────
  const framesDir = join(tmp, 'frames');
  mkdirSync(framesDir, { recursive: true });
  const frameCount = Math.max(1, Math.round(total * FPS));

  // seek(ms) 가 완전히 결정론적이므로 프레임을 나눠 병렬 캡처해도 결과가 동일하다
  // (워커 k 는 k, k+N, k+2N… 담당). 캡처가 전체 시간의 90% 이상이라 효과가 크다.
  // 탭을 여러 개 여는 방식은 안 된다 — 헤드리스 크롬은 활성 탭만 합성하므로
  // 백그라운드 탭의 Page.captureScreenshot 이 타임아웃난다. 그래서 브라우저를 N개 띄운다.
  const conc = Math.max(1, Math.min(o.concurrency || cpus().length - 1, 6));
  const workers = [];
  for (let k = 0; k < conc; k++) {
    const browser = await puppeteer.launch({
      headless: 'new',
      protocolTimeout: 180000,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        Array.from(document.images).map((img) =>
          img.complete ? null : new Promise((res) => { img.onload = img.onerror = res; })
        )
      );
    });
    workers.push({ browser, page });
  }
  try {
    await Promise.all(
      workers.map(async ({ page }, k) => {
        for (let f = k; f < frameCount; f += conc) {
          await page.evaluate((t) => window.__seek(t), (f / FPS) * 1000);
          await page.screenshot({
            path: join(framesDir, `f${String(f).padStart(5, '0')}.jpg`),
            type: 'jpeg',
            quality: 92,
            optimizeForSpeed: true,
            captureBeyondViewport: false,
          });
        }
      })
    );
  } finally {
    await Promise.all(workers.map((w) => w.browser.close().catch(() => {})));
  }
  const tCap = Date.now();

  // ── 인코딩 ────────────────────────────────────────────────────
  const silentVideo = join(tmp, 'video.mp4');
  await ff([
    '-framerate', String(FPS),
    '-i', join(framesDir, 'f%05d.jpg'),
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
    '-pix_fmt', 'yuv420p', '-r', String(FPS),
    silentVideo,
  ]);

  // ── 오디오 (기존 reel.js 와 동일한 배치/믹스) ──────────────────
  const starts = [];
  let acc = 0;
  for (let i = 0; i < durations.length; i++) {
    starts.push(acc + LEAD);
    acc += durations[i];
  }
  const bgm = o.bgmPath && existsSync(o.bgmPath) ? o.bgmPath : null;
  const finalAudio = join(tmp, 'final.m4a');

  const inputs = [];
  const parts = [];
  const mixLabels = [];
  let inIdx = 0;
  for (let i = 0; i < narration.length; i++) {
    if (!narr[i]?.file) continue;
    inputs.push('-i', resolve(narr[i].file));
    const ms = Math.round(starts[i] * 1000);
    parts.push(`[${inIdx}:a]aresample=44100,aformat=channel_layouts=stereo,adelay=${ms}:all=1[n${inIdx}]`);
    mixLabels.push(`[n${inIdx}]`);
    inIdx++;
  }

  let fc;
  const args = [];
  if (mixLabels.length === 0) {
    args.push('-f', 'lavfi', '-t', total.toFixed(2), '-i', 'anullsrc=r=44100:cl=stereo');
    fc = `[0:a]anull[spoken]`;
  } else {
    args.push(...inputs);
    fc = parts.join(';') + ';';
    fc += mixLabels.length > 1
      ? `${mixLabels.join('')}amix=inputs=${mixLabels.length}:duration=longest:normalize=0[sp0];`
      : `${mixLabels[0]}anull[sp0];`;
    fc += `[sp0]apad=whole_dur=${total.toFixed(2)}[spoken]`;
  }
  if (bgm) {
    args.push('-stream_loop', '-1', '-i', resolve(bgm));
    const bgmIdx = mixLabels.length === 0 ? 1 : inIdx;
    fc += `;[${bgmIdx}:a]volume=0.16,aresample=44100,aformat=channel_layouts=stereo[bg];` +
          `[spoken][bg]amix=inputs=2:duration=first:normalize=0,` +
          `afade=t=out:st=${(total - 1.2).toFixed(2)}:d=1.2[out]`;
  } else {
    fc += `;[spoken]afade=t=out:st=${(total - 1.0).toFixed(2)}:d=1.0[out]`;
  }
  args.push('-filter_complex', fc, '-map', '[out]', '-t', total.toFixed(2), '-c:a', 'aac', '-b:a', '160k', finalAudio);
  await ff(args);

  await ff([
    '-i', silentVideo, '-i', finalAudio,
    '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-shortest',
    outPath,
  ]);
  const tEnd = Date.now();

  if (!o.keepFrames) {
    try { rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ }
  }

  return {
    outPath,
    htmlPath,
    total,
    frames: frameCount,
    durations,
    ms: {
      tts: tTts - t0,
      images: tImg - tTts,
      capture: tCap - tImg,
      encode: tEnd - tCap,
      totalMs: tEnd - t0,
    },
  };
}
