using FlexDemy.Infrastructure.Security;
using Xunit;

namespace FlexDemy.Infrastructure.Tests.Security;

public class Pbkdf2PasswordHasherTests
{
    [Fact]
    public void Hash_then_Verify_roundtrips_for_the_correct_password()
    {
        var sut = new Pbkdf2PasswordHasher();
        var hash = sut.Hash("Password@123");

        Assert.True(sut.Verify("Password@123", hash));
    }

    [Fact]
    public void Verify_fails_for_the_wrong_password()
    {
        var sut = new Pbkdf2PasswordHasher();
        var hash = sut.Hash("Password@123");

        Assert.False(sut.Verify("wrong", hash));
    }

    [Fact]
    public void Hash_is_salted_so_the_same_password_hashes_differently_each_time()
    {
        var sut = new Pbkdf2PasswordHasher();
        Assert.NotEqual(sut.Hash("Password@123"), sut.Hash("Password@123"));
    }
}
