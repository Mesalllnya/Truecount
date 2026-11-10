<?php

require_once __DIR__ . '/../../backend/config/database.php';
require_once __DIR__ . '/../../backend/services/crypto/BlockchainService.php';

$db = getDB();
$electionId = 1;

echo "=== SEAL INVALID BLOCKCHAIN TEST ===\n\n";

$originalData = null;
$genesisId = null;
$originalBlockIds = [];

try {
    // Ambil seluruh block awal sebagai referensi pemulihan.
    $stmt = $db->prepare(
        "SELECT id, block_index, data
         FROM blocks
         WHERE election_id = :id
         ORDER BY block_index ASC"
    );

    $stmt->execute([':id' => $electionId]);
    $blocks = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($blocks as $block) {
        $originalBlockIds[] = (int) $block['id'];

        if ((int) $block['block_index'] === 0) {
            $genesisId = (int) $block['id'];
            $originalData = $block['data'];
        }
    }

    if ($genesisId === null) {
        throw new RuntimeException('Genesis Block tidak ditemukan.');
    }

    echo "--- MODIFY GENESIS BLOCK ---\n";

    // Modifikasi Genesis Block sementara.
    $stmt = $db->prepare(
        "UPDATE blocks
         SET data = CONCAT(data, ' TAMPERED')
         WHERE id = :id"
    );

    $stmt->execute([':id' => $genesisId]);

    echo "Genesis Block berhasil dimodifikasi.\n\n";

    echo "--- TEST SEALING ---\n";

    try {
        // Harus ditolak karena chain sudah rusak.
        $result = BlockchainService::sealElection($electionId);

        echo "[FAIL] Sealing berhasil padahal blockchain rusak!\n";

    } catch (Throwable $e) {
        echo "[PASS] Sealing berhasil ditolak!\n";
        echo "Pesan: " . $e->getMessage() . "\n";
    }

} catch (Throwable $e) {
    echo "[ERROR] " . $e->getMessage() . "\n";

} finally {
    echo "\n--- RESTORE DATABASE ---\n";

    if ($genesisId !== null && $originalData !== null) {
        try {
            // Hapus block tambahan jika sealing ternyata berhasil.
            $ids = array_map('intval', $originalBlockIds);

            if (count($ids) > 0) {
                $placeholders = implode(',', array_fill(0, count($ids), '?'));

                $stmt = $db->prepare(
                    "DELETE FROM blocks
                     WHERE election_id = ?
                     AND id NOT IN ($placeholders)"
                );

                $stmt->execute(array_merge([$electionId], $ids));
            }

            // Pulihkan Genesis Block ke data asli.
            $stmt = $db->prepare(
                "UPDATE blocks
                 SET data = :data
                 WHERE id = :id"
            );

            $stmt->execute([
                ':data' => $originalData,
                ':id' => $genesisId
            ]);

            echo "Data Genesis Block dipulihkan.\n";

        } catch (Throwable $restoreError) {
            echo "[CRITICAL] Pemulihan gagal: "
                . $restoreError->getMessage() . "\n";
        }
    }
}

echo "\n=== TEST SELESAI ===\n";
