// import * as THREE from "https://unpkg.com/three@0.144.0/build/three.module.js";
// import { OrbitControls } from "https://unpkg.com/three@0.144.0/examples/jsm/controls/OrbitControls.js";
// import { GLTFLoader } from "https://unpkg.com/three@0.144.0/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { IDB } from "../assets/shared/idb";
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

//Fullscreen
document.getElementById("fsbutton").onclick = () => {
  if(!document.fullscreenElement){
    const btn = document.getElementById("fsbutton");
    document.documentElement.requestFullscreen()
    btn.children[0].src = "../assets/img/closeFullscreen.svg"
  }
  else{
    const btn = document.getElementById("fsbutton");
    document.exitFullscreen();
    btn.children[0].src = "../assets/img/openFullscreen.svg"
  }
}

//var
let scale, mixer, animationName;
let clipDuration = 0;
let progressBar = document.getElementById("progressBarInner");

//scene
const scene = new THREE.Scene();
const themeColor = "0xF5F3F5";
scene.background =  new THREE.Color().setHex(themeColor);

//light
const ambLight = new THREE.AmbientLight( 0x404040, 2); // soft white light
scene.add( ambLight );

const dirLight = new THREE.DirectionalLight( 0xffffff, 0.7);
dirLight.position.set( 3, 10, 10 );
dirLight.lookAt(0,1,0);
//Set up shadow properties for the light
dirLight.shadow.mapSize.width = 1024;
dirLight.shadow.mapSize.height = 1024; 
dirLight.castShadow = true;
scene.add( dirLight );

//floor
const mesh = new THREE.Mesh( new THREE.PlaneGeometry( 5, 5), new THREE.ShadowMaterial({color: new THREE.Color().setHex("0x999999")}) );
mesh.rotation.x = - Math.PI / 2;
mesh.receiveShadow = true;
mesh.position.setY(-0.01);
scene.add( mesh );

const grid = new THREE.GridHelper( 5, 12, 0x888888, 0x888888);
grid.material.opacity = 0.7;
grid.receiveShadow = true;
grid.material.transparent = true;
scene.add( grid );


//camera
const camera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 1, 100);
camera.position.set(5, 4, 2.5);

//renderer
const renderer = new THREE.WebGLRenderer({canvas: document.getElementById("3dspace"), antialias: true});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth,window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.render(scene, camera);

//other
const clock = new THREE.Clock();

//controls
const controls = new OrbitControls(camera, renderer.domElement );
controls.enablePan = true;
controls.enableZoom = true;
controls.maxDistance = 15;
controls.minDistance = 1.5;
controls.target.set( 0, 1, 0 );
controls.autoRotate = false;
controls.enableDamping = true;
controls.update();

//speed slider
const slider = document.getElementById("speedRange");
slider.addEventListener("input", function() {
  if(clipDuration > 0) mixer.timeScale = Math.pow(slider.value/100,2);
});

//resize management
window.onresize = () => {
  console.log("onResize");
  renderer.setSize(window.innerWidth,window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
};

//get filepath file
fetch("../assets/shared/paths.json")
.then(function(resp) {
  return resp.json();
})
.then(function(data) {
  get3D(data);
});

if(isIOS()){
  disableButton("arbutton");
  disableButton("fsbutton");
}
else if(!isChrome()){
  disableButton("arbutton");
}
else {
  checkAR();
}
//... see get3D();

function checkAR(){
  if("xr" in window.navigator){
    window.navigator.xr.isSessionSupported("immersive-vr").then((isSupported) => {
      if(!isSupported){
        disableButton("arbutton");
      }
    });
  }
}

function disableButton(btnID){
  const btn = document.getElementById(btnID);
  btn.style.display = "none";
  btn.onclick = function () {}; 
}

//get file & load file
function get3D(json){
  const dance = new URLSearchParams(window.location.search).get("d");
  const figureNumber = new URLSearchParams(window.location.search).get("id");
  let objectPath = json.paths.mainFolder;
  let items, uid;

  switch(dance){
    case "Debug":
      items = json.figures.debug;
      objectPath += json.paths.debug;
      break;
    case "Extras":
      items = json.figures.extra;
      objectPath += json.paths.extra;
      break;
    case "Shuffle":
      items = json.figures.shuffle;
      objectPath += json.paths.shuffle;
      break;
    case "Michael Jackson":
      items = json.figures.mj;
      objectPath += json.paths.mj;
      break;
    case "HipHop":
      items = json.figures.hiphop;
      objectPath += json.paths.hiphop;
      break;
    default:
      items = null;
      throw new Error("Dance d invalid");
      return;
  }

  const figureJSON = items.find(e => e.number == figureNumber);
  objectPath += "/" + figureJSON.fileName;
  scale = figureJSON.hasOwnProperty("scale") ? figureJSON.scale : 1;
  document.getElementById("description").innerHTML  = figureJSON.description;
  if(!figureJSON.aiVerifiable) {disableButton("aibutton")}
  uid = figureJSON.fileName;
  animationName = figureJSON.animationName;

  if(!IDB.isSupported() || dance == "Extras"){ //Texture Error in MS files
    getGLB_online(objectPath, uid, false);
  }
  else{
    IDB.load(uid, json => {
      if(!json){
        getGLB_online(objectPath, uid, true);
      }
      else{
        getGLB_locally(json);
      }
    });
  }   
}

function getGLB_locally(json){
  const loader = new THREE.ObjectLoader();
  const object = loader.parse(json.data);
  scene.add(object);
  finishGLBLoading(object);
}

function getGLB_online(objectPath, uid, saveLocally){
  const loader = new GLTFLoader();
  loader.load(objectPath, object => {

    object.scene.position.set(0,0,0);
    object.scene.traverse( function ( child ) {
      if ( child.isMesh ) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    object.scene.scale.multiplyScalar(parseFloat(scale));
    object.scene.name = "3D_Object";
    object.scene.animations = Array.from(object.animations);

    scene.add( object.scene );

    object.scene.updateMatrixWorld();

    if(saveLocally){
      const data = object.scene.toJSON();
      IDB.save(uid, data);
    }
    finishGLBLoading(object.scene);
  });
}

function finishGLBLoading(object){
  if(object.animations.length >= 1){
    mixer = new THREE.AnimationMixer(object);
    let ani;
    if(!animationName) ani = object.animations[0];
    if(!!animationName) ani = object.animations.find(a => a.name == animationName);
    mixer.clipAction(ani).play();
    clipDuration = ani.duration;
  }
  // object.traverse( function ( child ) {
  //   if ( child.isSkinnedMesh ) {
  //     child.material.roughness = 0.5;
  //     child.material.metalness = 0.5;
  //   }
  // });
  console.log("Three ready");
  closeLoadingScreen();
  animate();
  //enableDebugGUI(object);
}

function closeLoadingScreen(){
  const scr = document.getElementById("loading_screen");
  const ani = document.getElementById("animation_frame");
  ani.style.animation = "fadeOut 0.5s linear forwards";
  ani.style.pointerEvents = "none";
  setTimeout(() => {
    scr.style.animation = "fadeOut 1s linear forwards";
    scr.style.pointerEvents = "none"; 
  }, 800);
}

//game loop
function animate(){
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  controls.update();

  //play animation
  if(clipDuration > 0 ){
    mixer.update(delta);
    progressBar.style.width = (mixer.time / clipDuration).toFixed(4) % 1 * 100 + "%";
  }

  renderer.render(scene, camera);
}

function enableDebugGUI(object){
  const panel = new GUI( { width: 300 } );
  const folder1 = panel.addFolder( 'Color' );
  const folder2 = panel.addFolder( 'Details' );
  const dummyMat = object.children[0].children[1].material;
  console.log(dummyMat);
  const params = {
    r: dummyMat.color.r,
    g: dummyMat.color.g,
    b: dummyMat.color.b,
    roughness: dummyMat.roughness,
    metalness: dummyMat.metalness,
  }
  folder1.add( params, "r", 0.0, 1, 0.01 ).onChange( () => dummyMat.color.r = params.r);
  folder1.add( params, "g", 0.0, 1, 0.01 ).onChange( () => dummyMat.color.g = params.g);
  folder1.add( params, "b", 0.0, 1, 0.01 ).onChange( () => dummyMat.color.b = params.b);
  folder2.add( params, "roughness", 0.0, 1, 0.01 ).onChange( () => dummyMat.roughness = params.roughness);
  folder2.add( params, "metalness", 0.0, 1, 0.01 ).onChange( () => dummyMat.metalness = params.metalness);
}

function isIOS() {
  return [
    'iPad Simulator',
    'iPhone Simulator',
    'iPod Simulator',
    'iPad',
    'iPhone',
    'iPod'
  ].includes(navigator.platform) || (navigator.userAgent.includes("Mac") && "ontouchend" in document)
}

function isChrome(){
  console.log(navigator.userAgent.toUpperCase());
  return navigator.userAgent.toUpperCase().indexOf("CHROME") != -1
}