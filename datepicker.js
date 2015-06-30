/**
 * datepicker.js - MooTools Datepicker class
 * @version 1.17
 * 
 * by MonkeyPhysics.com
 *
 * Source/Documentation available at:
 * http://www.monkeyphysics.com/mootools/script/2/datepicker
 * 
 * --
 * 
 * Smoothly animating, very configurable and easy to install.
 * No Ajax, pure Javascript. 4 skins available out of the box.
 * 
 * --
 *
 * Some Rights Reserved
 * http://creativecommons.org/licenses/by-sa/3.0/
 * 
 */

/**
* Aug 6, 2014
* Converted to native JavaScript by Edi Supriyadi
* edisupr@gmail.com
* Requires two stand-alone plugin: 
* 1. animJS (for animation) https://github.com/relay/anim
* 2. HamsterJS (for mousewheel support) https://github.com/monospaced/hamster.js
* 
* Requires my own class element
* 
*/

/*Basic functions, some are taken from Mootools*/

var $chk = function(obj){
    return !!(obj || obj === 0);
};

function $tryCatch(){
    for (var i = 0, l = arguments.length; i < l; i++){
        try {
            return arguments[i]();
        } catch(e){}
    }
    return null;
};

/*Browser function from Mootools*/
var Browser = {
    Engine: {name: 'unknown', version: 0},
    Platform: {name: (window.orientation != undefined) ? 'ipod' : (navigator.platform.match(/mac|win|linux/i) || ['other'])[0].toLowerCase()},
    Features: {xpath: !!(document.evaluate), air: !!(window.runtime), query: !!(document.querySelector)},
    Plugins: {},
    Engines: {
        presto: function(){
            return (!window.opera) ? false : ((arguments.callee.caller) ? 960 : ((document.getElementsByClassName) ? 950 : 925));
        },
        trident: function(){
            return (!window.ActiveXObject) ? false : ((window.XMLHttpRequest) ? ((document.querySelectorAll) ? 6 : 5) : 4);
        },
        webkit: function(){
            return (navigator.taintEnabled) ? false : ((Browser.Features.xpath) ? ((Browser.Features.query) ? 525 : 420) : 419);
        },
        gecko: function(){
            return (!document.getBoxObjectFor && window.mozInnerScreenX == null) ? false : ((document.getElementsByClassName) ? 19 : 18);
        }
    }

};
Browser.Platform[Browser.Platform.name] = true;
Browser.detect = function(){
    for (var engine in this.Engines){
        var version = this.Engines[engine]();
        if (version){
            this.Engine = {name: engine, version: version};
            this.Engine[engine] = this.Engine[engine + version] = true;
            break;
        }
    }
    return {name: engine, version: version};
};
Browser.detect();
Browser.Request = function(){
    return $tryCatch(function(){
        return new XMLHttpRequest();
    }, function(){
        return new ActiveXObject('MSXML2.XMLHTTP');
    }, function(){
        return new ActiveXObject('Microsoft.XMLHTTP');
    });
};
Browser.Features.xhr = !!(Browser.Request());
Browser.Plugins.Flash = (function(){
    var version = ($tryCatch(function(){
        return navigator.plugins['Shockwave Flash'].description;
    }, function(){
        return new ActiveXObject('ShockwaveFlash.ShockwaveFlash').GetVariable('$version');
    }) || '0 r0').match(/\d+/g);
    return {version: parseInt(version[0] || 0 + '.' + version[1], 10) || 0, build: parseInt(version[2], 10) || 0};
})();
/*end of Browser*/

/* addEventListener that works for modern browser and <IE9 */
/*function addEvent(element, evnt, funct){
  if (element.attachEvent){
   	return element.attachEvent('on'+evnt, funct);
  }else{
   	return element.addEventListener(evnt, funct, false);
  }
}*/
/* end of addEvent */

var $empty = function(){};

var DatePicker = function(){
	this.options = {
		pickerClass: 'datepicker_dashboard',
		days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
		months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
		dayShort: 2,
		monthShort: 3,
		startDay: 1, // Sunday (0) through Saturday (6) - be aware that this may affect your layout, since the days on the right might have a different margin
		timePicker: false,
		timePickerOnly: false,
		yearPicker: true,
		yearsPerPage: 20,
		format: 'Y-m-d',
		allowEmpty: false,
		inputOutputFormat: 'U', // default to unix timestamp
		animationDuration: 0.4,
		useFadeInOut: !Browser.Engine.trident, // dont animate fade-in/fade-out for IE
		startView: 'month', // allowed values: {time, month, year, decades}
		positionOffset: { x: 0, y: 0 },
		minDate: null, // { date: '[date-string]', format: '[date-string-interpretation-format]' }
		maxDate: null, // same as minDate
		debug: false,
		toggleElements: null,		
		// and some event hooks:
		onShow: $empty,   // triggered when the datepicker pops up
		onClose: $empty,  // triggered after the datepicker is closed (destroyed)
		onSelect: $empty,  // triggered when a date is selected	
		onAttach: $empty,  // triggered when datepicker is attached to the element
	};
	this.d = ''; // working date, which we will keep modifying to render the calendars
	this.today = ''; // just so that we need not request it over and over
	this.choice = {}; // current user-choice in date object format
	this.bodysize = {}; // size of body, used to animate the sliding
	this.limit = {}; // to check availability of next/previous buttons
	// element references:
	this.attachTo = null;    // selector for target inputs
	this.picker = null;      // main datepicker container
	this.slider = null;      // slider that contains both oldContents and newContents, used to animate between 2 different views
	this.oldContents = null; // used in animating from-view to new-view
	this.newContents = null; // used in animating from-view to new-view
	this.input = null;       // original input element (used for input/output)
	this.visual = null;      // visible input (used for rendering)	

	/*initialize function*/
	this.attachTo = arguments[0];
    for (var n in arguments[1]){
		this.options[n] = arguments[1][n];
    };
	
	this.attach();
	if (this.options.timePickerOnly) {
		this.options.timePicker = true;
		this.options.startView = 'time';
	}
	this.formatMinMaxDates();
	document.addEventListener('mousedown', this.close.bind(this));	
};
DatePicker.prototype={

	attach: function() {
		// toggle the datepicker through a separate element?
		if ($chk(this.options.toggleElements)) {
			var togglers = document.getElementsByClassName(this.options.toggleElements);
			document.addEventListener('keydown', function(e) {
					if (e.keyCode == 9) {
						this.close(null, true);
					}
				}.bind(this)
			);
		};
		/*
		@todo: attach the class directly to the element, not by selector
		 */
		// attach functionality to the inputs
		var i=0;
		var els=document.getElementsByClassName(this.attachTo);
		while(document.getElementsByClassName(this.attachTo)[i]){
			var item=document.getElementsByClassName(this.attachTo)[i];
			var index = i;

			// never double attach
			i++;
			if (item.datepicker) {
				continue;
			}
			
			// determine starting value(s)
			if ($chk(item.getAttribute('value'))) {
				var init_clone_val = this.format(new Date(this.unformat(item.getAttribute('value'), this.options.inputOutputFormat)), this.options.format);
			} else if (!this.options.allowEmpty) {
				var init_clone_val = this.format(new Date(), this.options.format);
			} else {
				var init_clone_val = '';
			}
			
			// create clone
			var display = getComputedStyle(item, null).display;
			var width = getComputedStyle(item, null).width;
			item.style.display = this.options.debug ? display : 'none';
			item.datepicker = true;
			var clone = item.cloneNode();
			clone.removeAttribute('name');
			//clone.removeAttribute('class');
			clone.classList.remove(this.attachTo);
			clone.removeAttribute('id');
			clone.datepicker = true;
			clone.style.display = display;
			clone.style.width = width;
			//clone.setAttribute('value', init_clone_val);
			clone.value = init_clone_val;
			item.parentNode.insertBefore(clone, item.nextSibling);
			this.options.onAttach(init_clone_val, item, clone);
			// events
			if ($chk(this.options.toggleElements)) {
				togglers[index].style.cursor='pointer';
				togglers[index].addEventListener('click', function(e) {
					this.onFocus(item, clone);
				}.bind(this));
				clone.readOnly = true;
				clone.addEventListener('blur', function() {
					//item.setAttribute('value', clone.getAttribute('value'));
					item.value = clone.getAttribute('value');
				});
			} else {
				//be careful, you need IIFE on this. otherwise you get the last item element only
				clone.addEventListener('keydown',function(b){
					return function(e){
						this.keyboard_edit(e,b);
					};
				}(item).bind(this));

				clone.addEventListener('focus',function(o, c){
					return function(){
						this.onFocus(o, c);
					};
				}(item, clone).bind(this));
			}
		}
	},

	onFocus: function(original_input, visual_input) {
		/*to prevent execution for the next focus while datepicker is not destroyed*/
		if(visual_input.firstFocus===true){
			return;
		}
		var init_visual_date;
		var coordinate = visual_input.getBoundingClientRect();
		var d = {left: coordinate.left, top: coordinate.top, height:parseInt(getComputedStyle(visual_input).height)};
		if ($chk(original_input.getAttribute('value'))) {
			init_visual_date = this.unformat(original_input.getAttribute('value'), this.options.inputOutputFormat).valueOf();
		} else {
			init_visual_date = new Date();
			if ($chk(this.options.maxDate) && init_visual_date.valueOf() > this.options.maxDate.valueOf()) {
				init_visual_date = new Date(this.options.maxDate.valueOf());
			}
			if ($chk(this.options.minDate) && init_visual_date.valueOf() < this.options.minDate.valueOf()) {
				init_visual_date = new Date(this.options.minDate.valueOf());
			}
		}
		this.show({ left: d.left + this.options.positionOffset.x + 'px', top: d.top + d.height + this.options.positionOffset.y + 'px'}, init_visual_date);
		this.input = original_input;
		this.visual = visual_input;
		this.visual.firstFocus = true;
		this.options.onShow();
		/*for editing by keyboard*/
		visual_input.dt = this.unformat(visual_input.value, this.options.inputOutputFormat, true);
	},
	
	show: function(position, timestamp) {
		this.formatMinMaxDates();
		if ($chk(timestamp)) {
			this.d = new Date(timestamp);
		} else {
			this.d = new Date();
		}
		this.today = new Date();
		this.choice = this.dateToObject(this.d);
		this.mode = (this.options.startView == 'time' && !this.options.timePicker) ? 'month' : this.options.startView;
		this.render();
		this.picker.style.left = position.left;
		this.picker.style.top = position.top;
	},
	
	render: function(fx) {
		if (!$chk(this.picker)) {
			this.constructPicker();
		} else {
			// swap contents so we can fill the newContents again and animate
			var o = this.oldContents;
			this.oldContents = this.newContents;
			this.newContents = o;
			while (this.newContents.firstChild) {
			    this.newContents.removeChild(this.newContents.firstChild);
			}
		}

		// remember current working date
		var startDate = new Date(this.d.getTime());
		
		// intially assume both left and right are allowed
		this.limit = { right: false, left: false };

		// render! booty!
		if (this.mode == 'decades') {
			this.renderDecades();
		} else if (this.mode == 'year') {
			this.renderYear();
		} else if (this.mode == 'time') {
			this.renderTime();
			this.limit = { right: true, left: true }; // no left/right in timeview
			/*Edo: set scrollLeft to 0 because I want to focus to hour input. Otherwise it will be scrolled by the browser*/
			this.picker.getElementsByClassName('body')[0].scrollLeft = 0;
		} else {
			this.renderMonth();
		}

		var prev = this.picker.getElementsByClassName('previous')[0];
		prev.style.visibility = this.limit.left ? 'hidden' : 'visible';
		var next = this.picker.getElementsByClassName('next')[0];
		next.style.visibility = this.limit.right ? 'hidden' : 'visible';
		var title = this.picker.getElementsByClassName('titleText')[0];
		title.style.cursor = this.allowZoomOut() ? 'pointer' : 'default';
		// restore working date
		this.d = startDate;
		
		// if ever the opacity is set to '0' it was only to have us fade it in here
		// refer to the constructPicker() function, which instantiates the picker at opacity 0 when fading is desired
		if(this.picker.style.opacity == 0){
			anim(this.picker,{opacity:1}, this.options.animationDuration);
		}
		
		// animate
		if ($chk(fx)) this.fx(fx);
	},
	
	fx: function(fx) {
		/*requires anim.js to animate*/
		if (fx == 'right') {
			this.oldContents.style.left = '0px';
			this.oldContents.style.opacity = 1;
			this.oldContents.style.visibility = 'visible';
			this.newContents.style.left = (this.bodysize.x) + 'px';
			this.newContents.style.opacity = 1;
			this.newContents.style.visibility = 'visible';
			anim(this.slider, {left:{to:(-this.bodysize.x)+'px', fr: '0px'}}, this.options.animationDuration);
		} else if (fx == 'left') {
			this.oldContents.style.left = (this.bodysize.x) + 'px';
			this.oldContents.style.opacity = 1;
			this.oldContents.style.visibility = 'visible';
			this.newContents.style.left = '0px';
			this.newContents.style.opacity = 1;
			this.newContents.style.visibility = 'visible';
			anim(this.slider, {left:{fr:(-this.bodysize.x)+'px', to: '0px'}}, this.options.animationDuration);
		} else if (fx == 'fade') {
			this.slider.style.left = '0px';
			this.oldContents.style.left='0px';
			this.newContents.style.left = '0px';
			this.oldContents.style.visibility = 'visible';
			this.newContents.style.visibility = 'hidden';
			anim(this.oldContents, {opacity:0}, this.options.animationDuration/2).anim(function(){this.oldContents.style.visibility = 'hidden';}.bind(this));
			anim(this.newContents, {opacity:1}, this.options.animationDuration/2).anim(function(){this.newContents.style.visibility = 'visible';}.bind(this));
		}
	},
	
	constructPicker: function() {
		/*Edo: I add tabindex to datepicker container so I can move focus to this element when I edit visual input by keyboard*/
		this.picker = new element('div',{className: this.options.pickerClass, tabIndex:0, style:{opacity:0} }).inject(document.body);

		/*Edo: this animation has no effect. Why?*/
		//if (this.options.useFadeInOut) {
			//anim(this.picker, {opacity:{fr:0, to: 1}}, this.options.animationDuration*1000);
		//}
		
		var h = new element('div', {className: 'header'}).inject(this.picker);
		var titlecontainer = new element('div', {className: 'title'}).inject(h);
		Hamster(titlecontainer).wheel(function(event, delta){
			event.preventDefault();
			if(delta<1){
				this.previous();
			}else{
				this.next();
			}
		}.bind(this));		
		var prev =  new element('div',{ className:'previous', innerHTML: '«', event: ['click',this.previous.bind(this)] }).inject(h);
		var next =  new element('div',{ className:'next', innerHTML: '»', event: ['click',this.next.bind(this)] }).inject(h);
		var close =  new element('div',{className:'closeButton', innerHTML: 'x', event: ['click', function(){ this.close(this,true).bind(this); }]}).inject(h);
		
		var title =  new element('span',{className:'titleText', event: ['click',this.zoomOut.bind(this)]}).inject(titlecontainer);
		var b =  new element('div',{className:'body'}).inject(this.picker);
		this.bodysize = {x: b.offsetWidth, y: b.offsetHeight};                
		this.slider =  new element('div',{style:{ position: 'absolute', top: 0, left: 0, width: (2 * this.bodysize.x)+'px', height: (this.bodysize.y)+'px' }}).inject(b);
		this.oldContents =  new element('div',{id: 'old', style:{ position: 'absolute', top: 0, left: (this.bodysize.x)+'px', width: (this.bodysize.x)+'px', height: (this.bodysize.y)+'px' }}).inject(this.slider);
		this.newContents =  new element('div',{id: 'new', style:{ position: 'absolute', top: 0, left: 0, width: (this.bodysize.x)+'px', height: (this.bodysize.y)+'px' }}).inject(this.slider);
	},

	renderTime: function() {
		var container = new element('div', {className: 'time'}).inject(this.newContents);
		var els = this.picker.getElementsByClassName('titleText')[0];
		var txt = this.format(this.d, 'j M, Y');
		if (this.options.timePickerOnly) {
			txt = 'Select a time';
		}
		els.innerHTML = txt;
		var el = new element('input', {type:'text', className: 'hour', value:this.leadZero(this.d.getHours()), maxlength: 2}).inject(container);
		Hamster(el).wheel(function(event, delta){
			this.mWheel(event, 23, delta);
		}.bind(this));	
		el.addEventListener('keydown',function(e){
			this.keyValue(e, 23);		
		}.bind(this));	
		/*Edo: focus so I can edit with keyboard*/
		el.focus();

		var el = new element('input', {type:'text', className: 'minutes', value: this.leadZero(this.d.getMinutes()), maxlength: 2}).inject(container);	
		Hamster(el).wheel(function(event, delta){
			this.mWheel(event, 59, delta);
		}.bind(this));
		el.addEventListener('keydown',function(e){
			this.keyValue(e, 59);
		}.bind(this));

		new element('div', {className: 'separator', innerHTML: ':'}).inject(container);
		new element('input', {
			type:'submit', 
			className: 'ok', 
			value:'OK',
			event: ['click', function(e){
				e.stopPropagation();
				e.preventDefault();
				this.select(
				$merge(this.dateToObject(this.d), 
				{ hours: parseInt(this.picker.getElementsByClassName('hour')[0].value), minutes: parseInt(this.picker.getElementsByClassName('minutes')[0].value) }))}.bind(this)
			]
		}).inject(container);
	},

	renderMonth: function() {
		var month = this.d.getMonth();

		var el = this.picker.getElementsByClassName('titleText')[0];
		el.innerHTML = this.options.months[month] + ' ' + this.d.getFullYear();

		this.d.setDate(1);
		while (this.d.getDay() != this.options.startDay) {
			this.d.setDate(this.d.getDate() - 1);
		}

		var container = new element('div', { className: 'days' }).inject(this.newContents);
		var titles = new element('div', { className: 'titles' }).inject(container);

		var d, i, classes, e, weekcontainer;

		for (d = this.options.startDay; d < (this.options.startDay + 7); d++) {
			new element('div', { className: 'title day day' + (d % 7), innerHTML:this.options.days[(d % 7)].substring(0,this.options.dayShort) }).inject(titles);
		}
		
		var available = false;
		var t = this.today.toDateString();
		var currentChoice = this.dateFromObject(this.choice).toDateString();	

		for (i = 0; i < 42; i++) {
			classes = [];
			classes.push('day');
			classes.push('day'+this.d.getDay());
			if (this.d.toDateString() == t) classes.push('today');
			if (this.d.toDateString() == currentChoice) classes.push('selected');
			if (this.d.getMonth() != month) classes.push('otherMonth');
			
			if (i % 7 == 0) {
				weekcontainer = new element('div', { className: 'week week'+(Math.floor(i/7)) }).inject(container);
			}
			
			e = new element('div', { className: classes.join(' '), innerHTML: this.d.getDate() }).inject(weekcontainer);
			if (this.limited('date')) {
				e.classList.add('unavailable');
				if (available) {
					this.limit.right = true;
				} else if (this.d.getMonth() == month) {
					this.limit.left = true;
				}
			} else {
				available = true;
				/*this is another form of IIFE, Edo. The function that's assigned to the e is actually immediately invoked*/
				e.addEventListener('click', function(d){
					return function(){
						if (this.options.timePicker) {
							this.d.setDate(d.day);
							this.d.setMonth(d.month);
							this.mode = 'time';
							this.render('fade');
						} else {
							this.select(d);
						}						
					};
				}({ day: this.d.getDate(), month: this.d.getMonth(), year: this.d.getFullYear() }).bind(this));
				/*after function expression, you still can bind it to the class*/

				/*So that we can scroll months*/
				Hamster(e).wheel(function(event, delta){
					event.preventDefault();
					if(delta<1){
						this.previous();
					}else{
						this.next();
					}
				}.bind(this));

			}
			this.d.setDate(this.d.getDate() + 1);
		}
		if (!available) this.limit.right = true;
	},

	renderYear: function() {
		var month = this.today.getMonth();
		var thisyear = this.d.getFullYear() == this.today.getFullYear();
		var selectedyear = this.d.getFullYear() == this.choice.year;
	
		var els = document.getElementsByClassName('titleText')[0];
		els.innerHTML = this.d.getFullYear();
		this.d.setMonth(0);
		
		var i, e;
		var available = false;
		var container = new element('div', { className: 'months' }).inject(this.newContents);

		for (i = 0; i <= 11; i++) {

			e = new element('div', { 
				className: 'month month'+(i+1)+(i == month && thisyear ? ' today' : '')+(i == this.choice.month && selectedyear ? ' selected' : ''),
				innerHTML: this.options.monthShort ? this.options.months[i].substring(0, this.options.monthShort) : this.options.months[i] 
			}).inject(container);

			if (this.limited('month')) {
				e.classList.add('unavailable');
				if (available) {
					this.limit.right = true;
				} else {
					this.limit.left = true;
				}
			} else {
				available = true;
				e.addEventListener('click', function(d){
					return function(){
						this.d.setDate(1);
						this.d.setMonth(d);
						this.mode = 'month';
						this.render('fade');
					};
				}(i).bind(this));

				/*so that we can scroll years*/
				Hamster(e).wheel(function(event, delta){
					event.preventDefault();
					if(delta<1){
						this.previous();
					}else{
						this.next();
					}
				}.bind(this));

			}
			this.d.setMonth(i);
		}
		if (!available) this.limit.right = true;
	},
	
	renderDecades: function() {
		// start neatly at interval (eg. 1980 instead of 1987)
		while (this.d.getFullYear() % this.options.yearsPerPage > 0) {
			this.d.setFullYear(this.d.getFullYear() - 1);
		}

		var els = document.getElementsByClassName('titleText')[0];
		els.innerHTML = this.d.getFullYear() + '-' + (this.d.getFullYear() + this.options.yearsPerPage - 1);
		
		var i, y, e;
		var available = false;
		var container = new element('div', { className: 'years' }).inject(this.newContents);

		if ($chk(this.options.minDate) && this.d.getFullYear() <= this.options.minDate.getFullYear()) {
			this.limit.left = true;
		}	
		for (i = 0; i < this.options.yearsPerPage; i++) {
			y = this.d.getFullYear();

			var e = new element('div', { className: 'year year' + i + (y == this.today.getFullYear() ? ' today' : '') + (y == this.choice.year ? ' selected' : ''), innerHTML: y }).inject(container);
			if (this.limited('year')) {
				e.classList.add('unavailable');
				if (available) {
					this.limit.right = true;
				} else {
					this.limit.left = true;
				}
			} else {
				available = true;
				e.addEventListener('click', function(d) {
					return function(){
						this.d.setFullYear(d);
						this.mode = 'year';
						this.render('fade');
					};
				}(y).bind(this));

				/*so that we can scroll decades*/
				Hamster(e).wheel(function(event, delta){
					event.preventDefault();
					if(delta<1){
						this.previous();
					}else{
						this.next();
					}
				}.bind(this));

			}
			this.d.setFullYear(this.d.getFullYear() + 1);
		}
		if (!available) {
			this.limit.right = true;
		}
		if ($chk(this.options.maxDate) && this.d.getFullYear() >= this.options.maxDate.getFullYear()) {
			this.limit.right = true;
		}
	},
	
	limited: function(type) {
		var cs = $chk(this.options.minDate);
		var ce = $chk(this.options.maxDate);
		if (!cs && !ce) return false;
		
		switch (type) {
			case 'year':
				return (cs && this.d.getFullYear() < this.options.minDate.getFullYear()) || (ce && this.d.getFullYear() > this.options.maxDate.getFullYear());
				
			case 'month':
				// todo: there has got to be an easier way...?
				var ms = ('' + this.d.getFullYear() + parseInt(this.leadZero(this.d.getMonth())));
				return cs && ms < parseInt('' + this.options.minDate.getFullYear() + this.leadZero(this.options.minDate.getMonth()))
					|| ce && ms > parseInt('' + this.options.maxDate.getFullYear() + this.leadZero(this.options.maxDate.getMonth()));
				
			case 'date':
				return (cs && this.d < this.options.minDate) || (ce && this.d > this.options.maxDate);
		}
	},
	
	allowZoomOut: function() {
		if (this.mode == 'time' && this.options.timePickerOnly) return false;
		if (this.mode == 'decades') return false;
		if (this.mode == 'year' && !this.options.yearPicker) return false;
		return true;
	},
	
	zoomOut: function() {
		if (!this.allowZoomOut()) return;
		if (this.mode == 'year') {
			this.mode = 'decades';
		} else if (this.mode == 'time') {
			this.mode = 'month';
		} else {
			this.mode = 'year';
		}
		this.render('fade');
	},
	
	previous: function() {
		if (this.mode == 'decades') {
			this.d.setFullYear(this.d.getFullYear() - this.options.yearsPerPage);
		} else if (this.mode == 'year') {
			this.d.setFullYear(this.d.getFullYear() - 1);
		} else if (this.mode == 'month') {
			this.d.setDate(1);
			this.d.setMonth(this.d.getMonth() - 1);
		}
		this.render('left');
	},
	
	next: function() {
		if (this.mode == 'decades') {
			this.d.setFullYear(this.d.getFullYear() + this.options.yearsPerPage);
		} else if (this.mode == 'year') {
			this.d.setFullYear(this.d.getFullYear() + 1);
		} else if (this.mode == 'month') {
			this.d.setDate(1);
			this.d.setMonth(this.d.getMonth() + 1);
		}
		this.render('right');
	},

	select: function(values, closed) {
		closed = typeof closed!=='undefined' ? closed : true;
		this.choice = $merge(this.choice, values); 
		var d = this.dateFromObject(this.choice);
		/*Edo: dont use setAttribute(value, blabla) only, it wont update the visual input
		Use both el.value and setAttribute instead, so the view and also the value will be updated
		*/
		this.input.value = this.format(d, this.options.inputOutputFormat);
		this.input.setAttribute('value', this.input.value);
		this.visual.value = this.format(d, this.options.format);
		this.visual.setAttribute('value', this.visual.value);

		/*Edo: return focus to visual input, otherwise it will jump somewhere unexpected*/
		this.options.onSelect(d, this.visual, this.input);
		if(closed){
			this.close(null, true);	
		}
	},

	close: function(e, force) {
		if (!this.picker) return;

		var clickOutside = ($chk(e) && e.target != this.picker && !this.picker.contains(e.target) && e.target != this.visual);

		if (force || clickOutside) {
			/*Edo: strange behaviour! If I ommit if condition here, i.e treat all the same regardless of this.options.useFadeInOut,
			when the focus jump from date picker input to another with the same class, the picker will stay open. Otherwise, it'll close
			*/
/*			if (this.options.useFadeInOut) {
				anim(this.picker,{opacity: 0},this.options.animationDuration / 2).anim(function(){this.destroy();}.bind(this));
			} else {
*/				this.destroy();
/*			}*/
		}
	},	

	destroy: function() {
		/*this anim is to treat all closing the same, regardless of this.options.useFadeInOut*/
		anim(this.picker,{opacity: 0},this.options.animationDuration / 2);
		/*to destroy firstFocus attribute*/
		this.visual.firstFocus = false;

		var final_format = this.unformat(this.visual.value, this.options.inputOutputFormat);
		if(this.visual.modified === true){	
			this.select(this.dateToObject(final_format), false);
			this.visual.modified = false;
		}

		this.picker.parentNode.removeChild(this.picker);
		this.picker = null;
		this.options.onClose(final_format,this.visual, this.input);
	},
	
	/*requires Hamster.js for stand-alone mousewheel support*/
	mWheel: function(event, max, delta){
		event.stopPropagation();
		event.preventDefault();
		event.target.value = this.editValue(parseInt(event.target.value), max, delta > 0);
	},

	editValue: function(value, max, add){
		if (add) {
			value = (value < max) ? value + 1 : 0;
		} else {
			value = (value > 0) ? value - 1 : max;
		}
		return this.leadZero(value);
	},

	/*edit time with keydown*/
	keyValue: function(e, max){
		e.stopPropagation();
		var key = e.keyCode;
		if(key==38 || key==40){
			e.target.value = this.editValue(parseInt(e.target.value), max, key==38);
		}else{
			if(key!=9){
				e.preventDefault();	
			}
		}		
	},

	leadZero: function(v) {
		return v < 10 ? '0'+v : v;
	},

	
	dateToObject: function(d) {
		return {
			year: d.getFullYear(),
			month: d.getMonth(),
			day: d.getDate(),
			hours: d.getHours(),
			minutes: d.getMinutes(),
			seconds: d.getSeconds()
		};
	},
	
	dateFromObject: function(values) {
		var d = new Date();
		d.setDate(1);
		['year', 'month', 'day', 'hours', 'minutes', 'seconds'].forEach(function(type) {
			var v = values[type];
			if (!$chk(v)) return;
			switch (type) {
				case 'day': d.setDate(v); break;
				case 'month': d.setMonth(v); break;
				case 'year': d.setFullYear(v); break;
				case 'hours': d.setHours(v); break;
				case 'minutes': d.setMinutes(v); break;
				case 'seconds': d.setSeconds(v); break;
			}
		});
		return d;
	},

	formatMinMaxDates: function() {
		if (this.options.minDate && this.options.minDate.format) {
			this.options.minDate = this.unformat(this.options.minDate.date, this.options.minDate.format);
		}
		if (this.options.maxDate && this.options.maxDate.format) {
			this.options.maxDate = this.unformat(this.options.maxDate.date, this.options.maxDate.format);
			this.options.maxDate.setHours(23);
			this.options.maxDate.setMinutes(59);
			this.options.maxDate.setSeconds(59);
		}
	},

	format: function(t, format) {
		var f = '';
		var h = t.getHours();
		var m = t.getMonth();
		
		for (var i = 0; i < format.length; i++) {
			switch(format.charAt(i)) {
				case '\\': i++; f+= format.charAt(i); break;
				case 'y': f += (t.getFullYear() + '').substring(2); break;
				case 'Y': f += t.getFullYear(); break;
				case 'm': f += this.leadZero(m + 1); break;
				case 'n': f += (m + 1); break;
				case 'M': f += this.options.months[m].substring(0,this.options.monthShort); break;
				case 'F': f += this.options.months[m]; break;
				case 'd': f += this.leadZero(t.getDate()); break;
				case 'j': f += t.getDate(); break;
				case 'D': f += this.options.days[t.getDay()].substring(0,this.options.dayShort); break;
				case 'l': f += this.options.days[t.getDay()]; break;
				case 'G': f += h; break;
				case 'H': f += this.leadZero(h); break;
				case 'g': f += (h % 12 ? h % 12 : 12); break;
				case 'h': f += this.leadZero(h % 12 ? h % 12 : 12); break;
				case 'a': f += (h > 11 ? 'pm' : 'am'); break;
				case 'A': f += (h > 11 ? 'PM' : 'AM'); break;
				case 'i': f += this.leadZero(t.getMinutes()); break;
				case 's': f += this.leadZero(t.getSeconds()); break;
				case 'U': f += Math.floor(t.valueOf() / 1000); break;
				default:  f += format.charAt(i);
			}
		}
		return f;
	},	

	unformat: function(t, format, outputData) {
		/*Edo: I modified so that I can output array from the value*/
		outputData = typeof outputData !== 'undefined' ? outputData : false;
		if(outputData){
			var output = {separator:[],values:{}};
		}
		var d = new Date();
		d.setMonth(0);
		d.setDate(1);
		var a = {};
		var c, m;
		t = t.toString();
		for (var i = 0; i < format.length; i++) {
			c = format.charAt(i);
			switch(c) {
				case '\\': r = null; i++; break;
				case 'y': r = '[0-9]{2}'; break;
				case 'Y': r = '[0-9]{4}'; break;
				case 'm': r = '0[1-9]|1[012]'; break;
				case 'n': r = '[1-9]|1[012]'; break;
				case 'M': r = '[A-Za-z]{'+this.options.monthShort+'}'; break;
				case 'F': r = '[A-Za-z]+'; break;
				case 'd': r = '0[1-9]|[12][0-9]|3[01]'; break;
				case 'j': r = '[12][0-9]|3[01]|[1-9]'; break;
				case 'D': r = '[A-Za-z]{'+this.options.dayShort+'}'; break;
				case 'l': r = '[A-Za-z]+'; break;
				case 'G': 
				case 'H': 
				case 'g': 
				case 'h': r = '[0-9]{1,2}'; break;
				case 'a': r = '(am|pm)'; break;
				case 'A': r = '(AM|PM)'; break;
				case 'i': 
				case 's': r = '[012345][0-9]'; break;
				case 'U': r = '-?[0-9]+$'; break;
				default:  r = null;
			}
			
			if ($chk(r)) {
				m = t.match('^'+r);
				if ($chk(m)) {
					a[c] = m[0];
					t = t.substring(a[c].length);
				} else {
					if (this.options.debug) alert("Fatal Error in DatePicker\n\nUnexpected format at: '"+t+"' expected format character '"+c+"' (pattern '"+r+"')");
					return d;
				}
			} else {
				if(outputData && output.separator.indexOf(c)==-1){
					output.separator.push(c);
				}
				t = t.substring(1);
			}
			
		}
		if(outputData){
			/*actually output.values is not yet used, only separator*/
			output.values = a;
			return output;
		}
		for (c in a) {
			var v = a[c];
			switch(c) {
				case 'y': d.setFullYear(v < 30 ? 2000 + parseInt(v) : 1900 + parseInt(v)); break; // assume between 1930 - 2029
				case 'Y': d.setFullYear(v); break;
				case 'm': 
				case 'n': d.setMonth(v - 1); break;
				// FALL THROUGH NOTICE! "M" has no break, because "v" now is the full month (eg. 'February'), which will work with the next format "F":
				case 'M': v = this.options.months.filter(function(item, index) { return item.substring(0,this.options.monthShort) == v }.bind(this))[0];
				case 'F': d.setMonth(this.options.months.indexOf(v)); break;
				case 'd':
				case 'j': d.setDate(v); break;
				case 'G': 
				case 'H': d.setHours(v); break;
				case 'g': 
				case 'h': if (a['a'] == 'pm' || a['A'] == 'PM') { d.setHours(v == 12 ? 0 : parseInt(v) + 12); } else { d.setHours(v); } break;
				case 'i': d.setMinutes(v); break;
				case 's': d.setSeconds(v); break;
				case 'U': d = new Date(parseInt(v) * 1000);
			}
		};
		return d;
	},

	keyboard_edit: function(e, item){
		//46 = delete
		//8 = backspace
		//9 = tab
		//left = 37
		//right = 39
		//up = 38
		//down = 40
		var key = e.keyCode;
		if (this.options.allowEmpty && !item.value && !e.target.value){
			if(key==9 || e.shiftKey){
				this.close(null, true);
				return;
			}
			var now = this.format(this.dateFromObject(this.choice), this.options.format);
			item.value = now;
			item.setAttribute('value', item.value);
			e.target.value = now;
			e.target.setAttribute('value', e.target.value);
			//set dt object for keyboard editing
			e.target.dt = this.unformat(e.target.value, this.options.inputOutputFormat, true);
		}
		if (this.options.allowEmpty && (key == 46 || key == 8)) {
			item.value = '';
			item.setAttribute('value', item.value);
			e.target.value = '';
			e.target.setAttribute('value', e.target.value);
			this.close(null, true);
		} else if (key == 9) {
			this.close(null, true);
		} else {
			e.stopPropagation();
			if(!e.target.value){
				return;
			}
			if(key!==37 && key!==39){
				e.preventDefault();	
			}
			if(key==38 || key==40 || key==37 || key==39){
				var sel = getInputSelection(e.target);
				var val = e.target.value;
				var start = sel.start;
				var s = 0;
				var n = val.length;
				for(var i = 0; i < e.target.dt.separator.length; i++){
					var str = e.target.dt.separator[i];
					var checkPre = val.lastIndexOf(str, start-1);
					var checkPost = val.indexOf(str, start);
					if(checkPre!==-1){
						s = checkPre > s ? checkPre : s;
					}
					if(checkPost!==-1){
						n = checkPost < n ? checkPost : n;
					}
				}
				s = s ? s+1 : 0;							
			}
			if(key==37 || key==39){
				var pos = key==39 ? n : s;
				setInputSelection(e.target, pos, pos);						
			}
			if(key==38 || key==40){
				e.target.modified = true;
				var new_value, prechunk = val.substr(0,s), chunk = val.substr(s,n-s), postchunk = val.substr(n);							
				if(key==38){
					chunk = parseInt(chunk)+1;
				}else if(key==40){
					chunk = parseInt(chunk)-1;
				}
				new_value = prechunk + (this.leadZero(chunk)) + postchunk;
				var new_format = this.unformat(new_value, this.options.inputOutputFormat);
				e.target.value = this.format(new Date(new_format), this.options.format);
				setInputSelection(e.target, sel.start, sel.start);								
			}
		}
	}
};
