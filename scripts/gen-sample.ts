/**
 * Generate sample C# output using template-based codegen.
 */
import { renderComponentBinding } from '../plugins/et-fui-codegen/src/templates.js';

const c: any = {
    bindingClassName:'FUI_LoginPanel', bindingNamespace:'ET.Client.Login', componentId:'abc',
    componentName:'LoginPanel', componentTypeName:'LoginPanel', fairyGuiBaseType:'GComponent',
    layer:'Normal',
    members:[
        {fieldName:'m_btn_start',index:0,kind:'child',originalName:'btn_start',typeName:'GButton'},
        {fieldName:'m_c_state',index:0,kind:'controller',originalName:'state',typeName:'Controller'}
    ],
    packageId:'p1', packageName:'Login', packageTypeName:'Login',
    role:'view', url:'ui://p1abc', entityTypeName:'LoginPanel', panelId:101
};
const s: any = { allowGenCode:true, classNamePrefix:'FUI_', memberNamePrefix:'m_',
    packageName:'ET.Client', ignoreNoname:true, getMemberByName:true, codePath:'', codeType:'' };

const binding = await renderComponentBinding(c,s);
console.log(binding);
