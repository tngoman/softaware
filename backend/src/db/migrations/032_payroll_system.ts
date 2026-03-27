import { db } from '../mysql.js';

/**
 * Migration 032 — Payroll System
 *
 * Adds payroll profile, salary, banking approval, and payslip tables.
 */
export async function up(): Promise<void> {
  console.log('[Migration 032] Creating payroll tables...');

  await db.execute(`
    CREATE TABLE IF NOT EXISTS staff_payroll_profiles (
      id                   VARCHAR(36)  NOT NULL PRIMARY KEY,
      user_id              VARCHAR(36)  NOT NULL,
      employment_date      DATE         NOT NULL,
      id_number            VARCHAR(50)  NULL,
      tax_number           VARCHAR(50)  NULL,
      bank_name            VARCHAR(100) NULL,
      branch_code          VARCHAR(20)  NULL,
      account_number       TEXT         NULL,
      account_type         VARCHAR(20)  NULL,
      account_holder_name  VARCHAR(255) NULL,
      banking_updated_at   DATETIME     NULL,
      banking_updated_by   VARCHAR(36)  NULL,
      created_by           VARCHAR(36)  NULL,
      created_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      UNIQUE KEY uq_staff_payroll_profiles_user (user_id),
      KEY idx_staff_payroll_profiles_employment_date (employment_date),
      KEY idx_staff_payroll_profiles_banking_updated_by (banking_updated_by),
      KEY idx_staff_payroll_profiles_created_by (created_by),

      CONSTRAINT fk_staff_payroll_profiles_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_staff_payroll_profiles_banking_updated_by
        FOREIGN KEY (banking_updated_by) REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT fk_staff_payroll_profiles_created_by
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS banking_change_requests (
      id                   VARCHAR(36)  NOT NULL PRIMARY KEY,
      user_id              VARCHAR(36)  NOT NULL,
      bank_name            VARCHAR(100) NOT NULL,
      branch_code          VARCHAR(20)  NOT NULL,
      account_number       TEXT         NOT NULL,
      account_type         VARCHAR(20)  NOT NULL,
      account_holder_name  VARCHAR(255) NOT NULL,
      status               ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
      rejection_reason     TEXT         NULL,
      reviewed_by          VARCHAR(36)  NULL,
      reviewed_at          DATETIME     NULL,
      created_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      KEY idx_banking_change_requests_user (user_id),
      KEY idx_banking_change_requests_status (status),
      KEY idx_banking_change_requests_reviewed_by (reviewed_by),
      KEY idx_banking_change_requests_created_at (created_at),

      CONSTRAINT fk_banking_change_requests_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_banking_change_requests_reviewed_by
        FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS staff_salaries (
      id                  VARCHAR(36)  NOT NULL PRIMARY KEY,
      user_id             VARCHAR(36)  NOT NULL,
      gross_salary_cents  BIGINT       NOT NULL,
      effective_from      DATE         NOT NULL,
      notes               TEXT         NULL,
      created_by          VARCHAR(36)  NULL,
      created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      UNIQUE KEY uq_staff_salaries_user (user_id),
      KEY idx_staff_salaries_effective_from (effective_from),
      KEY idx_staff_salaries_created_by (created_by),

      CONSTRAINT fk_staff_salaries_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_staff_salaries_created_by
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS salary_deductions (
      id            VARCHAR(36) NOT NULL PRIMARY KEY,
      salary_id     VARCHAR(36) NOT NULL,
      category      ENUM('deduction', 'allowance') NOT NULL,
      type          VARCHAR(100) NOT NULL,
      label         VARCHAR(255) NOT NULL,
      amount_cents  BIGINT      NOT NULL,
      sort_order    INT         NOT NULL DEFAULT 0,
      created_at    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      KEY idx_salary_deductions_salary_id (salary_id),
      KEY idx_salary_deductions_category (category),
      KEY idx_salary_deductions_sort_order (sort_order),

      CONSTRAINT fk_salary_deductions_salary
        FOREIGN KEY (salary_id) REFERENCES staff_salaries(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS payslips (
      id                       VARCHAR(36) NOT NULL PRIMARY KEY,
      user_id                  VARCHAR(36) NOT NULL,
      salary_id                VARCHAR(36) NULL,
      reference_number         VARCHAR(50) NOT NULL,
      pay_month                TINYINT     NOT NULL,
      pay_year                 SMALLINT    NOT NULL,
      gross_salary_cents       BIGINT      NOT NULL,
      total_deductions_cents   BIGINT      NOT NULL DEFAULT 0,
      total_allowances_cents   BIGINT      NOT NULL DEFAULT 0,
      net_salary_cents         BIGINT      NOT NULL,
      deductions_snapshot      JSON        NOT NULL,
      allowances_snapshot      JSON        NOT NULL,
      status                   ENUM('generated', 'voided') NOT NULL DEFAULT 'generated',
      voided_reason            TEXT        NULL,
      generated_by             VARCHAR(36) NULL,
      generated_at             DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at               DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at               DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      UNIQUE KEY uq_payslips_reference_number (reference_number),
      UNIQUE KEY uq_payslips_user_period (user_id, pay_month, pay_year),
      KEY idx_payslips_salary_id (salary_id),
      KEY idx_payslips_status (status),
      KEY idx_payslips_period (pay_year, pay_month),
      KEY idx_payslips_generated_by (generated_by),

      CONSTRAINT fk_payslips_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_payslips_salary
        FOREIGN KEY (salary_id) REFERENCES staff_salaries(id) ON DELETE SET NULL,
      CONSTRAINT fk_payslips_generated_by
        FOREIGN KEY (generated_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('[Migration 032] ✅ payroll tables created');
}

export async function down(): Promise<void> {
  await db.execute('DROP TABLE IF EXISTS payslips');
  await db.execute('DROP TABLE IF EXISTS salary_deductions');
  await db.execute('DROP TABLE IF EXISTS staff_salaries');
  await db.execute('DROP TABLE IF EXISTS banking_change_requests');
  await db.execute('DROP TABLE IF EXISTS staff_payroll_profiles');
  console.log('[Migration 032] ✅ payroll tables dropped');
}
