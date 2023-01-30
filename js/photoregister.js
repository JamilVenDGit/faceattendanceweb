// Promise.all([
//   faceapi.nets.tinyFaceDetector.loadFromUri("../models"),
//   faceapi.nets.faceLandmark68Net.loadFromUri("../models"),
//   faceapi.nets.faceRecognitionNet.loadFromUri("../models"),
//   faceapi.nets.faceExpressionNet.loadFromUri("../models"),
//   faceapi.nets.ssdMobilenetv1.loadFromUri("../models"),
// ])
//   .then(() => {
//     Emitter.emit(Events.MODEL_LOADED, {
//       message: "Models loaded successfully",
//     });
//     console.log("model loaded...");
//   })
//   .catch((error) => {
//     Emitter.emit(Events.ERROR, { error: "Errors loading models" });
//   });

const label = "yaqoob";
const data = {};
const input = document.querySelector("#input-photos");

input.addEventListener("change", () => {
  const files = input.files;
  for (let i = 0; i < files.length; i++) {
    const picURL = window.URL.createObjectURL(files[i]);

    if (Array.isArray(data[label])) {
      data[label].push(picURL);
    } else {
      data[label] = [picURL];
    }
  }

  console.log("==> data", data);
  train();
});

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

document.addEventListener("DOMContentLoaded", (e) => {
  input.click();
});
