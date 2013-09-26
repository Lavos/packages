define([
	'jquery', 'underscore', 'doubleunderscore/core',
	'util', 'workspace',
	'text!./grid_editor.jst', 'text!./toolbar.jst', 'text!./item.jst',
	'css!./grid_editor.css'
],
function($, _, __, util, WorkSpace, main_template_string, toolbar_template_string, item_template_string){
	$.event.props.push('dataTransfer');
	var item_template = __.template(item_template_string);

	var GridEditor = function GridEditor (params) {
		var self = this;

		var defaults = {
			item_height: 50,
			item_width: 50,
			item_template_string: ''
		};

		_.extend(self.options = {}, defaults, params);

		self.$element = $(main_template_string);
		self.$target = self.$element.find('.grid_editor_items_target');
		self.$holding_bin = self.$element.find('.grid_editor_holding_bin');
		self.$placeholder = self.$element.find('.grid_editor_placeholder');
		self.$toolbar = $(toolbar_template_string);

		self.user_item_template = __.template(self.options.item_template_string);

		self.$placeholder.find('.grid_editor_placeholder_inset').css({
			'height': self.options.item_height,
			'width': self.options.item_width
		});

		self.workspace = new WorkSpace({
			show_toolbar: true
		});

		self.workspace.appendElements(self.$element, self.$toolbar);

		self.actor = null;
		self.items = [];

		// dragging events

		self.$element.on('mousedown', '.grid_editor_item', function(e){
			self.$placeholder.appendTo(self.$target);
		});

		self.$element.on('dragstart', '.grid_editor_item', function(e){
			self.actor = e.currentTarget;
			e.dataTransfer.dropEffect = 'move';
			e.dataTransfer.setData('dummy', 0);
			e.stopPropagation();
		});

		self.$element.on('dragover', '.grid_editor_item', function(e){
			e.dataTransfer.dropEffect = 'move';
			e.dataTransfer.effectAllowed = 'move';

			if (self.actor === e.currentTarget) {
				$(e.currentTarget).addClass('dragging');
			};

			var $current_target = $(e.currentTarget);
			self.$element.addClass('dragging');
			$current_target[self.$placeholder.index() > $current_target.index() ? 'before' : 'after'](self.$placeholder);
		});

		self.$element.on('dragend', '.grid_editor_item', function(e){
			$(self.actor).removeClass('dragging');
			self.$element.removeClass('dragging');
			self.$placeholder.appendTo(self.$holding_bin);
		});

		self.$element.on('dragover', '.grid_editor_placeholder', function(e){
			e.preventDefault(); // prevent Firefox redirect
			e.dataTransfer.dropEffect = 'move';
			e.dataTransfer.effectAllowed = 'move';
			return false;
		});

		self.$element.on('drop', '.grid_editor_placeholder', function(e){
			e.preventDefault(); // prevent Firefox redirect

			$(self.actor).removeClass('dragging');
			self.$element.removeClass('dragging');

			self.$placeholder.after(self.actor);
			self.$placeholder.appendTo(self.$holding_bin);
			self.reindex();
			return false;
		});

		// input events

		self.$element.on('keypress', '.grid_editor_item', function(e){
			if (e.which === 13 && e.originalEvent.target.hasAttribute('data-grid-editor-input')) {
				var $item = $(this);
				var value = e.originalEvent.target.value;
				e.originalEvent.target.value = '';

				if (self.input_regex.test(value)) {
					var $items = self.$target.find('.grid_editor_item');

					var index = parseInt(value, 10)-1;
					index = Math.max(0, index);
					index = Math.min($items.length-1, index);
					console.log(index);

					var $target = $items.eq(index);
					var $actor = $items.eq($item.index());

					$target[index === $items.length-1 ? 'after' : 'before']($actor);
					self.reindex();
				};
			};
		});

		// toolbar events

		self.$toolbar.on('click', '[data-grid-editor-action="accept"]', function(e){
			e.preventDefault();

			self.fire('accept', self.getOrder());
			self.close();
		});

		self.$toolbar.on('click', '[data-grid-editor-action="cancel"]', function(e){
			e.preventDefault();

			self.fire('cancel');
			self.close();
		});
	};

	__.augment(GridEditor, __.PubSubPattern);

	GridEditor.prototype.input_regex = /^\d+$/;

	GridEditor.prototype.reindex = function reindex () {
		var self = this;

		var $inputs = self.$target.find('[data-grid-editor-input]');
		var counter = 0, limit = $inputs.length;
		while (counter < limit) {
			$inputs[counter].setAttribute('placeholder', counter+1);
			counter++;
		};
	};

	GridEditor.prototype.getOrder = function getOrder () {
		var self = this;	

		var indexes = [], working = [];
		self.$target.find('.grid_editor_item').each(function(index){
			indexes.push(parseInt(this.getAttribute('data-index'), 10));
		});

		var counter = 0, limit = indexes.length;
		while (counter < limit) {
			working.push(self.items[indexes[counter]]);
			counter++;
		};

		return working;
	};

	GridEditor.prototype.reorder = function reorder (actor_index, target_index) {
		var self = this;

		var actor = self.items[actor_index];
		self.items.splice(actor_index, 1);
		self.items.splice(target_index, 0, actor);
	};

	GridEditor.prototype.render = function render (items) {
		var self = this;

		self.items = (items ? items.slice() : self.items);

		var working = [];
		var counter = 0, limit = self.items.length;
		while (counter < limit) {
			working.push(item_template({
				item_render: self.user_item_template(self.items[counter], { util: util }),
				index: counter,
				height: self.options.item_height,
				width: self.options.item_width
			}));

			counter++;
		};

		self.$target.html(working.join(''));
	};

	GridEditor.prototype.open = function open () {
		var self = this;

		self.workspace.open();
	};

	GridEditor.prototype.close = function close () {
		var self = this;

		self.workspace.close();
	};

	return GridEditor;
});
