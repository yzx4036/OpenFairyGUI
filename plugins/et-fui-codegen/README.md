# et-fui-codegen

`et-fui-codegen` is an OpenFairyGUI publish plugin that replaces the built-in
Unity code generator with deterministic C# output for ET/FairyGUI projects.
The plugin has no runtime imports: OpenFairyGUI's Jiti loader can load
`src/index.ts` directly after this directory is copied into an FGUI project.

## Enable the plugin

OpenFairyGUI discovers Node publish plugins only from the project being
published:

```text
<FGUIProject>/plugins/et-fui-codegen/package.json
```

The project's `settings/Publish.json` must enable code generation and point
`codePath` at the desired logical C# root:

```json
{
  "codeGeneration": {
    "allowGenCode": true,
    "codePath": "../Generated/FUI",
    "classNamePrefix": "FUI_",
    "memberNamePrefix": "",
    "packageName": "ET.Client",
    "ignoreNoname": true,
    "getMemberByName": true
  }
}
```

Each package must also have `<publish genCode="true" ...>` in `package.xml`.
Both gates are required by design.

## Output contract

For packages that resolve to the same `codePath`, the plugin writes:

```text
<codePath>/
├── FUIAutoGen/PanelId.cs
├── ModelView/<Package>/
│   ├── FUI_<Component>.cs
│   └── <Entity>.cs
├── HotfixView/<Package>/
│   ├── <Entity>System.cs
│   └── Event/<Entity>EventHandler.cs
└── HotfixView/FUIBinder.cs
```

Binding namespaces are package-scoped (`ET.Client.<Package>`) so components
with the same name in different packages remain valid C#. ET Entity, System,
EventHandler, `PanelId`, and `FUIBinder` types use the configured base
namespace (`ET.Client` by default).

Component remarks retain the ProjZero classification convention:

| Remark | Binding | Entity/System | Event/PanelId |
| --- | --- | --- | --- |
| `Type:View|Layer:<layer>` | yes | yes | yes |
| `Type:Comp|Layer:<layer>` | yes | yes | no |
| `Type:None` | yes | no | no |
| no `remark` | yes | yes (panel default) | yes |

The no-remark fallback implements the generic context contract where every
component is treated as a panel. Explicit ProjZero remarks take precedence.

`PanelId` values use 32-bit FNV-1a over `packageId:componentId`, are masked to
a positive non-zero C# `int`, and are collision-checked. This deliberately
replaces the legacy traversal-order ids; existing persisted or configured ids
must be migrated before the generated file is adopted.

## Safe regeneration

Bindings, EventHandlers, `PanelId`, and `FUIBinder` are plugin-owned and are
overwritten deterministically. Entity and System files are generated only when
missing, so later publishes preserve business code. The abstract publish
filesystem has no recursive directory-delete contract, so stale files from
deleted/renamed components must be removed explicitly.

## Development

Use pnpm from the repository root:

```bash
pnpm --filter et-fui-codegen build
pnpm --filter et-fui-codegen typecheck
pnpm --filter et-fui-codegen test
pnpm --filter et-fui-codegen smoke:projzero -- <path-to-FGUIProject>
```

The smoke script copies the source FGUI project to an OS temporary directory,
enables generation only in that copy, publishes the `Login` package through
normal plugin discovery, and asserts the ET C# files exist. It never writes to
the source project.

## Deliberately deferred compatibility

The initial plugin contract does not generate `FUI_*Wind`, per-package Binder
classes, or the MemoryPack `UIPackageMapping.bytes` artifact. Those legacy
Spawner features require separate runtime contracts and should be added only
after the generated C# is reviewed against the target ET branch.
