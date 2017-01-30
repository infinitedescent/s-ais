import test from 'ava';
import fn from '../../lib/.';

test('title', t => {
	const err = t.throws(() => fn(123), TypeError);
	t.is(err.message, 'Expected a string, got number');

	t.is(fn('unicorns'), 'unicorns & rainbows');
});
