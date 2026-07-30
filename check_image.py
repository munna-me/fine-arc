
from PIL import Image
import os

logo_path = r"c:\Users\User\.gemini\antigravity\scratch\numerical-methods-solver\frontend\public\logo.png"

if os.path.exists(logo_path):
    print(f"File exists! Size: {os.path.getsize(logo_path)} bytes")
    try:
        with Image.open(logo_path) as img:
            print(f"Image is valid! Size: {img.width} x {img.height}, Mode: {img.mode}")
    except Exception as e:
        print(f"Error opening image: {e}")
else:
    print("File does NOT exist!")
