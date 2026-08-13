using FlexDemy.Domain.AdaptiveLearning;

namespace FlexDemy.Application.AdaptiveLearning;

public interface IExerciseService
{
    // Tutor-only. Returns the proposal without saving it (AC#1's "can be edited or accepted") --
    // nothing persists until the tutor explicitly calls SaveExerciseAsync.
    Task<ExerciseDraftDto> ProposeExerciseAsync(string courseId, string nodeId, AnswerType answerType, CancellationToken cancellationToken = default);

    // Tutor-only. One save path for both self-authored and AI-proposed-then-accepted/edited
    // exercises -- upserts the node's single Exercise row, replacing any existing one.
    Task<ExerciseDto> SaveExerciseAsync(string courseId, string nodeId, SaveExerciseRequest request, CancellationToken cancellationToken = default);

    // Tutor-only. Removes the node's exercise entirely (reverting to "no practice affordance").
    Task DeleteExerciseAsync(string courseId, string nodeId, CancellationToken cancellationToken = default);

    // Student-facing read. Null (not an exception) when the node has no exercise.
    Task<ExerciseDto?> GetExerciseAsync(string courseId, string nodeId, CancellationToken cancellationToken = default);

    // Student-facing grading -- a deliberate 1:1 port of Story 3.3's own mock evaluator.
    Task<ExerciseSubmissionResultDto> SubmitAnswerAsync(string courseId, string nodeId, string answer, CancellationToken cancellationToken = default);
}
