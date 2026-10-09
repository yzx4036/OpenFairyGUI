# review-result — 20261009-test-debt-sync

verdict: rejected

## 结论

指定的 71 项测试与类型检查均独立通过，A1–A10 的断言同步、B1 的常规 nested-only/混合布局行为、B2 的根优先与 4 个调用点切换也均核实无误；但 B1 存在一个可复现的输入边界缺陷：包子目录若是指向 `sourceDir` 外部的 junction/symlink，扫描会跟随它并读取外部二进制。该行为违反本轮明确要求的“扫描无法逃逸 sourceDir”，故不能批准。

## 检查表

| 项目 | 证据 | 结论 |
|---|---|---|
| 提交与范围 | `git log --oneline feacb97..81361a3` 仅有 `e66afe4`、`81361a3`；diff 仅改 `packages/functions/src/restore.ts`、`restore-internals/resource-paths.ts`、`restore-internals/asset-output.ts`、`packages/functions/test/publish.test.ts`。 | 通过 |
| 测试声明完整性 | 基线与现行 `publish.test.ts` 的 `^test(` 计数均为 50；双方均无 `test.skip`/`test.todo`/`.skip(`。完整 diff 未删除测试，只新增递归 helper 并替换目标路径/读取方式。 | 通过 |
| A1 | bytes 路径改为包子目录：`packages/functions/test/publish.test.ts:512`。 | 通过 |
| A2 | sound 路径改为包子目录：`packages/functions/test/publish.test.ts:550`。 | 通过 |
| A3 | expected、absent、bytes 三组路径均进入 `Loader/`：`packages/functions/test/publish.test.ts:584`、`:589`、`:594`。 | 通过 |
| A4 | Branch binary、round-trip、主/分支 atlas 均进入 `Branch/`：`packages/functions/test/publish.test.ts:619`、`:634`、`:652`、`:653`。 | 通过 |
| A5 | merged Branch binary 与 round-trip 均进入 `Branch/`：`packages/functions/test/publish.test.ts:678`、`:690`。 | 通过 |
| A6 | 递归 helper 定义于 `packages/functions/test/publish.test.ts:125`–`:133`，断言位于 `:770`。实测单个嵌套文件返回非空数组，空数组断言失败。 | 通过 |
| A7 | 复用同一 helper，断言位于 `packages/functions/test/publish.test.ts:795`，没有重复定义。 | 通过 |
| A8 | GhostPkg binary 路径进入包子目录：`packages/functions/test/publish.test.ts:949`。 | 通过 |
| A9 | HitTest binary 路径进入包子目录：`packages/functions/test/publish.test.ts:1057`。 | 通过 |
| A10 | 由 `_fui.bytes` 文件名推导包目录：`packages/functions/test/publish.test.ts:1100`。 | 通过 |
| B1：nested-only 与扁平优先 | 两遍扫描及 flat `seenPackages` 记录见 `packages/functions/src/restore.ts:104`–`:121`；nested 命中 flat 包名时跳过见 `:131`–`:138`。行为探针中 nested-only 成功恢复 Basics；混合布局下将 nested duplicate 故意写成无效二进制仍成功恢复，证明 flat 获胜。 | 通过 |
| B1：子目录读取失败 | `readdir(dirPath)` 被 `try/catch` 包裹并 `continue`：`packages/functions/src/restore.ts:125`–`:130`。 | 通过 |
| B1：段名安全 | 包目录名与 nested binary 名分别调用 `assertSafeRestoreSegment`：`packages/functions/src/restore.ts:124`、`:133`；该函数拒绝空值、`.`、`..`、NUL、斜杠、反斜杠和冒号：`packages/functions/src/restore-internals/resource-paths.ts:8`–`:11`。 | 词法边界通过 |
| B1：规范路径边界 | 扫描在 `packages/functions/src/restore.ts:107`–`:110`、`:126`–`:138` 直接 `isFile`/`readdir`，没有把 `resolvePath` 后的目录和二进制与规范化 `sourceDir` 做 `isPathWithin` 比较。junction 探针确认可读取 sourceDir 外二进制。 | **失败（阻断）** |
| B1：排序与空结果 | 最终仍按完整路径 `localeCompare` 排序：`packages/functions/src/restore.ts:141`；空结果错误原文保留于 `:143`–`:144`。与基线 diff 对照语义一致。 | 通过 |
| B2：查找顺序 | `resolvePackageSourceFile` 先调用根目录 resolver，命中即返回；未命中才校验 publishName 并查 `{sourceDir}/{publishName}`：`packages/functions/src/restore-internals/resource-paths.ts:143`–`:153`。探针得到 `directIsRoot=true`、`fallbackIsNested=true`。 | 通过 |
| B2：伴随文件逃逸校验 | `resolveSourceFile` 对候选段做安全校验，并以 `resolvePath` + `isPathWithin` 拒绝候选逃逸：`packages/functions/src/restore-internals/resource-paths.ts:124`–`:140`；`isPathWithin` 实现位于 `packages/functions/src/restore-internals/output-transaction.ts:7`–`:10`。模拟逃逸探针得到 `escapeRejected=true`。 | 通过（原有 resolver 语义未削弱） |
| B2：4 个真实调用点 | package-aware 调用位于 `packages/functions/src/restore-internals/asset-output.ts:49`、`:100`、`:221` 和 `packages/functions/src/restore-internals/resource-paths.ts:121`；`resolveSourceFile` 仅剩 `resource-paths.ts:124` 的定义及 `:149`、`:153` 的内部调用。 | 通过 |
| 回归面未改测试 | `git diff --exit-code feacb97..81361a3 -- packages/functions/test/restore.test.ts` 退出 0、无输出。 | 通过 |
| 回归测试确走子目录链路 | fixture 先复制扁平 Unity release，再调用 publish 发布 Branch/Loader：`packages/functions/test/restore.test.ts:206`–`:226`；bytes 发布规则在 `packages/functions/src/publish.ts:227`–`:230` 将它们写入各自包目录；测试随后断言 Branch/Loader 已恢复：`packages/functions/test/restore.test.ts:231`–`:255`。本轮日志也显示发布到 `release/Branch, release/Loader`。 | 通过 |
| 类型门 | `pnpm typecheck` 退出码 0，`tsc --noEmit --declaration false` 无错误。 | 通过 |

## 独立复跑读数

命令（Git Bash）：

```bash
export NODE_OPTIONS=--max-old-space-size=16384
pnpm exec ava --no-worker-threads packages/functions/test/publish.test.ts packages/functions/test/restore.test.ts
```

退出码：`0`。尾部关键行：

```text
✔ restore › restore published project: directory batch restores packages, assets, and branch files (6.8s)
─

71 tests passed
```

补充类型门：

```text
> tsc --noEmit --declaration false
```

退出码：`0`。

## 对抗探针与反例

### 1. A6/A7 非空目录

- 临时目录：`C:\Users\E_Ye\AppData\Local\Temp\ofgui-review-helper-p1YRuU`
- 构造：`pkg/artifact.bin` 一个文件。
- 读数：`files=["pkg\\artifact.bin"]`、`emptyAssertionFailed=true`。
- 结论：helper 遇到任意普通文件必然返回非空；空目录残留仍被预裁决允许。最接近失败场景是读取权限错误或目录循环，但前者会让测试直接失败、符号链接又会作为非目录条目计入文件列表，均不会假绿。
- 清理：`cleaned=true`。

### 2. nested-only 与混合布局

- 临时目录：`C:\Users\E_Ye\AppData\Local\Temp\ofgui-review-layout-am0HRT`
- nested-only：把公开 Unity release 放入 `input/Basics/`，成功恢复 Basics，`packageFound=true`。
- 混合布局：根目录放有效 `Basics_fui.bytes`，`Basics/` 中放同名无效二进制；恢复仍成功，证明扁平文件优先且 nested duplicate 未被读取。
- 最接近失败场景：同一包只在两个不同子目录重复出现时，当前 `seenPackages` 不记录 nested 命中，可能同时收集两份；但正式布局是一包一个 `{publishName}/`，且本任务预裁决只要求 flat-vs-nested 去重，因此该点不单独构成阻断。
- 第一次命令因 `tsx -e` 的 CJS 顶层 await 限制在编译阶段退出，未创建临时目录；第二次按 async IIFE 执行成功。
- 清理：`cleaned=true`。

### 3. package-aware resolver

- 临时目录：`C:\Users\E_Ye\AppData\Local\Temp\ofgui-review-resolver-gF0uTi`
- 读数：`directIsRoot=true`、`fallbackIsNested=true`、`escapeRejected=true`、`unsafePublishNameRejected=true`。
- 最接近失败场景：根目录和包目录同时存在同名伴随文件；实测根目录获胜，符合预裁决。候选规范路径被模拟到 sourceDir 外时抛错，未削弱原有 `isPathWithin` 校验。
- 清理：`cleaned=true`。

### 4. sourceDir 规范路径逃逸（命中真缺陷）

- 临时目录：`C:\Users\E_Ye\AppData\Local\Temp\ofgui-review-junction-k4Oum3`
- 构造：`input/Basics` 为 junction，目标是 sibling `outside/`；外部目录仅放无效的 `Basics_fui.bytes`。
- 读数：`junctionCreated=true`、`escapedScan=true`，恢复错误为 `Invalid FairyGUI binary file: bad magic`。
- 判定：若边界有效，应在读取外部二进制前拒绝，或最终得到 `No FairyGUI published binary files found ...`；实际 bad-magic 证明外部文件已被发现并读取。安全段检查只能阻止 `..`/分隔符等词法逃逸，不能阻止合法段名上的 junction/symlink。
- 清理：`cleaned=true`。

## 发现列表

| 严重度 | 证据 | 修复方向 |
|---|---|---|
| 高 / 阻断 | `packages/functions/src/restore.ts:107`–`:110` 在规范路径边界检查前分类条目，`:126`–`:138` 会跟随目录 junction 并收集其中二进制；真实探针读取了 sourceDir 外的无效 binary。 | 按下方最小修复清单处理。 |
| 信息 | `packages/functions/src/restore.ts:136` 只用 flat 阶段建立的 `seenPackages` 去重；两个 nested 目录内的同包名 binary 不互相去重。 | 当前正式布局与预裁决不覆盖该非法形态；若未来允许任意目录名，再补 nested 命中后的 `seenPackages.add(packageName)`。 |

## 最小修复清单

1. `packages/functions/src/restore.ts:103`–`:140`：扫描开始时用 `options.fs.resolvePath(sourceDir)` 取得规范根；对每个第一层 entry 在 `isFile`/`readdir` 前解析规范路径，并用现有 `isPathWithin` 验证仍位于该规范根内。对每个 nested binary 也应在 `isFile`/收集前做同一根边界校验，以覆盖目录 junction 和文件 symlink；越界时抛出明确的 restore 输入逃逸错误。
2. `packages/functions/src/restore.ts:16`–`:24`：复用 `restore-internals/output-transaction.ts:7` 的 `isPathWithin`，不要另写第二套路径比较逻辑；保留现有排序、空结果文本、flat 优先和子目录 `readdir` 失败静默跳过语义。
3. `packages/functions/test/restore.test.ts:231` 附近：增加一个聚焦的边界回归（可用受控 `RestoreFileSystem.resolvePath` 模拟目录/文件解析到 sourceDir 外，避免平台依赖），证明越界 binary 在读取前被拒绝；随后复跑本报告中的 71 项命令及 `pnpm typecheck`。

未修改产品代码、`status.json`，未 commit/push。
