@echo off
REM Environment Setup Script for Windows

echo =====================================
echo Environment Configuration Setup
echo =====================================

if "%1"=="prod" (
    echo Setting up PRODUCTION environment...
    copy "config\environments\.env.production" ".env"
    echo ✅ Production environment configured
) else if "%1"=="local" (
    echo Setting up LOCAL environment with database...
    copy "config\environments\.env.local" ".env"
    echo ✅ Local environment configured
) else (
    echo Setting up DEVELOPMENT environment...
    copy "config\environments\.env.development" ".env"
    echo ✅ Development environment configured
)

echo.
echo Available commands:
echo   setup.bat          - Development environment
echo   setup.bat local    - Local with database
echo   setup.bat prod     - Production environment
echo.
echo Current .env file configured for: %1
echo =====================================