namespace FlexDemy.Application.Common;

// Shared by CourseService.ReorderThumbnailAsync (wire vocabulary "left"/"right") and
// ContentTreeService.ReorderNodeAsync (wire vocabulary "up"/"down") -- both represent the exact
// same underlying operation (swap the target with its previous/next sibling in an Order-sorted
// list), just labeled differently per their own UI's axis (a horizontal thumbnail strip vs. a
// vertical content tree). Each service's public method signature still speaks its own wire
// string (unchanged HTTP contract, unchanged existing tests) -- it parses that string into this
// shared enum immediately on entry, then every internal comparison/swap decision uses the enum
// instead of comparing raw "left"/"right"/"up"/"down" strings.
public enum ReorderDirection
{
    Backward, // "left" (thumbnails) / "up" (content-tree nodes) -- swap with the previous sibling.
    Forward,  // "right" (thumbnails) / "down" (content-tree nodes) -- swap with the next sibling.
}
