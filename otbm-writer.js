/**
 * OTBM Binary Writer Module
 * 
 * Handles writing map data to OTBM (OpenTibia Binary Map) format.
 * Implements OTBM version 2 format.
 */

// OTBM Control Characters
const NODE_START = 0xFE;
const NODE_END = 0xFF;
const ESCAPE = 0xFD;

// OTBM Node Types
const OTBM_ROOTV1 = 1;
const OTBM_MAP_DATA = 2;
const OTBM_TILE_AREA = 4;
const OTBM_TILE = 5;
const OTBM_ITEM = 6;
const OTBM_TOWNS = 12;
const OTBM_WAYPOINTS = 15;

// OTBM Attributes
const OTBM_ATTR_DESCRIPTION = 1;
const OTBM_ATTR_ITEM = 9;

/**
 * OTBM Writer class for generating OTBM binary files
 */
class OTBMWriter {
	constructor(width, height, description = "Generated Map", otbmVersion = 2, otbMajorVersion = 2, otbMinorVersion = 7) {
		this.width = width;
		this.height = height;
		this.description = description;
		this.tiles = [];
		this.buffer = [];
		
		// OTBM version settings - can be customized per client version
		this.otbmVersion = otbmVersion;
		this.otbMajorVersion = otbMajorVersion;
		this.otbMinorVersion = otbMinorVersion;
	}
	
	/**
	 * Add a tile to the map
	 * @param {number} x - X coordinate
	 * @param {number} y - Y coordinate
	 * @param {number} z - Z coordinate (floor level)
	 * @param {number} groundId - Ground item ID
	 * @param {number[]} items - Additional item IDs (optional)
	 */
	addTile(x, y, z, groundId, items = []) {
		this.tiles.push({ x, y, z, groundId, items });
	}
	
	/**
	 * Write a single byte to the buffer
	 */
	_writeByte(value) {
		this.buffer.push(value & 0xFF);
	}
	
	/**
	 * Write a byte with escaping for control characters
	 */
	_writeEscapedByte(value) {
		value = value & 0xFF;
		if (value === NODE_START || value === NODE_END || value === ESCAPE) {
			this.buffer.push(ESCAPE);
		}
		this.buffer.push(value);
	}
	
	/**
	 * Write multiple bytes with escaping
	 */
	_writeEscapedBytes(bytes) {
		for (const b of bytes) {
			this._writeEscapedByte(b);
		}
	}
	
	/**
	 * Write uint16 little-endian with escaping
	 */
	_writeU16(value) {
		this._writeEscapedByte(value & 0xFF);
		this._writeEscapedByte((value >> 8) & 0xFF);
	}
	
	/**
	 * Write uint32 little-endian with escaping
	 */
	_writeU32(value) {
		this._writeEscapedByte(value & 0xFF);
		this._writeEscapedByte((value >> 8) & 0xFF);
		this._writeEscapedByte((value >> 16) & 0xFF);
		this._writeEscapedByte((value >> 24) & 0xFF);
	}
	
	/**
	 * Write a length-prefixed string
	 */
	_writeString(str) {
		const encoded = new TextEncoder().encode(str);
		this._writeU16(encoded.length);
		this._writeEscapedBytes(encoded);
	}
	
	/**
	 * Start a new node
	 */
	_startNode(nodeType) {
		this.buffer.push(NODE_START);
		this._writeByte(nodeType);
	}
	
	/**
	 * End the current node
	 */
	_endNode() {
		this.buffer.push(NODE_END);
	}
	
	/**
	 * Write the OTBM root header
	 */
	_writeRootHeader() {
		this._writeU32(this.otbmVersion);
		this._writeU16(this.width);
		this._writeU16(this.height);
		this._writeU32(this.otbMajorVersion);
		this._writeU32(this.otbMinorVersion);
	}
	
	/**
	 * Write the MAP_DATA node with all tiles
	 */
	_writeMapData() {
		this._startNode(OTBM_MAP_DATA);
		
		// Write description attribute
		this._writeByte(OTBM_ATTR_DESCRIPTION);
		this._writeString(this.description);
		
		// Group tiles by area (256x256 chunks)
		const areas = new Map();
		for (const tile of this.tiles) {
			const areaX = tile.x & 0xFF00;
			const areaY = tile.y & 0xFF00;
			const areaKey = `${areaX},${areaY},${tile.z}`;
			
			if (!areas.has(areaKey)) {
				areas.set(areaKey, { areaX, areaY, z: tile.z, tiles: [] });
			}
			areas.get(areaKey).tiles.push(tile);
		}
		
		// Write each tile area
		for (const area of areas.values()) {
			this._writeTileArea(area.areaX, area.areaY, area.z, area.tiles);
		}
		
		// Write empty towns node
		this._startNode(OTBM_TOWNS);
		this._endNode();
		
		// Waypoints (version 2+)
		if (this.otbmVersion >= 2) {
			this._startNode(OTBM_WAYPOINTS);
			this._endNode();
		}
		
		this._endNode();
	}
	
	/**
	 * Write a TILE_AREA node
	 */
	_writeTileArea(baseX, baseY, z, tiles) {
		this._startNode(OTBM_TILE_AREA);
		
		// Write area base coordinates
		this._writeU16(baseX);
		this._writeU16(baseY);
		this._writeEscapedByte(z);
		
		// Write each tile
		for (const tile of tiles) {
			this._writeTile(tile, baseX, baseY);
		}
		
		this._endNode();
	}
	
	/**
	 * Write a single TILE node
	 */
	_writeTile(tile, baseX, baseY) {
		this._startNode(OTBM_TILE);
		
		// Write tile offset from area base
		const xOffset = tile.x - baseX;
		const yOffset = tile.y - baseY;
		this._writeEscapedByte(xOffset);
		this._writeEscapedByte(yOffset);
		
		// Write ground item using compact format
		this._writeByte(OTBM_ATTR_ITEM);
		this._writeU16(tile.groundId);
		
		// Write additional items as full ITEM nodes
		for (const itemId of tile.items) {
			this._startNode(OTBM_ITEM);
			this._writeU16(itemId);
			this._endNode();
		}
		
		this._endNode();
	}
	
	/**
	 * Generate the OTBM binary data
	 * @returns {Uint8Array} The OTBM file data
	 */
	generate() {
		this.buffer = [];
		
		// Write file identifier "OTBM"
		this.buffer.push(0x4F, 0x54, 0x42, 0x4D);
		
		// Write root node
		this._startNode(OTBM_ROOTV1);
		this._writeRootHeader();
		
		// Write map data
		this._writeMapData();
		
		// End root node
		this._endNode();
		
		return new Uint8Array(this.buffer);
	}
	
	/**
	 * Download the OTBM file
	 * @param {string} filename - The filename to save as
	 */
	download(filename = "converted_map.otbm") {
		const data = this.generate();
		const blob = new Blob([data], { type: "application/octet-stream" });
		const url = URL.createObjectURL(blob);
		
		const a = document.createElement("a");
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
		
		return data.length;
	}
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
	module.exports = OTBMWriter;
}

