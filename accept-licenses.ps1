$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "C:\Users\swaff\AppData\Local\Android\Sdk"
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"

# Create a licenses directory if it doesn't exist
$licenseDir = "$env:ANDROID_HOME\licenses"
if (-not (Test-Path $licenseDir)) {
    New-Item -ItemType Directory -Path $licenseDir -Force
}

# Accept Android SDK licenses by writing the license keys to files
@(
    "android-googletv-license"
    "android-sdk-license"
    "android-sdk-preview-license"
    "google-gdk-license"
    "mips-android-sysimage-license"
    "intel-android-extra-license"
    "intel-android-sysimage-license"
) | ForEach-Object {
    $licenseFile = "$licenseDir\$_"
    Set-Content -Path $licenseFile -Value "8933bad161af4178b1185d1a37fbf41ea5269c55" -Force
}

# Also set the NDK license
Set-Content -Path "$licenseDir\android-ndk-license" -Value "8933bad161af4178b1185d1a37fbf41ea5269c55" -Force

Write-Host "Android SDK licenses accepted" -ForegroundColor Green

# Run the build script to verify licenses are accepted
.\build-android.ps1 