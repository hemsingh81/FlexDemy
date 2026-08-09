using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FlexDemy.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddProfilesAndRolePipeline : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "student_profiles",
                columns: table => new
                {
                    id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    user_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    class_level_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    board_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    country_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    state_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    city_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    subject_ids = table.Column<List<string>>(type: "text[]", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_student_profiles", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "tutor_profiles",
                columns: table => new
                {
                    id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    user_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    subject_ids = table.Column<List<string>>(type: "text[]", nullable: false),
                    country_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    state_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    city_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    bio = table.Column<string>(type: "text", nullable: false),
                    qualifications = table.Column<string>(type: "text", nullable: false),
                    reviewed_by_user_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    reviewed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    rejection_reason = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_tutor_profiles", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_student_profiles_user_id",
                table: "student_profiles",
                column: "user_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_tutor_profiles_user_id",
                table: "tutor_profiles",
                column: "user_id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "student_profiles");

            migrationBuilder.DropTable(
                name: "tutor_profiles");
        }
    }
}
