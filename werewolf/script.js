let role="";
let roles=["Villager","Villager","Seer","Doctor","Werewolf"];

let profile=JSON.parse(localStorage.getItem("ww_profile")||'{"game":0,"win":0,"point":0}');

function speak(t){
 document.getElementById("story").innerText=t;
 if(document.getElementById("tts").value==="on"){
  speechSynthesis.speak(new SpeechSynthesisUtterance(t));
 }
}

function startGame(){
 role=roles[Math.floor(Math.random()*roles.length)];
 profile.game++;
 localStorage.setItem("ww_profile",JSON.stringify(profile));
 document.getElementById("title").innerText="Malam Pertama";
 speak("Malam tiba. Semua warga desa tertidur. Moderator memulai permainan.");
}

function showRole(){
 let r=document.getElementById("role");
 r.classList.remove("hide");
 r.innerHTML="Role Kamu<br><b>"+role+"</b>";
 setTimeout(()=>r.classList.add("hide"),5000);
}

document.getElementById("profile").innerText=
"Game: "+profile.game+" | Menang: "+profile.win+" | Poin: "+profile.point;