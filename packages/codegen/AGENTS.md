# codegen

先读[根指引](../../AGENTS.md)。下面路径与命令均相对仓库根目录。

- 定位：`@openfairygui/codegen` 是零运行时依赖的通用模板代码生成基础设施——严格模板渲染、C# 命名与路径工具、稳定哈希，以及可注入文件系统的 overwrite/preserve 写入策略；不承载 FairyGUI 中间模型、框架模板或目录布局。
- 入口：`packages/codegen/src/index.ts` 是唯一公开入口，实现按 engine / naming / hash / writer 分文件。改公开行为时同步 `packages/codegen/test/` 下对应测试。
- 归属：ET（ProjZero）模板与目录布局留在 `plugins/et-fui-codegen`；`packages/functions/` 的内置 FairyGUI 生成与本包是不同边界。本包不引入 FairyGUI 语义。
- 验证：运行 `pnpm --filter @openfairygui/codegen test` 与 `pnpm --filter @openfairygui/codegen lint`；涉及下游使用时加跑 `pnpm test:changed`。