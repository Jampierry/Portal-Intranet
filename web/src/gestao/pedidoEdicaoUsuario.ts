// Ponte entre o sino (aviso "sem departamento") e a tela de Usuários: guarda quem deve abrir em edição.
let pendente: number | null = null;

/** Pede para a tela de Usuários abrir a edição desta pessoa (funciona mesmo se a tela ainda não carregou). */
export function pedirEdicaoUsuario(id: number) {
  pendente = id;
  window.dispatchEvent(new Event('editar-usuario'));
}

/** Entrega e limpa o pedido, se houver. */
export function pegarPedidoEdicaoUsuario(): number | null {
  const id = pendente;
  pendente = null;
  return id;
}
