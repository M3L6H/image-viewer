let albums = "albums";
let detailsForm = "details";
let image = "image";
let imageListElt = "image-list";
let images = "images";
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

const maxScale = 2;
const zoomIncrement = 0.02;

const init = () => {
  getElements();
  getWindowDimensions();

  // Initialize event listeners
  albums.addEventListener("input", selectAlbum);
  document.addEventListener("keyup", handleShortcuts, false);
  detailsForm.addEventListener("submit", handleSubmit);
  image.onload = imageLoaded;
  window.onresize = windowResized;
  overlay.onmousedown = panStart;
  overlay.onmousemove = pan;
  overlay.onmouseup = panStop;
  overlay.onwheel = zoom;
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
  }
};

const createAlbum = () => {
  const album = prompt("Please enter the name for the new album").replace(" ", "_").toLowerCase();

  if (album) {
    const albums = getAlbums();
    albums.push(album);
    setAlbums(albums);
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

const deleteImage = (url) => {
  const index = imageList.indexOf(url);
  if (index < imageIndex) imageIndex--;
  imageList.splice(index, 1);
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

const handleShortcuts = e => {
  if (e.ctrlKey) {
    switch(e.key) {
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
  }
};

const handleSubmit = e => {
  e.preventDefault();
};

const hideModal = () => {
  modal.classList.add("hidden");
  modalOverlay.classList.add("hidden");
};

const imageLoaded = () => {
  getImageDimensions();
  resizeImage();
};

const loadImage = src => {
  minScale = null;
  image.src = src;
};

const openModal = () => {
  modal.classList.remove("hidden");
  modalOverlay.classList.remove("hidden");
  updateAlbumsDropdown();

  const selected = localStorage.getItem("selected");

  if (selected) {
    albums.value = selected;
    selectAlbum({ target: { value: selected } });
  }
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
      loadImage(imageList[imageIndex]);
    }
  }
};

const setAlbums = albums => {
  localStorage.setItem("albums", albums.join(" "));
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
};

const windowResized = () => {
  getWindowDimensions();
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
