using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FlexDemy.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class MakeErrorRecordFingerprintUnique : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_error_records_fingerprint",
                table: "error_records");

            migrationBuilder.CreateIndex(
                name: "ix_error_records_fingerprint",
                table: "error_records",
                column: "fingerprint",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_error_records_fingerprint",
                table: "error_records");

            migrationBuilder.CreateIndex(
                name: "ix_error_records_fingerprint",
                table: "error_records",
                column: "fingerprint");
        }
    }
}
