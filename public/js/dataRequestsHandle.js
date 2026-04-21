document.querySelectorAll(".file-dwnld-btn").forEach((btn) => {
  btn.addEventListener("click", async function (event) {
    event.preventDefault();
    const requestid = this.getAttribute("request-id");

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

    fetch(`download/${requestid}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((response) => {
        document.getElementById("loader0").style.display = "none";
        if (response.status === 401) {
          alert("Your Account has been Blocked");
          throw new Error("Account Blocked (401 Unauthorized)"); // Or return Promise.reject(...)
        }

        return response.blob(); // Get the response as a blob
      })
      .then((blob) => {
        document.getElementById("loader0").style.display = "none";
        // Create a URL for the blob
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.style.display = "none";
        a.href = url;
        a.download = `download-${requestid}.zip`; // Set the default filename
        document.body.appendChild(a);
        a.click(); // Trigger the download
        window.URL.revokeObjectURL(url); // Clean up
      })
      .catch((error) => {
        document.getElementById("loader0").style.display = "none";
        console.error("There was a problem with the fetch operation:", error);
        Swal.fire({
          title: "Error!",
          text: "Failed to download the file.",
          icon: "error",
          confirmButtonText: "OK",
        });
      });
  });
});

const applyFilters = () => {
  const search = document.getElementById("searchInput").value;
  const sort = document.getElementById("sortSelect").value;
  const order = document.getElementById("orderSelect").value;
  const status =
    document.querySelector('input[name="status"]:checked')?.value || "all";
  window.location.href = `?search=${encodeURIComponent(
    search
  )}&sort=${sort}&order=${order}&status=${status}&page=1`;
};

document.getElementById("searchInput").addEventListener("change", applyFilters);
document.getElementById("sortSelect").addEventListener("change", applyFilters);
document.getElementById("orderSelect").addEventListener("change", applyFilters);
document.querySelectorAll('input[name="status"]').forEach((btn) => {
  btn.addEventListener("change", applyFilters);
});

//reset button
document.getElementById("resetBtn").addEventListener("click", () => {
  globalThis.location.href = "/requests"; // Navigate to default route with no filters
});

// applyFilters
document.getElementById("applyFilters").addEventListener("click", () => {
  applyFilters();
});

// view meta
document.addEventListener("click", function (event) {
  const target = event.target;

  // Match only buttons with the class 'view-button'
  if (target.matches(".view-button")) {
    event.preventDefault();

    const fileName = target.dataset.fileName;

    // Redirect to the metainfo URL
    globalThis.location.href = `/catalog/${fileName}/metainfo`;
  }

  // Match buttons with the class 'view-condition-btn'
  // if (target.closest(".view-condition-btn") || target.matches(".view-condition-btn")) {
  //   const btn = target.closest(".view-condition-btn") || target;
  //   const condition = btn.dataset.condition;

  //   const modalBody = document.getElementById("conditionModalBody");
  //   if (modalBody) {
  //     modalBody.textContent = condition;
  //   }
  // }
});
