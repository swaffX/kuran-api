# Bu betik ortam değişkenlerini kalıcı olarak ayarlar
# Administrator olarak çalıştırılmalıdır

# JAVA_HOME değişkenini ayarla
[System.Environment]::SetEnvironmentVariable("JAVA_HOME", "C:\Program Files\Android\Android Studio\jbr", [System.EnvironmentVariableTarget]::User)

# ANDROID_HOME değişkenini ayarla
[System.Environment]::SetEnvironmentVariable("ANDROID_HOME", "C:\Users\swaff\AppData\Local\Android\Sdk", [System.EnvironmentVariableTarget]::User)

# Path değişkenini güncelle
$path = [System.Environment]::GetEnvironmentVariable("Path", [System.EnvironmentVariableTarget]::User)

# JAVA_HOME\bin ekle (eğer yoksa)
$java_bin = "$env:JAVA_HOME\bin"
if ($path -notlike "*$java_bin*") {
    $path = "$path;$java_bin"
}

# ANDROID_HOME\platform-tools ekle (eğer yoksa)
$platform_tools = "$env:ANDROID_HOME\platform-tools"
if ($path -notlike "*$platform_tools*") {
    $path = "$path;$platform_tools"
}

# ANDROID_HOME\emulator ekle (eğer yoksa)
$emulator = "$env:ANDROID_HOME\emulator"
if ($path -notlike "*$emulator*") {
    $path = "$path;$emulator"
}

# Güncellenmiş Path değişkenini kaydet
[System.Environment]::SetEnvironmentVariable("Path", $path, [System.EnvironmentVariableTarget]::User)

Write-Host "`nOrtam değişkenleri kalıcı olarak ayarlandı:" -ForegroundColor Green
Write-Host "JAVA_HOME: C:\Program Files\Android\Android Studio\jbr" -ForegroundColor Yellow
Write-Host "ANDROID_HOME: C:\Users\swaff\AppData\Local\Android\Sdk" -ForegroundColor Yellow
Write-Host "`nPath değişkenine eklenenler:" -ForegroundColor Green
Write-Host "- C:\Program Files\Android\Android Studio\jbr\bin" -ForegroundColor Yellow
Write-Host "- C:\Users\swaff\AppData\Local\Android\Sdk\platform-tools" -ForegroundColor Yellow
Write-Host "- C:\Users\swaff\AppData\Local\Android\Sdk\emulator" -ForegroundColor Yellow

Write-Host "`nDeğişikliklerin etkili olması için PowerShell veya Komut İstemcisi pencerelerini kapatıp yeniden açmanız gerekebilir." -ForegroundColor Cyan 