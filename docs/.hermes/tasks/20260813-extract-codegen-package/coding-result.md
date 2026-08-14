# @openfairygui/codegen 包提取编码结果

## 完成清单

| Step | 状态 | 关键决策与结果 |
|---|---|---|
| Step 1 | 完成 | 创建 public `@openfairygui/codegen@0.1.0` 包骨架、README、MIT LICENSE 与根 `tsconfig.json` path；根 `pnpm install` 将 workspace 扩为 9 个项目并更新 lockfile。计划的 Step 1 文件清单尚无 `src/index.ts`，无法当步构建；在 Step 2 创建入口后立即完成 build 验证。 |
| Step 2 | 完成 | `engine.ts`、`naming.ts` 与插件原文件逐字一致；hash 泛化为 `fnv1a31(value)`，`fnv1a31('pkg1:comp1')` 固定为 `1794741604`；新增 engine/naming/hash 测试。 |
| Step 3 | 完成 | **采用 writer 契约**。`PublishFileSystem` 与批准的轻量接口结构兼容，抽象仅负责 mkdir、overwrite/preserve、探测与计数，不承载 ET 模型、模板或目录布局；新增 exists、read fallback、无探测能力与计数测试。 |
| Step 4 | 完成 | 插件新增 `@openfairygui/codegen` workspace 运行时依赖；删除重复 engine/naming；保留 `hashPanelId` 薄封装公开面；model/templates/index 改用新包；writer 接入后原日志、目录和 preserve 语义不变。 |
| Step 5 | 完成 | 新增 model、templates、公开 `genCode` 写入语义测试，以及复制 ProjZero 到 OS 临时目录并走真实 plugin discovery 的 smoke 脚本；临时工程实体部署 `@openfairygui/codegen`，验证复制部署时的运行时解析要求。 |
| Step 6 | 完成 | 从空目标重建 167 个 C# 文件，与 baseline 按相对路径、长度和逐文件 SHA-256 对比为零差异；全 workspace build 成功；根测试失败集无新增。 |
| Step 7 | 完成 | 同步插件 README、publish 插件指南、release workflow 四个实际清单位置、双语根 README、双语 packages guide、双语 architecture overview、双语 Changelog，并把根 smoke 的 engine/naming/hash 改为新包入口。`docs/README.md` 未改：没有新增或重命名关键文档，其现有架构/插件入口仍有效。 |
| Step 8 | 完成 | 确认插件源目录不再存在 engine/naming、无旧 import、新包 public 且零 runtime dependency；包级/根级检查与文档构建完成；未执行 git commit。 |

## 验证结果

| 命令或检查 | 结果摘要 |
|---|---|
| 改造前 `pnpm run test` | exit 1；`489 passed / 11 failed`，记录了精确失败集。 |
| `pnpm install` | exit 0；识别 9 个 workspace project，lockfile 已同步。 |
| `pnpm --filter @openfairygui/codegen test` | exit 0；14 tests passed。 |
| `pnpm --filter @openfairygui/codegen build` | exit 0；生成 `dist/index.js`、`index.cjs`、`index.d.ts`、`index.d.cts`。 |
| `pnpm --filter @openfairygui/codegen lint` | exit 0；`biome check` 的 formatter/assist 关闭，仅执行 lint，以同时遵守 engine/naming 逐字迁移硬约束；9 files checked。 |
| `pnpm --filter et-fui-codegen typecheck` | exit 0。 |
| `NODE_OPTIONS=--max-old-space-size=16384 pnpm --filter et-fui-codegen build` | exit 0；tsdown 构建成功，保留 neutral platform/external 与 plugin timing 警告。 |
| `pnpm --filter et-fui-codegen test` | exit 0；6 tests passed。 |
| `pnpm --filter et-fui-codegen smoke:projzero -- E:\\_Proj\\UnityProj\\ProjZero\\FGUIProject` | exit 0；真实发现插件并发布 Login，验证 PanelId/binding/entity/system/FUIBinder，临时目录已清理。 |
| `npx tsx scripts/verify-fgui.ts` | exit 0；从空目标写入 167 files。 |
| 字节级对比 | baseline/current 均为 167 files、102,571 bytes；路径 + 长度 + SHA-256 差异 `0`；聚合树摘要均为 `FC64B4EC93400D2C027077301128AB4B0FCB179E4224103297812CE5BC645AA7`。 |
| `NODE_OPTIONS=--max-old-space-size=16384 pnpm run build` | exit 0；8/9 workspace projects 有 build 脚本且全部成功。 |
| 根 `pnpm run lint` | exit 0；290 files checked，最终无 warning/error。 |
| 根 `pnpm run typecheck` | exit 0。 |
| 改造后 `pnpm run test` | exit 1；稳定结果 `503 passed / 11 failed`。11 个失败与改造前逐项一致，新增失败 0、消失失败 0；通过数净增 14。一次全量运行曾出现 2 个时序偶发失败，精确单跑与第二次全量均通过，未进入稳定失败集。 |
| `npx tsx scripts/smoke-test.ts` | exit 0；全部 7 组通过。 |
| `pnpm run docs:build` | exit 0；TypeDoc 与 VitePress 构建成功，仅有既有 chunk-size 提示。 |
| `git diff --check` | exit 0。 |

根测试保留的 11 个失败为任务声明的存量 publish/restore 路径债：runtime raster capability、missing atlas image、custom fileExtension、unpublished image binary、Unity sound、两个 Branch publish、loader skeleton、pixel hit test、directory batch restore、sample indirect references。

## 架构回审

| 检查项 | 状态 | 说明 |
|---|---|---|
| §1 逐字节行为门槛 | 通过 | 空目标重建后 167 文件的结构、字节数与逐文件哈希完全一致。 |
| §1/§2 通用下沉边界 | 通过 | engine/naming/hash/writer 位于新包；model/templates/index 与五个 `.tpl` 保留在插件；未抽象 FairyGUI 中间模型。 |
| §3 包结构 | 通过 | package/README/LICENSE、五个 src 模块与四类测试齐全；未增加包内 tsconfig 或 tsdown config。 |
| §4.1 模板 API | 通过 | `TemplateContext` 与 `renderTemplate(template, ctx, strict = true)` 签名和语义保持。 |
| §4.2 命名 API | 通过 | 七个命名/路径公开函数由单入口导出。 |
| §4.3 哈希 API | 通过 | `fnv1a31(value)` 保持原 FNV-1a 32-bit -> positive 31-bit 算法；插件薄封装保留。 |
| §4.4 writer 契约 | 通过 | 采用批准接口；mkdir 并行、overwrite、exists/read fallback、无探测回退、计数均实现并覆盖测试；插件继续输出原日志。 |
| §5 单公开入口 | 通过 | 只提供 `@openfairygui/codegen` 根入口，无 subpath。 |
| §6 依赖关系 | 通过 | 新包 `package.json` 无 `dependencies`，`src` 无 import；dev 仅 ava/tsx。插件将 codegen 放在 dependencies，core/functions 仍为 type-only devDependencies。 |
| §6.1 插件部署影响 | 通过 | 插件 README 与 publish 插件指南已说明复制部署必须能解析 `@openfairygui/codegen`；真实临时工程 smoke 已验证。 |
| §7 文件清单 | 通过 | 代码、测试、lockfile、smoke、双语文档与四个 release 实际列表位置均已同步。 |
| §7.3 release 同版本校验 | **needs_architecture** | 架构同时要求 codegen 初始 `0.1.0`、加入 release verify，而现有 workflow 要求所有公开包版本等于同一 tag；其他包为 `0.3.1`，任何 tag 都无法通过。已严格加入清单，未擅自改变版本或 release 策略，需架构方决定 lockstep 版本还是独立包校验。 |
| §8 测试策略 | 通过 | 新包 14 tests、插件 6 tests、真实 ProjZero smoke、167 文件字节回归、全量 build 与失败集对比均完成。 |
| §9 明确不做 | 通过 | 未移动 model/templates，未修改 functions 内置 codegen，未新增 runtime dependency。 |

## 遗留问题

1. ~~**needs_architecture — release 版本策略**~~：已解决。Hermes 采纳 lockstep 版本策略：codegen 版本 0.1.0 → 0.3.1，与仓库统一 tag 校验对齐。
2. ~~**既有插件模板缓存竞态**~~：已解决。Hermes 将 `_cache` 改为 Promise-based cache（`_cachePromise`），并发冷启动共享一次加载，无人观察到半填充缓存。
3. ~~**既有插件 dist 模板部署风险**~~：已解决。Hermes 在插件 build 脚本加入 `--copy src/templates`，tsdown dist 现包含 5 个 .tpl 文件。
4. 插件原源码不符合 Biome formatter 且含两个既有 unused warning；根 lint 不覆盖 plugins。本轮定向 `biome check --formatter-enabled=false --assist-enabled=false` 无 error，未对明确要求“其余逻辑不动”的 model/templates 做机械重排。
5. 根测试的 11 个存量失败仍保留，失败集未扩大。

## Hermes 修复记录（阶段 B-fix）

Codex 交付后 Hermes 直接修复了 4 项阻塞：

1. **版本 lockstep**：`packages/codegen/package.json` version 0.1.0 → 0.3.1（release.yml 统一 tag 校验要求所有包版本一致）。
2. **模板缓存竞态**：`plugins/et-fui-codegen/src/templates.ts` 的 `_cache` 对象缓存改为 `_cachePromise` Promise 缓存，消除并发冷启动读到半填充缓存的窗口。
3. **dist 缺模板**：插件 build 脚本加 `--copy src/templates`，dist/ 现包含 templates/ 子目录。
4. **import 排序**：biome organizeImports 自动修复 3 个文件的 import 排序错误（Codex 改导入时引入）。
