document.addEventListener("DOMContentLoaded", () => {
  const backButton = document.getElementById("backButton");
  const homeButton = document.getElementById("homeButton");

  if (backButton) {
    backButton.addEventListener("click", function () {
      history.back();
    });
  }

  if (homeButton) {
    homeButton.addEventListener("click", function () {
      window.location.href = "/";
    });
  }
});
