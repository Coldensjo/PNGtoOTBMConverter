/**
 * PNG to OTBM Converter - Main Application
 * 
 * Handles image loading, color detection, and OTBM generation.
 */

class PNGToOTBMApp {
	constructor() {
		// State
		this.image = null;
		this.imageData = null;
		this.colorMappings = new Map(); // color hex -> { color, tileId, count }
		this.transparentPixelCount = 0; // Count of transparent pixels
		
		// DOM Elements
		this.fileInput = document.getElementById('fileInput');
		this.importBtn = document.getElementById('importBtn');
		this.previewCanvas = document.getElementById('previewCanvas');
		this.previewContainer = document.getElementById('previewContainer');
		this.previewPlaceholder = document.getElementById('previewPlaceholder');
		this.imageInfo = document.getElementById('imageInfo');
		this.colorList = document.getElementById('colorList');
		this.colorCount = document.getElementById('colorCount');
		this.emptyState = document.getElementById('emptyState');
		this.generateBtn = document.getElementById('generateBtn');
		this.status = document.getElementById('status');
		this.clientVersion = document.getElementById('clientVersion');
		this.transparentTileId = document.getElementById('transparentTileId');
		this.zLevel = document.getElementById('zLevel');
		this.offsetX = document.getElementById('offsetX');
		this.offsetY = document.getElementById('offsetY');
		
		// Canvas context
		this.ctx = this.previewCanvas.getContext('2d');
		
		// Initialize
		this._populateClientVersions();
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
			if (file && file.type.startsWith('image/')) {
				this._loadImage(file);
			}
		});
		
		// Generate button
		this.generateBtn.addEventListener('click', () => this._generateOTBM());
		
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
				// Check image complexity before processing
				const complexityCheck = this._checkImageComplexity(img.width, img.height);
				if (!complexityCheck.valid) {
					this._updateStatus(complexityCheck.error, 'error');
					this.image = null;
					this.imageData = null;
					this.colorMappings.clear();
					this._buildColorList();
					this.generateBtn.disabled = true;
					// Reset preview
					this.previewPlaceholder.style.display = 'block';
					this.previewCanvas.classList.remove('visible');
					this.imageInfo.textContent = 'No image loaded';
					return;
				}
				
				this.image = img;
				this._updatePreview();
				// Analyze colors - this will show error if too complex
				const colorAnalysisResult = this._analyzeColors();
				// Only show success if color analysis passed
				if (colorAnalysisResult && colorAnalysisResult.success) {
					this._updateStatus(`Loaded: ${file.name}`, 'success');
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
	 * Check if image is too complex to process
	 * @param {number} width - Image width in pixels
	 * @param {number} height - Image height in pixels
	 * @returns {Object} { valid: boolean, error: string }
	 */
	_checkImageComplexity(width, height) {
		const MAX_DIMENSION = 2048; // Maximum width or height
		const MAX_TOTAL_PIXELS = 4194304; // 2048 × 2048 = 4,194,304 pixels
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
		
		// Get container dimensions
		const containerRect = this.previewContainer.getBoundingClientRect();
		const maxWidth = containerRect.width - 32;
		const maxHeight = containerRect.height - 32;
		
		// Calculate scale to fit
		const scale = Math.min(
			maxWidth / this.image.width,
			maxHeight / this.image.height,
			4 // Max 4x zoom for small images
		);
		
		// Set canvas size
		const displayWidth = Math.floor(this.image.width * scale);
		const displayHeight = Math.floor(this.image.height * scale);
		
		this.previewCanvas.width = displayWidth;
		this.previewCanvas.height = displayHeight;
		
		// Disable image smoothing for pixel-perfect rendering
		this.ctx.imageSmoothingEnabled = false;
		
		// Draw image
		this.ctx.drawImage(this.image, 0, 0, displayWidth, displayHeight);
		
		// Update info
		this.imageInfo.textContent = `${this.image.width} × ${this.image.height} px`;
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
		const MAX_COLORS = 256; // Maximum number of unique colors
		let transparentCount = 0;
		
		for (let i = 0; i < pixels.length; i += 4) {
			const r = pixels[i];
			const g = pixels[i + 1];
			const b = pixels[i + 2];
			const a = pixels[i + 3];
			
			// Count transparent pixels
			if (a < 128) {
				transparentCount++;
				continue;
			}
			
			const hex = this._rgbToHex(r, g, b);
			colorCounts.set(hex, (colorCounts.get(hex) || 0) + 1);
			
			// Check if too many unique colors (check immediately after adding)
			if (colorCounts.size > MAX_COLORS) {
				const errorMessage = `Image too complex: ${colorCounts.size} unique colors detected. Maximum: ${MAX_COLORS} colors. Please reduce color complexity (use fewer colors or quantize the image).`;
				this._updateStatus(errorMessage, 'error');
				this.image = null;
				this.imageData = null;
				this.colorMappings.clear();
				this._buildColorList();
				this.generateBtn.disabled = true;
				// Reset preview
				this.previewPlaceholder.style.display = 'block';
				this.previewCanvas.classList.remove('visible');
				this.imageInfo.textContent = 'No image loaded';
				// Show empty state
				if (this.emptyState) {
					this.emptyState.classList.remove('hidden');
				}
				return { success: false };
			}
		}
		
		// Sort by count (most common first)
		const sortedColors = [...colorCounts.entries()]
			.sort((a, b) => b[1] - a[1]);
		
		// Store mappings
		this.colorMappings.clear();
		for (const [hex, count] of sortedColors) {
			const rgb = this._hexToRgb(hex);
			this.colorMappings.set(hex, {
				hex,
				rgb,
				tileId: 0,
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
		
		// Enable generate button
		if (this.colorMappings.size > 0 || transparentCount > 0) {
			this.generateBtn.disabled = false;
		}
		
		return { success: true };
	}
	
	/**
	 * Build the color list UI
	 */
	_buildColorList() {
		// Clear existing
		this.colorList.innerHTML = '';
		
		// Hide empty state
		this.emptyState?.classList.add('hidden');
		
		// Create rows
		for (const [hex, mapping] of this.colorMappings) {
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
		});
		
		input.addEventListener('input', (e) => {
			const value = parseInt(e.target.value);
			if (!isNaN(value)) {
				mapping.tileId = Math.max(0, Math.min(65535, value));
			}
		});
		
		// Assemble row
		row.appendChild(swatch);
		row.appendChild(info);
		row.appendChild(input);
		
		return row;
	}
	
	/**
	 * Generate the OTBM file
	 */
	_generateOTBM() {
		if (!this.image || !this.imageData) {
			this._updateStatus('No image loaded!', 'error');
			return;
		}
		
		// Check for ID 0 warnings
		const zeroIds = [...this.colorMappings.values()].filter(m => m.tileId === 0);
		const transparentId = parseInt(this.transparentTileId.value) || 0;
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
		
		// Get settings
		const z = Math.max(0, Math.min(15, parseInt(this.zLevel.value) || 7));
		const offX = parseInt(this.offsetX.value) || 0;
		const offY = parseInt(this.offsetY.value) || 0;
		
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
		const width = this.image.width;
		const height = this.image.height;
		const writer = new OTBMWriter(
			width + offX,
			height + offY,
			`PNG to OTBM Converted Map (${clientConfig.name})`,
			clientConfig.otbmVersion,
			otbVersion.version,
			otbVersion.id
		);
		
		// Process each pixel
		const pixels = this.imageData.data;
		let tileCount = 0;
		let transparentTileCount = 0;
		
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				const i = (y * width + x) * 4;
				const r = pixels[i];
				const g = pixels[i + 1];
				const b = pixels[i + 2];
				const a = pixels[i + 3];
				
				// Handle transparent pixels
				if (a < 128) {
					if (transparentId > 0) {
						writer.addTile(x + offX, y + offY, z, transparentId);
						transparentTileCount++;
						tileCount++;
					}
					continue;
				}
				
				const hex = this._rgbToHex(r, g, b);
				const tileId = colorToTile.get(hex);
				
				if (tileId) {
					writer.addTile(x + offX, y + offY, z, tileId);
					tileCount++;
				}
			}
		}
		
		// Download
		try {
			const clientName = clientConfig.name.replace(/[^a-zA-Z0-9]/g, '_');
			const filename = `converted_map_${clientName}.otbm`;
			const fileSize = writer.download(filename);
			let statusMsg = `✓ Downloaded: ${filename} (${fileSize.toLocaleString()} bytes, ${tileCount.toLocaleString()} tiles`;
			if (transparentTileCount > 0) {
				statusMsg += `, ${transparentTileCount.toLocaleString()} transparent`;
			}
			statusMsg += `, Client: ${clientConfig.name})`;
			this._updateStatus(statusMsg, 'success');
		} catch (error) {
			this._updateStatus(`Error: ${error.message}`, 'error');
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
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
	window.app = new PNGToOTBMApp();
});

