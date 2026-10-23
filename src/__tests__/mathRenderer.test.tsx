import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MathRenderer, parseMathSegments } from '../components/common/MathRenderer';

describe('MathRenderer and parseMathSegments', () => {
  describe('parseMathSegments', () => {
    it('returns a single text segment for plain text without math delimiters', () => {
      const raw = 'O circuito abaixo possui resistores em paralelo e série.';
      const segments = parseMathSegments(raw);
      expect(segments).toEqual([
        { type: 'text', content: raw },
      ]);
    });

    it('returns empty array for empty string', () => {
      expect(parseMathSegments('')).toEqual([]);
    });

    it('parses inline math with dollar signs $...$', () => {
      const raw = 'Determine o valor de $x^2 + y^2 = 25$ no plano cartesiano.';
      const segments = parseMathSegments(raw);
      expect(segments).toHaveLength(3);
      expect(segments[0]).toEqual({ type: 'text', content: 'Determine o valor de ' });
      expect(segments[1]).toEqual({ type: 'inline', content: 'x^2 + y^2 = 25' });
      expect(segments[2]).toEqual({ type: 'text', content: ' no plano cartesiano.' });
    });

    it('parses inline math with LaTeX parentheses \\(...\\)', () => {
      const raw = 'Considere a constante \\(\\alpha = 0,05\\) radianos.';
      const segments = parseMathSegments(raw);
      expect(segments).toHaveLength(3);
      expect(segments[0]).toEqual({ type: 'text', content: 'Considere a constante ' });
      expect(segments[1]).toEqual({ type: 'inline', content: '\\alpha = 0,05' });
      expect(segments[2]).toEqual({ type: 'text', content: ' radianos.' });
    });

    it('parses block math with double dollar signs $$...$$', () => {
      const raw = 'A equação de onda é dada por:$$\\nabla^2 \\psi - \\frac{1}{v^2}\\frac{\\partial^2 \\psi}{\\partial t^2} = 0$$Onde v é a velocidade.';
      const segments = parseMathSegments(raw);
      expect(segments).toHaveLength(3);
      expect(segments[0]).toEqual({ type: 'text', content: 'A equação de onda é dada por:' });
      expect(segments[1]).toEqual({
        type: 'block',
        content: '\\nabla^2 \\psi - \\frac{1}{v^2}\\frac{\\partial^2 \\psi}{\\partial t^2} = 0',
      });
      expect(segments[2]).toEqual({ type: 'text', content: 'Onde v é a velocidade.' });
    });

    it('parses block math with LaTeX brackets \\[...\\]', () => {
      const raw = 'Resolva a integral:\\[\\int_{0}^{\\pi} \\sin(x) dx = 2\\]conforme indicado.';
      const segments = parseMathSegments(raw);
      expect(segments).toHaveLength(3);
      expect(segments[0]).toEqual({ type: 'text', content: 'Resolva a integral:' });
      expect(segments[1]).toEqual({
        type: 'block',
        content: '\\int_{0}^{\\pi} \\sin(x) dx = 2',
      });
      expect(segments[2]).toEqual({ type: 'text', content: 'conforme indicado.' });
    });

    it('handles multiple inline and block math formulas in complex statement', () => {
      const raw = 'Seja $f(x) = x^2$ e $g(x) = 2x$. Temos:\n$$\\int f(x)g(x) dx$$\nPara todo $x > 0$.';
      const segments = parseMathSegments(raw);
      expect(segments.filter((s) => s.type === 'inline')).toHaveLength(3);
      expect(segments.filter((s) => s.type === 'block')).toHaveLength(1);
    });
  });

  describe('MathRenderer component rendering', () => {
    it('renders plain text directly inside span', () => {
      render(<MathRenderer text="Texto acadêmico simples sem fórmulas." />);
      expect(screen.getByText('Texto acadêmico simples sem fórmulas.')).toBeTruthy();
    });

    it('renders inline math with KaTeX markup', () => {
      const { container } = render(
        <MathRenderer text="A energia cinética é $E_c = \\frac{1}{2}mv^2$ no referencial." />
      );
      expect(container.querySelector('.katex')).not.toBeNull();
      expect(screen.getByText(/A energia cinética é/)).toBeTruthy();
      expect(screen.getByText(/no referencial\./)).toBeTruthy();
    });

    it('renders block math with display mode wrapper', () => {
      const { container } = render(
        <MathRenderer text="Fórmula fundamental:$$\\oint \\vec{B} \\cdot d\\vec{l} = \\mu_0 I$$" />
      );
      expect(container.querySelector('.math-block')).not.toBeNull();
      expect(container.querySelector('.katex-display')).not.toBeNull();
    });

    it('renders inline span when inline prop is true', () => {
      const { container } = render(
        <MathRenderer text="Alternativa: $x = 42$" inline />
      );
      const spanWrapper = container.querySelector('span.math-rendered-container');
      expect(spanWrapper).not.toBeNull();
      expect(container.querySelector('div.math-rendered-container')).toBeNull();
    });

    it('handles invalid math syntax gracefully without throwing errors', () => {
      expect(() => {
        render(<MathRenderer text="Expressão com sintaxe quebrada: $\\frac{1}{}$." />);
      }).not.toThrow();
    });
  });
});
