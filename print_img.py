import sys
from PIL import Image

img = Image.open('screenshot.png')
img = img.resize((80, 40))
pixels = img.convert('L').load()
chars = " .:-=+*#%@"
for y in range(40):
    line = ""
    for x in range(80):
        val = pixels[x, y]
        line += chars[val * len(chars) // 256]
    print(line)
