// 모듈 ② 통합 테스트: 상품 검색 → 딥링크 생성이 실제로 동작하는지 확인.
//
// 실행:  npm run test:coupang
//        npm run test:coupang -- "무선 키보드"   (키워드 지정)
//
// COUPANG_ACCESS_KEY / COUPANG_SECRET_KEY 가 .env 에 있어야 합니다.
import { searchProducts } from '../src/coupang/search.js';
import { createDeeplinks } from '../src/coupang/deeplink.js';

const keyword = process.argv[2] || '무선 마우스';

function won(n) {
  return typeof n === 'number' ? n.toLocaleString('ko-KR') + '원' : n;
}

async function main() {
  console.log(`\n[1/2] 상품 검색:  "${keyword}"`);
  const products = await searchProducts(keyword, 5);

  if (products.length === 0) {
    console.log('  ⚠ 검색 결과가 없습니다. 키워드를 바꿔 다시 시도하세요.');
    return;
  }

  products.forEach((p, i) => {
    console.log(
      `  ${i + 1}. ${p.productName}\n     가격 ${won(p.productPrice)} | 로켓 ${p.isRocket ? 'O' : 'X'} | ID ${p.productId}`
    );
  });

  // 검색 결과에는 이미 제휴 URL(productUrl)이 포함되지만,
  // deeplink API 도 별도로 검증한다.
  const firstUrl = products[0].productUrl;
  console.log(`\n[2/2] 딥링크 생성 테스트 (첫 번째 상품 URL 사용)`);
  console.log(`     원본: ${firstUrl}`);

  const links = await createDeeplinks([firstUrl]);
  links.forEach((l) => {
    console.log(`     ▶ 단축 제휴 링크: ${l.shortenUrl}`);
    console.log(`     ▶ 랜딩 링크:     ${l.landingUrl}`);
  });

  console.log('\n✅ 모듈 ② 정상 동작 확인 완료.\n');
}

main().catch((err) => {
  console.error('\n❌ 실패:', err.message, '\n');
  process.exitCode = 1;
});
