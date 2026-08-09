using FlexDemy.Domain.Users;

namespace FlexDemy.Application.Users;

public static class UserMapper
{
    public static UserDto ToDto(this User user) =>
        new(user.Id, user.Email, user.FirstName, user.LastName, user.Role.ToString(), user.IsActive);
}
