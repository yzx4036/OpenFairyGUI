import test from 'ava';
import {
	ensureCSharpIdentifier,
	escapeCSharpString,
	isAbsolutePath,
	normalizeMemberName,
	normalizeTypeName,
	resolveProjectBasePath,
	trimTrailingSlashes,
} from '../src/index.js';

test('normalizes C# type and member identifiers', (t) => {
	t.is(normalizeTypeName('LoginPanel'), 'LoginPanel');
	t.is(normalizeTypeName('login-panel'), 'LoginPanel');
	t.is(normalizeTypeName('multi-part-type'), 'MultiPartType');
	t.is(normalizeTypeName('123abc'), '_123abc');
	t.is(normalizeTypeName('', 'Fallback'), 'Fallback');
	t.is(normalizeMemberName('btn_start'), 'btn_start');
	t.is(normalizeMemberName('', 'fallbackMember'), 'fallbackMember');
	t.is(ensureCSharpIdentifier('public'), '_public');
});

test('escapes C# string content', (t) => {
	t.is(escapeCSharpString('a\\b"c\r\nd'), 'a\\\\b\\"c\\r\\nd');
});

test('recognizes absolute paths and trims trailing separators', (t) => {
	t.true(isAbsolutePath('C:\\project\\src'));
	t.true(isAbsolutePath('/project/src'));
	t.true(isAbsolutePath('\\\\server\\share'));
	t.false(isAbsolutePath('project/src'));
	t.is(trimTrailingSlashes('project/src///'), 'project/src');
	t.is(trimTrailingSlashes('C:\\project\\\\'), 'C:\\project');
});

test('resolves project roots from project and assets paths', (t) => {
	t.is(resolveProjectBasePath(undefined), '');
	t.is(resolveProjectBasePath('C:\\project\\Project.fairy'), 'C:\\project');
	t.is(resolveProjectBasePath('C:\\project\\assets'), 'C:\\project');
	t.is(resolveProjectBasePath('/project/assets_mobile/'), '/project');
});
