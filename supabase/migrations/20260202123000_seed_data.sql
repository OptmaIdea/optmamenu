-- Categories
INSERT INTO public.categories (id, name, description, image_url, slug, order_index, active)
VALUES 
    ('d290f1ee-6c54-4b01-90e6-d701748f0851', 'Sorvetes', 'Massa artesanal cremosa', 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?auto=format&fit=crop&q=80&w=300', 'sorvetes', 1, true),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Picolés', 'Refrescantes e naturais', 'https://images.unsplash.com/photo-1579954115545-a9572718a93d?auto=format&fit=crop&q=80&w=300', 'picoles', 2, true),
    ('f47ac10b-58cc-4372-a567-0e02b2c3d479', 'Açaí', 'Energia pura da Amazônia', 'https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&q=80&w=300', 'acai', 3, true)
ON CONFLICT (id) DO NOTHING;

-- Products (Sorvetes)
INSERT INTO public.products (category_id, name, description, price, images, allergens, featured, stock_quantity, active)
VALUES
    ('d290f1ee-6c54-4b01-90e6-d701748f0851', 'Chocolate Belga', 'Intenso sabor de chocolate 70% cacau.', 12.00, ARRAY['https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&q=80&w=600'], ARRAY['LEITE'], true, 50, true),
    ('d290f1ee-6c54-4b01-90e6-d701748f0851', 'Morango Premium', 'Feito com a fruta fresca selecionada.', 12.00, ARRAY['https://images.unsplash.com/photo-1557142046-2778f55720f2?auto=format&fit=crop&q=80&w=600'], ARRAY['LEITE'], false, 30, true),
    ('d290f1ee-6c54-4b01-90e6-d701748f0851', 'Pistache Siciliano', 'O verdeiro sabor italiano.', 16.00, ARRAY['https://images.unsplash.com/photo-1557142046-2778f55720f2?auto=format&fit=crop&q=80&w=600'], ARRAY['LEITE', 'NOZES'], true, 20, true);

-- Products (Picolés)
INSERT INTO public.products (category_id, name, description, price, images, allergens, featured, stock_quantity, active)
VALUES
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Limão Siciliano', 'Refrescância cítrica natural.', 5.00, ARRAY['https://images.unsplash.com/photo-1579954115545-a9572718a93d?auto=format&fit=crop&q=80&w=600'], ARRAY[], false, 100, true),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Coco Queimado', 'Cremoso com pedaços de coco.', 6.00, ARRAY['https://images.unsplash.com/photo-1579954115545-a9572718a93d?auto=format&fit=crop&q=80&w=600'], ARRAY['LEITE'], true, 80, true);

-- Products (Açaí)
INSERT INTO public.products (category_id, name, description, price, images, allergens, featured, stock_quantity, active)
VALUES
    ('f47ac10b-58cc-4372-a567-0e02b2c3d479', 'Copo 300ml Completo', 'Açaí, granola, leite ninho e banana.', 18.00, ARRAY['https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&q=80&w=600'], ARRAY['LEITE', 'GLUTEN'], true, 200, true),
    ('f47ac10b-58cc-4372-a567-0e02b2c3d479', 'Barca 500ml', 'Para dividir (ou não).', 35.00, ARRAY['https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&q=80&w=600'], ARRAY['LEITE'], false, 50, true);
