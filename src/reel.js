// 카드 이미지(1080×1080) → 릴스용 세로 영상(1080×1920 mp4) 생성.
// ffmpeg-static 번들 바이너리 사용 (윈도우/리눅스 자동).
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import ffmpegPath from 'ffmpeg-static';

const run = promisify(execFile);

const BG = '0xF5EDE1'; // 카드 여백 크림색
const PER_CARD = 2.6; // 카드당 노출(초)
const FPS = 30;

async function ff(args) {
  await run(ffmpegPath, ['-hide_banner', '-loglevel', 'error', ...args], {
    maxBuffer: 1024 * 1024 * 64,
  });
}

/**
 * 카드들로 릴스 영상 생성.
 * @param {string[]} cardPaths  카드 jpg 경로(순서대로)
 * @param {object} [opts]
 * @param {string} [opts.outPath]  결과 mp4 경로
 * @param {string} [opts.bgmPath]  배경음 mp3 (없으면 무음 트랙)
 * @returns {Promise<string>} mp4 경로
 */
export async function buildReel(cardPaths, opts = {}) {
  const outPath = opts.outPath || 'published/reels/reel.mp4';
  const outDir = resolve(outPath, '..');
  mkdirSync(outDir, { recursive: true });
  const tmp = join(outDir, '_clips');
  mkdirSync(tmp, { recursive: true });

  // 1) 카드별 세로 클립 생성 (크림 여백 + 페이드)
  const clipList = [];
  for (let i = 0; i < cardPaths.length; i++) {
    const clip = join(tmp, `c${i}.mp4`);
    const vf =
      `scale=1080:1080:force_original_aspect_ratio=decrease,` +
      `pad=1080:1080:(ow-iw)/2:(oh-ih)/2:color=${BG},` +
      `pad=1080:1920:0:420:color=${BG},` +
      `fade=t=in:st=0:d=0.25,fade=t=out:st=${(PER_CARD - 0.25).toFixed(2)}:d=0.25,` +
      `setsar=1,format=yuv420p`;
    await ff([
      '-loop', '1', '-i', resolve(cardPaths[i]),
      '-t', String(PER_CARD), '-r', String(FPS),
      '-vf', vf, '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
      '-y', clip,
    ]);
    clipList.push(clip);
  }

  // 2) 클립 이어붙이기
  const listFile = join(tmp, 'list.txt');
  writeFileSync(
    listFile,
    clipList.map((c) => `file '${c.replace(/\\/g, '/')}'`).join('\n')
  );
  const silent = join(tmp, 'silent.mp4');
  await ff(['-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', '-y', silent]);

  // 3) 오디오 입히기 (배경음 or 무음)
  const total = PER_CARD * cardPaths.length;
  const bgm = opts.bgmPath && existsSync(opts.bgmPath) ? opts.bgmPath : null;
  if (bgm) {
    await ff([
      '-i', silent, '-stream_loop', '-1', '-i', resolve(bgm),
      '-map', '0:v', '-map', '1:a', '-shortest',
      '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k',
      '-af', `afade=t=out:st=${(total - 1).toFixed(2)}:d=1`,
      '-y', outPath,
    ]);
  } else {
    await ff([
      '-i', silent, '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
      '-map', '0:v', '-map', '1:a', '-shortest',
      '-c:v', 'copy', '-c:a', 'aac', '-y', outPath,
    ]);
  }

  // 임시 클립 정리
  try {
    rmSync(tmp, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
  return outPath;
}
