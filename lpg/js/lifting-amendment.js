$(document).ready(function () {
  $.ajaxSetup({ cache: false });

  // Configure Toastr
  toastr.options = {
    closeButton: true,
    progressBar: true,
    positionClass: "toast-top-right",
    timeOut: 5000, // 5 seconds
    extendedTimeOut: 2000,
  };

  let mappingData = JSON.parse(
    sessionStorage.getItem("userMappingData") || "[]"
  );

  if (!mappingData.length) {
    $("#error-message").html(
      "\u274C No mapping data found. Please log in again."
    );
    $(".btn-custom").prop("disabled", true);
    return;
  }

  // --- NEW FLOW: Product Group first ---

  // 1. Populate Product Group dropdown with all unique product groups
  const productGroupSelect = $("#productGroup");
  const uniqueGroups = [...new Set(mappingData.map((m) => m.PRODUCT_GROUP_NAME))];
  productGroupSelect.empty();
  productGroupSelect.append(`<option selected disabled value="">Select Product Group</option>`);
  uniqueGroups.forEach((group) => {
    productGroupSelect.append(`<option value="${group}">${group}</option>`);
  });

  // 2. Terminal/Location dropdown is empty and disabled until Product Group is selected
  const terminalSelect = $("#terminal");
  terminalSelect.empty();
  terminalSelect.append(`<option selected disabled value="">Select Terminal</option>`);
  terminalSelect.prop("disabled", true);

  // 3. On Product Group change, populate Terminal/Location dropdown with only those locations that have the selected product group
  productGroupSelect.off("change").on("change", function () {
    const selectedGroup = $(this).val();
    $(".products-container").empty(); // Clear previous product checkboxes

    // Filter mappingData for selected product group
    const groupData = mappingData.filter((m) => m.PRODUCT_GROUP_NAME === selectedGroup);
    const uniqueLocations = [...new Set(groupData.map((m) => m.LOCATION_NAME))];

    terminalSelect.empty();
    terminalSelect.append(`<option selected disabled value="">Select Terminal</option>`);
    uniqueLocations.forEach((location) => {
      const displayLabel = location.trim().toLowerCase() === "international"
        ? "Out Of Kingdom"
        : location;
      terminalSelect.append(`<option value="${location}">${displayLabel}</option>`);
    });
    terminalSelect.prop("disabled", false);
    terminalSelect.val("");
    validateForm();
  });

  // 4. On Terminal/Location change, populate products for that group/location
  terminalSelect.off("change").on("change", function () {
    const selectedGroup = productGroupSelect.val();
    const selectedLocation = $(this).val();
    $(".products-container").empty();

    const locationData = mappingData.filter(
      (m) => m.PRODUCT_GROUP_NAME === selectedGroup && m.LOCATION_NAME === selectedLocation
    );
    const groupProducts = locationData.map((m) => m.PRODUCT_CODE_NAME);
    populateProductCheckboxes([...new Set(groupProducts)]);
    validateForm();
  });

  // 5. Datepicker and default month
  $("#monthPicker").datepicker({
    format: "M yyyy",
    startView: "months",
    minViewMode: "months",
    autoclose: true,
  });
  $("#monthPicker").val(moment().format("MMM YYYY")).change(validateForm);

  // --- END NEW FLOW ---

  function populateProductCheckboxes(products) {
    const productContainer = $(".products-container");
    productContainer.empty();

    products.forEach((product) => {
      const checkboxHtml = `
        <div class="form-check">
          <input
            class="form-check-input"
            type="checkbox"
            id="${product}"
            value="${product}"
            checked
          />
          <label class="form-check-label" for="${product}">${product}</label>
        </div>
      `;
      productContainer.append(checkboxHtml);
    });

    // When user manually checks/unchecks, re-validate form
    $(".products-container .form-check-input").change(function () {
      validateForm();
    });
  }

  function validateForm() {
    let selectedProductGroup = $("#productGroup").val();
    let selectedTerminal = $("#terminal").val();
    let selectedMonth = $("#monthPicker").val();
    let selectedProducts = $(
      ".products-container .form-check-input:checked"
    ).length;

    let errors = [];
    if (!selectedProductGroup) errors.push("Please select a Product Group.");
    if (!selectedTerminal) errors.push("Please select a Terminal.");
    if (selectedProducts === 0)
      errors.push("Please select at least one Product.");
    if (!selectedMonth) errors.push("Please select a Month.");

    if (errors.length > 0) {
      $("#error-message").html(errors.join("<br>"));
      $(".btn-custom").prop("disabled", true);
      return false;
    } else {
      $("#error-message").html("");
      $(".btn-custom").prop("disabled", false);
      return true;
    }
  }

  function getSelectedValuesAndRedirect(targetPage) {
    const selectedLocationName = $("#terminal").val();
    const selectedGroupName = $("#productGroup").val();
    const selectedMonth = $("#monthPicker").val();
    const selectedProductNames = $(
      ".products-container .form-check-input:checked"
    )
      .map(function () {
        return $(this).next("label").text();
      })
      .get();

    const matched = mappingData.filter(
      (m) =>
        m.LOCATION_NAME === selectedLocationName &&
        m.PRODUCT_GROUP_NAME === selectedGroupName &&
        selectedProductNames.includes(m.PRODUCT_CODE_NAME)
    );

    if (!matched.length) {
      toastr.error("No matching mapping data found.");
      return;
    }

    const versionNo = matched[0].VERSION_NO;
    const locationCode = matched[0].LOCATION;
    const productGroupCode = matched[0].PRODUCT_GROUP;
    const productCodes = matched.map((m) => m.PRODUCT_CODE);

    const params = new URLSearchParams({
      terminal: selectedLocationName,
      productGroup: selectedGroupName,
      products: selectedProductNames.join(","),
      locationCode,
      productGroupCode,
      productCodes: productCodes.join(","),
      month: selectedMonth,
      versionNo,
    });

    window.location.href = `${targetPage}?${params.toString()}`;
  }

  $("#btn-view-one").click(function (e) {
    e.preventDefault();
    if (validateForm()) {
      getSelectedValuesAndRedirect("lifting-amendment-detail-view-one.html");
    }
  });

  $("#btn-view-two").click(function (e) {
    e.preventDefault();
    if (validateForm()) {
      getSelectedValuesAndRedirect("lifting-amendment-detail-view-two.html");
    }
  });
});
