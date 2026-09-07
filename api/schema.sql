-- FinMS — MySQL schema
-- Ids stay VARCHAR: they are generated client-side (genId) and the seed data
-- uses readable keys like 'tx1' / 'acc2'. Keeping them avoids rewriting every
-- reference when data moves over from IndexedDB.

CREATE DATABASE IF NOT EXISTS finms
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE finms;

CREATE TABLE IF NOT EXISTS users (
  id         VARCHAR(32)  NOT NULL PRIMARY KEY,
  name       VARCHAR(120) NOT NULL,
  email      VARCHAR(190) NOT NULL,
  password   VARCHAR(255) NOT NULL,     -- password_hash(), never plaintext
  role       VARCHAR(40)  NOT NULL,
  active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at VARCHAR(32)  NULL,
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS categories (
  id        VARCHAR(32)  NOT NULL PRIMARY KEY,
  name      VARCHAR(120) NOT NULL,
  flow_type VARCHAR(16)  NOT NULL,
  section   VARCHAR(24)  NOT NULL DEFAULT 'operating',
  color     VARCHAR(16)  NULL,
  KEY idx_categories_flow (flow_type)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS accounts (
  id             VARCHAR(32)   NOT NULL PRIMARY KEY,
  name           VARCHAR(120)  NOT NULL,
  bank           VARCHAR(80)   NULL,
  account_number VARCHAR(60)   NULL,
  balance        DECIMAL(18,2) NOT NULL DEFAULT 0,
  type           VARCHAR(24)   NULL,
  color          VARCHAR(16)   NULL,
  active         TINYINT(1)    NOT NULL DEFAULT 1
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS clients (
  id         VARCHAR(32)  NOT NULL PRIMARY KEY,
  name       VARCHAR(160) NOT NULL,
  contact    VARCHAR(120) NULL,
  phone      VARCHAR(40)  NULL,
  email      VARCHAR(190) NULL,
  address    VARCHAR(255) NULL,
  created_at VARCHAR(32)  NULL,
  KEY idx_clients_name (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS projects (
  id          VARCHAR(32)   NOT NULL PRIMARY KEY,
  name        VARCHAR(190)  NOT NULL,
  client_id   VARCHAR(32)   NULL,
  value       DECIMAL(18,2) NOT NULL DEFAULT 0,
  status      VARCHAR(24)   NOT NULL DEFAULT 'ongoing',
  start_date  DATE          NULL,
  end_date    DATE          NULL,
  description TEXT          NULL,
  created_at  VARCHAR(32)   NULL,
  KEY idx_projects_client (client_id),
  KEY idx_projects_status (status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS milestones (
  id         VARCHAR(32)   NOT NULL PRIMARY KEY,
  project_id VARCHAR(32)   NULL,
  name       VARCHAR(190)  NOT NULL,
  percentage DECIMAL(6,2)  NULL,
  amount     DECIMAL(18,2) NOT NULL DEFAULT 0,
  due_date   DATE          NULL,
  status     VARCHAR(24)   NOT NULL DEFAULT 'pending',
  invoice_id VARCHAR(32)   NULL,
  KEY idx_milestones_project (project_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS invoices (
  id           VARCHAR(32)   NOT NULL PRIMARY KEY,
  number       VARCHAR(60)   NULL,
  project_id   VARCHAR(32)   NULL,
  milestone_id VARCHAR(32)   NULL,
  client_id    VARCHAR(32)   NULL,
  amount       DECIMAL(18,2) NOT NULL DEFAULT 0,
  tax          DECIMAL(18,2) NOT NULL DEFAULT 0,
  total        DECIMAL(18,2) NOT NULL DEFAULT 0,
  issue_date   DATE          NULL,
  due_date     DATE          NULL,
  status       VARCHAR(24)   NOT NULL DEFAULT 'draft',
  notes        TEXT          NULL,
  created_at   VARCHAR(32)   NULL,
  KEY idx_invoices_project (project_id),
  KEY idx_invoices_status (status),
  KEY idx_invoices_due (due_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS invoice_payments (
  id         VARCHAR(32)   NOT NULL PRIMARY KEY,
  invoice_id VARCHAR(32)   NULL,
  amount     DECIMAL(18,2) NOT NULL DEFAULT 0,
  date       DATE          NULL,
  account_id VARCHAR(32)   NULL,
  notes      TEXT          NULL,
  created_at VARCHAR(32)   NULL,
  KEY idx_invpay_invoice (invoice_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS expenses (
  id            VARCHAR(32)   NOT NULL PRIMARY KEY,
  title         VARCHAR(190)  NOT NULL,
  category_id   VARCHAR(32)   NULL,
  category_type VARCHAR(24)   NULL,
  amount        DECIMAL(18,2) NOT NULL DEFAULT 0,
  date          DATE          NULL,
  account_id    VARCHAR(32)   NULL,
  status        VARCHAR(24)   NOT NULL DEFAULT 'pending',
  requested_by  VARCHAR(32)   NULL,
  approved_by   VARCHAR(32)   NULL,
  description   TEXT          NULL,
  attachment    VARCHAR(255)  NULL,
  created_at    VARCHAR(32)   NULL,
  KEY idx_expenses_status (status),
  KEY idx_expenses_account (account_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS transactions (
  id          VARCHAR(32)   NOT NULL PRIMARY KEY,
  type        VARCHAR(16)   NOT NULL,
  account_id  VARCHAR(32)   NULL,
  category_id VARCHAR(32)   NULL,
  amount      DECIMAL(18,2) NOT NULL DEFAULT 0,
  date        DATE          NULL,
  description VARCHAR(255)  NULL,
  ref_type    VARCHAR(24)   NULL,
  ref_id      VARCHAR(32)   NULL,
  created_by  VARCHAR(32)   NULL,
  created_at  VARCHAR(32)   NULL,
  updated_at  VARCHAR(32)   NULL,
  KEY idx_tx_account (account_id),
  KEY idx_tx_date (date),
  KEY idx_tx_type (type),
  KEY idx_tx_category (category_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reconciliations (
  id         VARCHAR(32)   NOT NULL PRIMARY KEY,
  account_id VARCHAR(32)   NULL,
  date       DATE          NULL,
  amount     DECIMAL(18,2) NOT NULL DEFAULT 0,
  status     VARCHAR(24)   NULL,
  notes      TEXT          NULL,
  created_at VARCHAR(32)   NULL,
  KEY idx_recon_account (account_id)
) ENGINE=InnoDB;

-- settings holds heterogeneous rows (seeded, migrations, demo_reset_at), so the
-- record is kept whole as JSON rather than forced into fixed columns.
CREATE TABLE IF NOT EXISTS settings (
  `key`  VARCHAR(64) NOT NULL PRIMARY KEY,
  `data` LONGTEXT    NOT NULL
) ENGINE=InnoDB;
