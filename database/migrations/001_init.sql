-- =============================================================
-- TrueCount — Database Migration (Sprint 1)
-- Database: truecount_db
--
-- Jalankan:  mysql -u root -p < database/migrations/001_init.sql
-- =============================================================

CREATE DATABASE IF NOT EXISTS `truecount_db`
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE `truecount_db`;

-- -------------------------------------------------------------
-- 1. users
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
    `id`            INT UNSIGNED     NOT NULL AUTO_INCREMENT,
    `username`      VARCHAR(50)      NOT NULL,
    `email`         VARCHAR(150)     NOT NULL,
    `password_hash` VARCHAR(255)     NOT NULL,          -- Argon2id hash
    `role`          ENUM('admin','voter') NOT NULL DEFAULT 'voter',
    `is_active`     TINYINT(1)       NOT NULL DEFAULT 1,
    `created_at`    DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`    DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP
                                         ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_users_username` (`username`),
    UNIQUE KEY `uq_users_email`    (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- 2. biometric_credentials  (WebAuthn / FIDO2 — Sprint 4)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `biometric_credentials` (
    `id`              INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id`         INT UNSIGNED NOT NULL,
    `credential_id`   TEXT         NOT NULL,   -- base64url encoded
    `public_key`      TEXT         NOT NULL,   -- COSE key
    `sign_count`      BIGINT       NOT NULL DEFAULT 0,
    `aaguid`          VARCHAR(36)  NULL,
    `created_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_biometric_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- 3. usb_tokens  (USB Dongle — Sprint 4)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `usb_tokens` (
    `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id`     INT UNSIGNED NOT NULL,
    `token_hash`  VARCHAR(255) NOT NULL,    -- hash dari secret key dongle
    `label`       VARCHAR(100) NULL,
    `is_active`   TINYINT(1)   NOT NULL DEFAULT 1,
    `registered_at` DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_usb_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- 4. elections
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `elections` (
    `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `title`       VARCHAR(255) NOT NULL,
    `description` TEXT         NULL,
    `start_time`  DATETIME     NOT NULL,
    `end_time`    DATETIME     NOT NULL,
    `status`      ENUM('draft','active','closed') NOT NULL DEFAULT 'draft',
    `created_by`  INT UNSIGNED NOT NULL,
    `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                   ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_election_creator`
        FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- 5. candidates
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `candidates` (
    `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `election_id` INT UNSIGNED NOT NULL,
    `name`        VARCHAR(150) NOT NULL,
    `vision`      TEXT         NULL,
    `mission`     TEXT         NULL,
    `photo_path`  VARCHAR(255) NULL,
    `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_candidate_election`
        FOREIGN KEY (`election_id`) REFERENCES `elections` (`id`)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- 6. voters  (partisipasi — TIDAK menyimpan pilihan)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `voters` (
    `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id`     INT UNSIGNED NOT NULL,
    `election_id` INT UNSIGNED NOT NULL,
    `has_voted`   TINYINT(1)   NOT NULL DEFAULT 0,
    `registered_at` DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `voted_at`    DATETIME     NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_voter_election` (`user_id`, `election_id`),
    CONSTRAINT `fk_voter_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
        ON DELETE CASCADE,
    CONSTRAINT `fk_voter_election`
        FOREIGN KEY (`election_id`) REFERENCES `elections` (`id`)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- 7. ballots  (isi suara — TIDAK ada FK ke users/voters)
-- Privacy by design: suara dan identitas pemilih terpisah.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `ballots` (
    `id`               INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `election_id`      INT UNSIGNED NOT NULL,
    `encrypted_vote`   TEXT         NOT NULL,  -- AES-256-GCM ciphertext
    `nonce`            VARCHAR(64)  NOT NULL,
    `integrity_hash`   VARCHAR(128) NOT NULL,  -- SHA-256
    `submitted_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_ballot_election`
        FOREIGN KEY (`election_id`) REFERENCES `elections` (`id`)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- 8. encrypted_messages  (Cryptography Module — Sprint 3)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `encrypted_messages` (
    `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id`       INT UNSIGNED NOT NULL,
    `algorithm`     ENUM('vigenere','aes256gcm','chacha20') NOT NULL,
    `ciphertext`    TEXT         NOT NULL,
    `iv_nonce`      VARCHAR(128) NULL,
    `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_encmsg_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- 9. encrypted_files  (Cryptography Module — Sprint 3)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `encrypted_files` (
    `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id`       INT UNSIGNED NOT NULL,
    `original_name` VARCHAR(255) NOT NULL,
    `stored_path`   VARCHAR(255) NOT NULL,
    `algorithm`     ENUM('aes256gcm','chacha20') NOT NULL,
    `file_hash`     VARCHAR(128) NOT NULL,
    `uploaded_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_encfile_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- 10. blocks  (Simple Blockchain — Sprint 3)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `blocks` (
    `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `election_id`   INT UNSIGNED NOT NULL,
    `block_index`   INT UNSIGNED NOT NULL,
    `data`          TEXT         NOT NULL,
    `previous_hash` VARCHAR(128) NOT NULL,
    `current_hash`  VARCHAR(128) NOT NULL,
    `timestamp`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_block_election`
        FOREIGN KEY (`election_id`) REFERENCES `elections` (`id`)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
