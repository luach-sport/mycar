# Transcribes every clip back to text so the pronunciation can be checked without listening.
import glob, traceback
from faster_whisper import WhisperModel

model = None
for name in ('ivrit-ai/whisper-large-v3-turbo-ct2', 'large-v3-turbo', 'medium'):
    try:
        model = WhisperModel(name, device='cpu', compute_type='int8')
        print('model:', name, flush=True)
        break
    except Exception:
        traceback.print_exc()
for path in sorted(glob.glob('out/*.mp3')):
    segs, info = model.transcribe(path, language='he', beam_size=5)
    print(path, '|', ' '.join(s.text.strip() for s in segs), flush=True)
