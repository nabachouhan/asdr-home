

// ----------  =>toogleAndHandleTheme.js
// *********Admin side Query handle ignore reply etc******starts******
document.addEventListener('DOMContentLoaded', () => {

// toggle between tabs of admin queries
      const statusRadios = document.querySelectorAll('input[name="isresolved"]');
    console.log('Found status radios:', statusRadios.length);
    statusRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            console.log('Status changed to:', radio.value);
            applySearch();
        });
    });

  const actionButtons = document.querySelectorAll('.btn-success, .btn-secondary');
  actionButtons.forEach(button => {
    button.addEventListener('click', async (event) => {
      const action = event.target.getAttribute('data-action');
      const email = event.target.getAttribute('data-email');
      const queryid = event.target.getAttribute('data-id');
      const responseMessage = event.target.getAttribute('data-reply');
      const subject = event.target.getAttribute('data-reason');
      const request = event.target.getAttribute('data-message');
      const fullname = event.target.getAttribute('data-fname');

      const reply = document.getElementById(responseMessage).value;

      try {
        const confirmationResult = await Swal.fire({
          title: 'Confirm Submission',
          text: 'Are you sure you want to proceed?',
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'Yes!',
          cancelButtonText: 'No!'
        });

        if (!confirmationResult.isConfirmed) {
          return;
        }

            // 🔄 Show loader before fetch starts
    Swal.fire({
        title: 'Please wait...',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

        const response = await fetch('/admin/queries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, queryid, email, reply, subject, request, fullname })
        });

        const data = await response.json();
        console.log('Response data:', data);
        Swal.fire({
          title: data.title,
          text: data.message,
          confirmButtonText: 'OK',
          icon: data.icon
        }).then((result) => {
          if (result.isConfirmed) {
            window.location.reload();
          }
        });
      } catch (error) {
        console.error('Error:', error);
        Swal.fire({
          title: 'Error!',
          text: `There was a problem performing the action ${action} for ${email}.`,
          icon: 'error',
          confirmButtonText: 'OK'
        });
      }
    });
  });

    // Apply Search
  const applyBtn = document.getElementById("applySearchBtn");
  if (applyBtn) {
    applyBtn.addEventListener("click", () => {
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
});
// *********Admin side Query handle ignore reply etc******starts******

// *************sorting********************

function sortTable(field) {
  const searchData = document.getElementById("searchData");

  const currentSortField = searchData.dataset.sortField;
  const currentSortOrder = searchData.dataset.sortOrder;

  // Toggle only if same field, otherwise reset to ASC
  const newSortOrder =
    currentSortField === field && currentSortOrder === "ASC"
      ? "DESC"
      : "ASC";

  const searchField = document.getElementById('searchField').value || '';
  const searchValue = document.getElementById('searchValue').value || '';
  const isresolved = document.querySelector('input[name="isresolved"]:checked').value || 'false';
  const dateFrom = document.getElementById('dateFrom').value || '';
  const dateTo = document.getElementById('dateTo').value || '';

  const url = `/admin/queries?page=1&sortField=${encodeURIComponent(field)}&sortOrder=${encodeURIComponent(newSortOrder)}&searchField=${encodeURIComponent(searchField)}&searchValue=${encodeURIComponent(searchValue)}&isresolved=${encodeURIComponent(isresolved)}&dateFrom=${encodeURIComponent(dateFrom)}&dateTo=${encodeURIComponent(dateTo)}`;    

  console.log("Sorting URL:", url);
  window.location.href = url;
}


   // Apply Search

   const queriestabs = document.getElementById("queries-type-tabs");
  if (queriestabs) {
    queriestabs.addEventListener("click", () => {
      applySearch();
    });
  }
  const applyBtn = document.getElementById("applySearch");
  if (applyBtn) {
    applyBtn.addEventListener("click", () => {
      applySearch();
    });
  }

// *************searching********************

function applySearch() {
  
  const searchField = document.getElementById('searchField').value || '';
  const searchValue = document.getElementById('searchValue').value || '';
  const sortField = 'queryid';
  const sortOrder = 'ASC';

  const isresolved = document.querySelector('input[name="isresolved"]:checked').value || 'false';
  const dateFrom = document.getElementById('dateFrom').value || '';
  const dateTo = document.getElementById('dateTo').value || '';
  const url = `/admin/queries?page=1&sortField=${encodeURIComponent(sortField)}&sortOrder=${encodeURIComponent(sortOrder)}&searchField=${encodeURIComponent(searchField)}&searchValue=${encodeURIComponent(searchValue)}&isresolved=${encodeURIComponent(isresolved)}&dateFrom=${encodeURIComponent(dateFrom)}&dateTo=${encodeURIComponent(dateTo)}`;
  console.log('Search URL:', url);
  window.location.href = url;
}




