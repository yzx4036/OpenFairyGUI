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
