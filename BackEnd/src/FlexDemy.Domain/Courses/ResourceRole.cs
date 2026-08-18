namespace FlexDemy.Domain.Courses;

// Story 8.1, FR-38/UX-DR9: every resource's role -- Inline (rendered directly in the reading
// flow), Attachment (a downloadable card, ordered among its siblings), or Both. Stored via
// .HasConversion<string>() in ResourceConfiguration -- same ordinal-drift-avoidance convention
// ContentOwnerType (Story 7.3) already established, not the EF numeric default.
public enum ResourceRole
{
    Inline,
    Attachment,
    Both,
}
