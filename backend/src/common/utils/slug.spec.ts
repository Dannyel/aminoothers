import { escapeLike, slugify } from './slug.js';

describe('slugify', () => {
  it('quita tildes, mayúsculas y signos', () => {
    expect(slugify('Acetaminofén 500 mg')).toBe('acetaminofen-500-mg');
    expect(slugify('  Niños & Bebés  ')).toBe('ninos-bebes');
    expect(slugify('Ácido Acetilsalicílico 5%')).toBe(
      'acido-acetilsalicilico-5-pct',
    );
  });

  it('respeta la longitud máxima sin dejar guiones al final', () => {
    expect(slugify('abc def ghi', 7)).toBe('abc-def');
  });
});

describe('escapeLike', () => {
  it('escapa los comodines de LIKE', () => {
    expect(escapeLike('50%_x\\')).toBe('50\\%\\_x\\\\');
  });
});
