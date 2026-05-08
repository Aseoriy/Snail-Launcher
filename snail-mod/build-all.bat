@echo off
REM Build snail-mod for multiple Minecraft versions
REM Usage: build-all.bat

setlocal enabledelayedexpansion

set GRADLE=%TEMP%\gradle-dist\gradle-8.5\bin\gradle.bat
set OUTDIR=..\snail-mod-jars

if not exist "%OUTDIR%" mkdir "%OUTDIR%"

REM ═══ Version configs: mcVersion,yarnMappings,loaderVersion ═══
set VERSIONS[0]=1.20.4,1.20.4+build.3,0.15.6
set VERSIONS[1]=1.20.1,1.20.1+build.10,0.15.6
set VERSIONS[2]=1.21.1,1.21.1+build.3,0.16.9

for /L %%i in (0,1,2) do (
    for /F "tokens=1,2,3 delims=," %%a in ("!VERSIONS[%%i]!") do (
        echo.
        echo ════════════════════════════════════════
        echo  Building for Minecraft %%a
        echo ════════════════════════════════════════
        
        REM Update gradle.properties
        (
            echo org.gradle.jvmargs=-Xmx2G
            echo minecraft_version=%%a
            echo yarn_mappings=%%b
            echo loader_version=%%c
        ) > gradle.properties
        
        REM Clean and build
        if exist build rmdir /s /q build 2>nul
        call "%GRADLE%" build --no-daemon
        
        if !errorlevel! == 0 (
            copy /Y "build\libs\snail-mod-1.0.0.jar" "%OUTDIR%\snail-mod-%%a.jar" >nul
            echo [OK] snail-mod-%%a.jar
        ) else (
            echo [FAIL] Minecraft %%a build failed
        )
    )
)

REM Restore original properties
(
    echo org.gradle.jvmargs=-Xmx2G
    echo minecraft_version=1.20.4
    echo yarn_mappings=1.20.4+build.3
    echo loader_version=0.15.6
) > gradle.properties

echo.
echo ════════════════════════════════════════
echo  Build complete! JARs in %OUTDIR%
echo ════════════════════════════════════════
dir /B "%OUTDIR%\snail-mod-*.jar" 2>nul
pause
