import { describe, it, expect } from 'vitest';
import {
  getStudyRooms,
  getGroupRequests,
  addGroupRequest,
  joinGroupRequest,
  getPublicClasses,
  subscribePublicClass,
  announcePublicClass,
} from '@/src/services/groupStudyService';
import { GroupClassRequest, PublicLiveClass } from '@/src/types';

describe('groupStudyService', () => {
  it('getStudyRooms returns the seeded mock rooms', async () => {
    expect((await getStudyRooms()).length).toBeGreaterThan(0);
  });

  it('addGroupRequest prepends a new request', async () => {
    const before = await getGroupRequests();
    const req: GroupClassRequest = {
      id: 'req_test',
      topic: 'Test Topic',
      courseTitle: 'Test Course',
      requestedByStudentId: 'usr_test',
      requestedByStudentName: 'Test Student',
      studentPool: [{ studentId: 'usr_test', studentName: 'Test Student', avatar: '' }],
      status: 'pending',
      ratePerMinute: 1,
      maxParticipants: 5,
    };
    const after = await addGroupRequest(req);
    expect(after.length).toBe(before.length + 1);
    expect(after[0].id).toBe('req_test');
  });

  it('joinGroupRequest adds a student once and is idempotent', async () => {
    const [existing] = await getGroupRequests();
    const first = await joinGroupRequest(existing.id, 'usr_join', 'Joiner', '');
    const joined = first.find((r) => r.id === existing.id);
    const countAfterFirst = joined?.studentPool.length;

    const second = await joinGroupRequest(existing.id, 'usr_join', 'Joiner', '');
    const stillJoined = second.find((r) => r.id === existing.id);
    expect(stillJoined?.studentPool.length).toBe(countAfterFirst);
  });

  it('getPublicClasses returns the seeded mock classes', async () => {
    expect((await getPublicClasses()).length).toBeGreaterThan(0);
  });

  it('subscribePublicClass toggles subscription for a student', async () => {
    const [existing] = await getPublicClasses();
    const subscribed = await subscribePublicClass(existing.id, 'usr_sub', 'Subscriber', '');
    const found = subscribed.find((c) => c.id === existing.id);
    expect(found?.subscribers.some((s) => s.studentId === 'usr_sub')).toBe(true);

    const unsubscribed = await subscribePublicClass(existing.id, 'usr_sub', 'Subscriber', '');
    const foundAgain = unsubscribed.find((c) => c.id === existing.id);
    expect(foundAgain?.subscribers.some((s) => s.studentId === 'usr_sub')).toBe(false);
  });

  it('announcePublicClass inserts a new class or replaces an existing one by id', async () => {
    const newClass: PublicLiveClass = {
      id: 'pub_test',
      title: 'Test Class',
      description: '',
      tutorName: '',
      tutorAvatar: '',
      tutorRole: '',
      scheduledDate: '2026-01-01',
      scheduledTime: '10:00 AM',
      durationMinutes: 30,
      pricePerMinute: 0,
      flatPrice: 0,
      subscribers: [],
      status: 'upcoming',
      subject: 'stem_math',
    };
    const announced = await announcePublicClass(newClass);
    expect(announced.some((c) => c.id === 'pub_test')).toBe(true);

    const replaced = await announcePublicClass({ ...newClass, title: 'Updated Title' });
    expect(replaced.find((c) => c.id === 'pub_test')?.title).toBe('Updated Title');
  });
});
