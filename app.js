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
		this.filteredColors = null; // Filtered color list for search
		this.zoomLevel = 1.0; // Current zoom level (1.0 = 100%)
		this.minZoom = 0.1; // Minimum zoom (10%)
		this.maxZoom = 20.0; // Maximum zoom (2000%)
		this.favorites = []; // Array of { id, name } favorite items
		
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
		this.pixelInfo = document.getElementById('pixelInfo');
		this.addFavoriteBtn = document.getElementById('addFavoriteBtn');
		this.favoritesList = document.getElementById('favoritesList');
		this.favoritesEmptyState = document.getElementById('favoritesEmptyState');
		
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
				// Check image complexity before processing
				const complexityCheck = this._checkImageComplexity(img.width, img.height);
				if (!complexityCheck.valid) {
					this._updateStatus(complexityCheck.error, 'error');
					this.image = null;
					this.imageData = null;
					this.colorMappings.clear();
					this.filteredColors = null;
					this.colorSearch.value = '';
					this._buildColorList();
					this.generateBtn.disabled = true;
					// Reset preview
					this.previewPlaceholder.style.display = 'block';
					this.previewCanvas.classList.remove('visible');
					this.imageInfo.textContent = 'No image loaded';
					return;
				}
				
			this.image = img;
			// Calculate initial zoom to fit container
			const containerRect = this.previewContainer.getBoundingClientRect();
			const maxWidth = containerRect.width - 32;
			const maxHeight = containerRect.height - 32;
			const fitScale = Math.min(
				maxWidth / img.width,
				maxHeight / img.height,
				1.0 // Don't zoom in beyond 100% initially
			);
			this.zoomLevel = Math.max(fitScale, this.minZoom);
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
		const MAX_DIMENSION = 4500; // Maximum width or height
		const MAX_TOTAL_PIXELS = 13500000; // 4500 × 3000 = 13,500,000 pixels - this was tested and it works fine
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
				this.filteredColors = null;
				this.colorSearch.value = '';
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
		
		// Enable generate button
		if (this.colorMappings.size > 0 || transparentCount > 0) {
			this.generateBtn.disabled = false;
		}
		
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
	 * Generate the OTBM file
	 */
	_generateOTBM() {
		try {
			if (!this.image || !this.imageData) {
				this._updateStatus('No image loaded!', 'error');
				return;
			}
			
			// Get image dimensions first
			const width = this.image.width;
			const height = this.image.height;
			
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
					} else {
						const hex = this._rgbToHex(r, g, b);
						const tileId = colorToTile.get(hex);
						
						if (tileId) {
							writer.addTile(x + offX, y + offY, z, tileId);
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
				offsetY: parseInt(this.offsetY.value) || 0
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
	 * Show dialog to add a new favorite
	 */
	_showAddFavoriteDialog() {
		const name = prompt('Enter favorite name:');
		if (!name || !name.trim()) return;
		
		const idStr = prompt('Enter tile ID:');
		if (!idStr) return;
		
		const tileId = parseInt(idStr);
		if (isNaN(tileId) || tileId < 0 || tileId > 65535) {
			this._updateStatus('Invalid tile ID. Must be between 0 and 65535', 'error');
			return;
		}
		
		// Create favorite with unique ID (use timestamp + random to avoid collisions)
		const favorite = {
			id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Unique ID
			name: name.trim(),
			tileId: tileId
		};
		
		this.favorites.push(favorite);
		this._saveFavorites();
		this._buildFavoritesList();
		this._updateStatus(`Added favorite: ${name} (ID: ${tileId})`, 'success');
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
		
		// Favorite content
		const name = document.createElement('div');
		name.className = 'favorite-name';
		name.textContent = favorite.name;
		
		const id = document.createElement('div');
		id.className = 'favorite-id';
		id.textContent = `ID: ${favorite.tileId}`;
		
		// Delete button
		const deleteBtn = document.createElement('button');
		deleteBtn.className = 'btn-icon-only favorite-delete';
		deleteBtn.textContent = '×';
		deleteBtn.title = 'Delete favorite';
		deleteBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			if (confirm(`Delete favorite "${favorite.name}"?`)) {
				this.favorites = this.favorites.filter(f => f.id !== favorite.id);
				this._saveFavorites();
				this._buildFavoritesList();
				this._updateStatus(`Deleted favorite: ${favorite.name}`, 'success');
			}
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
		item.appendChild(deleteBtn);
		
		return item;
	}
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
	window.app = new PNGToOTBMApp();
});

