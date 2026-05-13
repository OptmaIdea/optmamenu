-- Seed Categories
INSERT INTO public.categories (id, name, description, image_url, active)
VALUES 
    ('d290f1ee-6c54-4b01-90e6-d701748f0851', 'Sorvetes', 'Deliciosos sorvetes de massa artesanal', 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?auto=format&fit=crop&q=80&w=800', true),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Picolés', 'Picolés refrescantes de fruta e leite', 'https://images.unsplash.com/photo-1579954115545-a9572718a93d?auto=format&fit=crop&q=80&w=800', true),
    ('f47ac10b-58cc-4372-a567-0e02b2c3d479', 'Açaí', 'O melhor açaí da região', 'https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&q=80&w=800', true)
ON CONFLICT (id) DO NOTHING;

-- Seed Products (Sorvetes)
INSERT INTO public.products (category_id, name, description, price, image_url, stock, active)
VALUES
    ('d290f1ee-6c54-4b01-90e6-d701748f0851', 'Chocolate Belga', 'Sorvete cremoso de chocolate belga 70%.', 12.00, 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&q=80&w=800', 50, true),
    ('d290f1ee-6c54-4b01-90e6-d701748f0851', 'Morango ao Leite', 'Feito com pedaços de morango fresco.', 10.00, 'https://images.unsplash.com/photo-1557142046-2778f55720f2?auto=format&fit=crop&q=80&w=800', 30, true),
    ('d290f1ee-6c54-4b01-90e6-d701748f0851', 'Flocos', 'Clássico creme com pedaços de chocolate.', 10.00, 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&q=80&w=800', 40, true),
    ('d290f1ee-6c54-4b01-90e6-d701748f0851', 'Pistache Premium', 'O verdadeiro sabor do pistache italiano.', 15.00, 'https://images.unsplash.com/photo-1557142046-2778f55720f2?auto=format&fit=crop&q=80&w=800', 15, true); -- Low stock demo

-- Seed Products (Picolés)
INSERT INTO public.products (category_id, name, description, price, image_url, stock, active)
VALUES
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Picolé de Limão', 'Refrescante e cítrico.', 4.00, 'https://images.unsplash.com/photo-1579954115545-a9572718a93d?auto=format&fit=crop&q=80&w=800', 100, true),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Picolé de Coco', 'Cremoso com pedaços de coco.', 5.00, 'https://images.unsplash.com/photo-1579954115545-a9572718a93d?auto=format&fit=crop&q=80&w=800', 80, true),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Skimo', 'Baunilha com cobertura de chocolate.', 6.00, 'https://images.unsplash.com/photo-1579954115545-a9572718a93d?auto=format&fit=crop&q=80&w=800', 50, true);

-- Seed Products (Açaí)
INSERT INTO public.products (category_id, name, description, price, image_url, stock, active)
VALUES
    ('f47ac10b-58cc-4372-a567-0e02b2c3d479', 'Copo de Açaí 300ml', 'Açaí puro com granola e banana.', 15.00, 'https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&q=80&w=800', 200, true),
    ('f47ac10b-58cc-4372-a567-0e02b2c3d479', 'Copo de Açaí 500ml', 'Açaí puro com granola, banana e leite em pó.', 20.00, 'https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&q=80&w=800', 0, true); -- Out of stock demo
