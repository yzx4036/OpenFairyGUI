# 发布布局与工程还原（Fork 定制）

本页说明 fork 对「发布 → 导入导出（还原）」链路的修改：**bytes 按包子文件夹输出**、**`PublishSettings.pluginsDir`**、**restore 子文件夹支持与路径边界安全**；含两条端到端教程。

## 设计原理

### 为什么 bytes 按包子文件夹输出

- FairyGUI 编辑器发布到 `Assets/Bundles/FUI/{PkgName}/`——运行时按包名组织产物。上游 CLI 默认把全部包扁平堆在输出根目录，多个包的 `*_fui.bytes` 与图集 PNG 混在一起，与编辑器布局不一致，搬运脚本需要额外重组。
- fork 修改：Unity 发布（`fileExtension === 'bytes'`）时，每个包的产物写入 `{outputDir}/{PublishName}/`（`PublishName` 取包 `publishName`，缺省回退包名）；包的全部资源（`_fui.bytes` + 图集 PNG）落在各自子目录。其他扩展名（如 `.fui`）保持扁平输出不变。

### 为什么需要 pluginsDir

- Node 发布默认从工程 `plugins/` 扫描 publish 插件；而 FairyGUI 桌面编辑器把 `plugins/` 下每个子目录当作 **Lua 插件**加载。当 `plugins/` 里放的是 TypeScript/Node 插件（如 et-fui-codegen），编辑器打开工程会加载失败（OpenFairyGUI#2）。
- fork 新增 `PublishSettings.pluginsDir`：在 `settings/Publish.json` 的 `publish` 节点声明 Node 插件扫描子目录（相对工程根，默认 `plugins`）。设为 `cli-plugins` 之类的专用目录，即可让编辑器与 CLI 各用各的。字段口径详见[编辑器发布设置](./editor-publish-settings.md)。
- 注意：缺少插件 `main` 的目录会被跳过；但若插件 `package.json` 的 `main` 指向 `.lua`，Node 加载会中止发布。这类工程要么配置 `pluginsDir`，要么用「副本排除 `plugins/`」的方式发布（见文末限制）。

### restore 为什么必须支持子文件夹

- restore 从发布产物重建工程（导入导出）。bytes 布局改为子文件夹后，恢复链路必须按同样约定发现二进制，否则 fork 自己的发布物无法被自己的 restore 消费。
- 实现：两遍扫描——先收集扁平二进制（兼容扁平布局），再扫描一层包子目录（`{输入目录}/{PkgName}/`）；同名包以扁平为准（扁平优先去重）；子目录读取失败静默跳过。
- 伴随文件（图集 PNG、散图、音频等）解析顺序：输入根优先 → 包子目录兜底。

### 路径边界安全（扫描不得逃逸输入根）

- 原则：restore 只信任**输入目录内**的产物。包子目录若是指向输入根之外的 junction/symlink，或嵌套二进制解析到根外，必须在读取之前拒绝。
- 错误形如：`restore: Published artifact resolves outside the input directory: <条目>`；伴随文件同规则的错误为 `restore: Published source file resolves outside the input directory: <候选名>`。
- 实现：扫描时对每个第一层条目与每个嵌套二进制取规范路径（`resolvePath`）并与规范化输入根做包含性校验。含义：包目录名请使用普通目录；用符号链接拼接发布目录不受支持。

## 发布布局参考

```text
FUI/                      ← publish -o 输出根
├── Login/
│   ├── Login_fui.bytes   ← 二进制
│   ├── Login_atlas0.png  ← 图集等伴随资源
│   └── ...
├── Common/
│   ├── Common_fui.bytes
│   └── Common_atlas0.png
└── ...
```

## 用法

### 发布

```bash
ofgui publish <project-dir> -t unity [-o <output-dir>] [-p Pkg1,Pkg2] [--json]
```

- `-o` 覆盖输出目录（子文件夹规则同样生效）；`-p` 只发布指定包。
- `--json` 输出单行结果（退出码 0 成功 / 1 工作流失败 / 2 参数错误）。

### 还原（导入导出）

```bash
ofgui restore <release-dir> -o <output-dir> [-p Pkg1,Pkg2] [-f] [-t unity] [--json]
```

- `-f/--force`：仅在完整暂存恢复成功后替换已存在的非空输出目录。
- 输入必须为可信本地发布目录；恢复范围与不可恢复内容见[发布产物恢复边界](./published-project-restore-limitations.md)。

## 教程 A：发布并检查子文件夹布局

1. 发布：

   ```bash
   ofgui publish ./FGUIProject -t unity -o ./release
   ```

2. 检查每个包一个子目录、`*_fui.bytes` 位于包目录内：

   ```bash
   ls ./release/*/*_fui.bytes
   ```

3. 期望：日志出现 `publish: Published N package(s) to <dir>`；`release/` 根目录没有扁平的 `*_fui.bytes`。

## 教程 B：从发布产物还原工程

1. 还原：

   ```bash
   ofgui restore ./release -o ./Restored --json
   ```

2. 期望：退出码 0；生成 `Restored/Restored.fairy` 与各包 XML 及资源；JSON 含 `projectPath`、`packages[]`、`warnings[]`。

3. 边界自验（可选）：

   ```bash
   # 把某包子目录替换为指向外部的 junction/symlink 后重试，应被拒绝而非读取外部文件
   ofgui restore ./release-manipulated -o ./Restored2
   # 期望错误：restore: Published artifact resolves outside the input directory: <条目>
   ```

## 限制与注意

- **FairyGUI 编辑器 Lua 插件工程**：Node CLI 无法加载 `.lua` 插件入口，会导致发布中止。处置二选一：
  1. 配置 `PublishSettings.pluginsDir` 指向专用 Node 插件目录（推荐，一次配置长期有效）；
  2. 发布用的工程副本排除 `plugins/` 目录（适合一次性脚本）。
- **恢复是受限恢复**：仅重建可稳定还原的内容；范围、安全约束与不可恢复项见[发布产物恢复边界](./published-project-restore-limitations.md)。
