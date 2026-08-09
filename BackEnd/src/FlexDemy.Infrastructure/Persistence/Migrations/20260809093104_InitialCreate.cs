using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FlexDemy.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "courses",
                columns: table => new
                {
                    id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    title = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    short_description = table.Column<string>(type: "text", nullable: false),
                    full_description = table.Column<string>(type: "text", nullable: false),
                    subject = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    level = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    target_grade_tag = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    tags = table.Column<List<string>>(type: "text[]", nullable: false),
                    instructor_name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    instructor_role = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    instructor_avatar = table.Column<string>(type: "text", nullable: true),
                    rating = table.Column<decimal>(type: "numeric(3,2)", precision: 3, scale: 2, nullable: false),
                    enrolled_count = table.Column<int>(type: "integer", nullable: false),
                    estimated_hours = table.Column<int>(type: "integer", nullable: false),
                    thumbnail_url = table.Column<string>(type: "text", nullable: true),
                    badge_icon = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_courses", x => x.id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "courses");
        }
    }
}
