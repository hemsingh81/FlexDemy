namespace FlexDemy.Application.Common;

// AD-9: entity IDs are application-generated strings, never database-generated
// (no SERIAL/IDENTITY). Every new aggregate root's Id comes from NewId() before construction.
public interface IIdGenerator
{
    string NewId();
}
