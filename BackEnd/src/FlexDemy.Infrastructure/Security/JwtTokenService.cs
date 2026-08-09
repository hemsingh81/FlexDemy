using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using FlexDemy.Application.Common;
using FlexDemy.Domain.Users;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace FlexDemy.Infrastructure.Security;

// Dev-only signing key fallback so the demo works with zero config; override via
// Jwt:SigningKey (env var Jwt__SigningKey) for anything beyond local/demo use.
public class JwtTokenService(IConfiguration configuration) : ITokenService
{
    public string GenerateToken(User user)
    {
        var signingKey = configuration["Jwt:SigningKey"]
            ?? "flexdemy-dev-only-signing-key-not-for-production-use-32bytes+";
        var issuer = configuration["Jwt:Issuer"] ?? "FlexDemy";
        var expiryMinutes = int.TryParse(configuration["Jwt:ExpiryMinutes"], out var configured) ? configured : 480;

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id),
            new Claim(JwtRegisteredClaimNames.Email, user.Email),
            new Claim(ClaimTypes.GivenName, user.FirstName),
            new Claim(ClaimTypes.Surname, user.LastName),
            new Claim(ClaimTypes.Role, user.Role.ToString()),
        };

        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey)), SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: issuer,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(expiryMinutes),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
