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
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

        return hash('sha256', $payload);
    }

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

                $nextLevel[] = hash(
                    'sha256',
                    $left . $right
                );
            }

            $leaves = $nextLevel;
        }

        return $leaves[0];
    }

    /**
     * Tutup kumpulan ballot ke dalam blockchain.
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

            // Kunci election untuk mencegah proses sealing bersamaan.
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

            // Ambil seluruh ballot.
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
                    $ballot['integrity_hash'],
                    $expectedHash
                )) {
                    throw new RuntimeException(
                        'Ballot gagal verifikasi integritas.'
                    );
                }

                // Commitment hanya berasal dari data terenkripsi.
                $leaves[] = hash(
                    'sha256',
                    "TrueCount-Ballot-v1|" .
                    $ballot['encrypted_vote'] . "|" .
                    $ballot['nonce'] . "|" .
                    $ballot['auth_tag']
                );
            }

            $merkleRoot = self::calculateMerkleRoot($leaves);

            // Periksa apakah election sudah pernah diseal.
            $stmt = $db->prepare(
                "SELECT data
                FROM blocks
                WHERE election_id = :election_id
                ORDER BY block_index ASC"
            );

            $stmt->execute([':election_id' => $electionId]);
            $existingBlocks = $stmt->fetchAll(PDO::FETCH_COLUMN);

            foreach ($existingBlocks as $existingData) {
                $decoded = json_decode($existingData, true);

                if (
                    is_array($decoded) &&
                    ($decoded['type'] ?? '') === 'election_sealed'
                ) {
                    throw new RuntimeException(
                        'Election sudah pernah di-seal.'
                    );
                }
            }

            $previousHash = self::GENESIS_PREVIOUS_HASH;
            $nextIndex = 0;

            // Buat genesis block jika belum ada.
            if (count($existingBlocks) === 0) {
                $genesisData = json_encode([
                    'type' => 'genesis',
                    'election_id' => $electionId
                ], JSON_UNESCAPED_SLASHES);

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
                // Gunakan hash block terakhir sebagai previous_hash.
                $stmt = $db->prepare(
                    "SELECT block_index, current_hash
                    FROM blocks
                    WHERE election_id = :election_id
                    ORDER BY block_index DESC
                    LIMIT 1"
                );

                $stmt->execute([':election_id' => $electionId]);
                $lastBlock = $stmt->fetch(PDO::FETCH_ASSOC);

                $previousHash = $lastBlock['current_hash'];
                $nextIndex = (int) $lastBlock['block_index'] + 1;
            }

            $blockData = json_encode([
                'type' => 'election_sealed',
                'election_id' => $electionId,
                'ballot_count' => count($ballots),
                'merkle_root' => $merkleRoot
            ], JSON_UNESCAPED_SLASHES);

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
            return [
                'valid' => false,
                'message' => 'Blockchain belum tersedia.',
                'blocks_checked' => 0
            ];
        }

        $expectedPreviousHash = self::GENESIS_PREVIOUS_HASH;
        $expectedIndex = 0;

        foreach ($blocks as $block) {
            $index = (int) $block['block_index'];

            if ($index !== $expectedIndex) {
                return [
                    'valid' => false,
                    'message' => 'Urutan block tidak valid.',
                    'failed_block' => $index
                ];
            }

            if (!hash_equals(
                $expectedPreviousHash,
                $block['previous_hash']
            )) {
                return [
                    'valid' => false,
                    'message' => 'Previous hash tidak cocok.',
                    'failed_block' => $index
                ];
            }

            $calculatedHash = self::calculateBlockHash(
                $electionId,
                $index,
                $block['data'],
                $block['previous_hash'],
                $block['timestamp']
            );

            if (!hash_equals(
                $block['current_hash'],
                $calculatedHash
            )) {
                return [
                    'valid' => false,
                    'message' => 'Current hash tidak cocok.',
                    'failed_block' => $index
                ];
            }

            if ($index === 0) {
                $genesis = json_decode($block['data'], true);

                if (
                    !is_array($genesis) ||
                    ($genesis['type'] ?? '') !== 'genesis' ||
                    (int) ($genesis['election_id'] ?? 0) !== $electionId
                ) {
                    return [
                        'valid' => false,
                        'message' => 'Genesis block tidak valid.',
                        'failed_block' => 0
                    ];
                }
            }

            $expectedPreviousHash = $calculatedHash;
            $expectedIndex++;
        }

        
        // Verifikasi commitment terhadap ballot yang masih tersimpan.
        $sealedData = null;

        foreach ($blocks as $block) {
            $decoded = json_decode($block['data'], true);

            if (
                is_array($decoded) &&
                ($decoded['type'] ?? '') === 'election_sealed'
            ) {
                $sealedData = $decoded;
                break;
            }
        }

        if ($sealedData !== null) {
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
                (int) $sealedData['ballot_count'] !== count($ballots)
            ) {
                return [
                    'valid' => false,
                    'message' => 'Merkle root tidak cocok dengan ballot saat ini.',
                    'blocks_checked' => count($blocks)
                ];
            }
        }


        return [
            'valid' => true,
            'message' => 'Blockchain valid.',
            'blocks_checked' => count($blocks),
            'last_hash' => $expectedPreviousHash
        ];
    }
}
