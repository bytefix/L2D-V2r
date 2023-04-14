import { View3D } from './view3D';
import {Pose, STATE, TO} from "./classes";
import { ViewAI } from "./viewAI";
import { Drawer, Scoreboard, Diagramm } from './feedback';
import { Vector2, Vector3 } from 'three';

//error handling
addEventListener("error", (event) => {
  displayError();
});

let delta,
  previousFrame = Date.now(),
  ready = false,
  state = STATE.loading,
  view3D = undefined,
  viewAI = undefined;

let calibration = { 
  average: new Pose(),
  totalCount: 0,
  failedCount: 0,
  deltaSinceFirst: 0,
  maxFailrate: 0.15,
  reset: function() {this.totalCount=0;this.failedCount=0;this.deltaSinceFirst=0;this.average=new Pose()},
  addEntry: function(pose, delta, failed) {
    this.totalCount++;
    this.failedCount+=failed?1:0;
    this.deltaSinceFirst+=delta;
    this.average.makeSelfAverage(pose, this.totalCount);
  },
  getFailrate: function() {return this.failedCount/this.totalCount;}
}

let performance = {
  scorePose: null,
  toleranceRadiusFull: 0.1,
  toleranceRadiusZero: 0.5,
  startTime: null,
  transform: {
    map: null,
    center: null,
    scale: null,
    scaleStep: 0.001
  },
  userTpose: new Pose(),
  initialize: function(pose_3d) {this.startTime = Date.now(); this.transform.scale = 1; this.scorePose = new Pose(); this.userTpose = calibration.average.clone(); this.transform.map = createTransformMap(pose_3d, calibration.average); this.transform.center = this.transform.map.getCenterCoordinate()},
}

//Fullscreen
document.getElementById("fsbutton").onclick = () => {
  if(!document.fullscreenElement){
    const btn = document.getElementById("fsbutton");
    document.documentElement.requestFullscreen()
    btn.children[0].src = "../../assets/img/closeFullscreen_colored.svg"
  }
  else{
    const btn = document.getElementById("fsbutton");
    document.exitFullscreen();
    btn.children[0].src = "../../assets/img/openFullscreen_colored.svg"
  }
}
if(isIOS()){
  document.getElementById("fsbutton").style.display = "none";
}

document.onkeyup = event => event.preventDefault();

window.addEventListener("THREE_ready", setReady);
window.addEventListener("TF_ready", setReady);

viewAI = new ViewAI(document.getElementById("videoInput"));
await viewAI.getPermission(() => {displayError("Bitte Kamera aktivieren und Seite neu laden.")}); //waits until camera permission is granted  -> CALLBACK on fail
await viewAI.initialize("lightning");

view3D = new View3D(document.getElementById("canvas_3D"));
view3D.initialize();

const drawer = new Drawer(
  document.getElementById("canvas_pose"),
  document.getElementById("videoInput"),
  viewAI.params.minJointScore
);

const scoreboard = new Scoreboard(
  document.getElementById("score"),
  document.getElementById("totalScore"),
  document.getElementById("time")
);

document.getElementById('left').onclick = () => view3D.fadeCamera(TO.left);
document.getElementById('front').onclick = () => view3D.fadeCamera(TO.front);
document.getElementById('right').onclick = () => view3D.fadeCamera(TO.right);

document.getElementById("stopBtn").onclick = () => stopPerforming();
document.getElementById("eo_btn").onclick = () => closeEndScreen();

document.getElementById("preview").onclick = () => togglePreview();
document.getElementById("helpBtn").onclick = () => {document.getElementById("helpOverlay").style.visibility = "visible"};
document.getElementById("backFromHelp").onclick = () => {document.getElementById("helpOverlay").style.visibility = "hidden"};

const sliderDifficulty = document.getElementById("slider_dif");
sliderDifficulty.onchange = () => {setDifficulty(sliderDifficulty.value/8);}

const sliderAiType = document.getElementById("slider_ai");
sliderAiType.onchange = () => {setAiType(sliderAiType.value);}

setDifficulty(4/8);

// ----- FUNCTIONS -----
function displayError(message = "Ein Fehler ist aufgetreten. Bitte Seite neu laden."){
  document.getElementById("loading_screen").insertAdjacentHTML("afterbegin", `<p id='errorline'>${message}</p>`);
}

async function setAiType(num){
  enterLoading();
  if(num == 0){
    await viewAI.initialize("lightning");
  }
  else if (num == 1){
    await viewAI.initialize("thunder");
  }
}

function setReady(){
  if(!view3D || !viewAI) return
  if(view3D.ready && viewAI.ready){
    ready = true;
    finishLoading();
    gameLoop();
    console.log("Application ready");
  }
}

function gameLoop() {

  //getting delta
  delta = Date.now() - previousFrame;
  previousFrame = Date.now();

  //View3D
  view3D.update(delta);
  const pose3d = view3D.getPose("auto");

  //ViewAI
  viewAI.update(delta);
  const poseAi = viewAI.getPose();

  //console.log(state);
  if(state == STATE.waitForStart || state == STATE.inCalibration.one || state == STATE.inCalibration.two || state == STATE.inCalibration.three || state == STATE.inCalibration.finished){
    const valid = viewAI.checkStartCondition(poseAi);
    calibration.addEntry(poseAi,delta,!valid);
    if(calibration.getFailrate() <= calibration.maxFailrate){
      if(state == STATE.waitForStart && calibration.deltaSinceFirst >= 500){
        bg_animation(false);
        document.getElementById("startOverlay_kal").style.visibility = "visible";
        document.getElementById("backFromHelp").onclick();
        state = STATE.inCalibration.one;
      }
      else if(state == STATE.inCalibration.one && calibration.deltaSinceFirst >= 1000){
        num_animation(3);
        state = STATE.inCalibration.two;
      }
      else if(state == STATE.inCalibration.two && calibration.deltaSinceFirst >= 2000){
        num_animation(2);
        state = STATE.inCalibration.three;
      }
      else if(state == STATE.inCalibration.three && calibration.deltaSinceFirst >= 3000){
        num_animation(1);
        state = STATE.inCalibration.finished;
      }
      else if(state == STATE.inCalibration.finished && calibration.deltaSinceFirst >= 4000){
        startPerformance();
      }
      //console.log(calibration.average.joints[0].position.x);
    }
    else{
      if(state != STATE.waitForStart) {
        bg_animation(true); 
        document.getElementById("startOverlay_kal").style.visibility = "hidden";
      }
      calibration.reset();
      state = STATE.waitForStart;
    }
  }

  if(state == STATE.performing){
    const userPoseIn3d = getUserPoseIn3dWorld(poseAi);
    view3D.previewPose(userPoseIn3d, performance.scorePose);
    syncPosePositions(pose3d, userPoseIn3d);
    autoAdjustScale(pose3d, userPoseIn3d);
    performance.scorePose = compare(pose3d, userPoseIn3d);
    drawer.drawAll(poseAi, performance.scorePose);
    //view3D.previewPose(userPoseIn3d, performance.scorePose);
    scoreboard.update(performance.scorePose, performance.startTime, delta);
  }

  //Feedback System
  if(state != STATE.performing){ drawer.drawAll(poseAi); } 

  requestAnimationFrame(gameLoop);
}

window.onresize = () => {
  view3D.handleResize();
  scoreboard.handleResize();
  drawer.updateVideoSize();
};

function finishLoading(){
  const scr = document.getElementById("loading_screen");
  const ani = document.getElementById("animation_frame");
  reset_animation(ani);
  ani.style.animation = "fadeOut 0.5s linear forwards";
  ani.style.pointerEvents = "none";
  setTimeout(() => {
    reset_animation(scr);
    scr.style.animation = "fadeOut 1s linear forwards";
    scr.style.pointerEvents = "none"; 
    state = STATE.waitForStart; 
  }, 800);
}

function enterLoading(){
  state = STATE.loading;
  const scr = document.getElementById("loading_screen");
  const ani = document.getElementById("animation_frame");
  reset_animation(scr);
  reset_animation(ani);
  scr.style.animation = "fadeOut 0.5s linear forwards reverse";
  scr.style.pointerEvents = "all";
  setTimeout(() => { 
    ani.style.animation = "fadeOut 0.3s linear forwards reverse";
    ani.style.pointerEvents = "all";
  }, 500);
}

function reset_animation(el) {
  el.style.animation = 'none';
  el.offsetHeight; /* trigger reflow */
  el.style.animation = null; 
}

function bg_animation(reverse, t = 0.5){
  const bg = document.getElementById("startOverlay");
  const kal = document.getElementById("startOverlay_kal");
  reset_animation(bg);
  reset_animation(kal);
  bg.style.animation = reverse ? `fadeOpacityBG ${t}s linear forwards reverse` : `fadeOpacityBG ${t}s linear forwards normal`;
  kal.style.animation = reverse ? `fadeOpacityTxt ${t}s linear forwards normal` : `fadeOpacityTxt ${t}s linear forwards reverse`;
}

function num_animation(number){
  const num = document.getElementById("startOverlay_num");
  reset_animation(num);
  num.innerHTML = number.toString();
  num.style.animation = "fadeOpacityTxt 1s linear forwards";
}

function fadeEndScreen(reverse){
  const eoe = Array.from(document.getElementsByClassName("endOverlay"));
  eoe.forEach(element => {
    reset_animation(element);
    element.style.animation = `fadeOpacityTxt 0.2s linear forwards ${reverse? "reverse" : "normal"}`;
  });
  document.getElementById("eo_btn").style.visibility = reverse ? "visible" : "hidden";
}

function createTransformMap(pose_3d, pose_Ai){
  const map = pose_3d.clone();
  map.devide(pose_Ai);
  return map
}

function getUserPoseIn3dWorld(pose_px){
  const newPose = pose_px.clone();
  newPose.sub(performance.userTpose);
  const vec = new Vector2(- performance.transform.center.x, - performance.transform.center.y); //Negativ, da gespiegelt werden muss
 
  newPose.multiplyVector(vec);

  newPose.add(view3D.getStandardTpose(true));
  return newPose
}

function syncPosePositions(targetPose, poseToSync){
  const targetPoint = targetPose.getPointOfGravity();
  const currentPoint = poseToSync.getPointOfGravity();
  const difference = new Vector2().subVectors(currentPoint, targetPoint);
  //const difference = currentPoint.sub(targetPoint).clone();
  poseToSync.subVector(difference);
}

function autoAdjustScale(targetPose, poseUser){
  const scalePoint = poseUser.getPointOfGravity(); //getCenterCoordinate(); //
  let currentScale = performance.transform.scale;
  const scaleStep = performance.transform.scaleStep;
  let downscaledDistance, upscaledDistance;

  const dummyForUpscaling = poseUser.clone();
  const dummyForDownscaling = poseUser.clone();

  function getDistances(up, down){
    if(up){
      dummyForUpscaling.scaleAroundPoint(scalePoint, currentScale + scaleStep);
      upscaledDistance = getAverageSquareDistance(dummyForUpscaling, targetPose);
    }
    if(down){
      dummyForDownscaling.scaleAroundPoint(scalePoint, currentScale - scaleStep);
      downscaledDistance = getAverageSquareDistance(dummyForDownscaling, targetPose);  
    }
  }
  getDistances(true, true);

  if(upscaledDistance < downscaledDistance) { //für besseres Ergebniss muss pose GRÖßER skaliert werden
    // while(upscaledDistance < downscaledDistance){
    currentScale += scaleStep;
    //   getDistances(true, false);
    // }
  }
  else if(upscaledDistance > downscaledDistance) { //für besseres Ergebniss muss pose KLEINER skaliert werden
    // while(upscaledDistance > downscaledDistance){
    currentScale -= scaleStep;
    //   getDistances(false, true);
    // }
  }
  poseUser.scaleAroundPoint(scalePoint, currentScale)
  performance.transform.scale = currentScale;
}

function getAverageSquareDistance(poseA, poseB){
  let count = 0, value = 0;
  poseA.joints.forEach(jointA => {
    const jointB = poseB.joints.find(j => j.name === jointA.name);
    if(jointA.identified && jointB.identified){
      count++;
      value += jointA.position.distanceToSquared(jointB.position);
    }
  });
  return count === 0 ? 0 : value/count
}

function removeOffset(pose){
  const deltaPose = view3D.getPose(); //view3D.getStandardTpose(true);
  deltaPose.sub(pose);
  deltaPose.joints.filter(e => e.identified && e.score >= viewAI.params.minJointScore);
  const vec = new Vector2();
  const allX = deltaPose.getAxisValues("x");
  const allY = deltaPose.getAxisValues("y");
  const min = new Vector2(Math.min.apply(null, allX), Math.min.apply(null, allY));
  const max = new Vector2(Math.max.apply(null, allX), Math.max.apply(null, allY));
  if(min.x < 0 && max.x < 0){
    vec.setX(max.x);
  }
  else if(min.x > 0 && max.x > 0){
    vec.setX(min.x);
  }
  if(min.y < 0 && max.y < 0){
    vec.setY(max.y);
  }
  else if(min.y > 0 && max.y > 0){
    vec.setY(min.y);
  }
  pose.addVector(vec);
}

function compare(pose_3d, pose_user){
  let scorePose = new Pose(undefined, false);
  scorePose.joints.forEach((joint, index) => {
    const userJoint = pose_user.joints.find(j => j.name == joint.name);
    const pose3DJoint = pose_3d.joints.find(k => k.name == joint.name);
    if(!userJoint || !userJoint.identified){
      joint.identified = false;
      joint.score = 0;
    }
    else{
      joint.identified = true;
      const distance = userJoint.position.distanceTo(pose3DJoint.position);
      if(distance <= performance.toleranceRadiusFull){joint.score = 1;}
      else if(distance > performance.toleranceRadiusZero){joint.score = 0;}
      else{joint.score = 1 - ( (distance - performance.toleranceRadiusFull) / (performance.toleranceRadiusZero - performance.toleranceRadiusFull) );}
    }
  });
  return scorePose
}

function startPerformance() {
  bg_animation(true);
  if(!view3D.isAnimationRunning()) {
    view3D.playAnimation(500);
  }
  else{
    const buttonStyle = document.getElementById("preview").style;
    buttonStyle.backgroundColor = "transparent";
    buttonStyle.color = "var(--dark)";
  }
  document.getElementById("startOverlay_kal").style.visibility = "hidden";
  state = STATE.performing;
  performance.initialize(view3D.getStandardTpose(true));
  scoreboard.new();
  calibration.reset();
  document.getElementById("stopBtn").style.visibility = "visible";
  document.getElementById("overlay_3d").style.visibility = "hidden";
  document.getElementById("preview").style.visibility = "hidden";
  document.getElementById("helpBtn").style.visibility = "hidden";
  document.getElementById("fsbutton").style.visibility = "hidden";
  document.getElementById("backFromHelp").onclick();
}

function stopPerforming(){
  state = STATE.waitForEnd;

  //Diagramm 
  const dia = new Diagramm(document.getElementById("eo_dia"));
  dia.graphColor = "#a62639";
  dia.data = scoreboard.fullData;
  dia.average = scoreboard.getTotalScore(scoreboard.totalScorePose);
  dia.maxDisplayedTime = Math.round(dia.data[dia.data.length-1].x);
  dia.data = dia.data.map(d => {d.x -= dia.data[dia.data.length-1].x; return d});
  dia.handleResize();
  dia.draw();

  //Title
  document.getElementById("eo_title").innerHTML = ["Toll!","Klasse!","Super!","Fantastisch!","1a!","Weiter so!","Schön!"][Math.round(Math.random()*7)];

  //Duration & Average
  document.getElementById("eo_info_general").innerHTML = `\
    Dauer: <b>${scoreboard.timeTxt.innerHTML}</b><br> \n\
    Durchschnittlich: <b>${scoreboard.totalScoreTxt.innerHTML.split(" ")[1]}</b>`;

  //joints with lowest score
  let scorePoseCopy = scoreboard.totalScorePose.clone();
  scorePoseCopy.joints.sort((a,b) => a.score - b.score);
  let jointsToImprove = scorePoseCopy.joints.splice(0, 3);
  if(jointsToImprove.length > 0){
    let text = "Worauf du noch achten solltest:";
    jointsToImprove.forEach(j => {
      text += `<br>- ${j.getGermanName()} (${Math.round(j.score*100)}%)`;
    });
    document.getElementById("eo_info_detail").innerHTML = text;
  }

  fadeEndScreen(true); //enter Endscreen
}

function closeEndScreen(){
  fadeEndScreen(false);
  state = STATE.waitForStart;
  view3D.stopAnimation();
  document.getElementById("overlay_3d").style.visibility = "visible";
  document.getElementById("stopBtn").style.visibility = "hidden";
  document.getElementById("preview").style.visibility = "visible";
  document.getElementById("helpBtn").style.visibility = "visible";
  document.getElementById("fsbutton").style.visibility = "visible";
}

function togglePreview(){
  const buttonStyle = document.getElementById("preview").style;
  const fade = 650;//ms
  buttonStyle.pointerEvents = "none";
  setTimeout(()=>buttonStyle.pointerEvents = "all", fade*2)
  if (view3D.isAnimationRunning()){
    buttonStyle.backgroundColor = "transparent";
    buttonStyle.color = "var(--dark)";
    view3D.stopAnimation(fade);
  }
  else{
    buttonStyle.backgroundColor = "var(--dark)";
    buttonStyle.color = "var(--white)";
    view3D.playAnimation(fade);
  }
}

function setDifficulty(value){
  const maxRadiusZero = 0.5;
  const maxRadiusFull = 0.08;
  value = 1-value;
  performance.toleranceRadiusZero = maxRadiusZero*value;
  performance.toleranceRadiusFull = maxRadiusFull*value;
  //console.log(performance.toleranceRadiusFull, performance.toleranceRadiusZero);
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
