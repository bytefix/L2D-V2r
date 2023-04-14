import { Vector2, Vector4 } from "three";
import { Pose } from "./classes";
// import { Vector2 } from "https://unpkg.com/three@0.144.0/build/three.module.js";

export class Drawer {
    #blueprint = [
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
        ["left_knee", "left_ankle"],
    ];
    #colorLow = "#FF0000";
    #colorHigh = "#00FF00";
    #minConfidence = 0;
    #size = new Vector2();

    constructor(canvas, videoStream, minConfidence) {
        this.video = videoStream;
        this.ctx = canvas.getContext("2d");
        this.#size = new Vector2(videoStream.videoWidth, videoStream.videoHeight);
        this.#minConfidence = minConfidence;
        canvas.width = this.#size.x;
        canvas.height = this.#size.y;
    }

    drawAll(positionPose, scorePose = undefined){
        this.ctx.clearRect(0,0,this.#size.x,this.#size.y);
        this.ctx.drawImage(this.video, 0, 0, this.#size.x, this.#size.y);
        if(!positionPose) {return}
        if(!scorePose) {scorePose = positionPose;}
        //lines
        this.#blueprint.map(line => {      
            const posJntA = positionPose.joints.find(item => item.name === line[0]);
            const posJntB = positionPose.joints.find(item => item.name === line[1]);
            const scoJntA = scorePose.joints.find(item => item.name === line[0]);
            const scoJntB = scorePose.joints.find(item => item.name === line[1]);
            if(scoJntA.identified && scoJntB.identified){
                const clrA = Drawer.getGradient(this.#colorLow, this.#colorHigh, scoJntA.score);
                const clrB = Drawer.getGradient(this.#colorLow, this.#colorHigh, scoJntB.score);
                this.#drawLine(posJntA.position, posJntB.position, clrA, clrB);
            }
        });
        //points
        positionPose.joints.map(jnt => {
            const scoreJnt = scorePose.joints.find(item => item.name === jnt.name);
            if(scoreJnt.identified){
                this.#drawCircle(
                    jnt.position,
                    12,
                    Drawer.getGradient(this.#colorLow, this.#colorHigh, scoreJnt.score)
                );
            }
        });
    }

    static getGradient(colorA, colorB, step){
        let gradient = "#";
        for(let i = 0; i <= 2; i++){
            const a = parseInt(colorA.slice(1+i*2, 3+i*2),16);
            const b = parseInt(colorB.slice(1+i*2, 3+i*2),16);
            const n = Math.round(((b-a)*step+a)).toString(16);
            gradient += n.length == 2 ? n : "0" + n;
        }
        return gradient
    }

    #drawCircle(point, radius, color){ 
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(point.x, point.y, radius, 0, 2*Math.PI);
        this.ctx.fill(); 
    }

    #drawLine(point1, point2, colorA, colorB) {
        const grad= this.ctx.createLinearGradient(point1.x, point1.y, point2.x, point2.y);
        grad.addColorStop(0, colorA);
        grad.addColorStop(1, colorB);
        this.ctx.lineWidth = 5;
        this.ctx.strokeStyle = grad;
        this.ctx.beginPath();
        this.ctx.moveTo(point1.x, point1.y);
        this.ctx.lineTo(point2.x, point2.y)
        this.ctx.stroke();
    }

    updateVideoSize(){
        this.#size = new Vector2(this.video.videoWidth, this.video.videoHeight);
    }
}

export class Scoreboard{
    constructor(score, totalScore, time){
        this.scoreTxt = score;
        this.totalScoreTxt = totalScore;
        this.timeTxt = time;
        this.totalScorePose = new Pose();
        this.totalPosesCounted = 1;
        this.notVisibleTime = 0;
        this.fullData = [];
        this.diagramm = new Diagramm(document.getElementById("diagramm"));
        this.gauge = new GaugeManager(document.getElementById("gauge"));
    }
    new(){
        this.totalScorePose = new Pose();
        this.notVisibleTime = 0;
        this.totalPosesCounted = 1;
        this.diagramm.clearData();
        this.fullData = [];
    }
    update(scorePose, startTime, delta){
        const score = Math.round(this.getTotalScore(scorePose)*100);

        if(score != -100){
            this.fullData.push(new Vector2((Date.now() - startTime - this.notVisibleTime), score/100));

            //this.diagramm.update(this.#smoothedValue(200)/100, delta);
            //this.scoreTxt.innerHTML = score + "%";
            this.scoreTxt.innerHTML = this.#smoothedValue(250) + "%";
            this.gauge.set(this.#smoothedValue(250)/100);

            this.totalScorePose.makeSelfAverage(scorePose, this.totalPosesCounted);
            this.totalPosesCounted++;
            const scoreTotal = Math.round(this.getTotalScore(this.totalScorePose)*100);
            this.totalScoreTxt.innerHTML = "Durchschnitt: " + scoreTotal + "%";

            this.diagramm.update(score/100, delta, scoreTotal/100);

            const totalTime = Date.now() - startTime - this.notVisibleTime;
            let min = (totalTime/1000/60).toString().split(".")[0];
            let sec = ((totalTime/1000)-parseInt(min)*60).toString().split(".")[0];
            sec = sec.length < 2 ? "0" + sec : sec;
            const displayTime = min + ":" + sec;
            this.timeTxt.innerHTML = displayTime;
        }
        else{
            this.notVisibleTime += delta;
            this.scoreTxt.innerHTML = "---";
        }
    }

    #smoothedValue(deltaMax){
        const currentTime = this.fullData[this.fullData.length-1].x;
        const values = deltaMax < currentTime ?
            this.fullData.filter(d => currentTime - d.x < deltaMax)
            : this.fullData;
        return Math.round(values.reduce((cur, acc) => cur + acc.y, 0) / values.length * 100);
    } 

    getTotalScore(pose){
        let score = 0;
        let count = 0;
        pose.joints.map(j => {
            score+= j.identified ? j.score : 0;
            count+= j.identified ? 1 : 0;
        });
        return count >= 6 ? score/count : -1;
    }

    handleResize(){
        this.diagramm.handleResize();
    }
}

export class Diagramm{
    constructor(canvas){
        this.maxDisplayedTime = 10000;
        this.data = [];
        this.ctx = canvas.getContext("2d");
        this.pixelRatio = 2;
        this.average = 0;
        canvas.width = 100;
        canvas.height = 100;
        canvas.width = canvas.offsetWidth * this.pixelRatio;
        canvas.height = canvas.offsetHeight * this.pixelRatio;
        this.canvas = canvas;
        this.size = new Vector2(canvas.width, canvas.height).multiplyScalar(1);
        this.margin = [30*this.pixelRatio,20*this.pixelRatio,10*this.pixelRatio] //left, bottom, top
        this.#drawAxis();
        this.update(0,0);
        this.graphColor = "#549dac";
        this.graphColorAverage = "#F7B538";
        this.axisColor = "#293241";
        this.textColor = "#000000";
    }
    update(y, delta, average = 0){
        this.average = average;
        this.#updateData(y, delta);
        this.draw();
    }
    draw(){
        this.ctx.clearRect(0,0,this.size.x,this.size.y);
        this.#drawData();
        this.#drawAxis();
    }
    #drawAxis(){
        this.ctx.font = `${12*this.pixelRatio}px Anton`;
        this.ctx.strokeStyle = this.axisColor;
        this.ctx.fillStyle = this.axisColor;
        const lineWidth = 2*this.pixelRatio;
        const arrowSize = 5*this.pixelRatio;
        this.ctx.lineWidth = lineWidth;
        //axis: lines
        this.ctx.beginPath();
        this.ctx.moveTo(this.margin[0]-lineWidth, arrowSize*2);
        this.ctx.lineTo(this.margin[0]-lineWidth, this.size.y - this.margin[1] + lineWidth);
        this.ctx.lineTo(this.size.x - arrowSize*2, this.size.y - this.margin[1] + lineWidth);
        this.ctx.stroke();
        //axis: arrows
        this.ctx.beginPath();
        this.ctx.moveTo(this.size.x - arrowSize*2, this.size.y - this.margin[1] + lineWidth + arrowSize);
        this.ctx.lineTo(this.size.x, this.size.y - this.margin[1] + lineWidth);
        this.ctx.lineTo(this.size.x - arrowSize*2, this.size.y - this.margin[1] + lineWidth - arrowSize);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.fill();
        this.ctx.moveTo(this.margin[0]-lineWidth - arrowSize, arrowSize*2);
        this.ctx.lineTo(this.margin[0]-lineWidth, 0);
        this.ctx.lineTo(this.margin[0]-lineWidth + arrowSize, arrowSize*2);
        this.ctx.fill();
        //axis: text & numbers
        this.ctx.fillStyle = this.textColor;
        this.ctx.fillText(-Math.round(this.maxDisplayedTime/100)/10 + " Sekunden", this.margin[0], this.size.y);
        this.ctx.fillText("0 Sekunden", this.size.x - 75*this.pixelRatio, this.size.y);
        this.ctx.fillText("[%]", 0, 15*this.pixelRatio);
        this.ctx.fillText("100", 0, this.margin[2]+25*this.pixelRatio);
        this.ctx.fillText("0",  this.margin[0]/2, this.size.y - this.margin[1]);
        //TODO
    }
    #drawData(){
        this.ctx.lineWidth = 2 * this.pixelRatio;
        this.ctx.strokeStyle = this.graphColor;
        this.ctx.beginPath();
        const x0 = this.size.x - (-this.data[0].x/this.maxDisplayedTime * (this.size.x - this.margin[0]));
        const y0 = this.size.y - (this.data[0].y * (this.size.y - (this.margin[1] + this.margin[2]))) - this.margin[1];
        this.ctx.moveTo(x0, y0);
        this.data.forEach((item, index) => {
            if(index == 0) {return}
            const x = this.size.x - (-item.x/this.maxDisplayedTime * (this.size.x - this.margin[0]));
            const y = this.size.y - (item.y * (this.size.y - (this.margin[1] + this.margin[2]))) - this.margin[1];
            this.ctx.lineTo(x, y);
        })
        this.ctx.stroke();

        if(this.average > 0){
            this.ctx.strokeStyle = this.graphColorAverage;
            const x0 = this.size.x;
            const x = this.margin[0];
            const y = this.size.y - (this.average * (this.size.y - (this.margin[1] + this.margin[2]))) - this.margin[1];
            this.ctx.beginPath();
            this.ctx.moveTo(x0, y);
            this.ctx.lineTo(x, y);
            this.ctx.stroke();
        }
        
    }
    clearData(){
        this.data = [];
    }
    handleResize(){
        this.canvas.width = this.canvas.offsetWidth * this.pixelRatio;
        this.canvas.height = this.canvas.offsetHeight * this.pixelRatio;
        this.ctx.clearRect(
            -1,
            -1,
            this.size.x + 2,
            this.size.y + 2
        );
        this.size.set(this.canvas.width, this.canvas.height);
        this.#drawAxis();
    }
    #updateData(y, delta){
        this.data = this.data.map(d => {
            d.x -= delta;
            return d
        })
        this.data = this.data.filter(d => 
            -d.x <= this.maxDisplayedTime
        );
        this.data.unshift(new Vector2(0, y));
    }
}

class GaugeManager{
    constructor(gaugeEl){
        this.gauge = gaugeEl;
    }
    set(value) {
        const conic = `conic-gradient(from -90deg, black 0deg ${value*180}deg, rgba(0, 0, 0, 0.1) ${value*180}deg 180deg, rgba(0, 0, 0, 0) 180deg 360deg)`;
        this.gauge.style.webkitMaskImage = conic;
        this.gauge.style.maskImage = conic;
    }
}

