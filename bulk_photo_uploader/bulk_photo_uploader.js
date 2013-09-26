define([
	'jquery', 'underscore', 'doubleunderscore/core',
	'util',
	'sbarmodal', 'photo_uploader',
	'text!./bulk_photo_uploader.jst', 'text!./item.jst', 'css!./bulk_photo_uploader.css'
],
function($, _, __, util, SbarModal, PhotoUploader, template, item_template){
	var comptemplate = __.template(template);
	var itemtemplate = __.template(item_template);

	var BulkPhotoUploader = function BulkPhotoUploader (params) {
		var self = this;

		var defaults = {

		};

		_.extend(self.options = {}, defaults, params);

		self.items = [];

		self.$element = $(comptemplate(self.options));
		self.$preview = self.$element.find('.bulk_photo_uploader_preview');
		self.$target = self.$element.find('.bulk_photo_uploader_target');

		self.modal = new SbarModal();
		self.modal.appendContent(self.$element);

		self.photo_uploader = new PhotoUploader({
			target: self.$target,
			upload_count: 100
		});

		self.photo_uploader.on('upload', function(items){
			self.items = self.items.concat(items);
			self.renderItems();
		});

		self.modal.on('close', function(){
			self.reset();
		});

		self.$element.on('click', '.bulk_photo_uploader_import', function(e){
			e.preventDefault();

			self.fire('import', self.items);
			self.modal.close();
		});

		self.$element.on('click', '.bulk_photo_uploader_cancel', function(e){
			e.preventDefault();

			self.fire('cancel', self.items);
			self.reset();
			self.modal.close();
		});

		self.$element.on('click', '.bulk_photo_uploader_thumb', function(e){
			e.preventDefault();

			var index = $(this).data('index');
			self.items.splice(index, 1);
			self.renderItems();
		});
	};

	__.augment(BulkPhotoUploader, __.PubSubPattern);

	BulkPhotoUploader.prototype.renderItems = function renderItems () {
		var self = this;

		var working = [];
		var counter = 0, limit = self.items.length;
		while (counter < limit) {
			if (self.items[counter] !== null) {
				working.push(itemtemplate({ path: util.imagid_path('thumb-med', self.items[counter].path), index: counter }));
			};

			counter++;
		};

		self.$preview.html(working.join(''));
	};


	BulkPhotoUploader.prototype.open = function open () {
		var self = this;

		self.modal.open();
	};

	BulkPhotoUploader.prototype.reset = function reset () {
		var self = this;

		self.items = [];
		self.renderItems();
		self.photo_uploader.reset();
	};

	return BulkPhotoUploader;
});
