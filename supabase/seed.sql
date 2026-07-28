-- Seed data for Oferta Certa
-- Minimal structural data for categories, marketplaces, and application settings.

insert into public.categories (slug, name, description, icon) values
('tecnologia', 'Tecnologia', 'Ofertas em eletrônicos e gadgets.', '💡'),
('celulares', 'Celulares', 'Smartphones e acessórios.', '📱'),
('casa', 'Casa', 'Eletrodomésticos e organização.', '🏠'),
('games', 'Games', 'Jogos, consoles e periféricos.', '🎮');

insert into public.marketplaces (slug, name, logo) values
('magalu', 'Magazine Luiza', null),
('amazon', 'Amazon', null);

insert into public.settings (name, value) values
('site_title', jsonb '"Oferta Certa"'),
('site_description', jsonb '"Plataforma de comparação de ofertas e cupons."');
