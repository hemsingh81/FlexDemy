using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FlexDemy.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddErrorRecords : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "error_records",
                columns: table => new
                {
                    id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    fingerprint = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    source = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    category = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    secondary_category = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    priority = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    message = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: false),
                    exception_type = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    stack_trace = table.Column<string>(type: "text", nullable: true),
                    origin_context = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    related_entity_type = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    related_entity_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    user_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    request_path = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    correlation_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    occurrence_count = table.Column<int>(type: "integer", nullable: false),
                    first_occurred_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    last_occurred_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    resolved_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    resolved_by_user_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    archived_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    priority_increased_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    priority_increased_by_user_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    created_by = table.Column<string>(type: "text", nullable: true),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    updated_by = table.Column<string>(type: "text", nullable: true),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_error_records", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_error_records_category",
                table: "error_records",
                column: "category");

            migrationBuilder.CreateIndex(
                name: "ix_error_records_fingerprint",
                table: "error_records",
                column: "fingerprint");

            migrationBuilder.CreateIndex(
                name: "ix_error_records_last_occurred_at",
                table: "error_records",
                column: "last_occurred_at");

            migrationBuilder.CreateIndex(
                name: "ix_error_records_priority",
                table: "error_records",
                column: "priority");

            migrationBuilder.CreateIndex(
                name: "ix_error_records_status",
                table: "error_records",
                column: "status");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "error_records");
        }
    }
}
