import test from 'ava';
import sinon from 'sinon';
import rp from 'request-promise-native';
import proxyquire from 'proxyquire';

import InReachService from '../../../lib/delorme/inreach-service';

test('constructs', t => {
	t.truthy(new InReachService());
});

test('getMapShareKML with mapShareId', t => {
	let getSpy = sinon.spy(rp, 'get');
	proxyquire('../../../lib/delorme/inreach-service', {
		'request-promise-native': {
			get: getSpy
		}
	});
	const instance = new InReachService();
	const mapShareId = 'testMapShareId';

	instance.getMapShareKML(mapShareId);

	t.true(rp.get.calledOnce);
	t.deepEqual(rp.get.getCall(0).args[0].uri, 'https://share.delorme.com/feed/Share/' + mapShareId, 'should call expected uri');
	t.deepEqual(rp.get.getCall(0).args[0].headers['cache-control'], 'no-cache', 'should not cache results');
	t.falsy(rp.get.getCall(0).args[0].qs, 'should have no query string');
	rp.get.restore();
});

test('getMapShareKML with mapShareId and startTime', t => {
	let getSpy = sinon.spy(rp, 'get');
	proxyquire('../../../lib/delorme/inreach-service', {
		'request-promise-native': {
			get: getSpy
		}
	});
	const instance = new InReachService();
	const mapShareId = 'testMapShareId';
	const startTime = new Date();

	instance.getMapShareKML(mapShareId, startTime);

	t.true(rp.get.calledOnce);
	t.deepEqual(rp.get.getCall(0).args[0].uri, 'https://share.delorme.com/feed/Share/' + mapShareId, 'should call expected uri');
	t.truthy(rp.get.getCall(0).args[0].qs, 'should include query string payload');
	t.truthy(rp.get.getCall(0).args[0].qs.d1, 'should include "ds" param in query string');
	t.deepEqual(rp.get.getCall(0).args[0].qs.d1, startTime.toISOString(), 'should have expected start ISO time value');

	rp.get.restore();
});

test('getMapShareKML with mapShareId, startTime and endTime', t => {
	let getSpy = sinon.spy(rp, 'get');
	proxyquire('../../../lib/delorme/inreach-service', {
		'request-promise-native': {
			get: getSpy
		}
	});
	const instance = new InReachService();
	const mapShareId = 'testMapShareId';
	const startTime = new Date();
	const endTime = new Date();

	instance.getMapShareKML(mapShareId, startTime, endTime);

	t.true(rp.get.calledOnce);
	t.deepEqual(rp.get.getCall(0).args[0].uri, 'https://share.delorme.com/feed/Share/' + mapShareId, 'should call expected uri');
	t.truthy(rp.get.getCall(0).args[0].qs, 'should include query string payload');
	t.truthy(rp.get.getCall(0).args[0].qs.d1, 'should include "d1" param in query string');
	t.deepEqual(rp.get.getCall(0).args[0].qs.d1, startTime.toISOString(), 'should have expected start ISO time value');
	t.truthy(rp.get.getCall(0).args[0].qs.d2, 'should include "d2" param in query string');
	t.deepEqual(rp.get.getCall(0).args[0].qs.d2, endTime.toISOString(), 'should have expected end ISO time value');

	rp.get.restore();
});

test('getMapShareKML with mapShareId, startTime, endTime and IME', t => {
	let getSpy = sinon.spy(rp, 'get');
	proxyquire('../../../lib/delorme/inreach-service', {
		'request-promise-native': {
			get: getSpy
		}
	});
	const instance = new InReachService();
	const mapShareId = 'testMapShareId';
	const startTime = new Date();
	const endTime = new Date();
	const imeis = ['fakeImei1', 'fakeImei2'];

	instance.getMapShareKML(mapShareId, startTime, endTime, imeis);

	t.true(rp.get.calledOnce);
	t.deepEqual(rp.get.getCall(0).args[0].uri, 'https://share.delorme.com/feed/Share/' + mapShareId, 'should call expected uri');
	t.truthy(rp.get.getCall(0).args[0].qs, 'should include query string payload');
	t.truthy(rp.get.getCall(0).args[0].qs.d1, 'should include "d1" param in query string');
	t.deepEqual(rp.get.getCall(0).args[0].qs.d1, startTime.toISOString(), 'should have expected start ISO time value');
	t.truthy(rp.get.getCall(0).args[0].qs.d2, 'should include "d2" param in query string');
	t.deepEqual(rp.get.getCall(0).args[0].qs.d2, endTime.toISOString(), 'should have expected end ISO time value');
	t.truthy(rp.get.getCall(0).args[0].qs.imei, 'should include "imei" param in query string');
	t.deepEqual(rp.get.getCall(0).args[0].qs.imei, 'fakeImei1,fakeImei2', 'should have comma seperated list of expected values');

	rp.get.restore();
});

test('getMapShareKML with xml result', async t => {
	let getStub = sinon.stub(rp, 'get');
	proxyquire('../../../lib/delorme/inreach-service', {
		'request-promise-native': {
			get: getStub
		}
	});
	const instance = new InReachService();
	const mapShareId = 'testMapShareId';
	const requestPromise = Promise.resolve('<?xml');
	getStub.returns(requestPromise);

	const result = instance.getMapShareKML(mapShareId);
	rp.get.restore();
	await result.then(data => {
		t.deepEqual(data, '<?xml', 'expected data');
	});
});

test('getMapShareKML with error result', async t => {
	let getStub = sinon.stub(rp, 'get');
	proxyquire('../../../lib/delorme/inreach-service', {
		'request-promise-native': {
			get: getStub
		}
	});
	const instance = new InReachService();
	const mapShareId = 'testMapShareId';
	const requestPromise = Promise.resolve('');
	getStub.returns(requestPromise);

	const error = await t.throws(instance.getMapShareKML(mapShareId));
	t.is(error.message, 'No KML was returned for MapShare: ' + mapShareId, 'should throw correct error message');
	rp.get.restore();
});
