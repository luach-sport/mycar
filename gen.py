# Generates each narration line in two Hebrew voices, slow and low for a trailer feel.
import asyncio, json, os
import edge_tts

LINES = json.load(open('lines.json', encoding='utf-8'))
VOICES = {'avri': 'he-IL-AvriNeural', 'hila': 'he-IL-HilaNeural'}
os.makedirs('out', exist_ok=True)

async def main():
    for vk, voice in VOICES.items():
        for key, text in LINES.items():
            await edge_tts.Communicate(text, voice, rate='-10%', pitch='-4Hz').save(f'out/{vk}_{key}.mp3')
            print('made', vk, key)

asyncio.run(main())
