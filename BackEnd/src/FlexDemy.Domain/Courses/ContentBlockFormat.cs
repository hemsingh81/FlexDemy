namespace FlexDemy.Domain.Courses;

// Story 2.9: mirrors useCourseContentTree.ts's ContentBlockFormat union exactly. This story never
// produces Image blocks itself (same reasoning as Story 2.8 -- nothing in the AI-extraction
// pipeline identifies embedded images), but the value must exist so a tutor can manually add an
// image-format block through the editor UI in a later story/enhancement.
public enum ContentBlockFormat
{
    Text,
    Math,
    Image,
}
