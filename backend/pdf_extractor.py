import fitz
import json
from collections import defaultdict
import re
import io
import base64

# --- Helper Functions ---
def normalize_font_size(size):
    return round(size, 1) if size else None

def round_coord(value, precision=1):
    return round(value, precision) if value is not None else None

def detect_line_case(text):
    if text.isupper():
        return "UPPER"
    elif text.istitle():
        return "TITLE"
    elif text.islower():
        return "LOWER"
    else:
        return "MIXED"

def has_special_prefix(text):
    text = text.strip()
    patterns = [
        r"^(\d+[\.\)])+",
        r"^[IVXLCDM]+\.",
        r"^[A-Z]\.",
        r"^[-–•:]",
        r"^(Section|Chapter|Article)\b"
    ]
    return any(re.match(p, text, re.IGNORECASE) for p in patterns)

def is_centered(x, page_width=595.0, tolerance=50):
    center = page_width / 2
    return abs(x - center) < tolerance

def extract_pdf_lines_cleaned_and_merged(pdf_bytes: bytes) -> list:
    """
    Parses PDF bytes and extracts structured line-by-line data.
    Args:
        pdf_bytes: The PDF file as bytes.
    Returns:
        A list of pages, each containing structured data about its lines.
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages_data = []

    for page_num, page in enumerate(doc):
        y_line_map = defaultdict(list)
        try:
            blocks = page.get_text("dict")["blocks"]
        except Exception:
            continue # Skip page if text extraction fails

        for block in blocks:
            if block.get('type') != 0:
                continue
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    text = span.get("text", "").strip()
                    if not text:
                        continue

                    y_key = round(span["bbox"][1], 1)
                    y_line_map[y_key].append({
                        "text": text,
                        "font_size": normalize_font_size(span.get("size")),
                        "font_name": span.get("font"),
                        "bold": "Bold" in span.get("font", ""),
                        "italic": "Italic" in span.get("font", "") or "Oblique" in span.get("font", ""),
                        "position_x": round(span["bbox"][0], 1),
                        "position_y": y_key,
                        "page_number": page_num + 1
                    })

        page_lines = []
        for y_key in sorted(y_line_map.keys()):
            line_spans = sorted(y_line_map[y_key], key=lambda s: s["position_x"])
            merged_text = " ".join([s["text"] for s in line_spans])
            font_sizes = [s["font_size"] for s in line_spans if s["font_size"] is not None]
            fonts = [s["font_name"] for s in line_spans if s["font_name"]]
            bold = any(s["bold"] for s in line_spans)
            italic = any(s["italic"] for s in line_spans)
            x = min([s["position_x"] for s in line_spans]) if line_spans else 0
            
            page_lines.append({
                "text": merged_text,
                "font_size": max(font_sizes) if font_sizes else None,
                "font_name": fonts[0] if fonts else None,
                "bold": bold,
                "italic": italic,
                "position_x": x,
                "position_y": y_key,
                "page_number": page_num + 1,
                "line_length": len(merged_text),
                "is_centered": is_centered(x),
                "line_case": detect_line_case(merged_text),
                "has_special_prefix": has_special_prefix(merged_text)
            })
        
        pages_data.append({
            "page_number": page_num + 1,
            "content": page_lines
        })
    
    doc.close()
    return pages_data

def extract_medical_fields_from_pdf(pdf_bytes: bytes) -> dict:
    """
    Extracts medical information from PDF using structured text analysis.
    Args:
        pdf_bytes: The PDF file as bytes.
    Returns:
        A dictionary with extracted medical fields.
    """
    try:
        # Get structured text data
        pages_data = extract_pdf_lines_cleaned_and_merged(pdf_bytes)
        
        # Extract all text content for analysis
        all_text = ""
        for page in pages_data:
            for line in page["content"]:
                all_text += line["text"] + "\n"
        
        # Initialize extracted fields
        extracted_fields = {
            "patientName": "Unknown",
            "age": "Unknown",
            "sex": "Unknown",
            "dob": "Unknown",
            "contactNumber": "Unknown",
            "patientId": "Unknown",
            "abhaId": "Unknown",
            "previousCondition": "None reported",
            "currentMedication": "None reported",
            "familyHistory": "None reported",
            "knownAllergy": "None reported",
            "chiefComplaint": "Not specified",
            "referringDoctor": "Not specified",
            "neurologicalSymptom": "None reported",
            "treatmentHistory": "None reported",
            "symptomProgression": "Not specified",
            "reportContent": "Report uploaded"
        }
        
        # Extract patient name (look for patterns in title case or bold text)
        name_patterns = [
            r"Patient:\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)",
            r"Name:\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)",
            r"Patient Name:\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)",
            r"^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*$"  # Standalone names
        ]
        
        for pattern in name_patterns:
            match = re.search(pattern, all_text, re.MULTILINE)
            if match:
                extracted_fields["patientName"] = match.group(1).strip()
                break
        
        # Extract age
        age_patterns = [
            r"Age:\s*(\d+)",
            r"(\d+)\s*years?\s*old",
            r"Age\s*(\d+)",
            r"(\d+)\s*Y\/O"
        ]
        
        for pattern in age_patterns:
            match = re.search(pattern, all_text, re.IGNORECASE)
            if match:
                extracted_fields["age"] = match.group(1)
                break
        
        # Extract sex/gender
        sex_patterns = [
            r"Sex:\s*(Male|Female|M|F)",
            r"Gender:\s*(Male|Female|M|F)",
            r"(Male|Female|M|F)\s*$"
        ]
        
        for pattern in sex_patterns:
            match = re.search(pattern, all_text, re.IGNORECASE)
            if match:
                extracted_fields["sex"] = match.group(1)
                break
        
        # Extract date of birth
        dob_patterns = [
            r"DOB:\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})",
            r"Date of Birth:\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})",
            r"Birth Date:\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})",
            r"(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})"
        ]
        
        for pattern in dob_patterns:
            match = re.search(pattern, all_text)
            if match:
                # Convert to YYYY-MM-DD format
                date_str = match.group(1)
                try:
                    # Simple date parsing (you might want to use dateutil for more robust parsing)
                    parts = re.split(r'[/-]', date_str)
                    if len(parts) == 3:
                        if len(parts[2]) == 2:  # Convert YY to YYYY
                            parts[2] = '20' + parts[2] if int(parts[2]) < 50 else '19' + parts[2]
                        extracted_fields["dob"] = f"{parts[2]}-{parts[0].zfill(2)}-{parts[1].zfill(2)}"
                except:
                    extracted_fields["dob"] = date_str
                break
        
        # Extract contact number
        phone_patterns = [
            r"Phone:\s*([\d\-\+\(\)\s]+)",
            r"Contact:\s*([\d\-\+\(\)\s]+)",
            r"Mobile:\s*([\d\-\+\(\)\s]+)",
            r"(\d{3}[-.\s]?\d{3}[-.\s]?\d{4})"
        ]
        
        for pattern in phone_patterns:
            match = re.search(pattern, all_text)
            if match:
                extracted_fields["contactNumber"] = match.group(1).strip()
                break
        
        # Extract patient ID
        id_patterns = [
            r"Patient ID:\s*([A-Za-z0-9\-_]+)",
            r"ID:\s*([A-Za-z0-9\-_]+)",
            r"Patient Number:\s*([A-Za-z0-9\-_]+)"
        ]
        
        for pattern in id_patterns:
            match = re.search(pattern, all_text)
            if match:
                extracted_fields["patientId"] = match.group(1).strip()
                break
        
        # Extract ABHA ID
        abha_patterns = [
            r"ABHA ID:\s*([A-Za-z0-9\-_]+)",
            r"ABHA:\s*([A-Za-z0-9\-_]+)",
            r"([A-Za-z0-9\-_]{10,})"  # ABHA IDs are typically long
        ]
        
        for pattern in abha_patterns:
            match = re.search(pattern, all_text)
            if match:
                extracted_fields["abhaId"] = match.group(1).strip()
                break
        
        # Extract medical information using font analysis and positioning
        medical_sections = {
            "previousCondition": ["Previous", "History", "Past Medical"],
            "currentMedication": ["Medication", "Drugs", "Current Treatment"],
            "familyHistory": ["Family", "Genetic", "Hereditary"],
            "knownAllergy": ["Allergy", "Allergic", "Sensitivity"],
            "chiefComplaint": ["Chief Complaint", "Main Symptom", "Primary Concern"],
            "referringDoctor": ["Referring", "Referred by", "Doctor"],
            "neurologicalSymptom": ["Neurological", "Neurologic", "Brain", "Nerve"],
            "treatmentHistory": ["Treatment", "Therapy", "Intervention"],
            "symptomProgression": ["Progression", "Worsening", "Improvement"]
        }
        
        # Analyze text by font characteristics and positioning
        for field, keywords in medical_sections.items():
            found_text = []
            
            for page in pages_data:
                for line in page["content"]:
                    # Check if line contains relevant keywords
                    if any(keyword.lower() in line["text"].lower() for keyword in keywords):
                        # Look for content after the keyword
                        for keyword in keywords:
                            if keyword.lower() in line["text"].lower():
                                # Extract text after the keyword
                                parts = line["text"].split(keyword, 1)
                                if len(parts) > 1 and parts[1].strip():
                                    found_text.append(parts[1].strip())
                                break
                        
                        # Also check next few lines for additional content
                        current_y = line["position_y"]
                        for next_line in page["content"]:
                            if (next_line["position_y"] > current_y and 
                                next_line["position_y"] <= current_y + 50 and  # Within 50 units
                                next_line["text"].strip() and
                                not any(k.lower() in next_line["text"].lower() for k in keywords)):
                                found_text.append(next_line["text"].strip())
            
            if found_text:
                extracted_fields[field] = " ".join(found_text[:3])  # Limit to first 3 pieces
            elif field in ["previousCondition", "currentMedication", "familyHistory", "knownAllergy"]:
                extracted_fields[field] = "None reported"
            elif field in ["chiefComplaint", "referringDoctor", "neurologicalSymptom", "treatmentHistory", "symptomProgression"]:
                extracted_fields[field] = "Not specified"
        
        # Generate report content summary
        if pages_data:
            total_lines = sum(len(page["content"]) for page in pages_data)
            extracted_fields["reportContent"] = f"PDF report with {len(pages_data)} pages and {total_lines} text lines"
        
        return extracted_fields
        
    except Exception as e:
        print(f"Error extracting PDF fields: {str(e)}")
        # Return default structure on error
        return {
            "patientName": "Error extracting data",
            "age": "Unknown",
            "sex": "Unknown",
            "dob": "Unknown",
            "contactNumber": "Unknown",
            "patientId": "Unknown",
            "abhaId": "Unknown",
            "previousCondition": "None reported",
            "currentMedication": "None reported",
            "familyHistory": "None reported",
            "knownAllergy": "None reported",
            "chiefComplaint": "Not specified",
            "referringDoctor": "Not specified",
            "neurologicalSymptom": "None reported",
            "treatmentHistory": "None reported",
            "symptomProgression": "Not specified",
            "reportContent": "Error processing PDF"
        }
