const CSHARP_KEYWORDS = new Set([
	'abstract',
	'as',
	'base',
	'bool',
	'break',
	'byte',
	'case',
	'catch',
	'char',
	'checked',
	'class',
	'const',
	'continue',
	'decimal',
	'default',
	'delegate',
	'do',
	'double',
	'else',
	'enum',
	'event',
	'explicit',
	'extern',
	'false',
	'finally',
	'fixed',
	'float',
	'for',
	'foreach',
	'goto',
	'if',
	'implicit',
	'in',
	'int',
	'interface',
	'internal',
	'is',
	'lock',
	'long',
	'namespace',
	'new',
	'null',
	'object',
	'operator',
	'out',
	'override',
	'params',
	'private',
	'protected',
	'public',
	'readonly',
	'ref',
	'return',
	'sbyte',
	'sealed',
	'short',
	'sizeof',
	'stackalloc',
	'static',
	'string',
	'struct',
	'switch',
	'this',
	'throw',
	'true',
	'try',
	'typeof',
	'uint',
	'ulong',
	'unchecked',
	'unsafe',
	'ushort',
	'using',
	'virtual',
	'void',
	'volatile',
	'while',
]);

export function normalizeTypeName(value: string, fallback = 'Component'): string {
	const cleaned = value.replace(/[^0-9A-Za-z_]+/g, '_').replace(/^_+|_+$/g, '');
	const normalized = cleaned
		.split(/_+/)
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join('');
	return ensureCSharpIdentifier(normalized || fallback);
}

export function normalizeMemberName(value: string, fallback = 'member'): string {
	const cleaned = value.replace(/[^0-9A-Za-z_]+/g, '_').replace(/^_+|_+$/g, '');
	return ensureCSharpIdentifier(cleaned || fallback);
}

export function ensureCSharpIdentifier(value: string): string {
	let result = value;
	if (/^[0-9]/.test(result)) result = `_${result}`;
	if (CSHARP_KEYWORDS.has(result)) result = `_${result}`;
	return result;
}

export function escapeCSharpString(value: string): string {
	return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r/g, '\\r').replace(/\n/g, '\\n');
}

export function isAbsolutePath(value: string): boolean {
	return /^[a-z]:[/\\]/i.test(value) || value.startsWith('/') || value.startsWith('\\\\');
}

export function trimTrailingSlashes(value: string): string {
	return value.replace(/[/\\]+$/, '');
}

export function resolveProjectBasePath(basePath: string | undefined): string {
	if (!basePath) return '';
	const normalized = trimTrailingSlashes(basePath);
	const assetsMatch = normalized.match(/^(.*)[/\\]assets(?:_[^/\\]+)?$/i);
	if (assetsMatch?.[1]) return assetsMatch[1];
	const match = normalized.match(/^(.*)[/\\][^/\\]+$/);
	return match?.[1] ?? '';
}
