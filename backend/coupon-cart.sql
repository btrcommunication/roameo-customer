-- Existing listing cart data is preserved. Run in your application database.
CREATE TABLE IF NOT EXISTS coupon_cart (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  coupon_id INT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY unique_user_coupon (user_id, coupon_id),
  KEY coupon_id (coupon_id)
) ENGINE=InnoDB;
