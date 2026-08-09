using FlexDemy.Application.MasterData.Board;
using FlexDemy.Application.Permissions;
using FlexDemy.Domain.Users;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FlexDemy.Api.Controllers;

// AD-5: thin controller -- HTTP <-> DTO mapping and one Application service call, nothing else.
[ApiController]
[Route("api/v1/master-data/boards")]
[Authorize]
public class BoardsController(IBoardService boardService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<BoardDto>>> GetBoards(
        [FromQuery] string? parentId,
        [FromQuery] bool includeInactive,
        CancellationToken cancellationToken)
    {
        // includeInactive is only honored for Master/Support -- everyone else always sees the
        // active-only list, matching the "add/modify/active/deactivate" master-data requirement.
        var effectiveIncludeInactive = includeInactive && (User.IsInRole(nameof(UserRole.Master)) || User.IsInRole(nameof(UserRole.Support)));
        var boards = await boardService.GetAllAsync(effectiveIncludeInactive, parentId, cancellationToken);
        return Ok(boards);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<BoardDto>> GetBoardById(string id, CancellationToken cancellationToken)
    {
        var board = await boardService.GetByIdAsync(id, cancellationToken);
        return Ok(board);
    }

    [HttpPost]
    [Authorize(Policy = FeatureKeys.MasterDataManage)]
    public async Task<ActionResult<BoardDto>> CreateBoard(CreateBoardRequest request, CancellationToken cancellationToken)
    {
        var board = await boardService.CreateAsync(request, cancellationToken);
        return CreatedAtAction(nameof(GetBoardById), new { id = board.Id }, board);
    }

    [HttpPut("{id}")]
    [Authorize(Policy = FeatureKeys.MasterDataManage)]
    public async Task<ActionResult<BoardDto>> UpdateBoard(string id, UpdateBoardRequest request, CancellationToken cancellationToken)
    {
        var board = await boardService.UpdateAsync(id, request, cancellationToken);
        return Ok(board);
    }

    [HttpDelete("{id}")]
    [Authorize(Policy = FeatureKeys.MasterDataManage)]
    public async Task<IActionResult> DeleteBoard(string id, CancellationToken cancellationToken)
    {
        await boardService.DeleteAsync(id, cancellationToken);
        return NoContent();
    }
}
