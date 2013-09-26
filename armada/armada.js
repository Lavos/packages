define([
	'jquery', 'underscore', 'doubleunderscore/core',
	'text!./balloon.jst', 'css!./armada.css'
], function(
	$, _, __,
	balloon_template_string
){
	var balloon_template = __.template(balloon_template_string);

	var Armada = function Armada () {
		var self = this;

		self.elements = [];
		self.balloons = [];

		$(document).on('click', '[data-armada]', function(e){
			self.deploy(this);
		});
	};

	Armada.prototype.massDeply = function (name) {
		var self = this;

		$(__.sprintf('[data-armada="%s]', name)).each(function(){
			self.deploy(this);
		});
	};

	Armada.prototype.deploy = function deploy (element) {
		var self = this;

		if (self.elements.indexOf(element) === -1) {
			var $element = $(element);

			self.elements.push(element);
			self.balloons.push(new Balloon({
				target: $element,
				direction: $element.data('armada-direction') || 'right',
				style: $element.data('armada-style') || 'white',
				title: $element.data('armada-title') || null,
				body: $element.data('armada-body') || null,
				content_id: $element.data('armada-content-id') || null
			}));
		} else {
			self.balloons[self.elements.indexOf(element)].toggle();
		};
	};

	var Balloon = function Balloon (params) {
		var self = this;

		var defaults = {
			target: $(),
			direction: 'right',
			style: 'white',
			title: null,
			body: null,
			content_id: null
		};

		_.defaults(self.options = {}, params, defaults);

		self.$element = $(balloon_template(self.options, { __: __ }));
		self.element = self.$element[0];
		self.$target = self.options.target;
		self.shown = false;

		self.$target.after(self.element);

		if (self.options.content_id) {
			var target = document.getElementById(self.options.content_id);
			self.$element.find('.balloon-content').html(target.innerHTML);
		};

		var pos = self.$target.position();
		var applypos = {};

		switch (self.options.direction) {
		default:
		case 'top':
			applypos['left'] = pos.left;
			applypos['top'] = pos.top;
		break;

		case 'bottom':
			applypos['left'] = pos.left;
			applypos['top'] = pos.top + self.$target.outerHeight();
		break;

		case 'left':
			applypos['left'] = pos.left;
			applypos['top'] = pos.top;
		break;

		case 'right':
			applypos['left'] = pos.left + self.$target.outerWidth();
			applypos['top'] = pos.top;
		break;
		};

		self.$element.css(applypos);

		self.$element.on('click', '.balloon-close', function(){
			self.hide();
		});

		self.show();
	};

	Balloon.prototype.setShown = function setShown (shown) {
		var self = this;

		self.shown = shown;
		self.$element[shown ? 'removeClass' : 'addClass']('balloon-hidden');
	};

	Balloon.prototype.show = function show () {
		var self = this;

		self.setShown(true);
	};

	Balloon.prototype.hide = function hide () {
		var self = this;

		self.setShown(false);
	};

	Balloon.prototype.toggle = function toggle () {
		var self = this;

		self.setShown(!self.shown);
	};

	return new Armada();
});
