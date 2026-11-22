#Requires -Version 5.1
<#
.SYNOPSIS
    Menyiapkan dan menjalankan server demo TrueCount di Windows.

.DESCRIPTION
    Script ini melakukan preflight, menyiapkan .env, menjalankan migrasi,
    membuka firewall (opsional), lalu menyalakan PHP API agar bisa diakses
    client desktop di jaringan lokal.

    Tanpa parameter, script hanya memeriksa prasyarat dan menyalakan server
    memakai konfigurasi .env yang sudah ada.

.PARAMETER Port
    Port API. Default 8000.

.PARAMETER BindAddress
    Alamat bind PHP. Default 0.0.0.0 agar bisa diakses dari LAN.
    Gunakan 127.0.0.1 kalau hanya ingin diakses dari laptop sendiri.

.PARAMETER Migrate
    Jalankan php database/migrate.php sebelum server dinyalakan.

.PARAMETER SeedAdmin
    Jalankan scripts/seed_admin.php (hanya akun admin, bukan seed dummy).

.PARAMETER BuildFrontend
    Jalankan npm run build di folder frontend.

.PARAMETER OpenFirewall
    Buat rule inbound TCP untuk port ini, profil Private. Butuh Administrator.

.PARAMETER SkipChecks
    Lewati pemeriksaan ekstensi PHP dan status MySQL. Tidak disarankan.

.PARAMETER Force
    Izinkan menghentikan proses yang memakai port.

.PARAMETER RecreateEnv
    Buat ulang .env dari .env.example. Butuh konfirmasi ketik OVERWRITE karena
    kunci enkripsi baru membuat data lama tidak bisa dibuka.

.PARAMETER CheckOnly
    Jalankan preflight dan siapkan .env, tetapi jangan menyalakan server.

.PARAMETER Stop
    Hentikan proses yang sedang listen di port ini.

.EXAMPLE
    .\scripts\deploy-server.ps1

.EXAMPLE
    .\scripts\deploy-server.ps1 -Migrate -SeedAdmin -OpenFirewall

.EXAMPLE
    .\scripts\deploy-server.ps1 -CheckOnly

.EXAMPLE
    .\scripts\deploy-server.ps1 -Stop
#>
[CmdletBinding()]
param(
    [ValidateRange(1, 65535)]
    [int]$Port = 8000,

    [ValidatePattern('^(\d{1,3}\.){3}\d{1,3}$')]
    [string]$BindAddress = '0.0.0.0',

    [switch]$Migrate,
    [switch]$SeedAdmin,
    [switch]$BuildFrontend,
    [switch]$OpenFirewall,
    [switch]$SkipChecks,
    [switch]$Force,
    [switch]$RecreateEnv,
    [switch]$CheckOnly,
    [switch]$Stop
)

$ErrorActionPreference = 'Stop'

$script:Root       = Split-Path -Parent $PSScriptRoot
$script:EnvPath    = Join-Path $script:Root '.env'
$script:EnvExample = Join-Path $script:Root '.env.example'

# ---------------------------------------------------------------------------
# Output helpers
# ---------------------------------------------------------------------------

function Write-Step([string]$Message) {
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Ok([string]$Message) {
    Write-Host "    [OK] $Message" -ForegroundColor Green
}

function Write-Warn([string]$Message) {
    Write-Host "    [!] $Message" -ForegroundColor Yellow
}

function Write-Fail([string]$Message) {
    Write-Host ""
    Write-Host "    [X] $Message" -ForegroundColor Red
}

function Test-Exe([string]$Name) {
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

# ---------------------------------------------------------------------------
# PHP helpers
# ---------------------------------------------------------------------------

function Invoke-Php {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    # Selalu jalankan dari root repo supaya path relatif (scripts/, database/) tetap valid
    # walaupun script dipanggil dari folder lain.
    Push-Location $script:Root
    try {
        $output = & php @Arguments 2>&1
        $code   = $LASTEXITCODE
    }
    finally {
        Pop-Location
    }

    return [pscustomobject]@{
        Code   = $code
        Output = (($output | ForEach-Object { "$_" }) -join "`n")
    }
}

function New-PhpSecret([string]$Expression) {
    $result = Invoke-Php -Arguments @('-r', $Expression)
    if ($result.Code -ne 0 -or [string]::IsNullOrWhiteSpace($result.Output)) {
        throw 'Gagal membuat nilai acak memakai PHP.'
    }
    return $result.Output.Trim()
}

# ---------------------------------------------------------------------------
# .env helpers
# ---------------------------------------------------------------------------

function Read-EnvMap([string]$Path) {
    $map = @{}

    foreach ($line in Get-Content -LiteralPath $Path) {
        $trimmed = $line.Trim()
        if ($trimmed -eq '' -or $trimmed.StartsWith('#')) { continue }

        $separator = $trimmed.IndexOf('=')
        if ($separator -lt 1) { continue }

        $key   = $trimmed.Substring(0, $separator).Trim()
        $value = $trimmed.Substring($separator + 1).Trim().Trim('"').Trim("'")
        $map[$key] = $value
    }

    return $map
}

function Backup-Env([string]$Path) {
    $stamp  = Get-Date -Format 'yyyyMMdd-HHmmss'
    $backup = "$Path.bak.$stamp"
    Copy-Item -LiteralPath $Path -Destination $backup -Force
    Write-Warn "Backup .env dibuat: $backup"
}

function Set-EnvValue {
    param(
        [string]$Path,
        [string]$Key,
        [string]$Value
    )

    $lines = @(Get-Content -LiteralPath $Path)
    $found = $false

    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match "^\s*$([regex]::Escape($Key))\s*=") {
            $lines[$i] = "$Key=$Value"
            $found = $true
        }
    }

    if (-not $found) { $lines += "$Key=$Value" }

    [System.IO.File]::WriteAllLines($Path, [string[]]$lines, (New-Object System.Text.UTF8Encoding($false)))
}

function Set-OrAddEnvValue {
    param(
        [string]$Path,
        [string]$Key,
        [string]$Value
    )

    $lines = @(Get-Content -LiteralPath $Path)
    $found = $false
    $changed = $false

    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match "^\s*$([regex]::Escape($Key))\s*=") {
            $found = $true
            if ($lines[$i] -ne "$Key=$Value") {
                $lines[$i] = "$Key=$Value"
                $changed = $true
            }
        }
    }

    if (-not $found) {
        $lines += "$Key=$Value"
        $changed = $true
    }

    if ($changed) {
        [System.IO.File]::WriteAllLines($Path, [string[]]$lines, (New-Object System.Text.UTF8Encoding($false)))
    }

    return $changed
}

function New-EnvFile {
    if (-not (Test-Path -LiteralPath $script:EnvExample)) {
        throw ".env.example tidak ditemukan di $($script:Root)."
    }

    $values = [ordered]@{
        'DB_HOST'            = '127.0.0.1'
        'TC_STORAGE_ROOT'    = 'backend/storage'
        'JWT_SECRET'         = (New-PhpSecret 'echo bin2hex(random_bytes(32));')
        'ENCRYPTION_KEY_B64' = (New-PhpSecret 'echo base64_encode(random_bytes(32));')
        'CHACHA20_KEY_B64'   = (New-PhpSecret 'echo base64_encode(random_bytes(32));')
        'SERVER_ID'          = (New-PhpSecret 'echo bin2hex(random_bytes(8));')
        'SERVER_LABEL'       = 'Laptop Demo'
        'SETUP_PATH'         = '/__tc-setup'
        'SETUP_TOKEN'        = (New-PhpSecret 'echo bin2hex(random_bytes(16));')
        'SETUP_ALLOW_REMOTE' = 'false'
        'WEBAUTHN_RP_ID'     = 'localhost'
        'WEBAUTHN_ORIGIN'    = "http://localhost:$Port"
    }

    $lines  = New-Object System.Collections.Generic.List[string]
    $filled = @{}

    foreach ($line in Get-Content -LiteralPath $script:EnvExample) {
        if ($line -match '^\s*([A-Za-z0-9_]+)\s*=' -and $values.Contains($Matches[1])) {
            $key = $Matches[1]
            $lines.Add("$key=$($values[$key])")
            $filled[$key] = $true
        }
        else {
            $lines.Add($line)
        }
    }

    $missing = @($values.Keys | Where-Object { -not $filled.ContainsKey($_) })

    if ($missing.Count -gt 0) {
        $lines.Add('')
        $lines.Add('# --- Ditambahkan oleh scripts/deploy-server.ps1 ---')
        foreach ($key in $missing) {
            $lines.Add("$key=$($values[$key])")
        }
    }

    [System.IO.File]::WriteAllLines($script:EnvPath, $lines.ToArray(), (New-Object System.Text.UTF8Encoding($false)))
}

function Initialize-Env {
    Write-Step 'Menyiapkan .env'

    if (Test-Path -LiteralPath $script:EnvPath) {
        if ($RecreateEnv) {
            Write-Warn 'PERINGATAN: .env akan dibuat ulang.'
            Write-Warn 'Kunci enkripsi baru membuat data lama tidak bisa dibuka.'
            $answer = Read-Host 'Ketik OVERWRITE untuk melanjutkan'
            if ($answer -ne 'OVERWRITE') {
                throw 'Pembuatan ulang .env dibatalkan.'
            }
            Backup-Env $script:EnvPath
            New-EnvFile
            Write-Ok '.env dibuat ulang.'
            return
        }

        $map = Read-EnvMap $script:EnvPath

        $desired = [ordered]@{
            'SERVER_ID'          = (New-PhpSecret 'echo bin2hex(random_bytes(8));')
            'SERVER_LABEL'       = 'Laptop Demo'
            'SETUP_PATH'         = '/__tc-setup'
            'SETUP_TOKEN'        = (New-PhpSecret 'echo bin2hex(random_bytes(16));')
            'SETUP_ALLOW_REMOTE' = 'false'
            'WEBAUTHN_RP_ID'     = 'localhost'
            'WEBAUTHN_ORIGIN'    = "http://localhost:$Port"
        }

        $pending = @()

        foreach ($key in $desired.Keys) {
            $current = $map[$key]
            if ((-not $map.ContainsKey($key)) -or [string]::IsNullOrWhiteSpace($current)) {
                $pending += $key
            }
        }

        if ($pending.Count -gt 0) {
            Backup-Env $script:EnvPath

            foreach ($key in $pending) {
                Set-OrAddEnvValue -Path $script:EnvPath -Key $key -Value $desired[$key] | Out-Null
            }

            Write-Ok "Key baru dilengkapi: $($pending -join ', ')"
        }
        else {
            Write-Ok '.env sudah lengkap.'
        }

        $map = Read-EnvMap $script:EnvPath

        # MySQL di Windows: "localhost" di-resolve ke IPv6 (::1) lebih dulu,
        # gagal setelah ±2 detik baru fallback ke IPv4. Ganti ke 127.0.0.1.
        if ($map.ContainsKey('DB_HOST') -and $map['DB_HOST'] -eq 'localhost') {
            Backup-Env $script:EnvPath
            Set-EnvValue $script:EnvPath 'DB_HOST' '127.0.0.1'
            $map = Read-EnvMap $script:EnvPath
            Write-Warn 'DB_HOST diubah localhost -> 127.0.0.1 (mencegah delay ±2 detik per koneksi MySQL).'
        }

        # TC_STORAGE_ROOT: pakai folder storage yang sama baik oleh app desktop
        # maupun deploy-server.ps1, agar foto/log tidak terpecah dua lokasi.
        if (-not $map.ContainsKey('TC_STORAGE_ROOT') -or [string]::IsNullOrWhiteSpace($map['TC_STORAGE_ROOT'])) {
            Backup-Env $script:EnvPath
            Set-EnvValue $script:EnvPath 'TC_STORAGE_ROOT' 'backend/storage'
            $map = Read-EnvMap $script:EnvPath
            Write-Warn 'TC_STORAGE_ROOT ditambahkan = backend/storage (storage seragam untuk semua server).'
        }

        foreach ($key in @('DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER')) {
            if (-not $map.ContainsKey($key) -or [string]::IsNullOrWhiteSpace($map[$key])) {
                throw ".env tidak lengkap: $key kosong."
            }
        }

        foreach ($key in @('JWT_SECRET', 'ENCRYPTION_KEY_B64', 'CHACHA20_KEY_B64')) {
            $value = $map[$key]
            if ([string]::IsNullOrWhiteSpace($value) -or $value -match '^(GANTI|GENERATE|CHANGE)') {
                if ($key -eq 'JWT_SECRET') {
                    Write-Warn "$key masih placeholder. Nilai baru dibuat (semua sesi lama logout)."
                    Backup-Env $script:EnvPath
                    Set-EnvValue $script:EnvPath $key (New-PhpSecret 'echo bin2hex(random_bytes(32));')
                }
                else {
                    throw "$key masih placeholder. Isi manual, atau jalankan dengan -RecreateEnv lalu ketik OVERWRITE (hanya aman untuk database baru)."
                }
            }
        }

        return
    }

    New-EnvFile
    Write-Ok '.env dibuat dari .env.example.'
    Write-Warn 'Nilai rahasia dibuat otomatis. Token setup ada di .env (SETUP_TOKEN).'
}

# ---------------------------------------------------------------------------
# Preflight
# ---------------------------------------------------------------------------

function Test-Preflight {
    Write-Step 'Preflight'

    if (-not (Test-Exe 'php')) {
        throw 'php tidak ditemukan di PATH. Install PHP 8.1+ dan tambahkan ke PATH.'
    }

    $version = Invoke-Php -Arguments @('-r', 'echo PHP_VERSION;')
    if ($version.Code -ne 0) {
        throw 'php ditemukan, tetapi gagal dijalankan.'
    }

    $phpVersion = $version.Output.Trim()
    if ([version]$phpVersion -lt [version]'8.1.0') {
        throw "PHP $phpVersion terlalu lama. Butuh minimal 8.1."
    }
    Write-Ok "PHP $phpVersion"

    if ($SkipChecks) {
        Write-Warn 'Pemeriksaan ekstensi dan MySQL dilewati (-SkipChecks).'
        return
    }

    $modules = (Invoke-Php -Arguments @('-m')).Output -split "`r?`n" |
        ForEach-Object { $_.Trim().ToLowerInvariant() } |
        Where-Object { $_ -ne '' }

    $required = @('pdo_mysql', 'mbstring', 'openssl', 'gd', 'fileinfo')
    $missing  = $required | Where-Object { $modules -notcontains $_ }

    if ($missing.Count -gt 0) {
        throw "Ekstensi PHP belum aktif: $($missing -join ', '). Aktifkan di php.ini lalu jalankan ulang."
    }
    Write-Ok 'Ekstensi PHP lengkap.'

    $service = Get-Service -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match 'mysql|mariadb' -and $_.Status -eq 'Running' }

    $process = Get-Process -Name 'mysqld', 'mariadbd' -ErrorAction SilentlyContinue

    if ($service -or $process) {
        Write-Ok 'MySQL/MariaDB berjalan.'
        Test-MysqlExposure
        return
    }

    # Database bisa juga berjalan di luar Windows service, misalnya container
    # Docker. Cek koneksi TCP ke DB_HOST:DB_PORT dari .env.
    $dbHost = '127.0.0.1'
    $dbPort = 3306

    if (Test-Path -LiteralPath $script:EnvPath) {
        $envMap = Read-EnvMap $script:EnvPath

        if ($envMap.ContainsKey('DB_HOST') -and -not [string]::IsNullOrWhiteSpace($envMap['DB_HOST'])) {
            $dbHost = $envMap['DB_HOST']
        }
        if ($envMap.ContainsKey('DB_PORT') -and $envMap['DB_PORT'] -match '^\d+$') {
            $dbPort = [int]$envMap['DB_PORT']
        }
    }

    $tcpOk = $false
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $tcpOk  = $client.ConnectAsync($dbHost, $dbPort).Wait(2000)
        $client.Close()
    }
    catch {
        $tcpOk = $false
    }

    if (-not $tcpOk) {
        throw "MySQL/MariaDB tidak berjalan di ${dbHost}:${dbPort}. Nyalakan service MySQL/Laragon, atau jalankan database Docker (docker compose up -d db), lalu jalankan ulang."
    }

    Write-Ok "MySQL/MariaDB terdeteksi di ${dbHost}:${dbPort} (TCP)."
}

function Test-MysqlExposure {
    $publicListeners = Get-NetTCPConnection -LocalPort 3306 -State Listen -ErrorAction SilentlyContinue |
        Where-Object { $_.LocalAddress -notin @('127.0.0.1', '::1') }

    if (-not $publicListeners) { return }

    $addresses = ($publicListeners | Select-Object -ExpandProperty LocalAddress -Unique) -join ', '

    Write-Warn "MySQL listen di $addresses (port 3306) - bisa diakses dari LAN."
    Write-Warn 'Ini bukan dilakukan script. Perbaiki my.ini: bind-address = 127.0.0.1, lalu restart MySQL.'
}

function Test-Database {
    Write-Step 'Memeriksa koneksi database'

    $result = Invoke-Php -Arguments @('scripts/check_db.php')

    if ($result.Output -notmatch 'DB OK') {
        Write-Host $result.Output
        throw 'Database belum siap. Jalankan dengan -Migrate, atau periksa DB_* di .env.'
    }

    Write-Ok 'Database terhubung dan tabel utama tersedia.'
}

function Invoke-Migration {
    Write-Step 'Menjalankan migrasi database'

    $result = Invoke-Php -Arguments @('database/migrate.php')
    if ($result.Output) { Write-Host $result.Output }

    if ($result.Code -ne 0) {
        throw 'Migrasi gagal. Periksa pesan di atas.'
    }

    Write-Ok 'Migrasi selesai.'
}

function Invoke-SeedAdmin {
    Write-Step 'Seeding akun admin'

    $seed = Join-Path $script:Root 'scripts/seed_admin.php'
    if (-not (Test-Path -LiteralPath $seed)) {
        throw 'scripts/seed_admin.php tidak ditemukan.'
    }

    $result = Invoke-Php -Arguments @('scripts/seed_admin.php')
    if ($result.Output) { Write-Host $result.Output }

    if ($result.Code -ne 0) {
        throw 'Seed admin gagal. Periksa pesan di atas.'
    }

    Write-Ok 'Akun admin siap. Ganti password default setelah login.'
}

function Invoke-FrontendBuild {
    Write-Step 'Build frontend'

    if (-not (Test-Exe 'npm')) {
        throw 'npm tidak ditemukan di PATH.'
    }

    Push-Location (Join-Path $script:Root 'frontend')
    try {
        & npm run build
        if ($LASTEXITCODE -ne 0) {
            throw 'npm run build gagal.'
        }
    }
    finally {
        Pop-Location
    }

    Write-Ok 'Build frontend selesai.'
}

# ---------------------------------------------------------------------------
# Port & firewall
# ---------------------------------------------------------------------------

function Get-PortOwner([int]$LocalPort) {
    $connection = Get-NetTCPConnection -LocalPort $LocalPort -State Listen -ErrorAction SilentlyContinue |
        Select-Object -First 1

    if (-not $connection) { return $null }

    $process = Get-Process -Id $connection.OwningProcess -ErrorAction SilentlyContinue

    return [pscustomobject]@{
        Id   = $connection.OwningProcess
        Name = if ($process) { $process.ProcessName } else { 'unknown' }
    }
}

function Assert-PortFree([int]$LocalPort) {
    $owner = Get-PortOwner $LocalPort

    if (-not $owner) {
        Write-Ok "Port $LocalPort bebas."
        return
    }

    Write-Warn "Port $LocalPort dipakai PID $($owner.Id) ($($owner.Name))."

    if (-not $Force) {
        throw "Port $LocalPort masih dipakai. Hentikan prosesnya, jalankan scripts/free-ports.ps1, atau pakai -Force."
    }

    Write-Warn 'Karena -Force, proses tersebut dihentikan.'
    Stop-Process -Id $owner.Id -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 700

    if (Get-PortOwner $LocalPort) {
        throw "Port $LocalPort masih dipakai setelah proses dihentikan."
    }

    Write-Ok "Port $LocalPort bebas."
}

function Enable-FirewallRule {
    Write-Step 'Menyiapkan firewall'

    $principal = New-Object Security.Principal.WindowsPrincipal(
        [Security.Principal.WindowsIdentity]::GetCurrent()
    )

    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw '-OpenFirewall butuh PowerShell dengan hak Administrator.'
    }

    $networkCategories = Get-NetConnectionProfile -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty NetworkCategory -Unique

    if ($networkCategories -and $networkCategories -notcontains 'Private') {
        Write-Warn "Profil jaringan saat ini: $($networkCategories -join ', '). Rule hanya berlaku untuk profil Private."
    }

    $name = "TrueCount API $Port"

    if (Get-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue) {
        Write-Ok "Rule '$name' sudah ada."
        return
    }

    New-NetFirewallRule `
        -DisplayName $name `
        -Direction Inbound `
        -Protocol TCP `
        -LocalPort $Port `
        -Profile Private `
        -Action Allow | Out-Null

    Write-Ok "Rule '$name' dibuat untuk profil Private."
}

# ---------------------------------------------------------------------------
# Server lifecycle
# ---------------------------------------------------------------------------

function Get-LanIPv4 {
    try {
        $config = Get-NetIPConfiguration -ErrorAction Stop |
            Where-Object {
                $_.IPv4DefaultGateway -ne $null -and
                $_.NetAdapter.Status -eq 'Up'
            } |
            Select-Object -First 1

        if ($config -and $config.IPv4Address) {
            return @($config.IPv4Address)[0].IPAddress
        }
    }
    catch {
        # Get-NetIPConfiguration tidak tersedia di Windows lama.
    }

    try {
        $address = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
            Where-Object {
                $_.IPAddress -notlike '127.*' -and
                $_.IPAddress -notlike '169.254.*'
            } |
            Select-Object -First 1

        if ($address) { return $address.IPAddress }
    }
    catch {
        # Biarkan $null.
    }

    return $null
}

function Start-DemoServer {
    $lanIp = Get-LanIPv4

    Write-Host ""
    Write-Host "================= TrueCount Demo Server =================" -ForegroundColor Cyan
    Write-Host ("  Bind     : {0}:{1}" -f $BindAddress, $Port)
    Write-Host ("  Lokal    : http://localhost:{0}/" -f $Port)

    if ($BindAddress -eq '0.0.0.0') {
        if ($lanIp) {
            Write-Host ("  LAN      : http://{0}:{1}/" -f $lanIp, $Port)
        }
        else {
            Write-Warn 'IP LAN tidak terdeteksi. Cek koneksi jaringan.'
        }
    }

    Write-Host ("  Health   : http://localhost:{0}/health" -f $Port)

    $setupFile = Join-Path $script:Root 'backend/setup/index.php'
    if (Test-Path -LiteralPath $setupFile) {
        Write-Host ("  Setup    : http://localhost:{0}/__tc-setup?k=<SETUP_TOKEN>" -f $Port)
        Write-Host '             Token ada di .env (SETUP_TOKEN), tidak dicetak di sini.'
    }
    else {
        Write-Host '  Setup    : belum tersedia (backend/setup/index.php belum ada).'
    }

    Write-Host "=========================================================" -ForegroundColor Cyan
    Write-Host "  Tekan Ctrl+C untuk menghentikan server." -ForegroundColor DarkGray
    Write-Host ""

    $phpArgs = @(
        '-S', ("{0}:{1}" -f $BindAddress, $Port),
        '-t', 'backend',
        'backend/index.php'
    )

    $server = Start-Process `
        -FilePath 'php' `
        -ArgumentList $phpArgs `
        -WorkingDirectory $script:Root `
        -NoNewWindow `
        -PassThru

    try {
        $healthUrl = "http://127.0.0.1:$Port/health"
        $healthy   = $false

        for ($attempt = 1; $attempt -le 20; $attempt++) {
            Start-Sleep -Milliseconds 300

            if ($server.HasExited) { break }

            try {
                $health = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 5 -ErrorAction Stop
                $label  = if ($health.server_label) { $health.server_label } else { 'TrueCount' }
                Write-Ok ("Health: {0} | database: {1} | server: {2}" -f $health.status, $health.database, $label)
                $healthy = $true
                break
            }
            catch {
                # Server belum siap; coba lagi.
            }
        }

        if (-not $healthy) {
            Write-Warn 'Health check belum merespons. Buka /health manual atau periksa pesan PHP di atas.'
        }

        Wait-Process -Id $server.Id
    }
    finally {
        if ($server -and -not $server.HasExited) {
            Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
            Write-Host ""
            Write-Ok 'Server dihentikan.'
        }
    }
}

function Stop-DemoServer {
    $owner = Get-PortOwner $Port

    if (-not $owner) {
        Write-Ok "Tidak ada server yang listen di port $Port."
        return
    }

    Write-Step "Menghentikan PID $($owner.Id) ($($owner.Name)) di port $Port"
    Stop-Process -Id $owner.Id -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 700

    if (Get-PortOwner $Port) {
        throw "Gagal menghentikan proses di port $Port."
    }

    Write-Ok 'Server dihentikan.'
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

try {
    if ($Stop) {
        Stop-DemoServer
        exit 0
    }

    Test-Preflight
    Initialize-Env
    Assert-PortFree $Port

    if ($Migrate) { Invoke-Migration }
    if ($SeedAdmin) { Invoke-SeedAdmin }

    if (-not $Migrate -and -not $SeedAdmin) {
        Test-Database
    }

    if ($BuildFrontend) { Invoke-FrontendBuild }
    if ($OpenFirewall) { Enable-FirewallRule }

    if ($CheckOnly) {
        Write-Step 'Selesai'
        Write-Ok 'Preflight dan konfigurasi siap. Server tidak dijalankan (-CheckOnly).'
        exit 0
    }

    Start-DemoServer
}
catch {
    Write-Fail $_.Exception.Message
    exit 1
}
