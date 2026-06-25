import { describe, it, expect } from 'vitest';
import { csvCell } from './csv';

describe('csvCell', () => {
  it('convierte null/undefined en cadena vacía', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });

  it('deja texto y números simples sin tocar', () => {
    expect(csvCell('hola')).toBe('hola');
    expect(csvCell(123)).toBe('123');
  });

  it('entrecomilla (RFC-4180) cuando hay separador, comillas o salto de línea', () => {
    expect(csvCell('a;b')).toBe('"a;b"');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('línea1\nlínea2')).toBe('"línea1\nlínea2"');
    expect(csvCell('dijo "hola"')).toBe('"dijo ""hola"""');
  });

  it('neutraliza inyección de fórmulas anteponiendo un apóstrofo', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell('+1234')).toBe("'+1234");
    expect(csvCell('@handle')).toBe("'@handle");
  });

  it('preserva importes negativos con coma decimal (no son fórmulas)', () => {
    // Empieza por '-' pero es numérico → no se prefija; se entrecomilla por la coma.
    expect(csvCell('-1234,56')).toBe('"-1234,56"');
  });

  it('formatea Date como ISO YYYY-MM-DD', () => {
    expect(csvCell(new Date('2026-06-24T10:00:00Z'))).toBe('2026-06-24');
  });

  it('serializa objetos a JSON entrecomillado', () => {
    expect(csvCell({ a: 1 })).toBe('"{""a"":1}"');
  });
});
