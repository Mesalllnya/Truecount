-- Migration: Tambah kolom nonce, auth_tag, file_size, mime_type ke encrypted_files
-- Dibutuhkan oleh FileEncryptionService (ChaCha20-Poly1305)
--
-- MySQL 8 tidak mendukung `ADD COLUMN IF NOT EXISTS` (itu sintaks MariaDB),
-- jadi tiap kolom dicek dulu lewat information_schema lalu ditambahkan
-- lewat dynamic SQL. `DO 0` dipakai sebagai no-op kalau kolom sudah ada.

SET @ddl = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'encrypted_files'
       AND COLUMN_NAME = 'nonce') = 0,
    'ALTER TABLE `encrypted_files` ADD COLUMN `nonce` VARCHAR(64) NOT NULL AFTER `algorithm`',
    'DO 0'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'encrypted_files'
       AND COLUMN_NAME = 'auth_tag') = 0,
    'ALTER TABLE `encrypted_files` ADD COLUMN `auth_tag` VARCHAR(64) NOT NULL AFTER `nonce`',
    'DO 0'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'encrypted_files'
       AND COLUMN_NAME = 'file_size') = 0,
    'ALTER TABLE `encrypted_files` ADD COLUMN `file_size` BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER `file_hash`',
    'DO 0'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'encrypted_files'
       AND COLUMN_NAME = 'mime_type') = 0,
    'ALTER TABLE `encrypted_files` ADD COLUMN `mime_type` VARCHAR(100) NOT NULL DEFAULT ''application/octet-stream'' AFTER `file_size`',
    'DO 0'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
