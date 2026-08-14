import { Document, type ILogger } from '@openfairygui/core';
import type {
	CliCodeGenerationSettings,
	PublishCodeGenerationOptions,
	PublishFileSystem,
} from '@openfairygui/functions';
import test from 'ava';
import { genCode } from '../src/index.js';

const SETTINGS: Required<CliCodeGenerationSettings> = {
	allowGenCode: true,
	classNamePrefix: 'FUI_',
	memberNamePrefix: 'm_',
	packageName: 'ET.Client',
	ignoreNoname: true,
	getMemberByName: true,
	codePath: '',
	codeType: '',
};

class MemoryPublishFileSystem implements PublishFileSystem {
	readonly directories = new Set<string>();
	readonly files = new Map<string, Uint8Array>();
	readonly writes: string[] = [];

	async mkdir(path: string): Promise<void> {
		this.directories.add(path);
	}

	async writeFileRaw(path: string, bytes: Uint8Array): Promise<void> {
		this.files.set(path, bytes.slice());
		this.writes.push(path);
	}

	async exists(path: string): Promise<boolean> {
		return this.files.has(path);
	}

	join(...paths: string[]): string {
		return paths.filter(Boolean).join('/').replace(/\/+/g, '/');
	}
}

class MemoryLogger implements ILogger {
	readonly infos: string[] = [];
	readonly warnings: string[] = [];

	debug(): void {}

	info(message: string): void {
		this.infos.push(message);
	}

	warn(message: string): void {
		this.warnings.push(message);
	}

	error(): void {}
}

test.serial('genCode overwrites automatic files and preserves Entity/System files after first creation', async (t) => {
	const { doc, options, fs, logger } = createFixture();

	await genCode(doc, SETTINGS, options);

	const automaticPaths = [
		'generated/FUIAutoGen/PanelId.cs',
		'generated/HotfixView/FUIBinder.cs',
		'generated/ModelView/MainPkg/FUI_MainPanel.cs',
	];
	const preservedPaths = [
		'generated/ModelView/MainPkg/MainPanel.cs',
		'generated/HotfixView/MainPkg/MainPanelSystem.cs',
	];
	t.deepEqual(fs.writes.slice().sort(), [...automaticPaths, ...preservedPaths].sort());
	for (const path of automaticPaths) {
		t.regex(readText(fs, path), /automatically generated class by OpenFairyGUI et-fui-codegen/);
	}
	for (const path of preservedPaths) {
		t.regex(readText(fs, path), /Generated once by OpenFairyGUI et-fui-codegen/);
	}
	t.deepEqual(logger.infos, ['et-fui-codegen: Generated ET/FairyGUI code into generated.']);
	t.deepEqual(logger.warnings, []);

	for (const path of automaticPaths) fs.files.set(path, encode(`stale automatic: ${path}`));
	for (const path of preservedPaths) fs.files.set(path, encode(`user preserved: ${path}`));
	fs.writes.length = 0;
	logger.infos.length = 0;
	logger.warnings.length = 0;

	await genCode(doc, SETTINGS, options);

	t.deepEqual(fs.writes.slice().sort(), automaticPaths.slice().sort());
	for (const path of automaticPaths) {
		t.notRegex(readText(fs, path), /^stale automatic:/);
	}
	for (const path of preservedPaths) {
		t.is(readText(fs, path), `user preserved: ${path}`);
	}
	t.deepEqual(logger.infos, [
		'et-fui-codegen: Preserved 2 existing Entity/System file(s).',
		'et-fui-codegen: Generated ET/FairyGUI code into generated.',
	]);
	t.deepEqual(logger.warnings, []);
});

test.serial('genCode keeps legacy warning when preserve detection is unavailable', async (t) => {
	const { doc, options, fs, logger } = createFixture();
	const fsWithoutDetection: PublishFileSystem = {
		join: (...paths) => fs.join(...paths),
		mkdir: (path) => fs.mkdir(path),
		writeFileRaw: (path, bytes) => fs.writeFileRaw(path, bytes),
	};

	await genCode(doc, SETTINGS, { ...options, fs: fsWithoutDetection });

	t.is(fs.writes.length, 5);
	t.deepEqual(logger.infos, ['et-fui-codegen: Generated ET/FairyGUI code into generated.']);
	t.deepEqual(logger.warnings, [
		'et-fui-codegen: Host filesystem cannot detect existing files; Entity/System preservation is unavailable.',
	]);
});

function createFixture(): {
	doc: Document;
	fs: MemoryPublishFileSystem;
	logger: MemoryLogger;
	options: PublishCodeGenerationOptions;
} {
	const doc = new Document();
	const logger = new MemoryLogger();
	doc.setLogger(logger);

	const pkg = doc.createPackage('MainPkg');
	pkg.setId('main0001').setGenCode(true).setCodePath('generated');
	const panel = doc.createComponent('MainPanel');
	panel.setId('panel001').setExported(true).setRemark('Type:View|Layer:Normal');
	pkg.addResource(panel);

	const fs = new MemoryPublishFileSystem();
	return { doc, fs, logger, options: { fs, packages: [pkg] } };
}

function readText(fs: MemoryPublishFileSystem, path: string): string {
	const bytes = fs.files.get(path);
	if (!bytes) throw new Error(`Expected generated file ${path}.`);
	return new TextDecoder().decode(bytes);
}

function encode(value: string): Uint8Array {
	return new TextEncoder().encode(value);
}
