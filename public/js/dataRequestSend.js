// ********** datarequesthandle.js => dataRequestSend.js **********
// Handles user data request actions from admin panel
// ***************************************************************

document.addEventListener("DOMContentLoaded", () => {
  // Select all action buttons (Approve / Reject / Process etc.)
  const actionButtons = document.querySelectorAll(".btn-handlerequest");

  actionButtons.forEach((button) => {
    // Add click listener to every button
    button.addEventListener("click", async (event) => {
      // Extract attributes stored in the HTML element
      const email = event.target.getAttribute("data-email");
      const full_name = event.target.getAttribute("data-fullname");
      const action = event.target.getAttribute("data-action");
      const file_name = event.target.getAttribute("data-file");
      const id = event.target.getAttribute("data-requestid");
      const organization = event.target.getAttribute("data-organization");

      // Identify the parent card (if exists)
      const card = event.target.closest(".request-card");

      try {
        // Show confirmation popup before performing any operation
        const confirmationResult = await Swal.fire({
          title: "Confirm Submission",
          text: "Are you sure you want proceed?",
          icon: "warning",
          showCancelButton: true,
          confirmButtonText: "Yes!",
          cancelButtonText: "No!",
        });

        // User clicked "Cancel"
        if (!confirmationResult.isConfirmed) return;

        // Show loader (UI block)
        document.getElementById("loader0").style.display = "block";

        // Send POST request to server API
        const response = await fetch("/admin/handlerequests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            email,
            full_name,
            file_name,
            id,
            organization,
          }),
        });

        const data = await response.json();

        // Hide loader
        document.getElementById("loader0").style.display = "none";

        console.log("Response data:", data);

        // Show success / error response popup from server
        await Swal.fire({
          title: data.title,
          text: data.message,
          icon: data.icon,
          confirmButtonText: "OK",
        });

        // Remove card from UI if success and if such element exists
        if (card && data.icon === "success") {
          card.remove();
        }

        // Reload page after action
        window.location.reload();
      } catch (error) {
        // Hide loader on any error
        document.getElementById("loader0").style.display = "none";
        console.error("Error performing request:", error);

        // Error popup
        Swal.fire({
          title: "Error!",
          text: `Error performing action "${action}" for ${email}.`,
          icon: "error",
          confirmButtonText: "OK",
        });
      }
    });
  });
});

// ********** END: data request handler **********
