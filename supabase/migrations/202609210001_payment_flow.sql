-- Additive demo payment flow. Only method and outcome are persisted; never card fields.
alter table public.profiles add column if not exists default_shipping jsonb;
alter table public.orders add column if not exists payment_method text check (payment_method in ('qr','card'));
alter table public.orders add column if not exists payment_status text not null default 'paid' check (payment_status in ('pending','paid','not_paid','refunded'));
alter table public.orders add column if not exists payment_expires_at timestamptz;
alter table public.orders add column if not exists payment_token uuid;
alter table public.orders add column if not exists cancelled_at timestamptz;
alter table public.orders add column if not exists refunded_at timestamptz;
alter table public.payments add column if not exists method text;
alter table public.payments add column if not exists expires_at timestamptz;
alter table public.payments add column if not exists paid_at timestamptz;
alter table public.payments add column if not exists refunded_at timestamptz;
update public.orders set payment_status = 'paid', payment_method = coalesce(payment_method, 'card') where payment_status = 'pending' or payment_method is null;
update public.payments set method = coalesce(method, 'card'), paid_at = coalesce(paid_at, created_at) where method is null;

create or replace function public.create_pending_order(p_user_id uuid, p_idempotency_key text, p_items jsonb, p_shipping jsonb, p_method text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare existing_id uuid; new_id uuid; item jsonb; product public.products%rowtype; subtotal integer := 0; shipping integer; tax integer; total integer; token uuid := gen_random_uuid(); expiry timestamptz := now() + interval '60 seconds';
begin
  if p_method not in ('qr','card') then raise exception 'Choose QR or card payment.'; end if;
  select id into existing_id from public.orders where user_id = p_user_id and idempotency_key = p_idempotency_key;
  if existing_id is not null then return jsonb_build_object('orderId', existing_id, 'duplicate', true); end if;
  if jsonb_array_length(p_items) = 0 then raise exception 'Your cart is empty.'; end if;
  for item in select * from jsonb_array_elements(p_items) loop
    select * into product from public.products where id = item->>'product_id' and active for update;
    if not found or (item->>'quantity')::integer < 1 or (item->>'quantity')::integer > 10 or product.stock < (item->>'quantity')::integer then raise exception 'One or more products are unavailable.'; end if;
    subtotal := subtotal + product.price_cents * (item->>'quantity')::integer;
  end loop;
  shipping := case when subtotal >= 8000 then 0 else 799 end; tax := round(subtotal * .06); total := subtotal + shipping + tax;
  insert into public.orders (user_id,status,shipping_status,subtotal_cents,shipping_cents,tax_cents,total_cents,shipping_name,address1,address2,city,postal_code,country,idempotency_key,payment_method,payment_status,payment_expires_at,payment_token)
  values (p_user_id,'pending','pending',subtotal,shipping,tax,total,p_shipping->>'full_name',p_shipping->>'address1',coalesce(p_shipping->>'address2',''),p_shipping->>'city',p_shipping->>'postal_code',p_shipping->>'country',p_idempotency_key,p_method,'pending',expiry,token) returning id into new_id;
  for item in select * from jsonb_array_elements(p_items) loop
    select * into product from public.products where id = item->>'product_id' for update;
    update public.products set stock = stock - (item->>'quantity')::integer where id = product.id;
    insert into public.order_items(order_id,product_id,product_name,unit_price_cents,quantity) values(new_id,product.id,product.name,product.price_cents,(item->>'quantity')::integer);
  end loop;
  insert into public.payments(order_id,amount_cents,status,provider,method,expires_at,receipt_number) values(new_id,total,'pending','demo',p_method,expiry,'PB-' || upper(substr(replace(new_id::text,'-',''),1,12)));
  return jsonb_build_object('orderId',new_id,'paymentToken',token,'expiresAt',expiry,'total',total);
end $$;

create or replace function public.complete_demo_payment(p_order_id uuid, p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare o public.orders%rowtype;
begin
 select * into o from public.orders where id=p_order_id and payment_token=p_token for update;
 if not found then raise exception 'Payment link is invalid.'; end if;
 if o.payment_status = 'paid' then return jsonb_build_object('status','paid','total',o.total_cents); end if;
 if o.payment_expires_at < now() then update public.orders set payment_status='not_paid' where id=o.id; update public.payments set status='not_paid' where order_id=o.id; return jsonb_build_object('status','not_paid','total',o.total_cents); end if;
 update public.orders set payment_status='paid', status='confirmed' where id=o.id;
 update public.payments set status='paid', paid_at=now() where order_id=o.id;
 return jsonb_build_object('status','paid','total',o.total_cents);
end $$;

create or replace function public.retry_demo_payment(p_order_id uuid, p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare token uuid := gen_random_uuid(); expiry timestamptz := now() + interval '60 seconds';
begin
 update public.orders set payment_status='pending', payment_token=token, payment_expires_at=expiry where id=p_order_id and user_id=p_user_id and payment_status in ('not_paid','pending') returning id into p_order_id;
 if p_order_id is null then raise exception 'This order cannot be paid again.'; end if;
 update public.payments set status='pending', expires_at=expiry, paid_at=null where order_id=p_order_id;
 return jsonb_build_object('paymentToken',token,'expiresAt',expiry);
end $$;

create or replace function public.cancel_demo_order(p_order_id uuid, p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare o public.orders%rowtype; item record;
begin
 select * into o from public.orders where id=p_order_id and user_id=p_user_id for update;
 if not found then raise exception 'Order not found.'; end if;
 if o.shipping_status in ('shipped','delivered') then raise exception 'Orders cannot be cancelled after shipment.'; end if;
 if o.status='cancelled' then return jsonb_build_object('status','cancelled'); end if;
 update public.orders set status='cancelled', shipping_status='cancelled', cancelled_at=now(), payment_status=case when payment_status='paid' then 'refunded' else payment_status end, refunded_at=case when payment_status='paid' then now() else null end where id=o.id;
 if o.payment_status='paid' then update public.payments set status='refunded', refunded_at=now() where order_id=o.id; end if;
 for item in select product_id,quantity from public.order_items where order_id=o.id loop update public.products set stock=stock+item.quantity where id=item.product_id; end loop;
 return jsonb_build_object('status','cancelled','refunded',o.payment_status='paid');
end $$;

revoke all on function public.create_pending_order(uuid,text,jsonb,jsonb,text), public.complete_demo_payment(uuid,uuid), public.retry_demo_payment(uuid,uuid), public.cancel_demo_order(uuid,uuid) from public, anon, authenticated;
grant execute on function public.create_pending_order(uuid,text,jsonb,jsonb,text), public.complete_demo_payment(uuid,uuid), public.retry_demo_payment(uuid,uuid), public.cancel_demo_order(uuid,uuid) to service_role;
