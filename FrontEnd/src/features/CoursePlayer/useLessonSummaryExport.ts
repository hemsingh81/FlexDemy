import { useState } from 'react';
import { Course, Lesson } from '../../types';

// How long the "Copied!" confirmation stays visible on the Export Summary modal's copy button.
const COPY_FEEDBACK_DURATION_MS = 2500;

// Extracted from CoursePlayer.tsx: builds the Markdown study-notes summary for the current
// lesson (sentences + drilldowns) and drives the Export Summary modal's copy/download actions.
export const useLessonSummaryExport = (course: Course, currentLesson: Lesson, sentences: Lesson['sentences']) => {
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // Generate comprehensive lesson Markdown notes including sentences and drilldowns
  const generateLessonSummaryMarkdown = () => {
    let md = `# ${course.title} — Comprehensive Study Notes\n`;
    md += `## Lesson: ${currentLesson.title}\n`;
    md += `*Generated via FlexDemy AI Educational Platform on ${new Date().toLocaleDateString()}*\n\n`;
    md += `---\n\n`;

    md += `### 📖 Core Paragraph Breakdown\n\n`;
    sentences.forEach((s, idx) => {
      md += `**Paragraph ${idx + 1}:** ${s.text}\n\n`;
      if (s.mathLaTeX) {
        md += `\`\`\`latex\n${s.mathLaTeX}\n\`\`\`\n\n`;
      }
    });

    if (currentLesson.drilldowns && Object.keys(currentLesson.drilldowns).length > 0) {
      md += `---\n\n### 🔬 5-Level Deep Concept Explanations & Examples\n\n`;
      Object.entries(currentLesson.drilldowns).forEach(([, td]) => {
        md += `#### Concept: ${td.title}\n`;
        md += `*${td.overview}*\n\n`;

        td.levels.forEach((lvl) => {
          md += `##### Level ${lvl.level}: ${lvl.title}\n`;
          md += `**${lvl.subtitle}**\n\n`;
          md += `${lvl.content}\n\n`;

          if (lvl.keyPoints && lvl.keyPoints.length > 0) {
            md += `**Core Takeaways:**\n`;
            lvl.keyPoints.forEach((pt) => {
              md += `- ${pt}\n`;
            });
            md += `\n`;
          }

          if (lvl.examples && lvl.examples.length > 0) {
            md += `**Practical Worked Examples:**\n`;
            lvl.examples.forEach((ex, exIdx) => {
              md += `\n*Example ${exIdx + 1}: ${ex.title} (${ex.difficulty})*\n`;
              md += `- **Problem:** ${ex.problem}\n`;
              md += `- **Step-by-step:** ${ex.stepByStepSolution.join(' -> ')}\n`;
              md += `- **Final Answer:** ${ex.finalAnswer}\n`;
            });
            md += `\n`;
          }
        });
      });
    }

    md += `\n---\n*End of Summary Notes for ${currentLesson.title}*\n`;
    return md;
  };

  const handleDownloadMarkdown = () => {
    const content = generateLessonSummaryMarkdown();
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${currentLesson.title.toLowerCase().replace(/\s+/g, '_')}_summary_notes.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyMarkdown = () => {
    const content = generateLessonSummaryMarkdown();
    navigator.clipboard.writeText(content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), COPY_FEEDBACK_DURATION_MS);
  };

  return { generateLessonSummaryMarkdown, handleDownloadMarkdown, handleCopyMarkdown, isCopied };
};
