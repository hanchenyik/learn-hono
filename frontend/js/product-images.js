const PRODUCT_IMAGES = {
  prod_strawberry_cloud: '/assets/strawberry-cloud.png',
  prod_chocolate_fudge: '/assets/chocolate-fudge.png',
  prod_lemon_tart: '/assets/lemon-tart.png',
  prod_butter_croissant: '/assets/butter-croissant.png',
  prod_strawberry_danish: '/assets/strawberry-danish.png',
  prod_cinnamon_roll: '/assets/cinnamon-roll.png',
  prod_sea_salt_cookie: '/assets/sea-salt-cookie.png',
  prod_brown_butter_cookie: '/assets/brown-butter-cookie.png',
  prod_pistachio_cookie: '/assets/pistachio-cookie.png',
  prod_truffle_box: '/assets/truffle-box.png',
  prod_dark_bark: '/assets/dark-bark.png',
  prod_caramel_bonbon: '/assets/caramel-bonbon.png'
}

export function imageForProduct(product) {
  return PRODUCT_IMAGES[product.id] || '/assets/petitbakery-hero-cake.png'
}

export function imageForCartItem(item) {
  return PRODUCT_IMAGES[item.productId] || '/assets/petitbakery-hero-cake.png'
}
