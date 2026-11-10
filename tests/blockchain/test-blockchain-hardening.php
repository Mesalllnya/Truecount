<?php

require_once __DIR__ . '/../../backend/config/database.php';
require_once __DIR__ . '/../../backend/services/crypto/BlockchainService.php';

$db = getDB();
$electionId = 1;

echo "=== BLOCKCHAIN HARDENING TEST ===\n\n";

try {
    // Cari election_sealed block.
    $stmt = $db->prepare(
        "SELECT id, block_index, data
         FROM blocks
         WHERE election_id = :id
         ORDER BY block_index ASC"
    );

    $stmt->execute([':id' => $electionId]);
    $blocks = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $sealedBlock = null;

    foreach ($blocks as $block) {
        $decoded = json_decode($block['data'], true);

        if (
            is_array($decoded) &&
            ($decoded['type'] ?? '') === 'election_sealed'
        ) {
            $sealedBlock = $block;
            break;
        }
    }

    if (!$sealedBlock) {
        throw new RuntimeException(
            'Election sealed block tidak ditemukan.'
        );
    }

    // TEST 1: Sealed block dihapus.
    echo "--- TEST 1: MISSING SEALED BLOCK ---\n";

    $db->beginTransaction();

    $stmt = $db->prepare(
        "DELETE FROM blocks WHERE id = :id"
    );

    $stmt->execute([':id' => $sealedBlock['id']]);

    $result = BlockchainService::verifyChain($electionId);

    if (!$result['valid']) {
        echo "[PASS] Sealed block yang hilang terdeteksi.\n";
        echo "Pesan: {$result['message']}\n";
    } else {
        echo "[FAIL] Sealed block yang hilang tidak terdeteksi.\n";
    }

    $db->rollBack();
    echo "Database dipulihkan.\n\n";


    // TEST 2: Sealed block dimodifikasi.
    echo "--- TEST 2: SEALED BLOCK TAMPERING ---\n";

    $db->beginTransaction();

    $stmt = $db->prepare(
        "UPDATE blocks
         SET data = CONCAT(data, ' TAMPERED')
         WHERE id = :id"
    );

    $stmt->execute([':id' => $sealedBlock['id']]);

    $result = BlockchainService::verifyChain($electionId);

    if (!$result['valid']) {
        echo "[PASS] Modifikasi sealed block terdeteksi.\n";
        echo "Pesan: {$result['message']}\n";
    } else {
        echo "[FAIL] Modifikasi sealed block tidak terdeteksi.\n";
    }

    $db->rollBack();
    echo "Database dipulihkan.\n\n";

} catch (Throwable $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }

    echo "[ERROR] " . $e->getMessage() . "\n";
}

echo "=== TEST SELESAI ===\n";
