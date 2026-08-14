import { useEffect, useState } from 'react';
import { getCourseContent, type CourseFileDto } from '../../services/courseFileService';

// Extracted from CoursePlayer.tsx: fetches this course's real uploaded-file content (raw parsed
// text, no AI structuring step) and owns which file is currently selected for reading. Replaces
// the old Chapter/Topic/Subtopic mock-tree navigation -- this is the first real wiring of
// student-facing content reading, not a regression from something real (that tree only ever ran
// on a hardcoded fixture).
export const useCourseFileNavigation = (courseId: string) => {
  const [files, setFiles] = useState<CourseFileDto[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCourseContent(courseId)
      .then((dtos) => {
        if (!cancelled) setFiles(dtos);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  const selectedFile = selectedFileId ? (files.find((f) => f.id === selectedFileId) ?? null) : null;

  return { files, selectedFileId, setSelectedFileId, selectedFile };
};
