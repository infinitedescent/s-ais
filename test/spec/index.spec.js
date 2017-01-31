import test from 'ava';
import index from '../../lib/.';

test('title', t => {
	const err = t.throws(() => index(123), TypeError);
	t.is(err.message, 'Expected a string, got number');

	t.is(index('unicorns'), '');
});
