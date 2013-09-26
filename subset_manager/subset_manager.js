define([
	'jquery', 'underscore', 'doubleunderscore/core',
	'util', 'message',
	'text!./subset_manager.jst', 'text!./item.jst',
	'css!./subset_manager.css'
],
function($, _, __, util, Message, main_template_string, item_template_string){
	var main_template = __.template(main_template_string);

	var SubSetManager = function SubSetManager (params) {
		var self = this;

		var defaults = {
			target:  $(),
			limit: 5,
			ordered: true,
			label_property: 'name'
		};

		_.extend(self.options = {}, defaults, params);

		self.items = [];
		self.target = null;

		self.$element = $(main_template(self.options)).appendTo(self.options.target);
		self.element = self.$element[0];
		self.$counter = self.$element.find('.subset_manager_counter');
		self.$item_target = self.$element.find('.subset_manager_item_target');

		self.$element.on('click', '[data-subset-manager-action="removeall"]', function(e){
			e.preventDefault();

			var counter = self.items.length;
			while (counter--) {
				var current = self.items[counter];
				current.remove(true);
				self.remove(current, true);
			};

			new Message({ type: 'warning', title: 'SubSetManager', message: 'All items cleared successfully.' });
			self.fire('change', self.serialize());
		});
	};

	__.augment(SubSetManager, __.PubSubPattern);

	SubSetManager.prototype.add = function add (item, silently, template_string, set_key) {
		var self = this;

		if (__.getType(item) === 'array') {
			var items = item;
		} else {
			var items = [item];
		};

		set_key = set_key || 'content';

		if (self.items.length + items.length > self.options.limit) {
			self.fire('error', 'Item limit reached.');
			return new Message({ type: 'error', title: 'SubSetManager encountered an error', message: 'Item limit reached.' });
		};

		var working = [];
		var counter = 0, limit = items.length;
		while (counter < limit) {
			var new_item = new Item({
				ordered: self.options.ordered,
				label_property: self.options.label_property,
				template_string: template_string || item_template_string,
				set_key: set_key
			}, items[counter]);

			new_item.on('remove', function(){
				self.remove(this);
			});

			if (self.options.ordered) {
				new_item.on('handlegrab', function(e){
					self.$element.addClass('dragging');
					self.isDragging = true;
				});

				new_item.on('release', function(e){
					self.$element.removeClass('dragging');
					self.isDragging = false;
					self.target.$element[self.target.over ? 'before' : 'after'](this.element);

					var target_index = _.indexOf(self.items, self.target);
					var dragging_index = _.indexOf(self.items, this);

					self.items.splice(dragging_index, 1);

					if (self.target.over) {
						self.items.splice(target_index, 0, this);
					} else {
						self.items.splice(target_index+1, 0, this);
					};

					self.fire('change', self.serialize());
				});

				new_item.on('select', function(e){
					if (self.isDragging) {
						self.target = this;
					};
				});
			};

			working.push(new_item);
			counter++;
		};

		self.items = self.items.concat(working);

		self.render();

		if (!silently) {
			self.fire('add', items);
			self.fire('change', self.serialize());
		};
	};

	SubSetManager.prototype.remove = function remove (item, silently) {
		var self = this;

		var target_index = _.indexOf(self.items, item);
		self.items.splice(target_index, 1);

		if (!silently) {
			self.fire('remove', item);
			self.fire('change', self.serialize());
		};

		self.render();
	};

	SubSetManager.prototype.serialize = function serialize () {
		var self = this;

		return self.items;
	};

	SubSetManager.prototype.render = function render () {
		var self = this;

		var fragment = document.createDocumentFragment();

		var counter = 0, limit = self.options.limit;
		while (counter < limit) {
			if (counter < self.items.length) {
				fragment.appendChild(self.items[counter].element);
			} else {
				var placeholder = document.createElement('div');
				placeholder.className = 'subset_manager_placeholder';
				fragment.appendChild(placeholder);
			};

			counter++;
		};

		self.$item_target.find('.subset_manager_placeholder').remove();
		self.$item_target.append(fragment);
		self.$counter.text(self.items.length);
		self.fire('render');
	};


	var Item = function Item (params, data) {
		var self = this;

		var defaults = {
			ordered: true,
			label_property: 'name',
			template_string: '',
			set_key: 'content'
		};

		_.extend(self.options = {}, defaults, params);

		self.data = data;

		self.comp_template = __.template(self.options.template_string);
		self.element = __.strToElement(self.comp_template(self.data, self.options));
		self.$element = $(self.element);

		self.$element.on('click', '[data-subset-manager-item-action="remove"]', function(e){
			self.remove();
		});

		if (self.options.ordered) {
			self.isDragging = false;
			self.grabbedHandle = false;

			self.$element.on('mousedown', '.subset_manager_item_handle', function(e){
				self.fire('handlegrab', e);
				self.grabbedHandle = true;
				self.isDragging = true;

				e.stopPropagation();
				e.preventDefault();

				$(document).one('mouseup', function(){
					self.fire('release');
					self.grabbedHandle = false;
					self.isDragging = false;
				});
			});

			self.$element.on('mousemove', function(e){
				if (!self.isDragging) {
					self.fire('select');

					if (e.offsetY < 25) {
						self.over = true;
						self.$element.removeClass('under').addClass('over');
					} else {
						self.over = false;
						self.$element.removeClass('over').addClass('under');
					};
				};
			});

			self.$element.on('mouseleave', function(e){
				self.$element.removeClass('over under');
			});
		};
	};

	Item.prototype.global_name = 'item';

	Item.prototype.remove = function remove (silently) {
		var self = this;

		self.$element.remove();

		if (!silently) {
			self.fire('remove');
		};
	};

	Item.prototype.setDragging = function setDragging (dragging) {
		var self = this;

		if (dragging) {
			self.$element.addClass('dragging');
		} else {
			self.$element.removeClass('dragging');
		};
	};

	__.augment(Item, __.PubSubPattern);

	return SubSetManager;
});
