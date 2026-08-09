import { describe, it, expect } from 'vitest';
import { getTutorSlots, bookSlot, upsertSlot } from '@/src/services/tutorService';
import { TutorCalendarSlot } from '@/src/types';

describe('tutorService', () => {
  it('getTutorSlots returns the seeded mock slots', async () => {
    const slots = await getTutorSlots();
    expect(slots.length).toBeGreaterThan(0);
  });

  it('bookSlot marks a slot booked with the given student', async () => {
    const before = await getTutorSlots();
    const target = before.find((s) => !s.isBooked);
    expect(target).toBeDefined();

    const after = await bookSlot(target!.id, 'usr_test', 'Test Student', 'My topic');
    const booked = after.find((s) => s.id === target!.id);
    expect(booked?.isBooked).toBe(true);
    expect(booked?.bookedByStudentId).toBe('usr_test');
    expect(booked?.topic).toBe('My topic');
  });

  it('upsertSlot updates an existing slot and prepends a new one', async () => {
    const before = await getTutorSlots();
    const existing = before[0];

    const updated = await upsertSlot({ ...existing, topic: 'Updated Topic' });
    expect(updated.find((s) => s.id === existing.id)?.topic).toBe('Updated Topic');

    const newSlot: TutorCalendarSlot = {
      ...existing,
      id: 'slot_brand_new',
      isBooked: false,
    };
    const withNew = await upsertSlot(newSlot);
    expect(withNew[0].id).toBe('slot_brand_new');
  });
});
