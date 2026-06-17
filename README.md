# PNG to OTBM

A small **browser-based** tool that turns a PNG into an **OTBM** (Open Tibia Binary Map) file. Each distinct color in the image becomes a **ground tile** using the **item ID** you assign—handy for sketching map layouts from pixel art or reference images.

## Requirements

- A modern desktop browser (Chrome, Firefox, Edge, Safari).
- No install, no build step, no backend. Everything runs locally in the page.

## Quick start

1. Clone or download this repository.
2. Open `index.html` in your browser (double-click or use a simple static file server if your browser blocks local file access for some features).
3. Click **Import PNG** (or drag and drop) and load your image.
4. For each detected color, enter the **Tibia item ID** that should represent that color on the map.
5. Pick the **client version** that matches your OTB/dat setup (this sets OTBM/OTB version fields used by editors like RME).
6. Adjust **Z level**, **offset X/Y**, and **transparent tile ID** if needed (`0` for transparent usually means “skip”).
7. Click **Generate** and save the `.otbm` file when prompted.

Then open the file in **[Remere’s Map Editor](https://github.com/karolak6612/remeres-map-editor-redux)** or your usual Tibia mapping workflow.

### Reverse: OTBM → PNG

Click **OTBM → PNG** (or drag and drop an `.otbm` file) to convert a map back into an image. Each tile becomes one pixel colored by its ground item ID. If the map spans several floors, the most populated floor is used. Item IDs already present in your current color list reuse their assigned color (so a PNG → OTBM → PNG round-trip preserves colors); any other IDs get a distinct generated color. The PNG downloads automatically and is loaded into the preview.

## What you get

| Input | Output |
|--------|--------|
| PNG (one color ≈ one tile type) | Single-floor OTBM aligned to image pixels |

The OTBM writer targets **OTBM version 2** and builds a map sized to your image (**width × height** tiles).

## Features (short list)

- **Color list** with search; **export / import** color→ID mappings as JSON for reuse across images.
- **Simplify colors** when the image has many unique colors (merges similar shades down to a target count; max **256** mappable colors).
- **Favorites** for item IDs you use often.
- **Preview** with zoom; optional **ignore size limits** if you accept slow or heavy maps (default limits help avoid huge images in the tab).

## Limits (defaults)

These protect the browser from freezing on accidental huge inputs:

- **Max dimension:** 5000 px per side.
- **Max pixels:** about 23.5M total.
- **Colors:** up to **256** after mapping/simplification; more than that requires simplification.

Use **Ignore size limits** only when you know your machine can handle it.

## Project layout

| File | Role |
|------|------|
| `index.html` | UI |
| `app.js` | Image handling, color detection, UI logic |
| `otbm-writer.js` | OTBM binary serialization |
| `otbm-reader.js` | OTBM binary parsing (OTBM → PNG) |
| `clients-data.js` | Client ↔ OTB version data (from RME-style `clients.xml` mappings) |
| `styles.css` | Styling |

## License

[MIT](LICENSE)

## Disclaimer

This tool is for **map authoring** with assets and clients you are allowed to use. Item IDs and map format details depend on your **client version** and **OTB**; always verify the result in your editor and in-game.