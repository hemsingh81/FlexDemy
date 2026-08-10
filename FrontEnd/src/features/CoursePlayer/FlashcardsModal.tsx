import React, { useState, useEffect } from 'react';
import { Sparkles, X, RotateCw, Check, AlertCircle, ChevronLeft, ChevronRight, Award, Zap } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Sentence, DrilldownTopic } from '../../types';

interface Flashcard {
  id: string;
  question: string;
  answer: string;
  mastered: boolean;
  category: string;
}

interface FlashcardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lessonTitle: string;
  sentences: Sentence[];
  drilldowns?: Record<string, DrilldownTopic>;
}

export const FlashcardsModal: React.FC<FlashcardsModalProps> = ({
  isOpen,
  onClose,
  lessonTitle,
  sentences,
  drilldowns,
}) => {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [masteredCount, setMasteredCount] = useState<number>(0);

  // Parse lesson sentences & drilldown topics to generate smart AI flashcards
  const generateCards = () => {
    setIsGenerating(true);
    setTimeout(() => {
      const generated: Flashcard[] = [];

      // Generate Q&A from key sentences
      sentences.forEach((s, idx) => {
        if (s.text.length > 20 && idx % 2 === 0 && generated.length < 5) {
          const words = s.text.split(' ');
          const subjectStr = words.slice(0, 4).join(' ');
          generated.push({
            id: `fc_sent_${idx}`,
            question: `Key Concept #${idx + 1}: What does the lesson state regarding "${subjectStr}..."?`,
            answer: s.text,
            mastered: false,
            category: 'Lesson Core',
          });
        }
      });

      // Generate Q&A from drilldowns if available
      if (drilldowns) {
        Object.entries(drilldowns).forEach(([key, d], idx) => {
          if (generated.length < 8) {
            generated.push({
              id: `fc_drill_${idx}`,
              question: `Deep Drilldown (${d.title}): What is the ELI5 intuitive analogy for this concept?`,
              answer: d.level1_ELI5.analogy,
              mastered: false,
              category: 'Deep Intuition',
            });
            if (d.level2_Principles.keyFormulas.length > 0) {
              generated.push({
                id: `fc_formula_${idx}`,
                question: `Formula Challenge (${d.title}): What is the primary mathematical formula or law?`,
                answer: `${d.level2_Principles.keyFormulas[0].latex} — ${d.level2_Principles.keyFormulas[0].description}`,
                mastered: false,
                category: 'Math Formula',
              });
            }
          }
        });
      }

      // Fallback cards if lesson content is sparse
      if (generated.length === 0) {
        generated.push(
          {
            id: 'fc_fb_1',
            question: `What is the primary learning objective of "${lessonTitle}"?`,
            answer: `To master the core definitions, formulas, and practical problem-solving applications covered in this lesson module.`,
            mastered: false,
            category: 'General Objective',
          },
          {
            id: 'fc_fb_2',
            question: `How do you apply the 5-tier drilldown methodology to this lesson?`,
            answer: `Start with ELI5 analogies (L1), review core physical laws (L2), study mathematical derivations (L3), analyze real-world implementations (L4), and explore frontiers (L5).`,
            mastered: false,
            category: 'Methodology',
          }
        );
      }

      setCards(generated);
      setCurrentIndex(0);
      setIsFlipped(false);
      setMasteredCount(0);
      setIsGenerating(false);
    }, 400);
  };

  useEffect(() => {
    if (isOpen) {
      generateCards();
    }
  }, [isOpen, lessonTitle]);

  if (!isOpen) return null;

  const currentCard = cards[currentIndex];

  const handleToggleMastered = (cardId: string) => {
    const updated = cards.map((c) => {
      if (c.id === cardId) {
        const nextMastered = !c.mastered;
        if (nextMastered) {
          confetti({
            particleCount: 40,
            spread: 50,
            origin: { y: 0.6 },
            colors: ['#179765', '#BA5012', '#143358'],
          });
        }
        return { ...c, mastered: nextMastered };
      }
      return c;
    });
    setCards(updated);
    setMasteredCount(updated.filter((c) => c.mastered).length);
  };

  const handleNext = () => {
    setIsFlipped(false);
    if (currentIndex < cards.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setCurrentIndex(0);
    }
  };

  const handlePrev = () => {
    setIsFlipped(false);
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    } else {
      setCurrentIndex(cards.length - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 transition-all duration-300 ease-in-out">
      <div className="relative w-full max-w-2xl bg-white border border-[#E1DED4] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-fade-in transition-all duration-300">
        
        {/* Header */}
        <div className="p-5 border-b border-[#E1DED4] bg-[#FAF7EC] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-[#BA5012]/10 text-[#BA5012] border border-[#BA5012]/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#142030] font-display">
                AI Interactive Flashcards
              </h3>
              <p className="text-xs text-[#5E6A79]">
                {lessonTitle} • Self-Testing Practice Deck
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={generateCards}
              disabled={isGenerating}
              className="p-2.5 bg-white hover:bg-slate-100 text-[#142030] rounded-xl border border-[#E1DED4] transition-all cursor-pointer shadow-xs flex items-center space-x-1"
              title="Regenerate Deck with AI"
            >
              <RotateCw className={`w-4 h-4 text-[#143358] ${isGenerating ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2.5 bg-white hover:bg-slate-100 text-[#142030] rounded-xl border border-[#E1DED4] transition-all cursor-pointer shadow-xs"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Progress & Deck Meta */}
        <div className="px-6 py-3 bg-[#143358] text-white flex items-center justify-between text-xs font-bold">
          <div className="flex items-center space-x-2">
            <Award className="w-4 h-4 text-amber-300" />
            <span>Mastered: {masteredCount} / {cards.length} Cards</span>
          </div>
          <span>Card {cards.length > 0 ? currentIndex + 1 : 0} of {cards.length}</span>
        </div>

        {/* Card Arena */}
        <div className="p-6 sm:p-8 flex-1 overflow-y-auto flex flex-col items-center justify-center min-h-[320px] bg-[#FAF7EC]/50">
          {isGenerating ? (
            <div className="text-center py-12 space-y-3">
              <Sparkles className="w-8 h-8 text-[#BA5012] animate-spin mx-auto" />
              <p className="text-xs font-bold text-[#142030]">Parsing lesson content & generating AI flashcards...</p>
            </div>
          ) : currentCard ? (
            <div className="w-full space-y-6">
              
              {/* Flashcard container with flip interaction */}
              <div
                onClick={() => setIsFlipped(!isFlipped)}
                className={`w-full min-h-[220px] p-6 sm:p-8 rounded-3xl border transition-all duration-300 cursor-pointer shadow-md flex flex-col justify-between relative transform hover:scale-[1.01] ${
                  isFlipped
                    ? 'bg-[#143358] text-white border-[#143358]'
                    : 'bg-white text-[#142030] border-[#E1DED4]'
                }`}
              >
                <div className="flex items-center justify-between border-b pb-3 border-current/20">
                  <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${
                    isFlipped
                      ? 'bg-white/10 text-amber-300 border-white/20'
                      : 'bg-[#FAF7EC] text-[#BA5012] border-[#E1DED4]'
                  }`}>
                    {currentCard.category}
                  </span>

                  <span className={`text-[11px] font-bold ${isFlipped ? 'text-amber-300' : 'text-[#BA5012]'}`}>
                    {isFlipped ? 'Answer View (Click to flip)' : 'Question View (Click to flip)'}
                  </span>
                </div>

                <div className="py-6 text-center space-y-3">
                  <p className="text-base sm:text-lg font-bold leading-relaxed">
                    {isFlipped ? currentCard.answer : currentCard.question}
                  </p>
                  <p className={`text-[10px] uppercase tracking-wider font-extrabold ${
                    isFlipped ? 'text-white/60' : 'text-[#5E6A79]'
                  }`}>
                    {isFlipped ? '💡 Explanation / Answer' : '❓ Click Card to Reveal Answer'}
                  </p>
                </div>

                <div className="flex items-center justify-between border-t pt-3 border-current/20">
                  <span className="text-[10px] text-current/70">
                    {currentCard.mastered ? '✅ Marked as Mastered' : '⏳ Review Pending'}
                  </span>
                  <span className="text-[10px] font-bold underline">
                    Tap anywhere to flip
                  </span>
                </div>
              </div>

              {/* Controls below card */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <button
                  onClick={() => handleToggleMastered(currentCard.id)}
                  className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center space-x-1.5 transition-all cursor-pointer shadow-xs ${
                    currentCard.mastered
                      ? 'bg-[#179765] text-white border border-[#179765]'
                      : 'bg-white hover:bg-emerald-50 text-[#179765] border border-emerald-300'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  <span>{currentCard.mastered ? 'Mastered!' : 'Mark as Mastered (+10 pts)'}</span>
                </button>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={handlePrev}
                    className="p-2.5 bg-white hover:bg-slate-100 text-[#142030] rounded-xl border border-[#E1DED4] transition-all cursor-pointer shadow-xs flex items-center space-x-1 font-bold text-xs"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Prev</span>
                  </button>

                  <button
                    onClick={() => setIsFlipped(!isFlipped)}
                    className="px-4 py-2.5 bg-[#BA5012] hover:bg-[#BA5012]/90 text-white rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer"
                  >
                    <span>{isFlipped ? 'Show Question' : 'Flip Answer'}</span>
                  </button>

                  <button
                    onClick={handleNext}
                    className="p-2.5 bg-[#143358] hover:bg-[#143358]/90 text-white rounded-xl border border-[#143358] transition-all cursor-pointer shadow-xs flex items-center space-x-1 font-bold text-xs"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

            </div>
          ) : null}
        </div>

      </div>
    </div>
  );
};
