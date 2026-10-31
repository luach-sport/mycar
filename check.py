# Transcribes the narration back to text so the pronunciation can be checked without listening.
import glob, wave
import numpy as np
from faster_whisper import WhisperModel

model = WhisperModel('ivrit-ai/whisper-large-v3-turbo-ct2', device='cpu', compute_type='int8')
for path in sorted(glob.glob('wav16/*.wav')):
    with wave.open(path) as w:
        audio = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
    segs, info = model.transcribe(audio, language='he', beam_size=5)
    print(path, '|', ' '.join(s.text.strip() for s in segs), flush=True)
