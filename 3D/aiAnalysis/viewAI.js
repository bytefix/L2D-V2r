import * as POSE_DETECTION from '@tensorflow-models/pose-detection';
//import * as POSE_DETECTION from "https://unpkg.com/@tensorflow-models/pose-detection@2.0.0/dist/index.js";
import '@tensorflow/tfjs-backend-webgl';
//import "https://unpkg.com/@tensorflow/tfjs-backend-webgl@4.0.0/dist/index.js";
import {JitterRemover, Joint, Pose} from './classes';
// import {Vector2} from "https://unpkg.com/three@0.144.0/build/three.module.js";
import {Vector2} from "three";

export class ViewAI{
    #detectorConfig = null;
    #detector = null;
    #jitterRemover = null;
    #lastPose = null;
    
    constructor(video){
        this.params = {
            minJointScore: 0.1,
            minPoseScore: 0.2
        }
        this.videoStream = video;
        this.ready = false;
    }

    async initialize(type){
        console.log("AI: " + type);
        let model;
        if(type == "lightning") model = POSE_DETECTION.movenet.modelType.SINGLEPOSE_LIGHTNING;
        else if(type == "thunder") model = POSE_DETECTION.movenet.modelType.SINGLEPOSE_THUNDER;

        // Create a config and detector.
        this.#detectorConfig = {
            modelType: model, 
            trackerType: POSE_DETECTION.TrackerType.BoundingBox,                 //default 
            minPoseScore: this.params.minPoseScore                               //min confidence score for valid pose
        };
        this.#detector = await POSE_DETECTION.createDetector(POSE_DETECTION.SupportedModels.MoveNet, this.#detectorConfig);
        this.#jitterRemover = new JitterRemover(50, this.params.minJointScore, 0.8);
        
        this.ready = true;
        const event = new Event("TF_ready");
        window.dispatchEvent(event);
        await this.update(1); 
        console.log("TF ready");  
    }

    async update(delta){
        if (!this.ready) {return}
        const pose = Object.create( await this.#detector.estimatePoses(this.videoStream, {flipHorizontal: false}) );
        this.#lastPose = pose//this.#jitterRemover.calculateAverage(pose, delta);
    }

    async getPermission(callback = function() {console.warn("Camera access needed!")}){
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: {}});
            this.videoStream.srcObject = stream;
            console.log("Permission given");
        }
        catch{
            callback();
            throw new Error("Please enable camera access");
        }   
    }

    getPose(){
        if (!this.ready) {return}
        let pose = new Pose();
        if (this.#lastPose.length >= 1) {
            this.#lastPose[0].keypoints.map(kp => {
                const index = pose.joints.findIndex(item => item.name === kp.name);
                if(index >= 0){
                    const joint = new Joint(
                        new Vector2(kp.x, kp.y),
                        kp.name,
                        kp.score,
                        kp.score >= this.params.minJointScore
                    );
                    pose.joints[index] = joint;
                }
            });     
        }
        return pose;
    }

    getTFPose(){
        if (!this.ready) {return}
        return this.#lastPose;
    }

    checkStartCondition(pose){
        /*
        Bedingungen, um in einer T-pose stehen zu lönnen:
        1. Alle Joints müssen vorhanden sein                #checkCompleteness
        2. Hände am weitesten außen (x+, x-)                #checkHands 
        3. Hände & Arme in Höhe der Schultern               #checkArmLine
        4. Füße Schulterbreit                               #checkFeet
        5. Füße, Beine & Hüfte jeweils auf einer höhe       #checkLegs
        */
       //console.log(this.#checkCompleteness(pose),this.#checkHands(pose),this.#checkArmLine(pose,    0.025), this.#checkFeet(pose,       0.1),this.#checkLegs(pose,       0.013));

        if     (!this.#checkCompleteness(pose))         {return false}
        else if(!this.#checkHands(pose))                {return false}
        else if(!this.#checkArmLine(pose,    0.025))    {return false}
        else if(!this.#checkFeet(pose,       0.1))      {return false}
        else if(!this.#checkLegs(pose,       0.013))    {return false}
        else                                            {return true }
    }

    #checkLegs(pose, tolerance){
        tolerance *= this.videoStream.videoHeight;
        let valid = true;
        const pairs = [
            [pose.joints.find(item => item.name == "left_ankle").position.y, pose.joints.find(item => item.name == "right_ankle").position.y],
            [pose.joints.find(item => item.name == "left_knee").position.y, pose.joints.find(item => item.name == "right_knee").position.y],
            [pose.joints.find(item => item.name == "left_hip").position.y, pose.joints.find(item => item.name == "right_hip").position.y]
        ];
        pairs.map(pair => {
            const max = Math.max.apply(null, pair);
            const min = Math.min.apply(null, pair);
            const mid = (max-min)/2 + min;
            if(max > mid+tolerance && min < mid-tolerance) {valid = false}
        });
        return valid
    }

    #checkFeet(pose, tolerance){
        tolerance *= this.videoStream.videoWidth; 
        const left = [pose.joints.find(item => item.name == "left_shoulder").position.x, pose.joints.find(item => item.name == "left_ankle").position.x];
        const right = [pose.joints.find(item => item.name == "right_shoulder").position.x, pose.joints.find(item => item.name == "right_ankle").position.x];
        const l_min = Math.min.apply(null, left);
        const l_max = Math.max.apply(null, left);
        const l_mid = (l_max-l_min)/2 + l_min;
        const r_min = Math.min.apply(null, right);
        const r_max = Math.max.apply(null, right);
        const r_mid = (r_max-r_min)/2 + r_min;
        if( l_max < l_mid+(tolerance) &&
            r_max < r_mid+(tolerance) &&
            l_min > l_mid-(tolerance) &&
            r_min > r_mid-(tolerance)
        ){return true}
        else {return false}
    }

    #checkArmLine(pose, tolerance){
        tolerance *= this.videoStream.videoHeight;
        let members = [
            pose.joints.find(item => item.name == "left_shoulder").position,
            pose.joints.find(item => item.name == "left_elbow").position,
            pose.joints.find(item => item.name == "left_wrist").position,
            pose.joints.find(item => item.name == "right_shoulder").position,
            pose.joints.find(item => item.name == "right_elbow").position,
            pose.joints.find(item => item.name == "right_wrist").position,
        ];
        let max = members[0].y;
        let min = members[0].y;
        let average = 0;
        members.map(e => {
            max = e.y > max ? e.y : max;
            min = e.y < max ? e.y : min;
            average += e.y;
        });
        average /= members.length;
        if(max <= average+tolerance && min >= average-tolerance){
            return true
        }
        else{
            return false;
        }
    }

    #checkHands(pose) {
        const posLeft = pose.joints.find(item => item.name == "left_wrist").position;
        const posRight = pose.joints.find(item => item.name == "right_wrist").position;
        let valid = true;
        pose.joints.map(e => {
            if(e.position.x > posLeft.x || e.position.x < posRight.x){
                valid = false;
            }
        })
        return valid
    }

    #checkCompleteness(pose){
        let valid = true;
        if(pose.joints.length != 12) {return false}
        pose.joints.map(e => {
            if(!e.identified) {valid = false}
        });
        return valid
    }
}