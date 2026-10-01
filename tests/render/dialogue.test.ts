import { describe, expect, it } from 'vitest';
import { fonts, revealedLines } from '../../src/render';

const font = fonts.regular;
const text = 'Sentadilla profunda, sentencia más profunda.';
const width = font.measure('Sentadilla profunda,');

describe('Dialogue Box typewriter layout', () => {
  it('keeps each character on the line the whole Quip wraps it to', () => {
    expect(font.wrap(text, width)).toEqual(['Sentadilla profunda,', 'sentencia más', 'profunda.']);
    // "sentencia" starts on the second line even before the typewriter finishes the word.
    expect(revealedLines(font, text, 24, width)).toEqual(['Sentadilla profunda,', 'sen', '']);
  });

  it('shows nothing before the first character and everything at the end', () => {
    expect(revealedLines(font, text, 0, width)).toEqual(['', '', '']);
    expect(revealedLines(font, text, text.length, width)).toEqual(font.wrap(text, width));
  });
});
