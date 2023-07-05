const _ = require('lodash');
const keystone = require('keystone');
const passport = require('passport');
const passportGoogleStrategy = require('passport-google-oauth').OAuth2Strategy;
const { google } = require('googleapis');
const path = require('path');

const { signinWithUser } = require('../../../lib/session');

function makeid (length) {
	let result = '';
	const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	const charactersLength = characters.length;
	let counter = 0;
	while (counter < length) {
		result += characters.charAt(Math.floor(Math.random() * charactersLength));
		counter += 1;
	}
	return result;
}

passport.serializeUser((user, done) => {
	done(null, user);
});

exports.authenticateUser = function (req, res, next) {
	const credentials = {
		clientID: process.env.GOOGLE_CLIENT_ID,
		clientSecret: process.env.GOOGLE_CLIENT_SECRET,
		callbackURL: `${keystone.get('app origin')}/signin`,
		scope: 'profile email',
	};

	// Begin process
	console.log('============================================================');
	console.log('[services.google] - Triggered authentication process...');
	console.log('------------------------------------------------------------');

	// Initialize Google credentials
	const googleStrategy = new passportGoogleStrategy(credentials, function (accessToken, refreshToken, profile, done) {
		done(null, {
			accessToken: accessToken,
			refreshToken: refreshToken,
			profile: profile,
		});
	});

	// Pass through authentication to passport
	passport.use(googleStrategy);

	// Save user data once returning from Google
	if (_.has(req.query, 'code')) {
		console.log('[services.google] - Callback workflow detected, attempting to process data...');
		console.log('------------------------------------------------------------');

		passport.authenticate('google', { session: false }, function (err, data, info) {
			if (err || !data) {
				console.log(`[services.google] - Error retrieving Google account data - ${JSON.stringify(err)}`);
				return res.status(500).send(keystone.wrapHTMLError('Error Accessing google account data', err.message));
			}

			console.log('[services.google] - Successfully retrieved Google account data, processing...');
			console.log('------------------------------------------------------------');

			const auth = {
				type: 'google',

				name: {
					first: data.profile.name.givenName,
					last: data.profile.name.familyName,
				},

				email: data.profile.emails.length ? _.first(data.profile.emails).value : null,

				website: data.profile._json.blog,

				profileId: data.profile.id,

				username: data.profile.username,
				avatar: data.profile._json.picture,

				accessToken: data.accessToken,
				refreshToken: data.refreshToken,
			};

			req.session.auth = auth;

			readGroupMembers().then((members) => {
				const User = keystone.list('User');
				if (members && members.includes(auth.email)) {
					console.log('[auth.confirm] - Found existing user via email address...');
					console.log('------------------------------------------------------------');
					User.model.findOne({ email: auth.email }, (err, user) => {
						if (!user) {
							User.model.create({ email: auth.email, password: makeid(15), name: auth.name, isAdmin: true }, (err, user) => {
								return signinWithUser(user, req, res, () => {
									return res.redirect('/keystone');
								});
							});
						} else {
							return signinWithUser(user, req, res, () => {
								return res.redirect('/keystone');
							});
						}
					});

				} else {
					console.log('[auth.confirm] - Error finding existing user via email.', err);
					console.log('------------------------------------------------------------');
					return res.status(400).send(keystone.wrapHTMLError('Error finding existing user via email, access denied', err.message));
				}
			});
		})(req, res, next);

	// Perform initial authentication request to Google
	} else {
		console.log('[services.google] - Authentication workflow detected, attempting to request access...');
		console.log('------------------------------------------------------------');

		passport.authenticate('google', { accessType: 'offline' })(req, res, next); // approvalPrompt: 'force'
	}
};


const readGroupMembers = async function () {
	const currentPath = process.cwd();
	const auth = new google.auth.GoogleAuth({
		keyFile: path.join(currentPath, keystone.get('google sso key path')),
		scopes: ['https://www.googleapis.com/auth/admin.directory.group.readonly'],
	});

	const admin = google.admin({
		version: 'directory_v1',
		auth: auth,
	});

	const usersRequest = admin.members.list({
		groupKey: keystone.get('google sso group id'),
	});

	const adminsRequest = admin.members.list({
		groupKey: keystone.get('google sso admin group id'),
	});

	const [users, admins] = await Promise.all([usersRequest, adminsRequest]);

	return users.data.members && admins.data.members && users.data.members.concat(admins.data.members).map(m => m.email);
};

