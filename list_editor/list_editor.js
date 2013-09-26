define([
	'jquery', 'underscore', 'doubleunderscore/core',
	'message',
	'text!./list_editor.jst', 'text!./list_editor_item.jst', 'css!./list_editor.css'
],
function($, _, __, Message, main_template, item_template){
	var main_template = __.template(main_template);
	var item_template = __.template(item_template);

	var ListEditor = function ListEditor (params) {
		var self = this;

		var defaults = {
			element: $(),
			fieldName: 'list',
			primaryKeyName: '_id',
			displayPropertyName: 'name',
			limit: 0,
		};

		_.extend(self.options = {}, defaults, params);

		self.$element = self.options.element.html(main_template());
		self.element = self.$element[0];
		self.$target = self.$element.find('.list_editor_target');
		self.target = self.$target[0];
		self.$input = self.$element.find('.list_editor_input');
		self.input = self.$input[0];

		self.length = 0;
		self.setEmpty(true);

		self.$element.on('click', '.list_editor_item', function(e){
			e.preventDefault();

			var arr = Array.prototype.slice.call(self.target.children);
			var index = arr.indexOf(this);

			if (index != -1) {
				self.splice(index, 1);
			};
		});
	};

	__.augment(ListEditor, __.PubSubPattern);

	ListEditor.prototype.splice = function splice (start_index, items_to_remove) {
		var self = this;

		var args = _.toArray(arguments);
		var add_items = args.slice(2);

		if (self.checkLimit(add_items.length)) {
			return new Message({ type: 'warning', title: 'List Editor', message: 'Limit reached for this list. Please remove an item before adding another.' });
		};

		var removed_items = Array.prototype.splice.apply(self, arguments);

		self.fire('splice', arguments);

		if (add_items.length) {
			var frag = document.createDocumentFragment();
			var counter = 0, limit = add_items.length;
			while (counter < limit) {
				frag.appendChild(add_items[counter].element);
				counter++;
			};

			self.target.insertBefore(frag, self.target.children[start_index]);
		};

		if (removed_items.length) {
			var counter = removed_items.length;
			while (counter--) {
				self.target.removeChild(removed_items[counter].element);
			};
		};

		self.setEmpty(self.length === 0);
		return removed_items;
	};

	ListEditor.prototype.checkLimit = function checkLimit (adding) {
		var self = this;

		return self.options.limit && adding + self.length > self.options.limit;
	};

	ListEditor.prototype.setEmpty = function setEmpty (empty) {
		var self = this;

		self.$element[empty ? 'addClass' : 'removeClass']('list_editor_empty');
	};

	ListEditor.prototype.concat = function concat () {
		var self = this;

		var args = _.toArray(arguments);

		var flatten = Array.prototype.concat.apply([], args);
		self.splice.apply(self, [self.length, 0].concat(flatten));
		self.fire('concat', flatten);
	};

	ListEditor.prototype.push = function push (item) {
		var self = this;

		self.splice.apply(self, [self.length, 0].concat(item));
		self.fire('push', item);
	};

	ListEditor.prototype.clear = function clear () {
		var self = this;

		self.splice(0, self.length);
		self.fire('clear');
	};

	ListEditor.prototype.render = function render (arr) {
		var self = this;

		if (self.checkLimit(arr.length)) {
			return new Message({ type: 'warning', title: 'List Editor', message: 'Limit reached for this list. Please remove an item before adding another.' });
		};

		var items = [];
		var counter = 0, limit = arr.length;
		while (counter < limit) {
			var new_item = new Item(arr[counter], self.options.displayPropertyName);
			items.push(new_item);
			counter++;
		};

		if (items.length) {
			self.concat(items);
		};
	};

	ListEditor.prototype.serialize = function serialize () {
		var self = this;

		var dataset = [];
		var counter = 0, limit = self.length;
		while (counter < limit) {
			dataset.push(self[counter].data);
			counter++;
		};

		return dataset;
	};

	var Item = function Item (data, property_name) {
		var self = this;

		self.data = data;
		self.element = __.strToElement(item_template({ text: data[property_name] }));
	};

	return ListEditor;
});
