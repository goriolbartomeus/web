// GORIOL · Conexión con la API
// En local, la web utiliza el backend FastAPI de este ordenador.
// En producción habrá que configurar aquí la URL del backend desplegado.
const API_BASE = ["localhost", "127.0.0.1"].includes(window.location.hostname)
  ? "http://127.0.0.1:8000"
  : "";

const pageNames = {
  dashboard: "Dashboard",
  biblioteca: "Biblioteca",
  modulo: "Módulo",
  asistente: "Asistente IA",
  configuracion: "Configuración"
};

let modules = [];
let learningOutcomes = [];
let documents = [];
let toastTimer;
let activeLearningOutcome = null;

const $ = (selector, root = document) => root.querySelector(selector);
const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));

function toast(message) {
  const el = $("#toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
}

async function api(path, options = {}) {
  if (!API_BASE) {
    throw new Error("El backend todavía no está configurado para la web pública. Para probarlo, abre GORIOL desde localhost.");
  }
  const response = await fetch(API_BASE + path, options);
  if (!response.ok) {
    let detail = "";
    try {
      const data = await response.json();
      detail = data.detail || JSON.stringify(data);
    } catch {
      detail = await response.text();
    }
    throw new Error(detail || `Error HTTP ${response.status}`);
  }
  return response;
}

async function loadData() {
  if (!API_BASE) {
    showConnectionMessage("Para cargar tus datos, abre la web en local mientras el backend FastAPI esté encendido.");
    return;
  }
  try {
    const [moduleResponse, raResponse, documentResponse] = await Promise.all([
      api("/modules"),
      api("/learning-outcomes"),
      api("/documents")
    ]);
    const [moduleData, raData, documentData] = await Promise.all([
      moduleResponse.json(), raResponse.json(), documentResponse.json()
    ]);
    modules = moduleData.modules || [];
    learningOutcomes = raData.learning_outcomes || [];
    documents = documentData.documents || [];
    renderAll();
  } catch (error) {
    console.error("GORIOL API:", error);
    showConnectionMessage("No se ha podido conectar con el backend. Comprueba que Uvicorn esté funcionando en el puerto 8000.");
    toast("No se ha podido conectar con GORIOL API.");
  }
}

function showConnectionMessage(message) {
  const library = $("#library-list");
  if (library) library.innerHTML = `<div class="empty-search">${escapeHTML(message)}</div>`;
  const grid = $(".module-grid");
  if (grid) grid.innerHTML = `<div class="empty-search">${escapeHTML(message)}</div>`;
}

function getModuleRas(moduleId) {
  return learningOutcomes.filter(ra => ra.module_id === moduleId);
}

function getRaDocuments(raId) {
  return documents.filter(doc => doc.learning_outcome_id === raId);
}

function moduleDocumentCount(moduleId) {
  const raIds = getModuleRas(moduleId).map(ra => ra.id);
  return documents.filter(doc => raIds.includes(doc.learning_outcome_id)).length;
}

function renderAll() {
  renderSidebar();
  renderStats();
  renderDashboard();
  renderLibrary();
  updateScopeSelect();
}

function renderSidebar() {
  const nav = $("#module-nav");
  if (nav) {
    nav.innerHTML = modules.map((module, index) => `
      <a href="#modulo-${encodeURIComponent(module.code)}" class="module-link" data-module-id="${escapeHTML(module.id)}">
        <span class="module-dot ${["purple","blue","green","orange"][index % 4]}"></span>
        <span>${escapeHTML(module.code)} · ${escapeHTML(module.name)}</span>
      </a>`).join("") || '<div class="empty-search">Todavía no hay módulos.</div>';
  }
  const count = $(".nav-count");
  if (count) count.textContent = String(documents.length);
}

function renderStats() {
  const values = $$(".stats-grid .stat-value");
  if (values[0]) values[0].textContent = String(modules.length).padStart(2, "0");
  if (values[1]) values[1].textContent = String(documents.length).padStart(2, "0");
  if (values[2]) values[2].textContent = String(learningOutcomes.length).padStart(2, "0");
}

function renderDashboard() {
  const grid = $(".module-grid");
  if (grid) {
    grid.innerHTML = modules.map((module, index) => {
      const ras = getModuleRas(module.id);
      const docs = moduleDocumentCount(module.id);
      const colors = ["purple", "blue", "green", "orange"];
      return `
        <article class="module-card" data-open-module-id="${escapeHTML(module.id)}">
          <div class="module-card-top"><span class="module-symbol ${colors[index % 4]}">▦</span><span class="module-code">${escapeHTML(module.code)}</span></div>
          <h3>${escapeHTML(module.name)}</h3>
          <p>${escapeHTML(module.description || "Organiza tus materiales y resultados de aprendizaje.")}</p>
          <div class="module-meta"><span>${ras.length} apartados</span><span>${docs} documentos</span></div>
          <div class="progress-track"><span style="width:0%"></span></div>
          <div class="progress-caption"><span>Progreso de estudio</span><strong>Por empezar</strong></div>
        </article>`;
    }).join("") || '<div class="empty-search">Crea tu primer módulo para empezar a organizar tus apuntes.</div>';
  }

  const recent = $(".recent-panel");
  if (recent) {
    const heading = recent.querySelector(".panel-heading");
    const latest = [...documents].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);
    recent.innerHTML = "";
    if (heading) recent.append(heading);
    if (!latest.length) {
      const empty = document.createElement("div");
      empty.className = "empty-search";
      empty.textContent = "Todavía no has subido documentos.";
      recent.append(empty);
    } else {
      latest.forEach(doc => {
        const ra = learningOutcomes.find(item => item.id === doc.learning_outcome_id);
        const module = ra ? modules.find(item => item.id === ra.module_id) : null;
        const button = document.createElement("button");
        button.className = "recent-item";
        button.dataset.openRaId = ra?.id || "";
        button.innerHTML = `
          <span class="file-icon ${fileExtension(doc.original_filename) === "pdf" ? "pdf" : "doc"}">${escapeHTML(fileExtension(doc.original_filename).toUpperCase().slice(0, 3))}</span>
          <span class="recent-copy"><strong>${escapeHTML(doc.original_filename || doc.name)}</strong><small>${escapeHTML(module ? module.code + " · " + module.name : "Documento")}${ra ? " · " + escapeHTML(ra.code) : ""}</small></span>
          <span class="recent-date">${formatDate(doc.created_at)}</span><span class="row-arrow">→</span>`;
        recent.append(button);
      });
    }
  }
}

function renderLibrary() {
  const list = $("#library-list");
  if (!list) return;
  $(".demo-notice")?.remove();
  if (!modules.length) {
    list.innerHTML = '<div class="empty-search">Todavía no hay módulos en tu biblioteca.</div>';
    return;
  }
  list.innerHTML = modules.map((module, index) => {
    const ras = getModuleRas(module.id);
    const docs = moduleDocumentCount(module.id);
    const color = ["purple", "blue", "green", "orange"][index % 4];
    return `
      <article class="library-module">
        <button class="library-module-head" aria-expanded="true">
          <span class="module-symbol ${color}">▦</span>
          <span class="library-module-title"><strong>${escapeHTML(module.code)} · ${escapeHTML(module.name)}</strong><small>${ras.length} apartados · ${docs} documentos</small></span>
          <span class="module-progress-mini">—</span><span class="chevron">⌄</span>
        </button>
        <div class="library-module-actions">
          <button type="button" class="goriol-small-button" data-edit-module="${escapeHTML(module.id)}">Editar módulo</button>
          <button type="button" class="goriol-small-button danger" data-delete-module="${escapeHTML(module.id)}">Eliminar módulo</button>
        </div>
        <div class="ra-list">
          ${ras.length ? ras.map(ra => {
            const raDocs = getRaDocuments(ra.id);
            return `<div class="ra-row">
              <span class="ra-code">${escapeHTML(ra.code)}</span>
              <span class="ra-title">${escapeHTML(ra.title)}</span>
              <span class="doc-count">${raDocs.length} docs</span>
              <button type="button" class="goriol-small-button" data-edit-ra="${escapeHTML(ra.id)}">Editar</button>
              <button type="button" class="goriol-small-button danger" data-delete-ra="${escapeHTML(ra.id)}">Eliminar</button>
              <button class="ra-open" data-open-ra-id="${escapeHTML(ra.id)}">Abrir →</button>
            </div>`;
          }).join("") : '<div class="empty-search">Este módulo todavía no tiene resultados de aprendizaje.</div>'}
        </div>
      </article>`;
  }).join("");
  bindLibrarySearch();
}

function bindLibrarySearch() {
  const input = $("#library-search");
  if (!input || input.dataset.bound) return;
  input.dataset.bound = "true";
  input.addEventListener("input", () => {
    const query = input.value.toLocaleLowerCase("es");
    let visible = 0;
    $$(".library-module").forEach(card => {
      const match = card.textContent.toLocaleLowerCase("es").includes(query);
      card.style.display = match ? "" : "none";
      if (match) visible++;
    });
    let empty = $(".library-list .empty-search");
    if (!visible && !empty) {
      empty = document.createElement("div");
      empty.className = "empty-search";
      empty.textContent = "No se han encontrado resultados.";
      $("#library-list").append(empty);
    } else if (visible && empty && empty.parentElement === $("#library-list")) {
      empty.remove();
    }
  });
}

function updateScopeSelect() {
  const select = $("#scope-module");
  if (!select) return;
  select.innerHTML = modules.map(module => `<option value="${escapeHTML(module.id)}">${escapeHTML(module.code)} · ${escapeHTML(module.name)}</option>`).join("");
}

function openModule(moduleId) {
  const module = modules.find(item => item.id === moduleId);
  if (!module) return;
  const ras = getModuleRas(module.id);
  $("#detail-code").textContent = module.code + " · MÓDULO";
  $("#detail-title").textContent = module.name;
  $("#detail-description").textContent = module.description || "Organiza tus materiales por resultados de aprendizaje.";
  $("#detail-ra-count").textContent = String(ras.length);
  $("#detail-doc-count").textContent = String(moduleDocumentCount(module.id));
  $("#detail-progress").textContent = "—";
  $("#detail-ra-list").innerHTML = `
    <div class="detail-ra-toolbar">
      <button type="button" class="button button-primary" data-create-ra="${escapeHTML(module.id)}">＋ Añadir resultado de aprendizaje</button>
    </div>
    ${ras.length ? ras.map(ra => `
      <article class="detail-ra-card">
        <span class="ra-code">${escapeHTML(ra.code)}</span>
        <div><strong>${escapeHTML(ra.title)}</strong><p>${escapeHTML(ra.description || "Sin descripción")} · ${getRaDocuments(ra.id).length} documentos</p></div>
        <div class="ra-management-actions">
          <button type="button" class="goriol-small-button" data-edit-ra="${escapeHTML(ra.id)}">Editar</button>
          <button type="button" class="goriol-small-button danger" data-delete-ra="${escapeHTML(ra.id)}">Eliminar</button>
          <button type="button" class="goriol-small-button" data-open-ra-id="${escapeHTML(ra.id)}">Ver apartado →</button>
        </div>
      </article>`).join("") : '<div class="empty-search">Este módulo todavía no tiene resultados de aprendizaje.</div>'}`;
  navigate("modulo");
}

function openRa(raId) {
  const ra = learningOutcomes.find(item => item.id === raId);
  if (!ra) return;
  activeLearningOutcome = ra;
  const module = modules.find(item => item.id === ra.module_id);
  const docs = getRaDocuments(ra.id);
  showModal(`${ra.code} · ${ra.title}`, `
    <p class="goriol-modal-subtitle">${escapeHTML(module ? module.code + " · " + module.name : "")}</p>
    <p class="goriol-ra-description">${escapeHTML(ra.description || "Este resultado de aprendizaje no tiene descripción.")}</p>
    <div class="goriol-doc-list">
      ${docs.length ? docs.map(doc => documentRow(doc)).join("") : '<div class="empty-search">Todavía no hay documentos en este apartado.</div>'}
    </div>
    <form id="ra-upload-form" class="goriol-upload-form">
      <label for="ra-file">Añadir un documento</label>
      <input id="ra-file" name="file" type="file" accept=".pdf,.txt,.docx,.pptx" required>
      <small>PDF, TXT, DOCX o PPTX · máximo 50 MB</small>
      <button class="button button-primary" type="submit">Subir documento</button>
    </form>`);
  bindModalActions();
}

function documentRow(doc) {
  const filename = doc.original_filename || doc.name || "Documento";
  return `
    <div class="goriol-doc-row">
      <span class="file-icon ${fileExtension(filename) === "pdf" ? "pdf" : "doc"}">${escapeHTML(fileExtension(filename).toUpperCase().slice(0, 3))}</span>
      <span class="goriol-doc-name"><strong>${escapeHTML(filename)}</strong><small>${formatBytes(doc.file_size)} · ${formatDate(doc.created_at)}</small></span>
      <button type="button" class="goriol-small-button" data-download-doc="${escapeHTML(doc.id)}">Descargar</button>
      <button type="button" class="goriol-small-button danger" data-delete-doc="${escapeHTML(doc.id)}">Eliminar</button>
    </div>`;
}

function ensureModal() {
  if ($("#goriol-modal")) return;
  const style = document.createElement("style");
  style.textContent = `
    .goriol-modal-backdrop{position:fixed;inset:0;background:#05060bc9;z-index:50;display:grid;place-items:center;padding:18px}
    .goriol-modal-backdrop[hidden]{display:none}
    .goriol-modal{width:min(620px,100%);max-height:90vh;overflow:auto;background:#151824;border:1px solid #34394b;border-radius:15px;padding:22px;box-shadow:0 25px 90px #0009}
    .goriol-modal-head{display:flex;justify-content:space-between;align-items:flex-start;gap:15px;margin-bottom:12px}
    .goriol-modal-head h2{font:650 18px Manrope;margin:0;color:#f1f0fa}
    .goriol-modal-close{border:0;background:#25293a;color:#c9cce0;border-radius:7px;width:30px;height:30px;font-size:18px}
    .goriol-modal-subtitle,.goriol-ra-description{font-size:10px;color:#969db2;margin:0 0 10px}
    .goriol-doc-list{display:grid;gap:7px;margin:17px 0}
    .goriol-doc-row{display:flex;align-items:center;gap:9px;padding:10px;background:#1b1f2d;border:1px solid #2b3041;border-radius:8px}
    .goriol-doc-name{display:grid;gap:3px;min-width:0;flex:1}.goriol-doc-name strong{font-size:10px;overflow-wrap:anywhere}.goriol-doc-name small{font-size:8px;color:#858da4}
    .goriol-small-button{border:1px solid #44405f;background:#252239;color:#c8bcff;border-radius:6px;padding:7px 8px;font-size:9px;white-space:nowrap}
    .goriol-small-button.danger{border-color:#59333c;background:#321f29;color:#ffabb3}
    .goriol-upload-form{display:grid;gap:9px;padding-top:15px;border-top:1px solid #303548}
    .goriol-upload-form label{font-size:11px;font-weight:600}.goriol-upload-form input[type=file]{font-size:10px;color:#c6cada}.goriol-upload-form small{font-size:8px;color:#858da4}.goriol-upload-form .button{justify-self:start}
    .goriol-form-field{display:grid;gap:7px;margin:13px 0}.goriol-form-field label{font-size:10px;color:#c7cada}.goriol-form-field input,.goriol-form-field select{background:#1b1f2d;border:1px solid #3a4053;border-radius:7px;padding:10px;color:#f0eff8;font:inherit}
    .goriol-modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:15px}
    .library-module-actions{display:flex;justify-content:flex-end;gap:7px;padding:0 14px 10px;background:#151824}
    .library-module-actions .goriol-small-button{cursor:pointer}
    .goriol-form-field textarea{background:#1b1f2d;border:1px solid #3a4053;border-radius:7px;padding:10px;color:#f0eff8;font:inherit;min-height:76px;resize:vertical}
    .detail-ra-toolbar{display:flex;justify-content:flex-end;margin:0 0 14px}
    .ra-management-actions{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-left:auto}
    .ra-management-actions button{cursor:pointer}
    .detail-ra-card{display:flex;align-items:center;gap:12px;flex-wrap:wrap}


    @media(max-width:520px){.goriol-doc-row{flex-wrap:wrap}.goriol-doc-name{min-width:calc(100% - 55px)}}
  `;
  document.head.append(style);
  const backdrop = document.createElement("div");
  backdrop.id = "goriol-modal";
  backdrop.className = "goriol-modal-backdrop";
  backdrop.hidden = true;
  backdrop.innerHTML = '<section class="goriol-modal" role="dialog" aria-modal="true" aria-labelledby="goriol-modal-title"><div class="goriol-modal-head"><h2 id="goriol-modal-title"></h2><button class="goriol-modal-close" type="button" aria-label="Cerrar">×</button></div><div class="goriol-modal-body"></div></section>';
  document.body.append(backdrop);
  backdrop.addEventListener("click", event => {
    if (event.target === backdrop || event.target.closest(".goriol-modal-close")) closeModal();
  });
}

function showModal(title, body) {
  ensureModal();
  $("#goriol-modal-title").textContent = title;
  $(".goriol-modal-body").innerHTML = body;
  $("#goriol-modal").hidden = false;
}

function closeModal() {
  const modal = $("#goriol-modal");
  if (modal) modal.hidden = true;
}

function bindModalActions() {
  const form = $("#ra-upload-form");
  if (form) form.addEventListener("submit", uploadForActiveRa);
  $$("[data-download-doc]").forEach(button => button.addEventListener("click", () => downloadDocument(button.dataset.downloadDoc)));
  $$("[data-delete-doc]").forEach(button => button.addEventListener("click", () => deleteDocument(button.dataset.deleteDoc)));
}

async function uploadForActiveRa(event) {
  event.preventDefault();
  if (!activeLearningOutcome) return;
  const file = $("#ra-file").files[0];
  if (!file) return;
  if (file.size > 50 * 1024 * 1024) {
    toast("El archivo supera el límite de 50 MB.");
    return;
  }
  const formData = new FormData();
  formData.append("learning_outcome_id", activeLearningOutcome.id);
  formData.append("file", file);
  const submit = event.currentTarget.querySelector('button[type="submit"]');
  submit.disabled = true;
  submit.textContent = "Subiendo…";
  try {
    await api("/documents/upload", { method: "POST", body: formData });
    await refreshDocuments();
    toast("Documento subido correctamente.");
    openRa(activeLearningOutcome.id);
  } catch (error) {
    toast("No se ha podido subir: " + error.message);
    submit.disabled = false;
    submit.textContent = "Subir documento";
  }
}

async function refreshDocuments() {
  const response = await api("/documents");
  const data = await response.json();
  documents = data.documents || [];
  renderAll();
}

async function downloadDocument(documentId) {
  try {
    const response = await api("/documents/" + encodeURIComponent(documentId) + "/download");
    const type = response.headers.get("content-type") || "";
    if (type.includes("application/json")) {
      const data = await response.json();
      const url = data.download_url || data.signed_url || data.url;
      if (!url) throw new Error("La API no ha devuelto un enlace de descarga.");
      window.open(url, "_blank", "noopener");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const doc = documents.find(item => item.id === documentId);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = doc?.original_filename || doc?.name || "documento";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    toast("No se ha podido descargar: " + error.message);
  }
}

async function deleteDocument(documentId) {
  const doc = documents.find(item => item.id === documentId);
  if (!doc || !window.confirm(`¿Seguro que quieres eliminar "${doc.original_filename || doc.name}"? Esta acción no se puede deshacer.`)) return;
  try {
    await api("/documents/" + encodeURIComponent(documentId), { method: "DELETE" });
    await refreshDocuments();
    toast("Documento eliminado.");
    if (activeLearningOutcome) openRa(activeLearningOutcome.id);
  } catch (error) {
    toast("No se ha podido eliminar: " + error.message);
  }
}

function showModuleForm(moduleId = null) {
  const module = moduleId ? modules.find(item => item.id === moduleId) : null;
  const editing = Boolean(module);
  showModal(editing ? "Editar módulo" : "Crear módulo", `
    <form id="module-form">
      <div class="goriol-form-field">
        <label for="module-code">Código</label>
        <input id="module-code" name="code" maxlength="30" required placeholder="Ej. M01" value="${escapeHTML(module?.code || "")}">
      </div>
      <div class="goriol-form-field">
        <label for="module-name">Nombre</label>
        <input id="module-name" name="name" maxlength="150" required placeholder="Nombre del módulo" value="${escapeHTML(module?.name || "")}">
      </div>
      <div class="goriol-form-field">
        <label for="module-description">Descripción</label>
        <textarea id="module-description" name="description" maxlength="1000" placeholder="Descripción (opcional)">${escapeHTML(module?.description || "")}</textarea>
      </div>
      <div class="goriol-modal-actions">
        <button type="button" class="goriol-small-button" data-close-module-form>Cancelar</button>
        <button type="submit" class="button button-primary">${editing ? "Guardar cambios" : "Crear módulo"}</button>
      </div>
    </form>`);
  $("#module-form").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const payload = {
      code: form.elements.code.value.trim(),
      name: form.elements.name.value.trim(),
      description: form.elements.description.value.trim() || null
    };
    if (!payload.code || !payload.name) return toast("El código y el nombre son obligatorios.");
    button.disabled = true;
    button.textContent = "Guardando…";
    try {
      await api(editing ? "/modules/" + encodeURIComponent(module.id) : "/modules", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      await refreshModulesAndStructure();
      closeModal();
      toast(editing ? "Módulo actualizado." : "Módulo creado correctamente.");
    } catch (error) {
      toast("No se ha podido guardar el módulo: " + error.message);
      button.disabled = false;
      button.textContent = editing ? "Guardar cambios" : "Crear módulo";
    }
  });
}

async function refreshModulesAndStructure() {
  const [moduleResponse, raResponse, documentResponse] = await Promise.all([
    api("/modules"), api("/learning-outcomes"), api("/documents")
  ]);
  const [moduleData, raData, documentData] = await Promise.all([
    moduleResponse.json(), raResponse.json(), documentResponse.json()
  ]);
  modules = moduleData.modules || [];
  learningOutcomes = raData.learning_outcomes || [];
  documents = documentData.documents || [];
  renderAll();
}

function showRaForm(moduleId, raId = null) {
  const module = modules.find(item => item.id === moduleId);
  const ra = raId ? learningOutcomes.find(item => item.id === raId) : null;
  if (!module || (raId && !ra)) return;
  const editing = Boolean(ra);
  showModal(editing ? "Editar resultado de aprendizaje" : "Añadir resultado de aprendizaje", `
    <form id="ra-management-form">
      <div class="goriol-form-field">
        <label for="ra-management-code">Código</label>
        <input id="ra-management-code" name="code" maxlength="30" required placeholder="Ej. RA1" value="${escapeHTML(ra?.code || "")}">
      </div>
      <div class="goriol-form-field">
        <label for="ra-management-title">Título</label>
        <input id="ra-management-title" name="title" maxlength="200" required placeholder="Título del resultado" value="${escapeHTML(ra?.title || "")}">
      </div>
      <div class="goriol-form-field">
        <label for="ra-management-description">Descripción</label>
        <textarea id="ra-management-description" name="description" maxlength="2000" placeholder="Descripción (opcional)">${escapeHTML(ra?.description || "")}</textarea>
      </div>
      <div class="goriol-modal-actions">
        <button type="button" class="goriol-small-button" data-close-module-form>Cancelar</button>
        <button type="submit" class="button button-primary">${editing ? "Guardar cambios" : "Crear RA"}</button>
      </div>
    </form>`);
  $("#ra-management-form").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const payload = {
      code: form.elements.code.value.trim(),
      title: form.elements.title.value.trim(),
      description: form.elements.description.value.trim() || null
    };
    if (!payload.code || !payload.title) return toast("El código y el título son obligatorios.");
    if (!editing) payload.module_id = moduleId;
    button.disabled = true;
    button.textContent = "Guardando…";
    try {
      await api(editing ? "/learning-outcomes/" + encodeURIComponent(ra.id) : "/learning-outcomes", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      await refreshModulesAndStructure();
      closeModal();
      openModule(moduleId);
      toast(editing ? "Resultado de aprendizaje actualizado." : "Resultado de aprendizaje creado.");
    } catch (error) {
      toast("No se ha podido guardar el RA: " + error.message);
      button.disabled = false;
      button.textContent = editing ? "Guardar cambios" : "Crear RA";
    }
  });
}

async function removeRa(raId) {
  const ra = learningOutcomes.find(item => item.id === raId);
  if (!ra) return;
  const count = getRaDocuments(raId).length;
  const warning = count ? ` Tiene ${count} documentos asociados; la API podría impedir el borrado mientras existan.` : "";
  if (!window.confirm(`¿Seguro que quieres eliminar ${ra.code} · ${ra.title}?${warning} Esta acción no se puede deshacer.`)) return;
  const moduleId = ra.module_id;
  try {
    await api("/learning-outcomes/" + encodeURIComponent(raId), { method: "DELETE" });
    await refreshModulesAndStructure();
    if (modules.some(item => item.id === moduleId)) openModule(moduleId);
    toast("Resultado de aprendizaje eliminado.");
  } catch (error) {
    toast("No se ha podido eliminar el RA: " + error.message);
  }
}

async function removeModule(moduleId) {
  const module = modules.find(item => item.id === moduleId);
  if (!module) return;
  const raCount = getModuleRas(moduleId).length;
  const docCount = moduleDocumentCount(moduleId);
  const warning = raCount || docCount
    ? ` Este módulo contiene ${raCount} RA y ${docCount} documentos asociados. Si la API no permite eliminarlo por sus relaciones, no se borrará nada.`
    : "";
  if (!window.confirm(`¿Seguro que quieres eliminar el módulo "${module.code} · ${module.name}"?${warning} Esta acción no se puede deshacer.`)) return;
  try {
    await api("/modules/" + encodeURIComponent(moduleId), { method: "DELETE" });
    await refreshModulesAndStructure();
    toast("Módulo eliminado.");
    navigate("biblioteca");
  } catch (error) {
    toast("No se ha podido eliminar el módulo: " + error.message);
  }
}

function showUploadPicker() {
  if (!learningOutcomes.length) {
    toast("Primero necesitas crear un resultado de aprendizaje.");
    return;
  }
  showModal("Añadir documento", `
    <form id="general-upload-form" class="goriol-upload-form">
      <div class="goriol-form-field"><label for="upload-ra">Resultado de aprendizaje</label><select id="upload-ra" required>${learningOutcomes.map(ra => {
        const module = modules.find(item => item.id === ra.module_id);
        return `<option value="${escapeHTML(ra.id)}">${escapeHTML(module?.code || "")} · ${escapeHTML(ra.code)} · ${escapeHTML(ra.title)}</option>`;
      }).join("")}</select></div>
      <div class="goriol-form-field"><label for="general-file">Archivo</label><input id="general-file" type="file" accept=".pdf,.txt,.docx,.pptx" required><small>PDF, TXT, DOCX o PPTX · máximo 50 MB</small></div>
      <div class="goriol-modal-actions"><button class="button button-primary" type="submit">Subir documento</button></div>
    </form>`);
  $("#general-upload-form").addEventListener("submit", async event => {
    event.preventDefault();
    const file = $("#general-file").files[0];
    const raId = $("#upload-ra").value;
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) return toast("El archivo supera el límite de 50 MB.");
    const data = new FormData();
    data.append("learning_outcome_id", raId);
    data.append("file", file);
    const button = event.currentTarget.querySelector("button[type=submit]");
    button.disabled = true;
    button.textContent = "Subiendo…";
    try {
      await api("/documents/upload", { method: "POST", body: data });
      await refreshDocuments();
      closeModal();
      toast("Documento subido correctamente.");
    } catch (error) {
      toast("No se ha podido subir: " + error.message);
      button.disabled = false;
      button.textContent = "Subir documento";
    }
  });
}

function navigate(page) {
  $$(".page").forEach(section => section.classList.toggle("active-page", section.dataset.view === page));
  $$(".nav-link[data-page]").forEach(link => link.classList.toggle("active", link.dataset.page === page));
  const breadcrumb = $("#breadcrumb-current");
  if (breadcrumb) breadcrumb.textContent = pageNames[page] || "Módulo";
  $("#sidebar")?.classList.remove("open");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function fileExtension(filename) {
  return String(filename || "").split(".").pop().toLowerCase();
}
function formatBytes(bytes) {
  if (!bytes) return "Tamaño desconocido";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}
function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" }).format(new Date(value));
}
function $$(selector, root = document) {
  return [...root.querySelectorAll(selector)];
}

// Navegación y eventos delegados: también funcionan con elementos cargados desde la API.
document.addEventListener("click", event => {
  const pageLink = event.target.closest("[data-page]");
  if (pageLink) {
    event.preventDefault();
    navigate(pageLink.dataset.page);
    return;
  }
  const go = event.target.closest("[data-go]");
  if (go) { navigate(go.dataset.go); return; }
  const moduleCard = event.target.closest("[data-open-module-id]");
  if (moduleCard) { openModule(moduleCard.dataset.openModuleId); return; }
  const moduleLink = event.target.closest("[data-module-id]");
  if (moduleLink) { event.preventDefault(); openModule(moduleLink.dataset.moduleId); return; }
  const raButton = event.target.closest("[data-open-ra-id]");
  if (raButton) { openRa(raButton.dataset.openRaId); return; }
  const createRaButton = event.target.closest("[data-create-ra]");
  if (createRaButton) { event.preventDefault(); event.stopPropagation(); showRaForm(createRaButton.dataset.createRa); return; }
  const editRaButton = event.target.closest("[data-edit-ra]");
  if (editRaButton) {
    event.preventDefault(); event.stopPropagation();
    const ra = learningOutcomes.find(item => item.id === editRaButton.dataset.editRa);
    if (ra) showRaForm(ra.module_id, ra.id);
    return;
  }
  const deleteRaButton = event.target.closest("[data-delete-ra]");
  if (deleteRaButton) { event.preventDefault(); event.stopPropagation(); removeRa(deleteRaButton.dataset.deleteRa); return; }
  const editModuleButton = event.target.closest("[data-edit-module]");
  if (editModuleButton) { event.preventDefault(); event.stopPropagation(); showModuleForm(editModuleButton.dataset.editModule); return; }
  const deleteModuleButton = event.target.closest("[data-delete-module]");
  if (deleteModuleButton) { event.preventDefault(); event.stopPropagation(); removeModule(deleteModuleButton.dataset.deleteModule); return; }
  const closeModuleForm = event.target.closest("[data-close-module-form]");
  if (closeModuleForm) { closeModal(); return; }
  const accordion = event.target.closest(".library-module-head");
  if (accordion) {
    const expanded = accordion.getAttribute("aria-expanded") === "true";
    accordion.setAttribute("aria-expanded", String(!expanded));
    accordion.nextElementSibling?.classList.toggle("hidden", expanded);
    return;
  }
});

$("#upload-demo")?.addEventListener("click", showUploadPicker);
$("#add-module")?.addEventListener("click", () => showModuleForm());

$("#filter-all")?.addEventListener("click", () => {
  $$(".library-module").forEach(card => card.style.display = "");
  const search = $("#library-search");
  if (search) search.value = "";
  toast("Mostrando todos tus módulos.");
});
$("#mobile-menu")?.addEventListener("click", () => $("#sidebar")?.classList.toggle("open"));

$$('input[name="scope"]').forEach(radio => radio.addEventListener("change", () => {
  const select = $("#scope-module");
  if (select) select.disabled = radio.value !== "module";
  if (radio.value === "ra") toast("La selección de un RA para el asistente estará disponible más adelante.");
}));

$$(".suggestion").forEach(button => button.addEventListener("click", () => {
  $("#chat-input").value = button.dataset.prompt;
  $("#chat-input").focus();
}));
$("#chat-form")?.addEventListener("submit", event => {
  event.preventDefault();
  const input = $("#chat-input");
  const value = input.value.trim();
  if (!value) return;
  const content = $("#chat-content");
  const userMessage = document.createElement("div");
  userMessage.className = "chat-message user";
  userMessage.textContent = value;
  content.append(userMessage);
  const reply = document.createElement("div");
  reply.className = "chat-message assistant";
  reply.textContent = "El asistente IA todavía no está conectado. Primero estamos preparando tu biblioteca y la gestión de documentos.";
  content.append(reply);
  input.value = "";
  content.scrollTop = content.scrollHeight;
});

const now = new Date();
$("#today-label").textContent = new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "numeric", month: "short" }).format(now);
document.addEventListener("keydown", event => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    navigate("biblioteca");
    $("#library-search")?.focus();
  }
  if (event.key === "Escape") {
    $("#sidebar")?.classList.remove("open");
    closeModal();
  }
});

loadData();
