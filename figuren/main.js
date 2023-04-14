import { ViewHandler, Preview } from "./view3D";

let delta = 0,
previousFrame = Date.now(),
viewHandler,
scrolling = false,
previousScrollLength = [0,0,0,0,0,0],
fpsOnRender = Infinity,
renderedLastFrame = false;

const dance = new URLSearchParams(window.location.search).get("d");
document.getElementById("tanzname").innerHTML = dance;
document.title = dance;

fetch("../assets/shared/paths.json")
    .then(resp => resp.json())
    .then(data => buildPage(data));

function buildPage(json){
    let items, previews = [];
    let path = json.paths.mainFolder;
    switch(dance){
        case "Debug":
            items = json.figures.debug;
            path += json.paths.debug;
            break;
        case "Extras":
            items = json.figures.extra;
            path += json.paths.extra;
            break;
        case "Shuffle":
            items = json.figures.shuffle;
            path += json.paths.shuffle;
            break;
        case "Michael Jackson":
            items = json.figures.mj;
            path += json.paths.mj;
            break;
        case "HipHop":
            items = json.figures.hiphop;
            path += json.paths.hiphop;
            break;
        default:
            items = null;
            throw new Error("Dance d invalid");
    }

    const flexContainer = document.getElementById("flexContainer");
    items.forEach(element => {
        flexContainer.insertAdjacentHTML("beforeend", createHTML(element.number, element.description));
        const individualPath = path + "/" + element.fileName;
        const scale = element.hasOwnProperty("scale") ? element.scale : 1;
        previews.push(
            new Preview(
                individualPath,
                element.fileName,
                document.getElementById(`renderDiv${element.number}`),
                document.getElementById(`spinner${element.number}`),
                scale,
                element.animationName
            )
        );
    });

    viewHandler = new ViewHandler(document.getElementById("canvas"), previews, dance != "Extras");
    leaveLoading();
    animate();
}

function leaveLoading(){
    const scr = document.getElementById("loading_screen");
    const ani = document.getElementById("animation_frame");
    ani.style.animation = "fadeOut 0.5s linear forwards";
    ani.style.pointerEvents = "none";
    setTimeout(() => {
      scr.style.animation = "fadeOut 1s linear forwards";
      scr.style.pointerEvents = "none"; 
    }, 800);
  }
  
function createHTML(number, description){
    return `\
    <div class ="flexItem" onclick="location.href=location.href.split('figuren')[0] + '3D/?d=${dance}&id=${number}'">
        <div class="overlayNumber">
            <span>${number}</span>
        </div>
        <div id="renderDiv${number}" class="renderDiv"></div>
        <div class="overlayDescription">
            <p>${description}</p>
        </div>
        <div class="spinner" id="spinner${number}">
            <div>
                <div></div>
                <div></div>
                <div></div>
            </div>
        </div>
    </div>`;
}

window.onresize = () => {
    viewHandler.handleResize();
};

function animate(){
    delta = Date.now() - previousFrame;
    fpsOnRender = renderedLastFrame ? 1/delta*1000 : fpsOnRender;
    previousFrame = Date.now();
    previousScrollLength.unshift(document.body.scrollTop);
    previousScrollLength = previousScrollLength.slice(0,3);
    scrolling = previousScrollLength.reduce((acc, val) => {return acc + val}, 0) != previousScrollLength[0]*previousScrollLength.length;

    if(fpsOnRender >= 15 || !scrolling){
        viewHandler.update(delta/1000);
        renderedLastFrame = true;
    }
    else{
        viewHandler.renderer.clear();
        renderedLastFrame = false;
    }
    requestAnimationFrame(animate);
}


