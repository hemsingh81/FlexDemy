namespace FlexDemy.Domain.Jobs;

// Story 2.6: the exact 5-value vocabulary the frontend's FileUploadStatus union and PRD FR-13
// already use verbatim (queued/parsing/extracting/done/failed) -- see Story 2.6's Dev Notes for
// why this diverges from ARCHITECTURE-SPINE.md AD-15's illustrative 4-value example. Shared by
// Stories 2.7/2.8's Parsing/Extracting transitions; this story only ever sets Queued or Failed.
public enum JobItemStatus
{
    Queued,
    Parsing,
    Extracting,
    Done,
    Failed,
}
