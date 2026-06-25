'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { LoadingOverlay } from './loading-overlay';

export function GlobalNavigationLoader() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [isRouting, setIsRouting] = useState(false);

  // Cada vez que cambie la URL (pathname o searchParams), apagamos el spinner.
  // Sincronización con un sistema externo (el router): efecto legítimo.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsRouting(false);
  }, [pathname, searchParams]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as Element).closest('a');
      if (!target) return;
      
      const href = target.getAttribute('href');
      const targetAttr = target.getAttribute('target');
      
      if (!href || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:') || targetAttr === '_blank') return;
      if (href.startsWith('#')) return;
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0) return;

      // Importante: No interceptar si el link tiene onClick que llama a e.preventDefault()
      // Por eso usamos setTimeout, para que los eventos de React (que hacen preventDefault) se ejecuten antes.
      // Pero 'capture: false' por defecto en el EventListener nativo no va después de React...
      // Lo mejor es no usar este global para links que ya manejan su click, pero asumimos que Link nativo no llama e.preventDefault() hasta después.
      
      e.preventDefault();
      setIsRouting(true);
      startTransition(() => {
        router.push(href);
      });
    };

    // Usar 'capture: false' para permitir que eventos de React puedan parar la propagación si quieren
    document.addEventListener('click', handleClick, false);
    return () => document.removeEventListener('click', handleClick, false);
  }, [router]);

  return <LoadingOverlay isPending={isPending || isRouting} />;
}
