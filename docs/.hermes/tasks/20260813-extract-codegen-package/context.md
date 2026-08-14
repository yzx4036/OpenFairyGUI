# @openfairygui/codegen 包提取 — Codex 独立编码委派（Mode B）

## 项目

OpenFairyGUI · TypeScript + pnpm workspace + tsdown + ava + biome
工作目录：`E:\_Proj\OpenFairyGUI`（bash 路径 `/e/_Proj/OpenFairyGUI`）

## 任务

把 `plugins/et-fui-codegen` 的通用模板代码生成能力提取为 `packages/codegen`（`@openfairygui/codegen`）正式 npm 包，插件改为依赖新包。

**必读文档（按序）**：
1. `docs/.hermes/tasks/20260813-extract-codegen-package/requirements.md` — 需求与通用性边界判定
2. `docs/.hermes/tasks/20260813-extract-codegen-package/architecture.md` — 架构设计（模块划分/API 签名/文件清单/依赖关系）
3. `docs/.hermes/tasks/20260813-extract-codegen-package/implementation-plan.md` — 分步实施计划（Step 0-8，严格按步执行）

## 硬门槛（违反即失败）

1. **逐字节不变**：`plugins/et-fui-codegen` 对同一 FairyGUI 工程生成的 C# 代码必须与改造前完全一致。基线已生成在 `test-output/fgui-codegen-baseline/`（167 个文件）。改造后跑 `npx tsx scripts/verify-fgui.ts` 重新生成到 `test-output/fgui-codegen/`，然后 `diff -r test-output/fgui-codegen-baseline test-output/fgui-codegen` 必须零差异。
2. **零新运行时依赖**：新包不引入任何 dependencies。
3. **不引入过度抽象**：严格按 architecture.md 执行；writer 契约若实现时发现与插件耦合过深，允许放弃（architecture.md §4.4 已授权），行为不变优先。
4. **文档同步**：architecture.md §7.3 / implementation-plan Step 7 列出的所有文档（README/README_EN/docs/architecture-overview/docs/guide/packages/release.yml/CHANGELOG 双语/插件 README）必须同步更新。仓库 AGENTS.md 有文档联动硬规则。

## 环境要点

- shell 是 git-bash（MSYS），用 POSIX 语法
- `pnpm install` 在根目录执行以识别新 workspace 包（新包无外部依赖，纯 workspace 链接）
- `plugins/et-fui-codegen` 的 build 需要 `NODE_OPTIONS="--max-old-space-size=16384"`（已知 V8 OOM），根目录全量 build 同理
- 验证命令（全部必须通过）：
  - `pnpm --filter @openfairygui/codegen test && pnpm --filter @openfairygui/codegen build`
  - `pnpm --filter et-fui-codegen build && pnpm --filter et-fui-codegen test`
  - 根 `pnpm run lint`、根 `pnpm run typecheck`
  - 根 `pnpm run test`（注意：存量有 11 个已知失败基线，见下）
  - `npx tsx scripts/smoke-test.ts` 全绿
  - 字节级 diff 零差异（见硬门槛 1）
- **已知基线失败**：根 `pnpm run test` 存量有 11 个已知失败（与 bytes 子文件夹路径约定相关的测试债，非本次任务范围）。你的验收标准是**失败集不新增**，不是清零。先跑一遍记录失败集再动手。
- `scripts/smoke-test.ts` 的 import 路径需按 implementation-plan Step 7 改为从新包导入（engine/naming/hash 部分）。

## 特别指示

- 严格按 implementation-plan.md 的 Step 1-8 顺序执行，每步做完即验证。
- engine.ts / naming.ts 从插件**逐字迁移**，只改文件头注释归属。
- hash.ts 按 architecture.md §4.3 泛化为 `fnv1a31(value)`；插件侧保留 `hashPanelId` 薄封装。
- 不要 git commit——完成后保持工作区改动状态，由 Hermes 验收后统一提交。
- 完成后写 `docs/.hermes/tasks/20260813-extract-codegen-package/coding-result.md`，必须包含：
  - `## 完成清单`（每个 Step 的状态与关键决策，writer 契约是否采用及理由）
  - `## 验证结果`（所有命令的实际输出摘要，字节级 diff 结果，测试失败集对比）
  - `## 架构回审`（对照 architecture.md 逐项确认实现一致性，格式 `| 检查项 | 状态 | 说明 |`，漂移项标 `needs_architecture` 不自行修复）
  - `## 遗留问题`（如有）
- 把 `docs/.hermes/tasks/20260813-extract-codegen-package/status.json` 更新为 `{"status": "ready_for_review"}`。
