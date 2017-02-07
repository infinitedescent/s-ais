import test from 'ava';
import ServerAIS from '../../lib/s-ais';

test('constructs', t => {
	t.truthy(new ServerAIS());
});
