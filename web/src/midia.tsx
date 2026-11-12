import { useEffect, useRef, type CSSProperties } from 'react';

/** O endereço guardado é de um vídeo curto (MP4/WebM) enviado pelo portal? Banners e fundo da entrada aceitam imagem ou vídeo. */
export const ehVideo = (url?: string | null): boolean => !!url && /\.(mp4|webm)$/i.test(url.split('?')[0]);

/** Vídeo decorativo: sem som, em laço, sem controles; só toca quando `tocando` (o que não aparece fica parado, para poupar a máquina). */
export function VideoFundo({ src, tocando = true, className, style }: { src: string; tocando?: boolean; className?: string; style?: CSSProperties }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (tocando) void v.play().catch(() => { /* o navegador pode bloquear até haver interação; o primeiro quadro fica visível */ });
    else v.pause();
  }, [tocando, src]);
  return <video ref={ref} className={className} style={style} src={src} muted loop playsInline preload="metadata" disablePictureInPicture aria-hidden="true" tabIndex={-1} />;
}
