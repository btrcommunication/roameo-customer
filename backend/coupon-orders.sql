-- Run once before deploying the updated cart route.
-- Existing checkout drafts are preserved and are not converted into placed orders.
CREATE TABLE IF NOT EXISTS coupon_orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  request_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  items JSON NOT NULL,
  total_items INT UNSIGNED NOT NULL,
  total_amount DECIMAL(15,2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  status VARCHAR(32) NOT NULL DEFAULT 'placed',
  payment_status VARCHAR(32) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY unique_order_request (user_id, request_id),
  KEY orders_by_customer (user_id, created_at)
) ENGINE=InnoDB;
