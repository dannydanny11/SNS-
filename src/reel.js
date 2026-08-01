// 카드 이미지(1080×1080) → 릴스용 세로 영상(1080×1920 mp4).
//   · 페이드/디졸브 없음 (첫 프레임부터 카드 노출, 검정화면 X)
//   · 내레이션(TTS, ko-KR) + 배경음(ducked) 믹스
//   · ffmpeg-static 번들 바이너리만 사용 (윈도우/리눅스 자동, 시스템 설치 불필요)
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { optionalEnv } from './config.js';

const execFileP = promisify(execFile);
const BG = '0xF5EDE1'; // 카드 여백 크림색
const FPS = 30;
const PAD_AFTER = 0.9; // 대사 뒤 여유(초)
const MIN_CARD = 2.2; // 카드 최소 노출(초)
const LEAD = 0.2; // 카드 뜨고 대사 시작까지(초)

async function ff(args) {
  await execFileP(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', ...args], {
    maxBuffer: 1024 * 1024 * 128,
  });
}

/** ffmpeg -i 로 미디어 길이(초) 측정 (ffprobe 불필요) */
async function mediaDuration(file) {
  try {
    await execFileP(ffmpegPath, ['-hide_banner', '-i', resolve(file)]);
  } catch (e) {
    const m = String(e.stderr || '').match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
    if (m) return +m[1] * 3600 + +m[2] * 60 + parseFloat(m[3]);
  }
  return 0;
}

/** 대사들을 TTS 합성 → [{file, duration}] (빈 대사는 file=null) */
async function narrate(lines, outDir) {
  mkdirSync(outDir, { recursive: true });
  const voice = optionalEnv('TTS_VOICE') || 'ko-KR-SunHiNeural';
  const rate = optionalEnv('TTS_RATE') || '+10%';
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
    out.push({ file: audioFilePath, duration: await mediaDuration(audioFilePath) });
  }
  return out;
}

/**
 * 릴스 영상 생성.
 * @param {string[]} cardPaths  카드 jpg 경로(순서대로)
 * @param {object} [opts]
 * @param {string} [opts.outPath]
 * @param {string} [opts.bgmPath]  배경음 mp3
 * @param {string[]} [opts.narration]  카드별 대사(없으면 무내레이션·고정 길이)
 * @returns {Promise<string>} mp4 경로
 */
export async function buildReel(cardPaths, opts = {}) {
  const outPath = opts.outPath || 'published/reels/reel.mp4';
  const outDir = resolve(outPath, '..');
  mkdirSync(outDir, { recursive: true });
  const tmp = join(outDir, '_work');
  mkdirSync(tmp, { recursive: true });

  // 1) 내레이션 합성 → 카드별 길이 결정
  let narr = [];
  if (Array.isArray(opts.narration) && opts.narration.length) {
    narr = await narrate(opts.narration, join(tmp, 'tts'));
  }
  const durations = cardPaths.map((_, i) => {
    const d = narr[i]?.duration || 0;
    return d > 0 ? Math.max(d + PAD_AFTER, MIN_CARD) : 2.6;
  });

  // 2) 카드별 세로 클립 (페이드 없음 → 검정화면 X)
  const clips = [];
  for (let i = 0; i < cardPaths.length; i++) {
    const clip = join(tmp, `c${i}.mp4`);
    const vf =
      `scale=1080:1080:force_original_aspect_ratio=decrease,` +
      `pad=1080:1080:(ow-iw)/2:(oh-ih)/2:color=${BG},` +
      `pad=1080:1920:0:420:color=${BG},setsar=1,format=yuv420p`;
    await ff([
      '-loop', '1', '-i', resolve(cardPaths[i]),
      '-t', durations[i].toFixed(2), '-r', String(FPS),
      '-vf', vf, '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
      clip,
    ]);
    clips.push(clip);
  }

  // 3) 클립 이어붙이기 (하드컷)
  const vlist = join(tmp, 'v.txt');
  writeFileSync(vlist, clips.map((c) => `file '${c.replace(/\\/g, '/')}'`).join('\n'));
  const silentVideo = join(tmp, 'video.mp4');
  await ff(['-f', 'concat', '-safe', '0', '-i', vlist, '-c', 'copy', silentVideo]);

  const total = durations.reduce((a, b) => a + b, 0);

  // 4) 내레이션 트랙: 카드별 (무음 L초 + 대사 LEAD 지점 삽입) → 이어붙임
  const segs = [];
  for (let i = 0; i < cardPaths.length; i++) {
    const seg = join(tmp, `a${i}.m4a`);
    const L = durations[i].toFixed(2);
    if (narr[i]?.file) {
      await ff([
        '-f', 'lavfi', '-t', L, '-i', 'anullsrc=r=44100:cl=stereo',
        '-i', resolve(narr[i].file),
        '-filter_complex',
        `[1:a]aresample=44100,adelay=${Math.round(LEAD * 1000)}|${Math.round(LEAD * 1000)}[d];` +
          `[0:a][d]amix=inputs=2:duration=first:normalize=0[a]`,
        '-map', '[a]', '-t', L, '-c:a', 'aac', seg,
      ]);
    } else {
      await ff(['-f', 'lavfi', '-t', L, '-i', 'anullsrc=r=44100:cl=stereo', '-c:a', 'aac', seg]);
    }
    segs.push(seg);
  }
  const alist = join(tmp, 'a.txt');
  writeFileSync(alist, segs.map((c) => `file '${c.replace(/\\/g, '/')}'`).join('\n'));
  const narration = join(tmp, 'narration.m4a');
  await ff(['-f', 'concat', '-safe', '0', '-i', alist, '-c', 'copy', narration]);

  // 5) 최종 오디오: 내레이션 + 배경음(ducked) 믹스
  const bgm = opts.bgmPath && existsSync(opts.bgmPath) ? opts.bgmPath : null;
  const finalAudio = join(tmp, 'final.m4a');
  if (bgm) {
    await ff([
      '-i', narration, '-stream_loop', '-1', '-i', resolve(bgm),
      '-filter_complex',
      `[1:a]volume=0.16[bg];` +
        `[0:a][bg]amix=inputs=2:duration=first:normalize=0,` +
        `afade=t=out:st=${(total - 1.2).toFixed(2)}:d=1.2[a]`,
      '-map', '[a]', '-t', total.toFixed(2), '-c:a', 'aac', '-b:a', '160k', finalAudio,
    ]);
  } else {
    await ff(['-i', narration, '-c:a', 'aac', finalAudio]);
  }

  // 6) 영상 + 오디오 합치기
  await ff([
    '-i', silentVideo, '-i', finalAudio,
    '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-shortest',
    outPath,
  ]);

  try {
    rmSync(tmp, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
  return outPath;
}
