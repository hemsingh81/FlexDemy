namespace FlexDemy.Application.Common;

// Story 4.5: the backend's first paginated-response shape (confirmed: no Paged/pagination
// wrapper exists anywhere in the codebase before this). Generic so any future paginated list
// endpoint reuses this instead of inventing its own shape.
public sealed record PagedResult<T>(IReadOnlyList<T> Items, int TotalCount, int Page, int PageSize);
