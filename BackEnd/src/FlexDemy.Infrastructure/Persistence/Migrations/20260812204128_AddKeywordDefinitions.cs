using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FlexDemy.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddKeywordDefinitions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "keyword_definitions",
                columns: table => new
                {
                    id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    course_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    keyword = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    normalized_keyword = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    generated_definition_text = table.Column<string>(type: "text", nullable: true),
                    override_definition_text = table.Column<string>(type: "text", nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    created_by = table.Column<string>(type: "text", nullable: true),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    updated_by = table.Column<string>(type: "text", nullable: true),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_keyword_definitions", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_keyword_definitions_course_id_normalized_keyword",
                table: "keyword_definitions",
                columns: new[] { "course_id", "normalized_keyword" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "keyword_definitions");
        }
    }
}
