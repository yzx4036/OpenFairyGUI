# recheck-result — 20261009-test-debt-sync 修复轮复核

verdict: approved-with-notes

## 结论

修复提交 `5acf34d` 落实了 R1/R2/R3，原始真实 junction 反例已在读取外部 binary 前被拒绝；指定的 72 项测试独立通过。`81361a3..5acf34d` 只新增规范路径边界校验和一个聚焦回归，没有改变排序、空结果文案、扁平优先、子目录读取失败静默跳过或安全段校验语义。

本轮未发现产品缺陷或阻断项。保留一项低严重度测试覆盖注记：原 `.wav` source-escape 用例现在由更早的第一层 entry 校验截获，仍能证明总体安全行为，却不再专门覆盖 `resolvePackageSourceFile` / `resolveSourceFile` 的伴随文件边界。该 resolver 实现不在本修复提交中，上一轮 B2 已通过，故不据此驳回；建议后续补一条嵌套伴随文件逃逸用例。

## 检查表

| 项 | 证据 | 结论 |
|---|---|---|
| 提交与范围 | `HEAD=5acf34d`；`git diff --stat 81361a3..5acf34d` 仅含 `packages/functions/src/restore.ts`（+10）和 `packages/functions/test/restore.test.ts`（+37）。 | 通过 |
| R1：规范根 | `packages/functions/src/restore.ts:99` 取得去尾斜杠后的 `sourceDir`；`:105` 对它调用 `resolvePath` 得到 `resolvedSourceRoot`。 | 通过 |
| R1：第一层 entry | `packages/functions/src/restore.ts:109`–`:114` 对每个 entry 先解析并校验；`:115` 才调用 `isFile`。真实 junction 探针也在目录读取前得到边界错误。 | 通过 |
| R1：嵌套 binary | `packages/functions/src/restore.ts:137`–`:147` 对匹配的 nested binary 在 `isFile` / 收集前解析并校验；`:148` 才分类并加入。受控探针得到 `nestedIsFileCalls=0`。 | 通过 |
| R1：复用比较逻辑 | `packages/functions/src/restore.ts:16`–`:25` 从 `output-transaction.js` 导入 `isPathWithin`；唯一实现仍在 `packages/functions/src/restore-internals/output-transaction.ts:7`–`:10`。提交未新增第二套比较逻辑。 | 通过 |
| R1：无多余 catch | `git diff 81361a3..5acf34d -- packages/functions/src/restore.ts` 只有 import、三处 `resolvePath`/边界判断增量；未新增 catch。既有静默 catch 仍仅位于 `packages/functions/src/restore.ts:132`–`:135`。 | 通过 |
| 语义：排序与空结果 | 排序仍为 `packages/functions/src/restore.ts:151` 的完整路径 `localeCompare`；空结果原文仍在 `:153`–`:154`。与 `81361a3` 的原逻辑逐行一致，仅因插入校验发生行号后移。 | 通过 |
| 语义：扁平优先 | flat 包仍在 `packages/functions/src/restore.ts:119`–`:126` 写入 `seenPackages`；nested 仍在 `:142` 先跳过同包。故意放置损坏 nested duplicate 的混合布局探针仍成功恢复根层 Basics。 | 通过 |
| 语义：子目录读取失败 | `packages/functions/src/restore.ts:132`–`:135` 的 `readdir(dirPath)` 失败仍无条件 `continue`。受控 `EACCES sentinel` 探针最终得到原有空结果错误，未传播 sentinel。 | 通过 |
| 语义：安全段校验 | flat binary、包目录、nested binary 的调用仍分别位于 `packages/functions/src/restore.ts:122`、`:130`、`:139`，参数仍为 `published binary file name`、`published package directory name`、`published binary file name`。修复 diff 未触碰这些调用。 | 通过 |
| R2：新增测试构造 | `packages/functions/test/restore.test.ts:692`–`:727` 创建真实包目录与有效 binary；`:709`–`:713` 仅把该包目录的 `resolvePath` 映射到根外；`:715`–`:723` 断言边界错误。 | 通过 |
| R2：修复前红、修复后绿 | `git show 81361a3:packages/functions/src/restore.ts` 的扫描在旧 `:103`–`:110` 直接 `isFile` 分类、旧 `:137`–`:138` 直接 `isFile`/收集，不会对测试映射的目录调用 `resolvePath`；测试文档只有一个无资源包，因此旧实现会成功返回，使 `t.throwsAsync` 失败。现行实现由 `restore.ts:111`–`:113` 抛错；本轮 72 项复跑包含该用例并通过。未做 stash/checkout。 | 通过 |
| 边界：目录内文件解析到外部 | 受控 resolver 把 `Nested/Nested_fui.bytes` 映射到根外，读数为 `nestedEscapeError=...Nested/Nested_fui.bytes`、`nestedIsFileCalls=0`。 | 通过 |
| 边界：扁平 + 子目录混合 | 根层放有效 Unity Basics 发布物，`Basics/` 放同名无效 binary；读数 `mixedLayout="success:mixed-output.fairy"`。若 nested 获胜会出现 bad-magic，而实际根层获胜。 | 通过 |
| 边界：空目录 | 仅含空子目录时读数为原文 `No FairyGUI published binary files found in ...empty-input.`。 | 通过 |
| 边界：不可读子目录 | 受控 `readdir(Unreadable)` 抛 `EACCES sentinel`；最终读数仍为 `No FairyGUI published binary files found in ...unreadable-input.`，证明静默跳过保持。 | 通过 |
| 原 `.wav` 用例提前截获 | `packages/functions/test/restore.test.ts:649`–`:690` 将根层 `.wav` 的 `resolvePath` 映射到外部；现行扫描会在 `restore.ts:111`–`:113` 提前拒绝，错误仍匹配 `:684` 的相同子串。功能上可接受，但 resolver 层不再由该用例直接覆盖。 | 通过，附注记 |

## 独立复跑读数

Windows PowerShell 下执行与任务命令等价的环境设置：

```powershell
$env:NODE_OPTIONS='--max-old-space-size=16384'
pnpm exec ava --no-worker-threads packages/functions/test/publish.test.ts packages/functions/test/restore.test.ts
```

退出码：`0`。日志：`%TEMP%\ofgui-recheck-ava.log`。尾部关键行：

```text
✔ publish › publish: sample packages retain exported items and indirect resource references (5.6s)
✔ restore › restore published project: directory batch restores packages, assets, and branch files (6.9s)
─

72 tests passed
```

## 原始 junction 反例复跑

仓库根按任务给定内容创建 `.tmp-recheck-probe.mts`，执行：

```powershell
pnpm exec tsx .tmp-recheck-probe.mts *> $env:TEMP\ofgui-recheck-probe.log
```

退出码：`0`。日志原文：

```text
(node:68176) [DEP0205] DeprecationWarning: `module.register()` is deprecated. Use `module.registerHooks()` instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
{"junctionCreated":true,"observedError":"Error: restore: Published artifact resolves outside the input directory: Basics"}
```

结论：`junctionCreated=true`；`observedError` 含 `resolves outside the input directory`；日志未出现 `bad magic`。

探针运行后立即删除，核验 `PROBE_EXISTS=False`；对 `.tmp-recheck-probe.mts` 的路径限定 `git status --porcelain` 无输出。完整工作区状态恢复到执行前基线：仍仅有本任务目录为未跟踪项，并非探针残留。由于任务目录在复核开始前就整体未跟踪，完整 `git status --porcelain` 字面上不为空；未将其误报为干净工作区。

## 边界对抗探针读数

系统临时现场由脚本自行创建并清理，仓库根探针脚本运行后已删除（`ADVERSARIAL_PROBE_EXISTS=False`）。退出码 `0`，JSON 原文：

```json
{"nestedEscapeError":"Error: restore: Published artifact resolves outside the input directory: Nested/Nested_fui.bytes","nestedIsFileCalls":0,"mixedLayout":"success:mixed-output.fairy","emptyError":"Error: No FairyGUI published binary files found in C:\\Users\\E_Ye\\AppData\\Local\\Temp\\ofgui-recheck-adversarial-4MhKhe\\empty-input.","unreadableError":"Error: No FairyGUI published binary files found in C:\\Users\\E_Ye\\AppData\\Local\\Temp\\ofgui-recheck-adversarial-4MhKhe\\unreadable-input."}
```

另做静态最接近失败场景检查：第一层非目标 entry 只要规范路径越界也会在过滤前失败。这是 `review-result.md` R1 明确要求的“每个第一层 entry 在 `isFile` 前校验”，不是本轮语义漂移。规范根本身若是 junction，则 `restore.ts:105` 以其真实目标作为边界，后续真实子项仍可通过；不会错误地把调用者选定的输入根自身视为逃逸。

## 修复者注记裁定

裁定：**可接受，不构成驳回理由；建议补测试，记低严重度注记。**

理由：

1. 原 `.wav` 用例依然验证“任何扫描到的输入 artifact 规范解析到根外必须拒绝”，只是拒绝点从伴随文件 resolver 前移到第一层 entry 扫描；产品安全行为变得更早，而非减弱。
2. 本修复提交没有修改 `resource-paths.ts` 的 resolver 逻辑；上一轮已独立核实 B2 的 `resolvePath + isPathWithin`，本轮定向范围不要求重审已通过项。
3. 当前测试组合缺少对 resolver 层的专门回归，未来若该层退化，原 `.wav` 用例可能仍因扫描层提前失败而假绿。因此值得补，但这是测试定位精度问题，不是本轮产品缺陷。

最小后续方案：在包子目录内放有效 `{Pkg}_fui.bytes` 和它引用的 `.wav`，根目录不放 `.wav`；仅把该嵌套 `.wav` 的 `resolvePath` 映射到输入根外。这样第一层包目录校验和 nested binary 校验均正常通过，执行必须走到 `resolvePackageSourceFile` / `resolveSourceFile` 后因伴随文件越界失败。断言同样使用 `/resolves outside the input directory/`，并保留输出不被覆盖断言。

## 发现列表

| 严重度 | 证据 | 修复方向 |
|---|---|---|
| 低 / 测试覆盖注记 | `packages/functions/test/restore.test.ts:649`–`:690` 的根层 `.wav` 现在被 `packages/functions/src/restore.ts:111`–`:113` 提前拒绝，无法单独证明伴随文件 resolver 的边界分支仍工作。当前实现未改，且上一轮已验证。 | 按“修复者注记裁定”的最小方案另补嵌套伴随文件逃逸用例；不阻断本轮批准。 |
| 信息 / 工作区状态 | 探针删除后两个 `PROBE_EXISTS` 均为 `False`，探针路径状态为空；完整状态仍列出复核开始前已存在的未跟踪任务目录。 | 无需处理；不得为追求字面 clean 删除 Hermes 任务产物。 |

本轮未修改产品代码、测试、`status.json`，未 commit/push。

建议索引: restore 规范路径逃逸复核 → 墨典:memory/agent-delegation-pitfalls.md#代码审查与真实反例
