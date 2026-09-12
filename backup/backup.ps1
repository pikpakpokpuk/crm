# CRM Database Backup Script
# Saves daily pg_dump to D:\Munka\crm\backup\dumps\
# Keeps last 30 backups. Schedule with Windows Task Scheduler.

$ErrorActionPreference = 'Stop'

$pg_dump    = "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe"
$db         = "crm_db"
$host_      = "localhost"
$port       = "5432"
$user       = "postgres"
$dumpDir    = "$PSScriptRoot\dumps"
$keepDays   = 30

# Set password for pg_dump (avoids interactive prompt)
$env:PGPASSWORD = "0000"

# Create dump directory if missing
if (-not (Test-Path $dumpDir)) { New-Item -ItemType Directory -Path $dumpDir | Out-Null }

$timestamp  = Get-Date -Format "yyyy-MM-dd_HH-mm"
$outFile    = "$dumpDir\crm_db_$timestamp.sql"

Write-Host "Backing up $db to $outFile ..."

& $pg_dump -h $host_ -p $port -U $user -F p -f $outFile $db

if ($LASTEXITCODE -ne 0) {
    Write-Error "pg_dump failed with exit code $LASTEXITCODE"
    exit 1
}

Write-Host "Backup complete: $outFile ($([math]::Round((Get-Item $outFile).Length / 1MB, 2)) MB)"

# Prune old backups
$cutoff = (Get-Date).AddDays(-$keepDays)
Get-ChildItem $dumpDir -Filter "crm_db_*.sql" |
    Where-Object { $_.LastWriteTime -lt $cutoff } |
    ForEach-Object { Remove-Item $_.FullName; Write-Host "Removed old backup: $($_.Name)" }
