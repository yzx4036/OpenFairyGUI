# 编码轮任务 — OpenFairyGUI 测试债清零（test-debt-sync）

## 指令

1. 完整读取 `docs/.hermes/tasks/20261009-test-debt-sync/requirements.md`（本任务唯一权威任务书），按其中「修复需求 A（A1–A10）」「修复需求 B（B1–B3）」逐条实施。
2. 行号为快照参考；若漂移，以文中代码片段原文匹配为准。不要凭摘要猜，先读目标文件当前内容。
3. 完成后按「验收」节逐条执行命令，把证据写进 `docs/.hermes/tasks/20261009-test-debt-sync/coding-result.md`（格式见任务书「结果文件」节）。
4. 更新 `docs/.hermes/tasks/20261009-test-debt-sync/status.json` → `{"status": "code_review"}`。
5. **不要 git commit**（提交由编排层统一执行）；不要提出确认性问题——所有裁决已写在任务书「预裁决」节；确遇阻塞按铁律第 2 条写 `fault.md` 后自动结束。

## 工作环境

- 仓库：`E:/_Proj/OpenFairyGUI`（当前目录）
- 测试命令迭代示例：
  - 全量两文件：`pnpm exec ava --no-worker-threads packages/functions/test/publish.test.ts packages/functions/test/restore.test.ts`
  - 单测过滤：`pnpm exec ava --no-worker-threads packages/functions/test/publish.test.ts --match="custom fileExtension"`
  - 环境：重负载前 `export NODE_OPTIONS=--max-old-space-size=16384`

## 三锻铁律（强制）

1. **只做任务文档范围的事**：只执行 requirements.md 覆盖的范围，禁顺手重构、禁探索无关文件/环境、禁自行跑验证门之外的工具（如找 tsc/find 全盘）。
2. **漂移/卡住 → 异常标记 + 自动结束**：一旦发现自己偏离任务范围、或某步骤 2 次尝试仍卡住（如找不到工具、环境不具备）→ 写 `fault.md`（异常原因/已完成部分/未完成部分/建议下一步）+ `status.json → interrupted`，**自动结束当前委派**，不再无限重试/探索。
3. **编排层兜底**：Hermes 收到 interrupted → 依据 fault.md 分诊，进度始终有记录。
4. （本条即为原文引用要求，见上 1–3。）
