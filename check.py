# Transcribes the name variants back to text to find the clearest spelling.
import glob, subprocess
import numpy as np
import imageio_ffmpeg
from faster_whisper import WhisperModel

FF = imageio_ffmpeg.get_ffmpeg_exe()
model = WhisperModel('ivrit-ai/whisper-large-v3-turbo-ct2', device='cpu', compute_type='int8')
for path in sorted(glob.glob('out2/*.mp3')):
    raw = subprocess.run([FF, '-v', 'error', '-i', path, '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    segs, _ = model.transcribe(np.frombuffer(raw, np.float32), language='he', beam_size=5)
    print(path, '|', ' '.join(s.text.strip() for s in segs), flush=True)
