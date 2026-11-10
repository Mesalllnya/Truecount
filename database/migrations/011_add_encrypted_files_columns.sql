-- Migration: Tambah kolom nonce, auth_tag, file_size, mime_type ke encrypted_files
-- Dibutuhkan oleh FileEncryptionService (ChaCha20-Poly1305)

ALTER TABLE `encrypted_files`
    ADD COLUMN IF NOT EXISTS `nonce`     VARCHAR(64)  NOT NULL AFTER `algorithm`,
    ADD COLUMN IF NOT EXISTS `auth_tag`  VARCHAR(64)  NOT NULL AFTER `nonce`,
    ADD COLUMN IF NOT EXISTS `file_size` BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER `file_hash`,
    ADD COLUMN IF NOT EXISTS `mime_type` VARCHAR(100) NOT NULL DEFAULT 'application/octet-stream' AFTER `file_size`;

