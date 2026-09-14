import { cn } from '@/lib/utils';

/**
 * Marca de Kolek — mascota robot + "K", arte final entregado por el
 * cliente (public/brand/kolek-icon.png y kolek-wordmark.png). Se usan
 * como <img> normal (no next/image) porque el contenedor decide el alto
 * vía className y el ancho se ajusta solo por el aspect-ratio nativo del
 * archivo — no hay que declarar tamaños fijos en cada sitio donde se usa.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <img
      src="/brand/kolek-icon.png"
      alt=""
      aria-hidden="true"
      className={cn('h-6 w-6 object-contain', className)}
    />
  );
}

export function Logo({
  className,
  markClassName,
  showWordmark = true,
}: {
  className?: string;
  markClassName?: string;
  showWordmark?: boolean;
}) {
  if (!showWordmark) {
    return (
      <span className={cn('inline-flex items-center', className)}>
        <LogoMark className={cn('h-[26px] w-[26px]', markClassName)} />
      </span>
    );
  }

  return (
    <img
      src="/brand/kolek-wordmark.png"
      alt="Kolek"
      className={cn('h-7 w-auto object-contain', className)}
    />
  );
}
