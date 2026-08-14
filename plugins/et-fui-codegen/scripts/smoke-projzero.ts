import { access, cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@openfairygui/core/node';
import type { RootProjectSettings } from '@openfairygui/functions';
import { publishNode } from '@openfairygui/functions/node';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const pluginDir = resolve(scriptDir, '..');
const repositoryRoot = resolve(scriptDir, '../../..');
const codegenDir = join(repositoryRoot, 'packages', 'codegen');

async function main(): Promise<void> {
	const sourceProject = process.argv[2] ? resolve(process.argv[2]) : '';
	if (!sourceProject) {
		throw new Error('Usage: pnpm --filter et-fui-codegen smoke:projzero -- <path-to-FGUIProject>');
	}

	const projectFile = await findProjectFile(sourceProject);
	const temporaryRoot = await mkdtemp(join(tmpdir(), 'openfairygui-et-codegen-'));
	const copiedProject = join(temporaryRoot, basename(sourceProject));

	try {
		console.info(`Copying FairyGUI project to ${copiedProject}`);
		await cp(sourceProject, copiedProject, {
			recursive: true,
			filter: (source) => shouldCopyProjectPath(sourceProject, source),
		});

		await installPlugin(copiedProject);
		await installCodegenPackage(copiedProject);

		const copiedProjectFile = join(copiedProject, basename(projectFile));
		const document = await new NodeIO().readProject(copiedProjectFile);
		const loginPackage = document.getRoot().getPackage('Login');
		if (!loginPackage) throw new Error('The copied FairyGUI project does not contain the expected Login package.');

		for (const pkg of document.getRoot().listPackages()) pkg.setGenCode(false);
		loginPackage.setGenCode(true).setCodePath('generated-et');

		const settings = document.getRoot().getSettings() as RootProjectSettings;
		document.getRoot().setSettings({
			...settings,
			publish: {
				...settings.publish,
				codeGeneration: {
					...settings.publish?.codeGeneration,
					allowGenCode: true,
					classNamePrefix: 'FUI_',
					memberNamePrefix: '',
					packageName: 'ET.Client',
					ignoreNoname: true,
					getMemberByName: true,
					codePath: 'generated-et',
					codeType: '',
				},
			},
		});

		await publishNode({
			document,
			output: join(copiedProject, 'release-smoke'),
			packages: ['Login'],
		});

		const generatedRoot = join(copiedProject, 'generated-et');
		await assertGeneratedFile(join(generatedRoot, 'FUIAutoGen', 'PanelId.cs'), 'OpenFairyGUI et-fui-codegen');
		await assertGeneratedFile(
			join(generatedRoot, 'ModelView', 'Login', 'FUI_LoginPanel.cs'),
			'namespace ET.Client.Login',
		);
		await assertGeneratedFile(
			join(generatedRoot, 'ModelView', 'Login', 'LoginPanel.cs'),
			'class LoginPanel : Entity, IAwake',
		);
		await assertGeneratedFile(
			join(generatedRoot, 'HotfixView', 'Login', 'LoginPanelSystem.cs'),
			'class LoginPanelSystem',
		);
		await assertGeneratedFile(
			join(generatedRoot, 'HotfixView', 'FUIBinder.cs'),
			'SetPackageItemExtension(ET.Client.Login.FUI_LoginPanel.URL',
		);

		console.info('et-fui-codegen ProjZero smoke test passed.');
	} finally {
		await rm(temporaryRoot, { recursive: true, force: true });
	}
}

async function findProjectFile(projectDirectory: string): Promise<string> {
	const entries = await readdir(projectDirectory, { withFileTypes: true });
	const projectFiles = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.fairy'));
	if (projectFiles.length !== 1) {
		throw new Error(
			`Expected exactly one .fairy project file in ${projectDirectory}, found ${projectFiles.length}.`,
		);
	}
	return join(projectDirectory, projectFiles[0].name);
}

function shouldCopyProjectPath(projectDirectory: string, source: string): boolean {
	const pathFromProject = relative(projectDirectory, source);
	if (!pathFromProject) return true;
	const segments = pathFromProject.split(sep);
	return !segments.includes('.objs') && segments[0] !== 'plugins';
}

async function installPlugin(projectDirectory: string): Promise<void> {
	const destination = join(projectDirectory, 'plugins', 'et-fui-codegen');
	await mkdir(destination, { recursive: true });
	await Promise.all([
		cp(join(pluginDir, 'src'), join(destination, 'src'), { recursive: true }),
		cp(join(pluginDir, 'package.json'), join(destination, 'package.json')),
	]);
}

async function installCodegenPackage(projectDirectory: string): Promise<void> {
	const destination = join(projectDirectory, 'node_modules', '@openfairygui', 'codegen');
	const packageJson = JSON.parse(await readFile(join(codegenDir, 'package.json'), 'utf8')) as Record<string, unknown>;
	packageJson.main = './src/index.ts';
	packageJson.module = './src/index.ts';
	packageJson.types = './src/index.ts';
	packageJson.exports = { '.': './src/index.ts' };

	await mkdir(destination, { recursive: true });
	await Promise.all([
		cp(join(codegenDir, 'src'), join(destination, 'src'), { recursive: true }),
		writeFile(join(destination, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8'),
	]);
	await access(join(destination, 'src', 'index.ts'));
}

async function assertGeneratedFile(filePath: string, expectedText: string): Promise<void> {
	const content = await readFile(filePath, 'utf8');
	if (!content.includes(expectedText)) {
		throw new Error(`Generated file ${filePath} does not contain expected text: ${expectedText}`);
	}
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
});
