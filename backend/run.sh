#!/bin/bash

# Setup script for the Flask backend

echo "Setting up Radiologist Assistance System Backend..."

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install requirements
echo "Installing requirements..."
pip install -r requirements.txt

# Test the model
echo "Testing model..."
python model.py

# Start the Flask server
echo "Starting Flask server..."
python app.py
