using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FlexDemy.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFontSizeDefinitions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "font_size_definitions",
                columns: table => new
                {
                    id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    slug = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    root_font_scale = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    created_by = table.Column<string>(type: "text", nullable: true),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    updated_by = table.Column<string>(type: "text", nullable: true),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_font_size_definitions", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_font_size_definitions_slug",
                table: "font_size_definitions",
                column: "slug",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "font_size_definitions");
        }
    }
}
