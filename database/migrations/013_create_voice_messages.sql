CREATE TABLE IF NOT EXISTS voice_messages (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    sender_id INT UNSIGNED NOT NULL,
    recipient_id INT UNSIGNED NOT NULL,
    file_id INT UNSIGNED NOT NULL,
    duration_seconds DECIMAL(10,2) NOT NULL DEFAULT 0,
    is_read TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at DATETIME NULL DEFAULT NULL,

    CONSTRAINT fk_voice_sender
        FOREIGN KEY (sender_id) REFERENCES users(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_voice_recipient
        FOREIGN KEY (recipient_id) REFERENCES users(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_voice_file
        FOREIGN KEY (file_id) REFERENCES encrypted_files(id)
        ON DELETE CASCADE,

    UNIQUE KEY uq_voice_file (file_id),
    INDEX idx_voice_recipient (recipient_id, created_at),
    INDEX idx_voice_sender (sender_id, created_at)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;