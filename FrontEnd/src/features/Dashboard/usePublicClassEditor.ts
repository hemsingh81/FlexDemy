import { FormEvent, useState } from 'react';
import {
  PublicLiveClass,
  SubjectCategory,
  TutorCalendarSlot,
  UserProfile,
} from '../../types';
import { useToast } from '../../context/ToastContext';

// Extracted from TutorEducatorHubView.tsx: owns the "create/edit a Public Live Class" side-panel
// form state, plus the logic for pre-filling that form either from an existing calendar slot or
// from an existing public class, and for saving the result back out (broadcasting the class and
// syncing the linked calendar slot).
export const usePublicClassEditor = (
  user: UserProfile,
  tutorSlots: TutorCalendarSlot[],
  publicClasses: PublicLiveClass[],
  onAnnouncePublicClass: (newClass: PublicLiveClass) => void,
  onUpdateSlot?: (updatedSlot: TutorCalendarSlot) => void
) => {
  const { showToast } = useToast();

  const [isPublicClassModalOpen, setIsPublicClassModalOpen] = useState(false);
  const [selectedSlotForEdit, setSelectedSlotForEdit] = useState<TutorCalendarSlot | null>(null);
  const [editingPublicClass, setEditingPublicClass] = useState<PublicLiveClass | null>(null);

  // Form fields for Public Live Class
  const [pcTitle, setPcTitle] = useState('');
  const [pcDescription, setPcDescription] = useState('');
  const [pcSubject, setPcSubject] = useState<SubjectCategory>('physics');
  const [pcDate, setPcDate] = useState('2026-08-10');
  const [pcTime, setPcTime] = useState('04:00 PM EST');
  const [pcDuration, setPcDuration] = useState(60);
  const [pcFlatPrice, setPcFlatPrice] = useState(25.00);
  const [pcPricePerMinute, setPcPricePerMinute] = useState(0.50);
  const [pcMeetingUrl, setPcMeetingUrl] = useState('https://meet.flexdemy.edu/public-quantum-101');
  const [pcSessionType, setPcSessionType] = useState<'public_class' | 'one_on_one'>('public_class');

  const openForSlot = (slot: TutorCalendarSlot) => {
    setSelectedSlotForEdit(slot);

    // Look up if a PublicLiveClass exists for this slot date or topic or if slot is public_class
    const matchedClass = publicClasses.find(
      (c) =>
        c.scheduledDate === slot.date ||
        (slot.topic && c.title.toLowerCase().includes(slot.topic.toLowerCase())) ||
        slot.sessionType === 'public_class'
    );

    if (matchedClass) {
      setEditingPublicClass(matchedClass);
      setPcTitle(matchedClass.title);
      setPcDescription(matchedClass.description);
      setPcSubject(matchedClass.subject || 'physics');
      setPcDate(matchedClass.scheduledDate || slot.date);
      setPcTime(matchedClass.scheduledTime || slot.startTime);
      setPcDuration(matchedClass.durationMinutes || slot.durationMinutes);
      setPcFlatPrice(matchedClass.flatPrice || 25.0);
      setPcPricePerMinute(matchedClass.pricePerMinute || slot.ratePerMinute || 0.50);
      setPcMeetingUrl(matchedClass.meetingUrl || 'https://meet.flexdemy.edu/public-room');
      setPcSessionType('public_class');
    } else {
      setEditingPublicClass(null);
      setPcTitle(slot.topic ? `Live Masterclass: ${slot.topic}` : 'Public Live Masterclass Session');
      setPcDescription('Interactive live broadcast covering key concept proofs, problem solving, and live student Q&A.');
      setPcSubject('physics');
      setPcDate(slot.date);
      setPcTime(slot.startTime);
      setPcDuration(slot.durationMinutes);
      setPcFlatPrice(25.0);
      setPcPricePerMinute(slot.ratePerMinute || 0.50);
      setPcMeetingUrl(`https://meet.flexdemy.edu/public-room-${slot.id}`);
      setPcSessionType(slot.sessionType === 'public_class' ? 'public_class' : 'public_class');
    }

    setIsPublicClassModalOpen(true);
  };

  const openForClassItem = (pClass: PublicLiveClass) => {
    setEditingPublicClass(pClass);
    const matchedSlot = tutorSlots.find(
      (s) => s.date === pClass.scheduledDate || (s.topic && s.topic.toLowerCase().includes(pClass.title.toLowerCase()))
    );
    setSelectedSlotForEdit(matchedSlot || null);

    setPcTitle(pClass.title);
    setPcDescription(pClass.description);
    setPcSubject(pClass.subject || 'physics');
    setPcDate(pClass.scheduledDate);
    setPcTime(pClass.scheduledTime);
    setPcDuration(pClass.durationMinutes);
    setPcFlatPrice(pClass.flatPrice);
    setPcPricePerMinute(pClass.pricePerMinute);
    setPcMeetingUrl(pClass.meetingUrl || 'https://meet.flexdemy.edu/live-room');
    setPcSessionType('public_class');
    setIsPublicClassModalOpen(true);
  };

  const openNew = () => {
    setSelectedSlotForEdit(null);
    setEditingPublicClass(null);
    setPcTitle('');
    setPcDescription('');
    setPcSubject('physics');
    setPcDate('2026-08-10');
    setPcTime('04:00 PM EST');
    setPcDuration(60);
    setPcFlatPrice(30.0);
    setPcPricePerMinute(0.50);
    setPcMeetingUrl(`https://meet.flexdemy.edu/masterclass-${Date.now().toString().slice(-4)}`);
    setPcSessionType('public_class');
    setIsPublicClassModalOpen(true);
  };

  const close = () => setIsPublicClassModalOpen(false);

  const handleSave = (e: FormEvent) => {
    e.preventDefault();

    const classId = editingPublicClass?.id || `pub_${Date.now()}`;
    const newOrUpdatedClass: PublicLiveClass = {
      id: classId,
      title: pcTitle || 'Public Live Masterclass',
      description: pcDescription || 'Live interactive broadcast for all enrolled students.',
      tutorName: user.name,
      tutorAvatar: user.avatar,
      tutorRole: 'Verified FlexDemy Educator',
      scheduledDate: pcDate,
      scheduledTime: pcTime,
      durationMinutes: Number(pcDuration) || 60,
      pricePerMinute: Number(pcPricePerMinute) || 0.50,
      flatPrice: Number(pcFlatPrice) || 25.00,
      subscribers: editingPublicClass?.subscribers || [],
      status: 'upcoming',
      meetingUrl: pcMeetingUrl,
      subject: pcSubject,
    };

    // Broadcast or update public class
    onAnnouncePublicClass(newOrUpdatedClass);

    // Sync with calendar slot
    if (selectedSlotForEdit) {
      const updatedSlot: TutorCalendarSlot = {
        ...selectedSlotForEdit,
        date: pcDate,
        startTime: pcTime,
        durationMinutes: Number(pcDuration) || selectedSlotForEdit.durationMinutes,
        sessionType: pcSessionType,
        topic: pcTitle || selectedSlotForEdit.topic,
        ratePerMinute: Number(pcPricePerMinute) || selectedSlotForEdit.ratePerMinute,
      };
      if (onUpdateSlot) {
        onUpdateSlot(updatedSlot);
      }
    } else if (onUpdateSlot) {
      const newSlot: TutorCalendarSlot = {
        id: `slot_${Date.now()}`,
        tutorId: user.id,
        tutorName: user.name,
        tutorAvatar: user.avatar,
        date: pcDate,
        startTime: pcTime,
        endTime: `${pcTime} (${pcDuration}m)`,
        durationMinutes: Number(pcDuration) || 60,
        isBooked: false,
        sessionType: pcSessionType,
        ratePerMinute: Number(pcPricePerMinute) || 0.50,
        topic: pcTitle,
      };
      onUpdateSlot(newSlot);
    }

    showToast({
      message: `Public Live Class "${newOrUpdatedClass.title}" ${editingPublicClass ? 'updated' : 'scheduled & broadcasted'} successfully.`,
      variant: 'success',
    });
    setIsPublicClassModalOpen(false);
  };

  return {
    isPublicClassModalOpen,
    selectedSlotForEdit,
    editingPublicClass,
    pcTitle,
    setPcTitle,
    pcDescription,
    setPcDescription,
    pcSubject,
    setPcSubject,
    pcDate,
    setPcDate,
    pcTime,
    setPcTime,
    pcDuration,
    setPcDuration,
    pcFlatPrice,
    setPcFlatPrice,
    pcPricePerMinute,
    setPcPricePerMinute,
    pcMeetingUrl,
    setPcMeetingUrl,
    pcSessionType,
    setPcSessionType,
    openForSlot,
    openForClassItem,
    openNew,
    close,
    handleSave,
  };
};
