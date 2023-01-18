Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri("/Face_Recognition/models"),
  faceapi.nets.faceLandmark68Net.loadFromUri("/Face_Recognition/models"),
  faceapi.nets.faceRecognitionNet.loadFromUri("/Face_Recognition/models"),
  faceapi.nets.faceExpressionNet.loadFromUri("/Face_Recognition/models"),
  faceapi.nets.ssdMobilenetv1.loadFromUri("/Face_Recognition/models"),
])
  .then(() => console.log("Face API is ready!"))
  .catch((error) => {
    Emitter.emit(Events.ERROR, { error: "Errors loading models" });
  });

// DOM ELEMENTS
const video = document.getElementById("video-element");
const container = document.getElementById("container");

let startupDone = false;
let stream;
let faceMatcher = null;

async function startup(faces) {
  const urlParams = new URLSearchParams(window.location.search);
  const width = urlParams.get("w") || 640;
  const height = urlParams.get("h") || 480;

  stream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: false,
  });

  video.width = width;
  video.height = height;
  video.srcObject = stream;
  video.play();

  const displaySize = {
    width: video.width,
    height: video.height,
  };

  const labeledFaceDescriptors = faces
    .flat()
    .map((item) => faceapi.LabeledFaceDescriptors.fromJSON(item));

  faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.6);

  setInterval(async function () {
    document.querySelectorAll(".canvas-result").forEach((el) => el.remove());
    let canvas = document.createElement("canvas");
    canvas.className = "canvas-result";
    canvas.style.position = "absolute";
    canvas.style.top = 0;
    canvas.style.left = 0;
    faceapi.matchDimensions(canvas, displaySize);
    container.append(canvas);

    const detections = await faceapi
      .detectAllFaces(
        video,
        new faceapi.SsdMobilenetv1Options({ minConfidence: 0.9 })
      )
      .withFaceLandmarks()
      .withFaceDescriptors();

    const resizedDetections = faceapi.resizeResults(detections, displaySize);

    const results = resizedDetections.map((d) =>
      faceMatcher.findBestMatch(d.descriptor)
    );

    const payload = results.map((item) => ({
      label: item.label,
      distance: item.distance,
    }));

    if (payload.length > 0) Emitter.emit(Events.FACE_FOUND, { data: payload });

    results.forEach((result, i) => {
      const box = resizedDetections[i].detection.box;
      const drawBox = new faceapi.draw.DrawBox(box, {
        label: result.toString(),
      });

      drawBox.draw(canvas);
    });
  }, 500);
}

async function onMessage(message) {
  try {
    if (!startupDone) {
      await startup(JSON.parse(message.data));
      startupDone = true;
    }
  } catch (error) {
    Emitter.emit(Events.NOTIFICATION, {
      notificationType: 3,
      message: "Error from webview!",
    });
    Emitter.emit(Events.ERROR, { error: error.message });
  }
}

if (navigator.userAgent.indexOf("Chrome") != -1) {
  document.addEventListener("message", onMessage);
} else {
  window.addEventListener("message", onMessage);
}

async function start() {
  if (!window.ReactNativeWebView) {
    const faces = JSON.parse(localStorage.getItem("data"));
    await startup(faces);
  }
}

start();
