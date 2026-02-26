
// *****************sort*************

function sortTable(field) {
  const searchData = document.getElementById("searchData");

  const currentSortField = searchData.dataset.sortField;
  const currentSortOrder = searchData.dataset.sortOrder;
  const searchField = document.getElementById('searchField').value || '';
    const role = document.querySelector('input[name="role"]:checked').value || 'viewer';
    const dateFrom = document.getElementById('dateFrom').value || '';
    const dateTo = document.getElementById('dateTo').value || '';

  // Toggle only if same field, otherwise reset to ASC
  const newSortOrder =
    currentSortField === field && currentSortOrder === "ASC"
      ? "DESC"
      : "ASC";

  const searchValue = document.getElementById("searchValue").value || "";

      const url = `/admin/logs?page=1&sortField=${encodeURIComponent(field)}&sortOrder=${encodeURIComponent(newSortOrder)}&searchField=${encodeURIComponent(searchField)}&searchValue=${encodeURIComponent(searchValue)}&role=${encodeURIComponent(role)}&dateFrom=${encodeURIComponent(dateFrom)}&dateTo=${encodeURIComponent(dateTo)}`;


  console.log("Sorting URL:", url);
  window.location.href = url;
}

// *****************search*************
function applySearch() {
    const searchField = document.getElementById('searchField').value || '';
    const searchValue = document.getElementById('searchValue').value || '';
    const sortField = 'sn';
    const sortOrder = 'ASC';
    const role = document.querySelector('input[name="role"]:checked').value || 'viewer';
    const dateFrom = document.getElementById('dateFrom').value || '';
    const dateTo = document.getElementById('dateTo').value || '';
    const url = `/admin/logs?page=1&sortField=${encodeURIComponent(sortField)}&sortOrder=${encodeURIComponent(sortOrder)}&searchField=${encodeURIComponent(searchField)}&searchValue=${encodeURIComponent(searchValue)}&role=${encodeURIComponent(role)}&dateFrom=${encodeURIComponent(dateFrom)}&dateTo=${encodeURIComponent(dateTo)}`;
    console.log('Search URL:', url);
    window.location.href = url;
}



document.addEventListener("DOMContentLoaded", function () {
  
  // Apply Search 
  const applyBtn = document.getElementById("applyFilter");
  // preventDefault()
  if (applyBtn) {
    applyBtn.addEventListener("click", () => {
      applySearch();
    });
  }

  const roletabs = document.getElementById("role-tabs");
  if (roletabs) {
    roletabs.addEventListener("click", () => {
      applySearch();
    });
  }


  // Sorting
  const sortLinks = document.querySelectorAll(".sort-link");
  sortLinks.forEach(link => {
    link.addEventListener("click", e => {
      e.preventDefault();
      const field = link.getAttribute("data-field");
      sortTable(field);
    });
  });

})

   // Apply Search
  const applySearchBtn = document.getElementById("applySearchBtn");
  if (applySearchBtn) {
    applySearchBtn.addEventListener("click", () => {
      applySearch();
    });
  }