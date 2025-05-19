-- 大分類の挿入（親カテゴリ）
INSERT INTO categories (name, parent_id) VALUES
('服', NULL),
('花', NULL),
('食品', NULL),
('車', NULL);

-- 中分類の挿入（子カテゴリ）
-- 服のサブカテゴリ
INSERT INTO categories (name, parent_id) VALUES
('メンズ', (SELECT id FROM categories WHERE name = '服')),
('レディース', (SELECT id FROM categories WHERE name = '服')),
('キッズ', (SELECT id FROM categories WHERE name = '服'));

-- 花のサブカテゴリ
INSERT INTO categories (name, parent_id) VALUES
('切り花', (SELECT id FROM categories WHERE name = '花')),
('観葉植物', (SELECT id FROM categories WHERE name = '花')),
('ガーデニング', (SELECT id FROM categories WHERE name = '花'));

-- 食品のサブカテゴリ
INSERT INTO categories (name, parent_id) VALUES
('生鮮食品', (SELECT id FROM categories WHERE name = '食品')),
('加工食品', (SELECT id FROM categories WHERE name = '食品')),
('飲料', (SELECT id FROM categories WHERE name = '食品'));

-- 車のサブカテゴリ
INSERT INTO categories (name, parent_id) VALUES
('乗用車', (SELECT id FROM categories WHERE name = '車')),
('SUV', (SELECT id FROM categories WHERE name = '車')),
('トラック', (SELECT id FROM categories WHERE name = '車'));

-- 小分類の挿入（さらに細かい分類）
-- メンズ服のサブカテゴリ
INSERT INTO categories (name, parent_id) VALUES
('Tシャツ', (SELECT id FROM categories WHERE name = 'メンズ' AND parent_id = (SELECT id FROM categories WHERE name = '服'))),
('ジーンズ', (SELECT id FROM categories WHERE name = 'メンズ' AND parent_id = (SELECT id FROM categories WHERE name = '服'))),
('ジャケット', (SELECT id FROM categories WHERE name = 'メンズ' AND parent_id = (SELECT id FROM categories WHERE name = '服')));

-- 生鮮食品のサブカテゴリ
INSERT INTO categories (name, parent_id) VALUES
('野菜', (SELECT id FROM categories WHERE name = '生鮮食品' AND parent_id = (SELECT id FROM categories WHERE name = '食品'))),
('肉', (SELECT id FROM categories WHERE name = '生鮮食品' AND parent_id = (SELECT id FROM categories WHERE name = '食品'))),
('魚', (SELECT id FROM categories WHERE name = '生鮮食品' AND parent_id = (SELECT id FROM categories WHERE name = '食品')));

-- サンプル商品の挿入（各カテゴリに1つずつ）
INSERT INTO products (name, description, price, stock, category_id) VALUES
('メンズデニムジーンズ', 'クラシックなデニムジーンズ。快適な履き心地。', 8900, 50, (SELECT id FROM categories WHERE name = 'ジーンズ')),
('バラの花束', '赤いバラ10本入りの豪華な花束。', 5500, 20, (SELECT id FROM categories WHERE name = '切り花')),
('有機野菜セット', '旬の有機野菜が5種類入ったセット。', 3200, 30, (SELECT id FROM categories WHERE name = '野菜')),
('コンパクトSUV', '燃費の良いコンパクトSUV。最新安全装備搭載。', 2980000, 5, (SELECT id FROM categories WHERE name = 'SUV'));

-- サンプル画像の挿入（各商品に1つずつメイン画像）
INSERT INTO images (product_id, image_url, alt_text, is_main) VALUES
((SELECT id FROM products WHERE name = 'メンズデニムジーンズ'), 'https://example.com/images/jeans1.jpg', 'デニムジーンズの画像', 1),
((SELECT id FROM products WHERE name = 'バラの花束'), 'https://example.com/images/rose_bouquet.jpg', 'バラの花束の画像', 1),
((SELECT id FROM products WHERE name = '有機野菜セット'), 'https://example.com/images/vegetable_set.jpg', '有機野菜セットの画像', 1),
((SELECT id FROM products WHERE name = 'コンパクトSUV'), 'https://example.com/images/suv_car.jpg', 'SUVの画像', 1);
