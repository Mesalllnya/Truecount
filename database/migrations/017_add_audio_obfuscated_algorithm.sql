-- Migration 017: Tambah nilai 'audio_obfuscated' ke ENUM algorithm di encrypted_files
-- Dibutuhkan oleh AudioObfuscationService (voice message audio disimpan dengan
-- header dipertahankan + samples ter-XOR, bukan ciphertext biner penuh).

SET @ddl = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME   = 'encrypted_files'
       AND COLUMN_NAME  = 'algorithm'
       AND COLUMN_TYPE NOT LIKE '%audio_obfuscated%') > 0,
    'ALTER TABLE `encrypted_files` MODIFY COLUMN `algorithm` ENUM(''aes256gcm'',''chacha20'',''audio_obfuscated'') NOT NULL',
    'DO 0'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
