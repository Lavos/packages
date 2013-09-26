define([
	'jquery', 'underscore', 'doubleunderscore/core',
	'workspace', 'util', 'autocomplete', 'cropper',
	'./fields.js',
	'text!./dope.jst', 'text!./toolbar.jst',
	'css!./dope.css'
],
function($, _, __, WorkSpace, util, AutoComplete, Cropper, fields, template, toolbar_template_string){
	var comptemplate = __.template(template);

	var DOPE = function DOPE () {
		var self = this;

		self.$element = $(comptemplate());
		self.$toolbar = $(toolbar_template_string);
		self.$target = self.$element.find('.dope_target');

		self.workspace = new WorkSpace({
			show_toolbar: true
		});
		self.workspace.appendElements(self.$element, self.$toolbar);

		self.fields = [];

		self.$toolbar.on('click', 'button.dope_accept_button', function(e){
			e.preventDefault();

			var errors = self.validateFields();
			if (!errors.length) {
				self.fire('accept', self.serializeFields(self.$target));
				self.workspace.close();
			};
		});

		self.$toolbar.on('click', 'button.dope_cancel_button', function(e){
			e.preventDefault();
			self.workspace.close();
		});

		// cropper

		var start = new Date();
		self.cropper = new Cropper();
		console.log((new Date() - start) + 'ms, new Cropper');

		__.globalevents.on('request_crop', function(requester, target_details, profiles){
			console.log('request_crop', arguments);
			self.cropper.display(target_details, profiles, function(cropper, data_list){
				requester.ingest(target_details, data_list);
			});
		});


		// autocomplete for tags

		self.tags_autocomplete = new AutoComplete({
			selector: 'input.list_editor_input',
			propertyName: 'name'
		});

		self.tags_autocomplete.on('type', function(text){
			if (text) {
				util.hitAPI({
					verb: 'GET',
					context: __.sprintf('tag/search/%s', text), // id or collection type
					limit: 6,
					success: function(items, total){
						self.tags_autocomplete.render(text, items);
					},
					error: function(){
						self.tags_autocomplete.render(text, []);
					}
				});
			} else {
				self.tags_autocomplete.setDisplay(false);
			};
		});

		self.tags_autocomplete.global_name = 'autocomplete';
	};

	DOPE.prototype.open = function open () {
		var self = this;

		self.fire('open');
		self.workspace.open();
	};

	DOPE.prototype.render = function render (schema, changeable_data, full_data, context) {
		var self = this;

		self.fields = self.createFields(schema, changeable_data, full_data, context);

		var div = document.createElement('div'), counter = 0, limit = self.fields.length;
		while (counter < limit) {
			div.appendChild(self.fields[counter].element);
			counter++;
		};

		div.className = 'fields_master';

		self.$target.html('');
		self.$target.append(div);
	};

	DOPE.prototype.createFields = function createFields (schema, changeable_data, full_data, contexts) {
		var self = this;

		var working = [];

		_.each(schema.attributes, function(value, key, dict){
			if (!value || !value.hasOwnProperty('type') || value.visible_in_admin === false) { return; }

			// if the schema has defined some contexts to limit this field
			if (value.limit_to_contexts && value.limit_to_contexts.length) {
				if (contexts.length) {
					// the block has some contexts, and not one element of array exists in the other
					if (_.intersection(value.limit_to_contexts, contexts).length === 0) {
						return;
					};

				// if the block doesn't have a defined context, and single is not a valid context
				} else if (!_.contains(value.limit_to_contexts, 'single')) {
					return;
				};
			};

			switch (value.type) {

			case 'array':
				var counter = 0;
				var new_array = new fields['fields_array']({
					type: 'fields_array',
					keyname: key,
					description: value.description || null
				});

				while (counter < value.max) {
					new_array.addFields(self.createFields(value, __.path(changeable_data, __.sprintf('%s.%s', key, counter)), full_data, contexts));
					counter++;
				};

				working.push(new_array);
			break;

			case 'imagepath':
				working.push(new fields['imagepath']({
					type: value.type,
					keyname: key,
					label: value.label || key,
					data: __.path(changeable_data, key, ''),
					description: value.description || null,
					value: value,
					crop_profiles: __.path(schema, __.sprintf('attributes.%s.profiles', value.linked_profiles.crop)),
					watermark_profiles: __.path(schema, __.sprintf('attributes.%s.profiles', value.linked_profiles.watermark)),
					crop_data: __.path(changeable_data, value.linked_profiles.crop, null),
					watermark_data: __.path(changeable_data, value.linked_profiles.watermark, null),
					height: __.path(full_data, value.linked_dimensions.height, null),
					width: __.path(full_data, value.linked_dimensions.width, null),
				}));
			break;

			case 'profile_list':
				// skip this type, we are going to pair it with the imagepath
			break;

			default:
				working.push(new fields[value.type]({
					type: value.type,
					keyname: key,
					label: value.label || key,
					data: __.path(changeable_data, key, ''),
					description: value.description || null,
					value: value
				}));
			};
		});

		return working;
	};

	DOPE.prototype.validateFields = function () {
		var self = this;

		var errors = [];
		var counter = 0, limit = self.fields.length;
		while (counter < limit) {
			self.fields[counter].clearError();
			var response = self.fields[counter].validate();
			if (response !== true) {
				errors.push(response);
			};

			counter++;
		};

		return errors;
	};

	DOPE.prototype.serializeFields = function ($element) {
		var self = this;

		var working = {};

		var counter = 0, limit = self.fields.length;
		while (counter < limit) {
			var current = self.fields[counter];
			_.extend(working, current.serialize());
			counter++;
		};

		self.fire('serializeFields', working);
		console.log('dope serialize', working);
		return working;
	};

	__.augment(DOPE, __.PubSubPattern);
	return DOPE;
});
