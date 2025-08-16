# PDF Extraction Setup Guide

This guide explains how to set up and use the new PDF extraction system for the patient intake form.

## Backend Setup

### 1. Install Dependencies

The backend now requires PyMuPDF for PDF processing. Install it using:

```bash
cd backend
pip install PyMuPDF==1.23.8
```

Or update your requirements.txt and install all dependencies:

```bash
pip install -r requirements.txt
```

### 2. New Files Added

- `backend/pdf_extractor.py` - Contains the PDF extraction logic using PyMuPDF
- New endpoint `/extract-pdf` in `backend/app.py`

### 3. Start the Backend

```bash
cd backend
python app.py
```

The backend will run on `http://localhost:5000`

## Frontend Setup

### 1. Environment Configuration

Create a `.env.local` file in your project root:

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:5000
```

### 2. Updated Features

The patient intake form now:
- Uses Python-based PDF extraction instead of AI service
- Extracts structured data from PDF files using font analysis and positioning
- Supports both PDF files and manual text input
- Automatically populates form fields based on extracted data

## How It Works

### PDF Processing Pipeline

1. **File Upload**: User selects a PDF file
2. **Backend Processing**: File is sent to `/extract-pdf` endpoint
3. **Text Extraction**: PyMuPDF extracts text with font and positioning information
4. **Pattern Matching**: Regex patterns identify medical fields
5. **Font Analysis**: Bold/italic text and positioning help identify headers vs content
6. **Data Mapping**: Extracted data is mapped to form fields
7. **Form Population**: Frontend automatically fills the form

### Extraction Patterns

The system looks for patterns like:
- **Patient Name**: "Patient:", "Name:", or standalone capitalized names
- **Age**: "Age:", "years old", "Y/O"
- **Contact**: Phone number patterns
- **Medical Info**: Keywords like "Previous", "Medication", "Allergy"
- **Dates**: Various date formats converted to YYYY-MM-DD

### Font and Positioning Analysis

- **Bold Text**: Often indicates field headers
- **Positioning**: Related information is grouped by Y-coordinate
- **Font Size**: Larger fonts may indicate section headers
- **Text Case**: UPPERCASE, Title Case, or mixed case analysis

## Usage

### 1. Upload PDF
- Select a medical report PDF file
- Click "Extract Data"
- Wait for processing (usually 1-3 seconds)

### 2. Review Extracted Data
- Form fields are automatically populated
- Green borders indicate successfully extracted data
- Progress bar shows completion status

### 3. Manual Adjustments
- Edit any fields that need correction
- Add missing information manually
- Save the completed intake form

## Supported File Types

- **Primary**: PDF files (recommended)
- **Fallback**: TXT, DOC, DOCX files (using text extraction)
- **Manual**: Copy-paste text input

## Error Handling

- File size limit: 10MB
- Invalid file types are rejected
- Extraction failures show helpful error messages
- Fallback data structure ensures form usability

## Performance

- PDF processing: ~1-3 seconds for typical medical reports
- Text extraction: ~0.5-1 second
- Memory usage: Minimal (streaming file processing)

## Troubleshooting

### Common Issues

1. **"Failed to process PDF"**
   - Check if PyMuPDF is installed
   - Verify file is a valid PDF
   - Check file size (max 10MB)

2. **"No meaningful data extracted"**
   - PDF might be image-based (not text)
   - Try a different PDF file
   - Use manual text input as fallback

3. **Backend connection errors**
   - Ensure backend is running on port 5000
   - Check firewall settings
   - Verify environment variable `NEXT_PUBLIC_BACKEND_URL`

### Debug Information

The form shows debug information when extraction succeeds:
- Number of fields with meaningful data
- Form completion status
- Raw extracted data preview

## Future Enhancements

- Support for image-based PDFs using OCR
- Machine learning-based field extraction
- Integration with medical databases
- Export to various medical record formats
- Batch processing for multiple files

## Security Notes

- Files are processed in memory (not stored)
- No patient data is logged or persisted
- File size limits prevent DoS attacks
- Only PDF files are accepted for security
