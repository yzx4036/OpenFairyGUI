import {
	type CodegenWriteFile,
	isAbsolutePath,
	resolveProjectBasePath,
	trimTrailingSlashes,
	writeCodegenFiles,
} from '@openfairygui/codegen';
import type { Package } from '@openfairygui/core';
import type {
	CliCodeGenerationSettings,
	Plugin,
	PublishCodeGenerationOptions,
	PublishFileSystem,
} from '@openfairygui/functions';
import { buildCodegenOutputs, type EtCodegenOutput, type PlannedPackage } from './model.js';
import { mergeRegionContent, REGION_BEGIN, REGION_END } from './merge.js';
import {
	renderComponentBinding,
	renderFuiBinder,
	renderPanelEntity,
	renderPanelSystem,
	renderPanelId,
} from './templates.js';

export { hashPanelId } from './hash.js';
export type {
	EtCodegenComponent,
	EtCodegenMember,
	EtCodegenOutput,
	EtCodegenPackage,
	EtComponentRole,
} from './model.js';

export const name = 'et-fui-codegen';

export const genCode: NonNullable<Plugin['genCode']> = async (doc, settings, options) => {
	if (!settings.allowGenCode) return;

	const plans = options.packages
		.filter((pkg) => pkg.getGenCode())
		.map((pkg) => resolvePackagePlan(pkg, settings, options))
		.filter((plan): plan is PlannedPackage => plan !== null);

	if (plans.length === 0) {
		doc.getLogger().warn('et-fui-codegen: No package enabled code generation with a resolvable codePath.');
		return;
	}

	const outputs = buildCodegenOutputs(doc, plans, settings);
	for (const output of outputs) {
		await writeOutput(output, settings, options.fs, doc.getLogger());
	}
};

const plugin: Plugin = { genCode };
export default plugin;

function resolvePackagePlan(
	pkg: Package,
	settings: Required<CliCodeGenerationSettings>,
	options: PublishCodeGenerationOptions,
): PlannedPackage | null {
	const rawCodePath = (pkg.getCodePath() || settings.codePath || '').trim();
	if (!rawCodePath) return null;

	const outputDir = isAbsolutePath(rawCodePath)
		? trimTrailingSlashes(rawCodePath)
		: resolveRelativeCodePath(rawCodePath, options.basePath, options.fs);
	return { outputDir, pkg };
}

function resolveRelativeCodePath(
	codePath: string,
	basePath: string | undefined,
	fs: Pick<PublishFileSystem, 'join'>,
): string {
	const projectBasePath = resolveProjectBasePath(basePath);
	return trimTrailingSlashes(projectBasePath ? fs.join(projectBasePath, codePath) : codePath);
}

async function writeOutput(
	output: EtCodegenOutput,
	settings: Required<CliCodeGenerationSettings>,
	fs: PublishFileSystem,
	logger: { info(message: string): void; warn(message: string): void },
): Promise<void> {
	const autoGenDir = fs.join(output.outputDir, 'FUIAutoGen');
	const modelViewDir = fs.join(output.outputDir, 'ModelView');
	const hotfixViewDir = fs.join(output.outputDir, 'HotfixView');
	const directories = [output.outputDir, autoGenDir, modelViewDir, hotfixViewDir];

	// Render all content first (templates loaded & cached on first call)
	const panelIdContent = await renderPanelId(output);
	const binderContent = await renderFuiBinder(output);
	const files: CodegenWriteFile[] = [
		{ filePath: fs.join(autoGenDir, 'PanelId.cs'), content: panelIdContent, mode: 'overwrite' },
		{ filePath: fs.join(hotfixViewDir, 'FUIBinder.cs'), content: binderContent, mode: 'overwrite' },
	];

	// Entity files use region-marker merge: existing files with markers get
	// their marked regions replaced (hand-written code outside markers is kept);
	// marker-less old files fall back to preserve; new files are written fresh.
	const mergeFiles: Array<{ filePath: string; content: string; regionIds: string[] }> = [];
	const naivePreserve: CodegenWriteFile[] = [];

	for (const pkg of output.packages) {
		const packageModelDir = fs.join(modelViewDir, pkg.packageTypeName);
		const packageHotfixDir = fs.join(hotfixViewDir, pkg.packageTypeName);
		directories.push(packageModelDir, packageHotfixDir);

		for (const component of pkg.components) {
			files.push({
				filePath: fs.join(packageModelDir, `${component.bindingClassName}.cs`),
				content: await renderComponentBinding(component, settings),
				mode: 'overwrite',
			});
			if (!component.entityTypeName || component.role !== 'view') continue;

			const entityContent = await renderPanelEntity(component, output.baseNamespace);
			mergeFiles.push({
				filePath: fs.join(packageModelDir, `${component.entityTypeName}.cs`),
				content: entityContent,
				regionIds: [
					`${component.entityTypeName}:attributes`,
					`${component.entityTypeName}:view`,
				],
			});
			naivePreserve.push({
				filePath: fs.join(packageHotfixDir, `${component.entityTypeName}System.cs`),
				content: await renderPanelSystem(component, output.baseNamespace),
				mode: 'preserve',
			});
		}
	}

	const result = await writeCodegenFiles(fs, { directories, files });
	// System stubs stay on plain preserve (they are the hand-written work area).
	let systemPreserved = 0;
	for (const file of naivePreserve) {
		const systemResult = await writeCodegenFiles(fs, { directories: [], files: [file] });
		systemPreserved += systemResult.preserved;
	}
	// Entity stubs use region-marker merge.
	let mergedCount = 0;
	let preservedCount = 0;
	for (const file of mergeFiles) {
		const outcome = await writeMergeFile(fs, file.filePath, file.content, file.regionIds);
		if (outcome === 'merged') mergedCount++;
		else if (outcome === 'preserved') preservedCount++;
	}

	if (fs.readFileRaw && (mergedCount > 0 || preservedCount > 0 || systemPreserved > 0)) {
		logger.info(
			`et-fui-codegen: Merged ${mergedCount} region-marked Entity file(s), preserved ${preservedCount} marker-less Entity file(s) + ${systemPreserved} System file(s).`,
		);
	}
	logger.info(`et-fui-codegen: Generated ET/FairyGUI code into ${output.outputDir}.`);

	if (result.detectUnavailable) {
		logger.warn(
			'et-fui-codegen: Host filesystem cannot detect existing files; Entity/System preservation is unavailable.',
		);
	}
}

/**
 * Merge a generated file into an existing one using region markers.
 *  - File missing            → write fresh content           ('written')
 *  - File has markers        → replace marked regions only   ('merged')
 *  - File exists, no markers → fall back to preserve (skip)  ('preserved')
 */
async function writeMergeFile(
	fs: PublishFileSystem,
	filePath: string,
	generated: string,
	regionIds: string[],
): Promise<'written' | 'merged' | 'preserved'> {
	if (!fs.readFileRaw) return 'preserved'; // cannot detect/merge → preserve fallback
	let existingBytes: Uint8Array;
	try {
		existingBytes = await fs.readFileRaw(filePath);
	} catch {
		await fs.writeFileRaw(filePath, new TextEncoder().encode(generated));
		return 'written';
	}

	const existing = new TextDecoder().decode(existingBytes);
	const hasAnyMarker = regionIds.some((id) => existing.includes(REGION_BEGIN(id)));
	if (!hasAnyMarker) return 'preserved';

	const merged = mergeRegionContent(existing, generated, regionIds);
	if (merged === null) return 'preserved';
	await fs.writeFileRaw(filePath, new TextEncoder().encode(merged));
	return 'merged';
}
