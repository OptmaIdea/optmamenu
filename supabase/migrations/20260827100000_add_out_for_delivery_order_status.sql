-- Estado operacional para pedidos de entrega após retirada do pacote pelo entregador.
alter type public.order_status add value if not exists 'out_for_delivery' before 'completed';
