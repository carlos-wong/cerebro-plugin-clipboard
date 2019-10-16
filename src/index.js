'use strict';
const React = require('react');
const { clipboard, nativeImage } = require('electron');
const copyIcon = require('./CopyIcon.png');
const deleteIcon = require('./DeleteIcon.png');
const noItemsIcon = require('./NoItemsIcon.png');


const MAX_CLIPBOARD_ITEM_COUNT = 36;

const clipboardStorage = [];

let pauseWatching = false;
startWatchingClipboard();

Array.prototype.move = function(from,to){
  if (from === to) {
    return this;
  }
  this.splice(to,0,this.splice(from,1)[0]);
  return this;
};

const clearDisplayObj = {
  icon: deleteIcon,
  title: 'Clear Clipboard',
  onSelect: () => {
    clipboardStorage.length = 0;
    clipboard.writeText('');
    new Notification('Cleared Clipboard');
  },
  getPreview: () => (
    <div style={{ whiteSpace: 'pre-wrap' }}>
      <span>Clear currently stored Clipboard items, as well as item currently on clipboard.</span>
    </div>
  )
}

const plugin = ({term, display, actions}) => {
  const match = /clipboard\s(.*)/.exec(term);
  if (match && clipboardStorage.length) {
    pauseWatching = true;
    const [, filter] = match;
    const displayObjs = [];
    if (filter === 'clear') {
      displayObjs.push(clearDisplayObj);
    }
    displayObjs.push(...clipboardStorage.filter(({ type, value }) => {
      if (!filter) return true;
      if (type === 'image') {
        return 'image'.startsWith(filter.toLowerCase());
      }
      return value.toLowerCase().includes(filter.toLowerCase());
    }).map(({ type, value }, i) => {
      const isImage = (type === 'image');
      return isImage ?
        generateImageDisplay({ type, value, index: i + 1 }) :
        generateTextDisplay({ type, value, index: i + 1 })
    }));
    display(displayObjs);
  } else if (match) { // length == 0
    display({
      icon: noItemsIcon,
      title: 'Nothing Found in Clipboard.'
    });
  } else {
    pauseWatching = false;
  }
};

module.exports = {
  fn: plugin,
  keyword: 'clipboard',
  name: 'View your clipboard history'
}


function generateTextDisplay({ type, value, index }) {
  return {
    icon: copyIcon,
    title: `${index}. ${value}`,
    onSelect: () => {
      clipboardStorage.move(index-1,0);
      // clipboardStorage.splice(index - 1, 1);
      clipboard.writeText(value);
      // new Notification('Text copied to clipboard', {
      //   body: value
      // });
    },
    getPreview: () => (
      <div style={{ whiteSpace: 'pre-wrap' }}>
        <span>{value}</span>
      </div>
    )
  };
}

function generateImageDisplay({ type, value, index }) {
  return {
    icon: copyIcon,
    title: `${index}. Image`,
    onSelect: () => {
      clipboardStorage.move(index-1,0);
      // clipboardStorage.splice(index - 1, 1);
      clipboard.writeImage(value);
      new Notification('Image copied to clipboard');
    },
    getPreview: () => (
      <div>
        <img
          src={value.toDataURL()}
          style={{ maxWidth: '100%', maxHeight: '100%' }}
        />
      </div>
    )
  };
}


const imageDataUrlPreambleRegex = /^data:image\/.+;base64,.+/;
const imageContentTypes = ['image/gif', 'image/png', 'image/jpeg', 'image/bmp', 'image/webp'];
function startWatchingClipboard() {
  setInterval(readClipboardAndSaveNewValues, 360);
}

function readClipboardAndSaveNewValues() {
  if (pauseWatching) return;
  let clipboardImageValue;
  const clipboardTextValue = clipboard.readText();
  const clipboardAvailableFormats = clipboard.availableFormats();
  const textIsImage = imageDataUrlPreambleRegex.test(clipboardTextValue);
  let isImage = imageContentTypes.reduce((prevResult, imageContentType) => {
    return prevResult || clipboardAvailableFormats.includes(imageContentType);
  }, false);

  if (isImage) {
    clipboardImageValue = clipboard.readImage();
  } else if (textIsImage) {
    isImage = true;
    clipboardImageValue = nativeImage.createFromDataURL(clipboardTextValue);
  } else {
    // make sure there is a non-falsy value
    if (!clipboardTextValue || /^\s*$/.test(clipboardTextValue)) {
      return;
    }
  }

  const clipboardValue = {
    type: isImage ? 'image' : 'text',
    value: isImage ? clipboardImageValue : clipboardTextValue
  };

  const lastValue = clipboardStorage[0];
  if (!lastValue || !valuesAreEqual(lastValue, clipboardValue)){
    // console.log("Try to unshift clipboard value:",clipboardValue);
    clipboardStorage.unshift(clipboardValue);
    clipboardStorage.length = MAX_CLIPBOARD_ITEM_COUNT;
  }
}

function valuesAreEqual(prevValue, newValue) {
  if (prevValue.type !== newValue.type) {
    return false;
  }
  if (prevValue.type === 'image') {
    return prevValue.value.toDataURL() === newValue.value.toDataURL();
  }
  return prevValue.value === newValue.value;
}
