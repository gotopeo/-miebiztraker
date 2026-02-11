-- 発注機関を21機関に絞る
-- まず全ての発注機関を無効化
UPDATE issuers SET isActive = false;

-- 指定された21機関のみを有効化し、表示順序を設定
UPDATE issuers SET isActive = true, sortOrder = 1 WHERE name = '桑名農政事務所';
UPDATE issuers SET isActive = true, sortOrder = 2 WHERE name = '桑名建設事務所';
UPDATE issuers SET isActive = true, sortOrder = 3 WHERE name = '四日市農林事務所';
UPDATE issuers SET isActive = true, sortOrder = 4 WHERE name = '四日市建設事務所';
UPDATE issuers SET isActive = true, sortOrder = 5 WHERE name = '北勢流域下水道事務所';
UPDATE issuers SET isActive = true, sortOrder = 6 WHERE name = '鈴鹿建設事務所';
UPDATE issuers SET isActive = true, sortOrder = 7 WHERE name = '津農林水産事務所';
UPDATE issuers SET isActive = true, sortOrder = 8 WHERE name = '津建設事務所';
UPDATE issuers SET isActive = true, sortOrder = 9 WHERE name = '中南勢流域下水道事務所';
UPDATE issuers SET isActive = true, sortOrder = 10 WHERE name = '松阪地域防災総合事務所';
UPDATE issuers SET isActive = true, sortOrder = 11 WHERE name = '松阪農林事務所';
UPDATE issuers SET isActive = true, sortOrder = 12 WHERE name = '松阪建設事務所';
UPDATE issuers SET isActive = true, sortOrder = 13 WHERE name = '伊勢農林水産事務所';
UPDATE issuers SET isActive = true, sortOrder = 14 WHERE name = '伊勢建設事務所';
UPDATE issuers SET isActive = true, sortOrder = 15 WHERE name = '志摩建設事務所';
UPDATE issuers SET isActive = true, sortOrder = 16 WHERE name = '伊賀農林事務所';
UPDATE issuers SET isActive = true, sortOrder = 17 WHERE name = '伊賀建設事務所';
UPDATE issuers SET isActive = true, sortOrder = 18 WHERE name = '尾鷲農林水産事務所';
UPDATE issuers SET isActive = true, sortOrder = 19 WHERE name = '尾鷲建設事務所';
UPDATE issuers SET isActive = true, sortOrder = 20 WHERE name = '熊野農林事務所';
UPDATE issuers SET isActive = true, sortOrder = 21 WHERE name = '熊野建設事務所';
