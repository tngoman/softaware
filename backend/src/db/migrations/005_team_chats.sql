-- ═══════════════════════════════════════════════════════════════
-- Team Chat — local DB-backed group chat tables
-- Run this migration against your MySQL database
-- ═══════════════════════════════════════════════════════════════

-- Teams (the groups themselves)
CREATE TABLE IF NOT EXISTS team_chats (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100)    NOT NULL,
  description VARCHAR(500)    NULL,
  created_by  VARCHAR(36)     NULL,   -- references users.id
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME        NULL ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_team_chats_created_by (created_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Team members (who belongs to which team)
CREATE TABLE IF NOT EXISTS team_chat_members (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  team_id    BIGINT UNSIGNED NOT NULL,
  user_id    VARCHAR(36)     NOT NULL,
  role       ENUM('admin', 'member') NOT NULL DEFAULT 'member',
  joined_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  removed_at DATETIME        NULL,
  INDEX idx_tcm_team_user (team_id, user_id),
  INDEX idx_tcm_user (user_id),
  CONSTRAINT fk_tcm_team FOREIGN KEY (team_id) REFERENCES team_chats(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Chat messages
CREATE TABLE IF NOT EXISTS team_chat_messages (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  team_id      BIGINT UNSIGNED NOT NULL,
  user_id      VARCHAR(36)     NULL,
  content      TEXT            NOT NULL,
  message_type ENUM('text', 'image', 'video', 'audio', 'file') NOT NULL DEFAULT 'text',
  file_url     VARCHAR(500)    NULL,
  file_name    VARCHAR(255)    NULL,
  file_type    VARCHAR(100)    NULL,
  file_size    BIGINT UNSIGNED NULL,
  reply_to_id  BIGINT UNSIGNED NULL,
  created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tcmsg_team_date (team_id, created_at),
  INDEX idx_tcmsg_user (user_id),
  CONSTRAINT fk_tcmsg_team     FOREIGN KEY (team_id)     REFERENCES team_chats(id) ON DELETE CASCADE,
  CONSTRAINT fk_tcmsg_reply_to FOREIGN KEY (reply_to_id) REFERENCES team_chat_messages(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
