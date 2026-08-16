using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FlexDemy.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSettingChangeHistories : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "setting_change_histories",
                columns: table => new
                {
                    id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    setting_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    key = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    key_type = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    old_value = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    new_value = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    created_by = table.Column<string>(type: "text", nullable: true),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    updated_by = table.Column<string>(type: "text", nullable: true),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_setting_change_histories", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_setting_change_histories_setting_id",
                table: "setting_change_histories",
                column: "setting_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "setting_change_histories");
        }
    }
}
