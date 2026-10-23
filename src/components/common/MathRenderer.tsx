import React, { useMemo } from 'react';
import katex from 'katex';

interface MathRendererProps {
  text: string;
  className?: string;
  inline?: boolean;
}

interface Segment {
  type: 'text' | 'inline' | 'block';
  content: string;
}

// Regex matching:
// 1. Block: $$...$$ or \[...\]
// 2. Inline: $...$ or \(...\)
const MATH_REGEX = /\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\]|\$([^$\n]+?)\$|\\\(([\s\S]*?)\\\)/g;

export function parseMathSegments(rawText: string): Segment[] {
  if (!rawText) return [];

  // Fast path: if no math delimiters, return single text segment
  if (!rawText.includes('$') && !rawText.includes('\\(') && !rawText.includes('\\[')) {
    return [{ type: 'text', content: rawText }];
  }

  const segments: Segment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // Reset regex index
  MATH_REGEX.lastIndex = 0;

  while ((match = MATH_REGEX.exec(rawText)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: rawText.slice(lastIndex, match.index),
      });
    }

    if (match[1] !== undefined || match[2] !== undefined) {
      segments.push({
        type: 'block',
        content: (match[1] ?? match[2] ?? '').trim(),
      });
    } else if (match[3] !== undefined || match[4] !== undefined) {
      segments.push({
        type: 'inline',
        content: (match[3] ?? match[4] ?? '').trim(),
      });
    }

    lastIndex = MATH_REGEX.lastIndex;
  }

  if (lastIndex < rawText.length) {
    segments.push({
      type: 'text',
      content: rawText.slice(lastIndex),
    });
  }

  return segments;
}

function renderKaTeX(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex, {
      displayMode,
      throwOnError: false,
      output: 'htmlAndMathml',
      strict: false,
    });
  } catch (err) {
    // Graceful fallback to raw text if parsing completely fails
    return `<span class="katex-error" title="${String(err)}">${tex}</span>`;
  }
}

export function MathRenderer({ text, className = '', inline = false }: MathRendererProps) {
  const segments = useMemo(() => parseMathSegments(text), [text]);

  if (!text) return null;

  // Single text fast path
  if (segments.length === 1 && segments[0].type === 'text') {
    return <span className={`math-rendered-text ${className}`}>{text}</span>;
  }

  const Wrapper = inline ? 'span' : 'div';

  return (
    <Wrapper className={`math-rendered-container ${className}`}>
      {segments.map((seg, idx) => {
        if (seg.type === 'text') {
          return <React.Fragment key={idx}>{seg.content}</React.Fragment>;
        }

        const isBlock = seg.type === 'block';
        const html = renderKaTeX(seg.content, isBlock);

        if (isBlock) {
          return (
            <div
              key={idx}
              className="math-block"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        }

        return (
          <span
            key={idx}
            className="math-inline"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      })}
    </Wrapper>
  );
}
