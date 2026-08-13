// Story 3.1/Task 1: read-only student-facing content-tree types -- re-exports Epic 2's real
// Chapter/Topic/Subtopic/ContentBlock shapes (CourseContentEditor feature) rather than duplicating
// them by hand. This is a read, not a mutation, and both features already live under
// FrontEnd/src/features/ -- see this story's own Dev Notes for why this narrow read-only type
// reuse is fine without invoking AD-3's sanctioned (JSX) cross-feature import exception.
export type {
  Chapter,
  ContentBlock,
  ContentBlockFormat,
  NodeConfirmation,
  Subtopic,
  Topic,
} from '../CourseContentEditor/useCourseContentTree';

import type { Chapter } from '../CourseContentEditor/useCourseContentTree';

// Mock fixture standing in for a real student-facing "fetch a Published course's content tree"
// endpoint, which doesn't exist yet (BackEnd's ContentTreeController is tutor-Draft-only) -- see
// this story's own Dev Notes. Deliberately the same seed shape useCourseContentTree.ts's own
// pre-Story-2.9 mock tree used: a confirmed/unconfirmed mix, a Hindi (lang: 'hi') text block, a
// math block with real KaTeX notation, a chemistry block (mhchem), and a Topic with only direct
// Content Blocks (no Subtopic) exercising AD-20's Topic-or-Subtopic parentage.
// Story 3.2/Task 4: mock-supplied keyword list per content block id, since real keyword
// detection is Phase B's job (Story 3.7). Keyed to the same block ids the fixture below defines.
// 'wave' resolves to a real definition in useKeywordDefinition.ts's own fixture; 'energy' does
// not, deliberately exercising the "Definition unavailable" empty state.
export const MOCK_BLOCK_KEYWORDS: Record<string, string[]> = {
  block_1: ['wave', 'energy'],
};

export const makeMockContentTree = (): Chapter[] => [
  {
    id: 'chapter_1',
    title: 'Chapter 1: Waves & Chemistry',
    confirmation: 'confirmed',
    topics: [
      {
        id: 'topic_1',
        title: 'Topic 1: Wave Motion',
        confirmation: 'unconfirmed',
        contentBlocks: [],
        subtopics: [
          {
            id: 'subtopic_1',
            title: 'Subtopic 1: Introduction',
            confirmation: 'confirmed',
            contentBlocks: [
              {
                id: 'block_1',
                format: 'text',
                confirmation: 'confirmed',
                text: 'A wave transfers energy without transferring matter.',
                lang: 'en',
              },
              {
                id: 'block_2',
                format: 'math',
                confirmation: 'confirmed',
                notation: 'v = f\\lambda',
              },
            ],
          },
          {
            id: 'subtopic_2',
            title: 'Subtopic 2: तरंग गति',
            confirmation: 'unconfirmed',
            contentBlocks: [
              {
                id: 'block_3',
                format: 'text',
                confirmation: 'unconfirmed',
                text: 'तरंग ऊर्जा को स्थानांतरित करती है, पदार्थ को नहीं।',
                lang: 'hi',
              },
              {
                id: 'block_4',
                format: 'image',
                confirmation: 'unconfirmed',
                imageUrl: '/mock-assets/wave-diagram.png',
                altText: 'Diagram of a transverse wave showing crest and trough.',
              },
            ],
          },
        ],
      },
      {
        id: 'topic_2',
        title: 'Topic 2: Chemical Reactions',
        confirmation: 'confirmed',
        subtopics: [],
        contentBlocks: [
          {
            id: 'block_5',
            format: 'math',
            confirmation: 'confirmed',
            notation: '\\ce{2H2 + O2 -> 2H2O}',
          },
        ],
      },
    ],
  },
];
