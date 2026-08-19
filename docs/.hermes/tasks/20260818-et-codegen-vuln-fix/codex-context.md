# et-fui-codegen VULN-1/2/3 对抗测试 + 架构回审 — Codex 委派

## 项目

OpenFairyGUI monorepo（Node ≥20 + pnpm workspace）· plugins/et-fui-codegen 发布插件
工作目录：`E:/_Proj/OpenFairyGUI`

## 背景

工作区已实现三个漏洞修复（未提交），来自 ProjZero 项目实战：
- VULN-3：`src/model.ts` parseRemark 空 remark 默认 role 'component'（原 'view'）+ entityBaseName 推导加 role 门控
- VULN-1：`src/index.ts:110` 主循环门控加 `component.role !== 'view'` 短路
- VULN-2：`src/templates/panel-system.tpl` 4 个生命周期方法注入 `self.Children.Values` 遍历 + `FUIEventComponent.Instance.InvokePanelLifecycle` 转发

改动清单：`git diff`（6 文件，+99/-8）：
- plugins/et-fui-codegen/src/index.ts
- plugins/et-fui-codegen/src/model.ts
- plugins/et-fui-codegen/src/templates/panel-id.tpl（删 Invalid 行）
- plugins/et-fui-codegen/src/templates/panel-system.tpl
- plugins/et-fui-codegen/test/model.test.ts（+3 用例）
- plugins/et-fui-codegen/test/templates.test.ts（+断言）

## 三段式任务

### Phase 1: 对抗测试（读 `git diff`，不读架构文档）

1. `git diff` 查看全部未提交改动
2. 补边界测试：remark 各种形态（空串/仅空格/"Type:Comp"/"view:xxx"/非法前缀）
3. 补负向用例：无 remark 组件不应生成 Entity/System/PanelId 条目；role!=view 短路后 binding 文件仍生成
4. 补模板断言：panel-system.tpl 转发代码包含 4 个生命周期方法、OnShow 透传 contextData

### Phase 2: 架构回审（读 docs/.hermes/tasks/20260818-et-codegen-vuln-fix/architecture.md）

逐项对照实际代码检查：模块边界、公共契约（生成代码形态是否与 architecture.md 决策 3 样例一致）、依赖声明、数据模型一致性。漂移只标 `needs_architecture`，不自行修复。

### Phase 3: 轻量 bugfix（只修不重构）

恢复误删逻辑、修空指针/边界遗漏。绝不改架构设计、不换设计模式。

## 约束

- 测试命令：`cd plugins/et-fui-codegen && pnpm test`（ava）、`pnpm run typecheck`
- 网络代理已处理，依赖已安装，**不要跑 pnpm install**
- 存量 9 个测试不能退化
- 不要启动子代理，直接完成任务
- Node 项目，不是 .NET——构建/测试命令用 pnpm，不用 dotnet

## 特别指示

完成后写入 `docs/.hermes/tasks/20260818-et-codegen-vuln-fix/codex-review.md`，
必须包含 `## 对抗测试` + `## 架构回审` + `## 修复记录` 三段。
