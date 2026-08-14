import { Document } from '@openfairygui/core';
import type { CliCodeGenerationSettings } from '@openfairygui/functions';
import test from 'ava';
import type { EtCodegenComponent, EtCodegenOutput } from '../src/model.js';
import {
	renderComponentBinding,
	renderFuiBinder,
	renderPanelEntity,
	renderPanelId,
	renderPanelSystem,
} from '../src/templates.js';

const SETTINGS: Required<CliCodeGenerationSettings> = {
	allowGenCode: true,
	classNamePrefix: 'FUI_',
	codePath: '',
	codeType: '',
	getMemberByName: true,
	ignoreNoname: true,
	memberNamePrefix: 'm_',
	packageName: 'ET.Client',
};

function createComponentMock(): EtCodegenComponent {
	const doc = new Document();
	const pkg = doc.createPackage('Login').setId('p1');
	const component = doc.createComponent('LoginPanel').setId('abc');
	pkg.addResource(component);

	return {
		bindingClassName: 'FUI_LoginPanel',
		bindingNamespace: 'ET.Client.Login',
		component,
		componentId: 'abc',
		componentName: 'LoginPanel',
		componentTypeName: 'LoginPanel',
		entityTypeName: 'LoginPanel',
		fairyGuiBaseType: 'GComponent',
		layer: 'Normal',
		members: [
			{ fieldName: 'm_btn_start', index: 0, kind: 'child', originalName: 'btn_start', typeName: 'GButton' },
			{ fieldName: 'm_c_state', index: 0, kind: 'controller', originalName: 'state', typeName: 'Controller' },
		],
		packageId: 'p1',
		packageName: 'Login',
		packageTypeName: 'Login',
		panelId: 101,
		role: 'view',
		url: 'ui://p1abc',
	};
}

test.serial('renders a component binding', async (t) => {
	const binding = await renderComponentBinding(createComponentMock(), SETTINGS);

	t.true(binding.includes('namespace ET.Client.Login'));
	t.true(binding.includes('class FUI_LoginPanel : GComponent'));
	t.true(binding.includes('public GButton m_btn_start;'));
	t.true(binding.includes('GetChild("btn_start")'));
	t.true(binding.includes('GetController("state")'));
	t.true(binding.includes('FUIGComponent("Login", "LoginPanel")'));
});

test.serial('renders a panel entity and system', async (t) => {
	const component = createComponentMock();
	const entity = await renderPanelEntity(component, 'ET.Client');
	const system = await renderPanelSystem(component, 'ET.Client');

	t.true(entity.includes('class LoginPanel : Entity, IAwake'));
	t.true(entity.includes('public FUI_LoginPanel View;'));
	t.true(entity.includes('[ComponentOf(typeof(FUIEntity))]'));
	t.true(system.includes('class LoginPanelSystem'));
	t.true(system.includes('void OnShow'));
	t.true(system.includes('void RegisterUIEvent'));
});

test.serial('renders panel ids and the FairyGUI binder', async (t) => {
	const component = createComponentMock();
	const output: EtCodegenOutput = {
		baseNamespace: 'ET.Client',
		outputDir: '/test',
		packages: [
			{
				bindingNamespace: 'ET.Client.Login',
				components: [component],
				packageId: 'p1',
				packageName: 'Login',
				packageTypeName: 'Login',
			},
		],
	};
	const panelId = await renderPanelId(output);
	const binder = await renderFuiBinder(output);

	t.true(panelId.includes('LoginPanel = 101'));
	t.true(binder.includes('SetPackageItemExtension(ET.Client.Login.FUI_LoginPanel.URL'));
	t.true(binder.includes('UIObjectFactory.Clear();'));
});
