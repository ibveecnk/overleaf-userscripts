// ==UserScript==
// @name         Overleaf - Paste Images from Clipboard
// @version      0.7
// @description  Paste images from your clipboard directly into Overleaf (Community Edition, Cloud and Pro)
// @author       Iven Beck
// @license      GPL-3
// @match        https://www.overleaf.com/project/*
// @match        https://latex.ivbeck.de/project/*
// @require      https://cdnjs.cloudflare.com/ajax/libs/crypto-js/3.1.9-1/crypto-js.js
// @grant        none
// ==/UserScript==

// Based on https://github.com/BLumbye/overleaf-userscripts

/* global csrfToken, _ide, CryptoJS*/

"use strict";

const assetsFolder = "assets";

// Parse images from the clipboard
function retrieveImageFromClipboardAsBlob(pasteEvent, callback) {
  if (pasteEvent.clipboardData === false) return;
  const items = pasteEvent.clipboardData.items;
  if (items === undefined) return;

  for (let i = 0; i < items.length; i++) {
    // Skip content if not image
    if (items[i].type.indexOf("image") == -1) continue;
    // Retrieve image on clipboard as blob
    const blob = items[i].getAsFile();
    callback(blob);
  }
}

// Upload the image blob
async function uploadImage(imageBlob, hash) {
  try {
    const headers = new Headers();
    headers.append("x-csrf-token", csrfToken);

    const name = `${hash}.png`;
    const formData = new FormData();
    formData.append("relativePath", null);
    formData.append("name", name);
    formData.append("type", "image/png");
    formData.append("qqfile", imageBlob, name);

    const result = await fetch(
      `${document.location.pathname}/upload?` +
        new URLSearchParams({
          folder_id: _ide.fileTreeManager.findEntityByPath(assetsFolder).id,
        }),
      {
        method: "POST",
        body: formData,
        headers,
      }
    );
    const json = await result.json();
    // navigator.clipboard.writeText("\\image{" + hash + "}");
    console.log("Pasted image asset uploaded, entity id:", json.entity_id);
  } catch (e) {
    console.log(e);
  }
}

async function checkAndCreateAssetsFolder() {
  if (_ide.fileTreeManager.findEntityByPath(assetsFolder)) return;

  console.log("Creating missing assets folder...");
  try {
    await _ide.fileTreeManager.createFolder(assetsFolder, "/");
  } catch (e) {
    console.log(e);
  }
}

function makeAssetStr(hash) {
  return `\\begin{figure}[ht]
    \\centering
    \\includegraphics[width=0.6\\linewidth]{assets/${hash}.png}
    \\caption{}
    \\label{fig:${hash}}
\\end{figure}
`;
}

/* UPLOAD AND INSERT ASSET INTO EDITOR AT CURSOR POSITION ON PASTE */
document.querySelector("#editor").addEventListener("paste", (e) => {
  retrieveImageFromClipboardAsBlob(e, async (blob) => {
    await checkAndCreateAssetsFolder();
    const reader = new FileReader();
    reader.readAsBinaryString(blob);
    reader.onloadend = () => {
      const hash = CryptoJS.SHA256(reader.result).toString().substring(0, 8);
      console.log("Uploading image...");
      uploadImage(blob, hash);

      const sel = _ide.$scope.editor.sharejs_doc.ace.selection;
      const newRow = sel.cursor.row + 7;
      const content = [...sel.doc.$lines];
      content.splice(sel.cursor.row, 0, makeAssetStr(hash));
      console.log(newRow);
      console.log({ content });
      _ide.$scope.editor.sharejs_doc.ace.setValue(content.join("\n"));
      setInterval(() => {}, 100);
      _ide.$scope.editor.sharejs_doc.ace.gotoLine(newRow, 0);
    };
  });
});
