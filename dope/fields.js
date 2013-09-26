define([
	'jquery', 'underscore', 'doubleunderscore/core',
	'util', 'util/xhr_upload', 'list_editor', 'photo_uploader', 'template_cache', 'tooltip', 'shardviewer', 'message', 'armada',
	'text!./fields.jhtml', 'text!./searcher.jhtml', 'text!templates/stats.jst'
],
function(
	$, _, __,
	util, XHRUpload, ListEditor, PhotoUploader, TemplateCache, ToolTip, ShardViewer, Message, Armada,
	fields_html, searcher_html, stats_template_string
){
	var template_cache = new TemplateCache();
	var div = document.createElement('div');
	div.innerHTML = fields_html + searcher_html;
	template_cache.buildCache($(div));

	var fields = {};

	var Field = function Field (params) {
		var self = this;

		var defaults = {
			type: '',
			keyname: 'key',
			label: '',
			description: null,
			limit_to_contexts: [],
			data: {}
		};

		_.extend(self.options = {}, defaults, params);
		self.data = self.options.data;

		self.element = document.createElement('div');
		self.element.className = 'field';
		self.$element = $(self.element);

		if (self._applyDecorations) {
			self._applyDecorations();
		};
	};

	Field.prototype.render = function render () {
		var self = this;
		self.element.innerHTML = template_cache.cache[__.sprintf('schema_%s', self.options.type)](self.options, { _:_, __: __, util: util });
	};

	Field.prototype.validate = function validate () {
		var self = this;

		return true;
	};

	Field.prototype.clearError = function clearError () {
		var self = this;

		self.$element.find('.help-inline').text('');
		self.$element.find('.control-group').removeClass('error');
	};

	Field.prototype.throwError = function throwError (message) {
		var self = this;

		self.$element.find('.help-inline').text(message);
		self.$element.find('.control-group').addClass('error');
		return message;
	};

	Field.prototype.serialize = function serialize () {
		var self = this;

		var response = {};
		response[self.options.keyname] = self.$element.find('[data-field-value]').val();
		return response;
	};


	var FieldsArray = __.inherits(Field, function(params){
		var self = this;

		self.fields = [];
		self.render();
	});

	FieldsArray.prototype.serialize = function serialize () {
		var self = this;

		var working = [], counter = 0, limit = self.fields.length;
		while (counter < limit) {
			var current = self.fields[counter];
			var obj = {};
			obj[current.options.keyname] = self.fields[counter].serialize();
			working.push(obj);
			counter++;
		};

		var response = {};
		response[self.options.keyname] = working;
		return response;;
	};

	FieldsArray.prototype.addFields = function addFields (fields) {
		var self = this;

		self.fields = self.fields.concat(fields);

		var counter = 0, limit = fields.length;
		while (counter < limit) {
			self.element.appendChild(fields[counter].element);
			counter++;
		};
	};

	fields['fields_array'] = FieldsArray;

	fields['shorttext'] = __.inherits(Field, function(){
		this.render();
	});
	fields['longtext'] = __.inherits(Field, function(){
		this.render();
	});
	fields['embed'] = __.inherits(Field, function(){
		this.render();
	});

	var DateField = __.inherits(Field, function() {
		var self = this;

		self.$element.on('click', '[data-now]', function(e){
			self.$element.find('[data-field-value]').val(__.strftime('%Y-%m-%d %T', new Date()));
		});

		self.$element.on('click', '[data-clear]', function(e){
			self.$element.find('[data-field-value]').val('');
		});

		self.render();
	});
	fields['date'] = DateField;

	DateField.prototype.validate_regex = /(20[0-9]{2})-(1[0-2]|0*[0-9])-(3[0-1]|2[0-9]|1[0-9]|0*[1-9]) (2[0-3]|1[0-9]|0*[0-9]):(5[0-9]|4[0-9]|3[0-9]|2[0-9]|1[0-9]|0[0-9]):(5[0-9]|4[0-9]|3[0-9]|2[0-9]|1[0-9]|0[0-9])/;

	DateField.prototype.parse_date = function (str) {
		var self = this;

		var matches = self.validate_regex.exec(str);

		if (!matches || matches.length < 7) {
			return false;
		};

		return {
			 year: parseInt(matches[1], 10),
			 month: parseInt(matches[2], 10),
			 day: parseInt(matches[3], 10),
			 hours: parseInt(matches[4], 10),
			 minutes: parseInt(matches[5], 10),
			 seconds: parseInt(matches[6], 10)
		};
	};

	DateField.prototype.validate = function () {
		var self = this;

		var str = self.$element.find('[data-field-value]').val();
		if (str.length === 0) {
			return true;
		};

		var numbers = self.parse_date(str);
		if (!numbers) {
			return self.throwError('Specified text does not meet the format requirements.');
		};

		var months_31 = [1, 3, 5, 7, 8, 10, 12];
		var months_30 = [4, 6, 9, 11];

		if (_.contains(months_30, numbers.month) && numbers.day > 30) {
			return self.throwError('Month and day combo is invalid.');
		};

		if (numbers.month === 2 && numbers.day > 28 && !((numbers.year % 4 === 0 && numbers.year % 100) || numbers.year % 400)) {
			return self.throwError('February does not have more than 28 days that year.');
		};

		return true;
	};

	DateField.prototype.serialize = function () {
		var self = this;

		var str = self.$element.find('[data-field-value]').val();
		if (str.length === 0) {
			return 0;
		};

		var numbers = self.parse_date(str);
		if (!numbers) {
			return false;
		};

		var response = {};
		response[self.options.keyname] = parseInt((new Date(numbers.year, numbers.month-1, numbers.day, numbers.hours, numbers.minutes, numbers.seconds, 0)).getTime()/1000, 10);
		return response;
	};



	var Flag = __.inherits(Field, function(){
		this.render();
	});
	fields['flag'] = Flag;

	Flag.prototype.serialize = function() {
		var self = this;

		var response = {};
		response[self.options.keyname] = self.$element.find('[data-field-value]').is(':checked');
		return response;
	};


	var IPImage = function (path, width, height) {
		this.path = path;

		this.setEffective();

		this.original_width = width;
		this.original_height = height;

		if (this.original_width > 700) {
			this.effective_width = 700;
			this.effective_height = (this.effective_width * this.original_height) / this.original_width;
		} else {
			this.effective_width = this.original_width;
			this.effective_height = this.original_height;
		};
	};

	IPImage.prototype.setEffective = function setEffective (watermark_data) {
		var self = this;

		this.effective = util.imagid_path('cropper-effective', this.path);

		if (!_.isEmpty(watermark_data)) {
			this.watermarked = util.crop_path('cropper-effective', this.path) + __.toQueryParams({ w: JSON.stringify(watermark_data) });
		} else {
			this.watermarked = null;
		};
	};

	var ImagePath = __.inherits(Field, function(params){
		var self = this;

		self.clear();

		_.each(self.options.crop_data, function(value, key){
			self.crop_data[key] = _.clone(value);
		});

		_.each(self.options.watermark_profiles, function(value, key){
			if (__.hasPath(self, 'options.watermark_data.' + key)) {
				self.has_watermarks = true;
				self.watermark_data[key] = _.clone(self.options.watermark_data[key]);
			};
		});

		self.image = new IPImage(__.path(self, 'options.data'), __.path(self, 'options.width'), __.path(self, 'options.height'));
		self.image.setEffective(self.watermark_data);

		self.xhru = new XHRUpload({
			url: '/api/photo/upload',
			key: 'photo'
		});

		self.$element.on('click', '[data-imagepath-upload]', function(e){
			e.preventDefault();

			var $file = self.$element.find('[data-imagepath-file]');
			var new_file = _.toArray($file[0].files)[0];

			if (new_file) {
				self.xhru.send(new_file);
			};
		});

		self.$element.on('click', '[data-imagepath-remove]', function(e){
			e.preventDefault();

			self.clear();
			self.render();
		});

		self.xhru.on('success', function(data){
			self.clear();
			self.image = new IPImage(data.items.path, data.items.width, data.items.height);
			self.render();
		});

		self.$element.on('click', '[data-type]', function(){
			var $this = $(this);
			var profile = $this.data('profile');
			var type = $this.data('type');

			var work = {
				key: profile
			};

			_.extend(work, self.image, self.options[type + '_profiles'][profile]);
			__.globalevents.fire('request_crop', self, work, self[type + '_data'][profile]);
		});

		self.render();
	});

	ImagePath.prototype.clear = function clear () {
		var self = this;

		self.image = {};
		self.crop_data = {};
		self.watermark_data = {};
	};

	ImagePath.prototype.ingest = function ingest (work, data_list) {
		var self = this;

		switch (work.type) {
		case 'crop':
			self.crop_data[work.key] = data_list[0];
		break;

		case 'watermark':
			self.watermark_data[work.key] = data_list;
			self.image.setEffective(self.watermark_data);
		break;
		};

		self.render();
	};

	ImagePath.prototype.render = function render () {
		var self = this;
		self.element.innerHTML = template_cache.cache['schema_imagepath'](self, { _:_, __: __, util: util });
	};

	ImagePath.prototype.serialize = function serialize () {
		var self = this;

		var resp = {};
		resp[__.path(self, 'options.keyname')] = self.image.path;
		resp[__.path(self, 'options.value.linked_profiles.crop')] = self.crop_data;
		resp[__.path(self, 'options.value.linked_profiles.watermark')] = self.watermark_data;
		return resp;
	};

	fields['imagepath'] = ImagePath;

	var List = __.inherits(Field, function(params){
		var self = this;

		self.render();

		self.list_editor = new ListEditor({
			element: self.$element.find('[data-interface="list_editor"]'),
			fieldName: self.options.keyname,
			primaryKeyName: '_id',
			displayPropertyName: 'name',
			limit: __.path(self, 'options.value.limit', 0)
		});

		self.list_editor.render(self.data || []);

		__.globalevents.on('autocomplete_choose', function(autocomplete, value, target){
			if (target === self.list_editor.input) {
				self.list_editor.render([value]);
			};
		});
	});

	List.prototype.serialize = function serialize () {
		var self = this;

		var response = {};
		response[self.options.keyname] = self.list_editor.serialize();
		return response;
	};

	fields['list'] = List;


	var Select = __.inherits(Field, function(){
		this.render();
	});
	fields['select'] = Select;

	var Searcher = __.inherits(Field, function Searcher (params) {
		var self = this;

		self.render();

		self.$selected_target = self.$element.find('span.selected_target');
		self.$shardviewer_target = self.$element.find('.shardviewer_target');

		self.item_cache = null;
		self.selected = null;

		self.$element.on('click', '[data-action="select"]', function(e){
			e.preventDefault();

			var $this = $(this);
			self.select(self.item_cache[$this.data('index')]);
		});

		self.$element.on('click', '[data-action="clear"]', function(e){
			e.preventDefault();

			self.select(null);
		});

		if (self.data) {
			self.select(self.data);
		};
	});

	Searcher.prototype.serialize = function serialize () {
		var self = this;

		var response = {};
		response[self.options.keyname] = self.selected;
		return response;
	};

	Searcher.prototype.select = function select (value) {
		var self = this;

		self.selected = value;
		if (self.selected) {
			self.$selected_target.html(template_cache.cache[__.sprintf('%s_selected_template', self.options.type)](self.selected, { util: util }));
		} else {
			self.$selected_target.html('None Selected');
		};
	};

	Searcher.prototype.getShard = function getShard () {
		var self = this;

		util.hitAPI({
			verb: 'GET',
			context: self.context,
			sort: self.shardviewer.sort_property,
			offset: self.shardviewer.offset,
			direction_asc: self.shardviewer.sort_asc,
			limit: self.shardviewer.options.limit,
			where: self.shardviewer.filter,
			success: function(items, total){
				self.shardviewer.total = total;
				self.shardviewer.display(items);
				self.item_cache = items;
			},
			error: function(message, error_map){
				new Message({ type: 'error', title: 'ShardViewer', message: 'We could not update the table with the data from the server. Try reloading the page to try again.' });
			}
		});
	};

	fields['user_search'] = __.inherits(Searcher, function UserSearch (params){
		var self = this;

		self.context = 'user';

		self.shardviewer = new ShardViewer({
			target: self.$shardviewer_target,
			table_template_string: template_cache.source[__.sprintf('%s_table_template', self.options.type)],
			row_template_string: template_cache.source[__.sprintf('%s_row_template', self.options.type)],
			limit: 10,
			schema: __.path(LUCID, 'schema.User.attributes', null)
		});

		self.shardviewer.on('request_shard', function(){ self.getShard(); });

		self.$element.on('click', '[data-action="myself"]', function(e){
			e.preventDefault();

			self.select(LUCID.current_user);
		});

		self.shardviewer.fire('request_shard');
	});

	fields['story_search'] = __.inherits(Searcher, function StorySearch (params){
		var self = this;

		self.context = 'story';

		self.shardviewer = new ShardViewer({
			target: self.$shardviewer_target,
			table_template_string: template_cache.source[__.sprintf('%s_table_template', self.options.type)],
			row_template_string: template_cache.source[__.sprintf('%s_row_template', self.options.type)],
			limit: 10,
			schema: __.path(LUCID, 'schema.Story.attributes', null)
		});

		self.shardviewer.on('request_shard', function(){ self.getShard(); });

		self.shardviewer.fire('request_shard');
	});

	var Stats = {
		stats_template: __.template(stats_template_string),
		word_regex: /\S+/g,
		init: function(){
			var self = this;

			self.$element.find('[data-stats]').each(function(){
				var $wrapper = $(this);
				var $stats = $wrapper.find('[data-stats-target]');
				var $input = $wrapper.find('[data-stats-input]');

				function render () {
					var value = $input.val();
					var word_count = value.match(Stats.word_regex);

					$stats.html(Stats.stats_template({
						characters: value.length,
						words: word_count ? word_count.length : 0
					}));
				};

				$input.on('input', render);
				render();
			});
		}
	};

	__.decorate(fields['shorttext'].prototype, Stats);
	__.decorate(fields['longtext'].prototype, Stats);

	return fields;
});
