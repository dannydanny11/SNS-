// 환경변수 로딩.
// 로컬: .env 파일에서 읽음. GitHub Actions: Secrets 가 process.env 로 주입됨.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env');

// Node 20.6+ 는 process.loadEnvFile 지원. 로컬에 .env 가 있을 때만 로드.
if (existsSync(envPath) && typeof process.loadEnvFile === 'function') {
  process.loadEnvFile(envPath);
}

/** 필수 환경변수를 읽되, 없으면 명확한 에러를 던진다. */
export function requireEnv(name) {
  const v = process.env[name];
  if (!v || v.trim() === '') {
    throw new Error(
      `환경변수 ${name} 가(이) 설정되지 않았습니다. .env 파일(로컬) 또는 GitHub Secrets 를 확인하세요.`
    );
  }
  return v.trim();
}

/** 선택 환경변수. 없으면 undefined. */
export function optionalEnv(name) {
  const v = process.env[name];
  return v && v.trim() !== '' ? v.trim() : undefined;
}
