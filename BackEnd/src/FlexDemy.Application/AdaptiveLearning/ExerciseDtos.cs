namespace FlexDemy.Application.AdaptiveLearning;

// Story 3.6/Task 3: student-facing (and save-confirmation) read shape -- deliberately excludes
// CorrectAnswer, matching Story 3.3's own mock design decision to keep the answer key
// server-side-only.
public sealed record ExerciseDto(
    string NodeId,
    string AnswerType,
    string QuestionText,
    IReadOnlyList<string>? Options,
    string FeedbackText,
    bool IsAiProposed);

// Tutor-facing proposal shape -- returned by ProposeExerciseAsync only, never persisted. Includes
// CorrectAnswer (unlike ExerciseDto) since the tutor reviewing/editing a proposal needs to see
// and potentially change what counts as correct before accepting it.
public sealed record ExerciseDraftDto(
    string AnswerType,
    string QuestionText,
    IReadOnlyList<string>? Options,
    string CorrectAnswer,
    string FeedbackText);

public sealed record SaveExerciseRequest(
    string AnswerType,
    string QuestionText,
    IReadOnlyList<string>? Options,
    string CorrectAnswer,
    string FeedbackText,
    bool IsAiProposed);

public sealed record ExerciseSubmissionResultDto(bool IsCorrect, string FeedbackText);
