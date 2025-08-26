import sys
import json
import re
import requests
from difflib import HtmlDiff
from datetime import datetime

# Configuration
OLLAMA_URL = "http://localhost:11434"  # Ollama server URL
MODEL_NAME = "llama3.2"  # Model for AI comparison

def clean_text(text):
    """Clean and normalize text for comparison"""
    if not text:
        return ""
    return ' '.join(str(text).split())

def generate_ai_comparison(old_report, new_report, context=None):
    """Generate analytical AI-powered comparison using LLaMA model"""
    try:
        prompt = f"""You are a senior radiologist analyzing changes between two medical reports. 
        Provide a detailed, professional comparison with the following structure:

        [CLINICAL FINDINGS]
        - Key changes in clinical observations
        - New or resolved findings
        - Changes in severity or progression

        [DIAGNOSTIC IMPRESSION]
        - Changes in diagnosis or assessment
        - New or modified differential diagnoses
        - Changes in confidence levels

        [TREATMENT IMPLICATIONS]
        - New treatment recommendations
        - Medication changes
        - Follow-up requirements

        [CRITICAL CHANGES] (if any)
        - Urgent findings requiring immediate attention
        - Significant changes in patient condition
        - Red flags or warning signs

        OLD REPORT:
        {old_report}

        NEW REPORT:
        {new_report}

        IMPORTANT: 
        - Use clear section headers in UPPERCASE
        - Be concise but thorough
        - Focus on clinically significant changes
        - Highlight critical findings
        - Avoid markdown formatting
        - Use bullet points for clarity
        - Include relevant measurements and values
        - Note any new symptoms or resolved issues
        - Mention stability or progression of existing conditions
        """
        
        response = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": "llama3.2",  # Using the available LLaMA 3.2 model
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.3,  # More focused and deterministic
                    "top_p": 0.9,
                    "top_k": 40,
                    "num_ctx": 4096  # Larger context window for better analysis
                }
            },
            timeout=120  # Slightly increased timeout for reliability
        )
        
        if response.status_code != 200:
            raise Exception(f"AI model error: {response.text}")
            
        result = response.json().get("response", "")
        # Clean up any markdown formatting that might be present
        result = result.replace("**", "").replace("*", "•").replace("#", "").strip()
        return result
        
    except Exception as e:
        return f"AI comparison failed: {str(e)}"

def compare_reports(old_report, new_report, context=None):
    """Compare two medical reports using AI analysis"""
    try:
        if not old_report or not new_report:
            raise ValueError("Both reports are required for comparison")
            
        # Generate AI comparison
        ai_comparison = generate_ai_comparison(old_report, new_report, context)
        
        # Basic analysis
        old_words = set(clean_text(old_report).lower().split())
        new_words = set(clean_text(new_report).lower().split())
        
        # Prepare result
        return {
            "metadata": {
                "generated_at": datetime.utcnow().isoformat(),
                "context": context or {}
            },
            "comparison": ai_comparison,
            "statistics": {
                "old_word_count": len(old_words),
                "new_word_count": len(new_words),
                "added_words": len(new_words - old_words),
                "removed_words": len(old_words - new_words)
            },
            "success": True
        }
        
    except Exception as e:
        return {
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat(),
            "success": False
        }

if __name__ == "__main__":
    try:
        data = json.loads(sys.stdin.read())
        result = compare_reports(
            data.get("oldReport", ""),
            data.get("newReport", ""),
            data.get("context", {})
        )
        print(json.dumps(result, indent=2))
    except Exception as e:
        error = {"error": str(e), "timestamp": datetime.utcnow().isoformat(), "success": False}
        print(json.dumps(error, indent=2), file=sys.stderr)
        sys.exit(1)
