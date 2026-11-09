<?php

/**
 * Blockchain Service
 * TrueCount - Cryptography Module
 *
 * Hash-chain audit trail untuk integritas ballot.
 * Tidak menyimpan plaintext pilihan kandidat.
 */

require_once __DIR__ . '/../../config/database.php';

class BlockchainService
{
    private const GENESIS_PREVIOUS_HASH =
        '0000000000000000000000000000000000000000000000000000000000000000';

    /**
     * Menghitung hash sebuah block.
     */
    private static function calculateBlockHash(
        int $electionId,
        int $index,
        string $data,
        string $previousHash,
        string $timestamp
    ): string {
        $payload = json_encode([
            'election_id' => $electionId,
            'block_index' => $index,
            'data' => $data,
            'previous_hash' => $previousHash,
            'timestamp' => $timestamp
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);

        return hash('sha256', $payload);
    }

    /**
     * Menghitung Merkle Root dari kumpulan hash ballot.
     */
    private static function calculateMerkleRoot(array $leaves): string
    {
        if (count($leaves) === 0) {
            return hash('sha256', 'EMPTY_ELECTION');
        }

        while (count($leaves) > 1) {
            $nextLevel = [];

            for ($i = 0; $i < count($leaves); $i += 2) {
                $left = $leaves[$i];
                $right = $leaves[$i + 1] ?? $left;

                $nextLevel[] = hash('sha256', $left . $right);
            }

            $leaves = $nextLevel;
        }

        return $leaves[0];
    }

    /**
     * Membuat format hasil kegagalan verifikasi.
     */
    private static function verificationFailure(
        string $message,
        int $blocksChecked = 0,
        ?int $failedBlock = null
    ): array {
        $result = [
            'valid' => false,
            'message' => $message,
            'blocks_checked' => $blocksChecked
        ];

        if ($failedBlock !== null) {
            $result['failed_block'] = $failedBlock;
        }

        return $result;
    }

    /**
     * Memverifikasi hash chain dan commitment ballot.
     *
     * $requireSealed:
     * - true: wajib memiliki tepat satu election_sealed di block terakhir.
     * - false: mengizinkan chain yang belum diseal, untuk proses sealing.
     */
    private static function verifyChainInternal(
        PDO $db,
        int $electionId,
        bool $requireSealed
    ): array {
        $stmt = $db->prepare(
            "SELECT block_index, data, previous_hash,
                    current_hash, timestamp
             FROM blocks
             WHERE election_id = :election_id
             ORDER BY block_index ASC"
        );

        $stmt->execute([':election_id' => $electionId]);
        $blocks = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if (count($blocks) === 0) {
            return self::verificationFailure(
                'Blockchain belum tersedia.'
            );
        }

        $expectedPreviousHash = self::GENESIS_PREVIOUS_HASH;
        $expectedIndex = 0;
        $sealedData = null;
        $sealedBlockIndex = null;
        $sealedCount = 0;

        foreach ($blocks as $block) {
            $index = (int) $block['block_index'];

            // Pastikan urutan block berurutan.
            if ($index !== $expectedIndex) {
                return self::verificationFailure(
                    'Urutan block tidak valid.',
                    $expectedIndex,
                    $index
                );
            }

            // Pastikan previous hash mengarah ke block sebelumnya.
            if (!hash_equals(
                $expectedPreviousHash,
                (string) $block['previous_hash']
            )) {
                return self::verificationFailure(
                    'Previous hash tidak cocok.',
                    $expectedIndex + 1,
                    $index
                );
            }

            // Hitung ulang current hash.
            try {
                $calculatedHash = self::calculateBlockHash(
                    $electionId,
                    $index,
                    (string) $block['data'],
                    (string) $block['previous_hash'],
                    (string) $block['timestamp']
                );
            } catch (Throwable $e) {
                return self::verificationFailure(
                    'Data block tidak dapat dihitung hash-nya.',
                    $expectedIndex + 1,
                    $index
                );
            }

            if (!hash_equals(
                (string) $block['current_hash'],
                $calculatedHash
            )) {
                return self::verificationFailure(
                    'Current hash tidak cocok.',
                    $expectedIndex + 1,
                    $index
                );
            }

            // Genesis block wajib berada pada index 0.
            if ($index === 0) {
                $genesis = json_decode(
                    (string) $block['data'],
                    true
                );

                if (
                    !is_array($genesis) ||
                    ($genesis['type'] ?? '') !== 'genesis' ||
                    (int) ($genesis['election_id'] ?? 0) !== $electionId
                ) {
                    return self::verificationFailure(
                        'Genesis block tidak valid.',
                        $expectedIndex + 1,
                        0
                    );
                }
            }

            // Identifikasi election_sealed block.
            $decoded = json_decode((string) $block['data'], true);

            if (
                is_array($decoded) &&
                ($decoded['type'] ?? '') === 'election_sealed'
            ) {
                $sealedCount++;

                if ($sealedCount > 1) {
                    return self::verificationFailure(
                        'Ditemukan lebih dari satu election_sealed block.',
                        $expectedIndex + 1,
                        $index
                    );
                }

                $sealedData = $decoded;
                $sealedBlockIndex = $index;
            }

            $expectedPreviousHash = $calculatedHash;
            $expectedIndex++;
        }

        // Election yang sudah ditutup wajib memiliki sealed block.
        if ($requireSealed && $sealedData === null) {
            return self::verificationFailure(
                'Election belum memiliki election_sealed block.',
                count($blocks)
            );
        }

        if ($sealedData !== null) {
            // Sealed block harus menjadi block terakhir.
            $lastBlock = $blocks[count($blocks) - 1];
            $lastIndex = (int) $lastBlock['block_index'];

            if ($sealedBlockIndex !== $lastIndex) {
                return self::verificationFailure(
                    'Election sealed block bukan block terakhir.',
                    count($blocks),
                    $sealedBlockIndex
                );
            }

            // Validasi struktur data sealed block.
            if (
                (int) ($sealedData['election_id'] ?? 0) !== $electionId ||
                !isset($sealedData['ballot_count']) ||
                !is_int($sealedData['ballot_count']) ||
                $sealedData['ballot_count'] < 0 ||
                !isset($sealedData['merkle_root']) ||
                !is_string($sealedData['merkle_root']) ||
                !preg_match('/^[a-f0-9]{64}$/', $sealedData['merkle_root'])
            ) {
                return self::verificationFailure(
                    'Struktur election_sealed block tidak valid.',
                    count($blocks),
                    $sealedBlockIndex
                );
            }

            // Ambil ballot yang tersimpan untuk memverifikasi Merkle Root.
            $stmt = $db->prepare(
                "SELECT encrypted_vote, nonce, auth_tag
                 FROM ballots
                 WHERE election_id = :election_id
                 ORDER BY id ASC"
            );

            $stmt->execute([':election_id' => $electionId]);
            $ballots = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $leaves = [];

            foreach ($ballots as $ballot) {
                $leaves[] = hash(
                    'sha256',
                    "TrueCount-Ballot-v1|" .
                    $ballot['encrypted_vote'] . "|" .
                    $ballot['nonce'] . "|" .
                    $ballot['auth_tag']
                );
            }

            $currentRoot = self::calculateMerkleRoot($leaves);

            if (
                !hash_equals(
                    $sealedData['merkle_root'],
                    $currentRoot
                ) ||
                $sealedData['ballot_count'] !== count($ballots)
            ) {
                return self::verificationFailure(
                    'Merkle root tidak cocok dengan ballot saat ini.',
                    count($blocks)
                );
            }
        }

        return [
            'valid' => true,
            'message' => 'Blockchain valid.',
            'blocks_checked' => count($blocks),
            'last_hash' => $expectedPreviousHash
        ];
    }

    /**
     * Menutup kumpulan ballot ke dalam blockchain.
     * Hanya dapat dilakukan setelah election berstatus closed.
     */
    public static function sealElection(int $electionId): array
    {
        if ($electionId <= 0) {
            throw new InvalidArgumentException(
                'Election ID tidak valid.'
            );
        }

        $db = getDB();

        try {
            $db->beginTransaction();

            // Kunci election agar tidak ada proses sealing bersamaan.
            $stmt = $db->prepare(
                "SELECT id, status
                 FROM elections
                 WHERE id = :id
                 FOR UPDATE"
            );

            $stmt->execute([':id' => $electionId]);
            $election = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$election) {
                throw new RuntimeException(
                    'Election tidak ditemukan.'
                );
            }

            if ($election['status'] !== 'closed') {
                throw new RuntimeException(
                    'Election harus ditutup sebelum sealing.'
                );
            }

            // Ambil seluruh block yang sudah ada.
            $stmt = $db->prepare(
                "SELECT block_index, data, previous_hash,
                        current_hash, timestamp
                 FROM blocks
                 WHERE election_id = :election_id
                 ORDER BY block_index ASC"
            );

            $stmt->execute([':election_id' => $electionId]);
            $existingBlocks = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Jika chain sudah ada, verifikasi sebelum melanjutkan.
            // Pada tahap ini chain boleh belum memiliki sealed block.
            if (count($existingBlocks) > 0) {
                $verification = self::verifyChainInternal(
                    $db,
                    $electionId,
                    false
                );

                if (!$verification['valid']) {
                    throw new RuntimeException(
                        'Blockchain tidak valid. Sealing dibatalkan: ' .
                        $verification['message']
                    );
                }

                // Tolak jika election sudah pernah diseal.
                foreach ($existingBlocks as $block) {
                    $decoded = json_decode($block['data'], true);

                    if (
                        is_array($decoded) &&
                        ($decoded['type'] ?? '') === 'election_sealed'
                    ) {
                        throw new RuntimeException(
                            'Election sudah pernah di-seal.'
                        );
                    }
                }
            }

            // Ambil dan verifikasi seluruh ballot.
            $stmt = $db->prepare(
                "SELECT encrypted_vote, nonce, auth_tag, integrity_hash
                 FROM ballots
                 WHERE election_id = :election_id
                 ORDER BY id ASC"
            );

            $stmt->execute([':election_id' => $electionId]);
            $ballots = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $leaves = [];

            foreach ($ballots as $ballot) {
                $expectedHash = hash(
                    'sha256',
                    $ballot['encrypted_vote'] .
                    $ballot['nonce'] .
                    $ballot['auth_tag']
                );

                if (!hash_equals(
                    (string) $ballot['integrity_hash'],
                    $expectedHash
                )) {
                    throw new RuntimeException(
                        'Ballot gagal verifikasi integritas.'
                    );
                }

                // Commitment berasal dari data terenkripsi.
                $leaves[] = hash(
                    'sha256',
                    "TrueCount-Ballot-v1|" .
                    $ballot['encrypted_vote'] . "|" .
                    $ballot['nonce'] . "|" .
                    $ballot['auth_tag']
                );
            }

            $merkleRoot = self::calculateMerkleRoot($leaves);

            $previousHash = self::GENESIS_PREVIOUS_HASH;
            $nextIndex = 0;

            // Buat Genesis Block jika blockchain belum tersedia.
            if (count($existingBlocks) === 0) {
                $genesisData = json_encode([
                    'type' => 'genesis',
                    'election_id' => $electionId
                ], JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);

                $timestamp = gmdate('Y-m-d H:i:s');

                $genesisHash = self::calculateBlockHash(
                    $electionId,
                    0,
                    $genesisData,
                    $previousHash,
                    $timestamp
                );

                $stmt = $db->prepare(
                    "INSERT INTO blocks
                     (election_id, block_index, data,
                      previous_hash, current_hash, timestamp)
                     VALUES
                     (:election_id, 0, :data,
                      :previous_hash, :current_hash, :timestamp)"
                );

                $stmt->execute([
                    ':election_id' => $electionId,
                    ':data' => $genesisData,
                    ':previous_hash' => $previousHash,
                    ':current_hash' => $genesisHash,
                    ':timestamp' => $timestamp
                ]);

                $previousHash = $genesisHash;
                $nextIndex = 1;
            } else {
                // Lanjutkan dari block terakhir yang telah diverifikasi.
                $lastBlock = end($existingBlocks);

                $previousHash = $lastBlock['current_hash'];
                $nextIndex = (int) $lastBlock['block_index'] + 1;
            }

            // Buat election_sealed block.
            $blockData = json_encode([
                'type' => 'election_sealed',
                'election_id' => $electionId,
                'ballot_count' => count($ballots),
                'merkle_root' => $merkleRoot
            ], JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);

            $timestamp = gmdate('Y-m-d H:i:s');

            $currentHash = self::calculateBlockHash(
                $electionId,
                $nextIndex,
                $blockData,
                $previousHash,
                $timestamp
            );

            $stmt = $db->prepare(
                "INSERT INTO blocks
                 (election_id, block_index, data,
                  previous_hash, current_hash, timestamp)
                 VALUES
                 (:election_id, :block_index, :data,
                  :previous_hash, :current_hash, :timestamp)"
            );

            $stmt->execute([
                ':election_id' => $electionId,
                ':block_index' => $nextIndex,
                ':data' => $blockData,
                ':previous_hash' => $previousHash,
                ':current_hash' => $currentHash,
                ':timestamp' => $timestamp
            ]);

            $db->commit();

            return [
                'election_id' => $electionId,
                'ballot_count' => count($ballots),
                'merkle_root' => $merkleRoot,
                'block_index' => $nextIndex,
                'block_hash' => $currentHash
            ];

        } catch (Throwable $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }

            throw $e;
        }
    }

    /**
     * Verifikasi seluruh hash chain suatu election.
     */
    public static function verifyChain(int $electionId): array
    {
        if ($electionId <= 0) {
            throw new InvalidArgumentException(
                'Election ID tidak valid.'
            );
        }

        $db = getDB();

        // Periksa status election.
        $stmt = $db->prepare(
            "SELECT id, status
             FROM elections
             WHERE id = :id"
        );

        $stmt->execute([':id' => $electionId]);
        $election = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$election) {
            return self::verificationFailure(
                'Election tidak ditemukan.'
            );
        }

        // Election closed wajib memiliki sealed block.
        $requireSealed = ($election['status'] === 'closed');

        return self::verifyChainInternal(
            $db,
            $electionId,
            $requireSealed
        );
    }
}