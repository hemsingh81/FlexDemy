using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FlexDemy.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddUserRole : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Default is a valid UserRole name (not "") so any pre-existing row stays
            // readable through the string<->enum conversion; Program.cs's idempotent seed
            // then corrects hemsingh81@gmail.com's role to Master on the next startup.
            migrationBuilder.AddColumn<string>(
                name: "role",
                table: "users",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "Student");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "role",
                table: "users");
        }
    }
}
