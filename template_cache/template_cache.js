// admin templates
define(['jquery', 'doubleunderscore/core'], function($, __){
	var TemplateCache = function (params) {
		var self = this;
		self.cache = {};
		self.source = {};
	};

	TemplateCache.prototype.buildCache = function buildCache ($element, type) {
		var self = this;

		var $element = $element || $(document);
		var type = type || 'text/html';	

		self.$scripts = $element.find('script[type="' + type +'"]').each(function(index){
			var html = this.innerHTML;
			self.cache[this.id] = __.template(html);
			self.source[this.id] = html;
		});
	};

	TemplateCache.prototype.add = function add (id, template_string) {
		var self = this;

		self.cache[id] = __.template(template_string);
	};

	return TemplateCache;
});
