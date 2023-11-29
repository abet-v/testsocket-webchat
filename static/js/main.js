console.log("main.js loaded");

const protocol = window.location.protocol === "https:" ? "wss" : "ws";
const url = `${protocol}://${window.location.host}/ws/socket-server`;
const username = "username" + Math.random();
var mapPeers = {};

const socket = new WebSocket(url);

socket.onmessage = function (e) {
  let data = JSON.parse(e.data);
  const peerUsername = data.peer;

  if (data.type === "message") {
    addMessage(data.message);
  }

  if (data.type === "new-peer") {
    createOffer(peerUsername, data.message.receiver_channel_name);
    let peers = document.getElementById("peers");
    let peer = document.createElement("div");
    peer.innerHTML = data.peer;
    peers.appendChild(peer);
  }

  if (data.type === "new-offer") {
    createAnswer(
      data.message.sdp,
      peerUsername,
      data.message.receiver_channel_name
    );
  }

  if (data.type === "new-answer") {
    var answer = new RTCSessionDescription(data.message.sdp);
    var peer = mapPeers[peerUsername][0];

    peer.setRemoteDescription(answer);
    return;
  }

  console.log("Data:", data);
};

socket.onopen = function (e) {
  console.log("Socket connected");
  sendSignal("new-peer", {});
};

let form = document.getElementById("form");
form.addEventListener("submit", function (e) {
  e.preventDefault();

  let message = document.getElementById("message").value;

  socket.send(
    JSON.stringify({
      peer: username,
      type: "message",
      message: message,
    })
  );
  form.reset();
});

const mediaStream = new MediaStream();

const constraints = {
  video: true,
  audio: true,
};

const localVideo = document.getElementById("local-video");

const userMedia = navigator.mediaDevices
  .getUserMedia(constraints)
  .then((stream) => {
    stream.getTracks().forEach((track) => {
      mediaStream.addTrack(track);
    });
    localVideo.srcObject = mediaStream;
    // we mute for development purposes
    localVideo.muted = true;
  })
  .catch((err) => {
    console.log(err);
  });

function sendSignal(type, message) {
  console.log("Sending signal with message : ", message);
  socket.send(
    JSON.stringify({
      peer: username,
      type: type,
      message: message,
    })
  );
}

function addLocalTracks(peerConnection) {
  mediaStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, mediaStream);
  });
}

function addMessage(message_text) {
  const messagesDiv = document.getElementById("messages");
  let newMessageDiv = document.createElement("div");
  newMessageDiv.innerHTML = message_text;
  messagesDiv.appendChild(newMessageDiv);
}

const createVideo = (peerUsername) => {
  const videoContainer = document.getElementById("videos");
  const remoteVideo = document.createElement("video");
  remoteVideo.id = peerUsername;
  remoteVideo.autoplay = true;
  remoteVideo.playsinline = true;
  videoContainer.appendChild(remoteVideo);
  return remoteVideo;
};

const setOnTrack = (peerConnection, remoteVideo) => {
  const remoteStream = new MediaStream();
  remoteVideo.srcObject = remoteStream;
  peerConnection.addEventListener("track", (event) => {
    remoteStream.addTrack(event.track, remoteStream);
  });
};

const removeVideo = (video) => {
  const videoContainer = document.getElementById("videos");
  videoContainer.removeChild(video);
};

const createOffer = (peerUsername, receiver_channel_name) => {
  if (peerUsername === username) {
    return;
  }
  console.log("New peer:", peerUsername);
  const peerConnection = new RTCPeerConnection(null);
  addLocalTracks(peerConnection);
  const dc = peerConnection.createDataChannel("chat");
  dc.addEventListener("open", () => {
    console.log("Connection opened");
  });
  dc.addEventListener("message", (e) => {
    console.log("Message from data channel:", e.data);
  });
  const remoteVideo = createVideo(peerUsername);
  setOnTrack(peerConnection, remoteVideo);
  mapPeers[peerUsername] = [peerConnection, dc];

  peerConnection.addEventListener("iceconnectionstatechange", (event) => {
    if (peerConnection.iceConnectionState === "connected") {
      console.log("Successfully connected with:", peerUsername);
    }
    if (
      peerConnection.iceConnectionState === "disconnected" ||
      peerConnection.iceConnectionState === "failed" ||
      peerConnection.iceConnectionState === "closed"
    ) {
      if (peerConnection.iceConnectionState !== "closed") {
        peerConnection.close();
      }
      delete mapPeers[peerUsername];
      console.log("Disconnected from:", peerUsername);
      removeVideo(remoteVideo);
    }
  });

  peerConnection.addEventListener("icecandidate", (event) => {
    if (event.candidate) {
      console.log("New ice candidate");
      return;
    }
    sendSignal("new-offer", {
      sdp: peerConnection.localDescription,
      receiver_channel_name: receiver_channel_name,
    });
  });

  peerConnection.createOffer().then((sdp) => {
    peerConnection.setLocalDescription(sdp);
    console.log("Local description set");
  });
};

const createAnswer = (offer, peerUsername, receiver_channel_name) => {
  if (peerUsername === username) {
    return;
  }

  const peerConnection = new RTCPeerConnection(null);
  addLocalTracks(peerConnection);

  const remoteVideo = createVideo(peerUsername);
  setOnTrack(peerConnection, remoteVideo);

  peerConnection.addEventListener("datachannel", (event) => {
    peerConnection.dc = event.channel;
    peerConnection.dc.addEventListener("open", () => {
      console.log("Connection opened");
    });
    peerConnection.dc.addEventListener("message", (e) => {
      console.log("Message from data channel:", e.data);
    });
    mapPeers[peerUsername] = [peerConnection, dc];
  });

  peerConnection.addEventListener("iceconnectionstatechange", (event) => {
    if (peerConnection.iceConnectionState === "connected") {
      console.log("Successfully connected with:", peerUsername);
    }
    if (
      peerConnection.iceConnectionState === "disconnected" ||
      peerConnection.iceConnectionState === "failed" ||
      peerConnection.iceConnectionState === "closed"
    ) {
      if (peerConnection.iceConnectionState !== "closed") {
        peerConnection.close();
      }
      delete mapPeers[peerUsername];
      console.log("Disconnected from:", peerUsername);
      removeVideo(remoteVideo);
    }
  });

  peerConnection.addEventListener("icecandidate", (event) => {
    if (event.candidate) {
      console.log(
        "New ice candidate: ",
        JSON.stringify(peerConnection.localDescription)
      );
      return;
    }
    sendSignal("new-answer", {
      sdp: peerConnection.localDescription,
      receiver_channel_name: receiver_channel_name,
    });
  });
  peerConnection.setRemoteDescription(offer).then(() => {
    peerConnection.createAnswer().then((sdp) => {
      peerConnection.setLocalDescription(sdp);
      console.log("Local description set");
    });
  });
};
