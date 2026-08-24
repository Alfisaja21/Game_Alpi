const SUPABASE_URL="https://keklkfvtbdejwqtmjzzo.supabase.co";
const SUPABASE_KEY="YOUR_ANON_KEY";

let supabaseClient=null;

if(SUPABASE_KEY !== "YOUR_ANON_KEY"){
    supabaseClient=supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );
}

let room=null;

const $=id=>document.getElementById(id);

function show(id){
    document.querySelectorAll(".screen")
    .forEach(x=>x.classList.remove("active"));

    $(id).classList.add("active");
}

$("createBtn").onclick=async()=>{

    const name=$("playerName").value.trim();

    if(!name){
        showToast("Isi nama dulu");
        return;
    }

    // Tempat RPC Supabase:
    // room = await supabase.rpc("werewolf_create_room",...)

    room={
        code:
        Math.random()
        .toString(36)
        .substring(2,8)
        .toUpperCase(),
        players:[name]
    };

    loadLobby();
};


$("joinBtn").onclick=()=>{

    const name=$("playerName").value.trim();

    if(!name){
        showToast("Isi nama dulu");
        return;
    }

    const code=prompt("Kode room:");

    if(code){
        room={
            code:code.toUpperCase(),
            players:[name]
        };

        loadLobby();
    }
};


function loadLobby(){

    $("roomCode").innerText=room.code;

    $("players").innerHTML="";

    room.players.forEach(p=>{
        $("players").innerHTML+=`
        <div class="player">
        👤 ${p}
        </div>`;
    });

    show("lobby");
}


$("startBtn").onclick=()=>{

    show("game");

    $("phase").innerText="🌙 Night Phase";

    $("roleCard").innerText=
    "Role akan diberikan dari Supabase";
};


function showToast(message){
    let toast=document.getElementById("gameToast");

    if(!toast){
        toast=document.createElement("div");
        toast.id="gameToast";
        document.body.appendChild(toast);
    }

    toast.innerText=message;
    toast.classList.add("show");

    setTimeout(()=>{
        toast.classList.remove("show");
    },2500);
}
