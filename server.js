var http = require('http');
var Static = require('node-static');
var WebSocketServer = new require('ws');

const PORT = 8081;

// подключенные клиенты
var clients = new Map();
var clients_ans = new Map();
var rooms = new Map();
var rooms_connection_allow = new Map();
let id = 0;
var session_ready = false;

// WebSocket-server on port 8081
var webSocketServer = new WebSocketServer.Server({port: PORT});
webSocketServer.on('connection', function(ws) {
  clients.set(id++, ws);
  console.log("new connection with id " + (id - 1));

  ws.on('message', function(message) {
    var this_id;
    for (var client_id of clients.keys()) 
      if (clients.get(client_id) == ws) {
        this_id = client_id;
        break;
      }
    
    var data = JSON.parse(message);
    if (data.type === 'game')
      game_message_processing(data, this_id);
    if (data.type === 'find_room')
      room_find(this_id);
    if (data.type === 'connect-to') {
      try_to_connect_on(data.id, this_id);
    }
    if (data.type === 'ans')
      remember_num(data.num, this_id);
    if (data.type === 'guess') 
      guessing(this_id, data.num);
  });

  //with log
  ws.on('close', function() {
    for (var key of clients.keys())
      if (clients.get(key) === ws) {
        console.log('connection close ' + key);
        delete_from_room(key);
        clients.delete(key);
        return;
      }
  });

});

function check_game_state(str, room_id, client_id, op_id) {
  if (str.indexOf('4Б') == -1) return;
  clients.get(client_id).send(JSON.stringify({
    type: 'win',
    you_win: 'win',
    // TO DO elo: sth,
  }));
  clients.get(op_id).send(JSON.stringify({
    type: 'win',
    you_win: 'lose',
    // TO DO elo: sth,
  }));
  delete_room(room_id);
}

function guessing(client_id, num) {
  var room_id = key_find(rooms, client_id);
  var room = rooms.get(room_id);
  var op_id = room[0];
  if (room[0] == client_id)
    op_id = room[1];
  var correct_num = clients_ans.get(op_id);
  var add_ans = compare_nums(num, correct_num);
  clients.get(client_id).send(JSON.stringify({
    type: 'guess',
    str: String(num) + add_ans,
  }));
  check_game_state(add_ans, room_id, client_id, op_id);
}

function compare_nums(num1, num2) {
  var cows = 0, bulls = 0;
  for (var i in String(num1)) 
    if (num2.indexOf(num1.charAt(i)) !== -1)
      cows++;
  for (var i in String(num1))
    if (num1.charAt(i) == num2.charAt(i)) {
      cows--;
      bulls++;
    }
  return ` - ${cows}К, ${bulls}Б`;
}

function remember_num(ans, client_id) {
  clients_ans.set(client_id, ans);
  var room_id = key_find(rooms, client_id);
  var room = rooms.get(room_id);
  rooms_connection_allow.set(room_id, false);
  var total = 0;
  for (var client_id of room) {
    total += clients_ans.has(client_id);
  }
  if (total == 2) 
    start_game(room_id);
}

function start_game(room_id){
  console.log('Game started at room with id ' + room_id);
  var room = rooms.get(room_id);
  var flag = (Math.random > 0.5);
  var client_id_1 = room[0];
  var client_id_2 = room[1];
  clients.get(client_id_1).send(JSON.stringify({
    type: 'turn',
    value: flag,
  }));
  clients.get(client_id_2).send(JSON.stringify({
    type: 'turn',
    value: !flag,
  }));
}

function try_to_connect_on(room_id, client_id) {
  if (!rooms.has(room_id)) { 
    create_new_room(client_id, room_id);
    return;
  }
  if (rooms.get(room_id).length < 2 && rooms_connection_allow.get(room_id)) {
    var arr = rooms.get(room_id);
    arr.push(client_id);
    rooms.set(room_id, arr);
    for (var client_id of rooms.get(room_id))
    clients.get(client_id).send(JSON.stringify({
      type: 'ask',
    }));
    return;
  }
  
}

function delete_room(room_id) {
  rooms.delete(room_id);
  rooms_connection_allow.delete(room_id); 
}

function delete_from_room(client_id) {
  for (var room_id of rooms.keys()) {
    var room = rooms.get(room_id);
    if (room.indexOf(client_id) != -1) {
      rooms.delete(room_id);
      rooms_connection_allow.delete(room_id);
    }
  }
}

function random_int(min = 0, max = 100) {
  return Math.random() * (max - min) + min;
}

function gen_room_id() {
  var alphabet = '1234567890qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM';
  var s = '';
  for (var i = 0; i < 6; i++) {
    s = s + alphabet.charAt(random_int(0, alphabet.length - 1));
  }
  return s;
}

function create_new_room(client_id, room_id = undefined) {
  if (room_id === undefined) room_id = gen_room_id();
  rooms_connection_allow.set(room_id, true);
  rooms.set(room_id, [client_id]);
  return room_id;
}

function find_empty_room(client_id) {
  for (var room_id of rooms.keys())
    if (rooms.get(room_id).length == 1 && rooms_connection_allow.get(room_id) == true) {
      var clients = rooms.get(room_id);
      clients.push(client_id);
      rooms.set(room_id, clients);
      rooms_connection_allow.set(room_id, false);
      session_ready = true;
      return room_id;
    }
  return create_new_room(client_id);
}

function room_find(client_id){
  session_ready = false;
  var client = clients.get(client_id);
  var room_id = find_empty_room(client_id);
  client.send(JSON.stringify({
    type: 'connect',
    id: room_id,
  }));
  if (session_ready) {
    for (var client_id of rooms.get(room_id))
      clients.get(client_id).send(JSON.stringify({
        type: 'ask',
      }));
    session_ready = false;
  }
}

function key_find(mp, value) {
  for (var key of mp.keys()) {
    var arr = mp.get(key);
    if (arr.indexOf(value) !== -1) {
      return key;
    }
  }
  return 'no_key';
}

function game_message_processing(message, id){
  if (message.type == "game") console.log('recieved message ' + message.msg);
  var room_id = key_find(rooms, id);
  var room = rooms.get(room_id);
  var op_id = room[(room.indexOf(id) + 1) % 2];

  var data = JSON.stringify({
    type: "game",
    msg: message.msg,
  });

  clients.get(op_id).send(data);
}

// stat port: 80
var fileServer = new Static.Server('.');
http.createServer(function (req, res) {
  
  fileServer.serve(req, res);

}).listen(80);

console.log("Server started at ports: 80, 8081");

