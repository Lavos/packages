// story editor
define([
	'jquery', 'underscore', 'doubleunderscore/core', 'textile',
	'util', 'template_cache', 'dope', 'grid_editor',
	'text!templates/photo_grid.jst',
	'text!./story_editor.jhtml', 'css!./story_editor.css'
],
function($, _, __, textile, util, TemplateCache, DOPE, GridEditor, photo_grid_template_string, template){
	var templatecache = new TemplateCache();
	var div = document.createElement('div');
	div.innerHTML = template;
	templatecache.buildCache($(div));
	var MOMENT_TYPES = ['Text', 'Photo', 'Video', 'Quote', 'Poll', 'Audio', 'Misc', 'CMP'];

	var collection_grid_editor = new GridEditor({
		item_height: 100,
		item_width: 100,
		item_template_string: photo_grid_template_string
	});

	var Block = function Block (params) {
		var self = this;

		var defaults = {
			templateID: '',
			elementID: null,
			elementClasses: null,
			elementTagName: 'div'
		};

		_.extend(self.options = self.options || {}, defaults, params);

		self.element = document.createElement(self.options.elementTagName);

		if (self.options.elementID) {
			self.element.setAttribute('id', self.options.elementID);
		};

		if (self.options.elementClasses) {
			self.element.setAttribute('class', self.options.elementClasses);
		};

		self.$element = $(self.element);
		self.element.innerHTML = templatecache.cache[self.options.templateID](self, __);
		self.$view = self.$element.find('.view_rep');

		self.isSaving = false;
		self.setDirty(true);
		self.isRemoved = false;
		self.data = {};
		self.transmit_data = {};
		self.saveHandler = __.globalevents.on('save', function(){ self.commit(); self.isSaving = true; });

		self.$element.on('click', '.edit', function(e){
			e.preventDefault();
			e.stopPropagation();

			__.globalevents.fire('edit', self, LUCID.schema[self.options.type], self.transmit_data, self.data);
		});

		self.clearDirtyHandler = __.globalevents.on('clear_dirty', function(){ self.setDirty(false); });
	};

	__.augment(Block, __.PubSubPattern);
	Block.prototype.modes = ['error', 'loading', 'view'];

	Block.prototype.remember = function remember (data) {
		var self = this;

		_.extend(self.data, data);

		var schema = LUCID.schema[self.options.type].attributes;

		_.each(schema, function(value, key, dict){
			if (self.data.hasOwnProperty(key)) {
				self.transmit_data[key] = self.data[key];
			};
		});
	};

	Block.prototype.update = function update (data) {
		var self = this;

		self.remember(data);
		self.$view.html(self.renderView(LUCID.schema[self.options.type], self.transmit_data).join(''));
		self.fire('update');
	};

	Block.prototype.renderView = function view (schema, data) {
		var self = this;

		var working = [];

		_.each(schema.attributes, function(value, key, dict){
			if (!value) { return; }

			switch (value.type) {

			case 'array':
				var counter = 0;
				var objects = [];

				while (counter < value.max) {
					objects[objects.length] = self.renderView(value, __.path(data, __.sprintf('%s.%s', key, counter)));
					counter++;
				};

				working[working.length] = templatecache.cache['array_template']({
					isArray: true,
					key: key,
					internals: objects,
					label: value['label'] || key,
					limit_to_contexts: value.limit_to_contexts || [],
				});
			break;

			case 'profile_list':
				// skip this one since we are going to use in imagepath
			break;

			default:
				var single_field = templatecache.cache[__.sprintf('schema_%s', value.type)]({
					__: __,
					_: _,
					textile: textile,
					util: util,
					value: __.path(data, key, ''),
					key: key,
					label: value['label'] || key,
					schema: value,
					limit_to_contexts: value.limit_to_contexts || []
				});

				working[working.length] = templatecache.cache['array_template']({
					isArray: false,
					key: key,
					internals: [single_field],
					limit_to_contexts: value.limit_to_contexts || []
				});
			break;
			};
		});

		return working;
	};

	Block.prototype.commit = function commit () {
		var self = this;

		self.fire('commit');

		if (self.isRemoved) {
			__.globalevents.off(self.saveHandler);
		};

		if (self.isDirty || self.isRemoved) {
			return util.hitAPI({
				context: __.sprintf('%s/%s', self.options.type.toLowerCase(), self.data._id || ''),
				expand: ['tags', 'parent_tags'],
				data: self.transmit_data,
				verb: (self.isRemoved ? 'DELETE' : 'POST'),
				success: function(items){
					console.log(__.sprintf('save_success for: %s', self.options.type));
					self.remember(items[0]);
					self.setDirty(false);
					self.fire.apply(self, ['save_success'].concat(_.toArray(arguments)));
					self.isSaving = false;
				},
				error: function(message, error_map){
					self.throwError(message, error_map);
					self.fire.apply(self, ['save_error'].concat(_.toArray(arguments)));
					self.isSaving = false;
				}
			});
		} else {
			console.log(__.sprintf('NOT DIRTY for: %s', self.options.type));
			self.fire.apply(self, ['no_changes'].concat([self.data]));
		};
	};

	Block.prototype.remove = function remove () {
		var self = this;

		if (self.data._id) {
			self.isRemoved = true;
		} else {
			__.globalevents.off(self.saveHandler);
		};

		__.globalevents.off(self.clearDirtyHandler);
		self.$element.remove();
		self.fire('remove');
		self.cancelSubscriptions();
	};

	Block.prototype.setDirty = function setDirty (dirty) {
		var self = this;

		self.isDirty = dirty;
		if (dirty) {
			self.$element.addClass('dirty');
		} else {
			self.$element.removeClass('dirty');
		};
	};

	Block.prototype.setMode = function setMode (targetmode) {
		var self = this;

		self.$element.removeClass(self.modes.join(' ')).addClass(targetmode);
		self.current_mode = targetmode;
	};

	Block.prototype.throwError = function throwError (message, error_map) {
		var self = this;

		self.fire('error', message, error_map);
		self.setMode('error');
	};

	Block.prototype.serializeToJSON = function serializeToJSON () {
		var self = this;

		var sub = {};
		if (self.options.itemConstructor) {

			var counter = 0, limit = self.length, working = [];
			while (counter < limit) {
				working.push(self[counter].serializeToJSON());
				counter++;
			};

			sub[self.options.itemConstructor.prototype.global_name + 's'] = working;
		};

		return __.extend({}, self.data, self.transmit_data, sub);
	};

	var Collection = __.inherits(Block, function Collection (params) {
		var self = this;

		var defaults = {
			targetSelector: '.target',
			itemConstructor: Collection,
			draggable: false,
			growing: false
		};

		_.extend(self.options, defaults, params);

		self.length = 0;
		self.has_contexts = [];
		self.valid_moment_types = [];
		self.$target = self.$element.find(self.options.targetSelector);
		self.target = self.$target[0];
		self.$placeholder = self.$element.find('.placeholder');

		self.$element.on('click', '.request_moment', function(e){
			e.preventDefault();
			e.stopPropagation();

			self.fire('request_moment', $(this).data('type'));
		});

		self.$element.on('click focus', '.specifics form', function(e){
			e.stopPropagation();
			self.setDirty(true);
		});

		self.$element.on('click', '[data-collection-action="gridedit"]', function(e){
			e.preventDefault();
			e.stopPropagation();

			collection_grid_editor.render(self);
			collection_grid_editor.open();

			collection_grid_editor.once('accept', function(items){
				self.splice.apply(self, [0, self.length].concat(items));
			});
		});

		// item handler

		self.item_handler = function (eventname) {
			switch (eventname) {
			case 'remove':
				self.removeItem(this);
				self.checkRemove();
			break;

			case 'save_success':
				if (self.isSaving) {
					self.saveQueue.bump();
				};
			break;

			case 'save_error':
				self.isSaving = false;
			break;

			default:
			break;
			};
		};

		// dragging

		self.dragging = null;

		__.globalevents.on('dragstart', function(draggable_object){
			self.dragging = draggable_object;
			self.$placeholder.height(draggable_object.$element.outerHeight());
			self.$placeholder.width(draggable_object.$element.outerWidth());
		});

		__.globalevents.on('dragend', function(draggable_object){
			if (draggable_object.dropTarget === self) {
				var index = self.$placeholder.index();

				if (_.contains(self, draggable_object)) {
					self.removeItem(draggable_object);
				};

				self.splice(index, 0, draggable_object);
			} else if (draggable_object.dropTarget && _.contains(self, draggable_object)) {
				self.removeItem(draggable_object);
				self.checkRemove();
			};

			self.setDragOver(false);
			self.dragging = null;
		});

		__.globalevents.on('dragover', function(object_under, e){
			if (self.hasInterest(self.dragging.options.type) && self.dragging instanceof self.options.itemConstructor && _.contains(self, object_under)) {
				object_under.$element[self.$placeholder.index() > object_under.$element.index() ? 'before' : 'after'](self.$placeholder);
			};

			if (object_under !== self) {
				self.setDragOver(false);
			};
		});

		__.addEvent(self.element, 'dragover', function(e){
			if (self.hasInterest(self.dragging.options.type) && self.dragging instanceof self.options.itemConstructor) {
				e.dataTransfer.dropEffect = 'move';
				e.dataTransfer.effectAllowed = 'move';

				e.preventDefault(); // Chrome requires for "successful" drop, Firefox redirects
				self.setDragOver(true);
				return false;
			};
		});

		__.addEvent(self.element, 'drop', function(e){
			if (self.hasInterest(self.dragging.options.type) && self.dragging instanceof self.options.itemConstructor) {
				self.dragging.dropTarget = self;
				e.preventDefault(); // prevent Firefox redirect
				return false;
			};
		});

		if (self.options.growing) {
			self.$element.on('dragover', '.hortscroll', function(e){
				var $this = $(this);
				var $viewport = self.$element.find('.viewport');
				$viewport.scrollLeft($viewport.scrollLeft() + ($this.is('.left') ? -20 : 20));
			});
		};

		self._applyDecorations();
	});

	Collection.prototype.global_name = 'collection';

	Collection.prototype.hasInterest = function hasInterest (type) {
		var self = this;

		return _.contains(self.valid_moment_types, type);
	};

	Collection.prototype.determineContext = function determineContext () {
		var self = this;

		var moment_map = self.getMomentTypes();
		var moment_list = [];
		_.each(moment_map, function(value, key){
			moment_list.push(key);
		});

		var possible_contexts = _.keys(LUCID.schema.Collection.contexts);
		var valid_contexts = [];
		var valid_moment_types = [];

		if (moment_list.length) {
			valid_contexts = self.getValidContexts(moment_list);

			var context_moment_types = [];
			var counter = valid_contexts.length;
			while (counter--) {
				context_moment_types = context_moment_types.concat(LUCID.schema.Collection.contexts[valid_contexts[counter]].valid_types);
			};

			valid_moment_types = _.unique(context_moment_types);
		} else {
			valid_moment_types = MOMENT_TYPES;
		};

		self.has_contexts = valid_contexts;
		self.valid_moment_types = valid_moment_types;

		// remove all the current context classes
		// remove all the current valid moment classes
		self.element.className = self.element.className.replace(/\scontext_\S+/g, '').replace(/\svalid_\S+/g, '');

		var class_names = [];

		// add all valid contexts
		var counter = valid_contexts.length;
		while (counter--) {
			class_names.push('context_' + valid_contexts[counter]);
		};

		// add all the valid moment types
		var counter = valid_moment_types.length;
		while (counter--) {
			class_names.push('valid_' + valid_moment_types[counter]);
		};

		self.element.className = __.sprintf("%s %s", self.element.className, class_names.join(' '));

		if (self.length > 1) {
			self.setHasMany(true);
		} else {
			self.setHasMany(false);
		};
	};

	Collection.prototype.getValidContexts = function getValidContexts (types) {
		var self = this;

		var valid_contexts = [];

		_.each(LUCID.schema.Collection.contexts, function(context_settings, context_name){
			var valid_context = true;

			var counter = types.length;
			while (counter--) {
				if (!_.contains(context_settings.valid_types, types[counter])) {
					valid_context = false;
					break;
				};
			};

			if (valid_context) {
				valid_contexts.push(context_name);
			};
		});

		return valid_contexts;
	};

	Collection.prototype.getMomentTypes = function () {
		var self = this;

		var types_map = {}, counter = self.length;
		while (counter--) {
			types_map[self[counter].options.type] = true;
		};

		return types_map;
	};

	Collection.prototype.setCanHaveMany = function setCanHaveMany (canHaveMany) {
		var self = this;

		if (canHaveMany) {
			self.$element.addClass('canHaveMany');
		} else {
			self.$element.removeClass('canHaveMany');
		};
	};

	Collection.prototype.setHasMany = function setHasMany (hasMany) {
		var self = this;

		if (hasMany) {
			self.$element.addClass('hasMany');
		} else {
			self.$element.removeClass('hasMany');
		};
	};


	Collection.prototype.indexOf = Array.prototype.indexOf;
	Collection.prototype.slice = Array.prototype.slice;

	Collection.prototype.push = function push (item) {
		var self = this;

		self.splice(self.length, 0, item);
		return item;
	};

	Collection.prototype.concat = function concat () {
		var self = this;

		var args = _.toArray(arguments);

		var counter = 0, limit = args.length;
		while (counter < limit) {
			var current = args[counter];

			if (__.getClass(current) === 'array') {
				self.splice.apply(self, [self.length, 0].concat(current));
			} else {
				self.push(current);
			};

			counter++;
		};

		self.fire('concat');
	};

	Collection.prototype.splice = function splice (start_index, remove_count) {
		var self = this;

		var args = _.toArray(arguments);
		var removed_items = Array.prototype.splice.apply(self, arguments);
		var add_items = args.slice(2);

		var counter = removed_items.length;
		while (counter--) {
			var current = removed_items[counter];
			current.off(['all', self.item_handler]);
		};

		var counter = 0, limit = add_items.length;
		while (counter < limit) {
			var current = add_items[counter], pos = start_index + counter;
			current.on('all', self.item_handler);

			if (pos >= self.target.children.length - 1) {
				self.target.appendChild(current.element);
			} else {
				self.target.insertBefore(current.element, self.target.children[pos]);
			};

			counter++;
		};

		self.setDirty(true);
		self.determineContext();

		return removed_items;
	};

	Collection.prototype.checkRemove = function checkRemove () {
		var self = this;

		if (self.length === 0) {
			self.remove();
			return true;
		} else {
			return false;
		};
	};

	Collection.prototype.removeItem = function removeItem (item) {
		var self = this;

		var index = self.indexOf(item);
		if (index === -1) {
			return;
		};

		self.splice(index, 1);

		return item;
	};

	Collection.prototype.commit = function commit () {
		var self = this;

		var count = 0;
		var counter = self.length;
		while (counter--) {
			if (self[counter].isDirty) {
				count++;
			};
		};

		self.saveQueue = new __.SerialManager(count, function(){
			self.populateTransmitData();
			Collection.__super__.commit.call(self);
		});
	};

	Collection.prototype.serializeToJSON = function serializeToJSON () {
		var self = this;

		self.populateTransmitData();
		return Collection.__super__.serializeToJSON.call(self);
	};

	Collection.prototype.populateTransmitData = function populateTransmitData () {
		var self = this;

		var items = self.getItemIDs();
		self.transmit_data[self.options.itemConstructor.prototype.global_name + 's'] = items;
	};

	Collection.prototype.getItemIDs = function getItemIDs () {
		var self = this;

		var working = [], counter = 0, limit = self.length;
		while (counter < limit) {
			var current = self[counter];

			if (__.path(current, 'data._id', false)) {
				working[working.length] = self[counter].data._id;
			};

			counter++;
		};

		return working;
	};

	var Moment = __.inherits(Block, function Moment (params) {
		var self = this;

		var defaults = {
			draggable: false,
			type: 'photo'
		};

		_.extend(self.options, defaults, params);

		self.data.type = self.options.type;

		self.$element.on('click', '.view', function(e){
			self.setMode('view');
		});

		self.$element.on('click', '.remove', function(e){
			e.preventDefault();

			self.remove();
		});

		self._applyDecorations();
	});

	Moment.prototype.modes = ['error', 'loading', 'view', 'edit'];
	Moment.prototype.global_name = 'moment';

	Moment.prototype.throwError = function throwError (message, error_map) {
		var self = this;

		self.$element.find('.error_master').html(templatecache.cache['error_template']({ message: message, error_map: error_map }));
		Moment.__super__.throwError.call(self, message, error_map);
	};

	var Story = __.inherits(Collection, function Story (params){
		var self = this;

		var defaults = {
			itemConstructor: Collection
		};

		_.extend(self.options, defaults, params);

		self.$window = $(window);

		self.$element.on('click', '.new_collection_buttons .add_moment', function(e){
			e.preventDefault();

			var $this = $(this);

			var addingType = $this.data('type');

			var new_collection = self.createCollection();
			new_collection.update({});
			new_collection.push(self.createMoment(addingType));
		});

		self.$element.on('click', '.dismiss_error', function(e){
			e.preventDefault();

			self.setMode('view');
		});


		self.dope = new DOPE();
		__.globalevents.on('edit', function(block, schema, transmit_data, data){
			self.dope.render(schema, transmit_data, data, block.has_contexts);
			self.dope.open();

			self.dope.once('accept', function(data){
				block.update(data);
				block.setDirty(true);
			});
		});

		// hover areas

		self.$scrollareas = $('#workarea .scrollarea').each(function(index){
			var $this = $(this);

			if ($this.is('.top')) {
				__.addEvent(this, 'dragover', function(){
					self.$window.scrollTop(self.$window.scrollTop() - 40);
				});
			} else {
				__.addEvent(this, 'dragover', function(){
					self.$window.scrollTop(self.$window.scrollTop() + 40);
				});
			};
		});

		__.globalevents.on('dragstart', function(e){
			self.displayScrollAreas(true);
		});

		__.globalevents.on('dragend', function(e){
			self.displayScrollAreas(false);
		});

		__.globalevents.on('moment_update', function(e){
			self.setDirty(true);
		});

		__.globalevents.on('collection_update', function(e){
			self.setDirty(true);
		});

		self.setMode('view');
	});

	Story.prototype.modes = ['loading', 'error', 'view'];

	Story.prototype.serialize = function serialize () {
		var self = this;

		return self.serializeToJSON();
	};

	Story.prototype.determineContext = function(){};

	Story.prototype.hasInterest = function hasInterest () {
		var self = this;

		return true;
	};

	Story.prototype.checkRemove = function checkRemove () { };

	Story.prototype.remove = function remove () { };

	Story.prototype.ingest = function ingest (data, markAsDirty) {
		var self = this;

		self.update(data);

		var collections = __.path(data, 'collections', []);

		var counter = 0, limit = collections.length;
		while (counter < limit) {
			var current_collection = collections[counter];

			if (current_collection.moments.length) {
				var new_collection = self.createCollection(current_collection);
				new_collection.update(current_collection);

				var moment_counter = 0, moment_limit = current_collection.moments.length;
				var new_moments = [];
				while (moment_counter < moment_limit) {
					var current_moment = current_collection.moments[moment_counter];
					var type = (current_moment['_id'] ? util.identify(current_moment['_id']) : current_moment.type);

					var new_moment = self.createMoment(type, current_moment);
					new_moments.push(new_moment);
					moment_counter++;
				};

				new_collection.concat(new_moments);
			};

			counter++;
		};

		if (markAsDirty) {
			self.setDirty(true);
		} else {
			__.globalevents.fire('clear_dirty');
		};
	};

	Story.prototype.displayScrollAreas = function displayScrollAreas (display) {
		var self = this;

		if (display) {
			self.$scrollareas.addClass('show');
		} else {
			self.$scrollareas.removeClass('show');
		};
	};

	Story.prototype.createCollection = function createCollection (collection_data, suppressDirty) {
		var self = this;

		var new_collection = new Collection({
			data: collection_data || {},
			templateID: 'collection_template',
			elementClasses: 'clearfix collection',
			itemConstructor: Moment,
			draggable: true,
			growing: true,
			type: 'Collection'
		});

		new_collection.on('request_moment', function(type){
			new_collection.push(self.createMoment(type, {}));
		});

		self.push(new_collection);
		return new_collection;
	};

	Story.prototype.createMoment = function createMoment (type, data) {
		var self = this;

		var moment = new Moment({
			templateID: 'moment_template',
			elementTagName: 'td',
			elementClasses: 'moment ' + type,
			draggable: true,
			type: type
		});

		moment.update(data);
		moment.setMode('view');
		self.fire('create_moment', moment);

		return moment;
	};

	Story.prototype.throwError = function throwError (message, error_map) {
		var self = this;

		self.$element.find('.story_error_message').html(templatecache.cache['error_template']({ message: message, error_map: error_map }));
		Story.__super__.throwError.call(self, message, error_map);
	};

	Story.prototype.global_name = 'story';


	var DraggableObject = {
		init: function(){
			var self = this;

			if (self.options.draggable) {
				self.isDragging = false;
				self.dropTarget = null;
				self.grabbedHandle = false;

				self.$element.on('mousedown', '.handle', function(e){
					self.grabbedHandle = true;
					self.$element.attr('draggable', true);
					e.stopPropagation();
				});

				self.$element.on('mouseup', function(e){
					if (self.grabbedHandle) {
						self.grabbedHandle = false;
						self.$element.attr('draggable', false);
					};
				});

				self.$element.on('dragstart', function(e){
					if (!self.grabbedHandle) { return false; };

					e.originalEvent.dataTransfer.dropEffect = 'move';
					e.originalEvent.dataTransfer.setData('Text', 'dummy');
					e.stopPropagation();

					self.isDragging = true;
					self.fire('dragstart', e);
					__.globalevents.fire('dragstart', self, e);
				});

				self.$element.on('dragenter', function(e){
					if (self.isDragging) {
						self.$element.addClass('drag_dragging');
					};

					self.fire('dragenter', e);
					__.globalevents.fire('dragenter', self, e);
				});

				self.$element.on('dragover', function(e){
					self.fire('dragover', e);
					__.globalevents.fire('dragover', self, e);
				});

				self.$element.on('dragend', function(e){
					self.$element.attr('draggable', false);
					self.$element.removeClass('drag_dragging');
					self.fire('dragend');
					__.globalevents.fire('dragend', self);

					self.dropTarget = null;
					self.isDragging = false;
					self.grabbedHandle = false;
					e.stopPropagation();
				});
			};
		},
		methods: {
			setDragOver: function setDragOver (dragover) {
				var self = this;

				if (dragover) {
					self.$element.addClass('drag_active');
				} else {
					self.$element.removeClass('drag_active');
				};

				self.draggingOver = true;
			}
		}
	};

	__.decorate(Moment.prototype, DraggableObject);
	__.decorate(Collection.prototype, DraggableObject);

	return Story;
});
