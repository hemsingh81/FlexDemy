import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
}

/**
 * FlexDemy mark: an open book built from two navy "page" quads that splay apart from a
 * shared center, leaving a deliberate gap between them so the badge's amber shows through
 * as the spine/binding -- one shape decision reads as both "book" (learning) and "flexed
 * open shape" (the Flex in FlexDemy). A small dot caps the spine as a rising point of
 * mastery. Single-tone (currentColor) so it stays crisp at small sizes, e.g. the 16px
 * favicon -- see public/favicon.svg, which renders this exact mark on the same amber
 * badge. Keep the two files' paths in sync if this glyph ever changes.
 */
export const Logo: React.FC<LogoProps> = ({ className, size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path d="M11 19L4 16L3 7L11 4Z" fill="currentColor" />
    <path d="M13 19L20 16L21 7L13 4Z" fill="currentColor" />
    <circle cx="12" cy="2.4" r="1.3" fill="currentColor" />
  </svg>
);
