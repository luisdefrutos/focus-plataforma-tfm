import { describe, it, expect } from 'vitest';
import { normalizeUsername } from './username';

describe('normalizeUsername', () => {
  it('extrae el sAMAccountName de DOMINIO\\usuario', () => {
    expect(normalizeUsername('WW001\\defru-li')).toBe('defru-li');
  });

  it('extrae el usuario de un email UPN', () => {
    expect(normalizeUsername('defru-li@tuvsud.com')).toBe('defru-li');
  });

  it('normaliza a minúsculas y recorta espacios', () => {
    expect(normalizeUsername('  Defru-Li  ')).toBe('defru-li');
  });

  it('deja un identificador simple intacto', () => {
    expect(normalizeUsername('uriza-jo')).toBe('uriza-jo');
  });
});
