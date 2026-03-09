-- Cases System Tables
-- Complete issue tracking, flagging, and case management

-- ═══════════════════════════════════════════════════════════════════════════
-- Cases table - Core issue tracking
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS cases (
  id VARCHAR(36) PRIMARY KEY,
  case_number VARCHAR(50) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  severity ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
  status ENUM('open', 'in_progress', 'resolved', 'closed', 'wont_fix') DEFAULT 'open',
  type ENUM('user_reported', 'auto_detected', 'monitoring') DEFAULT 'user_reported',
  category ENUM('bug', 'performance', 'ui_issue', 'data_issue', 'security', 'feature_request', 'other') DEFAULT 'other',
  source ENUM('user_report', 'auto_detected', 'health_monitor', 'ai_analysis') DEFAULT 'user_report',
  
  -- User reporting
  reported_by VARCHAR(36),
  assigned_to VARCHAR(36),
  
  -- Context
  url TEXT,
  page_path VARCHAR(500),
  component_name VARCHAR(255),
  error_message TEXT,
  error_stack TEXT,
  user_agent TEXT,
  browser_info JSON,
  
  -- AI analysis
  ai_analysis JSON COMMENT 'AI-generated component identification and suggestions',
  
  -- Resolution
  resolution TEXT,
  resolved_at DATETIME,
  resolved_by VARCHAR(36),
  
  -- Rating
  rating INT COMMENT '1-5 star rating by reporter',
  rating_comment TEXT,
  
  -- Metadata
  metadata JSON COMMENT 'Additional context: stack traces, screenshots, etc',
  tags JSON COMMENT 'Array of tag strings',
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_case_number (case_number),
  INDEX idx_status (status),
  INDEX idx_severity (severity),
  INDEX idx_type (type),
  INDEX idx_reported_by (reported_by),
  INDEX idx_assigned_to (assigned_to),
  INDEX idx_created (created_at),
  INDEX idx_page_path (page_path(255)),
  
  FOREIGN KEY (reported_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ═══════════════════════════════════════════════════════════════════════════
-- Case comments - Discussion thread for each case
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS case_comments (
  id VARCHAR(36) PRIMARY KEY,
  case_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36),
  comment TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT FALSE COMMENT 'Hidden from case reporter',
  attachments JSON COMMENT 'Array of file URLs',
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_case_id (case_id),
  INDEX idx_user_id (user_id),
  INDEX idx_created (created_at),
  
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ═══════════════════════════════════════════════════════════════════════════
-- Case activity log - Audit trail
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS case_activity (
  id VARCHAR(36) PRIMARY KEY,
  case_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36),
  action VARCHAR(50) NOT NULL COMMENT 'created, status_changed, assigned, commented, etc',
  old_value TEXT,
  new_value TEXT,
  metadata JSON,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_case_id (case_id),
  INDEX idx_action (action),
  INDEX idx_created (created_at),
  
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ═══════════════════════════════════════════════════════════════════════════
-- System health checks - Auto-detected issues
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS system_health_checks (
  id VARCHAR(36) PRIMARY KEY,
  check_type ENUM('endpoint', 'ingestion', 'database', 'service', 'enterprise') NOT NULL,
  check_name VARCHAR(255) NOT NULL,
  status ENUM('healthy', 'warning', 'error', 'unknown') DEFAULT 'unknown',
  
  -- Results
  response_time_ms INT,
  error_message TEXT,
  details JSON,
  
  -- Auto-case creation
  case_id VARCHAR(36) COMMENT 'Auto-created case if check fails',
  
  last_check DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_success DATETIME,
  last_failure DATETIME,
  consecutive_failures INT DEFAULT 0,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_type (check_type),
  INDEX idx_status (status),
  INDEX idx_name (check_name),
  INDEX idx_last_check (last_check),
  
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ═══════════════════════════════════════════════════════════════════════════
-- Insert default health checks
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO system_health_checks (id, check_type, check_name, status) VALUES
  (UUID(), 'database', 'MySQL Connection', 'unknown'),
  (UUID(), 'service', 'Ollama Service', 'unknown'),
  (UUID(), 'service', 'Redis Cache', 'unknown'),
  (UUID(), 'ingestion', 'Ingestion Queue', 'unknown')
ON DUPLICATE KEY UPDATE check_name=check_name;
