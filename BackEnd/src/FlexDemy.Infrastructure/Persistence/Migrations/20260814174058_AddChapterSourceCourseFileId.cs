using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FlexDemy.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddChapterSourceCourseFileId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "source_course_file_id",
                table: "chapters",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_chapters_course_id_source_course_file_id",
                table: "chapters",
                columns: new[] { "course_id", "source_course_file_id" });

            migrationBuilder.CreateIndex(
                name: "ix_chapters_source_course_file_id",
                table: "chapters",
                column: "source_course_file_id");

            migrationBuilder.AddForeignKey(
                name: "fk_chapters_course_files_source_course_file_id",
                table: "chapters",
                column: "source_course_file_id",
                principalTable: "course_files",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_chapters_course_files_source_course_file_id",
                table: "chapters");

            migrationBuilder.DropIndex(
                name: "ix_chapters_course_id_source_course_file_id",
                table: "chapters");

            migrationBuilder.DropIndex(
                name: "ix_chapters_source_course_file_id",
                table: "chapters");

            migrationBuilder.DropColumn(
                name: "source_course_file_id",
                table: "chapters");
        }
    }
}
