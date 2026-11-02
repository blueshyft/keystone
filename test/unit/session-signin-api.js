var assert = require('assert');
var sinon = require('sinon');
var signin = require('../../admin/server/api/session/signin');

describe('session signin API', function () {
	it('rejects password signin when password auth is disabled', function () {
		var keystone = {
			get: sinon.stub().withArgs('password auth enabled').returns(false),
			security: { csrf: { validate: sinon.stub().returns(false) } },
			list: sinon.spy(),
		};
		var status;
		var body;
		var res = {
			status: function (code) {
				status = code;
				return this;
			},
			json: function (responseBody) {
				body = responseBody;
				return this;
			},
		};

		signin({
			keystone: keystone,
			body: { email: 'test@example.invalid', password: 'not-a-real-password' },
		}, res);

		assert.strictEqual(status, 403);
		assert.deepStrictEqual(body, { error: 'password auth disabled' });
		sinon.assert.notCalled(keystone.security.csrf.validate);
		sinon.assert.notCalled(keystone.list);
	});
});
