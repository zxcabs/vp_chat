/*
 * chat.js
 */
(function (global) {
	var $ = global.$;
	
	function extend (target, obj) {
		var   _obj = obj || {}
			, _target = target || {}
			, _prop = {}
			;
		
		for (var prop in _obj) {
			_prop[prop] = {value: _obj[prop]};
		}
		
		return Object.create(_target, _prop);
	}
	
	/*
	 * Chat class
	 */
	function Chat(opt) {
		//default setting clone
		
		this._opt = extend({
				  defaultChannel: 'main'
				, channelList: ['main']
				, pollFreq: 1000
				, scrollEnabled: true
				, msgElId: 'lschat_list_msg'
				, textAreaEl: 'lschat_input_msg'
			}, opt);
		
		this._msgEl = $(this._opt.msgElId);
		this._textAreaEl = $(this._opt.textAreaEl);
		this._channels = new Queue();
				
		for (var i = 0, l = this._opt.channelList.length; l > i; i++) {
			this._channels.push(new Channel(this._opt.channelList[i], this));
		}
		
		this.activateChannel(this._opt.defaultChannel);
	};
	
	Chat.prototype.activateChannel = function (name) {
		var channel = this.findChannelByName(name)
			, activeChannel = this.getActiveChannel()
			;
			
		if (activeChannel) activeChannel.deactivate();
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
		var msg = this.getMsg()
			, channel = this.getActiveChannel();
		
		if (msg && channel) {
			channel.sendMsg(msg);
		};
		
		this.setMsg('');
	};	
	
	Chat.prototype.sendClick = function () {
		this.onMsg();
	};
	
	Chat.prototype.send = function (ch, msg, fn, timeout) {
		var req = new Chat.Request({
						  url: '/plugins/chatlight/include/ajax/lschatSendMsg.php'
						, method: 'POST'
						, data: { msg: msg
								, security_ls_key: Chat.SEC_KEY
								, channel: ch.getName()
						}
						, onSuccess: fn.bind(ch)
						, onFailure: function (res) {
							fn('Some error');
						}.bind(ch)
					});
		if (!timeout) {
			req.send();
		} else {
			setTimeout(function () {
				req.send();
			}, timeout);
		}
	};
	
	Chat.Request = global.Request;
	Chat.SEC_KEY = global.LIVESTREET_SECURITY_KEY;
	
	/*
	 * Chat channel class
	 */
	function Channel(name, chat) {
		this._name = name;
		this._chat = chat;
		this._isActive = false;
		this._el = $('block_lschat_tab_' + this._name);
		this._msgBuffer = new Buffer();
		this._sendBuffer = new Buffer(10);
		this._msg = '';
		this._isSending = false;
		
	};
	
	Channel.prototype.isActive = function () {
		return this._isActive;
	};
	
	Channel.prototype.activate = function () {
		this._el.addClass('active');
		this._chat.print(this._text);
		this._chat.setMsg(this._msg);
		this._isActive = true;
	};
	
	Channel.prototype.deactivate = function () {
		this._el.removeClass('active');
		this._msg = this._chat.getMsg();
		this._chat.clear();
		this._isActive = false;
	};
	
	Channel.prototype.sendMsg = function (msg) {
		this._sendBuffer.push(msg);
		this.send();
	};
	
	Channel.prototype.send = function (timeout) {
		var msg = this._sendBuffer.first();

		if (!this._isSending) {
			if (msg) {
				this._isSending = true;
				this._chat.send(this, msg, function (err) {
					this._isSending = false;
					this._sendHandler(err);
				}, timeout);
			} else {
				this._isSending = false;
			}
		}
	};
	
	Channel.prototype._sendHandler = function (err) {
		if (err) {
			this.send(this._chat._pollFreq * 4);
		} else {
			this._sendBuffer.shift();
			if (this._sendBuffer.first()) {
				this.send(this._chat._pollFreq);
			};
		}
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
		this._maxLength = max;
	};
	
	Buffer.prototype.first = function () {
		return this._buff[0];
	};
	
	Buffer.prototype.shift = function () {
		return this._buff.shift();
	};
	
	Buffer.prototype.push = function (item) {
		if (this._buff.length == this._maxLength) {
			this._buff.shift();
		}
		
		this._buff.push(item);
	};
	
	Buffer.prototype.length = function () {
		return this._buff.length;
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