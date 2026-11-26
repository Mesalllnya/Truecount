-- =============================================================
-- TrueCount - Dongle: unik global (satu credential satu pemakai)
-- Migration: 018
-- Description: Kebijakan baru: dongle HANYA untuk role admin, tiap
--              admin maksimal 1 dongle, dan satu credential dongle
--              tidak boleh terdaftar pada dua admin berbeda.
--              UNIQUE KEY ini menjamin credential_id cuma muncul
--              satu kali di seluruh tabel (penegakan terakhir di
--              level database — aturan role & batas 1 per admin
--              dijaga di endpoint register).
-- =============================================================

USE `truecount_db`;

-- MySQL 8 tidak punya ADD UNIQUE IF NOT EXISTS, jadi dicek dulu
-- lewat information_schema (pola sama dengan migration 016).
SET @ddl = IF(
    (SELECT COUNT(*) FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'usb_token_credentials'
       AND INDEX_NAME = 'uq_usb_token_credentials_credential_id') = 0,
    'ALTER TABLE `usb_token_credentials` ADD UNIQUE KEY `uq_usb_token_credentials_credential_id` (`credential_id`)',
    'DO 0'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
