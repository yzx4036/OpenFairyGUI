/**
 * et-fui-codegen unit smoke test (template-based codegen).
 * Tests engine.ts + naming.ts + hash.ts + templates.ts.
 */
import { hashPanelId } from '../plugins/et-fui-codegen/src/hash.js';
import { normalizeTypeName, normalizeMemberName, ensureCSharpIdentifier } from '../plugins/et-fui-codegen/src/naming.js';
import { renderTemplate, type TemplateContext } from '../plugins/et-fui-codegen/src/engine.js';
import {
    renderComponentBinding, renderPanelEntity, renderPanelSystem,
    renderPanelId, renderFuiBinder,
} from '../plugins/et-fui-codegen/src/templates.js';
import type { EtCodegenComponent, EtCodegenOutput } from '../plugins/et-fui-codegen/src/model.js';

const SETTINGS = { allowGenCode:true, classNamePrefix:'FUI_', memberNamePrefix:'m_', packageName:'ET.Client', ignoreNoname:true, getMemberByName:true, codePath:'', codeType:'' } as const;

let failed = 0;
function check(cond: boolean, msg: string) { if (!cond) { console.error(`  ❌ ${msg}`); failed++; } else console.log(`  ✓ ${msg}`); }
function contains(text: string, needle: string, msg: string) { check(text.includes(needle), msg); }

console.log('=== et-fui-codegen Unit Smoke Test (Template-based) ===\n');

// ── 1. engine.ts ──
console.log('[1/7] engine.ts — template engine');
{
    const ctx: TemplateContext = {
        scalars: { name: 'World', flag: 'true', zero: '0' },
        loops: {
            items: [{ label: 'A', value: '1' }, { label: 'B', value: '2' }],
        },
    };
    const tpl = 'Hello $name$\n//$for item in items$\n  $item.label$=$item.value$\n//$endfor$\n//$if flag$\nFLAG_ON\n//$endif$\n//$if zero$\nZERO_ON\n//$endif$';
    const result = renderTemplate(tpl, ctx);
    check(result.includes('Hello World'), 'scalar $name$');
    check(result.includes('  A=1'), 'loop row 0');
    check(result.includes('  B=2'), 'loop row 1');
    check(result.includes('FLAG_ON'), '$if$ truthy');
    check(!result.includes('ZERO_ON'), '$if$ falsy ("0")');
    check(!result.includes('$'), 'no unresolved tokens');
}
console.log('  ✅ PASSED');

// ── 2. naming.ts ──
console.log('[2/7] naming.ts');
check(normalizeTypeName('LoginPanel') === 'LoginPanel', 'type Pascal');
check(normalizeTypeName('login-panel') === 'LoginPanel', 'type kebab→Pascal');
check(normalizeTypeName('123abc') === '_123abc', 'digit prefix');
check(normalizeMemberName('btn_start') === 'btn_start', 'member preserve');
check(ensureCSharpIdentifier('public') === '_public', 'keyword escape');
console.log('  ✅ PASSED');

// ── 3. hash.ts ──
console.log('[3/7] hash.ts');
const id1 = hashPanelId('pkg1', 'comp1');
check(id1 === hashPanelId('pkg1', 'comp1'), 'deterministic');
check(id1 !== hashPanelId('pkg1', 'comp2'), 'different inputs');
check(id1 > 0, 'positive');
console.log('  ✅ PASSED (id=%d)', id1);

// ── 4-7. templates.ts (all async via .tpl files) ──
console.log('[4/7] templates.ts — component binding');
const mock: EtCodegenComponent = {
    bindingClassName:'FUI_LoginPanel', bindingNamespace:'ET.Client.Login', componentId:'abc',
    componentName:'LoginPanel', componentTypeName:'LoginPanel', fairyGuiBaseType:'GComponent',
    layer:'Normal',
    members:[
        {fieldName:'m_btn_start',index:0,kind:'child',originalName:'btn_start',typeName:'GButton'},
        {fieldName:'m_c_state',index:0,kind:'controller',originalName:'state',typeName:'Controller'},
    ],
    packageId:'p1', packageName:'Login', packageTypeName:'Login',
    role:'view', url:'ui://p1abc', entityTypeName:'LoginPanel', panelId:101,
};
const binding = await renderComponentBinding(mock, SETTINGS);
contains(binding, 'namespace ET.Client.Login', 'namespace');
contains(binding, 'class FUI_LoginPanel : GComponent', 'class');
contains(binding, 'public GButton m_btn_start;', 'button field');
contains(binding, 'GetChild("btn_start")', 'getMemberByName child');
contains(binding, 'GetController("state")', 'getMemberByName ctrl');
contains(binding, 'FUIGComponent("Login", "LoginPanel")', 'FUIGComponent attr');
console.log('  ✅ PASSED');

console.log('[5/7] templates.ts — entity + system');
const entity = await renderPanelEntity(mock, 'ET.Client');
contains(entity, 'class LoginPanel : Entity, IAwake', 'entity class');
contains(entity, 'public FUI_LoginPanel View;', 'View field');
contains(entity, '[ComponentOf(typeof(FUIEntity))]', 'ComponentOf attr');

const sys = await renderPanelSystem(mock, 'ET.Client');
contains(sys, 'class LoginPanelSystem', 'system class');
contains(sys, 'void OnShow', 'OnShow');
contains(sys, 'void RegisterUIEvent', 'RegisterUIEvent');
console.log('  ✅ PASSED');

console.log('[6/7] templates.ts — PanelId/Binder');
const out: EtCodegenOutput = {
    baseNamespace:'ET.Client', outputDir:'/test',
    packages:[{ bindingNamespace:'ET.Client.Login', components:[mock], packageId:'p1',packageName:'Login',packageTypeName:'Login' }]
};
const panelId = await renderPanelId(out);
contains(panelId, 'LoginPanel = 101', 'panelId');

const binder = await renderFuiBinder(out);
contains(binder, 'SetPackageItemExtension(ET.Client.Login.FUI_LoginPanel.URL', 'binder entry');
contains(binder, 'UIObjectFactory.Clear();', 'Clear call');
console.log('  ✅ PASSED');

// ── 7. strict mode error ──
console.log('[7/7] engine.ts — strict mode error');
let threw = false;
try { renderTemplate('hello $unknown$', { scalars:{}, loops:{} }, true); } catch { threw = true; }
check(threw, 'unresolved token throws in strict mode');
console.log('  ✅ PASSED');

// ── summary ──
console.log('\n═══════════════════════════════════');
if (failed === 0) console.log('✅ ALL 7 TEST GROUPS PASSED');
else console.log(`❌ ${failed} FAILURES`);
console.log('═══════════════════════════════════');
process.exit(failed > 0 ? 1 : 0);
