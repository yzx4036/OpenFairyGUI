# 阶段 C：OpenCode 架构回审指令

## 你的角色
你是本任务的**架构回审者**（阶段 C）。你设计了本任务的 architecture.md 和 implementation-plan.md，现在要审查 Codex（阶段 B）+ Hermes（阶段 B-fix）的最终实现是否忠实落地了你的架构。

## 必读文档（按序）
1. `docs/.hermes/tasks/20260813-extract-codegen-package/architecture.md` —— 你的架构设计
2. `docs/.hermes/tasks/20260813-extract-codegen-package/implementation-plan.md` —— 实现计划
3. `docs/.hermes/tasks/20260813-extract-codegen-package/coding-result.md` —— Codex 交付记录 + Hermes 修复记录
4. `docs/.hermes/tasks/20260813-extract-codegen-package/requirements.md` —— 原始需求

## 要审查的代码（工作区当前状态，未提交）
- `packages/codegen/` —— 新包（src、test、package.json、README、LICENSE）
- `plugins/et-fui-codegen/` —— 改造后插件（src 仅剩 ET 专属：hash 薄封装、model、templates、index）
- `scripts/smoke-test.ts`、`scripts/verify-fgui.ts` —— 脚本改动
- `.github/workflows/release.yml` —— 发布链路
- 双语 CHANGELOG / README / docs 文档改动

## 审查清单（逐项给结论：通过 / 不通过 + 理由）
1. **§1 字节级门槛**：确认 167 文件 md5/sha 对比证据链可信
2. **§2 通用/ET 边界**：新包无 ET/FairyGUI 依赖；插件只留 ET 专属
3. **§3 包结构**：package.json exports、零 runtime deps、public 入口
4. **§4 API 契约**：engine/naming/hash/writer 签名与架构一致
5. **§5 依赖方向**：插件 → codegen 单向；无循环
6. **§6 部署契约**：复制部署场景 README 说明是否充分
7. **§7 文件清单与文档同步**：release.yml、CHANGELOG、README、架构文档
8. **Hermes 4 项修复的合理性**：版本 lockstep、Promise cache、--copy 模板、import 排序——是否引入新风险

## 产出
写入 `docs/.hermes/tasks/20260813-extract-codegen-package/review-result.md`，结构：
- 逐项审查结论表
- 阻塞项清单（如有，标注 severity: blocking / should-fix / nit）
- 最终裁决：APPROVE / REQUEST_CHANGES

更新 `status.json` 为 `review_passed`（若 APPROVE）或 `review_blocked`（若有 blocking 项）。

**禁止修改任何源代码**——只审查和写 review-result.md / status.json。