-- Fresh PetitBakery demo database. Run with `supabase db push`.
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default 'Customer',
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now()
);
create table public.products (
  id text primary key, slug text not null unique, name text not null, description text not null,
  category text not null, price_cents integer not null check (price_cents >= 0), stock integer not null default 0 check (stock >= 0),
  image_url text not null, active boolean not null default true, created_at timestamptz not null default now()
);
create table public.orders (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id), status text not null default 'confirmed', shipping_status text not null default 'pending',
  subtotal_cents integer not null, shipping_cents integer not null, tax_cents integer not null, total_cents integer not null,
  shipping_name text not null, address1 text not null, address2 text not null default '', city text not null, postal_code text not null, country text not null,
  idempotency_key text not null, created_at timestamptz not null default now(), unique(user_id, idempotency_key)
);
create table public.order_items (id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade, product_id text not null references public.products(id), product_name text not null, unit_price_cents integer not null, quantity integer not null check (quantity > 0));
create table public.payments (id uuid primary key default gen_random_uuid(), order_id uuid not null unique references public.orders(id) on delete cascade, amount_cents integer not null, status text not null default 'paid', provider text not null default 'demo', receipt_number text not null unique, created_at timestamptz not null default now());
create table public.admin_activity (id uuid primary key default gen_random_uuid(), admin_id uuid references public.profiles(id), action text not null, subject_type text not null, subject_id text not null, created_at timestamptz not null default now());

alter table public.profiles enable row level security; alter table public.products enable row level security; alter table public.orders enable row level security; alter table public.order_items enable row level security; alter table public.payments enable row level security; alter table public.admin_activity enable row level security;
create policy "profiles own" on public.profiles for select using (id = auth.uid());
create policy "catalog public" on public.products for select using (active = true);
create policy "orders own" on public.orders for select using (user_id = auth.uid());
create policy "items own" on public.order_items for select using (exists (select 1 from public.orders where orders.id = order_items.order_id and user_id = auth.uid()));
create policy "payments own" on public.payments for select using (exists (select 1 from public.orders where orders.id = payments.order_id and user_id = auth.uid()));
create policy "activity admin" on public.admin_activity for select using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create or replace function public.create_profile() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into public.profiles (id,email,display_name) values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.create_profile();

create or replace function public.checkout_order(p_user_id uuid, p_idempotency_key text, p_items jsonb, p_shipping jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare existing_id uuid; new_id uuid; item jsonb; product public.products%rowtype; subtotal integer := 0; shipping integer; tax integer; total integer;
begin
  select id into existing_id from public.orders where user_id = p_user_id and idempotency_key = p_idempotency_key;
  if existing_id is not null then return jsonb_build_object('orderId', existing_id, 'duplicate', true); end if;
  if jsonb_array_length(p_items) = 0 then raise exception 'Your cart is empty.'; end if;
  for item in select * from jsonb_array_elements(p_items) loop
    select * into product from public.products where id = item->>'product_id' and active for update;
    if not found then raise exception 'One or more products are unavailable.'; end if;
    if (item->>'quantity')::integer < 1 or (item->>'quantity')::integer > 10 or product.stock < (item->>'quantity')::integer then raise exception '% does not have enough stock.', product.name; end if;
    subtotal := subtotal + product.price_cents * (item->>'quantity')::integer;
  end loop;
  shipping := case when subtotal >= 8000 then 0 else 799 end; tax := round(subtotal * .06); total := subtotal + shipping + tax;
  insert into public.orders (user_id,subtotal_cents,shipping_cents,tax_cents,total_cents,shipping_name,address1,address2,city,postal_code,country,idempotency_key)
  values (p_user_id,subtotal,shipping,tax,total,p_shipping->>'full_name',p_shipping->>'address1',coalesce(p_shipping->>'address2',''),p_shipping->>'city',p_shipping->>'postal_code',p_shipping->>'country',p_idempotency_key) returning id into new_id;
  for item in select * from jsonb_array_elements(p_items) loop
    select * into product from public.products where id = item->>'product_id' for update;
    update public.products set stock = stock - (item->>'quantity')::integer where id = product.id;
    insert into public.order_items(order_id,product_id,product_name,unit_price_cents,quantity) values(new_id,product.id,product.name,product.price_cents,(item->>'quantity')::integer);
  end loop;
  insert into public.payments(order_id,amount_cents,receipt_number) values(new_id,total,'PB-' || upper(substr(replace(new_id::text,'-',''),1,12)));
  return jsonb_build_object('orderId', new_id, 'duplicate', false, 'totals', jsonb_build_object('subtotal',subtotal,'shipping',shipping,'tax',tax,'total',total));
end $$;
revoke all on function public.checkout_order(uuid,text,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.checkout_order(uuid,text,jsonb,jsonb) to service_role;

insert into public.products (id,slug,name,description,category,price_cents,stock,image_url) values
('prod_strawberry_cloud','strawberry-cloud','Strawberry Cloud Cake','Vanilla sponge, whipped cream and bright strawberries for a soft little celebration.','Cakes',14800,12,'https://images.unsplash.com/photo-1571115177098-24ec42ed204d?auto=format&fit=crop&w=1200&q=85'),
('prod_chocolate_fudge','chocolate-fudge','Midnight Fudge Cake','A rich chocolate crumb with silky ganache and a gentle sea-salt finish.','Cakes',16800,9,'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=1200&q=85'),
('prod_lemon_tart','lemon-tart','Lemon Meringue Tart','Buttery shortcrust, sharp lemon curd and toasted meringue.','Cakes',12800,8,'https://images.unsplash.com/photo-1519915028121-7d3463d20b13?auto=format&fit=crop&w=1200&q=85'),
('prod_butter_croissant','butter-croissant','Butter Croissant','Flaky, golden layers made with cultured butter.','Pastries',900,30,'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=1200&q=85'),
('prod_strawberry_danish','strawberry-danish','Strawberry Danish','Laminated pastry, vanilla cream and strawberry.','Pastries',1200,22,'https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=1200&q=85'),
('prod_cinnamon_roll','cinnamon-roll','Cinnamon Morning Roll','Soft spiral dough with brown sugar and cinnamon.','Pastries',1100,24,'https://images.unsplash.com/photo-1509365465985-25d11c17e812?auto=format&fit=crop&w=1200&q=85'),
('prod_sea_salt_cookie','sea-salt-cookie','Sea Salt Chocolate Cookie','Crisp edges and dark chocolate puddles.','Cookies',850,40,'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=1200&q=85'),
('prod_brown_butter_cookie','brown-butter-cookie','Brown Butter Cookie','Toasty brown butter and roasted pecans.','Cookies',850,35,'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=1200&q=85'),
('prod_pistachio_cookie','pistachio-cookie','Pistachio Shortbread','Tender shortbread with roasted pistachio.','Cookies',950,28,'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=1200&q=85'),
('prod_truffle_box','truffle-box','Petit Truffle Box','Six glossy chocolate truffles.','Chocolates',2200,18,'https://images.unsplash.com/photo-1548907040-4d42e42f4b80?auto=format&fit=crop&w=1200&q=85'),
('prod_dark_bark','dark-bark','Almond Dark Bark','Dark chocolate with toasted almonds.','Chocolates',1800,16,'https://images.unsplash.com/photo-1575377427642-087cf684f04d?auto=format&fit=crop&w=1200&q=85'),
('prod_caramel_bonbon','caramel-bonbon','Salted Caramel Bonbons','Milk chocolate shells with salted caramel.','Chocolates',2400,14,'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=1200&q=85');

-- Promote an account only after it has signed up: update public.profiles set role = 'admin' where email = 'admin@example.com';
