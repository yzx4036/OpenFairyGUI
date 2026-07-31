import type {
	Component,
	Document,
	GComponent,
	GObject,
	Package,
} from '@openfairygui/core';
import type { CliCodeGenerationSettings } from '@openfairygui/functions';
import { hashPanelId } from './hash.js';
import { ensureCSharpIdentifier, normalizeMemberName, normalizeTypeName } from './naming.js';

export type EtComponentRole = 'view' | 'component' | 'binding';
export type EtMemberKind = 'child' | 'controller' | 'transition';

export interface PlannedPackage {
	outputDir: string;
	pkg: Package;
}

export interface EtCodegenMember {
	fieldName: string;
	index: number;
	kind: EtMemberKind;
	originalName: string;
	typeName: string;
}

export interface EtCodegenComponent {
	bindingClassName: string;
	bindingNamespace: string;
	component: Component;
	componentId: string;
	componentName: string;
	componentTypeName: string;
	entityTypeName?: string;
	fairyGuiBaseType: string;
	layer: string;
	members: EtCodegenMember[];
	packageId: string;
	packageName: string;
	packageTypeName: string;
	panelId?: number;
	role: EtComponentRole;
	url: string;
}

export interface EtCodegenPackage {
	bindingNamespace: string;
	components: EtCodegenComponent[];
	packageId: string;
	packageName: string;
	packageTypeName: string;
}

export interface EtCodegenOutput {
	baseNamespace: string;
	outputDir: string;
	packages: EtCodegenPackage[];
}

interface ComponentDraft extends Omit<EtCodegenComponent, 'entityTypeName' | 'members' | 'panelId'> {
	entityBaseName?: string;
	entityTypeName?: string;
	members: EtCodegenMember[];
	panelId?: number;
}

interface ParsedRemark {
	explicit: boolean;
	layer: string;
	role: EtComponentRole;
}

export function buildCodegenOutputs(
	doc: Document,
	plans: PlannedPackage[],
	settings: Required<CliCodeGenerationSettings>,
): EtCodegenOutput[] {
	const baseNamespace = normalizeNamespace(settings.packageName || 'ET.Client');
	const packageTypeNames = assertUniquePackageTypeNames(plans);
	const drafts: ComponentDraft[] = [];

	for (const { pkg } of plans) {
		const packageName = pkg.getName();
		const packageId = pkg.getId();
		const packageTypeName = packageTypeNames.get(pkg)!;
		const bindingNamespace = `${baseNamespace}.${packageTypeName}`;
		const seenBindingClasses = new Map<string, string>();

		for (const component of [...pkg.listComponents()].sort(compareComponents)) {
			const componentName = component.getName().replace(/\.xml$/i, '');
			const componentTypeName = normalizeTypeName(componentName);
			const bindingClassName = normalizeMemberName(`${settings.classNamePrefix}${componentTypeName}`, 'FUI_Component');
			const previous = seenBindingClasses.get(bindingClassName);
			if (previous) {
				throw new Error(
					`Package "${packageName}" has components "${previous}" and "${componentName}" that normalize to ${bindingClassName}.`,
				);
			}
			seenBindingClasses.set(bindingClassName, componentName);

			const remark = parseRemark(component.getRemark?.() ?? '');
			const entityBaseName = remark.role === 'binding'
				? undefined
				: remark.explicit
					? componentTypeName
					: componentTypeName.endsWith('Panel')
						? componentTypeName
						: `${componentTypeName}Panel`;

			drafts.push({
				bindingClassName,
				bindingNamespace,
				component,
				componentId: component.getId(),
				componentName,
				componentTypeName,
				entityBaseName,
				fairyGuiBaseType: resolveComponentBaseType(component),
				layer: remark.layer,
				members: [],
				packageId,
				packageName,
				packageTypeName,
				role: remark.role,
				url: `ui://${packageId}${component.getId()}`,
			});
		}
	}

	resolveEntityNames(drafts);
	assignPanelIds(drafts);
	const generatedByResource = new Map(drafts.map((draft) => [resourceKey(draft.packageId, draft.componentId), draft]));
	const packagesById = new Map(doc.getRoot().listPackages().map((pkg) => [pkg.getId(), pkg]));

	for (const draft of drafts) {
		draft.members = buildMembers(draft, settings, generatedByResource, packagesById);
	}

	const draftsByPackage = new Map<Package, ComponentDraft[]>();
	for (const draft of drafts) {
		const plan = plans.find((candidate) => candidate.pkg.getId() === draft.packageId);
		if (!plan) continue;
		const list = draftsByPackage.get(plan.pkg) ?? [];
		list.push(draft);
		draftsByPackage.set(plan.pkg, list);
	}

	const grouped = new Map<string, PlannedPackage[]>();
	for (const plan of plans) {
		const list = grouped.get(plan.outputDir) ?? [];
		list.push(plan);
		grouped.set(plan.outputDir, list);
	}

	return [...grouped.entries()]
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([outputDir, groupedPlans]) => ({
			baseNamespace,
			outputDir,
			packages: groupedPlans
				.map(({ pkg }) => ({
					bindingNamespace: `${baseNamespace}.${packageTypeNames.get(pkg)!}`,
					components: [...(draftsByPackage.get(pkg) ?? [])].sort(compareCodegenComponents),
					packageId: pkg.getId(),
					packageName: pkg.getName(),
					packageTypeName: packageTypeNames.get(pkg)!,
				}))
				.sort((left, right) => left.packageId.localeCompare(right.packageId)),
		}));
}

function assertUniquePackageTypeNames(plans: PlannedPackage[]): Map<Package, string> {
	const result = new Map<Package, string>();
	const seen = new Map<string, Package>();
	for (const { pkg } of plans) {
		const typeName = normalizeTypeName(pkg.getName(), 'Package');
		const previous = seen.get(typeName);
		if (previous && previous.getId() !== pkg.getId()) {
			throw new Error(
				`Packages "${previous.getName()}" and "${pkg.getName()}" normalize to the same C# namespace ${typeName}.`,
			);
		}
		seen.set(typeName, pkg);
		result.set(pkg, typeName);
	}
	return result;
}

function resolveEntityNames(drafts: ComponentDraft[]): void {
	const byBaseName = new Map<string, ComponentDraft[]>();
	for (const draft of drafts) {
		if (!draft.entityBaseName) continue;
		const list = byBaseName.get(draft.entityBaseName) ?? [];
		list.push(draft);
		byBaseName.set(draft.entityBaseName, list);
	}

	for (const [baseName, matches] of byBaseName) {
		for (const draft of matches) {
			draft.entityTypeName = matches.length === 1 ? baseName : `${draft.packageTypeName}${baseName}`;
		}
	}
}

function assignPanelIds(drafts: ComponentDraft[]): void {
	const byId = new Map<number, ComponentDraft>();
	for (const draft of drafts.filter((candidate) => candidate.role === 'view')) {
		const panelId = hashPanelId(draft.packageId, draft.componentId);
		const previous = byId.get(panelId);
		if (previous) {
			throw new Error(
				`PanelId hash collision ${panelId}: ${previous.packageName}/${previous.componentName} and ${draft.packageName}/${draft.componentName}.`,
			);
		}
		byId.set(panelId, draft);
		draft.panelId = panelId;
	}
}

function buildMembers(
	draft: ComponentDraft,
	settings: Required<CliCodeGenerationSettings>,
	generatedByResource: Map<string, ComponentDraft>,
	packagesById: Map<string, Package>,
): EtCodegenMember[] {
	const candidates: Array<Omit<EtCodegenMember, 'fieldName'>> = [];
	let childIndex = 0;
	for (const child of draft.component.listChildren()) {
		if (!isRuntimeChild(child)) continue;
		const index = childIndex++;
		if (settings.ignoreNoname && isDefaultMemberName(draft.fairyGuiBaseType, 'child', child.getName())) continue;
		candidates.push({
			index,
			kind: 'child',
			originalName: child.getName(),
			typeName: resolveChildType(draft, child, generatedByResource, packagesById),
		});
	}

	for (const [index, controller] of draft.component.listControllers().entries()) {
		if (settings.ignoreNoname && isDefaultMemberName(draft.fairyGuiBaseType, 'controller', controller.getName())) continue;
		candidates.push({
			index,
			kind: 'controller',
			originalName: controller.getName(),
			typeName: 'Controller',
		});
	}

	for (const [index, transition] of draft.component.listTransitions().entries()) {
		candidates.push({
			index,
			kind: 'transition',
			originalName: transition.getName(),
			typeName: 'Transition',
		});
	}

	const usedNames = new Map<string, number>();
	return candidates.map((candidate) => {
		const baseName = normalizeMemberName(`${settings.memberNamePrefix}${candidate.originalName}`);
		const count = (usedNames.get(baseName) ?? 0) + 1;
		usedNames.set(baseName, count);
		return {
			...candidate,
			fieldName: count === 1 ? baseName : `${baseName}_${count}`,
		};
	});
}

function resolveChildType(
	owner: ComponentDraft,
	child: GObject,
	generatedByResource: Map<string, ComponentDraft>,
	packagesById: Map<string, Package>,
): string {
	const target = resolveReferencedComponent(owner.packageId, child, packagesById);
	if (target) {
		const generated = generatedByResource.get(resourceKey(target.pkg.getId(), target.component.getId()));
		if (generated) {
			return generated.bindingNamespace === owner.bindingNamespace
				? generated.bindingClassName
				: `${generated.bindingNamespace}.${generated.bindingClassName}`;
		}
		return resolveComponentBaseType(target.component);
	}

	const instanceExtType = (child as GComponent & { getInstanceExtType?(): string }).getInstanceExtType?.();
	if (instanceExtType) return `G${normalizeTypeName(instanceExtType)}`;
	return child.propertyType;
}

function resolveReferencedComponent(
	ownerPackageId: string,
	child: GObject,
	packagesById: Map<string, Package>,
): { component: Component; pkg: Package } | null {
	const src = (child as GObject & { getSrc?(): string }).getSrc?.();
	if (!src) return null;

	let packageId = ownerPackageId;
	let componentId = src;
	if (src.startsWith('ui://')) {
		const rest = src.slice(5);
		packageId = rest.slice(0, 8);
		componentId = rest.slice(8);
	} else {
		packageId = (child as GComponent & { getPackageId?(): string }).getPackageId?.() || ownerPackageId;
	}

	const pkg = packagesById.get(packageId);
	const resource = pkg?.getResourceById(componentId);
	if (!pkg || resource?.propertyType !== 'Component') return null;
	return { component: resource, pkg };
}

function isRuntimeChild(child: GObject): boolean {
	return child.propertyType !== 'GGroup' || (child as GObject & { getAdvanced?(): boolean }).getAdvanced?.() === true;
}

function resolveComponentBaseType(component: Component): string {
	const extensionType = component.getExtensionType();
	return extensionType ? `G${normalizeTypeName(extensionType)}` : 'GComponent';
}

function parseRemark(value: string): ParsedRemark {
	const trimmed = value.trim();
	if (!trimmed) return { explicit: false, layer: 'Normal', role: 'view' };

	const values = new Map<string, string>();
	for (const segment of trimmed.split('|')) {
		const separator = segment.indexOf(':');
		if (separator < 0) continue;
		values.set(segment.slice(0, separator).trim().toLowerCase(), segment.slice(separator + 1).trim());
	}

	const type = values.get('type')?.toLowerCase();
	const role: EtComponentRole = type === 'view' ? 'view' : type === 'comp' ? 'component' : 'binding';
	return {
		explicit: values.has('type'),
		layer: ensureCSharpIdentifier(normalizeTypeName(values.get('layer') || 'Normal')),
		role,
	};
}

function isDefaultMemberName(ownerType: string, kind: EtMemberKind, name: string): boolean {
	if (kind === 'controller') return (ownerType === 'GButton' || ownerType === 'GComboBox') && name === 'button';
	if (kind === 'transition') return false;
	if (ownerType === 'GButton' || ownerType === 'GLabel' || ownerType === 'GComboBox') {
		if (name === 'title' || name === 'icon') return true;
	}
	if (ownerType === 'GProgressBar') {
		if (name === 'bar' || name === 'bar_v' || name === 'title' || name === 'ani') return true;
	}
	if (ownerType === 'GSlider') {
		if (name === 'bar' || name === 'bar_v' || name === 'grip' || name === 'title' || name === 'ani') return true;
	}
	return /^n\d+(?:_.*)?$/i.test(name);
}

function normalizeNamespace(value: string): string {
	const normalized = value
		.split('.')
		.map((part) => normalizeTypeName(part, 'Generated'))
		.join('.');
	return normalized || 'ET.Client';
}

function resourceKey(packageId: string, componentId: string): string {
	return `${packageId}:${componentId}`;
}

function compareComponents(left: Component, right: Component): number {
	return left.getId().localeCompare(right.getId()) || left.getName().localeCompare(right.getName());
}

function compareCodegenComponents(left: EtCodegenComponent, right: EtCodegenComponent): number {
	return left.componentId.localeCompare(right.componentId) || left.componentName.localeCompare(right.componentName);
}
