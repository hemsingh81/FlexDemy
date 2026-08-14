import React, { useState, useEffect, useRef } from 'react';
import {
  NotebookPen,
  X,
  Plus,
  Trash2,
  Edit2,
  Check,
  Tag,
  Copy,
  BookOpen,
  AlignLeft,
  Search,
  Sparkles,
  Bookmark,
  Share2,
  Mic,
  MicOff,
} from 'lucide-react';
import { ScratchpadNote, Course, Lesson, Module } from '../../types';
import { getNotesForCourse, addNote, saveNotesForCourse } from '../../services/scratchpadService';
import { COPY_CONFIRMATION_DISMISS_MS } from '../../lib/constants';

// Minimal local shapes for the Web Speech API's callback events -- only the fields this
// component actually reads, standing in for the `lib.dom.d.ts` types TypeScript doesn't ship
// (SpeechRecognition is still non-standard/vendor-prefixed) without resorting to `any`.
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  [index: number]: { transcript: string };
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechRecognitionResultLike };
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

interface ScratchpadPanelProps {
  course: Course;
  currentLesson: Lesson;
  currentModule?: Module;
  currentParagraphIndex?: number;
  isOpen: boolean;
  onClose: () => void;
  onSelectParagraph?: (index: number) => void;
  initialParagraphIndex?: number | null;
}

export const ScratchpadPanel: React.FC<ScratchpadPanelProps> = ({
  course,
  currentLesson,
  currentModule,
  currentParagraphIndex = 0,
  isOpen,
  onClose,
  onSelectParagraph,
  initialParagraphIndex,
}) => {
  const [notes, setNotes] = useState<ScratchpadNote[]>([]);
  const [noteText, setNoteText] = useState<string>('');
  const [attachToParagraph, setAttachToParagraph] = useState<boolean>(true);
  const [selectedParagraph, setSelectedParagraph] = useState<number>(
    initialParagraphIndex ?? currentParagraphIndex
  );
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editText, setEditText] = useState<string>('');
  const [filterQuery, setFilterQuery] = useState<string>('');
  const [filterScope, setFilterScope] = useState<'current_lesson' | 'course_all'>('current_lesson');
  const [copiedNoteId, setCopiedNoteId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [speechSupported, setSpeechSupported] = useState<boolean>(true);
  const recognitionRef = useRef<any>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) {
        setNoteText((prev) => (prev ? `${prev} ${finalTranscript}` : finalTranscript));
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error('Failed to start speech recognition', err);
      }
    }
  };

  // Update selected paragraph when prop or initial paragraph changes
  useEffect(() => {
    if (initialParagraphIndex !== undefined && initialParagraphIndex !== null) {
      setSelectedParagraph(initialParagraphIndex);
      setAttachToParagraph(true);
    } else {
      setSelectedParagraph(currentParagraphIndex);
    }
  }, [initialParagraphIndex, currentParagraphIndex]);

  // Load notes for this course via the scratchpad service (AD-1: localStorage
  // access is confined to services/scratchpadService.ts)
  useEffect(() => {
    setNotes(getNotesForCourse(course.id));
  }, [course.id]);

  const handleAddNote = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!noteText.trim()) return;

    const targetSentence =
      attachToParagraph && currentLesson.sentences[selectedParagraph]
        ? currentLesson.sentences[selectedParagraph].text
        : undefined;

    const newNote: ScratchpadNote = {
      id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      courseId: course.id,
      lessonId: currentLesson.id,
      lessonTitle: currentLesson.title,
      moduleTitle: currentModule?.title,
      paragraphIndex: attachToParagraph ? selectedParagraph : undefined,
      paragraphText: targetSentence,
      content: noteText.trim(),
      createdAt: new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      updatedAt: new Date().toISOString(),
    };

    const updatedAll = addNote(newNote);
    setNotes(updatedAll.filter((n) => n.courseId === course.id));
    setNoteText('');
  };

  const handleDeleteNote = (id: string) => {
    const updated = notes.filter((n) => n.id !== id);
    setNotes(saveNotesForCourse(course.id, updated));
  };

  const handleStartEdit = (note: ScratchpadNote) => {
    setEditingNoteId(note.id);
    setEditText(note.content);
  };

  const handleSaveEdit = (id: string) => {
    if (!editText.trim()) return;
    const updated = notes.map((n) =>
      n.id === id ? { ...n, content: editText.trim(), updatedAt: new Date().toISOString() } : n
    );
    setNotes(saveNotesForCourse(course.id, updated));
    setEditingNoteId(null);
    setEditText('');
  };

  const handleCopyNote = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedNoteId(id);
    setTimeout(() => setCopiedNoteId(null), COPY_CONFIRMATION_DISMISS_MS);
  };

  // Filter notes
  const filteredNotes = notes.filter((note) => {
    const matchesScope =
      filterScope === 'current_lesson'
        ? note.lessonId === currentLesson.id
        : note.courseId === course.id;

    const matchesSearch =
      note.content.toLowerCase().includes(filterQuery.toLowerCase()) ||
      note.lessonTitle.toLowerCase().includes(filterQuery.toLowerCase()) ||
      (note.paragraphText && note.paragraphText.toLowerCase().includes(filterQuery.toLowerCase()));

    return matchesScope && matchesSearch;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-white border-l border-[#E1DED4] shadow-2xl flex flex-col justify-between overflow-hidden animate-slide-left">

      {/* Top Header */}
      <div className="p-4 bg-[#143358] text-white flex items-center justify-between border-b border-white/10">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-[#BA5012] text-white shadow-xs">
            <NotebookPen className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-tight">Lesson Scratchpad & Notes</h3>
            <p className="text-[11px] text-slate-200">
              Personal study notes saved locally
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title="Close Scratchpad"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 bg-[#FAF7EC]/50">

        {/* Active Context Bar */}
        <div className="p-3 rounded-2xl bg-white border border-[#E1DED4] shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-[#142030]">
            <span className="flex items-center space-x-1.5 truncate">
              <BookOpen className="w-3.5 h-3.5 text-[#BA5012] shrink-0" />
              <span className="truncate">{currentLesson.title}</span>
            </span>
            <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 bg-[#FAF7EC] text-[#143358] rounded-md border border-[#E1DED4]">
              Para #{currentParagraphIndex + 1}
            </span>
          </div>

          {currentLesson.sentences[currentParagraphIndex] && (
            <p className="text-[11px] text-[#5E6A79] line-clamp-2 italic border-l-2 border-[#BA5012] pl-2 py-0.5">
              "{currentLesson.sentences[currentParagraphIndex].text}"
            </p>
          )}
        </div>

        {/* Create Note Input Card */}
        <form onSubmit={handleAddNote} className="p-4 rounded-2xl bg-white border border-[#E1DED4] shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-[#142030] flex items-center space-x-1.5">
              <Plus className="w-4 h-4 text-[#BA5012]" />
              <span>New Personal Note</span>
            </span>

            {/* Attach to Paragraph Toggle */}
            <label className="inline-flex items-center space-x-1.5 text-[11px] font-bold text-[#5E6A79] cursor-pointer">
              <input
                type="checkbox"
                checked={attachToParagraph}
                onChange={(e) => setAttachToParagraph(e.target.checked)}
                className="rounded border-[#E1DED4] text-[#BA5012] focus:ring-[#BA5012] w-3.5 h-3.5 cursor-pointer"
              />
              <span>Link to Para #{selectedParagraph + 1}</span>
            </label>
          </div>

          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Type your notes, takeaways, formulas, or key insights here..."
            rows={3}
            className="w-full p-3 rounded-xl bg-[#FAF7EC]/80 border border-[#E1DED4] text-xs text-[#142030] placeholder-[#5E6A79] focus:outline-none focus:ring-2 focus:ring-[#BA5012] resize-none"
          />

          <div className="flex items-center justify-between pt-1">
            {/* Speech Recognition Voice Dictation Button */}
            {speechSupported ? (
              <button
                type="button"
                onClick={toggleListening}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 border transition-all cursor-pointer ${
                  isListening
                    ? 'bg-red-500 text-white border-red-600 animate-pulse shadow-md'
                    : 'bg-[#FAF7EC] hover:bg-[#143358] text-[#143358] hover:text-white border border-[#E1DED4]'
                }`}
                title={isListening ? 'Click to stop voice dictation' : 'Click to dictate notes using Web Speech API'}
              >
                {isListening ? (
                  <>
                    <MicOff className="w-3.5 h-3.5 text-white" />
                    <span>Listening... (Click to stop)</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-3.5 h-3.5 text-[#BA5012]" />
                    <span>Dictate Note</span>
                  </>
                )}
              </button>
            ) : (
              <span className="text-[10px] text-[#5E6A79]">
                Saved locally
              </span>
            )}

            <button
              type="submit"
              disabled={!noteText.trim()}
              className="px-4 py-2 bg-[#143358] hover:bg-[#143358]/90 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs flex items-center space-x-1.5 transition-all cursor-pointer"
            >
              <Bookmark className="w-3.5 h-3.5 text-[#BA5012]" />
              <span>Save Note</span>
            </button>
          </div>
        </form>

        {/* Filter & Saved Notes List Section */}
        <div className="space-y-3">

          <div className="flex items-center justify-between">
            <h4 className="text-xs font-extrabold text-[#142030] uppercase tracking-wider flex items-center space-x-1.5">
              <AlignLeft className="w-4 h-4 text-[#143358]" />
              <span>Saved Notes ({filteredNotes.length})</span>
            </h4>

            {/* Scope Filter Toggle */}
            <div className="flex items-center bg-white p-0.5 rounded-lg border border-[#E1DED4] text-[10px] font-bold">
              <button
                type="button"
                onClick={() => setFilterScope('current_lesson')}
                className={`px-2 py-1 rounded-md cursor-pointer transition-colors ${
                  filterScope === 'current_lesson'
                    ? 'bg-[#143358] text-white'
                    : 'text-[#5E6A79] hover:text-[#142030]'
                }`}
              >
                This Lesson
              </button>
              <button
                type="button"
                onClick={() => setFilterScope('course_all')}
                className={`px-2 py-1 rounded-md cursor-pointer transition-colors ${
                  filterScope === 'course_all'
                    ? 'bg-[#143358] text-white'
                    : 'text-[#5E6A79] hover:text-[#142030]'
                }`}
              >
                All Course Notes
              </button>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#5E6A79]" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Search saved notes..."
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-[#E1DED4] rounded-xl text-xs text-[#142030] placeholder-[#5E6A79] focus:outline-none focus:ring-1 focus:ring-[#BA5012]"
            />
          </div>

          {/* List of Notes */}
          {filteredNotes.length === 0 ? (
            <div className="p-8 text-center bg-white border border-[#E1DED4] rounded-2xl space-y-2">
              <NotebookPen className="w-8 h-8 text-[#5E6A79] mx-auto opacity-50" />
              <p className="text-xs font-bold text-[#142030]">No notes saved yet</p>
              <p className="text-[11px] text-[#5E6A79]">
                Write down key takeaways or questions as you study this lesson.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredNotes.map((note) => (
                <div
                  key={note.id}
                  className="p-3.5 bg-white rounded-2xl border border-[#E1DED4] shadow-2xs space-y-2.5 transition-all hover:border-[#143358] group"
                >
                  <div className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center space-x-1.5">
                      {note.paragraphIndex !== undefined ? (
                        <button
                          onClick={() => onSelectParagraph && onSelectParagraph(note.paragraphIndex!)}
                          className="px-2 py-0.5 rounded-md bg-[#FAF7EC] text-[#143358] font-extrabold border border-[#E1DED4] hover:bg-[#143358] hover:text-white transition-colors cursor-pointer"
                          title="Click to jump to this paragraph"
                        >
                          Para #{note.paragraphIndex + 1}
                        </button>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-[#FAF7EC] text-[#5E6A79] font-bold border border-[#E1DED4]">
                          Lesson Note
                        </span>
                      )}
                      <span className="text-[#5E6A79] font-medium">{note.createdAt}</span>
                    </div>

                    <div className="flex items-center space-x-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleCopyNote(note.id, note.content)}
                        className="p-1 text-[#5E6A79] hover:text-[#142030] cursor-pointer"
                        title="Copy note text"
                      >
                        {copiedNoteId === note.id ? (
                          <Check className="w-3.5 h-3.5 text-[#179765]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <button
                        onClick={() => handleStartEdit(note)}
                        className="p-1 text-[#5E6A79] hover:text-[#143358] cursor-pointer"
                        title="Edit note"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        className="p-1 text-[#5E6A79] hover:text-red-600 cursor-pointer"
                        title="Delete note"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {note.paragraphText && (
                    <p className="text-[11px] text-[#5E6A79] bg-[#FAF7EC] p-2 rounded-xl italic border-l-2 border-[#BA5012] line-clamp-2">
                      "{note.paragraphText}"
                    </p>
                  )}

                  {editingNoteId === note.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-[#BA5012] text-xs text-[#142030] focus:outline-none"
                        rows={3}
                      />
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => setEditingNoteId(null)}
                          className="px-2.5 py-1 text-xs text-[#5E6A79] hover:text-[#142030] cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveEdit(note.id)}
                          className="px-3 py-1 bg-[#143358] text-white rounded-lg text-xs font-bold cursor-pointer"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-[#142030] font-medium leading-relaxed whitespace-pre-wrap">
                      {note.content}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

        </div>

      </div>

      {/* Footer Summary Export Action */}
      <div className="p-3 bg-white border-t border-[#E1DED4] flex items-center justify-between text-xs">
        <span className="text-[11px] text-[#5E6A79]">
          {filteredNotes.length} notes saved for this course
        </span>

        <button
          onClick={() => {
            const allText = filteredNotes
              .map((n, i) => `Note ${i + 1} (${n.lessonTitle}): ${n.content}`)
              .join('\n\n');
            navigator.clipboard.writeText(allText);
            alert('All notes copied to clipboard!');
          }}
          disabled={filteredNotes.length === 0}
          className="px-3 py-1.5 bg-[#FAF7EC] hover:bg-slate-100 border border-[#E1DED4] text-[#142030] font-bold text-xs rounded-xl flex items-center space-x-1 disabled:opacity-50 cursor-pointer"
        >
          <Share2 className="w-3.5 h-3.5 text-[#143358]" />
          <span>Copy All Notes</span>
        </button>
      </div>

    </div>
  );
};
