import { useState } from 'react';
import { makeMockContentTree, type Chapter as ContentChapter } from './playerContent';
import { findContentNode } from './ContentNodeReadingPane';

// Extracted from CoursePlayer.tsx: owns the real Chapter/Topic/Subtopic content-tree navigation
// state (Story 3.1/Task 2) -- a mock fixture standing in for a real "fetch a Published course's
// content tree" endpoint that doesn't exist yet.
export const useContentTreeNavigation = () => {
  const [contentChapters] = useState<ContentChapter[]>(() => makeMockContentTree());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const selectedContentNode = selectedNodeId ? findContentNode(contentChapters, selectedNodeId) : null;

  return { contentChapters, selectedNodeId, setSelectedNodeId, selectedContentNode };
};
