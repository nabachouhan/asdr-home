// handle submissions--starts------

function formDataToObject(formData) {
  const obj = {};
  formData.forEach((value, key) => {
    obj[key] = value;
  });
  return obj;
}

// Generic function to handle form submissions
const handleFormSubmit = async (event, url) => {
  event.preventDefault(); // Prevent the default form submission

  const formData = new FormData(event.target); // Create a FormData object from the form
  const clickedButtonValue = event.submitter.value;
  formData.append("submit", clickedButtonValue);

  const formDataObj = formDataToObject(formData); // Convert FormData to an object for logging
  console.log("Submitting to URL:", url, "with data:", formDataObj);

  // First, show confirmation before submitting the data
  const confirmationResult = await Swal.fire({
    title: "Confirm Submission",
    text: "Are you sure you want proceed?",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Yes!",
    cancelButtonText: "No!",
  });

  if (!confirmationResult.isConfirmed) {
    // If the user cancels, exit the function
    return;
  }
  document.getElementById("loader0").style.display = "block";

  // Proceed with the fetch request if confirmed
  await fetch(url, {
    method: "POST",
    redirect: "follow",
    body: formData,
  })
    .then((response) => response.json())
    .then((data) => {
      document.getElementById("loader0").style.display = "none";
      console.log("Response data:", data);
      if (data) {
        Swal.fire({
          title: data.title,
          text: data.message,
          confirmButtonText: "OK",
          icon: data.icon,
        }).then((result) => {
          if (result.isConfirmed && data.redirect !== undefined) {
            window.location.href = data.redirect; // Replace with your desired URL
          }
        });
      } else {
        console.error("Unexpected response format:", data);
        Swal.fire({
          title: "Error",
          text: "Unexpected response format.",
          icon: "error",
        });
      }
    })
    .catch((error) => {
      document.getElementById("loader0").style.display = "none";
      console.error("Fetch error:", error);
      Swal.fire({
        title: "Error",
        text: `An error occurred: ${error.message}`,
        icon: "error",
      });
    });
};

// Attach event listeners to each form, passing the appropriate endpoint URL
document.addEventListener("DOMContentLoaded", function () {
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", function (e) {
      handleFormSubmit(e, "/user/login");
    });
  }

  const forgotForm = document.getElementById("forgotForm");
  if (forgotForm) {
    forgotForm.addEventListener("submit", function (e) {
      handleFormSubmit(e, "/user/forgot");
    });
  }

  const registerForm = document.getElementById("registerForm");
  if (registerForm) {
    registerForm.addEventListener("submit", function (e) {
      handleFormSubmit(e, "/user");
    });
  }
  const adminLoginForm = document.getElementById("adminLoginForm");
  if (adminLoginForm) {
    adminLoginForm.addEventListener("submit", function (e) {
      handleFormSubmit(e, "/admin");
    });
  }
  const queryForm = document.getElementById("queryForm");
  if (queryForm) {
    queryForm.addEventListener("submit", function (e) {
      console.log("HII");
      handleFormSubmit(e, "/query");
    });
  }

  const userLogout = document.getElementById("userLogout");
  if (userLogout) {
    userLogout.addEventListener("click", function (e) {
      console.log("HII");
      handleUserogout(e, "/logout");
    });
  }

  loaderHideFunc();
});
// handle submissions--ends------

// home page loader start
const loader = document.getElementById("loader");
function loaderHideFunc() {
  loader.style.display = "none";
}
// home page loader stop

// ---------------------------------------------------------------------------

// User logout
// Attach event listeners to each form, passing the appropriate endpoint URL

async function handleUserogout(event, url) {
  event.preventDefault(); // Prevent the default form submission

  // First, show confirmation before submitting the data
  const confirmationResult = await Swal.fire({
    title: "Confirm Submission",
    text: "Are you sure you want proceed?",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Yes!",
    cancelButtonText: "No!",
  });

  if (!confirmationResult.isConfirmed) {
    // If the user cancels, exit the function
    return;
  }

  fetch(url, {
    // Send the FormData object to the specified route
    method: "POST",
  })
    .then((response) => response.json())
    .then((data) => {
      console.log(data);
      if (data) {
        Swal.fire({
          title: data.title,
          text: data.message,
          confirmButtonText: "OK",

          icon: data.icon,
        }).then((result) => {
          /* Read more about isConfirmed, isDenied below */
          if (result.isConfirmed) {
            window.location.reload();
          }
        });
      } // Handle the response data
    })
    .catch((error) => {
      console.error("Error:", error); // Handle any errors
    });
}
