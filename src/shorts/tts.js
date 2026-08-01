// 나레이션 TTS — msedge-tts (무료 Edge 신경망 음성).
//   기본 음성: ko-KR-SunHiNeural (여성). .env 의 TTS_VOICE 로 교체 가능.
//   각 대사를 mp3 파일로 저장하고 경로 + 길이(초)를 반환.
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { mkdirSync, existsSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { optionalEnv } from '../config.js';
import { probeDuration } from './ffmpeg.js';

const DEFAULT_VOICE = 'ko-KR-SunHiNeural';

/**
 * 여러 대사를 순서대로 TTS 합성.
 * @param {string[]} lines  각 슬라이드 나레이션
 * @param {string} outDir   mp3 저장 폴더
 * @returns {Promise<Array<{index:number, text:string, file:string, duration:number}>>}
 */
export async function synthesize(lines, outDir) {
  mkdirSync(outDir, { recursive: true });
  const voice = optionalEnv('TTS_VOICE') || DEFAULT_VOICE;

  const tts = new MsEdgeTTS();
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

  const results = [];
  for (let i = 0; i < lines.length; i++) {
    const text = String(lines[i] || '').trim();
    const target = join(outDir, `narr-${String(i).padStart(2, '0')}.mp3`);
    if (!text) {
      // 빈 대사는 건너뜀 (해당 슬라이드는 무음 처리)
      results.push({ index: i, text: '', file: null, duration: 0 });
      continue;
    }
    // toFile 은 디렉터리를 받아 임의 파일명으로 저장 → 원하는 이름으로 이동
    const { audioFilePath } = await tts.toFile(outDir, text);
    if (existsSync(target)) {
      // 이전 실행 잔여물 방지
    }
    renameSync(audioFilePath, target);
    const duration = await probeDuration(target);
    results.push({ index: i, text, file: target, duration });
  }
  return results;
}

/** 사용 가능한 한국어 음성 목록 (참고용) */
export const KOREAN_VOICES = [
  'ko-KR-SunHiNeural', // 여성, 밝고 또렷 (기본)
  'ko-KR-InJoonNeural', // 남성, 차분
  'ko-KR-HyunsuMultilingualNeural', // 남성, 멀티링구얼
];
