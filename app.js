/**
 * PNG to OTBM Converter - Main Application
 * 
 * Handles image loading, color detection, and OTBM generation.
 */

const RECOMMENDED_MAX_COLORS = 30;
const HARD_MAX_COLORS = 256;
const KMEANS_SAMPLE_SIZE = 8000;
const KMEANS_ITERATIONS = 12;

class PNGToOTBMApp {
	constructor() {
		// State
		this.image = null;
		this.imageData = null;
		this.colorMappings = new Map(); // color hex -> { color, tileId, count }
		this.transparentPixelCount = 0; // Count of transparent pixels
		this.imageExceedsLimits = false; // Image exceeds recommended pixel/dimension limits
		this.uniqueColorCount = 0; // Unique opaque colors in current image
		this.requiresSimplify = false; // More colors than HARD_MAX_COLORS
		this.filteredColors = null; // Filtered color list for search
		this.zoomLevel = 1.0; // Current zoom level (1.0 = 100%)
		this.minZoom = 0.1; // Minimum zoom (10%)
		this.maxZoom = 20.0; // Maximum zoom (2000%)
		this.favorites = []; // Array of { id, name } favorite items
		
		// DOM Elements
		this.fileInput = document.getElementById('fileInput');
		this.otbmFileInput = document.getElementById('otbmFileInput');
		this.importBtn = document.getElementById('importBtn');
		this.importOtbmBtn = document.getElementById('importOtbmBtn');
		this.previewCanvas = document.getElementById('previewCanvas');
		this.previewContainer = document.getElementById('previewContainer');
		this.previewPlaceholder = document.getElementById('previewPlaceholder');
		this.imageInfo = document.getElementById('imageInfo');
		this.colorList = document.getElementById('colorList');
		this.colorCount = document.getElementById('colorCount');
		this.emptyState = document.getElementById('emptyState');
		this.generateBtn = document.getElementById('generateBtn');
		this.ignoreSizeLimits = document.getElementById('ignoreSizeLimits');
		this.flipHorizontal = document.getElementById('flipHorizontal');
		this.flipVertical = document.getElementById('flipVertical');
		this.status = document.getElementById('status');
		this.clientVersion = document.getElementById('clientVersion');
		this.transparentTileId = document.getElementById('transparentTileId');
		this.zLevel = document.getElementById('zLevel');
		this.offsetX = document.getElementById('offsetX');
		this.offsetY = document.getElementById('offsetY');
		this.colorSearch = document.getElementById('colorSearch');
		this.exportMappingsBtn = document.getElementById('exportMappingsBtn');
		this.importMappingsBtn = document.getElementById('importMappingsBtn');
		this.progressContainer = document.getElementById('progressContainer');
		this.progressFill = document.getElementById('progressFill');
		this.progressText = document.getElementById('progressText');
		this.zoomInBtn = document.getElementById('zoomInBtn');
		this.zoomOutBtn = document.getElementById('zoomOutBtn');
		this.zoomFitBtn = document.getElementById('zoomFitBtn');
		this.zoomLevelDisplay = document.getElementById('zoomLevel');
		this.mapScale = document.getElementById('mapScale');
		this.mapScaleHint = document.getElementById('mapScaleHint');
		this.pixelInfo = document.getElementById('pixelInfo');
		this.addFavoriteBtn = document.getElementById('addFavoriteBtn');
		this.favoritesList = document.getElementById('favoritesList');
		this.favoritesEmptyState = document.getElementById('favoritesEmptyState');
		this.simplifySection = document.getElementById('simplifySection');
		this.simplifyHint = document.getElementById('simplifyHint');
		this.targetColorCount = document.getElementById('targetColorCount');
		this.simplifyColorsBtn = document.getElementById('simplifyColorsBtn');
		
		// Canvas context
		this.ctx = this.previewCanvas.getContext('2d');
		
		// Initialize
		this._populateClientVersions();
		this._loadSettings();
		this._loadFavorites();
		this._bindEvents();
	}
	
	/**
	 * Populate the client version dropdown
	 */
	_populateClientVersions() {
		if (!CLIENT_DATA || !CLIENT_DATA.clients) {
			console.error('CLIENT_DATA not available');
			return;
		}
		
		// Clear existing options
		this.clientVersion.innerHTML = '';
		
		// Add options for each client
		const defaultClient = getDefaultClient();
		CLIENT_DATA.clients.forEach(client => {
			const option = document.createElement('option');
			option.value = client.name;
			option.textContent = client.name;
			if (client.name === defaultClient) {
				option.selected = true;
			}
			this.clientVersion.appendChild(option);
		});
	}
	
	/**
	 * Get the current client configuration
	 */
	_getCurrentClientConfig() {
		const selectedClient = this.clientVersion.value;
		return getClientConfig(selectedClient);
	}
	
	/**
	 * Bind all event listeners
	 */
	_bindEvents() {
		// Import button
		this.importBtn.addEventListener('click', () => this.fileInput.click());
		
		// File input change
		this.fileInput.addEventListener('change', (e) => this._handleFileSelect(e));

		// OTBM → PNG (inverse conversion)
		this.importOtbmBtn.addEventListener('click', () => this.otbmFileInput.click());
		this.otbmFileInput.addEventListener('change', (e) => this._handleOTBMSelect(e));
		
		// Drag and drop
		this.previewContainer.addEventListener('dragover', (e) => {
			e.preventDefault();
			this.previewContainer.classList.add('drag-over');
		});
		
		this.previewContainer.addEventListener('dragleave', () => {
			this.previewContainer.classList.remove('drag-over');
		});
		
		this.previewContainer.addEventListener('drop', (e) => {
			e.preventDefault();
			this.previewContainer.classList.remove('drag-over');
			
			const file = e.dataTransfer.files[0];
			if (!file) return;
			if (file.type.startsWith('image/')) {
				this._loadImage(file);
			} else if (file.name.toLowerCase().endsWith('.otbm')) {
				this._loadOTBM(file);
			}
		});
		
		// Generate button
		this.generateBtn.addEventListener('click', () => this._generateOTBM());
		this.ignoreSizeLimits.addEventListener('change', () => this._updateGenerateButtonState());
		this.flipHorizontal.addEventListener('change', () => this._saveSettings());
		this.flipVertical.addEventListener('change', () => this._saveSettings());
		this.simplifyColorsBtn.addEventListener('click', () => this._handleSimplifyColors());
		this.targetColorCount.addEventListener('change', () => this._saveSettings());
		
		// Color search
		this.colorSearch.addEventListener('input', () => this._filterColors());
		
		// Export/Import mappings
		this.exportMappingsBtn.addEventListener('click', () => this._exportMappings());
		this.importMappingsBtn.addEventListener('click', () => this._importMappings());
		
		// Favorites
		this.addFavoriteBtn.addEventListener('click', () => this._showAddFavoriteDialog());
		
		// Settings change handlers (for localStorage)
		this.clientVersion.addEventListener('change', () => this._saveSettings());
		this.transparentTileId.addEventListener('change', () => this._saveSettings());
		this.zLevel.addEventListener('change', () => this._saveSettings());
		this.offsetX.addEventListener('change', () => this._saveSettings());
		this.offsetY.addEventListener('change', () => this._saveSettings());
		
		// Keyboard shortcuts
		document.addEventListener('keydown', (e) => this._handleKeyboard(e));
		
		// Zoom controls
		this.zoomInBtn.addEventListener('click', () => this._zoomIn());
		this.zoomOutBtn.addEventListener('click', () => this._zoomOut());
		this.zoomFitBtn.addEventListener('click', () => this._zoomFit());

		// Map scale (downsizes the output map without altering the image)
		this.mapScale.addEventListener('input', () => this._onMapScaleChange());
		this.mapScale.addEventListener('change', () => {
			this._onMapScaleChange();
			this._saveSettings();
		});
		
		// Mouse wheel zoom (scroll up/down to zoom)
		this.previewContainer.addEventListener('wheel', (e) => {
			if (this.image) {
				e.preventDefault();
				// Scroll up = zoom in, scroll down = zoom out
				if (e.deltaY < 0) {
					this._zoomIn();
				} else if (e.deltaY > 0) {
					this._zoomOut();
				}
			}
		}, { passive: false });
		
		// Pixel hover detection
		this.previewCanvas.addEventListener('mousemove', (e) => this._handlePixelHover(e));
		this.previewCanvas.addEventListener('mouseleave', () => {
			this.pixelInfo.style.display = 'none';
		});
		
		// Pixel click to highlight in color list
		this.previewCanvas.addEventListener('click', (e) => this._handlePixelClick(e));
		
		// Window resize
		window.addEventListener('resize', () => {
			if (this.image) {
				this._updatePreview();
			}
		});
	}
	
	/**
	 * Handle file selection
	 */
	_handleFileSelect(event) {
		const file = event.target.files[0];
		if (file) {
			this._loadImage(file);
		}
	}
	
	/**
	 * Load an image file
	 */
	_loadImage(file) {
		const reader = new FileReader();
		
		reader.onload = (e) => {
			const img = new Image();
			
			img.onload = () => {
				this.image = img;
				// Evaluate limits against the scaled output, not the raw image
				const { width: outW, height: outH } = this._getOutputDimensions();
				const complexityCheck = this._checkImageComplexity(outW, outH);
				this.imageExceedsLimits = !complexityCheck.valid;

				const containerRect = this.previewContainer.getBoundingClientRect();
				const maxWidth = containerRect.width - 32;
				const maxHeight = containerRect.height - 32;
				const fitScale = Math.min(
					maxWidth / img.width,
					maxHeight / img.height,
					1.0
				);
				this.zoomLevel = Math.max(fitScale, this.minZoom);
				this._updatePreview();
				const colorAnalysisResult = this._analyzeColors();
				if (colorAnalysisResult?.success || colorAnalysisResult?.tooManyColors) {
					if (this.imageExceedsLimits) {
						this._updateStatus(
							`${complexityCheck.error} Lower "Map scale" or enable "Ignore size limits" to generate.`,
							'warning'
						);
					} else {
						this._updateStatus(`Loaded: ${file.name}`, 'success');
					}
				}
			};
			
			img.onerror = () => {
				this._updateStatus('Failed to load image', 'error');
			};
			
			img.src = e.target.result;
		};
		
		reader.readAsDataURL(file);
	}
	
	/**
	 * Handle OTBM file selection from the hidden file input
	 */
	_handleOTBMSelect(event) {
		const file = event.target.files[0];
		if (file) {
			this._loadOTBM(file);
		}
		// Reset so selecting the same file again re-triggers the change event
		event.target.value = '';
	}

	/**
	 * Load an OTBM file, convert it to a PNG, render it in the preview, and
	 * trigger a download. This is the inverse of OTBM generation: each tile
	 * becomes one pixel, colored by its ground item ID.
	 */
	_loadOTBM(file) {
		this._updateStatus(`Reading ${file.name}...`, '');

		const reader = new FileReader();
		reader.onload = (e) => {
			try {
				const mapData = new OTBMReader(e.target.result).parse();

				if (!mapData.tiles.length) {
					this._updateStatus('No tiles found in OTBM file', 'error');
					return;
				}

				const { canvas, info } = this._otbmToCanvas(mapData);

				// Download the PNG
				const baseName = file.name.replace(/\.otbm$/i, '') || 'map';
				canvas.toBlob((blob) => {
					if (!blob) {
						this._updateStatus('Failed to encode PNG', 'error');
						return;
					}
					const url = URL.createObjectURL(blob);
					const a = document.createElement('a');
					a.href = url;
					a.download = `${baseName}.png`;
					document.body.appendChild(a);
					a.click();
					document.body.removeChild(a);
					URL.revokeObjectURL(url);
				}, 'image/png');

				// Load the result into the app as the current image so the user
				// can inspect it and (re)generate if desired.
				this._applyCanvasAsImage(canvas).then(() => {
					this._zoomFit();
					this._analyzeColors();
					this._updateStatus(
						`✓ Converted ${file.name} → PNG (${info.width} × ${info.height}, ` +
						`${info.tileCount.toLocaleString()} tiles, floor z=${info.z}, ` +
						`${info.uniqueIds} unique IDs)`,
						'success'
					);
				});
			} catch (error) {
				this._updateStatus(`Failed to read OTBM: ${error.message}`, 'error');
				console.error('OTBM read error:', error);
			}
		};
		reader.onerror = () => this._updateStatus('Failed to read OTBM file', 'error');
		reader.readAsArrayBuffer(file);
	}

	/**
	 * Render parsed OTBM map data onto a canvas, one pixel per tile.
	 *
	 * The map may span several floors (z). A 2D PNG can only show one, so we
	 * pick the floor with the most tiles. Each ground item ID is mapped to a
	 * color: known IDs reuse the current color mappings (so a PNG→OTBM→PNG
	 * round-trip preserves colors), and unknown IDs get a stable generated color.
	 *
	 * @returns {{ canvas: HTMLCanvasElement, info: Object }}
	 */
	_otbmToCanvas(mapData) {
		// Choose the most populated floor.
		const tilesByZ = new Map();
		for (const tile of mapData.tiles) {
			if (!tilesByZ.has(tile.z)) tilesByZ.set(tile.z, []);
			tilesByZ.get(tile.z).push(tile);
		}
		let z = 0;
		let tiles = [];
		for (const [floor, floorTiles] of tilesByZ) {
			if (floorTiles.length > tiles.length) {
				tiles = floorTiles;
				z = floor;
			}
		}

		// Bounding box of the chosen floor (produces a tight PNG).
		let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
		for (const tile of tiles) {
			if (tile.x < minX) minX = tile.x;
			if (tile.y < minY) minY = tile.y;
			if (tile.x > maxX) maxX = tile.x;
			if (tile.y > maxY) maxY = tile.y;
		}
		const width = maxX - minX + 1;
		const height = maxY - minY + 1;

		// Build an ID → color lookup. Reuse existing assignments where possible.
		const idToColor = this._buildIdColorLookup(tiles);

		const canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;
		const ctx = canvas.getContext('2d');
		const imageData = ctx.createImageData(width, height);
		const px = imageData.data;
		// Tiles default to transparent; only painted tiles become opaque pixels.

		const uniqueIds = new Set();
		for (const tile of tiles) {
			uniqueIds.add(tile.groundId);
			const color = idToColor.get(tile.groundId);
			const idx = ((tile.y - minY) * width + (tile.x - minX)) * 4;
			px[idx] = color.r;
			px[idx + 1] = color.g;
			px[idx + 2] = color.b;
			px[idx + 3] = 255;
		}

		ctx.putImageData(imageData, 0, 0);

		return {
			canvas,
			info: { width, height, z, tileCount: tiles.length, uniqueIds: uniqueIds.size }
		};
	}

	/**
	 * Map each ground item ID present in the tiles to a color.
	 *
	 * The IDs are ranked by how many tiles use them. The four most common get
	 * fixed colors so the dominant terrain is easy to read at a glance:
	 *   1st → blue, 2nd → green, 3rd → grey, 4th → red.
	 * Every remaining ID gets a deterministic, visually distinct generated color.
	 */
	_buildIdColorLookup(tiles) {
		// Count how many tiles use each ground ID.
		const counts = new Map();
		for (const tile of tiles) {
			counts.set(tile.groundId, (counts.get(tile.groundId) || 0) + 1);
		}

		// Rank by frequency (most common first). Ties break by ID for stability.
		const rankedIds = [...counts.entries()]
			.sort((a, b) => b[1] - a[1] || a[0] - b[0])
			.map(([id]) => id);

		// Fixed colors for the top four, in rank order.
		const topColors = [
			{ r: 0, g: 0, b: 255 },     // 1st — blue
			{ r: 0, g: 255, b: 0 },     // 2nd — green
			{ r: 128, g: 128, b: 128 }, // 3rd — grey
			{ r: 255, g: 0, b: 0 }      // 4th — red
		];

		const idToColor = new Map();
		rankedIds.forEach((id, rank) => {
			idToColor.set(
				id,
				rank < topColors.length ? topColors[rank] : this._generateColor(rank - topColors.length)
			);
		});

		return idToColor;
	}

	/**
	 * Generate a deterministic, visually distinct RGB color for an index using
	 * the golden-ratio hue spacing so consecutive IDs look different.
	 */
	_generateColor(index) {
		const hue = (index * 137.508) % 360; // golden angle
		return this._hslToRgb(hue, 0.65, 0.55);
	}

	/**
	 * Convert HSL (h in degrees, s/l in 0..1) to an {r,g,b} object (0..255).
	 */
	_hslToRgb(h, s, l) {
		const c = (1 - Math.abs(2 * l - 1)) * s;
		const hp = h / 60;
		const x = c * (1 - Math.abs((hp % 2) - 1));
		let r = 0, g = 0, b = 0;
		if (hp < 1) { r = c; g = x; }
		else if (hp < 2) { r = x; g = c; }
		else if (hp < 3) { g = c; b = x; }
		else if (hp < 4) { g = x; b = c; }
		else if (hp < 5) { r = x; b = c; }
		else { r = c; b = x; }
		const m = l - c / 2;
		return {
			r: Math.round((r + m) * 255),
			g: Math.round((g + m) * 255),
			b: Math.round((b + m) * 255)
		};
	}

	/**
	 * Replace the working image with the contents of a canvas (used by the
	 * OTBM → PNG conversion). Resolves once the new image is ready.
	 */
	_applyCanvasAsImage(canvas) {
		return new Promise((resolve, reject) => {
			const dataUrl = canvas.toDataURL('image/png');
			const img = new Image();
			img.onload = () => {
				this.image = img;
				this.imageExceedsLimits = !this._checkImageComplexity(img.width, img.height).valid;
				this._updatePreview();
				resolve();
			};
			img.onerror = () => reject(new Error('Failed to load converted image'));
			img.src = dataUrl;
		});
	}

	/**
	 * Check if image is too complex to process
	 * @param {number} width - Image width in pixels
	 * @param {number} height - Image height in pixels
	 * @returns {Object} { valid: boolean, error: string }
	 */
	_checkImageComplexity(width, height) {
		const MAX_DIMENSION = 5000; // Maximum width or height
		const MAX_TOTAL_PIXELS = 23500000; // 4500 × 3000 = 13,500,000 pixels - this was tested and it works fine
		const totalPixels = width * height;
		
		// Check dimensions
		if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
			return {
				valid: false,
				error: `Image too large: ${width} × ${height} px. Maximum dimension: ${MAX_DIMENSION} px. Please reduce the image size.`
			};
		}
		
		// Check total pixel count
		if (totalPixels > MAX_TOTAL_PIXELS) {
			return {
				valid: false,
				error: `Image too complex: ${totalPixels.toLocaleString()} pixels. Maximum: ${MAX_TOTAL_PIXELS.toLocaleString()} pixels (${MAX_DIMENSION} × ${MAX_DIMENSION}). Please reduce the image size.`
			};
		}
		
		return { valid: true, error: null };
	}
	
	/**
	 * Update the preview canvas
	 */
	_updatePreview() {
		if (!this.image) return;
		
		// Hide placeholder, show canvas
		this.previewPlaceholder.style.display = 'none';
		this.previewCanvas.classList.add('visible');
		
		// Calculate display size based on zoom
		const displayWidth = Math.floor(this.image.width * this.zoomLevel);
		const displayHeight = Math.floor(this.image.height * this.zoomLevel);
		
		// Set canvas size
		this.previewCanvas.width = displayWidth;
		this.previewCanvas.height = displayHeight;
		
		// Disable image smoothing for pixel-perfect rendering
		this.ctx.imageSmoothingEnabled = false;
		
		// Draw image
		this.ctx.drawImage(this.image, 0, 0, displayWidth, displayHeight);
		
		// Update info
		this.imageInfo.textContent = `${this.image.width} × ${this.image.height} px`;
		
		// Update zoom level display
		this._updateZoomDisplay();

		// Update map scale hint
		this._updateMapScaleHint();
	}

	/**
	 * Read and clamp the map scale percentage from the input
	 */
	_getMapScale() {
		let scale = parseFloat(this.mapScale.value);
		if (!Number.isFinite(scale)) scale = 100;
		return Math.max(1, Math.min(100, scale));
	}

	/**
	 * Compute the output map dimensions after applying the map scale.
	 * The source image is never modified — only the tile grid is downsampled.
	 */
	_getOutputDimensions() {
		const scale = this._getMapScale();
		const width = Math.max(1, Math.round(this.image.width * scale / 100));
		const height = Math.max(1, Math.round(this.image.height * scale / 100));
		return { width, height, scale };
	}

	/**
	 * Show the resulting map size (in tiles) for the current scale, and warn
	 * if it still exceeds the limits.
	 */
	_updateMapScaleHint() {
		if (!this.mapScaleHint) return;

		if (!this.image) {
			this.mapScaleHint.textContent = '';
			return;
		}

		const { width, height, scale } = this._getOutputDimensions();
		if (scale >= 100) {
			this.mapScaleHint.textContent = `Map: ${width} × ${height} tiles (full size)`;
		} else {
			this.mapScaleHint.textContent = `Map: ${width} × ${height} tiles (${this.image.width} × ${this.image.height} at ${scale}%)`;
		}
	}

	/**
	 * Re-evaluate size limits against the scaled output and refresh UI.
	 */
	_onMapScaleChange() {
		if (this.image) {
			const { width, height } = this._getOutputDimensions();
			this.imageExceedsLimits = !this._checkImageComplexity(width, height).valid;
		}
		this._updateMapScaleHint();
		this._updateGenerateButtonState();
	}
	
	/**
	 * Zoom in
	 */
	_zoomIn() {
		if (!this.image) return;
		// Allow zooming up to maxZoom regardless of container size
		const newZoom = this.zoomLevel * 1.2;
		this.zoomLevel = Math.min(newZoom, this.maxZoom);
		this._updatePreview();
	}
	
	/**
	 * Zoom out
	 */
	_zoomOut() {
		if (!this.image) return;
		// Allow zooming down to minZoom regardless of container size
		const newZoom = this.zoomLevel / 1.2;
		this.zoomLevel = Math.max(newZoom, this.minZoom);
		this._updatePreview();
	}
	
	/**
	 * Fit image to container
	 */
	_zoomFit() {
		if (!this.image) return;
		const containerRect = this.previewContainer.getBoundingClientRect();
		const maxWidth = containerRect.width - 32;
		const maxHeight = containerRect.height - 32;
		const fitScale = Math.min(
			maxWidth / this.image.width,
			maxHeight / this.image.height
		);
		this.zoomLevel = Math.max(Math.min(fitScale, 1.0), this.minZoom); // Don't zoom in beyond 100% when fitting, but ensure at least minZoom
		this._updatePreview();
	}
	
	/**
	 * Update zoom level display
	 */
	_updateZoomDisplay() {
		if (this.zoomLevelDisplay) {
			this.zoomLevelDisplay.textContent = `${Math.round(this.zoomLevel * 100)}%`;
		}
	}
	
	/**
	 * Handle pixel hover to show color and ID info
	 */
	_handlePixelHover(e) {
		if (!this.image || !this.imageData) {
			this.pixelInfo.style.display = 'none';
			return;
		}
		
		const rect = this.previewCanvas.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;
		
		// Convert canvas coordinates to image coordinates
		// Safety check: ensure zoomLevel is valid
		if (!this.zoomLevel || this.zoomLevel <= 0 || isNaN(this.zoomLevel)) {
			this.zoomLevel = 1.0; // Reset to default
		}
		const imageX = Math.floor(x / this.zoomLevel);
		const imageY = Math.floor(y / this.zoomLevel);
		
		// Check bounds
		if (imageX < 0 || imageX >= this.image.width || imageY < 0 || imageY >= this.image.height) {
			this.pixelInfo.style.display = 'none';
			return;
		}
		
		// Get pixel data
		const pixels = this.imageData.data;
		const i = (imageY * this.image.width + imageX) * 4;
		const r = pixels[i];
		const g = pixels[i + 1];
		const b = pixels[i + 2];
		const a = pixels[i + 3];
		
		// Build info text
		let infoText = '';
		
		if (a < 128) {
			// Transparent pixel
			const transparentId = Math.max(0, Math.min(65535, parseInt(this.transparentTileId.value) || 0));
			infoText = `Transparent`;
			if (transparentId > 0) {
				infoText += `<br>ID: ${transparentId}`;
			} else {
				infoText += `<br>ID: 0 (skipped)`;
			}
		} else {
			// Opaque pixel
			const hex = this._rgbToHex(r, g, b);
			const mapping = this.colorMappings.get(hex);
			
			infoText = `RGB(${r}, ${g}, ${b})<br>Hex: ${hex.toUpperCase()}`;
			
			if (mapping) {
				if (mapping.tileId > 0) {
					infoText += `<br>ID: ${mapping.tileId}`;
				} else {
					infoText += `<br>ID: 0 (not assigned)`;
				}
				infoText += `<br><small style="opacity: 0.7;">Click to highlight</small>`;
			}
		}
		
		// Position and show tooltip relative to canvas
		this.pixelInfo.innerHTML = infoText;
		this.pixelInfo.style.display = 'block';
		
		// Position relative to canvas container
		const containerRect = this.previewContainer.getBoundingClientRect();
		let tooltipX = e.clientX - containerRect.left + 15;
		let tooltipY = e.clientY - containerRect.top + 15;
		
		// Get tooltip dimensions (need to measure after display)
		const tooltipWidth = this.pixelInfo.offsetWidth || 150;
		const tooltipHeight = this.pixelInfo.offsetHeight || 60;
		
		// Adjust if tooltip goes off screen
		if (tooltipX + tooltipWidth > containerRect.width) {
			tooltipX = e.clientX - containerRect.left - tooltipWidth - 15;
		}
		if (tooltipY + tooltipHeight > containerRect.height) {
			tooltipY = e.clientY - containerRect.top - tooltipHeight - 15;
		}
		
		this.pixelInfo.style.left = `${tooltipX}px`;
		this.pixelInfo.style.top = `${tooltipY}px`;
	}
	
	/**
	 * Handle pixel click to highlight color in mappings list
	 */
	_handlePixelClick(e) {
		if (!this.image || !this.imageData) return;
		
		const rect = this.previewCanvas.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;
		
		// Convert canvas coordinates to image coordinates
		// Safety check: ensure zoomLevel is valid
		if (!this.zoomLevel || this.zoomLevel <= 0 || isNaN(this.zoomLevel)) {
			this.zoomLevel = 1.0; // Reset to default
		}
		const imageX = Math.floor(x / this.zoomLevel);
		const imageY = Math.floor(y / this.zoomLevel);
		
		// Check bounds
		if (imageX < 0 || imageX >= this.image.width || imageY < 0 || imageY >= this.image.height) {
			return;
		}
		
		// Get pixel data
		const pixels = this.imageData.data;
		const i = (imageY * this.image.width + imageX) * 4;
		const r = pixels[i];
		const g = pixels[i + 1];
		const b = pixels[i + 2];
		const a = pixels[i + 3];
		
		// Skip transparent pixels (can't highlight them in color list)
		if (a < 128) {
			this._updateStatus('Transparent pixels cannot be highlighted in color mappings', '');
			return;
		}
		
		// Get hex color
		const hex = this._rgbToHex(r, g, b);
		
		// Find and highlight the color row
		this._highlightColorInList(hex);
	}
	
	/**
	 * Highlight a color in the color mappings list
	 */
	_highlightColorInList(hex) {
		// Clear any existing highlights
		const existingHighlights = this.colorList.querySelectorAll('.color-row.highlighted');
		existingHighlights.forEach(row => row.classList.remove('highlighted'));
		
		// Check if color exists in mappings
		if (!this.colorMappings.has(hex)) {
			this._updateStatus('Color not found in mappings list', '');
			return;
		}
		
		// If search is active, clear it first to show the color
		const hadSearch = this.colorSearch.value.trim();
		if (hadSearch) {
			this.colorSearch.value = '';
			this._filterColors();
		}
		
		// Find the color row by data attribute (after a brief delay if we cleared search)
		setTimeout(() => {
			const colorRow = this.colorList.querySelector(`[data-color-hex="${hex}"]`);
			
			if (colorRow) {
				// Add highlight class
				colorRow.classList.add('highlighted');
				
				// Scroll into view
				colorRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
				
				// Clear highlight after 2 seconds
				setTimeout(() => {
					colorRow.classList.remove('highlighted');
				}, 2000);
			} else {
				this._updateStatus('Color not found in mappings list', '');
			}
		}, hadSearch ? 150 : 0);
	}
	
	/**
	 * Analyze colors in the image
	 * @returns {Object|null} { success: boolean } or null if no image
	 */
	_analyzeColors() {
		if (!this.image) return null;
		
		// Create temporary canvas to read pixel data
		const tempCanvas = document.createElement('canvas');
		tempCanvas.width = this.image.width;
		tempCanvas.height = this.image.height;
		const tempCtx = tempCanvas.getContext('2d');
		tempCtx.drawImage(this.image, 0, 0);
		
		// Get image data
		this.imageData = tempCtx.getImageData(0, 0, this.image.width, this.image.height);
		const pixels = this.imageData.data;
		
		// Count colors
		const colorCounts = new Map();
		let transparentCount = 0;
		
		for (let i = 0; i < pixels.length; i += 4) {
			const r = pixels[i];
			const g = pixels[i + 1];
			const b = pixels[i + 2];
			const a = pixels[i + 3];
			
			if (a < 128) {
				transparentCount++;
				continue;
			}
			
			const hex = this._rgbToHex(r, g, b);
			colorCounts.set(hex, (colorCounts.get(hex) || 0) + 1);
		}
		
		this.uniqueColorCount = colorCounts.size;
		this.requiresSimplify = this.uniqueColorCount > HARD_MAX_COLORS;
		
		if (this.requiresSimplify) {
			this.transparentPixelCount = transparentCount;
			this.colorMappings.clear();
			this.filteredColors = null;
			this.colorSearch.value = '';
			this._buildColorList();
			this.colorCount.textContent = `${this.uniqueColorCount} colors`;
			this._updateSimplifyPanel();
			this._updateGenerateButtonState();
			return { success: false, tooManyColors: true };
		}
		
		// Sort by count (most common first)
		const sortedColors = [...colorCounts.entries()]
			.sort((a, b) => b[1] - a[1]);
		
		// Store mappings
		this.colorMappings.clear();
		// Clear filtered colors when loading new image
		this.filteredColors = null;
		this.colorSearch.value = '';
		
		// Load saved color mappings to restore previously assigned tile IDs
		const savedMappings = this._loadColorMappings();
		
		for (const [hex, count] of sortedColors) {
			const rgb = this._hexToRgb(hex);
			// Restore saved tile ID if available, otherwise default to 0
			const savedTileId = savedMappings.get(hex);
			this.colorMappings.set(hex, {
				hex,
				rgb,
				tileId: savedTileId !== undefined ? savedTileId : 0,
				count
			});
		}
		
		// Store transparent pixel count
		this.transparentPixelCount = transparentCount;
		
		// Build UI
		this._buildColorList();
		
		// Update count (include transparent pixels if any)
		let countText = `${this.colorMappings.size} colors`;
		if (transparentCount > 0) {
			countText += `, ${transparentCount.toLocaleString()} transparent`;
		}
		this.colorCount.textContent = countText;
		
		this._updateSimplifyPanel();
		this._updateGenerateButtonState();
		
		return { success: true };
	}
	
	/**
	 * Build the color list UI (with optional filter)
	 */
	_buildColorList() {
		// Clear existing
		this.colorList.innerHTML = '';
		
		// Hide empty state
		this.emptyState?.classList.add('hidden');
		
		// Get colors to display (filtered or all)
		const colorsToDisplay = this.filteredColors || this.colorMappings;
		
		if (colorsToDisplay.size === 0) {
			this.emptyState?.classList.remove('hidden');
			if (this.filteredColors) {
				this.emptyState.innerHTML = '<p>No colors match<br>your search</p>';
			} else {
				this.emptyState.innerHTML = '<p>Import an image to<br>detect colors</p>';
			}
			return;
		}
		
		// Create rows
		for (const [hex, mapping] of colorsToDisplay) {
			const row = this._createColorRow(hex, mapping);
			this.colorList.appendChild(row);
		}
	}
	
	/**
	 * Create a single color row element
	 */
	_createColorRow(hex, mapping) {
		const row = document.createElement('div');
		row.className = 'color-row';
		row.setAttribute('data-color-hex', hex); // Add data attribute for finding the row
		
		// Color swatch
		const swatch = document.createElement('div');
		swatch.className = 'color-swatch';
		swatch.style.backgroundColor = hex;
		
		// Color info
		const info = document.createElement('div');
		info.className = 'color-info';
		
		const rgb = document.createElement('div');
		rgb.className = 'color-rgb';
		rgb.textContent = `RGB(${mapping.rgb.r}, ${mapping.rgb.g}, ${mapping.rgb.b})`;
		
		const pixels = document.createElement('div');
		pixels.className = 'color-pixels';
		pixels.textContent = `${mapping.count.toLocaleString()} pixels`;
		
		info.appendChild(rgb);
		info.appendChild(pixels);
		
		// ID input
		const input = document.createElement('input');
		input.type = 'number';
		input.className = 'color-id-input';
		input.value = mapping.tileId;
		input.min = 0;
		input.max = 65535;
		input.placeholder = 'ID';
		
		input.addEventListener('change', (e) => {
			const value = parseInt(e.target.value) || 0;
			mapping.tileId = Math.max(0, Math.min(65535, value));
			e.target.value = mapping.tileId;
			this._saveColorMappings(); // Save color mapping when ID changes
		});
		
		// Use debounced save for input events to avoid excessive localStorage writes
		let inputTimeout = null;
		input.addEventListener('input', (e) => {
			const value = parseInt(e.target.value);
			if (!isNaN(value)) {
				mapping.tileId = Math.max(0, Math.min(65535, value));
				// Debounce localStorage save (save after 500ms of no input)
				clearTimeout(inputTimeout);
				inputTimeout = setTimeout(() => {
					this._saveColorMappings();
				}, 500);
			}
		});
		
		// Add ARIA label
		input.setAttribute('aria-label', `Tile ID for color ${hex}`);
		
		// Make row droppable for favorites
		row.addEventListener('dragover', (e) => {
			e.preventDefault();
			row.classList.add('drag-over');
		});
		
		row.addEventListener('dragleave', () => {
			row.classList.remove('drag-over');
		});
		
		row.addEventListener('drop', (e) => {
			e.preventDefault();
			row.classList.remove('drag-over');
			const favoriteId = e.dataTransfer.getData('favorite/id');
			if (favoriteId) {
				const favorite = this.favorites.find(f => f.id === favoriteId);
				if (favorite) {
					mapping.tileId = favorite.tileId;
					input.value = favorite.tileId;
					this._saveColorMappings(); // Save color mapping when ID is assigned via favorite
					this._updateStatus(`Assigned "${favorite.name}" (ID: ${favorite.tileId}) to color`, 'success');
				}
			}
		});
		
		// Assemble row
		row.appendChild(swatch);
		row.appendChild(info);
		row.appendChild(input);
		
		return row;
	}
	
	/**
	 * Enable or disable the Generate button based on image state and size limits
	 */
	_updateGenerateButtonState() {
		const hasMappableContent = this.colorMappings.size > 0 || this.transparentPixelCount > 0;
		const limitsOk = !this.imageExceedsLimits || this.ignoreSizeLimits.checked;
		const colorsOk = !this.requiresSimplify;
		this.generateBtn.disabled = !this.image || !this.imageData || !hasMappableContent || !limitsOk || !colorsOk;
	}
	
	/**
	 * Show or hide the simplify-colors panel based on unique color count
	 */
	_updateSimplifyPanel() {
		if (!this.image) {
			this.simplifySection.hidden = true;
			return;
		}
		
		const show = this.uniqueColorCount > RECOMMENDED_MAX_COLORS || this.requiresSimplify;
		this.simplifySection.hidden = !show;
		
		if (!show) return;
		
		const maxTarget = Math.max(2, Math.min(HARD_MAX_COLORS, this.uniqueColorCount - 1));
		this.targetColorCount.max = String(maxTarget);
		
		const currentTarget = parseInt(this.targetColorCount.value, 10);
		if (!Number.isFinite(currentTarget) || currentTarget < 2 || currentTarget > maxTarget) {
			this.targetColorCount.value = String(Math.min(RECOMMENDED_MAX_COLORS, maxTarget));
		}
		
		if (this.requiresSimplify) {
			this.simplifyHint.textContent = `This image has ${this.uniqueColorCount} unique colors. Choose a target (2–${maxTarget}) and simplify before generating. Similar shades merge into one palette color.`;
		} else {
			this.simplifyHint.textContent = `${this.uniqueColorCount} colors detected (recommended ≤ ${RECOMMENDED_MAX_COLORS}). Merge similar shades into fewer colors for easier tile mapping.`;
		}
		
		this.simplifyColorsBtn.disabled = this.uniqueColorCount <= 2;
	}
	
	/**
	 * Reduce image palette to user-chosen color count (k-means in RGB)
	 */
	async _handleSimplifyColors() {
		if (!this.image || !this.imageData) {
			this._updateStatus('No image loaded', 'error');
			return;
		}
		
		const maxTarget = Math.max(2, Math.min(HARD_MAX_COLORS, this.uniqueColorCount - 1));
		let k = parseInt(this.targetColorCount.value, 10);
		if (!Number.isFinite(k)) k = RECOMMENDED_MAX_COLORS;
		k = Math.max(2, Math.min(maxTarget, k));
		this.targetColorCount.value = String(k);
		
		if (k >= this.uniqueColorCount) {
			this._updateStatus('Target is not lower than the current color count', 'warning');
			return;
		}
		
		const beforeCount = this.uniqueColorCount;
		this.simplifyColorsBtn.disabled = true;
		this._updateStatus(`Simplifying to ${k} colors…`, '');
		
		try {
			await new Promise((resolve) => setTimeout(resolve, 0));
			
			const simplified = this._quantizeImageData(this.imageData, k);
			await this._applyImageDataToPreview(simplified);
			
			const result = this._analyzeColors();
			if (result?.success) {
				this._updatePreview();
				this._updateStatus(
					`Simplified palette: ${beforeCount} → ${this.uniqueColorCount} colors`,
					'success'
				);
			} else if (result?.tooManyColors) {
				this._updateStatus(
					`Reduced to ${this.uniqueColorCount} colors; still above ${HARD_MAX_COLORS}. Lower the target and simplify again.`,
					'warning'
				);
			}
		} catch (error) {
			this._updateStatus(`Simplify failed: ${error.message}`, 'error');
		} finally {
			this.simplifyColorsBtn.disabled = this.uniqueColorCount <= 2;
		}
	}
	
	/**
	 * k-means quantize opaque pixels; transparent pixels unchanged
	 */
	_quantizeImageData(sourceData, k) {
		const { width, height, data: src } = sourceData;
		const out = new ImageData(width, height);
		const dst = out.data;
		dst.set(src);
		
		const samples = [];
		for (let i = 0; i < src.length; i += 4) {
			if (src[i + 3] < 128) continue;
			samples.push([src[i], src[i + 1], src[i + 2]]);
		}
		
		if (samples.length === 0) return out;
		
		const unique = new Set(samples.map(([r, g, b]) => `${r},${g},${b}`));
		const effectiveK = Math.min(k, unique.size);
		if (effectiveK >= unique.size) return out;
		
		const centroids = this._kMeansCentroids(samples, effectiveK);
		
		for (let i = 0; i < src.length; i += 4) {
			if (src[i + 3] < 128) continue;
			const [r, g, b] = this._nearestCentroid(src[i], src[i + 1], src[i + 2], centroids);
			dst[i] = r;
			dst[i + 1] = g;
			dst[i + 2] = b;
			dst[i + 3] = src[i + 3];
		}
		
		return out;
	}
	
	/**
	 * Run k-means on a sample of RGB points; returns centroid list
	 */
	_kMeansCentroids(samples, k) {
		const n = samples.length;
		const trainCount = Math.min(n, KMEANS_SAMPLE_SIZE);
		const train = [];
		const used = new Set();
		while (train.length < trainCount) {
			const idx = (Math.random() * n) | 0;
			if (used.has(idx)) continue;
			used.add(idx);
			train.push(samples[idx]);
		}
		
		const centroids = [];
		const firstIdx = (Math.random() * trainCount) | 0;
		centroids.push(train[firstIdx].slice());
		
		while (centroids.length < k) {
			const distances = train.map((p) => {
				let min = Infinity;
				for (const c of centroids) {
					const d = this._colorDistSq(p, c);
					if (d < min) min = d;
				}
				return min;
			});
			const total = distances.reduce((a, b) => a + b, 0);
			let pick = Math.random() * total;
			let chosen = 0;
			for (let i = 0; i < distances.length; i++) {
				pick -= distances[i];
				if (pick <= 0) {
					chosen = i;
					break;
				}
			}
			centroids.push(train[chosen].slice());
		}
		
		const assignments = new Array(trainCount);
		for (let iter = 0; iter < KMEANS_ITERATIONS; iter++) {
			const sums = Array.from({ length: k }, () => [0, 0, 0, 0]);
			for (let i = 0; i < trainCount; i++) {
				const ci = this._nearestCentroidIndex(train[i], centroids);
				assignments[i] = ci;
				sums[ci][0] += train[i][0];
				sums[ci][1] += train[i][1];
				sums[ci][2] += train[i][2];
				sums[ci][3]++;
			}
			for (let c = 0; c < k; c++) {
				if (sums[c][3] === 0) {
					centroids[c] = train[(Math.random() * trainCount) | 0].slice();
				} else {
					centroids[c] = [
						Math.round(sums[c][0] / sums[c][3]),
						Math.round(sums[c][1] / sums[c][3]),
						Math.round(sums[c][2] / sums[c][3])
					];
				}
			}
		}
		
		return centroids;
	}
	
	_colorDistSq(a, b) {
		const dr = a[0] - b[0];
		const dg = a[1] - b[1];
		const db = a[2] - b[2];
		return dr * dr + dg * dg + db * db;
	}
	
	_nearestCentroidIndex(rgb, centroids) {
		let best = 0;
		let bestD = Infinity;
		for (let i = 0; i < centroids.length; i++) {
			const d = this._colorDistSq(rgb, centroids[i]);
			if (d < bestD) {
				bestD = d;
				best = i;
			}
		}
		return best;
	}
	
	_nearestCentroid(r, g, b, centroids) {
		return centroids[this._nearestCentroidIndex([r, g, b], centroids)];
	}
	
	/**
	 * Replace working image from ImageData and refresh preview bitmap
	 */
	_applyImageDataToPreview(imageData) {
		return new Promise((resolve, reject) => {
			const canvas = document.createElement('canvas');
			canvas.width = imageData.width;
			canvas.height = imageData.height;
			canvas.getContext('2d').putImageData(imageData, 0, 0);
			
			const dataUrl = canvas.toDataURL('image/png');
			const img = new Image();
			img.onload = () => {
				this.image = img;
				this.imageData = imageData;
				resolve();
			};
			img.onerror = () => reject(new Error('Failed to update preview image'));
			img.src = dataUrl;
		});
	}
	
	/**
	 * Generate the OTBM file
	 */
	_generateOTBM() {
		try {
			if (!this.image || !this.imageData) {
				this._updateStatus('No image loaded!', 'error');
				return;
			}
			
			// Source image dimensions (unchanged) and scaled output map dimensions
			const srcWidth = this.image.width;
			const srcHeight = this.image.height;
			const { width, height, scale } = this._getOutputDimensions();

			const complexityCheck = this._checkImageComplexity(width, height);
			if (!complexityCheck.valid && !this.ignoreSizeLimits.checked) {
				this._updateStatus(complexityCheck.error, 'error');
				return;
			}
			
			// Check for ID 0 warnings
			const zeroIds = [...this.colorMappings.values()].filter(m => m.tileId === 0);
			const transparentId = Math.max(0, Math.min(65535, parseInt(this.transparentTileId.value) || 0));
			const hasTransparentPixels = this.transparentPixelCount > 0;
			
			if (zeroIds.length > 0 || (hasTransparentPixels && transparentId === 0)) {
				let warningMsg = '';
				if (zeroIds.length > 0) {
					warningMsg += `${zeroIds.length} color(s) have ID 0.\nThese pixels will be skipped (no tile placed).\n\n`;
				}
				if (hasTransparentPixels && transparentId === 0) {
					warningMsg += `${this.transparentPixelCount.toLocaleString()} transparent pixel(s) detected.\nTransparent Tile ID is 0, so these will be skipped.\n\n`;
				}
				warningMsg += 'Continue anyway?';
				
				const proceed = confirm(warningMsg);
				if (!proceed) return;
			}
			
			this._updateStatus('Generating OTBM...', '');
			
			// Get and validate settings
			const z = Math.max(0, Math.min(15, parseInt(this.zLevel.value) || 7));
			const offX = Math.max(0, parseInt(this.offsetX.value) || 0);
			const offY = Math.max(0, parseInt(this.offsetY.value) || 0);
			
			// Validate offsets don't cause overflow
			if (offX + width > 65535 || offY + height > 65535) {
				this._updateStatus('Error: Offset + image size exceeds maximum map dimensions (65535)', 'error');
				return;
			}
			
			// Get client configuration
			const clientConfig = this._getCurrentClientConfig();
			if (!clientConfig) {
				this._updateStatus('Invalid client version selected!', 'error');
				return;
			}
			
			// Get OTB version information
			const otbVersion = getOTBVersion(clientConfig.otb);
			if (!otbVersion) {
				this._updateStatus('OTB version not found for selected client!', 'error');
				return;
			}
			
			// Create color lookup map (hex -> tileId)
			const colorToTile = new Map();
			for (const [hex, mapping] of this.colorMappings) {
				if (mapping.tileId > 0) {
					colorToTile.set(hex, mapping.tileId);
				}
			}
			
			// Create OTBM writer with client-specific versions
			const writer = new OTBMWriter(
				width + offX,
				height + offY,
				`PNG to OTBM Converted Map (${clientConfig.name})`,
				clientConfig.otbmVersion,
				otbVersion.version,
				otbVersion.id
			);
			
			// Process each pixel with progress indicator
			const pixels = this.imageData.data;
			let tileCount = 0;
			let transparentTileCount = 0;
			const totalPixels = width * height;
			let processedPixels = 0;
			
			// Show progress for large images
			const showProgress = totalPixels > 10000;
			if (showProgress) {
				this.progressContainer.style.display = 'block';
			}
			
			// When downscaled (scale < 100), each output tile samples the
			// nearest source pixel; at 100% this is a 1:1 mapping.
			const downscaled = scale < 100;
			const flipH = this.flipHorizontal.checked;
			const flipV = this.flipVertical.checked;
			for (let y = 0; y < height; y++) {
				const sy = downscaled ? Math.min(srcHeight - 1, Math.floor(y * srcHeight / height)) : y;
				const tileY = (flipV ? height - 1 - y : y) + offY;
				for (let x = 0; x < width; x++) {
					const sx = downscaled ? Math.min(srcWidth - 1, Math.floor(x * srcWidth / width)) : x;
					const tileX = (flipH ? width - 1 - x : x) + offX;
					const i = (sy * srcWidth + sx) * 4;
					const r = pixels[i];
					const g = pixels[i + 1];
					const b = pixels[i + 2];
					const a = pixels[i + 3];
					
					// Handle transparent pixels
					if (a < 128) {
						if (transparentId > 0) {
							writer.addTile(tileX, tileY, z, transparentId);
							transparentTileCount++;
							tileCount++;
						}
					} else {
						const hex = this._rgbToHex(r, g, b);
						const tileId = colorToTile.get(hex);
						
						if (tileId) {
							writer.addTile(tileX, tileY, z, tileId);
							tileCount++;
						}
					}
					
					processedPixels++;
					
					// Update progress every 1000 pixels
					if (showProgress && processedPixels % 1000 === 0) {
						const progress = Math.round((processedPixels / totalPixels) * 100);
						this._updateProgress(progress);
					}
				}
			}
			
			if (showProgress) {
				this._updateProgress(100);
			}
			
			// Hide progress
			if (this.progressContainer) {
				this.progressContainer.style.display = 'none';
			}
			
			// Download
			const clientName = clientConfig.name.replace(/[^a-zA-Z0-9]/g, '_');
			const filename = `converted_map_${clientName}.otbm`;
			const fileSize = writer.download(filename);
			let statusMsg = `✓ Downloaded: ${filename} (${fileSize.toLocaleString()} bytes, ${tileCount.toLocaleString()} tiles`;
			if (transparentTileCount > 0) {
				statusMsg += `, ${transparentTileCount.toLocaleString()} transparent`;
			}
			if (scale < 100) {
				statusMsg += `, ${width} × ${height} map @ ${scale}%`;
			}
			statusMsg += `, Client: ${clientConfig.name})`;
			this._updateStatus(statusMsg, 'success');
		} catch (error) {
			this._updateStatus(`Error: ${error.message}`, 'error');
			console.error('OTBM generation error:', error);
			// Hide progress in case of error
			if (this.progressContainer) {
				this.progressContainer.style.display = 'none';
			}
		}
	}
	
	/**
	 * Update the status message
	 */
	_updateStatus(message, type = '') {
		this.status.textContent = message;
		this.status.className = 'status ' + type;
	}
	
	/**
	 * Update progress indicator
	 */
	_updateProgress(percent) {
		this.progressFill.style.width = `${percent}%`;
		this.progressText.textContent = `${percent}%`;
	}
	
	/**
	 * Convert RGB to hex string
	 */
	_rgbToHex(r, g, b) {
		return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
	}
	
	/**
	 * Convert hex string to RGB object
	 */
	_hexToRgb(hex) {
		const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
		return result ? {
			r: parseInt(result[1], 16),
			g: parseInt(result[2], 16),
			b: parseInt(result[3], 16)
		} : { r: 0, g: 0, b: 0 };
	}
	
	/**
	 * Load settings from localStorage
	 */
	_loadSettings() {
		try {
			const settings = localStorage.getItem('pngToOtbmSettings');
			if (settings) {
				const parsed = JSON.parse(settings);
				if (parsed.clientVersion) this.clientVersion.value = parsed.clientVersion;
				if (parsed.transparentTileId !== undefined) {
					const validatedId = Math.max(0, Math.min(65535, parseInt(parsed.transparentTileId) || 0));
					this.transparentTileId.value = validatedId;
				}
				if (parsed.zLevel !== undefined) this.zLevel.value = parsed.zLevel;
				if (parsed.offsetX !== undefined) this.offsetX.value = parsed.offsetX;
				if (parsed.offsetY !== undefined) this.offsetY.value = parsed.offsetY;
				if (parsed.targetColorCount !== undefined) {
					const t = Math.max(2, Math.min(256, parseInt(parsed.targetColorCount, 10) || RECOMMENDED_MAX_COLORS));
					this.targetColorCount.value = t;
				}
				if (parsed.mapScale !== undefined) {
					const s = Math.max(1, Math.min(100, parseInt(parsed.mapScale, 10) || 100));
					this.mapScale.value = s;
				}
				if (parsed.flipHorizontal !== undefined) this.flipHorizontal.checked = !!parsed.flipHorizontal;
				if (parsed.flipVertical !== undefined) this.flipVertical.checked = !!parsed.flipVertical;
			}
		} catch (error) {
			console.warn('Failed to load settings:', error);
		}
	}
	
	/**
	 * Save settings to localStorage
	 */
	_saveSettings() {
		try {
			const settings = {
				clientVersion: this.clientVersion.value,
				transparentTileId: parseInt(this.transparentTileId.value) || 0,
				zLevel: parseInt(this.zLevel.value) || 7,
				offsetX: parseInt(this.offsetX.value) || 0,
				offsetY: parseInt(this.offsetY.value) || 0,
				targetColorCount: parseInt(this.targetColorCount.value, 10) || RECOMMENDED_MAX_COLORS,
				mapScale: this._getMapScale(),
				flipHorizontal: this.flipHorizontal.checked,
				flipVertical: this.flipVertical.checked
			};
			localStorage.setItem('pngToOtbmSettings', JSON.stringify(settings));
		} catch (error) {
			console.warn('Failed to save settings:', error);
		}
	}
	
	/**
	 * Save color mappings to localStorage
	 * Stores hex color -> tileId mappings for persistence across sessions
	 */
	_saveColorMappings() {
		try {
			const mappings = {};
			for (const [hex, mapping] of this.colorMappings) {
				// Only save non-zero tile IDs to avoid cluttering storage
				if (mapping.tileId > 0) {
					mappings[hex] = mapping.tileId;
				}
			}
			localStorage.setItem('pngToOtbmColorMappings', JSON.stringify(mappings));
		} catch (error) {
			console.warn('Failed to save color mappings:', error);
		}
	}
	
	/**
	 * Load color mappings from localStorage
	 * Returns a Map of hex color -> tileId
	 */
	_loadColorMappings() {
		try {
			const saved = localStorage.getItem('pngToOtbmColorMappings');
			if (saved) {
				const parsed = JSON.parse(saved);
				const mappings = new Map();
				for (const [hex, tileId] of Object.entries(parsed)) {
					mappings.set(hex, tileId);
				}
				return mappings;
			}
		} catch (error) {
			console.warn('Failed to load color mappings:', error);
		}
		return new Map();
	}
	
	/**
	 * Filter colors based on search query
	 */
	_filterColors() {
		const query = this.colorSearch.value.toLowerCase().trim();
		
		if (!query) {
			this.filteredColors = null;
			this._buildColorList();
			return;
		}
		
		// Filter colors by hex, RGB values, or tile ID
		this.filteredColors = new Map();
		for (const [hex, mapping] of this.colorMappings) {
			const hexMatch = hex.toLowerCase().includes(query);
			const rgbMatch = `${mapping.rgb.r},${mapping.rgb.g},${mapping.rgb.b}`.includes(query);
			const idMatch = mapping.tileId.toString().includes(query);
			
			if (hexMatch || rgbMatch || idMatch) {
				this.filteredColors.set(hex, mapping);
			}
		}
		
		this._buildColorList();
	}
	
	/**
	 * Export color mappings to JSON file
	 */
	_exportMappings() {
		if (this.colorMappings.size === 0) {
			this._updateStatus('No color mappings to export', 'error');
			return;
		}
		
		try {
			const exportData = {
				version: 1,
				colors: [],
				settings: {
					clientVersion: this.clientVersion.value,
					transparentTileId: parseInt(this.transparentTileId.value) || 0,
					zLevel: parseInt(this.zLevel.value) || 7,
					offsetX: parseInt(this.offsetX.value) || 0,
					offsetY: parseInt(this.offsetY.value) || 0
				}
			};
			
			for (const [hex, mapping] of this.colorMappings) {
				exportData.colors.push({
					hex,
					rgb: mapping.rgb,
					tileId: mapping.tileId,
					count: mapping.count
				});
			}
			
			const json = JSON.stringify(exportData, null, 2);
			const blob = new Blob([json], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = 'color_mappings.json';
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
			
			this._updateStatus('Color mappings exported successfully', 'success');
		} catch (error) {
			this._updateStatus(`Export failed: ${error.message}`, 'error');
		}
	}
	
	/**
	 * Import color mappings from JSON file
	 */
	_importMappings() {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.json';
		
		input.onchange = (e) => {
			const file = e.target.files[0];
			if (!file) return;
			
			const reader = new FileReader();
			reader.onload = (event) => {
				try {
					const importData = JSON.parse(event.target.result);
					
					if (!importData.colors || !Array.isArray(importData.colors)) {
						throw new Error('Invalid file format');
					}
					
					// Import colors (only if they exist in current mappings)
					let imported = 0;
					for (const colorData of importData.colors) {
						// Validate colorData structure
						if (!colorData || typeof colorData.hex !== 'string') {
							continue; // Skip invalid entries
						}
						if (this.colorMappings.has(colorData.hex)) {
							// Handle explicit 0 vs undefined/null
							const tileId = (colorData.tileId !== undefined && colorData.tileId !== null) 
								? colorData.tileId 
								: 0;
							this.colorMappings.get(colorData.hex).tileId = Math.max(0, Math.min(65535, tileId));
							imported++;
						}
					}
					
					// Import settings if available
					if (importData.settings) {
						if (importData.settings.clientVersion) {
							// Validate client version exists in available clients
							const validClient = CLIENT_DATA.clients.find(c => c.name === importData.settings.clientVersion);
							if (validClient) {
								this.clientVersion.value = importData.settings.clientVersion;
							} else {
								console.warn(`Invalid client version in import: ${importData.settings.clientVersion}`);
							}
						}
						if (importData.settings.transparentTileId !== undefined) {
							const validatedId = Math.max(0, Math.min(65535, parseInt(importData.settings.transparentTileId) || 0));
							this.transparentTileId.value = validatedId;
						}
						if (importData.settings.zLevel !== undefined) {
							this.zLevel.value = importData.settings.zLevel;
						}
						if (importData.settings.offsetX !== undefined) {
							this.offsetX.value = importData.settings.offsetX;
						}
						if (importData.settings.offsetY !== undefined) {
							this.offsetY.value = importData.settings.offsetY;
						}
						this._saveSettings();
					}
					
					// Save imported color mappings to localStorage
					this._saveColorMappings();
					
					// Rebuild list
					this._buildColorList();
					this._updateStatus(`Imported ${imported} color mapping(s)`, 'success');
				} catch (error) {
					this._updateStatus(`Import failed: ${error.message}`, 'error');
				}
			};
			
			reader.readAsText(file);
		};
		
		input.click();
	}
	
	/**
	 * Handle keyboard shortcuts
	 */
	_handleKeyboard(e) {
		// Escape: Clear search (check before early return so it works when input has focus)
		if (e.key === 'Escape' && document.activeElement === this.colorSearch) {
			this.colorSearch.value = '';
			this._filterColors();
			return;
		}
		
		// Don't trigger shortcuts when typing in inputs
		if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
			return;
		}
		
		// Ctrl/Cmd + O: Open file
		if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
			e.preventDefault();
			this.fileInput.click();
		}
		
		// Ctrl/Cmd + G: Generate
		if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
			e.preventDefault();
			if (!this.generateBtn.disabled) {
				this._generateOTBM();
			}
		}
		
		// Ctrl/Cmd + F: Focus search
		if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
			e.preventDefault();
			this.colorSearch.focus();
		}
	}
	
	/**
	 * Load favorites from localStorage
	 */
	_loadFavorites() {
		try {
			const favorites = localStorage.getItem('pngToOtbmFavorites');
			if (favorites) {
				this.favorites = JSON.parse(favorites);
				this._buildFavoritesList();
			}
		} catch (error) {
			console.warn('Failed to load favorites:', error);
			this.favorites = [];
		}
	}
	
	/**
	 * Save favorites to localStorage
	 */
	_saveFavorites() {
		try {
			localStorage.setItem('pngToOtbmFavorites', JSON.stringify(this.favorites));
		} catch (error) {
			console.warn('Failed to save favorites:', error);
		}
	}
	
	/**
	 * Prompt for favorite name and tile ID
	 * @param {{ name?: string, tileId?: number }} [defaults]
	 * @returns {{ name: string, tileId: number } | null}
	 */
	_promptFavoriteFields(defaults = {}) {
		const name = prompt('Enter favorite name:', defaults.name ?? '');
		if (!name || !name.trim()) return null;
		
		const defaultId = defaults.tileId !== undefined ? String(defaults.tileId) : '';
		const idStr = prompt('Enter tile ID:', defaultId);
		if (!idStr) return null;
		
		const tileId = parseInt(idStr);
		if (isNaN(tileId) || tileId < 0 || tileId > 65535) {
			this._updateStatus('Invalid tile ID. Must be between 0 and 65535', 'error');
			return null;
		}
		
		return { name: name.trim(), tileId };
	}
	
	/**
	 * Show dialog to add a new favorite
	 */
	_showAddFavoriteDialog() {
		const fields = this._promptFavoriteFields();
		if (!fields) return;
		
		const favorite = {
			id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
			name: fields.name,
			tileId: fields.tileId
		};
		
		this.favorites.push(favorite);
		this._saveFavorites();
		this._buildFavoritesList();
		this._updateStatus(`Added favorite: ${fields.name} (ID: ${fields.tileId})`, 'success');
	}
	
	/**
	 * Show dialog to edit an existing favorite
	 */
	_showEditFavoriteDialog(favorite) {
		const fields = this._promptFavoriteFields({
			name: favorite.name,
			tileId: favorite.tileId
		});
		if (!fields) return;
		
		favorite.name = fields.name;
		favorite.tileId = fields.tileId;
		this._saveFavorites();
		this._buildFavoritesList();
		this._updateStatus(`Updated favorite: ${fields.name} (ID: ${fields.tileId})`, 'success');
	}
	
	/**
	 * Build the favorites list UI
	 */
	_buildFavoritesList() {
		// Clear existing items (but keep empty state)
		const existingItems = this.favoritesList.querySelectorAll('.favorite-item');
		existingItems.forEach(item => item.remove());
		
		if (this.favorites.length === 0) {
			if (this.favoritesEmptyState) {
				this.favoritesEmptyState.style.display = 'flex';
			}
			return;
		}
		
		if (this.favoritesEmptyState) {
			this.favoritesEmptyState.style.display = 'none';
		}
		
		for (const favorite of this.favorites) {
			const item = this._createFavoriteItem(favorite);
			this.favoritesList.appendChild(item);
		}
	}
	
	/**
	 * Create a favorite item element
	 */
	_createFavoriteItem(favorite) {
		const item = document.createElement('div');
		item.className = 'favorite-item';
		item.draggable = true;
		item.setAttribute('data-favorite-id', favorite.id);
		item.title = 'Drag to assign · Double-click to edit';
		
		// Favorite content
		const name = document.createElement('div');
		name.className = 'favorite-name';
		name.textContent = favorite.name;
		
		const id = document.createElement('div');
		id.className = 'favorite-id';
		id.textContent = `ID: ${favorite.tileId}`;
		
		const actions = document.createElement('div');
		actions.className = 'favorite-actions';
		
		const editBtn = document.createElement('button');
		editBtn.className = 'btn-icon-only favorite-edit';
		editBtn.innerHTML = '<span class="favorite-edit-icon" aria-hidden="true">✎</span>';
		editBtn.title = 'Edit favorite';
		editBtn.setAttribute('aria-label', 'Edit favorite');
		editBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			this._showEditFavoriteDialog(favorite);
		});
		
		const deleteBtn = document.createElement('button');
		deleteBtn.className = 'btn-icon-only favorite-delete';
		deleteBtn.textContent = '×';
		deleteBtn.title = 'Delete favorite';
		deleteBtn.setAttribute('aria-label', 'Delete favorite');
		deleteBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			if (confirm(`Delete favorite "${favorite.name}"?`)) {
				this.favorites = this.favorites.filter(f => f.id !== favorite.id);
				this._saveFavorites();
				this._buildFavoritesList();
				this._updateStatus(`Deleted favorite: ${favorite.name}`, 'success');
			}
		});
		
		actions.appendChild(editBtn);
		actions.appendChild(deleteBtn);
		
		item.addEventListener('dblclick', (e) => {
			if (e.target.closest('button')) return;
			this._showEditFavoriteDialog(favorite);
		});
		
		// Drag handlers
		item.addEventListener('dragstart', (e) => {
			e.dataTransfer.setData('favorite/id', favorite.id);
			item.classList.add('dragging');
		});
		
		item.addEventListener('dragend', () => {
			item.classList.remove('dragging');
		});
		
		item.appendChild(name);
		item.appendChild(id);
		item.appendChild(actions);
		
		return item;
	}
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
	window.app = new PNGToOTBMApp();
});

