# OpenFairyGUI 测试债清零：bytes 子文件夹断言同步 + restore 子文件夹布局支持

## 背景

OpenFairyGUI fork 的 Unity（`fileExtension === 'bytes'`）产物按 FairyGUI 编辑器约定输出到 `{outputDir}/{publishName}/` 子文件夹。部分历史测试断言仍基于旧的「扁平输出」路径，导致 11 个测试长期失败（已文档化为测试债，见 `docs/CHANGELOG.md`）。本任务清零全部 11 个失败：

- 10 个在 `packages/functions/test/publish.test.ts`（断言路径同步到子文件夹约定；其中 2 个改为「未写入任何文件」断言）。
- 1 个在 `packages/functions/test/restore.test.ts`（`directory batch restores packages, assets, and branch files`）：根因是**产品缺口**——restore 的输入扫描只读扁平一层、伴随文件解析只查输入目录根，无法消费 fork 自己的子文件夹发布布局。属「导入导出」功能链，必须产品侧修复。

## 已核实的现状（已读源码/实测日志，勿凭摘要猜）

复现命令（仓库根，git-bash）：

```bash
export NODE_OPTIONS=--max-old-space-size=16384
pnpm exec ava --no-worker-threads packages/functions/test/publish.test.ts packages/functions/test/restore.test.ts
```

当前失败 11 个，逐条根因见「修复需求」。

关键事实（已核实）：

- 子文件夹推导：`packages/functions/src/publish.ts:228-229` — `if (outputDir && config.fileExtension === 'bytes') outputDir = \`${outputDir}/${publishName}\`;`；`publishName = pkg.getPublishName() || pkg.getName()`（183 行）。
- 已适配先例（照抄风格，含中文注释）：`publish.test.ts` 约 857 行（misc resources 测试）「Unity (bytes) 产物嵌套在 {PkgName}/ 子文件夹（对齐 FairyGUI Editor FUI/{PkgName}/ 约定）。」；约 101-107 行（republishing 测试）产物路径形如 `path.join(output, 'Repeat', 'Repeat_fui.bytes')`。
- restore 输入扫描：`packages/functions/src/restore.ts:103-119` — `readdir(sourceDir)` 扁平一层，只取匹配 `/_fui\.bytes$/i || /\.fui$/i || /\.bin$/i` 的**文件**。
- restore 伴随文件（atlas PNG / loose 资源）解析：`restore-internals/resource-paths.ts` 的 `resolveSourceFile`（124-141 行）只在单一 `sourceDir` 下查候选。真实调用点共 4 处，全部持 `pkg` 引用：
  - `restore-internals/asset-output.ts:49`（restoreAtlasImages）、`:100`（copyLooseResources）、`:220`（buildSpriteLookup）
  - `restore-internals/resource-paths.ts:121`（`resolveLooseSourceFile` 内部；skeleton.ts 经它间接调用）
- 失败测试的 fixture 结构（restore 批次用例）：`FairyGUI-unity/Assets/Examples/Resources/UI` 为 124 个**扁平文件**（无子目录、无 Branch/Loader 文件）；`restore.test.ts` 的 `createRestoreReleaseFixture` 先扁平拷贝，再 `publish()` Branch+Loader — 产物落入 `release/Branch/`、`release/Loader/` 子目录（实测日志：`publish: Published 1 package(s) to .../release/Branch`）。失败点：`Branch package is restored`（`doc.getRoot().getPackage('Branch')` 为 null）。
- ava 调用注意：根脚本为 `ava --no-worker-threads`；直跑必须带 `--no-worker-threads`（否则 tsx 解析失效，假失败 `Cannot find module '../src/index.js'`）。
- 失败清单（写任务书时的实测快照，行号为当时快照、可能漂移，**以代码片段为准**）：
  1. publish: custom fileExtension works
  2. publish: exports published sound resources with Unity naming
  3. publish: exports loader skeleton resources and dependency closure with editor-aligned naming
  4. publish: Branch package keeps branch resources and emits separate branch atlases when configured
  5. publish: Branch package merges active branch resources onto main ids
  6. publish: rejects runtime output without raster capabilities（readdir 差 `['StrictPkg']`）
  7. publish: rejects missing atlas source images instead of writing transparent holes（readdir 差 `['MissingImagePkg']`）
  8. publish: binary output excludes unpublished image resources and preserves component extension type
  9. publish: generates package-level pixel hit test entries for Unity hit-test images
  10. publish: sample packages retain exported items and indirect resource references
  11. restore published project: directory batch restores packages, assets, and branch files

## 修复需求 A：publish.test.ts 10 处断言同步（仅测试侧）

> 每处校验：产物实际落在 `{tmpDir}/{PkgName}/`（PkgName = `pkg.getPublishName() || pkg.getName()`）。只改断言路径/读取方式，不改测试语义。

A1. `publish: custom fileExtension works`
- 现：`const bytesPath = path.join(tmpDir, 'UnityPkg_fui.bytes');`
- 改：`path.join(tmpDir, 'UnityPkg', 'UnityPkg_fui.bytes')`

A2. `publish: exports published sound resources with Unity naming`
- 现：`const targetPath = path.join(tmpDir, 'Basics_o4lt7w.wav');`
- 改：`path.join(tmpDir, 'Basics', 'Basics_o4lt7w.wav')`

A3. `publish: exports loader skeleton resources and dependency closure with editor-aligned naming`
- expectedFiles 循环：`path.join(tmpDir, file)` → `path.join(tmpDir, 'Loader', file)`
- absentFiles 循环：`path.join(tmpDir, absentFile)` → `path.join(tmpDir, 'Loader', absentFile)`
- bytes 读取：`path.join(tmpDir, 'Loader_fui.bytes')` → `path.join(tmpDir, 'Loader', 'Loader_fui.bytes')`

A4. `publish: Branch package keeps branch resources and emits separate branch atlases when configured`
- `path.join(tmpDir, 'Branch_fui.bytes')` → `path.join(tmpDir, 'Branch', 'Branch_fui.bytes')`（2 处：bytes 解析 + readBinary 回读）
- `path.join(tmpDir, 'Branch_atlas0.png')` → `path.join(tmpDir, 'Branch', 'Branch_atlas0.png')`
- `path.join(tmpDir, 'Branch_atlas0_dev.png')` → `path.join(tmpDir, 'Branch', 'Branch_atlas0_dev.png')`

A5. `publish: Branch package merges active branch resources onto main ids`
- `path.join(tmpDir, 'Branch_fui.bytes')` → `path.join(tmpDir, 'Branch', 'Branch_fui.bytes')`（2 处：bytes 解析 + readBinary 回读）

A6. `publish: rejects runtime output without raster capabilities`
- 现：`t.deepEqual(await fs.readdir(tmpDir), [], 'strict capability validation runs before writing package artifacts');`
- 问题：子文件夹约定下包目录 mkdir 先于能力校验，失败时残留**空目录**；应断言「未写入任何文件」。
- 改：在文件既有 helper 区（`readReferenceReleaseNames` 之后、`createFs` 之前）新增模块级 helper：

```ts
// 递归收集目录内所有文件（子文件夹产物约定下，允许失败残留空目录——只断言没有写入任何文件）。
async function collectFilesRecursively(dirPath: string): Promise<string[]> {
	const files: string[] = [];
	for (const entry of await fs.readdir(dirPath, { withFileTypes: true })) {
		const fullPath = path.join(dirPath, entry.name);
		if (entry.isDirectory()) files.push(...(await collectFilesRecursively(fullPath)));
		else files.push(fullPath);
	}
	return files;
}
```

  断言改为：`t.deepEqual(await collectFilesRecursively(tmpDir), [], 'strict capability validation runs before writing package artifacts');`

A7. `publish: rejects missing atlas source images instead of writing transparent holes`
- 同 A6：`t.deepEqual(await fs.readdir(tmpDir), [], ...)` → `t.deepEqual(await collectFilesRecursively(tmpDir), [], 'failed atlas input does not write a binary or PNG');`
- （复用 A6 的同一 helper，不得重复定义）

A8. `publish: binary output excludes unpublished image resources and preserves component extension type`
- 现：`const bytes = await fs.readFile(path.join(tmpDir, 'GhostPkg_fui.bytes'));`
- 改：`path.join(tmpDir, 'GhostPkg', 'GhostPkg_fui.bytes')`

A9. `publish: generates package-level pixel hit test entries for Unity hit-test images`
- 现：`path.join(tmpDir, 'HitTest_fui.bytes')`
- 改：`path.join(tmpDir, 'HitTest', 'HitTest_fui.bytes')`

A10. `publish: sample packages retain exported items and indirect resource references`
- 现：`const bytes = await fs.readFile(path.join(tmpDir, check.file));`
- 改：`const bytes = await fs.readFile(path.join(tmpDir, check.file.replace(/_fui\.bytes$/, ''), check.file));`
- 说明：每个包产物位于 `{PkgName}/{file}`，PkgName 恰好等于文件名去掉 `_fui.bytes` 后缀。

## 修复需求 B：restore 支持子文件夹发布布局（产品侧）

B1. 二进制发现（`packages/functions/src/restore.ts` 约 103-119 行）
- 目标行为：先扫第一层扁平文件（现状语义不变：同名过滤 → 安全段校验 → packageFilter → isFile）；再扫描第一层中的**子目录**（fork 约定 `{sourceDir}/{PkgName}/`），子目录内的 `_fui.bytes/.fui/.bin` 文件按同一规则处理。
- 实现要点（两遍扫描，保证「扁平优先」不受 readdir 顺序影响）：
  - 第一遍：把 `readdir(sourceDir)` 的条目按 `isFile` 分成 flat 文件列表与目录列表。
  - 处理 flat：现有语义原样（`isPublishedBinaryFile` 过滤 → `assertSafeRestoreSegment` → packageFilter 用 `inferPackageName` → 收集），并记录已见包名集合。
  - 处理目录：目录名先过 `assertSafeRestoreSegment(name, 'published package directory name')`；`readdir(dirPath)` 抛错则静默 continue；子目录内命名匹配且 `isFile` 为真的二进制——**若其包名已在「已见包名集合」中则跳过（扁平优先去重）**；否则收集。
  - 最终 `binaryPaths.sort((left, right) => left.localeCompare(right))` 保持；空结果错误保持原文：`No FairyGUI published binary files found in ${sourceDir}.`
- 参考实现骨架（可微调细节，但语义必须一致）：

```ts
const entries = await options.fs.readdir(sourceDir);
const flatFiles: Array<{ filePath: string; name: string }> = [];
const directories: Array<{ dirPath: string; name: string }> = [];
for (const name of entries) {
	const entryPath = options.fs.join(sourceDir, name);
	if (await options.fs.isFile(entryPath)) flatFiles.push({ filePath: entryPath, name });
	else directories.push({ dirPath: entryPath, name });
}
const binaryPaths: string[] = [];
const seenPackages = new Set<string>();
for (const { filePath, name } of flatFiles) {
	if (!isPublishedBinaryFile(name)) continue;
	assertSafeRestoreSegment(name, 'published binary file name');
	const packageName = inferPackageName(name);
	if (packageFilter && !packageFilter.has(packageName)) continue;
	seenPackages.add(packageName);
	binaryPaths.push(filePath);
}
for (const { dirPath, name } of directories) {
	// Unity (bytes) 产物按 {PkgName}/ 子文件夹发布（fork 约定）：再扫描一层。
	assertSafeRestoreSegment(name, 'published package directory name');
	let nestedNames: string[];
	try {
		nestedNames = await options.fs.readdir(dirPath);
	} catch {
		continue;
	}
	for (const nestedName of nestedNames) {
		if (!isPublishedBinaryFile(nestedName)) continue;
		assertSafeRestoreSegment(nestedName, 'published binary file name');
		const packageName = inferPackageName(nestedName);
		if (packageFilter && !packageFilter.has(packageName)) continue;
		if (seenPackages.has(packageName)) continue; // 扁平优先
		const nestedPath = options.fs.join(dirPath, nestedName);
		if (await options.fs.isFile(nestedPath)) binaryPaths.push(nestedPath);
	}
}
binaryPaths.sort((left, right) => left.localeCompare(right));
```

B2. 伴随文件解析（`restore-internals/resource-paths.ts` + `asset-output.ts`）
- 在 `resource-paths.ts` 新增：

```ts
export async function resolvePackageSourceFile(
	fs: RestoreFileSystem,
	sourceDir: string,
	pkg: Package,
	candidates: string[],
): Promise<string | null> {
	const direct = await resolveSourceFile(fs, sourceDir, candidates);
	if (direct) return direct;
	const publishName = pkg.getPublishName() || pkg.getName();
	assertSafeRestoreSegment(publishName, 'package publish name');
	return resolveSourceFile(fs, fs.join(sourceDir, publishName), candidates);
}
```

- 4 个调用点切换到新函数（`resolveSourceFile` 本体不动，`isPathWithin` 校验语义不变——子目录解析仍在其自身 `sourceDir` 内）：
  - `asset-output.ts:49` → `resolvePackageSourceFile(fs, options.sourceDir, pkg, sourceFileCandidates(pkg, atlas.getFile()))`
  - `asset-output.ts:100` → `resolvePackageSourceFile(fs, options.sourceDir, pkg, sourceFileCandidates(pkg, resourcePublishedFileName(resource), fileName))`
  - `asset-output.ts:220` → 同 :49 模式
  - `resource-paths.ts:121`（`resolveLooseSourceFile` 内部）→ `return resolvePackageSourceFile(fs, sourceDir, pkg, candidates);`
- 顺序说明：先查 `sourceDir` 根（保持既有扁平行为），未命中再查 `{sourceDir}/{publishName}/`（fork 子文件夹布局）。

B3. 边界
- 不改 CLI、不改 `RestoreOptions`/`RestoreFileSystem` 接口、不加依赖。
- 不为新能力额外添加测试（现有 11 个失败测试即为回归面）。

## 预裁决（不要另行决策）

1. A6/A7：允许失败残留空目录，断言「未写入任何文件」——这是子文件夹约定下的既成行为，产品侧不改。
2. B1 去重：扁平优先（目录内同名包二进制仅当扁平层未找到时才收集）。
3. B2 查找顺序：`sourceDir` 根优先、`{sourceDir}/{publishName}/` 兜底。
4. 不新增测试、不重构、不格式化无关代码。

## 验收

1. 两个测试文件全绿：
   `pnpm exec ava --no-worker-threads packages/functions/test/publish.test.ts packages/functions/test/restore.test.ts`
2. `pnpm typecheck` 通过（仓库根）；`pnpm lint` 通过。
3. `git status --porcelain` 的变更应只含：
   - `packages/functions/test/publish.test.ts`
   - `packages/functions/test/restore.test.ts`（若需要）
   - `packages/functions/src/restore.ts`
   - `packages/functions/src/restore-internals/resource-paths.ts`
   - `packages/functions/src/restore-internals/asset-output.ts`
   - 本任务目录 `docs/.hermes/tasks/20261009-test-debt-sync/` 下文件
   之外的新变更要说明原因。
4. 不要 `git commit`（提交由编排层统一执行）。
5. 不要跑仓库根全量 `pnpm test`（终验由编排层执行）；迭代时可用
   `pnpm exec ava --no-worker-threads packages/functions/test/publish.test.ts --match="<测试名>"` 加速。

## 结果文件（coding-result.md 格式）

```md
# coding-result — 20261009-test-debt-sync

## 改动清单
（file → 变更摘要，逐文件）

## 逐项完成确认
（A1–A10、B1–B3 各一行：done / 说明）

## 验证证据
（命令 + 结果尾部关键行；含两个测试文件的最终全绿输出）

## 偏差与未决
（无 → 写「无」）
```

## 三锻铁律（强制，原文）

1. **只做任务文档范围的事**：子代理（OpenCode/Codex）只执行 requirements.md/architecture.md/implementation-plan.md 覆盖的范围，禁顺手重构、禁探索无关文件/环境、禁自行跑验证门之外的工具（如找 tsc/find 全盘）。
2. **漂移/卡住 → 异常标记 + 自动结束**：子代理一旦发现自己偏离任务范围、或某步骤 2 次尝试仍卡住（如找不到工具、环境不具备）→ 写 `fault.md`（异常原因/已完成部分/未完成部分/建议下一步）+ `status.json → interrupted`，**自动结束当前委派**，不再无限重试/探索。
3. **编排层兜底**：Hermes 收到 interrupted → 依据 fault.md 分诊（能自管补完则降级自管；需换执行体则换；架构问题退回阶段 A），进度始终有记录。
4. **委派 prompt 末尾必须带本节铁律**（原文引用），让子代理在执行起点就知道边界。
