#!/usr/bin/env python3
"""
Icon Generator for ACE (Agent Command Engine)
Converts logo.png to .ico (Windows) and .icns (Mac) formats
"""

import os
import sys
from PIL import Image

# Icon sizes needed
# Windows ICO: 16, 24, 32, 48, 64, 128, 256
# Mac ICNS: 16, 32, 64, 128, 256, 512, 1024
ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]
ICNS_SIZES = [16, 32, 64, 128, 256, 512, 1024]

def create_ico(input_path, output_path):
    """Create Windows .ico file"""
    print(f"Creating Windows icon: {output_path}")

    img = Image.open(input_path)

    # Create resized versions
    icon_sizes = [(size, size) for size in ICO_SIZES]
    img.save(output_path, format='ICO', sizes=icon_sizes)

    print(f"✓ Created {output_path}")

def create_png_set(input_path, output_dir):
    """Create PNG set for Mac .icns (requires iconutil on Mac)"""
    print(f"Creating PNG set for Mac icon in: {output_dir}")

    img = Image.open(input_path)

    os.makedirs(output_dir, exist_ok=True)

    # Create all required sizes
    for size in ICNS_SIZES:
        # Standard resolution
        resized = img.resize((size, size), Image.Resampling.LANCZOS)
        filename = f"icon_{size}x{size}.png"
        resized.save(os.path.join(output_dir, filename))
        print(f"  ✓ {filename}")

        # Retina (@2x) for sizes that need it
        if size <= 512:
            retina_size = size * 2
            if retina_size <= 1024:
                resized_2x = img.resize((retina_size, retina_size), Image.Resampling.LANCZOS)
                filename_2x = f"icon_{size}x{size}@2x.png"
                resized_2x.save(os.path.join(output_dir, filename_2x))
                print(f"  ✓ {filename_2x}")

    print(f"✓ PNG set created in {output_dir}")
    print("\nTo create .icns on Mac, run:")
    print(f"  iconutil -c icns {output_dir}")

def main():
    # Paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)

    input_logo = os.path.join(project_root, "assets", "images", "logo.png")

    # Output paths
    build_dir = os.path.join(project_root, "build")
    os.makedirs(build_dir, exist_ok=True)

    output_ico = os.path.join(build_dir, "icon.ico")
    iconset_dir = os.path.join(build_dir, "icon.iconset")

    # Check input exists
    if not os.path.exists(input_logo):
        print(f"Error: Logo not found at {input_logo}")
        sys.exit(1)

    print(f"Input: {input_logo}")
    print(f"Output directory: {build_dir}\n")

    # Create icons
    create_ico(input_logo, output_ico)
    print()
    create_png_set(input_logo, iconset_dir)

    print("\n✓ All icons created successfully!")
    print(f"\nWindows icon: {output_ico}")
    print(f"Mac iconset: {iconset_dir}")
    print("\nNote: .icns creation requires macOS iconutil command.")
    print("The PNG set has been created and can be converted on Mac.")

if __name__ == "__main__":
    main()
