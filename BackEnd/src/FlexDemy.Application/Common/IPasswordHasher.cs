namespace FlexDemy.Application.Common;

// AD-4-style seam: Application defines the interface, Infrastructure implements it
// (PBKDF2 via System.Security.Cryptography -- no extra package needed).
public interface IPasswordHasher
{
    string Hash(string password);
    bool Verify(string password, string hash);
}
