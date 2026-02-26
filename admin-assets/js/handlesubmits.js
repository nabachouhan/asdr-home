
// handle submissions forms admin--starts------

function formDataToObject(formData) {
    const obj = {};
    formData.forEach((value, key) => {
        obj[key] = value;
    });
    return obj;
}

// Generic function to handle form submissions
const handleFormSubmit = async(event, url) => {
    event.preventDefault(); // Prevent the default form submission

    const formData = new FormData(event.target); // Create a FormData object from the form
    const clickedButtonValue = event.submitter.value;
    formData.append('submit', clickedButtonValue);
    
    const formDataObj = formDataToObject(formData); // Convert FormData to an object for logging
    console.log('Submitting to URL:', url, 'with data:', formDataObj);

    // First, show confirmation before submitting the data
    const confirmationResult = await Swal.fire({
        title: 'Confirm Submission',
        text: 'Are you sure you want proceed?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes!',
        cancelButtonText: 'No!'
    });

    if (!confirmationResult.isConfirmed) {
        // If the user cancels, exit the function
        return;
    }
    document.getElementById('loader0').style.display = 'block';

    // Proceed with the fetch request if confirmed
    await fetch(url, {
        method: 'POST',
        redirect: 'follow',
        body: formData,
    })
    .then(response => response.json())
    .then(data => {
        document.getElementById('loader0').style.display = 'none'
        console.log('Response data:', data);
        if (data) {
            Swal.fire({
                title: data.title,
                text: data.message,
                confirmButtonText: "OK",
                icon: data.icon
            }).then((result) => {
                if (result.isConfirmed && data.redirect !== undefined) {
                    window.location.href = data.redirect; // Replace with your desired URL
                }
            });
        } else {
            console.error('Unexpected response format:', data);
            Swal.fire({
                title: 'Error',
                text: 'Unexpected response format.',
                icon: 'error'
            });
        }
    })
    .catch(error => {
        document.getElementById('loader0').style.display = 'none'
        console.error('Fetch error:', error);
        Swal.fire({
            title: 'Error',
            text: `An error occurred: ${error.message}`,
            icon: 'error'
        });
    });
};

// Attach event listeners to each form, passing the appropriate endpoint URL
document.addEventListener('DOMContentLoaded', function() {

    const adminUpload = document.getElementById('adminUploadForm');
    if (adminUpload) {
        adminUpload.addEventListener('submit', function(e) {
            console.log("HII admin")
            handleFormSubmit(e, '/admin/shpuploads');
        });
    }
    const adminCatalogForm = document.getElementById('adminCatalogForm');
    if (adminCatalogForm) {
        adminCatalogForm.addEventListener('submit', function(e) {
            console.log("HII ctalog")
            handleFormSubmit(e, '/admin/catalog');
        });
    }

    const metadataForm = document.getElementById('metadataForm');
    if (metadataForm) {
        metadataForm.addEventListener('submit', function(e) {
            console.log("HII ctalog")
            handleFormSubmit(e, '/admin/metadata');
        });
    }
  
});
// handle submissions--ends------

   // Sidebar toggle
  const sidebarBtn = document.getElementById("toggleSidebarBtn");
  if (sidebarBtn) {
    sidebarBtn.addEventListener("click", () => {
      toggleadminSidebar();
    });
  }
     // Sidebar toggle

     
// admin Logout--start
function handleAdminLogout(event, url) {
    event.preventDefault(); // Prevent the default form submission
    
    function proceedLogout(){
                fetch(url, { // Send the FormData object to the specified route
                    method: 'POST',
                })
                    .then(response => response.json())
                    .then(data => {
                        console.log(data);
                        if (data) {
                            Swal.fire({
                                title: data.title,
                                text: data.message,
                                icon: data.icon
                            }).then((result) => {
                                /* Read more about isConfirmed, isDenied below */
                                if (result.isConfirmed) {
                                        window.location.href = '/'; 
                                }
                            });
                        } // Handle the response data
                    })
                    .catch(error => {
                        console.error('Error:', error); // Handle any errors
                    });
    
    
            }
            Swal.fire({
                    title: "Proceed Logout",
                    icon: "warning",
                    showCancelButton: true,

                }).then((result) => {
                    /* Read more about isConfirmed, isDenied below */
                    if (result.isConfirmed) {
                            proceedLogout()
                    }
                });
            }

// Attach event listeners to each form, passing the appropriate endpoint URL
document.getElementById('adminLogout').addEventListener('click', function (e) {
    console.log("clickeed loggout..........");
    handleAdminLogout(e, '/admin/logout');
});
// admin Logout--end
// ---------------------------------------------------------------------------

//   admin side bar toggle-- starts
function toggleadminSidebar() {
const adminsidebar = document.getElementById('admin-sidebar');
const mainContent = document.getElementById('mainContent');
adminsidebar.classList.toggle('admin-sidebar-collapsed');
mainContent.classList.toggle('content-expanded');
}
//   admin side bar toggle-- ends

// ----------------------------------------------------------------


// ****************admin uplod toggle uplod form hendle start********************
// ---shape file upload form ----

document.addEventListener('DOMContentLoaded', () => {
  const uploadForm = document.getElementById('adminUploadForm');
  const metadataForm = document.getElementById('metadataForm');
  const uploadOption = document.getElementById('uploadOption');
  const metadataOption = document.getElementById('metadataOption');
  const filenameInput = document.getElementById('filename');
  const thumbnailInput = document.getElementById('thumbnail');
  const thumbnailPreview = document.getElementById('thumbnailPreview');
  const steps = metadataForm.querySelectorAll('.form-step');
  const nextButtons = metadataForm.querySelectorAll('.next-btn');
  const prevButtons = metadataForm.querySelectorAll('.prev-btn');
  const progressBar = metadataForm.querySelector('.progress-bar');
  let currentStep = 0;

  // Toggle forms based on radio button Admin Upload
  function toggleForms() {
    uploadForm.classList.toggle('form-hidden', !uploadOption.checked);
    metadataForm.classList.toggle('form-hidden', uploadOption.checked);
    if (metadataOption.checked) updateStep();
  }
  // Toggle forms based on radio button Admin Upload

  // Update active step and progress bar
  function updateStep() {
    steps.forEach((step, index) => {
      step.classList.toggle('active', index === currentStep);
    });
    progressBar.style.width = `${(currentStep + 1) * 33.33}%`;
    progressBar.textContent = `Step ${currentStep + 1} of 3`;
  }

  // Radio button handlers
  uploadOption.addEventListener('change', toggleForms);
  metadataOption.addEventListener('change', toggleForms);

  // Filename validation
  filenameInput.addEventListener('input', () => {
    const pattern = /^[a-z0-9_]+$/;
    filenameInput.classList.toggle('is-invalid', !pattern.test(filenameInput.value) && filenameInput.value !== '');
  });

  // Thumbnail preview
  thumbnailInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    thumbnailPreview.style.display = file ? 'block' : 'none';
    thumbnailPreview.src = file ? URL.createObjectURL(file) : '';
  });

  // Step navigation
  nextButtons.forEach(button => {
    button.addEventListener('click', () => {
      if (currentStep < steps.length - 1) {
        currentStep++;
        updateStep();
      }
    });
  });

  prevButtons.forEach(button => {
    button.addEventListener('click', () => {
      if (currentStep > 0) {
        currentStep--;
        updateStep();
      }
    });
  });
});


// request form
// Sample card data (simulating multiple cards)
const cardData = Array.from({ length: 2 }, (_, index) => ({
  requestId: 12345 + index,
  name: `John Doe ${index + 1}`,
  email: `john.doe${index + 1}@example.com`,
  organization: `Example Corp ${index + 1}`,
  designation: `Manager ${index + 1}`,
  fileTitle: `Project Proposal ${index + 1}`,
  requestDate: `2025-04-${26 - index}`,
  field1: `Project Scope ${index + 1}`,
  field2: `Budget Details ${index + 1}`
}));

const cardsPerPage = 5;
let currentPage = 1;

// Function to render cards for the current page
function renderCards(page) {
  const start = (page - 1) * cardsPerPage;
  const end = start + cardsPerPage;
}

// Function to render pagination
function renderPagination() {
  const totalPages = Math.ceil(cardData.length / cardsPerPage);
  const pagination = document.getElementById('pagination');
  pagination.innerHTML = '';

  // Previous button
  pagination.innerHTML += `
                <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
                    <a class="page-link" href="#" onclick="changePage(${currentPage - 1})">Previous</a>
                </li>
            `;

  // Page numbers (current and adjacent pages)
  const maxPagesToShow = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
  let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

  if (endPage - startPage + 1 < maxPagesToShow) {
    startPage = Math.max(1, endPage - maxPagesToShow + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pagination.innerHTML += `
                    <li class="page-item ${i === currentPage ? 'active' : ''}">
                        <a class="page-link" href="#" onclick="changePage(${i})">${i}</a>
                    </li>
                `;
  }

  // Next button
  pagination.innerHTML += `
                <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
                    <a class="page-link" href="#" onclick="changePage(${currentPage + 1})">Next</a>
                </li>
            `;
}

// Function to change page
function changePage(page) {
  const totalPages = Math.ceil(cardData.length / cardsPerPage);
  if (page >= 1 && page <= totalPages) {
    currentPage = page;
    renderCards(currentPage);
    renderPagination();
  }
}

// Initial render
renderCards(currentPage);
renderPagination();
// ****************admin uplod toggle uplod form hendle ends********************

