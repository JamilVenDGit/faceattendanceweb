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
    console.log("model loaded...");
    getStream().catch((error) => {
      Emitter.emit({ message: "failed tog get stream", error });
    });
  })
  .catch((error) => {
    Emitter.emit(Events.ERROR, { error: "Errors loading models" });
  });

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
});
