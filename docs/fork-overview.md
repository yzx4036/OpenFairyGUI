# Fork 定制总览

本仓库 `yzx4036/OpenFairyGUI` 是上游 [OpenFairyGUI](https://github.com/OpenFairyGUI/OpenFairyGUI) 的 **fork 分支**（Y0Studio 维护）：在持续跟踪上游发布（`upstream-release` → `test-merge` → `develop`）的同时，维护本仓库额外新增的功能与修改。本页给出完整清单、设计原则与各专题入口；专题页包含设计原理、用法与端到端教程。

## 定制清单

| 功能 | 类型 | 一句话 | 专题 |
|---|---|---|---|
| et-fui-codegen 插件 | 新增 | FairyGUI → ET 客户端 C# 确定性代码生成，发布时排他接管内置 codegen | [ET 代码生成插件使用指南](./fork-et-codegen-guide.md) |
| 生成区标记保护（merge 语义） | 新增 | Entity 文件按 `GENERATED:et-fui-codegen:<regionId>:BEGIN/END` 标记区局部替换，区外手写代码永久保留 | [ET 代码生成插件使用指南](./fork-et-codegen-guide.md) |
| CLI `--plugin` | 新增 | 显式加载工程目录之外的 publish 插件目录 | [Publish 插件](./publish-plugins.md) |
| `@openfairygui/codegen` 包 | 新增 | 零运行时依赖的模板引擎、命名、哈希与代码写入策略，供插件复用 | [Fork 下游代码生成策略](./fork-codegen-policy.md) |
| bytes 按包子文件夹输出 | 修改 | Unity 发布产物落到 `{outputDir}/{PublishName}/`，对齐编辑器 `Bundles/FUI/{Pkg}/` 约定 | [发布布局与工程还原](./fork-publish-and-restore.md) |
| `PublishSettings.pluginsDir` | 新增 | 可配置 Node 插件扫描目录，避开与 FairyGUI 编辑器 `plugins/` 的冲突（OpenFairyGUI#2） | [发布布局与工程还原](./fork-publish-and-restore.md) |
| restore 子文件夹支持与路径边界 | 修改 | 恢复链路消费子文件夹布局；扫描拒绝 junction/symlink 逃逸输入根 | [发布布局与工程还原](./fork-publish-and-restore.md) |
| Top 层 View opaque 点击拦截告警 | 新增 | `top_view_opaque_blocks_touches` warning 诊断 | 本页「校验增强」 |
| 发布 tag 前缀隔离 | 新增 | fork 发布一律 `y0-*` 前缀，与上游 `v*` tag 分离 | [分支增强记录](./CHANGELOG.md) |

## 设计原则

### 本地优先（合并铁律）

合并上游（`upstream-release` → `test-merge`/`develop`）时**优先保证本仓库新增的功能和修改项**；冲突时先审计比较，上游更好才采纳。完整铁律与历次合并/发布记录见[分支增强记录](./CHANGELOG.md)。

### 定制隔离

1. 定制全部放在**纯新增目录**（`plugins/`、`packages/codegen`），不修改上游文件；
2. 必须动上游文件时只做附加性改动（`tsconfig.json`、CI 清单、README 导航）；
3. 优先利用上游已有的扩展点（`genCode` 插件钩子）而非改上游逻辑；
4. 上游内置实现保持原样；同名不同行为的协议级差异不强行统一。

依赖方向与上游同步影响面详见 [Fork 下游代码生成策略](./fork-codegen-policy.md)。

### 行为口径

文档只描述当前正式实现，不记录历史过渡方案、旧兼容层或未来规划（与仓库文档口径一致）。

## 校验增强：Top 层 View 的 opaque 点击拦截告警

### 设计原理（问题背景）

FairyGUI 命中测试在组件范围内未命中子元素时，若组件的 `opaque === true` 会返回组件自身（`Container.HitTest_Container`：`target == null && opaque && rect.Contains(point) → target = this`）。因此 `Type:View|Layer:Top` 的全屏被动覆盖层（如 Banner）一旦漏写 `opaque="false"`，会吞掉下层（Normal/Scene/Background）的全部点击——实机表现为「按钮能看不能点、连按下态缩放都没有」。

该问题在 ProjZero 的 Banner（Top 层 1080×2344 被动覆盖层）上真实发生并排查多轮，故在工具侧加入告警防复发。

### 诊断行为

- `ofgui validate <project>` 对「`remark` 为 `Type:View|Layer:Top` 且 `opaque === true`」的组件报告 `top_view_opaque_blocks_touches`（`warning` 级别）。
- 仅告警：不影响 `validate` 退出码与 `status`；同层 View 若是有意拦截的模态/引导层可忽略。
- 处置：被动覆盖层补 `opaque="false"` 后重新发布。

### 入口

- 诊断归属与逐码恢复指引见[诊断与恢复](./guide/diagnostics.md)。
- 校验报告契约（API/CLI/Backend/MCP 统一）见[工程验证](./project-validation.md)。

## 相关文档

- [分支增强记录](./CHANGELOG.md) —— 每个版本相对上游的完整修改记录
- [Fork 下游代码生成策略](./fork-codegen-policy.md)
- [发布布局与工程还原](./fork-publish-and-restore.md)
- [ET 代码生成插件使用指南](./fork-et-codegen-guide.md)
- [新设备接入与多项目使用指南](./new-device-multi-project.md)
