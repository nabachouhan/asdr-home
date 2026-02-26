// **********=>catalogsrc.js=>catalogRender.js
//*************catalog page handle starts*******************
let currentPage = 1;
const itemsPerPage = 9;

function renderDatasets(data) {
  const grid = document.getElementById("datasetGrid");
  grid.innerHTML = "";
  const start = (currentPage - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  const paginated = data.slice(start, end);

  paginated.forEach((dataset) => {
    const col = document.createElement("div");
    col.className = "col-md-4 mb-3";
    col.innerHTML = `
      <div class="card">
        <img src="${dataset.img}" class="card-img-top" alt="${dataset.title}">
        <div class="card-body">
          <h5  class="card-title">${dataset.title}</h5>
          <p class="card-text">Category: ${dataset.category}</p>
          <p class="card-text">Date: ${dataset.date}</p>
          <a href="#" class="btn btn-success" onclick="viewInGeoportal()">View in Geoportal</a>
        </div>
      </div>`;
    grid.appendChild(col);
  });
  renderPagination(data.length);
}

function renderPagination(totalItems) {
  const pagination = document.getElementById("pagination");
  pagination.innerHTML = "";
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const maxAdjacents = 2;

  const createPageItem = (page, text = page, isActive = false) => {
    return `<li class="page-item ${isActive ? "active" : ""}">
          <a class="page-link" href="#" onclick="changePage(${page})">${text}</a>
        </li>`;
  };

  if (currentPage > 1) {
    pagination.innerHTML += createPageItem(currentPage - 1, "Previous");
  }

  // Always show first page
  if (currentPage > maxAdjacents + 2) {
    pagination.innerHTML += createPageItem(1);
    pagination.innerHTML += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
  }

  // Show range of pages around current
  const startPage = Math.max(1, currentPage - maxAdjacents);
  const endPage = Math.min(totalPages, currentPage + maxAdjacents);

  for (let i = startPage; i <= endPage; i++) {
    pagination.innerHTML += createPageItem(i, i, i === currentPage);
  }

  // Always show last page
  if (currentPage < totalPages - maxAdjacents - 1) {
    pagination.innerHTML += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
    pagination.innerHTML += createPageItem(totalPages);
  }

  if (currentPage < totalPages) {
    pagination.innerHTML += createPageItem(currentPage + 1, "Next");
  }
}

function changePage(page) {
  currentPage = page;
  applyFilters();
}

function applyFilters() {
  let filtered = [...datasets];
  const search = document.getElementById("search").value.toLowerCase();
  const sort = document.getElementById("sort").value;
  const order = document.getElementById("order").value;
  const theme =
    document.querySelector("#themes .active")?.dataset.value || "all";
  const year = document.querySelector("#years .active")?.dataset.value || "all";
  const tag = document.querySelector("#tags .active")?.dataset.value || "all";
  const dateFrom = document.getElementById("date-from").value;
  const dateTo = document.getElementById("date-to").value;

  if (search)
    filtered = filtered.filter((d) => d.title.toLowerCase().includes(search));
  if (theme !== "all") filtered = filtered.filter((d) => d.category === theme);
  if (year !== "all")
    filtered = filtered.filter(
      (d) => new Date(d.date).getFullYear().toString() === year
    );
  if (tag !== "all") filtered = filtered.filter((d) => d.tag === tag);
  if (dateFrom && dateTo)
    filtered = filtered.filter(
      (d) =>
        new Date(d.date) >= new Date(dateFrom) &&
        new Date(d.date) <= new Date(dateTo)
    );
  if (sort === "date")
    filtered.sort((a, b) =>
      order === "desc"
        ? new Date(b.date) - new Date(a.date)
        : new Date(a.date) - new Date(b.date)
    );

  renderDatasets(filtered);
}

function resetFilters() {
  document.getElementById("search").value = "";
  document.getElementById("sort").value = "date";
  document.getElementById("order").value = "desc";
  document.getElementById("date-from").value = "";
  document.getElementById("date-to").value = "";
  document
    .querySelectorAll(".list-group-item")
    .forEach((el) => el.classList.remove("active"));
  document
    .querySelectorAll('[data-value="all"]')
    .forEach((el) => el.classList.add("active"));
  renderDatasets(datasets);
}

function viewInGeoportal() {
  alert("Redirecting to Geoportal...");
}

document.querySelectorAll(".list-group-item").forEach((item) => {
  item.addEventListener("click", function (e) {
    e.preventDefault();
    const group = this.parentElement;
    group
      .querySelectorAll(".list-group-item")
      .forEach((i) => i.classList.remove("active"));
    this.classList.add("active");
    applyFilters();
  });
});

function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("d-none");
}

function toggleMode() {
  document.body.classList.toggle("dark-mode");
  const btn = document.getElementById("modeToggle");
  btn.textContent = document.body.classList.contains("dark-mode")
    ? "Light Mode"
    : "Dark Mode";
}

renderDatasets(datasets);

//*************catalog page handle starts*******************
