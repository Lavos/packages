define([
	'jquery', 'underscore', 'doubleunderscore/core',
	'text!./autocomplete.jst', 'css!./autocomplete.css'
],
function($, _, __, template){
	var AutoComplete = function AutoComplete (params) {
		var self = this;

		var defaults = {
			selector: '',
			element: null,
			propertyName: 'name',
			allowNew: true,
		};

		_.extend(self.options = {}, defaults, params);

		self.display = false;
		self.$element = $('<div class="autocomplete"/>').appendTo('body');
		self.$target = null;
		self.$current_selected_choice = null;
		self.position = 0;
		self.selecting = false;
		self.choices = [];
		self.loading = false;

		function keyup_handler (e) {
			var $this = $(this);
			self.$target = $this;

			if (!self.display) {
				self.setDisplay(true);
				$(document).one('click', function(e){ self.setDisplay(false); });
			};

			switch (e.which) {
			case 38: // up
				self.selectIndex(self.selecting ? self.position -1 : self.choices.length -1);
			break;

			case 40: // down
				self.selectIndex(self.selecting ? self.position +1 : 0);
			break;

			case 37: // left
			case 39: // right
			break;

			case 13: // return
				if (self.position !== null) {
					self.fire('choose', self.choices[self.position], this);
					self.setDisplay(false);
					self.$target.val('');
				};
			break;

			case 27:
				// esc
				$this.val('');
				$this.trigger('change');
				self.setDisplay(false);
				self.fire('clear');
			break;

			default:
				self.fire('type', this.value);
				self.setLoading(true);
			break;
			};
		};

		function keydown_handler (e) {
			if (_.contains([38, 40], e.which)) {
				e.stopPropagation();
				e.preventDefault();
			};
		};

		if (self.options.selector) {
			$(document).on('keyup', self.options.selector, keyup_handler);
			$(document).on('keydown', self.options.selector, keydown_handler);
		} else {
			self.options.element.on('keyup', keyup_handler);
			self.options.element.on('keydown', keydown_handler);
		};

		self.$element.on('click', '.autocomplete_result', function(e){
			e.preventDefault();
			self.selectIndex(_.indexOf(self.$result_items, this));
			self.fire('choose', self.choices[self.position], self.$target[0]);
			self.$target.val('');
		});

		if (self.options.allowNew) {
			self.$element.on('click', '.autocomplete_new_item', function(e){
				e.preventDefault();
				var shell = {};
				shell[self.options.propertyName] = self.text;
				self.fire('choose', shell, self.$target[0]);
				self.$target.val('');
			});
		};
	};

	__.augment(AutoComplete, __.PubSubPattern);

	AutoComplete.prototype.comptemplate = __.template(template);

	AutoComplete.prototype.detectMatch = function detectMatch () {
		var self = this;

		var term_regex = new RegExp(__.sprintf('^%s$', self.$target.val()), 'i');

		var match_index = null, counter = self.choices.length;
		while (counter--) {
			if (term_regex.test(self.choices[counter][self.options.propertyName])) {
				match_index = counter;
				break;
			};
		};

		return match_index;
	};

	AutoComplete.prototype.setDisplay = function setDisplay (display) {
		var self = this;

		self.display = display;

		if (self.display) {
			self.$element.addClass('show');
			self.$target.after(self.$element);
		} else {
			self.$element.removeClass('show');
			$('body').append(self.$element);
		};
	};

	AutoComplete.prototype.setLoading = function setLoading (loading) {
		var self = this;

		self.loading = loading;

		if (self.loading) {
			self.fire('loading');
			self.$element.addClass('loading');
		} else {
			self.$element.removeClass('loading');
		};
	};

	AutoComplete.prototype.selectIndex = function selectIndex (index) {
		var self = this;

		self.selecting = true;

		if (index < 0) {
			index = self.choices.length +index;
		};

		var current_index = (index % self.choices.length);

		if (self.$current_selected_choice) {
			self.$current_selected_choice.removeClass('selected');
		};

		self.position = current_index;

		if (self.choices[self.position]) {
			self.$current_selected_choice = self.$result_items.eq(self.position).addClass('selected');
			self.$target.val(self.choices[self.position][self.options.propertyName]);
			self.fire('select', self.choices[self.position]);
		};
	};

	AutoComplete.prototype.clear = function clear () {
		var self = this;

		self.position = null;
		self.selecting = false;
		self.choices = [];
	};

	AutoComplete.prototype.render = function render (text, choices) {
		var self = this;

		self.clear();
		self.choices = choices;
		self.text = text;

		try {
			var regex = new RegExp(__.escapeRegex(text), 'gi');
		} catch (e) {
			var regex = null;
		};

		self.$element.html(self.comptemplate({ allowNew: self.options.allowNew, results: choices, propertyName: self.options.propertyName, regex: regex, text: text }));
		self.$result_items = self.$element.find('li.autocomplete_result');

		self.setLoading(false);

		var match_index = self.detectMatch();
		if (match_index !== null) {
			self.selectIndex(match_index);
		};
	};

	return AutoComplete;
});
