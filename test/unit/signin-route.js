var assert = require('assert');
var ejs = require('ejs');
var sinon = require('sinon');
var SigninRoute = require('../../admin/server/routes/signin');

function makeKeystone (passwordAuthEnabled) {
	var options = {
		'admin path': 'keystone',
		'brand': 'Test app',
		'password auth enabled': passwordAuthEnabled,
		'user model': 'User',
	};
	return {
		get: function (key) { return options[key]; },
		list: function () { return { getDocumentName: function () { return 'Test User'; } }; },
		security: { csrf: { CSRF_HEADER_KEY: 'x-csrf-token', getToken: function () { return 'csrf'; } } },
		wrapHTMLError: function (title, message) { return title + message; },
	};
}

describe('SigninRoute', function () {
	it('redirects to Google sign-in unless password auth is enabled', function () {
		var redirect = sinon.spy();
		SigninRoute({ keystone: makeKeystone(false) }, { redirect: redirect });
		assert(redirect.calledOnce);
		assert.strictEqual(redirect.firstCall.args[0], '/signin');
	});

	it('renders Keystone password sign-in when password auth is enabled', function (done) {
		var send = sinon.spy();
		var render = sinon.stub(ejs, 'renderFile').callsArgWith(3, null, 'password sign-in page');
		SigninRoute({ keystone: makeKeystone(true) }, { send: send });
		assert(render.calledOnce);
		assert(send.calledOnce);
		assert.strictEqual(send.firstCall.args[0], 'password sign-in page');
		render.restore();
		done();
	});
});
