define([
	'jquery', 'underscore', 'doubleunderscore/core',
	'util',
	'text!./workspace.jst',
	'css!./workspace.css'
],
function($, _, __, util, main_template_string){
	var WorkSpace = function WorkSpace (params) {
		var self = this;

		var defaults = {
			show_toolbar: false
		};

		_.extend(self.options = {}, defaults, params);

		self.isOpen = false;
		self.$body = $('body');
		self.$html = $('html');
		self.$element = $(main_template_string).appendTo(self.$body);
		self.$content_target = self.$element.find('[data-workspace-content-target]');
		self.$toolbar_target = self.$element.find('[data-workspace-toolbar-target]');

		if (self.options.show_toolbar) {
			self.$element.addClass('workspace_show_toolbar');
		};
	};

	__.augment(WorkSpace, __.PubSubPattern);

	WorkSpace.prototype.appendElements = function appendElements (content_element, toolbar_element) {
		var self = this;

		self.$content_target.append(content_element);

		if (toolbar_element) {
			self.$toolbar_target.append(toolbar_element);
		};

		self.fire('append', content_element, toolbar_element);
	};

	WorkSpace.prototype.close = WorkSpace.prototype.hide = function close () {
		var self = this;

		self.isOpen = false;

		self.$element.removeClass('workspace_show');
		self.$body.removeClass('noscroll');
		self.$html.removeClass('noscroll');

		self.fire('close');
	};

	WorkSpace.prototype.show = WorkSpace.prototype.open = function open (bool) {
		var self = this;

		if (bool === false) {
			return self.close();
		};

		self.isOpen = true;

		self.$body.addClass('noscroll');
		self.$html.addClass('noscroll');
		self.$element.addClass('workspace_show');

		self.fire('open');
	};

	return WorkSpace;
});
