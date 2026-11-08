-- Aplicativos restritos liberados por PERFIL. Quem tem o perfil vê esses aplicativos; além disso, cada usuário pode receber
-- aplicativos extras (tabela usuarios_aplicativos). A pessoa vê a soma dos dois. O administrador sempre vê todos.
CREATE TABLE perfis_aplicativos (
  perfil         TEXT NOT NULL REFERENCES perfis_permissoes(perfil) ON DELETE CASCADE,
  aplicacao_slug TEXT NOT NULL REFERENCES aplicacoes(slug) ON DELETE CASCADE,
  PRIMARY KEY (perfil, aplicacao_slug)
);
