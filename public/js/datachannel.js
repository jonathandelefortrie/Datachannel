(function() {

    // Debug
    let debug = false;

    // Helpers
    function log(type) {
        const args = [].slice.call(arguments, 1);
        if(debug) console[type].apply(console, args);
    }

    // Polyfills
    const RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
    const RTCSessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription;
    const RTCIceCandidate = window.RTCIceCandidate || window.mozRTCIceCandidate;
    const WebSocket = window.WebSocket || window.MozWebSocket;

    // Config
    const config = {
        iceServers: [/*{
            "urls": "turn:turn.bistri.com:80",
            "username": "datachannel",
            "credential": "12345",
            "credentialType": "password"
        }, */{
            "urls": ["stun:stun.services.mozilla.com", "stun:stun.l.google.com:19302"]
        }]
    };
    const mandatory = { mandatory: { 'OfferToReceiveAudio': false, 'OfferToReceiveVideo': false } };
    const option = { optional: [{'DtlsSrtpKeyAgreement': true}/*, {'RtpDataChannels': true }*/] };

    // Class
    class DataChannel {

        constructor(config) {

            const id = (Math.random() * 1000).toFixed().toString() + Date.now();
            const socket = new WebSocket(config.socket || "ws://0.0.0.0:8080");
            const connections = {};

            // WebSocket
            socket.onopen = e => {
                log("log", "Websocket opened");

                socket.push = socket.send;
                socket.send = function (data) {
                    socket.push(JSON.stringify(data));
                };

                socket.send({ type: "connect", data: { localId: id } });
            };
            socket.onclose = e => {
                log("log", "Websocket closed");

                socket.send({ type: "disconnect", data: { localId: id } });
            };
            socket.onerror = e => {
                log("log", "Websocket error");
            };
            socket.onmessage = e => {
                log("log", "Websocket message");

                const data = JSON.parse(e.data);
                this[data.type](data.data);
            };

            // Public
            this.id = id;
            this.socket = socket;
            this.connections = connections;

            // Debug
            debug = config.debug || debug;
        }

        connect(data) {

            if(data.localId === this.id) return;
            const connection = new RTCPeerConnection(config, option);
            connection.onicecandidate = e => !e.candidate || this.socket.send({ type: "candidate", data: { candidate: e.candidate, localId: this.id, remoteId: data.localId } });
            connection.oniceconnectionstatechange = e => this.oniceconnectionstatechange && this.oniceconnectionstatechange.call(null, e);

            const channel = connection.createDataChannel("datachannel", { reliable: false });
            channel._id = data.localId;
            channel.onerror = e => this.onerror && this.onerror.call(null, e);
            channel.onmessage = e => this.onmessage && this.onmessage.call(null, e);
            channel.onopen = e => this.onopen && this.onopen.call(null, e);
            channel.onclose = e => this.onclose && this.onclose.call(null, e);

            connection.createOffer(offer => {
                connection.setLocalDescription(offer, () => {
                    this.socket.send({ type: "offer", data: { description: offer, localId: this.id, remoteId: data.localId } });
                }, e => log("error", "Set local description offer", e));
            }, e => log("error", "Create offer", e), mandatory);

            this.connections[data.localId] = { connection, channel };
        }

        disconnect(data) {

            if(data.localId === this.id) return;
            const channel = this.connections[data.localId].channel;
            const connection = this.connections[data.localId].connection;

            channel.close();
            connection.close();

            delete this.connections[data.localId];
        }

        answer(data) {

            if(data.remoteId !== this.id) return;
            const connection = this.connections[data.localId].connection;

            connection.setRemoteDescription(new RTCSessionDescription(data.description),
                () => log("info", "Set remote description answer"),
                e => log("error", "Set remote description answer", e)
            );
        }

        offer(data) {

            if(data.remoteId !== this.id) return;
            const connection = new RTCPeerConnection(config, option);

            connection.onicecandidate = e => !e.candidate || this.socket.send({ type: "candidate", data: { candidate: e.candidate, localId: this.id, remoteId: data.localId } });
            connection.oniceconnectionstatechange = e => this.oniceconnectionstatechange && this.oniceconnectionstatechange.call(null, e);
            connection.ondatachannel = event => {
                const channel = event.channel;
                channel._id = data.localId;
                channel.onerror = e => this.onerror && this.onerror.call(null, e);
                channel.onmessage = e => this.onmessage && this.onmessage.call(null, e);
                channel.onopen = e => this.onopen && this.onopen.call(null, e);
                channel.onclose = e => this.onclose && this.onclose.call(null, e);

                this.connections[data.localId].channel = channel;
            };

            connection.setRemoteDescription(new RTCSessionDescription(data.description),
                () => log("info", "Set remote description offer"),
                e => log("error", "Set remote description offer", e)
            );

            connection.createAnswer(answer => {
                connection.setLocalDescription(answer, () => {
                    this.socket.send({ type: "answer", data: { description: answer, localId: this.id, remoteId: data.localId } });
                }, e => log("error", "Set local description answer", e));
            }, e => log("error", "Create answer", e), mandatory);

            this.connections[data.localId] = { connection };
        }

        candidate(data) {

            if(data.remoteId !== this.id) return;
            const connection = this.connections[data.localId].connection;

            connection.addIceCandidate(new RTCIceCandidate(data.candidate),
                () => log("info", "Add candidate"),
                e => log("error", "Add candidate", e)
            );
        }
    }

    window.DataChannel = DataChannel;

})();
