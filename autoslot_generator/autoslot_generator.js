define([
	'jquery', 'underscore', 'doubleunderscore/core', 'autocomplete', 'list_editor', 'util',
	'text!./main.jst', 'css!./style.css'
], function(
	$, _, __, AutoComplete, ListEditor, util,
	main_string
){
	var AutoSlotGenerator = function AutoSlotGenerator (params) {
		var self = this;

		var defaults = {
			target: $(),
		};

		self.options = _.defaults(params, defaults);

		self.element = __.strToElement(main_string);
		self.$element = $(self.element);
		self.$target = self.options.target.append(self.element);

		self.list_editor = new ListEditor({
			element: self.$element.find('.list_editor_target')
		});

		self.$input = self.$element.find('input.list_editor_input');

		self.autocomplete = new AutoComplete({
			element: self.$input,
			allowNew: false
		});

		self.autocomplete.on('type', function(text){
			if (text) {
				util.hitAPI({
					verb: 'GET',
					context: __.sprintf('tag/search/%s', text), // id or collection type
					where: { 'category': true },
					limit: 6,
					success: function(items, total){
						self.autocomplete.render(text, items);
					},
					error: function(){
						self._autocomplete.render(text, []);
					}
				});
			} else {
				self.autocomplete.setDisplay(false);
			};
		});

		self.autocomplete.on('choose', function(tag){
			console.log('choose', tag);

			self.list_editor.render([tag]);
		});

		self.$element.on('click', '[data-action="clear"]', function(){
			self.list_editor.clear();
		});

		self.$element.on('click', '[data-action="add"]', function(){
			self.fire('add', self.list_editor.serialize());
		});
	};

	__.augment(AutoSlotGenerator, __.PubSubPattern);

	return AutoSlotGenerator;
});
