let albums = "albums";
let detailsForm = "details";
let image = "image";
let imageListElt = "image-list";
let images = "images";
let loader = "loader";
let modal = "modal";
let modalOverlay = "modal-overlay";
let overlay = "overlay";
let viewer = "viewer";

let aspectRatio, imgWidth;
let album, imageList, imageIndex;
let mouseX, mouseY;
let scrollX, scrollY;
let windowWidth, windowHeight;
let panning = false;
let minScale = null, scale = 1;

const maxScale = 3;
const zoomIncrement = 0.04;

const init = () => {
  getElements();
  getWindowDimensions();

  // Initialize event listeners
  albums.addEventListener("input", selectAlbum);
  detailsForm.addEventListener("submit", handleSubmit);
  document.addEventListener("keydown", handleShortcuts, false);
  document.addEventListener("keyup", handleKeyUp, false);
  overlay.onmousedown = panStart;
  overlay.onmousemove = pan;
  overlay.onmouseup = panStop;
  overlay.onwheel = zoom;
  window.onresize = windowResized;
  window.addEventListener("blur", unhideOverlay);

  const lastSeen = localStorage.getItem("selected");
  if (!lastSeen || lastSeen == "null" || lastSeen == "undefined") {
    loadMedia("https://www.thesprucepets.com/thmb/Eh-n-bxfKQTopLQZ9gTiOChF-jY=/1080x810/smart/filters:no_upscale()/16_Love-5bb4c12bc9e77c00263933b3.jpg");
  } else {
    selectAlbum({ target: { value: lastSeen } });
  }
};

const addImages = () => {
  const imageLinks = images.value.split(/\s+/);
  imageList = [...new Set(imageList.concat(imageLinks))];
  saveAlbum();
  updateImageList();
  images.value = "";
};

const clamp = (val, min, max) => {
  return Math.max(min, Math.min(max, val));
};

const clearData = () => {
  if (confirm("Are you sure you want to clear all data?")) {
    localStorage.clear();
    alert("Data cleared");
    location.reload();
  }
};

const createAlbum = () => {
  const album = prompt("Please enter the name for the new album").replace(" ", "_").toLowerCase();

  if (album) {
    const albums = getAlbums();
    albums.push(album);
    setAlbums(albums);
    localStorage.setItem(`${album}.index`, 0);
    updateAlbumsDropdown(album);
    selectAlbum({ target: { value: album } });
  }
};

const createListElement = (text, button) => {
  const li = document.createElement("li");

  if (button) {
    const buttonElt = document.createElement("button");
    buttonElt.classList.add("right-margin");
    buttonElt.innerText = "x";
    buttonElt.addEventListener("click", () => deleteImage(text));
    li.appendChild(buttonElt);
  }

  const span = document.createElement("span");
  span.innerText = text;
  li.appendChild(span);

  return li;
};

const createOption = (text, value) => {
  const option = document.createElement("option");
  option.innerText = text;
  option.value = (value !== undefined) ? value : text.replace(" ", "_");
  return option;
};

const deleteAlbum = () => {
  if (!confirm(`Are you sure you want to delete '${album}'?`)) return;

  const albums = getAlbums();
  albums.splice(albums.indexOf(album), 1);
  setAlbums(albums);
  localStorage.removeItem(`${album}.images`);
  localStorage.removeItem(`${album}.index`);

  if (albums.length > 0)
    localStorage.setItem("selected", albums[0]);
  else
    localStorage.removeItem("selected");

  alert(`'${album}' deleted`);
  location.reload();
};

const deleteImage = (url) => {
  const index = imageList.indexOf(url);
  imageList.splice(index, 1);
  if (index <= imageIndex) {
    let shouldLoad = index === imageIndex;
    imageIndex = clamp(imageIndex - 1, 0, imageList.length);
    if (shouldLoad) loadMedia(imageList[imageIndex]);
  }
  saveAlbum();
  updateImageList();
};

const getAlbum = album => {
  let images = localStorage.getItem(`${album}.images`);

  if (!images)
    images = [];
  else
    images = images.split(" ");

  const index = parseInt(localStorage.getItem(`${album}.index`));

  return [index, images];
};

const getAlbums = () => {
  let albums = localStorage.getItem("albums")

  if (!albums) return [];

  return albums.split(" ");
};

const getElements = () => {
  albums = document.getElementById(albums);
  detailsForm = document.getElementById(detailsForm);
  image = document.getElementById(image);
  imageListElt = document.getElementById(imageListElt);
  images = document.getElementById(images);
  loader = document.getElementById(loader);
  modal = document.getElementById(modal);
  modalOverlay = document.getElementById(modalOverlay);
  overlay = document.getElementById(overlay);
  viewer = document.getElementById(viewer);
};

const getHeight = () =>
  Math.max(
    document.body.scrollHeight,
    document.documentElement.scrollHeight,
    document.body.offsetHeight,
    document.documentElement.offsetHeight,
    document.documentElement.clientHeight
  );

const getImageDimensions = () => {
  imgWidth = image.width;
  aspectRatio = imgWidth / image.height;
};

const getWidth = () =>
  Math.max(
    document.body.scrollWidth,
    document.documentElement.scrollWidth,
    document.body.offsetWidth,
    document.documentElement.offsetWidth,
    document.documentElement.clientWidth
  );

const getWindowDimensions = () => {
  windowHeight = getHeight();
  windowWidth = getWidth();
};

const handleKeyUp = e => {
  switch (e.key) {
    case "`":
      unhideOverlay();
      break;
  }
}

const handleShortcuts = e => {
  if (e.ctrlKey) {
    switch(e.key) {
      case "1":
        e.preventDefault()
        e.stopPropagation();
        minScale = null;
        resizeImage();
        break;
      case "c":
        e.preventDefault();
        e.stopPropagation();
        clearData();
        break;
      case "m":
        e.preventDefault();
        e.stopPropagation();
        openModal();
        break;
    }
  } else {
    switch (e.key) {
      case "d":
      case "ArrowLeft":
        nextImage()
        break;
      case "a":
      case "ArrowRight":
        prevImage()
        break;
      case "`":
        overlay.style.display = "none";
        break;
    }
  }
};

const handleSubmit = e => {
  e.preventDefault();
};

const hideModal = () => {
  modal.classList.add("hidden");
  modalOverlay.classList.add("hidden");
};

const imageLoaded = (newImage) => {
  loader.classList.add("hidden");
  image.replaceWith(newImage);
  image = newImage;
  minScale = null;
  getImageDimensions();
  resizeImage();
};

const iframeLoaded = (iframe) => {
  loader.classList.add("hidden");
  iframe.onload = undefined;
  iframe.style.visibility = "visible";
  minScale = null;
  getImageDimensions();
  resizeImage();
}

const loadMedia = src => {
  let newMedia;

  if (!src) {
    image.src = null;
    return;
  }

  switch (true) {
    // Image
    case /.*\.(jpe?g|png|gif)(\?.*)?$/i.test(src):
      newMedia = document.createElement("img");
      newMedia.onload = () => imageLoaded(newMedia);
      break;
    // Video
    case /.*y.*tu.*be.*\/watch\?v=.+$/i.test(src):
      src = src.replace(/watch\?v=/, "embed/");
    case /.*\/embed\/.*/.test(src):
      newMedia = document.createElement("iframe");
      newMedia.allow = allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
      newMedia.allowFullscreen = true;
      newMedia.style.visibility = "hidden";
      newMedia.width = 1920;
      newMedia.height = 1080;
      image.replaceWith(newMedia);
      image = newMedia;
      newMedia.onload = () => iframeLoaded(newMedia);
      break;
    // Unrecognized format
    default:
      newMedia = document.createElement("iframe");
      newMedia.allowFullscreen = true;
      newMedia.style.visibility = "hidden";
      newMedia.style.width = "100vw";
      newMedia.style.height = "100vh";
      image.replaceWith(newMedia);
      image = newMedia;
      newMedia.onload = () => iframeLoaded(newMedia);
  }

  newMedia.id = "image";
  newMedia.src = src;
  loader.classList.remove("hidden");
};

const mod = (n, m) => ((n % m) + m) % m;

const nextImage = (dir) => {
  dir ||= 1;

  if (imageIndex === null || imageIndex === undefined) return;

  imageIndex = mod(imageIndex + dir, imageList.length);
  saveAlbum();
  loadMedia(imageList[imageIndex]);
}

const openModal = () => {
  modal.classList.remove("hidden");
  modalOverlay.classList.remove("hidden");
  updateAlbumsDropdown();

  const selected = localStorage.getItem("selected");

  if (selected) albums.value = selected;
};

const panStart = e => {
  mouseX = e.clientX;
  mouseY = e.clientY;
  scrollX = viewer.scrollLeft;
  scrollY = viewer.scrollTop;
  panning = true;
};

const pan = e => {
  if (panning) {
    const dX = e.clientX - mouseX;
    const dY = e.clientY - mouseY;

    viewer.scrollLeft = scrollX - dX;
    viewer.scrollTop = scrollY - dY;
  }
};

const panStop = () => {
  panning = false;
};

const prevImage = () => nextImage(-1);

const resizeImage = () => {
  if (minScale === null) {
    image.width = windowWidth;
    image.height = image.width / aspectRatio;

    if (image.height > windowHeight) {
      image.height = windowHeight;
      image.width = image.height * aspectRatio;
    }

    minScale = image.width / imgWidth;
  }

  scale = image.width / imgWidth;
};

const saveAlbum = () => {
  localStorage.setItem(`${album}.images`, imageList.join(" "));
  localStorage.setItem(`${album}.index`, imageIndex);
};

const selectAlbum = e => {
  album = e.target.value;
  images.disabled = !album;
  [imageIndex, imageList] = getAlbum(album);

  if (album) {
    localStorage.setItem("selected", album);
    updateImageList();

    if (imageList.length > 0) {
      imageIndex ||= 0;
      loadMedia(imageList[imageIndex]);
    }
  }
};

const setAlbums = albums => {
  localStorage.setItem("albums", albums.join(" "));
};

const unhideOverlay = () => {
  setTimeout(() => {
    overlay.style.display = "block";
    overlay.focus();
  }, 1);
};

const updateAlbumsDropdown = (selected) => {
  const albums = getAlbums();
  const select = document.getElementById("albums");
  select.textContent = "";

  // Add default option
  const defaultOption = createOption("Select One", 0);
  defaultOption.selected = !selected;
  defaultOption.disabled = true;
  select.appendChild(defaultOption);

  albums.forEach(album => {
    const option = createOption(album.replace("_", " "));
    select.appendChild(option)
    option.selected = selected === album;
  });
};

const updateImageList = () => {
  imageListElt.textContent = "";

  if (imageList.length === 0) {
    imageListElt.appendChild(createListElement("No images"));
  } else {
    imageList.forEach(url => {
      imageListElt.appendChild(createListElement(url, true));
    });
  }

  loadMedia(imageList[imageIndex || 0]);
};

const windowResized = () => {
  getWindowDimensions();
  minScale = null;
  resizeImage();
};

const zoom = e => {
  const direction = clamp(e.deltaY, -1, 1) * -1;
  scale += direction * zoomIncrement;
  scale = clamp(scale, minScale, maxScale);

  const oldWidth = image.width, oldHeight = image.height;

  image.width = scale * imgWidth;
  image.height = image.width / aspectRatio;

  const deltaX = image.width - oldWidth, deltaY = image.height - oldHeight;

  mouseX = e.clientX;
  mouseY = e.clientY;

  viewer.scrollLeft += deltaX * (mouseX / windowWidth);
  viewer.scrollTop += deltaY * (mouseY / windowHeight);
};
