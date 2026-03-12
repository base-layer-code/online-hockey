const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

let rooms = {}; // 部屋ごとのデータを保存

io.on('connection', (socket) => {
    let roomId = null;

    // 空いている部屋（1人だけ待機中）を探す
    for (let id in rooms) {
        if (rooms[id].players.length === 1) {
            roomId = id;
            break;
        }
    }

    // 空きがなければ新しく部屋を作る
    if (!roomId) {
        roomId = 'room_' + Date.now();
        rooms[roomId] = { 
            players: [], 
            config: { items: true, skills: true } // 初期設定
        };
    }

    socket.join(roomId);
    const side = rooms[roomId].players.length === 0 ? 'left' : 'right';
    rooms[roomId].players.push({ id: socket.id, side: side });

    // 自分の役割と、その部屋の設定を自分に送る
    socket.emit('init', { side: side, config: rooms[roomId].config });

    // ホスト(1P)が設定を変えたら部屋全体に通知
    socket.on('config_change', (newConfig) => {
        if (side === 'left') {
            rooms[roomId].config = newConfig;
            socket.to(roomId).emit('config_update', newConfig);
        }
    });

    // プレイヤーの動きを同期
    socket.on('move', (data) => {
        socket.to(roomId).emit('update', { side: side, x: data.x, y: data.y });
    });

    // ボールの動きを同期（左側のプレイヤーがマスター）
    socket.on('ball_sync', (data) => {
        if (side === 'left') {
            socket.to(roomId).emit('ball_update', data);
        }
    });

    // 接続が切れたら部屋から削除
    socket.on('disconnect', () => {
        if (rooms[roomId]) {
            rooms[roomId].players = rooms[roomId].players.filter(p => p.id !== socket.id);
            if (rooms[roomId].players.length === 0) {
                delete rooms[roomId]; // 誰もいなくなったら部屋を消す
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
