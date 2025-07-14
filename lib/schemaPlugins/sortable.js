module.exports = function sortable () {

	var list = this;

	this.add({
		sortOrder: { type: Number, index: true, hidden: true },
	});

	this.schema.pre('save', function (next) {

		if (typeof this.sortOrder === 'number') {
			return next();
		}

		var item = this;

		var addLast = function (done) {
			list.model.findOne().sort('-sortOrder').exec().then((max) => { // eslint-disable-line no-unused-vars, handle-callback-err
				item.sortOrder = (max && max.sortOrder) ? max.sortOrder + 1 : 1;
				done();
			}).catch(done);
		};

		if (list.get('sortable') === 'unshift') {
			list.model.where('sortOrder')
				.updateMany(
					{ $inc: { sortOrder: 1 } }
				).then(
					() => {
						item.sortOrder = 1;
						next();
					}
				).catch(err => {
					console.log('err', err);
					return addLast(next);
				});
		} else {
			addLast(next);
		}
	});

	this.schema.statics.reorderItems = function reorderItems (id, prevOrder, newOrder, cb) {

		prevOrder = parseFloat(prevOrder);
		newOrder = parseFloat(newOrder);

		var whichWay = (newOrder > prevOrder) ? -1 : 1;
		var gte = (newOrder > prevOrder) ? prevOrder + 1 : newOrder;
		var lte = (newOrder > prevOrder) ? newOrder : prevOrder - 1;
		return list.model
			.where('sortOrder')
			.gte(gte)
			.lte(lte)
			.updateMany({ $inc: { sortOrder: whichWay } }).then(() => {
				list.model.findOneAndUpdate({ _id: id }, { sortOrder: newOrder }).exec().then(data => cb(null, data)).catch(cb);
			}).catch((err) => console.log('err', err));
	};

};
