import { BASE_URL, API_ENDPOINTS } from '../api/api-config.js';

$(document).ready(function () {
  $.ajaxSetup({ cache: false });

  let customerAmendmentModalInstance = null;
  let latestAmendmentRequests = [];
  let gospVersions = [];
  let userCheckCancelled = false;
  window.processId = Date.now();

  // USER LOGGED IN CHECK
  function startUserCheckPolling(payload) {
    userCheckCancelled = false;

    async function poll() {
      if (userCheckCancelled) return;

      try {
        console.log("Checking active users with payload:", payload);
        const csrfToken = await fetchCSRFToken();
        const response = await fetch(`${BASE_URL}${API_ENDPOINTS.INVPROJ_CONCURRENT_USER}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-TOKEN": csrfToken,
          },
          body: JSON.stringify(payload),
          credentials: "include",
        });

        const data = await response.json();
        handleActiveUsersResponse(data);
      } catch (error) {
        console.error("User check polling failed:", error);
      } finally {
        // Immediately call again once current request is complete
        poll();
      }
    }

    poll();
  }

  function handleActiveUsersResponse(apiResponse) {
    const data = apiResponse?.DATA || [];

    if (!Array.isArray(data) || data.length === 0) {
      console.log("No active users found in response. Save is enabled.");
      $("#saveButton").prop("disabled", false).attr("title", "");
      return;
    }

    // One or more users received in DATA
    const users = data.map(item => item.USER_NM);
    const userList = users.join(", ");
    const verb = users.length === 1 ? "is" : "are";
    const msg = `${userList} ${verb} already logged in`;

    console.log("Active users from response:", users);
    $("#saveButton").prop("disabled", true).attr("title", msg);
  }

  // Toggle submenus on click
  $('.dropdown-submenu > a').on('click', function (e) {
    e.preventDefault();
    e.stopPropagation();

    const $submenu = $(this).next('.dropdown-menu');
    const $parent = $(this).parent();

    // Close other open submenus
    $('.dropdown-submenu').not($parent).removeClass('expanded').find('.dropdown-menu').hide();

    // Toggle current
    $submenu.toggle();
    $parent.toggleClass('expanded');
  });
  $('.action-dropdown').on('hidden.bs.dropdown shown.bs.dropdown', function () {
    $('.dropdown-submenu .dropdown-menu').hide();
    $('.dropdown-submenu').removeClass('expanded');
  });

  // Fetch GOSP Simulated Avails
  function populateGospModal() {
    const $tbody = $("#gospAvailsTableBody");
    const $noDataMessage = $("#noGospDataMessage");

    $tbody.empty();
    $noDataMessage.hide();

    if (!Array.isArray(gospVersions) || gospVersions.length === 0) {
      $noDataMessage.show();
      toastr.warning("No GOSP versions found.");
      return;
    }

    const grouped = {};
    gospVersions.forEach(v => {
      const code = v.PRODUCT_CODE;
      if (!grouped[code]) grouped[code] = [];
      grouped[code].push(v);
    });

    Object.keys(grouped).forEach(productCode => {
      const versions = grouped[productCode];
      const productDisplayName = grouped[productCode][0].PRODUCT_CODE_NAME || productCode;
      let options = `<option value="">-- Select a Version --</option>`;
      versions.forEach(v => {
        options += `<option value="${v.VERSION_NO}">${v.VERSION_NAME} - ${v.VERSION_DESCRIPTION}</option>`;
      });

      $tbody.append(`
          <tr data-product="${productCode}">
            <td>
              <div class="form-check">
                <input class="form-check-input gosp-product-checkbox" type="checkbox" value="${productCode}" id="product_${productCode}" checked  style="cursor:pointer">
                <label class="form-check-label ml-4" for="product_${productCode}" style="cursor:pointer">${productDisplayName}</label>
              </div>
            </td>
            <td>
            <select class="form-control gosp-version-select" id="version_${productCode}" style="cursor:pointer">
            ${options}
            </select>
            </td>
          </tr>
        `);
    });

    $(".gosp-product-checkbox").on("change", function () {
      const $row = $(this).closest("tr");
      const $dropdown = $row.find(".gosp-version-select");

      if ($(this).is(":checked")) {
        $dropdown.prop("disabled", false).removeClass("disabled-blur");
      } else {
        $dropdown.prop("disabled", true).addClass("disabled-blur");
      }
    });
  }

  $("#fetchGospAvailsBtn").on("click", function () {
    if (!gospVersions || gospVersions.length === 0) {
      toastr.error("No GOSP versions loaded.");
      return;
    }

    populateGospModal();
    $("#gospSimulatedAvailsModal").modal("show");
  });

  // Handle Update button in the modal
  $("#updateGospAvailsBtn").on("click", async function () {
    const selections = [];

    $("#gospAvailsTableBody tr").each(function () {
      const $row = $(this);
      const product = $row.data("product");
      const $checkbox = $row.find(".gosp-product-checkbox");
      const $dropdown = $row.find(".gosp-version-select");
      const versionNo = parseInt($dropdown.val());

      if ($checkbox.is(":checked") && versionNo) {
        const matched = gospVersions.find(
          v => v.PRODUCT_CODE === product && Number(v.VERSION_NO) === versionNo
        );

        const monthValue = matched?.MONTH_VALUE || "";

        selections.push({
          PRODUCT_CODE: product,
          VERSION_NO: versionNo,
          MONTH_VALUE: monthValue,
        });
      }
    });

    if (selections.length === 0) {
      toastr.warning("Please select at least one product and version.");
      return;
    }

    try {
      const payload = {
        GOSP_VERSIONS: selections,
      };

      console.log("Sending GOSP Update Payload:", payload);

      $("#loadingSpinner").show();
      $("#cancelGospAvailsBtn").prop("disabled", true);
      $("#gospSimulatedAvailsModal .close").prop("disabled", true);

      const csrfToken = await fetchCSRFToken();

      const response = await fetch(`${BASE_URL}${API_ENDPOINTS.FETCH_GOSP_AVAIL}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-TOKEN": csrfToken,
          "Cache-Control": "no-cache",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Fetch API failed with status: " + response.status);
      }

      const result = await response.json();
      console.log("Fetch GOSP response:", result);

      const openGosp = result.OPEN_GOSP || [];

      openGosp.forEach(item => {
        const { PRODUCT_CODE, DATE_VALUE, ADJUSTED_QTY } = item;
        const row = liftingAmendmentData.find(r => Number(r.date) === Number(DATE_VALUE));
        if (row) {
          row[`adjustment_${PRODUCT_CODE}TA`] = ADJUSTED_QTY;
        }
      });

      recalculateLiftingData();
      $("#liftingAmendmentGrid").dxDataGrid("instance").refresh();
      renderAllKpiCards();

      toastr.success("GOSP simulated avails updated successfully!");
      $("#gospSimulatedAvailsModal").modal("hide");
    } catch (error) {
      console.error("Save API Error:", error);
      toastr.error("Failed to update GOSP simulated avails.");
    } finally {
      $("#loadingSpinner").fadeOut();
      $("#cancelGospAvailsBtn").prop("disabled", false);
      $("#gospSimulatedAvailsModal .close").prop("disabled", false);
    }
  });

  // Compare Simulated Closing Button
  $("#compareSimulatedClosingBtn").on("click", function (e) {
    e.preventDefault();
    const baseUrl = API_ENDPOINTS.COMPARE_SIMULATED_CLOSING_URL.split('&pr483=')[0];

    const [monthStr, yearStr] = selection.month.split(" ");
    const monthMap = {
      Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
    };
    const jsDate = new Date(parseInt(yearStr), monthMap[monthStr], 2);
    const excelEpoch = new Date(1899, 11, 31);
    const diffDays = Math.floor((jsDate - excelEpoch) / (1000 * 60 * 60 * 24));
    const pr483 = diffDays - 21916;
    const encodeForParam = str => (str || '').toUpperCase().replace(/ /g, '%2520');
    const pr484 = encodeForParam(selection.terminal);
    const pr485 = encodeForParam(selection.productGroup);

    const url = `${baseUrl}&pr483=${pr483}&pr484=${pr484}&pr485=${pr485}`;
    window.open(url, "_blank");
  });

  // Spot Opportunity
  $("#findSpotOpportunityBtn").on("click", function () {
    const opt = window.optimizationParameters || {};

    $("#inputMaxShipPerDay").val(opt.maxShipPerDay);
    $("#inputMinProductQty").val(opt.minProductQty);
    $("#inputMaxProductQty").val(opt.maxProductQty);
    $("#inputMaxVesselSize").val(opt.maxShipSize);

    $("#spotOpportunityModal").modal("show");
  });

  $("#updateOptimizationBtn").on("click", async function () {
    const optParams = window.originalOptParameters || [];

    const updatedPayload = optParams.map(param => {
      let updatedValue = param.PARAMETER_VALUE;

      switch ((param.PARAMETER_NM || "").toUpperCase()) {
        case "MAX_SHIP_PER_DAY":
          updatedValue = $("#inputMaxShipPerDay").val().toString();
          break;
        case "MIN_PRODUCT_QTY":
          updatedValue = $("#inputMinProductQty").val().toString();
          break;
        case "MAX_PRODUCT_QTY":
          updatedValue = $("#inputMaxProductQty").val().toString();
          break;
        case "MAX_SHIP_SIZE":
          updatedValue = $("#inputMaxVesselSize").val().toString();
          break;
      }

      return {
        ...param,
        PARAMETER_VALUE: updatedValue
      };
    });

    const payload = {
      OPT_PARAMETER: updatedPayload
    };

    try {
      $("#loadingSpinner").show();

      const csrfToken = await fetchCSRFToken();
      const response = await fetch(`${BASE_URL}${API_ENDPOINTS.OPTMODEL_UPDATE_PARAMETER}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-TOKEN": csrfToken,
          "Cache-Control": "no-cache",
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`API request failed with status: ${response.status}`);
      }

      toastr.success("Optimization parameters updated successfully!");
      window.originalOptParameters = updatedPayload;
      window.optimizationParameters = {
        maxShipPerDay: $("#inputMaxShipPerDay").val().toString(),
        minProductQty: $("#inputMinProductQty").val().toString(),
        maxProductQty: $("#inputMaxProductQty").val().toString(),
        maxShipSize: $("#inputMaxVesselSize").val().toString()
      };

      $("#spotOpportunityModal").modal("hide");
    } catch (error) {
      console.error("Update Optimization API failed:", error);
      toastr.error(`Failed to update parameters.\n${error}`);
    } finally {
      $("#loadingSpinner").fadeOut();
    }
  });

  // Collapse toggles
  $("#toggleSpotParams").on("click", function () {
    const $body = $("#spotOpportunityBody");
    const $icon = $("#iconSpotParams");

    if ($body.is(":visible")) {
      $body.hide();
      $icon.removeClass("fa-chevron-down").addClass("fa-chevron-right");
    } else {
      $body.show();
      $icon.removeClass("fa-chevron-right").addClass("fa-chevron-down");
    }
  });

  $("#toggleSpotSuggestions").on("click", function () {
    const $body = $("#spotSuggestionsBody");
    const $icon = $("#iconSpotSuggestions");

    if ($body.is(":visible")) {
      $body.hide();
      $icon.removeClass("fa-chevron-down").addClass("fa-chevron-right");
    } else {
      $body.show();
      $icon.removeClass("fa-chevron-right").addClass("fa-chevron-down");
    }
  });

  // Run Optimization Button
  $("#runOptimizationBtn").on("click", async function () {
    $("#loadingSpinner").show();

    try {
      let nominationAggregate = [];
      window.spotSuggestions = [];
      inventoryData = inventoryData.map((inv) => {
        const date = inv.DATE_VALUE;
        const product = inv.PRODUCT_CODE;
        const matchingRow = liftingAmendmentData.find((r) => r.date === date);

        return {
          ...inv,
          TERMINAL_AVAILS_ADJ: matchingRow?.[`adjustment_${product}TA`] || 0,
          CUSTOMER_LIFTING_ADJ: matchingRow?.[`adjustment_${product}CL`] || 0,
        };
      });

      liftingAmendmentData.forEach((row) => {
        if (!Array.isArray(row.nomination)) return;
        row.nomination.forEach((nom) => {
          Object.keys(nom).forEach((key) => {
            if (key.startsWith("scheduledQty_")) {
              const productCode = key.split("_")[1];
              const matchingRaw = (originalNominationList || []).find(
                (n) =>
                  n.NOMINATION_NO === nom.nominationNumber &&
                  n.PRODUCT_CODE === productCode &&
                  Number(n.DATE_VALUE) === row.date
              );

              nominationAggregate.push({
                VERSION_NO: matchingRaw?.VERSION_NO ?? activeVersionFromReadAPI?.VERSION_NO ?? -1,
                HISTORY_NO: matchingRaw?.HISTORY_NO ?? null,
                PRODUCT_GROUP: matchingRaw?.PRODUCT_GROUP ?? selection.productGroupCode,
                LOCATION: matchingRaw?.LOCATION ?? selection.locationCode,
                MONTH_VALUE: matchingRaw?.MONTH_VALUE ?? selection.month.replace(" ", "").toUpperCase(),
                KS_ROW_NUM: matchingRaw?.KS_ROW_NUM ?? null,
                DATE_VALUE: row.date,
                DATE_VALUE_ADJ: nom.DATE_VALUE_ADJ ?? row.date,
                NOMINATION_NO: nom.nominationNumber,
                CUSTOMER_NAME: nom.customerName,
                SHIP_NAME: nom.shipName,
                PRODUCT_CODE: productCode,
                SCHEDULED_QTY: nom[`scheduledQty_${productCode}`] || 0,
                SCHEDULED_QTY_ADJ: nom[`adjustedQty_${productCode}`] || 0,
                ACTUAL_QTY: matchingRaw?.ACTUAL_QTY ?? (nom[`scheduledQty_${productCode}`] || 0),
              });
            }
          });
        });
      });

      let transformedOpeningInventory = [];
      if (openingInventoryData && Array.isArray(openingInventoryData)) {
        openingInventoryData.forEach((item) => {
          const { Date, ...productEntries } = item;
          const dateDay = Number(Date);

          Object.entries(productEntries).forEach(([productCode, value]) => {
            const meta = (inventoryData || []).find(
              (inv) => inv.DATE_VALUE === dateDay && inv.PRODUCT_CODE === productCode
            );

            transformedOpeningInventory.push({
              VERSION_NO: meta?.VERSION_NO ?? activeVersionFromReadAPI?.VERSION_NO ?? -1,
              HISTORY_NO: meta?.HISTORY_NO ?? null,
              PRODUCT_GROUP: meta?.PRODUCT_GROUP ?? selection.productGroupCode,
              LOCATION: meta?.LOCATION ?? selection.locationCode,
              MONTH_VALUE: meta?.MONTH_VALUE ?? selection.month.replace(" ", "").toUpperCase(),
              KS_ROW_NUM: meta?.KS_ROW_NUM ?? null,
              DATE_VALUE: dateDay,
              PRODUCT_CODE: productCode,
              OPENING_INVENTORY: value || 0,
            });
          });
        });
      }

      const workingCapacityPayload = [];
      workingCapacityData.forEach((row) => {
        const date = row.Date;
        selection.products.forEach((product) => {
          workingCapacityPayload.push({
            DATE_VALUE: date,
            PRODUCT_CODE: product,
            WORKING_CAPACITY: row[product] || 0,
          });
        });
      });

      const selectedAmendments = latestAmendmentRequests.map((original) => {
        const $tr = $(`#customerAmendmentTable tbody tr[data-nomination-no="${original.NOMINATION_NO}"]`);
        const APPLY_BOTH = $tr.find(".apply-both-checkbox").is(":checked") ? "1" : "0";
        const APPLY_QTY = $tr.find(".apply-qty-checkbox").is(":checked") ? "1" : "0";
        const APPLY_DATE = $tr.find(".apply-date-checkbox").is(":checked") ? "1" : "0";

        return {
          ...original,
          APPLY_BOTH,
          APPLY_QTY,
          APPLY_DATE,
        };
      });

      const payload = {
        VERSION: activeVersionFromReadAPI,
        INVENTORY: inventoryData,
        OPENING_INVENTORY: transformedOpeningInventory,
        WORKING_CAPACITY: workingCapacityPayload,
        NOMINATION: nominationAggregate,
        MIN_MAX_PERCENTAGE: minMaxPercentageData,
        NOM_AMD_DATA: selectedAmendments,
      };

      console.log("Optimization Payload:", payload);

      // ----- SEND TO API -----
      const csrfToken = await fetchCSRFToken();
      const response = await fetch(`${BASE_URL}${API_ENDPOINTS.OPTMODEL_RUN}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-TOKEN": csrfToken,
          "Cache-Control": "no-cache",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Run Optimization API failed with status: " + response.status);
      }

      // const response = await fetch("../response/runOptimization.json");
      const apiResponse = await response.json();
      console.log("Optimization API Response:", apiResponse);

      // ----- UPDATE SPOT SUGGESTIONS TABLE -----
      $("#spotSuggestionsBody").empty();

      window.spotSuggestions = apiResponse.SPOT_SUGGESTIONS || [];
      window.spotNominations = apiResponse.SPOT_SUGGESTIONS || [];

      if (spotSuggestions.length === 0) {
        $("#spotSuggestionsBody").append(`
          <tr id="noSuggestionsRow">
            <td colspan="5" class="text-center">
              No suggestions yet. Run optimization to generate.
            </td>
          </tr>
        `);
        $("#viewInScenarioSpotBtn").hide();
      } else {
        // Get unique product names dynamically
        const productSet = new Set(spotSuggestions.map(s => s.PRODUCT_CODE_NAME));
        const productHeaders = Array.from(productSet);

        // Build header row
        const headerRow = `
          <tr>
            <th>Date</th>
              ${productHeaders.map(p => `<th>${p}</th>`).join("")}
            <th>Select</th>
          </tr>
        `;
        $("#spotSuggestionsBody").append(headerRow);

        // Group data by DATE_VALUE
        const groupedByDate = {};
        spotSuggestions.forEach(item => {
          if (!groupedByDate[item.DATE_VALUE]) {
            groupedByDate[item.DATE_VALUE] = {};
          }
          groupedByDate[item.DATE_VALUE][item.PRODUCT_CODE_NAME] = item.LIFTING_QTY;
        });

        window.spotSuggestionSelections = window.spotSuggestionSelections || {};

        Object.entries(groupedByDate).forEach(([date, products]) => {
          const productCells = productHeaders.map(p => `<td>${products[p] || 0}</td>`).join("");
          const isChecked = window.spotSuggestionSelections[date] ? 'checked' : '';
          const isDisabled = window.spotSuggestionSelections[date] ? '' : 'disabled';

          const dataRow = `
            <tr data-date="${date}">
              <td>${date}</td>
                ${productCells}
              <td>
                <div class="d-flex align-items-center">
                  <input type="checkbox" class="form-check-input spot-select-checkbox mr-2" ${isChecked}>
                  <button class="btn btn-sm btn-warning reset-spot-btn ml-4" ${isDisabled}>Reset</button>
                </div>
              </td>
            </tr>
          `;
          $("#spotSuggestionsBody").append(dataRow);
        });

        // Track checkbox changes
        $(document).off('change', '.spot-select-checkbox').on('change', '.spot-select-checkbox', function () {
          const $row = $(this).closest('tr');
          const date = $row.data('date');
          const isChecked = $(this).is(':checked');

          window.spotSuggestionSelections[date] = isChecked;

          // Enable/disable View In Scenario button
          const anySelected = Object.values(window.spotSuggestionSelections).some(v => v);
          $("#viewInScenarioSpotBtn").prop("disabled", !anySelected);

          // Enable/disable this row's Reset button
          const $resetBtn = $row.find('.reset-spot-btn');
          $resetBtn.prop('disabled', !isChecked);
        });

        // Reset button handler
        $('#spotOpportunityModal').off('click', '.reset-spot-btn').on('click', '.reset-spot-btn', function () {
          const $row = $(this).closest('tr');
          const date = $row.data('date');
          const $checkbox = $row.find('.spot-select-checkbox');

          // Ensure the checkbox is checked before proceeding
          if (!$checkbox.is(':checked')) {
            toastr.warning(`ฐPlease select the checkbox before resetting date: ${date}`);
            return;
          }

          // Double-check the global selections state
          if (!window.spotSuggestionSelections[date]) {
            toastr.warning(`Selection state mismatch for date: ${date}. Please reselect the checkbox.`);
            $checkbox.prop('checked', false);
            $(this).prop('disabled', true);
            return;
          }

          const filteredSuggestions = window.spotNominations.filter(s => s.DATE_VALUE == date);
          const reverted = revertNominationDetailForDate(date, filteredSuggestions);

          if (reverted) {
            $checkbox.prop('checked', false);
            window.spotSuggestionSelections[date] = false;

            // Disable reset button after revert
            $(this).prop('disabled', true);

            // Recheck global button
            const anySelected = Object.values(window.spotSuggestionSelections).some(v => v);
            $("#viewInScenarioSpotBtn").prop("disabled", !anySelected);

            toastr.success(`Successfully reset spot suggestions for date: ${date}`);
          } else {
            toastr.warning(`No spot nominations found to reset for date: ${date}`);
          }
        });

        $("#viewInScenarioSpotBtn").show();
      }

      toastr.success("Optimization results loaded!");
    } catch (error) {
      console.error("Optimization Failed:", error);
      toastr.error("Failed to run optimization.");
    } finally {
      $("#loadingSpinner").fadeOut();
    }
  });

  // View In Scenario Spot Button
  $("#viewInScenarioSpotBtn").off("click").on("click", function () {
    const selectedDates = Object.keys(window.spotSuggestionSelections).filter(
      date => window.spotSuggestionSelections[date]
    );

    if (selectedDates.length === 0) {
      toastr.warning("Please select at least one date to view in scenario.");
      return;
    }

    const spotNominations = (window.spotNominations || []).filter(
      suggestion => selectedDates.includes(suggestion.DATE_VALUE)
    );

    spotNominations.forEach(suggestion => {
      const {
        NOMINATION_NO,
        DATE_VALUE,
        PRODUCT_CODE,
        PRODUCT_GROUP,
        LOCATION,
        MONTH_VALUE,
        LIFTING_QTY
      } = suggestion;

      let parentRow = liftingAmendmentData.find(r => r.date == DATE_VALUE);
      if (!parentRow) {
        parentRow = {
          date: DATE_VALUE,
          id: "row_" + DATE_VALUE,
          nomination: []
        };
        liftingAmendmentData.push(parentRow);
      }

      let nomination = parentRow.nomination.find(
        n => n.nominationNumber === NOMINATION_NO
      );

      if (!nomination) {
        nomination = {
          nominationNumber: NOMINATION_NO,
          PRODUCT_GROUP: PRODUCT_GROUP,
          LOCATION: LOCATION,
          MONTH_VALUE: MONTH_VALUE,
          customerName: suggestion.CUSTOMER_NAME || "",
          shipName: suggestion.SHIP_NAME || ""
        };
        parentRow.nomination.push(nomination);
      }

      const adjKey = `adjustedQty_${PRODUCT_CODE}`;
      nomination[adjKey] = LIFTING_QTY;

      parentRow[`adjustment_${PRODUCT_CODE}CL`] = parentRow.nomination
        .reduce((sum, n) => sum + (n[`adjustedQty_${PRODUCT_CODE}`] || 0), 0);
    });

    toastr.success("SPOT nominations added to scenario.");

    renderAllKpiCards();

    const mainGrid = $("#liftingAmendmentGrid").dxDataGrid("instance");
    mainGrid.getVisibleRows().forEach(rowInfo => {
      if (mainGrid.isRowExpanded(rowInfo.key)) {
        mainGrid.collapseRow(rowInfo.key);
        mainGrid.expandRow(rowInfo.key);
      }
    });

    mainGrid.refresh();
    recalculateLiftingData();

    $("#spotOpportunityModal").modal("hide");
    window.spotSuggestionSelections = {};
  });

  // Helper Function — Revert Logic
  function revertNominationDetailForDate(date, suggestionsForDate) {
    let revertedAny = false;

    // Find the parent row for the specific date
    const parentRow = liftingAmendmentData.find(r => r.date == date);
    if (!parentRow || !Array.isArray(parentRow.nomination)) {
      return false; // No nominations to revert for this date
    }

    suggestionsForDate.forEach(suggestion => {
      const { NOMINATION_NO, PRODUCT_CODE } = suggestion;

      // Find the nomination within the parent row for this specific date
      const nomIndex = parentRow.nomination.findIndex(
        n => n.nominationNumber === NOMINATION_NO
      );
      if (nomIndex === -1) return; // Nomination not found for this date

      const nomination = parentRow.nomination[nomIndex];

      if (NOMINATION_NO === "XXXXX") {
        // Remove the nomination entirely if it's a placeholder
        parentRow.nomination.splice(nomIndex, 1);
        revertedAny = true;
      } else {
        // Reset the adjusted quantity for the specific product
        const adjKey = `adjustedQty_${PRODUCT_CODE}`;
        if (nomination.hasOwnProperty(adjKey)) {
          nomination[adjKey] = 0;
          revertedAny = true;
        }
      }

      // Recalculate customer lifting adjustment for the product
      parentRow[`adjustment_${PRODUCT_CODE}CL`] = parentRow.nomination
        .reduce((sum, n) => sum + (n[`adjustedQty_${PRODUCT_CODE}`] || 0), 0);
    });

    // If any nominations were reverted, refresh the UI
    if (revertedAny) {
      recalculateLiftingData();
      renderAllKpiCards();
      const mainGrid = $("#liftingAmendmentGrid").dxDataGrid("instance");
      mainGrid.refresh();
      return true;
    }

    return false;
  }


  // Customer Amendment Requests
  $("#customerAmendmentRequestsBtn").off("click").on("click", function () {
    const $tbody = $("#customerAmendmentTable tbody");
    if (!$tbody.length) {
      console.error("Table body #customerAmendmentTable tbody not found in the DOM.");
      toastr.error("Table element not found. Please check the HTML structure.");
      return;
    }
    $tbody.empty();

    // 1) Grab the data you already fetched earlier:
    const amendmentRequests = latestAmendmentRequests;

    // 2) Validate / empty message
    if (!Array.isArray(amendmentRequests)) {
      toastr.error("Invalid data format.");
      return;
    }
    if (amendmentRequests.length === 0) {
      $tbody.append("<tr><td colspan='5' class='text-center'>No amendment requests available.</td></tr>");
      return;
    }

    // 3) Group amendment requests by NOMINATION_NO
    const groupedRequests = {};
    amendmentRequests.forEach((row) => {
      const { NOMINATION_NO, SHIP_NAME } = row;
      const key = `${NOMINATION_NO}/${SHIP_NAME}`; // Unique key for nomination
      if (!groupedRequests[key]) {
        groupedRequests[key] = {
          NOMINATION_NO,
          SHIP_NAME,
          requests: []
        };
      }
      groupedRequests[key].requests.push(row);
    });

    // 4) Render rows for each grouped nomination
    Object.values(groupedRequests).forEach((group) => {
      const { NOMINATION_NO, SHIP_NAME, requests } = group;

      let type = "—";
      if (requests.length > 0) {
        type = requests[0].REQUEST_TYPE || "—";
      }

      // Create the nested table with a row for each request (product)
      const $nestedTableBody = $("<tbody>");
      requests.forEach((row) => {
        const {
          PRODUCT_CODE_NAME,
          SCHEDULED_QTY,
          REQUESTED_QTY,
          DATE_VALUE,
          REQUESTED_DATE
        } = row;
        $nestedTableBody.append(`
       <tr data-product-code="${row.PRODUCT_CODE}">
          <td>${PRODUCT_CODE_NAME || "—"}</td>
          <td>${SCHEDULED_QTY?.toLocaleString() || "—"}</td>
          <td>${REQUESTED_QTY?.toLocaleString() || "—"}</td>
          <td>${DATE_VALUE || "—"}</td>
          <td>${REQUESTED_DATE || "—"}</td>
        </tr>
      `);
      });

      const $nestedTable = $("<table>")
        .addClass("nested-table table table-bordered")
        .hide()
        .append(`
        <thead>
          <tr>
            <th>Product Name</th>
            <th colspan="2" class="text-center">Qty</th>
            <th colspan="2" class="text-center">Date</th>
          </tr>
          <tr>
            <th></th><th>Scheduled</th><th>Requested</th><th>Scheduled</th><th>Requested</th>
          </tr>
        </thead>
      `)
        .append($nestedTableBody);

      const $tr = $("<tr>")
        .attr("data-nomination-no", NOMINATION_NO)
        .data("nominationNo", NOMINATION_NO)
        .data("productCode", requests[0].PRODUCT_CODE).append(`
          <td>
            <div class="nomination-details d-flex align-items-center">
              <span class="toggle-icon me-2" style="cursor: pointer;">▶</span>
              <span class="nomination-text">${NOMINATION_NO} / ${SHIP_NAME}</span>
            </div>
            <div class="nested-table-wrapper"></div>
          </td>
        `)
        .append(`<td>${type}</td>`)
        .append(`<td><input type="checkbox" class="apply-both-checkbox" id="applyBoth_${NOMINATION_NO}" /></td>`)
        .append(`<td><input type="checkbox" class="apply-qty-checkbox" id="applyQty_${NOMINATION_NO}" /></td>`)
        .append(`<td><input type="checkbox" class="apply-date-checkbox" id="applyDate_${NOMINATION_NO}" /></td>`);

      $tr.find(".nested-table-wrapper").append($nestedTable);
      $tbody.append($tr);
    });

    // 5) Re-attach "check all" handlers
    $("#checkAllBoth").off("change").on("change", () => {
      $(".apply-both-checkbox").prop("checked", $("#checkAllBoth").is(":checked"));
    });
    $("#checkAllQty").off("change").on("change", () => {
      $(".apply-qty-checkbox").prop("checked", $("#checkAllQty").is(":checked"));
    });
    $("#checkAllDate").off("change").on("change", () => {
      $(".apply-date-checkbox").prop("checked", $("#checkAllDate").is(":checked"));
    });

    // disable buttons to start
    $("#viewInScenarioBtn, #sendEmailBtn").prop("disabled", true);

    $tbody
      .add("#checkAllBoth, #checkAllQty, #checkAllDate")
      .off("change", "input[type=checkbox]")
      .on("change", "input[type=checkbox]", updateFooterButtons);

    if (!customerAmendmentModalInstance) {
      customerAmendmentModalInstance = new bootstrap.Modal(
        document.getElementById("customerAmendmentModal")
      );
    }
    customerAmendmentModalInstance.show();
  });

  // helper to toggle the footer buttons
  function updateFooterButtons() {
    const anyChecked = !!$(".apply-both-checkbox:checked, .apply-qty-checkbox:checked, .apply-date-checkbox:checked").length;
    $("#viewInScenarioBtn, #sendEmailBtn").prop("disabled", !anyChecked);
  }

  // wire up ALL the checkboxes: the per-row ones AND the header "check all" boxes
  $(document).off("change", "#checkAllBoth, #checkAllQty, #checkAllDate, .apply-both-checkbox, .apply-qty-checkbox, .apply-date-checkbox");
  $(document).on(
    "change",
    "#checkAllBoth, #checkAllQty, #checkAllDate, .apply-both-checkbox, .apply-qty-checkbox, .apply-date-checkbox",
    updateFooterButtons
  );

  // initialize once in case a header box was pre-checked
  updateFooterButtons();

  // Use event delegation for the dropdown toggle
  $("#customerAmendmentTable").off("click", ".nomination-details").on("click", ".nomination-details", function () {
    const $this = $(this);
    const $icon = $this.find(".toggle-icon");
    const $table = $this.next(".nested-table-wrapper").find(".nested-table");
    $table.toggle();
    $icon.text($table.is(":visible") ? "▼" : "▶");
  });

  $("#viewInScenarioBtn").off("click").on("click", function () {
    const missingNominations = [];

    $("#customerAmendmentTable tbody tr").each(function () {
      const $row = $(this);
      const nominationText = $row.find(".nomination-text").text().trim();
      const [nominationNumber] = nominationText.split(" / ").map(s => s.trim());

      const applyBoth = $row.find(".apply-both-checkbox").is(":checked");
      const applyQty = $row.find(".apply-qty-checkbox").is(":checked");
      const applyDate = $row.find(".apply-date-checkbox").is(":checked");
      if (!(applyBoth || applyQty || applyDate)) return;

      let matchFound = false;

      for (let parentRow of liftingAmendmentData) {
        if (!Array.isArray(parentRow.nomination)) continue;

        const nomIndex = parentRow.nomination.findIndex(
          n => n.nominationNumber === nominationNumber
        );
        if (nomIndex === -1) continue;

        const nomination = parentRow.nomination[nomIndex];
        matchFound = true;

        // ── APPLY QTY ──
        if (applyBoth || applyQty) {
          $row.find(".nested-table tbody tr").each(function () {
            const $cells = $(this).find("td");
            const productCode = $(this).data("product-code");
            const scheduledQty = parseFloat($cells.eq(1).text().replace(/,/g, "")) || 0;
            const requestedQty = parseFloat($cells.eq(2).text().replace(/,/g, "")) || 0;
            const adjustedQty = requestedQty - scheduledQty;

            const adjKey = `adjustedQty_${productCode}`;
            nomination[adjKey] = adjustedQty;

            parentRow[`adjustment_${productCode}CL`] = parentRow.nomination
              .reduce((sum, n) => sum + (n[adjKey] || 0), 0);
          });
        }

        // ── APPLY DATE + MOVE ──
        if (applyBoth || applyDate) {
          const oldDay = parseInt($row.find(".nested-table tbody tr td").eq(3).text().replace(/\D/g, "")) || 0;
          const newDay = parseInt($row.find(".nested-table tbody tr td").eq(4).text().replace(/\D/g, "")) || oldDay;
          if (newDay !== oldDay) {
            // splice out of old row
            const moved = parentRow.nomination.splice(nomIndex, 1)[0];
            moved.DATE_VALUE_ADJ = newDay;

            // push into (or create) the newDay row
            let targetRow = liftingAmendmentData.find(r => r.date === newDay);
            if (!targetRow) {
              targetRow = { date: newDay, id: "row_" + newDay, nomination: [] };
              liftingAmendmentData.push(targetRow);
            }
            targetRow.nomination = targetRow.nomination || [];
            targetRow.nomination.push(moved);

            // recalc both rows
            const p = moved.PRODUCT_CODE;
            parentRow[`adjustment_${p}CL`] = parentRow.nomination
              .reduce((s, n) => s + (n[`adjustedQty_${p}`] || 0), 0);
            targetRow[`adjustment_${p}CL`] = targetRow.nomination
              .reduce((s, n) => s + (n[`adjustedQty_${p}`] || 0), 0);
          }
        }

        break;  // done with this nomination
      }

      if (!matchFound) {
        missingNominations.push(nominationNumber);
      }
    });

    if (missingNominations.length) {
      toastr.warning("Some nominations not found: " + missingNominations.join(", "));
    } else {
      toastr.success("Scenario updated with selected amendment requests.");
    }

    // recalc & redraw the main grid + KPIs
    renderAllKpiCards();

    // ── NEW: force re-render of any open detail rows ──
    const mainGrid = $("#liftingAmendmentGrid").dxDataGrid("instance");
    mainGrid.getVisibleRows().forEach(rowInfo => {
      if (mainGrid.isRowExpanded(rowInfo.key)) {
        mainGrid.collapseRow(rowInfo.key);
        mainGrid.expandRow(rowInfo.key);
      }
    });

    // finally hide the modal
    if (customerAmendmentModalInstance) {
      customerAmendmentModalInstance.hide();
    }
  });

  $("#sendEmailBtn").off("click").on("click", async function () {
    const payload = [];

    $("tr[data-nomination-no]").each((_, tr) => {
      const $tr = $(tr);
      const nominationNo = $tr.data("nominationNo");

      const isBoth = $tr.find(".apply-both-checkbox").is(":checked");
      const isQty = $tr.find(".apply-qty-checkbox").is(":checked");
      const isDate = $tr.find(".apply-date-checkbox").is(":checked");

      if (!(isBoth || isQty || isDate)) return;

      // find all products under this nomination
      const relatedRows = latestAmendmentRequests.filter(r => r.NOMINATION_NO === nominationNo);

      relatedRows.forEach(row => {
        const item = {
          NOMINATION_NUMBER: row.NOMINATION_NO,
          PRODUCT_CODE: row.PRODUCT_CODE,
          PRODUCT_GROUP: row.PRODUCT_GROUP,
          MONTH_VALUE: row.MONTH_VALUE,
          LOCATION: row.LOCATION,
          VERSION_NO: row.VERSION_NO,
          REQUEST_TYPE: row.REQUEST_TYPE || "—",
          BOTH_CHANGE: isBoth ? "YES" : "NO",
          QUANTITY_CHANGE: isQty ? "YES" : "NO",
          DATE_CHANGE: isDate ? "YES" : "NO"
        };

        if (isBoth) item.ACCEPTED_FLAG = "BOTH";

        payload.push(item);
      });
    });

    if (!payload.length) {
      toastr.warning("Please select at least one amendment to email.");
      return;
    }

    console.log("Sending Payload:", JSON.stringify({ NOMINATION_AMD: payload }, null, 2));

    const $btn = $(this).prop("disabled", true).text("Sending…");

    try {
      const csrfToken = await fetchCSRFToken();
      const res = await fetch(`${BASE_URL}${API_ENDPOINTS.EMAIL_AMENDMENT}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-TOKEN": csrfToken
        },
        body: JSON.stringify({ NOMINATION_AMD: payload })
      });

      if (!res.ok) throw new Error(res.statusText);
      await res.json();
      toastr.success("Email request submitted successfully!");
    } catch (err) {
      console.error(err);
      toastr.error("Failed to send email.");
    } finally {
      $btn.prop("disabled", false).text("SEND EMAIL");
    }
  });

  let inventoryData = [];

  var currentUnit = "MB";
  var unitConversionFactors = {};
  let userUpdatedUOMFactors = {};
  let minMaxPercentageData = [];
  let activeVersionFromReadAPI = null;

  // Configure Toastr
  toastr.options = {
    closeButton: true,
    progressBar: true,
    positionClass: "toast-top-right",
    timeOut: 5000, // 5 seconds
    extendedTimeOut: 2000,
  };

  function getQueryParams() {
    let params = new URLSearchParams(window.location.search);

    return {
      terminal: params.get("terminal"),
      locationCode: params.get("locationCode"),
      productGroup: params.get("productGroup"),
      productGroupCode: params.get("productGroupCode"),
      products: params.get("productCodes")?.split(",") || [],
      productCodes: params.get("productCodes")?.split(",") || [],
      productCodeNames: params.get("productCodeNames")?.split(",") || [],
      month: params.get("month"),
      versionNo: params.get("versionNo"),
    };
  }

  const selection = getQueryParams();
  console.log(getQueryParams());

  function unique(array) {
    return Array.from(new Set(array));
  }

  selection.products = unique(selection.products);

  callReadAPIWithSelection(selection);

  // Bind Save button
  $("#saveButton").on("click", function () {
    saveData();
  });

  async function saveData() {
    $("#loadingSpinner").show();
    let nominationAggregate = [];

    // Rebuild inventoryData to preserve all original fields AND inject adjusted values
    inventoryData = inventoryData.map((inv) => {
      const date = inv.DATE_VALUE;
      const product = inv.PRODUCT_CODE;

      const matchingRow = liftingAmendmentData.find((r) => r.date === date);

      return {
        ...inv,
        TERMINAL_AVAILS_ADJ: matchingRow?.[`adjustment_${product}TA`] || 0,
        CUSTOMER_LIFTING_ADJ: matchingRow?.[`adjustment_${product}CL`] || 0,
      };
    });

    liftingAmendmentData.forEach((row) => {
      if (!Array.isArray(row.nomination)) return;
      row.nomination.forEach((nom) => {
        Object.keys(nom).forEach((key) => {
          if (key.startsWith("scheduledQty_")) {
            const productCode = key.split("_")[1];
            const matchingRaw = (originalNominationList || []).find(
              (n) =>
                n.NOMINATION_NO === nom.nominationNumber &&
                n.PRODUCT_CODE === productCode &&
                Number(n.DATE_VALUE) === row.date
            );

            nominationAggregate.push({
              VERSION_NO:
                matchingRaw?.VERSION_NO ?? activeVersionFromReadAPI?.VERSION_NO ?? -1,
              HISTORY_NO: matchingRaw?.HISTORY_NO ?? null,
              PRODUCT_GROUP: matchingRaw?.PRODUCT_GROUP ?? selection.productGroupCode,
              LOCATION: matchingRaw?.LOCATION ?? selection.locationCode,
              MONTH_VALUE:
                matchingRaw?.MONTH_VALUE ?? selection.month.replace(" ", "").toUpperCase(),
              KS_ROW_NUM: matchingRaw?.KS_ROW_NUM ?? null,
              DATE_VALUE: row.date,
              DATE_VALUE_ADJ: nom.DATE_VALUE_ADJ ?? row.date,
              NOMINATION_NO: nom.nominationNumber,
              CUSTOMER_NAME: nom.customerName,
              SHIP_NAME: nom.shipName,
              PRODUCT_CODE: productCode,
              SCHEDULED_QTY: nom[`scheduledQty_${productCode}`] || 0,
              SCHEDULED_QTY_ADJ: nom[`adjustedQty_${productCode}`] || 0,
              ACTUAL_QTY: matchingRaw?.ACTUAL_QTY ?? (nom[`scheduledQty_${productCode}`] || 0),
            });
          }
        });
      });
    });

    let transformedOpeningInventory = [];

    if (openingInventoryData && Array.isArray(openingInventoryData)) {
      openingInventoryData.forEach((item) => {
        const { Date, ...productEntries } = item;
        const dateDay = Number(Date);

        Object.entries(productEntries).forEach(([productCode, value]) => {
          const meta = (inventoryData || []).find(
            (inv) =>
              inv.DATE_VALUE === dateDay && inv.PRODUCT_CODE === productCode
          );

          transformedOpeningInventory.push({
            VERSION_NO:
              meta?.VERSION_NO ?? activeVersionFromReadAPI?.VERSION_NO ?? -1,
            HISTORY_NO: meta?.HISTORY_NO ?? null,
            PRODUCT_GROUP: meta?.PRODUCT_GROUP ?? selection.productGroupCode,
            LOCATION: meta?.LOCATION ?? selection.locationCode,
            MONTH_VALUE:
              meta?.MONTH_VALUE ?? selection.month.replace(" ", "").toUpperCase(),
            KS_ROW_NUM: meta?.KS_ROW_NUM ?? null,
            DATE_VALUE: dateDay,
            PRODUCT_CODE: productCode,
            OPENING_INVENTORY: value || 0,
          });
        });
      });
    }

    const workingCapacityPayload = [];
    workingCapacityData.forEach((row) => {
      const date = row.Date;
      selection.products.forEach((product) => {
        workingCapacityPayload.push({
          DATE_VALUE: date,
          PRODUCT_CODE: product,
          WORKING_CAPACITY: row[product] || 0,
        });
      });
    });

    const selectedAmendments = latestAmendmentRequests.map(original => {
      const $tr = $(
        `#customerAmendmentTable tbody tr[data-nomination-no="${original.NOMINATION_NO}"]`
      );

      const APPLY_BOTH = $tr.find(".apply-both-checkbox").is(":checked") ? "1" : "0";
      const APPLY_QTY = $tr.find(".apply-qty-checkbox").is(":checked") ? "1" : "0";
      const APPLY_DATE = $tr.find(".apply-date-checkbox").is(":checked") ? "1" : "0";

      return {
        ...original,
        APPLY_BOTH,
        APPLY_QTY,
        APPLY_DATE
      };
    });

    const payload = {
      VERSION: activeVersionFromReadAPI,
      INVENTORY: inventoryData,
      OPENING_INVENTORY: transformedOpeningInventory,
      WORKING_CAPACITY: workingCapacityPayload,
      NOMINATION: nominationAggregate,
      MIN_MAX_PERCENTAGE: minMaxPercentageData,
      NOM_AMD_DATA: selectedAmendments
    };

    console.log("Final Save Payload:", payload);

    try {
      const csrfToken = await fetchCSRFToken();
      const response = await fetch(`${BASE_URL}${API_ENDPOINTS.SAVE}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-TOKEN": csrfToken,
          "Cache-Control": "no-cache",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Save API failed with status: " + response.status);
      }

      const result = await response.json();
      console.log("Save Success:", result);
      toastr.success("Data saved successfully!");

      await handleReadApiData(result);
    } catch (error) {
      console.error("Save Failed:", error);
      toastr.error("Failed to save data.");
    } finally {
      $("#loadingSpinner").fadeOut();
    }
  };

  const [monthStr, yearStr] = selection.month.split(" ");
  // Define a mapping for month abbreviations to month numbers
  const monthMap = {
    Jan: 0,
    Feb: 1,
    Mar: 2,
    Apr: 3,
    May: 4,
    Jun: 5,
    Jul: 6,
    Aug: 7,
    Sep: 8,
    Oct: 9,
    Nov: 10,
    Dec: 11,
  };

  // Create a date for the planning month (first day of that month)
  const planningDate = new Date(parseInt(yearStr), monthMap[monthStr], 1);

  // Get today's date (set time to midnight for accurate comparisons)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Create a date representing the current month (first day)
  const currentMonthDate = new Date(today.getFullYear(), today.getMonth(), 1);

  // Set editingEnabled to true only if the planning month is current or in the future
  const editingEnabled = planningDate >= currentMonthDate;

  if (!editingEnabled) {
    $(
      "#resetOpeningInventory, #saveOpeningInventory, " +
      "#resetWorkingCapacity, #saveWorkingCapacity, " +
      "#resetInventoryPlanning, #saveInventoryPlanning"
    )
      .prop("disabled", true)
      .css("cursor", "not-allowed");
  }

  function updateHeader(selection) {
    const productNames = selection.products
      .map(code => window.productNameMap?.[code] || code)
      .join(", ");

    // Replace "International" with "Out Of Kingdom" for display only
    const displayTerminal = selection.terminal === "International"
      ? "Out Of Kingdom"
      : selection.terminal;

    $("#app-header .title").html(`
    <strong>Lifting Amendment Simulator</strong> -
    <strong>Planning:</strong> ${selection.month} |
    <strong>Terminal:</strong> ${displayTerminal} |
    <strong>Group:</strong> ${selection.productGroup} |
    <strong>Products:</strong> ${productNames} |
    <strong>Version:</strong> ${activeVersionFromReadAPI?.VERSION_NAME || "N/A"} |
    <strong>Description:</strong> ${activeVersionFromReadAPI?.VERSION_DESCRIPTION || "No description"}
  `);
  }

  let savedVersions = [];

  $("#openButton").on("click", function () {
    const $select = $("#versionSelect").empty();
    const $message = $("#noVersionsMessage");

    if (savedVersions.length > 0) {
      savedVersions.forEach((v) => {
        $select.append(
          `<option value="${String(v.id)}">${v.name || "Unnamed Version"
          }</option>`
        );
      });
      $select.show();
      $message.hide();
    } else {
      $select.hide();
      $message.show();
    }

    $("#openVersionModal").modal("show");
  });

  $("#confirmOpenVersion").on("click", function () {
    const selectedId = $("#versionSelect").val();
    const selectedVersion = savedVersions.find(
      (v) => String(v.id) === selectedId
    );

    if (!selectedVersion) {
      toastr.error("Please select a version.");
      return;
    }

    const newSelection = { ...selection, versionNo: selectedVersion.id };

    callReadAPIWithSelection(newSelection);

    $("#openVersionModal").modal("hide");
  });

  // SAVE AS
  $("#saveAsButton").on("click", function () {
    $("#saveName").val("");
    $("#saveDescription").val("");
    $("#saveAsModal").modal("show");
  });

  $("#saveAsForm").on("submit", async function (e) {
    e.preventDefault();

    const name = $("#saveName").val().trim();
    const description = $("#saveDescription").val().trim();

    if (!name) {
      toastr.error("Please enter a name");
      return;
    }

    // Check if the name already exists in savedVersions
    if (savedVersions.some(version => version.name === name)) {
      toastr.error("Version name already exists. Please choose a different name.");
      return;
    }

    // Show spinner and disable button
    $("#saveAsSubmitBtn").prop("disabled", true);
    $("#saveAsLoadingSpinner").removeClass("d-none");
    $("#saveAsBtnText").text("Saving...");

    let nominationAggregate = [];

    liftingAmendmentData.forEach((row) => {
      if (!Array.isArray(row.nomination)) return;
      row.nomination.forEach((nom) => {
        Object.keys(nom).forEach((key) => {
          if (key.startsWith("scheduledQty_")) {
            const productCode = key.split("_")[1];
            const matchingRaw = (originalNominationList || []).find(
              (n) =>
                n.NOMINATION_NO === nom.nominationNumber &&
                n.PRODUCT_CODE === productCode &&
                Number(n.DATE_VALUE) === row.date
            );

            nominationAggregate.push({
              VERSION_NO:
                matchingRaw?.VERSION_NO ??
                activeVersionFromReadAPI?.VERSION_NO ??
                -1,
              HISTORY_NO: matchingRaw?.HISTORY_NO ?? null,
              PRODUCT_GROUP:
                matchingRaw?.PRODUCT_GROUP ?? selection.productGroupCode,
              LOCATION: matchingRaw?.LOCATION ?? selection.locationCode,
              MONTH_VALUE:
                matchingRaw?.MONTH_VALUE ??
                selection.month.replace(" ", "").toUpperCase(),
              KS_ROW_NUM: matchingRaw?.KS_ROW_NUM ?? null,
              DATE_VALUE: row.date,
              DATE_VALUE_ADJ: nom.DATE_VALUE_ADJ ?? row.date,
              NOMINATION_NO: nom.nominationNumber,
              CUSTOMER_NAME: nom.customerName,
              SHIP_NAME: nom.shipName,
              PRODUCT_CODE: productCode,
              SCHEDULED_QTY: nom[`scheduledQty_${productCode}`] || 0,
              SCHEDULED_QTY_ADJ: nom[`adjustedQty_${productCode}`] || 0,
              ACTUAL_QTY:
                matchingRaw?.ACTUAL_QTY ??
                (nom[`scheduledQty_${productCode}`] || 0),
            });
          }
        });
      });
    });

    let transformedOpeningInventory = [];
    if (openingInventoryData && Array.isArray(openingInventoryData)) {
      openingInventoryData.forEach((item) => {
        const { Date, ...productEntries } = item;
        const dateDay = Number(Date);

        Object.entries(productEntries).forEach(([productCode, value]) => {
          const meta = (inventoryData || []).find(
            (inv) => inv.DATE_VALUE === dateDay && inv.PRODUCT_CODE === productCode
          );

          transformedOpeningInventory.push({
            VERSION_NO: meta?.VERSION_NO ?? activeVersionFromReadAPI?.VERSION_NO ?? -1,
            HISTORY_NO: meta?.HISTORY_NO ?? null,
            PRODUCT_GROUP: meta?.PRODUCT_GROUP ?? selection.productGroupCode,
            LOCATION: meta?.LOCATION ?? selection.locationCode,
            MONTH_VALUE: meta?.MONTH_VALUE ?? selection.month.replace(" ", "").toUpperCase(),
            KS_ROW_NUM: meta?.KS_ROW_NUM ?? null,
            DATE_VALUE: dateDay,
            PRODUCT_CODE: productCode,
            OPENING_INVENTORY: value || 0,
          });
        });
      });
    }

    const workingCapacityPayload = [];
    workingCapacityData.forEach((row) => {
      const date = row.Date;
      selection.products.forEach((product) => {
        workingCapacityPayload.push({
          DATE_VALUE: date,
          PRODUCT_CODE: product,
          WORKING_CAPACITY: row[product] || 0,
        });
      });
    });

    inventoryData = inventoryData.map((inv) => {
      const date = inv.DATE_VALUE;
      const product = inv.PRODUCT_CODE;
      const matchingRow = liftingAmendmentData.find((r) => r.date === date);

      return {
        ...inv,
        TERMINAL_AVAILS_ADJ: matchingRow?.[`adjustment_${product}TA`] || 0,
        CUSTOMER_LIFTING_ADJ: matchingRow?.[`adjustment_${product}CL`] || 0,
      };
    });

    const selectedAmendments = latestAmendmentRequests.map(original => {
      const $tr = $(
        `#customerAmendmentTable tbody tr[data-nomination-no="${original.NOMINATION_NO}"]`
      );

      const APPLY_BOTH = $tr.find(".apply-both-checkbox").is(":checked") ? "1" : "0";
      const APPLY_QTY = $tr.find(".apply-qty-checkbox").is(":checked") ? "1" : "0";
      const APPLY_DATE = $tr.find(".apply-date-checkbox").is(":checked") ? "1" : "0";

      return {
        ...original,
        APPLY_BOTH,
        APPLY_QTY,
        APPLY_DATE
      };
    });

    const versionPayload = {
      VERSION: {
        VERSION_NO: -1,
        VERSION_NAME: name,
        VERSION_DESCRIPTION: description,
      },
      INVENTORY: inventoryData,
      OPENING_INVENTORY: transformedOpeningInventory,
      WORKING_CAPACITY: workingCapacityPayload,
      NOMINATION: nominationAggregate,
      MIN_MAX_PERCENTAGE: minMaxPercentageData,
      NOM_AMD_DATA: selectedAmendments
    };

    console.log("Save As Payload:", versionPayload);

    try {
      // Fetch CSRF token
      const csrfResponse = await fetch(`${BASE_URL}${API_ENDPOINTS.CSRF}?_t=${Date.now()}`, {
        method: "GET",
        credentials: "include",
        headers: { "Cache-Control": "no-cache" },
      });
      const csrfToken = csrfResponse.headers.get("X-CSRF-TOKEN");
      if (!csrfToken) {
        throw new Error("Failed to fetch CSRF token");
      }

      // Make API request
      const response = await fetch(`${BASE_URL}${API_ENDPOINTS.SAVE}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-TOKEN": csrfToken,
          "Cache-Control": "no-cache",
        },
        credentials: "include",
        body: JSON.stringify(versionPayload),
      });

      if (!response.ok) {
        throw new Error("Save API failed with status: " + response.status);
      }

      const result = await response.json();
      console.log("Save As Success:", result);

      // Update active version info manually
      activeVersionFromReadAPI = {
        VERSION_NO: -1,
        VERSION_NAME: name,
        VERSION_DESCRIPTION: description,
      };

      // Update the header immediately
      updateHeader(selection);

      toastr.success(`Saved as "${name}"`);
      $("#saveAsModal").modal("hide");

      await handleReadApiData(result);
    } catch (error) {
      console.error("Save As Failed:", error);
      toastr.error("Failed to save version.");
    } finally {
      $("#saveAsSubmitBtn").prop("disabled", false);
      $("#saveAsLoadingSpinner").addClass("d-none");
      $("#saveAsBtnText").text("Save");
    }
  });

  let liftingAmendmentData = [],
    openingInventoryData = [],
    workingCapacityData = [],
    inventoryPlanningData = [],
    originalNominationList = [],
    countriesData = [],
    productCountryMap = {};

  let originalOpeningInventoryData = [],
    originalWorkingCapacityData = [],
    originalInventoryPlanningData = [];

  // Attach event to Change Unit button
  $("#changeUnitBtn").on("click", function () {
    const nameMap = window.productNameMap || {};
    let selectedUnit = $("#unitSelect").val();

    if (selectedUnit === "MB") {
      const fallbackUnit = $("#unitSelect option")
        .toArray()
        .map(o => o.value)
        .find(val => val !== "MB");

      selectedUnit = fallbackUnit || "KMT";
      $("#unitSelect").val(selectedUnit);
    }

    $("#unitSelect").trigger("change");
    $("#unitFactorTableBody").empty();

    selection.products.forEach(function (product) {
      const displayName = nameMap[product] || product;
      const key = `${product}_${selectedUnit}`;

      const backendFactor = availableUOMData.find(
        item =>
          item.PRODUCT_CODE === product &&
          item.CONVERSION_UNIT === selectedUnit
      )?.CONVERSION_FACTOR || 1;

      const factor = userUpdatedUOMFactors[key] ?? backendFactor;

      $("#unitFactorTableBody").append(`
      <tr>
        <td>${displayName}</td>
        <td>
          <input type="text" class="form-control factor-input" value="${factor}" />
        </td>
      </tr>
    `);
    });

    // Handle change of unit dropdown
    $("#unitSelect")
      .off("change")
      .on("change", function () {
        const selectedUnit = $(this).val();
        $("#unitFactorTableBody").empty();

        selection.products.forEach(function (product) {
          const key = `${product}_${selectedUnit}`;
          const backendFactor =
            availableUOMData.find(
              (item) =>
                item.PRODUCT_CODE === product &&
                item.CONVERSION_UNIT === selectedUnit
            )?.CONVERSION_FACTOR || 1;

          const factor = userUpdatedUOMFactors[key] ?? backendFactor;

          $("#unitFactorTableBody").append(`
          <tr>
            <td>${nameMap[product] || product}</td>
            <td>
              <input type="text" class="form-control factor-input" value="${factor}" />
            </td>
          </tr>
        `);
        });
      });
    $("#unitSelect").trigger("change");
    $("#changeUnitModal").modal("show");
  });

  $("#saveUnitChanges").on("click", function () {
    const nameMap = window.productNameMap || {};
    const selectedUnit = $("#unitSelect").val();
    let factors = {};

    $("#unitFactorTableBody tr").each(function () {
      const displayName = $(this).find("td:first").text();
      const productCode = Object.keys(nameMap).find(
        (code) => nameMap[code] === displayName || code === displayName
      );

      const factor = parseFloat($(this).find("input.factor-input").val()) || 1;

      if (productCode) {
        userUpdatedUOMFactors[`${productCode}_${selectedUnit}`] = factor;
        factors[productCode] = factor;
      }
    });

    currentUnit = selectedUnit;
    unitConversionFactors = factors;

    console.log("New unit:", currentUnit);
    console.log("Conversion factors:", unitConversionFactors);

    toastr.success("Unit conversion applied: " + currentUnit);
    recalculateLiftingData();
    $("#liftingAmendmentGrid").dxDataGrid("instance").refresh();
    renderAllKpiCards();
    $("#changeUnitModal").modal("hide");
  });

  $("#updateUnitChanges").on("click", async function () {
    const updateBtn = $(this);
    const saveBtn = $("#saveUnitChanges");
    const closeBtn = $("#closeUnitModalBtn");
    const nameMap = window.productNameMap || {};
    closeBtn.prop("disabled", true);

    updateBtn
      .prop("disabled", true)
      .html(
        '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Updating...'
      );
    saveBtn.prop("disabled", true);
    closeBtn.prop("disabled", false);

    const selectedUnit = $("#unitSelect").val();
    let factors = {};

    $("#unitFactorTableBody tr").each(function () {
      const displayName = $(this).find("td:first").text();
      const productCode = Object.keys(nameMap).find(
        (code) => nameMap[code] === displayName || code === displayName
      );

      const factor = parseFloat($(this).find("input.factor-input").val()) || 1;

      if (productCode) {
        userUpdatedUOMFactors[`${productCode}_${selectedUnit}`] = factor;
        factors[productCode] = factor;
      }
    });

    const csrfToken = await fetchCSRFToken();

    const payload = {
      FACTORS: Object.entries(factors).map(([productCode, factor]) => ({
        PRODUCT_CODE: productCode,
        CONVERSION_FACTOR: factor,
        PRODUCT_GROUP: selection.productGroupCode,
        CONVERSION_UNIT: selectedUnit,
      })),
    };

    try {
      const response = await fetch(`${BASE_URL}${API_ENDPOINTS.UPDATE_UOM}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-TOKEN": csrfToken,
          "Cache-Control": "no-cache",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Failed to update UOM");

      const contentType = response.headers.get("Content-Type") || "";
      if (contentType.includes("application/json")) {
        const result = await response.json();
        console.log("UOM Update Success:", result);
      } else {
        console.log("UOM Update Success: No response body");
      }

      toastr.success("Unit conversion updated successfully!");
      currentUnit = selectedUnit;
      unitConversionFactors = factors;

      recalculateLiftingData();
      $("#liftingAmendmentGrid").dxDataGrid("instance").refresh();
      renderAllKpiCards();
    } catch (error) {
      console.error("UOM Update Failed:", error);
      toastr.error("Failed to update unit conversion.");
    } finally {
      updateBtn.prop("disabled", false).html("Update");
      saveBtn.prop("disabled", false);
      closeBtn.prop("disabled", false);
      $("#changeUnitModal").modal("hide");
    }
  });

  $("#resetToMbBtn").on("click", function () {
    const nameMap = window.productNameMap || {};
    const defaultUnit = "MB";

    if (!$("#unitSelect option[value='MB']").length) {
      $("#unitSelect").prepend(`<option value="MB">MB</option>`);
    }

    $("#unitSelect").val(defaultUnit);

    $("#unitSelect").off("focus").on("focus", function () {
      $(this).find("option[value='MB']").remove();
    });

    $("#unitFactorTableBody").empty();

    selection.products.forEach(function (product) {
      const key = `${product}_${defaultUnit}`;
      const backendFactor = availableUOMData.find(
        item =>
          item.PRODUCT_CODE === product &&
          item.CONVERSION_UNIT === defaultUnit
      )?.CONVERSION_FACTOR || 1;

      userUpdatedUOMFactors[key] = backendFactor;

      $("#unitFactorTableBody").append(`
       <tr>
         <td>${nameMap[product] || product}</td>
         <td>
           <input type="text" class="form-control factor-input" value="${backendFactor}" />
         </td>
       </tr>
     `);
    });

    $("#saveUnitChanges").trigger("click");
  });

  async function handleReadApiData(data) {
    try {
      $("#loadingSpinner").show();

      const isInternational = (selection.terminal?.toLowerCase() === "international");

      // Store GOSP_VERSIONS
      gospVersions = data.GOSP_VERSIONS || [];

      const productConversionMap = {};
      data.UOM?.forEach((item) => {
        window.availableUOMData = data.UOM || [];

        // Extract and populate unique units into the dropdown
        const uniqueUnits = [...new Set(window.availableUOMData.map(u => u.CONVERSION_UNIT))];
        const $unitSelect = $("#unitSelect");
        $unitSelect.empty();
        uniqueUnits.forEach(unit => {
          $unitSelect.append(`<option value="${unit}">${unit}</option>`);
        });
        const defaultUnit = uniqueUnits.includes("KMT") ? "KMT" : uniqueUnits[0];
        $unitSelect.val(defaultUnit);
        window.currentUnit = defaultUnit;

        const productConversionMap = {};
        window.availableUOMData.forEach((item) => {
          const key = `${item.PRODUCT_CODE}_${item.CONVERSION_UNIT}`;
          productConversionMap[key] = item.CONVERSION_FACTOR;
        });
      });

      // Apply selected unit's factors
      selection.products.forEach((product) => {
        const key = `${product}_${currentUnit}`;
        unitConversionFactors[product] = productConversionMap[key] || 1;
      });

      const productNameMap = {};
      data.UOM.forEach(item => {
        productNameMap[item.PRODUCT_CODE] = item.PRODUCT_CODE_NAME;
      });
      // save it globally so your grid init can see it
      window.productNameMap = productNameMap;

      // INVENTORY
      liftingAmendmentData = [];
      data.INVENTORY.forEach((inv) => {
        const date = Number(inv.DATE_VALUE);
        let row = liftingAmendmentData.find((r) => r.date === date);
        if (!row) {
          row = { date, id: "row_" + date };
          liftingAmendmentData.push(row);
        }
        const p = inv.PRODUCT_CODE;
        if (isInternational) {
          const suffix = `${p}_${inv.LOCATION}`;
          row[`terminalAvails_${suffix}`] = inv.TERMINAL_AVAILS || 0;
          row[`adjustment_${suffix}TA`] = inv.TERMINAL_AVAILS_ADJ || 0;
          row[`customerLifting_${suffix}`] = inv.CUSTOMER_LIFTING || 0;
          row[`adjustment_${suffix}CL`] = inv.CUSTOMER_LIFTING_ADJ || 0;
          row[`closingInventory_${suffix}`] = inv.CLOSING_INVENTORY || 0;
        } else {
          row[`terminalAvails_${p}`] = inv.TERMINAL_AVAILS || 0;
          row[`adjustment_${p}TA`] = inv.TERMINAL_AVAILS_ADJ || 0;
          row[`customerLifting_${p}`] = inv.CUSTOMER_LIFTING || 0;
          row[`adjustment_${p}CL`] = inv.CUSTOMER_LIFTING_ADJ || 0;
          row[`closingInventory_${p}`] = inv.CLOSING_INVENTORY || 0;
        }
      });

      inventoryData = data.INVENTORY.map((inv) => {
        const includeOnlyAdj =
          !inv.TERMINAL_AVAILS &&
          !inv.CUSTOMER_LIFTING &&
          !inv.CLOSING_INVENTORY &&
          !inv.MIN_CAPACITY &&
          !inv.MAX_CAPACITY;

        if (includeOnlyAdj) {
          return {
            VERSION_NO: inv.VERSION_NO,
            HISTORY_NO: inv.HISTORY_NO,
            PRODUCT_GROUP: inv.PRODUCT_GROUP,
            LOCATION: inv.LOCATION,
            MONTH_VALUE: inv.MONTH_VALUE,
            KS_ROW_NUM: inv.KS_ROW_NUM,
            DATE_VALUE: inv.DATE_VALUE,
            PRODUCT_CODE: inv.PRODUCT_CODE,
            TERMINAL_AVAILS_ADJ: inv.TERMINAL_AVAILS_ADJ,
            CUSTOMER_LIFTING_ADJ: inv.CUSTOMER_LIFTING_ADJ,
          };
        } else {
          return { ...inv };
        }
      });

      // WORKING CAPACITY
      workingCapacityData = [];
      const workingCapacityMap = {};

      data.INVENTORY.forEach((inv) => {
        const date = Number(inv.DATE_VALUE);
        const product = inv.PRODUCT_CODE;

        if (!workingCapacityMap[date]) {
          workingCapacityMap[date] = { Date: date };
        }

        const min = Number(inv.MIN_CAPACITY) || 0;
        const max = Number(inv.MAX_CAPACITY) || 0;
        const capacity = max - min;

        if (isInternational) {
          workingCapacityMap[date][`${product}_${inv.LOCATION}`] = capacity;
        } else {
          workingCapacityMap[date][product] = capacity;
        }
      });

      workingCapacityData = Object.values(workingCapacityMap);

      // NOMINATION
      const getDayFromDateStr = (str) => Number(str);
      if (Array.isArray(data.NOMINATION)) {
        originalNominationList = data.NOMINATION;

        liftingAmendmentData.forEach((row) => {
          const match = data.NOMINATION.filter(
            (n) => getDayFromDateStr(n.DATE_VALUE) === row.date
          );
          if (match.length) {
            const nominationMap = {};

            match.forEach((n) => {
              const nomNo = n.NOMINATION_NO;
              if (!nominationMap[nomNo]) {
                nominationMap[nomNo] = {
                  nominationNumber: nomNo,
                  customerName: n.CUSTOMER_NAME,
                  shipName: n.SHIP_NAME,
                  SCHEDULED_TYPE: n.SCHEDULED_TYPE || "-",
                  location: isInternational ? n.LOCATION : "",
                  scheduledTotal: 0,
                  DATE_VALUE_ADJ: n.DATE_VALUE_ADJ || n.DATE_VALUE,
                };
              }

              const productField = `scheduledQty_${n.PRODUCT_CODE}`;
              const adjustedField = `adjustedQty_${n.PRODUCT_CODE}`;
              const actualField = `actualQty_${n.PRODUCT_CODE}`;

              nominationMap[nomNo][actualField] = n.ACTUAL_QTY || 0;
              nominationMap[nomNo][productField] = n.SCHEDULED_QTY;
              nominationMap[nomNo][adjustedField] = n.SCHEDULED_QTY_ADJ || 0;
              nominationMap[nomNo].scheduledTotal += n.SCHEDULED_QTY || 0;
            });

            row.nomination = Object.values(nominationMap);
          }
        });
      }

      // OPENING INVENTORY
      openingInventoryData = [];
      data.OPENING_INVENTORY.forEach((item) => {
        const date = Number(item.DATE_VALUE);
        let row = openingInventoryData.find((r) => r.Date === date);
        if (!row) {
          row = { Date: date };
          openingInventoryData.push(row);
        }
        if (isInternational) {
          row[`${item.PRODUCT_CODE}_${item.LOCATION}`] = item.OPENING_INVENTORY || 0;
        } else {
          row[item.PRODUCT_CODE] = item.OPENING_INVENTORY || 0;
        }
      });

      if (
        Array.isArray(data.MIN_MAX_PERCENTAGE) &&
        data.MIN_MAX_PERCENTAGE.length
      ) {
        let minRow = { Type: "Min" };
        let maxRow = { Type: "Max" };

        data.MIN_MAX_PERCENTAGE.forEach((item) => {
          const p = item.PRODUCT_CODE;
          if (isInternational) {
            minRow[`${p}_${item.LOCATION}`] = item.MIN_PERC || 0;
            maxRow[`${p}_${item.LOCATION}`] = item.MAX_PERC || 100;
          } else {
            minRow[p] = item.MIN_PERC || 0;
            maxRow[p] = item.MAX_PERC || 100;
          }
        });

        minMaxPercentageData = data.MIN_MAX_PERCENTAGE;

        inventoryPlanningData = [minRow, maxRow];
      } else {
        minMaxPercentageData = [];
        inventoryPlanningData = [];
        console.warn("⚠️ MIN_MAX_PERCENTAGE missing or empty in response");
      }

      // Saved Versions
      savedVersions = (data.LIST_VERSIONS || []).map((v) => ({
        id: String(v.VERSION_NO),
        name: v.VERSION_NAME,
        description: v.VERSION_DESCRIPTION,
      }));

      if (Array.isArray(data.VERSION) && data.VERSION.length > 0) {
        activeVersionFromReadAPI = {
          VERSION_NO: data.VERSION[0].VERSION_NO,
          VERSION_NAME: data.VERSION[0].VERSION_NAME,
          VERSION_DESCRIPTION: data.VERSION[0].VERSION_DESCRIPTION,
        };
      }

      // Deep clone for reset buttons
      originalOpeningInventoryData = JSON.parse(
        JSON.stringify(openingInventoryData)
      );
      originalWorkingCapacityData = JSON.parse(
        JSON.stringify(workingCapacityData)
      );
      originalInventoryPlanningData = JSON.parse(
        JSON.stringify(inventoryPlanningData)
      );

      storeOriginalNominationState();
      recalculateLiftingData();
      initializeApp();
      renderAllKpiCards();
    } catch (error) {
      console.error("handleReadApiData Failed:", error);
      toastr.error(`Failed to load response data.\n${error}`);
    } finally {
      $("#loadingSpinner").fadeOut();
    }
  };

  // Get CSRF token first
  async function fetchCSRFToken() {
    const csrfURL = `${BASE_URL}${API_ENDPOINTS.CSRF}?_t=${Date.now()}`;
    const res = await fetch(csrfURL, {
      method: "GET",
      credentials: "include",
      headers: { "Cache-Control": "no-cache" },
    });
    return res.headers.get("X-CSRF-TOKEN");
  }

  async function callReadAPIWithSelection(selection) {
    try {
      $("#loadingSpinner").show();
      window.selection = selection;

      const isInternational = (selection.terminal?.toLowerCase() === "international");

      // const csrfToken = await fetchCSRFToken();

      // const response = await fetch(
      //   `${BASE_URL}${API_ENDPOINTS.READ}`,
      //   {
      //     method: "POST",
      //     headers: {
      //       "Content-Type": "application/json",
      //       "X-CSRF-TOKEN": csrfToken,
      //       "Cache-Control": "no-cache",
      //     },
      //     credentials: "include",
      //     body: JSON.stringify({
      //       LOCATION: selection.locationCode,
      //       PRODUCT_GROUP: selection.productGroupCode,
      //       PRODUCT_CODE: selection.productCodes,
      //       MONTH_VALUE: selection.month.replace(" ", "").toUpperCase(),
      //       VERSION_NO: Number(selection.versionNo),
      //     }),
      //   }
      // );
      // if (!response.ok) {
      //   throw new Error(`API request failed with status: ${response.status}`);
      // }
      // const data = await response.json();

      // Local mock JSON instead of API
      const response = await fetch("../response/lifting-amendment.json");
      const data = await response.json();

      // SPOT OPPORTUNITY
      const optParamArray = data.OPT_PARAMETER || [];
      window.originalOptParameters = optParamArray;
      const optMap = {};

      optParamArray.forEach(param => {
        const name = (param.PARAMETER_NM || "").toUpperCase();
        const value = param.PARAMETER_VALUE || "--";

        if (name === "MAX_SHIP_PER_DAY") optMap.maxShipPerDay = value;
        else if (name === "MIN_PRODUCT_QTY") optMap.minProductQty = value;
        else if (name === "MAX_PRODUCT_QTY") optMap.maxProductQty = value;
        else if (name === "MAX_SHIP_SIZE") optMap.maxShipSize = value;
      });

      window.optimizationParameters = {
        maxShipPerDay: optMap.maxShipPerDay || "--",
        minProductQty: optMap.minProductQty || "--",
        maxProductQty: optMap.maxProductQty || "--",
        maxShipSize: optMap.maxShipSize || "--"
      };

      gospVersions = data.GOSP_VERSIONS || [];
      if (Array.isArray(gospVersions) && gospVersions.length > 0) {
        $("#fetchGospAvailsBtn").removeClass("disabled");
      } else {
        $("#fetchGospAvailsBtn").addClass("disabled");
      }

      // Extract INTERNATIONAL flag from VERSIONS section
      window.versionsData = data.VERSION || [];

      latestAmendmentRequests = data.NOM_AMD_DATA || [];
      if (Array.isArray(latestAmendmentRequests) && latestAmendmentRequests.length > 0) {
        $("#customerAmendmentRequestsBtn").removeClass("disabled");
      } else {
        $("#customerAmendmentRequestsBtn").addClass("disabled");
      }

      const productNameMap = {};
      const productCodeMap = {};

      data.UOM.forEach(item => {
        productNameMap[item.PRODUCT_CODE] = item.PRODUCT_CODE_NAME;
        productCodeMap[item.PRODUCT_CODE_NAME.toLowerCase()] = item.PRODUCT_CODE;
      });

      window.productNameMap = productNameMap;
      window.productCodeMap = productCodeMap;

      countriesData = data.COUNTRIES || [];

      const productConversionMap = {};
      data.UOM?.forEach((item) => {
        window.availableUOMData = data.UOM || [];

        // Extract and populate unique units into the dropdown
        const uniqueUnits = [...new Set(window.availableUOMData.map(u => u.CONVERSION_UNIT))];
        const $unitSelect = $("#unitSelect");
        $unitSelect.empty();
        uniqueUnits.forEach(unit => {
          $unitSelect.append(`<option value="${unit}">${unit}</option>`);
        });
        const defaultUnit = uniqueUnits.includes("KMT") ? "KMT" : uniqueUnits[0];
        $unitSelect.val(defaultUnit);
        window.currentUnit = defaultUnit;

        const productConversionMap = {};
        window.availableUOMData.forEach((item) => {
          const key = `${item.PRODUCT_CODE}_${item.CONVERSION_UNIT}`;
          productConversionMap[key] = item.CONVERSION_FACTOR;
        });

      });

      selection.products.forEach((product) => {
        const key = `${product}_${currentUnit}`;
        unitConversionFactors[product] = productConversionMap[key] || 1;
      });

      liftingAmendmentData = [];
      data.INVENTORY.forEach((inv) => {
        const date = Number(inv.DATE_VALUE);
        let row = liftingAmendmentData.find((r) => r.date === date);
        if (!row) {
          row = { date, id: "row_" + date };
          liftingAmendmentData.push(row);
        }
        const p = inv.PRODUCT_CODE;
        if (isInternational) {
          const suffix = `${p}_${inv.LOCATION}`;
          row[`terminalAvails_${suffix}`] = inv.TERMINAL_AVAILS || 0;
          row[`adjustment_${suffix}TA`] = inv.TERMINAL_AVAILS_ADJ || 0;
          row[`customerLifting_${suffix}`] = inv.CUSTOMER_LIFTING || 0;
          row[`adjustment_${suffix}CL`] = inv.CUSTOMER_LIFTING_ADJ || 0;
          row[`closingInventory_${suffix}`] = inv.CLOSING_INVENTORY || 0;
        } else {
          row[`terminalAvails_${p}`] = inv.TERMINAL_AVAILS || 0;
          row[`adjustment_${p}TA`] = inv.TERMINAL_AVAILS_ADJ || 0;
          row[`customerLifting_${p}`] = inv.CUSTOMER_LIFTING || 0;
          row[`adjustment_${p}CL`] = inv.CUSTOMER_LIFTING_ADJ || 0;
          row[`closingInventory_${p}`] = inv.CLOSING_INVENTORY || 0;
        }
      });

      inventoryData = data.INVENTORY.map((inv) => {
        const includeOnlyAdj =
          !inv.TERMINAL_AVAILS &&
          !inv.CUSTOMER_LIFTING &&
          !inv.CLOSING_INVENTORY &&
          !inv.MIN_CAPACITY &&
          !inv.MAX_CAPACITY;

        if (includeOnlyAdj) {
          return {
            VERSION_NO: inv.VERSION_NO,
            HISTORY_NO: inv.HISTORY_NO,
            PRODUCT_GROUP: inv.PRODUCT_GROUP,
            LOCATION: inv.LOCATION,
            MONTH_VALUE: inv.MONTH_VALUE,
            KS_ROW_NUM: inv.KS_ROW_NUM,
            DATE_VALUE: inv.DATE_VALUE,
            PRODUCT_CODE: inv.PRODUCT_CODE,
            TERMINAL_AVAILS_ADJ: inv.TERMINAL_AVAILS_ADJ,
            CUSTOMER_LIFTING_ADJ: inv.CUSTOMER_LIFTING_ADJ,
          };
        } else {
          return { ...inv };
        }
      });

      workingCapacityData = [];
      const workingCapacityMap = {};

      data.INVENTORY.forEach((inv) => {
        const date = Number(inv.DATE_VALUE);
        const product = inv.PRODUCT_CODE;

        if (!workingCapacityMap[date]) {
          workingCapacityMap[date] = { Date: date };
        }

        const min = Number(inv.MIN_CAPACITY) || 0;
        const max = Number(inv.MAX_CAPACITY) || 0;
        const capacity = max - min;

        if (isInternational) {
          workingCapacityMap[date][`${product}_${inv.LOCATION}`] = capacity;
        } else {
          workingCapacityMap[date][product] = capacity;
        }
      });

      workingCapacityData = Object.values(workingCapacityMap);

      const getDayFromDateStr = (str) => Number(str);
      if (Array.isArray(data.NOMINATION)) {
        originalNominationList = data.NOMINATION;

        liftingAmendmentData.forEach((row) => {
          const match = data.NOMINATION.filter(
            (n) => getDayFromDateStr(n.DATE_VALUE) === row.date
          );
          if (match.length) {
            const nominationMap = {};

            match.forEach((n) => {
              const nomNo = n.NOMINATION_NO;
              if (!nominationMap[nomNo]) {
                nominationMap[nomNo] = {
                  nominationNumber: nomNo,
                  customerName: n.CUSTOMER_NAME,
                  shipName: n.SHIP_NAME,
                  SCHEDULED_TYPE: n.SCHEDULED_TYPE || "-",
                  location: isInternational ? n.LOCATION : "",
                  scheduledTotal: 0,
                  DATE_VALUE_ADJ: n.DATE_VALUE_ADJ || n.DATE_VALUE,
                };
              }

              const productCode = n.PRODUCT_CODE;
              const productField = `scheduledQty_${productCode}`;
              const adjustedField = `adjustedQty_${productCode}`;
              const actualField = `actualQty_${productCode}`;

              nominationMap[nomNo][productField] = n.SCHEDULED_QTY;
              nominationMap[nomNo][adjustedField] = n.SCHEDULED_QTY_ADJ || 0;
              nominationMap[nomNo][actualField] = n.ACTUAL_QTY || 0;
              nominationMap[nomNo].scheduledTotal += n.SCHEDULED_QTY || 0;
            });

            row.nomination = Object.values(nominationMap);
          }
        });
      }

      openingInventoryData = [];
      data.OPENING_INVENTORY.forEach((item) => {
        const date = Number(item.DATE_VALUE);
        let row = openingInventoryData.find((r) => r.Date === date);
        if (!row) {
          row = { Date: date };
          openingInventoryData.push(row);
        }
        if (isInternational) {
          row[`${item.PRODUCT_CODE}_${item.LOCATION}`] = item.OPENING_INVENTORY || 0;
        } else {
          row[item.PRODUCT_CODE] = item.OPENING_INVENTORY || 0;
        }
      });

      let minRow = { Type: "Min" };
      let maxRow = { Type: "Max" };
      data.MIN_MAX_PERCENTAGE.forEach((item) => {
        const p = item.PRODUCT_CODE;
        if (isInternational) {
          minRow[`${p}_${item.LOCATION}`] = item.MIN_PERC || 0;
          maxRow[`${p}_${item.LOCATION}`] = item.MAX_PERC || 100;
        } else {
          minRow[p] = item.MIN_PERC || 0;
          maxRow[p] = item.MAX_PERC || 100;
        }

      });
      inventoryPlanningData = [minRow, maxRow];
      minMaxPercentageData = data.MIN_MAX_PERCENTAGE;

      savedVersions = (data.LIST_VERSIONS || []).map((v) => ({
        id: String(v.VERSION_NO),
        name: v.VERSION_NAME,
        description: v.VERSION_DESCRIPTION,
      }));

      if (Array.isArray(data.VERSION) && data.VERSION.length > 0) {
        activeVersionFromReadAPI = {
          VERSION_NO: data.VERSION[0].VERSION_NO,
          VERSION_NAME: data.VERSION[0].VERSION_NAME,
          VERSION_DESCRIPTION: data.VERSION[0].VERSION_DESCRIPTION,
        };
      }

      updateHeader(selection);

      originalOpeningInventoryData = JSON.parse(JSON.stringify(openingInventoryData));
      originalWorkingCapacityData = JSON.parse(JSON.stringify(workingCapacityData));
      originalInventoryPlanningData = JSON.parse(JSON.stringify(inventoryPlanningData));

      storeOriginalNominationState();
      recalculateLiftingData();
      initializeApp();
      renderAllKpiCards();
    } catch (error) {
      setupModals
      console.error("❌ read_api Call Failed:", error);
      toastr.error(`Failed to load data from backend.\n${error}`);
    } finally {
      $("#loadingSpinner").fadeOut();
    }
  };

  function initializeApp() {
    $("#resetOpeningInventory").on("click", function () {
      openingInventoryData = JSON.parse(
        JSON.stringify(originalOpeningInventoryData)
      );
      $("#openingInventoryGrid")
        .dxDataGrid("instance")
        .option("dataSource", openingInventoryData);

      recalculateLiftingData();
      $("#liftingAmendmentGrid").dxDataGrid("instance").refresh();
      renderAllKpiCards();
    });

    $("#resetWorkingCapacity").on("click", function () {
      workingCapacityData = JSON.parse(
        JSON.stringify(originalWorkingCapacityData)
      );
      $("#workingCapacityGrid")
        .dxDataGrid("instance")
        .option("dataSource", workingCapacityData);

      recalculateLiftingData();
      $("#liftingAmendmentGrid").dxDataGrid("instance").refresh();
      renderAllKpiCards();
    });

    $("#resetInventoryPlanning").on("click", function () {
      inventoryPlanningData = JSON.parse(
        JSON.stringify(originalInventoryPlanningData)
      );
      $("#inventoryPlanningGrid")
        .dxDataGrid("instance")
        .option("dataSource", inventoryPlanningData);

      // 🔄 Also update violation highlights and KPI cards
      recalculateLiftingData();
      $("#liftingAmendmentGrid").dxDataGrid("instance").refresh();
      renderAllKpiCards();
    });

    setupModals();
    renderAllKpiCards();
    initializeLiftingAmendmentGrid();

    $("#printToPDF").on("click", function () {
      generatePDF();
    });

    // Open confirmation modal (Bootstrap 4)
    $("#resetAdjustmentsBtn").on("click", function () {
      $("#resetAdjustmentsConfirmModal").modal("show");
    });

    // Handle confirm reset
    $("#confirmResetAdjustmentsBtn").on("click", function () {
      $("#resetAdjustmentsConfirmModal").modal("hide");

      if (!Array.isArray(liftingAmendmentData)) return;

      // Clear and restore all nominations
      const newOriginalNominationMap = {};

      liftingAmendmentData.forEach((row) => {
        const currentDate = row.date;
        if (!Array.isArray(row.nomination)) return;

        const nominationsCopy = [...row.nomination];

        for (const nomination of nominationsCopy) {
          const nomId = nomination.nominationNumber.toString();
          const original = originalNominationMap[nomId];

          // Build fallback if not tracked
          const fallbackOriginal = {
            originalDate: nomination.DATE_VALUE || currentDate,
            adjustedQty: selection.products.reduce((acc, p) => {
              acc[p] = 0;
              return acc;
            }, {})
          };

          const originalDate = original?.originalDate ?? fallbackOriginal.originalDate;

          // Remove from current row
          const index = row.nomination.findIndex((n) => n.nominationNumber.toString() === nomId);
          if (index !== -1) {
            const nom = row.nomination.splice(index, 1)[0];

            // Zero out adjusted qty
            selection.products.forEach((p) => {
              nom[`adjustedQty_${p}`] = 0;
            });

            // Push to target row
            const targetRow = liftingAmendmentData.find(r => Number(r.date) === originalDate);
            if (!targetRow) continue;

            if (!Array.isArray(targetRow.nomination)) targetRow.nomination = [];
            targetRow.nomination.push(nom);

            nom.DATE_VALUE_ADJ = originalDate;

            // Update backup map
            newOriginalNominationMap[nomId] = {
              originalDate,
              adjustedQty: selection.products.reduce((acc, p) => {
                acc[p] = 0;
                return acc;
              }, {})
            };
          }
        }
      });

      // Replace with updated originalNominationMap
      originalNominationMap = newOriginalNominationMap;

      // Reset adjustment and KPI
      liftingAmendmentData.forEach((row) => {
        selection.products.forEach((product) => {
          row[`adjustment_${product}TA`] = 0;
          row[`adjustment_${product}CL`] = Array.isArray(row.nomination)
            ? row.nomination.reduce((sum, n) => sum + (Number(n[`adjustedQty_${product}`]) || 0), 0)
            : 0;
        });
      });

      recalculateLiftingData();
      const grid = $("#liftingAmendmentGrid").dxDataGrid("instance");
      grid.option("dataSource", liftingAmendmentData);
      grid.refresh();

      renderAllKpiCards();

      $(".apply-both-checkbox, .apply-qty-checkbox, .apply-date-checkbox").prop("checked", false);
      $("#checkAllBoth, #checkAllQty, #checkAllDate").prop("checked", false);

      latestAmendmentRequests.forEach(r => {
        r.APPLY_BOTH = "0";
        r.APPLY_QTY = "0";
        r.APPLY_DATE = "0";
      });

      updateFooterButtons();

      // Rebuild modal table with updated nominations
      const tableBody = $("#adjustedNominationsTableBody").empty();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      liftingAmendmentData.forEach((row) => {
        if (!Array.isArray(row.nomination)) return;

        const currentDate = row.date;
        const nominationDate = new Date(parseInt(yearStr), monthMap[monthStr], currentDate);
        nominationDate.setHours(0, 0, 0, 0);
        const isFutureOrToday = nominationDate >= today;
        if (!isFutureOrToday) return;

        row.nomination.forEach((nom) => {
          const original = originalNominationMap[nom.nominationNumber];
          const originalDate = (original?.originalDate ?? nom.DATE_VALUE) || currentDate;
          const changedDate = currentDate !== originalDate;

          let changedQty = selection.products.some((p) => {
            const adjusted = parseFloat(nom[`adjustedQty_${p}`] || 0);
            return adjusted > 0;
          });

          const shouldShow = changedDate || changedQty;
          if (!shouldShow) return;

          let action = "";
          if (changedDate && changedQty) action = "Both Changed";
          else if (changedDate) action = "Date Changed";
          else if (changedQty) action = "Qty Changed";

          tableBody.append(`
        <tr data-nom-id="${nom.nominationNumber}">
          <td>${nom.nominationNumber}</td>
          <td>${nom.customerName || "-"}</td>
          <td>${nom.shipName || "-"}</td>
          <td>${originalDate}</td>
          <td>${currentDate}</td>
          <td><strong>${action}</strong></td>
          <td><button class="btn btn-sm btn-warning reset-nomination-btn">Reset</button></td>
        </tr>
      `);
        });
      });

      toastr.success("All adjustments and nomination moves have been reset.");
    });
  }

  function generatePDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const usableWidth = pageWidth - 2 * margin;
    const usableHeight = pageHeight - 2 * margin;

    // Header lines (common for all pages)
    const headerLines = [
      `Date: ${new Date().toLocaleDateString()}`,
      `Terminal: ${selection.terminal} | Group: ${selection.productGroup}`,
      `Planning: ${selection.month} | Products: ${selection.products.join(", ")}`,
    ];

    // Loop through each product and create a page for each
    selection.products.forEach((product, idx) => {
      if (idx > 0) doc.addPage();

      // Product Title
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text(`Product: ${window.productNameMap?.[product] || product}`,
        margin, margin + 2
      );

      // Header Info
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      headerLines.forEach((line, i) => {
        doc.text(line, margin, margin + 12 + i * 5);
      });

      // Table columns for this product
      const columns = [
        { header: "Date", dataKey: "date", width: 15 },
        { header: "Term", dataKey: `terminalAvails_${product}`, width: 18 },
        { header: "Adj TA", dataKey: `adjustment_${product}TA`, width: 18 },
        { header: "Cust", dataKey: `customerLifting_${product}`, width: 18 },
        { header: "Adj CL", dataKey: `adjustment_${product}CL`, width: 18 },
        { header: "Clos Inv", dataKey: `closingInventory_${product}`, width: 22 },
        { header: "%", dataKey: `closingPercentage_${product}`, width: 14 },
        { header: "Ships", dataKey: "numberOfShips", width: 14 },
        { header: "Total Lift", dataKey: "totalLifting", width: 18 },
        { header: "Lift/2D", dataKey: "liftingPer2Days", width: 18 },
      ];

      // Table data for this product
      const tableData = liftingAmendmentData.map((row) => {
        return {
          date: formatDateMMDDYYYY(new Date(parseInt(yearStr), monthMap[monthStr], row.date)), [`terminalAvails_${product}`]: row[`terminalAvails_${product}`]?.toLocaleString() || "0",
          [`adjustment_${product}TA`]: row[`adjustment_${product}TA`]?.toLocaleString() || "0",
          [`customerLifting_${product}`]: row[`customerLifting_${product}`]?.toLocaleString() || "0",
          [`adjustment_${product}CL`]: row[`adjustment_${product}CL`]?.toLocaleString() || "0",
          [`closingInventory_${product}`]: row[`closingInventory_${product}`]?.toLocaleString() || "0",
          [`closingPercentage_${product}`]: row[`closingPercentage_${product}`] || "0%",
          numberOfShips: row.numberOfShips?.toLocaleString() || "0",
          totalLifting: row.totalLifting?.toLocaleString() || "0",
          liftingPer2Days: row.liftingPer2Days?.toLocaleString() || "0",
        };
      });

      // Table styling
      doc.autoTable({
        startY: margin + 30,
        head: [columns.map((col) => col.header)],
        body: tableData.map((row) => columns.map((col) => row[col.dataKey])),
        theme: "grid",
        margin: { left: margin, right: margin },
        styles: {
          fontSize: 8,
          cellPadding: 2.5,
          font: "helvetica",
          overflow: "linebreak",
        },
        headStyles: {
          fillColor: [220, 220, 220],
          textColor: [0, 0, 0],
          fontStyle: "bold",
        },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        columnStyles: columns.reduce((acc, col, i) => {
          acc[i] = { cellWidth: col.width };
          return acc;
        }, {}),
        didDrawPage: function (data) {
          // Page number at the bottom right
          doc.setFontSize(9);
          doc.text(
            `Page ${doc.internal.getNumberOfPages()}`,
            pageWidth - margin - 15,
            pageHeight - 7
          );
        },
      });
    });

    doc.save(`Lifting_Amendment_${selection.month.replace(" ", "_")}.pdf`);
  }

  function setupModals() {
    $("#btnOpeningInventory").click(() =>
      $("#openingInventoryModal").modal("show")
    );
    $("#btnWorkingCapacity").click(() =>
      $("#workingCapacityModal").modal("show")
    );
    $("#btnInventoryPlanning").click(() =>
      $("#inventoryPlanningModal").modal("show")
    );

    // 🔹 Opening Inventory Modal
    $("#openingInventoryModal").on("shown.bs.modal", () => {
      const tempOpeningData = JSON.parse(JSON.stringify(openingInventoryData));

      createGrid(
        "#openingInventoryGrid",
        tempOpeningData,
        "Opening Inventory",
        false,
        true
      );

      $("#saveOpeningInventory")
        .off("click")
        .on("click", function () {
          const grid = $("#openingInventoryGrid").dxDataGrid("instance");
          grid.saveEditData();

          openingInventoryData = JSON.parse(JSON.stringify(tempOpeningData));
          $("#openingInventoryModal").modal("hide");
          recalculateLiftingData();
          $("#liftingAmendmentGrid").dxDataGrid("instance").refresh();
          renderAllKpiCards();
        });
    });

    // 🔹 Working Capacity Modal
    $("#workingCapacityModal").on("shown.bs.modal", () => {
      const tempWorkingCapacity = JSON.parse(
        JSON.stringify(workingCapacityData)
      );
      const totalHeight = Math.min(tempWorkingCapacity.length * 35 + 40, 500);

      createGrid(
        "#workingCapacityGrid",
        tempWorkingCapacity,
        "Working Capacity",
        false,
        true,
        totalHeight
      );

      $("#saveWorkingCapacity")
        .off("click")
        .on("click", function () {
          const grid = $("#workingCapacityGrid").dxDataGrid("instance");
          grid.saveEditData();

          workingCapacityData = JSON.parse(JSON.stringify(tempWorkingCapacity));
          $("#workingCapacityModal").modal("hide");
          recalculateLiftingData();
          $("#liftingAmendmentGrid").dxDataGrid("instance").refresh();
          renderAllKpiCards();
        });
    });

    // 🔹 Inventory Planning Modal
    $("#inventoryPlanningModal").on("shown.bs.modal", () => {
      const tempInventoryPlanning = JSON.parse(
        JSON.stringify(inventoryPlanningData)
      );

      createGrid(
        "#inventoryPlanningGrid",
        tempInventoryPlanning,
        "Inventory Planning %",
        true
      );

      $("#saveInventoryPlanning")
        .off("click")
        .on("click", function () {
          const grid = $("#inventoryPlanningGrid").dxDataGrid("instance");
          grid.saveEditData();

          inventoryPlanningData = JSON.parse(
            JSON.stringify(tempInventoryPlanning)
          );
          $("#inventoryPlanningModal").modal("hide");
          recalculateLiftingData();
          $("#liftingAmendmentGrid").dxDataGrid("instance").refresh();
          renderAllKpiCards();
        });
    });

    // Close modals when Reset is clicked
    $("#resetOpeningInventory").on("click", function () {
      $("#openingInventoryModal").modal("hide");
    });

    $("#resetWorkingCapacity").on("click", function () {
      $("#workingCapacityModal").modal("hide");
    });

    $("#resetInventoryPlanning").on("click", function () {
      $("#inventoryPlanningModal").modal("hide");
    });
  }

  function createGrid(
    selector,
    dataSource,
    title,
    isInventoryPlanning = false,
    hasDate = false,
    totalGridHeight
  ) {
    $(selector).dxDataGrid({
      dataSource,
      showBorders: true,
      paging: false,
      columnAutoWidth: true,
      width: "100%",
      height: totalGridHeight || "100%",
      editing: { mode: "cell", allowUpdating: editingEnabled },
      columns: generateColumns(),
      onEditingStart: function (e) {
        const rowDay = parseInt(e.data.Date, 10);

        // If the planning month is entirely in the past, block editing.
        if (planningDate < currentMonthDate) {
          e.cancel = true;
          return;
        }

        // If the planning month is the current month, only allow editing on dates >= today.
        const isSameMonth =
          planningDate.getFullYear() === today.getFullYear() &&
          planningDate.getMonth() === today.getMonth();

        if (isSameMonth && rowDay < today.getDate()) {
          e.cancel = true;
          return;
        }
      },
      onCellPrepared: function (e) {
        if (e.rowType !== "data") return;

        // full JS Date for this row
        const cellDate = new Date(
          parseInt(yearStr),
          monthMap[monthStr],
          Number(e.data.Date)
        );
        cellDate.setHours(0, 0, 0, 0);

        const todayZero = new Date();
        todayZero.setHours(0, 0, 0, 0);

        if (cellDate < todayZero) {
          // past rows → grey + block
          $(e.cellElement).css({
            backgroundColor: "#eee",
            color: "#999",
            cursor: "not-allowed",
          });
        } else {
          // today/future → editable I-beam
          $(e.cellElement).css({
            cursor: "text",
          });
        }
      },
      onContentReady: function () {
        if (!$(selector).find(".custom-header").length) {
          $(selector).prepend(
            `<h6 class="custom-header text-center">${title}</h6>`
          );
        }
      },
    });

    function generateColumns() {
      const isInternational =
        (window.versionsData?.[0]?.INTERNATIONAL === 1) &&
        (selection.terminal?.toLowerCase() === "international");

      if (isInventoryPlanning) {
        if (isInternational) {
          // International → group by LOCATION + PRODUCT
          const uniqueLocations = [...new Set(minMaxPercentageData.map(d => d.LOCATION))];
          const groupedByLocation = {};
          uniqueLocations.forEach(loc => {
            const products = minMaxPercentageData
              .filter(d => d.LOCATION === loc)
              .map(d => d.PRODUCT_CODE);
            groupedByLocation[loc] = [...new Set(products)];
          });

          const locationColumns = Object.entries(groupedByLocation).map(
            ([location, products]) => ({
              caption: location,
              alignment: "center",
              columns: products.map(product => ({
                dataField: `${product}_${location}`,
                caption: window.productNameMap[product] || product,
                alignment: "center",
                editorType: "dxNumberBox",
                allowEditing: editingEnabled,
                allowSorting: false,
                editorOptions: {
                  min: 0,
                  max: 100,
                  showSpinButtons: false,
                  format: "#0.##",
                  inputAttr: {
                    style: "background-color: #f6edc8; font-weight: bold;",
                  },
                },
                cellTemplate(container, options) {
                  const val = Number(options.value || 0);
                  $(container)
                    .css({ backgroundColor: "#f6edc8", fontWeight: "bold" })
                    .text(val);
                },
              })),
            })
          );

          return [
            {
              dataField: "Type",
              caption: "",
              width: 50,
              alignment: "center",
              allowEditing: false,
              allowSorting: false,
            },
            ...locationColumns,
          ];
        } else {
          // Domestic → only products (no location)
          const productColumns = selection.products.map(product => ({
            dataField: product,
            caption: window.productNameMap[product] || product,
            alignment: "center",
            editorType: "dxNumberBox",
            allowEditing: editingEnabled,
            allowSorting: false,
            editorOptions: {
              min: 0,
              max: 100,
              showSpinButtons: false,
              format: "#0.##",
              inputAttr: {
                style: "background-color: #f6edc8; font-weight: bold;",
              },
            },
            cellTemplate(container, options) {
              const val = Number(options.value || 0);
              $(container)
                .css({ backgroundColor: "#f6edc8", fontWeight: "bold" })
                .text(val);
            },
          }));

          return [
            {
              dataField: "Type",
              caption: "",
              width: 50,
              alignment: "center",
              allowEditing: false,
              allowSorting: false,
            },
            ...productColumns,
          ];
        }
      }

      // ---------- DEFAULT FLOW for other grids ----------
      const dateCol =
        hasDate || selector === "#openingInventoryGrid"
          ? [{
            dataField: "Date",
            caption: "Date",
            alignment: "center",
            width: 100,
            allowEditing: false,
            allowSorting: false,
            cellTemplate(container, options) {
              const day = Number(options.value);
              const fullDate = new Date(
                parseInt(yearStr),
                monthMap[monthStr],
                day
              );
              $(container).text(
                formatDateMMDDYYYY(fullDate)
              );
            },
          }]
          : [];

      let mainColumns;
      if (isInternational) {
        const groupedByLocation = {};

        selection.products.forEach(product => {
          (countryMap[product] || []).forEach(location => {
            if (!groupedByLocation[location]) {
              groupedByLocation[location] = [];
            }
            groupedByLocation[location].push(product);
          });
        });

        mainColumns = Object.entries(groupedByLocation).map(
          ([location, products]) => ({
            caption: location,
            alignment: "center",
            columns: products.map(product => ({
              dataField: `${product}_${location}`,
              caption: window.productNameMap[product] || product,
              alignment: "center",
              editorType: "dxNumberBox",
              allowEditing: editingEnabled,
              allowSorting: false,
              editorOptions: {
                min: 0,
                showSpinButtons: false,
                format: "#,##0.##",
                inputAttr: {
                  style: "background-color: #f6edc8; font-weight: bold;",
                },
              },
              cellTemplate(container, options) {
                $(container)
                  .css({ backgroundColor: "#f6edc8", fontWeight: "bold" })
                  .text(Number(options.value || 0));
              },
              headerCellTemplate: function (container, options) {
                $(container).html(`
                  <div style="display:flex; flex-direction:column; align-items:center;">
                    <span>${window.productNameMap[product] || product}</span>
                    <button class="btn btn-link p-0 m-0 working-capacity-bulk-btn" data-product="${product}" title="Bulk Edit Working Capacity" style="font-size:18px;line-height:1;">
                      <i class="fa fa-sliders-h"></i>
                    </button>
                  </div>
                `);
              }
            })),
          })
        );
      } else {
        mainColumns = selection.products.map(product => {
          const baseColumn = {
            dataField: product,
            caption: window.productNameMap[product] || product,
            alignment: "center",
            editorType: "dxNumberBox",
            allowEditing: editingEnabled,
            allowSorting: false,
            editorOptions: {
              min: 0,
              showSpinButtons: false,
              format: "#,##0.##",
              inputAttr: {
                style: "background-color: #f6edc8; font-weight: bold;",
              },
            },
            cellTemplate(container, options) {
              const factor = unitConversionFactors?.[product] ?? 1;
              const convertedValue = Number(options.value || 0) * factor;
              $(container)
                .css({ backgroundColor: "#f6edc8", fontWeight: "bold" })
                .text(convertedValue.toLocaleString());
            }
          };
          // Only add the icon button for Working Capacity grid
          if (selector === "#workingCapacityGrid") {
            baseColumn.headerCellTemplate = function (container, options) {
              $(container).html(`
                <div style="display:flex; flex-direction:column; align-items:center;">
                  <span>${window.productNameMap[product] || product}</span>
                  <button class="btn btn-link p-0 m-0 working-capacity-bulk-btn" data-product="${product}" title="Bulk Edit Working Capacity" style="font-size:18px;line-height:1;">
                    <i class="fa fa-sliders-h"></i>
                  </button>
                </div>
              `);
            };
          }
          return baseColumn;
        });
      }

      return dateCol.concat(mainColumns);
    }
  }

  function recalculateLiftingData(startIndex = 0) {
    if (!window.countryMap) {
      window.countryMap = {};
    }
    const countryMap = window.countryMap;
    const factorMap = unitConversionFactors || {};

    const workingCapMap = {};
    workingCapacityData.forEach((row) => {
      workingCapMap[row.Date] = row;
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [monthStr, yearStr] = selection.month.split(" ");
    const monthIndex = monthMap[monthStr];
    const planningYear = parseInt(yearStr);

    const isInternational =
      (window.versionsData?.[0]?.INTERNATIONAL === 1) &&
      (selection.terminal?.toLowerCase() === "international");

    const planningDate = new Date(planningYear, monthIndex, 1);
    const isFutureMonth = planningDate > today;

    for (let i = startIndex; i < liftingAmendmentData.length; i++) {
      const row = liftingAmendmentData[i];
      const currentDay = row.date;

      const currentDate = new Date(planningYear, monthIndex, currentDay);
      currentDate.setHours(0, 0, 0, 0);
      const isPastDay = currentDate < today;
      const isToday = currentDate.getTime() === today.getTime();

      if (isInternational) {
        selection.products.forEach((product) => {
          const locations = countryMap[product] || [];
          locations.forEach((location) => {
            const suffix = `${product}_${location}`;
            let closing;

            if (!isPastDay && !isToday) {
              const nominations = row.nomination || [];
              if (nominations.length > 0) {
                const totalLifting = nominations.reduce((sum, nom) => {
                  const factor = factorMap[product] || 1;
                  const adjusted = (Number(nom[`adjustedQty_${product}`]) || 0) * factor;
                  const scheduled = (Number(nom[`scheduledQty_${product}`]) || 0) * factor;
                  return sum + (adjusted > 0 ? adjusted : scheduled);
                }, 0);
                row[`customerLifting_${suffix}`] = totalLifting;
              } else {
                // Use backend CUSTOMER_LIFTING value when no nominations
                const backendValueRaw = row[`CUSTOMER_LIFTING`] || row[`customerLifting_${suffix}`] || 0;
                const factor = factorMap[product] || 1;
                const backendValue = backendValueRaw * factor;
                row[`customerLifting_${suffix}`] = backendValue;
              }
            }

            if (isPastDay) {
              const inventoryRecord = inventoryData.find(
                (inv) => inv.DATE_VALUE === currentDay &&
                  inv.PRODUCT_CODE === product &&
                  inv.LOCATION === location
              );
              closing = inventoryRecord?.CLOSING_INVENTORY || 0;
            } else {
              let opening;
              if (isToday || (isFutureMonth && currentDay === 1)) {
                const openingRecord = openingInventoryData.find(
                  (r) => r.Date === currentDay
                );
                opening = openingRecord?.[suffix] || 0;
              } else {
                opening =
                  liftingAmendmentData[i - 1]?.[`closingInventory_${suffix}`] || 0;
              }

              const factor = factorMap[product] || 1;
              const terminal = (row[`terminalAvails_${suffix}`] || 0) * factor;
              const customer = (row[`customerLifting_${suffix}`] || 0) * factor;
              const adjTA = (row[`adjustment_${suffix}TA`] || 0) * factor;
              const adjCL = (row[`adjustment_${suffix}CL`] || 0) * factor;


              closing = opening + terminal + adjTA - customer - adjCL;
            }

            row[`closingInventory_${suffix}`] = closing;

            const workingCap = workingCapMap[currentDay]?.[suffix] || 0;
            row[`closingPercentage_${suffix}`] = workingCap
              ? Math.round((closing / workingCap) * 100) + "%"
              : "0%";
          });
        });
      } else {
        selection.products.forEach((product) => {
          let closing;

          if (!isPastDay && !isToday) {
            const nominations = row.nomination || [];
            if (nominations.length > 0) {
              const totalLifting = nominations.reduce((sum, nom) => {
                const factor = factorMap[product] || 1;
                const adjusted = (Number(nom[`adjustedQty_${product}`]) || 0) * factor;
                const scheduled = (Number(nom[`scheduledQty_${product}`]) || 0) * factor;
                return sum + (adjusted > 0 ? adjusted : scheduled);
              }, 0);
              row[`customerLifting_${product}`] = totalLifting;
            } else {
              // Use backend CUSTOMER_LIFTING value when no nominations
              const rawValue = row[`CUSTOMER_LIFTING`] || row[`customerLifting_${product}`] || 0;
              const factor = factorMap[product] || 1;
              const backendValue = rawValue * factor;
              row[`customerLifting_${product}`] = backendValue;
            }
          }

          if (isPastDay) {
            const inventoryRecord = inventoryData.find(
              (inv) => inv.DATE_VALUE === currentDay &&
                inv.PRODUCT_CODE === product
            );
            closing = inventoryRecord?.CLOSING_INVENTORY || 0;
          } else {
            let opening;
            if (isToday || (isFutureMonth && currentDay === 1)) {
              const openingRecord = openingInventoryData.find(
                (r) => r.Date === currentDay
              );
              opening = openingRecord?.[product] || 0;
            } else {
              opening =
                liftingAmendmentData[i - 1]?.[`closingInventory_${product}`] || 0;
            }

            const terminal = (row[`terminalAvails_${product}`] || 0);
            const customer = (row[`customerLifting_${product}`] || 0);
            const adjTA = (row[`adjustment_${product}TA`] || 0);
            const adjCL = (row[`adjustment_${product}CL`] || 0);

            closing = opening + terminal + adjTA - customer - adjCL;
          }

          row[`closingInventory_${product}`] = closing;

          const workingCap = workingCapMap[currentDay]?.[product] || 0;
          row[`closingPercentage_${product}`] = workingCap
            ? Math.round((closing / workingCap) * 100) + "%"
            : "0%";
        });
      }

      row.numberOfShips = Array.isArray(row.nomination)
        ? row.nomination.length
        : 0;

      row.totalLifting = selection.products.reduce((sum, p) => {
        return sum + (row[`customerLifting_${p}`] || 0);
      }, 0);
    }

    // Recalculate 2-day rolling lifting totals
    liftingAmendmentData.forEach((row, i) => {
      const todayLifting = row.totalLifting || 0;
      const tomorrowLifting = liftingAmendmentData[i + 1]?.totalLifting || 0;
      row.liftingPer2Days = todayLifting + tomorrowLifting;
    });
  };

  let originalNominationMap = {};

  function storeOriginalNominationState() {
    originalNominationMap = {};

    liftingAmendmentData.forEach((row) => {
      if (Array.isArray(row.nomination)) {
        row.nomination.forEach((nom) => {
          originalNominationMap[nom.nominationNumber] = {
            originalDate: nom.parentRowDate || row.date,
            adjustedQty: selection.products.reduce((acc, p) => {
              acc[p] = nom[`adjustedQty_${p}`] || 0;
              return acc;
            }, {}),
          };

        });
      }
    });
  };

  // Delegate the click event on the modal container. This will handle clicks on dynamically added reset buttons.
  $("#adjustedNominationsModal").on("click", ".reset-nomination-btn", function () {
    const $row = $(this).closest("tr");
    const nomId = $row.data("nom-id").toString(); // Ensure nomId is a string
    console.log("Attempting reset for nomId:", nomId);

    // Try to get original state from map
    let original = originalNominationMap[nomId];

    // Fallback for backend-injected nominations
    if (!original) {
      const fallbackRow = liftingAmendmentData.find((r) =>
        (r.nomination || []).some((n) => n.nominationNumber.toString() === nomId)
      );
      if (!fallbackRow) {
        toastr.error("Fallback row not found for backend nomination.");
        return;
      }

      const fallbackNom = fallbackRow.nomination.find(
        (n) => n.nominationNumber.toString() === nomId
      );
      if (!fallbackNom) {
        toastr.error("Fallback nomination not found.");
        return;
      }

      original = {
        originalDate: fallbackRow.date,
        adjustedQty: selection.products.reduce((acc, p) => {
          acc[p] = 0;
          return acc;
        }, {}),
      };
    }

    const originalDate = original.originalDate;

    // Get the current date from modal row
    const currentDate = Number($row.find("td:nth-child(5)").text());
    let currentRow = liftingAmendmentData.find((row) => Number(row.date) === currentDate);
    if (!currentRow) {
      toastr.error("Current row not found for date: " + currentDate);
      return;
    }

    let currentNomination = currentRow.nomination.find(
      (n) => n.nominationNumber.toString() === nomId
    );
    if (!currentNomination) {
      toastr.error("Current nomination not found in row.");
      return;
    }

    // Remove from current row
    const nominationIndex = currentRow.nomination.findIndex(
      (n) => n.nominationNumber.toString() === nomId
    );
    if (nominationIndex !== -1) {
      currentNomination = currentRow.nomination.splice(nominationIndex, 1)[0];
    }

    // Apply original (or zeroed) values
    selection.products.forEach((p) => {
      currentNomination[`adjustedQty_${p}`] = 0;
    });

    originalNominationMap[nomId] = {
      originalDate: original.originalDate,
      adjustedQty: selection.products.reduce((acc, p) => {
        acc[p] = 0;
        return acc;
      }, {})
    };

    // Move back to original row
    const targetRow = liftingAmendmentData.find((row) => Number(row.date) === originalDate);
    if (!targetRow) {
      toastr.error("Target/original row not found.");
      return;
    }
    if (!Array.isArray(targetRow.nomination)) targetRow.nomination = [];
    targetRow.nomination.push(currentNomination);
    currentNomination.DATE_VALUE_ADJ = original.originalDate;


    // Update adjustments
    selection.products.forEach((product) => {
      const key = `adjustment_${product}CL`;
      currentRow[key] = currentRow.nomination.reduce(
        (sum, n) => sum + (Number(n[`adjustedQty_${product}`]) || 0),
        0
      );
      targetRow[key] = targetRow.nomination.reduce(
        (sum, n) => sum + (Number(n[`adjustedQty_${product}`]) || 0),
        0
      );
    });

    // Clear apply flags if present
    $(`#applyBoth_${nomId}, #applyQty_${nomId}, #applyDate_${nomId}`).prop("checked", false);
    latestAmendmentRequests
      .filter((r) => r.NOMINATION_NO === nomId)
      .forEach((r) => {
        r.APPLY_BOTH = "0";
        r.APPLY_QTY = "0";
        r.APPLY_DATE = "0";
      });

    updateFooterButtons();
    recalculateLiftingData();
    $("#liftingAmendmentGrid").dxDataGrid("instance").refresh();
    renderAllKpiCards();

    // Rebuild modal table
    const tableBody = $("#adjustedNominationsTableBody").empty();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    liftingAmendmentData.forEach((row) => {
      if (!Array.isArray(row.nomination)) return;

      const currentDate = row.date;
      const nominationDate = new Date(parseInt(yearStr), monthMap[monthStr], currentDate);
      nominationDate.setHours(0, 0, 0, 0);
      const isFutureOrToday = nominationDate >= today;
      if (!isFutureOrToday) return;

      row.nomination.forEach((nom) => {
        const original = originalNominationMap[nom.nominationNumber];
        const originalDate = (original?.originalDate ?? nom.DATE_VALUE) || currentDate;
        const changedDate = currentDate !== originalDate;

        let changedQty = selection.products.some((p) => {
          const adjusted = parseFloat(nom[`adjustedQty_${p}`] || 0);
          return adjusted > 0;
        });

        const shouldShow = changedDate || changedQty;
        if (!shouldShow) return;

        let action = "";
        if (changedDate && changedQty) action = "Both Changed";
        else if (changedDate) action = "Date Changed";
        else if (changedQty) action = "Qty Changed";

        tableBody.append(`
        <tr data-nom-id="${nom.nominationNumber}">
          <td>${nom.nominationNumber}</td>
          <td>${nom.customerName || "-"}</td>
          <td>${nom.shipName || "-"}</td>
         <td>${formatDateMMDDYYYY(originalDate)}</td>
          <td>${formatDateMMDDYYYY(currentDate)}</td>
          <td><strong>${action}</strong></td>
          <td><button class="btn btn-sm btn-warning reset-nomination-btn">Reset</button></td>
        </tr>
      `);
      });
    });
    renderAllKpiCards();
  });

  function renderAllKpiCards() {
    const nameMap = window.productNameMap || {};
    const container = $("#kpiScrollContainer").empty();

    const isInternational =
      (window.versionsData?.[0]?.INTERNATIONAL === 1) &&
      (selection.terminal?.toLowerCase() === "international");

    const kpiCardClass = isInternational ? "kpi-card-international" : "kpi-card";

    let productPairs = [];
    if (isInternational) {
      (inventoryData || []).forEach(entry => {
        if (selection.products.includes(entry.PRODUCT_CODE)) {
          const key = `${entry.PRODUCT_CODE}_${entry.LOCATION}`;
          if (!productPairs.find(p => p.key === key)) {
            productPairs.push({
              key,
              product: entry.PRODUCT_CODE,
              location: entry.LOCATION
            });
          }
        }
      });
    } else {
      productPairs = selection.products.map(product => ({
        key: product,
        product,
        location: ""
      }));
    }

    const groupedByLocation = {};
    productPairs.forEach(({ location, product }) => {
      if (!groupedByLocation[location]) groupedByLocation[location] = [];
      groupedByLocation[location].push(product);
    });

    function buildHeaders() {
      const row1 = Object.entries(groupedByLocation)
        .map(([loc, prods]) => `<th colspan="${prods.length}" class="location-group">${loc}</th>`)
        .join("");

      const row2 = Object.entries(groupedByLocation)
        .flatMap(([_, prods]) =>
          prods.map((prod, index) => {
            const isLast = index === prods.length - 1;
            return `<th class="${isLast ? 'with-right-border' : ''}">${nameMap[prod] || prod}</th>`;
          })
        )
        .join("");

      return { row1, row2 };
    }

    function buildValueRow(valuesMap) {
      return Object.entries(groupedByLocation)
        .flatMap(([loc, prods]) =>
          prods.map((prod, index) => {
            const key = `${loc}_${prod}`;
            const val = valuesMap[key] || 0;
            const formattedVal = Number(val).toLocaleString("en-IN");
            const isLast = index === prods.length - 1;
            return `<td class="${isLast ? 'with-right-border' : ''}" style="color: ${val > 0 ? 'blue' : '#333'}">
              <strong>${formattedVal}</strong>
            </td>`;
          })
        )
        .join("");
    }

    // Total Cargoes
    const cargoesMap = {};
    productPairs.forEach(({ product, location }) => {
      const key = `${location}_${product}`;
      const seen = new Set();
      liftingAmendmentData.forEach(row => {
        row.nomination?.forEach(nom => {
          const qty = Number(nom[`scheduledQty_${product}`]) || 0;
          if (qty > 0) seen.add(`${nom.nominationNumber}_${nom.shipName}`);
        });
      });
      cargoesMap[key] = seen.size;
    });

    const { row1, row2 } = buildHeaders();
    const cargoesRow = buildValueRow(cargoesMap);

    container.append(`
    <div class="${kpiCardClass}">
      <div class="card-title">Total Cargoes</div>
      <div class="kpi-table-wrapper">
        <table class="table table-sm text-center mb-0">
          <thead><tr>${row1}</tr><tr>${row2}</tr></thead>
          <tbody><tr>${cargoesRow}</tr></tbody>
        </table>
      </div>
    </div>
  `);

    // Closing Inv. Violation (Days)
    const violationMap = {};
    productPairs.forEach(({ product, location }) => {
      const min = parseInt(inventoryPlanningData.find(r => r.Type === "Min")[product]) || 0;
      const max = parseInt(inventoryPlanningData.find(r => r.Type === "Max")[product]) || 100;

      const allPercentages = liftingAmendmentData.map(row =>
        parseInt(row[`closingPercentage_${product}`]) || 0
      );

      const allZero = allPercentages.every(p => p === 0);

      let count = 0;
      if (!allZero) {
        count = allPercentages.reduce((sum, val) =>
          (val < min || val > max) ? sum + 1 : sum
          , 0);
      }

      violationMap[`${location}_${product}`] = count;
    });

    const violationRow = Object.entries(groupedByLocation)
      .flatMap(([loc, prods]) =>
        prods.map(prod => {
          const key = `${loc}_${prod}`;
          const val = violationMap[key] || 0;
          return `<td style="color: ${val > 0 ? "red" : "#333"}"><strong>${val}</strong></td>`;
        })
      )
      .join("");

    if (!isInternational) {
      container.append(`
      <div class="${kpiCardClass}">
        <div class="card-title">Closing Inv. Violation (Days)</div>
        <div class="kpi-table-wrapper">
          <table class="table table-sm text-center mb-0">
            <thead><tr>${row1}</tr><tr>${row2}</tr></thead>
            <tbody><tr>${violationRow}</tr></tbody>
          </table>
        </div>
      </div>
    `);
    }

    // Demand and Available For Export
    const demandMap = {};
    const availMap = {};
    productPairs.forEach(({ product, location }) => {
      const demand = liftingAmendmentData.reduce(
        (sum, r) =>
          sum +
          ((Number(r[`customerLifting_${product}`]) || 0) +
            (Number(r[`adjustment_${product}CL`]) || 0)),
        0
      );
      const avail = liftingAmendmentData.reduce(
        (sum, r) =>
          sum +
          ((Number(r[`terminalAvails_${product}`]) || 0) +
            (Number(r[`adjustment_${product}TA`]) || 0)),
        0
      );
      const factor = currentUnit !== "MB" && unitConversionFactors[product] ? unitConversionFactors[product] : 1;
      demandMap[`${location}_${product}`] = currentUnit === "MB" ? demand : demand * factor;
      availMap[`${location}_${product}`] = currentUnit === "MB" ? avail : avail * factor;
    });

    const demandRow = buildValueRow(demandMap);
    const availRow = buildValueRow(availMap);

    container.append(`
    <div class="${kpiCardClass}">
      <div class="card-title">Demand (${currentUnit})</div>
      <div class="kpi-table-wrapper">
        <table class="table table-sm text-center mb-0">
          <thead><tr>${row1}</tr><tr>${row2}</tr></thead>
          <tbody><tr>${demandRow}</tr></tbody>
        </table>
      </div>
    </div>
  `);

    if (!isInternational) {
      container.append(`
  <div class="${kpiCardClass}">
    <div class="card-title">Available For Export (${currentUnit})</div>
    <div class="kpi-table-wrapper">
      <table class="table table-sm text-center mb-0">
        <thead><tr>${row1}</tr><tr>${row2}</tr></thead>
        <tbody><tr>${availRow}</tr></tbody>
      </table>
    </div>
  </div>
  `);
    }

    // Adjusted Avails (Terminal Avails Adjustments)
    const adjustedAvailsMap = {};
    productPairs.forEach(({ product, location }) => {
      const adjustedAvails = liftingAmendmentData.reduce(
        (sum, r) => {
          const suffix = location ? `${product}_${location}` : product;
          return sum + (Number(r[`adjustment_${suffix}TA`]) || 0);
        },
        0
      );
      const factor = currentUnit !== "MB" && unitConversionFactors[product] ? unitConversionFactors[product] : 1;
      adjustedAvailsMap[`${location}_${product}`] = currentUnit === "MB" ? adjustedAvails : adjustedAvails * factor;
    });

    const adjustedAvailsRow = buildValueRow(adjustedAvailsMap);

    container.append(`
    <div class="${kpiCardClass}">
      <div class="card-title">Adjusted Avails (${currentUnit})</div>
      <div class="kpi-table-wrapper">
        <table class="table table-sm text-center mb-0">
          <thead><tr>${row1}</tr><tr>${row2}</tr></thead>
          <tbody><tr>${adjustedAvailsRow}</tr></tbody>
        </table>
      </div>
    </div>
  `);

    // Adjusted Nominations (kept as global summary)
    let dateChangedCount = 0;
    let qtyChangedCount = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    liftingAmendmentData.forEach((row) => {
      if (!Array.isArray(row.nomination)) return;

      const currentDate = row.date;
      const nominationDate = new Date(parseInt(yearStr), monthMap[monthStr], currentDate);
      nominationDate.setHours(0, 0, 0, 0);
      const isFutureOrToday = nominationDate >= today;

      if (!isFutureOrToday) return;

      row.nomination.forEach((nom) => {
        const original = originalNominationMap[nom.nominationNumber];
        if (!original) return;

        const originalDate = original.originalDate;
        const isDateChanged = currentDate !== originalDate;

        let isQtyChanged = false;
        selection.products.forEach((p) => {
          const originalVal = parseFloat(original?.adjustedQty?.[p] || 0);
          const currentVal = parseFloat(nom[`adjustedQty_${p}`] || 0);

          if (originalVal !== currentVal || currentVal > 0) {
            isQtyChanged = true;
          }
        });

        if (isDateChanged) dateChangedCount++;
        if (isQtyChanged) qtyChangedCount++;
      });
    });

    container.append(`
    <div class="kpi-card" id="adjustedNominationsCard" style="cursor: pointer;">
      <div class="card-title">Adjusted Nominations</div>
      <div class="kpi-table-wrapper">
        <table class="table table-sm text-center mb-0">
          <thead><tr><th>Qty Changed</th><th>Date Changed</th></tr></thead>
          <tbody><tr>
            <td><strong>${qtyChangedCount}</strong></td>
            <td><strong>${dateChangedCount}</strong></td>
          </tr></tbody>
        </table>
      </div>
    </div>
  `);

    $("#adjustedNominationsCard").on("click", function () {
      const tableBody = $("#adjustedNominationsTableBody").empty();
      liftingAmendmentData.forEach((row) => {
        if (!Array.isArray(row.nomination)) return;

        const currentDate = row.date;
        const nominationDate = new Date(parseInt(yearStr), monthMap[monthStr], currentDate);
        nominationDate.setHours(0, 0, 0, 0);
        const isFutureOrToday = nominationDate >= today;

        if (!isFutureOrToday) return;

        row.nomination.forEach((nom) => {
          const original = originalNominationMap[nom.nominationNumber];

          const currentDate = row.date;
          const originalDate = (original?.originalDate ?? nom.DATE_VALUE) || currentDate;
          const changedDate = currentDate !== originalDate;

          let changedQty = selection.products.some((p) => {
            const adjusted = parseFloat(nom[`adjustedQty_${p}`] || 0);
            return adjusted > 0;
          });

          const shouldShow = changedDate || changedQty;
          if (!shouldShow) return;

          let action = "";
          if (changedDate && changedQty) action = "Both Changed";
          else if (changedDate) action = "Date Changed";
          else if (changedQty) action = "Qty Changed";

          $("#adjustedNominationsTableBody").append(`
            <tr data-nom-id="${nom.nominationNumber}">
              <td>${nom.nominationNumber}</td>
              <td>${nom.customerName || "-"}</td>
              <td>${nom.shipName || "-"}</td>
               <td>${formatDateMMDDYYYY(originalDate)}</td>
          <td>${formatDateMMDDYYYY(currentDate)}</td>
              <td><strong>${action}</strong></td>
              <td><button class="btn btn-sm btn-warning reset-nomination-btn">Reset</button></td>
            </tr>
          `);
        });

      });

      $("#adjustedNominationsModal").modal("show");
    });
  };

  function generateColumns(products) {
    const columns = [
      {
        dataField: "date",
        caption: "Date",
        width: 90,
        fixed: true,
        fixedPosition: "left",
        allowSorting: false,
        allowEditing: false,
        cellTemplate: function (container, options) {
          let $link = $("<a>")
            .text(options.value)
            .addClass("date-link")
            .on("click", function () {
              const grid = $("#liftingAmendmentGrid").dxDataGrid("instance");
              const isExpanded = grid.isRowExpanded(options.key);
              isExpanded ? grid.collapseRow(options.key) : grid.expandRow(options.key);
            });
          $(container).append($link);
        },
      },
    ];

    const sectionTitles = [
      { key: "terminalAvails", title: "Avails" },
      { key: "adjustment_TA", title: "Adjust" },
      { key: "customerLifting", title: "Lifting" },
      { key: "adjustment_CL", title: "Adjust" },
      { key: "closingInventory", title: "Closing" },
      { key: "closingPercentage", title: "%" },
    ];

    const isInternational = selection.terminal?.toLowerCase() === "international";

    if (isInternational) {
      // Build grouped by LOCATION → PRODUCTS
      const groupedByLocation = {};
      (inventoryData || []).forEach((entry) => {
        if (products.includes(entry.PRODUCT_CODE)) {
          if (!groupedByLocation[entry.LOCATION]) {
            groupedByLocation[entry.LOCATION] = [];
          }
          if (!groupedByLocation[entry.LOCATION].includes(entry.PRODUCT_CODE)) {
            groupedByLocation[entry.LOCATION].push(entry.PRODUCT_CODE);
          }
        }
      });

      Object.entries(groupedByLocation).forEach(([location, locProducts]) => {
        columns.push({
          caption: location,
          alignment: "center",
          columns: sectionTitles.map((section) => ({
            caption: section.title,
            alignment: "center",
            columns: locProducts.map((product) =>
              createColumnConfig(section.key, product, location)
            ),
          })),
        });
      });

    } else {
      // Local terminal - normal without location grouping
      columns.push(
        ...sectionTitles.map((section) => ({
          caption: section.title,
          alignment: "center",
          columns: products.map((product) =>
            createColumnConfig(section.key, product)
          ),
        }))
      );
    }

    columns.push({
      caption: "Summary",
      fixed: true,
      fixedPosition: "right",
      columns: [
        {
          dataField: "numberOfShips",
          caption: "Number of Ships",
          alignment: "center",
          width: 125,
          allowEditing: false,
          allowSorting: false,
          format: "#,##0"
        },
        {
          dataField: "totalLifting",
          caption: "Total Lifting",
          alignment: "center",
          width: 95,
          allowEditing: false,
          allowSorting: false,
          format: "#,##0",
          cellTemplate: (container, options) => {
            const value = Number(options.value || 0);
            const factor = getAverageConversionFactor(); // see function below
            const converted = value * factor;
            $(container).text(converted.toLocaleString(undefined, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 2
            }));
          }
        },
        {
          dataField: "liftingPer2Days",
          caption: "Lifting Per 2 Days",
          alignment: "center",
          width: 130,
          allowEditing: false,
          allowSorting: false,
          format: "#,##0",
          cellTemplate: (container, options) => {
            const value = Number(options.value || 0);
            const factor = getAverageConversionFactor();
            const converted = value * factor;
            $(container).text(converted.toLocaleString(undefined, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 2
            }));
          }
        },
      ]
    });

    function getAverageConversionFactor() {
      const products = selection.products || [];
      const factors = products.map(p => unitConversionFactors[p] || 1);
      if (factors.length === 0) return 1;
      return factors.reduce((a, b) => a + b, 0) / factors.length;
    }

    return columns;

    function createColumnConfig(sectionKey, product, location = "") {
      const suffix = location ? `${product}_${location}` : product;

      let dataField = sectionKey.includes("adjustment")
        ? `adjustment_${suffix}${sectionKey.split("_")[1]}`
        : `${sectionKey}_${suffix}`;

      const baseWidth = 120;
      let captionText = window.productNameMap[product] || product;

      if (location) {
        captionText += ` (${location})`;
      }

      const dynamicWidth = Math.max(baseWidth, (captionText.length + 8) * 8);

      const columnConfig = {
        dataField: dataField,
        caption: window.productNameMap[product] || product,
        alignment: "center",
        format: "#,##0",
        allowSorting: false,
        allowEditing: false,
        width: dynamicWidth,
      };

      if (sectionKey === "closingPercentage") {
        columnConfig.width = 150;
        columnConfig.cellTemplate = function (container, options) {
          let rawValue = options.value ? options.value.replace("%", "").trim() : "0";
          let value = parseInt(rawValue, 10) || 0;
          value = Math.max(0, Math.min(100, value));

          let min = parseInt(inventoryPlanningData.find((r) => r.Type === "Min")[product]) || 0;
          let max = parseInt(inventoryPlanningData.find((r) => r.Type === "Max")[product]) || 100;
          let color = value < min || value > max ? "red-bar" : "green-bar";

          $(container).html(`
          <div class="progress-container">
            <div class="progress-bar ${color}" style="width: ${value}%; height: 100%;"></div>
            <div class="progress-text">${value}%</div>
          </div>`);
        };
      } else if (sectionKey.includes("adjustment")) {
        columnConfig.allowEditing = true;
        columnConfig.cellTemplate = function (container, options) {
          const factor = unitConversionFactors[product] || 1;
          const val = options.value || 0;
          const raw = val * (currentUnit === "MB" ? 1 : factor);
          $(container).text(raw.toLocaleString());
        };
        // Add bulk adjust icon button to header
        columnConfig.headerCellTemplate = function (container, options) {
          const type = sectionKey.endsWith("TA") ? "TA" : "CL";
          $(container).html(`
            <div style=\"display:flex; flex-direction:column; align-items:center;\">
              <span>Adjust</span>
              <button class=\"btn btn-link p-0 m-0 bulk-adjust-btn\" title=\"Bulk Adjust\" style=\"font-size:14px;line-height:1;\" data-type=\"${type}\" data-product=\"${product}\" data-location=\"${location}\">
                <i class=\"fa fa-sliders-h\"></i>
              </button>
            </div>
          `);
        };
      } else if (sectionKey === "closingInventory") {
        columnConfig.cellTemplate = function (container, options) {
          const factor = unitConversionFactors[product] || 1;
          const val = options.value || 0;
          const raw = val * (currentUnit === "MB" ? 1 : factor);
          $(container).text(raw.toLocaleString());
        };
      } else if (sectionKey === "terminalAvails" || sectionKey === "customerLifting") {
        columnConfig.cellTemplate = function (container, options) {
          const factor = unitConversionFactors[product] || 1;
          const val = options.value || 0;
          const raw = val * (currentUnit === "MB" ? 1 : factor);
          $(container).text(raw.toLocaleString());
        };
      }

      return columnConfig;
    }
  };

  function initializeLiftingAmendmentGrid() {
    recalculateLiftingData();

    const isInternational =
      (window.versionsData?.[0]?.INTERNATIONAL === 1) &&
      (selection.terminal?.toLowerCase() === "international");

    $("#liftingAmendmentGrid").dxDataGrid({
      dataSource: liftingAmendmentData,
      keyExpr: "id",
      showBorders: true,
      columnAutoWidth: false,
      allowColumnResizing: true,
      paging: { enabled: false },
      height: "auto",
      editing: {
        mode: "cell",
        allowUpdating: true,
      },
      scrolling: {
        scrollByContent: true,
        scrollByThumb: true,
        showScrollbar: "onHover",
      },
      customizeColumns: function (columns) {
        columns.forEach((column) => {
          if (column.command === "expand") {
            column.visible = false;
          }
        });
      },
      onEditingStart: function (e) {
        const column = e.column;
        const rowData = e.data;
        const isAdjustment = column.dataField?.includes("adjustment_");
        if (!isAdjustment) return;

        const monthIndex = monthMap[monthStr];
        const rowDate = new Date(parseInt(yearStr), monthIndex, rowData.date);
        rowDate.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (rowDate < today) e.cancel = true;
      },
      onCellPrepared: function (e) {
        if (
          e.rowType === "data" &&
          e.column.dataField?.startsWith("adjustment_")
        ) {
          // build the full date for this row
          const monthIndex = monthMap[monthStr];
          const rowDate = new Date(
            parseInt(yearStr),
            monthIndex,
            e.data.date
          );
          rowDate.setHours(0, 0, 0, 0);

          const today = new Date();
          today.setHours(0, 0, 0, 0);

          if (rowDate < today) {
            // past → grey & block
            $(e.cellElement).css({
              backgroundColor: "#eee",
              color: "#999",
              cursor: "not-allowed"
            });
          }
          else {
            // today/future → editable I-beam
            $(e.cellElement).css({
              backgroundColor: "#f6edc8",
              fontWeight: "bold",
              cursor: "text"
            });
          }
        }
      },
      onEditorPreparing(e) {
        if (
          e.parentType === "dataRow" &&
          /^adjustment_.+CL$/.test(e.dataField)
        ) {
          const m = e.dataField.match(/^adjustment_(.+)CL$/);
          const product = m ? m[1] : null;

          e.editorOptions.onValueChanged = (args) => {
            const newTotal = Number(args.value) || 0;
            const rowData = e.row.data;

            rowData[e.dataField] = newTotal;

            const noms = rowData.nomination || [];
            const perNom = noms.length ? newTotal / noms.length : 0;
            noms.forEach(n => {
              n[`adjustedQty_${product}`] = perNom;
            });

            recalculateLiftingData(e.row.rowIndex);
            const grid = $("#liftingAmendmentGrid").dxDataGrid("instance");
            grid.refresh();
            if (grid.isRowExpanded(rowData.id)) {
              grid.collapseRow(rowData.id);
              grid.expandRow(rowData.id);
            }
            renderAllKpiCards();
          };
        }
      },
      onRowUpdated(e) {
        const updatedRowIndex = liftingAmendmentData.findIndex(
          (r) => r.id === e.data.id
        );
        recalculateLiftingData(updatedRowIndex);
        $("#liftingAmendmentGrid").dxDataGrid("instance").refresh();
        renderAllKpiCards();
      },
      columns: generateColumns(selection.products),
      masterDetail: {
        enabled: true,
        template: function (container, options) {
          const details = options.data.nomination || [];
          const parentRowDate = options.data.date; // The parent row's original date

          // Initialize DATE_VALUE_ADJ if not set
          details.forEach(function (nomination) {
            if (typeof nomination.DATE_VALUE_ADJ === "undefined") {
              nomination.DATE_VALUE_ADJ = nomination.DATE_VALUE || parentRowDate;
            }
          });

          // If no nomination details
          if (!details.length) {
            $("<div>")
              .text("No nomination details available. (the customer lifting includes only local customers intake via pipeline)")
              .css({
                "font-size": "14px",
                "text-align": "center",
                padding: "10px",
                color: "#999",
              })
              .appendTo(container);
            return;
          }

          $("<div>")
            .text("Nomination Details")
            .css({
              "font-size": "16px",
              "font-weight": "bold",
              "margin-bottom": "10px",
              "padding-bottom": "5px",
            })
            .appendTo(container);

          const actualColumns = selection.products.map((product) => ({
            dataField: `actualQty_${product}`,
            caption: window.productNameMap[product] || product,
            width: 80,
            alignment: "center",
            allowEditing: false,
            allowSorting: false,
            format: "#,##0",
            cellTemplate: (container, options) => {
              const val = Number(options.value || 0);
              const factor = unitConversionFactors?.[product] ?? 1;
              const converted = val * factor;

              $(container)
                .css({ fontWeight: "bold" })
                .text(converted.toLocaleString());
            }
          }));

          const scheduledColumns = selection.products.map((product) => ({
            dataField: `scheduledQty_${product}`,
            caption: (window.productNameMap && window.productNameMap[product]) || product,
            width: 80,
            alignment: "center",
            allowEditing: false,
            allowSorting: false,
            format: "#,##0",
            calculateCellValue: (rowData) => {
              const value = rowData[`scheduledQty_${product}`];
              return isNaN(value) || value == null ? 0 : value;
            },
            cellTemplate: (container, options) => {
              const val = Number(options.value || 0);
              const factor = unitConversionFactors?.[product] ?? 1;
              const converted = val * factor;

              $(container).text(converted.toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2
              }));
            }
          }))
            .concat([
              {
                dataField: "scheduledTotal",
                caption: "Total",
                width: 100,
                alignment: "center",
                allowEditing: false,
                allowSorting: false,
                format: "#,##0",
                cellTemplate: (container, options) => {
                  const val = Number(options.value || 0);
                  const converted = selection.products.reduce((sum, product) => {
                    const raw = Number(options.data[`scheduledQty_${product}`] || 0);
                    const factor = unitConversionFactors?.[product] ?? 1;
                    return sum + raw * factor;
                  }, 0);

                  $(container).text(converted.toLocaleString(undefined, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2
                  }));
                }
              },
            ]);

          const adjustedColumns = selection.products.map((product) => ({
            dataField: `adjustedQty_${product}`,
            caption: window.productNameMap[product] || product,
            width: 80,
            alignment: "center",
            allowSorting: false,
            format: "#0.##",
            editorType: "dxNumberBox",
            editorOptions: {
              showSpinButtons: false,
              step: 0.01,
              format: "#0.##",
              stylingMode: "filled",
              inputAttr: {
                style: "background-color: #f6edc8; font-weight: bold;",
              },
            },
            cellTemplate: function (container, options) {
              const val = Number(options.value || 0);
              const product = options.column.dataField.split("_")[1];
              const factor = unitConversionFactors?.[product] ?? 1;
              const converted = val * factor;

              $(container)
                .addClass("yellow-bg")
                .text(converted.toLocaleString(undefined, {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 2
                }));
            }
          }));

          const baseColumns = [
            {
              dataField: "nominationNumber",
              caption: "Nomination Number",
              width: 120,
              alignment: "center",
              allowEditing: false,
              allowSorting: false,
            },
            {
              dataField: "customerName",
              caption: "Customer Name",
              width: 150,
              alignment: "center",
              allowEditing: false,
              allowSorting: false,
            },
            {
              dataField: "shipName",
              caption: "Ship Name",
              width: 150,
              alignment: "center",
              allowEditing: false,
              allowSorting: false,
            },
          ];

          if (isInternational) {
            baseColumns.push(
              {
                dataField: "location",
                caption: "Location",
                width: 100,
                alignment: "center",
                allowEditing: false,
                allowSorting: false,
              },
              {
                dataField: "SCHEDULED_TYPE",
                caption: "Scheduled Type",
                width: 130,
                alignment: "center",
                allowEditing: false,
                allowSorting: false,
                cellTemplate: function (container, options) {
                  const val = options.value || "-";
                  $(container).text(val);
                },
              }
            );
          }

          const dateMoveColumn = {
            dataField: "DATE_VALUE_ADJ",
            caption: "Move to Date",
            width: 120,
            alignment: "center",
            allowSorting: false,
            editorType: "dxDateBox",
            editorOptions: {
              type: "date",
              displayFormat: "dd/MM/yyyy",
              value: (() => {
                const adjDay = details[0]?.DATE_VALUE_ADJ || parentRowDate;
                if (typeof adjDay === "number" && adjDay > 0 && adjDay <= 31) {
                  return new Date(parseInt(yearStr), monthMap[monthStr], adjDay);
                }
                return new Date(parseInt(yearStr), monthMap[monthStr], parentRowDate);
              })(),
              min: new Date(parseInt(yearStr), monthMap[monthStr], 1),
              max: new Date(parseInt(yearStr), monthMap[monthStr] + 1, 0),
              onValueChanged: function (e) {
                const gridInstance = nominationGrid.dxDataGrid("instance");
                const rowIndex = $(e.element).closest(".dx-row").index();
                const nominationRow = gridInstance.getDataSource().items()[rowIndex];

                let newDate;
                if (e.value instanceof Date) newDate = e.value;
                else if (typeof e.value === "number") newDate = new Date(e.value);
                else if (typeof e.value === "string") newDate = new Date(Date.parse(e.value));

                if (!newDate || isNaN(newDate.getTime())) return;

                const newDay = newDate.getDate();
                const oldDay = nominationRow.DATE_VALUE_ADJ || parentRowDate;

                if (newDay === Number(oldDay)) return;

                const sourceRow = liftingAmendmentData.find(
                  (row) => Number(row.date) === Number(oldDay)
                );
                const targetRow = liftingAmendmentData.find(
                  (row) => Number(row.date) === newDay
                );

                if (!sourceRow || !targetRow) {
                  toastr.error("Invalid date selection: row not found.");
                  return;
                }

                const nominationIndex = sourceRow.nomination.findIndex(
                  (n) => n.nominationNumber === nominationRow.nominationNumber
                );
                if (nominationIndex === -1) {
                  toastr.error("Nomination not found in source row.");
                  return;
                }

                const nomination = sourceRow.nomination.splice(nominationIndex, 1)[0];
                nomination.DATE_VALUE_ADJ = newDay;

                if (!targetRow.nomination) targetRow.nomination = [];
                targetRow.nomination.push(nomination);

                sourceRow.numberOfShips = sourceRow.nomination.length;
                targetRow.numberOfShips = targetRow.nomination.length;

                selection.products.forEach((product) => {
                  sourceRow[`adjustment_${product}CL`] = sourceRow.nomination.reduce(
                    (sum, n) => sum + (Number(n[`adjustedQty_${product}`]) || 0),
                    0
                  );
                  targetRow[`adjustment_${product}CL`] = targetRow.nomination.reduce(
                    (sum, n) => sum + (Number(n[`adjustedQty_${product}`]) || 0),
                    0
                  );
                });

                recalculateLiftingData();
                $("#liftingAmendmentGrid").dxDataGrid("instance").refresh();
                renderAllKpiCards();
              },
            },
            cellTemplate: function (container, options) {
              const adjDay = options.data.DATE_VALUE_ADJ;
              if (typeof adjDay === "number" && adjDay > 0 && adjDay <= 31) {
                const date = new Date(parseInt(yearStr), monthMap[monthStr], adjDay);
                $(container).text(formatDateMMDDYYYY(date));
              } else {
                $(container).text("");
              }
            },
          };

          const nominationGrid = $("<div>")
            .dxDataGrid({
              dataSource: details,
              showBorders: true,
              columnAutoWidth: true,
              editing: { mode: "cell", allowUpdating: true },
              onEditingStart: function (e) {
                const parentFullDate = new Date(
                  parseInt(yearStr),
                  monthMap[monthStr],
                  parentRowDate
                );
                parentFullDate.setHours(0, 0, 0, 0);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (parentFullDate < today) e.cancel = true;
              },
              columns: [
                ...baseColumns,
                { caption: "Actual Qty", columns: actualColumns },
                { caption: "Scheduled Qty", columns: scheduledColumns },
                { caption: "Adjusted Qty", columns: adjustedColumns },
                dateMoveColumn,
              ],
              onRowUpdated: function () {
                const parentRow = liftingAmendmentData.find(
                  (row) => Number(row.date) === parentRowDate
                );
                if (!parentRow) return;

                selection.products.forEach((product) => {
                  parentRow[`adjustment_${product}CL`] =
                    parentRow.nomination.reduce(
                      (sum, n) =>
                        sum + (Number(n[`adjustedQty_${product}`]) || 0),
                      0
                    );
                });

                recalculateLiftingData();
                $("#liftingAmendmentGrid").dxDataGrid("instance").refresh();
                renderAllKpiCards();
              },
              onEditorPrepared(e) {
                if (e.dataField && /^adjustedQty_/.test(e.dataField)) {
                  const cellDate = new Date(parseInt(yearStr), monthMap[monthStr], parentRowDate);
                  cellDate.setHours(0, 0, 0, 0);

                  const today = new Date();
                  today.setHours(0, 0, 0, 0);

                  if (cellDate >= today) {
                    $(e.editorElement).find("input").css("cursor", "text");
                  } else {
                    $(e.editorElement).find("input").css("cursor", "not-allowed");
                  }
                }
              },
              onCellPrepared(e) {
                if (e.rowType !== "data") return;

                const cellDate = new Date(parseInt(yearStr), monthMap[monthStr], parentRowDate);
                cellDate.setHours(0, 0, 0, 0);

                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const isAdjQty = /^adjustedQty_/.test(e.column.dataField);
                const isMoveDate = e.column.dataField === "DATE_VALUE_ADJ";

                if (cellDate < today) {
                  // Past dates: disable edit styling
                  if (isAdjQty || isMoveDate) {
                    $(e.cellElement).css({
                      backgroundColor: "#eee",
                      color: "#999",
                      cursor: "not-allowed"
                    });
                  }
                } else {
                  // Present/Future dates: make cursor text for adjustedQty
                  if (isAdjQty) {
                    $(e.cellElement).css({
                      cursor: "text"
                    });
                  }
                }
              }
            })
            .appendTo(container);
        },
      }
    });

    function setGridDynamicHeight() {
      const windowHeight = $(window).height();
      const headerHeight = $("#app-header").outerHeight(true);
      const buttonHeight = $(".button-group").outerHeight(true);
      const footerHeight = $(".bottom-buttons").outerHeight(true);
      const kpiHeight = $(".kpi-card")
        .first()
        .closest(".row")
        .outerHeight(true);
      const totalOffset =
        headerHeight + buttonHeight + footerHeight + kpiHeight + 40;
      const availableHeight = windowHeight - totalOffset;

      $("#liftingAmendmentGrid")
        .dxDataGrid("instance")
        .option("height", availableHeight);
    }

    $(window).off("resize").on("resize", setGridDynamicHeight);
    setTimeout(setGridDynamicHeight, 200);

    window.recalculateLiftingData = recalculateLiftingData;
    window.storeOriginalNominationState = storeOriginalNominationState;
    window.updateFooterButtons = updateFooterButtons;
    window.latestAmendmentRequests = latestAmendmentRequests;
    window.renderAllKpiCards = renderAllKpiCards;
    window.liftingAmendmentData = liftingAmendmentData;
    window.countryMap = countryMap;
    window.inventoryPlanningData = inventoryPlanningData;
    window.generatePDF = generatePDF;
  };

  // --- Keep session alive by pinging SASLogon every 3 minutes ---
  function keepSessionAlive() {
    fetch(`${BASE_URL}/SASLogon/`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    }).then(res => {
      if (!res.ok) {
        console.warn('Keep-alive failed:', res.status);
      }
    }).catch(err => {
      console.error('Keep-alive error:', err);
    });
  }
  setInterval(keepSessionAlive, 180000); // 3 minutes

  // Add event handler for bulk adjust button
  $(document).on('click', '.bulk-adjust-btn', function () {
    $('#bulkAdjustType').val($(this).data('type'));
    $('#bulkAdjustProduct').val($(this).data('product'));
    $('#bulkAdjustLocation').val($(this).data('location'));
    $('#bulkFromDate').val('');
    $('#bulkToDate').val('');
    $('#bulkAdjustValue').val('');
    $('#bulkAdjustModal').modal('show');
  });

  // Apply bulk adjustment
  $(document).on('click', '#applyBulkAdjust', function () {
    const from = parseInt($('#bulkFromDate').val());
    const to = parseInt($('#bulkToDate').val());
    const value = parseFloat($('#bulkAdjustValue').val());
    const type = $('#bulkAdjustType').val(); // "TA", "CL", or "WC"
    const product = $('#bulkAdjustProduct').val();
    const location = $('#bulkAdjustLocation').val();

    if (isNaN(from) || isNaN(to) || isNaN(value)) {
      toastr.error("Please fill all fields.");
      return;
    }

    if (type === "WC") {
      // Bulk update for Working Capacity modal
      workingCapacityData.forEach(row => {
        if (row.Date >= from && row.Date <= to) {
          row[product] = value;
        }
      });
      // Refresh the grid
      $("#workingCapacityGrid").dxDataGrid("instance").refresh();
      toastr.success("Working Capacity updated!");
    } else {
      // Bulk update for main grid
      liftingAmendmentData.forEach(row => {
        if (row.date >= from && row.date <= to) {
          const suffix = location ? `${product}_${location}` : product;
          row[`adjustment_${suffix}${type}`] = value;
          if (type === "CL" && Array.isArray(row.nomination)) {
            const perNom = row.nomination.length ? value / row.nomination.length : 0;
            row.nomination.forEach(n => {
              n[`adjustedQty_${product}`] = perNom;
            });
          }
        }
      });
      recalculateLiftingData();
      $("#liftingAmendmentGrid").dxDataGrid("instance").refresh();
      renderAllKpiCards();
      toastr.success("Bulk adjustment applied!");
    }

    $('#bulkAdjustModal').modal('hide');
  });

  // Add event handler for working capacity bulk icon button
  $(document).on('click', '.working-capacity-bulk-btn', function () {
    // Hide the Working Capacity modal first
    $('#workingCapacityModal').modal('hide');

    // Set up the bulk modal as before
    $('#bulkAdjustType').val('WC');
    $('#bulkAdjustProduct').val($(this).data('product'));
    $('#bulkAdjustLocation').val('');
    $('#bulkFromDate').val('');
    $('#bulkToDate').val('');
    $('#bulkAdjustValue').val('');

    // Show the bulk modal
    $('#bulkAdjustModal').modal('show');

    $('#bulkAdjustModal').on('hidden.bs.modal', function () {
      // Only re-show if the Working Capacity modal was open before
      if (!$('.modal.show').length) {
        $('#workingCapacityModal').modal('show');
      }
    });
  });
});

// Add a helper function at the top (after imports)
function formatDateMMDDYYYY(date) {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d)) return date;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}