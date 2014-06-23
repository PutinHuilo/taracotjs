module.exports = function (app) {
	// Sort order hash
	var sort_cells = {
		oname: 1,
		ovalue: 1,
		lang: 1
	};
	var sort_cell_default = 'oname';
	var sort_cell_default_mode = 1;
	// Set items per page for this module
	var items_per_page = 5;
	// 
	var router = app.get('express').Router();
	var ObjectId = require('mongodb').ObjectID;
	var i18nm = new(require('i18n-2'))({
		locales: app.get('config').locales,
		directory: app.get('path').join(__dirname, 'lang'),
		extension: '.js'
	});
	router.get_module_name = function (req) {
		i18nm.setLocale(req.i18n.getLocale());
		return i18nm.__("module_name");
	};
	router.get('/', function (req, res) {
		i18nm.setLocale(req.i18n.getLocale());
		if (!req.session.auth || req.session.auth.status < 2) {
			req.session.auth_redirect = '/cp/pages';
			res.redirect(303, "/auth?rnd=" + Math.random().toString().replace('.', ''));
			return;
		}

		var data = app.get('mongodb').collection('pages_folders').find({
			oname: 'folders_json'
		}, {
			limit: 1
		}).toArray(function (err, items) {			
			var folders;
			if (!items || !items.length || !items[0].ovalue) {
				folders = '[{"id":"j1_1","text":"/","data":null,"parent":"#","type":"root"}]';
			} else {
				folders = items[0].ovalue;
			}
			var body = app.get('renderer').render_file(app.get('path').join(__dirname, 'views'), 'pages_control', {
				lang: i18nm,
				folders: folders,
				locales: JSON.stringify(app.get('config').locales)
			});
			app.get('cp').render(req, res, {
				body: body,
				css: '<link rel="stylesheet" href="/modules/pages/css/main.css">' + "\n\t\t" + '<link rel="stylesheet" href="/js/jstree/theme/style.min.css">' + "\n\t\t"
			}, i18nm, 'pages', req.session.auth);
		});		
	});

	router.post('/data/list', function (req, res) {
		i18nm.setLocale(req.i18n.getLocale());
		var rep = {
			ipp: items_per_page
		};
		var skip = req.body.skip;
		var query = req.body.query;
		var sort_mode = req.body.sort_mode;
		var sort_cell = req.body.sort_cell;
		if (typeof skip != 'undefined') {
			if (!skip.match(/^[0-9]{1,10}$/)) {
				rep.status = 0;
				rep.error = i18nm.__("invalid_query");
				res.send(JSON.stringify(rep));
				return;
			}
		}
		if (typeof query != 'undefined') {
			if (!query.match(/^[\w\sА-Яа-я0-9_\-\.]{3,40}$/)) {
				rep.status = 0;
				rep.error = i18nm.__("invalid_query");
				res.send(JSON.stringify(rep));
				return;
			}
		}
		// Check authorization
		if (!req.session.auth || req.session.auth.status < 2) {
			rep.status = 0;
			rep.error = i18nm.__("unauth");
			res.send(JSON.stringify(rep));
			return;
		}
		var sort = {};
		sort[sort_cell_default] = sort_cell_default_mode;
		if (typeof sort_cell != 'undefined') {
			if (typeof sort_cells[sort_cell] != 'undefined') {
				sort = {};
				sort[sort_cell] = 1;
				if (typeof sort_mode != 'undefined' && sort_mode == -1) {
					sort[sort_cell] = -1;
				}
			}
		}
		// Get pages from MongoDB
		rep.items = [];
		var find_query = {};
		if (query) {
			find_query = {
				$or: [{
					oname: new RegExp(query, 'i')
				}, {
					ovalue: new RegExp(query, 'i')
				}]
			};
		}
		var data = app.get('mongodb').collection('pages').find(find_query).count(function (err, items_count) {
			if (!err && items_count > 0) {
				rep.total = items_count;
				var data = app.get('mongodb').collection('pages').find(find_query, {
					skip: skip,
					limit: items_per_page
				}).sort(sort).toArray(function (err, items) {
					if (typeof items != 'undefined' && !err) {
						// Generate array
						for (var i = 0; i < items.length; i++) {
							var arr = [];
							arr.push(items[i]._id);
							arr.push(items[i].oname);
							arr.push(items[i].ovalue);
							arr.push(items[i].olang);
							rep.items.push(arr);
						}
					}
					// Return results
					rep.status = 1;
					res.send(JSON.stringify(rep));
				}); // data
			} else { // Error or count = 0
				rep.status = 1;
				rep.total = '0';
				res.send(JSON.stringify(rep));
			}
		}); // count
	});
	router.post('/data/load', function (req, res) {
		i18nm.setLocale(req.i18n.getLocale());
		var rep = {};
		var user_id = req.body.id;
		if (typeof user_id == 'undefined' || !user_id.match(/^[a-f0-9]{24}$/)) {
			rep.status = 0;
			rep.error = i18nm.__("invalid_query");
			res.send(JSON.stringify(rep));
			return;
		}
		// Check authorization
		if (!req.session.auth || req.session.auth.status < 2) {
			rep.status = 0;
			rep.error = i18nm.__("unauth");
			res.send(JSON.stringify(rep));
			return;
		}
		// Get pages from MongoDB
		rep.data = {};
		var data = app.get('mongodb').collection('pages').find({
			_id: new ObjectId(user_id)
		}, {
			limit: 1
		}).toArray(function (err, items) {
			if (typeof items != 'undefined' && !err) {
				if (items.length > 0) {
					rep.data = items[0];
				}
			}
			// Return results
			rep.status = 1;
			res.send(JSON.stringify(rep));
		});
	});
	router.post('/data/save', function (req, res) {
		i18nm.setLocale(req.i18n.getLocale());
		var rep = {
			err_fields: [],
			status: 1
		};
		// Check authorization
		if (!req.session.auth || req.session.auth.status < 2) {
			rep.status = 0;
			rep.error = i18nm.__("unauth");
			res.send(JSON.stringify(rep));
			return;
		}
		var oname = req.body.oname,
			ovalue = req.body.ovalue,
			olang = req.body.olang,
			id = req.body.id;
		if (typeof id != 'undefined' && id.length == 24) {
			if (!id.match(/^[a-f0-9]{24}$/)) {
				rep.status = 0;
				rep.error = i18nm.__("invalid_query");
				res.send(JSON.stringify(rep));
				return;
			}
		}
		if (!oname.match(/^[A-Za-z0-9_\-]{3,20}$/)) {
			rep.status = 0;
			rep.err_fields.push('oname');
		}
		oname = oname.toLowerCase();
		if (!ovalue.match(/^.{1,255}$/)) {
			rep.status = 0;
			rep.err_fields.push('ovalue');
		}
		var _olang = '';
		for (var i = 0; i < app.get('config').locales.length; i++) {
			if (olang == app.get('config').locales[i]) {
				_olang = app.get('config').locales[i];
			}
		}
		olang = _olang;
		if (rep.status == 0) {
			res.send(JSON.stringify(rep));
			return;
		}
		if (id) {
			var data = app.get('mongodb').collection('pages').find({
				oname: oname,
				olang: olang,
				_id: {
					$ne: new ObjectId(id)
				}
			}, {
				limit: 1
			}).toArray(function (err, items) {
				if ((typeof items != 'undefined' && items.length > 0) || err) {
					rep.status = 0;
					rep.error = i18nm.__("option_exists");
					rep.err_fields.push('oname');
					res.send(JSON.stringify(rep));
					return;
				}
				var data = app.get('mongodb').collection('pages').find({
					_id: new ObjectId(id)
				}, {
					limit: 1
				}).toArray(function (err, items) {
					if (typeof items != 'undefined' && !err) {
						if (items.length > 0) {
							var update = {
								oname: oname,
								ovalue: ovalue,
								olang: olang
							};
							app.get('mongodb').collection('pages').update({
								_id: new ObjectId(id)
							}, update, function () {
								rep.status = 1;
								res.send(JSON.stringify(rep));
							});
							return;
						}
					} else {
						rep.status = 0;
						rep.error = i18nm.__("id_not_found");
						res.send(JSON.stringify(rep));
					}
				});
			});
		} else {
			var data = app.get('mongodb').collection('pages').find({
				oname: oname,
				olang: olang
			}, {
				limit: 1
			}).toArray(function (err, items) {
				if ((typeof items != 'undefined' && items.length > 0) || err) {
					rep.status = 0;
					rep.error = i18nm.__("option_exists");
					rep.err_fields.push('oname');
					res.send(JSON.stringify(rep));
					return;
				}
				app.get('mongodb').collection('pages').insert({
					oname: oname,
					ovalue: ovalue,
					olang: olang
				}, function () {
					rep.status = 1;
					res.send(JSON.stringify(rep));
				});
			});
		}
	});
	router.post('/data/delete', function (req, res) {
		i18nm.setLocale(req.i18n.getLocale());
		var rep = {
			status: 1
		};
		// Check authorization
		if (!req.session.auth || req.session.auth.status < 2) {
			rep.status = 0;
			rep.error = i18nm.__("unauth");
			res.send(JSON.stringify(rep));
			return;
		}
		var ids = req.body.ids;
		if (typeof ids != 'object' || ids.length < 1) {
			rep.status = 0;
			rep.error = i18nm.__("invalid_query");
			res.send(JSON.stringify(rep));
			return;
		}
		for (var i = 0; i < ids.length; i++) {
			if (ids[i].match(/^[a-f0-9]{24}$/)) {
				app.get('mongodb').collection('pages').remove({
					_id: new ObjectId(ids[i])
				}, function () {});
			}
		}
		res.send(JSON.stringify(rep));
	});
	router.post('/data/folders/load', function (req, res) {
		i18nm.setLocale(req.i18n.getLocale());
		var rep = {
			status: 1
		};
		// Check authorization
		if (!req.session.auth || req.session.auth.status < 2) {
			rep.status = 0;
			rep.error = i18nm.__("unauth");
			res.send(JSON.stringify(rep));
			return;
		}
		var data = app.get('mongodb').collection('pages_folders').find({
			oname: 'folders_json'
		}, {
			limit: 1
		}).toArray(function (err, items) {
			if (err) {
				rep.status = 0;
				rep.error = i18nm.__("cannot_load_db_data");
				res.send(JSON.stringify(rep));
				return;	
			}
			if (!items || !items.length || !items[0].ovalue) {
				rep.folders = '[{"id":"j1_1","text":"/","data":null,"parent":"#","type":"root"}]';
			    res.send(JSON.stringify(rep));	
			    return;
			}
			rep.folders = items[0].ovalue;
			res.send(JSON.stringify(rep));
		});
	});
	router.post('/data/folders/save', function (req, res) {
		i18nm.setLocale(req.i18n.getLocale());
		var rep = {
			status: 1
		};
		// Check authorization
		if (!req.session.auth || req.session.auth.status < 2) {
			rep.status = 0;
			rep.error = i18nm.__("unauth");
			res.send(JSON.stringify(rep));
			return;
		}
		var json = req.body.json;
		try {
			JSON.parse(json);
		} catch (e) {
			rep.status = 0;
			rep.error = i18nm.__("cannot_parse_json");
			res.send(JSON.stringify(rep));
			return;	
		}

		var data = app.get('mongodb').collection('pages_folders').find({
			oname: 'folders_json'
		}, {
			limit: 1
		}).toArray(function (err, items) {
			if (!err && typeof items != 'undefined' && items.length > 0) {
				// Update
				app.get('mongodb').collection('pages_folders').update({
					oname: 'folders_json'},
				{
					oname: 'folders_json',
					ovalue: json	
				}, 
					function (err) {
						if (err) {
							rep.status = 0;
							rep.error = i18nm.__("cannot_save_db_data");
							res.send(JSON.stringify(rep));
							return;	
						}
						res.send(JSON.stringify(rep));
				});
			} else {
				// Insert
				app.get('mongodb').collection('pages_folders').insert({
					oname: 'folders_json',
					ovalue: json
				}, function (err) {
					if (err) {
						rep.status = 0;
						rep.error = i18nm.__("cannot_save_db_data");
						res.send(JSON.stringify(rep));
						return;	
					}
					res.send(JSON.stringify(rep));
				});
			}
		});
	});	
	return router;
}