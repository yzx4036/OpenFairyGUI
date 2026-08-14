# 阶段 C：架构回审结果

审查者：OpenCode 架构回审（阶段 C）
审查对象：Codex（阶段 B）+ Hermes（阶段 B-fix）对 `@openfairygui/codegen` 包提取任务的最终实现
审查基准：`docs/.hermes/tasks/20260813-extract-codegen-package/architecture.md`、`implementation-plan.md`、`requirements.md`
证据方法：除读取实现外，独立复跑字节级对比、全量 build/lint/typecheck/test/smoke，并对「基线空 `Event/` 目录」做了原版插件真实发布路径对照实验。

## 逐项审查结论表

| # | 检查项 | 结论 | 说明 |
|---|---|---|---|
| 1 | §1 字节级门槛 | **通过**（附 1 项 nit） | 独立复跑 sha256：baseline/current 均为 167 文件，逐文件 sha256 全部一致（另复验文件清单一致、`git diff --check` 干净）。唯一差异是 baseline 里多出 10 个**空** `HotfixView/*/Event/` 目录。为排除回归，我用 HEAD 原版插件源码经真实 `publishNode` 链路对 ProjZero 重新生成，结果**原版代码同样不产生任何 `Event/` 目录**——即该差异是基线目录遗留的陈旧空目录（非新旧代码任何一方产物），**不是提取引入的回归**。文件级字节不变证据链可信。 |
| 2 | §2 通用/ET 边界 | **通过** | `packages/codegen/src/*` 无任何 import（纯 TS）；插件 `src/` 仅剩 `hash.ts`（薄封装）、`index.ts`、`model.ts`、`templates.ts` + `templates/*.tpl`。`engine.ts`/`naming.ts` 已删除，无残留引用（rg 全仓 0 命中）。 |
| 3 | §3 包结构 | **通过** | `package.json` public（无 `private`）、`type: module`、`sideEffects: false`、`exports` 含 require/types 与 default/types 双出口、`files: [dist/, src/]`、devDeps 仅 ava/tsx、**无 dependencies**。无包内 `tsconfig.json`/`tsdown.config.ts`（符合架构）。`dist/index.js|cjs|d.ts|d.cts` 齐全。 |
| 4 | §4 API 契约 | **通过** | `renderTemplate(template, ctx, strict = true)` 与 `TemplateContext` 逐字迁移（与原文件 diff 为零）；7 个命名/路径函数齐全；`fnv1a31(value)` 算法保留，独立复算 `fnv1a31('pkg1:comp1') = 1794741604` 与 hash.test.ts 断言一致；插件 `hashPanelId(packageId, componentId)` 薄封装（`fnv1a31(\`${pkg}:${comp}\`)`）公开面保留。writer 契约签名与 §4.4 一致。 |
| 5 | §5 依赖方向 | **通过** | 插件 `dependencies: { "@openfairygui/codegen": "workspace:*" }`（运行时依赖），`@openfairygui/core`/`@openfairygui/functions` 保持 `devDependencies`（源码均 `import type`）；codegen 零依赖 → 单向、无循环。 |
| 6 | §6 部署契约 | **通过** | 插件 README 已移除「no runtime imports」表述，改为说明运行时依赖 `@openfairygui/codegen`，复制部署需安装该包；`docs/publish-plugins.md` 补充了运行时包解析要求；`smoke-projzero` 真实复制 ProjZero 到临时目录并在工程 `node_modules` 落地 codegen 包，验证复制部署场景可解析（本次实测通过）。 |
| 7 | §7 文件清单与文档同步 | **通过** | `release.yml` **四个**实际清单位置（verify 版本校验 L44、pack L66、npmjs publish L113、GitHub Packages L164）均加入 codegen；双语 CHANGELOG 的 Unreleased 条目内容一致；README/README_EN 包导航、`docs/guide/packages.md` 与 `docs/en/guide/packages.md`、双语 `architecture-overview.md`、`docs/publish-plugins.md`、根 `tsconfig.json` paths 均同步。`docs/README.md` 未改：本次无新增/重命名关键文档，现有入口仍有效（符合 AGENTS.md 触发条件）。 |
| 8 | Hermes 4 项修复合理性 | **通过**（版本 lockstep 为必要修正） | ① 版本 0.1.0→0.3.1 lockstep：必要。release.yml L44 要求全部公开包版本等于发布 tag，其他包均为 0.3.1，codegen 若保持 0.1.0 会使每次发布校验必败；统一 0.3.1 是正确解。② Promise 缓存 `_cachePromise`：修复了原 `_cache` 对象缓存并发冷启动可能读到半填充缓存的问题，不改变任何生成产物（已验证）。③ build 加 `--copy src/templates`：修复 dist 缺少 `.tpl` 的问题，`dist/templates/` 现含 5 个与 src 逐字节一致的文件（cmp 验证）。④ import 排序：纯机械整理，lint 全绿，无行为影响。 |

## 阻塞项清单

无 **blocking** 项。

- **should-fix**（均不阻塞，建议后续顺手处理）：
  1. 基线目录 `test-output/fgui-codegen-baseline` 混入了 10 个空 `HotfixView/*/Event/` 陈旧目录（非新旧代码任何一方产物，已用原版插件真实发布实验证实）。`diff -r` 会因此报「Only in baseline」，虽不影响文件级字节结论，但为让证据链完全干净，建议从空目标重建一份基线再复验。
  2. `writeCodegenFiles` 将全部 `directories` 并行 mkdir；契约的 `mkdir` 未声明「recursive 语义」。Node publish 适配器为 `recursive: true`（已核对），当前部署无风险；但契约注释最好显式说明 mkdir 需支持父目录自动创建，避免未来非递归宿主接入时行为漂移。
- **nit**：
  1. `architecture.md` §7.1 仍写 codegen `v0.1.0`，实现为 lockstep `0.3.1`。此为已被 Hermes 解决的 `needs_architecture` 项，最终决策合理；仅提醒后续把架构文档版本口径同步为 lockstep，避免文档与实现再次分叉。

## 最终裁决

**APPROVE**

理由：
1. 字节级硬门槛通过——167 个生成文件逐文件 sha256 一致，且我用原版插件真实发布链路对照，确认 baseline 的空 `Event/` 目录差异不是提取回归。
2. 通用/ET 边界干净，零运行时依赖、公开包、单向依赖、无循环。
3. 全部构建/测试/检查复验通过：codegen 14 tests、插件 6 tests、根 smoke 7 组、根 build/lint/typecheck 全绿、根 test 失败集与声明一致（11 个存量失败、无新增）。
4. Hermes 4 项修复均合理，其中版本 lockstep 是 release.yml 校验约束下的必要修正；Promise 缓存与 `--copy templates` 修复了真实缺陷且未改变产物。

`status.json` 已更新为 `review_passed`。
