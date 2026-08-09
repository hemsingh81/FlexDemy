using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using FlexDemy.Domain.Users;
using FlexDemy.Infrastructure.Security;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace FlexDemy.Infrastructure.Tests.Security;

public class JwtTokenServiceTests
{
    private static User MakeUser(UserRole role) => new()
    {
        Id = "usr_1",
        Email = "hemsingh81@gmail.com",
        PasswordHash = "hashed",
        FirstName = "Hem",
        LastName = "Singh",
        Role = role,
    };

    private static JwtTokenService NewSut()
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection().Build();
        return new JwtTokenService(configuration);
    }

    [Fact]
    public void GenerateToken_embeds_the_user_role_as_a_claim()
    {
        var sut = NewSut();
        var token = sut.GenerateToken(MakeUser(UserRole.Master));

        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(token);

        Assert.Equal("Master", jwt.Claims.First(c => c.Type == ClaimTypes.Role).Value);
        Assert.Equal("hemsingh81@gmail.com", jwt.Claims.First(c => c.Type == JwtRegisteredClaimNames.Email).Value);
    }

    [Theory]
    [InlineData(UserRole.Student)]
    [InlineData(UserRole.Tutor)]
    [InlineData(UserRole.Support)]
    [InlineData(UserRole.Master)]
    public void GenerateToken_round_trips_every_role(UserRole role)
    {
        var sut = NewSut();
        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(sut.GenerateToken(MakeUser(role)));

        Assert.Equal(role.ToString(), jwt.Claims.First(c => c.Type == ClaimTypes.Role).Value);
    }
}
