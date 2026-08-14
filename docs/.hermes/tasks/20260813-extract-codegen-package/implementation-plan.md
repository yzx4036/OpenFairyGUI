# @openfairygui/codegen 提取实施计划

目标：把 `plugins/et-fui-codegen` 的通用引擎/命名/哈希下沉到 `packages/codegen`，插件改为依赖新包。
**硬门槛**：插件生成产物逐字节不变。本计划每步都有明确的文件改动与验证方式。

## 实施前准备

- 仓库根执行：`git status` 干净后开始（当前工作区含未跟踪的 `docs/.hermes/`，不影响）。
- 确认本地可用的 FGUI 样例工程（`scripts/verify-fgui.ts` 引用的 ProjZero 路径）存在，用于字节级回归。
- 记录基线失败集：先跑一遍 `pnpm test`，保存当前失败用例列表，供最后对比「无新增回归」。

---

## Step 0 — 建立字节级基线（不写代码）

**改动文件**：无。

**操作**：
1. 在改造前用当前插件源码生成基准产物：
   ```
   npx tsx scripts/verify-fgui.ts
   ```
   输出到 `test-output/fgui-codegen/`。
2. 复制一份基线：
   ```
   cp -r test-output/fgui-codegen test-output/fgui-codegen-baseline
   ```
3. 记录基线树结构与文件哈希（供 Step 6 对比）：
   ```
   find test-output/fgui-codegen-baseline -type f | sort
   ```

**验证**：基线目录存在且文件非空。

---

## Step 1 — 创建 `packages/codegen` 包骨架

**改动文件**：
- 新增 `packages/codegen/package.json`
- 新增 `packages/codegen/README.md`
- 新增 `packages/codegen/LICENSE`（复制自 `packages/core/LICENSE`）
- 修改 `tsconfig.json`：`paths` 增加 `"@openfairygui/codegen": ["./packages/codegen/src/index.ts"]`

**package.json 要点**（对齐 `packages/functions` 惯例）：
- `name: "@openfairygui/codegen"`，`version: "0.1.0"`，public（不设 `private`）
- `type: "module"`、`sideEffects: false`、`main/module/types/exports` 指向 `dist`
- `scripts`：
  - `build`: `tsdown src/index.ts --format esm,cjs --platform neutral --dts`
  - `build:watch`: 同上加 `--watch`
  - `test`: `ava --no-worker-threads`
  - `lint`: `biome check src test`
- `files: ["dist/", "src/"]`
- `devDependencies`: `ava: ^7.0.0`、`tsx: ^4.0.0`（与 core/functions 一致）
- 无 `dependencies`（零运行时依赖）
- ava 配置块：`extensions: { ts: "module" }` + `nodeArguments: ["--import", "tsx/esm"]` + `files: ["test/**/*.test.ts"]`（对齐 et-fui-codegen 写法）

**验证**：
- `pnpm install`（根）能识别新 workspace 包
- `pnpm --filter @openfairygui/codegen build` 产出 `dist/index.js` + `dist/index.cjs` + `dist/index.d.ts`

---

## Step 2 — 迁移 engine / naming / hash

**改动文件**：
- 新增 `packages/codegen/src/engine.ts`（复制自 `plugins/et-fui-codegen/src/engine.ts`，**逐字迁移**，只改文件头注释的归属说明）
- 新增 `packages/codegen/src/naming.ts`（同上，逐字迁移）
- 新增 `packages/codegen/src/hash.ts`：改写成
  ```ts
  export function fnv1a31(value: string): number {
      let hash = 0x811c9dc5;
      for (let index = 0; index < value.length; index++) {
          hash ^= value.charCodeAt(index);
          hash = Math.imul(hash, 0x01000193);
      }
      const positive = hash >>> 0 & 0x7fffffff;
      return positive === 0 ? 1 : positive;
  }
  ```
  保留原实现算法，仅参数由 `(packageId, componentId)` 泛化为 `value`，内部拼接字符串的逻辑移到调用方。
- 新增 `packages/codegen/src/index.ts`：导出 engine / naming / hash
- 新增测试：
  - `packages/codegen/test/engine.test.ts`（迁移 `scripts/smoke-test.ts` 第 1、7 组断言 + 补齐：for 嵌套、if 取反、缺失 endfor 抛错、循环未提供抛错）
  - `packages/codegen/test/naming.test.ts`（迁移第 2 组断言 + 补齐：fallback、多段 kebab、路径工具）
  - `packages/codegen/test/hash.test.ts`（迁移第 3 组断言 + 补齐：与 `hashPanelId` 等价的 `fnv1a31("pkg1:comp1")`）

**注意**：`hash.ts` 必须保证 `fnv1a31(\`${pkg}:${comp}\`)` 与旧 `hashPanelId(pkg, comp)` 结果逐位一致（内部实现无变化）。

**验证**：
- `pnpm --filter @openfairygui/codegen test` 全绿
- `pnpm --filter @openfairygui/codegen build`
- 根 `pnpm typecheck` 通过（新包已纳入 `packages/*/src`）
- 根 `pnpm lint` 通过（biome 覆盖 `packages`）

---

## Step 3 — 可选的 writer 契约

**改动文件**：
- 新增 `packages/codegen/src/writer.ts`
- `packages/codegen/src/index.ts` 增加 writer 导出
- 新增 `packages/codegen/test/writer.test.ts`

**内容**：按 architecture.md §4.4 的 `writeCodegenFiles` 契约实现：
- `directories` 逐个 `mkdir`（`Promise.all`）
- overwrite 文件直接写；preserve 文件先探测存在性（`fs.exists`，否则 `fs.readFileRaw` try/catch），存在则跳过并计数 `preserved`
- fs 无 `exists` 且无 `readFileRaw` 时 `detectUnavailable: true`，全部按写入处理（与旧 `fileExists` 语义一致）
- 返回 `written / preserved / detectUnavailable`

**测试**：用内存 fake fs（实现 `mkdir/writeFileRaw/exists`）覆盖：纯 overwrite、preserve 已存在跳过、preserve 不存在写入、无探测能力回退、计数与 `detectUnavailable`。

**验证**：
- `pnpm --filter @openfairygui/codegen test` 全绿

> 若本步骤发现契约与插件 `writeOutput` 耦合过深，可跳过 writer 抽象，`writeOutput` 留在插件内原样实现。
> 该决策不改变任何生成产物。

---

## Step 4 — 改造 `plugins/et-fui-codegen`

**改动文件**：
- `plugins/et-fui-codegen/package.json`：新增 `dependencies: { "@openfairygui/codegen": "workspace:*" }`
- `plugins/et-fui-codegen/src/engine.ts`：**删除**
- `plugins/et-fui-codegen/src/naming.ts`：**删除**
- `plugins/et-fui-codegen/src/hash.ts`：改写为薄封装（见 architecture.md §7.2）
- `plugins/et-fui-codegen/src/model.ts`：
  - `import { ensureCSharpIdentifier, normalizeMemberName, normalizeTypeName } from './naming.js'` → `from '@openfairygui/codegen'`
  - `import { hashPanelId } from './hash.js'` → 若保留薄封装则维持 `./hash.js`，否则改 `import { fnv1a31 } from '@openfairygui/codegen'` 并内联 `fnv1a31(\`${packageId}:${componentId}\`)`
  - 其余逻辑（remark 解析、跨包引用、panelId 分配、排序）**不动**
- `plugins/et-fui-codegen/src/templates.ts`：
  - `import { renderTemplate } from './engine.js'` → `from '@openfairygui/codegen'`
  - `import { escapeCSharpString } from './naming.js'` → `from '@openfairygui/codegen'`
- `plugins/et-fui-codegen/src/index.ts`：
  - `isAbsolutePath / resolveProjectBasePath / trimTrailingSlashes` 改从 `@openfairygui/codegen` 导入
  - 若采用 writer：`writeOutput` 构造 `directories + files` 列表调用 `writeCodegenFiles`；preserve 计数与「无法探测」告警改用返回的 `preserved` / `detectUnavailable`，**日志文案保持不变**

**验证**：
- `pnpm --filter et-fui-codegen typecheck` 通过（插件 tsconfig 继承根 paths）
- `pnpm --filter et-fui-codegen build` 通过
- `pnpm --filter et-fui-codegen test` 通过（Step 5 补充测试后）

---

## Step 5 — 补插件消费侧测试

**改动文件**：
- 新增 `plugins/et-fui-codegen/test/model.test.ts`：用 `@openfairygui/core` 的 `Document` 构建样例工程，断言 `buildCodegenOutputs` 的 package/component/member/panelId/entity 命名结果
- 新增 `plugins/et-fui-codegen/test/templates.test.ts`：迁移 `scripts/smoke-test.ts` 第 4-6 组 render 断言（binding / entity / system / panelId / binder）
- 新增 `plugins/et-fui-codegen/test/index.test.ts`（若采用 writer）：用内存 fs 走 `writeOutput`，断言 automatic 覆盖、preserved 文件首写创建/二次跳过、日志计数
- 新增 `plugins/et-fui-codegen/scripts/smoke-projzero.ts`（`package.json` 已声明 `smoke:projzero` 但文件缺失）：从 `scripts/verify-fgui.ts` 提取为可复制工程的 smoke 脚本

**验证**：
- `pnpm --filter et-fui-codegen test` 全绿
- `pnpm --filter et-fui-codegen smoke:projzero -- <path-to-FGUIProject>` 可运行

---

## Step 6 — 字节级回归与全量验证

**操作**：
1. 改造后重新生成：
   ```
   npx tsx scripts/verify-fgui.ts
   ```
2. 与基线逐字节对比：
   ```
   diff -r test-output/fgui-codegen-baseline test-output/fgui-codegen
   ```
   期望：**无任何差异**（含目录结构、文件清单、文件内容）。

**全量验证**：
- `pnpm --filter @openfairygui/codegen test`
- `pnpm --filter et-fui-codegen test`
- 根 `pnpm run build`（workspace 全量）
- 根 `pnpm run lint`
- 根 `pnpm run typecheck`
- 根 `pnpm run test`（全量 ava）
- 与基线失败集对比，确认**无新增测试回归**

---

## Step 7 — 文档与发布配置同步

**改动文件**（按 AGENTS.md 文档联动规则）：
- `plugins/et-fui-codegen/README.md`：更新部署描述——插件运行时依赖 `@openfairygui/codegen`；复制进 FGUI 工程时需安装该包或保持 workspace；移除「no runtime imports」表述
- `.github/workflows/release.yml`：三处包列表（verify / npmjs / GitHub Packages）各加 `codegen`
- `README.md`、`README_EN.md`：包导航表加 `@openfairygui/codegen`
- `docs/guide/packages.md`、`docs/en/guide/packages.md`：包表与公开入口表加 `@openfairygui/codegen`
- `docs/architecture-overview.md`：模块边界表加 `@openfairygui/codegen`（模板代码生成基础设施、零运行时依赖），说明插件依赖关系变化
- `CHANGELOG_CN.md`、`CHANGELOG.md`：Unreleased 加「新增 `@openfairygui/codegen` 包」条目，双语一致
- `docs/publish-plugins.md`：核对插件 API 是否变化（本次不改 Plugin 钩子契约，通常无需改动；如涉及 `--plugin` 加载说明措辞则同步）

**验证**：检查 `README.md` / `README_EN.md` / `docs/README.md` 入口无失效链接。

---

## Step 8 — 收尾提交检查

- `git status`：确认无遗留重复代码（`plugins/et-fui-codegen/src/` 下不再有 engine/naming 源文件）
- `rg "plugins/et-fui-codegen/src/(engine|naming|hash)"`：仓库内不再有指向已删文件的 import（`scripts/smoke-test.ts` 已改）
- 根 `pnpm lint` / `pnpm typecheck` 全绿
- 确认新包未被误设为 `private`（发布链路需要 public）
- 按需更新 `docs/.hermes/tasks/20260813-extract-codegen-package/status.json`

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| `hash.ts` 泛化改变哈希结果 | Step 2 的 `hash.test.ts` 显式断言 `fnv1a31("pkg1:comp1")` 等于旧 `hashPanelId("pkg1","comp1")`；Step 6 字节级 diff 兜底 |
| 插件运行时解析 `@openfairygui/codegen` 失败 | workspace 符号链接保证仓库内 `--plugin` 可用；README 部署章节同步说明 |
| writer 契约过度设计 | Step 3 允许放弃；行为不变优先 |
| 新包被 release 流程遗漏 | Step 7 同步 `release.yml` |
| `verify-fgui.ts` 的样例路径在 CI 不可用 | 字节级回归为本地人工步骤；CI 由 ava 测试 + typecheck + lint 覆盖 |
