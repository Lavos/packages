define([
	'jquery', 'underscore', 'doubleunderscore/core',
	'util', 'sbarmodal',
	'text!./rearranger.jst', 'text!./item.jst',
	'css!./rearranger.css'
],
function($, _, __, util, SbarModal, main_template_string, item_template_string){
	var item_template = __.template(item_template_string);

	var Rearranger = function Rearranger () {
		var self = this;

		self.items = [];

		self.isDragging = false;
		self.actor = null;
		self.target = null;
		self.over = false;

		self.modal = new SbarModal();
		self.$element = $(main_template_string);
		self.modal.appendContent(self.$element);

		self.$target = self.$element.find('.rearranger_item_target');

		self.$element.on('mousedown', '.rearranger_item', function(e){
			if (e.originalEvent.target.hasAttribute('data-rearranger-handle')) {
				self.isDragging = true;
				self.actor = this;

				$(this).addClass('dragging');

				e.stopPropagation();
				e.preventDefault();

				$(document).one('mouseup', function(){
					self.isDragging = false;

					if (self.target && self.target !== self.actor) {
						var actor_index = $(self.actor).data('rearranger-item-index');
						var target_index = $(self.target).data('rearranger-item-index');

						if ((self.over && actor_index !== target_index-1) || (!self.over && actor_index !== target_index+1)) {
							self.reorder(actor_index, target_index, self.over);
						} else {
							self.$element.find('.rearranger_item').removeClass('over under dragging');
						};

						self.over = false;
						self.actor = null;
						self.target = null;
					} else {
						self.$element.find('.rearranger_item').removeClass('over under dragging');
					};
				});
			};
		});

		self.$element.on('mousemove', '.rearranger_item', function(e){
			if (self.isDragging && self.actor !== this) {
				if (self.target) {
					$(self.target).removeClass('under over');
				};

				self.target = this;
				var $item = $(this);

				if (e.offsetY < 25) {
					self.over = true;
					$item.removeClass('under').addClass('over');
				} else {
					self.over = false;
					$item.removeClass('over').addClass('under');
				};
			};
		});

		self.$element.on('mouseleave', function(e){
			if (self.isDragging) {
				self.$element.find('.rearranger_items').removeClass('over under');
			};
		});

		self.$element.on('keypress', '[data-rearranger-input]', function(e){
			if (e.which === 13) {
				var $input = $(this);
				var value = $input.val();

				if (self.input_regex.test(value)) {
					self.reorder($input.data('rearranger-item-index'), value, true);
				};

				$input.val('');
			};
		});

		self.modal.on('close', function(){
			self.fire('close', self.reordered);
			self.reordered = false;
		});
	};

	__.augment(Rearranger, __.PubSubPattern);

	Rearranger.prototype.input_regex = /^\d+$/;

	Rearranger.prototype.open = function open () {
		var self = this;

		self.modal.open();
	};

	Rearranger.prototype.reorder = function reorder (actor_index, target_index, position_over) {
		var self = this;

		self.reordered = true;
		var actor = self.items[actor_index];

		self.items.splice(actor_index, 1);

		if (position_over) {
			self.items.splice(target_index, 0, actor);
		} else {
			self.items.splice(target_index+1, 0, actor);
		};

		self.render(self.items, self.item_template_string);
		self.fire('reorder', self.items);
	};

	Rearranger.prototype.render = function render (items, item_template_string) {
		var self = this;

		var start = new Date();

		self.items = items;
		self.item_template_string = item_template_string;
		var comp_template = __.template(item_template_string);

		var working = [];
		var counter = 0, limit = items.length;
		while (counter < limit) {
			working.push(item_template({ item_render: comp_template(items[counter], { util: util }), index: counter }));
			counter++;
		};

		self.$target.html(working.join(''));
		console.log((new Date() - start) + 'ms, render');
	};

	return new Rearranger();
});
