namespace FlexDemy.Domain.Jobs;

// The frontend's FileUploadStatus union mirrors this exactly. `Extracting` (the AI structure-
// extraction step) was removed along with the Chapter/Topic/Subtopic tree -- a clean parse now
// goes straight from Parsing to Done.
public enum JobItemStatus
{
    Queued,
    Parsing,
    Done,
    Failed,
}
