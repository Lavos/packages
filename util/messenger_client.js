define(['doubleunderscore/core'], function(__){
return (function(){
	var MessengerClient = function MessengerClient (params) {
		var self = this;

		var defaults = {
			url: '',
			params: {},
			reconnect: true,
			retry_delay: 5000,
			retry_attempts: 20
		};

		__.extend(self.options = {}, defaults, params);

		self.socket = null;
		self.fatal = false;
		self.attempts = 0;
		self.timer = null;
		self.state = 'closed';
		self.rooms = {};
	};

	__.augment(MessengerClient, __.PubSubPattern);
	MessengerClient.prototype.global_name = 'mc';

	MessengerClient.prototype.TYPE_EVENT = 'event';
	MessengerClient.prototype.TYPE_TEXT = 'text';

	MessengerClient.prototype.open = function open () {
		var self = this;

		if (self.state === 'open') {
			return;
		};

		if (self.timer) {
			clearTimeout(self.timer);
		};

		if (!(self.socket instanceof WebSocket)) {
			self.socket = new WebSocket(__.sprintf("%s%s", self.options.url, __.toQueryParams(self.options.params)));
		};

		self.socket.onopen = function(e){
			self.state = 'open';
			self.fatal = false;
			self.attempts = 0;

			self.fire('open', e);

			// rejoin channels
			__.each(self.rooms, function(bool, room_name){
				self.send({
					type: 'command',
					room: room_name,
					name: 'join'
				});
			});
		};

		self.socket.onclose = function(e){
			self.state = 'closed';
			self.fire('close', e);
			self.socket = null;

			if (self.options.reconnect && !self.fatal) {
				if (self.attempts >= self.options.retry_attempts) {
					return;
				};

				if (!self.timer) {
					self.attempts++;
					self.timer = setTimeout(function(){ self.timer = null; self.open(); }, self.options.retry_delay);
				};
			};
		};

		self.socket.onerror = function(e){
			self.state = 'closed';
			self.fire('error', e);
		};

		self.socket.onmessage = function(e){
			var message = null;

			try {
				message = JSON.parse(e.data);
			} catch (e) {
				return;
			};

			self.fire('message', message);
			self.fire.call(self, message.room, message.name, message.data);
			self.fire.call(self, __.sprintf("%s:%s", message.room, message.name), message.data, message.user);
			self.fire.call(self, message.name, message.room, message.data);
			
			if (__.hasPath(self, __.sprintf('rooms.%s', message.room))) {
				self.rooms[message.room].fire(message.name, message.data, message.user);
			};
		};
	};

	MessengerClient.prototype.close = function close (fatal) {
		var self = this;

		if (fatal) {
			self.fatal = fatal;
		};

		self.socket.close(1000, 'connection reset by peer.');
	};

	MessengerClient.prototype.send = function send (message) {
		var self = this;

		self.socket.send(JSON.stringify(message));
		self.fire('send', message);
	};

	MessengerClient.prototype.join = function join (room_name) {
		var self = this;

		if (!self.rooms.hasOwnProperty(room_name)) {
			self.rooms[room_name] = new Room(room_name);

			self.send({
				type: 'command',
				room: room_name,
				name: 'join',
				data: {}
			});

			self.fire('join', room_name);
			return self.rooms[room_name];
		};

		return null;
	};

	MessengerClient.prototype.part = function part (room_name) {
		var self = this;

		if (self.rooms.hasOwnProperty(room_name)) {
			delete self.rooms[room_name];

			self.send({
				type: 'command',
				room: room_name,
				name: 'part',
				data: {}
			});

			self.fire('part', room_name);
		};
	};

	var Room = function Room (room_name) {
		var self = this;

		self.name = room_name;
	};

	__.augment(Room, __.PubSubPattern);

	return MessengerClient;
})();
});
