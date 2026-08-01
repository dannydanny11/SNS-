// 모듈 ⑥ 통지 — 실행 결과를 텔레그램으로 요약 전송(설정된 경우).
import { optionalEnv } from './config.js';

/**
 * 텔레그램으로 메시지 전송. 토큰 미설정 시 콘솔 출력만.
 * @param {string} message
 */
export async function notify(message) {
  const token = optionalEnv('TELEGRAM_BOT_TOKEN');
  const chatId = optionalEnv('TELEGRAM_CHAT_ID');

  console.log('\n[통지]\n' + message + '\n');

  if (!token || !chatId) return; // 미설정 시 콘솔만

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message }),
    });
  } catch (e) {
    console.warn('텔레그램 통지 실패:', e.message);
  }
}
