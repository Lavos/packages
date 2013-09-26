define([
	'jquery', 'underscore', 'doubleunderscore/core',
	'util', 'message',
	'text!./photo_uploader.jst', 'text!./queue_item_template.jst', 'css!./photo_uploader.css'
],
function($, _, __, util, Message, template, queue_item_template){
	var qi_template = __.template(queue_item_template);
	var comptemplate = __.template(template);

	var PhotoUploader = function PhotoUploader (params) {
		var self = this;

		var defaults = {
			url: '/api/photo/upload',
			target: $(),
			upload_count: 1
		};

		_.extend(self.options = {}, defaults, params);

		self.$element = $(comptemplate(self.options)).appendTo(self.options.target);
		self.$file = self.$element.find('input[name=file]');
		self.$total_count = self.$element.find('.total_count');
		self.$total_size = self.$element.find('.total_size');
		self.$queue_list = self.$element.find('table.queue_list');
		self.$upload_button = self.$element.find('.photo_uploader_upload');
		self.$progress = self.$element.find('.progress');
		self.$bar = self.$element.find('.bar');

		self.setAbility(false);
		self.queue = [];
		self.wasError = false;

		self.$file.on('change', function(){
			// append queue with selected files
			var new_files = _.toArray(self.$file[0].files);
			var new_queue = self.queue.concat(new_files);
			new_queue.splice(0, new_queue.length - self.options.upload_count);
			self.queue = new_queue;
			self.renderQueue();

			self.determineAbility();
		});

		self.$upload_button.on('click', function(e){
			e.preventDefault();

			if (self.ability) {
				self.send();
			};
		});

		self.$element.on('click', '.queue_item [data-actions="remove"]', function(e){
			e.preventDefault();

			if (self.ability) {
				var index = $(this).data('index');

				self.queue.splice(index, 1);
				self.renderQueue();
				self.determineAbility();
			};
		});

		self.$element.on('click', '.photo_uploader_remove_all', function(e){
			e.preventDefault();

			if (self.ability) {
				self.reset();
			};
		});
	};

	__.augment(PhotoUploader, __.PubSubPattern);

	PhotoUploader.prototype.determineAbility = function determineAbility () {
		var self = this;

		if (self.queue.length > 0) {
			self.setAbility(true);
		} else {
			self.setAbility(false);
		};
	};

	PhotoUploader.prototype.setAbility = function setAbility (ability) {
		var self = this;

		self.ability = ability;
		if (self.ability) {
			self.$upload_button.prop('disabled', false);
		} else {
			self.$upload_button.prop('disabled', true);
		};
	};

	PhotoUploader.prototype.renderQueue = function renderQueue () {
		var self = this;

		var working = [], size_sum = 0;
		var counter = 0, limit = self.queue.length;
		while (counter < limit) {
			var current = self.queue[counter];

			size_sum += current.size;
			working.push(qi_template({ item: current, index: counter, size: __.hrFilesize(current.size) }));
			counter++;
		};

		self.$total_count.text(limit);
		self.$total_size.text(__.hrFilesize(size_sum));
		self.$queue_list.find('tbody').html(working.join(''));
	};

	PhotoUploader.prototype.progress = function progress (percentage) {
		var self = this;

		self.$bar.width(percentage + '%');
	};

	PhotoUploader.prototype.success = function success () {
		var self = this;

		self.$progress.removeClass('progress-info').addClass('progress-success');

		window.setTimeout(function(){
			self.progress(0);
			self.$progress.removeClass('progress-success').addClass('progress-info');
		}, 5000);

		if (self.wasError && self.options.upload_count > 1) {
			new Message({ type: 'warning', title: 'Photo Uploader', message: 'Photo queue completed, but one or more files were not able to be uploaded.' });
		} else if (self.options.upload_count > 1) {
			new Message({ type: 'success', title: 'Photo Uploader', message: 'Photo queue completed successfully.' });
		} else if (!self.wasError) {
			new Message({ type: 'success', title: 'Photo Uploader', message: 'Photo uploaded successfully.' });
		};
	};

	PhotoUploader.prototype.send = function send () {
		var self = this;

		if (!self.ability) {
			return false;
		};

		self.setAbility(false);
		var queue_manager = new __.Queue();
		var results = [];

		queue_manager.on('end', function(){
			self.fire('upload', results);
			self.reset();
		});

		queue_manager.on('step', function(){
			self.progress(((this.pos / (self.queue.length-1))*100));
		});

		queue_manager.on('end', function(){
			self.success();
		});

		var counter = 0, limit = self.queue.length;
		while (counter < limit) {
			queue_manager.add(function(cnter){
				self.doXHR(queue_manager, self.queue[cnter], cnter, results);
			}, counter);

			counter++;
		};

		queue_manager.step();
	};

	PhotoUploader.prototype.doXHR = function doXHR (queue_manager, file, index, results) {
		var self = this;

		var xhr = new XMLHttpRequest();
		var fd = new FormData();
		var creds = { '_user_token': LUCID.user_token, '_access_key': LUCID.access_key, '_timestamp': Math.floor(+new Date()/1000) };
		var url = self.options.url + __.toQueryParams(creds);
		var timer = null;

		xhr.open('POST', url, true);
		xhr.onreadystatechange = function() {
			if (xhr.readyState === 4) {
				if (timer) {
					clearTimeout(timer);
				};

				switch (xhr.status) {
				case 200:
					var data = null;

					try { data = JSON.parse(xhr.responseText); }
					catch (e) {
						new Message({ type: 'error', title: 'Photo Uploader', message: 'The server responded in a format that could not be understood. Please contact the administrators.' });
						self.fire('error', 'Could not parse response as JSON.');
						self.wasError = true;
					};

					results[index] = __.path(data, 'items', null);
					queue_manager.step();
				break;

				default:
					new Message({ type: 'error', title: 'Photo Uploader', message: __.sprintf('<em>%s</em> failed to upload. Please check the file and try again.', file.name) });
					results[index] = null;
					self.wasError = true;
					queue_manager.step();
				break;
				};
			};
		};

		fd.append('photo', file);
		xhr.send(fd);
		timer = setTimeout(function(){
			xhr.abort();
		}, 20000);
	};

	PhotoUploader.prototype.reset = function reset () {
		var self = this;

		self.$file.val('');

		self.queue = [];
		self.renderQueue();
		self.determineAbility();
	};

	return PhotoUploader;
});
