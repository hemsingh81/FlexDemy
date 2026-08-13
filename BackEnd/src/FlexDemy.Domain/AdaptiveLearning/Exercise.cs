using FlexDemy.Domain.Common;

namespace FlexDemy.Domain.AdaptiveLearning;

// Persistence-ignorant POCO (AD-4). Story 3.6/Task 1: at most one Exercise row per node (a unique
// index, see ExerciseConfiguration.cs) -- matches Story 3.3's already-committed zero-or-one
// frontend shape (useExercise(): { exercise: Exercise | null, ... }) rather than PRD FR19's more
// aspirational "one or more" wording. TopicId?/SubtopicId? follow ContentBlock's exact
// mutual-exclusivity pattern.
public class Exercise : AuditableEntity
{
    public string? TopicId { get; set; }
    public string? SubtopicId { get; set; }
    public AnswerType AnswerType { get; set; }
    public required string QuestionText { get; set; }
    // Only populated for AnswerType.MultipleChoice -- a JSON string array, same raw-JSON-storage
    // precedent as Story 3.5's GeneratedContentJson/OverrideContentJson.
    public string? OptionsJson { get; set; }
    // The grading reference -- never included in any DTO returned to a student (ExerciseDto),
    // matching Story 3.3's own mock design decision to keep the answer key server-side-only.
    public required string CorrectAnswer { get; set; }
    // The worked solution -- always shown after submission regardless of correctness.
    public required string FeedbackText { get; set; }
    // Provenance only -- does not gate anything once saved.
    public bool IsAiProposed { get; set; }
}
