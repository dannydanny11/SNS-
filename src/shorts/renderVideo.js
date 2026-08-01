// 슬라이드 PNG + 나레이션 mp3 → 쇼츠 mp4 조립 (ffmpeg).
//   1) 슬라이드마다 클립(mp4) 생성: 이미지 정지화면 + 음성, 길이 = 음성+여백.
//      (모든 클립을 동일 코덱/파라미터로 맞춰 concat -c copy 가능)
//   2) concat 데모서로 이어붙임
//   3) BGM 파일이 있으면 낮은 볼륨으로 믹스
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ffmpeg } from './ffmpeg.js';

const PAD = 0.5; // 나레이션 뒤 여백(초)
const SILENT_DEFAULT = 2.6; // 나레이션 없는 슬라이드 기본 길이

function fwd(p) {
  return p.replace(/\\/g, '/');
}

/**
 * 슬라이드 1장 → 클립 mp4.
 * @param {{image:string, audio:string|null, duration:number, fadeIn:boolean, fadeOut:boolean}} c
 * @param {string} outFile
 */
async function buildClip(c, outFile) {
  const dur = (c.audio ? c.duration + PAD : c.duration || SILENT_DEFAULT);
  const T = Math.max(1.2, Number(dur.toFixed(3)));

  // 비디오 필터 체인
  let vf = `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,format=yuv420p,fps=30`;
  if (c.fadeIn) vf += `,fade=t=in:st=0:d=0.3`;
  if (c.fadeOut) vf += `,fade=t=out:st=${(T - 0.4).toFixed(3)}:d=0.4`;
  vf += `[v]`;

  const args = ['-loop', '1', '-i', c.image];
  if (c.audio) {
    args.push('-i', c.audio);
    const af = `[1:a]aresample=44100,aformat=channel_layouts=stereo,apad,atrim=0:${T}[a]`;
    args.push('-filter_complex', `${vf};${af}`, '-map', '[v]', '-map', '[a]');
  } else {
    args.push('-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo');
    args.push('-filter_complex', vf, '-map', '[v]', '-map', '1:a');
  }
  args.push(
    '-c:v', 'libx264', '-preset', 'veryfast', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-r', '30', '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '2',
    '-t', String(T), '-movflags', '+faststart', outFile
  );
  await ffmpeg(args);
  return { file: outFile, duration: T };
}

/**
 * 전체 쇼츠 조립.
 * @param {object} opts
 * @param {Array<{image:string, audio:string|null, duration:number}>} opts.clips
 * @param {string} opts.outFile  최종 mp4 경로
 * @param {string} opts.tmpDir   중간 클립 폴더
 * @param {string} [opts.bgm]    BGM mp3 경로(선택)
 * @returns {Promise<{outFile:string, duration:number}>}
 */
export async function buildVideo({ clips, outFile, tmpDir, bgm }) {
  mkdirSync(tmpDir, { recursive: true });

  // 1) 클립 생성
  const clipFiles = [];
  let total = 0;
  for (let i = 0; i < clips.length; i++) {
    const c = {
      ...clips[i],
      fadeIn: i === 0,
      fadeOut: i === clips.length - 1,
    };
    const out = join(tmpDir, `clip-${String(i).padStart(2, '0')}.mp4`);
    const r = await buildClip(c, out);
    clipFiles.push(r.file);
    total += r.duration;
  }

  // 2) concat
  const listPath = join(tmpDir, 'concat.txt');
  writeFileSync(listPath, clipFiles.map((f) => `file '${fwd(f)}'`).join('\n') + '\n', 'utf8');
  const base = bgm && existsSync(bgm) ? join(tmpDir, 'base.mp4') : outFile;
  await ffmpeg(['-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', base]);

  // 3) BGM 믹스(있을 때만)
  if (bgm && existsSync(bgm)) {
    await ffmpeg([
      '-i', base,
      '-stream_loop', '-1', '-i', bgm,
      '-filter_complex',
      '[1:a]volume=0.10,aresample=44100[bg];[0:a][bg]amix=inputs=2:duration=first:dropout_transition=3[a]',
      '-map', '0:v', '-map', '[a]',
      '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-shortest',
      '-movflags', '+faststart', outFile,
    ]);
  }

  return { outFile, duration: Number(total.toFixed(2)) };
}
