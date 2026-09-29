-- One current checkout draft per customer. Does not record payment success.
-- Requires coupons.price to exist (as supplied by the updated Coupon model).
CREATE TABLE IF NOT EXISTS coupon_checkouts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  items JSON NOT NULL,
  total_items INT UNSIGNED NOT NULL,
  total_amount DECIMAL(15,2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  status VARCHAR(32) NOT NULL DEFAULT 'pending_payment',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY unique_checkout_user (user_id)
) ENGINE=InnoDB;
