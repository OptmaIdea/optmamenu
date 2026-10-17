update public.store_payment_methods
set name='Pagar no recebimento',
    description='Pagamento definido ou concluído no momento da retirada, entrega ou atendimento.',
    updated_at=now()
where code='pending';
