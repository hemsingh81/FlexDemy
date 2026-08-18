namespace FlexDemy.Domain.Courses;

// AD-20: the wire contract for Page/Resource's polymorphic OwnerType/OwnerId ownership -- pinned
// exact member spelling, matching the Chapter/Topic/Subtopic entity class names verbatim
// ("Subtopic" one word). FrontEnd/src/types.ts's ContentOwnerType union must match these four
// literal strings exactly (stored via .HasConversion<string>() in PageConfiguration, never the
// EF numeric default). Defined in full now even though Resource (Story 8.1) is the only future
// consumer of the Page member -- the enum is fixed by the PRD's Appendix A once.
public enum ContentOwnerType
{
    Chapter,
    Topic,
    Subtopic,
    Page,
}
