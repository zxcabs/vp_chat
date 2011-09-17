/*
 * chat.js
 */
(function (global) {
	var $ = global.$;
	var Request = global.Request;
					
	function extend (target, obj) {
		var   _obj = obj || {}
			, _target = target || {}
			, _prop = {}
			;
		
		for (var prop in _obj) {
			_prop[prop] = {value: _obj[prop], writable: true};
		}
		
		return Object.create(_target, _prop);
	};
	
	/*
	 * Chat class
	 */
	function Chat(opt) {
		//default setting clone
		
		this._opt = extend({
				  defaultChannel: 'main'
				, channelList: ['main']
				, pollFreq: 5000
				, retryFreq: 30000
				, scrollEnabled: true
				, msgElId: 'lschat_list_msg'
				, textAreaEl: 'lschat_input_msg'
			}, opt);
		
		this._msgEl = $(this._opt.msgElId);
		this._textAreaEl = $(this._opt.textAreaEl);
		
		this._textAreaEl.addEvent('keydown', this._textAreaKeydown.bind(this));
		this._channels = new Queue();
				
		for (var i = 0, l = this._opt.channelList.length; l > i; i++) {
			this._channels.push(new Channel(this._opt.channelList[i], this));
		}
		
		this.Request = Request;
		this.activateChannel(this._opt.defaultChannel);
	};
	
	Chat.prototype.activateChannel = function (name) {
		var channel = this.findChannelByName(name)
			, activeChannel = this.getActiveChannel()
			;
			
		if (activeChannel) activeChannel.deactivate();
		
		this.clear();
		
		if (channel) channel.activate();
	};
	
	Chat.prototype.getActiveChannel = function () {
		var active = null;
		
		function iterator(channel, i) {
			if (channel.isActive()) {
				active = channel;
				return false;
			};
		};
		
		this._channels.forEach(iterator);
		return active;
	};
	
	Chat.prototype.findChannelByName = function (name) {
		var ch = null;
		
		function iterator(channel, i) {
			if (channel.getName() == name) {
				ch = channel;
				return false;
			};
		};
		
		this._channels.forEach(iterator);
		return ch;
	};
	
	Chat.prototype.print = function (str) {
		this._msgEl.set('html', str);
	};
	
	Chat.prototype.append = function (str) {
		var el = document.createElement('div');
		el.innerHTML = str;
		
		while (el.childElementCount > 0) {
				this._msgEl.appendChild(el.childNodes[0]);
		}
		
		if (this._opt.scrollEnabled) {
			this.scroll();
		}
		
		el.destroy();
		delete el;
	};
	
	Chat.prototype.scroll = function () {
		function _scroll() {
			this._msgEl.scrollTo(0, this._msgEl.scrollHeight);
		};
		
		setTimeout(_scroll.bind(this), 0);
	};
	
	Chat.prototype.setMsg = function (msg) {
		if (this._textAreaEl) {
			this._textAreaEl.set('value', msg);
		}
	};
	
	Chat.prototype.getMsg = function () {
		var msg;
		
		if (this._textAreaEl) {
			msg = this._textAreaEl.get('value');
		}
		
		return msg;
	};
	
	Chat.prototype.clear = function () {
		this.print('');
		this.setMsg('');
	};
	
	Chat.prototype.onMsg = function () {
		var msg = new String(this.getMsg())
			, channel = this.getActiveChannel()
			, isCommand = (msg.match(/^\//))? true: false
			;
		if (isCommand) {
			this.execute.apply(this, msg.split(/\s/));
		} else {
			if (channel) {
				channel.sendMsg(msg);
			}
		}
		
		this.setMsg('');
	};	
	
	Chat.prototype.execute = function () {
		var command = arguments[0]
			, params =  Array.prototype.slice.call(arguments, 1)
			, channel = this.getActiveChannel()
			, msg = ''
			, now = new Date()
			, h = now.getHours()
			, m = now.getMinutes()
			;
		
		h = (h < 10)? '0' + h: h;
		m = (m < 10)? '0' + m: m;
				
		switch (command) {
			case '/scroll': 
				this.setScrollEnabled('off' != params[0]);				
				msg = 'scroll enabled: ' + this._opt.scrollEnabled;
				break;
			default:
				if (channel.execute.apply(channel, params) === false) {
					msg = 'Не известная команда: ' + command + ' ' + params.join(' ');
				}
			};
			
		this.append('<div class="chat-message"><span class="cm-time">[' + h + ':' + m + ']</span> ' + msg + '</div>');
	};
	
	Chat.prototype.setScrollEnabled = function (enabled) {
		this._opt.scrollEnabled = enabled;
	};
	
	Chat.prototype.sendClick = function () {
		this.onMsg();
	};
	
	Chat.prototype._textAreaKeydown = function (e) {
		if ((e.control ||e.meta) && 'enter' == e.key) {
			e.preventDefault();
			this.onMsg();
        }
	};
	
	Chat.prototype.send = function (ch, msg, fn, timeout) {
		var req = new this.Request({
						  url: '/plugins/chatlight/include/ajax/lschatSendMsg.php'
						, method: 'POST'
						, data: { msg: msg
								, security_ls_key: this._opt.SEC_KEY
								, channel: ch.getName()
						}
						, onSuccess: fn.bind(ch)
						, onFailure: function () {
							fn.call(ch, 'Some error');
						}
					});
		if (!timeout) {
			req.send();
		} else {
			setTimeout(function () {
				req.send();
			}, timeout);
		}
	};
	
	Chat.prototype.poll = function (ch, fn, timeout) {
		var req = new this.Request({
						  url: '/chatmsg/' + ch.getName() + '.html'
						, method: 'GET'
						, noCache: true
						, onSuccess: function (data) {
							fn.call(ch, null, data);
						}
						, onFailure: function () {
							fn.call(ch, 'Some error');
						}
					});

		if (!timeout) {
			req.send();
		} else {
			setTimeout(function () {
				req.send();
			}, timeout);
		}		
	};
	
	/*
	 * Chat channel class
	 */
	function Channel(name, chat) {
		this._name = name;
		this._chat = chat;
		this._isActive = false;
		this._el = $('block_lschat_tab_' + this._name);
		this._msgBuffer = new Buffer(250);
		this._sendBuffer = new Buffer(10);
		this._msg = '';
		this._isSending = false;
		this._isPolling = false;		
	};
	
	Channel.prototype.execute = function () {
		return false;
	};
	
	Channel.prototype.isActive = function () {
		return this._isActive;
	};
	
	Channel.prototype.activate = function () {
		this._el.addClass('active');
		this._append();
		this._chat.setMsg(this._msg);
		this._isActive = true;
		this.poll();
	};
	
	Channel.prototype.deactivate = function () {
		this._el.removeClass('active');
		this._msg = this._chat.getMsg();
		this._isActive = false;
	};
	
	Channel.prototype.append = function (str) {
		if (str) {
			this._chat.append(str);
		}
	};
	
	Channel.prototype._append = function (start, stop) {
		var str = ''
			, start = start || 0
			, arr = this._msgBuffer.slice(start, stop)
			;
		
		
		this.append(arr.join(''));
	};
	
	Channel.prototype.sendMsg = function (msg) {
		this._sendBuffer.push(msg);
		this.send();
	};
	
	Channel.prototype.send = function (timeout) {
		var msg = this._sendBuffer.first();

		if (!this._isSending) {
			if (msg && msg != "") {
				this._isSending = true;
				this._chat.send(this, msg, function (err) {
					this._isSending = false;
					this._sendHandler(err);
				}, timeout);
			} else {
				this._isSending = false;
				this._sendBuffer.shift(); //remove bad msg
			}
		}
	};
	
	Channel.prototype._sendHandler = function (err) {
		if (err) {
			this.send(this._chat._opt.retryFreq);
		} else {
			this._sendBuffer.shift();
			if (this._sendBuffer.first()) {
				this.send(this._chat._opt.pollFreq);
			};
		}
	};
	
	Channel.prototype.poll = function (timeout) {
		if (!this._isPolling && this.isActive()) {
			this._isPolling = true;
			this._chat.poll(this, function (err, data) {
				this._isPolling = false;
				this._pollHandler(err, data);
			}, timeout);
		}
	};
	
	Channel.prototype._pollHandler = function (err, data) {
		if (err) {
			this.poll(this._chat._opt.retryFreq);
		} else {
			this._onPollData(data);
			this.poll(this._chat._opt.pollFreq);
		}
	};
	
	Channel.prototype._onPollData = function (data) {
		var array = data.replace(/\r\n/g, '').match(/<div(.*)<\/div>/g)
			, last = this._msgBuffer.last()
			, pushed = 0
			;
			
		for (var i = 0, l = array.length; l > i; i++) {
			if (last == array[i]) {
				array.splice(0, i + 1);
				break;
			}
		};
		
		if (array.length > 0) {
			pushed = this._msgBuffer.push(array);
			
			if (this.isActive()) {
				this._append(this._msgBuffer.length() - pushed);
			}
		};
	};
	
	Channel.prototype.getName = function () {
		return this._name;
	};
	
	/*
	 * Buffer
	 */
	function Buffer (size) {
		this._maxLength = size || 1000;
		this._buff = [];
	};
	
	Buffer.prototype.getMaxLength = function () {
		return this._maxLength;
	};
	
	Buffer.prototype.setMaxLength = function (max) {
		var l = this.length();
		
		if (max < this._maxLength && max > l) {
			this._buff.splice(0, max - l);
		}
		
		this._maxLength = max;
	};
	
	Buffer.prototype.first = function () {
		return this._buff[0];
	};
	
	Buffer.prototype.last = function () {
		var l = this.length()
			, i = (l > 0)? l - 1: 0;

		return this._buff[i];
	};
	
	Buffer.prototype.shift = function () {
		return this._buff.shift();
	};
	
	Buffer.prototype.push = function (item) {
		var pushedItemCount = 0;
		
		if ('object' == typeof item && '[object Array]' == Object.prototype.toString.call(item)) {
			pushedItemCount = this._pushArray(item);
		} else {
			pushedItemCount = this._pushItem(item);
		}
		
		return pushedItemCount;
	};
	
	Buffer.prototype._pushItem = function (item) {
		if (this._buff.length == this._maxLength) {
			this._buff.shift();
		}
		
		this._buff.push(item);
		return 1;
	};
	
	Buffer.prototype._pushArray = function (items) {
		var itemsL = items.length
			, len = this.length()
			, dl = (itemsL + len) - this._maxLength
			;
		
		if (dl > 0) {
			this._buff.splice(0, dl);
		}
		
		this._buff = this._buff.concat(items);
		
		return itemsL;
	};
	
	Buffer.prototype.length = function () {
		return this._buff.length;
	};
	
	Buffer.prototype.slice = function () {
		return this._buff.slice.apply(this._buff, arguments);
	};
	
	/*
	 * Queue
	 */
	 function Queue() {
		this._q = [];
		this._i = 0;
	 };
	 
	Queue.prototype.push = function (item) {
		return this._q.push(item);
	};
	
	Queue.prototype.remove = function (removeItem) {
		function iterator (item, index, length) {
			if (item == removeItem) {
				this._q.splice(index, 1);
				
				if (this._i == length - 1 || this._i > index) {
					this._i--;
				}
				return false;
			};
		};
		this.forEach(iterator);
	};
	 
	Queue.prototype.forEach = function (fn) {
		for (var i = 0, l = this._q.length; l > i; i++) {
			if(fn(this._q[i], i, l) === false) break;
		};
	};
	
	Queue.prototype.setIndex = function (index) {
		var i = index;
		
		if (i >= this.length()) {
			i = this.length() - 1;
		} else if (i < 0) {
			i = 0;
		}
		
		this._i = i;
		return this._i;
	};
	
	Queue.prototype.getIndex = function () {
		return this._i;
	};
	
	Queue.prototype.length = function () {
		return this._q.length;
	};
	
	//export to global object
	global.Chat = Chat;	
}(this));