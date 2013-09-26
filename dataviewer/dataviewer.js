define([
	'jquery', 'underscore',
	'doubleunderscore/core', 'doubleunderscore/sortable',
	'util',
	'text!./pagination.jst', 'text!./filters.jst',
	'css!./dataviewer.css'
],
function($, _, __, sortable, util, pagination_template_string, filters_template_string){
	var DataViewer = function DataViewer (params) {
		var self = this;

		var defaults = {
			element: $(),
			row_template_id: 'row_template',
			per_page: 30
		};

		_.extend(self.options = {}, defaults, params);

		self.comptemplate = __.template(document.getElementById(self.options.row_template_id).innerHTML);
		self.sort_direction_asc = true;
		self.sort_property = null;
		self.offset = 0;
		self.data = [];
		self.subset = [];

		self.$element = self.options.element.addClass('dataviewer');
		self.$target = self.$element.find('.dataviewer_row_target');
		self.$columns = self.$element.find('col');

		self.$pagination = $(pagination_template_string);
		self.$backers = self.$pagination.find('[data-dataviewer-direction="back"]');
		self.$forwarders = self.$pagination.find('[data-dataviewer-direction="forward"]');
		self.$jumper = self.$pagination.find('.dataviewer_jumper');
		self.$element.append(self.$pagination);

		self.$filters = $(filters_template_string);
		self.$filter_form = self.$filters.find('form');
		self.$filter_input = self.$filters.find('input[name="filter"]');
		self.$element.prepend(self.$filters);

		self.$element.on('click', '[data-dataviewer-sort-by]', function(e){
			var $this = $(this);

			self.sort(self.sort_property);

			if (self.sort_property === $this.data('dataviewer-sort-by')) {
				self.sort_direction_asc = !self.sort_direction_asc;
			} else {
				self.sort_property = $this.data('dataviewer-sort-by');
				self.sort_direction_asc = true;
			};

			if (self.sort_direction_asc) {
				self.display(0, self.sort_direction_asc);
			} else {
				self.display(self.subset.length -1, self.sort_direction_asc);
			};
		});

		self.$jumper.on('keypress', function(e){
			if (e.which === 13) {
				e.preventDefault();

				var total_pages = Math.ceil(self.subset.length / self.options.per_page);
				var value = self.$jumper.val();

				if (self.jumper_regex.test(value)) {
					var desired_page = parseInt(self.$jumper.val(), 10);

					if (desired_page <= total_pages) {
						if (self.sort_direction_asc) {
							self.display(self.options.per_page * (desired_page -1), self.sort_direction_asc);
						} else {
							self.display(self.subset.length-1 - (self.options.per_page * (desired_page -1)), self.sort_direction_asc);
						};
					};
				};

				self.$jumper.val('');
			};
		});

		self.$jumper.on('blur', function(e){
			self.$jumper.val('');
		});

		self.$filter_form.on('submit', function(e){
			e.preventDefault();

			self.filter(self.$filter_input.val());
		});

		self.$filter_form.on('reset', function(e){
			self.clearFilter();
		});

		self.$element.on('click', '[data-dataviewer-direction]', function(e){
			e.preventDefault();

			var $this = $(this);
			switch ($this.data('dataviewer-movement')) {
			case 'first':
				if (self.sort_direction_asc) {
					self.display(0, self.sort_direction_asc);
				} else {
					self.display(self.subset.length -1, self.sort_direction_asc);
				};
			break;

			case 'previous':
				if (self.sort_direction_asc) {
					self.display(self.offset - self.options.per_page, self.sort_direction_asc);
				} else {
					self.display(self.offset + self.options.per_page, self.sort_direction_asc);
				};
			break;

			case 'next':
				if (self.sort_direction_asc) {
					self.display(self.offset + self.options.per_page, self.sort_direction_asc);
				} else {
					self.display(self.offset - self.options.per_page, self.sort_direction_asc);
				};
			break;

			case 'last':
				var total_pages = Math.ceil(self.subset.length / self.options.per_page);

				if (self.sort_direction_asc) {
					self.display(self.options.per_page * (total_pages-1), self.sort_direction_asc);
				} else {
					self.display(self.subset.length-1 - (self.options.per_page * (total_pages-1)), self.sort_direction_asc);
				};
			break;

			};
		});
	};

	__.augment(DataViewer, __.PubSubPattern);
	DataViewer.prototype.global_name = 'dataviewer';
	DataViewer.prototype.jumper_regex = /^(\d+)$/;

	DataViewer.prototype.setData = function setData (data) {
		var self = this;

		self.data = data;
		self.clearFilter();
	};

	DataViewer.prototype.filter = function filter (str) {
		var self = this;

		self.subset = sortable.search(self.data, str);
		self.display(0, true);
	};

	DataViewer.prototype.clearFilter = function clearFilter () {
		var self = this;

		self.subset = self.data;
		self.reset();
	};

	DataViewer.prototype.determinePagination = function determinePagination () {
		var self = this;

		var total_pages = Math.ceil(self.subset.length / self.options.per_page);
		var current_page = 0;

		if ((self.sort_direction_asc && self.offset === 0) || (!self.sort_direction_asc && self.offset == self.subset.length-1)) {
			self.$backers.prop('disabled', true);

			if (total_pages > 1) {
				self.$forwarders.prop('disabled', false);
			} else {
				self.$forwarders.prop('disabled', true);
			};
		} else if ((self.sort_direction_asc && self.offset >= self.subset.length - self.options.per_page) || (!self.sort_direction_asc && self.offset <= self.options.per_page)) {
			current_page = total_pages -1;
			self.$backers.prop('disabled', false);
			self.$forwarders.prop('disabled', true);
		} else if (self.sort_direction_asc) {
			current_page = Math.floor(self.offset / self.options.per_page);
			self.$backers.prop('disabled', false);
			self.$forwarders.prop('disabled', false);
		} else {
			current_page = Math.floor((self.subset.length - self.offset) / self.options.per_page);
			self.$backers.prop('disabled', false);
			self.$forwarders.prop('disabled', false);
		};

		self.$jumper.prop('placeholder', __.sprintf('%s of %s', current_page+1, total_pages));
	};

	DataViewer.prototype.sort = function sort (property) {
		var self = this;

		self.sort_property = property;
		self.$columns.removeClass('current');
		self.$columns.filter(__.sprintf('[data-dataviewer-column="%s"]', property)).addClass('current');
		sortable.sort(self.subset, 'merge', property);
	};

	DataViewer.prototype.display = function display (offset, direction_asc) {
		var self = this;

		if (offset < 0 || offset > self.subset.length-1) {
			return false;
		};

		self.sort_direction_asc = direction_asc;
		var working = [];

		if (self.sort_direction_asc) {
			var counter = offset, limit = Math.min(self.subset.length, offset + self.options.per_page)-1;

			for (var i = counter; i <= limit; i++) {
				working.push(self.comptemplate(self.subset[i], { property: self.sort_property, index: i }));
			};
		} else {
			var counter = offset, limit = Math.max(offset - self.options.per_page+1, 0);

			for (var i = counter; i >= limit; i--) {
				working.push(self.comptemplate(self.subset[i], { property: self.sort_property, index: i }));
			};
		};

		self.offset = offset;
		self.$target.html(working.join(''));
		self.determinePagination();
		self.fire('display', self.$target.find('tr'));
	};

	DataViewer.prototype.refresh = function refresh () {
		var self = this;

		self.sort(self.sort_property);
		self.display(self.offset, self.sort_direction_asc);
		self.fire('refresh');
	};

	DataViewer.prototype.reset = function reset () {
		var self = this;

		self.sort(self.sort_property);
		self.display(self.sort_direction_asc ? 0 : self.subset.length-1, self.sort_direction_asc);
		self.fire('reset');
	};

	return DataViewer;
});
