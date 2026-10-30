# Transcribes every clip back to text so the pronunciation can be checked without listening.
import glob
from faster_whisper import WhisperModel

model = WhisperModel('ivrit-ai/whisper-large-v3-turbo-ct2', device='cpu', compute_type='int8')
for path in sorted(glob.glob('out/*.mp3')):
    segs, info = model.transcribe(path, language='he', beam_size=5)
    print(path, f'{info.duration:.2f}s', '|', ' '.join(s.text.strip() for s in segs))
