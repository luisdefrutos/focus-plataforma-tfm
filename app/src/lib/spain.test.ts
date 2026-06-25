import { describe, it, expect } from 'vitest';
import { pc2CodesForProvince, pc2CodesForCcaa, classifyEntity } from './spain';

describe('pc2CodesForProvince', () => {
  it('devuelve el código PC2 de una provincia', () => {
    expect(pc2CodesForProvince('Madrid')).toEqual(['28']);
    expect(pc2CodesForProvince('Bizkaia')).toEqual(['48']);
    expect(pc2CodesForProvince('A Coruña')).toEqual(['15']);
  });

  it('devuelve [] para una provincia inexistente', () => {
    expect(pc2CodesForProvince('Atlántida')).toEqual([]);
  });
});

describe('pc2CodesForCcaa', () => {
  it('agrupa los PC2 de todas las provincias de la CCAA', () => {
    expect(pc2CodesForCcaa('Canarias').sort()).toEqual(['35', '38']);
    expect(pc2CodesForCcaa('País Vasco').sort()).toEqual(['01', '20', '48']);
  });
});

describe('classifyEntity', () => {
  it('clasifica nulos / "Not assigned" como NA', () => {
    expect(classifyEntity(null)).toBe('NA');
    expect(classifyEntity(undefined)).toBe('NA');
    expect(classifyEntity('Not assigned')).toBe('NA');
  });

  it('clasifica por la letra del CIF (con o sin prefijo ES)', () => {
    expect(classifyEntity('B12345678')).toBe('B');
    expect(classifyEntity('ESB12345678')).toBe('B');
    expect(classifyEntity('A58818501')).toBe('A');
  });

  it('distingue NIF (dígito inicial) y NIE (X/Y/Z)', () => {
    expect(classifyEntity('12345678Z')).toBe('NIF');
    expect(classifyEntity('X1234567L')).toBe('NIE');
    expect(classifyEntity('ESX1234567L')).toBe('NIE');
  });

  it('marca como EXTRANJERO un tax_id con prefijo de país distinto de ES', () => {
    expect(classifyEntity('FR12345678')).toBe('EXTRANJERO');
    expect(classifyEntity('DE123456789')).toBe('EXTRANJERO');
  });

  it('devuelve NA para una letra inicial desconocida', () => {
    expect(classifyEntity('I12345678')).toBe('NA');
  });
});
