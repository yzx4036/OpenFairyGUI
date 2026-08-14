/**
 * Template-based C# code generation.
 *
 * All templates live in ./templates/*.tpl and use $key$ placeholder syntax
 * matching ProjZero's FUITemplateEngine (see engine.ts for syntax reference).
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { escapeCSharpString, renderTemplate } from '@openfairygui/codegen';
import type { CliCodeGenerationSettings } from '@openfairygui/functions';
import type { EtCodegenComponent, EtCodegenOutput } from './model.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TPL_DIR = join(__dirname, 'templates');

// ── cached templates ────────────────────────────────────────────────
// Promise-based cache: concurrent cold-start callers share one load,
// nobody ever observes a half-populated cache.
let _cachePromise: Promise<Record<string, string>> | null = null;

function loadTemplates(): Promise<Record<string, string>> {
	if (!_cachePromise) {
		_cachePromise = (async () => {
			const files = ['component-binding', 'panel-entity', 'panel-system', 'panel-id', 'fui-binder'];
			const entries = await Promise.all(
				files.map(async (f) => [f, await readFile(join(TPL_DIR, `${f}.tpl`), 'utf-8')] as const),
			);
			return Object.fromEntries(entries);
		})();
	}
	return _cachePromise;
}

async function loadTpl(name: string): Promise<string> {
	return (await loadTemplates())[name];
}

// ── public API ──────────────────────────────────────────────────────

export async function renderComponentBinding(
	component: EtCodegenComponent,
	settings: Required<CliCodeGenerationSettings>,
): Promise<string> {
	const tpl = await loadTpl('component-binding');

	// pre-render fields and assignments
	const fields = component.members.length
		? component.members.map((m) => `\t\tpublic ${m.typeName} ${m.fieldName};`).join('\n') + '\n'
		: '';
	const assignments = component.members.length
		? '\n' +
			component.members.map((m) => `\t\t\t${renderMemberAssignment(m, settings.getMemberByName)}`).join('\n') +
			'\n'
		: '';

	return renderTemplate(tpl, {
		scalars: {
			generated_mark: AUTO_GENERATED_MARK,
			namespace: component.bindingNamespace,
			package_name: escapeCSharpString(component.packageName),
			component_name: escapeCSharpString(component.componentName),
			class_name: component.bindingClassName,
			base_type: component.fairyGuiBaseType,
			url: escapeCSharpString(component.url),
			fields,
			assignments,
		},
		loops: {},
	});
}

export async function renderPanelEntity(component: EtCodegenComponent, baseNamespace: string): Promise<string> {
	assertEntity(component);
	const tpl = await loadTpl('panel-entity');
	return renderTemplate(tpl, {
		scalars: {
			preserved_mark: PRESERVED_MARK,
			binding_namespace: component.bindingNamespace,
			base_namespace: baseNamespace,
			entity_name: component.entityTypeName!,
			binding_class: component.bindingClassName,
			package_name: escapeCSharpString(component.packageName),
			component_name: escapeCSharpString(component.componentName),
			layer: component.layer,
		},
		loops: {},
	});
}

export async function renderPanelSystem(component: EtCodegenComponent, baseNamespace: string): Promise<string> {
	assertEntity(component);
	const tpl = await loadTpl('panel-system');
	return renderTemplate(tpl, {
		scalars: {
			preserved_mark: PRESERVED_MARK,
			base_namespace: baseNamespace,
			entity_name: component.entityTypeName!,
		},
		loops: {},
	});
}

export async function renderPanelId(output: EtCodegenOutput): Promise<string> {
	const tpl = await loadTpl('panel-id');
	const panels = output.packages
		.flatMap((pkg) => pkg.components)
		.filter((c) => c.role === 'view')
		.sort((a, b) => a.entityTypeName!.localeCompare(b.entityTypeName!));

	return renderTemplate(tpl, {
		scalars: {
			generated_mark: AUTO_GENERATED_MARK,
			base_namespace: output.baseNamespace,
		},
		loops: {
			panels: panels.map((p) => ({ name: p.entityTypeName!, id: String(p.panelId) })),
		},
	});
}

export async function renderFuiBinder(output: EtCodegenOutput): Promise<string> {
	const tpl = await loadTpl('fui-binder');
	const components = output.packages
		.flatMap((pkg) => pkg.components)
		.sort((a, b) => a.packageId.localeCompare(b.packageId) || a.componentId.localeCompare(b.componentId));

	return renderTemplate(tpl, {
		scalars: {
			generated_mark: AUTO_GENERATED_MARK,
			base_namespace: output.baseNamespace,
		},
		loops: {
			components: components.map((c) => ({
				full_class: `${c.bindingNamespace}.${c.bindingClassName}`,
			})),
		},
	});
}

// ── helpers ─────────────────────────────────────────────────────────

export const AUTO_GENERATED_MARK =
	'/** This is an automatically generated class by OpenFairyGUI et-fui-codegen. Please do not modify it. **/';

export const PRESERVED_MARK =
	'/** Generated once by OpenFairyGUI et-fui-codegen. This file is preserved on later publishes. **/';

function renderMemberAssignment(member: EtCodegenComponent['members'][number], getMemberByName: boolean): string {
	if (member.kind === 'controller') {
		return getMemberByName
			? `${member.fieldName} = GetController("${escapeCSharpString(member.originalName)}");`
			: `${member.fieldName} = GetControllerAt(${member.index});`;
	}
	if (member.kind === 'transition') {
		return getMemberByName
			? `${member.fieldName} = GetTransition("${escapeCSharpString(member.originalName)}");`
			: `${member.fieldName} = GetTransitionAt(${member.index});`;
	}
	return getMemberByName
		? `${member.fieldName} = (${member.typeName})GetChild("${escapeCSharpString(member.originalName)}");`
		: `${member.fieldName} = (${member.typeName})GetChildAt(${member.index});`;
}

function assertEntity(
	component: EtCodegenComponent,
): asserts component is EtCodegenComponent & { entityTypeName: string } {
	if (!component.entityTypeName) {
		throw new Error(
			`Component ${component.packageName}/${component.componentName} does not generate an ET entity.`,
		);
	}
}
