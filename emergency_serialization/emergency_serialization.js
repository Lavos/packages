define([
	'jquery', 'underscore', 'doubleunderscore/core',
	'sbarmodal', 'message',
	'text!./emergency_serialization.jst', 'text!./error_message.jst', 'css!./emergency_serialization.css'
],
function($, _, __, SbarModal, Message, template, error_template){
	var comptemplate = __.template(template);
	var error_comptemplate = __.template(error_template);

	var EmergencySerialization = function EmergencySerialization (params) {
		var self = this;

		self.modal = new SbarModal();
		self.$element = $(comptemplate());
		self.modal.appendContent(self.$element);

		self.$get_textarea = self.$element.find('.emergency_serialization_getting textarea');
		self.$set_textarea = self.$element.find('.emergency_serialization_setting textarea');

		self.$element.on('submit', function(e){
			e.preventDefault();

			try {
				var obj = JSON.parse(self.$set_textarea.val());
				self.fire('import', obj);
				self.close();

				new Message({
					type: 'success',
					message: 'Data import completed successfully!'
				});
			} catch (e) {
				var message = 'Could not parse the pasted data.';
				self.fire('error', message);
				self.throwError(message);
			};
		});
	};

	EmergencySerialization.prototype.throwError = function throwError (message) {
		var self = this;

		new Message({
			type: 'error',
			title: 'Date Import Error',
			message: message
		});
	};

	EmergencySerialization.prototype.open = function open (obj) {
		var self = this;

		self.$get_textarea.val(JSON.stringify(obj));
		self.modal.open();
	};

	EmergencySerialization.prototype.close = function close () {
		var self = this;

		self.modal.close();
		self.$set_textarea.val('');
	};

	__.augment(EmergencySerialization, __.PubSubPattern);

	return EmergencySerialization;
});
