
// *********** Admin-user role handele load dynamically starts**********
document.addEventListener('DOMContentLoaded', () => {
  // Role filter radio buttons
  const roleRadios = document.querySelectorAll('input[name="role"]');
  console.log('Found role radios:', roleRadios.length);
  roleRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      console.log('Role changed to:', radio.value);
      applySearch();
    });
  });

  // Handle privilege change
  document.querySelectorAll(".role-select").forEach(select => {
    select.dataset.currentPrivilege = select.value; // Store initial value
    select.addEventListener("change", async function () {
      const email = this.dataset.email;
      const role = this.value;

      const result = await Swal.fire({
        title: 'Are you sure?',
        text: 'Do you want to update the user role?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, update!',
        cancelButtonText: 'No'
      });

      if (result.isConfirmed) {
        try {
          const response = await fetch('/admin/roles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, role })
          });
          const data = await response.json();
          if (response.ok) {
            this.dataset.currentPrivilege = role; // Update stored value
            Swal.fire({
              title: data.title,
              text: data.message || 'Privilege updated successfully',
              icon: data.icon,
              confirmButtonText: 'OK'
            });
          } else {
            this.value = this.dataset.currentPrivilege; // Revert on failure
            Swal.fire({
              title: 'Error',
              text: data.message || 'Failed to update privilege',
              icon: 'error'
            });
          }
        } catch (error) {
          console.error('Error updating privilege:', error);
          this.value = this.dataset.currentPrivilege; // Revert on failure
          Swal.fire({
            title: 'Error',
            text: 'Error updating privilege',
            icon: 'error'
          });
        }
      } else {
        this.value = this.dataset.currentPrivilege; // Revert if cancelled
      }
    });
  });

  // Handle profile modal data population
// Handle profile modal data population (if you still want dynamic updates)
document.querySelectorAll(".profile-btn").forEach(button => {
  button.addEventListener("click", function () {
    const userId = this.dataset.userId;
    const modal = document.querySelector(`#profileModal-${userId}`);
    
    if (modal) {
      // Update modal content with button data attributes
      const profileImage = modal.querySelector('.modal-body img:first-child');
      if (profileImage && this.dataset.profileImage) {
        profileImage.src = this.dataset.profileImage;
      }
      
      // Update other fields if needed
      const nameSpan = modal.querySelector(`#profileName-${userId}`);
      if (nameSpan) {
        nameSpan.textContent = `${this.dataset.firstName || ''} ${this.dataset.lastName || ''}`.trim();
      }
      
      const privilegeSpan = modal.querySelector(`#profilePrivilege-${userId}`);
      if (privilegeSpan) {
        privilegeSpan.textContent = this.dataset.privilege || 'N/A';
      }
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
// *********** Admin-user role handele load dynamically ends**********


// ********************srting******************


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
  const role = document.querySelector('input[name="role"]:checked')?.value || "";
  const url = `/admin/roles?page=1&sortField=${encodeURIComponent(field)}&sortOrder=${encodeURIComponent(newSortOrder)}&searchField=${encodeURIComponent(searchField)}&searchValue=${encodeURIComponent(searchValue)}&role=${encodeURIComponent(role)}`;

  console.log("Sorting URL:", url);
  window.location.href = url;
}
// ********************searching******************
function applySearch() {
  const searchField = document.getElementById("searchField").value || "";
  const searchValue = document.getElementById("searchValue").value || "";
  const sortField =  "user_id";
  const sortOrder = "ASC";
  const role = document.querySelector('input[name="role"]:checked').value;
  const url = `/admin/roles?page=1&sortField=${encodeURIComponent(sortField)}&sortOrder=${encodeURIComponent(sortOrder)}&searchField=${encodeURIComponent(searchField)}&searchValue=${encodeURIComponent(searchValue)}&role=${encodeURIComponent(role)}`;
  console.log('Search URL:', url);
  window.location.assign(url);
}
