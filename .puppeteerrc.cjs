const {join} = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Puppeteerのキャッシュディレクトリ
  // 本番環境: /usr/src/app/.cache/puppeteer
  // 開発環境: /home/ubuntu/mie_bidding_system/.cache/puppeteer
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
