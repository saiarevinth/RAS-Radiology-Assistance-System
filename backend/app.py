from flask import Flask, request, jsonify
from flask_cors import CORS
import torch
import numpy as np
import cv2
import io
import base64
from PIL import Image
from model import ResUNet50   # make sure model.py defines this
import json
from datetime import datetime
import os

# Device configuration
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Initialize Flask app
app = Flask(__name__)
# Enable credentialed CORS so we can use HttpOnly cookies from the frontend
CORS(
    app,
    supports_credentials=True,
    resources={r"/*": {"origins": ["http://localhost:3000", "http://127.0.0.1:3000"]}},
)

from auth import auth_bp, require_auth  # noqa: E402
app.register_blueprint(auth_bp)

# Simple model cache so you don't reload on every request
_model_cache = {}

def get_model(model_path):
    if model_path in _model_cache:
        return _model_cache[model_path]

    model = ResUNet50(out_channels=1, pretrained=False)
    state = torch.load(model_path, map_location=DEVICE)

    if isinstance(state, dict) and "state_dict" in state:
        model.load_state_dict(state["state_dict"])
    else:
        try:
            model.load_state_dict(state)
        except Exception:
            model = state

    model.to(DEVICE)
    model.eval()
    _model_cache[model_path] = model
    return model

def preprocess_image(image_data, target_size=(256, 256)):
    image = Image.open(io.BytesIO(image_data))
    if hasattr(image, "n_frames") and image.n_frames > 1:
        image.seek(0)
    image = np.array(image)

    if len(image.shape) == 2:
        image = cv2.cvtColor(image, cv2.COLOR_GRAY2RGB)
    elif image.shape[2] > 3:
        image = image[:, :, :3]

    image_resized = cv2.resize(image, target_size)
    image_normalized = image_resized.astype(np.float32) / 255.0
    image_tensor = torch.tensor(image_normalized).permute(2, 0, 1).unsqueeze(0)
    return image, image_tensor

def predict(model, image_tensor):
    with torch.no_grad():
        image_tensor = image_tensor.to(DEVICE)
        out = model(image_tensor)
        out = torch.sigmoid(out)
        out = (out > 0.5).float()
    return out

def overlay_mask(original_image, mask, alpha=0.5):
    if len(original_image.shape) == 2:
        original_image = cv2.cvtColor(original_image, cv2.COLOR_GRAY2RGB)
    if original_image.max() > 1.0:
        original_image = original_image.astype(np.float32) / 255.0

    mask_resized = cv2.resize(mask, (original_image.shape[1], original_image.shape[0]), interpolation=cv2.INTER_NEAREST)
    colored_mask = np.zeros_like(original_image, dtype=np.float32)
    colored_mask[mask_resized > 0] = [0, 0, 1.0]  # Blue mask
    result = cv2.addWeighted(original_image, 1.0, colored_mask, alpha, 0)
    return (result * 255).astype(np.uint8)

def png_bytes_to_datauri(png_bytes):
    b64 = base64.b64encode(png_bytes).decode("ascii")
    return f"data:image/png;base64,{b64}"

# Health check for React
@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({"status": "ok"}), 200

# API endpoint for segmentation
@app.route("/segment", methods=["POST"])
def segment():
    # Require authentication
    user = require_auth(request)
    if not user:
        return jsonify({"error": "unauthorized"}), 401
    if "image" not in request.files:
        return jsonify({"error": "no image file"}), 400

    model_path = request.form.get("model_path", "ResUNet50.pth")
    image_file = request.files["image"]

    try:
        model = get_model(model_path)
    except Exception as e:
        return jsonify({"error": f"failed to load model: {e}"}), 500

    image_bytes = image_file.read()
    original_image, image_tensor = preprocess_image(image_bytes)
    mask_pred = predict(model, image_tensor)
    mask_numpy = mask_pred[0, 0].cpu().numpy()

    overlay_img = overlay_mask(original_image, mask_numpy)
    tumor_pixels = int(np.sum(mask_numpy > 0.5))
    total_pixels = int(mask_numpy.size)
    affected_percentage = round((tumor_pixels / total_pixels) * 100, 2)

    success, png = cv2.imencode(".png", overlay_img)
    if not success:
        return jsonify({"error": "failed to encode image"}), 500

    data_uri = png_bytes_to_datauri(png.tobytes())

    return jsonify({
        "image_data_uri": data_uri,
        "affected_percentage": affected_percentage
    })

@app.route("/export-report", methods=["POST"])
def export_report():
    # Require authentication
    user = require_auth(request)
    if not user:
        return jsonify({"error": "unauthorized"}), 401
    
    try:
        data = request.get_json()
        format_type = data.get("format", "pdf")
        report_data = data.get("reportData", {})
        
        if format_type == "html":
            return generate_html_report(report_data)
        elif format_type == "pdf":
            return generate_pdf_report(report_data)
        elif format_type == "docx":
            return generate_docx_report(report_data)
        else:
            return jsonify({"error": "Unsupported format"}), 400
            
    except Exception as e:
        return jsonify({"error": f"Failed to export report: {str(e)}"}), 500

def generate_pdf_report(report_data):
    """Generate PDF report (simplified - returns HTML for now)"""
    # For now, return HTML that can be converted to PDF by the browser
    # In production, you'd use a library like reportlab or weasyprint
    html_content = generate_html_content(report_data)
    
    response = app.response_class(
        response=html_content,
        status=200,
        mimetype='text/html'
    )
    response.headers['Content-Disposition'] = f'attachment; filename="{report_data.get("patientName", "patient")}_report.pdf"'
    return response

def generate_docx_report(report_data):
    """Generate DOCX report (simplified - returns HTML for now)"""
    # For now, return HTML that can be converted to DOCX
    # In production, you'd use a library like python-docx
    html_content = generate_html_content(report_data)
    
    response = app.response_class(
        response=html_content,
        status=200,
        mimetype='text/html'
    )
    response.headers['Content-Disposition'] = f'attachment; filename="{report_data.get("patientName", "patient")}_report.docx"'
    return response

def generate_html_content(report_data):
    """Generate HTML content for reports"""
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Medical Report - {report_data.get('patientName', 'Unknown')}</title>
        <style>
            body {{ font-family: Arial, sans-serif; margin: 40px; }}
            .header {{ text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }}
            .section {{ margin-bottom: 25px; }}
            .section h2 {{ color: #2c5aa0; border-bottom: 1px solid #ccc; padding-bottom: 5px; }}
            .info-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }}
            .patient-info {{ background: #f5f5f5; padding: 15px; border-radius: 5px; }}
            .report-content {{ white-space: pre-wrap; line-height: 1.6; }}
            .footer {{ margin-top: 40px; text-align: center; font-size: 12px; color: #666; }}
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Medical Imaging Report</h1>
            <p>Generated on {datetime.now().strftime('%B %d, %Y at %I:%M %p')}</p>
        </div>
        
        <div class="section">
            <h2>Patient Information</h2>
            <div class="info-grid">
                <div class="patient-info">
                    <strong>Patient Name:</strong> {report_data.get('patientName', 'N/A')}<br>
                    <strong>Referring Physician:</strong> {report_data.get('patientInfo', {}).get('referringPhysician', 'N/A')}<br>
                    <strong>Report Generated By:</strong> {report_data.get('doctorName', 'N/A')} ({report_data.get('doctorSpecialty', 'N/A')})
                </div>
                <div class="patient-info">
                    <strong>Chief Complaint:</strong> {report_data.get('patientInfo', {}).get('chiefComplaint', 'N/A')}<br>
                    <strong>Affected Area:</strong> {report_data.get('affectedPercentage', 'N/A')}%<br>
                    <strong>Report Status:</strong> {'Edited' if report_data.get('isEdited') else 'AI Generated'}
                </div>
            </div>
        </div>
        
        <div class="section">
            <h2>Clinical History</h2>
            <div class="patient-info">
                <strong>Medical History:</strong> {report_data.get('patientInfo', {}).get('medicalHistory', 'N/A')}<br><br>
                <strong>Current Medications:</strong> {report_data.get('patientInfo', {}).get('currentMedications', 'N/A')}<br><br>
                <strong>Known Allergies:</strong> {report_data.get('patientInfo', {}).get('knownAllergies', 'N/A')}<br><br>
                <strong>Family History:</strong> {report_data.get('patientInfo', {}).get('familyHistory', 'N/A')}
            </div>
        </div>
        
        <div class="section">
            <h2>AI Analysis Report</h2>
            <div class="report-content">{report_data.get('content', 'No report content available')}</div>
        </div>
        
        <div class="footer">
            <p>This report was generated using AI-assisted medical imaging analysis.</p>
            <p>Please review all findings with qualified medical professionals.</p>
        </div>
    </body>
    </html>
    """

def generate_html_report(report_data):
    """Generate HTML report"""
    html_content = generate_html_content(report_data)
    
    response = app.response_class(
        response=html_content,
        status=200,
        mimetype='text/html'
    )
    response.headers['Content-Disposition'] = f'attachment; filename="{report_data.get("patientName", "patient")}_report.html"'
    return response

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
