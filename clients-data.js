/**
 * Client Configuration Data
 * 
 * Contains information about Tibia client versions and their OTBM/OTB format requirements.
 * Based on clients.xml from Remere's Map Editor.
 */

const CLIENT_DATA = {
	// OTB version mappings (client name -> { version, id })
	otbVersions: {
		"7.40": { version: 1, id: 1 },
		"7.50": { version: 1, id: 1 },
		"7.55": { version: 1, id: 2 },
		"7.60": { version: 1, id: 3 },
		"7.70": { version: 1, id: 3 },
		"7.80": { version: 1, id: 4 },
		"7.90": { version: 1, id: 5 },
		"7.92": { version: 1, id: 6 },
		"8.00": { version: 2, id: 7 },
		"8.10": { version: 2, id: 8 },
		"8.11": { version: 2, id: 9 },
		"8.20": { version: 3, id: 10 },
		"8.30": { version: 3, id: 11 },
		"8.40": { version: 3, id: 12 },
		"8.41": { version: 3, id: 13 },
		"8.42": { version: 3, id: 14 },
		"8.50": { version: 3, id: 15 },
		"8.54 (bad)": { version: 3, id: 16 },
		"8.54": { version: 3, id: 17 },
		"8.55": { version: 3, id: 18 },
		"8.60 (old)": { version: 3, id: 19 },
		"8.60": { version: 3, id: 20 },
		"8.61": { version: 3, id: 21 },
		"8.62": { version: 3, id: 22 },
		"8.70": { version: 3, id: 23 },
		"8.71": { version: 3, id: 24 },
		"8.72": { version: 3, id: 25 },
		"8.73": { version: 3, id: 26 },
		"8.74": { version: 3, id: 26 },
		"9.00": { version: 3, id: 27 },
		"9.10": { version: 3, id: 28 },
		"9.20": { version: 3, id: 29 },
		"9.40": { version: 3, id: 30 },
		"9.44": { version: 3, id: 31 },
		"9.44.v2": { version: 3, id: 32 },
		"9.44.v3": { version: 3, id: 33 },
		"9.44.v4": { version: 3, id: 34 },
		"9.46": { version: 3, id: 35 },
		"9.50": { version: 3, id: 36 },
		"9.52": { version: 3, id: 37 },
		"9.53": { version: 3, id: 38 },
		"9.54": { version: 3, id: 39 },
		"9.60": { version: 3, id: 40 },
		"9.61": { version: 3, id: 41 },
		"9.63": { version: 3, id: 42 },
		"9.70": { version: 3, id: 43 },
		"9.80": { version: 3, id: 44 },
		"9.81": { version: 3, id: 45 },
		"9.82": { version: 3, id: 46 },
		"9.83": { version: 3, id: 47 },
		"9.85": { version: 3, id: 48 },
		"9.86": { version: 3, id: 49 },
		"10.10": { version: 3, id: 50 },
		"10.20": { version: 3, id: 51 },
		"10.21": { version: 3, id: 52 },
		"10.30": { version: 3, id: 53 },
		"10.31": { version: 3, id: 54 },
		"10.41": { version: 3, id: 55 },
		"10.77": { version: 3, id: 56 },
		"10.98": { version: 3, id: 57 },
		"10.100": { version: 3, id: 58 },
		"12.71": { version: 3, id: 59 },
		"12.81": { version: 3, id: 60 },
		"12.85": { version: 3, id: 61 },
		"12.86": { version: 3, id: 62 },
		"12.87": { version: 3, id: 63 },
		"12.90": { version: 3, id: 64 },
		"13.10": { version: 3, id: 65 }
	},

	// Client configurations (visible clients only)
	clients: [
		{ name: "7.4", otb: "7.40", otbmVersion: 1, default: false },
		{ name: "7.6", otb: "7.60", otbmVersion: 1, default: false },
		{ name: "8.00", otb: "8.00", otbmVersion: 2, default: true },
		{ name: "8.10", otb: "8.10", otbmVersion: 2, default: false },
		{ name: "8.20 - 8.31", otb: "8.20", otbmVersion: 2, default: false },
		{ name: "8.40", otb: "8.40", otbmVersion: 3, default: false },
		{ name: "8.50", otb: "8.50", otbmVersion: 3, default: false },
		{ name: "8.54", otb: "8.54", otbmVersion: 3, default: false },
		{ name: "8.60", otb: "8.60", otbmVersion: 3, default: false },
		{ name: "8.70", otb: "8.70", otbmVersion: 3, default: false },
		{ name: "9.10", otb: "9.10", otbmVersion: 3, default: false },
		{ name: "9.20 - 9.31", otb: "9.20", otbmVersion: 3, default: false },
		{ name: "9.46", otb: "9.46", otbmVersion: 3, default: false },
		{ name: "9.54", otb: "9.54", otbmVersion: 3, default: false },
		{ name: "9.60", otb: "9.60", otbmVersion: 3, default: false },
		{ name: "9.70", otb: "9.70", otbmVersion: 3, default: false },
		{ name: "9.86", otb: "9.86", otbmVersion: 3, default: false },
		{ name: "10.10", otb: "10.10", otbmVersion: 3, default: false },
		{ name: "10.20", otb: "10.20", otbmVersion: 3, default: false },
		{ name: "10.21", otb: "10.21", otbmVersion: 3, default: false },
		{ name: "10.30", otb: "10.30", otbmVersion: 3, default: false },
		{ name: "10.31", otb: "10.31", otbmVersion: 3, default: false },
		{ name: "10.41", otb: "10.41", otbmVersion: 3, default: false },
		{ name: "10.77", otb: "10.77", otbmVersion: 3, default: false },
		{ name: "10.98", otb: "10.98", otbmVersion: 3, default: false },
		{ name: "10.100", otb: "10.100", otbmVersion: 3, default: false },
		{ name: "12.71 - 12.72", otb: "12.71", otbmVersion: 3, default: false },
		{ name: "12.81", otb: "12.81", otbmVersion: 3, default: false },
		{ name: "12.85", otb: "12.85", otbmVersion: 3, default: false },
		{ name: "12.86", otb: "12.86", otbmVersion: 3, default: false },
		{ name: "12.87", otb: "12.87", otbmVersion: 3, default: false },
		{ name: "12.90", otb: "12.90", otbmVersion: 3, default: false },
		{ name: "13.10", otb: "13.10", otbmVersion: 3, default: false }
	]
};

/**
 * Get client configuration by name
 * @param {string} clientName - The client name (e.g., "12.86")
 * @returns {Object|null} Client configuration or null if not found
 */
function getClientConfig(clientName) {
	return CLIENT_DATA.clients.find(c => c.name === clientName) || null;
}

/**
 * Get OTB version information for a client
 * @param {string} otbName - The OTB name (e.g., "12.86")
 * @returns {Object|null} OTB version info or null if not found
 */
function getOTBVersion(otbName) {
	return CLIENT_DATA.otbVersions[otbName] || null;
}

/**
 * Get the default client name
 * @returns {string} Default client name
 */
function getDefaultClient() {
	const defaultClient = CLIENT_DATA.clients.find(c => c.default === true);
	return defaultClient ? defaultClient.name : CLIENT_DATA.clients[CLIENT_DATA.clients.length - 1].name;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
	module.exports = { CLIENT_DATA, getClientConfig, getOTBVersion, getDefaultClient };
}

