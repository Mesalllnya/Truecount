
$php = "D:\xampp\php\php.exe"

$tests = @(
    "tests/crypto/test-aes.php",
    "tests/crypto/test-aes-aad.php",
    "tests/crypto/test-chacha20.php",
    "tests/crypto/test-encrypted-message.php",
    "tests/crypto/test-encrypted-message-chacha.php",
    "tests/crypto/test-tampering-db.php",
    "tests/crypto/test-vigenere.php",
    "tests/crypto/test-file-encryption.php",
    "tests/crypto/test-file-tampering.php",
    "tests/crypto/test-steganography.php",
    "tests/crypto/test-steganography-tampering.php",
    "tests/crypto/test-steganography-capacity.php",
    "tests/crypto/test-steganography-persistence.php",
    "tests/crypto/test-steganography-psnr.php",
    "tests/crypto/test-encrypted-message-aad.php",
    "tests/crypto/test-file-encryption-metadata.php",
    "tests/blockchain/test-ballot-integrity.php",
    "tests/blockchain/test-blockchain-tampering.php",
    "tests/blockchain/test-blockchain-hardening.php",
    "tests/blockchain/test-seal-invalid-chain.php"
)

foreach ($test in $tests) {
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "RUNNING: $test" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Cyan

    & $php $test

    if ($LASTEXITCODE -ne 0) {
        Write-Host "FAILED: $test" -ForegroundColor Red
        exit 1
    }
}

Write-Host "`nALL TESTS COMPLETED SUCCESSFULLY!" -ForegroundColor Green
