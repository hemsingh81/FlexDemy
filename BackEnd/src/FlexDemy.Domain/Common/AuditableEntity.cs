namespace FlexDemy.Domain.Common;

// Persistence-ignorant POCO (ARCHITECTURE-SPINE.md AD-4) -- no EF Core attributes here.
// Every Domain entity inherits this instead of redeclaring Id/CreatedAt/IsActive itself, so the
// standard audit/lifecycle columns (is_active, created_at, created_by, updated_at, updated_by,
// is_deleted -- snake_case via EFCore.NamingConventions) are always present. Stamped by
// Infrastructure/Persistence/Interceptors/AuditSaveChangesInterceptor.cs on SaveChanges -- not
// by callers -- so services shouldn't set CreatedAt/UpdatedAt/CreatedBy/UpdatedBy themselves.
public abstract class AuditableEntity
{
    public required string Id { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; }
    public string? CreatedBy { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }
    public string? UpdatedBy { get; set; }
    public bool IsDeleted { get; set; }
}
