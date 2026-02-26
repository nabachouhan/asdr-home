
  
  // *****Event listner to publish layer geoserver***********
  document.addEventListener("DOMContentLoaded", () => {
    const fileNameSelect = document.getElementById("file_name");
    const titleId = document.getElementById("title");
    const storeId = document.getElementById("theme");

    fileNameSelect.addEventListener("change", async () => {
      const fileName = fileNameSelect.value;

      if (fileName) {
        try {
          const response = await fetch(`/admin/catalog/${fileName}`);
          if (response.ok) {
            const data = await response.json();
            titleId.value = data.title;
            storeId.value = data.theme;
          } 
        } catch (error) {
          console.error("Error fetching item details:", error);
        }
      } else {
        fileIdInput.value = "";
      }
    });
  });
// *****Event listner to publish layer geoserver***********
