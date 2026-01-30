const STORAGE_KEY = "malla_icminas_ucn_aprobados_v1";

let data = null;
let aprobados = new Set();      // ids aprobados
let unlockedNow = new Set();    // ids resaltados por desbloqueo reciente

function loadState(){
  try{
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    aprobados = new Set(raw);
  }catch{
    aprobados = new Set();
  }
}

function saveState(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...aprobados]));
}

function isDone(id){ return aprobados.has(id); }

function prereqsOf(id){
  const c = data.cursos.find(x => x.id === id);
  return (c && c.prerrequisitos) ? c.prerrequisitos : [];
}

function allPrereqsDone(id){
  return prereqsOf(id).every(p => aprobados.has(p));
}

function isLocked(id){
  if(isDone(id)) return false; // si ya está aprobado, no se bloquea
  const reqs = prereqsOf(id);
  if(reqs.length === 0) return false;
  return !allPrereqsDone(id);
}

function availableCourses(){
  // Disponibles: NO aprobados y NO bloqueados
  return new Set(
    data.cursos
      .filter(c => !isDone(c.id) && !isLocked(c.id))
      .map(c => c.id)
  );
}

function dependentsOf(id){
  // Cursos donde id aparece como prerequisito (flecha saliente)
  return data.cursos
    .filter(c => (c.prerrequisitos || []).includes(id))
    .map(c => c.id);
}

function toggleDone(id){
  const beforeAvail = availableCourses();

  if(aprobados.has(id)) aprobados.delete(id);
  else aprobados.add(id);

  saveState();

  const afterAvail = availableCourses();

  // Resaltar SOLO los que quedaron disponibles gracias a ESTE ramo (dependientes directos)
  unlockedNow = new Set();
  for(const dep of dependentsOf(id)){
    if(afterAvail.has(dep) && !beforeAvail.has(dep)){
      unlockedNow.add(dep);
    }
  }
}

function groupBySemester(cursos){
  const map = new Map();
  for(const c of cursos){
    if(!map.has(c.semestre)) map.set(c.semestre, []);
    map.get(c.semestre).push(c);
  }
  return [...map.entries()].sort((a,b)=>a[0]-b[0]);
}

function render(filterText=""){
  const grid = document.getElementById("grid");
  grid.innerHTML = "";

  document.getElementById("titulo").textContent =
    `Malla Interactiva — ${data.carrera}`;

  const lower = filterText.trim().toLowerCase();
  const cursos = lower
    ? data.cursos.filter(c =>
        c.nombre.toLowerCase().includes(lower) ||
        c.id.toLowerCase().includes(lower)
      )
    : data.cursos.slice();

  const bySem = groupBySemester(cursos);

  for(const [sem, lista] of bySem){
    const col = document.createElement("section");
    col.className = "semester";
    col.innerHTML = `<h2>Semestre ${sem}</h2>`;

    lista.sort((a,b)=>a.nombre.localeCompare(b.nombre, "es"));

    for(const curso of lista){
      const div = document.createElement("div");
      const locked = isLocked(curso.id);

      div.className = [
        "course",
        (curso.categoria || "core"),
        locked ? "locked" : "",
        isDone(curso.id) ? "done" : "",
        unlockedNow.has(curso.id) ? "unlocked-now" : ""
      ].join(" ").trim();

      const reqs = (curso.prerrequisitos || []);
      const reqText = reqs.length ? reqs.join(", ") : "—";

      div.innerHTML = `
        <div class="name">${curso.nombre}</div>
        <div class="meta">
          <div><b>ID:</b> ${curso.id}</div>
          <div><b>Créditos:</b> ${curso.creditos ?? "-"}</div>
          <div><b>Prerrequisitos:</b> ${reqText}</div>
          ${locked ? `<div style="margin-top:6px; opacity:.85"><b>Bloqueado</b>: falta aprobar prerrequisitos.</div>` : ""}
        </div>
      `;

      div.addEventListener("click", () => {
        if(locked) return;
        toggleDone(curso.id);
        render(document.getElementById("buscador").value);
      });

      col.appendChild(div);
    }

    grid.appendChild(col);
  }
}

async function init(){
  loadState();
  const res = await fetch("malla.json");
  data = await res.json();

  const buscador = document.getElementById("buscador");
  buscador.addEventListener("input", () => render(buscador.value));

  document.getElementById("reset").addEventListener("click", () => {
    aprobados = new Set();
    unlockedNow = new Set();
    saveState();
    render(buscador.value);
  });

  render();
}

init();
