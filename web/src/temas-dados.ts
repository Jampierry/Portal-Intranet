// Dados puros dos estilos (sem React), para a tela e para o teste de contraste.
// Cada estilo tem a sua cor de destaque (definida em estilo.css); o usuário escolhe só estilo e modo.
export type Estilo = 'dipaula' | 'bordo' | 'meianoite' | 'ardosia' | 'grafite' | 'oceano' | 'github' | 'notion';

// Amostra (menu | fundo | destaque) mostrada em cada botão de estilo, no tema claro.
// menuClaro: no modo claro o menu lateral é claro (nos demais estilos o menu é escuro nos dois modos); isso decide qual logo aparece sobre o menu.
export const ESTILOS: { id: Estilo; nome: string; menu: string; fundo: string; acento: string; menuClaro?: boolean }[] = [
  { id: 'dipaula', nome: 'Padrão', menu: '#2b2a2d', fundo: '#f7f3f1', acento: '#6e3a58' },
  { id: 'bordo', nome: 'Bordô', menu: '#2e1a28', fundo: '#faf6f7', acento: '#d9aec6' },
  { id: 'meianoite', nome: 'Meia-noite', menu: '#18214d', fundo: '#f0f2fa', acento: '#b8b2ee' },
  { id: 'ardosia', nome: 'Ardósia', menu: '#2b313c', fundo: '#eff1f4', acento: '#a8c3ec' },
  { id: 'grafite', nome: 'Grafite', menu: '#27272a', fundo: '#f4f4f5', acento: '#a4d4be' },
  { id: 'oceano', nome: 'Oceano', menu: '#0f2f3d', fundo: '#edf4f6', acento: '#9acfdb' },
  // Menu claro no tema claro e escuro no tema escuro, nas paletas públicas mais usadas (GitHub Primer e Notion).
  { id: 'github', nome: 'GitHub', menu: '#f6f8fa', fundo: '#ffffff', acento: '#0969da', menuClaro: true },
  { id: 'notion', nome: 'Notion', menu: '#f7f6f3', fundo: '#ffffff', acento: '#1a6fc4', menuClaro: true },
];
