define([
	'jquery', 'blocks', 'doubleunderscore/core',
	'sbarmodal',
	'text!./master.jst', 'text!./widget.jst',
	'css!./style.css'
], function(
	$, Blocks, __,
	SbarModal,
	master_template_string, widget_template_string
){

	// models

	var Target = Blocks.Model.inherits(function(){
		this.data = {
			path: '//sb-129.net/image/1200x1200',
			effective: '//sb-129.net/image/700x700',
			watermarked: '//sb-129.net/image/700x700',
			original_height: 1200,
			original_width: 1200,
			effective_height: 700,
			effective_width: 700,
			type: 'crop',
			ratio: 1,
			label: ''
		};
	});

	var Widget = Blocks.Model.inherits(function(target){
		this.target = target;
		this.x_ratio = this.target.get('original_width') / this.target.get('effective_width');
		this.y_ratio = this.target.get('original_height') / this.target.get('effective_height');
	}, {
		move: function (effective_x, effective_y) {
			effective_x = Math.max(0, effective_x);
			effective_y = Math.max(0, effective_y);

			var true_x = effective_x * this.x_ratio;
			var true_y = effective_y * this.y_ratio;

			if (true_x + this.get('w') > this.target.get('original_width')) {
				true_x = this.target.get('original_width') - this.get('w');
			};

			if (true_y + this.get('h') > this.target.get('original_height')) {
				true_y = this.target.get('original_height') - this.get('h');
			};

			this.set('x', true_x);
			this.set('y', true_y);
		},
		resize: function (effective_x) {
			effective_x = Math.max(0, effective_x);

			var true_x = effective_x * this.x_ratio;

			var width = true_x - this.get('x');

			if (width + this.get('x') > this.target.get('original_width')) {
				width = this.target.get('original_width') - this.get('x');
			};

			var height = width / this.target.get('ratio');

			if (height + this.get('y') > this.target.get('original_height')) {
				height = this.target.get('original_height') - this.get('y');
				width = height * this.target.get('ratio');
			};

			this.set('w', width);
			this.set('h', height);
		},
		getArea: function getArea () {
			return this.get('h') * this.get('w');
		}
	});

	var Watermark = Widget.inherits(function(){
		var dummy_width = this.target.get('original_width') /4;
		var dummy_height = Math.min(dummy_width / this.target.get('ratio'), this.target.get('original_height'));
		dummy_width = dummy_height * this.target.get('ratio');

		this.data = {
			x: 0,
			y: 0,
			h: dummy_height,
			w: dummy_width,
			o: 100
		};
	});

	var Crop = Widget.inherits(function(){
		var dummy_width = this.target.get('original_width') /2;
		var dummy_height = Math.min(dummy_width / this.target.get('ratio'), this.target.get('original_height'));
		dummy_width = dummy_height * this.target.get('ratio');

		this.data = {
			x: 0,
			y: 0,
			h: dummy_height,
			w: dummy_width
		};
	});

	// collections

	var WidgetList = Blocks.Collection.inherits(function(){}, {
		getLargest: function getLargest () {
			var largest_model = null, largest_area = 0, counter = this.length;
			while (counter--) {
				var model = this[counter];
				var area = model.getArea();
				if (area > largest_area) {
					largest_area = area;
					largest_model = model;
				};
			};

			return largest_model;
		}
	});

	// views

	var WidgetView = Blocks.View.inherits(function(model){
		this.model = model;
		this.model.on('change', this.render, this);
		this.model.on('destroy', this.destroy, this);
		this.element.innerHTML = this.template_string;

		this.$viewport = this.$element.find('.viewport');
		this.$viewport.addClass(this.model.target.get('type'));

		switch (this.model.target.get('type')) {
		case 'crop':
			var watermarked = this.model.target.get('watermarked');

			if (watermarked) {
				var src = watermarked;
			} else {
				var src = this.model.target.get('effective');
			};

			this.$viewport.css('backgroundImage', __.sprintf('url(%s)', src));
		break;

		case 'watermark':
		break;
		};

		this.render();
	}, {
		offset_x: 0,
		offset_y: 0,
		element_classes: 'widget',
		template_string: widget_template_string,
		comp_template: __.template(widget_template_string),
		events: [
			{ event_name: 'mousedown', selector: '.widget_handle_resize', function_name: 'start_resize' },
			{ event_name: 'mousedown', selector: '.viewport', function_name: 'start_move' },
			{ event_name: 'click', selector: '.widget_handle_delete', function_name: 'destroy_model' }
		],
		render: function render () {
			var settings = {
				'height': this.model.get('h') / this.model.y_ratio,
				'width': this.model.get('w') / this.model.x_ratio,
				'top': this.model.get('y') / this.model.y_ratio,
				'left': this.model.get('x') / this.model.x_ratio,
			};

			switch (this.model.target.get('type')) {
			case 'crop':
				settings['backgroundPosition'] = __.sprintf('-%spx -%spx', settings.left +2, settings.top +2);
			break;

			case 'watermark':
			break;
			};

			this.$viewport.css(settings);
		},

		setActive: function setActive (active) {
			this.$element[this.active = active ? 'addClass' : 'removeClass']('active');
			$(window).one('mouseup', this.stop.bind(this));
		},

		destroy_model: function destroy_model () {
			this.model.destroy();
		},

		// handle movement events
		start_resize: function start_resize (e) {
			e.preventDefault();
			e.stopPropagation();

			if (e.button !== 0) {
				return;
			};

			this.setActive(true);
			this.fire('active', 'resize');
		},

		start_move: function start_move (e) {
			e.preventDefault();
			e.stopPropagation();

			if (e.button !== 0) {
				return;
			};

			this.offset_x = e.offsetX;
			this.offset_y = e.offsetY;
			this.setActive(true);
			this.fire('active', 'move');
		},

		stop: function stop (e) {
			this.setActive(false);
		}
	});

	var Cropper = Blocks.View.inherits(function(){
		var self = this;

		this.model = new Target();
		this.model.on('change', this.render, this);

		this.list = new WidgetList();
		this.list.on('change', this.detect, this);

		this.modal = new SbarModal();
		this.modal.appendContent(this.element);
		this.modal.on('close', function(){
			self.cancelSubscriptions('accept');
		});

		this.render();
	}, {
		active_widget: null,
		mode: 'move',
		mouse_handler: function(){},
		element_classes: 'cropper',
		template_string: master_template_string,
		comp_template: __.template(master_template_string),
		events: [
			{ event_name: 'mousemove', selector: '*', function_name: 'prevent' },
			{ event_name: 'click', selector: '[data-action="add"]', function_name: 'add' },
			{ event_name: 'click', selector: '[data-action="accept"]', function_name: 'serialize' },
			{ event_name: 'click', selector: '[data-action="clear"]', function_name: 'clear' },
			{ event_name: 'click', selector: '[data-action="cancel"]', function_name: 'cancel' },
			{ event_name: 'click', selector: '[data-action="equalize"]', function_name: 'equalize' }
		],
		setMouseListen: function (listen) {
			if (listen) {
				$(window).on('mousemove', this.mouse_handler = this.mousemove.bind(this));
				$(window).one('mouseup', this.stop.bind(this));
			} else {
				$(window).off('mousemove', this.mouse_handler);
			};
		},
		prevent: function (e) {
			e.preventDefault();
		},
		mousemove: function (e) {
			var nudge = this.$crop_canvas.offset();

			switch (this.mode) {
			case 'move':
				this.active_widget.model.move(e.pageX - nudge.left - this.active_widget.offset_x, e.pageY - nudge.top - this.active_widget.offset_y);
			break;

			case 'resize':
				this.active_widget.model.resize(e.pageX - nudge.left);
			break;
			};
		},
		stop: function (e) {
			this.setMouseListen(false);
		},
		display: function display (target_data, saved_widgets, callback) {
			this.model.ingest(target_data);
			this.list.removeAll();

			if (saved_widgets) {
				switch (this.model.get('type')) {

				case 'crop':
					this.addWidget(saved_widgets);
				break;

				case 'watermark':
					var counter = 0, limit = saved_widgets.length;
					while (counter < limit) {
						this.addWidget(saved_widgets[counter]);
						counter++;
					};
				break;
				};
			};

			this.modal.open();
			this.once('accept', callback, this);
		},
		render: function render () {
			this.element.innerHTML = this.comp_template(this.model.data);
			this.$crop_canvas = this.$element.find('.crop_canvas');
		},
		detect: function detect () {
			this.$element[this.list.length && this.model.get('type') === 'crop' ? 'addClass' : 'removeClass']('dimmed');
		},

		// UI actions
		serialize: function serialize () {
			this.fire('accept', this.list.serialize());
			this.modal.close();
		},
		add: function add () {
			this.addWidget();
		},
		clear: function clear () {
			this.list.removeAll();
		},
		cancel: function cancel () {
			this.modal.close();
		},
		equalize: function equalize () {
			var largest = this.list.getLargest(), counter = this.list.length;
			while (counter--) {
				var model = this.list[counter];
				model.set('h', largest.get('h'));
				model.set('w', largest.get('w'));
			};
		},

		// widgets
		addWidget: function (data) {
			if (!this.list.length || this.model.get('type') === 'watermark') {
				switch (this.model.get('type')) {
				case 'crop':
					var model = new Crop(this.model);
				break;

				case 'watermark':
					var model = new Watermark(this.model);
				break;
				};

				if (data) {
					model.ingest(data);
				};

				var view = new WidgetView(model);
				this.list.push(model);
				this.$crop_canvas.append(view.element);
				view.on('active', this.setActiveWidget, this);
			};
		},
		setActiveWidget: function setActiveWidget (widget, mode) {
			this.active_widget = widget;
			this.mode = mode;
			this.setMouseListen(true);
		}
	});

	return Cropper;
});
