# 新设备接入与多 ETPlus 项目使用指南

> 场景：一台新机器，上面有多个以 ETPlus 为框架的项目，每个项目都有自己的 FairyGUI 工程（`FGUIProject/`），需要统一用本 fork 的 OpenFairyGUI 完成「发布二进制 + ET C# 代码生成」。
>
> 适用版本：`y0-v0.1.0`。所有命令基于 git-bash（POSIX 风格）。

## 一、新设备一次性安装（全机器只装一份）

```bash
# 1. 克隆并切到发布版
git clone git@github.com:yzx4036/OpenFairyGUI.git
cd OpenFairyGUI && git checkout y0-v0.1.0

# 2. 安装依赖 + 构建
#    ⚠️ build 必须带内存参数，否则 tsdown OOM（exit 134）
pnpm install
NODE_OPTIONS=--max-old-space-size=16384 pnpm run build
```

### CLI 调用方式

`ofgui` 不是全局命令（未发布到 npm），真实入口是 `packages/cli/bin/cli.cjs`。建议在 shell 配置里加一个包装：

```bash
# ~/.bashrc 或项目脚本
export OPENFAIRYGUI_HOME="E:/_Proj/OpenFairyGUI"   # 换成实际路径
ofgui() { node "$OPENFAIRYGUI_HOME/packages/cli/bin/cli.cjs" "$@"; }
```

别名 `ofgui` 与 `openfairygui` 等价（`@openfairygui/cli` 的 bin 声明）。

## 二、各项目接入（两种模式，按需选）

### 模式 A：插件复制进工程（自包含，推荐 CI / 完全离线项目）

把插件**连同 node_modules 一起**复制进每个项目的 FGUI 工程：

```text
FGUIProject/plugins/et-fui-codegen/
├── src/index.ts        # 入口（package.json main → jiti 直接加载 TS 源码，无需构建插件本身）
├── package.json
└── node_modules/@openfairygui/{codegen,core,functions}   # ⚠️ 运行时依赖，必须带上
```

之后 `ofgui publish` 自动发现工程内 `plugins/` 目录，不需要额外参数。

加载机制：发布时加载器读取每个插件目录的 `package.json` 的 `main` 字段，用 jiti 即时编译 TypeScript——所以插件源码可直接运行，不必预先 build 插件。

### 模式 B：共享一份插件（多项目省空间，推荐本地开发）

插件留在 OpenFairyGUI 仓库（`plugins/et-fui-codegen`，仓库 `pnpm install` 后 workspace 依赖可解析），每次发布显式指定：

```bash
ofgui publish FGUIProject -o "$OUT" -t unity \
  --plugin "$OPENFAIRYGUI_HOME/plugins/et-fui-codegen"
```

`--plugin` 与工程内 `plugins/` 的自动发现合并加载。**多项目共用推荐模式 B**——升级插件只改一处；模式 A 适合要求完全自包含的项目。

## 三、每个 FGUI 工程的配置（一次性）

**1. `FGUIProject/settings/Publish.json`** 的 `codeGeneration` 段（ET/ProjZero 实际配置参考值）：

```json
"codeGeneration": {
  "allowGenCode": true,          // 开关①：允许代码生成
  "codePath": "../Generated/FUI",
  "classNamePrefix": "FUI_",
  "packageName": "ET.Client",
  "getMemberByName": true
}
```

**2. 每个需要生成代码的包**：`assets/<Pkg>/package.xml` 加 `<publish genCode="true">`（开关②）。

两个开关同时打开，该包才参与代码生成。

## 四、日常使用（三步链路）

```bash
# ① 发布二进制 + 生成代码
ofgui publish FGUIProject -o "$(pwd)/Unity/Assets/Bundles/FUI" -t unity
#    -p <PkgName> 只发单个包
```

产物去向：

- 二进制 bytes → `Unity/Assets/Bundles/FUI/<Pkg>/`（按包分子文件夹是 y0 定制）
- 生成代码 → 工程根 `Generated/FUI/{FUIAutoGen,ModelView,HotfixView}/`（gitignored 中间产物，不参与 Unity 编译）

```text
# ② Unity 菜单 BuildEditor →「同步 FUI 生成代码」（FUICodeSyncTool.SyncFUI()）
#    Generated/FUI → ModelView/HotfixView 双 asmdef 目录，并重建 UIPackageMapping.bytes
#    ⚠️ UIPackageMapping.bytes 由 Unity 侧生成，不是插件产物

# ③ F6 编译
```

一句话：二进制和代码都由 `ofgui publish` 出，Unity 只做搬运；改 FGUI 后三步缺一不可。

生成代码契约（remark 分类）：`Type:View|Layer:*` → 完整面板（Entity/System/PanelId）；`Type:Comp` / `Type:None` / 无 remark → 仅绑定类。Entity/System 只在缺失时生成（保护手写业务代码），绑定类与 PanelId 每次覆盖。

## 五、多项目落地清单

| 步骤 | 位置 | 频次 |
|------|------|------|
| clone + build OpenFairyGUI | 一处（如 `E:/_Proj/OpenFairyGUI`） | 每设备一次 |
| shell 包装 `ofgui()` | 全局环境 | 每设备一次 |
| 插件接入（模式 A 复制 / 模式 B `--plugin`） | 各项目 | 每项目一次 |
| `Publish.json` + `package.xml` 双开关 | 各 FGUI 工程 | 每项目一次 |
| Unity 侧 `FUICodeSyncTool` | 各 ETPlus 项目 `Editor/Plugins/Y0Studio/FairyGUI/CodeSpawn/` | 随框架代码自带 |

### 验证

```bash
# 在 OpenFairyGUI 仓库根执行；临时目录演练，不写源工程
pnpm --filter et-fui-codegen smoke:projzero -- <FGUI工程绝对路径>
```

## 六、已知问题

- 全仓 `pnpm test` 有 11 个 pre-existing 失败（集中在 `packages/functions/test/publish.test.ts`，bytes 子文件夹断言），为已文档化基线测试债，非 fork 回归，不影响使用；插件自身测试 11/11 通过。
- build 不带 `NODE_OPTIONS=--max-old-space-size=16384` 会 OOM（exit 134）。
- 模式 A 复制插件时漏掉 `node_modules/@openfairygui/*` 会在发布时报模块解析失败。

## 参考

- [Fork 下游代码生成策略](./fork-codegen-policy.md)
- [CHANGELOG](./CHANGELOG.md)
- 插件详情：`plugins/et-fui-codegen/README.md`
