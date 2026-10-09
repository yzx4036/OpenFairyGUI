# coding-result — 20261009-test-debt-sync

## 改动清单

| 文件 | 变更摘要 |
|---|---|
| `packages/functions/test/publish.test.ts` | A1–A10：10 处断言同步到 `{tmpDir}/{PkgName}/` 子文件夹约定；新增模块级 helper `collectFilesRecursively`（A6/A7 复用，仅定义一次）；A6/A7 由 `fs.readdir` 改为递归文件断言。仅测试侧，无语义变更。 |
| `packages/functions/src/restore.ts` | B1：二进制发现改为两遍扫描——先扁平文件（语义不变：`isPublishedBinaryFile` → `assertSafeRestoreSegment` → packageFilter → isFile），再扫第一层子目录内 `_fui.bytes/.fui/.bin`（目录名安全段校验、子目录读取失败静默 continue、扁平优先去重）。空结果错误原文与最终排序保持。 |
| `packages/functions/src/restore-internals/resource-paths.ts` | B2：新增 `resolvePackageSourceFile(fs, sourceDir, pkg, candidates)`（`sourceDir` 根优先，未命中再查 `{sourceDir}/{publishName}/`，publishName 经 `assertSafeRestoreSegment` 校验）；`resolveLooseSourceFile` 切换到新函数。`resolveSourceFile` 本体与 `isPathWithin` 语义未动。 |
| `packages/functions/src/restore-internals/asset-output.ts` | B2：import 由 `resolveSourceFile` 切换为 `resolvePackageSourceFile`；3 个调用点（`restoreAtlasImages`、`copyLooseResources`、`buildSpriteLookup`）改为新签名并传入 `pkg`。 |

`packages/functions/test/restore.test.ts` 未改动（fixture 无需调整）。

## 逐项完成确认

- A1: done — `path.join(tmpDir, 'UnityPkg', 'UnityPkg_fui.bytes')`
- A2: done — `path.join(tmpDir, 'Basics', 'Basics_o4lt7w.wav')`
- A3: done — expectedFiles/absentFiles 循环与 bytes 读取均加 `Loader` 子目录
- A4: done — `Branch_fui.bytes`（2 处）、`Branch_atlas0.png`、`Branch_atlas0_dev.png` 加 `Branch` 子目录
- A5: done — `Branch_fui.bytes`（2 处）加 `Branch` 子目录
- A6: done — 新增 `collectFilesRecursively` helper，断言改为递归文件列表为空
- A7: done — 复用 A6 helper（未重复定义），断言改为递归文件列表为空
- A8: done — `path.join(tmpDir, 'GhostPkg', 'GhostPkg_fui.bytes')`
- A9: done — `path.join(tmpDir, 'HitTest', 'HitTest_fui.bytes')`
- A10: done — `path.join(tmpDir, check.file.replace(/_fui\.bytes$/, ''), check.file)`
- B1: done — 两遍扫描 + 扁平优先去重 + 子目录安全段校验 + 静默 continue + 排序保持
- B2: done — 新增 `resolvePackageSourceFile`，4 个调用点全部切换，查找顺序根优先/子目录兜底
- B3: done — 未改 CLI、未改 `RestoreOptions`/`RestoreFileSystem` 接口、未加依赖、未新增测试、未重构无关代码

## 验证证据

命令 1（两个测试文件全绿）：

```bash
export NODE_OPTIONS=--max-old-space-size=16384
pnpm exec ava --no-worker-threads packages/functions/test/publish.test.ts packages/functions/test/restore.test.ts
```

尾部关键行：

```
  ✔ restore › restore published project: directory batch restores packages, assets, and branch files (7.6s)
  ─

  71 tests passed
```

命令 2（类型检查）：

```bash
pnpm typecheck
```

结果：`tsc --noEmit --declaration false` 退出码 `0`，无错误输出。

命令 3（静态检查）：

```bash
pnpm lint
```

结果：`Checked 387 files in 459ms. No fixes applied.` 退出码 `0`。

命令 4（变更范围）：

```bash
git status --porcelain
```

结果：

```
 M packages/functions/src/restore-internals/asset-output.ts
 M packages/functions/src/restore-internals/resource-paths.ts
 M packages/functions/src/restore.ts
 M packages/functions/test/publish.test.ts
?? docs/.hermes/tasks/20261009-test-debt-sync/
```

全部落在验收允许清单内（`restore.test.ts` 无需改动；任务目录为未跟踪结果文件）。

## 偏差与未决

无。
