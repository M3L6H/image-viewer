// Initialize globals for page elements pointing to their ids
// These are later replaced by the actual html elements by the getElements()
// function
let albums = "albums";
let albumTitle = "album-title";
let detailsForm = "details";
let help = "help";
let helpOverlay = "help-overlay";
let image = "image";
let imageIndexElt = "image-index";
let imageListElt = "image-list";
let images = "images";
let loader = "loader";
let modal = "modal";
let modalOverlay = "modal-overlay";
let overlay = "overlay";
let viewer = "viewer";

// Initialize other global values
let aspectRatio, imgWidth;
let album, imageList, imageIndex;
let mouseX, mouseY;
let scrollX, scrollY;
let windowWidth, windowHeight;
let panning = false;
let minScale = null, scale = 1;
let imageIndexTimeout;

// Constants
// Maximum scale we allow (3x the original size)
const MAX_SCALE = 3;
// Defines how much we zoom in per zoom step
const ZOOM_INCREMENT = 0.04;

// Called when the page first loads
const init = () => {
  getElements(); // Initialize all the HTML globals
  getWindowDimensions(); // Initialize window dimensions

  // Initialize event listeners
  albums.addEventListener("input", e => selectAlbum(e.target.value));
  detailsForm.addEventListener("submit", handleSubmit);
  document.addEventListener("keydown", handleShortcuts, false);
  document.addEventListener("keyup", handleKeyUp, false);
  overlay.addEventListener("mousedown", panStart);
  overlay.addEventListener("mousemove", pan);
  overlay.addEventListener("mouseup", panStop);
  overlay.addEventListener("wheel", zoom);
  window.addEventListener("resize", windowResized);
  window.addEventListener("blur", unhideOverlay);

  // Preload the selected album
  const lastSeen = localStorage.getItem("selected");

  // If we have not previously viewed anything, load a default image
  if (!lastSeen || lastSeen == "null" || lastSeen == "undefined")
    loadMedia("default.jpg");
  // Otherwise load the last opened album
  else
    selectAlbum(lastSeen);
};

// Add a single image to the currently selected album
const addImage = () => {
  // Check that an album is selected
  if (!album) {
    alert("Cannot quickadd when no album is selected!");
    return;
  }

  // Retrieve the url for the image to add
  const image = prompt("Enter the url for the image");

  // If we received an image, then add it to the list
  if (image) {
    // Delegate to the addImages function
    addImages([image]);

    imageIndex = imageList.indexOf(image); // Update our image index
    loadMedia(image); // Jump to the new image
  }
};

// Add a list of images to the current album
// If a list is passed, it uses that, otherwise it refers to the current text
// in the images textarea and adds the urls listed there
const addImages = (imageLinks) => {
  // If we weren't passed a list, use the links in the images textarea
  // We make sure to filter out empty strings for any blank lines that might
  // have been left in the textarea
  imageLinks ||= images.value.split(/\s+/).filter(url => url !== "");

  // We update our image list by combining it with the links we were just given
  // We use a set to remove any duplicates and then turn it into an array with
  // the spread operator
  imageList = [...new Set(imageList.concat(imageLinks))];

  // Persist the updates to local storage
  saveAlbum();

  // Update the image list in the album management modal
  updateImageList();

  // Reset the content in the textarea
  images.value = "";

  // If this is the first image we are adding to an album, load it immediately
  if (imageList.length === 1) loadMedia(imageList[0]);

  // Update the image index element to reflect the changes
  updateImageIndexElt();
};

// Simple clamp function
const clamp = (val, min, max) => {
  return Math.max(min, Math.min(max, val));
};

// Clear all saved data
const clearData = () => {
  // Make sure to get confirmation from the user
  if (confirm("Are you sure you want to clear all data?")) {
    localStorage.clear(); // Clear the data
    location.reload(); // Refresh the page to revert to initial state
  }
};

// Create a new album
const createAlbum = () => {
  // Get the name for the album from the user
  const album = prompt("Please enter the name for the new album").toLowerCase();

  // If we weren't supplied an album name or the user cancelled, do nothing
  if (!album) return;

  // Retrieve the list of existing albums
  const albums = getAlbums();

  // Check if the album we are trying to add has already been created
  if (albums.indexOf(album) === -1) {
    albums.push(album); // Add the album to the list
    setAlbums(albums); // Save the list of albums
    localStorage.setItem(`${album}.index`, 0); // Initialize the album index
    updateAlbumsDropdown(album); // Add the album to the dropdown in the modal
    selectAlbum(album); // Set the created album as the currently selected album
  } else {
    alert(`Album '${album}' already exists!`);
  }
};

// Helper function to create an image list element
const createListElement = (text, button) => {
  // Create the li first
  const li = document.createElement("li");

  // If we are asked to create the element with a button, we are creating an
  // image link...
  if (button) {
    // ...so we first create the delete button and add the appropriate classes
    const buttonElt = document.createElement("span");
    buttonElt.classList.add("icon-btn");
    buttonElt.classList.add("right-margin");
    buttonElt.classList.add("delete");

    // Making sure to add the event listener
    buttonElt.addEventListener("click", () => deleteImage(text));
    li.appendChild(buttonElt); // Add the button to the li

    // Create the image link
    const link = document.createElement("a");

    // Set its attributes
    link.innerText = text;
    link.href = text;
    link.target = "_blank";

    // Append the link to the li
    li.appendChild(link);
  // If we were not asked to create a button, we are creating a default list
  // element...
  } else {
    // ...so we just create a generic span
    const span = document.createElement("span");
    span.innerText = text;
    li.appendChild(span);
  }

  // Return the li we created
  return li;
};

// Helper function to create an option in the album dropdown
// Accepts an optional value, otherwise it uses the text as the value
const createOption = (text, value) => {
  const option = document.createElement("option"); // Create the element
  option.innerText = text; // Update its text contents
  option.value = (value !== undefined) ? value : text; // Set its value
  return option; // Return the created element
};

// Called to delete the currently selected album
const deleteAlbum = () => {
  // Check with the user to make sure it is what they want
  if (!confirm(`Are you sure you want to delete '${album}'?`)) return;

  // Get our list of albums
  const albums = getAlbums();

  // Remove the album from the list
  albums.splice(albums.indexOf(album), 1);

  // Save the updated list
  setAlbums(albums);

  // Remove the other album data
  localStorage.removeItem(`${album}.images`);
  localStorage.removeItem(`${album}.index`);

  // If we still have albums remaining, select the first album
  if (albums.length > 0)
    localStorage.setItem("selected", albums[0]);
  // Otherwise clear the selected entry
  else
    localStorage.removeItem("selected");

  // Reload the page to return to the initial state
  location.reload();
};

// Called to delete an image based on url
const deleteImage = (url) => {
  // Get the index of the image to be deleted
  const index = imageList.indexOf(url);

  // Remove the image from the list
  imageList.splice(index, 1);

  // If we are deleting an image behind the currently viewed image, we need to
  // decrease our index accordingly
  if (index <= imageIndex) {
    // If we deleted the image we were looking at, should load will be true
    let shouldLoad = index === imageIndex;

    // Decrement our image index while making sure to clamp it
    imageIndex = clamp(imageIndex - 1, 0, imageList.length);

    // Update what we are looking at if it has changed
    if (shouldLoad) loadMedia(imageList[imageIndex]);
  }

  // Persist the change in the image list and possibly currently selected index
  // to local storage
  saveAlbum();

  // Update the image list in the album management modal
  updateImageList();

  // Update the image index element to reflect the changes
  updateImageIndexElt();
};

// Load in album data
const getAlbum = album => {
  // Retrieve the images entry from local storage
  let images = getArray(`${album}.images`);

  // Retrieve the index entry from local storage
  const index = parseInt(localStorage.getItem(`${album}.index`));

  // Return both the imageIndex and images array
  return [index, images];
};

// Retrieve the list of albums from local storage
const getAlbums = () => getArray("albums");

// Helper function to retrieve an array from local storage
const getArray = (key) => {
  // Get the array from local storage
  let arr = localStorage.getItem(key);

  // If there is currently nothing in local storage, return an empty array
  if (!arr) return [];

  // Use the JSON api to parse an array from the string
  return JSON.parse(arr);
};

// Retrieve all the relevant DOM elements
// Called in the init function
const getElements = () => {
  albums = document.getElementById(albums);
  albumTitle = document.getElementById(albumTitle);
  detailsForm = document.getElementById(detailsForm);
  help = document.getElementById(help);
  helpOverlay = document.getElementById(helpOverlay);
  image = document.getElementById(image);
  imageIndexElt = document.getElementById(imageIndexElt);
  imageListElt = document.getElementById(imageListElt);
  images = document.getElementById(images);
  loader = document.getElementById(loader);
  modal = document.getElementById(modal);
  modalOverlay = document.getElementById(modalOverlay);
  overlay = document.getElementById(overlay);
  viewer = document.getElementById(viewer);
};

// Retrieve the height of the window
const getHeight = () =>
  Math.max(
    document.body.scrollHeight,
    document.documentElement.scrollHeight,
    document.body.offsetHeight,
    document.documentElement.offsetHeight,
    document.documentElement.clientHeight
  );

// Set the imgWidth and aspectRatio global variables based on the currently
// loaded image
const getImageDimensions = () => {
  imgWidth = image.width;
  aspectRatio = imgWidth / image.height;
};

// Retrieve the width of the window
const getWidth = () =>
  Math.max(
    document.body.scrollWidth,
    document.documentElement.scrollWidth,
    document.body.offsetWidth,
    document.documentElement.offsetWidth,
    document.documentElement.clientWidth
  );

// Calls both getHeight and getWidth to initialize the global windowHeight and
// windowWidth variables
const getWindowDimensions = () => {
  windowHeight = getHeight();
  windowWidth = getWidth();
};

// Handle when the ` key is released
const handleKeyUp = e => {
  switch (e.key) {
    case "`":
      unhideOverlay();
      break;
  }
}

// Handle the various available shortcuts
const handleShortcuts = e => {
  // Ignore shortcuts if the modal is currently open or if we are panning
  if (modalIsVisible() || panning) return;

  // Check if the control key is pressed
  if (e.ctrlKey) {
    switch(e.key) {
      // Reset zoom if CTRL+1 is pressed
      case "1":
        e.preventDefault()
        e.stopPropagation();
        resizeImage();
        break;
      // Clear data if CTRL+C is pressed
      case "c":
        e.preventDefault();
        e.stopPropagation();
        clearData();
        break;
      // Open the modal if CTRL+M is pressed
      case "m":
        e.preventDefault();
        e.stopPropagation();
        openModal();
        break;
    }
  // Check if the shift key is pressed
  } else if (e.shiftKey) {
    switch (e.key) {
      // Run quick add if SHIFT+A is presseed
      case "A":
        e.preventDefault();
        e.stopPropagation();
        addImage();
        break;
    }
  // If no control keys are pressed, check the other shortcuts
  } else {
    switch (e.key) {
      // Go to the next image
      case "d":
      case "ArrowLeft":
        nextImage()
        break;
      // Go to the previous image
      case "a":
      case "ArrowRight":
        prevImage()
        break;
      // Prevent interactions with the overlay if ` is held
      case "`":
        overlay.style["pointer-events"] = "none";
        break;
      // Toggle the help menu if the / key is pressed
      case "/":
        if (help.classList.contains("hidden"))
          showHelp();
        else
          hideHelp();
        break;
    }
  }
};

// Ignore the submit event
const handleSubmit = e => e.preventDefault();

// Hide the help modal
const hideHelp = () => {
  help.classList.add("hidden");
  helpOverlay.classList.add("hidden");
};

// Hide the album management modal
const hideModal = () => {
  modal.classList.add("hidden");
  modalOverlay.classList.add("hidden");
};

// Callback for when an iframe loads
const iframeLoaded = (iframe) => {
  // Remove the onload callback to prevent infinite loops
  iframe.onload = undefined;

  // Make the iframe visible
  iframe.style.visibility = "visible";

  // Image display cleanup
  updateImageDisplay();
}

// Calback for when an image loads
const imageLoaded = (newImage) => {
  // Replace the current image in the DOM with the one that just loaded
  image.replaceWith(newImage);

  // Update the global variable
  image = newImage;

  // Image display cleanup
  updateImageDisplay();
};

// Called to load an image or video or other media
const loadMedia = src => {
  let newMedia; // Initialize variable

  // If we are loading nothing
  if (!src) {
    // Show a default message
    const message = document.createElement("div");
    message.innerText = "No images";
    message.classList.add("big");
    message.classList.add("center");
    image.replaceWith(message);
    image = message;

    // Reset our image index element
    imageIndexElt.innerText = "";
    return;
  }

  // Use a javascript trick to use regex in case statements
  switch (true) {
    // Image
    case /.*\.(jpe?g|png|gif)(\?.*)?$/i.test(src):
      newMedia = document.createElement("img");
      newMedia.onload = () => imageLoaded(newMedia); // Set callback
      break;
    // Video
    case /.*y.*tu.*be.*\/watch\?v=.+$/i.test(src):
      src = src.replace(/watch\?v=/, "embed/");
    case /.*\/embed\/.*/.test(src):
      newMedia = document.createElement("iframe");
      newMedia.allow = allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
      newMedia.allowFullscreen = true;
      newMedia.style.visibility = "hidden";

      // Set default width and height for video, since we can't calculate the
      // dimensions of an iframe directly
      newMedia.width = 1920;
      newMedia.height = 1080;

      image.replaceWith(newMedia);
      image = newMedia;
      newMedia.onload = () => iframeLoaded(newMedia); // Set callback
      break;
    // Unrecognized format
    default:
      // Create a generic iframe for content we don't know how to handle
      newMedia = document.createElement("iframe");
      newMedia.allowFullscreen = true;
      newMedia.style.visibility = "hidden";
      newMedia.style.width = "100vw";
      newMedia.style.height = "100vh";
      image.replaceWith(newMedia);
      image = newMedia;
      newMedia.onload = () => iframeLoaded(newMedia);
  }

  // Make sure to set the id and src on the new element
  newMedia.id = "image";
  newMedia.src = src;

  // Show the loader
  loader.classList.remove("hidden");
};

// A proper modulo function
const mod = (n, m) => ((n % m) + m) % m;

// Returns whether the album management modal is visible
const modalIsVisible = () => !modal.classList.contains("hidden");

// Navigate to the next image in the album
// Accepts an optional argument specifying the direction to navigate in
// If not supplied, will navigate to the image with the next sequential index
const nextImage = (dir = 1) => {
  // Don't do anything if we don't have an image we are currently looking at
  if (imageIndex === null || imageIndex === undefined) return;

  // Loop around if we go past the last image
  imageIndex = mod(imageIndex + dir, imageList.length);

  // Persist the index to local storage
  saveAlbum();

  // Load the image
  loadMedia(imageList[imageIndex]);
}

// Open the album managment modal
const openModal = () => {
  modal.classList.remove("hidden");
  modalOverlay.classList.remove("hidden");

  // Initialize the albums dropdown
  updateAlbumsDropdown();

  // Retrieve the last selected album
  const selected = localStorage.getItem("selected");

  // If there is a selected value, set that in the albums dropdown
  if (selected) albums.value = selected;
};

// Called when panning starts
const panStart = e => {
  // Save the initial mouse position
  mouseX = e.clientX;
  mouseY = e.clientY;

  // Save the initial scroll position
  scrollX = viewer.scrollLeft;
  scrollY = viewer.scrollTop;

  // Flag to indicate we are panning
  panning = true;
};

// Called while actively panning
const pan = e => {
  if (panning) {
    // Calculate the delta between the current mouse pos and the previous one
    const dX = e.clientX - mouseX;
    const dY = e.clientY - mouseY;

    // Adjust the viewer's scroll position accordingly
    viewer.scrollLeft = scrollX - dX;
    viewer.scrollTop = scrollY - dY;
  }
};

// Called when panning stops
const panStop = () => {
  // Update the panning flag
  panning = false;
};

// Navigate to the previous image by delegating to the nextImage function
const prevImage = () => nextImage(-1);

// Called to resize the image to a default size
const resizeImage = () => {
  // Start by shrinking the image to the width of the window
  image.width = windowWidth;
  image.height = image.width / aspectRatio;

  // If that results in the image being taller than the window, then shrink it
  // that way
  if (image.height > windowHeight) {
    image.height = windowHeight;
    image.width = image.height * aspectRatio;
  }

  // Update the minimum scale allowed for the image
  minScale = image.width / imgWidth;

  // Initialize the image's scale
  scale = image.width / imgWidth;
};

// Store the album's details into localStorage
const saveAlbum = () => {
  localStorage.setItem(`${album}.images`, JSON.stringify(imageList));
  localStorage.setItem(`${album}.index`, imageIndex);
};

// Load an album from local storage
const selectAlbum = a => {
  // Set global variable
  album = a;

  // Update the images textarea based on whether we are loading an album
  images.disabled = !album;

  // Retrieve the album from local storage
  [imageIndex, imageList] = getAlbum(album);

  // If we were given an album to retrieve
  if (album) {
    // Update what is selected
    localStorage.setItem("selected", album);

    // Set the album title's inner text
    albumTitle.innerText = album;

    // Update the list of images in the album managment modal
    updateImageList();

    // Load the last selected image
    loadMedia(imageList[imageIndex]);
  }
};

// Save the list of albums to local storage
const setAlbums = albums => {
  localStorage.setItem("albums", JSON.stringify(albums));
};

// Show the help modal
const showHelp = () => {
  help.classList.remove("hidden");
  helpOverlay.classList.remove("hidden");
};

// Restore the overlay after it has been hidden for interaction with an iframe
const unhideOverlay = () => {
  // The timeout is necessary
  // Somehow, performing this synchronously results in the change getting
  // ignored most of the time
  setTimeout(() => {
    overlay.style["pointer-events"] = "all";
    overlay.focus();
  }, 1);
};

// Update the dropdown containing the albums
const updateAlbumsDropdown = (selected) => {
  // Retrieve the list of albums from local storage
  const albums = getAlbums();

  // Get the albums dropdown
  const select = document.getElementById("albums");

  // Clear it
  select.textContent = "";

  // Add default option
  const defaultOption = createOption("Select One", 0);
  defaultOption.selected = !selected;
  defaultOption.disabled = true;
  select.appendChild(defaultOption);

  // Iterate over the list of albums and add them to the dropdown
  albums.forEach(album => {
    const option = createOption(album);
    select.appendChild(option)
    option.selected = selected === album;
  });
};

// Clean-up function called after an image or iframe is loaded
const updateImageDisplay = () => {
  // Hide the loader
  loader.classList.add("hidden");

  // Get the dimensions of what we just loaded
  getImageDimensions();

  // Resize it to fit the window
  resizeImage();

  // Set the image index
  updateImageIndexElt();
};

// Helper function to update the image index
const updateImageIndexElt = () => {
  if (!imageList) return;
  if (imageIndexTimeout) clearTimeout(imageIndexTimeout);
  imageIndexElt.classList.remove("fade");
  imageIndexElt.innerText = `${imageIndex + 1}/${imageList.length}`;
  imageIndexTimeout = setTimeout(() => imageIndexElt.classList.add("fade"), 3000);
};

// Called to update the list of images in the album managment modal
const updateImageList = () => {
  // First clear the image list element
  imageListElt.textContent = "";

  // If there are no images, display that in the menu
  if (imageList.length === 0) {
    imageListElt.appendChild(createListElement("No images"));
  } else {
    // Otherwise map over each element in the image list and create a
    // corresponding entry
    imageList.forEach(url => {
      imageListElt.appendChild(createListElement(url, true));
    });
  }
};

// Window resize handler
const windowResized = () => {
  getWindowDimensions();
  resizeImage();
};

// Zoom function called when the mousewheel is moved
const zoom = e => {
  // Get the bounding box for the image
  const bb = image.getBoundingClientRect();

  // Get the position of the mouse relative to the image's current scale and
  // translation
  const mX = (e.clientX - bb.x) / scale, mY = (e.clientY - bb.y) / scale;

  // Determine whether we are zooming in or out
  const direction = clamp(e.deltaY, -1, 1) * -1;

  // Save our old scale
  const oldScale = scale;

  // Calculate the new scale
  scale += direction * ZOOM_INCREMENT;
  scale = clamp(scale, minScale, MAX_SCALE);

  // Calculate the change in scale
  const scaleChange = scale - oldScale;

  // Calculate the appropriate translation that needs to happen
  const dX = (mX * scaleChange), dY = (mY * scaleChange);

  // Actually scale the image
  image.width = scale * imgWidth;
  image.height = image.width / aspectRatio;

  // Adjust the viewport to maintain the point under the cursor
  viewer.scrollLeft += dX;
  viewer.scrollTop += dY;
};
