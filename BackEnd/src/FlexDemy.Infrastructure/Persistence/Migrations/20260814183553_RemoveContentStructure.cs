using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FlexDemy.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RemoveContentStructure : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "content_blocks");

            migrationBuilder.DropTable(
                name: "drilldown_levels");

            migrationBuilder.DropTable(
                name: "exercises");

            migrationBuilder.DropTable(
                name: "publish_batch_items");

            migrationBuilder.DropTable(
                name: "publish_batches");

            migrationBuilder.DropTable(
                name: "way_contents");

            migrationBuilder.DropTable(
                name: "subtopics");

            migrationBuilder.DropTable(
                name: "topics");

            migrationBuilder.DropTable(
                name: "chapters");

            migrationBuilder.DropColumn(
                name: "extracted_structure_json",
                table: "course_files");

            migrationBuilder.DropColumn(
                name: "is_materialized",
                table: "course_files");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "extracted_structure_json",
                table: "course_files",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_materialized",
                table: "course_files",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "chapters",
                columns: table => new
                {
                    id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    confirmation = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    course_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    created_by = table.Column<string>(type: "text", nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false),
                    order = table.Column<int>(type: "integer", nullable: false),
                    source_course_file_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    title = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    updated_by = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_chapters", x => x.id);
                    table.ForeignKey(
                        name: "fk_chapters_course_files_source_course_file_id",
                        column: x => x.source_course_file_id,
                        principalTable: "course_files",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_chapters_courses_course_id",
                        column: x => x.course_id,
                        principalTable: "courses",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "drilldown_levels",
                columns: table => new
                {
                    id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    created_by = table.Column<string>(type: "text", nullable: true),
                    generated_content_json = table.Column<string>(type: "text", nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false),
                    level_number = table.Column<int>(type: "integer", nullable: false),
                    override_content_json = table.Column<string>(type: "text", nullable: true),
                    subtopic_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    topic_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    updated_by = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_drilldown_levels", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "exercises",
                columns: table => new
                {
                    id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    answer_type = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    correct_answer = table.Column<string>(type: "text", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    created_by = table.Column<string>(type: "text", nullable: true),
                    feedback_text = table.Column<string>(type: "text", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    is_ai_proposed = table.Column<bool>(type: "boolean", nullable: false),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false),
                    options_json = table.Column<string>(type: "text", nullable: true),
                    question_text = table.Column<string>(type: "text", nullable: false),
                    subtopic_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    topic_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    updated_by = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_exercises", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "publish_batch_items",
                columns: table => new
                {
                    id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    batch_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    created_by = table.Column<string>(type: "text", nullable: true),
                    decrement_committed = table.Column<bool>(type: "boolean", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false),
                    progress_text = table.Column<string>(type: "text", nullable: true),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    subtopic_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    topic_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    updated_by = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_publish_batch_items", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "publish_batches",
                columns: table => new
                {
                    id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    course_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    created_by = table.Column<string>(type: "text", nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false),
                    remaining = table.Column<int>(type: "integer", nullable: false),
                    total_nodes = table.Column<int>(type: "integer", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    updated_by = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_publish_batches", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "way_contents",
                columns: table => new
                {
                    id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    created_by = table.Column<string>(type: "text", nullable: true),
                    generated_content_json = table.Column<string>(type: "text", nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false),
                    override_content_json = table.Column<string>(type: "text", nullable: true),
                    subtopic_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    topic_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    updated_by = table.Column<string>(type: "text", nullable: true),
                    way_number = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_way_contents", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "topics",
                columns: table => new
                {
                    id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    chapter_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    confirmation = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    created_by = table.Column<string>(type: "text", nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false),
                    order = table.Column<int>(type: "integer", nullable: false),
                    title = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    updated_by = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_topics", x => x.id);
                    table.ForeignKey(
                        name: "fk_topics_chapters_chapter_id",
                        column: x => x.chapter_id,
                        principalTable: "chapters",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "subtopics",
                columns: table => new
                {
                    id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    confirmation = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    created_by = table.Column<string>(type: "text", nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false),
                    order = table.Column<int>(type: "integer", nullable: false),
                    title = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    topic_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    updated_by = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_subtopics", x => x.id);
                    table.ForeignKey(
                        name: "fk_subtopics_topics_topic_id",
                        column: x => x.topic_id,
                        principalTable: "topics",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "content_blocks",
                columns: table => new
                {
                    id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    alt_text = table.Column<string>(type: "text", nullable: true),
                    confirmation = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    created_by = table.Column<string>(type: "text", nullable: true),
                    format = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    image_url = table.Column<string>(type: "text", nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false),
                    lang = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: true),
                    notation = table.Column<string>(type: "text", nullable: true),
                    order = table.Column<int>(type: "integer", nullable: false),
                    subtopic_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    text = table.Column<string>(type: "text", nullable: true),
                    topic_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    updated_by = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_content_blocks", x => x.id);
                    table.ForeignKey(
                        name: "fk_content_blocks_subtopics_subtopic_id",
                        column: x => x.subtopic_id,
                        principalTable: "subtopics",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_content_blocks_topics_topic_id",
                        column: x => x.topic_id,
                        principalTable: "topics",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_chapters_course_id",
                table: "chapters",
                column: "course_id");

            migrationBuilder.CreateIndex(
                name: "ix_chapters_course_id_source_course_file_id",
                table: "chapters",
                columns: new[] { "course_id", "source_course_file_id" });

            migrationBuilder.CreateIndex(
                name: "ix_chapters_source_course_file_id",
                table: "chapters",
                column: "source_course_file_id");

            migrationBuilder.CreateIndex(
                name: "ix_content_blocks_subtopic_id",
                table: "content_blocks",
                column: "subtopic_id");

            migrationBuilder.CreateIndex(
                name: "ix_content_blocks_topic_id",
                table: "content_blocks",
                column: "topic_id");

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

            migrationBuilder.CreateIndex(
                name: "ix_publish_batch_items_batch_id",
                table: "publish_batch_items",
                column: "batch_id");

            migrationBuilder.CreateIndex(
                name: "ix_publish_batches_course_id",
                table: "publish_batches",
                column: "course_id");

            migrationBuilder.CreateIndex(
                name: "ix_subtopics_topic_id",
                table: "subtopics",
                column: "topic_id");

            migrationBuilder.CreateIndex(
                name: "ix_topics_chapter_id",
                table: "topics",
                column: "chapter_id");

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
    }
}
