namespace FlexDemy.Domain.AdaptiveLearning;

// Story 3.8/Task 1: deliberately NOT Domain/Jobs/JobItemStatus.cs -- that enum's
// Parsing/Extracting vocabulary is extraction-specific and doesn't fit node-generation. A fresh,
// purpose-built enum, per this epic's own dependency-analysis finding. Persisted via
// .HasConversion<string>() (PublishBatchItemConfiguration.cs).
public enum PublishItemStatus
{
    Queued,
    InProgress,
    Done,
    Failed,
}
