// ffmpeg / ffprobe 실행 헬퍼.
//   - 실행 파일 경로 resolve: FFMPEG_PATH 환경변수 → PATH → winget 설치 경로 순.
//   - 오디오 길이 측정(ffprobe), 명령 실행 래퍼 제공.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { globSync } from 'node:fs';
import { optionalEnv } from '../config.js';

let _ffmpeg = null;
let _ffprobe = null;

function resolveBinary(name, envKey) {
  // 1) 환경변수 직접 지정
  const fromEnv = optionalEnv(envKey);
  if (fromEnv && existsSync(fromEnv)) return fromEnv;

  // 2) PATH 에 있으면 그냥 이름으로 실행 가능 (win 은 .exe)
  //    (여기서는 존재 확인이 어려우므로 winget 경로를 먼저 시도)
  // 3) winget 기본 설치 경로 탐색
  const home = process.env.USERPROFILE || process.env.HOME || '';
  const pattern = home.replace(/\\/g, '/') +
    `/AppData/Local/Microsoft/WinGet/Packages/*FFmpeg*/ffmpeg-*/bin/${name}.exe`;
  try {
    const hits = globSync(pattern);
    if (hits.length > 0) return hits.sort().reverse()[0];
  } catch {
    // globSync 미지원 Node — 무시하고 PATH 이름 fallback
  }
  // 4) PATH 이름 (win 은 .exe 자동 확장)
  return name;
}

export function ffmpegPath() {
  if (!_ffmpeg) _ffmpeg = resolveBinary('ffmpeg', 'FFMPEG_PATH');
  return _ffmpeg;
}

export function ffprobePath() {
  if (!_ffprobe) _ffprobe = resolveBinary('ffprobe', 'FFPROBE_PATH');
  return _ffprobe;
}

/** 자식 프로세스 실행 → {code, stdout, stderr} */
export function run(bin, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { windowsHide: true });
    let out = '';
    let err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('error', (e) => reject(new Error(`${bin} 실행 실패: ${e.message}`)));
    p.on('close', (code) => {
      if (code === 0) resolve({ code, stdout: out, stderr: err });
      else reject(new Error(`${bin} 종료코드 ${code}\n${err.slice(-1200)}`));
    });
  });
}

/** ffmpeg 실행 (자동 -y, 배너 최소화) */
export async function ffmpeg(args) {
  return run(ffmpegPath(), ['-hide_banner', '-loglevel', 'error', '-y', ...args]);
}

/** 오디오/비디오 길이(초) 측정 */
export async function probeDuration(file) {
  const { stdout } = await run(ffprobePath(), [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    file,
  ]);
  const d = parseFloat(String(stdout).trim());
  if (!Number.isFinite(d) || d <= 0) throw new Error(`길이 측정 실패: ${file}`);
  return d;
}

/** ffmpeg 사용 가능 여부 확인 (미설치 시 명확한 안내) */
export async function assertFfmpeg() {
  try {
    await run(ffmpegPath(), ['-version']);
  } catch (e) {
    throw new Error(
      'ffmpeg 를 찾을 수 없습니다. 설치했다면 새 터미널을 열거나 .env 에 ' +
        'FFMPEG_PATH=... 로 ffmpeg.exe 전체 경로를 지정하세요.\n원인: ' + e.message
    );
  }
}
