define([
	'jquery', 'underscore', 'doubleunderscore/core',
	'text!./message.jst', 'css!./message.css'
],
function($, _, __, template){
	var holder = document.createElement('div');
	holder.id = 'message_master';
	document.getElementsByTagName('body')[0].appendChild(holder);

	var Message = function Message (params) {
		var self = this;

		var defaults = {
			type: 'info',
			title: null,
			message: '',
			timeout_ms: 3500,
			timeout: true
		};

		_.extend(self.options = {}, defaults, params);

		self.$element = $(self.template(self.options)).appendTo(holder);
		self.timer = null;

		function clear () {
			self.fire('clear');

			setTimeout(function() {
				self.$element.remove();
			}, 350);

			if (self.timer) {
				clearTimeout(self.timer);
			};

			self.$element.addClass('disappear');
		};

		if (self.options.type !== 'error') {
			if (self.options.timeout) {
				self.timer = setTimeout(clear, self.options.timeout_ms);

				self.$element.on('mouseenter', function(){
					if (self.timer) {
						clearTimeout(self.timer);
					};
				});

				self.$element.on('mouseleave', function(){
					self.timer = setTimeout(clear, self.options.timeout_ms);
				});
			};

			self.$element.on('click', function(e){
				e.preventDefault();
				clear();
			});
		} else {
			self.$element.on('click', '[data-message-action="dismiss"]', function(e){
				e.preventDefault();

				self.fire('error_dismiss');
				clear();
			});
		};
	};

	__.augment(Message, __.PubSubPattern);
	Message.prototype.template = __.template(template);
	Message.prototype.global_name = 'message';

	return Message;
});
