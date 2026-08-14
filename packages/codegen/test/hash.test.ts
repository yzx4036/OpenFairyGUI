import test from 'ava';
import { fnv1a31 } from '../src/index.js';

test('creates deterministic positive identifiers', (t) => {
	const first = fnv1a31('pkg1:comp1');
	t.is(first, fnv1a31('pkg1:comp1'));
	t.not(first, fnv1a31('pkg1:comp2'));
	t.true(first > 0);
});

test('matches the legacy panel-id hash input', (t) => {
	t.is(fnv1a31('pkg1:comp1'), 1794741604);
});
