export { renderTemplate } from './engine.js';
export type { TemplateContext } from './engine.js';
export { fnv1a31 } from './hash.js';
export {
	ensureCSharpIdentifier,
	escapeCSharpString,
	isAbsolutePath,
	normalizeMemberName,
	normalizeTypeName,
	resolveProjectBasePath,
	trimTrailingSlashes,
} from './naming.js';
export { writeCodegenFiles } from './writer.js';
export type { CodegenWriteFile, CodegenWriteResult, CodegenWriterFs } from './writer.js';
