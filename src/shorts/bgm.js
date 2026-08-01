// BGM 선택 — 라이선스 보유 음원을 폴더에 넣어두면 영상마다 랜덤으로 한 곡 고른다.
//   · SHORTS_BGM 이 폴더면: 그 안의 mp3/m4a/wav 중 랜덤
//   · SHORTS_BGM 이 파일이면: 그 파일 고정
//   · 없거나 비어있으면: null (BGM 없이 진행)
//
// ⚠️ 저작권: 이 폴더에는 '본인이 라이선스를 보유한' 또는 '로열티프리' 음원만 넣을 것.
//    구독형(Artlist/Epidemic 등)은 해당 유튜브 채널을 반드시 화이트리스트 등록해야
//    Content ID 클레임이 자동 해제된다.
import { statSync, readdirSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { optionalEnv } from '../config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// 기본 폴더: 프로젝트/assets/bgm
const DEFAULT_DIR = join(__dirname, '..', '..', 'assets', 'bgm');

const AUDIO_EXT = new Set(['.mp3', '.m4a', '.wav', '.aac', '.ogg']);

function listAudio(dir) {
  try {
    return readdirSync(dir)
      .filter((f) => AUDIO_EXT.has(extname(f).toLowerCase()))
      .map((f) => join(dir, f));
  } catch {
    return [];
  }
}

/**
 * 사용할 BGM 경로 1개 반환(랜덤) 또는 null.
 * @param {string} [override] 강제 지정 경로(파일/폴더)
 */
export function pickBgm(override) {
  const target = override || optionalEnv('SHORTS_BGM') || DEFAULT_DIR;
  if (!target || !existsSync(target)) return null;

  let file = null;
  const st = statSync(target);
  if (st.isDirectory()) {
    const files = listAudio(target);
    if (files.length === 0) return null;
    file = files[Math.floor(Math.random() * files.length)];
  } else {
    file = target;
  }
  return file;
}

/** 폴더에 든 음원 개수(안내용) */
export function bgmCount(override) {
  const target = override || optionalEnv('SHORTS_BGM') || DEFAULT_DIR;
  if (!target || !existsSync(target)) return 0;
  return statSync(target).isDirectory() ? listAudio(target).length : 1;
}
