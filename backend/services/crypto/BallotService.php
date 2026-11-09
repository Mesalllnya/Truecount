<?php

/**
 * Ballot Service
 * TrueCount - Cryptography Module
 *
 * Mengelola validasi, enkripsi, dan penyimpanan ballot.
 */

require_once __DIR__ . '/AESGCMService.php';
require_once __DIR__ . '/../../config/database.php';

class BallotService
{
    private const CRYPTO_VERSION = 1;

    /**
     * AAD untuk mengikat ciphertext dengan election ID.
     */
    private static function getAAD(int $electionId): string
    {
        return 'truecount:ballot:v1:election:' . $electionId;
    }

    /**
     * Submit suara pemilih.
     *
     * Identitas pemilih hanya digunakan untuk validasi
     * dan pembaruan tabel voters.
     *
     * Tidak disimpan pada tabel ballots.
     */
    public static function submitVote(
        int $userId,
        int $electionId,
        int $candidateId
    ): int {

        if ($userId <= 0 || $electionId <= 0 || $candidateId <= 0) {
            throw new InvalidArgumentException('Data voting tidak valid.');
        }

        $db = getDB();

        try {
            $db->beginTransaction();

            // 1. Validasi dan kunci status pemilih.
            $stmt = $db->prepare(
                "SELECT id, has_voted
                FROM voters
                WHERE user_id = :user_id
                AND election_id = :election_id
                LIMIT 1
                FOR UPDATE"
            );

            $stmt->execute([
                ':user_id' => $userId,
                ':election_id' => $electionId
            ]);

            $voter = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$voter) {
                throw new RuntimeException(
                    'Anda tidak terdaftar sebagai pemilih dalam pemilihan ini.'
                );
            }

            if ((int) $voter['has_voted'] === 1) {
                throw new RuntimeException(
                    'Anda sudah menggunakan hak pilih.'
                );
            }

            // 2. Validasi status dan periode pemilihan.
            $stmt = $db->prepare(
                "SELECT id, status, start_time, end_time
                FROM elections
                WHERE id = :election_id
                LIMIT 1
                FOR UPDATE"
            );

            $stmt->execute([
                ':election_id' => $electionId
            ]);

            $election = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$election) {
                throw new RuntimeException('Pemilihan tidak ditemukan.');
            }

            if ($election['status'] !== 'active') {
                throw new RuntimeException('Pemilihan tidak sedang aktif.');
            }

            $stmt = $db->prepare(
                "SELECT
                    UTC_TIMESTAMP() >= :start_time
                    AND UTC_TIMESTAMP() <= :end_time AS is_open"
            );

            $stmt->execute([
                ':start_time' => $election['start_time'],
                ':end_time' => $election['end_time']
            ]);

            if (!(bool) $stmt->fetchColumn()) {
                throw new RuntimeException(
                    'Pemilihan berada di luar periode voting.'
                );
            }

            // 3. Pastikan kandidat berasal dari pemilihan tersebut.
            $stmt = $db->prepare(
                "SELECT id
                FROM candidates
                WHERE id = :candidate_id
                AND election_id = :election_id
                LIMIT 1"
            );

            $stmt->execute([
                ':candidate_id' => $candidateId,
                ':election_id' => $electionId
            ]);

            if (!$stmt->fetchColumn()) {
                throw new RuntimeException(
                    'Kandidat tidak ditemukan dalam pemilihan ini.'
                );
            }

            // 4. Buat payload suara.
            $payload = json_encode([
                'election_id' => $electionId,
                'candidate_id' => $candidateId
            ], JSON_THROW_ON_ERROR);

            // 5. Enkripsi menggunakan AES-256-GCM + AAD.
            $aad = self::getAAD($electionId);

            $encrypted = AESGCMService::encrypt(
                $payload,
                $aad
            );

            // 6. Buat hash untuk pemeriksaan integritas tambahan.
            $integrityHash = hash(
                'sha256',
                $encrypted['ciphertext'] .
                $encrypted['nonce'] .
                $encrypted['tag']
            );

            // 7. Simpan ballot tanpa user_id atau voter_id.
            $stmt = $db->prepare(
                    "INSERT INTO ballots
                    (
                    election_id,
                    encrypted_vote,
                    nonce,
                    auth_tag,
                    crypto_version,
                    integrity_hash,
                    submitted_at
                    )
                VALUES
                    (
                    :election_id,
                :encrypted_vote,
                :nonce,
                :auth_tag,
                :crypto_version,
                :integrity_hash,
                UTC_TIMESTAMP()
                    )"
                );

            $stmt->execute([
                ':election_id' => $electionId,
                ':encrypted_vote' => $encrypted['ciphertext'],
                ':nonce' => $encrypted['nonce'],
                ':auth_tag' => $encrypted['tag'],
                ':crypto_version' => self::CRYPTO_VERSION,
                ':integrity_hash' => $integrityHash
            ]);

            $ballotId = (int) $db->lastInsertId();


            // 8. Tandai pemilih sudah menggunakan hak pilih.
            $stmt = $db->prepare(
                "UPDATE voters
                SET has_voted = 1,
                    voted_at = UTC_TIMESTAMP()
                WHERE id = :voter_id
                AND has_voted = 0"
            );

            $stmt->execute([
                ':voter_id' => $voter['id']
            ]);

            if ($stmt->rowCount() !== 1) {
                throw new RuntimeException(
                    'Gagal memperbarui status hak pilih.'
                );
            }

            $db->commit();

            return $ballotId;

        } catch (Throwable $e) {

            if ($db->inTransaction()) {
                $db->rollBack();
            }

            throw $e;
        }
    }
}
