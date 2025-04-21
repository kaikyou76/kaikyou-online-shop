-- ① 既存の cart_items テーブルを削除
DROP TABLE IF EXISTS cart_items;

-- ② 正しいスキーマで再作成
CREATE TABLE cart_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, product_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- ③ 必要に応じてインデックスも再作成
CREATE INDEX idx_cart_items_user_id ON cart_items(user_id);
