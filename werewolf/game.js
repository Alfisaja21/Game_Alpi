
const create=document.getElementById("createRoom");
const join=document.getElementById("joinRoom");
const lobby=document.getElementById("lobby");

create.onclick=()=>{
openLobby();
};

join.onclick=()=>{
let code=prompt("Masukkan kode room");
if(code){
document.getElementById("roomCode").innerText=code;
openLobby();
}
};

function openLobby(){
lobby.classList.remove("hidden");
lobby.scrollIntoView({behavior:"smooth"});
}
