const express = require('express');
const path = require('path');
const app = express();

app.set('port', 3000);
app.use(express.static(path.join(__dirname, 'public')));
app.listen(app.get('port'));

const WebSocketServer = require('ws').Server;
const ws = new WebSocketServer({port: 8080});
const sockets = [];

ws.on('connection', function(socket) {

    socket.on('close', () => {
        // console.log('disconnected');
        sockets.splice(sockets.indexOf(socket), 1);
    });

    socket.on('message', (message) => {
        // console.log('messaged');
        const data = JSON.parse(message);
        var s = sockets.length; while(s--) {
            if(sockets.indexOf(socket) === s) continue;
            sockets[s].send(message);
        }
    });

    // console.log('connected');
    sockets.push(socket);

});
