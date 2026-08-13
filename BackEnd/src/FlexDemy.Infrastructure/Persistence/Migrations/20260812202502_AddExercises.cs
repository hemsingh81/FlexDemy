using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FlexDemy.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddExercises : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "exercises",
                columns: table => new
                {
                    id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    topic_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    subtopic_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    answer_type = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    question_text = table.Column<string>(type: "text", nullable: false),
                    options_json = table.Column<string>(type: "text", nullable: true),
                    correct_answer = table.Column<string>(type: "text", nullable: false),
                    feedback_text = table.Column<string>(type: "text", nullable: false),
                    is_ai_proposed = table.Column<bool>(type: "boolean", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    created_by = table.Column<string>(type: "text", nullable: true),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    updated_by = table.Column<string>(type: "text", nullable: true),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_exercises", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_exercises_subtopic_id",
                table: "exercises",
                column: "subtopic_id",
                unique: true,
                filter: "subtopic_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_exercises_topic_id",
                table: "exercises",
                column: "topic_id",
                unique: true,
                filter: "topic_id IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "exercises");
        }
    }
}
