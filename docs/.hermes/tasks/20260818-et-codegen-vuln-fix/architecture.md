# et-fui-codegen VULN-1/2/3 修复架构设计

> 产出：OpenCode plan agent（deepseek-v4-pro）· 架构决策由 Hermes 审后落盘
> 日期：2026-08-18

## 决策总览

| # | 漏洞 | 决策 |
|---|------|------|
| 1 | VULN-3 | `parseRemark` 空 remark 默认 `role: 'component'`；连锁：entityBaseName 推导加 role 门控 |
| 2 | VULN-1 | index.ts 主循环门控加 `component.role !== 'view'` 短路 |
| 3 | VULN-2 | 复用框架 `FUIEventComponent.Instance.InvokePanelLifecycle`，模板生成遍历 `self.Children.Values` 的转发代码；不内联原始 Reflection |

## 决策 1 详解：VULN-3 连锁双重改动

- `src/model.ts:335`：`role: 'view'` → `role: 'component'`
- `src/model.ts:100-107`：entityBaseName 推导改为 `remark.role !== 'view' ? undefined : ...`

理由：空 remark 组件语义上等同未标注组件（comp），不应生成 Entity/System stub。若只改 role 不改 entityBaseName，空 remark 组件仍会推导 XxxPanel 名并生成引用不存在 PanelId 常量的 stub——CS0246 漏洞依旧。两处必须一起改。

## 决策 2 详解：VULN-1 role 门控

- `src/index.ts:110`：`if (!component.entityTypeName) continue;` → `if (!component.entityTypeName || component.role !== 'view') continue;`

理由：Type:Comp 显式标注的组件即使有 entityTypeName 也不应生成 Entity/System stub（PanelId 只分配给 view）。双保险：与决策 1 的 entityBaseName 门控互为兜底。

## 决策 3 详解：VULN-2 生成代码形态（推荐：复用框架 API）

**推荐**：模板生成 `FUIEventComponent.Instance.InvokePanelLifecycle` 遍历转发，不生成原始 Reflection 代码。

理由：
1. 框架 `InvokePanelLifecycle`（ProjZero `FUIEventComponentSystem.cs:53`）已实现「按 `{Type}System` 反射找静态方法 → 找不到静默返回」语义，与需求完全吻合
2. 避免模板生成 Reflection 原始代码 → 生成代码体积小、无 IL2CPP/AOT 风险
3. 与框架现有分发路径（`FUIComponentSystem.cs:311/312/610`）风格一致

生成代码样例（panel-system.tpl 渲染结果）：

```csharp
[EntitySystemOf(typeof(FUI_LoginPanel))]
public static class FUI_LoginPanelSystem
{
    public static void Awake(this FUI_LoginPanel self)
    {
    }

    public static void RegisterUIEvent(this FUI_LoginPanel self)
    {
        foreach (var child in self.Children.Values)
        {
            FUIEventComponent.Instance.InvokePanelLifecycle(child, "RegisterUIEvent");
        }
    }

    public static void OnShow(this FUI_LoginPanel self, ArgsDict contextData = null)
    {
        foreach (var child in self.Children.Values)
        {
            FUIEventComponent.Instance.InvokePanelLifecycle(child, "OnShow", contextData);
        }
    }

    public static void OnHide(this FUI_LoginPanel self)
    {
        foreach (var child in self.Children.Values)
        {
            FUIEventComponent.Instance.InvokePanelLifecycle(child, "OnHide");
        }
    }

    public static void BeforeUnload(this FUI_LoginPanel self)
    {
        foreach (var child in self.Children.Values)
        {
            FUIEventComponent.Instance.InvokePanelLifecycle(child, "BeforeUnload");
        }
    }
}
```

注意：`self.Children` 是 `SortedDictionary<long, Entity>`（Core/Entity/Entity.cs:389），`.Values` 直接可遍历。Awake 保持空壳（无 UI 事件语义，且框架 Awake 分发路径不走 InvokePanelLifecycle）。

## 决策 4：OnShow 透传形态

`OnShow(this T self, ArgsDict contextData = null)` → 转发时 `InvokePanelLifecycle(child, "OnShow", contextData)`。保持与框架 `FUIComponentSystem.cs:311` 的调用签名一致。

## 决策 5：测试策略

| 文件 | 新增用例 |
|------|---------|
| `test/model.test.ts` | ① parseRemark('') → role 'component'；② Type:Comp 组件不出现在 assignPanelIds；③ 裸 remark（无 Type: 前缀）仍走 binding 分支（回归护栏） |
| `test/templates.test.ts` | 更新 renderPanelSystem 断言：含 `InvokePanelLifecycle` 遍历代码；OnShow 断言含 contextData 透传；保留 `void RegisterUIEvent` 断言（templates.test.ts:74 兼容） |
| `test/index.test.ts`（可选） | Type:Comp 组件 writeOutput 只写 binding，不写 Entity/System |

## 护栏确认（requirements.md「不要动的东西」）

- ✅ panel-id.tpl 删 Invalid 的未提交改动保留不回退
- ✅ assignPanelIds role 过滤不动
- ✅ renderPanelId role 过滤不动
- ✅ preserve 模式语义不动
- ✅ 不改 @openfairygui/codegen 核心包
