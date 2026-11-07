-- Cada banner pertence a um dos 3 carrosséis do topo do Início: o grande (esquerda) ou um dos dois menores (direita).
ALTER TABLE banners ADD COLUMN posicao TEXT NOT NULL DEFAULT 'principal';
