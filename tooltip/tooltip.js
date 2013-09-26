define([
	'jquery', 'underscore', 'doubleunderscore/core',
	'text!./tooltip.jst',
	'css!./tooltip.css'
],
function($, _, __, template_string){
	var ToolTip = function ToolTip (params) {
		var self = this;

		var defaults = {
			target: $(),
			tooltip_element: $(),
			position: 'top'
		};

		_.extend(self.options = {}, defaults, params);

		self.$element = $(template_string).addClass(self.options.position);
		self.$content = self.options.tooltip_element.appendTo(self.$element);
		self.$content.removeClass('hide');
		self.$target = self.options.target;
		self.$target.after(self.$element);

		self.detachTimer = null;
		self.hideTimer = null;

		self.$element.on('mouseenter', function(e){
			if (self.hideTimer) {
				clearTimeout(self.hideTimer);
			};
		});

		self.$element.on('mouseleave', function(e){
			self.hideTimer = setTimeout(function(){
				self.hide();
			}, 1000);
		});

		self.$target.on('mouseenter', function(e){
			if (self.hideTimer) {
				clearTimeout(self.hideTimer);
			};

			self.show();
		});

		self.$target.on('mouseleave', function(e){
			self.hideTimer = setTimeout(function(){
				self.hide();
			}, 1000);
		});
	};

	__.augment(ToolTip, __.PubSubPattern);

	ToolTip.prototype.show = function show () {
		var self = this;

		if (self.detachTimer) {
			clearTimeout(self.detachTimer);
			self.detachTimer = null;
		};

		var pos = self.$target.position();
		self.tip_height = self.$element.outerHeight();
		self.tip_width = self.$element.outerWidth();
		self.target_width = self.$target[0].offsetWidth;
		self.target_height = self.$target[0].offsetHeight;

		var applypos = {};

		switch (self.options.position) {
		default:
		case 'top':
			applypos['left'] = pos.left - 7;
			applypos['top'] = pos.top - (self.tip_height + 7);
		break;

		case 'bottom':
			applypos['left'] = pos.left - 7;
			applypos['top'] = pos.top + (self.target_height + 7);
		break;

		case 'left':
			applypos['left'] = pos.left - (self.tip_width + 7);
			applypos['top'] = pos.top - 7;
		break;

		case 'right':
			applypos['left'] = pos.left + self.target_width + 7;
			applypos['top'] = pos.top - 7;
		break;
		};

		self.$element.css(applypos).removeClass('hide').addClass('reveal');
		self.fire('show');
	};

	ToolTip.prototype.hide = function hide () {
		var self = this;

		self.$element.removeClass('reveal');
		self.detachTimer = setTimeout(function(){
			self.$element.addClass('hide');
			self.$element.attr('style', '');
			self.detachTimer = null;
			self.fire('detach');
		}, 275);

		self.fire('hide');
	};

	return ToolTip;
});
