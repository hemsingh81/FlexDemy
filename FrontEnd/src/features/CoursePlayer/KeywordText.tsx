import React from 'react';
import { KeywordPopover } from './KeywordPopover';

interface KeywordTextProps {
  text: string;
  keywords: string[];
  lang?: string;
  activeKeyword: string | null;
  definition: string | null;
  isOverridden: boolean;
  isLoading: boolean;
  onDefine: (keyword: string) => void;
  onDismiss: () => void;
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildKeywordPattern = (keywords: string[]): RegExp | null => {
  if (keywords.length === 0) return null;
  // Longest-first so a multi-word phrase matches before a shorter keyword it contains.
  const sorted = [...keywords].sort((a, b) => b.length - a.length).map(escapeRegExp);
  return new RegExp(`\\b(${sorted.join('|')})\\b`, 'gi');
};

// Story 3.2/Task 4: wraps a block of rendered text, turning each mock-supplied keyword
// occurrence into a real <button> (never a <span onClick>, per UX-DR13's explicit rule) --
// reachable in normal Tab order and activated by both click and Enter/Space (a native <button>
// gets Enter/Space for free; no custom keydown handling here that could suppress it).
export const KeywordText: React.FC<KeywordTextProps> = ({
  text,
  keywords,
  lang,
  activeKeyword,
  definition,
  isOverridden,
  isLoading,
  onDefine,
  onDismiss,
}) => {
  const pattern = buildKeywordPattern(keywords);
  // String#split with a single-capture-group regex alternates [text, match, text, match, ...] --
  // odd indices are always the captured keyword matches.
  const parts = pattern ? text.split(pattern) : [text];

  return (
    <p lang={lang} className="text-sm leading-relaxed text-slate-800" data-testid="keyword-text">
      {parts.map((part, index) => {
        const isKeyword = pattern !== null && index % 2 === 1;
        if (!isKeyword) return <React.Fragment key={index}>{part}</React.Fragment>;

        const isOpen = activeKeyword !== null && activeKeyword.toLowerCase() === part.toLowerCase();

        return (
          <span key={index} className="relative inline-block">
            <button
              type="button"
              onClick={() => (isOpen ? onDismiss() : onDefine(part))}
              aria-expanded={isOpen}
              className="font-bold text-[#143358] underline decoration-dotted underline-offset-2 cursor-pointer"
            >
              {part}
            </button>
            {isOpen && (
              <KeywordPopover
                keyword={part}
                definition={definition}
                isOverridden={isOverridden}
                isLoading={isLoading}
                onDismiss={onDismiss}
              />
            )}
          </span>
        );
      })}
    </p>
  );
};
