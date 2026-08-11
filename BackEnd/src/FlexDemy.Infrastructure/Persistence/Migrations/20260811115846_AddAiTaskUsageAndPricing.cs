using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FlexDemy.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddAiTaskUsageAndPricing : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "fallback_price_per_million_input_tokens",
                table: "ai_task_configs",
                type: "numeric(12,4)",
                precision: 12,
                scale: 4,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "fallback_price_per_million_output_tokens",
                table: "ai_task_configs",
                type: "numeric(12,4)",
                precision: 12,
                scale: 4,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "price_per_million_input_tokens",
                table: "ai_task_configs",
                type: "numeric(12,4)",
                precision: 12,
                scale: 4,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "price_per_million_output_tokens",
                table: "ai_task_configs",
                type: "numeric(12,4)",
                precision: 12,
                scale: 4,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.CreateTable(
                name: "ai_task_usages",
                columns: table => new
                {
                    id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    task_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    provider = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    model = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    prompt_tokens = table.Column<int>(type: "integer", nullable: false),
                    completion_tokens = table.Column<int>(type: "integer", nullable: false),
                    total_tokens = table.Column<int>(type: "integer", nullable: false),
                    cost = table.Column<decimal>(type: "numeric(12,6)", precision: 12, scale: 6, nullable: false),
                    is_fallback_served = table.Column<bool>(type: "boolean", nullable: false),
                    course_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    tutor_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    created_by = table.Column<string>(type: "text", nullable: true),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    updated_by = table.Column<string>(type: "text", nullable: true),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_ai_task_usages", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_ai_task_usages_created_at",
                table: "ai_task_usages",
                column: "created_at");

            migrationBuilder.CreateIndex(
                name: "ix_ai_task_usages_task_id",
                table: "ai_task_usages",
                column: "task_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ai_task_usages");

            migrationBuilder.DropColumn(
                name: "fallback_price_per_million_input_tokens",
                table: "ai_task_configs");

            migrationBuilder.DropColumn(
                name: "fallback_price_per_million_output_tokens",
                table: "ai_task_configs");

            migrationBuilder.DropColumn(
                name: "price_per_million_input_tokens",
                table: "ai_task_configs");

            migrationBuilder.DropColumn(
                name: "price_per_million_output_tokens",
                table: "ai_task_configs");
        }
    }
}
