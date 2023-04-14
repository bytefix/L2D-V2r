import { IDB } from "../assets/shared/idb";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export function Preview(path, fileName, renderFrame, spinnerFrame, scale, animationName = undefined) {
    this.path = path;
    this.scale = scale;
    this.renderFrame = renderFrame;
    this.spinnerFrame = spinnerFrame
    this.animationName = animationName;
    this.fileName = fileName;
}

export class ViewHandler {
    #scenes = [];
    #canvas;
    #enableIDB;
    constructor(canvas, previews, enableIDB){
        this.#enableIDB = enableIDB;
        this.#canvas = canvas
        this.renderer;

        previews.forEach((preview, index) => {
            //Scene
            const scene = new THREE.Scene();

            //Light
            const ambLight = new THREE.AmbientLight( 0x404040, 2); // soft white light
            scene.add( ambLight );

            const dirLight = new THREE.DirectionalLight( 0xffffff, 1);
            dirLight.position.set(-2, 1, 5);
            dirLight.lookAt(0,1,0);
            scene.add( dirLight );

            const shadowLight = new THREE.DirectionalLight( 0xffffff, 1);
            shadowLight.position.set(-2, 3, 1);
            shadowLight.castShadow = true;
            shadowLight.shadow.mapSize.width = 1024;
            shadowLight.shadow.mapSize.height = 1024;
            shadowLight.lookAt(0,1,0);
            scene.add( shadowLight );

            //camera
            const camera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 1, 100);
            camera.position.set(0, 1, 2.5);
            camera.lookAt(0,0.9,0);

            //floor (shadow)
            const ground = new THREE.Mesh( new THREE.PlaneGeometry( 5, 5), new THREE.ShadowMaterial({color: new THREE.Color().setHex("0x999999")}) ); //new THREE.ShadowMaterial({color: new THREE.Color().setHex("0x999999")})
            ground.rotation.x = - Math.PI / 2;
            ground.receiveShadow = true;
            ground.position.setY(-0.001);
            scene.add( ground );

            //load Object
            this.#load(preview, scene);

            //UserData
            scene.userData.renderFrame = preview.renderFrame;
            scene.userData.camera = camera;

            //push
            this.#scenes.push(scene);     
        });

        //renderer
        this.renderer = new THREE.WebGLRenderer({canvas: canvas, antialias: false, alpha: true});
        this.renderer.shadowMap.enabled = true;
        this.handleResize();
    }
    #load(preview, scene){
        const uid = preview.fileName;
        const that = this;
        if(!IDB.isSupported() || !this.#enableIDB){ //Texture Error in MS files
            online(preview.path, uid, false);
        }
        else{
            IDB.load(uid, json => {
            if(!json){
                online(preview.path, uid, true);
            }
            else{
                locally(json);
            }
            });
        }
        function locally(json){
            const loader = new THREE.ObjectLoader();
            const object = loader.parse(json.data);
            finish(object);
        }

        function online(objectPath, uid, saveLocally){
            const loader = new GLTFLoader();

            loader.load(objectPath, object => {  
                object.scene.position.set(0,0,0);
                object.scene.scale.multiplyScalar(parseFloat(preview.scale));
                object.scene.animations = Array.from(object.animations);

                object.scene.traverse( function ( child ) {
                    if (child.isMesh) {
                        child.castShadow = true;
                    }
                });
        
                object.scene.updateMatrixWorld();
                if(saveLocally){
                    const data = object.scene.toJSON();
                    IDB.save(uid, data);
                }
                finish(object.scene);
            });
        }

        function finish(object){
            scene.add(object);
            if(object.animations.length >= 1){
                const mixer = new THREE.AnimationMixer(object);
                let ani = !preview.animationName ? object.animations[0] : object.animations.find(a => a.name == preview.animationName);
                mixer.clipAction(ani).play();
                scene.userData.hasAnimation = true;
                scene.userData.mixer = mixer;
            }
            object.castShadow = true;
            console.log(`Three ${preview.fileName} ready`);
            scene.userData.ready = true;
            preview.spinnerFrame.style.animation = "fadeOut 0.5s linear forwards";
            that.#renderScene(scene, 0, true);
        }
    }
    handleResize(){
        this.renderer.setPixelRatio(window.devicePixelRatio/2);
        this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

        this.#scenes.forEach(s => {
            const rect = s.userData.renderFrame.getBoundingClientRect();
            s.userData.camera.aspect = (rect.right - rect.left) / (rect.bottom - rect.top);
            s.userData.camera.updateProjectionMatrix();
        })
    }
    update(delta){
        this.#canvas.style.transform = `translateY(${window.scrollY}px)`;
        this.renderer.setScissorTest(true);
        this.renderer.clear();
        const that = this;

        this.#scenes.forEach(function(scene) {
            that.#renderScene(scene, delta);
        })
    }
    #renderScene(scene, delta, forced = false){
        if(!scene.userData.ready) return;

        const rect = scene.userData.renderFrame.getBoundingClientRect();

        // check if it's offscreen. If so skip it
        if(!forced){
            if(rect.bottom < 0 || rect.top > this.renderer.domElement.clientHeight ||
                rect.right < 0 || rect.left > this.renderer.domElement.clientWidth) {
                return; // it's off screen
            }
        }

        const width = rect.right - rect.left;
        const height = rect.bottom - rect.top - 6;
        const left = rect.left;
        const bottom = this.renderer.domElement.clientHeight - rect.bottom + 6;

        this.renderer.setViewport( left, bottom, width, height );
        this.renderer.setScissor( left, bottom, width, height );

        if(scene.userData.hasAnimation) scene.userData.mixer.update(delta);
        this.renderer.render(scene, scene.userData.camera);
    }
}