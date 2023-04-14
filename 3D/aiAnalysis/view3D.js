// import * as THREE from "https://unpkg.com/three@0.144.0/build/three.module.js";
// import { GLTFLoader } from "https://unpkg.com/three@0.144.0/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import { BufferAttribute, Group, ObjectLoader, Vector2, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Pose, Rig, TO } from "./classes.js";
import { Drawer } from "./feedback.js";
import { IDB } from "../../assets/shared/idb.js";

//Debug? DISABLE FOR PRODUCTION
var debug = false;

if(debug){
  var b1, b2
}

export class View3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.params = {
      figure: {
        scale: 1,
        preview: {
          blueprint: [
            ["right_wrist", "right_elbow"],
            ["right_elbow", "right_shoulder"],
            ["right_shoulder", "left_shoulder"],
            ["right_shoulder", "right_hip"],
            ["left_shoulder", "left_elbow"],
            ["left_elbow", "left_wrist"],
            ["left_shoulder", "left_hip"],
            ["right_hip", "left_hip"],
            ["right_hip", "right_knee"],
            ["right_knee", "right_ankle"],
            ["left_hip", "left_knee"],
            ["left_knee", "left_ankle"]
          ],
          spheres: new Pose(),
          lines: []
        }
      },
      animation:{
        startFrame: 0,
        endFrame: 0,
        fps: 24, //TODO: get dinamicly
        duration: 0,
        last: 0,
        name: undefined
      },
      camera: {
        positions: {
          pointToLookAt: new THREE.Vector3(0,1,0),
          front: new THREE.Vector3(0,1,4.5),
          left: new THREE.Vector3(4.5,1,0),
          right: new THREE.Vector3(-4.5,1,0),
        },
        fadeDuration: 300 //ms
      }
    }
    this.ready = false;
  }

  initialize(){
    // Needed Objects:
    // this.scene
    // this.renderer
    // this.camera
    
    //scene
    this.scene = new THREE.Scene();
    const themeColor = 0xaaaaaa;
    // this.scene.fog = new THREE.Fog( themeColor , 20, 40 );
    this.scene.background =  new THREE.Color( themeColor );

    //light
    const ambLight = new THREE.AmbientLight( 0x404040, 2); // soft white light
    this.scene.add( ambLight );

    const dirLight = new THREE.DirectionalLight( 0xffffff, 0.7);
    dirLight.position.set( 3, 10, 10 );
    dirLight.lookAt(0,1,0);
    dirLight.castShadow = true;
    this.scene.add( dirLight );

    //floor
    const mesh = new THREE.Mesh( new THREE.PlaneGeometry( 5, 5 ), new THREE.ShadowMaterial( { color: new THREE.Color().setHex(0x222222) } ) );
    mesh.rotation.x = - Math.PI / 2;
    mesh.receiveShadow = true;
    this.scene.add( mesh ); 

    const grid = new THREE.GridHelper( 5, 12, 0xffffff, 0xffffff);
    grid.material.opacity = 0.7;
    grid.material.transparent = true;
    this.scene.add( grid );

    //camera
    this.camera = new THREE.PerspectiveCamera(45, this.canvas.offsetWidth / this.canvas.offsetHeight, 1, 100);
    this.camera.position.set(
      this.params.camera.positions.front.x,
      this.params.camera.positions.front.y,
      this.params.camera.positions.front.z);
    this.camera.lookAt(this.params.camera.positions.pointToLookAt);
    //Adding variables needed for fading camera
    this.camera.fade = {
      isFading: false,
      target: new THREE.Vector3(0,0,0),
      origin: new THREE.Vector3(0,0,0),
      elapsed: 0,
      duration: this.params.camera.fadeDuration
    }

    //renderer
    this.renderer = new THREE.WebGLRenderer({canvas: this.canvas, antialias: true});
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(this.canvas.offsetWidth, this.canvas.offsetHeight, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.render(this.scene, this.camera);

    this.#fetchData();
  }

  handleResize(){
    this.renderer.setSize(this.canvas.offsetWidth, this.canvas.offsetHeight, false);
    this.camera.aspect = this.canvas.offsetWidth / this.canvas.offsetHeight;
    this.camera.updateProjectionMatrix();
  }

  update(delta){
    if(!this.ready) return
    this.#calcCamPos(delta);
    this.renderer.render(this.scene, this.camera);
    
    //this.mixer.update(delta/1000);
    const startTime = this.params.animation.startFrame/this.params.animation.fps;
    const endTime = this.params.animation.endFrame/this.params.animation.fps;
    const totalPlayDuration = (endTime-startTime);
    this.params.animation.last += delta/1000;
    while (this.params.animation.last > totalPlayDuration) {this.params.animation.last -= totalPlayDuration}
    this.mixer.setTime(startTime + (this.params.animation.last / totalPlayDuration) * totalPlayDuration);
    //console.log(startTime, endTime, totalPlayDuration, this.params.animation.duration, this.params.animation.fps, (startTime + (this.params.animation.last / totalPlayDuration) * totalPlayDuration)*this.params.animation.fps, delta );
  
    if(debug){
      try{
        b1.update();
        b2.update();
      }
      catch (error) {
        console.log(error);
      }  
    }
  }

  getPose(view = "auto"){
    if(!this.ready) {return}
    const rig = this.getRig();
    const nView = typeof(view) == "string" && view == "auto" ? this.getNumOfView() : view;
    const pose = rig.toPose(nView);
    // const debug = false;
    // if(debug){
    //   this.#debugRig(rig);
    //   this.debugPose(pose);
    // }
    return pose;
  }

  fadeCamera(toView, duration = this.camera.fade.duration){
    if (this.camera.fade.isFading || !this.ready) {return;}
    this.camera.fade.duration = duration;
    this.camera.fade.elapsed = 0;
    this.camera.fade.isFading = true;
    this.camera.fade.origin = this.copyVecEul(this.camera.position);//Object.create(this.camera.position);
    switch(toView){
      case TO.front:
        this.camera.fade.target = this.params.camera.positions.front;
        this.para
        break;
      case TO.left:
        this.camera.fade.target = this.params.camera.positions.left;
        break;
      case TO.right:
        this.camera.fade.target = this.params.camera.positions.right;
        break;
      default:
        throw new Error("invalid view number: ", toView);
    }
    if(this.camera.fade.target.distanceTo(this.camera.position) == 0) {this.camera.fade.isFading = false;}
  }

  copyVecEul(vec){ //Vector2-4 & Euler
    return vec.clone()
  }

  subVector3(a,b){
    return new THREE.Vector3(a.x-b.x, a.y-b.y, a.z-b.z);
  }

  addVector3(a,b){
    return new THREE.Vector3(a.x+b.x, a.y+b.y, a.z+b.z);
  }

  mirrorModel(){
    if(!this.ready) {return}
    const s = new Vector3(-1,1,1);
    this.scene.children.find(i => i.name == "modelGroup").scale.multiply(s);
  }

  #debugRig(rig){
    if(typeof this.debugObjRig == "undefined") {
      this.debugObjRig = [];
      for(let i = 0; i < 18; i++){
        const geometry = new THREE.SphereGeometry( 0.05);
        const material = new THREE.MeshBasicMaterial( { color: 0xff0000 } );
        const sphere = new THREE.Mesh( geometry, material );
        this.scene.add( sphere );
        this.debugObjRig.push(sphere);
      }
    }

    applyPos(this, rig.root.hip, 0);

    function applyPos(that, obj, lvl){
      //console.log(that.debugObjRig[lvl], obj, lvl);
      that.debugObjRig[lvl].position.set(obj.position.x + 1, obj.position.y,obj.position.z);
      for (let e in obj){
        if (e !== "position" && e !== "rotation" && e !== "ref") {
          //console.log(obj, e);
          lvl = applyPos(that, obj[e], lvl+1);
        }
      }
      return lvl;
    }
  }

  previewPose(position_pose, score_pose) {
    const allJoints = this.params.figure.preview.spheres.joints;
    const allLines = this.params.figure.preview.lines;
    //creating spheres/lines and adding it as userData to the joints/params obj if not done before
    if(typeof allJoints[0].userData == "undefined") {
      const group = new THREE.Group();
      allJoints.forEach(j => {
        const geometry = new THREE.SphereGeometry( 0.05);
        const material = new THREE.MeshStandardMaterial( { color: 0xffffff } );
        const sphere = new THREE.Mesh( geometry, material );
        j.userData = sphere;
        group.add(sphere);
      })
      for(let i = 0; i < this.params.figure.preview.blueprint.length; i++){
        const material = new THREE.LineBasicMaterial( { color: 0xffffff , linewidth: 10} );
        const geometry = new THREE.BufferGeometry();
        const line = new THREE.Line( geometry, material );
        allLines.push(line);
        group.add(line);
      }

      this.scene.add( group );
      if(debug){
        b1 = new THREE.BoxHelper( group, 0xff00ff );
        this.scene.add( b1 );
      }
    }
    //sets position and color of sphere
    allJoints.forEach(j => {
      const currentPoseJoint = position_pose.joints.find(i => i.name === j.name);
      const currentScoreJoint = score_pose.joints.find(i => i.name === j.name);
      switch (this.getNumOfView()) {
        case TO.front:
          j.userData.position.set(
            currentPoseJoint.position.x,
            currentPoseJoint.position.y,
            0
          );
          break;
        case TO.left:
          j.userData.position.set(
            0,
            currentPoseJoint.position.y,
            -currentPoseJoint.position.x,
          );
          break;
        case TO.right:
          j.userData.position.set(
            0,
            currentPoseJoint.position.y,
            currentPoseJoint.position.x,
          );
          break;
        default:
          break;
      }
      j.identified = currentPoseJoint.identified;
      j.userData.visible = j.identified;
      j.userData.material.color.setStyle(Drawer.getGradient("#ff0000", "#00ff00", currentScoreJoint.score)); 
    })
    this.params.figure.preview.blueprint.forEach((lp, ind) => {
      const j1 = allJoints.find(j => j.name === lp[0]);
      const j2 = allJoints.find(j => j.name === lp[1]);
      const pos1 = j1.userData.position.clone();
      const pos2 = j2.userData.position.clone();

      allLines[ind].geometry.setFromPoints([pos1, pos2]);
      allLines[ind].visible = j1.identified && j2.identified;
    })
  }

  getRig(){
    if (!this.ready) {return}
    let hips;
    this.scene.children.map(i => {
      if (i.name == "modelGroup"){
        hips = i.children[0].children[0].children[0];
      }
    });

    //reference
    const spine = hips.children[0];
    const spine1 = spine.children[0];
    const spine2 = spine1.children[0];
    const leftShoulder = spine2.children[0]; 
    const rightShoulder = spine2.children[1]; 
    const leftUpperArm = leftShoulder.children[0];
    const rightUpperArm = rightShoulder.children[0];
    const leftArm = leftUpperArm.children[0];
    const rightArm = rightUpperArm.children[0];
    const leftHand = leftArm.children[0];
    const rightHand = rightArm.children[0];
    const leftUpperLeg = hips.children[2];
    const rightUpperLeg = hips.children[1];
    const leftLeg = leftUpperLeg.children[0];
    const rightLeg = rightUpperLeg.children[0];
    const leftFoot = leftLeg.children[0];
    const rightFoot = rightLeg.children[0];

    let rig = new Rig(hips, 
      spine, 
      spine1, 
      spine2, 
      leftShoulder, 
      leftUpperArm,
      leftArm,
      leftHand,
      rightShoulder,
      rightUpperArm,
      rightArm,
      rightHand,
      leftUpperLeg,
      leftLeg,
      leftFoot,
      rightUpperLeg,
      rightLeg,
      rightFoot);

      rig.copyRefValues();
      return rig;
  }

  getNumOfView(){
    const n = this.camera.position.equals(this.params.camera.positions.front) ? TO.front : 
      this.camera.position.equals(this.params.camera.positions.left) ? TO.left :
      TO.right;
    return n;
  }

  playAnimation(fadeIn = 0){
    this.mixer.animationAction.setLoop(THREE.LoopOnce,1).play();
    this.mixer.animationAction.clampWhenFinished = true;
    if(fadeIn > 0) {
      this.mixer.animationAction.fadeIn(fadeIn/1000);
      //this.mixer.animationAction.crossFadeFrom(undefined, fadeIn/1000, false);
      setTimeout(()=>{
        this.mixer.animationAction.stopFading().reset();
      },fadeIn)
    }
  }

  stopAnimation(fadeOut = 0){
    if(fadeOut > 0){
      this.mixer.animationAction.setLoop(THREE.LoopOnce,1).fadeOut(fadeOut/1000);
      setTimeout(()=>{
        this.mixer.animationAction.stopFading();
        this.mixer.stopAllAction();
      },fadeOut)
    }
    else{
      this.mixer.stopAllAction();
    }
  }

  isAnimationRunning(){
    return this.mixer.animationAction.isRunning();
  }

  getStandardTpose(mirrored){
    return !mirrored? new Pose([
      new Vector2(0.1876081347914624, 1.4344565330538903),
      new Vector2(-0.18760783518830007, 1.4344565209466968),
      new Vector2(0.46165497307500136, 1.4344569243206426),
      new Vector2(-0.4616546734718391, 1.4344568497878076),
      new Vector2(0.7377995968314104, 1.4344572138387268),
      new Vector2(-0.7377992972282481, 1.4344570764023818),
      new Vector2(0.0912445262074471, 0.9301566183567049),
      new Vector2(-0.0912445336580276, 0.9301566332578661),
      new Vector2(0.09369132807478313, 0.5242025852203369),
      new Vector2(-0.093691338552162, 0.5242022722959521),
      new Vector2(0.09124463214538996, 0.10372260212898293),
      new Vector2(-0.09124464425258333, 0.10372357070446009)
    ],true)
    : new Pose([
      new Vector2(-0.1876081347914624, 1.4344565330538903),
      new Vector2(0.18760783518830007, 1.4344565209466968),
      new Vector2(-0.46165497307500136, 1.4344569243206426),
      new Vector2(0.4616546734718391, 1.4344568497878076),
      new Vector2(-0.7377995968314104, 1.4344572138387268),
      new Vector2(0.7377992972282481, 1.4344570764023818),
      new Vector2(-0.0912445262074471, 0.9301566183567049),
      new Vector2(0.0912445336580276, 0.9301566332578661),
      new Vector2(-0.09369132807478313, 0.5242025852203369),
      new Vector2(0.093691338552162, 0.5242022722959521),
      new Vector2(-0.09124463214538996, 0.10372260212898293),
      new Vector2(0.09124464425258333, 0.10372357070446009)
    ],true);
    // if(pose3d){
    //   console.log(pose3d);
    //   pose3d.joints.map(e => {
    //     console.log(`new Vector2(${e.position.x}, ${e.position.y}),`);
    //   });
    //  console.log();
    // }
  }

  #calcCamPos(delta) {
    if (!this.camera.fade.isFading) {return;}
    this.camera.fade.elapsed += delta;
    const progress = (this.camera.fade.elapsed < this.camera.fade.duration) ? (this.camera.fade.elapsed / this.camera.fade.duration) : 1;
    const relDist = this.subVector3(this.camera.fade.target, this.camera.fade.origin);
    const newPosition = this.addVector3(this.camera.fade.origin, relDist.multiplyScalar( progress ));
    // const newPosition = this.addVector3(this.camera.fade.origin, new Vector3(
    //   relDist.x * -(Math.cos(progress*Math.PI)),
    //   relDist.y,
    //   relDist.z
    //   ));
    this.camera.position.set(
      newPosition.x,
      newPosition.y,
      newPosition.z
    );
    this.camera.lookAt(this.params.camera.positions.pointToLookAt);
    if(progress == 1) {
      this.camera.fade.isFading = false;
      this.camera.position.set(
        this.camera.fade.target.x,
        this.camera.fade.target.y,
        this.camera.fade.target.z
      );
    }
  }

  #fetchData(){  
    fetch("../../assets/shared/paths.json")
    .then(function(resp) {
        return resp.json();
    })
    .then(data => this.#get3D(data));
  }

  #get3D(json){
    const dance = new URLSearchParams(window.location.search).get("d");
    const figureNumber = new URLSearchParams(window.location.search).get("id");
    let objectPath = json.paths.mainFolderED;
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
        throw new Error(`Dance ${dance} is invalid`);
        return;
    }
    
    const figureJSON = items.find(e => e.number == figureNumber);
    objectPath += "/" + figureJSON.fileName;
    if(!figureJSON.aiVerifiable) {throw new Error("can't use " + dance + figureJSON.number +" here!")}
    this.params.animation.startFrame = figureJSON.startFrame;
    this.params.animation.endFrame = figureJSON.endFrame;
    this.params.animation.name = figureJSON.animationName;
    this.params.figure.scale = figureJSON.hasOwnProperty("scale") ? figureJSON.scale : 1;
    uid = figureJSON.fileName;

    if(!IDB.isSupported()){
      this.#getGLB_online(objectPath, uid, false);
    }
    else{
      IDB.load(uid, json => {
        if(!json){
          this.#getGLB_online(objectPath, uid, true);
        }
        else{
          this.#getGLB_locally(json);
        }
      });
    }   
  }

  #getGLB_locally(json){
    const loader = new ObjectLoader();
    const object = loader.parse(json.data);
    this.scene.add(object);
    this.#finishGLBLoading(object);
  }

  #getGLB_online(objectPath, uid, saveLocally){
    const loader = new GLTFLoader();
    loader.load(objectPath, object => {

      object.scene.position.set(0,0,0);
      object.scene.traverse( function ( child ) {
        if ( child.isMesh ) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      object.scene.scale.multiplyScalar(parseFloat(this.params.figure.scale));
      object.scene.animations = Array.from(object.animations);

      this.scene.add( object.scene );

      //this.renderer.render(this.scene, this.camera);
      object.scene.updateMatrixWorld();

      if(saveLocally){
        const data = object.scene.toJSON();
        IDB.save(uid, data);
      }
      this.#finishGLBLoading(object.scene);
    });
  }

  #finishGLBLoading(object){
    if(debug){
      b2 = new THREE.BoxHelper( object, 0xffff00 );
      this.scene.add( b2 );
    }

    if(object.animations.length >= 1){
      this.mixer = new THREE.AnimationMixer(object);
      let ani;
      if(!this.params.animation.name) ani = object.animations[0];
      if(!!this.params.animation.name) ani = object.animations.find(a => a.name == this.params.animation.name);
      this.mixer.animationAction = this.mixer.clipAction(ani);
      this.params.animation.duration = object.animations[0].duration;
    }
    object.name = "modelGroup";
    //this.params.animation.fps = object.animations[0].tracks[0].times.length / object.animations[0].duration;
    this.#setReady();
    this.mirrorModel();
  }

  #setReady(){
    this.ready = true;
    const event = new Event("THREE_ready");
    window.dispatchEvent(event);
    console.log("Three ready");
  }
}