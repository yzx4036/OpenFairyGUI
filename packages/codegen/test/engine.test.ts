import test from 'ava';
import { renderTemplate, type TemplateContext } from '../src/index.js';

test('renders scalars, loops, and truthy conditionals', (t) => {
	const context: TemplateContext = {
		scalars: { flag: 'true', name: 'World', zero: '0' },
		loops: {
			items: [
				{ label: 'A', value: '1' },
				{ label: 'B', value: '2' },
			],
		},
	};
	const template =
		'Hello $name$\n//$for item in items$\n  $item.label$=$item.value$\n//$endfor$\n//$if flag$\nFLAG_ON\n//$endif$\n//$if zero$\nZERO_ON\n//$endif$';
	const result = renderTemplate(template, context);

	t.true(result.includes('Hello World'));
	t.true(result.includes('  A=1'));
	t.true(result.includes('  B=2'));
	t.true(result.includes('FLAG_ON'));
	t.false(result.includes('ZERO_ON'));
	t.false(result.includes('$'));
});

test('supports nested loops and inverted conditions', (t) => {
	const result = renderTemplate(
		'//$for outer in outers$\n//$for inner in inners$\n$outer.name$:$inner.name$\n//$endfor$\n//$endfor$\n//$if !disabled$\nON\n//$endif$',
		{
			scalars: { disabled: 'false' },
			loops: {
				inners: [{ name: '1' }, { name: '2' }],
				outers: [{ name: 'A' }, { name: 'B' }],
			},
		},
	);

	t.is(result, 'A:1\nA:2\nB:1\nB:2\nON\n');
});

test('strict mode rejects unresolved tokens and missing loops', (t) => {
	t.throws(() => renderTemplate('hello $unknown$', { scalars: {}, loops: {} }), {
		message: /unresolved token/u,
	});
	t.throws(
		() => renderTemplate('//$for item in missing$\n$item.name$\n//$endfor$', { scalars: {}, loops: {} }),
		{ message: /loop "missing" not provided/u },
	);
});

test('parser rejects a missing endfor directive', (t) => {
	t.throws(() => renderTemplate('//$for item in items$\n$item.name$', { scalars: {}, loops: { items: [] } }), {
		message: /missing terminator for \/\/\$for/u,
	});
});
