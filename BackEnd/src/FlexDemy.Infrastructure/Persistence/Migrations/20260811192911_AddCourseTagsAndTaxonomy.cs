using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FlexDemy.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCourseTagsAndTaxonomy : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "board_id",
                table: "courses",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "city_id",
                table: "courses",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "class_level_id",
                table: "courses",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "country_id",
                table: "courses",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "state_id",
                table: "courses",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "subject_id",
                table: "courses",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<List<string>>(
                name: "tag_ids",
                table: "courses",
                type: "text[]",
                nullable: false,
                defaultValueSql: "'{}'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "board_id",
                table: "courses");

            migrationBuilder.DropColumn(
                name: "city_id",
                table: "courses");

            migrationBuilder.DropColumn(
                name: "class_level_id",
                table: "courses");

            migrationBuilder.DropColumn(
                name: "country_id",
                table: "courses");

            migrationBuilder.DropColumn(
                name: "state_id",
                table: "courses");

            migrationBuilder.DropColumn(
                name: "subject_id",
                table: "courses");

            migrationBuilder.DropColumn(
                name: "tag_ids",
                table: "courses");
        }
    }
}
