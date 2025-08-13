# Radiologist Assistance System

A full-stack application for AI-powered medical image segmentation using ResUNet50.

## Architecture

- **Frontend**: Next.js 14 with React, TypeScript, and Tailwind CSS
- **Backend**: Flask with PyTorch for deep learning inference
- **Model**: ResUNet50 for medical image segmentation

## Setup Instructions

### Backend Setup

1. Navigate to the backend directory:
\`\`\`bash
cd backend
\`\`\`

2. Create and activate a virtual environment:
\`\`\`bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
\`\`\`

3. Install dependencies:
\`\`\`bash
pip install -r requirements.txt
\`\`\`

4. Place your trained ResUNet50 model file (`ResUNet50.pth`) in the backend directory

5. Start the Flask server:
\`\`\`bash
python app.py
\`\`\`

The backend will run on `http://localhost:5000`

### Frontend Setup

1. Install dependencies:
\`\`\`bash
npm install
\`\`\`

2. Start the development server:
\`\`\`bash
npm run dev
\`\`\`

The frontend will run on `http://localhost:3000`

## Usage

1. **Check Backend Connection**: Click "Check Connection" to verify the Flask backend is running
2. **Configure Model**: Enter the path to your ResUNet50 model file
3. **Upload Image**: Select a medical image (JPEG, PNG, TIFF, DICOM)
4. **Run Analysis**: Click "Run Segmentation Analysis" to process the image
5. **View Results**: See the segmentation overlay and affected area percentage

## Features

- Real-time backend connection status
- Image preview before processing
- AI-powered segmentation with ResUNet50
- Segmentation overlay visualization
- Affected area percentage calculation
- Comprehensive error handling
- Responsive design
- CORS-enabled API
- **AI Medical Report Generation** with Ollama integration
- **Multi-format Export** (HTML, PDF, DOCX)
- **Report Editing** capabilities for doctors
- **Comprehensive Patient Information** forms

## AI Report Generation

The system now includes AI-powered medical report generation using Ollama:

### Setup Ollama

1. **Install Ollama** from [ollama.ai](https://ollama.ai)
2. **Start Ollama service**:
   ```bash
   ollama serve
   ```
3. **Pull a model** (recommended: llama3.2):
   ```bash
   ollama pull llama3.2
   ```
4. **Set environment variable**:
   ```bash
   # Windows
   set NEXT_PUBLIC_OLLAMA_URL=http://localhost:11434
   
   # Linux/macOS
   export NEXT_PUBLIC_OLLAMA_URL=http://localhost:11434
   ```

### Using AI Reports

1. **Fill patient information** including patient name
2. **Upload and process** medical images
3. **Generate AI Report** - Click "Generate AI Medical Report"
4. **Edit Report** - Review and modify the AI-generated content
5. **Export Report** - Download in HTML, PDF, or DOCX format

### Report Features

- **Structured Medical Reports** with patient demographics
- **Clinical History Integration** from patient forms
- **AI Analysis Results** with affected area percentages
- **Professional Formatting** for medical documentation
- **Multi-format Export** for different use cases
- **Doctor Editing** capabilities for final review

### Export Formats

- **HTML Export**: Direct download of formatted HTML report
- **PDF Export**: Direct download of PDF file using jsPDF library
- **DOCX Export**: HTML-based document (can be opened in Word)

**Note**: PDF export now uses jsPDF library for direct PDF generation and download. The PDF will be automatically saved to your downloads folder with the patient's name and includes proper formatting with sections for patient information, clinical history, and AI analysis.

## API Endpoints

- `GET /health` - Backend health check
- `POST /segment` - Image segmentation endpoint
- `POST /export-report` - Export medical reports in various formats

## Model Requirements

The system expects a ResUNet50 model saved as a `.pth` file. The model should:
- Accept 3-channel RGB input images (256x256)
- Output single-channel segmentation masks
- Be compatible with PyTorch

## Development Notes

- The backend includes comprehensive logging for debugging
- Model caching prevents reloading on each request
- CORS is configured for local development
- Error handling covers model loading, image processing, and inference
- The frontend includes connection testing and status monitoring

## Production Deployment

For production deployment:
1. Update CORS origins in `app.py`
2. Set `debug=False` in Flask
3. Configure proper environment variables
4. Use a production WSGI server like Gunicorn
5. Set up proper SSL/TLS certificates