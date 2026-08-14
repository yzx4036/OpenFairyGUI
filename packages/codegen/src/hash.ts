/** FNV-1a 32-bit to a positive 31-bit integer. */
export function fnv1a31(value: string): number {
	let hash = 0x811c9dc5;
	for (let index = 0; index < value.length; index++) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193);
	}
	const positive = hash >>> 0 & 0x7fffffff;
	return positive === 0 ? 1 : positive;
}
