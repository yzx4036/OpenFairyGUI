# 定向复审（Codex）— 20261009-test-debt-sync 修复轮复核

你此前对本任务判 `rejected`（报告：`docs/.hermes/tasks/20261009-test-debt-sync/review-result.md`；唯一阻断项：包子目录为 junction/symlink 指向 `sourceDir` 外时，扫描跟随并读取外部二进制）。修复轮已完成并提交：

- 被审提交范围：`81361a3..5acf34d`（`git log --oneline 81361a3..5acf34d`、`git diff 81361a3..5acf34d`）
- 修复自述（不可信，逐条核）：`docs/.hermes/tasks/20261009-test-debt-sync/fix-result.md`

本轮=定向复核「最小修复清单 R1/R2/R3」的落实与语义保持。**不需要**重审上一轮已通过项（A1–A10、B2、测试声明完整性等），除非发现新证据。

## 必做 1：独立复跑

```bash
export NODE_OPTIONS=--max-old-space-size=16384
pnpm exec ava --no-worker-threads packages/functions/test/publish.test.ts packages/functions/test/restore.test.ts
```

期望 **72 tests passed**（71+新增 1）、退出码 0。

## 必做 2：原始反例必须死（重跑你上一轮的真实 junction 探针）

把以下探针写入仓库根临时文件 `.tmp-recheck-probe.mts`，运行后**立即删除**并确认 `git status --porcelain` 干净：

```ts
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { restoreNode } from './packages/functions/src/node.ts';

void (async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ofgui-recheck-probe-'));
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

运行：`pnpm exec tsx .tmp-recheck-probe.mts > /tmp/ofgui-recheck-probe.log 2>&1`，**读日志文件**（Windows 管道可能丢输出）。
期望：`observedError` 含 `resolves outside the input directory`；**不得**再出现 `bad magic`。

## 必做 3：对抗检查（逐项给证据，`文件:行`）

1. **R1 落实**：`packages/functions/src/restore.ts` —— 规范根取值；第一层 entry 在 `isFile` 前校验；嵌套 binary 在收集前校验；复用 `output-transaction.js` 的 `isPathWithin`（无第二套比较逻辑）；无多余 catch。
2. **语义保持**：对照 `81361a3..5acf34d` diff 核对——排序（localeCompare）、空结果错误原文、扁平优先 `seenPackages`、子目录 `readdir` 失败静默跳过、`assertSafeRestoreSegment` 调用位置与参数，全部未变。
3. **R2 测试有效性**：新增用例（`packages/functions/test/restore.test.ts` 新增段）是否真的修复前红、修复后绿。复核方式：读新用例 + `git show 81361a3:packages/functions/src/restore.ts` 对照（修复前无该校验 ⇒ 用例必红）。**禁止**在共享工作区做 stash/checkout 类操作。
4. **边界反例尝试**（找修复仍漏的场景；给探针读数或静态论证）：
   - in-bounds 目录内的文件条目解析到外部（可控 resolvePath 或符号链接，平台受限时用受控方式）；
   - 扁平 + 子目录混合布局语义（扁平优先不变）；
   - 空目录 / 不可读子目录（静默跳过语义不变）；
   - 其余你能构造的最接近失败场景。
5. **裁定修复者注记**：「原 source-escape 用例（.wav 模拟逃逸）现在在第一层 entry 校验处被提前拦截（错误文案含相同子串，仍绿）」。请裁定：是否可接受？（是否要求补一条「嵌套伴随文件逃逸」用例以覆盖 resolver 层校验；给出理由与最小方案。）该项结论按严重度记为注记或驳回理由。

## 输出

写 `docs/.hermes/tasks/20261009-test-debt-sync/recheck-result.md`：

- `verdict: approved / approved-with-notes / rejected`（rejected 必附最小修复清单）
- 检查表（项 / 证据 / 结论）
- 复跑读数（命令 + 尾部关键行）+ 探针读数原文
- 发现列表（严重度 / 证据 / 修复方向）

## 约束

- 唯一写入 = `recheck-result.md`（临时探针放系统临时目录或仓库根并以「运行后删除 + git status 校验」收尾）；不改代码、不动 `status.json`、不 commit/push。
- 受限命令如实标注；铁律：2 次尝试仍卡住 → 写 `fault.md`（原因/已完成/未完成/建议）后结束。
