import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Formatea un importe en euros con separador de miles español. Sin decimales. */
export function formatCurrency(value: number | bigint | null | undefined, opts?: { compact?: boolean }): string {
  if (value == null) return '—';
  const n = typeof value === 'bigint' ? Number(value) : value;
  const fmt = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    notation: opts?.compact ? 'compact' : 'standard',
    compactDisplay: 'short',
  });
  return fmt.format(n);
}

/** Formatea un número con separador de miles español. Sin decimales. */
export function formatNumber(value: number | bigint | null | undefined): string {
  if (value == null) return '—';
  const n = typeof value === 'bigint' ? Number(value) : value;
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(n);
}

/** Formatea una fecha como dd/mm/yyyy. */
export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'short' }).format(d);
}
