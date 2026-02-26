let currentPage = 1;
const itemsPerPage = 9;

function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  const main = document.querySelector("main");

  // Toggle sidebar visibility
  sidebar.classList.toggle("d-none");

  // Toggle main column width
  if (main.classList.contains("col-md-9")) {
    main.classList.remove("col-md-9");
    main.classList.add("col-md-12");
  } else {
    main.classList.remove("col-md-12");
    main.classList.add("col-md-9");
  }
}

function getActiveFilter(groupId) {
  const group = document.getElementById(groupId);
  const activeItem = group.querySelector(".list-group-item.active");
  return activeItem ? activeItem.dataset.value : "all";
}

async function applyFilters(page = 1) {
  currentPage = page;
  const filters = {
    theme: getActiveFilter("themes"),
    year: getActiveFilter("years"),
    dateFrom: document.getElementById("date-from").value,
    dateTo: document.getElementById("date-to").value,
    // fileType: getActiveFilter('file-types'),
    scale: getActiveFilter("scales"),
    // tag: getActiveFilter('tags'),
    search: document.getElementById("search").value,
    sort: document.getElementById("sort").value,
    order: document.getElementById("order").value,
    district: document.getElementById("district").value,
    department: document.getElementById("department").value,
    tag: document.getElementById("tag").value,
    page: currentPage,
    limit: itemsPerPage,
  };

  console.log("Applying filters:", filters); // Debug: Log filters

  try {
    const response = await fetch("/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(filters),
    });

    if (!response.ok) {
      throw new Error(
        `HTTP error! Status: ${
          response.status
        }, Message: ${await response.text()}`
      );
    }

    const data = await response.json();
    console.log("Received data:", data); // Debug: Log response data

    updateDatasetGrid(data.items);
    updatePagination(data.total);
  } catch (error) {
    console.error("Fetch error:", error); // Debug: Log error
    Swal.fire("Error", `Failed to fetch data: ${error.message}`, "error");
  }
}

function updateDatasetGrid(items) {
  const grid = document.getElementById("datasetGrid");
  const noResults = document.getElementById("no-results");

  if (items.length === 0) {
    grid.style.display = "none";
    noResults.style.display = "block";
  } else {
    grid.style.display = "flex";
    noResults.style.display = "none";
    grid.innerHTML = items
      .map(
        (item) => `
                        <div class="col-md-3 col-sm-6 mb-4">
                            <div class="card h-100 themed-box shadow rounded">
                                <div id="${
                                  item.file_name
                                }" class="card-map" style="height: 150px;"></div>
                                <div class="card-body themed-box rounded">
                                    <h6 class="card-title">${item.title}</h6>
                                    <p class="mb-1">Theme: <i>${
                                      item.theme
                                    }</i></p>
                                    <p class="mb-1">Scale: <i>${
                                      item.scale
                                    }</i></p>
                                    <p class="mb-1">Date: <i>${new Date(
                                      item.source_date
                                    ).toDateString()}</i></p>
                                    <div class="d-flex justify-content-between">
                                        <a href="#" class="btn btn-success btn-sm action-link" data-file="${
                                          item.file_name
                                        }" data-action="geoportal">View</a>
                                        <a href="#" class="btn btn-outline-success btn-sm action-link" data-file="${
                                          item.file_name
                                        }" data-action="view">Request</a>
                                        <a href="#" class="btn btn-primary btn-sm action-link" data-file="${
                                          item.file_name
                                        }" data-action="metainfo">Metadata</a>
                                        </div>
                                </div>
                            </div>
                        </div>
                `
      )
      .join("");

    // After innerHTML is set, initialize OpenLayers maps
    items.forEach((item) => {
      const targetId = item.file_name;
      const targetDiv = document.getElementById(targetId);

      // Only proceed if the targetDiv exists
      if (targetDiv) {
        // Step 1: Check if spatial_coverage exists before processing
        if (item.spatial_coverage) {
          const coords = item.spatial_coverage
            .replace("POLYGON((", "")
            .replace("))", "")
            .split(",")
            .map((coord) => coord.trim().split(" ").map(Number));

          const longitudes = coords.map((c) => c[0]);
          const latitudes = coords.map((c) => c[1]);

          const extent4326 = [
            Math.min(...longitudes),
            Math.min(...latitudes),
            Math.max(...longitudes),
            Math.max(...latitudes),
          ];

          // Step 2: Transform to EPSG:3857
          const extent3857 = ol.proj.transformExtent(
            extent4326,
            "EPSG:4326",
            "EPSG:3857"
          );

          // Step 3: Create WMS layer
          const wmsLayer = new ol.layer.Tile({
            source: new ol.source.TileWMS({
              url: "/catalog/wms",
              params: {
                LAYERS: item.file_name,
                TILED: true,
                BBOX: "10097025.688358642,2896046.127668757,10175297.205322662,2974317.6446327777",
                WIDTH: 230,
                HEIGHT: 230,
                SRS: "EPSG:3857",
                FORMAT: "image/png",
              },
              serverType: "geoserver",
              transition: 0,
            }),
          });

          // Step 4: Add ESRI Satellite Base Layer
          const esriLayer = new ol.layer.Tile({
            source: new ol.source.XYZ({
              url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
              attributions:
                'Tiles &copy; <a href="https://www.esri.com/">Esri</a>',
            }),
          });

          // Step 5: Create OpenLayers Map with both layers
          const view = new ol.View({
            projection: "EPSG:3857",
          });

          const map = new ol.Map({
            target: targetId,
            layers: [esriLayer, wmsLayer], // Add both layers to the map
            view: view,
          });

          view.fit(extent3857, {
            size: map.getSize(),
            padding: [20, 20, 20, 20],
          });
        } else {
          // Skip the item if spatial_coverage is not available
          console.warn(
            `Skipping item with file name: ${item.file_name} (missing spatial_coverage)`
          );
        }
      }
    });
  }
}

function updatePagination(total) {
  const totalPages = Math.ceil(total / itemsPerPage) || 1; // Ensure at least 1 page
  const pagination = document.getElementById("pagination");
  pagination.innerHTML = `
                        <li class="page-item ${
                          currentPage === 1 ? "disabled" : ""
                        }">
                            <a class="page-link pagination-link" href="#" data-page="${
                              currentPage - 1
                            }">Previous</a>
                        </li>
                        ${Array.from(
                          { length: totalPages },
                          (_, i) => `
                            <li class="page-item ${
                              currentPage === i + 1 ? "active" : ""
                            }">
                                <a class="page-link pagination-link" href="#" data-page="${
                                  i + 1
                                }">${i + 1}</a>
                            </li>
                        `
                        ).join("")}
                        <li class="page-item ${
                          currentPage === totalPages ? "disabled" : ""
                        }">
                            <a class="page-link pagination-link" href="#" data-page="${
                              currentPage + 1
                            }">Next</a>
                        </li>
                    `;

  pagination.addEventListener("click", function (event) {
    const target = event.target;
    if (target.classList.contains("pagination-link")) {
      event.preventDefault();
      const page = parseInt(target.dataset.page, 10);
      if (
        !isNaN(page) &&
        page >= 1 &&
        page <= totalPages &&
        page !== currentPage
      ) {
        applyFilters(page);
      }
    }
  });
}

function resetFilters() {
  ["themes", "years", "scales", "tag"].forEach((groupId) => {
    const group = document.getElementById(groupId);
    group.querySelectorAll(".list-group-item").forEach((item) => {
      item.classList.toggle("active", item.dataset.value === "all");
    });
  });
  document.getElementById("date-from").value = "";
  document.getElementById("date-to").value = "";
  document.getElementById("search").value = "";
  document.getElementById("sort").value = "title";
  document.getElementById("order").value = "desc";
  document.getElementById("district").value = "all";
  document.getElementById("department").value = "all";
  document.getElementById("tag").value = "all";

  currentPage = 1;
  applyFilters();
}

function viewInGeoportal(fileName) {
  Swal.fire("Geoportal", `Opening ${fileName} in Geoportal`, "info");
  // Implement actual Geoportal integration here
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

document
  .getElementById("search")
  .addEventListener("input", () => applyFilters());
document
  .getElementById("district")
  .addEventListener("change", () => applyFilters());
document
  .getElementById("department")
  .addEventListener("change", () => applyFilters());
document
  .getElementById("sort")
  .addEventListener("change", () => applyFilters());
document
  .getElementById("order")
  .addEventListener("change", () => applyFilters());
document
  .getElementById("date-from")
  .addEventListener("change", () => applyFilters());
document
  .getElementById("date-to")
  .addEventListener("change", () => applyFilters());
document.getElementById("tag").addEventListener("change", () => applyFilters());

// Initial load
applyFilters();

// Fetch and populate categories
async function loadTags() {
  try {
    const response = await fetch("/admin/tags");
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    const tags = await response.json();
    console.log("Fetched tagaaSSs:", tags); // Debug log

    // Get references
    const tagoption = document.getElementById("tag");

    // Clear existing options

    // Populate datalist with <option> elements
    tags.forEach((tag) => {
      console.log(tag);
      const option = document.createElement("option");
      option.value = tag;
      option.textContent = tag;
      tagoption.appendChild(option);
    });
  } catch (err) {
    console.error("Error loading categories:", err);
  }
}

loadTags();
document.addEventListener("DOMContentLoaded", function () {
  document.getElementById("toggleSidebar").addEventListener("click", () => {
    toggleSidebar();
  });

  document.getElementById("resetFilters").addEventListener("click", () => {
    resetFilters();
  });

  document.getElementById("applyFilters").addEventListener("click", () => {
    applyFilters();
  });

  document.getElementById("resetFilters1").addEventListener("click", () => {
    resetFilters();
  });

  document
    .getElementById("datasetGrid")
    .addEventListener("click", function (event) {
      const link = event.target.closest(".action-link");
      if (!link) return;

      event.preventDefault();

      const fileName = link.getAttribute("data-file");
      const action = link.getAttribute("data-action");

      if (!fileName || !action) return;

      if (action === "geoportal") {
        viewInGeoportal(fileName);
      } else {
        window.location.href = `/catalog/${fileName}/${action}`;
      }
    });
});
