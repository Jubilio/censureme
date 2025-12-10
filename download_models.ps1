# Script to download NSFW.js models manually
# Run this if the extension fails to load the model from the CDN

$ErrorActionPreference = "Stop"

$modelDir = "libs\model"
if (-not (Test-Path $modelDir)) {
    New-Item -ItemType Directory -Path $modelDir | Out-Null
}

Write-Host "Downloading model.json..."
try {
    Invoke-WebRequest -Uri "https://raw.githubusercontent.com/infinitered/nsfwjs/master/models/mobilenet_v2/model.json" -OutFile "$modelDir\model.json"
    Write-Host "✅ model.json downloaded."
}
catch {
    Write-Error "Failed to download model.json. Please check your internet connection."
}

Write-Host "Downloading group1-shard1of1.bin..."
try {
    Invoke-WebRequest -Uri "https://raw.githubusercontent.com/infinitered/nsfwjs/master/models/mobilenet_v2/group1-shard1of1" -OutFile "$modelDir\group1-shard1of1.bin"
    Write-Host "✅ group1-shard1of1.bin downloaded."
}
catch {
    Write-Error "Failed to download shard file."
}

Write-Host "Done! Please reload the extension."
