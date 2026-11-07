-- USB Token Credentials (WebAuthn-style / ECDSA P-256)
-- Untuk menyimpan public key user yang terdaftar via USB token
-- Sprint 4: MFA - USB Token (software token di USB flashdisk)

CREATE TABLE IF NOT EXISTS `usb_token_credentials` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `credential_id` VARBINARY(32) NOT NULL COMMENT 'SHA-256(SPKI public key) - unique identifier',
  `public_key` VARBINARY(200) NOT NULL COMMENT 'SPKI DER encoded public key (ECDSA P-256 ~91 bytes)',
  `label` VARCHAR(100) DEFAULT NULL COMMENT 'Label user: "USB Kantor", "USB Rumah"',
  `aaguid` BINARY(16) DEFAULT NULL COMMENT 'Authenticator Attestation GUID (untuk hardware key nanti)',
  `sign_count` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Signature counter (replay protection)',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_used_at` TIMESTAMP NULL DEFAULT NULL,
  `revoked_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_credential` (`user_id`, `credential_id`),
  KEY `idx_credential_id` (`credential_id`),
  KEY `idx_usb_token_credential_lookup` (`credential_id`, `revoked_at`),
  CONSTRAINT `fk_usb_token_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='USB Token / WebAuthn credentials untuk MFA';