/**
 * Returns a stable, positive 31-bit panel id from the FairyGUI package and
 * component ids. FNV-1a is intentionally implemented with 32-bit arithmetic
 * so the result is identical on every JavaScript runtime.
 */
export function hashPanelId(packageId: string, componentId: string): number {
	const value = `${packageId}:${componentId}`;
	let hash = 0x811c9dc5;
	for (let index = 0; index < value.length; index++) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193);
	}

	const positive = hash >>> 0 & 0x7fffffff;
	return positive === 0 ? 1 : positive;
}
