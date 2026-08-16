import React, { useMemo } from 'react';
import { parseMarkdown, type InlineNode, type MarkdownBlock, type ListItem } from '../lib/markdown';

// Renders the block tree from lib/markdown.ts as React elements. Deliberately no
// dangerouslySetInnerHTML anywhere in this file -- see that module's header for why the whole
// pipeline avoids HTML strings. Styling matches the app's reading surfaces (Lumen palette,
// --font-display for headings) so a rendered document looks like part of the product rather than
// a browser's default Markdown dump.

const renderInline = (nodes: InlineNode[], keyPrefix: string): React.ReactNode =>
  nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;
    switch (node.type) {
      case 'text':
        return <React.Fragment key={key}>{node.value}</React.Fragment>;
      case 'code':
        return (
          <code key={key} className="px-1 py-0.5 rounded bg-[#F3F0E6] text-[#BA5012] font-mono text-[0.9em]">
            {node.value}
          </code>
        );
      case 'strong':
        return (
          <strong key={key} className="font-bold text-[#142030]">
            {renderInline(node.children, key)}
          </strong>
        );
      case 'em':
        return (
          <em key={key} className="italic">
            {renderInline(node.children, key)}
          </em>
        );
      case 'link':
        return (
          // noopener/noreferrer with target=_blank: without them the opened page can reach back
          // through window.opener. The href itself was already scheme-checked by the parser.
          <a
            key={key}
            href={node.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#BA5012] underline underline-offset-2 hover:text-[#BA5012]/80"
          >
            {renderInline(node.children, key)}
          </a>
        );
      default:
        return null;
    }
  });

const HEADING_CLASSES: Record<number, string> = {
  1: 'text-xl font-extrabold mt-5 mb-2',
  2: 'text-lg font-bold mt-5 mb-2',
  3: 'text-base font-bold mt-4 mb-1.5',
  4: 'text-sm font-bold mt-3 mb-1',
  5: 'text-sm font-semibold mt-3 mb-1',
  6: 'text-xs font-semibold uppercase tracking-wide mt-3 mb-1 text-[#5E6A79]',
};

const renderListItems = (items: ListItem[], keyPrefix: string): React.ReactNode =>
  items.map((item, index) => (
    <li key={`${keyPrefix}-li-${index}`} className="leading-relaxed">
      {renderInline(item.content, `${keyPrefix}-li-${index}`)}
      {item.children.map((child, childIndex) => (
        <BlockRenderer key={`${keyPrefix}-li-${index}-c-${childIndex}`} block={child} keyPrefix={`${keyPrefix}-li-${index}-c-${childIndex}`} />
      ))}
    </li>
  ));

const BlockRenderer: React.FC<{ block: MarkdownBlock; keyPrefix: string }> = ({ block, keyPrefix }) => {
  switch (block.type) {
    case 'heading': {
      // Heading levels come from the document, so the tag is data-driven; createElement keeps that
      // honest instead of a six-way branch that would drift.
      const Tag = `h${Math.min(6, Math.max(1, block.level))}` as keyof React.JSX.IntrinsicElements;
      return React.createElement(
        Tag,
        { className: `${HEADING_CLASSES[block.level] ?? HEADING_CLASSES[6]} text-[#142030] font-display first:mt-0` },
        renderInline(block.content, keyPrefix),
      );
    }
    case 'paragraph':
      return <p className="text-[#142030] leading-relaxed my-2 first:mt-0">{renderInline(block.content, keyPrefix)}</p>;
    case 'code':
      return (
        <pre className="my-3 p-3 rounded-xl bg-[#142030] overflow-x-auto">
          <code className="text-xs font-mono text-[#F3F0E6] whitespace-pre">{block.value}</code>
        </pre>
      );
    case 'list':
      return block.ordered ? (
        <ol className="list-decimal pl-6 my-2 space-y-1 marker:text-[#5E6A79]">{renderListItems(block.items, keyPrefix)}</ol>
      ) : (
        <ul className="list-disc pl-6 my-2 space-y-1 marker:text-[#5E6A79]">{renderListItems(block.items, keyPrefix)}</ul>
      );
    case 'table':
      return (
        // Its own horizontal scroll container: a wide extracted table must not widen the page
        // (docs/FRONTEND_TRANSITIONS.md's sibling rule for wide content).
        <div className="my-3 overflow-x-auto rounded-xl border border-[#E1DED4]">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-[#FAF7EC]">
                {block.header.map((cell, index) => (
                  <th key={`${keyPrefix}-th-${index}`} className="text-left font-bold text-[#142030] px-3 py-2 border-b border-[#E1DED4]">
                    {renderInline(cell, `${keyPrefix}-th-${index}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={`${keyPrefix}-tr-${rowIndex}`} className="even:bg-[#FAFAF7]">
                  {row.map((cell, cellIndex) => (
                    <td key={`${keyPrefix}-td-${rowIndex}-${cellIndex}`} className="align-top px-3 py-2 border-b border-[#E1DED4] text-[#142030]">
                      {renderInline(cell, `${keyPrefix}-td-${rowIndex}-${cellIndex}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'blockquote':
      return (
        <blockquote className="my-3 pl-3 border-l-4 border-[#BA5012]/40 text-[#5E6A79] italic">
          {block.children.map((child, index) => (
            <BlockRenderer key={`${keyPrefix}-bq-${index}`} block={child} keyPrefix={`${keyPrefix}-bq-${index}`} />
          ))}
        </blockquote>
      );
    case 'hr':
      return <hr className="my-4 border-[#E1DED4]" />;
    default:
      return null;
  }
};

export const MarkdownViewer: React.FC<{ source: string; className?: string }> = ({ source, className }) => {
  // Parsing is pure and the source only changes when a different file is selected, so this keeps
  // a long document off the critical path of unrelated re-renders (tab switches included).
  const blocks = useMemo(() => parseMarkdown(source), [source]);

  return (
    <div className={`text-sm ${className ?? ''}`}>
      {blocks.map((block, index) => (
        <BlockRenderer key={`b-${index}`} block={block} keyPrefix={`b-${index}`} />
      ))}
    </div>
  );
};
