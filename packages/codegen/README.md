# @openfairygui/codegen

Framework-agnostic template code generation utilities for OpenFairyGUI tooling.

## Install

```bash
npm install @openfairygui/codegen
```

## Usage

```ts
import { fnv1a31, normalizeTypeName, renderTemplate } from '@openfairygui/codegen';

const className = normalizeTypeName('login-panel');
const source = renderTemplate('public class $name$ {}', {
	scalars: { name: className },
	loops: {},
});
const stableId = fnv1a31(`ui:${className}`);
```

## API

- `renderTemplate()` renders strict scalar, loop, and conditional templates.
- Naming helpers normalize C# identifiers and project-relative paths.
- `fnv1a31()` creates deterministic positive 31-bit identifiers.
- `writeCodegenFiles()` applies overwrite and preserve-if-missing file policies through a caller-provided filesystem.

The package has no runtime dependencies.
