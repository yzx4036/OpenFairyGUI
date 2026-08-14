export interface CodegenWriteFile {
	filePath: string;
	content: string;
	mode: 'overwrite' | 'preserve';
}

export interface CodegenWriterFs {
	mkdir(path: string): Promise<void>;
	writeFileRaw(path: string, bytes: Uint8Array): Promise<void>;
	exists?(path: string): Promise<boolean>;
	readFileRaw?(path: string): Promise<Uint8Array>;
}

export interface CodegenWriteResult {
	written: number;
	preserved: number;
	detectUnavailable: boolean;
}

export async function writeCodegenFiles(
	fs: CodegenWriterFs,
	options: { directories: string[]; files: CodegenWriteFile[] },
	logger?: { info(message: string): void; warn(message: string): void },
): Promise<CodegenWriteResult> {
	await Promise.all(options.directories.map((directory) => fs.mkdir(directory)));

	const detectUnavailable = !fs.exists && !fs.readFileRaw;
	if (detectUnavailable) {
		logger?.warn('Codegen writer cannot detect existing files; preserve-mode files will be overwritten.');
	}

	const results = await Promise.all(
		options.files.map(async (file): Promise<'written' | 'preserved'> => {
			if (file.mode === 'preserve' && (await fileExists(fs, file.filePath))) return 'preserved';
			await fs.writeFileRaw(file.filePath, new TextEncoder().encode(file.content));
			return 'written';
		}),
	);

	return {
		written: results.filter((result) => result === 'written').length,
		preserved: results.filter((result) => result === 'preserved').length,
		detectUnavailable,
	};
}

async function fileExists(fs: CodegenWriterFs, filePath: string): Promise<boolean> {
	if (fs.exists) return fs.exists(filePath);
	if (!fs.readFileRaw) return false;
	try {
		await fs.readFileRaw(filePath);
		return true;
	} catch {
		return false;
	}
}
