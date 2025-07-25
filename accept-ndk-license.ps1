$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "C:\Users\swaff\AppData\Local\Android\Sdk"
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\cmdline-tools\latest\bin;$env:Path"

# Create necessary license directories
$licenseDir = "$env:ANDROID_HOME\licenses"
if (-not (Test-Path $licenseDir)) {
    New-Item -ItemType Directory -Path $licenseDir -Force
}

# Set all possible license files with various license hashes
$licenseFiles = @{
    "android-sdk-license" = @(
        "8933bad161af4178b1185d1a37fbf41ea5269c55",
        "d56f5187479451eabf01fb78af6dfcb131a6481e",
        "24333f8a63b6825ea9c5514f83c2829b004d1fee"
    )
    "android-sdk-preview-license" = @(
        "84831b9409646a918e30573bab4c9c91346d8abd"
    )
    "android-ndk-license" = @(
        "8933bad161af4178b1185d1a37fbf41ea5269c55",
        "d56f5187479451eabf01fb78af6dfcb131a6481e"
    )
    "intel-android-extra-license" = @(
        "d975f751698a77b662f1254ddbeed3901e976f5a"
    )
}

# Write all license files
foreach ($license in $licenseFiles.Keys) {
    $content = $licenseFiles[$license] -join "`n"
    Set-Content -Path "$licenseDir\$license" -Value $content -Force
    Write-Host "Created license file: $license" -ForegroundColor Yellow
}

Write-Host "`nAll Android SDK and NDK licenses accepted" -ForegroundColor Green
Write-Host "Now running Gradle clean to verify..." -ForegroundColor Cyan

# Run the build script
cd android
.\gradlew.bat clean

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nSuccess! Gradle clean completed successfully." -ForegroundColor Green
} else {
    Write-Host "`nError: Gradle clean failed. See the error message above." -ForegroundColor Red
} 