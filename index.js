const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

let rooms = {}; 

io.on('connection', (socket) => {
    let roomId = null;

    // 空いている部屋を探す
    for (let id in rooms) {
        if (rooms[id].players.length === 1) {
            roomId = id;
            break;
        }
    }

    // なければ新室作成
    if (!roomId) {
        roomId = 'room_' + Math.random().toString(36).substr(2, 8).toUpperCase();
        rooms[roomId] = { 
            players: [], 
            config: { items: true, skills: true, limit: true, winScore: 5 }
        };
    }

    socket.join(roomId);
    const side = rooms[roomId].players.length === 0 ? 'left' : 'right';
    rooms[roomId].players.push({ id: socket.id, side: side });

    // 初期化情報を送信
    socket.emit('init', { side: side, config: rooms[roomId].config, roomId: roomId });

    // 部屋の人数を更新（2人揃ったらHTML側のボタンが有効になる）
    io.to(roomId).emit('player_joined', rooms[roomId].players.length);

    // ホストからの開始リクエストを受け取る
    socket.on('game_start_request', () => {
        if (side === 'left') {
            io.to(roomId).emit('game_start_signal');
        }
    });

    // プレイヤーの動き
    socket.on('move', (data) => {
        socket.to(roomId).emit('update', { side: side, x: data.x, y: data.y });
    });

    // ボールとスコアの同期（P1が計算主導）
    socket.on('ball_sync', (data) => {
        if (side === 'left') {
            socket.to(roomId).emit('ball_update', data);
        }
    });

    socket.on('disconnect', () => {
        if (rooms[roomId]) {
            rooms[roomId].players = rooms[roomId].players.filter(p => p.id !== socket.id);
            if (rooms[roomId].players.length === 0) delete rooms[roomId];
            else io.to(roomId).emit('player_joined', rooms[roomId].players.length);
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Server is running!`));
