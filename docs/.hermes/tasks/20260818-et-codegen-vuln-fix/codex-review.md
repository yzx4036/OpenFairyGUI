# Codex Review — et-codegen-vuln-fix

## 对抗测试

结论：VULN-1/2/3 的目标行为通过，9 个存量测试未退化，新增 2 个对抗测试后共 11 个测试通过。

- 已先审查全部未提交 git diff，再补测试；git diff --check 通过。
- remark 边界覆盖：空串、仅空白、Type:Comp 均为 component；view:xxx 与 Typo:View 均为 binding。五种情况都不产生 entityTypeName 或 panelId。
- 写盘负向覆盖：无 remark、Type:Comp、非 Type 前缀组件仍生成 FUI_ binding 并注册到 FUIBinder，但不生成 Entity/System，PanelId.cs 中也无对应条目。
- 模板覆盖：精确断言 RegisterUIEvent、OnShow、OnHide、BeforeUnload 四个方法各有一次 Children.Values 遍历和一次 InvokePanelLifecycle；OnShow 透传 contextData；Awake 保持空壳。
- 进程内边界/负向校验通过：P1 adversarial checks passed。
- 完整 AVA 补充执行通过：11 tests passed。为适配当前 Node 25 沙箱，使用了临时 worker 加载器；加载器及临时编译产物均已删除，未进入交付差异。
- lint 通过：Biome 检查 8 个文件，无错误。
- typecheck 通过：tsc --noEmit -p tsconfig.json。
- 指定原命令在 plugins/et-fui-codegen 目录执行 pnpm test 时，系统全局 pnpm 11 在切换仓库声明的 pnpm 10.14 前报 unable to open database file，退出码 1，AVA 未启动。未运行 pnpm install；上述 11/11 结果来自同一 AVA 测试集的 worker 模式补充执行，不能记作原命令成功。

## 架构回审

回审结论：needs_architecture。以下漂移只记录，未修改代码或文档。

- 模块边界通过：改动限定在 et-fui-codegen 插件及其测试；未改 @openfairygui/codegen 核心包、workspace 依赖或锁文件。
- 生命周期主体通过：四个转发方法及 OnShow 参数形态与 architecture.md 决策 3/4 一致；FUIEventComponent、ArgsDict 与 Entity 均在生成代码的基础命名空间内，无新增 npm 依赖。
- 数据模型通过：parseRemark → entityBaseName → resolveEntityNames → assignPanelIds → writeOutput/renderPanelId 的门控一致，只有 role=view 能生成 Entity/System/PanelId；binding 对所有角色保持生成。
- needs_architecture：architecture.md 决策 3 样例使用 EntitySystemOf(typeof(FUI_LoginPanel))、FUI_LoginPanelSystem，并把扩展方法挂到 FUI_LoginPanel；实际模板沿用既有 FriendOf(typeof(LoginPanel))、partial LoginPanelSystem，扩展方法挂到 LoginPanel。生命周期方法体一致，但 System 头部与目标类型的公共契约不一致，需要架构方确认样例是否笔误；本轮未擅自切换。
- needs_architecture：plugins/et-fui-codegen/README.md 的公开 remark 表仍声明 Type:Comp 和无 remark 会生成 Entity/System，且 no-remark 段落仍写默认 panel；这与批准后的 component 默认和实现相反，也遗漏 implementation-plan.md Step 5 的生命周期说明。按“漂移只标不修”要求，本轮未更新 README。
- panel-id.tpl 删除 Invalid = 0 与 architecture.md 护栏一致，已保留。

## 修复记录

- 新增 test/model.test.ts 的 remark 边界用例，补齐空串、空白、Type:Comp、view:xxx、非法前缀。
- 新增 test/index.test.ts 的写盘负向用例，证明 role!=view 时 binding 仍生成，而 Entity/System/PanelId 条目不生成。
- 强化 test/templates.test.ts，精确校验四个生命周期方法、四次遍历、四次反射转发及 OnShow contextData。
- 修正新增 index 测试的 Biome 格式；未改生产实现、未重构、未更换设计模式。
- 已核实 Entity.Children getter会懒初始化空 SortedDictionary，无子组件时不会因 Children 为 null 崩溃，因此未添加多余空值分支。
- 未恢复 PanelId.Invalid：requirements.md 与 architecture.md 均明确要求保留该删除。
- 遗留事项仅为上节两项 needs_architecture，以及当前沙箱中原样 pnpm test 的启动器故障。
