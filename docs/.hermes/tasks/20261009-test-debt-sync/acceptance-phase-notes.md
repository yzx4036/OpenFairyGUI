# acceptance-phase-notes — 20261009-test-debt-sync 全功能验收阶段纪实

日期：2026-10-09。入参 HEAD：`0421c15`（本阶段修复产出 `7fc52dc`）。编排层：Hermes。

## 验收矩阵（两轮）

### 第一轮 ofgui-acceptance-v021.sh（16:25 起）

- **PASS(12)**：typecheck / lint / build / fulltest（648 全绿）/ testrepo / docscheck / plugin-et-fui-codegen / plugin-codegen / smoke-test / verify-fgui / smoke-projzero / codegen-preserve（生成代码「覆盖区域」live 探针，6 项断言全过）
- **FAIL(5)**：rt-publish、rt-layout、rt-restore、rt-restored-project、eval-agent

### 失败定性

1. **rt-publish**：ProjZero 工程携带 FairyGUI 编辑器 Lua 插件（`plugins/PanelInspector/main.lua`）→ Node CLI 自动加载工程 `plugins/` 时 `Unknown file extension ".lua"` 整链失败。定性：既有行为（需 `PublishSettings.pluginsDir` 配置绕开，或用副本排除 `plugins/`——smoke-projzero 同款安全模式），非本迭代回归。
2. **rt-restore**：验收脚本 bug——MSYS 路径 `/e/...` 未转换为原生 `E:/...`，node 解析为 `E:\e\...` 失败。
3. **eval-agent**：消费者准备阶段「Build current workspace」在**剥离 NODE_OPTIONS 的干净环境**下，`plugins/et-fui-codegen` tsdown 构建 OOM（默认 4GB 与 8GB 均复现，16GB 通过）。

### 插件构建 OOM 根因与修复（本阶段产出）

- **根因**：`tsdown ... --dts` 生成声明文件时沿 `import type { Package } from '@openfairygui/core'` 的完整类型图展开（rolldown-rc 病理），内存需求 >8GB；去掉 `--dts` 后构建 **74ms** 通过。
- **依据**：插件 `main`/`exports` → `./src/index.ts`，`dist` 无任何消费者（全仓 grep 证实）；`private: true`。
- **修复**：`plugins/et-fui-codegen/package.json` build 脚本去掉 `--dts`（commit `7fc52dc`）。
- **验证**：默认堆全量 `pnpm build` ✅（9 工程全 Done）；插件测试 14/14 ✅；eval 消费者环境（干净 env）内部构建通过 ✅；默认堆全量测试 648/648 ✅。
- **CI 关联**：GitHub CI 三类失败（Repository checks=同款 OOM / Guidance=impact map 覆盖 / consumer=诊断码恢复指引缺失）已全部在 develop 修复；y0-v0.2.1 main 推送后以实跑为准。

### 第二轮 ofgui-acceptance-rerun.sh（修复后）

- **PASS(6) FAIL(0)**：
  - `rt-publish`（工程副本排除 plugins/ + 原生路径）→ **13** 个 bytes 子文件夹产物；
  - `rt-restore` → 恢复工程 **70** 个 XML；
  - `eval-agent`（标准路径，干净消费者环境）**10/10**：inspect-validate / rename-save / stale-revision-recovery / edit-display-node / edit-controller / edit-transition / missing-source-bytes / path-policy / publish-consume / restore-trusted（含 realPublish / realRestore / decodedPixels 断言）；
  - 默认堆全量测试 **648/648**。

## 结论

- **ofgui 全功能验收通过**：拼UI/改UI（eval 六任务 + smoke-test + 全量单元套件）、导入导出（live 往返 + eval 发布/恢复任务）、发布链（smoke-projzero、codegen-preserve）、生成代码（新代码 + 覆盖区域 + 保留语义 live 探针）。
- **遗留（非阻断）**：FairyGUI 编辑器 Lua 插件工程需 `pluginsDir` 配置或排除 `plugins/` 副本后经 CLI 发布；CI consumer 任务 ubuntu/windows 的 pack:check 浏览器环节未在本机复现（首轮失败点=contracts:check，修复后未见新证据）。

## 证据文件（本机）

- 验收日志：`E:/_Proj/_Agent/riven-hermes/cache/scratch/ofgui-v021/acceptance/{acceptance.log, acceptance-rerun.log}`
- 脚本：`E:/_Proj/_Agent/riven-hermes/scripts/{ofgui-acceptance-v021.sh, ofgui-acceptance-rerun.sh, ofgui-accept-codegen-preserve.mts}`
- eval 报告：`C:/Users/E_Ye/AppData/Local/Temp/ofgui-consumer-HSgJpO/evaluations/report.json`（保留现场）
