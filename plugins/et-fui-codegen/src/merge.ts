/**
 * Region-marker merge for generated C# files.
 *
 * Generated files declare replaceable regions with marker comment pairs:
 *
 *   // ===== GENERATED:et-fui-codegen:<regionId>:BEGIN =====
 *   ... generated content ...
 *   // ===== GENERATED:et-fui-codegen:<regionId>:END =====
 *
 * `mergeRegionContent` replaces only those regions in an existing file,
 * leaving everything outside the markers (hand-written business code)
 * untouched. Files without markers fall back to the caller's preserve
 * semantics (return null → do not write).
 */

export const REGION_BEGIN = (regionId: string) => `// ===== GENERATED:et-fui-codegen:${regionId}:BEGIN =====`;
export const REGION_END = (regionId: string) => `// ===== GENERATED:et-fui-codegen:${regionId}:END =====`;

const SPACE_TAB = '[ \\t]*';

function regionPattern(regionId: string): RegExp {
	const beginMark = `// ===== GENERATED:et-fui-codegen:${escapeRegExp(regionId)}:BEGIN =====`;
	const endMark = `// ===== GENERATED:et-fui-codegen:${escapeRegExp(regionId)}:END =====`;
	// Non-greedy match between BEGIN line and END line, without crossing any
	// other GENERATED marker; 's' flag makes '.' span newlines.
	return new RegExp(
		`(${SPACE_TAB}${beginMark}${SPACE_TAB}\\r?\\n)(?:(?!// ===== GENERATED:et-fui-codegen:).)*?(${SPACE_TAB}${endMark}${SPACE_TAB}\\r?\\n)`,
		'ms',
	);
}

/**
 * Merge a freshly rendered file into an existing file by replacing each
 * region marker block (with its own marker lines preserved).
 *
 * @param existing   Current on-disk content of the file (may contain hand-written code).
 * @param generated  Freshly rendered content containing marker pairs.
 * @param regionIds  Region ids to merge. Unknown regions are ignored.
 * @returns Merged content, or null when the existing file contains no markers
 *          for any of the given region ids (caller should preserve the file).
 */
export function mergeRegionContent(existing: string, generated: string, regionIds: string[]): string | null {
	let merged = existing;
	let touched = false;

	for (const regionId of regionIds) {
		const begin = REGION_BEGIN(regionId);
		const end = REGION_END(regionId);

		// Fresh block from the generated render (markers + inner content).
		const freshStart = generated.indexOf(begin);
		const freshEnd = generated.indexOf(end, freshStart + begin.length);
		if (freshStart < 0 || freshEnd < 0) continue; // render no longer emits this region
		const freshBlock = generated.slice(freshStart, freshEnd + end.length);

		const pattern = regionPattern(regionId);
		if (pattern.test(merged)) {
			// Replace existing region block, keeping marker lines from the fresh render.
			merged = merged.replace(pattern, () => freshBlock);
			touched = true;
		} else {
			// Region does not exist yet in the target: append it inside the first
			// class body of the existing file (conservative insert).
			const insertion = insertAfterClassOpen(merged, freshBlock);
			if (insertion !== null) {
				merged = insertion;
				touched = true;
			}
		}
	}

	return touched ? merged : null;
}

/**
 * Insert a fresh marker block right after the opening brace of the first
 * class declaration in `source`. Returns null when no class brace is found
 * (caller should fall back to preserve semantics).
 */
function insertAfterClassOpen(source: string, block: string): string | null {
	const braceIndex = source.indexOf('{');
	if (braceIndex < 0) return null;
	return source.slice(0, braceIndex + 1) + '\n' + block + '\n' + source.slice(braceIndex + 1);
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}