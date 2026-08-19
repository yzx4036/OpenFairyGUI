# 实施计划（implementation-plan.md）

## 文件级改动清单

### Step 1 — VULN-3：parseRemark 空 remark 默认 comp
- `plugins/et-fui-codegen/src/model.ts:335`：`role: 'view'` → `role: 'component'`
- `plugins/et-fui-codegen/src/model.ts:100-107`：entityBaseName 推导改为 `remark.role !== 'view' ? undefined : ...`

### Step 2 — VULN-1：index.ts 主循环 role 门控
- `plugins/et-fui-codegen/src/index.ts:110`：`if (!component.entityTypeName) continue;` → `if (!component.entityTypeName || component.role !== 'view') continue;`

### Step 3 — VULN-2：panel-system.tpl 注入反射式生命周期转发
- `plugins/et-fui-codegen/src/templates/panel-system.tpl`：4 个空壳方法体替换为遍历 `self.Children.Values` + `FUIEventComponent.Instance.InvokePanelLifecycle` 转发（OnShow 透传 contextData）；Awake 保持空壳
- `plugins/et-fui-codegen/src/templates.ts` 无需改动（变量集不变）
- 生成代码形态见 architecture.md 决策 3 样例

### Step 4 — 测试
- `plugins/et-fui-codegen/test/model.test.ts`：新增空 remark / Type:Comp / 裸 remark 三个用例
- `plugins/et-fui-codegen/test/templates.test.ts`：更新 system 断言，追加转发代码断言
- `plugins/et-fui-codegen/test/index.test.ts`（可选）：Type:Comp 只写 binding 的回归

### Step 5 — 文档同步
- `plugins/et-fui-codegen/README.md`：更新 remark 分类表 + no-remark fallback 段落 + PanelSystem 生命周期转发说明

## 验证门禁（全部必须通过）

1. `pnpm --filter et-fui-codegen typecheck`
2. `pnpm --filter et-fui-codegen test`
3. `pnpm --filter et-fui-codegen lint`
4. `pnpm --filter et-fui-codegen smoke:projzero "E:/_Proj/UnityProj/ProjZero-FiveElementMarble/FGUIProject"`（⚠️ 不带 `--` 分隔符；外网命令前置 `unset http_proxy https_proxy all_proxy HTTP_PROXY HTTPS_PROXY ALL_PROXY`）
5. ProjZero 全量 publish 到临时目录，grep 产物确认：
   - PanelId.cs 无 Button1Panel/Button2Panel/IconComPanel/RadioButtonPanel
   - 无 Type:Comp 组件 Entity/System stub 新增
   - 某 view panel System stub 含反射转发代码

## 收尾
- 写 `coding-result.md`（文件清单 + 每 VULN 修复方式 + 门禁输出摘要）
- 更新 `status.json` → `ready_for_review`
