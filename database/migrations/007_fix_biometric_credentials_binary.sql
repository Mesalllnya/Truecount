-- =============================================================
-- TrueCount - Fix biometric_credentials column types for binary storage
-- Migration: 007_fix_biometric_credentials_binary.sql
-- =============================================================

USE `truecount_db`;

-- credential_id: store as binary (VARBINARY), max 1024 bytes for base64url decoded credential IDs
-- public_key: store as binary (VARBINARY), max 2048 bytes for SPKI DER
-- Both were incorrectly TEXT with charset conversion corrupting binary data

ALTER TABLE `biometric_credentials`
    MODIFY COLUMN `credential_id` VARBINARY(1024) NOT NULL,
    MODIFY COLUMN `public_key` VARBINARY(2048) NOT NULL;
