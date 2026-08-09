using FlexDemy.Domain.Users;

namespace FlexDemy.Application.Common;

public interface ITokenService
{
    string GenerateToken(User user);
}
