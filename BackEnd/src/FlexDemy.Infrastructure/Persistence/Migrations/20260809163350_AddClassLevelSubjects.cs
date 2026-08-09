using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FlexDemy.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddClassLevelSubjects : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // defaultValueSql backfills existing rows with an empty array -- Postgres rejects
            // ADD COLUMN ... NOT NULL on a populated table with no default (dev DBs that already
            // ran DatabaseSeeder will already have class_levels rows by the time this applies).
            migrationBuilder.AddColumn<List<string>>(
                name: "subject_ids",
                table: "class_levels",
                type: "text[]",
                nullable: false,
                defaultValueSql: "'{}'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "subject_ids",
                table: "class_levels");
        }
    }
}
