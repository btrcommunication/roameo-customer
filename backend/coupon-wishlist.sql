CREATE TABLE IF NOT EXISTS coupon_wishlist (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  coupon_id INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY unique_wishlist_user_coupon (user_id, coupon_id),
  KEY wishlist_coupon_id (coupon_id)
) ENGINE=InnoDB;
