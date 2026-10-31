# Name-only check: the first spoken word of each closing line, transcribed as English.
import glob, subprocess
import numpy as np
import imageio_ffmpeg
from faster_whisper import WhisperModel

FF = imageio_ffmpeg.get_ffmpeg_exe()
model = WhisperModel('large-v3-turbo', device='cpu', compute_type='int8')
for path in ['out/avri_l5n.mp3', 'out/avri_l5.mp3', 'out2/l5_v1.mp3', 'out/avri_l3n.mp3']:
    raw = subprocess.run([FF, '-v', 'error', '-i', path, '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    a = np.frombuffer(raw, np.float32)
    name = a[int(0.15 * 16000):int(1.15 * 16000)]
    for lang in ('en', None):
        segs, info = model.transcribe(name, language=lang, beam_size=5)
        print(path, lang or f'auto({info.language})', '|', ' '.join(s.text.strip() for s in segs), flush=True)
