import test from 'ava';
import { type CodegenWriterFs, writeCodegenFiles } from '../src/index.js';

class MemoryWriterFs implements CodegenWriterFs {
	readonly directories = new Set<string>();
	readonly files = new Map<string, Uint8Array>();

	async mkdir(path: string): Promise<void> {
		this.directories.add(path);
	}

	async writeFileRaw(path: string, bytes: Uint8Array): Promise<void> {
		this.files.set(path, bytes.slice());
	}

	async exists(path: string): Promise<boolean> {
		return this.files.has(path);
	}
}

test('creates directories and writes overwrite files', async (t) => {
	const fs = new MemoryWriterFs();
	fs.files.set('generated.cs', new TextEncoder().encode('old'));

	const result = await writeCodegenFiles(fs, {
		directories: ['generated', 'preserved'],
		files: [{ filePath: 'generated.cs', content: 'new', mode: 'overwrite' }],
	});

	t.deepEqual([...fs.directories].sort(), ['generated', 'preserved']);
	t.is(new TextDecoder().decode(fs.files.get('generated.cs')), 'new');
	t.deepEqual(result, { written: 1, preserved: 0, detectUnavailable: false });
});

test('preserves existing files and writes missing files', async (t) => {
	const fs = new MemoryWriterFs();
	fs.files.set('existing.cs', new TextEncoder().encode('keep'));

	const result = await writeCodegenFiles(fs, {
		directories: [],
		files: [
			{ filePath: 'existing.cs', content: 'replace', mode: 'preserve' },
			{ filePath: 'missing.cs', content: 'create', mode: 'preserve' },
		],
	});

	t.is(new TextDecoder().decode(fs.files.get('existing.cs')), 'keep');
	t.is(new TextDecoder().decode(fs.files.get('missing.cs')), 'create');
	t.deepEqual(result, { written: 1, preserved: 1, detectUnavailable: false });
});

test('uses readFileRaw when exists is unavailable', async (t) => {
	const files = new Map<string, Uint8Array>([['existing.cs', new TextEncoder().encode('keep')]]);
	const fs: CodegenWriterFs = {
		async mkdir() {},
		async readFileRaw(path) {
			const bytes = files.get(path);
			if (!bytes) throw new Error('missing');
			return bytes;
		},
		async writeFileRaw(path, bytes) {
			files.set(path, bytes.slice());
		},
	};

	const result = await writeCodegenFiles(fs, {
		directories: [],
		files: [
			{ filePath: 'existing.cs', content: 'replace', mode: 'preserve' },
			{ filePath: 'missing.cs', content: 'create', mode: 'preserve' },
		],
	});

	t.is(new TextDecoder().decode(files.get('existing.cs')), 'keep');
	t.is(new TextDecoder().decode(files.get('missing.cs')), 'create');
	t.deepEqual(result, { written: 1, preserved: 1, detectUnavailable: false });
});

test('falls back to writing when detection is unavailable and warns once', async (t) => {
	const files = new Map<string, Uint8Array>();
	const warnings: string[] = [];
	const fs: CodegenWriterFs = {
		async mkdir() {},
		async writeFileRaw(path, bytes) {
			files.set(path, bytes.slice());
		},
	};

	const result = await writeCodegenFiles(
		fs,
		{
			directories: [],
			files: [{ filePath: 'preserved.cs', content: 'write', mode: 'preserve' }],
		},
		{ info() {}, warn(message) { warnings.push(message); } },
	);

	t.is(new TextDecoder().decode(files.get('preserved.cs')), 'write');
	t.deepEqual(result, { written: 1, preserved: 0, detectUnavailable: true });
	t.deepEqual(warnings, ['Codegen writer cannot detect existing files; preserve-mode files will be overwritten.']);
});
