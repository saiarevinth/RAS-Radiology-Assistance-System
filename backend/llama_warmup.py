import requests
import logging

def warmup_llama_model():
    """Send a dummy request to Ollama to preload the llama3.2 model on backend startup."""
    OLLAMA_URL = "http://localhost:11434"
    MODEL_NAME = "llama3.2"
    try:
        # Send a minimal completion request to trigger model load
        response = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": MODEL_NAME,
                "prompt": "Warm up."
            },
            timeout=30
        )
        if response.status_code == 200:
            logging.info("Llama model warmup successful.")
        else:
            logging.warning(f"Llama model warmup failed: {response.text}")
    except Exception as e:
        logging.warning(f"Llama model warmup exception: {e}")
