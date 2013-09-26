define([
	'jquery', 'underscore', 'doubleunderscore/core',
	'util',
	'text!./scheduler.jst', 'text!./slot_template.jst', 'text!./puck_template.jst', 'text!./day_template.jst', 'text!./day_nav_template.jst',
	'css!./scheduler.css'
],
function($, _, __, util, template, slot_template, puck_template, day_template, day_nav_template){
	var comptemplate = __.template(template);
	var slottemplate = __.template(slot_template);
	var pucktemplate = __.template(puck_template);
	var daytemplate = __.template(day_template);
	var daynavtemplate = __.template(day_nav_template);

	var Scheduler = function Scheduler (params) {
		var self = this;

		var defaults = {
			element: $(),
			nav_target: $(),
			loose_pucks: [],
			set_pucks: [],
			display_key: 'title',
		};

		_.extend(self.options = {}, defaults, params);

		self.$element = $(comptemplate()).appendTo(self.options.element);
		self.$day_target = self.$element.find('.scheduler_day_target');
		self.$puck_target = self.$element.find('.scheduler_puck_target');
		self.$day_nav_target = self.options.nav_target;

		self.now = new Date();
		self.this_morning = new Date(self.now.getFullYear(), self.now.getMonth(), self.now.getDate(), 0, 0, 0, 0);

		self.current_day_index = 0;
		self.days = [];
		self.pucks = [];
		self.renderPucks(self.options.loose_pucks);

		var start = new Date();
		// render 7 days
		var day_fragment = document.createDocumentFragment();

		var counter = 0, limit = 7;
		while (counter < limit) {
			var new_day = new Day(__.relativeDate(self.this_morning, { days: counter }));

			self.days.push(new_day);
			day_fragment.appendChild(new_day.element);
			counter++;
		};
		console.log((new Date() - start) + 'ms, render days');

		self.$day_target.append(day_fragment);
		self.$day_nav_target.html(daynavtemplate({ days: self.days }));

		self.setCurrentDay(0);

		self.$day_nav_target.on('click', 'a.scheduler_nav_link', function(e){
			e.preventDefault();
			self.setCurrentDay($(this).data('index'));
		});


		// set pucks processing

		var sp_counter = 0, limit = self.options.set_pucks.length;
		while (sp_counter < limit) {
			var current_puck = self.options.set_pucks[sp_counter];

			var largest_smaller_index = null;
			var days_counter = 0, days_limit = self.days.length;
			while (days_counter < days_limit) {
				if (self.days[days_counter].day.getTime() <= current_puck.publish_date * 1000) {
					largest_smaller_index = days_counter;
				} else {
					break;
				};

				days_counter++;
			};

			if (largest_smaller_index !== null) {
				var new_puck = new Puck({
					disassociate_target: self.$puck_target,
					payload: current_puck
				});

				self.pucks.push(new_puck);
				self.days[largest_smaller_index].placePuck(new_puck);
			};

			sp_counter++;
		};
	};

	Scheduler.prototype.setCurrentDay = function setCurrentDay (index) {
		var self = this;

		self.days[self.current_day_index].setActive(false);
		self.current_day_index = index;
		self.days[index].setActive('true');
	};

	Scheduler.prototype.renderPucks = function renderPucks (pucks) {
		var self = this;

		self.pucks = [];

		var fragment = document.createDocumentFragment();
		var counter = 0, limit = pucks.length;
		while (counter < limit) {
			var new_slot = new Puck({
				disassociate_target: self.$puck_target,
				payload: pucks[counter],
				index: counter,
				display_key: self.options.display_key
			});
			fragment.appendChild(new_slot.element);
			self.pucks.push(new_slot);

			counter++;
		};

		self.$puck_target.html('');
		self.$puck_target.append(fragment);
	};

	__.augment(Scheduler, __.PubSubPattern);


	var Day = function Day (day) {
		var self = this;

		self.day = day;
		self.day_title = __.strftime('%A %B %d %Y', self.day);

		self.$element = $(daytemplate({ day_title: self.day_title }));
		self.element = self.$element[0];
		self.$slot_target = self.$element.find('.scheduler_slot_target');

		self.slots = [];

		var fragment = document.createDocumentFragment();

		var day_morning = new Date(self.day.getFullYear(), self.day.getMonth(), self.day.getDate(), 6, 30, 0, 0);
		var counter = 0, limit = 30;
		while (counter < limit) {
			var new_slot = new Slot(__.relativeDate(day_morning, { minutes: 30 * counter }));
			fragment.appendChild(new_slot.element);
			self.slots.push(new_slot);
			counter++;
		};

		self.$slot_target.append(fragment);

		self.$element.on('submit', 'form', function(e){
			e.preventDefault();

			var $form = $(this);

			var dict = __.dict($form.serializeArray());
			var matches = self.time_string_regex.exec(dict['time_string']);
			$form.trigger('reset');

			if (!matches || matches.length < 3) {
				return false;
			};

			var destination_date = new Date(self.day.getFullYear(), self.day.getMonth(), self.day.getDate(), parseInt(matches[1], 10), parseInt(matches[2], 10), 0, 0);

			self.insertSlot(destination_date);
		});

	};

	Day.prototype.time_string_regex = /^(0*[0-9]|1[0-9]|2[0-3]):(0[0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])$/;

	Day.prototype.setActive = function setActive (active) {
		var self = this;

		if (active) {
			self.$element.addClass('active');
		} else {
			self.$element.removeClass('active');
		};
	};

	Day.prototype.placePuck = function placePuck (puck) {
		var self = this;

		var exact_match_index = null;
		var counter = 0, limit = self.slots.length;
		while (counter < limit) {
			if (self.slots[counter].day.getTime() === (puck.options.payload.publish_date * 1000)) {
				exact_match_index = counter;
				break;
			};

			counter++;
		};

		if (exact_match_index !== null && !self.slots[exact_match_index].puck) {
			self.slots[exact_match_index].associate(puck);
		} else {
			var new_slot = self.insertSlot(new Date(puck.options.payload.publish_date * 1000));
			new_slot.associate(puck);
		};
	};

	Day.prototype.insertSlot = function insertSlot (destination_date) {
		var self = this;

		var largest_smaller_index = null;

		var counter = 0, limit = self.slots.length;
		while (counter < limit) {
			if (self.slots[counter].day.getTime() <= destination_date.getTime()) {
				largest_smaller_index = counter;
			} else {
				break;
			};

			counter++;
		};

		var new_slot = new Slot(destination_date);

		if (largest_smaller_index === null) {
			self.$slot_target.prepend(new_slot.element);
			self.slots.unshift(new_slot);
		} else if (largest_smaller_index < self.slots.length-1) {
			self.$slot_target[0].insertBefore(new_slot.element, self.slots[largest_smaller_index+1].element);
			self.slots.splice(largest_smaller_index, 0, new_slot);
		} else {
			self.$slot_target.append(new_slot.element);
			self.slots.push(new_slot);
		};

		return new_slot;
	};

	__.augment(Day, __.PubSubPattern);



	var Slot = function Slot (day) {
		var self = this;

		self.day = day;
		self.$element = $(slottemplate({ day: self.day, __: __ }));
		self.element = self.$element[0];
		self.$drop_target = self.$element.find('.scheduler_drop_target');

		self.puck = null;

		self.$element.on('click', '[data-action="remove"]', function(e){
			e.preventDefault();

			if (self.puck) {
				self.disassociate();
			};
		});

		// dragging stuffs
		var current_dragging_puck = null;

		__.addEvent(self.element, 'dragover', self.cancelDND);
		__.addEvent(self.element, 'dragenter', self.cancelDND);

		__.addEvent(self.element, 'drop', function(e){
			e.preventDefault(); // prevent Firefox redirect

			if (self.puck) {
				self.disassociate();
			};

			self.associate(current_dragging_puck);
			return false;
		});

		__.globalevents.on('dragstart', function(puck, e){
			current_dragging_puck = puck;
		});

		__.globalevents.on('slot_associate', function(slot, puck, timestamp){
			if (slot !== self && self.puck === puck) {
				self.disassociate(true);
			};
		});
	};

	Slot.prototype.cancelDND = function cancelDND (e) {
		e.preventDefault(); // Chrome requires for "successful" drop, Firefox redirects
		e.dataTransfer.dropEffect = 'move';
		e.dataTransfer.effectAllowed = 'move';

		return false;
	};

	Slot.prototype.disassociate = function disassociate (silently) {
		var self = this;

		if (!silently) {
			self.fire('disassociate', self.puck);
		};

		self.$element.removeClass('associated');
		self.puck = null;
	};

	Slot.prototype.associate = function associate (puck, silently) {
		var self = this;

		self.puck = puck;

		if (!silently) {
			self.fire('associate', puck, self.day.getTime());
		};

		self.$drop_target.append(self.puck.element);
		self.$element.addClass('associated');
	};

	__.augment(Slot, __.PubSubPattern);
	Slot.prototype.global_name = 'slot';

	var Puck = function Puck (params) {
		var self = this;

		var defaults = {
			disassociate_target: $(),
			payload: 0,
			display_key: 'title'
		};

		_.extend(self.options = {}, defaults, params);

		self.$element = $(pucktemplate(self.options));
		self.element = self.$element[0];

		self.isDragging = false;

		__.addEvent(self.element, 'dragstart', function(e){
			e.stopPropagation();
			e.dataTransfer.dropEffect = 'move';
			e.dataTransfer.setData('text', 'dummy');

			self.isDragging = true;

			self.fire('dragstart', e);
			__.globalevents.fire('dragstart', self, e);
		});

		__.addEvent(self.element, 'dragover', function(e){
			// e.stopPropagation();

			if (self.isDragging) {
				self.setDragging(true);
			};
		});

		__.addEvent(self.element, 'dragend', function(e){
			e.stopPropagation();

			self.isDragging = false;

			self.fire('dragend');
			__.globalevents.fire('dragend', self);

			self.setDragging(false);
		});

		__.globalevents.on('slot_disassociate', function(slot, puck) {
			if (self === puck) {
				self.options.disassociate_target.append(self.element);
			};
		});
	};

	Puck.prototype.setDragging = function setDragging (dragging) {
		var self = this;

		if (dragging) {
			self.$element.addClass('dragging');
		} else {
			self.$element.removeClass('dragging');
		};
	};

	__.augment(Puck, __.PubSubPattern);

	return Scheduler;
});
