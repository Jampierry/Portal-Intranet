/** Formato (para o cartão do documento) a partir da extensão do arquivo; null se não reconhecer. */
export function formatoPorNome(nome: string): string | null {
  const ext = /\.([A-Za-z0-9]{1,5})(?:[?#].*)?$/.exec(nome.trim())?.[1]?.toLowerCase();
  if (!ext) return null;
  const mapa: Record<string, string> = {
    pdf: 'PDF', doc: 'Documento Word', docx: 'Documento Word', odt: 'Documento', rtf: 'Documento', txt: 'Texto',
    xls: 'Planilha', xlsx: 'Planilha', xlsm: 'Planilha', csv: 'Planilha', ods: 'Planilha',
    ppt: 'Apresentação', pptx: 'Apresentação', odp: 'Apresentação',
    png: 'Imagem', jpg: 'Imagem', jpeg: 'Imagem', gif: 'Imagem', webp: 'Imagem', svg: 'Imagem',
    zip: 'Arquivo compactado', rar: 'Arquivo compactado', '7z': 'Arquivo compactado',
    mp4: 'Vídeo', mov: 'Vídeo', mp3: 'Áudio', vsdx: 'Fluxograma', dwg: 'Desenho técnico',
  };
  return mapa[ext] ?? ext.toUpperCase();
}
