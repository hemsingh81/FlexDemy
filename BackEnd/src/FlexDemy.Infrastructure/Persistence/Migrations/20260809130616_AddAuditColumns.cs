using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FlexDemy.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddAuditColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "created_by",
                table: "users",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_active",
                table: "users",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_deleted",
                table: "users",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "updated_at",
                table: "users",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "updated_by",
                table: "users",
                type: "text",
                nullable: true);

            migrationBuilder.AlterColumn<DateTimeOffset>(
                name: "updated_at",
                table: "tutor_profiles",
                type: "timestamp with time zone",
                nullable: true,
                oldClrType: typeof(DateTimeOffset),
                oldType: "timestamp with time zone");

            migrationBuilder.AddColumn<string>(
                name: "created_by",
                table: "tutor_profiles",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_active",
                table: "tutor_profiles",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_deleted",
                table: "tutor_profiles",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "updated_by",
                table: "tutor_profiles",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "created_by",
                table: "subjects",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_deleted",
                table: "subjects",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "updated_at",
                table: "subjects",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "updated_by",
                table: "subjects",
                type: "text",
                nullable: true);

            migrationBuilder.AlterColumn<DateTimeOffset>(
                name: "updated_at",
                table: "student_profiles",
                type: "timestamp with time zone",
                nullable: true,
                oldClrType: typeof(DateTimeOffset),
                oldType: "timestamp with time zone");

            migrationBuilder.AddColumn<string>(
                name: "created_by",
                table: "student_profiles",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_active",
                table: "student_profiles",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_deleted",
                table: "student_profiles",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "updated_by",
                table: "student_profiles",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "created_by",
                table: "states",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_deleted",
                table: "states",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "updated_at",
                table: "states",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "updated_by",
                table: "states",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "created_by",
                table: "courses",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_active",
                table: "courses",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_deleted",
                table: "courses",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "updated_at",
                table: "courses",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "updated_by",
                table: "courses",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "created_by",
                table: "countries",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_deleted",
                table: "countries",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "updated_at",
                table: "countries",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "updated_by",
                table: "countries",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "created_by",
                table: "class_levels",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_deleted",
                table: "class_levels",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "updated_at",
                table: "class_levels",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "updated_by",
                table: "class_levels",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "created_by",
                table: "cities",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_deleted",
                table: "cities",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "updated_at",
                table: "cities",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "updated_by",
                table: "cities",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "created_by",
                table: "boards",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_deleted",
                table: "boards",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "updated_at",
                table: "boards",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "updated_by",
                table: "boards",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "created_by",
                table: "users");

            migrationBuilder.DropColumn(
                name: "is_active",
                table: "users");

            migrationBuilder.DropColumn(
                name: "is_deleted",
                table: "users");

            migrationBuilder.DropColumn(
                name: "updated_at",
                table: "users");

            migrationBuilder.DropColumn(
                name: "updated_by",
                table: "users");

            migrationBuilder.DropColumn(
                name: "created_by",
                table: "tutor_profiles");

            migrationBuilder.DropColumn(
                name: "is_active",
                table: "tutor_profiles");

            migrationBuilder.DropColumn(
                name: "is_deleted",
                table: "tutor_profiles");

            migrationBuilder.DropColumn(
                name: "updated_by",
                table: "tutor_profiles");

            migrationBuilder.DropColumn(
                name: "created_by",
                table: "subjects");

            migrationBuilder.DropColumn(
                name: "is_deleted",
                table: "subjects");

            migrationBuilder.DropColumn(
                name: "updated_at",
                table: "subjects");

            migrationBuilder.DropColumn(
                name: "updated_by",
                table: "subjects");

            migrationBuilder.DropColumn(
                name: "created_by",
                table: "student_profiles");

            migrationBuilder.DropColumn(
                name: "is_active",
                table: "student_profiles");

            migrationBuilder.DropColumn(
                name: "is_deleted",
                table: "student_profiles");

            migrationBuilder.DropColumn(
                name: "updated_by",
                table: "student_profiles");

            migrationBuilder.DropColumn(
                name: "created_by",
                table: "states");

            migrationBuilder.DropColumn(
                name: "is_deleted",
                table: "states");

            migrationBuilder.DropColumn(
                name: "updated_at",
                table: "states");

            migrationBuilder.DropColumn(
                name: "updated_by",
                table: "states");

            migrationBuilder.DropColumn(
                name: "created_by",
                table: "courses");

            migrationBuilder.DropColumn(
                name: "is_active",
                table: "courses");

            migrationBuilder.DropColumn(
                name: "is_deleted",
                table: "courses");

            migrationBuilder.DropColumn(
                name: "updated_at",
                table: "courses");

            migrationBuilder.DropColumn(
                name: "updated_by",
                table: "courses");

            migrationBuilder.DropColumn(
                name: "created_by",
                table: "countries");

            migrationBuilder.DropColumn(
                name: "is_deleted",
                table: "countries");

            migrationBuilder.DropColumn(
                name: "updated_at",
                table: "countries");

            migrationBuilder.DropColumn(
                name: "updated_by",
                table: "countries");

            migrationBuilder.DropColumn(
                name: "created_by",
                table: "class_levels");

            migrationBuilder.DropColumn(
                name: "is_deleted",
                table: "class_levels");

            migrationBuilder.DropColumn(
                name: "updated_at",
                table: "class_levels");

            migrationBuilder.DropColumn(
                name: "updated_by",
                table: "class_levels");

            migrationBuilder.DropColumn(
                name: "created_by",
                table: "cities");

            migrationBuilder.DropColumn(
                name: "is_deleted",
                table: "cities");

            migrationBuilder.DropColumn(
                name: "updated_at",
                table: "cities");

            migrationBuilder.DropColumn(
                name: "updated_by",
                table: "cities");

            migrationBuilder.DropColumn(
                name: "created_by",
                table: "boards");

            migrationBuilder.DropColumn(
                name: "is_deleted",
                table: "boards");

            migrationBuilder.DropColumn(
                name: "updated_at",
                table: "boards");

            migrationBuilder.DropColumn(
                name: "updated_by",
                table: "boards");

            migrationBuilder.AlterColumn<DateTimeOffset>(
                name: "updated_at",
                table: "tutor_profiles",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTimeOffset(new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)),
                oldClrType: typeof(DateTimeOffset),
                oldType: "timestamp with time zone",
                oldNullable: true);

            migrationBuilder.AlterColumn<DateTimeOffset>(
                name: "updated_at",
                table: "student_profiles",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTimeOffset(new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)),
                oldClrType: typeof(DateTimeOffset),
                oldType: "timestamp with time zone",
                oldNullable: true);
        }
    }
}
