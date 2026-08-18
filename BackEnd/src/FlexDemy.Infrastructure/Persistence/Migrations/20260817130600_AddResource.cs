using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FlexDemy.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddResource : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "resources",
                columns: table => new
                {
                    id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    owner_type = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    owner_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    course_file_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    label = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    caption = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    role = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    file_name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    content_type = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    size_bytes = table.Column<long>(type: "bigint", nullable: false),
                    stored_url = table.Column<string>(type: "text", nullable: false),
                    status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    failure_reason = table.Column<string>(type: "character varying(1024)", maxLength: 1024, nullable: true),
                    order = table.Column<int>(type: "integer", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    created_by = table.Column<string>(type: "text", nullable: true),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    updated_by = table.Column<string>(type: "text", nullable: true),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_resources", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_resources_course_file_id",
                table: "resources",
                column: "course_file_id");

            migrationBuilder.CreateIndex(
                name: "ix_resources_owner_type_owner_id",
                table: "resources",
                columns: new[] { "owner_type", "owner_id" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "resources");
        }
    }
}
