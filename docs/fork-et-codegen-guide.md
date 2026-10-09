# ET 代码生成插件使用指南（et-fui-codegen）

`plugins/et-fui-codegen` 是 fork 提供的 FairyGUI publish 插件：把 FGUI 工程发布为 **ET（ETPlus / ProjZero 风格）客户端 C# 代码**。策略背景（插件接管机制、与上游内置 codegen 的关系、上游同步影响面）见 [Fork 下游代码生成策略](./fork-codegen-policy.md)；本页专注**设计原理、配置与端到端教程**。

## 设计原理

### 生成产物

发布时按工程配置生成如下文件（布局示意，根目录以 `codePath` 为准）：

```text
FUIAutoGen/PanelId.cs                 # 组件 PanelId（32 位 FNV-1a(packageId:componentId)）
ModelView/<Package>/FUI_<Name>.cs     # 绑定类（成员字段 / GetChild / GetController / FUIGComponent）
ModelView/<Package>/<Name>.cs         # Entity（面板实体，区域标记合并）
HotfixView/<Package>/<Name>System.cs  # System（手写工作区，存在即不覆盖）
HotfixView/FUIBinder.cs               # SetPackageItemExtension 绑定注册
```

### 三类写入语义（核心设计）

| 类别 | 文件 | 重发布行为 |
|---|---|---|
| overwrite | `PanelId.cs`、`FUIBinder.cs`、`FUI_*.cs` | 每次全量重写（纯生成物） |
| merge | `ModelView/<Pkg>/<Entity>.cs` | 有标记 → 仅替换标记区内内容，区外手写代码保留；存在但无标记 → 整体保留（回退）；不存在 → 写入 |
| preserve | `HotfixView/<Pkg>/<Entity>System.cs` | 存在即完全不动（业务逻辑工作区） |

设计目标：UI 组件树变化时（组件改名、layer/包变化、新增绑定字段）生成区能持续刷新，而开发者写在生成区之外的业务代码**永不丢失**。每次重发布输出统计日志：`Merged N region-marked Entity file(s), preserved N marker-less Entity file(s) + N System file(s).`（计数为 0 时不打印）。

### 区域标记协议

- 生成文件内以 C# 注释标记可替换区域：

  ```csharp
  // ===== GENERATED:et-fui-codegen:<regionId>:BEGIN =====
  ...生成内容...
  // ===== GENERATED:et-fui-codegen:<regionId>:END =====
  ```

- Entity 文件当前包含两个区域：`<Name>:attributes`（特性/继承声明）与 `<Name>:view`（视图属性接线）。
- 重发布时按区域 ID 定位并**只替换 BEGIN/END 之间的内容**；标记行本身与区外代码不动。无标记的历史文件回退为整体保留。

### 生命周期转发

System 模板生成 `RegisterUIEvent` / `OnShow` / `OnHide` / `BeforeUnload` 四个生命周期转发方法，并遍历子级转发 `FUIEventComponent.Instance.InvokePanelLifecycle`，与 ET 实体生命周期对接。

### remark 约定（决定生成形态）

| remark | 生成 |
|---|---|
| `Type:View\|Layer:*` | 完整面板：Entity + System + PanelId |
| `Type:Comp` / `Type:None` / 无 remark | 仅绑定类 |

## 安装与配置

### 方式一：工程内插件（发布时自动发现）

把 `plugins/et-fui-codegen/` 复制进 FGUI 工程的插件目录（默认 `plugins/`，可用 [`pluginsDir`](./fork-publish-and-restore.md) 指定专用目录），并让工程可解析运行时依赖 `@openfairygui/codegen`。发布时自动加载，`genCode` 钩子**排他接管**内置生成。

> 若工程还会被 FairyGUI 桌面编辑器打开，请把 Node 插件放进 `pluginsDir` 指定的专用目录——编辑器会把默认 `plugins/` 下每个子目录当 Lua 插件加载（OpenFairyGUI#2）。

### 方式二：CLI 显式加载

```bash
ofgui publish ./FGUIProject -t unity --plugin ../OpenFairyGUI/plugins/et-fui-codegen
```

`--plugin` 与工程内插件目录自动发现的合并规则见 [Publish 插件](./publish-plugins.md)。

### 配置（两个开关）

1. **工程级**：`settings/Publish.json` → `codeGeneration.allowGenCode: true`，并配置 `codePath`（生成根目录）、`classNamePrefix`（默认 `FUI_`）、`packageName`（命名空间前缀，如 `ET.Client`）、`memberNamePrefix`、`ignoreNoname`、`getMemberByName` 等字段结构见[编辑器发布设置](./editor-publish-settings.md)。
2. **包级**：`package.xml` → `<publish genCode="true">`；仅勾选的包参与生成，包级 `codePath` 可覆盖工程级。

## 教程：从 FGUI 工程到 ET 客户端代码（端到端）

以下以 ProjZero 风格链路为例；**建议在工程副本上操作**，避免污染原始工程。

1. **准备**：复制 FGUI 工程为工作副本；把 `plugins/et-fui-codegen` 复制进副本插件目录；准备 `node_modules/@openfairygui/codegen`（本地链接 `packages/codegen/src` 即可）。

2. **打开生成开关**：`settings/Publish.json` 设 `allowGenCode: true`、`codePath: "generated-et"`；目标包（示例 `Login`）`package.xml` 设 `genCode="true"`。

3. **发布**：

   ```bash
   ofgui publish ./FGUIProject-copy -t unity -o ./release
   ```

   期望日志出现 `et-fui-codegen: Generated ET/FairyGUI code into <codePath>`；首次发布不出现 `Merged ...` 行（计数为 0 不打印）。

4. **检查生成物**：`generated-et/` 下五类文件齐全：

   ```bash
   ls generated-et/FUIAutoGen/PanelId.cs \
      generated-et/ModelView/Login/FUI_LoginPanel.cs \
      generated-et/ModelView/Login/LoginPanel.cs \
      generated-et/HotfixView/Login/LoginPanelSystem.cs \
      generated-et/HotfixView/FUIBinder.cs
   ```

5. **验证手写区保护（覆盖区域生成）**：
   - 在 Entity 文件标记区**之外**追加一行手写代码；
   - 在标记区**之内**改动一行；
   - 重新执行第 3 步发布；
   - 期望：区外手写行保留、区内改动被替换回生成内容；日志出现 `Merged 1 region-marked Entity file(s), ...`。

6. **验证 System 工作区**：修改 `<Name>System.cs`（例如在 `OnShow` 中加日志）→ 重发布 → 文件原样保留（preserve 语义）。

7. **验证绑定类刷新**：在 FGUI 中给组件新增一个控件 → 重发布 → `FUI_<Name>.cs` 全量刷新，新增成员出现在绑定类中（overwrite 语义）。

## 常见问题

| 现象 | 原因与处置 |
|---|---|
| 发布中止：`Unknown file extension ".lua"` | 工程默认 `plugins/` 里有编辑器 Lua 插件；配置 `pluginsDir` 或发布副本排除 `plugins/`（见[发布布局与工程还原](./fork-publish-and-restore.md)） |
| 重发布后手写代码被覆盖 | 手写代码写进了标记区（BEGIN/END 之间）；把业务代码移到标记区之外 |
| 无标记旧文件不再更新 | 属设计内回退（preserve）；需要继续接收更新时，让文件带上模板的区域标记（重新生成或手工补标记对） |
| 未生成任何文件 | 检查两个开关：`codeGeneration.allowGenCode` 与包级 `genCode="true"` |

## 验证方式（仓库侧）

- 插件单元测试：`pnpm --filter et-fui-codegen run test`（含区域合并、保留回退、缺失区域插入等用例）。
- 真实工程冒烟：`pnpm exec tsx plugins/et-fui-codegen/scripts/smoke-projzero.ts <path-to-FGUIProject>`（在临时副本上执行，不触碰原始工程）。
