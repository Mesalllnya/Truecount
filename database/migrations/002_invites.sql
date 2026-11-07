-- =============================================================
-- TrueCount — Database Migration (Sprint 2)
-- Pendaftaran via Undangan (Invite) — admin-only registration
--
-- Akun tidak lagi bisa dibuat bebas oleh publik.
-- Admin membuat undangan (token), lalu calon pengguna
-- mengklaim akun lewat tautan /daftar?undangan=<token>.
-- =============================================================

USE `truecount_db`;

-- -------------------------------------------------------------
-- 11. invites
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `invites` (
    `id`          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    `token`       CHAR(48)      NOT NULL,             -- bin2hex(random_bytes(24))
    `email`       VARCHAR(150)  NULL,                 -- NULL = undangan terbuka (siapapun bisa klaim)
    `role`        ENUM('admin','voter') NOT NULL DEFAULT 'voter',
    `status`      ENUM('pending','accepted','revoked') NOT NULL DEFAULT 'pending',
    `created_by`  INT UNSIGNED  NOT NULL,             -- admin yang membuat undangan
    `expires_at`  DATETIME      NOT NULL,
    `used_by`     INT UNSIGNED  NULL,                 -- user yang mengklaim (jika sudah dipakai)
    `used_at`     DATETIME      NULL,
    `created_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_invites_token`  (`token`),
    KEY `idx_invites_status`       (`status`),
    KEY `idx_invites_expires_at`   (`expires_at`),
    CONSTRAINT `fk_invite_creator`
        FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
    CONSTRAINT `fk_invite_user`
        FOREIGN KEY (`used_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
