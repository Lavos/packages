define([
	'jquery', 'underscore', 'doubleunderscore/core',
],
function($, _, __){
	var hash_regex = /^#scrollto:([\w\d]+)$/;

	var Scroller = function Scroller () {
		var self = this;

		$(window).on('hashchange', self.moveWindow.bind(self));
		self.moveWindow();
	};

	__.augment(Scroller, __.PubSubPattern);
	Scroller.prototype.global_name = 'scroller';

	Scroller.prototype.moveWindow = function moveWindow (event) {
		var matches = hash_regex.exec(window.location.hash);
		if (matches) {
			if (event) {
				event.preventDefault();
			};

			var id = matches[1];
			var target = document.getElementById(id);

			if (target) {
				window.scrollTo(0, $(target).position().top - 86);
				this.fire('move_window');
			};
		};
	};

	return Scroller;
});
