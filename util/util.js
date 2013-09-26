// utility functions
define(['jquery', 'underscore', 'doubleunderscore/core'], function($, _, __){
	var util = {};

	util.identify = function identify (id) {
		if (__.getType(id) !== 'string') { return null; };

		var target_offset = id.substr(-2, 2), type;
		_.each(LUCID.schema, function(value, key, dict){
			if (value.offset === target_offset) {
				type = key;
			};
		});

		return type;
	};

	util.imagid_path = function imagid (profile, path) {
		return __.sprintf("%s%s/-%s", LUCID.Imagid.url, profile, path);
	};

	util.crop_path = function imagid (profile, path) {
		return __.sprintf("%s%s/-%s", LUCID.Imagid.crop_url, profile, path);
	};

	util.getYoutubeID = (function(){
		var share_id_regex = /^.*(?:youtu\.be\/)([^#\&\?]*).*/;

		return function (share_url) {
			return share_id_regex.exec(share_url)[1];
		};
	})();

	util.smartSerialize = (function(){
		// currently does not support radio or multiple selects

		var number_regex = /^(\d)$/;

		return function smartSerialize ($element) {
			var working = {};

			$element.find('textarea:not([data-no-serialize], input:not([data-no-serialize]), select:not([data-no-serialize])').each(function(index){
				var $this = $(this);
				var name = $this.attr('name');
				var value = $this.val();

				if ($this.is('[data-boolean]')) {
					if ($this.is('input:checkbox:checked')) {
						return working[name] = true;
					};

					if ($this.is('input:checkbox:not(:checked)')) {
						return working[name] = false;
					};

					return working[name] = value;
				};

				if (number_regex.test(value)) {
					return working[name] = parseInt(value, 10);
				};

				return working[name] = value || '';
			});

			return working;
		};
	})();

	util.hitAPI = (function(){
		var default_params = {
			verb: 'GET',
			context: '', // id or collection type
			data: {},
			where: null,
			sort: null,
			offset: 0,
			limit: 30,
			direction_asc: true,
			expand: [],
			success: function(items, total){},
			error: function(message, error_map){}
		};

		return function hitAPI (params) {
			var options = {};
			var get_params = {};

			_.extend(options, default_params, params);

			var control = {};
			if (options.expand.length) {
				control['_expand'] = JSON.stringify(options.expand);
			};

			var data_rep = {};
			if (options.verb === 'GET') {
				data_rep['_offset'] = options.offset;
				data_rep['_limit'] = options.limit;

				if (options.where !== null) {
					data_rep['_where'] = JSON.stringify(options.where);
				};

				if (options.sort !== null) {
					data_rep['_sort'] = JSON.stringify([__.sprintf('%s%s', (options.direction_asc ? '' : '-'), options.sort)]);
				};
			};

			_.extend(get_params, data_rep, (options.verb === 'GET' ? options.data : {}), control, { '_user_token': LUCID.user_token, '_access_key': LUCID.access_key, _timestamp: Math.floor(+new Date()/1000) });

			return $.ajax({
				cache: true,
				type: options.verb,
				url: __.sprintf('/api/%s%s', (options.context ? options.context + '/' : ''), __.toQueryParams(get_params)),
				async: true,
				dataType: 'json',
				data: (options.verb === 'POST' ? 'json=' + encodeURIComponent(JSON.stringify(options.data)) : ''),
				complete: function (jqXHR, textStatus) {
					try { var data = JSON.parse(jqXHR.responseText); } catch (e) { var data = {}; };

					switch (textStatus) {

					case 'success':
					case 'notmodified':
						options.success.call(this, __.path(data, 'items', []), __.path(data, 'total', 0));
					break;

					case 'error':
						switch (jqXHR.status) {

						case 404:
							options.error.call(this, 'The API location you are attempting to access can not be found.', {});
						break;

						case 405:
							options.error.call(this, 'The server will not respond to that request the way it was formed.', {});
						break;

						case 412:
							options.error.call(this, 'The data supplied did not validate.', __.path(data, 'error', {}));
						break;

						default:
						case 500:
							options.error.call(this, __.path(data, 'message', 'The call was unsuccessful, but no error message was returned.'), {});
						break;

						};
					break;

					case 'timeout':
						options.error.call(this, 'The connection to the server has timed out.', {});
					break;

					case 'abort':
						options.error.call(this, 'The connection to the server was aborted.', {});
					break;

					case 'parsererror':
						options.error.call(this, 'Response was not in JSON format.', {});
					break;

					default:
						options.error.call(this, 'The server did not respond within a defined status.', {});
					break;

					};
				}
			});
		};
	})();

	return util;
});
