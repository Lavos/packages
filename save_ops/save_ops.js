// save buttons
define([
	'jquery', 'underscore', 'doubleunderscore/core',
	'util', 'message',
	'text!./save_ops.jst', 'css!./save_ops.css'
],
function($, _, __, util, Message, template){
	var SaveOps = function SaveOps (params) {
		var self = this;

		var defaults = {
			target: $()
		};

		_.extend(self.options = {}, defaults, params);

		self.$element = $(self.comptemplate()).appendTo(self.options.target);
		self.$save_button = self.$element.find('button.save');
		self.$total = self.$element.find('span.total');
		self.$counter = self.$element.find('span.counter');

		self.ability = false;
		self.history_timer = null;
		self.count = 0;

		self.$element.on('click', '.save', function(e){
			e.preventDefault();

			self.setLoading(true);
			self.count = 0;
			self.fire('save');
		});

		self.$element.on('click', '.preview', function(e){
			e.preventDefault();

			self.fire('preview');	
		});
	};

	__.augment(SaveOps, __.PubSubPattern);

	SaveOps.prototype.comptemplate = __.template(template);

	SaveOps.prototype.setTotal = function setTotal (total) {
		var self = this;

		self.total = total;
		self.$total.text(total);
	};

	SaveOps.prototype.setCounter = function setCounter (counter) {
		var self = this;

		self.counter = counter;
		self.$counter.text(counter);
	};

	SaveOps.prototype.setLoading = function setLoading (loading) {
		var self = this;

		if (loading) { 
			self.$element.removeClass('waiting').addClass('loading');
		} else {
			self.$element.removeClass('loading').addClass('waiting');
		};
	};

	SaveOps.prototype.error = function error (message) {
		var self = this;

		var error_message = new Message({
			type: 'error',
			title: 'There was an error saving your story',
			message: message
		});

		error_message.on('error_dismiss', function(){
			self.setLoading(false);
		});
	};

	SaveOps.prototype.success = function success () {
		var self = this;

		self.setLoading(false);

		new Message({
			type: 'success',
			message: 'Save successfully completed!'
		});
	};

	return SaveOps;
});
