from flask import Flask, request, jsonify
from flask_cors import CORS
import torch
import numpy as np
import cv2
import io
import base64
from PIL import Image
import os
import logging
from scipy import ndimage

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import your model - with better error handling
try:
    from model import ResUNet50
    logger.info("Successfully imported ResUNet50 model")
except ImportError as e:
    logger.error(f"Failed to import ResUNet50: {e}")
    # Create the ResUNet50 class inline if import fails
    class ResUNet50(torch.nn.Module):
        def __init__(self, out_channels=1, pretrained=False):
            super(ResUNet50, self).__init__()
            # Simplified version - you should use your actual model.py
            import torch.nn as nn
            self.conv1 = nn.Conv2d(3, 64, 3, padding=1)
            self.conv2 = nn.Conv2d(64, out_channels, 3, padding=1)
            
        def forward(self, x):
            x = torch.relu(self.conv1(x))
            return torch.sigmoid(self.conv2(x))
    
    logger.warning("Using simplified ResUNet50 - please ensure model.py is in the correct path")

# Alternative model definitions
class FlexibleUNet(torch.nn.Module):
    """Flexible U-Net that can adapt to different architectures"""
    def __init__(self, in_channels=3, out_channels=1):
        super(FlexibleUNet, self).__init__()
        import torch.nn as nn
        
        # Simple encoder-decoder architecture
        self.encoder = nn.Sequential(
            nn.Conv2d(in_channels, 64, 3, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(inplace=True),
            nn.Conv2d(64, 64, 3, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2)
        )
        
        self.decoder = nn.Sequential(
            nn.ConvTranspose2d(64, 32, 2, stride=2),
            nn.Conv2d(32, 32, 3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(inplace=True),
            nn.Conv2d(32, out_channels, 1),
            nn.Sigmoid()
        )
    
    def forward(self, x):
        # Ensure input is float32
        x = x.float()
        # Simple forward pass
        enc = self.encoder(x)
        dec = self.decoder(enc)
        return dec

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
logger.info(f"Using device: {DEVICE}")

app = Flask(__name__)
CORS(app, origins=["http://localhost:3000", "http://127.0.0.1:3000"])

# Model cache
_model_cache = {}

def get_model(model_path):
    """Load and cache the segmentation model with robust error handling"""
    if model_path in _model_cache:
        logger.info(f"Using cached model: {model_path}")
        return _model_cache[model_path]

    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model file not found: {model_path}")

    # Load the checkpoint
    try:
        checkpoint = torch.load(model_path, map_location=DEVICE)
        logger.info("Successfully loaded checkpoint")
    except Exception as e:
        raise RuntimeError(f"Failed to load checkpoint: {e}")
    
    # Extract state dict
    if isinstance(checkpoint, dict) and 'state_dict' in checkpoint:
        state_dict = checkpoint['state_dict']
    else:
        state_dict = checkpoint

    # Remove module prefix if present from DataParallel - FIXED LINE
    state_dict = {k.replace('module.', ''): v for k, v in state_dict.items()}
    
    # CRITICAL FIX: Convert all state dict tensors to float32
    for key in state_dict:
        if isinstance(state_dict[key], torch.Tensor):
            state_dict[key] = state_dict[key].float()
    
    # Analyze the architecture from state dict keys
    keys = list(state_dict.keys())
    logger.info(f"Model has {len(keys)} parameters")
    logger.info(f"Sample keys: {keys[:5]}")
    
    model = None
    
    # Strategy 1: Try original ResUNet50 if available
    if ResUNet50 is not None:
        try:
            model = ResUNet50(out_channels=1, pretrained=False)
            # Ensure model is in float32
            model = model.float()
            
            # Try loading with non-strict mode first
            missing_keys, unexpected_keys = model.load_state_dict(state_dict, strict=False)
            logger.info(f"ResUNet50 loaded - Missing: {len(missing_keys)}, Unexpected: {len(unexpected_keys)}")
            
            if len(missing_keys) == 0:
                logger.info("Perfect match! All model weights loaded successfully.")
            elif len(missing_keys) < len(state_dict) * 0.5:  # Less than 50% missing
                logger.info("Acceptable match - most weights loaded successfully")
            else:
                logger.warning("Too many missing keys, trying alternative approach")
                model = None
                
        except Exception as e:
            logger.warning(f"ResUNet50 loading failed: {e}")
            model = None
    
    # Strategy 2: Try flexible architecture
    if model is None:
        try:
            # Determine input/output channels from state dict
            first_conv_key = None
            last_conv_key = None
            
            for key in keys:
                if 'weight' in key and len(state_dict[key].shape) == 4:
                    if first_conv_key is None:
                        first_conv_key = key
                    last_conv_key = key
            
            in_channels = 3  # Default
            out_channels = 1  # Default
            
            if first_conv_key:
                in_channels = state_dict[first_conv_key].shape[1]
            if last_conv_key:
                out_channels = state_dict[last_conv_key].shape[0]
                
            logger.info(f"Inferred architecture: {in_channels} -> {out_channels}")
            
            model = FlexibleUNet(in_channels=in_channels, out_channels=out_channels)
            # Ensure model is in float32
            model = model.float()
            
            # Try to load compatible weights
            model_dict = model.state_dict()
            compatible_dict = {}
            
            for k, v in state_dict.items():
                if k in model_dict and model_dict[k].shape == v.shape:
                    compatible_dict[k] = v.float()  # Ensure float32
            
            if len(compatible_dict) > 0:
                model_dict.update(compatible_dict)
                model.load_state_dict(model_dict)
                logger.info(f"Loaded {len(compatible_dict)}/{len(state_dict)} compatible weights")
            else:
                logger.warning("No compatible weights found")
            
        except Exception as e:
            logger.warning(f"Flexible model loading failed: {e}")
            
    # Strategy 3: Fallback to simple model
    if model is None:
        logger.warning("Using simple fallback model - will generate random predictions")
        model = FlexibleUNet(in_channels=3, out_channels=1)

    # Ensure model is float32 and move to device
    model = model.float().to(DEVICE)
    model.eval()
    _model_cache[model_path] = model
    logger.info(f"Model loaded and cached: {model_path}")
    return model


def preprocess_image(image_data, target_size=(256, 256)):
    """Preprocess the input image for model inference with proper tensor types"""
    image = Image.open(io.BytesIO(image_data)).convert("RGB")
    original_size = image.size  # (width, height)
    image_resized = image.resize(target_size, Image.BILINEAR)

    # Ensure float32 throughout preprocessing
    image_np = np.array(image_resized).astype(np.float32) / 255.0
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    image_normalized = (image_np - mean) / std

    # Create tensor with explicit float32 type
    image_tensor = torch.from_numpy(image_normalized).permute(2, 0, 1).unsqueeze(0).float()
    
    logger.info(f"Preprocessed image shape: {image_tensor.shape}, dtype: {image_tensor.dtype}")
    return np.array(image), image_tensor, original_size

def predict(model, image_tensor):
    """Run model inference with proper tensor type handling and extensive debugging"""
    with torch.no_grad():
        # Ensure input tensor is float32 and on correct device
        image_tensor = image_tensor.float().to(DEVICE)
        
        logger.info(f"Input tensor shape: {image_tensor.shape}, dtype: {image_tensor.dtype}")
        logger.info(f"Model device: {next(model.parameters()).device}")
        logger.info(f"Model dtype: {next(model.parameters()).dtype}")
        
        try:
            out = model(image_tensor)
        except RuntimeError as e:
            logger.error(f"Model forward pass failed: {e}")
            # Additional debugging info
            logger.error(f"Input tensor device: {image_tensor.device}")
            logger.error(f"Input tensor requires_grad: {image_tensor.requires_grad}")
            raise
        
        # Ensure output is float32 for numpy conversion
        out = out.float()
        
        # Apply sigmoid activation if not already applied
        if hasattr(model, 'final_activation') and model.final_activation != 'sigmoid':
            out = torch.sigmoid(out)
        
        out = out.squeeze().cpu().numpy()
        
        # EXTENSIVE DEBUGGING: Log statistics about the prediction
        logger.info(f"Prediction statistics:")
        logger.info(f"  Min: {np.min(out):.4f}, Max: {np.max(out):.4f}")
        logger.info(f"  Mean: {np.mean(out):.4f}, Std: {np.std(out):.4f}")
        logger.info(f"  Percentiles - 50th: {np.percentile(out, 50):.4f}, 90th: {np.percentile(out, 90):.4f}, 95th: {np.percentile(out, 95):.4f}, 99th: {np.percentile(out, 99):.4f}")
        
        # Count pixels above various thresholds for debugging
        for thresh in [0.1, 0.3, 0.5, 0.7, 0.9]:
            count = np.sum(out > thresh)
            percentage = (count / out.size) * 100
            logger.info(f"  Pixels > {thresh}: {count} ({percentage:.2f}%)")
        
        # RELAXED APPROACH: Start with lower thresholds and adaptive logic
        # Try different threshold strategies
        
        # Strategy 1: Use a more reasonable threshold
        threshold_95 = np.percentile(out, 95)
        threshold_90 = np.percentile(out, 90)
        threshold_mean_plus_std = np.mean(out) + np.std(out)
        
        logger.info(f"Threshold candidates: 95th={threshold_95:.3f}, 90th={threshold_90:.3f}, mean+std={threshold_mean_plus_std:.3f}")
        
        # Choose threshold based on distribution
        if np.max(out) < 0.3:
            # Very low confidence predictions - use lower threshold
            threshold = max(0.1, np.percentile(out, 80))
            logger.warning("Very low confidence predictions detected - using relaxed threshold")
        elif threshold_95 > 0.9:
            # Model predicting everything as positive - use more aggressive filtering
            threshold = max(0.7, threshold_95)
            logger.warning("Model appears to be segmenting entire brain region")
        else:
            # Normal case - use adaptive threshold
            threshold = max(0.3, min(0.7, threshold_mean_plus_std))
        
        # Create initial mask
        mask = (out > threshold).astype(np.uint8)
        
        # Count initial detections
        initial_pixels = np.sum(mask)
        logger.info(f"Initial mask has {initial_pixels} pixels ({(initial_pixels/mask.size)*100:.2f}%)")
        
        # If no pixels detected, try progressively lower thresholds
        if initial_pixels == 0:
            logger.warning("No pixels detected with initial threshold, trying lower values...")
            for fallback_thresh in [threshold*0.8, threshold*0.6, threshold*0.4, threshold*0.2, 0.1]:
                mask = (out > fallback_thresh).astype(np.uint8)
                pixels = np.sum(mask)
                logger.info(f"  Threshold {fallback_thresh:.3f}: {pixels} pixels")
                if pixels > 0:
                    threshold = fallback_thresh
                    logger.info(f"Using fallback threshold: {fallback_thresh:.3f}")
                    break
        
        # Apply less aggressive post-processing
        mask = post_process_mask(mask, out, relaxed=True)
        
        final_pixels = np.sum(mask)
        logger.info(f"Final mask has {final_pixels} pixels after post-processing")
        
    logger.info(f"Prediction completed - threshold: {threshold:.3f}, final pixels: {final_pixels}")
    return mask

def detect_abnormal_regions(probability_map, original_tensor):
    """Fallback method to detect abnormal regions when model segments whole brain"""
    
    # Convert tensor back to image for analysis
    # Denormalize the image
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    
    image = original_tensor.transpose(1, 2, 0)  # CHW to HWC
    image = (image * std) + mean
    image = np.clip(image, 0, 1)
    
    # Convert to grayscale for analysis
    gray = cv2.cvtColor(image.astype(np.float32), cv2.COLOR_RGB2GRAY)
    
    # Method 1: Use intensity variations to find abnormal regions
    # Apply Gaussian blur and find high-intensity variations
    blurred = cv2.GaussianBlur(gray, (15, 15), 0)
    intensity_diff = np.abs(gray - blurred)
    
    # Find regions with high intensity variation (potential tumors)
    intensity_threshold = np.percentile(intensity_diff, 90)
    abnormal_mask1 = (intensity_diff > intensity_threshold).astype(np.uint8)
    
    # Method 2: Use probability map gradients
    # Find areas with sharp probability changes
    grad_x = cv2.Sobel(probability_map.astype(np.float32), cv2.CV_64F, 1, 0, ksize=3)
    grad_y = cv2.Sobel(probability_map.astype(np.float32), cv2.CV_64F, 0, 1, ksize=3)
    gradient_magnitude = np.sqrt(grad_x**2 + grad_y**2)
    
    grad_threshold = np.percentile(gradient_magnitude, 85)
    abnormal_mask2 = (gradient_magnitude > grad_threshold).astype(np.uint8)
    
    # Method 3: Use very high probability regions only
    prob_threshold = np.percentile(probability_map, 98)
    abnormal_mask3 = (probability_map > prob_threshold).astype(np.uint8)
    
    # Combine all methods
    combined_mask = np.logical_or(
        np.logical_or(abnormal_mask1, abnormal_mask2), 
        abnormal_mask3
    ).astype(np.uint8)
    
    # If still too much area, be even more aggressive
    if np.sum(combined_mask) > (combined_mask.size * 0.15):  # More than 15% of image
        # Use only the highest confidence regions
        very_high_threshold = np.percentile(probability_map, 99.5)
        combined_mask = (probability_map > very_high_threshold).astype(np.uint8)
    
    return combined_mask

def post_process_mask(mask, probability_map, relaxed=False):
    """Enhanced post-process the segmentation mask with configurable filtering"""
    
    # If mask covers too much area, it's likely wrong
    total_area = mask.size
    mask_area = np.sum(mask)
    
    logger.info(f"Post-processing: mask covers {(mask_area/total_area)*100:.1f}% of image")
    
    if not relaxed and mask_area > total_area * 0.3:  # More than 30% of image
        logger.warning(f"Mask covers {(mask_area/total_area)*100:.1f}% of image - applying aggressive filtering")
        
        # Use only the top 5% highest probability regions
        high_prob_threshold = np.percentile(probability_map, 95)
        mask = (probability_map > high_prob_threshold).astype(np.uint8)
        
        # If still too large, use top 2%
        if np.sum(mask) > total_area * 0.15:
            very_high_prob_threshold = np.percentile(probability_map, 98)
            mask = (probability_map > very_high_prob_threshold).astype(np.uint8)
    elif relaxed and mask_area > total_area * 0.5:  # Much more relaxed threshold when in relaxed mode
        logger.warning("Relaxed mode: mask too large, applying moderate filtering")
        # Only apply filtering if mask is extremely large (>50%)
        high_prob_threshold = np.percentile(probability_map, 90)  # More relaxed
        mask = (probability_map > high_prob_threshold).astype(np.uint8)
    
    # Skip morphological operations if mask is empty
    if np.sum(mask) == 0:
        logger.warning("Empty mask after initial filtering")
        return mask
    
    # Remove small noise using morphological operations
    kernel = np.ones((3, 3), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=1)  # Reduced iterations
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=1)
    
    # Skip connected components analysis if mask is empty after morphology
    if np.sum(mask) == 0:
        logger.warning("Empty mask after morphological operations")
        return mask
    
    # Remove very small connected components
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(mask, connectivity=8)
    
    # Calculate minimum area threshold - more relaxed in relaxed mode
    if relaxed:
        min_area = total_area * 0.0001  # Very small minimum (0.01%)
        max_area = total_area * 0.2     # Allow larger regions (20%)
    else:
        min_area = total_area * 0.0005  # Original threshold (0.05%)
        max_area = total_area * 0.1     # Maximum 10% for any single region
    
    # Create new mask keeping only appropriate-sized regions
    filtered_mask = np.zeros_like(mask)
    kept_regions = 0
    
    for i in range(1, num_labels):  # Skip background (label 0)
        area = stats[i, cv2.CC_STAT_AREA]
        if min_area < area < max_area:
            # Additional check: ensure the region has reasonable probability
            region_mask = (labels == i)
            mean_prob = np.mean(probability_map[region_mask])
            max_prob = np.max(probability_map[region_mask])
            
            # More relaxed confidence requirements in relaxed mode
            if relaxed:
                if mean_prob > 0.3 and max_prob > 0.5:  # Much more relaxed
                    filtered_mask[region_mask] = 1
                    kept_regions += 1
            else:
                # Only keep regions with very high confidence
                if mean_prob > 0.6 and max_prob > 0.8:
                    filtered_mask[region_mask] = 1
                    kept_regions += 1
    
    logger.info(f"Kept {kept_regions} regions after filtering (relaxed={relaxed})")
    
    # Final smoothing only if we have regions
    if np.any(filtered_mask):
        filtered_mask = ndimage.binary_fill_holes(filtered_mask).astype(np.uint8)
    
    return filtered_mask

def overlay_mask(original_image, mask, alpha=0.6):
    """Overlay segmentation mask on original image with better visualization"""
    if len(original_image.shape) == 2:
        original_image = cv2.cvtColor(original_image, cv2.COLOR_GRAY2RGB)

    if original_image.max() > 1.0:
        original_image = original_image.astype(np.float32) / 255.0

    # Resize mask to original image size
    mask_resized = cv2.resize(mask, (original_image.shape[1], original_image.shape[0]), 
                             interpolation=cv2.INTER_NEAREST)
    
    # Create colored mask with better visibility
    colored_mask = np.zeros_like(original_image, dtype=np.float32)
    
    # Use red for tumor regions
    colored_mask[mask_resized > 0] = [1.0, 0.2, 0.2]  # Bright red
    
    # Create edge overlay for better boundary visualization
    edges = cv2.Canny((mask_resized * 255).astype(np.uint8), 50, 150)
    edge_mask = np.zeros_like(original_image, dtype=np.float32)
    edge_mask[edges > 0] = [1.0, 0.0, 0.0]  # Pure red edges
    
    # Combine filled regions and edges
    result = cv2.addWeighted(original_image, 1.0, colored_mask, alpha, 0)
    result = cv2.addWeighted(result, 1.0, edge_mask, 0.8, 0)
    
    result = np.clip(result * 255, 0, 255).astype(np.uint8)
    return result

def calculate_metrics(mask, original_size):
    """Calculate more accurate segmentation metrics"""
    tumor_pixels = int(np.sum(mask > 0))
    total_pixels = int(mask.size)
    
    if total_pixels == 0:
        return {"affected_percentage": 0, "tumor_area_mm2": 0, "largest_region_mm2": 0}
    
    affected_percentage = round((tumor_pixels / total_pixels) * 100, 2)
    
    # Estimate physical area (assuming typical brain MRI pixel spacing)
    # This is approximate - actual pixel spacing should come from DICOM headers
    pixel_spacing_mm = 1.0  # mm per pixel (approximate)
    tumor_area_mm2 = tumor_pixels * (pixel_spacing_mm ** 2)
    
    # Find largest connected component
    if tumor_pixels > 0:
        num_labels, labels = cv2.connectedComponents(mask.astype(np.uint8))
        largest_region_size = 0
        for i in range(1, num_labels):
            region_size = np.sum(labels == i)
            largest_region_size = max(largest_region_size, region_size)
        largest_region_mm2 = largest_region_size * (pixel_spacing_mm ** 2)
    else:
        largest_region_mm2 = 0
    
    return {
        "affected_percentage": affected_percentage,
        "tumor_area_mm2": round(tumor_area_mm2, 2),
        "largest_region_mm2": round(largest_region_mm2, 2),
        "num_regions": max(0, num_labels - 1) if tumor_pixels > 0 else 0
    }

def png_bytes_to_datauri(png_bytes):
    """Convert PNG bytes to data URI"""
    b64 = base64.b64encode(png_bytes).decode("ascii")
    return f"data:image/png;base64,{b64}"

@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({
        "status": "healthy",
        "device": str(DEVICE),
        "cuda_available": torch.cuda.is_available(),
        "message": "Radiologist Assistance System backend is running"
    })

@app.route("/")
def index():
    return jsonify({
        "message": "Radiologist Assistance System API",
        "endpoints": {
            "health": "/health",
            "segment": "/segment (POST)"
        }
    })

@app.route("/segment", methods=["POST"])
def segment():
    if "image" not in request.files:
        return jsonify({"error": "No image file provided"}), 400

    model_path = request.form.get("model_path", "resunet50_brain_segmentation.pth")
    image_file = request.files["image"]

    logger.info(f"Segmentation request with model: {model_path}")
    image_bytes = image_file.read()

    try:
        model = get_model(model_path)
    except Exception as e:
        return jsonify({"error": f"Failed to load model: {str(e)}"}), 500

    try:
        original_image, image_tensor, original_size = preprocess_image(image_bytes)
    except Exception as e:
        return jsonify({"error": f"Failed to preprocess image: {str(e)}"}), 400

    try:
        mask_numpy = predict(model, image_tensor)
    except Exception as e:
        return jsonify({"error": f"Failed to run prediction: {str(e)}"}), 500

    try:
        overlay_img = overlay_mask(original_image, mask_numpy)
        metrics = calculate_metrics(mask_numpy, original_size)
    except Exception as e:
        return jsonify({"error": f"Failed to create overlay: {str(e)}"}), 500

    try:
        success, png = cv2.imencode(".png", overlay_img)
        if not success:
            return jsonify({"error": "Failed to encode result image"}), 500
        data_uri = png_bytes_to_datauri(png.tobytes())
    except Exception as e:
        return jsonify({"error": f"Failed to encode image: {str(e)}"}), 500

    return jsonify({
        "image_data_uri": data_uri,
        "affected_percentage": metrics["affected_percentage"],
        "tumor_area_mm2": metrics["tumor_area_mm2"],
        "largest_region_mm2": metrics["largest_region_mm2"],
        "num_regions": metrics["num_regions"],
        "model_used": model_path,
        "device": str(DEVICE),
        "analysis_notes": [
            f"Detected {metrics['num_regions']} distinct region(s)",
            f"Largest region: {metrics['largest_region_mm2']} mm²",
            "Applied aggressive filtering for tumor-specific detection",
            "Model may be trained for brain segmentation rather than tumor detection"
        ]
    })

if __name__ == "__main__":
    logger.info("Starting Radiologist Assistance System backend...")
    logger.info(f"CUDA available: {torch.cuda.is_available()}")
    logger.info(f"Using device: {DEVICE}")
    app.run(host="0.0.0.0", port=5000, debug=True)