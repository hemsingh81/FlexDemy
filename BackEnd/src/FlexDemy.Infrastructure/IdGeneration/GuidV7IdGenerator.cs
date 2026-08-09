using FlexDemy.Application.Common;

namespace FlexDemy.Infrastructure.IdGeneration;

// AD-9: sortable, application-generated string ids. Uses Guid v7 (RFC 9562, time-ordered,
// built into .NET's Guid.CreateVersion7 since .NET 9) rather than pulling in a third-party
// ULID package -- same sortability property, zero extra dependency.
public class GuidV7IdGenerator : IIdGenerator
{
    public string NewId() => Guid.CreateVersion7().ToString();
}
