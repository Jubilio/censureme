from PIL import Image
import os

source_path = "icons/icon.png"
sizes = [16, 48, 128]

if os.path.exists(source_path):
    img = Image.open(source_path)
    for size in sizes:
        resized_img = img.resize((size, size), Image.Resampling.LANCZOS)
        resized_img.save(f"icons/icon{size}.png")
        print(f"Resized to {size}x{size}")
else:
    print("Source icon not found")
