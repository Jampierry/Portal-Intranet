# CSS do layout

O antigo `portal.css` (2.197 linhas) foi dividido **mecanicamente** em `parte-01.css` … `parte-10.css`; a `parte-11.css` (efeito vidro) é nova e vem por último, cortando só entre blocos de nível raiz, e é importado **na mesma ordem** em `main.tsx`. A cascata ("o último vence") é a mesma de antes: o CSS compilado ficou idêntico byte a byte.

Regras daqui em diante:
- Não reordene os imports de `main.tsx`.
- Regra nova: procure antes se o seletor já existe (`grep -rn ".seletor" web/src/css`) e **edite no lugar**, em vez de acrescentar outro bloco no fim.
- Alturas que dependem do zoom usam `var(--zoom)`.
- `@media` com `px` em largura/altura é reescrito em tempo de execução por `web/src/escala-auto.ts` (escala automática em telas menores que 1600×860); escreva normalmente, valendo o tamanho "de projeto".
- Consolidar as regras repetidas (ex.: `.entrar`, `.rodape-portal`) exige teste visual nos 6 estilos × claro/escuro × celular; faça por módulo e confira no navegador.
