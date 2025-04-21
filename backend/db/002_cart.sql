-- セッション切れのカートを自動削除
DELETE FROM cart_items 
WHERE user_id IS NULL 
AND created_at < datetime('now', '-30 days');
