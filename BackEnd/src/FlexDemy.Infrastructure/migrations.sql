CREATE TABLE IF NOT EXISTS "__EFMigrationsHistory" (
    migration_id character varying(150) NOT NULL,
    product_version character varying(32) NOT NULL,
    CONSTRAINT pk___ef_migrations_history PRIMARY KEY (migration_id)
);

START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809093104_InitialCreate') THEN
    CREATE TABLE courses (
        id character varying(64) NOT NULL,
        title character varying(255) NOT NULL,
        short_description text NOT NULL,
        full_description text NOT NULL,
        subject character varying(64) NOT NULL,
        level character varying(32) NOT NULL,
        target_grade_tag character varying(64) NOT NULL,
        tags text[] NOT NULL,
        instructor_name character varying(255) NOT NULL,
        instructor_role character varying(255),
        instructor_avatar text,
        rating numeric(3,2) NOT NULL,
        enrolled_count integer NOT NULL,
        estimated_hours integer NOT NULL,
        thumbnail_url text,
        badge_icon character varying(64),
        created_at timestamp with time zone NOT NULL,
        CONSTRAINT pk_courses PRIMARY KEY (id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809093104_InitialCreate') THEN
    INSERT INTO "__EFMigrationsHistory" (migration_id, product_version)
    VALUES ('20260809093104_InitialCreate', '10.0.4');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809103428_AddUsers') THEN
    CREATE TABLE users (
        id character varying(64) NOT NULL,
        email character varying(255) NOT NULL,
        password_hash text NOT NULL,
        first_name character varying(255) NOT NULL,
        last_name character varying(255) NOT NULL,
        created_at timestamp with time zone NOT NULL,
        CONSTRAINT pk_users PRIMARY KEY (id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809103428_AddUsers') THEN
    CREATE UNIQUE INDEX ix_users_email ON users (email);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809103428_AddUsers') THEN
    INSERT INTO "__EFMigrationsHistory" (migration_id, product_version)
    VALUES ('20260809103428_AddUsers', '10.0.4');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809111220_AddUserRole') THEN
    ALTER TABLE users ADD role character varying(32) NOT NULL DEFAULT 'Student';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809111220_AddUserRole') THEN
    INSERT INTO "__EFMigrationsHistory" (migration_id, product_version)
    VALUES ('20260809111220_AddUserRole', '10.0.4');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809122117_AddMasterData') THEN
    CREATE TABLE class_levels (
        id character varying(64) NOT NULL,
        name character varying(64) NOT NULL,
        sort_order integer NOT NULL,
        is_active boolean NOT NULL,
        created_at timestamp with time zone NOT NULL,
        CONSTRAINT pk_class_levels PRIMARY KEY (id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809122117_AddMasterData') THEN
    CREATE TABLE countries (
        id character varying(64) NOT NULL,
        name character varying(255) NOT NULL,
        iso_code character varying(8) NOT NULL,
        is_active boolean NOT NULL,
        created_at timestamp with time zone NOT NULL,
        CONSTRAINT pk_countries PRIMARY KEY (id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809122117_AddMasterData') THEN
    CREATE TABLE subjects (
        id character varying(64) NOT NULL,
        name character varying(128) NOT NULL,
        stream character varying(64),
        is_active boolean NOT NULL,
        created_at timestamp with time zone NOT NULL,
        CONSTRAINT pk_subjects PRIMARY KEY (id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809122117_AddMasterData') THEN
    CREATE TABLE states (
        id character varying(64) NOT NULL,
        country_id character varying(64) NOT NULL,
        name character varying(255) NOT NULL,
        code character varying(16) NOT NULL,
        is_active boolean NOT NULL,
        created_at timestamp with time zone NOT NULL,
        CONSTRAINT pk_states PRIMARY KEY (id),
        CONSTRAINT fk_states_countries_country_id FOREIGN KEY (country_id) REFERENCES countries (id) ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809122117_AddMasterData') THEN
    CREATE TABLE boards (
        id character varying(64) NOT NULL,
        name character varying(255) NOT NULL,
        code character varying(32) NOT NULL,
        state_id character varying(64),
        is_active boolean NOT NULL,
        created_at timestamp with time zone NOT NULL,
        CONSTRAINT pk_boards PRIMARY KEY (id),
        CONSTRAINT fk_boards_states_state_id FOREIGN KEY (state_id) REFERENCES states (id) ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809122117_AddMasterData') THEN
    CREATE TABLE cities (
        id character varying(64) NOT NULL,
        state_id character varying(64) NOT NULL,
        name character varying(255) NOT NULL,
        is_active boolean NOT NULL,
        created_at timestamp with time zone NOT NULL,
        CONSTRAINT pk_cities PRIMARY KEY (id),
        CONSTRAINT fk_cities_states_state_id FOREIGN KEY (state_id) REFERENCES states (id) ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809122117_AddMasterData') THEN
    CREATE INDEX ix_boards_state_id ON boards (state_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809122117_AddMasterData') THEN
    CREATE INDEX ix_cities_state_id ON cities (state_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809122117_AddMasterData') THEN
    CREATE UNIQUE INDEX ix_countries_iso_code ON countries (iso_code);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809122117_AddMasterData') THEN
    CREATE INDEX ix_states_country_id ON states (country_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809122117_AddMasterData') THEN
    INSERT INTO "__EFMigrationsHistory" (migration_id, product_version)
    VALUES ('20260809122117_AddMasterData', '10.0.4');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809123204_AddProfilesAndRolePipeline') THEN
    CREATE TABLE student_profiles (
        id character varying(64) NOT NULL,
        user_id character varying(64) NOT NULL,
        class_level_id character varying(64) NOT NULL,
        board_id character varying(64) NOT NULL,
        country_id character varying(64) NOT NULL,
        state_id character varying(64) NOT NULL,
        city_id character varying(64) NOT NULL,
        subject_ids text[] NOT NULL,
        created_at timestamp with time zone NOT NULL,
        updated_at timestamp with time zone NOT NULL,
        CONSTRAINT pk_student_profiles PRIMARY KEY (id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809123204_AddProfilesAndRolePipeline') THEN
    CREATE TABLE tutor_profiles (
        id character varying(64) NOT NULL,
        user_id character varying(64) NOT NULL,
        subject_ids text[] NOT NULL,
        country_id character varying(64) NOT NULL,
        state_id character varying(64) NOT NULL,
        city_id character varying(64) NOT NULL,
        bio text NOT NULL,
        qualifications text NOT NULL,
        reviewed_by_user_id character varying(64),
        reviewed_at timestamp with time zone,
        rejection_reason text,
        created_at timestamp with time zone NOT NULL,
        updated_at timestamp with time zone NOT NULL,
        CONSTRAINT pk_tutor_profiles PRIMARY KEY (id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809123204_AddProfilesAndRolePipeline') THEN
    CREATE UNIQUE INDEX ix_student_profiles_user_id ON student_profiles (user_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809123204_AddProfilesAndRolePipeline') THEN
    CREATE UNIQUE INDEX ix_tutor_profiles_user_id ON tutor_profiles (user_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809123204_AddProfilesAndRolePipeline') THEN
    INSERT INTO "__EFMigrationsHistory" (migration_id, product_version)
    VALUES ('20260809123204_AddProfilesAndRolePipeline', '10.0.4');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809130616_AddAuditColumns') THEN
    ALTER TABLE users ADD created_by text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809130616_AddAuditColumns') THEN
    ALTER TABLE users ADD is_active boolean NOT NULL DEFAULT FALSE;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809130616_AddAuditColumns') THEN
    ALTER TABLE users ADD is_deleted boolean NOT NULL DEFAULT FALSE;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809130616_AddAuditColumns') THEN
    ALTER TABLE users ADD updated_at timestamp with time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809130616_AddAuditColumns') THEN
    ALTER TABLE users ADD updated_by text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809130616_AddAuditColumns') THEN
    ALTER TABLE tutor_profiles ALTER COLUMN updated_at DROP NOT NULL;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809130616_AddAuditColumns') THEN
    ALTER TABLE tutor_profiles ADD created_by text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809130616_AddAuditColumns') THEN
    ALTER TABLE tutor_profiles ADD is_active boolean NOT NULL DEFAULT FALSE;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809130616_AddAuditColumns') THEN
    ALTER TABLE tutor_profiles ADD is_deleted boolean NOT NULL DEFAULT FALSE;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809130616_AddAuditColumns') THEN
    ALTER TABLE tutor_profiles ADD updated_by text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809130616_AddAuditColumns') THEN
    ALTER TABLE subjects ADD created_by text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809130616_AddAuditColumns') THEN
    ALTER TABLE subjects ADD is_deleted boolean NOT NULL DEFAULT FALSE;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809130616_AddAuditColumns') THEN
    ALTER TABLE subjects ADD updated_at timestamp with time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809130616_AddAuditColumns') THEN
    ALTER TABLE subjects ADD updated_by text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809130616_AddAuditColumns') THEN
    ALTER TABLE student_profiles ALTER COLUMN updated_at DROP NOT NULL;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809130616_AddAuditColumns') THEN
    ALTER TABLE student_profiles ADD created_by text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809130616_AddAuditColumns') THEN
    ALTER TABLE student_profiles ADD is_active boolean NOT NULL DEFAULT FALSE;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809130616_AddAuditColumns') THEN
    ALTER TABLE student_profiles ADD is_deleted boolean NOT NULL DEFAULT FALSE;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809130616_AddAuditColumns') THEN
    ALTER TABLE student_profiles ADD updated_by text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809130616_AddAuditColumns') THEN
    ALTER TABLE states ADD created_by text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809130616_AddAuditColumns') THEN
    ALTER TABLE states ADD is_deleted boolean NOT NULL DEFAULT FALSE;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809130616_AddAuditColumns') THEN
    ALTER TABLE states ADD updated_at timestamp with time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809130616_AddAuditColumns') THEN
    ALTER TABLE states ADD updated_by text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809130616_AddAuditColumns') THEN
    ALTER TABLE courses ADD created_by text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809130616_AddAuditColumns') THEN
    ALTER TABLE courses ADD is_active boolean NOT NULL DEFAULT FALSE;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809130616_AddAuditColumns') THEN
    ALTER TABLE courses ADD is_deleted boolean NOT NULL DEFAULT FALSE;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809130616_AddAuditColumns') THEN
    ALTER TABLE courses ADD updated_at timestamp with time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809130616_AddAuditColumns') THEN
    ALTER TABLE courses ADD updated_by text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809130616_AddAuditColumns') THEN
    ALTER TABLE countries ADD created_by text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809130616_AddAuditColumns') THEN
    ALTER TABLE countries ADD is_deleted boolean NOT NULL DEFAULT FALSE;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809130616_AddAuditColumns') THEN
    ALTER TABLE countries ADD updated_at timestamp with time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809130616_AddAuditColumns') THEN
    ALTER TABLE countries ADD updated_by text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809130616_AddAuditColumns') THEN
    ALTER TABLE class_levels ADD created_by text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809130616_AddAuditColumns') THEN
    ALTER TABLE class_levels ADD is_deleted boolean NOT NULL DEFAULT FALSE;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809130616_AddAuditColumns') THEN
    ALTER TABLE class_levels ADD updated_at timestamp with time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809130616_AddAuditColumns') THEN
    ALTER TABLE class_levels ADD updated_by text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809130616_AddAuditColumns') THEN
    ALTER TABLE cities ADD created_by text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809130616_AddAuditColumns') THEN
    ALTER TABLE cities ADD is_deleted boolean NOT NULL DEFAULT FALSE;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809130616_AddAuditColumns') THEN
    ALTER TABLE cities ADD updated_at timestamp with time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809130616_AddAuditColumns') THEN
    ALTER TABLE cities ADD updated_by text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809130616_AddAuditColumns') THEN
    ALTER TABLE boards ADD created_by text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809130616_AddAuditColumns') THEN
    ALTER TABLE boards ADD is_deleted boolean NOT NULL DEFAULT FALSE;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809130616_AddAuditColumns') THEN
    ALTER TABLE boards ADD updated_at timestamp with time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809130616_AddAuditColumns') THEN
    ALTER TABLE boards ADD updated_by text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809130616_AddAuditColumns') THEN
    INSERT INTO "__EFMigrationsHistory" (migration_id, product_version)
    VALUES ('20260809130616_AddAuditColumns', '10.0.4');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809131316_AddUserMustChangePassword') THEN
    ALTER TABLE users ADD must_change_password boolean NOT NULL DEFAULT FALSE;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809131316_AddUserMustChangePassword') THEN
    INSERT INTO "__EFMigrationsHistory" (migration_id, product_version)
    VALUES ('20260809131316_AddUserMustChangePassword', '10.0.4');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809132231_AddRolePermissions') THEN
    CREATE TABLE role_permissions (
        id character varying(64) NOT NULL,
        role character varying(32) NOT NULL,
        feature_key character varying(64) NOT NULL,
        is_visible boolean NOT NULL,
        is_active boolean NOT NULL,
        created_at timestamp with time zone NOT NULL,
        created_by text,
        updated_at timestamp with time zone,
        updated_by text,
        is_deleted boolean NOT NULL,
        CONSTRAINT pk_role_permissions PRIMARY KEY (id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809132231_AddRolePermissions') THEN
    CREATE UNIQUE INDEX ix_role_permissions_role_feature_key ON role_permissions (role, feature_key);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20260809132231_AddRolePermissions') THEN
    INSERT INTO "__EFMigrationsHistory" (migration_id, product_version)
    VALUES ('20260809132231_AddRolePermissions', '10.0.4');
    END IF;
END $EF$;
COMMIT;

