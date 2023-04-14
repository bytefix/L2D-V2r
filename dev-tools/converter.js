//
// Tool to copy multiple animations to a single rig
// only works if the rigs are the same!
//

import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

const loader = new GLTFLoader();
const expoeter = new GLTFExporter();
let mainObj;
let loaded = 0;
let hasToLoad = 0;

let options = {
  binary: true,
  animations: []
};

console.log("Exporting...");

fetch("../assets/shared/paths.json")
    .then(resp => resp.json())
    .then(data => convert(data));

function convert(data){
    console.log(Object.entries(data.figures));
    Object.entries(data.figures).forEach(o => {
        o[1].forEach(p => {
            hasToLoad += 1;
            let e;
            if(o[0] == "shuffle") e = data.paths.shuffle;
            if(o[0] == "mj") e = data.paths.mj;
            if(o[0] == "hiphop") e = data.paths.hiphop;
            load(data.paths.mainFolder + e + "/" + p.fileName, o[0]+p.number);
            console.log(o[0]+p.number);
        });
    });
}

function load(obj, newName) {
  loader.load(obj, (object) => {
    if(loaded === 0) mainObj = object.scene;
    loaded+=1;
    object.animations[0].name = newName;
    options.animations.push(object.animations[0]);
    console.log(loaded + "/" + hasToLoad);
    if(loaded === hasToLoad) exportObj(mainObj);
  });
}

function exportObj(obj) {
  expoeter.parse(
    obj,
    (a) => {
      console.log(a);
      download(a, 'single.glb', 'application/octet-stream');
    },
    undefined,
    options
  );
}

function download(content, fileName, contentType) {
  var a = document.createElement("a");
  var file = new Blob([content], {type: contentType});
  a.href = URL.createObjectURL(file);
  a.download = fileName;
  a.click();
}