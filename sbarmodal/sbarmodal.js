define([
	'jquery', 'underscore', 'doubleunderscore/core',
	'util',
	'text!./sbarmodal.jst', 'css!./sbarmodal.css'
],
function($, _, __, util, template){
	var SbarModal = function SbarModal (params) {
		var self = this;

		self.isOpen = false;

		var defaults = {
			contentID: null,
			width: null,
			top: null
		};

		_.extend(self.options = {}, defaults, params);

		self.jq = {
			element: $(template).appendTo('body'),
			doc: $(document),
			body: $('body'),
			html: $('html')
		};

		var extender = {
			content: self.jq.element.find('.sbar_content'),
			target: self.jq.element.find('.sbar_target')
		};

		_.extend(self.jq, extender);

		self.jq.element.on('click', '.sbar_close', function(e){
			e.preventDefault();
			self.hide();
		});

		if (self.options.contentID) {
			self.appendContent(document.getElementById(self.options.contentID));
		};

		if (self.options.top) {
			self.jq.content.css('margin-top', self.options.top);
		};
	};

	__.augment(SbarModal, __.PubSubPattern);

	SbarModal.prototype.appendContent = function (targetElement) {
		var self = this;

		self.jq.targetElement = $(targetElement);
		self.jq.target.append(self.jq.targetElement);

		self.fire('append', self.jq.targetElement);

		/* exporting self so that we can close it outside this context */
		self.jq.targetElement.data('overlay', self);
	};

	SbarModal.prototype.close = SbarModal.prototype.hide = function () {
		var self = this;
		self.isOpen = false;

		self.jq.element.scrollTop(0);
		self.jq.element.removeClass('sbar_show');
		self.jq.body.removeClass('sbar_noscroll');
		self.jq.html.removeClass('sbar_noscroll');

		self.fire('close');
	};

	SbarModal.prototype.show = SbarModal.prototype.open = function (link) {
		var self = this;
		self.isOpen = true;

		self.jq.body.addClass('sbar_noscroll');
		self.jq.html.addClass('sbar_noscroll');

		if (self.options.width) {
			self.jq.content.css('width', self.options.width);
		} else {
			/* adding display, and setting visibility hidden offpage to calc width */
			self.jq.element.addClass('sbar_dbutnv');
			self.jq.content.css('width', self.jq.targetElement.outerWidth());
			self.jq.element.removeClass('sbar_dbutnv');
		};

		self.jq.element.addClass('sbar_show');

		self.jq.doc.one('keyup', function(e){
			if (e.which === 27) { self.hide(); };
		});

		self.fire('open');
	};

	return SbarModal;
});
