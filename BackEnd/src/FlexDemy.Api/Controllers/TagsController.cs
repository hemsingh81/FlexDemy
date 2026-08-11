using FlexDemy.Application.Permissions;
using FlexDemy.Application.Tags;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FlexDemy.Api.Controllers;

// AD-5: thin controller. Deliberately at api/v1/tags, not api/v1/master-data/tags -- Tag is not
// part of the Master Data scaffold (FR-26; ARCHITECTURE-SPINE.md Structural Seed). Reuses
// FeatureKeys.MasterDataManage for write actions -- no dedicated Tag permission key exists or is
// needed (Master already has MasterDataManage granted).
[ApiController]
[Route("api/v1/tags")]
[Authorize]
public class TagsController(ITagService tagService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<TagDto>>> GetTags(CancellationToken cancellationToken)
    {
        var tags = await tagService.GetAllAsync(cancellationToken);
        return Ok(tags);
    }

    [HttpPost]
    [Authorize(Policy = FeatureKeys.MasterDataManage)]
    public async Task<ActionResult<TagDto>> CreateTag(CreateTagRequest request, CancellationToken cancellationToken)
    {
        var tag = await tagService.CreateAsync(request, cancellationToken);
        return Ok(tag);
    }

    [HttpPut("{id}")]
    [Authorize(Policy = FeatureKeys.MasterDataManage)]
    public async Task<ActionResult<TagDto>> UpdateTag(string id, UpdateTagRequest request, CancellationToken cancellationToken)
    {
        var tag = await tagService.UpdateAsync(id, request, cancellationToken);
        return Ok(tag);
    }
}
