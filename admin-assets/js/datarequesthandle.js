
// *****************sorting starts*************

function sortTable(field) {
  const searchData = document.getElementById("searchData");

  const currentSortField = searchData.dataset.sortField;
  const currentSortOrder = searchData.dataset.sortOrder;

  // Toggle only if same field, otherwise reset to ASC
  const newSortOrder =
    currentSortField === field && currentSortOrder === "ASC"
      ? "DESC"
      : "ASC";

  const searchField = document.getElementById("searchField").value || "";
  const searchValue = document.getElementById("searchValue").value || "";

  const url = `/admin/requests?page=1&sortField=${encodeURIComponent(
    field
  )}&sortOrder=${encodeURIComponent(
    newSortOrder
  )}&searchField=${encodeURIComponent(
    searchField
  )}&searchValue=${encodeURIComponent(searchValue)}`;

  console.log("Sorting URL:", url);
  window.location.href = url;
}
// *****************sorting ends*************

// *****************apply search starts*************
function applySearch() {
    const searchField = document.getElementById('searchField').value || '';
    const searchValue = document.getElementById('searchValue').value || '';
    const sortField = 'id';
    const sortOrder = 'ASC';
    const status = document.querySelector('input[name="status"]:checked')?.value || '<%= status %>';
    const url = `/admin/requests?page=1&sortField=${encodeURIComponent(sortField)}&sortOrder=${encodeURIComponent(sortOrder)}&searchField=${encodeURIComponent(searchField)}&searchValue=${encodeURIComponent(searchValue)}&status=${encodeURIComponent(status)}`;
    console.log('Search URL:', url);
    window.location.assign(url);
}
// *****************apply search ends*************

// *****************apply search starts*************
document.addEventListener('DOMContentLoaded', () => {
    const statusRadios = document.querySelectorAll('input[name="status"]');
    console.log('Found status radios:', statusRadios.length);
    statusRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            console.log('Status changed to:', radio.value);
            applySearch();
        });
    });

    const actionButtons = document.querySelectorAll('.btn-handlerequest');
    console.log('Found action buttons:', actionButtons.length);
    actionButtons.forEach(button => {
        button.addEventListener('click', async (event) => {
            const action = event.target.getAttribute('data-action');
            const email = event.target.getAttribute('data-email');
            const file_name = event.target.getAttribute('data-file');
            const id = event.target.getAttribute('data-requestid');
            const full_name = event.target.getAttribute('full-name');
            const organization = event.target.getAttribute('data-organization');

            try {
                const confirmationResult = await Swal.fire({
                    title: 'Confirm Submission',
                    text: `Are you sure you want to ${action} this request?`,
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'Yes!',
                    cancelButtonText: 'No!'
                });

                if (!confirmationResult.isConfirmed) return;

                document.getElementById('loader0').style.display = 'block';

                const response = await fetch('/admin/handlerequests', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action, email, full_name, file_name, id, organization })
                });

                const data = await response.json();
                document.getElementById('loader0').style.display = 'none';

                if (data) {
                    Swal.fire({
                        title: data.title,
                        text: data.message,
                        icon: data.icon,
                        confirmButtonText: 'OK'
                    }).then((result) => {
                        if (result.isConfirmed) {
                            window.location.reload();
                        }
                    });
                } else {
                    Swal.fire({
                        title: 'Error',
                        text: 'Unexpected response format.',
                        icon: 'error'
                    });
                }
            } catch (error) {
              console.error(error)
                document.getElementById('loader0').style.display = 'none';
                Swal.fire({
                    title: 'Error!',
                    text: `There was a problem performing the action ${action}.`,
                    icon: 'error',
                    confirmButtonText: 'OK'
                });
            }
        });
    });

    // Sorting
  const sortLinks = document.querySelectorAll(".sort-link");
  sortLinks.forEach(link => {
    link.addEventListener("click", e => {
      e.preventDefault();
      const field = link.getAttribute("data-field");
      sortTable(field);
    });
  });

   // Apply Search
  const applyBtn = document.getElementById("applySearchBtn");
  if (applyBtn) {
    applyBtn.addEventListener("click", () => {
      applySearch();
    });
  }
});
// *****************apply search ends*************
