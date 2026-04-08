//  *********Toogle theme dark/light and set theme from previous prefence*
// Load the saved theme on page load

document.addEventListener("DOMContentLoaded", () => {
  const savedTheme = localStorage.getItem("theme") || "dark";
  document.body.setAttribute("data-bs-theme", savedTheme);

  // Set icon and optional dark-mode class
  const themeIcon = document.getElementById("theme-icon");
  if (savedTheme === "dark") {
    document.body.classList.add("dark-mode");
    themeIcon.textContent = "light_mode";
  } else {
    document.body.classList.remove("dark-mode");
    themeIcon.textContent = "dark_mode";
  }
});

// Theme toggle button logic
const toggleButton = document.getElementById("toggleTheme");
const themeIcon = document.getElementById("theme-icon");

toggleButton.addEventListener("click", () => {
  const currentTheme = document.body.getAttribute("data-bs-theme");
  const newTheme = currentTheme === "light" ? "dark" : "light";

  // Apply new theme
  document.body.setAttribute("data-bs-theme", newTheme);
  localStorage.setItem("theme", newTheme);

  // Toggle optional dark-mode class for your custom styling
  document.body.classList.toggle("dark-mode");

  // Update icon
  themeIcon.textContent = newTheme === "dark" ? "light_mode" : "dark_mode";
});

// navg toggle

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
