const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

let players = {};

io.on('connection', (socket) => {
    let side = 'right';
    const currentSides = Object.values(players).map(p => p.side);
    
    if (!currentSides.includes('left')) side = 'left';
    else if (!currentSides.includes('right')) side = 'right';
    else side = 'spectator';

    players[socket.id] = { side: side };
    socket.emit('assign_side', side);

    socket.on('move', (data) => {
        socket.broadcast.emit('update', { side: side, x: data.x, y: data.y });
    });

    socket.on('ball_sync', (data) => {
        if (side === 'left') socket.broadcast.emit('ball_update', data);
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Server running on port ${PORT}`));
