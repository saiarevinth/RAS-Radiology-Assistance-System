# Database Setup Guide for RAS Application

This guide will help you set up PostgreSQL database integration for your RAS (Receptionist Admin System) application.

## Prerequisites

1. **PostgreSQL** installed and running on your system
2. **Python 3.8+** with pip
3. **Git** (for cloning the repository)

## Installation Steps

### 1. Install PostgreSQL

#### Windows:
- Download and install PostgreSQL from [postgresql.org](https://www.postgresql.org/download/windows/)
- During installation, note down the password for the `postgres` user
- Add PostgreSQL bin directory to your PATH environment variable

#### macOS:
```bash
brew install postgresql
brew services start postgresql
```

#### Linux (Ubuntu/Debian):
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 2. Set Up Database

#### Option A: Using the provided scripts

**Windows:**
```cmd
cd backend
setup_database.bat
```

**Linux/macOS:**
```bash
cd backend
chmod +x setup_database.sh
./setup_database.sh
```

#### Option B: Manual setup

1. Connect to PostgreSQL as the postgres user:
```bash
psql -U postgres
```

2. Create database and user:
```sql
CREATE DATABASE ras_database;
CREATE USER ras_user WITH PASSWORD 'ras_password';
GRANT ALL PRIVILEGES ON DATABASE ras_database TO ras_user;
\q
```

### 3. Configure Environment

1. Copy the environment file:
```bash
cd backend
copy env.example .env  # Windows
# OR
cp env.example .env    # Linux/macOS
```

2. Edit `.env` file and update database credentials if needed:
```env
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=ras_database
POSTGRES_USER=ras_user
POSTGRES_PASSWORD=ras_password
```

### 4. Install Python Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 5. Initialize Database

```bash
python init_db.py
```

This script will:
- Create all necessary database tables
- Seed initial users (doctors and receptionists)
- Optionally create sample patient data

### 6. Start the Application

```bash
python app.py
```

The application will be available at `http://localhost:5000`

## Database Schema

### Tables Created:

1. **users** - Stores doctor and receptionist accounts
2. **patients** - Stores patient information
3. **medical_reports** - Stores medical reports and AI analysis results
4. **patient_sessions** - Tracks patient visits and sessions

### Key Features:

- **Patient Management**: Receptionists can create and manage patient records
- **Medical Reports**: Store PDF uploads, AI extraction results, and doctor reviews
- **User Authentication**: Role-based access control for doctors and receptionists
- **File Storage**: Secure file upload and storage for medical documents

## API Endpoints

### Patient Management:
- `POST /api/patients` - Create new patient (Receptionist only)
- `GET /api/patients` - List all patients
- `GET /api/patients/<id>` - Get patient details
- `GET /api/patients/search?patient_id=<id>` - Search patient by ID (Doctor only)

### Medical Reports:
- `POST /api/reports` - Create medical report (Receptionist only)
- `PUT /api/reports/<id>` - Update report (Doctor only)
- `GET /api/reports/<id>` - Get report details
- `GET /api/reports/patient/<patient_id>` - Get all reports for a patient

### File Management:
- `POST /api/upload` - Upload files for medical reports

### Dashboard:
- `GET /api/dashboard/stats` - Get system statistics

## Default Login Credentials

### Doctors:
- **Dr. John Smith**: dr.smith@hospital.com / Smith2024!
- **Dr. Sarah Johnson**: dr.johnson@hospital.com / Johnson2024!
- **Dr. Michael Williams**: dr.williams@hospital.com / Williams2024!

### Receptionists:
- **Alex Parker**: reception@hospital.com / Reception2024

## Workflow

### Receptionist Workflow:
1. Login with receptionist credentials
2. Create new patient record
3. Upload medical PDF for AI extraction
4. Create medical report with extracted data
5. Assign report to appropriate doctor

### Doctor Workflow:
1. Login with doctor credentials
2. Search for patient using patient ID
3. View patient details and medical history
4. Review AI-generated reports
5. Edit and finalize reports
6. Export reports in various formats

## Troubleshooting

### Common Issues:

1. **Database Connection Error**:
   - Ensure PostgreSQL is running
   - Check database credentials in `.env` file
   - Verify database and user exist

2. **Permission Denied**:
   - Ensure `ras_user` has proper privileges
   - Check PostgreSQL configuration

3. **Port Already in Use**:
   - Change port in `.env` file or kill existing process
   - Default port is 5000

4. **Import Errors**:
   - Ensure all dependencies are installed
   - Check Python version compatibility

### Getting Help:

- Check the application logs for detailed error messages
- Verify database connection using `psql -U ras_user -d ras_database`
- Ensure all environment variables are properly set

## Security Notes

- Change default passwords in production
- Use strong, unique passwords for database users
- Enable SSL for database connections in production
- Regularly backup your database
- Implement proper access controls and audit logging

## Production Deployment

For production deployment:

1. Use environment-specific configuration files
2. Enable SSL/TLS for database connections
3. Implement proper backup strategies
4. Use production-grade PostgreSQL configuration
5. Set up monitoring and logging
6. Implement rate limiting and security headers
7. Use HTTPS for all communications
