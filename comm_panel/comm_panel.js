define([
	'jquery', 'underscore', 'doubleunderscore/core',
	'util/messenger_client', 'message',
	'text!./comm_panel.jst', 'text!./icons.jst', 'text!./text.jst', 'text!./userlist.jst',
	'css!./comm_panel.css'
],
function($, _, __, MessengerClient, Message, template_string, icon_template_string, text_template_string, userlist_template_string){
	var icon_template = __.template(icon_template_string);
	var text_template = __.template(text_template_string);
	var userlist_template = __.template(userlist_template_string);

	var CommPanel = function CommPanel (params) {
		var self = this;

		var defaults = {
			user: {}
		};

		self.element = document.createElement('div');
		self.element.innerHTML = template_string;
		self.element.className = 'comm_panel_master';
		document.body.appendChild(self.element);

		self.$element = $(self.element);
		self.$icon_master = self.$element.find('.comm_panel_icon_master');
		self.$stream = self.$element.find('.comm_panel_stream');
		self.$userlist = self.$element.find('.comm_panel_userlist');
		self.$form = self.$element.find('.comm_panel_form');
		self.$input = self.$element.find('.comm_panel_input');

		_.extend(self.options = {}, defaults, params);
		self.name = __.sprintf("%s %s", self.options.user.first_name, self.options.user.last_name);

		self.client = new MessengerClient({
			url: __.sprintf('%s/room', LUCID.messenger.server),
			params: {
				user_name: self.name,
				user_id: self.options.user._id
			}
		});

		self.client.on('open close error', function(){
			self.client.join(window.location.pathname);
			self.updateIcons();
		});

		self.client.on(window.location.pathname + ':status', function(data){
			self.users = data.user_list;
			self.updateIcons();
		});

		self.client.on(window.location.pathname + ':text', function(data, user){
			self.$stream.append(text_template({ data: data, user: user }));
			self.setNewMessage(true);
		});

		self.users = [];
		self.open = false;
		self.new_message = false;

		self.$icon_master.on('click', function(){
			self.setOpen(!self.open);
		});

		self.$form.on('submit', function(e){
			e.preventDefault();

			if (self.$input.val()) {
				self.client.send({
					type: 'event',
					room: window.location.pathname,
					name: 'text',
					data: { text: self.$input.val() }
				});

				self.$input.val('');
			};
		});

		self.client.open();
	};

	__.augment(CommPanel, __.PubSubPattern);

	CommPanel.prototype.setNewMessage = function setNewMessage (new_message) {
		var self = this;

		if (new_message && !self.open) {
			self.new_message = true;
			self.$element.addClass('new_message');
		} else {
			self.new_message = false;
			self.$element.removeClass('new_message');
		};
	};

	CommPanel.prototype.setOpen = function setOpen (open) {
		var self = this;

		self.open = open;
		self.$element[open ? 'addClass' : 'removeClass']('show');
		self.setNewMessage(false);
	};

	CommPanel.prototype.updateIcons = function updateIcons () {
		var self = this;

		self.$icon_master.html(icon_template({
			users: self.users.length,
			state: self.client.state,
			new_message: self.new_message
		}));

		self.$userlist.html(userlist_template({
			users: self.users
		}));
	};

	return CommPanel;
});
