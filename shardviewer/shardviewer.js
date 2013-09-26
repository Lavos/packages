define([
	'jquery', 'underscore', 'doubleunderscore/core',
	'util',
	'text!./shardviewer.jst',
	'css!./shardviewer.css'
],
function($, _, __, util, main_template_string){
	var main_template = __.template(main_template_string);

	var ShardViewer = function ShardViewer (params) {
		var self = this;

		var defaults = {
			target: $(),
			table_template_string: '',
			row_template_string: '',
			limit: 30,
			schema: null,
		};

		_.extend(self.options = {}, defaults, params);

		self.$target = self.options.target;
		self.$element = $(main_template({ table: self.options.table_template_string }));
		self.$target.append(self.$element);

		// determine object properties that are sortable from the table
		self.$row_target = self.$element.find('.shardviewer_row_target');

		// sorting columns
		self.$columns = self.$element.find('col');

		// pagination
		self.$backers = self.$element.find('[data-shardviewer-direction="back"]');
		self.$forwarders = self.$element.find('[data-shardviewer-direction="forward"]');
		self.$jumper = self.$element.find('.shardviewer_jumper');

		self.offset = 0;
		self.total = 0;
		self.filter = null;
		self.sort_property = null;
		self.sort_asc = true;
		self.lock = false;

		self.row_template = __.template(self.options.row_template_string);

		if (self.options.schema !== null) {
			self.$element.find('.shardviewer_filter_master').removeClass('hide');
			self.$filter_input = self.$element.find('[name="filter"]');

			self.fields = [];
			__.each(self.options.schema, function(value, key, dict){
				if (value.type === 'shorttext') {
					self.fields.push(key);
				};
			});

			self.$element.on('submit', function(e){
				e.preventDefault();

				var value = self.$filter_input.val();

				if (value.length) {
					var regex_obj = {
						'$regex': value,
						'$options': 'i'
					};

					var ors = [];
					var counter = self.fields.length;
					while (counter--) {
						var obj = {};
						obj[self.fields[counter]] = regex_obj;
						ors.push(obj);
					};

					self.filter = { '$or': ors };
				} else {
					self.filter = null;
				};

				self.reset();
			});

			self.$element.on('click', '[data-shardviewer-filter-action="clear"]', function(e){
				e.preventDefault();

				self.$filter_input.val('');
				self.filter = null;
				self.reset();
			});
		};

		self.$element.on('click', '[data-shardviewer-sort-property]', function(e){
			var $this = $(this);

			self.setOffset(0);

			if (self.sort_property === $this.data('shardviewer-sort-property')) {
				self.sort_asc = !self.sort_asc;
			} else {
				self.sort_property = $this.data('shardviewer-sort-property');
				self.sort_asc = true;
			};

			if (self.sort_asc) {
				self.$element.addClass('shardviewer_sort_asc');
			} else {
				self.$element.removeClass('shardviewer_sort_asc');
			};

			self.$element.find('th[data-shardviewer-sort-property]').removeClass('shardviewer_current_sort');
			$this.addClass('shardviewer_current_sort');
			self.fire('request_shard');
		});

		self.$element.on('click', '[data-shardviewer-movement]', function(e){
			var $this = $(this);

			switch ($this.data('shardviewer-movement')) {
			case 'first':
				self.setOffset(0);
				self.fire('request_shard');
			break;

			case 'previous':
				self.setOffset(self.offset - self.options.limit);
				self.fire('request_shard');
			break;

			case 'next':
				self.setOffset(self.offset + self.options.limit);
				self.fire('request_shard');
			break;

			case 'last':
				var total_pages = Math.ceil(self.total / self.options.limit);
				self.setOffset((total_pages-1) * self.options.limit);
				self.fire('request_shard');
			break;

			};
		});

		self.$jumper.on('keypress', function(e){
			if (e.which === 13) {
				e.preventDefault();

				var total_pages = Math.ceil(self.total / self.options.limit);
				var value = self.$jumper.val();

				if (self.jumper_regex.test(value)) {
					var desired_page = parseInt(self.$jumper.val(), 10);

					if (desired_page <= total_pages) {
						self.setOffset((desired_page-1) * self.options.limit);
						self.fire('request_shard');
					};
				};

				self.$jumper.val('');
			};
		});

		self.$jumper.on('blur', function(e){
			self.$jumper.val('');
		});


		self.determinePagination();
	};

	__.augment(ShardViewer, __.PubSubPattern);
	ShardViewer.prototype.global_name = 'shardviewer';
	ShardViewer.prototype.jumper_regex = /^(\d+)$/;

	ShardViewer.prototype.setLock = function setLock (lock) {
		var self = this;

		self.lock = lock;
		self.fire('lock', self.lock);

		if (self.lock) {
			self.$element.find('input, button, a.btn').prop('disabled', true);
		} else {
			self.$element.find('input, button, a.btn').prop('disabled', false);
		};
	};

	ShardViewer.prototype.setMode = function setMode (mode) {
		var self = this;

		self.$element.removeClass('empty display').addClass(mode);
	};

	ShardViewer.prototype.determinePagination = function determinePagination () {
		var self = this;

		var total_pages = Math.ceil(self.total / self.options.limit);
		var current_page_index = Math.floor(self.offset / self.options.limit);

		if (current_page_index === 0) {
			self.$backers.prop('disabled', true);

			if (total_pages > 1) {
				self.$forwarders.prop('disabled', false);
				self.$jumper.prop('disabled', false);
			} else {
				self.$forwarders.prop('disabled', true);
				self.$jumper.prop('disabled', true);
			};
		} else if (current_page_index === total_pages-1) {
			self.$backers.prop('disabled', false);
			self.$forwarders.prop('disabled', true);
			self.$jumper.prop('disabled', false);
		} else {
			self.$backers.prop('disabled', false);
			self.$forwarders.prop('disabled', false);
			self.$jumper.prop('disabled', false);
		};

		self.$jumper.prop('placeholder', __.sprintf('%s of %s', current_page_index+1, total_pages));
	};

	ShardViewer.prototype.reset = function reset () {
		var self = this;

		self.setOffset(0);
		self.$element.find('th[data-shardviewer-sort-property]').removeClass('shardviewer_current_sort');
		self.sort_property = null;
		self.sort_asc = true;
		self.fire('request_shard');
	};

	ShardViewer.prototype.setOffset = function setOffset (offset) {
		var self = this;

		offset = Math.max(offset, 0);
		offset = Math.min(self.total, offset);
		self.offset = offset;
		self.setLock(true);
	};

	ShardViewer.prototype.display = function (items) {
		var self = this;

		var working = [];

		var counter = 0, limit = items.length;
		while (counter < limit) {
			working.push(self.row_template(items[counter], { shardviewer: self, index: counter, __: __, util: util }));
			counter++;
		};

		self.$columns.removeClass('shardviewer_current_sort');
		self.$columns.filter('[data-shardviewer-sort-property="' + self.sort_property + '"]').addClass('shardviewer_current_sort');

		self.setLock(false);
		self.determinePagination();
		self.$row_target.html(working.join(''));
		self.fire('display');

		if (items.length) {
			self.setMode('display');
		} else {
			self.setMode('empty');
		};
	};

	return ShardViewer;
});
