namespace FlexDemy.Domain.AdaptiveLearning;

// Matches Story 3.3's frontend union ('multipleChoice' | 'numeric' | 'shortText') exactly.
// Persisted via .HasConversion<string>() (ExerciseConfiguration.cs).
public enum AnswerType
{
    MultipleChoice,
    Numeric,
    ShortText,
}
