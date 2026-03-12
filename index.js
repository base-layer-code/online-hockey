const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

// 静的ファイルの場所を明示的に指定
app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

let rooms = {}; 

io.on('connection', (socket) => {
    let roomId = null;
    for (let id in rooms) {
        if (rooms[id].players.length === 1) { roomId = id; break; }
    }
    if (!roomId) {
        roomId = Math.random().toString(36).substr(2, 8).toUpperCase();
        rooms[roomId] = { players: [], config: { items: true, skills: true } };
    }

    socket.join(roomId);
    const side = rooms[roomId].players.length === 0 ? 'left' : 'right';
    rooms[roomId].players.push({ id: socket.id, side: side });

    // 自分の役割とルームIDを送信
    socket.emit('init', { side: side, config: rooms[roomId].config, roomId: roomId });
    io.to(roomId).emit('player_joined', rooms[roomId].players.length);

    socket.on('game_start_request', () => {
        if (side === 'left') io.to(roomId).emit('game_start_signal');
    });

    socket.on('move', (data) => {
        socket.to(roomId).emit('update', { side: side, x: data.x, y: data.y });
    });

    socket.on('ball_sync', (data) => {
        if (side === 'left') socket.to(roomId).emit('ball_update', data);
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
http.listen(PORT, () => console.log(`Server running`));
