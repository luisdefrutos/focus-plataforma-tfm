import { describe, it, expect } from 'vitest';
import { escapeLike } from './sql';

describe('escapeLike', () => {
  it('deja el texto sin metacaracteres intacto', () => {
    expect(escapeLike('abc')).toBe('abc');
    expect(escapeLike('')).toBe('');
  });

  it('escapa el comodín de porcentaje', () => {
    expect(escapeLike('50%')).toBe('50\\%');
  });

  it('escapa el comodín de subrayado', () => {
    expect(escapeLike('a_b')).toBe('a\\_b');
  });

  it('escapa la barra invertida', () => {
    expect(escapeLike('a\\b')).toBe('a\\\\b');
  });

  it('escapa varios metacaracteres a la vez', () => {
    expect(escapeLike('100%_done\\')).toBe('100\\%\\_done\\\\');
  });
});
