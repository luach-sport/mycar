# Same two lines with the app name spelled several ways, to find the one pronounced clearly as "מאי קאר".
import asyncio, os
import edge_tts

NAMES = {'v1': 'מאי קאר', 'v2': 'מַאי קָאר', 'v3': 'My Car', 'v4': 'מאי-קאר', 'v5': 'מָאִי קָאר', 'v6': 'מאיי קאר'}
LINES = {'l3': '{n} מחשבת לך את זה. עד האגורה האחרונה.',
         'l5': '{n}. עד הטיפה האחרונה. כל ההסבר וההורדה, בקישור.'}
os.makedirs('out2', exist_ok=True)

async def main():
    for vk, name in NAMES.items():
        for lk, text in LINES.items():
            await edge_tts.Communicate(text.format(n=name), 'he-IL-AvriNeural', rate='-10%', pitch='-4Hz').save(f'out2/{lk}_{vk}.mp3')

asyncio.run(main())
