/**
 * Full integration test: read ProjZero FGUI project → build codegen model → render C#.
 * Usage: cd E:\_Proj\OpenFairyGUI && npx tsx scripts/verify-fgui.ts
 */
import { NodeIO } from '@openfairygui/core/node';
import { buildCodegenOutputs, type EtCodegenOutput } from '../plugins/et-fui-codegen/src/model.js';
import { renderComponentBinding, renderPanelEntity, renderPanelSystem,
    renderPanelId, renderFuiBinder } from '../plugins/et-fui-codegen/src/templates.js';

const FGUI_PROJECT = 'E:/_Proj/UnityProj/ProjZero/FGUIProject';
const OUTPUT_DIR = 'E:/_Proj/OpenFairyGUI/test-output/fgui-codegen';

const SETTINGS = {
    allowGenCode: true, classNamePrefix: 'FUI_', memberNamePrefix: 'm_',
    packageName: 'ET.Client', ignoreNoname: true, getMemberByName: true,
    codePath: '', codeType: '',
} as const;

async function main() {
    console.log('=== et-fui-codegen FGUI Integration Test ===\n');

    // 1. Read FGUI project
    console.log('[1/4] Reading FGUI project...');
    const io = new NodeIO();
    const doc = await io.readProject(FGUI_PROJECT + '/FGUIProject.fairy');
    const root = doc.getRoot();
    const allPkgs = root.listPackages();
    console.log(`  Packages: ${allPkgs.length}`);

    // Build plans — one output per package
    const plans = allPkgs
        .filter(p => p.listComponents().length > 0)
        .map(p => ({ outputDir: OUTPUT_DIR, pkg: p }));

    // 2. Build codegen model
    console.log('[2/4] Building codegen model...');
    const outputs = buildCodegenOutputs(doc, plans, SETTINGS);
    let totalComps = 0, totalViews = 0, totalBindings = 0;
    for (const o of outputs) {
        for (const p of o.packages) {
            totalComps += p.components.length;
            totalViews += p.components.filter(c => c.role === 'view').length;
            totalBindings += p.components.filter(c => c.role === 'binding').length;
        }
    }
    console.log(`  Output groups: ${outputs.length}`);
    console.log(`  Total components: ${totalComps} (views=${totalViews}, bindings=${totalBindings})`);

    // 3. Render C# for all
    console.log('[3/4] Rendering C# code...');
    let fileCount = 0;
    const { mkdir, writeFile } = await import('node:fs/promises');
    await mkdir(OUTPUT_DIR, { recursive: true });

    const allRendered: { path: string; content: string }[] = [];

    for (const output of outputs) {
        // PanelId.cs
        allRendered.push({ path: 'FUIAutoGen/PanelId.cs', content: await renderPanelId(output) });
        // FUIBinder.cs
        allRendered.push({ path: 'HotfixView/FUIBinder.cs', content: await renderFuiBinder(output) });

        for (const pkg of output.packages) {
            for (const comp of pkg.components) {
                // Component binding
                allRendered.push({
                    path: `ModelView/${pkg.packageTypeName}/${comp.bindingClassName}.cs`,
                    content: await renderComponentBinding(comp, SETTINGS),
                });

                if (!comp.entityTypeName) continue;

                // Entity
                allRendered.push({
                    path: `ModelView/${pkg.packageTypeName}/${comp.entityTypeName}.cs`,
                    content: await renderPanelEntity(comp, output.baseNamespace),
                });
                // System
                allRendered.push({
                    path: `HotfixView/${pkg.packageTypeName}/${comp.entityTypeName}System.cs`,
                    content: await renderPanelSystem(comp, output.baseNamespace),
                });
            }
        }
    }

    // Write all files
    for (const { path, content } of allRendered) {
        const fullPath = `${OUTPUT_DIR}/${path}`;
        const dir = fullPath.replace(/[/\\][^/\\]+$/, '');
        await mkdir(dir, { recursive: true });
        await writeFile(fullPath, content, 'utf-8');
        fileCount++;
    }
    console.log(`  Written: ${fileCount} files`);

    // 4. Show output tree
    console.log(`\n[4/4] Output tree:`);
    const { readdir } = await import('node:fs/promises');
    const { join } = await import('node:path');
    async function tree(dir: string, indent = '') {
        try {
            const entries = (await readdir(dir, { withFileTypes: true })).sort((a,b) =>
                (a.isDirectory()===b.isDirectory()) ? a.name.localeCompare(b.name) : a.isDirectory() ? -1 : 1);
            for (const e of entries) {
                console.log(`${indent}${e.isDirectory() ? '📁' : '📄'} ${e.name}`);
                if (e.isDirectory() && indent.length < 6) await tree(join(dir, e.name), indent + '  ');
            }
        } catch {}
    }
    await tree(OUTPUT_DIR, '  ');
    console.log(`\n✅ Done — ${fileCount} files generated to ${OUTPUT_DIR}`);
}
main().catch(err => { console.error('❌', err); process.exit(1); });
