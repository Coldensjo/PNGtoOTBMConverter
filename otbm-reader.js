/**
 * OTBM Binary Reader Module
 *
 * Parses OTBM (OpenTibia Binary Map) files into a tile list, the inverse of
 * OTBMWriter. Implements the same node/escaping scheme used by otbm-writer.js.
 */

// OTBM Control Characters (must match otbm-writer.js)
const READER_NODE_START = 0xFE;
const READER_NODE_END = 0xFF;
const READER_ESCAPE = 0xFD;

// OTBM Node Types
const READER_OTBM_ROOTV1 = 1;
const READER_OTBM_MAP_DATA = 2;
const READER_OTBM_TILE_AREA = 4;
const READER_OTBM_TILE = 5;
const READER_OTBM_ITEM = 6;
const READER_OTBM_HOUSETILE = 14;

// OTBM Attributes
const READER_OTBM_ATTR_DESCRIPTION = 1;
const READER_OTBM_ATTR_TILE_FLAGS = 3;
const READER_OTBM_ATTR_ITEM = 9;

/**
 * OTBM Reader class for parsing OTBM binary files
 */
class OTBMReader {
	/**
	 * @param {ArrayBuffer|Uint8Array} data - Raw OTBM file bytes
	 */
	constructor(data) {
		this.bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
	}

	/**
	 * Parse the file and return structured map data.
	 * @returns {Object} { width, height, otbmVersion, description, tiles: [{x,y,z,groundId}] }
	 */
	parse() {
		const bytes = this.bytes;
		let pos = 0;

		// Optional "OTBM" magic (4 bytes). Some tools write a 4-byte zero magic
		// instead; either way the first node starts at the first NODE_START.
		if (bytes.length >= 4 &&
			bytes[0] === 0x4F && bytes[1] === 0x54 && bytes[2] === 0x42 && bytes[3] === 0x4D) {
			pos = 4;
		} else if (bytes.length >= 4 && bytes[0] !== READER_NODE_START) {
			// Skip an unrecognized 4-byte magic/version header.
			pos = 4;
		}

		if (pos >= bytes.length || bytes[pos] !== READER_NODE_START) {
			throw new Error('Not a valid OTBM file (root node not found)');
		}

		const { node } = this._parseNode(pos);
		return this._interpret(node);
	}

	/**
	 * Recursively parse a node beginning at `start` (which points at NODE_START).
	 * Returns { node, pos } where pos is the index just past the node's NODE_END.
	 */
	_parseNode(start) {
		const bytes = this.bytes;
		const type = bytes[start + 1];
		let pos = start + 2;
		const props = [];
		const children = [];

		while (pos < bytes.length) {
			const b = bytes[pos];
			if (b === READER_NODE_START) {
				const result = this._parseNode(pos);
				children.push(result.node);
				pos = result.pos;
			} else if (b === READER_NODE_END) {
				pos++;
				return { node: { type, props, children }, pos };
			} else if (b === READER_ESCAPE) {
				props.push(bytes[pos + 1]);
				pos += 2;
			} else {
				props.push(b);
				pos++;
			}
		}

		// Reached EOF without a closing NODE_END — tolerate truncated files.
		return { node: { type, props, children }, pos };
	}

	/**
	 * Turn the parsed root node into map data.
	 */
	_interpret(root) {
		// The root node's type varies by writer: Remere's Map Editor (and most
		// real maps) use a bare type-0 root, while some tools (including this
		// app's writer) use OTBM_ROOTV1 (1). Accept either; the version/size
		// header lives in the root node's properties in both cases.
		if (root.type !== 0 && root.type !== READER_OTBM_ROOTV1) {
			throw new Error('Unexpected root node type: ' + root.type);
		}

		const header = new PropReader(root.props);
		const otbmVersion = header.u32();
		const width = header.u16();
		const height = header.u16();

		const mapData = root.children.find(c => c.type === READER_OTBM_MAP_DATA);
		if (!mapData) {
			throw new Error('OTBM file has no map data node');
		}

		const description = this._readDescription(mapData.props);

		const tiles = [];
		for (const area of mapData.children) {
			if (area.type !== READER_OTBM_TILE_AREA) continue;

			const ap = new PropReader(area.props);
			const baseX = ap.u16();
			const baseY = ap.u16();
			const z = ap.u8();

			for (const tileNode of area.children) {
				if (tileNode.type !== READER_OTBM_TILE && tileNode.type !== READER_OTBM_HOUSETILE) continue;
				const tile = this._readTile(tileNode, baseX, baseY, z, tileNode.type === READER_OTBM_HOUSETILE);
				if (tile) tiles.push(tile);
			}
		}

		return { width, height, otbmVersion, description, tiles };
	}

	/**
	 * Pull the description string out of the MAP_DATA attributes, if present.
	 */
	_readDescription(props) {
		const reader = new PropReader(props);
		while (reader.remaining() > 0) {
			const attr = reader.u8();
			if (attr === READER_OTBM_ATTR_DESCRIPTION) {
				return reader.string();
			}
			// Unknown attribute in map data — stop rather than misread.
			break;
		}
		return '';
	}

	/**
	 * Read a single TILE (or HOUSETILE) node into { x, y, z, groundId }.
	 * House tiles carry an extra u32 house ID after the offsets.
	 */
	_readTile(tileNode, baseX, baseY, z, isHouseTile = false) {
		const reader = new PropReader(tileNode.props);
		if (reader.remaining() < 2) return null;

		const xOffset = reader.u8();
		const yOffset = reader.u8();
		if (isHouseTile) {
			if (reader.remaining() < 4) return null;
			reader.u32(); // house ID — not needed for the image
		}
		let groundId = 0;

		// Read tile attributes; we only care about the compact ground item, but
		// must skip known fixed-size attributes (e.g. tile flags) that can
		// precede it, or we'd stop before reaching the ground.
		while (reader.remaining() > 0) {
			const attr = reader.u8();
			if (attr === READER_OTBM_ATTR_ITEM) {
				groundId = reader.u16();
			} else if (attr === READER_OTBM_ATTR_TILE_FLAGS) {
				reader.u32(); // flags — not needed for the image
			} else {
				// Unknown attribute layout — stop to avoid misaligned reads.
				break;
			}
		}

		// Fall back to a ground item written as a child ITEM node.
		if (groundId === 0) {
			const itemNode = tileNode.children.find(c => c.type === READER_OTBM_ITEM);
			if (itemNode) {
				groundId = new PropReader(itemNode.props).u16();
			}
		}

		return { x: baseX + xOffset, y: baseY + yOffset, z, groundId };
	}
}

/**
 * Little helper to sequentially read primitives from a property byte array.
 */
class PropReader {
	constructor(props) {
		this.props = props;
		this.pos = 0;
	}

	remaining() {
		return this.props.length - this.pos;
	}

	u8() {
		return this.props[this.pos++] & 0xFF;
	}

	u16() {
		const lo = this.u8();
		const hi = this.u8();
		return lo | (hi << 8);
	}

	u32() {
		const b0 = this.u8();
		const b1 = this.u8();
		const b2 = this.u8();
		const b3 = this.u8();
		return (b0 | (b1 << 8) | (b2 << 16) | (b3 << 24)) >>> 0;
	}

	string() {
		const len = this.u16();
		const bytes = [];
		for (let i = 0; i < len && this.remaining() > 0; i++) {
			bytes.push(this.u8());
		}
		return new TextDecoder().decode(new Uint8Array(bytes));
	}
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
	module.exports = OTBMReader;
}
