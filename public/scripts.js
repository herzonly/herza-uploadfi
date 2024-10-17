// Select elements
const selectButton = document.getElementById('selectButton');
const fileInput = document.getElementById('fileInput');
const uploadButton = document.getElementById('uploadButton');
const toast = document.getElementById('toast');
const fileNameSpan = document.getElementById('fileName');
const unselectButton = document.getElementById('unselectButton');
const mediaPreview = document.getElementById('mediaPreview');
const toastMedia = document.getElementById('toastMedia');
const formContainer = document.getElementById('formContainer');
const successPopup = document.getElementById('successPopup');
const closePopup = document.getElementById('closePopup');
const fileLink = document.getElementById('fileLink');
const copyUrlButton = document.getElementById('copyUrlButton');

let selectedFile = null;
let previewVideoElement = null;

const titles = ["Uploading File", "File Uploader", "Processing...", "Ready to Upload", "File Ready!", "Let's Upload!"];
let index = 0;

function changeTitle() {
  document.title = titles[index];
  index = (index + 1) % titles.length;
}

// Change the title every 2 seconds
setInterval(changeTitle, 2000);


// Event listeners
selectButton.addEventListener('click', () => {
  fileInput.click();
});

fileInput.addEventListener('change', () => {
  if (fileInput.files.length > 0) {
    selectedFile = fileInput.files[0];
    fileNameSpan.textContent = selectedFile.name;

    formContainer.classList.add('fade-out');
    setTimeout(() => {
      handleMediaDisplay(selectedFile);
      formContainer.classList.remove('fade-out');
      formContainer.classList.add('fade-in');
    }, 500);

    showToast();
  }
});

uploadButton.addEventListener('click', async () => {
  try {
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    const response = await fetch('/upload', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (data.message === 'File is too large. Max size is 10MB.') {
      // Show error popup for file too large
      showErrorPopup('File is too large. Maximum allowed size is 10MB.');
    } else {
      const fileUrl = data.url;
      const fileType = selectedFile.type;
      const reader = new FileReader();

      reader.onload = function(event) {
        const previewSrc = event.target.result;
        showSuccessPopup(fileUrl, fileType, previewSrc);
      };
      reader.readAsDataURL(selectedFile);

      hideToast();
    }
  } catch (error) {
    console.error('Error:', error);
    showErrorPopup('File is bigger than 10MB');
  }
});

// Function to show error popup
function showErrorPopup(errorMessage) {
  const errorPopup = document.getElementById('errorPopup');
  const errorText = document.getElementById('errorText');
  errorText.textContent = errorMessage;
  errorPopup.classList.add('show');
}

// Add event listener to close the error popup
const closeErrorPopup = document.getElementById('closeErrorPopup');
closeErrorPopup.addEventListener('click', () => {
  const errorPopup = document.getElementById('errorPopup');
  errorPopup.classList.remove('show');
});


unselectButton.addEventListener('click', () => {
  selectedFile = null;
  fileInput.value = '';
  mediaPreview.innerHTML = '';
  toastMedia.innerHTML = '';
  if (previewVideoElement) {
    previewVideoElement.pause();
  }

  formContainer.classList.add('fade-out');
  setTimeout(() => {
    mediaPreview.innerHTML = '';
    formContainer.classList.remove('fade-out');
    formContainer.classList.add('fade-in');
  }, 500);

  hideToast();
});

// Functions
function handleMediaDisplay(file) {
  const fileType = file.type;
  mediaPreview.innerHTML = '';
  toastMedia.innerHTML = '';

  const reader = new FileReader();
  reader.onload = function(event) {
    if (fileType.startsWith('image/')) {
      const imgElement = createImageElement(event.target.result);
      mediaPreview.appendChild(imgElement);
      toastMedia.appendChild(createImageElement(event.target.result, 40, 40));
    } else if (fileType.startsWith('video/')) {
      const videoElement = createVideoElement(event.target.result, true);
      mediaPreview.appendChild(videoElement);
      toastMedia.appendChild(createVideoElement(event.target.result, false, 40, 40, true));
    } else if (fileType.startsWith('audio/')) {
      const audioIcon = createAudioIcon();
      mediaPreview.appendChild(audioIcon);
      toastMedia.appendChild(audioIcon.cloneNode(true));
    }
  };
  reader.readAsDataURL(file);
}

function createImageElement(src, width = null, height = null) {
  const img = document.createElement('img');
  img.src = src;
  if (width && height) {
    img.style.width = `${width}px`;
    img.style.height = `${height}px`;
  }
  img.addEventListener('click', () => {
    img.classList.toggle('fullscreen');
  });
  return img;
}

function createVideoElement(src, withAudio = false, width = null, height = null, autoplay = false) {
  const video = document.createElement('video');
  video.src = src;
  video.muted = !withAudio;
  video.controls = withAudio;
  video.autoplay = autoplay;
  if (width && height) {
    video.style.width = `${width}px`;
    video.style.height = `${height}px`;
  }
  if (withAudio) {
    previewVideoElement = video;
  }
  return video;
}

function createAudioIcon() {
  const audioIcon = document.createElement('div');
  audioIcon.innerHTML = '&#127925;';
  audioIcon.classList.add('audio-icon');
  return audioIcon;
}

function showToast() {
  toast.classList.add('show');
}

function hideToast() {
  toast.classList.remove('show');
}

// Function to show success popup
function showSuccessPopup(fileUrl, fileType, previewSrc) {
  fileLink.href = fileUrl;
  fileLink.textContent = fileUrl;
  successPopup.classList.add('show');

  const previewContainer = document.getElementById('popupMediaPreview');
  previewContainer.innerHTML = '';

  if (fileType.startsWith('image/')) {
    const imgElement = createImageElement(previewSrc, 200, 200);
    previewContainer.appendChild(imgElement);
  } else if (fileType.startsWith('video/')) {
    const videoElement = createVideoElement(previewSrc, true, 200, 200, false);
    previewContainer.appendChild(videoElement);
  } else if (fileType.startsWith('audio/')) {
    const audioIcon = createAudioIcon();
    previewContainer.appendChild(audioIcon);
  }
}

copyUrlButton.addEventListener('click', () => {
  const fileUrl = fileLink.href;
  navigator.clipboard.writeText(fileUrl)
    .catch(err => {
      console.error('Failed to copy URL: ', err);
    });
});

closePopup.addEventListener('click', () => {
  successPopup.classList.remove('show');
});
