# free-ports.ps1 - Bebaskan port TrueCount (5173 Vite, 5183 HMR, 8000 PHP)
# Jalankan:  powershell -ExecutionPolicy Bypass -File scripts/free-ports.ps1
# Berguna saat "Port X is already in use" padahal tidak ada terminal yang aktif.

$ports = @(5173, 5183, 8000)

$pids = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $_.LocalPort -in $ports } |
    Select-Object -ExpandProperty OwningProcess -Unique

if (-not $pids) {
    Write-Host "Semua port ($($ports -join ', ')) bebas. Tidak ada yang perlu dimatikan." -ForegroundColor Green
    exit 0
}

foreach ($procId in $pids) {
    $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$procId" -ErrorAction SilentlyContinue
    if ($proc) {
        Write-Host "Menghentikan PID $procId ($($proc.Name))..." -ForegroundColor Yellow
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    }
}

Start-Sleep -Seconds 1
Write-Host "Selesai. Port $($ports -join ', ') bebas." -ForegroundColor Green
