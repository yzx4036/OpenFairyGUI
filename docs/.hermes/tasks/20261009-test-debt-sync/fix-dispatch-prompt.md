# 修复轮（OpenCode）— 20261009-test-debt-sync 回审驳回项定向修复

## 背景与范围

Codex 对抗验证轮判 `rejected`（完整报告：同目录 `review-result.md`）。唯一阻断项：包子目录为 junction/symlink 指向 `sourceDir` 外时，二进制扫描会跟随并读取外部文件；编排层已用真实 junction 独立复现（读取到外部无效二进制 → `Invalid FairyGUI binary file: bad magic`）。

本轮**只做** `review-result.md`「最小修复清单」1/2/3 三件事 + 定点自验。清单之外（含信息级发现「nested 目录间不互相去重」）一律不做。

工作目录：`E:/_Proj/OpenFairyGUI`（git-bash）。基线 HEAD = `81361a3`（develop）。

## R1 — `packages/functions/src/restore.ts` 扫描块（现约 103–140 行）

1. 扫描开始处取规范根：`const resolvedSourceRoot = await Promise.resolve(options.fs.resolvePath(sourceDir));`
2. 第一层循环内，在 `isFile` 判定**之前**对每个 entry：`const resolvedEntryPath = await Promise.resolve(options.fs.resolvePath(entryPath));`，并校验 `isPathWithin(resolvedSourceRoot, resolvedEntryPath)`；越界即抛错。
3. 嵌套二进制收集前同样：先 `await Promise.resolve(options.fs.resolvePath(nestedPath))` 校验同一根边界，通过后再 `isFile`/收集；越界抛同一错误。
4. 错误文案（两处一致，前缀固定）：`restore: Published artifact resolves outside the input directory: ${越界条目}`；第一层条目用 entry 名，嵌套用 `{目录名}/{文件名}`。**必须包含** `resolves outside the input directory` 子串（既有测试的正则依赖）。
5. import：从 `./restore-internals/output-transaction.js` 复用 `isPathWithin`（已导出，实现为规范化前缀比较）；**禁止**另写第二套路径比较逻辑。
6. 保持既有语义完全不变：二进制排序（localeCompare）、空结果错误原文、扁平优先 seenPackages 逻辑、子目录 readdir 失败静默跳过、既有 assertSafeRestoreSegment 调用位置与参数。
7. 不要给 resolvePath 套多余 catch：`RestoreFileSystem.resolvePath` 的两个实现（node 适配器 `adapters/node/restore.ts:63`、测试用 `createRestoreFs`）都不会抛错（realpath 失败回退 `path.resolve`）。

## R2 — `packages/functions/test/restore.test.ts` 新增聚焦回归

位置：紧随既有 `restore published project: source files resolved outside the input are rejected`（约 649–690 行）之后。

- 用例名：`restore published project: package directory resolved outside the input is rejected before reading`
- 构造：
  - `releaseDir/DirEscapePkg/`（真实目录）内用 `io.writeBinary(doc, ...)` 写入有效 `DirEscapePkg_fui.bytes`（doc/pkg 最简构造，含 setId/setPublishName，仿照相邻用例）；
  - `outsideDir`（真实空目录）；
  - 受控模拟跨平台逃逸（仿照 671–675 行 monkey-patch 模式）：`restoreFs.resolvePath` 将 `releaseDir/DirEscapePkg` 的规范路径解析为 `outsideDir`，其余走原实现。
- 断言：`t.throwsAsync(..., { message: /resolves outside the input directory/ })`。
- 该测试在修复前应红、修复后绿——在 fix-result.md 里附上你对「修复前红」的推演或实测说明。

## R3 — 定点自验（读数原文进 fix-result.md）

1. 两个测试文件：`export NODE_OPTIONS=--max-old-space-size=16384; pnpm exec ava --no-worker-threads packages/functions/test/publish.test.ts packages/functions/test/restore.test.ts` → 期望 **72 passed**。
2. `pnpm typecheck` exit 0；`pnpm lint` exit 0。
3. **真实 junction 端到端复验**（原始反例必须死）。参考探针（写到仓库根临时文件 `.tmp-fix-probe.mts`，运行后删除，并确认 `git status --porcelain` 仅剩两个被修改的源/测试文件）：

```ts
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { restoreNode } from './packages/functions/src/node.ts';

void (async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ofgui-fix-probe-'));
	try {
		const input = path.join(root, 'input');
		const outside = path.join(root, 'outside');
		await fs.mkdir(input);
		await fs.mkdir(outside);
		await fs.writeFile(path.join(outside, 'Basics_fui.bytes'), 'invalid external binary');
		let junctionCreated = false;
		let observedError = '';
		try {
			await fs.symlink(outside, path.join(input, 'Basics'), 'junction');
			junctionCreated = true;
			await restoreNode({ inputDir: input, output: path.join(root, 'output'), packages: ['Basics'], force: true });
			observedError = '(no error)';
		} catch (error) {
			observedError = String(error);
		}
		console.log(JSON.stringify({ junctionCreated, observedError }));
	} finally {
		await fs.rm(root, { recursive: true, force: true });
	}
})();
```

运行：`pnpm exec tsx .tmp-fix-probe.mts > /tmp/ofgui-fix-probe.log 2>&1` 后读日志（Windows 管道可能丢输出，务必重定向到文件再读）。
期望：`observedError` 含 `resolves outside the input directory`；**不得**再出现 `bad magic`。

## 产物与约束

- 写 `fix-result.md`：改动文件清单、R1–R3 逐项映射（`文件:行`）、全部命令读数原文、probe 输出、任何与预期不符的观察。
- 只改 `packages/functions/src/restore.ts` 和 `packages/functions/test/restore.test.ts`；不 commit、不 push、不动 `status.json`。
- 铁律：只做本范围事；2 次卡住或需越界才能修 → 写 `fault.md`（原因/已完成/未完成/建议）后结束，不硬撑。
