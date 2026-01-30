const STORAGE_KEY = "malla_progreso_v1";

const ESTADOS = ["pendiente", "cursando", "aprobado"]; // clic va rotando

let data = null;
let progreso = {}; // { "MAT101": "aprobado", ... }
let selectedCourseId = null;

function loadProgreso(){
  try{
    progreso = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  }catch{
    progreso = {};
  }
}

function saveProgreso(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progreso));
}

function estadoDe(id){
  return progreso[id] || "pendiente";
}

function cumplePrereqs(curso){
  const reqs = curso.prerrequisitos || [];
  return reqs.every(r => estadoDe(r) === "aprobado");
}

function esBloqueado(curso){
  // Se considera bloqueado si NO cumple prerequisitos (cuando tiene prereqs)
  const reqs = curso.prerrequisitos || [];
  if(reqs.length === 0) return false;
  return !cumplePrereqs(curso);
}

function rotarEstado(id){
  const actual = estadoDe(id);
  const idx = ESTADOS.indexOf(actual);
  const next = ESTADOS[(idx + 1) % ESTADOS.length];
  progreso[id] = next;
  saveProgreso();
}

function groupBySemester(cursos){
  const map = new Map();
  for(const c of cursos){
    if(!map.has(c.semestre)) map.set(c.semestre, []);
    map.get(c.semestre).push(c);
  }
  // ordenar por semestre
  return [...map.entries()].sort((a,b)=>a[0]-b[0]);
}

function render(filterText=""){
  const grid = document.getElementById("grid");
  grid.innerHTML = "";

  document.getElementById("titulo").textContent =
    `Malla Interactiva - ${data.carrera}`;

  const cursos = data.cursos.slice();

  const lower = filterText.trim().toLowerCase();
  const cursosFiltrados = lower
    ? cursos.filter(c =>
        c.id.toLowerCase().includes(lower) ||
        c.nombre.toLowerCase().includes(lower)
      )
    : cursos;

  const bySem = groupBySemester(cursosFiltrados);

  for(const [semestre, lista] of bySem){
    const col = document.createElement("section");
    col.className = "semester";
    col.innerHTML = `<h2>Semestre ${semestre}</h2>`;

    // ordenar por id para consistencia
    lista.sort((a,b)=>a.id.localeCompare(b.id));

    for(const curso of lista){
      const div = document.createElement("div");
      const estado = estadoDe(curso.id);
      const bloqueado = esBloqueado(curso);

      div.className = `course ${estado} ${bloqueado ? "bloqueado" : ""}`;

      if(selectedCourseId === curso.id) div.classList.add("highlight-selected");

      // resaltar prerequisitos del seleccionado
      if(selectedCourseId){
        const sel = data.cursos.find(x => x.id === selectedCourseId);
        if(sel && (sel.prerrequisitos || []).includes(curso.id)){
          div.classList.add("highlight-prereq");
        }
      }

      const reqs = (curso.prerrequisitos || []);
      div.innerHTML = `
        <div class="code">${curso.id}</div>
        <div class="name">${curso.nombre}</div>
        <div class="meta">
          Créditos: ${curso.creditos ?? "-"}<br/>
          Prerrequisitos: ${reqs.length ? reqs.join(", ") : "—"}<br/>
          <span style="opacity:.8">Tip: Shift + Click para ver prerrequisitos</span>
        </div>
      `;

      div.addEventListener("click", (e) => {
        // Shift+Click: seleccionar para ver prerequisitos
        if(e.shiftKey){
          selectedCourseId = (selectedCourseId === curso.id) ? null : curso.id;
          render(document.getElementById("buscador").value);
          return;
        }

        // Click normal: cambiar estado
        if(bloqueado){
          selectedCourseId = curso.id; // al menos selecciona para mostrar prereqs
          render(document.getElementById("buscador").value);
          return;
        }
        rotarEstado(curso.id);
        render(document.getElementById("buscador").value);
      });

      col.appendChild(div);
    }

    grid.appendChild(col);
  }
}

async function init(){
  loadProgreso();
  const res = await fetch("malla.json");
  data = await res.json();

  // UI
  const buscador = document.getElementById("buscador");
  buscador.addEventListener("input", () => render(buscador.value));

  document.getElementById("reset").addEventListener("click", () => {
    progreso = {};
    saveProgreso();
    selectedCourseId = null;
    render(buscador.value);
  });

  render();
}

init();
