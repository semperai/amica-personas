FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    wget \
    ffmpeg \
    espeak-ng \
    && rm -rf /var/lib/apt/lists/*

# Clone AllTalk TTS
RUN git clone https://github.com/erew123/alltalk_tts.git .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Download default model
RUN python -c "from TTS.api import TTS; TTS('tts_models/multilingual/multi-dataset/xtts_v2')"

# Expose port
EXPOSE 7851

# Start the server
CMD ["python", "server.py", "--host", "0.0.0.0", "--port", "7851"]
