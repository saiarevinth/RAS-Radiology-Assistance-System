Radiologist Assistance System (RAS)

A comprehensive medical imaging platform that combines AI-powered image segmentation with patient intake and reporting workflows for receptionists and doctors.

## Features

### 🏥 Receptionist Module
- **Patient Intake Management**: Register patients and capture demographics, history, medications, allergies, symptoms, and clinical context.
- **PDF Report Upload & Storage**: Upload previous medical reports (PDF). The uploaded file path is saved with the patient intake (`previous_report_pdf`).
- **AI-Powered Data Extraction**: Extract key fields from uploaded PDFs to auto-fill the intake form (manual edits supported).
- **No Report Auto-Creation**: Reception does not create medical reports; only the uploaded PDF is stored with the intake for doctor reference.

### 👨‍⚕️ Doctor Module
- **Patient Search by ID**: Load a patient using the custom Patient ID.
- **Auto-Populated Clinical View**: Intake details auto-fill the clinical information panel.
- **Uploaded PDF Access**: Direct “View / Download” link for the intake’s uploaded report via backend `/uploads/<filename>`.
- **Medical Image Segmentation**: Upload medical images and run AI segmentation.
- **AI Report Generation**: Create AI-assisted narrative reports (via Ollama) and edit before saving.
- **Report Update**: Save AI/edited report content to the latest patient report when available.
- **Export**: Download reports as PDF, DOCX, or HTML.

### 🔬 AI & Processing
- **Segmentation**: ResUNet50-based model for brain image segmentation.
- **Default Model Path**: Backend uses the default `resunet50_brain_segmentation.pth`. Frontend model-path UI has been removed.
- **Report Generation**: Uses Ollama (example model: `llama3.2`).

## System Architecture

- **Frontend**: Next.js + TypeScript + Tailwind CSS
- **Backend**: Flask (Python) + SQLAlchemy ORM
- **Database**: PostgreSQL
- **Auth**: Session-based, role-based access control (Doctor, Receptionist)

## Prerequisites

- Python 3.8+
- Node.js 18+
- PostgreSQL 12+
- Ollama (for AI report generation)

## Installation

### 1) Clone
```bash
git clone <repository-url>
cd RAS
```

### 2) Backend Setup
```bash
cd backend

python -m venv venv
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt

cp env.example .env
# Edit .env

python init_db.py
```

### 3) Frontend Setup
```bash
npm install

cp .env.example .env.local
# Edit .env.local (NEXT_PUBLIC_BACKEND_URL, NEXT_PUBLIC_OLLAMA_URL)
```

### 4) Database
```bash
createdb ras_database
cd backend
python init_db.py
```

### 5) Ollama (AI report generation)
```bash
# Install from https://ollama.ai/
ollama serve
ollama pull llama3.2
```

## Usage

### Start
```bash
# Backend
cd backend
python app.py

# Frontend (in project root)
npm run dev
```

Access:
- Frontend: http://localhost:3000
- Backend:  http://localhost:5000

## Receptionist Intake Fields (Saved)

Core fields saved under `patient_intakes` (naming may vary per schema):
- Demographics: `patientName`, `age`, `gender`, `contactNumber`.
- Clinical: `referringPhysician`, `chiefComplaint`, `symptoms`.
- History: `medicalHistory`, `familyHistory`.
- Medications/Allergies: `currentMedications`, `knownAllergies`.
- Documents: `previous_report_pdf` (path to uploaded PDF).

Tip: When an intake is saved, the PDF filename returned by `/upload-pdf` should be stored in `previous_report_pdf` so doctors can access it from the patient view.

## Workflow

### Receptionist
1. Login as Receptionist.
2. Go to Intake, upload previous report PDF (optional), optionally extract fields.
3. Complete missing fields and Save intake. The PDF path is stored with the intake.

### Doctor
1. Login as Doctor.
2. Search patient by Patient ID.
3. Review intake information auto-populated on the page.
4. If a PDF was uploaded, use the “View / Download” button to open it.
5. Upload imaging, run segmentation, generate/edit AI report, and export.

## Data Flow Overview

- Receptionist uploads a PDF via `POST /upload-pdf` and gets `{ filename, file_path }`.
- Receptionist saves intake via `POST /api/intake` including `previousReportPdf` with the uploaded filename/path.
- Doctor searches patient via `GET /api/patients/search-by-id` and sees the intake data.
- If `previous_report_pdf` exists, the UI renders a link to `GET /uploads/<filename>`.
- Doctor may upload an image to `POST /segment` to run AI segmentation. The backend uses the default model path.

## API Endpoints (Key)

### Authentication (`backend/auth.py` under `/auth`)
- `POST /auth/login` — Doctor login
- `POST /auth/receptionist/login` — Receptionist login
- `POST /auth/logout` — Logout (clears session cookie)
- `GET /auth/me` — Current session user

### Patient & Intake (`backend/database.py` registered under `/api`)
- `POST /api/intake` — Create patient intake (Receptionist)
- `GET /api/intake/<patient_id>` — Get latest intake for patient
- `GET /api/patients/search-by-id?patient_id=...` — Doctor search by custom Patient ID

### Medical Reports (`backend/database.py`)
- `PUT /api/reports/<id>` — Update existing report (Doctor) with AI/edited content
- `GET /api/reports/<id>` — Fetch report details
- Note: Receptionist does not create reports; only intake stores `previous_report_pdf`.

### Files & Processing (`backend/app.py`)
- `POST /upload-pdf` — Upload a PDF for intake; responds with `file_path`
- `GET /uploads/<filename>` — Serve uploaded files
- `POST /segment` — Segment uploaded image (Doctor). Uses default model `resunet50_brain_segmentation.pth`.
- `POST /extract-pdf` — Extract fields from uploaded PDF (for intake assistance)

### Endpoint Examples

PDF Upload
```bash
curl -X POST http://localhost:5000/upload-pdf \
  -F "file=@/path/to/report.pdf"
# => { "success": true, "filename": "<uuid>_report.pdf", "file_path": "uploads/<uuid>_report.pdf" }
```

PDF Field Extraction
```bash
curl -X POST http://localhost:5000/extract-pdf \
  -F "file=@/path/to/report.pdf"
# => { "success": true, "data": { ... extracted fields ... } }
```

Segmentation
```bash
curl -X POST http://localhost:5000/segment \
  -H "Cookie: ras_session=<session_token>" \
  -F "image=@/path/to/image.png"
# => { "image_data_uri": "data:image/png;base64,...", "affected_percentage": 12.34 }
```

## File Storage

- Uploaded PDFs are stored under the `backend/uploads/` directory.
- Files are served via `GET /uploads/<filename>` using `send_from_directory`.
- Ensure `UPLOAD_FOLDER=uploads` in backend environment and that the folder is writable.

## Roles & Permissions

- Receptionist: can upload PDFs and create intakes (`POST /api/intake`).
- Doctor: can search patients, run segmentation, and update reports.
- Protected routes require a valid session cookie (see `auth.py` and `/auth/*` endpoints).

## Database Overview

- `patients` — Patient basic details
- `patient_intakes` — Detailed intake; includes `previous_report_pdf`
- `medical_reports` — Imaging reports and doctor-reviewed content

## Configuration

Environment variables:
```bash
# Backend (.env)
DATABASE_URL=postgresql://user:password@localhost/ras_database
SECRET_KEY=your-secret-key
UPLOAD_FOLDER=uploads

# Frontend (.env.local)
NEXT_PUBLIC_BACKEND_URL=http://localhost:5000
NEXT_PUBLIC_OLLAMA_URL=http://localhost:11434
```

## Troubleshooting

- Backend not starting: ensure venv is activated and deps installed.
- Frontend errors: reinstall deps and confirm env vars.
- Ollama: ensure `ollama serve` is running and model pulled.
- 401 errors: login first; cookies are required for protected routes.

## Development

1. Update models in `backend/models.py`
2. Add/modify endpoints in `backend/database.py` or `backend/app.py`
3. Update frontend components
4. Re-run `db.create_all()` (dev) if schema changed

## Security

- Role-based access control and session cookies
- Input validation and sanitization
- Secure file upload handling
- CORS for development

---

Note: This system is for educational and research purposes. Always follow medical protocols and consult qualified professionals for patient care.
