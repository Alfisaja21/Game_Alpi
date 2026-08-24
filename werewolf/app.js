
const SUPABASE_URL="https://keklkfvtbdejwqtmjzzo.supabase.co";
const SUPABASE_KEY="sb_publishable_PHOgHUCIXq8B89-tk2edVg_5enIgQaq";

const db=supabase.createClient(
SUPABASE_URL,
SUPABASE_KEY
);

let session={
room:null,
player:null,
token:null
};

const $=x=>document.getElementById(x);

function page(id){
document.querySelectorAll(".page")
.forEach(x=>x.classList.remove("active"));
$(id).classList.add("active");
}

function toast(t){
$("toast").innerText=t;
$("toast").classList.add("show");
setTimeout(()=>$("toast").classList.remove("show"),2500);
}


$("createBtn").onclick=async()=>{

let name=$("nameInput").value.trim();

if(!name){
toast("Input name first");
return;
}

let {data,error}=await db.rpc(
"werewolf_create_room",
{
p_player_name:name
}
);

if(error){
toast(error.message);
return;
}

let r=data[0];

session.room=r.room_code;
session.player=r.player_id;
session.token=r.player_token;

$("roomCode").innerText=r.room_code;

page("lobby");

listenLobby();

};


$("joinBtn").onclick=async()=>{

let name=$("nameInput").value.trim();
let code=prompt("Room code");

if(!name||!code){
toast("Data incomplete");
return;
}

let {data,error}=await db.rpc(
"werewolf_join_room",
{
p_room_code:code,
p_player_name:name
}
);

if(error){
toast(error.message);
return;
}

let r=data[0];

session.room=r.room_code;
session.player=r.player_id;
session.token=r.player_token;

$("roomCode").innerText=r.room_code;

page("lobby");

listenLobby();

};


function listenLobby(){

db.channel("room-"+session.room)
.on(
"postgres_changes",
{
event:"*",
schema:"public",
table:"werewolf_players",
filter:`room_code=eq.${session.room}`
},
()=>{
loadPlayers();
}
)
.subscribe();

loadPlayers();

}


async function loadPlayers(){

let {data}=await db
.from("werewolf_players")
.select("*")
.eq("room_code",session.room)
.order("seat_order");

$("playerList").innerHTML="";

(data||[]).forEach(p=>{

$("playerList").innerHTML+=
`<div>👤 ${p.player_name}
${p.is_host?" ⭐ HOST":""}</div>`;

});

}


$("startBtn").onclick=async()=>{

let {error}=await db.rpc(
"werewolf_start_game",
{
p_room_code:session.room,
p_host_id:session.player,
p_host_token:session.token
}
);

if(error){
toast(error.message);
return;
}

page("game");

};
