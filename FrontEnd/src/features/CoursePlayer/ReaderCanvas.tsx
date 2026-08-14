import React, { useEffect, useRef } from 'react';
import { Sentence, TopicDrilldown } from '../../types';
import { SentenceCard } from './SentenceCard';
import { useInlineDrilldownState } from './useInlineDrilldownState';

interface ReaderCanvasProps {
  sentences: Sentence[];
  drilldowns?: Record<string, TopicDrilldown>;
  activeSentenceIndex: number;
  onSelectSentence: (index: number) => void;
  onOpenDrilldown?: (topicKey: string) => void;
  onOpenScratchpadForParagraph?: (index: number) => void;
}

// Reader text size is a fixed, sensible default now that the old Accessibility modal's
// user-configurable font-size control has been removed (see FlexDemy remove-accessibility-modal
// change) -- 16px was the modal's own default.
const READER_FONT_SIZE_PX = 16;

export const ReaderCanvas: React.FC<ReaderCanvasProps> = ({
  sentences,
  drilldowns = {},
  activeSentenceIndex,
  onSelectSentence,
  onOpenScratchpadForParagraph,
}) => {
  const activeSentenceRef = useRef<HTMLDivElement | null>(null);

  const drilldownState = useInlineDrilldownState();

  // Smooth auto-scroll to active sentence when reading progresses
  useEffect(() => {
    if (activeSentenceRef.current) {
      activeSentenceRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeSentenceIndex]);

  return (
    <div
      className="space-y-6 transition-all text-slate-800"
      style={{ fontSize: `${READER_FONT_SIZE_PX}px` }}
    >
      {sentences.map((sentence, index) => {
        const isActive = index === activeSentenceIndex;

        return (
          <SentenceCard
            key={sentence.id}
            sentence={sentence}
            index={index}
            isActive={isActive}
            activeRef={isActive ? activeSentenceRef : null}
            drilldowns={drilldowns}
            onSelectSentence={onSelectSentence}
            onOpenScratchpadForParagraph={onOpenScratchpadForParagraph}
            drilldownState={drilldownState}
          />
        );
      })}
    </div>
  );
};
