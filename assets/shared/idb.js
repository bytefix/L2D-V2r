const db_name = "l2d_main";
const db_version = 1;
const store_name = "files3D";

let saveQue = [];

export class IDB{
    static isSupported(){
       return !!window.indexedDB
    }

    static save(keyName_, json_){
        saveQue.push({keyName: keyName_, json: json_});
        if(saveQue.length > 1) return
        
        const request = window.indexedDB.open(db_name, db_version);

        request.onupgradeneeded = function (event) {
            var db = event.target.result;
            db.createObjectStore(store_name, {keyPath: "uid"});
            console.log("IDB: Upgrade");
          };

        request.onerror = function (event) {
            console.error(`Database error: ${event.target.errorCode}`);
        };
          
        request.onsuccess = function (event) {
            let db = event.target.result;
            let transaction = db.transaction([store_name], "readwrite");
            let store = transaction.objectStore(store_name);
            while(saveQue.length > 0){
                let dataSet = saveQue.shift();
                store.put({uid: dataSet.keyName, data: dataSet.json});
            }
            transaction.oncomplete = () => db.close;
            console.log("IDB: Saved");
        };
    }

    static load(keyName, callback){
        const request = window.indexedDB.open(db_name, db_version);

        request.onupgradeneeded = function (event) {
            var db = event.target.result;
            var objectStore = db.createObjectStore(store_name, {keyPath: "uid"});
            console.log("IDB: Upgrade");
          };

        request.onerror = function (event) {
            console.error(`Database error: ${event.target.errorCode}`);
        };
          
        request.onsuccess = function (event) {
            let db = event.target.result;
            let transaction = db.transaction([store_name], "readonly");
            let store = transaction.objectStore(store_name);
            let query = store.get(keyName)

            query.onsuccess = function (event) {
                callback(event.target.result);
            }
            
            query.onerror = function (event) {
                console.error(`Database error: ${event.target.errorCode}`);
            }

            transaction.oncomplete = () => db.close;
            console.log("IDB: Loaded");
        };
    }
}