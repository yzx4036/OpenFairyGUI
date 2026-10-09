# fix-result — 20261009-test-debt-sync 回审驳回项定向修复

基线 HEAD = `81361a3`（develop）。范围严格限定为 `review-result.md`「最小修复清单」1/2/3 + 定点自验；未 commit、未 push、未动 `status.json`。

## 改动文件清单

| 文件 | 改动 | 净增 |
|---|---|---|
| `packages/functions/src/restore.ts` | 扫描块加入规范根边界校验（R1） | +10 |
| `packages/functions/test/restore.test.ts` | 新增聚焦回归用例（R2） | +37 |

`git status --porcelain`（探针已删除后）：

```text
 M packages/functions/src/restore.ts
 M packages/functions/test/restore.test.ts
?? docs/.hermes/tasks/20261009-test-debt-sync/
```

（`docs/.hermes/tasks/20261009-test-debt-sync/` 为本任务自带未跟踪目录，非本次代码改动。）

## R1 — 扫描块逃逸校验（`packages/functions/src/restore.ts`）

| 清单项 | 落点 | 说明 |
|---|---|---|
| 1. 规范根 | `restore.ts:105` | `const resolvedSourceRoot = await Promise.resolve(options.fs.resolvePath(sourceDir));` |
| 2. 第一层 entry 边界 | `restore.ts:111`–`:114` | 在 `isFile` 判定**之前**对每个 entry `resolvePath` 并用 `isPathWithin` 校验；越界抛错 |
| 3. 嵌套 binary 边界 | `restore.ts:144`–`:147` | 嵌套收集前同样 `resolvePath` + 同一根边界校验；越界抛同一错误 |
| 4. 错误文案 | `restore.ts:113` / `restore.ts:146` | 前缀固定 `restore: Published artifact resolves outside the input directory: `；第一层用 entry 名，嵌套用 `{目录名}/{文件名}` |
| 5. import 复用 | `restore.ts:21` | 从 `./restore-internals/output-transaction.js` 复用 `isPathWithin`，未另写路径比较逻辑 |
| 6. 既有语义保持 | 见 diff | 排序（`localeCompare`）、空结果原文、扁平优先 `seenPackages`、子目录 `readdir` 失败静默 `continue`、`assertSafeRestoreSegment` 调用位置与参数均未改 |
| 7. 不套多余 catch | `restore.ts:105/111/144` | 直接 `Promise.resolve(options.fs.resolvePath(...))`，未加 try/catch |

diff（`git diff packages/functions/src/restore.ts`）：

```diff
@@ -18,6 +18,7 @@ import {
 	basename,
 	commitRestoreOutput,
 	createRestoreStagingDir,
+	isPathWithin,
 	normalizeRestoreOutputDir,
 	resolveOutputProjectPath,
 	trimTrailingSlashes,
@@ -101,11 +102,16 @@ export async function restore(options: RestoreOptions): Promise<RestoreResult> {
 	const packageFilter = options.packages?.length ? new Set(options.packages) : null;
+	const resolvedSourceRoot = await Promise.resolve(options.fs.resolvePath(sourceDir));
 	const entries = await options.fs.readdir(sourceDir);
 	const flatFiles: Array<{ filePath: string; name: string }> = [];
 	const directories: Array<{ dirPath: string; name: string }> = [];
 	for (const name of entries) {
 		const entryPath = options.fs.join(sourceDir, name);
+		const resolvedEntryPath = await Promise.resolve(options.fs.resolvePath(entryPath));
+		if (!isPathWithin(resolvedSourceRoot, resolvedEntryPath)) {
+			throw new Error(`restore: Published artifact resolves outside the input directory: ${name}`);
+		}
 		if (await options.fs.isFile(entryPath)) flatFiles.push({ filePath: entryPath, name });
 		else directories.push({ dirPath: entryPath, name });
 	}
@@ -135,6 +141,10 @@ export async function restore(options: RestoreOptions): Promise<RestoreResult> {
 			if (packageFilter && !packageFilter.has(packageName)) continue;
 			if (seenPackages.has(packageName)) continue; // 扁平优先
 			const nestedPath = options.fs.join(dirPath, nestedName);
+			const resolvedNestedPath = await Promise.resolve(options.fs.resolvePath(nestedPath));
+			if (!isPathWithin(resolvedSourceRoot, resolvedNestedPath)) {
+				throw new Error(`restore: Published artifact resolves outside the input directory: ${name}/${nestedName}`);
+			}
 			if (await options.fs.isFile(nestedPath)) binaryPaths.push(nestedPath);
 		}
 	}
```

### 既有测试仍绿的一致性说明

既有用例 `restore published project: source files resolved outside the input are rejected`（`restore.test.ts:649`–`:690`）把 `.wav` 的 `resolvePath` 模拟到 `tmpDir/outside.wav`。修复后，第一层 entry 边界校验对该 `.wav` entry 提前抛出，错误文案含 `resolves outside the input directory`，与该用例的正则断言一致，因此仍绿。该用例的既有覆盖意图（拒绝 sourceDir 外解析）由新的更早拦截点同样满足，无回归。

## R2 — 新增聚焦回归（`packages/functions/test/restore.test.ts:692`–`:727`）

- 用例名：`restore published project: package directory resolved outside the input is rejected before reading`
- 位置：紧随既有 source-escape 用例之后（`:690` 后）。
- 构造：
  - `releaseDir/DirEscapePkg/`（真实目录）内 `io.writeBinary` 写入有效 `DirEscapePkg_fui.bytes`（`restore.test.ts:707`）；
  - `outsideDir`（真实空目录，`restore.test.ts:706`）；
  - 受控 monkey-patch：`restoreFs.resolvePath` 将 `releaseDir/DirEscapePkg` 的规范路径解析为 `outsideDir`，其余走原实现（`restore.test.ts:709`–`:713`）。
- 断言：`t.throwsAsync(..., { message: /resolves outside the input directory/ })`（`restore.test.ts:715`–`:723`）。

### 「修复前红」实测（不是推演）

仅暂存 `packages/functions/src/restore.ts`（`git stash push -- packages/functions/src/restore.ts`），保留新测试，运行：

```bash
pnpm exec ava --no-worker-threads packages/functions/test/restore.test.ts \
  --match="*package directory resolved outside the input is rejected before reading*"
```

退出码 `1`，原始读数（`/tmp/ofgui-prefix-red.log`）：

```text
  ✘ [fail]: restore published project: package directory resolved outside the input is rejected before reading
  ─
  restore published project: package directory resolved outside the input is rejected before reading
  packages\functions\test\restore.test.ts:715
   715:     await t.throwsAsync(
   716:       () => restore({
  Returned promise resolved with:
  {
    document: Document { ... },
    projectPath: 'C:\\Users\\E_Ye\\AppData\\Local\\Temp\\openfairygui-restore-dir-escape-MsHldy\\Restored\\Restored.fairy',
    warnings: [],
  }
  › <anonymous> (packages/functions/test/restore.test.ts:715:11)
  1 test failed
```

即：修复前 restore **成功返回**（未抛错），`throwsAsync` 判定失败 → 红。修复后（`git stash pop`）同一用例绿。

## R3 — 定点自验读数

### 1. 两个测试文件（期望 72 passed）

```bash
export NODE_OPTIONS=--max-old-space-size=16384
pnpm exec ava --no-worker-threads packages/functions/test/publish.test.ts packages/functions/test/restore.test.ts
```

退出码 `0`，尾部读数：

```text
  ✔ restore › restore published project: directory batch restores packages, assets, and branch files (8.5s)
  ─

  72 tests passed
```

### 2. 类型门与 lint

```text
> tsc --noEmit --declaration false
TYPECHECK_EXIT=0
```

```text
> biome lint packages scripts examples docs/.vitepress/config.ts docs/.vitepress/theme
Checked 387 files in 484ms. No fixes applied.
LINT_EXIT=0
```

### 3. 真实 junction 端到端复验（原始反例必须死）

探针写入仓库根 `.tmp-fix-probe.mts`（内容与任务给定探针一致），运行：

```bash
pnpm exec tsx .tmp-fix-probe.mts > /tmp/ofgui-fix-probe.log 2>&1
```

退出码 `0`，日志读数：

```text
(node:11356) [DEP0205] DeprecationWarning: `module.register()` is deprecated. Use `module.registerHooks()` instead.
(Use `node --trace-deprecation ...` to show where the warning was created.)
{"junctionCreated":true,"observedError":"Error: restore: Published artifact resolves outside the input directory: Basics"}
```

- `junctionCreated=true`：真实 junction 已创建；
- `observedError` 含 `resolves outside the input directory`；
- **未出现** `bad magic`（外部无效二进制未被读取）。

探针运行后已删除；`git status --porcelain` 仅剩两个被修改的源/测试文件（见上）。

## 与预期不符的观察

无。全部读数与任务预期一致。

## 未做事项（严格按范围）

- 未处理 review 信息级发现「nested 目录间不互相去重」（清单外）。
- 未改动其他文件；未 commit / push；未动 `status.json`。
