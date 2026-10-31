# Transcribes the narration clips back to text so the pronunciation can be checked without listening.
import glob, subprocess
import numpy as np
from faster_whisper import WhisperModel

model = WhisperModel('ivrit-ai/whisper-large-v3-turbo-ct2', device='cpu', compute_type='int8')
for path in sorted(glob.glob('out/avri_*.mp3')):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    audio = np.frombuffer(raw, np.float32)
    segs, info = model.transcribe(audio, language='he', beam_size=5)
    print(path, '|', ' '.join(s.text.strip() for s in segs), flush=True)
