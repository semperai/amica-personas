FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    wget \
    ffmpeg \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

# Clone RVC-WebUI
RUN git clone https://github.com/ddPn08/rvc-webui.git .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Create necessary directories
RUN mkdir -p assets/weights logs

# Expose port
EXPOSE 7865

# Start the server
CMD ["python", "app.py", "--listen", "0.0.0.0", "--port", "7865"]
