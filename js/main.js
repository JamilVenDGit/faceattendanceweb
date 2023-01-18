Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
  faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
  faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
  faceapi.nets.faceExpressionNet.loadFromUri("/models"),
  faceapi.nets.ssdMobilenetv1.loadFromUri("/models"),
]).then(() => console.log("Face API is ready!"));

let data = {};
let interval;
let intervalTwo;
const LS_KEY = "training_data";

const recognizeFaceVideo = document.getElementById("recognizeFaceVideo");
const registerFaceVideo = document.getElementById("registerFaceVideo");
const takePictureBtn = document.getElementById("take-picture-btn");
const container = document.getElementById("recognizeDiv");
const registerContainer = document.getElementById("registerDiv");
const trainBtn = document.getElementById("trainBtn");

let registerFaceStream = null;
let recognizeFaceStream = null;

const recognizeObserver = new MutationObserver(async function (
  mutationRecords
) {
  const classMutation = mutationRecords.filter(
    (item) => item.attributeName === "class"
  )[0];

  // If Modal Show
  if (
    classMutation?.target?.classList &&
    Array.from(classMutation?.target?.classList)?.includes("show")
  ) {
    recognizeFaceStream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480 },
      audio: false,
    });

    if (recognizeFaceStream) {
      recognizeFaceVideo.srcObject = recognizeFaceStream;
      recognizeFaceVideo.play();
    }

    const faces = JSON.parse(localStorage.getItem(LS_KEY));

    const labeledFaceDescriptors = faces.map((item) =>
      faceapi.LabeledFaceDescriptors.fromJSON(item)
    );

    const faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.6);

    const videoTrack = recognizeFaceStream.getVideoTracks()[0];
    const imageCapture = new ImageCapture(videoTrack);

    let canvas = document.createElement("canvas");

    intervalTwo = setInterval(function () {
      imageCapture.takePhoto().then(async (blob) => {
        if (canvas) canvas.remove();
        let image = await faceapi.bufferToImage(blob);
        canvas = faceapi.createCanvasFromMedia(image);
        canvas.style.position = "absolute";
        canvas.style.top = 0;
        canvas.style.left = 0;
        const displaySize = {
          width: recognizeFaceVideo.width,
          height: recognizeFaceVideo.height,
        };
        faceapi.matchDimensions(canvas, displaySize);

        container.append(canvas);

        const detections = await faceapi
          .detectAllFaces(image)
          .withFaceLandmarks()
          .withFaceDescriptors();

        const resizedDetections = faceapi.resizeResults(
          detections,
          displaySize
        );

        const results = resizedDetections.map((d) =>
          faceMatcher.findBestMatch(d.descriptor)
        );
        results.forEach((result, i) => {
          const box = resizedDetections[i].detection.box;
          const drawBox = new faceapi.draw.DrawBox(box, {
            label: result.toString(),
          });

          drawBox.draw(canvas);
        });
      });
    }, 500);
  } else {
    if (recognizeFaceStream) {
      const tracks = recognizeFaceStream.getTracks();
      if (Array.isArray(tracks) && tracks.length > 0) {
        tracks.map((track) => track.stop());
      }
    }
    clearInterval(intervalTwo);
  }
});

const observer = new MutationObserver(async function (mutationRecords) {
  const classMutation = mutationRecords.filter(
    (item) => item.attributeName === "class"
  )[0];

  // If Modal Show
  if (
    classMutation?.target?.classList &&
    Array.from(classMutation?.target?.classList)?.includes("show")
  ) {
    registerFaceStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });

    const displaySize = {
      width: registerFaceVideo.width,
      height: registerFaceVideo.height,
    };

    if (registerFaceStream) {
      registerFaceVideo.srcObject = registerFaceStream;
      registerFaceVideo.play();

      let canvas = document.createElement("canvas");
      canvas.style.position = "absolute";
      canvas.className = "face-canvas";
      canvas.style.top = 0;
      canvas.style.left = 0;
      faceapi.matchDimensions(canvas, displaySize);
      registerContainer.append(canvas);

      interval = setInterval(async () => {
        const detections = await faceapi
          .detectAllFaces(
            registerFaceVideo,
            new faceapi.TinyFaceDetectorOptions()
          )
          .withFaceLandmarks()
          .withFaceExpressions();
        const resizedDetections = faceapi.resizeResults(
          detections,
          displaySize
        );
        canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
        faceapi.draw.drawDetections(canvas, resizedDetections);
        faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
        faceapi.draw.drawFaceExpressions(canvas, resizedDetections);
      }, 100);
    }
  } else {
    if (registerFaceStream) {
      const tracks = registerFaceStream.getTracks();
      if (Array.isArray(tracks) && tracks.length > 0) {
        tracks.map((track) => track.stop());
      }
    }
    document.querySelectorAll(".face-canvas").forEach((el) => el.remove());
    clearInterval(interval);
  }
});

observer.observe(document.getElementById("registerFaceModal"), {
  attributes: true,
});

recognizeObserver.observe(document.getElementById("detectFaceModal"), {
  attributes: true,
});

takePictureBtn.addEventListener("click", () => {
  const videoTrack = registerFaceStream.getVideoTracks()[0];
  const imageCapture = new ImageCapture(videoTrack);
  imageCapture.takePhoto().then((blob) => {
    const picURL = window.URL.createObjectURL(blob);
    const label = document.getElementById("facelabel").value;

    if (Array.isArray(data[label])) {
      data[label].push(picURL);
    } else {
      data[label] = [picURL];
    }

    console.log("Picture Taken!", data);
  });
});

trainBtn.addEventListener("click", async (e) => {
  e.preventDefault();

  if (Object.keys(data).length === 0) {
    alert("No Images!");
  } else {
    const labeledFaceDescriptors = await loadLabeledImages();
    const faces = labeledFaceDescriptors.map((item) => item.toJSON());
    localStorage.setItem(LS_KEY, JSON.stringify(faces));
  }
});

function loadLabeledImages() {
  return Promise.all(
    Object.entries(data).map(async (item) => {
      const label = item[0];
      const descriptions = [];

      for (let i = 0; i < item[1].length; i++) {
        const img = await faceapi.fetchImage(item[1][i]);
        console.log(img);
        const detections = await faceapi
          .detectSingleFace(img)
          .withFaceLandmarks()
          .withFaceDescriptor();
        descriptions.push(detections.descriptor);
      }
      return new faceapi.LabeledFaceDescriptors(label, descriptions);
    })
  );
}
