import React, { useContext, useMemo } from 'react';
import { AlertTriangle, CheckCircle2, ChevronRight, Info, Lightbulb, Paperclip, StickyNote, XCircle } from 'lucide-react';
import { parseMarkdown, type CalloutVariant, type InlineNode, type MarkdownBlock, type ListItem } from '../lib/markdown';
import { renderLatex } from '../lib/renderLatex';
import { useResolvedResourceUrl } from '../hooks/useResolvedResourceUrl';

// Renders the block tree from lib/markdown.ts as React elements. Deliberately no
// dangerouslySetInnerHTML anywhere in this file -- see that module's header for why the whole
// pipeline avoids HTML strings. Styling matches the app's reading surfaces (Lumen palette,
// --font-display for headings) so a rendered document looks like part of the product rather than
// a browser's default Markdown dump.

// Story 8.3, FR-30/Task 2: the minimal resolver hook this story adds -- a `resource:{id}` URI
// resolves to a real served URL at render time via this context, never a raw storage URL baked
// into the Markdown. Context (not a threaded prop) since renderInline/BlockRenderer/
// renderListItems recurse freely and a resolver is the same for the whole render tree. `null`
// (no provider, or MarkdownViewer's own resolveResourceUrl prop omitted) degrades to showing the
// image's alt text -- the same graceful degradation every other unsupported inline construct in
// this parser already gets.
type ResolveResourceUrl = (resourceId: string) => Promise<string>;
const ResourceResolverContext = React.createContext<ResolveResourceUrl | null>(null);

const ResolvedResourceImage: React.FC<{ resourceId: string; alt: string; width?: number }> = ({ resourceId, alt, width }) => {
  const resolve = useContext(ResourceResolverContext);
  const { url: src, failed } = useResolvedResourceUrl(resolve, resourceId);

  if (!resolve || failed) return <span className="italic text-[#5E6A79]">{alt}</span>;
  if (!src) return <span className="italic text-[#5E6A79]">{alt}</span>;
  // width is a percentage of the reading column (see lib/markdown.ts). max-w-full still caps it,
  // so a 100% image can never overflow its container on a narrow screen.
  return <img src={src} alt={alt} style={width ? { width: `${width}%` } : undefined} className="max-w-full rounded-lg my-2" />;
};

// Story 9.2, FR-28/FR-30/FR-31, Task 2: a download-card resolving its resourceId through the same
// resolver context resourceImage uses -- reuses that same `resource:` URI resolution mechanism
// (Story 8.3), just rendered as a labeled download card (Story 8.1's own resource-row visual
// language) instead of an inline `<img>`.
const ResolvedResourceCard: React.FC<{ resourceId: string; label: string }> = ({ resourceId, label }) => {
  const resolve = useContext(ResourceResolverContext);
  // Preserves this component's own pre-extraction behavior exactly: a resolve failure leaves
  // `href` null (renders as an anchor with no href) rather than a distinct failed state --
  // `failed` is deliberately unused here.
  const { url: href } = useResolvedResourceUrl(resolve, resourceId);

  return (
    <a
      href={href ?? undefined}
      target="_blank"
      rel="noopener noreferrer"
      className="my-2 flex items-center gap-2 px-3 py-2 rounded-lg border border-[#E1DED4] bg-[#F3F0E6] text-sm font-semibold text-[#142030] no-underline hover:border-[#BA5012]"
    >
      <Paperclip className="w-4 h-4 text-[#BA5012] shrink-0" />
      {label}
    </a>
  );
};

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
      case 'resourceImage':
        return <ResolvedResourceImage key={key} resourceId={node.resourceId} alt={node.alt} width={node.width} />;
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

// Confluence's panel palette, mapped onto this app's existing semantic colours rather than a new
// set: signal-green for success (the same #179765 the confirmation glyphs and Done badges use),
// the error red already used by failed-file rows, amber for warning, navy for info/note, and the
// accent orange the original single-variant callout shipped with for `tip`. No new colour language
// (DESIGN.md), just an existing one applied consistently.
const CALLOUT_STYLES: Record<CalloutVariant, { label: string; icon: React.ComponentType<{ className?: string }>; wrapper: string; accent: string }> = {
  note: { label: 'Note', icon: StickyNote, wrapper: 'border-[#143358]/25 bg-[#143358]/5', accent: 'text-[#143358]' },
  info: { label: 'Info', icon: Info, wrapper: 'border-[#143358]/25 bg-[#143358]/5', accent: 'text-[#143358]' },
  tip: { label: 'Tip', icon: Lightbulb, wrapper: 'border-[#BA5012]/30 bg-[#BA5012]/5', accent: 'text-[#BA5012]' },
  success: { label: 'Success', icon: CheckCircle2, wrapper: 'border-[#179765]/30 bg-[#179765]/5', accent: 'text-[#179765]' },
  warning: { label: 'Warning', icon: AlertTriangle, wrapper: 'border-[#B45309]/30 bg-[#B45309]/5', accent: 'text-[#B45309]' },
  error: { label: 'Error', icon: XCircle, wrapper: 'border-[#DC2626]/30 bg-[#DC2626]/5', accent: 'text-[#DC2626]' },
};

const renderListItems = (items: ListItem[], keyPrefix: string): React.ReactNode =>
  items.map((item, index) => (
    <li
      key={`${keyPrefix}-li-${index}`}
      className={item.checked === undefined ? 'leading-relaxed' : 'leading-relaxed flex items-start gap-2 list-none -ml-6'}
    >
      {/* A read-only checkbox, not an interactive one: this is the STUDENT reading surface, and a
          student ticking a box here would have nowhere to persist it. `disabled` + aria-checked
          keeps it announced correctly as a checkbox in a known state rather than as a control the
          student can operate and silently lose. */}
      {item.checked !== undefined && (
        <input
          type="checkbox"
          checked={item.checked}
          disabled
          readOnly
          aria-label={item.checked ? 'Completed' : 'Not completed'}
          className="mt-1 shrink-0 accent-[#179765]"
        />
      )}
      <span className={item.checked ? 'line-through text-[#5E6A79]' : undefined}>{renderInline(item.content, `${keyPrefix}-li-${index}`)}</span>
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
    // Story 9.2, FR-28: KaTeX display-mode rendering, reusing lib/renderLatex.ts (relocated from
    // features/CoursePlayer -- see that module's own header comment) rather than a second KaTeX
    // integration. No dangerouslySetInnerHTML anywhere else in this file, but KaTeX's own output
    // is trusted markup this module already had one other exception for nowhere -- this is the
    // first, scoped to exactly KaTeX's own rendered HTML, never raw document text.
    case 'math':
      return <div className="my-3 overflow-x-auto text-center" dangerouslySetInnerHTML={{ __html: renderLatex(block.value) }} />;
    // Story 9.2: no dedicated content-callout DESIGN.md token was found during this story's
    // research -- composed from this app's existing card-shell/badge-pill visual language rather
    // than inventing new unreviewed tokens; flagged here for a future UX pass.
    case 'callout': {
      // Variant-driven, defaulting to `note` -- a callout parsed before variants existed carries
      // `note` explicitly, and an unknown variant string can never reach here (parseMarkdown only
      // emits a callout for a keyword in CALLOUT_VARIANTS), but the `?? note` keeps this total.
      const style = CALLOUT_STYLES[block.variant] ?? CALLOUT_STYLES.note;
      const Icon = style.icon;
      return (
        <div className={`my-3 p-3 rounded-xl border ${style.wrapper}`}>
          <div className={`flex items-center gap-1.5 mb-1 text-[10px] font-extrabold uppercase tracking-wide ${style.accent}`}>
            <Icon className="w-3.5 h-3.5" />
            {style.label}
          </div>
          {block.children.map((child, index) => (
            <BlockRenderer key={`${keyPrefix}-co-${index}`} block={child} keyPrefix={`${keyPrefix}-co-${index}`} />
          ))}
        </div>
      );
    }
    // Native <details>/<summary>: the collapse behaviour, keyboard operability and screen-reader
    // announcement all come from the browser for free. A hand-rolled button+state version would
    // have to reimplement all three, and would also break in-page find (browsers expand a closed
    // <details> when its text matches a find) -- which matters a lot on a study page.
    case 'expand':
      return (
        <details className="my-3 rounded-xl border border-[#E1DED4] bg-white group">
          <summary className="flex items-center gap-1.5 px-3 py-2 cursor-pointer text-xs font-bold text-[#142030] list-none marker:hidden">
            <ChevronRight className="w-3.5 h-3.5 shrink-0 transition-transform group-open:rotate-90" />
            {block.title || 'Details'}
          </summary>
          <div className="px-3 pb-3 pt-0 border-t border-[#E1DED4]">
            {block.children.map((child, index) => (
              <BlockRenderer key={`${keyPrefix}-ex-${index}`} block={child} keyPrefix={`${keyPrefix}-ex-${index}`} />
            ))}
          </div>
        </details>
      );
    case 'resourceCard':
      return <ResolvedResourceCard resourceId={block.resourceId} label={block.label} />;
    default:
      return null;
  }
};

export const MarkdownViewer: React.FC<{ source: string; className?: string; resolveResourceUrl?: ResolveResourceUrl }> = ({
  source,
  className,
  resolveResourceUrl,
}) => {
  // Parsing is pure and the source only changes when a different file is selected, so this keeps
  // a long document off the critical path of unrelated re-renders (tab switches included).
  const blocks = useMemo(() => parseMarkdown(source), [source]);

  return (
    <ResourceResolverContext.Provider value={resolveResourceUrl ?? null}>
      <div className={`text-sm ${className ?? ''}`}>
        {blocks.map((block, index) => (
          <BlockRenderer key={`b-${index}`} block={block} keyPrefix={`b-${index}`} />
        ))}
      </div>
    </ResourceResolverContext.Provider>
  );
};
