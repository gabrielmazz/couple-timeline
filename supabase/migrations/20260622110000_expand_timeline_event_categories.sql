alter table public.timeline_events
  drop constraint if exists timeline_events_category_check;

alter table public.timeline_events
  add constraint timeline_events_category_check check (category in (
    'Primeiro encontro', 'Primeiro beijo', 'Início do namoro', 'Pedido de namoro',
    'Noivado', 'Pedido de casamento', 'Viagem', 'Fim de semana', 'Passeio', 'Praia',
    'Aventura', 'Lua de mel', 'Aniversário', 'Aniversário de namoro',
    'Aniversário de casamento', 'Pedido', 'Casamento', 'Jantar', 'Almoço', 'Café',
    'Piquenique', 'Cinema', 'Teatro', 'Show', 'Festival', 'Festa', 'Natal', 'Ano Novo',
    'Dia dos Namorados', 'Presente', 'Surpresa', 'Conquista', 'Formatura', 'Novo emprego',
    'Casa nova', 'Mudança', 'Adoção de pet', 'Família', 'Amigos',
    'Sessão de fotos', 'Reconciliação', 'Dia comum especial', 'Outro'
  ));
