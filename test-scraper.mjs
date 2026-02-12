import { scrapeMieBiddings } from './server/scraper.ts';

console.log('=== スクレイピングテスト開始 ===');

const result = await scrapeMieBiddings({ useLatestAnnouncement: true }, false);

console.log('成功:', result.success);
console.log('総件数:', result.totalCount);
console.log('取得件数:', result.items.length);

if (result.items.length > 0) {
  console.log('\n最初の3件:');
  for (let i = 0; i < Math.min(3, result.items.length); i++) {
    const item = result.items[i];
    console.log(`\n[${i + 1}] ${item.title}`);
    console.log(`  発注機関: ${item.orderOrganName}`);
    console.log(`  工事種別: ${item.constructionType}`);
    console.log(`  格付: ${item.rating}`);
  }
}

process.exit(0);
