@echo off
REM Database setup script for RAS application (Windows)
REM This script will create the PostgreSQL database and user

echo Setting up PostgreSQL database for RAS application...

REM Check if PostgreSQL is running
pg_isready -q
if %errorlevel% neq 0 (
    echo Error: PostgreSQL is not running. Please start PostgreSQL first.
    pause
    exit /b 1
)

REM Database configuration
set DB_NAME=ras_database
set DB_USER=ras_user
set DB_PASSWORD=ras_password

echo Creating database: %DB_NAME%
echo Creating user: %DB_USER%

REM Create database and user
psql -U postgres -c "CREATE DATABASE %DB_NAME%;" 2>nul || echo Database already exists or error occurred
psql -U postgres -c "CREATE USER %DB_USER% WITH PASSWORD '%DB_PASSWORD%';" 2>nul || echo User already exists or error occurred
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE %DB_NAME% TO %DB_USER%;" 2>nul || echo Privileges already granted or error occurred

echo.
echo Database setup completed!
echo.
echo Next steps:
echo 1. Copy env.example to .env and update database credentials if needed
echo 2. Install Python dependencies: pip install -r requirements.txt
echo 3. Run database initialization: python init_db.py
echo 4. Start the application: python app.py
echo.
echo Default credentials:
echo Doctor: dr.smith@hospital.com / Smith2024!
echo Receptionist: reception@hospital.com / Reception2024
echo.
pause
