// -datarequest.js=>dataRequestForm.js
// *********wms viewer and request form handle at catalog starts******************
// Extract theme and fileName

// Extract theme and fileName
let theme = "";
let fileName = "";

function assign(data) {
  theme = data.theme;
  fileName = data.file;
  console.log("Theme:", theme, "File:", fileName);
}

document.addEventListener("DOMContentLoaded", function () {
  const firstBox = document.querySelector(".request-fields");
  if (firstBox) {
    const data = {
      theme: firstBox.dataset.theme,
      file: firstBox.dataset.file_name,
    };
    assign(data);
  }

  // ✅ Initialize OpenLayers Map *after* theme & fileName are set
  new ol.Map({
    target: "map",
    layers: [
      new ol.layer.Tile({
        source: new ol.source.XYZ({
          url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          maxZoom: 19,
        }),
      }),
      new ol.layer.Tile({
        source: new ol.source.TileWMS({
          url: "/catalog/wms",
          params: {
            LAYERS: `${theme}:${fileName}`,
            TILED: true,
            SERVICE: "WMS",
            REQUEST: "GetMap",
            FORMAT: "image/png",
            VERSION: "1.1.1",
          },
          serverType: "geoserver",
        }),
      }),
    ],
    view: new ol.View({
      center: ol.proj.fromLonLat([93, 26]),
      zoom: 7,
    }),
  });

  // ✅ Initialize everything else after theme/fileName are set
  fetchFields();
  fetchDistrictValues();
});

// Toggle Query Sections
const allSection = document.getElementById("all-section");
const querySection = document.getElementById("query-section");
const districtwiseSection = document.getElementById("districtwise-section");
document.querySelectorAll('input[name="queryType"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    allSection.classList.toggle("active", radio.value === "all");
    querySection.classList.toggle("active", radio.value === "query");
    districtwiseSection.classList.toggle(
      "active",
      radio.value === "districtwise"
    );
  });
});

// Fetch Fields for Query Section
async function fetchFields() {
  try {
    const response = await fetch(`/catalog/fields/${theme}/${fileName}`);
    if (!response.ok) throw new Error("Failed to fetch fields");
    const fields = await response.json();

    if (!fields.length) {
      document.querySelectorAll(".field-select").forEach((select, i) => {
        document.getElementById(`field-error-${i + 1}`).textContent =
          "No fields available";
        document.getElementById(`field-error-${i + 1}`).style.display = "block";
      });
      return;
    }

    document.querySelectorAll(".field-select").forEach((select) => {
      select.innerHTML = '<option value="">Select Field</option>';
      fields.forEach((field) => {
        const option = document.createElement("option");
        option.value = field;
        option.textContent = field;
        select.appendChild(option);
      });
    });
  } catch (error) {
    console.error(error);
    document.querySelectorAll(".field-select").forEach((select, i) => {
      document.getElementById(`field-error-${i + 1}`).textContent =
        "Error loading fields";
      document.getElementById(`field-error-${i + 1}`).style.display = "block";
    });
  }
}

// Fetch Values for Selected Fields
document.querySelectorAll(".field-select").forEach((select, i) => {
  select.addEventListener("change", async () => {
    const field = select.value;
    const checkboxContainer = document.getElementById(
      `value-checkboxes-${i + 1}`
    );
    const errorDiv = document.getElementById(`value-error-${i + 1}`);
    checkboxContainer.innerHTML = "";
    errorDiv.style.display = "none";

    if (field) {
      try {
        const response = await fetch(
          `/catalog/values/${theme}/${fileName}/${field}`
        );
        if (!response.ok) throw new Error("Failed to fetch values");
        const values = await response.json();

        if (!values.length) {
          errorDiv.textContent = "No values available";
          errorDiv.style.display = "block";
          return;
        }

        values.forEach((value) => {
          const div = document.createElement("div");
          div.className = "form-check";
          div.innerHTML = `
            <input class="form-check-input" type="checkbox" name="values-${
              i + 1
            }" value="${value}" id="value-${i + 1}-${value}">
            <label class="form-check-label" for="value-${
              i + 1
            }-${value}">${value}</label>
          `;
          checkboxContainer.appendChild(div);
        });
      } catch (error) {
        console.error(error);
        errorDiv.textContent = "Error loading values";
        errorDiv.style.display = "block";
      }
    }
  });
});

// Fetch District Values
async function fetchDistrictValues() {
  const checkboxContainer = document.getElementById("district-checkboxes");
  const errorDiv = document.getElementById("district-error");
  checkboxContainer.innerHTML = "";
  errorDiv.style.display = "none";

  try {
    const response = await fetch("/catalog/districts");
    if (!response.ok) throw new Error("Failed to fetch districts");
    const districts = await response.json();

    if (!districts.length) {
      errorDiv.textContent = "No districts available";
      errorDiv.style.display = "block";
      return;
    }

    districts.forEach((district) => {
      const div = document.createElement("div");
      div.className = "form-check";
      div.innerHTML = `
        <input class="form-check-input" type="checkbox" name="district-values" value="${district}" id="district-${district}">
        <label class="form-check-label" for="district-${district}">${district}</label>
      `;
      checkboxContainer.appendChild(div);
    });
  } catch (error) {
    console.error(error);
    errorDiv.textContent = "Error loading districts";
    errorDiv.style.display = "block";
  }
}

// Request All
document.getElementById("request-all").addEventListener("click", async () => {
  const url = `/catalog/${fileName}/filerequest`;
  try {
    const confirm = await Swal.fire({
      icon: "question",
      title: "Confirm",
      text: "Send request for all data?",
      showCancelButton: true,
      confirmButtonText: "Yes",
      cancelButtonText: "No",
    });
    if (!confirm.isConfirmed) return;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "all", theme, fileName }),
    });
    const data = await response.json();

    Swal.fire({
      title: data.title || "Error",
      text: data.message || "Unexpected response",
      icon: data.icon || "error",
      confirmButtonText: "OK",
    }).then((result) => {
      if (result.isConfirmed && data.redirect)
        window.location.href = data.redirect;
    });
  } catch (error) {
    Swal.fire({
      title: "Error",
      text: `Error: ${error.message}`,
      icon: "error",
    });
  }
});

// Request Query
document.getElementById("request-query").addEventListener("click", async () => {
  const queryData = {
    type: "query",
    theme,
    fileName,
    conditions: [],
    operator: document.querySelector(".operator").value,
  };
  let hasValidCondition = false;

  document.querySelectorAll(".query-row").forEach((row, i) => {
    const field = row.querySelector(".field-select").value;
    const values = Array.from(
      row.querySelectorAll(`input[name="values-${i + 1}"]:checked`)
    ).map((cb) => cb.value);
    const errorDiv = document.getElementById(`value-error-${i + 1}`);

    if (field && values.length) {
      queryData.conditions.push({ field, values });
      hasValidCondition = true;
    } else if (field && !values.length) {
      errorDiv.textContent = "Select at least one value";
      errorDiv.style.display = "block";
    }
  });

  if (!hasValidCondition) {
    Swal.fire({ text: "Select at least one field and value", icon: "warning" });
    return;
  }

  try {
    const confirm = await Swal.fire({
      icon: "question",
      title: "Confirm",
      text: "Send query request?",
      showCancelButton: true,
      confirmButtonText: "Yes",
      cancelButtonText: "No",
    });
    if (!confirm.isConfirmed) return;

    const response = await fetch(`/catalog/${fileName}/filerequest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(queryData),
    });
    const data = await response.json();

    Swal.fire({
      title: data.title || "Error",
      text: data.message || "Unexpected response",
      icon: data.icon || "error",
      confirmButtonText: "OK",
    }).then((result) => {
      if (result.isConfirmed && data.redirect)
        window.location.href = data.redirect;
    });
  } catch (error) {
    Swal.fire({
      title: "Error",
      text: `Error: ${error.message}`,
      icon: "error",
    });
  }
});

// Request Districtwise
document
  .getElementById("request-districtwise")
  .addEventListener("click", async () => {
    const queryData = {
      type: "district",
      conditions: JSON.stringify(
        Array.from(
          document.querySelectorAll('input[name="district-values"]:checked')
        ).map((cb) => cb.value)
      ),
      theme,
      fileName,
    };
    console.log(queryData);
    console.log(queryData.conditions.length);
    console.log(queryData.conditions);

    const errorDiv = document.getElementById("district-error");

    if (queryData.conditions.length < 3) {
      errorDiv.textContent = "Select at least one district";
      errorDiv.style.display = "block";
      Swal.fire({ text: "Select at least one district", icon: "warning" });
      return;
    }

    try {
      const confirm = await Swal.fire({
        icon: "question",
        title: "Confirm",
        text: "Send district-wise request?",
        showCancelButton: true,
        confirmButtonText: "Yes",
        cancelButtonText: "No",
      });
      if (!confirm.isConfirmed) return;

      const response = await fetch(`/catalog/${fileName}/filerequest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(queryData),
      });
      const data = await response.json();

      Swal.fire({
        title: data.title || "Error",
        text: data.message || "Unexpected response",
        icon: data.icon || "error",
        confirmButtonText: "OK",
      }).then((result) => {
        if (result.isConfirmed && data.redirect)
          window.location.href = data.redirect;
      });
    } catch (error) {
      Swal.fire({
        title: "Error",
        text: `Error: ${error.message}`,
        icon: "error",
      });
    }
  });

// *********wms viewer and request form handle at catalog ends******************
