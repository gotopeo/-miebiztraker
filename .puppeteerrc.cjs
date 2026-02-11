const {join} = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Puppeteerのキャッシュディレクトリを環境変数で指定可能にする
  // デフォルトは /home/ubuntu/.cache/puppeteer
  cacheDirectory: process.env.PUPPETEER_CACHE_DIR || join(__dirname, '.cache', 'puppeteer'),
};
