const modal=document.getElementById("tutorialModal");
const slides=[...document.querySelectorAll(".tutorial-slide")];
const next=document.getElementById("tutorialNextBtn");
const skip=document.getElementById("tutorialSkipBtn");
const openBtn=document.getElementById("openTutorialBtn");
const stepText=document.getElementById("tutorialStepText");
const dots=document.getElementById("tutorialDots");
const KEY="gameAlpiImpostorTutorialSeen";
let step=0;

function render(){
  slides.forEach((s,i)=>s.classList.toggle("hidden",i!==step));
  stepText.textContent=`${step+1} / ${slides.length}`;
  dots.innerHTML=slides.map((_,i)=>`<i class="${i===step?"active":""}"></i>`).join("");
  next.textContent=step===slides.length-1?"Mulai Main":"Lanjut";
}
function showTutorial(reset=true){
  if(reset)step=0;
  render();
  modal.classList.remove("hidden");
}
function closeTutorial(){
  modal.classList.add("hidden");
  localStorage.setItem(KEY,"1");
}
next.onclick=()=>{
  if(step<slides.length-1){step++;render()}
  else closeTutorial();
};
skip.onclick=closeTutorial;
openBtn.onclick=()=>showTutorial(true);
modal.addEventListener("click",e=>{if(e.target===modal)closeTutorial()});
if(localStorage.getItem(KEY)!=="1")setTimeout(()=>showTutorial(true),250);
