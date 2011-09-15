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
		this._channels = {};
				
		for (var i = 0, l = this._opt.channelList.length; l > i; i++) {
			this._channels[this._opt.channelList[i]] = new Channel(this._opt.channelList[i], this);
		}
		
		this.activateChannel(this._opt.defaultChannel);
	};
	
	Chat.prototype.activateChannel = function (name) {
		var channel = this._channels[name]
			, activeChannel = this.getActiveChannel()
			;
			
		if (activeChannel) activeChannel.deactivate();
		if (channel) channel.activate();
	};
	
	Chat.prototype.getActiveChannel = function () {
		var active = null
			, channel = null;
		
		for (var ch in this._channels) {
			channel = this._channels[ch];
			
			if (channel.isActive()) {
				active = channel;
				break;
			}
		}
		
		return active;
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
	};	
	
	Chat.prototype.sendClick = function () {
		this.onMsg();
	};
	
	/*
	 * Chat channel class
	 */
	function Channel(name, chat) {
		this._name = name;
		this._chat = chat;
		this._isActive = false;
		this._el = $('block_lschat_tab_' + this._name);
		this._text = 'Загружаем...';
		this._msg = '';
		
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
		console.log(this._name + ' ' + msg);
	};
	
	global.Chat = Chat;	
}(this));