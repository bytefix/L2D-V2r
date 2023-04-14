import { Vector3, Vector2, Euler } from "three";
// import { Vector3, Vector2, Euler } from "https://unpkg.com/three@0.144.0/build/three.module.js";

export const TO = {
    front: 0,
    left: 1,
    right: 2
}

export const STATE = {
    loading: 0,
    waitForStart: 1,
    inCalibration: {
        one: 2.1,
        two: 2.2,
        three: 2.3,
        finished: 2.4
    },
    performing: 3,
    waitForEnd: 4,
}

//EXTENTION view3D.js

export class Rig{
    constructor(hi,sp,sp1,sp2,ls,lua,la,lh,rs,rua,ra,rh,lul,ll,lf,rul,rl,rf){
        this.root = {
            hip: {
                position: new Vector3(),
                rotation: new Euler(),
                ref: hi,
                spine: {
                    position: new Vector3(),
                    rotation: new Euler(),
                    ref: sp,
                    spine1: {
                        position: new Vector3(),
                        rotation: new Euler(),
                        ref: sp1,
                        spine2: {
                            position: new Vector3(),
                            rotation: new Euler(),
                            ref: sp2,
                            leftShoulder: {
                                position: new Vector3(),
                                rotation: new Euler(),
                                ref: ls,
                                leftUpperArm: {
                                    position: new Vector3(),
                                    rotation: new Euler(),
                                    ref: lua,
                                    lelftArm: {
                                        position: new Vector3(),
                                        rotation: new Euler(),
                                        ref: la,
                                        leftHand: {
                                            position: new Vector3(),
                                            rotation: new Euler(),
                                            ref: lh
                                        }
                                    }
                                }
                            },
                            rightShoulder: {
                                position: new Vector3(),
                                rotation: new Euler(),
                                ref: rs,
                                rightUpperArm: {
                                    position: new Vector3(),
                                    rotation: new Euler(),
                                    ref: rua,
                                    rightArm: {
                                        position: new Vector3(),
                                        rotation: new Euler(),
                                        ref: ra,
                                        rightHand: {
                                            position: new Vector3(),
                                            rotation: new Euler(),
                                            ref: rh,
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                leftUpperLeg: {
                    position: new Vector3(),
                    rotation: new Euler(),
                    ref: lul,
                    leftLeg: {
                        position: new Vector3(),
                        rotation: new Euler(),
                        ref: ll,
                        leftFoot: {
                            position: new Vector3(),
                            rotation: new Euler(),
                            ref: lf
                        }
                    }
                },
                rightUpperLeg: {
                    position: new Vector3(),
                    rotation: new Euler(),
                    ref: rul,
                    rightLeg: {
                        position: new Vector3(),
                        rotation: new Euler(),
                        ref: rl,
                        rightFoot: {
                            position: new Vector3(),
                            rotation: new Euler(),
                            ref: rf
                        }
                    }
                }
            }
        }
    }

    copyRefValues(obj = this.root.hip){
        const position = new Vector3();
        obj.ref.getWorldPosition(position);
        obj.position = position.clone();
        obj.rotation = obj.ref.rotation.clone();
        for (let e in obj){
            if (e !== "position" && e !== "rotation" && e !== "ref") {
                this.copyRefValues(obj[e]);
            }
        }
    }

    toPose(angle) {
        const raw = [
            this.root.hip.spine.spine1.spine2.leftShoulder.leftUpperArm.position,
            this.root.hip.spine.spine1.spine2.rightShoulder.rightUpperArm.position,
            this.root.hip.spine.spine1.spine2.leftShoulder.leftUpperArm.lelftArm.position,
            this.root.hip.spine.spine1.spine2.rightShoulder.rightUpperArm.rightArm.position,
            this.root.hip.spine.spine1.spine2.leftShoulder.leftUpperArm.lelftArm.leftHand.position,
            this.root.hip.spine.spine1.spine2.rightShoulder.rightUpperArm.rightArm.rightHand.position,
            this.root.hip.leftUpperLeg.position,
            this.root.hip.rightUpperLeg.position,
            this.root.hip.leftUpperLeg.leftLeg.position,
            this.root.hip.rightUpperLeg.rightLeg.position,
            this.root.hip.leftUpperLeg.leftLeg.leftFoot.position,
            this.root.hip.rightUpperLeg.rightLeg.rightFoot.position
        ];
        let posArray = [];

        if(angle == TO.front){
            raw.map(e => {
                posArray.push(new Vector2(e.x , e.y));
            });
        }
        else if(angle == TO.left){
            raw.map(e => {
                posArray.push(new Vector2(e.z*-1 , e.y));
            });
        }
        else if(angle == TO.right){
            raw.map(e => {
                posArray.push(new Vector2(e.z , e.y));
            });
        }
        return new Pose(posArray, true);
    }
}

export class Joint{
    constructor(position = new Vector2(), name = "joint", score = 0, identified = false, userData = undefined){
        this.position = position;
        this.name = name;
        this.score = score;
        this.identified = identified;
        this.userData = userData //optional Data
    }

    getGermanName(){
        //const names = ["left_shoulder","right_shoulder","left_elbow","right_elbow","left_wrist","right_wrist","left_hip","right_hip","left_knee","right_knee","left_ankle","right_ankle"]
        switch (this.name) {
            case "left_shoulder":
                return "Linke Schulter"
            case "right_shoulder":
                return "Rechte Schulter"
            case "left_elbow":
                return "Linker Ellenbogen"
            case "right_elbow":
                return "Rechter Ellenbogen"
            case "left_wrist":
                return "Linkes Handgelenk"
            case "right_wrist":
                return "Rechtes Handgelenk"
            case "left_hip":
                return "Hüfte (Links)"
            case "right_hip":
                return "Hüfte (Rechts)"
            case "left_knee":
                return "Linkes Knie"
            case "right_knee":
                return "Rechtes Knie"
            case "left_ankle":
                return "Linker Knöchel"
            case "right_ankle":
                return "Rechter Knöchel"
            default:
                return undefined
        }
    }
}

export class Pose{
    constructor(posArray = new Array(12).fill(new Vector2(0,0)), allIdentified = false){
        //const posArray = [ls,rs,le,re,lw,rw,lh,rh,lk,rk,la,ra];
        const names = ["left_shoulder","right_shoulder","left_elbow","right_elbow","left_wrist","right_wrist","left_hip","right_hip","left_knee","right_knee","left_ankle","right_ankle"];
        this.joints = [];
        for (let i = 0; i < names.length; i++) {
            this.joints.push(new Joint(posArray[i].clone(), names[i], 0, allIdentified));
        }
    }

    makeSelfAverage(poseToAdd, count){
        if(count==1){this.joints = poseToAdd.joints}
        this.joints.map(jnt => {
            const jntToAdd = poseToAdd.joints.find(j => j.name == jnt.name);
            jnt.position.setX(jnt.position.x * (1-(1/count)) + jntToAdd.position.x * (1/count));
            jnt.position.setY(jnt.position.y * (1-(1/count)) + jntToAdd.position.y * (1/count));
            jnt.score = jnt.score * (1-(1/count)) + jntToAdd.score * (1/count);
            return jnt;
        });
    }

    multiply(pose){
        this.joints.forEach((item, index) => {
            const jntToMtp = pose.joints.find(i => i.name == item.name);
            if(!jntToMtp){return}
            item.position.multiply(jntToMtp.position);
        });
    }

    multiplyVector(vector){
        this.joints.forEach((item, index) => {
            item.position.multiply(vector);
        });
    }

    devide(pose){
        this.joints.forEach((item, index) => {
            const jntToDvd = pose.joints.find(i => i.name == item.name);
            const x_d = (jntToDvd.position.x == 0) ? 0.0000000000000001 : jntToDvd.position.x;
            const y_d = (jntToDvd.position.y == 0) ? 0.0000000000000001 : jntToDvd.position.y;
            if(!jntToDvd){return}
            item.position.setX(item.position.x/x_d);
            item.position.setY(item.position.y/y_d);
        });
    }

    sub(pose){
        this.joints.forEach((item, index) => {
            const jntToSub = pose.joints.find(i => i.name == item.name);
            if(!jntToSub){return}
            item.position.sub(jntToSub.position);
        });
    }

    subVector(vector){
        this.joints.forEach((item, index) => {
            item.position.sub(vector);
        });
    }

    add(pose){
        this.joints.forEach((item, index) => {
            const jntToAdd = pose.joints.find(i => i.name == item.name);
            if(!jntToAdd){return}
            item.position.add(jntToAdd.position);
        });
    }

    addVector(vector){
        this.joints.forEach((item, index) => {
            item.position.add(vector);
        });
    }

    clone(){
        let newPose = new Pose();
        newPose.joints.forEach((item, index)=>{
            item.position =this.joints[index].position.clone();
            item.name = this.joints[index].name;
            item.score = this.joints[index].score;
            item.identified = this.joints[index].identified;
            item.userData = this.joints[index].userData; //not cloned, just copied TODO
        });
        return newPose
    }

    getAxisValues(axis){
        let all = this.joints.map(e => {
            if(axis === "x"){return e.position.x}
            else if(axis === "y"){return e.position.y}
            else if(axis === "score"){return e.score}
        });
        return all
    }

    getCenterCoordinate(){
        const allX = this.getAxisValues("x");
        const minX = Math.min.apply(null, allX);
        const maxX = Math.max.apply(null, allX);
        const midX = maxX - minX;
        const allY = this.getAxisValues("y");
        const minY = Math.min.apply(null, allY);
        const maxY = Math.max.apply(null, allY);
        const midY = maxY - minY;
        return new Vector2(midX, midY);
    }

    getPointOfGravity(ofIdentified = true){
        let valueX = 0, valueY = 0, count = 0;
        this.joints.forEach( item => {
            if(item.identified || !ofIdentified){
                valueX += item.position.x;
                valueY += item.position.y;
                count++;
            }
        });
        if(count == 0) count = 1
        return new Vector2(valueX/count, valueY/count);
    }

    scaleAroundPoint(point, scale){
        this.subVector(point);
        this.multiplyVector(new Vector2(scale, scale));
        this.addVector(point);
    }
}

//EXTENTION viewAI.js

//EXPERIMENTAL
export class JitterRemover {
    constructor(timeSpan, minConfidence, linearValue = 1){
        this.timeSpan = timeSpan;
        this.minConfidence = minConfidence;
        this.data = [];
        if(linearValue > 1) {this.linearValue = 2;} else {this.linearValue = linearValue*2};
    }

    calculateAverage(pose, delta){
        if(pose.length == 0 || delta == 0) {return pose;}
        if(this.data.length == 0) {this.#firstInput(pose, delta);}
        this.#updateData(pose, delta);

        for(let keypoint = 0; keypoint < 17; keypoint++){
            let valueX = 0;
            let valueY = 0;
            let counted = 0;
            for(let index = 0; index < this.data.length; index++){
                if(this.data[index].pose[0].keypoints[keypoint].score >= this.minConfidence){
                    valueX += this.data[index].pose[0].keypoints[keypoint].x
                    valueY += this.data[index].pose[0].keypoints[keypoint].y
                    counted ++;
                }
            }
            if(counted >= 1){
                pose[0].keypoints[keypoint].x = valueX/counted;
                pose[0].keypoints[keypoint].y = valueY/counted;
            }
        }
        return pose;
    }

    //EXPERIMENTAL
    calculateLinearAverage(pose, delta){
        if(pose.length == 0 || delta == 0) {return pose;}
        if(this.data.length == 0) {this.#firstInput(pose, delta);}
        this.#updateData(pose, delta);

        for(let keypoint = 0; keypoint < 17; keypoint++){
            let valueX = 0;
            let valueY = 0;
            let counted = 0;
            for(let index = 0; index < this.data.length; index++){
                if(this.data[index].pose[0].keypoints[keypoint].score >= this.minConfidence){
                    let linFaktor = this.linearValue * (index/this.data.length-0.5) + 1;            //y = linFaktor*(𝑥−0,5)+1
                    valueX += this.data[index].pose[0].keypoints[keypoint].x * linFaktor;
                    valueY += this.data[index].pose[0].keypoints[keypoint].y * linFaktor;
                    counted += linFaktor;
                }
            }
            if(counted > 0){
                pose[0].keypoints[keypoint].x = valueX/counted;
                pose[0].keypoints[keypoint].y = valueY/counted;
            }
        }
        return pose;
    }

    //TODO & EXPERIMENTAL
    calculateMedian(pose, delta){
        if(pose.length == 0 || delta == 0) {return pose;}
        if(this.data.length == 0) {this.#firstInput(pose, delta);}
        this.#updateData(pose, delta);

        for(let keypoint = 0; keypoint < 17; keypoint++){
            let valuesX = [];
            let valuesY = [];
            for(let index = 0; index < this.data.length; index++){
                if(this.data[index].pose[0].keypoints[keypoint].score >= this.minConfidence){
                    valuesX.push(this.data[index].pose[0].keypoints[keypoint].x);
                    valuesY.push(this.data[index].pose[0].keypoints[keypoint].y);
                }
            }
            if(valuesX.length > 0){
                valuesX.sort();
                valuesY.sort();
                pose[0].keypoints[keypoint].x = valuesX[Math.round((valuesX.length-1)/2)];
                pose[0].keypoints[keypoint].y = valuesY[Math.round((valuesY.length-1)/2)];
            }
        }
        return pose;
    }

    #firstInput(pose, delta){
        const minLength = Math.round(this.timeSpan / delta) + 1;
        this.data = Array(minLength).fill(this.#toObj(pose, delta));
    }

    #updateData(pose, delta){
        this.data.unshift(this.#toObj(pose, delta));
        let countedTime = 0;
        for(let i = 0; i < this.data.length; i++){
            if(countedTime >= this.timeSpan){
                this.data = this.data.slice(0,i); 
                return;
            }
            countedTime += this.data[i].delta; //adds delta to countedTime
        }
    }

    #toObj(pose_, delta_){
        return {
            pose: pose_,
            delta: delta_
        }
    }
}