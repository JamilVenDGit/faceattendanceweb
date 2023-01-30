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
  })
  .catch((error) => {
    Emitter.emit(Events.ERROR, { error: "Errors loading models" });
  });

const urlParams = new URLSearchParams(window.location.search);
let stream;
let data = {};

// async function takePhoto() {
//   const videoTrack = stream.getVideoTracks()[0];
//   const imageCapture = new ImageCapture(videoTrack);
//   imageCapture.takePhoto().then(async (blob) => {
//     // // Get Label

//     const label = urlParams.get("id") || "unknown";

//     const picURL = window.URL.createObjectURL(blob);

//     if (Array.isArray(data[label])) {
//       data[label].push(picURL);
//     } else {
//       data[label] = [picURL];
//     }

//     Emitter.emit(Events.NOTIFICATION, {
//       notificationType: 1,
//       message: "Photo has been captured!",
//     });
//     // Notifier.showNotification(1, "Photo has been captured!");
//     console.log("Picture Taken!", data);
//   });
// }

function dataURLtoFile(dataurl, filename) {
  var arr = dataurl.split(","),
    mime = arr[0].match(/:(.*?);/)[1],
    bstr = atob(arr[1]),
    n = bstr.length,
    u8arr = new Uint8Array(n);

  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }

  return new File([u8arr], filename, { type: mime });
}

function takePhotosAndTrain(photos) {
  const label = urlParams.get("id") || "unknown";

  if (Array.isArray(photos)) {
    photos.map((photo, index) => {
      const file = dataURLtoFile(
        `data:text/plain;base64,${photo}`,
        `photo-${index}.jpeg`
      );

      const picURL = window.URL.createObjectURL(file);
      if (Array.isArray(data[label])) {
        data[label].push(picURL);
      } else {
        data[label] = [picURL];
      }
    });
  }

  console.log("data", data);
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
  console.log("received message", payload);

  switch (payload.type) {
    case "send_photos":
      takePhotosAndTrain(payload.data);
      break;
    case Events.DONE_PRESS:
      train();
      break;
    case Events.SWITCH_CAMEA:
      switchCamera();
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
