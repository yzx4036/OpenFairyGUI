# Coding Result — et-codegen-vuln-fix

**Executor**: Hermes (direct implementation, Codex sandbox ACL blocked)
**Date**: 2026-08-18
**Status**: Complete — all 5 gates passed

## Files Modified

| File | Change |
|------|--------|
| `plugins/et-fui-codegen/src/model.ts` | VULN-3: parseRemark empty remark default `role:'view'`→`role:'component'`; entityBaseName gate `remark.role !== 'view'` |
| `plugins/et-fui-codegen/src/index.ts` | VULN-1: line 110 gate adds `component.role !== 'view'` short-circuit |
| `plugins/et-fui-codegen/src/templates/panel-system.tpl` | VULN-2: 4 lifecycle methods inject `self.Children.Values` traversal + `FUIEventComponent.Instance.InvokePanelLifecycle` forwarding |
| `plugins/et-fui-codegen/test/model.test.ts` | 3 new test cases for VULN-3 |
| `plugins/et-fui-codegen/test/templates.test.ts` | Updated assertions for VULN-2 forwarding code |

## VULN Fix Details

### VULN-3: Empty remark defaults to role 'view' → phantom PanelId
- **Root cause**: `parseRemark("")` returned `{ role: 'view' }`, so components without remark were treated as view panels and generated phantom Entity/System stubs + PanelId entries.
- **Fix**: Default to `role:'component'`. EntityBaseName derivation gates on `remark.role !== 'view'` → returns `undefined` for non-view roles, preventing Entity stub generation.

### VULN-1: index.ts:110 missing role gate
- **Root cause**: `if (!component.entityTypeName) continue;` didn't check role, so non-view components with entityTypeName still got PanelId assigned.
- **Fix**: Added `|| component.role !== 'view'` to the condition.

### VULN-2: panel-system.tpl missing lifecycle forwarding
- **Root cause**: Template generated empty `Awake()` and bare lifecycle methods with no forwarding to child components.
- **Fix**: 4 lifecycle methods (`RegisterUIEvent`, `OnShow`, `OnHide`, `BeforeUnload`) now inject `foreach (var child in self.Children.Values) { FUIEventComponent.Instance.InvokePanelLifecycle(child, "<method>", ...); }`. `OnShow` passes `contextData`; `Awake` stays empty shell per architecture decision.

## Gate Results

| Gate | Command | Result |
|------|---------|--------|
| 1. typecheck | `pnpm --filter et-fui-codegen typecheck` | ✓ PASS |
| 2. test | `pnpm --filter et-fui-codegen test` | ✓ PASS (9 tests) |
| 3. lint | `pnpm --filter et-fui-codegen lint` | ✓ PASS |
| 4. smoke:projzero | `pnpm --filter et-fui-codegen smoke:projzero "E:/_Proj/UnityProj/ProjZero-FiveElementMarble/FGUIProject"` | ✓ PASS |
| 5. publish verify | Full publish + grep phantom PanelId | ✓ PASS — 4 phantom PanelIds gone; new System stubs contain InvokePanelLifecycle forwarding; no phantom Entity/System for Type:Comp components |

## Verification Details

### PanelId.cs (no phantom entries)
```
grep -E "Button1Panel|Button2Panel|IconComPanel|RadioButtonPanel" PanelId.cs
→ no matches ✓
```

### New System stub (TestAPanelSystem.cs) contains forwarding
```csharp
public static void OnShow(this TestAPanel self, ArgsDict contextData = null)
{
    foreach (var child in self.Children.Values)
    {
        FUIEventComponent.Instance.InvokePanelLifecycle(child, "OnShow", contextData);
    }
}
```

### Phantom Entity/System stubs deleted
8 phantom files removed:
- `Button1Panel.cs` / `Button1PanelSystem.cs`
- `Button2Panel.cs` / `Button2PanelSystem.cs`
- `IconComPanel.cs` / `IconComPanelSystem.cs`
- `RadioButtonPanel.cs` / `RadioButtonPanelSystem.cs`

## Notes
- `panel-id.tpl` Invalid deletion preserved (untouched)
- `assignPanelIds` / `renderPanelId` role filter unchanged
- `preserve` mode semantics unchanged
- No changes to `@openfairygui/codegen` core package
- No out-of-scope refactoring
