import React, { useEffect, useState } from 'react';
import {
  Users,
  MessageSquare,
  PenTool,
  Send,
  Plus,
  Play,
  Pause,
  CheckCircle2,
  Sparkles,
  Smile,
  X,
  Volume2,
} from 'lucide-react';
import { StudyGroupRoom } from '../../types';
import { useGroupStudy } from './useGroupStudy';

export const GroupStudyView: React.FC = () => {
  const { rooms, userLanguage, isLoading } = useGroupStudy();

  const [activeRoomId, setActiveRoomId] = useState<string>('');
  const [chatInput, setChatInput] = useState('');
  const [localRooms, setLocalRooms] = useState<StudyGroupRoom[]>([]);
  const [whiteboardText, setWhiteboardText] = useState('');

  useEffect(() => {
    if (!isLoading) {
      setLocalRooms(rooms);
      setActiveRoomId(rooms[0]?.id || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, rooms]);

  if (isLoading) return null;

  const activeRoom =
    localRooms.find((r) => r.id === activeRoomId) || localRooms[0];

  const handleSendMessage = (e?: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    const messageContent = customText || chatInput;
    if (!messageContent.trim() || !activeRoom) return;

    const newMsg = {
      id: `msg_${Date.now()}`,
      sender: 'Hem Singh (You)',
      text: messageContent.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setLocalRooms((prev) =>
      prev.map((r) =>
        r.id === activeRoom.id
          ? { ...r, chatMessages: [...r.chatMessages, newMsg] }
          : r
      )
    );
    if (!customText) setChatInput('');

    // Simulate instant peer response for real-time collaboration feel
    setTimeout(() => {
      const peerNames = activeRoom.members.filter((m) => !m.name.includes('Hem'));
      if (peerNames.length > 0) {
        const randomPeer = peerNames[Math.floor(Math.random() * peerNames.length)];
        const tips = [
          `💡 Good point! I noted that down too.`,
          `👍 Makes total sense for this lesson section.`,
          `⚡ Thanks for sharing that insight!`,
          `❓ Let's check paragraph 3 together to verify that step.`,
        ];
        const randomTip = tips[Math.floor(Math.random() * tips.length)];

        const peerMsg = {
          id: `msg_${Date.now() + 1}`,
          sender: randomPeer.name,
          text: randomTip,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        setLocalRooms((prevRooms) =>
          prevRooms.map((r) =>
            r.id === activeRoom.id
              ? { ...r, chatMessages: [...r.chatMessages, peerMsg] }
              : r
          )
        );
      }
    }, 1500);
  };

  const handleAddWhiteboardNote = () => {
    if (!whiteboardText.trim() || !activeRoom) return;

    const newElement = {
      id: `w_${Date.now()}`,
      type: 'text' as const,
      content: whiteboardText,
      color: '#3b82f6',
      x: Math.floor(Math.random() * 150) + 20,
      y: Math.floor(Math.random() * 100) + 30,
    };

    setLocalRooms((prev) =>
      prev.map((r) =>
        r.id === activeRoom.id
          ? { ...r, whiteboardElements: [...r.whiteboardElements, newElement] }
          : r
      )
    );
    setWhiteboardText('');
  };

  return (
    <div className="w-full space-y-8 pb-12">

      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 flex items-center space-x-3">
          <Users className="w-8 h-8 text-indigo-600" />
          <span>Synchronous Group Study Rooms</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Collaborate synchronously with peers on course lessons, share interactive whiteboards, and solve math problems together.
        </p>
      </div>

      {/* Room Tabs / Selectors */}
      <div className="flex items-center space-x-3 overflow-x-auto pb-2">
        {localRooms.map((room) => (
          <button
            key={room.id}
            onClick={() => setActiveRoomId(room.id)}
            className={`p-4 rounded-2xl text-xs font-bold transition-all border flex items-center space-x-3 min-w-max cursor-pointer ${
              activeRoom.id === room.id
                ? 'bg-[#143358] text-white border-[#143358] shadow-md shadow-[#143358]/20'
                : 'bg-white text-[#142030] border-[#E1DED4] hover:bg-[#FAF7EC]'
            }`}
          >
            <div className="flex -space-x-2">
              {room.members.slice(0, 3).map((m, idx) => (
                <img
                  key={idx}
                  src={m.avatar}
                  alt={m.name}
                  className="w-6 h-6 rounded-full border-2 border-white object-cover"
                />
              ))}
            </div>
            <div>
              <p className={`font-bold ${activeRoom.id === room.id ? 'text-white' : 'text-[#142030]'}`}>{room.name}</p>
              <p className={`text-[10px] ${activeRoom.id === room.id ? 'text-amber-200' : 'text-[#5E6A79]'}`}>{room.activeCount} Active Peers</p>
            </div>
          </button>
        ))}
      </div>

      {/* Main Study Room View */}
      {activeRoom && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left Column (2/3): Live Synchronized Reader & Shared Whiteboard */}
          <div className="lg:col-span-2 space-y-6">

            {/* Live Synchronized Reader Status Bar - Matched to Lumen Ink Navy #143358 */}
            <div className="p-6 rounded-3xl bg-[#143358] text-white space-y-3 shadow-xl border border-white/10 relative overflow-hidden">
              <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-[#EC7B38]/15 rounded-full blur-2xl pointer-events-none" />

              <div className="flex items-center justify-between text-xs relative z-10">
                <span className="font-bold text-[#EC7B38] uppercase tracking-wider flex items-center space-x-1.5">
                  <Volume2 className="w-4 h-4 animate-pulse text-[#EC7B38]" />
                  <span>Synchronous Session Active</span>
                </span>
                <span className="bg-white/10 px-3 py-1 rounded-full text-amber-200 border border-white/15 text-[10px] font-bold">
                  Host: {activeRoom.hostName}
                </span>
              </div>

              <h3 className="text-lg font-bold font-display text-white relative z-10">{activeRoom.currentLessonTitle}</h3>
              <p className="text-xs text-slate-100 italic bg-white/10 p-3.5 rounded-2xl border border-white/10 relative z-10">
                "{activeRoom.currentSentenceText}"
              </p>
            </div>

            {/* Shared Collaborative Whiteboard Canvas */}
            <div className="p-6 rounded-3xl bg-white border border-[#E1DED4] shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#142030] flex items-center space-x-2">
                  <PenTool className="w-4 h-4 text-[#143358]" />
                  <span>Shared Collaborative Whiteboard</span>
                </h3>
                <span className="text-[10px] text-[#5E6A79] font-semibold bg-[#FAF7EC] px-2.5 py-0.5 rounded-full border border-[#E1DED4]">Live Sync</span>
              </div>

              {/* Whiteboard Surface */}
              <div className="relative h-64 bg-[#FCFAF4] rounded-2xl border border-[#E1DED4] p-4 overflow-hidden shadow-inner">
                {activeRoom.whiteboardElements.map((elem) => (
                  <div
                    key={elem.id}
                    className="absolute p-2 rounded-lg bg-[#143358] border border-[#143358] text-white text-xs font-mono shadow-sm animate-fade-in"
                    style={{ left: `${elem.x}px`, top: `${elem.y}px` }}
                  >
                    {elem.content}
                  </div>
                ))}
                {activeRoom.whiteboardElements.length === 0 && (
                  <div className="flex items-center justify-center h-full text-xs text-[#5E6A79]">
                    Add notes or formulas below to project onto the shared whiteboard.
                  </div>
                )}
              </div>

              {/* Add Note Controls */}
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={whiteboardText}
                  onChange={(e) => setWhiteboardText(e.target.value)}
                  placeholder="Type formula or note for whiteboard..."
                  className="flex-1 px-3.5 py-2.5 bg-[#FAF7EC] border border-[#E1DED4] rounded-xl text-xs text-[#142030] placeholder-[#5E6A79] focus:outline-none focus:ring-2 focus:ring-[#EC7B38]"
                />
                <button
                  onClick={handleAddWhiteboardNote}
                  className="px-4 py-2.5 bg-[#143358] hover:bg-[#143358]/90 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  Project Note
                </button>
              </div>

            </div>

          </div>

          {/* Right Column (1/3): Real-Time Chat & Peer Roster */}
          <div className="p-6 rounded-3xl bg-white border border-[#E1DED4] shadow-xs flex flex-col h-[520px]">

            <div className="pb-3 border-b border-[#E1DED4] space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase text-[#5E6A79] tracking-wider flex items-center space-x-2">
                  <MessageSquare className="w-4 h-4 text-[#143358]" />
                  <span>Real-Time Peer Chat</span>
                </h3>
                <span className="text-[10px] text-[#179765] font-extrabold flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-[#179765] animate-pulse"></span>
                  <span>{activeRoom.members.length} Online</span>
                </span>
              </div>

              {/* Active Peer Avatars */}
              <div className="flex items-center space-x-1.5 overflow-x-auto pt-1 pb-1">
                {activeRoom.members.map((member, idx) => (
                  <div key={idx} className="flex items-center space-x-1 px-2 py-1 rounded-full bg-[#FAF7EC] border border-[#E1DED4] shrink-0 text-[10px] font-bold text-[#142030]">
                    <img src={member.avatar} alt={member.name} className="w-4 h-4 rounded-full object-cover" />
                    <span className="truncate max-w-[80px]">{member.name.split(' ')[0]}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Tip Shortcuts */}
            <div className="py-2 border-b border-[#E1DED4]/60 flex items-center gap-1.5 overflow-x-auto">
              {[
                { label: '💡 Tip', text: '💡 Study Tip: Review key terms before the quiz!' },
                { label: '❓ Question', text: '❓ Can someone clarify the step in paragraph 2?' },
                { label: '⚡ Solution', text: '⚡ Key formula: E = mc² applies here!' },
                { label: '👏 Praise', text: '👏 Great explanation everyone!' },
              ].map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendMessage(undefined, chip.text)}
                  className="px-2.5 py-1 rounded-lg bg-[#FAF7EC] hover:bg-[#143358] text-[#143358] hover:text-white border border-[#E1DED4] text-[10px] font-bold transition-all shrink-0 cursor-pointer"
                  title={`Send quick share: ${chip.text}`}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {/* Chat Log */}
            <div className="flex-1 my-3 overflow-y-auto space-y-3 pr-1 text-xs">
              {activeRoom.chatMessages.map((msg) => {
                const isUser = msg.sender.includes('You') || msg.sender.includes('Hem');
                return (
                  <div key={msg.id} className="space-y-0.5">
                    <div className="flex items-center justify-between text-[10px] text-[#5E6A79]">
                      <span className={`font-bold ${isUser ? 'text-[#EC7B38]' : 'text-[#142030]'}`}>
                        {msg.sender}
                      </span>
                      <span>{msg.timestamp}</span>
                    </div>
                    <p className={`p-2.5 rounded-xl border text-xs leading-relaxed ${
                      isUser
                        ? 'bg-[#143358] text-white border-[#143358]'
                        : 'bg-[#FAF7EC] border-[#E1DED4] text-[#142030]'
                    }`}>
                      {msg.text}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Send Input */}
            <form onSubmit={handleSendMessage} className="pt-2 border-t border-[#E1DED4] flex items-center space-x-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Share a tip or ask peers..."
                className="flex-1 px-3 py-2 bg-[#FAF7EC] border border-[#E1DED4] rounded-xl text-xs text-[#142030] placeholder-[#5E6A79] focus:outline-none focus:ring-2 focus:ring-[#EC7B38]"
              />
              <button
                type="submit"
                disabled={!chatInput.trim()}
                className="p-2 bg-[#143358] hover:bg-[#143358]/90 disabled:opacity-50 text-white rounded-xl shadow-xs cursor-pointer transition-all"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>

          </div>

        </div>
      )}

    </div>
  );
};
