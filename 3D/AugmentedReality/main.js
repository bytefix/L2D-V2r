// import * as THREE from "https://unpkg.com/three@0.144.0/build/three.module.js";
// import { GLTFLoader } from "https://unpkg.com/three@0.144.0/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import { Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { IDB } from "../../assets/shared/idb";

let camera, scene, renderer;
let controller, clock;
let arrow, figure, scale, currentScale, animationName;
let hitTestSource = null;
let hitTestSourceRequested = false;
let mixerDance, mixerArrow; //animation Mixer
let previousTouchPositions = [];
let clipDurationDance = 0;

const STATE = {
  now: 0,
  loading: 0,
  loadedOne: 1,
  loadedBoth: 2,
  waitForStart: 3,
  presentingArrow: 4,
  presentingFigure: 5,
  set: function(s) {this.now = s},
  nextState: function() {this.now += 1},
  previousState: function() {this.now -= 1}
}

//error handling
addEventListener("error", (event) => {
  document.getElementById("loading_screen").insertAdjacentHTML("afterbegin", `<p id='errorline'>Ein Fehler ist aufgetreten. Bitte Seite neu laden.</p>`);
});

//speed slider
const slider = document.getElementById("speedRange");
slider.addEventListener("input", function() {
  if(clipDurationDance > 0) mixerDance.timeScale = Math.pow(slider.value/100,2);
});

checkAR();

function checkAR(){
  if("xr" in window.navigator){
    window.navigator.xr.isSessionSupported("immersive-vr").then((isSupported) => {
      if(isSupported){    
        init();
        animate();
      }
    });
  }
}

function init(){
    //scene
    scene = new THREE.Scene();
  
    //clock
    clock = new THREE.Clock();
  
    //light
    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
    light.position.set(0.5, 1, 0.25);
    scene.add(light);
  
    const dirLight = new THREE.DirectionalLight( 0xffffff, 0.7);
    dirLight.position.set( 3, 10, 10 );
    dirLight.lookAt(0,1,0);
    dirLight.castShadow = true;controller
    scene.add( dirLight );
  
    //camera
    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);
    camera.position.set(5, 4, 2.5);
  
    //renderer
    renderer = new THREE.WebGLRenderer({antialias: true, alpha: true});
    renderer.xr.enabled = true;
  
    //AR & controller
    controller = renderer.xr.getController(0);
    controller.addEventListener( 'select', onPlace);
    scene.add(controller);

    //getting 3D files
    fetch("../../assets/shared/paths.json")
    .then(function(resp) {
      return resp.json();
    })
    .then(function(data) {
      load3DFiles(data);
    });
}

function load3DFiles(json){
    const dance = new URLSearchParams(window.location.search).get("d");
    const figureNumber = new URLSearchParams(window.location.search).get("id");
    let figurePath = json.paths.mainFolderED;
    let items, uid, uid_arrow;

    switch(dance){
        case "Debug":
        items = json.figures.debug;
        figurePath += json.paths.debug;
        break;
        case "Extras":
        items = json.figures.extra;
        figurePath += json.paths.extra;
        break;
        case "Shuffle":
        items = json.figures.shuffle;
        figurePath += json.paths.shuffle;
        break;
        case "Michael Jackson":
        items = json.figures.mj;
        figurePath += json.paths.mj;
        break;
        case "HipHop":
        items = json.figures.hiphop;
        figurePath += json.paths.hiphop;
        break;
        default:
        items = null;
        throw new Error("No dance selected.");
        return;
    }

    //figure
    const figureJSON = items.find(e => e.number == figureNumber);
    figurePath += "/" + figureJSON.fileName;
    scale = figureJSON.hasOwnProperty("scale") ? figureJSON.scale : 1;
    currentScale = scale;
    animationName = figureJSON.animationName;
    uid = figureJSON.fileName;
    //arrow
    const arrowPath = json.paths.mainFolderED += json.paths.ar + "/" + json.figures.ar[0].fileName;
    uid_arrow = json.figures.ar[0].fileName;

    if(!IDB.isSupported() || dance == "Extras"){
        fromOnline("arrow", arrowPath);
        fromOnline("figure", figurePath);
    }
    else{
        //figure
        IDB.load(uid, json => {
        if(!json){
            fromOnline("figure", figurePath, uid);
        }
        else{
            fromBrowser("figure", json);
        }
        });
        //arrow
        IDB.load(uid_arrow, json => {
            if(!json){
                fromOnline("arrow", arrowPath, uid_arrow);
            }
            else{
                fromBrowser("arrow", json);
            }
        });
    }   
}

function fromBrowser(type, json){
    const loader = new THREE.ObjectLoader();
    const object = loader.parse(json.data);
    applyObject(object, type);
}

function fromOnline(type, path, uid = undefined){
    const loader = new GLTFLoader();
    loader.load(path, object => {
        //arrow
        if(type === "arrow"){
            object.scene.animations = Array.from(object.animations);
            const geometry = new THREE.RingGeometry( 2.5, 3, 32 );
            const material = new THREE.MeshBasicMaterial( { color: 0xcccccc, side: THREE.DoubleSide } );
            const mesh = new THREE.Mesh( geometry, material );
            mesh.rotation.x = - Math.PI / 2;
            object.scene.add(mesh);
            console.log(object);
            applyObject(object.scene, type);
            object.scene.scale.multiplyScalar(0.1);
        }
        
        //figure
        if(type === "figure") {
            object.scene.children[0].scale.multiplyScalar(parseFloat(scale));
            // object.scene.children[0].position.set(0,0,0);
            object.scene.children[0].animations = Array.from(object.animations);
            applyObject(object.scene.children[0], type);
        }
    
        object.scene.updateMatrixWorld();
        if(!!uid){
          const data = object.scene.toJSON();
          IDB.save(uid, data);
        }    
    });
}

function applyObject(object, type){
    scene.add(object);
    object.visible = false;
    //arrow
    if(type == "arrow"){
        mixerArrow = new THREE.AnimationMixer(object);
        mixerArrow.clipAction(object.animations[0]).play();
        arrow = object;
    }
    //figure
    if(type == "figure"){
        object.name = "3D_Object";
        figure = object;
        if(object.animations.length >= 1){
            mixerDance = new THREE.AnimationMixer(object);
            let ani;
            ani = !animationName ? object.animations[0] : object.animations.find(a => a.name == animationName);
            mixerDance.clipAction(object.animations[0]).play();
            clipDurationDance = ani.duration;
        }
    }
    console.log("Three ready: " + type);
    STATE.nextState();
}

function animate() {
    renderer.setAnimationLoop(render);
}

function render(timestamp, frame ) {
    const delta = clock.getDelta();
    
    //Loading finished
    if (STATE.now === STATE.loadedBoth){
        finishLoading();
        console.log("ready");
        //enable start Button
        document.getElementById("start").onclick = function () {
            startSession(renderer, { 
            requiredFeatures: ["hit-test"], 
            optionalFeatures: ["dom-overlay"], 
                domOverlay: {root: document.getElementById("overlay")}
            });
        }
        STATE.nextState();
    }
  
    //Entered AR
    if(renderer.xr.isPresenting){ //when in AR

        //showing arrow
        if(STATE.now === STATE.presentingArrow){

            if(frame){

            const referenceSpace = renderer.xr.getReferenceSpace();
            const session = renderer.xr.getSession();
    
            if (hitTestSourceRequested === false) {
                session.requestReferenceSpace('viewer').then(function (referenceSpace) {
                    session.requestHitTestSource({ space: referenceSpace }).then(function (source) {
                        hitTestSource = source;
                    });
                });
                session.addEventListener('end', function () {
                    hitTestSourceRequested = false;
                    hitTestSource = null;
                });
                hitTestSourceRequested = true;
            }

            if (hitTestSource) {
                const hitTestResults = frame.getHitTestResults(hitTestSource);
                if (hitTestResults.length) { //if hit
                    arrow.visible = true;

                    let hit = hitTestResults[0];
                    let hitMatrix = new THREE.Matrix4();
                    hitMatrix.fromArray(hit.getPose(referenceSpace).transform.matrix);
                    arrow.position.setFromMatrixPosition(hitMatrix);
                    
                    document.getElementById("instructionAnimation").style.display = "none";                                 
        
                    // rotation
                    let m = new THREE.Matrix4();
                    let eu = new THREE.Euler(0,0,0);
                    eu.y = -camera.rotation.y;
                    m.makeRotationFromEuler(eu);
                    arrow.matrix.multiply(m);
        
                    //animation:
                    mixerArrow.update(delta);
                } 
                else {
                    arrow.visible = false;
                }
            }
            }
        }
        else if(STATE.now === STATE.presentingFigure){
            if(clipDurationDance >= 1) {
                mixerDance.update(delta);
            }
            // if(!figure.visible){
            //   stage = 3;
            // }
        }
    }
    //render
    renderer.render(scene, camera);
}

//place modell
function onPlace(){
    
    if(STATE.now != STATE.presentingArrow || !arrow.visible){
        return
    }
    else{
        STATE.set(STATE.presentingFigure);
        figure.position.copy(arrow.position);
        arrow.visible = false;
        figure.visible = true;
        console.log("onPlace", figure);
        document.getElementById("speedSlider").style.display = "block";   
    }
}

function startSession( renderer, sessionInit = {} ){
    let currentSession = null;

    navigator.xr.requestSession( 'immersive-ar', sessionInit ).then( session => {onSessionStarted(session)} );
    
    //on AR Start
    async function onSessionStarted( session ) {
        session.addEventListener( 'end', onSessionEnded );
        renderer.xr.setReferenceSpaceType( 'local' );
        await renderer.xr.setSession( session );
        currentSession = session;
        document.getElementById("instructionAnimation").style.display = "block";
        STATE.set(STATE.presentingArrow);
        console.log("AR: Start");
    }

    //on AR End
    function onSessionEnded() {
        currentSession.removeEventListener( 'end', onSessionEnded );
        currentSession = null;
        arrow.visible = false;
        figure.visible = false;
        document.getElementById("instructionAnimation").style.display = "none";
        document.getElementById("speedSlider").style.display = "none";   
        STATE.set(STATE.waitForStart);
        console.log("AR: End");

    }
}

function finishLoading(){
    const scr = document.getElementById("loading_screen");
    const ani = document.getElementById("animation_frame");
    ani.style.animation = "fadeOut 0.5s linear forwards";
    ani.style.pointerEvents = "none";
    setTimeout(() => {
      scr.style.animation = "fadeOut 1s linear forwards";
      scr.style.pointerEvents = "none"; 
    }, 800);
  }

//touch handler
document.getElementById("body").addEventListener('touchstart', function(e) {
    for(let i = 0; i < e.touches.length && i < 2; i++){
      previousTouchPositions[i] = [e.touches[i].screenX, e.touches[i].screenY];
    }
  });
  document.getElementById("body").addEventListener('touchmove', function(e) {
    handleTouches(e.touches);
  });
  
  function handleTouches(touches){
    const count = touches.length;
    //rotate
    if(count === 1 && STATE.now === STATE.presentingFigure && touches[0].screenY < window.screen.height*0.8){
      if(touches[0].screenX > previousTouchPositions[0][0]){
        figure.rotateY(0.035);
      }
      else if(touches[0].screenX < previousTouchPositions[0][0]){
        figure.rotateY(-0.035);
      }
      previousTouchPositions[0] = [touches[0].screenX, touches[0].screenY];
    }
    //scale
    else if(count >= 2 && STATE.now === STATE.presentingFigure){
      const oldDistance = determineDistance(previousTouchPositions);
      const newDistance = determineDistance(
        [[touches[0].screenX, touches[0].screenY],
        [touches[1].screenX, touches[1].screenY]]);
      if(newDistance > oldDistance ){ //scale up
        figure.scale.multiplyScalar((figure.scale.x < 5 * scale) ? 1.01 : 1);
      }
      else if(newDistance < oldDistance){ //scale down
        figure.scale.multiplyScalar((figure.scale.x > 0.001 * scale) ? 0.99 : 1);
      }
      for(let i = 0; i < touches.length && i < 2; i++){ //copy array
        previousTouchPositions[i] = [touches[i].screenX, touches[i].screenY];
      }
    }
  }
  
  function determineDistance(touches){
    const diff_x = touches[1][0] - touches[0][0];
    const diff_y = touches[1][1] - touches[0][1];
    const dist = Math.sqrt(Math.pow(diff_x, 2) + Math.pow(diff_y, 2));
    return dist;
  }
