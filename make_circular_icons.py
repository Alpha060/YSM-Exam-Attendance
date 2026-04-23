from PIL import Image, ImageDraw


def crop_center_square(image, crop_ratio=0.8):
    width, height = image.size
    crop_size = int(min(width, height) * crop_ratio)
    left = (width - crop_size) // 2
    top = (height - crop_size) // 2
    return image.crop((left, top, left + crop_size, top + crop_size))


def make_circular_icon(
    input_path,
    output_path,
    size,
    fill_ratio=0.88,
    source_crop_ratio=0.8,
    border_ratio=0.03,
):
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)

    border_size = max(2, int(size * border_ratio))
    draw.ellipse(
        (
            border_size,
            border_size,
            size - border_size - 1,
            size - border_size - 1,
        ),
        fill=(255, 255, 255, 255),
    )

    with Image.open(input_path) as source:
        img = source.convert("RGBA")
        img = crop_center_square(img, crop_ratio=source_crop_ratio)

    target_size = max(1, int(size * fill_ratio))
    resize_ratio = min(target_size / img.width, target_size / img.height)
    resized_dimensions = (
        max(1, int(img.width * resize_ratio)),
        max(1, int(img.height * resize_ratio)),
    )
    img = img.resize(resized_dimensions, Image.Resampling.LANCZOS)

    x = (size - img.width) // 2
    y = (size - img.height) // 2

    canvas.alpha_composite(img, (x, y))
    canvas.save(output_path)


if __name__ == "__main__":
    make_circular_icon(
        "public/logo.png",
        "public/icons/icon-512x512.png",
        512,
        fill_ratio=0.78,
        source_crop_ratio=0.8,
        border_ratio=0.03,
    )
    make_circular_icon(
        "public/logo.png",
        "public/icons/icon-192x192.png",
        192,
        fill_ratio=0.78,
        source_crop_ratio=0.78,
        border_ratio=0.04,
    )
