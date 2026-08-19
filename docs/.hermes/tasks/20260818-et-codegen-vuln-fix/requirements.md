# et-fui-codegen 三漏洞修复（VULN-1 / VULN-2 / VULN-3）

## 背景

et-fui-codegen 插件模板审计发现 3 个漏洞，用户拍板全部修复。本任务是插件代码修改，目标仓库是 OpenFairyGUI，不是 ProjZero。

## 已核实的现状（Hermes 读过源码，勿凭摘要猜）

### 关键文件
- `plugins/et-fui-codegen/src/model.ts` — parseRemark 在 333-351 行；assignPanelIds 在 211-224 行（已按 role==='view' 过滤）；entityBaseName 推导在 100-107 行
- `plugins/et-fui-codegen/src/index.ts` — writeOutput 主循环 80-138 行，第 110 行 `if (!component.entityTypeName) continue;` 是 VULN-1 位置
- `plugins/et-fui-codegen/src/templates/panel-system.tpl` — 21 行，4 个生命周期方法全空壳
- `plugins/et-fui-codegen/src/templates/panel-entity.tpl` — 13 行，无条件输出 `[FUIPanel(PanelId.$entity_name$, ...)]`
- `plugins/et-fui-codegen/src/templates.ts` — renderPanelId 第 108 行已有 role==='view' 过滤（PanelId.cs 生成侧没问题）
- 测试：`test/model.test.ts`、`test/templates.test.ts`（templates.test.ts:74 断言生成内容含 `void RegisterUIEvent`）

### ProjZero FGUI 工程 remark 分布（74 个组件 XML）
- `Type:Comp|Layer:Normal` ×35、`Type:View|Layer:*` ×17、`Type:None` ×1
- **裸 remark（无 Type: 前缀）×2**：TestB/Components/OneComponent、LevelBattle/HeadBar（remark="Common"）
- **无 remark ×4**：Icon3/IconCom、TestA/Button2、TestA/RadioButton、TestB/Components/Button1
- 这 4 个无 remark 组件被 parseRemark 默认成 view → 产生 4 个幻影 PanelId（Button1Panel/Button2Panel/IconComPanel/RadioButtonPanel）
- **已验证：这 4 个幻影 PanelId 在 ProjZero 全部 C# 代码中零引用，可安全消失**
- Login 包（smoke 测试用）无裸 remark 组件，smoke 断言全部基于 Login，不受 VULN-3 影响

### 框架侧生命周期契约（VULN-2 的参照物，ProjZero 仓库）
框架已有反射生命周期设施，VULN-2 必须对齐这套契约：

1. `FUIEventComponentSystem.InvokePanelLifecycle(Entity panel, string methodName, params object[] args)`
   （ProjZero: Unity/Assets/Scripts/HotfixView/Client/Plugins/Y0Studio/FairyGUI/FUIEventComponentSystem.cs:53）
   - 按 `{panel.GetType().FullName}System` 用 CodeTypes.Instance.GetType 找 System 类
   - GetMethod 找 Public Static 方法，**找不到静默返回**（不抛异常）
   - 框架在 FUIComponentSystem.cs:311/312/610 调用它分发 RegisterUIEvent/UnRegisterUIEvent/BeforeUnload

2. 手写范例（ProjZero: Unity/Assets/Scripts/HotfixView/Client/Demo/FUI/TestB/TestBPanelSystem.cs）：
   ```csharp
   public static void RegisterUIEvent(this TestBPanel self)
   {
       self.Com1.RegisterUIEvent();   // 子组件扩展方法直接调用
   }
   public static void OnShow(this TestBPanel self, ArgsDict contextData = null)
   {
       self.Com1.OnShow();
   }
   ```
   手写方式要求子组件 System 必须定义对应扩展方法，否则 CS1929 编译错误——这正是本漏洞要消灭的坑。

3. 子组件字段来源：panel-entity stub 不含子组件字段；手写 Entity 里子组件是 `AddChild<T, FUI_T>(...)` 创建的 Entity，挂在 `self.Children`（`SortedDictionary<long, Entity>`，Core/Entity/Entity.cs:389）下。

## 三个修复需求

### VULN-1：index.ts 生成主循环加 role 门控
- 位置：`src/index.ts:110`
- 现状：`if (!component.entityTypeName) continue;` → Type:Comp 组件若有 entityTypeName 也会生成 Entity/System stub，stub 里 `[FUIPanel(PanelId.Xxx)]` 引用不存在的 PanelId 常量（assignPanelIds 只给 view 分配）→ CS0246
- 修复：门控条件加上 `component.role !== 'view'` 短路。Type:Comp 组件只生成绑定类（FUI_*），不生成 Entity/System stub。
- 验收：给一个 Type:Comp 组件跑 buildCodegenOutputs+writeOutput，不产出 Entity/System 文件。

### VULN-2：panel-system.tpl 注入反射式子组件生命周期转发
- 用户原话：「panel-system.tpl 对应生命周期，注入反射每个子组件是否存在对应生命周期的方法」
- 需求：生成的 PanelSystem 4 个生命周期方法（RegisterUIEvent/OnShow/OnHide/BeforeUnload）不再是空壳，而是把调用转发给子组件 Entity——且子组件没实现对应方法时静默跳过（不产生编译错误、不运行时抛异常）。
- **强烈建议复用框架已有设施**：模板生成 `FUIEventComponent.Instance.InvokePanelLifecycle(child, "OnShow", ...)` 形式的转发，遍历 `self.Children`。理由：
  - 框架 InvokePanelLifecycle 已实现「反射找 {Type}System → 找不到静默跳过」语义，与需求完全吻合
  - 避免模板生成 Reflection 原始代码，减少生成代码体积和 AOT/IL2CPP 风险
  - 与框架现有分发路径（FUIComponentSystem.cs:311/610）风格一致
- 约束：
  - OnShow 必须带 `ArgsDict contextData = null` 参数并透传
  - 生成的 stub 是 preserve 模式（已存在不覆盖），所以只影响新生成文件，不破坏现有手写
  - 模板只能引用 ET.Client 命名空间内已存在的类型（FUIEventComponent/Entity/ArgsDict）
- 验收：renderPanelSystem 输出含子组件遍历+反射转发代码；无子组件的 panel 生成合法 C#（循环体为空或跳过）；smoke 通过。

### VULN-3：parseRemark 空 remark 默认 comp
- 位置：`src/model.ts:333-351` parseRemark
- 现状：`if (!trimmed) return { explicit: false, layer: 'Normal', role: 'view' };`
- 修复：空 remark 返回 `role: 'component'`（用户拍板「空 remark 默认comp」）
- 连锁影响（已核实安全）：
  - 4 个无 remark 组件不再生成 entityTypeName/PanelId → 幻影 PanelId 消失（零引用，安全）
  - 裸 remark（"Common" 这类无 Type: 前缀）走 else 分支落到 'binding' 角色——**这个行为不要动**，用户只拍板了空 remark
  - 注意 entityBaseName 推导（model.ts:100-107）：`remark.explicit` 为 false 且名字不以 Panel 结尾的组件会被强加 Panel 后缀——VULN-3 改默认 role 后，空 remark 组件 role='component'，entityBaseName 仍会推导出 XxxPanel。需要确认：role='component' 的组件是否应该 entityBaseName=undefined（不生成 Entity）？请给出决策并写进 architecture.md。倾向：comp 角色不生成 Entity/System stub（与 Type:Comp 显式标注行为一致），即 entityBaseName=undefined。
- 验收：parseRemark('') 返回 role 'component'；无 remark 组件不出现在 PanelId.cs；model.test.ts 更新/新增对应用例。

## 不要动的东西（护栏）
- `panel-id.tpl` 中已删除 `Invalid = 0` 的未提交改动**保留**，不许回退（ProjZero 侧 FUIEventComponent.cs:33 partial 类有 Invalid=0 兜底）
- `assignPanelIds` 的 role==='view' 过滤已正确，不动
- `renderPanelId`（templates.ts:108）的 role 过滤已正确，不动
- preserve 模式语义不动（Entity/System 已存在不覆盖）
- 不改 @openfairygui/codegen 核心包，只改 et-fui-codegen 插件

## 验证门禁（全部必须通过）
1. `pnpm --filter et-fui-codegen typecheck`
2. `pnpm --filter et-fui-codegen test`（ava，含新增用例）
3. `pnpm --filter et-fui-codegen lint`（biome）
4. `pnpm --filter et-fui-codegen smoke:projzero "E:/_Proj/UnityProj/ProjZero-FiveElementMarble/FGUIProject"`
   ⚠️ 注意：smoke 命令**不要带 `--` 分隔符**（package.json 里 tsx 直传 argv）
   ⚠️ 所有外网/node 命令前置 `unset http_proxy https_proxy all_proxy HTTP_PROXY HTTPS_PROXY ALL_PROXY`
5. 对 ProjZero 全量 publish 到临时目录，grep 产物确认：
   - PanelId.cs 无 Button1Panel/Button2Panel/IconComPanel/RadioButtonPanel
   - 无 Type:Comp 组件的 Entity/System stub 新增
   - 某个 view panel 的 System stub 含反射转发代码

## 交付物
- 代码修改（src/ + test/）
- `coding-result.md`：修改文件清单 + 每个 VULN 的修复方式 + 验证门禁输出摘要
- 更新 `status.json`
