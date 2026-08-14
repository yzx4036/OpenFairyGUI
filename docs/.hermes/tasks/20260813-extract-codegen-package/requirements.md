# 提取通用模板代码生成包（packages/codegen）

## 目标

把 `plugins/et-fui-codegen` 中与 ET 框架无关的**通用「按模板生成代码」能力**提取为 `packages/` 下的正式 npm 包（建议名 `@openfairygui/codegen`），使 OpenFairyGUI 具备框架无关的模板代码生成基础设施。`plugins/et-fui-codegen` 保留为 ET 框架专属实现，改为依赖新包。

一句话：**引擎通用化下沉，ET 模板留在插件层。**

## 现状分析（Hermes 已审计）

`plugins/et-fui-codegen/src/` 六个文件的通用性边界：

| 文件 | 内容 | 通用性判定 |
|---|---|---|
| `engine.ts` (182行) | 模板引擎：`$key$` 标量替换 / `$item.field$` 循环字段 / `//$for x in list$` / `//$if expr$`，AST 解析+严格模式，零外部依赖 | ✅ 完全通用，直接下沉 |
| `naming.ts` (122行) | C# 标识符规范化：关键字转义、类型名/成员名 normalize、路径工具（isAbsolutePath/trimTrailingSlashes/resolveProjectBasePath） | ✅ 通用（C# 目标语言工具），下沉 |
| `hash.ts` (16行) | FNV-1a 31-bit 稳定哈希（panel id 用） | ✅ 通用算法，下沉 |
| `model.ts` (380行) | `buildCodegenOutputs()`：FairyGUI Document → EtCodegenOutput 数据模型（remark 解析 Type:View/Layer、成员提取、跨包引用解析、panelId 分配） | ⚠️ 混合：FairyGUI→数据模型的管线通用，但 EtCodegenOutput/EtCodegenComponent 等类型和 remark 约定是 ET 专属 |
| `templates.ts` (163行) | 5 个 render 函数 + AUTO_GENERATED_MARK/PRESERVED_MARK + 模板加载缓存 | ❌ ET 专属（模板内容、目录布局 FUIAutoGen/ModelView/HotfixView 都是 ET 约定） |
| `templates/*.tpl` (5个) | C# 模板文本 | ❌ ET 专属 |
| `index.ts` (149行) | Plugin genCode 钩子 + writeOutput/writeTextIfMissing（preserved 文件保护） | ⚠️ 混合：Plugin 钩子接入和「自动覆盖 vs 保留已有」写文件策略通用，ET 目录布局专属 |

## 设计要求

1. **新包定位**：`packages/codegen`（`@openfairygui/codegen`），对齐现有包结构（tsdown 构建、ESM、workspace 协议、biome lint、ava 测试）。
2. **通用引擎 API**：模板引擎（engine）、标识符/命名工具（naming）、稳定哈希（hash）作为一等公开导出。API 设计面向「任意目标语言的模板代码生成」，不绑定 C#/ET。
3. **可选的管线抽象**：`model.ts` 里「FairyGUI Document → 中间模型 → 渲染 → 写文件」的管线，若 OpenCode 判断值得抽象，可设计一个轻量的「codegen pipeline / writer」契约（含 AUTO/PRESERVED 标记写文件策略），但**不得过度设计**——ET 是当前唯一消费方，抽象必须能被 et-fui-codegen 自然消费。
4. **et-fui-codegen 改造**：删除已下沉的重复代码，改为 `import { ... } from '@openfairygui/codegen'`；ET 专属的 model/templates/index 逻辑保留；对外行为（生成的 C# 文件内容、目录结构、preserved 语义）**必须完全不变**。
5. **测试迁移**：`engine/naming/hash` 的测试随代码迁移到新包；et-fui-codegen 保留/补充消费侧测试。新包要有自己的 ava 测试配置。
6. **版本与发布**：新包初始版本 0.1.0，纳入 lerna/changeset 体系（看现有仓库用哪个），`private` 与否由 OpenCode 按上游惯例决定。

## 约束

- **行为不变是硬门槛**：et-fui-codegen 对同一 FairyGUI 工程生成的 C# 代码必须逐字节一致（可用现有 smoke/verify 脚本对比）。
- 不引入新外部依赖（模板引擎保持零依赖）。
- 遵循仓库 AGENTS.md：协议字段落正式属性、文档同步（若影响 publish 插件文档 `docs/publish-plugins.md` 需同步）。
- 保持 `--plugin` 外部加载能力不受影响。

## 验收标准

- [ ] `packages/codegen` 存在，构建/lint/测试通过
- [ ] `plugins/et-fui-codegen` 依赖新包，无重复代码，构建/测试通过
- [ ] 全仓库 `pnpm run build` + `pnpm run lint` + `pnpm run typecheck` 通过
- [ ] et-fui-codegen 生成产物与改造前一致（smoke 对比）
- [ ] 无新增测试回归（与基线失败集对比）

## 技术关键词

模板引擎、代码生成、AST、FairyGUI publish plugin、tsdown、ava、pnpm workspace、lerna
