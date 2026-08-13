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

## 上游合并基线

- `7af7ab0` merge upstream-release v0.2.5 → test-merge；`03ef5ed` test-merge → develop。
- fork 已含 `#86 preserve override whitespace`、`#85 XML overrides + SVG`、`#79/#78/#77/#76/#75` 等上游修复。

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
