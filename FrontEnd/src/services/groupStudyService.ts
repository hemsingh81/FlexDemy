import { StudyGroupRoom, GroupClassRequest, PublicLiveClass } from '../types';
import { MOCK_STUDY_ROOMS, MOCK_GROUP_REQUESTS, MOCK_PUBLIC_CLASSES } from '../data/mockData';

let groupRequests: GroupClassRequest[] = MOCK_GROUP_REQUESTS;
let publicClasses: PublicLiveClass[] = MOCK_PUBLIC_CLASSES;

export const getStudyRooms = async (): Promise<StudyGroupRoom[]> => {
  return MOCK_STUDY_ROOMS;
};

export const getGroupRequests = async (): Promise<GroupClassRequest[]> => {
  return groupRequests;
};

export const addGroupRequest = async (req: GroupClassRequest): Promise<GroupClassRequest[]> => {
  groupRequests = [req, ...groupRequests];
  return groupRequests;
};

export const joinGroupRequest = async (
  requestId: string,
  studentId: string,
  studentName: string,
  avatar: string
): Promise<GroupClassRequest[]> => {
  groupRequests = groupRequests.map((req) =>
    req.id === requestId
      ? {
          ...req,
          studentPool: req.studentPool.some((s) => s.studentId === studentId)
            ? req.studentPool
            : [...req.studentPool, { studentId, studentName, avatar }],
        }
      : req
  );
  return groupRequests;
};

export const getPublicClasses = async (): Promise<PublicLiveClass[]> => {
  return publicClasses;
};

export const subscribePublicClass = async (
  classId: string,
  studentId: string,
  studentName: string,
  avatar: string
): Promise<PublicLiveClass[]> => {
  publicClasses = publicClasses.map((cls) => {
    if (cls.id !== classId) return cls;
    const isSubbed = cls.subscribers.some((s) => s.studentId === studentId) || cls.isSubscribedByMe;
    const updatedSubs = isSubbed
      ? cls.subscribers.filter((s) => s.studentId !== studentId)
      : [...cls.subscribers, { studentId, studentName, avatar }];
    return { ...cls, subscribers: updatedSubs, isSubscribedByMe: !isSubbed };
  });
  return publicClasses;
};

export const announcePublicClass = async (newClass: PublicLiveClass): Promise<PublicLiveClass[]> => {
  const index = publicClasses.findIndex((c) => c.id === newClass.id);
  publicClasses =
    index >= 0
      ? [...publicClasses.slice(0, index), newClass, ...publicClasses.slice(index + 1)]
      : [newClass, ...publicClasses];
  return publicClasses;
};
