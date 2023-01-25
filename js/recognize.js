Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri("../models"),
  faceapi.nets.faceLandmark68Net.loadFromUri("../models"),
  faceapi.nets.faceRecognitionNet.loadFromUri("../models"),
  faceapi.nets.faceExpressionNet.loadFromUri("../models"),
  faceapi.nets.ssdMobilenetv1.loadFromUri("../models"),
])
  .then(() => {
    Emitter.emit(Events.MODEL_LOADED, {
      message: "Models loaded successfully",
    });
    console.log("Face API is ready!");
  })
  .catch((error) => {
    Emitter.emit(Events.ERROR, { error: "Errors loading models" });
  });

// DOM ELEMENTS
const video = document.getElementById("video-element");
const container = document.getElementById("container");

let cameraMode = "user";
let startupDone = false;
let stream;
let faceMatcher = null;

async function startup(faces) {
  console.log("startup", faces);
  const urlParams = new URLSearchParams(window.location.search);
  const width = urlParams.get("w") || 640;
  const height = urlParams.get("h") || 480;

  stream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: false,
  });
  const settings = stream.getVideoTracks()[0].getSettings();
  Emitter.emit(Events.DATA, { settings });

  video.width = width;
  video.height = height;
  video.srcObject = stream;
  video.play();

  const displaySize = {
    width: video.width,
    height: video.height,
  };

  const labeledFaceDescriptors = faces.map((item) =>
    faceapi.LabeledFaceDescriptors.fromJSON(item)
  );

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

    // results.forEach((result, i) => {
    //   const box = resizedDetections[i].detection.box;
    //   const drawBox = new faceapi.draw.DrawBox(box, {
    //     label: result.toString(),
    //   });

    //   drawBox.draw(canvas);
    // });
  }, 500);
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach((track) => {
      track.stop();
    });
  }
}

async function switchCamera() {
  try {
    stopCamera();
    cameraMode = cameraMode === "user" ? "environment" : "user";
    const constraints = {
      video: {
        facingMode: { exact: cameraMode },
      },
      audio: false,
    };

    stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;
    video.play();
  } catch (error) {
    console.log("ERROR", error);
  }
}

async function onMessage(message) {
  console.log("==> messsage", message.data);
  const data = JSON.parse(message.data);

  try {
    switch (data.type) {
      case "data":
        if (!startupDone) {
          await startup(data.data);
          startupDone = true;
        }
        break;

      case "switch_camera":
        switchCamera();
        break;

      default:
        break;
    }
  } catch (error) {}
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
