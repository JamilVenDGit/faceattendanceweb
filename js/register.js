Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri("/Face_Recognition/models"),
  faceapi.nets.faceLandmark68Net.loadFromUri("/Face_Recognition/models"),
  faceapi.nets.faceRecognitionNet.loadFromUri("/Face_Recognition/models"),
  faceapi.nets.faceExpressionNet.loadFromUri("/Face_Recognition/models"),
  faceapi.nets.ssdMobilenetv1.loadFromUri("/Face_Recognition/models"),
])
  .then(() => getStream())
  .catch((error) => {
    Emitter.emit(Events.ERROR, { error: "Errors loading models" });
  });

let stream;
let data = {};
const video = document.getElementById("video-element");

async function getStream() {
  stream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: false,
  });
  video.srcObject = stream;
  video.play();
}

async function takePhoto() {
  const videoTrack = stream.getVideoTracks()[0];
  const imageCapture = new ImageCapture(videoTrack);
  imageCapture.takePhoto().then(async (blob) => {
    // // Get Label
    const urlParams = new URLSearchParams(window.location.search);
    const label = urlParams.get("id") || "unknown";

    const picURL = window.URL.createObjectURL(blob);

    if (Array.isArray(data[label])) {
      data[label].push(picURL);
    } else {
      data[label] = [picURL];
    }

    Emitter.emit(Events.NOTIFICATION, {
      notificationType: 1,
      message: "Photo has been captured!",
    });
    // Notifier.showNotification(1, "Photo has been captured!");
    console.log("Picture Taken!", data);
  });
}

async function train() {
  try {
    if (Object.keys(data).length > 0) {
      Emitter.emit(Events.TRAINING_START);
      const labeledFaceDescriptors = await loadLabeledImages();
      const faces = labeledFaceDescriptors.map((item) => item.toJSON());
      faces && Emitter.emit(Events.DATA, { data: JSON.stringify(faces) });
    } else {
      Emitter.emit(Events.NOTIFICATION, {
        notificationType: 2,
        message: "There are no pictures taken!",
      });
    }
  } catch (error) {
    Emitter.emit(Events.ERROR, {
      error: "Error in training faces!" + "Error: " + error.message,
    });
  }
}

async function onMessage(message) {
  let payload = JSON.parse(message.data);

  switch (payload.type) {
    case Events.TAKE_PHOTO:
      takePhoto();
      break;
    case Events.DONE_PRESS:
      train();
      break;
    default:
      break;
  }
}

function loadLabeledImages() {
  return Promise.all(
    Object.entries(data).map(async (item) => {
      const label = item[0];
      const descriptions = [];

      for (let i = 0; i < item[1].length; i++) {
        const img = await faceapi.fetchImage(item[1][i]);
        const detections = await faceapi
          .detectSingleFace(
            img,
            new faceapi.SsdMobilenetv1Options({ minConfidence: 0.9 })
          )
          .withFaceLandmarks()
          .withFaceDescriptor();
        if (detections) {
          descriptions.push(detections.descriptor);
        }
      }
      return new faceapi.LabeledFaceDescriptors(label, descriptions);
    })
  );
}

if (navigator.userAgent.indexOf("Chrome") != -1) {
  document.addEventListener("message", onMessage);
} else {
  window.addEventListener("message", onMessage);
}
