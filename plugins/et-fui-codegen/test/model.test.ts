import { Document } from '@openfairygui/core';
import type { CliCodeGenerationSettings } from '@openfairygui/functions';
import test from 'ava';
import { hashPanelId } from '../src/hash.js';
import { buildCodegenOutputs } from '../src/model.js';

const SETTINGS: Required<CliCodeGenerationSettings> = {
	allowGenCode: true,
	classNamePrefix: 'FUI_',
	codePath: '',
	codeType: '',
	getMemberByName: true,
	ignoreNoname: false,
	memberNamePrefix: 'm_',
	packageName: 'Game.Client',
};

test('buildCodegenOutputs normalizes package, component, member, panel, and entity names', (t) => {
	const doc = new Document();
	const pkg = doc.createPackage('login-ui').setId('pkglogin');
	const component = doc.createComponent('login-panel.xml').setId('cmp00001').setRemark('Type:View|Layer:popup-layer');
	component.addChild(doc.createGButton('start-button').setId('n0'));
	component.addController(doc.createController('state-mode'));
	component.addTransition(doc.createTransition('show-panel'));
	pkg.addResource(component);

	const [output] = buildCodegenOutputs(doc, [{ outputDir: '/generated', pkg }], SETTINGS);
	const generatedPackage = output?.packages[0];
	const generatedComponent = generatedPackage?.components[0];

	t.is(output?.baseNamespace, 'Game.Client');
	t.is(generatedPackage?.packageTypeName, 'LoginUi');
	t.is(generatedPackage?.bindingNamespace, 'Game.Client.LoginUi');
	t.is(generatedComponent?.component, component, 'the model keeps the real FairyGUI component');
	t.is(generatedComponent?.componentTypeName, 'LoginPanel');
	t.is(generatedComponent?.bindingClassName, 'FUI_LoginPanel');
	t.is(generatedComponent?.entityTypeName, 'LoginPanel');
	t.is(generatedComponent?.layer, 'PopupLayer');
	t.is(generatedComponent?.panelId, hashPanelId('pkglogin', 'cmp00001'));
	t.deepEqual(
		generatedComponent?.members.map(({ fieldName, kind, typeName }) => ({ fieldName, kind, typeName })),
		[
			{ fieldName: 'm_start_button', kind: 'child', typeName: 'GButton' },
			{ fieldName: 'm_state_mode', kind: 'controller', typeName: 'Controller' },
			{ fieldName: 'm_show_panel', kind: 'transition', typeName: 'Transition' },
		],
	);
});

test('remark-less component defaults to component role without entity stub', (t) => {
	// VULN-3: 空 remark 默认 comp → 不推导 entityBaseName → 无 entityTypeName/panelId
	const doc = new Document();
	const pkg = doc.createPackage('Login').setId('p1');
	const component = doc.createComponent('IconCom').setId('c1');
	pkg.addResource(component);

	const [output] = buildCodegenOutputs(doc, [{ outputDir: '/generated', pkg }], SETTINGS);
	const generated = output?.packages[0]?.components[0];

	t.is(generated?.role, 'component', 'empty remark falls back to component role');
	t.is(generated?.entityTypeName, undefined, 'component role must not derive an entity name');
	t.is(generated?.panelId, undefined, 'component role must not receive a panel id');
});

test('Type:Comp component gets no panel id and no entity name', (t) => {
	// VULN-1 回归: 显式 Type:Comp 不分配 panelId、不生成 Entity
	const doc = new Document();
	const pkg = doc.createPackage('Login').setId('p1');
	const comp = doc.createComponent('BattleBar').setId('c1').setRemark('Type:Comp|Layer:Normal');
	const view = doc.createComponent('LoginPanel').setId('c2').setRemark('Type:View|Layer:Normal');
	pkg.addResource(comp);
	pkg.addResource(view);

	const [output] = buildCodegenOutputs(doc, [{ outputDir: '/generated', pkg }], SETTINGS);
	const components = output?.packages[0]?.components ?? [];
	const generatedComp = components.find((c) => c.componentName === 'BattleBar');
	const generatedView = components.find((c) => c.componentName === 'LoginPanel');

	t.is(generatedComp?.role, 'component');
	t.is(generatedComp?.panelId, undefined, 'Type:Comp must not receive a panel id');
	t.is(generatedComp?.entityTypeName, undefined, 'Type:Comp must not derive an entity name');
	t.is(generatedView?.panelId !== undefined, true, 'Type:View still receives a panel id');
	t.is(generatedView?.entityTypeName, 'LoginPanel');
});

test('bare remark without Type prefix stays binding role', (t) => {
	// 护栏回归: 裸 remark（无 Type: 前缀）仍走 binding 分支，行为不变
	const doc = new Document();
	const pkg = doc.createPackage('Login').setId('p1');
	const component = doc.createComponent('HeadBar').setId('c1').setRemark('Common');
	pkg.addResource(component);

	const [output] = buildCodegenOutputs(doc, [{ outputDir: '/generated', pkg }], SETTINGS);
	const generated = output?.packages[0]?.components[0];

	t.is(generated?.role, 'binding', 'bare remark keeps binding role');
	t.is(generated?.entityTypeName, undefined);
	t.is(generated?.panelId, undefined);
});

test('remark boundaries only allow Type:View to produce an entity', (t) => {
	const doc = new Document();
	const pkg = doc.createPackage('Login').setId('p1');
	const cases = [
		{ id: 'c1', name: 'EmptyRemark', remark: '', role: 'component' },
		{ id: 'c2', name: 'WhitespaceRemark', remark: ' \t\r\n ', role: 'component' },
		{ id: 'c3', name: 'ExplicitComp', remark: 'Type:Comp', role: 'component' },
		{ id: 'c4', name: 'ViewPrefix', remark: 'view:xxx', role: 'binding' },
		{ id: 'c5', name: 'InvalidPrefix', remark: 'Typo:View', role: 'binding' },
	] as const;

	for (const { id, name, remark } of cases) {
		pkg.addResource(doc.createComponent(name).setId(id).setRemark(remark));
	}

	const [output] = buildCodegenOutputs(doc, [{ outputDir: '/generated', pkg }], SETTINGS);
	const components = output?.packages[0]?.components ?? [];

	for (const { name, role } of cases) {
		const generated = components.find((component) => component.componentName === name);
		t.is(generated?.role, role, name + ' has the expected role');
		t.is(generated?.entityTypeName, undefined, name + ' must not derive an entity name');
		t.is(generated?.panelId, undefined, name + ' must not receive a panel id');
	}
});
