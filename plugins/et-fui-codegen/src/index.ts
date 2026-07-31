import type { Package } from '@openfairygui/core';
import type {
	CliCodeGenerationSettings,
	Plugin,
	PublishCodeGenerationOptions,
	PublishFileSystem,
} from '@openfairygui/functions';
import { buildCodegenOutputs, type EtCodegenOutput, type PlannedPackage } from './model.js';
import { isAbsolutePath, resolveProjectBasePath, trimTrailingSlashes } from './naming.js';
import {
	renderComponentBinding,
	renderFuiBinder,
	renderPanelEntity,
	renderPanelId,
	renderPanelSystem,
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
	await fs.mkdir(output.outputDir);
	const autoGenDir = fs.join(output.outputDir, 'FUIAutoGen');
	const modelViewDir = fs.join(output.outputDir, 'ModelView');
	const hotfixViewDir = fs.join(output.outputDir, 'HotfixView');
	await Promise.all([fs.mkdir(autoGenDir), fs.mkdir(modelViewDir), fs.mkdir(hotfixViewDir)]);

	// Render all content first (templates loaded & cached on first call)
	const panelIdContent = await renderPanelId(output);
	const binderContent = await renderFuiBinder(output);
	const automaticWrites: Array<Promise<void>> = [
		writeText(fs, fs.join(autoGenDir, 'PanelId.cs'), panelIdContent),
		writeText(fs, fs.join(hotfixViewDir, 'FUIBinder.cs'), binderContent),
	];
	const preservedWrites: Array<Promise<boolean>> = [];

	for (const pkg of output.packages) {
		const packageModelDir = fs.join(modelViewDir, pkg.packageTypeName);
		const packageHotfixDir = fs.join(hotfixViewDir, pkg.packageTypeName);
		await Promise.all([fs.mkdir(packageModelDir), fs.mkdir(packageHotfixDir)]);

		for (const component of pkg.components) {
			automaticWrites.push((async () => {
				const content = await renderComponentBinding(component, settings);
				await writeText(fs, fs.join(packageModelDir, `${component.bindingClassName}.cs`), content);
			})());
			if (!component.entityTypeName) continue;

			preservedWrites.push((async () => {
				const content = await renderPanelEntity(component, output.baseNamespace);
				return writeTextIfMissing(fs, fs.join(packageModelDir, `${component.entityTypeName}.cs`), content);
			})(), (async () => {
				const content = await renderPanelSystem(component, output.baseNamespace);
				return writeTextIfMissing(fs, fs.join(packageHotfixDir, `${component.entityTypeName}System.cs`), content);
			})());
		}
	}

	await Promise.all(automaticWrites);
	const created = await Promise.all(preservedWrites);
	const preservedCount = created.filter((wasCreated) => !wasCreated).length;
	if (preservedCount > 0) {
		logger.info(`et-fui-codegen: Preserved ${preservedCount} existing Entity/System file(s).`);
	}
	logger.info(`et-fui-codegen: Generated ET/FairyGUI code into ${output.outputDir}.`);

	if (!fs.exists && !fs.readFileRaw) {
		logger.warn('et-fui-codegen: Host filesystem cannot detect existing files; Entity/System preservation is unavailable.');
	}
}

async function writeText(fs: PublishFileSystem, filePath: string, content: string): Promise<void> {
	await fs.writeFileRaw(filePath, new TextEncoder().encode(content));
}

async function writeTextIfMissing(fs: PublishFileSystem, filePath: string, content: string): Promise<boolean> {
	if (await fileExists(fs, filePath)) return false;
	await writeText(fs, filePath, content);
	return true;
}

async function fileExists(fs: PublishFileSystem, filePath: string): Promise<boolean> {
	if (fs.exists) return fs.exists(filePath);
	if (!fs.readFileRaw) return false;
	try {
		await fs.readFileRaw(filePath);
		return true;
	} catch {
		return false;
	}
}
