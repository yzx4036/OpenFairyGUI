# Changelog — 分支增强记录

> 本文档蒸馏本 fork（`yzx4036/OpenFairyGUI`，develop 分支）相对上游的修改记录。
> 每次合并上游、新增分支特性时追加；只记录行为差异，不重复上游 release notes。

## ⚖️ 上游合并铁律（最高优先）

> 合并上游（`upstream-release` → `test-merge`/`develop`）时，**必须优先保证本仓库新增的功能和修改项（本仓库自己的需求）**。合并上游只是锦上添花的更新。

1. **本地优先**：任何冲突，默认以本仓库的实现为准——本仓库的功能、设计、优化领先时，直接弃掉对应的上游修改。
2. **审计比较**：冲突时先审计上游的修改是否比本仓库优秀或实现更好：
   - 本仓库的设计和优化领先 → 弃掉这部分上游的修改；
   - 上游更好 → 把上游的设计和新功能合并进来。
3. **验证门槛**：合并后必须跑 `pnpm run build` + `pnpm run lint` + `pnpm run test`，确认本仓库功能完好、无新增回归（与合并前基线对比失败集）。
4. **记录**：每次合并完成，在本文件追加一条合并记录（上游基线 commit、冲突文件、取舍决策）。

## 2026-08-04 — v0.2.0-alpha.37 分支增强

### [feat] publish(bytes): 产物输出到 {outputDir}/{PkgName}/ 子文件夹

- **commit**: `3ff19b5`
- **文件**: `packages/functions/src/publish.ts` → `resolvePackagePublishPlan()`
- **行为**: Unity（`fileExtension === 'bytes'`）发布时，解析出的输出目录自动追加 `/{PublishName}/` 子文件夹；每个包的全部资源（`_fui.bytes` + 图集 PNG）落在自己的子目录。
- **背景**: 对齐 FairyGUI 编辑器的 `Assets/Bundles/FUI/{PkgName}/` 约定，避免 14 个包的产物扁平堆在 FUI/ 根目录。
- **影响**: `.fui` 等其他扩展名不受影响（仍扁平输出）；需重编译 `functions` + `cli` 两个包才生效。
- **验证**: `publish` 输出 `E:\tmp\.../Common/Common_fui.bytes` 等子文件夹结构，根目录 0 扁平文件。

### [feat] CLI publish 支持 --plugin 加载外部 codegen 插件

- **commit**: `765cdfa`
- **文件**: `packages/cli/src/commands/publish.ts`（+ functions 插件加载路径）
- **行为**: `--plugin <dir>` 显式加载工程目录之外的插件目录，与工程内 `plugins/` 自动发现合并。
- **背景**: 让 `et-fui-codegen` 代码生成插件挂在共享仓库，无需复制进每个 FGUI 工程。

### [feat] plugins/et-fui-codegen — ProjZero ET 代码生成插件

- **目录**: `plugins/et-fui-codegen/`
- **行为**: publish 时按 ProjZero 模板产出 `PanelId.cs` / `FUI_{Name}.cs` / `{Name}Panel.cs` / `{Name}PanelSystem.cs` / `FUIBinder.cs`。
- **标记**: `AUTO_GENERATED_MARK`（每次覆盖）/ `PRESERVED_MARK`（仅首次）。
- **remark 约定**: `Type:View|Layer:Normal` → 完整 Panel；`Type:Comp|Layer:Top` → 子组件绑定。
- **验证**: `npx tsx plugins/et-fui-codegen/scripts/smoke-projzero.ts`（mock 单测）+ `scripts/verify-fgui.ts`（读真实工程）。

### [chore] pnpm-lock 更新（upstream merge 引入 jpeg-js 等）

- **commit**: `967bbf5`
- **背景**: 合并上游后 `MODULE_NOT_FOUND: jpeg-js` → `pnpm install --no-frozen-lockfile && pnpm build`。

## 2026-08-19 — fork 首个发布 `y0-v0.1.0`

- **tag**: `y0-v0.1.0`（annotated，指向 `ed030c3`，已推送 origin）
- **前缀约定**: fork 自有发布一律用 `y0-` 前缀——与上游 `v*` tag 分离，且不会误触发继承自上游的 `release.yml`（该 workflow 只监听 `v*` 并强制校验 tag == v+包版本，fork 未改包版本，触发必失败）。`git tag -l 'y0-*'` 即全部 fork 发布。
- **内容快照**: 上游 v0.3.1 基线 + et-fui-codegen 插件（三项漏洞修复 + 对抗测试 11/11）+ CLI `--plugin` + bytes 按包子文件夹输出。
- **验证**: build（`NODE_OPTIONS=--max-old-space-size=16384`）✅ / lint ✅ / et-fui-codegen test 11/11 ✅ / functions 11 项失败为已文档化基线测试债（bytes 子文件夹断言，非回归）。

## 2026-08-19 — `y0-v0.1.0` 重置指向 main HEAD

- **动作**: `y0-v0.1.0` 由 `ed030c3` 重置到发布时的 main HEAD（完整覆盖 README Y0Studio 定制章节 + 本条记录），本地与远端 tag 同步替换。
- **原因**: tag 应覆盖完整发布内容（含 README 定制功能文档），与正式发布的 main 保持一致。

## 2026-08-19 — `y0-v0.1.0` 再次重置指向 main HEAD

- **动作**: main 因新增 `docs/new-device-multi-project.md`（新设备与多项目指南）前进，`y0-v0.1.0` 再次重置到当前 main HEAD，本地与远端 tag 同步替换。
- **原因**: 维持「tag = main HEAD」惯例，确保发布 tag 覆盖全部文档。

## 2026-09-15 — 校验增强：Top 层 View 的 opaque 点击拦截告警（fork 特性）

### [feat] validation: `top_view_opaque_blocks_touches` 诊断（warning）

- **文件**: `packages/core/src/validation.ts`（新增诊断码）、`packages/core/src/uam/validate.ts`（新规则 + `pushIssue` 支持 warning 级别）、`packages/core/test/project-validation.test.ts`（新测试）
- **行为**: `remark` 为 `Type:View|Layer:Top` 且 `opaque === true` 的组件在 `ofgui validate` 中报告 `warning` 诊断。
- **背景**: FairyGUI 命中测试在组件范围内未命中子元素时返回组件自身（`Container.HitTest_Container`: `target == null && opaque && rect.Contains(point) → target = this`）；全屏 View 因此会吞掉下层（Normal/Scene/Background）全部点击——实机表现为「按钮能看不能点、连按下态缩放都没有」。该问题在 ProjZero 的 Banner（Top 层 1080×2344 被动覆盖层，漏写 `opaque="false"`）上真实发生并排查多轮，故在工具侧加告警防复发。
- **影响**: 仅告警（`warning`，不影响 `validate` 退出码与 `status`）；同层 View 若不是被动覆盖层（模态/引导层有意拦截）可忽略。上游不含此规则，属 fork 增强。
- **验证**: `pnpm exec ava packages/core/test/project-validation.test.ts`（新增用例：Top 层告警 / `opaque="false"` 与 `Layer:Normal` 不告警）；`pnpm typecheck`、`biome lint`.

## 上游合并基线

- `7af7ab0` merge upstream-release v0.2.5 → test-merge；`03ef5ed` test-merge → develop。
- fork 已含 `#86 preserve override whitespace`、`#85 XML overrides + SVG`、`#79/#78/#77/#76/#75` 等上游修复。
- `3b468dd` merge upstream-release v0.6.3 → test-merge（2026-10-09，记录见下）。

## 2026-10-09 — merge upstream-release → test-merge（v0.3.1 → v0.6.3）

- **上游基线**: `3b468dd`（= 上游 main / v0.6.3 tip；含 v0.4.0、v0.5.0(-alpha.1~4)、v0.6.0、v0.6.1、v0.6.2、v0.6.3 共 85 个上游提交）
- **冲突文件（10）**: `README.md`、`README_EN.md`、`docs/architecture-overview.md`、`docs/en/architecture-overview.md`、`docs/guide/packages.md`、`docs/en/guide/packages.md`、`docs/editor-publish-settings.md`、`docs/project-validation.md`、`packages/cli/src/commands/publish.ts`、`packages/core/src/uam/validate.ts`
- **取舍决策（Jev 决策评审）**:
  - 代码冲突按「本地功能 + 上游改进」并集：`cli/publish.ts` 保留 `--plugin` 加载块，同时采纳上游 `--json` / `PublishNodeResult` 输出流（合并后 `publishNode` 签名同时支持 `plugins?: LoadedPlugin[]` 与 result 返回）；`uam/validate.ts` import 区保留本地 `ProjectDiagnosticSeverity`（warning 级别与 opaque 规则），同时采纳上游 property-rules 抽取与 re-export。
  - 架构文档：采纳上游精简重写版为基线（46K→26K），本地增量以「模块表新增 codegen 两行 + 数据流补 codegen 边」重放（Jev：策略选择 1.0 置信，上游采纳 0.96）。
  - README 双语：保留 Y0Studio 定制段落与含 `codegen` 的包表；导航采纳上游分类表并补「协议文档 / Fork 定制」行。
  - 发布设置：上游变量替换段与本地 Unity bytes 子文件夹小节并存；补上 `pluginsDir` 的设置文档说明（fork 增强，此前缺失的文档同步；Jev 判定为本次唯一薄弱点，已修复）。
  - 上游删除 `backend/services/job-service.ts` 及 `runtime-jobs` 集成测试：属上游重构（`35883e8`），fork 自 v0.3.1 起对 backend services 零改动，无本地内容损失。
- **测试同步（4 个上游新测试适配本地约定/环境）**: `republishing…` 与 `publish contexts isolate…` 的子文件夹断言、`plugins › publishNode…` 的 readdir 顶层视图、`cli inspect --json` 的 node 弃用警告环境适配（`--no-deprecation`）。
- **验证**: `pnpm run build` ✅（`NODE_OPTIONS=--max-old-space-size=16384`）；`pnpm run lint` ✅（387 files）；`pnpm run typecheck` ✅；`pnpm run test` 失败集与合并前基线完全一致（11 项已文档化的 bytes 子文件夹断言债，非本次 merge 引入）；et-fui-codegen 14/14 ✅。

## 2026-10-09 — fork 发布 `y0-v0.2.0`

- **tag**: `y0-v0.2.0`（annotated，指向发布时 main HEAD）
- **内容快照**: 上游 v0.6.3 基线（自 v0.3.1 起同步 v0.4.0~v0.6.3，85 个上游提交）+ 全部 Y0Studio 定制：et-fui-codegen 插件（含生成区 marker 保护）、CLI `--plugin`、bytes 按包子文件夹输出、`PublishSettings.pluginsDir`、Top 层 opaque 点击拦截校验告警（`top_view_opaque_blocks_touches`）、`@openfairygui/codegen` 包。
- **验证**: `pnpm run build` ✅ / `pnpm run lint` ✅（387 files）/ `pnpm run typecheck` ✅ / `pnpm run test` 失败集与合并前基线完全一致（11 项已文档化的 bytes 子文件夹断言债）/ et-fui-codegen 14/14 ✅。

## 2026-10-09 — fork 发布 `y0-v0.2.1`（测试债清零 + 治理链本地化 + 插件构建修复）

- **tag**: `y0-v0.2.1`（annotated，指向发布时 main HEAD）
- **内容快照**: `y0-v0.2.0` 全量内容 + 以下增强（沿 develop 提交 `4745b8c` → `5bcff7b`）。

### [fix] restore 支持 bytes 子文件夹发布布局（测试债清零，三锻协作）

- **提交**: `e66afe4`（子目录发现 + 伴随文件解析）、`81361a3`（publish 断言同步）、`5acf34d`（扫描规范路径边界校验）、`8f5d921`（嵌套伴随文件逃逸用例）
- **行为**: restore 两遍扫描发现 `{PkgName}/` 子文件夹二进制（扁平优先去重、子目录 readdir 失败静默跳过、排序与空结果文案保持）；伴随文件解析新增 `resolvePackageSourceFile`（根优先 → 包目录兜底）；扫描层新增规范路径边界校验（复用 `isPathWithin`），拒绝包子目录 junction/symlink 与嵌套二进制逃逸输入根。
- **背景**: 10 项 publish 断言债（bytes 子文件夹约定）+ 1 项 restore 产品缺口（无法消费 fork 自身子文件夹布局）。三锻协作：OpenCode 修复 → Codex 对抗验证（抓到 junction 逃逸真缺陷并经编排层独立复现）→ OpenCode 定向修复 → Codex 定向复审 approved-with-notes → 注记测试补齐。任务产物：`docs/.hermes/tasks/20261009-test-debt-sync/`。
- **验证**: functions 两测试文件 73/73 ✅；全量 648 全绿（11 项历史测试债清零，bytes 子文件夹特性引入以来首次）；真实 junction 探针 ✅。

### [fix] et-fui-codegen 构建去掉 `--dts`（消除默认堆 OOM）

- **提交**: `7fc52dc`
- **行为**: build 脚本去掉 `--dts`。根因：dts 生成沿 `@openfairygui/core` 完整类型图展开（rolldown-rc 病理），内存需求 >8GB（默认 4GB 与 8GB 均 OOM，16GB 才通过）；插件入口指向 src、`dist` 无消费者，dts 产物无用途。
- **背景**: 该 OOM 是 GitHub CI「Repository checks」job 长期红的根因（`pnpm check` 含 build），并导致干净消费者环境（eval:agent 的构建步骤）失败。
- **验证**: 默认堆全量 `pnpm build` ✅（插件构建 OOM → 74ms）；插件测试 14/14 ✅；eval:agent 标准消费者流程 10/10 ✅。

### [chore] 治理链本地化（fork 结构满足上游检查）

- **提交**: `7540cc3`、`f88427d`、`feacb97`
- **行为**: impact map 补 `codegen` 测试组与规则、新增 `packages/codegen/AGENTS.md`、`top_view_opaque_blocks_touches` 诊断补恢复指引并重生成契约数据、双语入口对齐（README_EN / docs/en/README）、仓库检查硬编码计数同步（agentFiles 8、catalog 102）。
- **背景**: `pnpm test:repo` / `check:agent-links` / `contracts:check` 在 fork 结构下全绿化（CI Guidance / consumer job 失败根因）。
- **验证**: `pnpm test:repo` 35/35 ✅；`pnpm docs:check` ✅；契约生成物零漂移 ✅。

### [fix] 测试基建与冒烟脚本

- **提交**: `4745b8c`
- **行为**: `scripts/smoke-test.ts` 的 View 断言同步现行 `panel-entity` 模板（View accessor + getter 接线）。
- **验证**: `pnpm exec tsx scripts/smoke-test.ts` 7 组全过 ✅。

### 发布门（全功能验收矩阵 18/18）

- typecheck / lint / build / **全量测试 648 全绿（含默认堆复跑）** / `test:repo` / `docs:check` / 插件测试 ×2 / smoke-test / verify-fgui（87 个 C# 文件）/ smoke-projzero / codegen-preserve（覆盖区域生成 live：标记区内替换 + 区外保留 + System preserve + 绑定 overwrite）/ 导入导出 live 往返（13 个 bytes 子文件夹产物 → 恢复 70 个 XML）/ `eval:agent` 10/10（拼UI / 改UI / 发布 / 恢复 / 安全停止）。
- **已知限制（非阻断）**: 携带 FairyGUI 编辑器 Lua 插件的工程需 `PublishSettings.pluginsDir` 配置或排除 `plugins/` 副本后经 CLI 发布。

## 2026-10-09 — GitHub Pages 文档站开通（fork 基路径适配）

- **提交**: `9c38e90`（工作流适配）
- **动作**: ① 仓库 Pages 开通（Source = GitHub Actions，站点 `https://yzx4036.github.io/OpenFairyGUI/`，HTTPS 强制）；② `deploy-docs.yml` 构建环境 `VITEPRESS_BASE: /` → `/OpenFairyGUI/`、`VITEPRESS_SITE_URL` → fork 站点 URL。
- **背景**: `deploy-docs` 工作流自 fork 建立以来持续失败（Pages 未开通，`configure-pages` 报 "Get Pages site failed"）；开通后首次部署暴露基路径缺陷——上游工作流按自有域名 `fairygui.dev` 根路径部署（commit `6ca28c8`），fork 部署在工程页时页面引用 `/assets/...` 全部 404。
- **验证**: 本地 `VITEPRESS_BASE=/OpenFairyGUI/ pnpm docs:build` 产物引用 `/OpenFairyGUI/assets/...` ✅、`og:image` 指向 fork 站点 ✅；线上部署 run 与站点资源探活随本次推送核验。

## 2026-08-13 — merge upstream-release → test-merge（v0.2.5 → v0.3.1）

- **上游基线**: `8a8946a`（含 v0.2.6、v0.3.0、v0.3.1：协议类型完整覆盖、SWF 资源保留、项目值校验、发布信任边界加固、backend 路径策略、atomic save/stale lock 恢复等 44 个提交）
- **冲突文件**: 无——5 个双侧改动文件（`docs/README.md`、`docs/editor-publish-settings.md`、`docs/publish-plugins.md`、`packages/functions/src/node.ts`、`packages/functions/src/publish.ts`）全部自动合并成功。
- **取舍决策**:
  - 本仓库 `--plugin` 插件加载、`plugins/et-fui-codegen`、bytes 子文件夹输出全部完好保留（`publish.ts` 中 `outputDir = ${outputDir}/${publishName}` 逻辑与上游新增的包级 atlas 选项解析共存）；
  - 上游插件失败中止策略（`shouldAbortPluginFailure`，插件声明 `abortOnError` 时 hook 失败直接抛错而非仅 warn）→ 采纳，与本地 `--plugin` 功能互补；
  - 上游 `validateProjectNode` 导出、包级 atlas 设置解析（useGlobal/sizeOption/extractAlpha 等）→ 采纳，纯增量改进。
- **测试同步**: 上游新增的 3 个 bytes 产物测试（misc runtime-prefixed / package exclusions / atlas RGB-alpha split）断言未适配本地子文件夹约定 → 本仓库同步断言路径到 `{PkgName}/` 子文件夹（`packages/functions/test/publish.test.ts`），3 个测试转绿。
- **验证**: `pnpm run build` ✅（et-fui-codegen 需 `NODE_OPTIONS=--max-old-space-size=16384`，pre-existing）；`pnpm run lint` ✅（1 个 pre-existing warning，`scripts/verify-fgui.ts` 未用导入）；`pnpm run test` 失败集与 merge 前基线完全一致（11 个，均为本地已知测试债）。

## 2026-08-07 — merge upstream-release → test-merge（v0.2.0-alpha.37 → v0.2.5）

- **上游基线**: `51c7a18`（含 v0.2.0→v0.2.5、UAM 元数据完善、英文文档、layabox 修复、folder-atlas 事务、browser session lock 等 45 个提交）
- **冲突文件**: `packages/cli/src/commands/publish.ts`（仅 import 区）
- **取舍决策**:
  - 保留本仓库 `loadPlugins`/`LoadedPlugin`/`--plugin` 插件加载功能（上游无此功能）；
  - 合并上游 `import type { Command }` 位置调整（编译必需，非功能差异）；
  - 上游 `codegen.ts` 的 `Required<CliCodeGenerationSettings>` 类型强化 + `plugins.ts` 的 `PluginManifest` 类型重构 → 自动合并成功，保留（纯类型改进，与本地 loadPlugins 兼容）。
- **验证**: `pnpm run build` ✅（et-fui-codegen 插件需 `NODE_OPTIONS=--max-old-space-size=16384`，pre-existing）；`pnpm run lint` ✅；`pnpm run test` 失败集与 merge 前基线完全一致（11 个，均为本地 bytes 子文件夹功能导致的测试断言未同步，非本次 merge 引入）。

---

## 维护约定

| 项目 | 约定 |
|---|---|
| 触发 | 每次 fork 相对上游的行为变更 / 上游合并完成 |
| 内容 | commit hash、改动文件、行为差异、验证方式 |
| 位置 | 只追加，不重写历史条目 |
