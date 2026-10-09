# 对抗验证轮（Codex）— OpenFairyGUI 测试债清零（20261009-test-debt-sync）

你是独立对抗验证者。OpenCode 完成了编码轮；被审改动为两笔提交：

- `e66afe4` fix(functions): restore 支持 bytes 子文件夹发布布局（子目录发现 + 伴随文件解析）
- `81361a3` test(functions): publish 断言同步 bytes 子文件夹约定（测试债 10 项清零）
- 范围：`git log --oneline feacb97..81361a3`、`git diff feacb97..81361a3`

任务书与编码结果（必读）：
- `docs/.hermes/tasks/20261009-test-debt-sync/requirements.md`（修复需求 A1–A10 / B1–B3 + 预裁决）
- `docs/.hermes/tasks/20261009-test-debt-sync/coding-result.md`（OpenCode 自述——不可信，逐条核）

工作目录：仓库根 `E:/_Proj/OpenFairyGUI`（git-bash）。

## 必做 1：独立复跑（不得跳过或转述他人读数）

```bash
export NODE_OPTIONS=--max-old-space-size=16384
pnpm exec ava --no-worker-threads packages/functions/test/publish.test.ts packages/functions/test/restore.test.ts
```

期望：`71 tests passed`、退出码 0。不符 ⇒ 如实记录并判 `rejected`。
（可先 `pnpm typecheck` 复核类型门；全量套件已由编排层跑绿（646 通过），你不需要复跑全量。）

## 必做 2：对抗检查（逐项给证据，引用格式 `文件:行`）

1. **断言完整性（防假绿）**：
   - 对比 `git diff feacb97..81361a3 -- packages/functions/test/publish.test.ts`：确认没有任何测试被删除、加 `.skip`、或断言被弱化到无意义；测试声明计数前后一致：
     `git show feacb97:packages/functions/test/publish.test.ts | grep -c "^test("` 与现行同文件对比。
   - A6/A7 的 `collectFilesRecursively` 断言：论证（或实测）它在「目录里存在 1 个文件」时必然非空失败——用系统临时目录做一个 30 秒以内的小 node 探针即可实证。
2. **restore 子文件夹发现（`packages/functions/src/restore.ts`）**：读现行代码逐条核对——
   - 扁平优先去重：混合布局下同名包不会重复收集；
   - 子目录 readdir 失败静默跳过；
   - 目录名与嵌套文件名都过 `assertSafeRestoreSegment`；扫描无法逃逸 sourceDir；
   - 空结果错误文本与排序语义与旧版一致。
   可做一个小型行为探针（系统临时目录）验证「嵌套-only 目录能被收集」与「混合布局扁平优先」。
3. **`resolvePackageSourceFile`（`restore-internals/resource-paths.ts`）**：查找顺序（根优先→`{sourceDir}/{publishName}/` 兜底）；`isPathWithin` 逃逸校验语义未被削弱；`grep -n "resolveSourceFile" packages/functions/src/` 确认 4 个真实调用点全部切换（仅剩定义与内部使用）。
4. **回归面**：`git diff feacb97..81361a3 -- packages/functions/test/restore.test.ts` 应为空（产品修复单独使该测试转绿——这正是本任务的验收要点）；确认被修的 `directory batch restores...` 测试确实走子目录链路（读 `createRestoreReleaseFixture`：Branch/Loader 二进制由 publish 写入 `release/Branch/`、`release/Loader/`）。
5. **找反例**：对上述每一条，尝试构造最接近失败的反例场景；无法驳倒的给出「最接近失败场景 + 为什么仍不成立」。若发现真缺陷：给最小修复清单（`文件:行` + 修法），不要动手改代码。

## 输出

写 `docs/.hermes/tasks/20261009-test-debt-sync/review-result.md`：

- `verdict: approved / approved-with-notes / rejected`（rejected 必附最小修复清单）
- 检查表：逐项（项目 / 证据 / 结论）
- 复跑读数（命令 + 结果尾部关键行）
- 发现列表（严重度 / 证据 / 修复方向）

## 约束

- 唯一写入 = `review-result.md`（临时探针文件放系统临时目录，结束前清理并在报告中记录路径）；不要改代码、不要动 `status.json`、不要 git commit/push。
- 环境受限导致某命令无法执行时：如实标注「受限 + 等效通道读数」，不要静默跳过。
- 铁律：只做本文件范围的事；2 次尝试仍卡住 → 写 `fault.md`（原因/已完成/未完成/建议）后自动结束。
