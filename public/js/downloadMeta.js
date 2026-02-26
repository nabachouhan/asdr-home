// Theme Toggle
// Copy to Clipboard
function copyToClipboard(text) {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      alert("Copied to clipboard: " + text);
    })
    .catch((err) => {
      console.error("Failed to copy: ", err);
    });
}

// Download PDF

function downloadPDF(item) {
  console.log("Item received:", item); // Debug log to check item contents
  if (!item || !item.title) {
    alert("Error: Metadata is incomplete or missing.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yOffset = 20;

  // Header
  doc.setFillColor(0, 94, 184); // Bootstrap primary color
  doc.rect(0, 0, pageWidth, 30, "F");
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text("ASSAM STATE SPACE APPLICATION CENTRE | ASSAM-SDR", 35, 15);
  
  doc.setFontSize(10);
  doc.text("Metadata Report", pageWidth - 5, 25, { align: "right" });

  // File Header
  yOffset += 20;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.text(`Data and Resources: ${item.title}`, 20, yOffset);
  yOffset += 10;
  doc.setFontSize(12);
  doc.text(`Category: ${item.theme}`, 20, yOffset);
  yOffset += 15;
  doc.setLineWidth(0.5);
  doc.line(20, yOffset, pageWidth - 20, yOffset);
  yOffset += 10;

  // Identification
  doc.setFontSize(12);
  doc.text("Spatial / Geographical Coverage Area:", 20, yOffset, {
    maxWidth: pageWidth - 150,
  });
  doc.text(item.spatial_coverage || "N/A", 80, yOffset, {
    maxWidth: pageWidth - 100,
  });
  yOffset += 20;
  doc.text("Dataset Thumbnail:", 20, yOffset);
  doc.text("Thumbnail (Image Omitted in PDF)", 80, yOffset);
  yOffset += 40;
  doc.text("Group content visibility:", 20, yOffset);
  doc.text(item.group_visibility || "N/A", 80, yOffset, {
    maxWidth: pageWidth - 100,
  });
  yOffset += 10;
  doc.text("Publisher:", 20, yOffset);
  doc.text(item.publisher || "N/A", 80, yOffset, { maxWidth: pageWidth - 100 });
  yOffset += 10;
  doc.text("Data Type:", 20, yOffset);
  doc.text(item.file_type || "N/A", 80, yOffset, { maxWidth: pageWidth - 100 });
  yOffset += 10;
  doc.text("Scale:", 20, yOffset);
  doc.text(item.scale || "N/A", 80, yOffset, { maxWidth: pageWidth - 100 });
  yOffset += 10;
  doc.text("Projection Information:", 20, yOffset);
  doc.text(item.projection || "N/A", 80, yOffset, {
    maxWidth: pageWidth - 100,
  });
  yOffset += 10;
  doc.text("Public Access Level:", 20, yOffset);
  doc.text(item.public_access_level || "N/A", 80, yOffset, {
    maxWidth: pageWidth - 100,
  });
  yOffset += 10;
  if (yOffset > pageHeight - 50) {
    doc.addPage();
    yOffset = 20;
  }


  doc.text(`Citation:`, 20, yOffset);
  doc.text(item.citation || "N/A", 80, yOffset, {
    maxWidth: pageWidth - 100,
  });
  yOffset += 10;

  doc.text("Source Date:", 20, yOffset);
  const onlyDate = item.source_date?.split("T")[0] || "N/A";
  doc.text(`${onlyDate|| "N/A"} `, 80, yOffset, {
    maxWidth: pageWidth - 100,
  });
    yOffset += 10;
    doc.text(`Data Quality:`, 20, yOffset);
  doc.text(item.data_quality || "N/A", 80, yOffset, {
    maxWidth: pageWidth - 100,
  });

  yOffset += 10;
  doc.line(20, yOffset, pageWidth - 20, yOffset);
  yOffset += 10;

  // Date & Language

  yOffset += 10;
  doc.text("Dataset Language:", 20, yOffset);
  doc.text(item.language || "N/A", 80, yOffset, { maxWidth: pageWidth - 100 });
  yOffset += 10;
  doc.text("Character Set:", 20, yOffset);
  doc.text("UTF-8", 80, yOffset, { maxWidth: pageWidth - 100 });
  yOffset += 15;
    doc.line(20, yOffset, pageWidth - 20, yOffset);
  yOffset += 10;
  if (yOffset > pageHeight - 50) {
    doc.addPage();
    yOffset = 20;
  }


  // Geographic Extent

  if (yOffset > pageHeight - 50) {
    doc.addPage();
    yOffset = 20;
  }
  doc.line(20, yOffset, pageWidth - 20, yOffset);

  yOffset += 15;

  // Metadata Info

  doc.text("Metadata Date Stamp:", 20, yOffset);
  doc.text(item.metadata_date || "N/A", 80, yOffset, {
    maxWidth: pageWidth - 100,
  });
  yOffset += 10;
  doc.text("Metadata Standard Name:", 20, yOffset);
  doc.text("ISO 19115", 80, yOffset, { maxWidth: pageWidth - 100 });
  yOffset += 10;
  doc.text("Metadata Standard Version:", 20, yOffset);
  doc.text("2014", 80, yOffset, { maxWidth: pageWidth - 100 });
  yOffset += 15;
  doc.line(20, yOffset, pageWidth - 20, yOffset);
  yOffset += 10;

  // Contact Information, Citation, Metadata Stamp, Topic Category, Language, Data Quality
  doc.text("Contact Person :", 20, yOffset, { maxWidth: pageWidth - 150 });
  doc.text("Director", 80, yOffset, { maxWidth: pageWidth - 100 });
  yOffset += 10;

  doc.text("Organisation :", 20, yOffset, { maxWidth: pageWidth - 150 });
  doc.text("Assam State Space Application Centre", 80, yOffset, {
    maxWidth: pageWidth - 100,
  });
  yOffset += 10;
  doc.text("Mailing Address :", 20, yOffset, { maxWidth: pageWidth - 150 });
  doc.text(
    "GS Rd, near IDBI Bank ABC, ABC, Near IDBI Bank, Sree Nagar, Guwahati, Assam 781005",
    80,
    yOffset,
    { maxWidth: pageWidth - 100 }
  );
  yOffset += 20;
  doc.text("City/Locality :", 20, yOffset, { maxWidth: pageWidth - 150 });
  doc.text("Guwahati", 80, yOffset, { maxWidth: pageWidth - 100 });
  yOffset += 10;
  doc.text("Country :", 20, yOffset, { maxWidth: pageWidth - 150 });
  doc.text("India", 80, yOffset, { maxWidth: pageWidth - 100 });
  yOffset += 10;
  doc.text("Contact Telephone :", 20, yOffset, { maxWidth: pageWidth - 150 });
  doc.text("069138 48401", 80, yOffset, { maxWidth: pageWidth - 100 });
  yOffset += 10;
  doc.text("Email :", 20, yOffset, { maxWidth: pageWidth - 150 });
  doc.text("dirassac2021[at]gmail[dot]com", 80, yOffset, {
    maxWidth: pageWidth - 100,
  });
  yOffset += 10;

  if (yOffset > pageHeight - 50) {
    doc.addPage();
    yOffset = 20;
  }

  // Footer
  doc.setFillColor(0, 94, 184);
  doc.rect(0, pageHeight - 20, pageWidth, 20, "F");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(
    "ASSAM STATE SPACE APPLICATION CENTRE | ASSAM-SDR ",
    8,
    pageHeight - 10
  );
  
  const crntdt = (new Date()).toDateString()

  doc.text(`Generated on: ${crntdt}`, pageWidth - 15, pageHeight - 10, {
    align: "right",
  });

    yOffset += 10;

    doc.text(
    `Source URL: ${globalThis.location.href}`,
    8,
    pageHeight - 2
  );

  // Save PDF
  doc.save(`${item.title}_metadata.pdf`);
}

document.addEventListener("DOMContentLoaded", function () {
  // Attach a global event listener for all copy buttons
  document.addEventListener("click", function (event) {
    const target = event.target;

    // Check if it's a button with the class 'copy-btn' and the required data attribute
    if (target.classList.contains("copy-btn") && target.dataset.copyText) {
      const textToCopy = target.dataset.copyText;

      navigator.clipboard
        .writeText(textToCopy)
        .then(() => {
          alert("Copied to clipboard: " + textToCopy);
        })
        .catch((err) => {
          console.error("Failed to copy: ", err);
        });
    }
  });
  // download
  document.addEventListener("click", function (e) {
    const btn = e.target.closest(".download-pdf-btn");
    if (btn) {
      const metadata = {
        title: btn.dataset.title,
        spatial_coverage: btn.dataset.spatialCoverage,
        group_visibility: btn.dataset.groupVisibility,
        publisher: btn.dataset.publisher,
        file_type: btn.dataset.fileType,
        scale: btn.dataset.scale,
        projection: btn.dataset.projection,
        public_access_level: btn.dataset.publicAccessLevel,
        source_date: btn.dataset.sourceDate,
        theme: btn.dataset.theme,
        citation: btn.dataset.citation,
        data_quality: btn.dataset.dataQuality,
        language: btn.dataset.language,
        metadata_date: btn.dataset.metadataDate,
      };

      downloadPDF(metadata); // This must be defined in your JS file
    }
  });
});
