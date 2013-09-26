define(['underscore', 'doubleunderscore/core'], function(_, __){
	var XHRUpload = function XHRUpload (params) {
		var self = this;

		_.defaults(self.options = {}, params, self.defaults);
		self.xhr = null;
	};

	__.augment(XHRUpload, __.PubSubPattern);

	XHRUpload.prototype.defaults = {
		url: '',
		key: '',
		timeout: true,
		timeout_duration: 20000
	};

	XHRUpload.prototype.send = function send (file) {
		var self = this;

		self.xhr = new XMLHttpRequest();
		var fd = new FormData();
		var creds = { '_user_token': LUCID.user_token, '_access_key': LUCID.access_key, '_timestamp': Math.floor(+new Date()/1000) };
		var url = self.options.url + __.toQueryParams(creds);
		var timer = null;

		self.xhr.open('POST', url, true);
		self.xhr.onreadystatechange = function(){
			if (self.xhr.readyState === 4) {
				if (timer) {
					clearTimeout(timer);
				};

				switch (self.xhr.status) {
				case 200:
					var data = null;

					try { data = JSON.parse(self.xhr.responseText); }
					catch (e) {
						return self.fire('error', 'Could not parse response as JSON.');
					};

					self.fire('success', data);
				break;

				default:
					self.fire('error', 'Did not receive a success response from the server.');
				break;
				};
			};
		};

		fd.append(self.options.key, file);
		self.fire('before_send', fd);
		self.xhr.send(fd);
		self.fire('send', fd);

		if (self.options.timeout) {
			timer = setTimeout(function(){
				self.xhr.abort();
				self.fire('timeout');
				self.fire('error', 'Timeout duration reached.');
			}, self.options.timeout_duration);
		};
	};

	XHRUpload.prototype.abort = function abort (error) {
		var self = this;

		if (self.xhr) {
			self.xhr.abort();
			self.fire('abort');

			if (error) {
				self.fire('error', 'Transfer aborted.');
			};
		};
	};

	return XHRUpload;
});
