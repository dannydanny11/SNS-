// 쿠팡 파트너스 Open API 클라이언트 — HMAC-SHA256 서명 인증.
//
// 인증 규격 (쿠팡 파트너스 공식):
//   Authorization: CEA algorithm=HmacSHA256, access-key={ACCESS}, signed-date={DATE}, signature={SIG}
//   - signed-date : GMT 기준 yyMMdd'T'HHmmss'Z'  (예: 240101T120000Z)
//   - 서명 대상 message = signed-date + method + path + query(선행 '?' 제외)
//   - signature = HMAC-SHA256(secretKey, message) 의 hex 문자열
import crypto from 'node:crypto';
import { requireEnv } from '../config.js';

const HOST = 'https://api-gateway.coupang.com';
const API_PREFIX = '/v2/providers/affiliate_open_api/apis/openapi/v1';

/** GMT 기준 yyMMdd'T'HHmmss'Z' 형식의 signed-date 생성 */
function signedDate() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return (
    p(d.getUTCFullYear() % 100) +
    p(d.getUTCMonth() + 1) +
    p(d.getUTCDate()) +
    'T' +
    p(d.getUTCHours()) +
    p(d.getUTCMinutes()) +
    p(d.getUTCSeconds()) +
    'Z'
  );
}

/** Authorization 헤더 값 생성 */
function buildAuthorization(method, path, query, accessKey, secretKey) {
  const datetime = signedDate();
  const message = datetime + method + path + (query || '');
  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(message)
    .digest('hex');
  return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${signature}`;
}

/**
 * 파트너스 API 요청.
 * @param {'GET'|'POST'} method
 * @param {string} apiPath  API_PREFIX 이후 경로 (예: '/products/search')
 * @param {object} [opts]
 * @param {Record<string,string|number>} [opts.query]  쿼리 파라미터
 * @param {object} [opts.body]  POST 바디
 */
export async function coupangRequest(method, apiPath, opts = {}) {
  const accessKey = requireEnv('COUPANG_ACCESS_KEY');
  const secretKey = requireEnv('COUPANG_SECRET_KEY');

  const path = API_PREFIX + apiPath;

  // 쿼리 문자열 구성 (서명 대상과 실제 URL 이 반드시 동일해야 함)
  let queryString = '';
  if (opts.query && Object.keys(opts.query).length > 0) {
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null && v !== '') usp.append(k, String(v));
    }
    queryString = usp.toString();
  }

  const authorization = buildAuthorization(
    method,
    path,
    queryString,
    accessKey,
    secretKey
  );

  const url = HOST + path + (queryString ? '?' + queryString : '');

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: authorization,
      'Content-Type': 'application/json;charset=UTF-8',
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      `파트너스 API 응답 파싱 실패 (HTTP ${res.status}): ${text.slice(0, 300)}`
    );
  }

  if (!res.ok) {
    const msg = json?.message || json?.rMessage || text.slice(0, 300);
    throw new Error(`파트너스 API 오류 (HTTP ${res.status}): ${msg}`);
  }

  return json;
}
