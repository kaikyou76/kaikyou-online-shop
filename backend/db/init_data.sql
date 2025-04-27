-- categories テーブル
INSERT INTO categories (id, name)
VALUES
  (1, 'Electronics'),
  (2, 'Smartphones'),
  (3, 'Accessories');

-- products テーブル
INSERT INTO products (id, name, description, price, category_id)
VALUES
  (1, 'Laptop', 'A powerful laptop with 16GB RAM and 512GB SSD', 1200, 1),
  (2, 'Smartphone', 'Latest model smartphone with 5G support', 800, 2),
  (3, 'Wireless Mouse', 'Ergonomic wireless mouse with Bluetooth', 30, 3);

-- images テーブル
INSERT INTO images (id, product_id, image_url)
VALUES
  (1, 1, 'https://example.com/images/laptop.jpg'),
  (2, 2, 'https://example.com/images/smartphone.jpg'),
  (3, 3, 'https://example.com/images/mouse.jpg');

-- users テーブル
INSERT INTO users (id, name, email, password_hash)
VALUES
  (1, 'John Doe', 'john.doe@example.com', 'hashedpassword123'),
  (2, 'Jane Smith', 'jane.smith@example.com', 'hashedpassword456');

-- orders テーブル
INSERT INTO orders (id, user_id, total_price, status)
VALUES
  (1, 1, 1200, 'completed'),
  (2, 2, 800, 'pending');
