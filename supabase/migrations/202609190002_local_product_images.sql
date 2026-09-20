update public.products set image_url = '/assets/images/products/' || case id
  when 'prod_strawberry_cloud' then 'strawberry-cloud.png' when 'prod_chocolate_fudge' then 'chocolate-fudge.png'
  when 'prod_lemon_tart' then 'lemon-tart.png' when 'prod_butter_croissant' then 'butter-croissant.png'
  when 'prod_strawberry_danish' then 'strawberry-danish.png' when 'prod_cinnamon_roll' then 'cinnamon-roll.png'
  when 'prod_sea_salt_cookie' then 'sea-salt-cookie.png' when 'prod_brown_butter_cookie' then 'brown-butter-cookie.png'
  when 'prod_pistachio_cookie' then 'pistachio-cookie.png' when 'prod_truffle_box' then 'truffle-box.png'
  when 'prod_dark_bark' then 'dark-bark.png' when 'prod_caramel_bonbon' then 'caramel-bonbon.png' end;
