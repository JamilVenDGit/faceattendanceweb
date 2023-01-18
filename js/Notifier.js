var Events = {
  NOTIFICATION: "notification",
  DATA: "data",
  FACE_FOUND: "face_found",
  ERROR: "error",
  TRAINING_START: "training_start",
  TRAINING_FINISH: "training_finish",
  TAKE_PHOTO: "take_photo",
  DONE_PRESS: "done_press",
};

var Emitter = {
  emit: function (type, payload = {}) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(
        JSON.stringify({ type, ...payload })
      );
    } else {
      alert("Event: " + type + " Data: " + JSON.stringify(payload));
    }
  },
};
