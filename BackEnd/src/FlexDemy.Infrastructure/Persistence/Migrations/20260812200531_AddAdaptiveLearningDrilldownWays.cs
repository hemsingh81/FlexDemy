using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FlexDemy.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddAdaptiveLearningDrilldownWays : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "drilldown_levels",
                columns: table => new
                {
                    id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    topic_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    subtopic_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    level_number = table.Column<int>(type: "integer", nullable: false),
                    generated_content_json = table.Column<string>(type: "text", nullable: true),
                    override_content_json = table.Column<string>(type: "text", nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    created_by = table.Column<string>(type: "text", nullable: true),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    updated_by = table.Column<string>(type: "text", nullable: true),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_drilldown_levels", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "way_contents",
                columns: table => new
                {
                    id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    topic_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    subtopic_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    way_number = table.Column<int>(type: "integer", nullable: false),
                    generated_content_json = table.Column<string>(type: "text", nullable: true),
                    override_content_json = table.Column<string>(type: "text", nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    created_by = table.Column<string>(type: "text", nullable: true),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    updated_by = table.Column<string>(type: "text", nullable: true),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_way_contents", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_drilldown_levels_subtopic_id_level_number",
                table: "drilldown_levels",
                columns: new[] { "subtopic_id", "level_number" },
                unique: true,
                filter: "subtopic_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_drilldown_levels_topic_id_level_number",
                table: "drilldown_levels",
                columns: new[] { "topic_id", "level_number" },
                unique: true,
                filter: "topic_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_way_contents_subtopic_id_way_number",
                table: "way_contents",
                columns: new[] { "subtopic_id", "way_number" },
                unique: true,
                filter: "subtopic_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_way_contents_topic_id_way_number",
                table: "way_contents",
                columns: new[] { "topic_id", "way_number" },
                unique: true,
                filter: "topic_id IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "drilldown_levels");

            migrationBuilder.DropTable(
                name: "way_contents");
        }
    }
}
