var messages = new Array();
var msg_count = 0;
var you_turn = false;
var button = document.getElementById('find_button');
var game_end = false;
var game_id = '';

var HOST = 'ws://localhost:8081'; //'ws://45.133.18.246:8081'; 

if (!window.WebSocket) {
	document.body.innerHTML = 'WebSocket в этом браузере не поддерживается.';
}

var socket = new WebSocket(HOST);

create_subscribe_div();

//connect по уже существующему хешу
socket.onopen = function() {
  if (window.location.hash !== '') {
    var data = JSON.stringify({
      type: 'connect-to',
      id: window.location.hash.slice(1),
    });
    while (!socket.readyState) {}
    socket.send(data);
  }
}

//поиск комнаты по нажатию на кнопку FIND
button.onclick = function() {
  if (game_end || window.location.hash === '') {
    get_id();
  }
}

// отправить сообщение из формы publish
document.forms.publish.onsubmit = function() {
  var outgoingMessage = this.message.value;
  if (!you_turn || !string_is_correct(outgoingMessage)) return false;
  
  var data = JSON.stringify({
    type: 'game',
    msg: outgoingMessage,
  });

  socket.send(data);

  socket.send(JSON.stringify({
    type: 'guess',
    num: outgoingMessage,
  }));
  you_turn = false;
  set_turn_state(you_turn);
  return false;
};

function dispay_message(outgoingMessage) {
  var messageElem = document.createElement('div');
  messageElem.setAttribute('id', msg_count++);
  messageElem.setAttribute('class', 'text myturn');
  messageElem.appendChild(document.createTextNode(outgoingMessage));
  document.getElementById('subscribe').appendChild(messageElem);
}

function string_is_correct(msg) {
  if (msg.length != 4)
    return false;
  for (i of msg) 
    if ('123456789'.search(i) == -1) 
      return false;
  let a = [0,0,0,0,0,0,0,0,0,0];
  for (i of msg)
    a[i]++;
  for (i of a) 
    if (i > 1)
      return false;
  return true;
}

// обработчик входящих сообщений 
socket.onmessage = function(event) {
  var incomingMessage = event.data;
  incomingMessage = JSON.parse(incomingMessage);
  if (incomingMessage.type === "game") {
    showMessage(incomingMessage.msg);
    you_turn = !you_turn;
    set_turn_state(you_turn);
  }
  if (incomingMessage.type === "connect") {
    game_end = false;
    game_id = incomingMessage.id;
    window.location.hash = incomingMessage.id;
    document.getElementById('subscribe').remove();
    create_subscribe_div();
  }
  if (incomingMessage.type === 'ask')
    make_number();
  if (incomingMessage.type === 'turn') {
    you_turn = incomingMessage.value;
    set_turn_state(you_turn);
  }
  if (incomingMessage.type === 'guess') 
    dispay_message(incomingMessage.str);
  if (incomingMessage.type === 'win') 
    set_win_state(incomingMessage.you_win);
};

function set_turn_state(you_turn) {
  var div = document.getElementById('turn-win-state');
  var str = (you_turn) ? 'You turn' : 'Opponent turn';
  div.innerHTML = '';
  div.appendChild(document.createTextNode(str));
}

function set_win_state(str) {
  you_turn = false;
  msg_count = 0;
  var div = document.getElementById('turn-win-state');
  div.innerHTML = '';
  div.appendChild(document.createTextNode(`You ${str}`));
  game_end = true;
}

function make_number() {
  var our_num = '';
  while (!string_is_correct(our_num))
    our_num = prompt('Загадайте число из 4 цифр\nЦифра не может быть равна 0', 'Ваше число?');
  socket.send(JSON.stringify({
    type: 'ans',
    num: our_num,
  }));
}

function set_session_id(id) {
  window.location.hash = id;
}

// показать сообщение в div#subscribe
function showMessage(message) {
  var messageElem = document.createElement('div');
  messageElem.setAttribute('id', msg_count++);
  messageElem.setAttribute('class', 'text opponentturn');
  messageElem.appendChild(document.createTextNode(message));
  document.getElementById('subscribe').appendChild(messageElem);
  messageElem = document.createElement('br');
  document.getElementById('subscribe').appendChild(messageElem);
}

function create_subscribe_div() {
  var div = document.createElement('div');
  div.setAttribute('id', 'subscribe');
  document.body.appendChild(div);
}

function get_id() {
  var data = JSON.stringify({
    type: 'find_room',
  });
  socket.send(data);
}