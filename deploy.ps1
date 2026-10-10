param(
    [Parameter(Mandatory = $true)][string]$Server,          # mis. root@1.2.3.4
    [string]$RemoteDir = "/opt/tugasweb"
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

Write-Host "==> Menyiapkan folder di $Server:$RemoteDir"
ssh $Server "mkdir -p '$RemoteDir'"

Write-Host "==> Mengirim konfigurasi"
scp "$root\Dockerfile" "$root\nginx.conf" "$root\docker-compose.yml" "$root\.dockerignore" "${Server}:$RemoteDir/"

Write-Host "==> Mengirim file situs"
scp -r "$root\halaman-informasi-akademik" "${Server}:$RemoteDir/"

Write-Host "==> Build & jalankan container (port 4432)"
ssh $Server "cd '$RemoteDir' && docker compose up -d --build"

Write-Host ""
Write-Host "Selesai. Cek: http://<IP-server>:4432"
Write-Host "Aktifkan Cloudflare Tunnel: ssh $Server `"cd $RemoteDir && echo TUNNEL_TOKEN=xxx > .env && docker compose --profile tunnel up -d`""
