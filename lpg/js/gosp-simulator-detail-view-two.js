import { BASE_URL, API_ENDPOINTS } from "../api/api-config.js";

$(document).ready(function () {
    let userAdjustedValues = {};

    $(document).on("change", ".area-checkbox", function () {
        const gridInstance = $("#gospGrid2").dxDataGrid("instance");
        if (gridInstance) {
            const currentData = gridInstance.option("dataSource") || [];
            currentData.forEach(row => {
                const key = `${row.area}_${row.gosp}`;
                if (!userAdjustedValues[key]) userAdjustedValues[key] = {};
                Object.keys(row).forEach(field => {
                    if (field.startsWith("adj_")) {
                        userAdjustedValues[key][field] = row[field];
                    }
                });
            });
        }

        const $checkboxes = $(".area-checkbox");
        const selectedAreas = $checkboxes
            .filter(":checked")
            .map(function () { return this.value; })
            .get();

        if (selectedAreas.length === 0) {
            $(this).prop("checked", true);
            toastr.warning("At least one area must remain selected.");
            return;
        }

        selection.areas = selectedAreas;

        const AREA_TO_GOSPS = {};
        originalGOSPData.forEach(row => {
            if (!AREA_TO_GOSPS[row.PLANT_AREA_CODE]) {
                AREA_TO_GOSPS[row.PLANT_AREA_CODE] = new Set();
            }
            AREA_TO_GOSPS[row.PLANT_AREA_CODE].add(row.GOSP_CODE);
        });
        Object.keys(AREA_TO_GOSPS).forEach(area => {
            AREA_TO_GOSPS[area] = Array.from(AREA_TO_GOSPS[area]);
        });

        selection.gosps = selectedAreas.flatMap(area => AREA_TO_GOSPS[area] || []);

        handleGospReadResponse({
            GOSP_DATA: originalGOSPData,
            GAUGE_FACTOR: Object.entries(gaugedFactors).map(([GOSP_CODE, GAUGE_FACTOR]) => ({
                GOSP_CODE,
                GAUGE_FACTOR
            })),
            TOT_PROD_DATA: originalTotalProductionData,
            VERSION: versionListFromBackend
        });
    });

    $.ajaxSetup({ cache: false });

    const currentDate = moment();

    function getQueryParams() {
        const params = new URLSearchParams(window.location.search);
        return {
            productGroup: params.get("productGroup") || "",
            products: params.get("product")?.split(",") || [],
            areas: params.get("area")?.split(",") || [],
            gosps: params.get("gosp")?.split(",") || [],
            month: params.get("month") || "",
            versionNo: Number(params.get("versionNo") || -1)
        };
    }

    const selection = getQueryParams();

    function updateHeader(selection) {
        $("#app-header .title").html(`
      <strong>GOSP Simulator</strong> -
      <strong>Products:</strong> ${selection.products} |
      <strong>Month:</strong> ${selection.month} |
      <strong>Version:</strong> ${activeVersionFromReadAPI?.VERSION_NAME || "N/A"
            } |
      <strong>Description:</strong> ${activeVersionFromReadAPI?.VERSION_DESCRIPTION || "No description"
            }
    `);
    }

    let gaugedFactors = {};
    let activeVersionFromReadAPI = null;
    let savedVersions = [];
    let versionListFromBackend = [];
    let originalGOSPData = [];
    let originalTotalProductionData = [];

    function populateGaugeFactorModal() {
        const tbody = $("#gaugeFactorTableBody");
        tbody.empty();

        selection.gosps.forEach(gosp => {
            const key = gosp;
            const factor = gaugedFactors[key] ?? 1;
            const row = `
     <tr>
       <td>${gosp}</td>
       <td><input type="number" step="0.01" value="${factor}" data-key="${key}"></td>
     </tr>`;
            tbody.append(row);
        });
    }

    $("#gaugeFactorBtn").on("click", function () {
        populateGaugeFactorModal();
        $("#gaugeFactorModal").modal("show");
    });

    $("#saveGaugeFactorBtn").on("click", function () {
        const updatedFactors = {};
        $("#gaugeFactorTableBody input").each(function () {
            const key = $(this).closest("tr").find("td:first").text().split("_").pop();
            const value = parseFloat($(this).val()) || 1;
            updatedFactors[key] = value;
        });
        console.log("Saved Gauge Factors:", updatedFactors);
        Object.assign(gaugedFactors, updatedFactors);
        $("#gaugeFactorModal").modal("hide");
        $("#gospGrid2").dxDataGrid("instance").refresh();
    });

    $("#updateGaugeFactorBtn").on("click", async function () {
        const updateBtn = $(this);
        const saveBtn = $("#saveGaugeFactorBtn");
        const closeBtn = $("#gaugeFactorModal .btn-close, #gaugeFactorModal .btn-cancel");
        closeBtn.prop("disabled", true);

        updateBtn
            .prop("disabled", true)
            .html(
                '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Updating...'
            );
        saveBtn.prop("disabled", true);

        let factors = [];
        $("#gaugeFactorTableBody tr").each(function () {
            let gospCode = $(this).find("td:first").text().trim();
            let factor = parseFloat($(this).find("input[type=number]").val()) || 1;

            gaugedFactors[gospCode] = factor;

            let apiFactor = (window.lastReadGaugeFactors || []).find(item =>
                item.GOSP_CODE === gospCode && item.PRODUCT_CODE === selection.products[0]
            );

            factors.push({
                GOSP_CODE: gospCode,
                PRODUCT_CODE: selection.products[0],
                BASE_UNIT: apiFactor?.BASE_UNIT || "MB",
                CONVERSION_UNIT: apiFactor?.CONVERSION_UNIT || "MB",
                GAUGE_FACTOR: factor
            });
        });

        const csrfToken = await fetchCSRFToken();
        const payload = { FACTORS: factors };
        console.log("Gauge Factor Update Payload:", JSON.stringify(payload, null, 2));

        try {
            const response = await fetch(`${BASE_URL}${API_ENDPOINTS.UPDATE_GAUGE_FACTOR}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRF-TOKEN": csrfToken,
                    "Cache-Control": "no-cache"
                },
                credentials: "include",
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error("Failed to update Gauge Factor");

            const contentType = response.headers.get("Content-Type") || "";
            if (contentType.includes("application/json")) {
                const result = await response.json();
            }

            toastr.success("Gauge factors updated successfully!");
            $("#gospGrid2").dxDataGrid("instance").refresh();
        } catch (error) {
            console.error("Gauge Factor Update Failed:", error);
            toastr.error("Failed to update gauge factors.");
        } finally {
            updateBtn.prop("disabled", false).html("Update (API)");
            saveBtn.prop("disabled", false);
            closeBtn.prop("disabled", false);
            $("#gaugeFactorModal").modal("hide");
        }
    });

    async function fetchCSRFToken() {
        const csrfURL = `${BASE_URL}${API_ENDPOINTS.CSRF}?_t=${Date.now()}`;
        const res = await fetch(csrfURL, {
            method: "GET",
            credentials: "include",
            headers: { "Cache-Control": "no-cache" },
        });
        return res.headers.get("X-CSRF-TOKEN");
    }

    // Open Button
    $("#openButton").on("click", function () {
        const $select = $("#versionSelect").empty();
        const $message = $("#noVersionsMessage");

        if (savedVersions.length > 0) {
            savedVersions.forEach((v) => {
                $select.append(
                    `<option value="${String(v.id)}">${v.name || "Unnamed Version"}</option>`
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
        const selectedVersion = savedVersions.find(v => String(v.id) === selectedId);

        if (!selectedVersion) {
            toastr.error("Please select a version.");
            return;
        }

        selection.versionNo = Number(selectedVersion.id);
        callGOSPReadAPI();

        $("#openVersionModal").modal("hide");
    });

    // Save Button
    $("#saveButton").on("click", function () {
        saveData();
    });

    async function saveData() {
        $("#loadingSpinner, .overlay").show();

        const grid = $("#gospGrid2").dxDataGrid("instance");
        const data = grid.option("dataSource");

        const GOSP_DATA = [];
        const TOT_PROD_DATA = [];

        const monthValue = selection.month.replace(" ", "").toUpperCase();

        data.forEach(row => {
            const area = row.area;
            const gosp = row.gosp;

            Object.keys(row).forEach(key => {
                if (key.startsWith("act_") || key.startsWith("adj_")) {
                    const date = key.split("_")[1];
                    const type = key.split("_")[0];

                    const matched = originalGOSPData.find(r =>
                        r.DATE_VALUE == date &&
                        r.PLANT_AREA_CODE === area &&
                        r.GOSP_CODE === gosp &&
                        r.PRODUCT_CODE === selection.products[0]
                    ) || {};

                    GOSP_DATA.push({
                        VERSION_NO: matched.VERSION_NO ?? -1,
                        HISTORY_NO: matched.HISTORY_NO ?? null,
                        KS_ROW_NUM: matched.KS_ROW_NUM ?? null,
                        PRODUCT_GROUP: selection.productGroup,
                        PRODUCT_CODE: selection.products[0],
                        PLANT_AREA_CODE: area,
                        GOSP_CODE: gosp,
                        GOSP_NAME: matched.GOSP_NAME ?? "",
                        DATE_VALUE: date,
                        MONTH_VALUE: monthValue,
                        ACTUAL_QTY: type === "act" ? row[key] ?? matched.ACTUAL_QTY ?? 0 : matched.ACTUAL_QTY ?? 0,
                        ADJUSTED_QTY: type === "adj" ? row[key] ?? matched.ADJUSTED_QTY ?? 0 : matched.ADJUSTED_QTY ?? 0
                    });
                }
            });

            TOT_PROD_DATA.push({
                DATE_VALUE: row.date,
                TOTAL_PRODUCTION_QTY: row.totalProduction || 0
            });
        });

        const GAUGE_FACTOR = Object.entries(gaugedFactors).map(([gosp, factor]) => ({
            GOSP_CODE: gosp,
            PRODUCT_CODE: selection.products[0],
            BASE_UNIT: "MB",
            CONVERSION_UNIT: "MB",
            GAUGE_FACTOR: factor
        }));

        const payload = {
            VERSION: versionListFromBackend,
            GAUGE_FACTOR: GAUGE_FACTOR,
            GOSP_DATA: GOSP_DATA,
            TOT_PROD_DATA: TOT_PROD_DATA
        };

        console.log("Final Save Payload:", payload);

        try {
            const csrfToken = await fetchCSRFToken();
            const response = await fetch(`${BASE_URL}${API_ENDPOINTS.GOSP_SAVE}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRF-TOKEN": csrfToken,
                    "Cache-Control": "no-cache",
                },
                credentials: "include",
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error("Save API failed with status: " + response.status);

            const result = await response.json();
            console.log("Save Success:", result);
            toastr.success("GOSP data saved successfully!");

            userAdjustedValues = {};
            handleGospReadResponse(result);
        } catch (error) {
            console.error("Save Failed:", error);
            toastr.error("Failed to save GOSP data.");
        } finally {
            $("#loadingSpinner, .overlay").fadeOut();
        }
    }

    // Save As Button
    $("#saveAsButton").on("click", function () {
        $("#saveName").val("");
        $("#saveDescription").val("");
        $("#saveAsModal").modal("show");
    });

    $("#saveAsForm").on("submit", async function (e) {
        e.preventDefault();
        $("#loadingSpinner, .overlay").show();

        $("#saveAsModal .btn-close").prop("disabled", true);
        $("#saveAsModal .btn-cancel").prop("disabled", true);

        const name = $("#saveName").val().trim();
        const description = $("#saveDescription").val().trim();

        if (!name) {
            toastr.error("Please enter a name");
            $("#loadingSpinner, .overlay").fadeOut();
            $("#saveAsSubmitBtn").prop("disabled", false);
            $("#saveAsLoadingSpinner").addClass("d-none");
            $("#saveAsBtnText").text("Save");
            $("#saveAsModal .btn-close").prop("disabled", false);
            $("#saveAsModal .btn-cancel").prop("disabled", false);
            return;
        }

        if (savedVersions.some(version => version.name === name)) {
            toastr.error("Version name already exists. Please choose a different name.");
            $("#loadingSpinner, .overlay").fadeOut();
            $("#saveAsSubmitBtn").prop("disabled", false);
            $("#saveAsLoadingSpinner").addClass("d-none");
            $("#saveAsBtnText").text("Save");
            $("#saveAsModal .btn-close").prop("disabled", false);
            $("#saveAsModal .btn-cancel").prop("disabled", false);
            return;
        }

        $("#saveAsSubmitBtn").prop("disabled", true);
        $("#saveAsLoadingSpinner").removeClass("d-none");
        $("#saveAsBtnText").text("Saving...");

        try {
            const grid = $("#gospGrid2").dxDataGrid("instance");
            const data = grid.option("dataSource");

            const monthValue = selection.month.replace(" ", "").toUpperCase();

            const GOSP_DATA = [];
            const TOT_PROD_DATA = [];

            data.forEach(row => {
                const area = row.area;
                const gosp = row.gosp;

                Object.keys(row).forEach(key => {
                    if (key.startsWith("act_") || key.startsWith("adj_")) {
                        const date = key.split("_")[1];
                        const type = key.split("_")[0];

                        const matched = originalGOSPData.find(r =>
                            r.DATE_VALUE == date &&
                            r.PLANT_AREA_CODE === area &&
                            r.GOSP_CODE === gosp &&
                            r.PRODUCT_CODE === selection.products[0]
                        ) || {};

                        GOSP_DATA.push({
                            VERSION_NO: matched.VERSION_NO ?? -1,
                            HISTORY_NO: matched.HISTORY_NO ?? null,
                            KS_ROW_NUM: matched.KS_ROW_NUM ?? null,
                            PRODUCT_GROUP: selection.productGroup,
                            PRODUCT_CODE: selection.products[0],
                            PLANT_AREA_CODE: area,
                            GOSP_CODE: gosp,
                            GOSP_NAME: matched.GOSP_NAME ?? "",
                            DATE_VALUE: date,
                            MONTH_VALUE: monthValue,
                            ACTUAL_QTY: type === "act" ? row[key] ?? matched.ACTUAL_QTY ?? 0 : matched.ACTUAL_QTY ?? 0,
                            ADJUSTED_QTY: type === "adj" ? row[key] ?? matched.ADJUSTED_QTY ?? 0 : matched.ADJUSTED_QTY ?? 0
                        });
                    }
                });

                TOT_PROD_DATA.push({
                    DATE_VALUE: row.date,
                    TOTAL_PRODUCTION_QTY: row.totalProduction || 0
                });
            });

            const GAUGE_FACTOR = Object.entries(gaugedFactors).map(([gosp, factor]) => ({
                GOSP_CODE: gosp,
                PRODUCT_CODE: selection.products[0],
                BASE_UNIT: "MB",
                CONVERSION_UNIT: "MB",
                GAUGE_FACTOR: factor
            }));

            const payload = {
                VERSION: {
                    VERSION_NO: -1,
                    VERSION_NAME: name,
                    VERSION_DESCRIPTION: description
                },
                GAUGE_FACTOR: GAUGE_FACTOR,
                GOSP_DATA: GOSP_DATA,
                TOT_PROD_DATA: TOT_PROD_DATA,
            };

            console.log("Save As Payload:", payload);

            const csrfToken = await fetchCSRFToken();

            const response = await fetch(`${BASE_URL}${API_ENDPOINTS.GOSP_SAVE}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRF-TOKEN": csrfToken,
                    "Cache-Control": "no-cache"
                },
                credentials: "include",
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error("Save As failed: " + response.status);
            const result = await response.json();

            toastr.success(`Saved as "${name}"`);
            $("#saveAsModal").modal("hide");

            userAdjustedValues = {};
            handleGospReadResponse(result);

            activeVersionFromReadAPI = {
                VERSION_NO: result.VERSION?.VERSION_NO ?? -1,
                VERSION_NAME: result.VERSION?.VERSION_NAME ?? name,
                VERSION_DESCRIPTION: result.VERSION?.VERSION_DESCRIPTION ?? description
            };
            updateHeader(selection);
        } catch (err) {
            console.error("Save As Failed:", err);
            toastr.error("Failed to save version.");
        } finally {
            $("#saveAsSubmitBtn").prop("disabled", false);
            $("#saveAsLoadingSpinner").addClass("d-none");
            $("#saveAsBtnText").text("Save");
            $("#loadingSpinner, .overlay").fadeOut();
            $("#saveAsModal .btn-close").prop("disabled", false);
            $("#saveAsModal .btn-cancel").prop("disabled", false);
        }
    });

    // Notify OSPAS Button
    $("#notifyOSPASBtn").on("click", function () {
        $("#ospasComment").val("");
        $("#notifyOSPASModal").modal({
            backdrop: "static",
            keyboard: false
        }).modal("show");
    });

    $("#sendOSPASBtn").on("click", async function () {
        const comment = $("#ospasComment").val().trim();
        if (!comment) {
            toastr.error("Please enter a comment before sending.");
            return;
        }

        $("#sendOSPASBtn").prop("disabled", true);
        $("#notifyOSPASModal .btn-close").prop("disabled", true);
        $("#notifyOSPASModal .btn-cancel").prop("disabled", true);
        $("#ospasSpinner").removeClass("d-none");
        $("#ospasBtnText").text("Sending...");

        try {
            const csrfToken = await fetchCSRFToken();
            const payload = {
                COMMENT: comment,
                MONTH_VALUE: selection.month.replace(/\s+/g, "").toUpperCase(),
                PRODUCT_CODE: selection.products[0],
                PRODUCT_GROUP: selection.productGroup,
                VERSION_NO: activeVersionFromReadAPI?.VERSION_NO ?? -1
            };

            const response = await fetch(`${BASE_URL}${API_ENDPOINTS.NOTIFY_OSPAS}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRF-TOKEN": csrfToken,
                    "Cache-Control": "no-cache"
                },
                credentials: "include",
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error("Notification failed");

            toastr.success("Notification sent to OSPAS successfully.");
            $("#notifyOSPASModal").modal("hide");
        } catch (err) {
            console.error("Notify OSPAS Failed:", err);
            toastr.error("Failed to notify OSPAS.");
        } finally {
            $("#sendOSPASBtn").prop("disabled", false);
            $("#notifyOSPASModal .btn-close").prop("disabled", false);
            $("#notifyOSPASModal .btn-cancel").prop("disabled", false);
            $("#ospasSpinner").addClass("d-none");
            $("#ospasBtnText").text("Send");
        }
    });

    function renderAreaFilterOptions() {
        const container = $("#areaFilterContainer").empty();
        const uniqueAreas = [...new Set(originalGOSPData.map(r => r.PLANT_AREA_CODE))];

        uniqueAreas.forEach(area => {
            const checked = selection.areas.includes(area) ? "checked" : "";
            const checkbox = `
            <label class="mr-3 mb-2 d-inline-block">
                <input type="checkbox" class="area-checkbox" value="${area}" ${checked}>
                ${area}
            </label>
        `;
            container.append(checkbox);
        });
    }

    async function callGOSPReadAPI() {
        try {
            $("#loadingSpinner, .overlay").show();

            const payload = {
                PRODUCT_GROUP: selection.productGroup,
                PRODUCT_CODE: selection.products,
                PLANT_AREA_CODE: selection.areas,
                MONTH_VALUE: moment(selection.month, "MMM YYYY").format("MMMYYYY").toUpperCase(),
                GOSP_CODE: selection.gosps,
                VERSION_NO: selection.versionNo
            };

            // const csrfToken = await fetchCSRFToken();
            // const response = await fetch(`${BASE_URL}${API_ENDPOINTS.GOSP_READ}`, {
            //     method: "POST",
            //     headers: {
            //         "Content-Type": "application/json",
            //         "X-CSRF-TOKEN": csrfToken,
            //         "Cache-Control": "no-cache"
            //     },
            //     credentials: "include",
            //     body: JSON.stringify(payload)
            // });
            // const json = await response.json();

            const response = await fetch("../response/gosp_dynamic_production.json")
            const json = await response.json();

            $("#loadingSpinner, .overlay").fadeOut();
            toastr.success("GOSP data loaded successfully", "Success");

            originalTotalProductionData = json.TOT_PROD_DATA || [];

            // Saved Versions
            if (Array.isArray(json.LIST_VERSIONS)) {
                savedVersions = json.LIST_VERSIONS.map(v => ({
                    id: v.VERSION_NO,
                    name: v.VERSION_NAME,
                    description: v.VERSION_DESCRIPTION
                }));
            }

            if (Array.isArray(json.VERSION) && json.VERSION.length > 0) {
                versionListFromBackend = json.VERSION;
                activeVersionFromReadAPI = {
                    VERSION_NO: json.VERSION[0].VERSION_NO,
                    VERSION_NAME: json.VERSION[0].VERSION_NAME,
                    VERSION_DESCRIPTION: json.VERSION[0].VERSION_DESCRIPTION
                };
            }
            updateHeader(selection);
            handleGospReadResponse(json);
            renderAreaFilterOptions();
        } catch (error) {
            console.error("read_api Call Failed:", error);
            toastr.error(`Failed to load data from backend.\n${error}`);
        } finally {
            $("#loadingSpinner").fadeOut();
        }
    };

    $("#resetAdjustmentsBtn").on("click", function () {
        $("#resetAdjustmentsConfirmModal").modal("show");
    });

    $("#confirmResetAdjustmentsBtn").on("click", function () {
        const grid = $("#gospGrid2").dxDataGrid("instance");
        const data = grid.option("dataSource");

        const currentDay = currentDate.date();

        data.forEach(row => {
            Object.keys(row).forEach(key => {
                if (key.startsWith("adj_")) {
                    const date = key.split("_")[1];
                    const rowDate = moment(date, "DMMMYYYY");
                    if (rowDate.isSameOrAfter(currentDate, "day")) {
                        row[key] = null;
                    }
                }
            });
        });

        grid.refresh();
        $("#resetAdjustmentsConfirmModal").modal("hide");
        toastr.success("GOSP adjustments reset successfully.");
    });

    function handleGospReadResponse(json) {
        originalGOSPData = json.GOSP_DATA || [];

        gaugedFactors = {};
        (json.GAUGE_FACTOR || []).forEach(item => {
            gaugedFactors[item.GOSP_CODE] = item.GAUGE_FACTOR ?? 1;
        });
        window.lastReadGaugeFactors = json.GAUGE_FACTOR || [];

        const totalProdMap = {};
        (json.TOT_PROD_DATA || []).forEach(r => {
            totalProdMap[r.DATE_VALUE] = r.TOTAL_PRODUCTION_QTY;
        });

        const filtered = (json.GOSP_DATA || []).filter(r =>
            selection.products.includes(r.PRODUCT_CODE) &&
            selection.areas.includes(r.PLANT_AREA_CODE) &&
            selection.gosps.includes(r.GOSP_CODE)
        );
        const dates = Array.from(new Set(filtered.map(r => r.DATE_VALUE)))
            .sort((a, b) => moment(a, "DMMMYYYY").diff(moment(b, "DMMMYYYY")));

        const mtdByGosp = {}, mbdByGosp = {}, avgVarianceByGosp = {};
        const daily = {};
        filtered.forEach(r => {
            const d = moment(r.DATE_VALUE, "DMMMYYYY");
            if (!daily[r.GOSP_CODE]) daily[r.GOSP_CODE] = { mtd: 0, mtdN: 0, mbd: 0, mbdN: 0, var: 0, varN: 0 };
            daily[r.GOSP_CODE].mbd += r.ACTUAL_QTY || 0;
            daily[r.GOSP_CODE].mbdN++;
            if (d.isSameOrBefore(currentDate, "day")) {
                daily[r.GOSP_CODE].mtd += r.ACTUAL_QTY || 0;
                daily[r.GOSP_CODE].mtdN++;
            }
            // compute daily variance for this GOSP
            const sumG = filtered
                .filter(x => x.GOSP_CODE === r.GOSP_CODE && x.DATE_VALUE === r.DATE_VALUE)
                .reduce((s, x) => s + (x.ACTUAL_QTY || 0) + (x.ADJUSTED_QTY || 0), 0);
            const v = Math.abs(sumG - (totalProdMap[r.DATE_VALUE] || 0));
            daily[r.GOSP_CODE].var += v;
            daily[r.GOSP_CODE].varN++;
        });

        selection.gosps.forEach(g => {
            const d = daily[g] || {};
            mtdByGosp[g] = d.mtdN ? d.mtd / d.mtdN : 0;
            mbdByGosp[g] = d.mbdN ? d.mbd / d.mbdN : 0;
            avgVarianceByGosp[g] = d.varN ? d.var / d.varN : 0;
        });

        function renderKpiCard(title, dataMap) {
            const headers = selection.gosps.map(g => `<th>${g}</th>`).join("");
            const values = selection.gosps
                .map(g => `<td>${(dataMap[g] || 0).toFixed(2)}</td>`)
                .join("");

            const cardHtml = `
        <div class="kpi-card">
          <div class="card-title">${title}</div>
            <div class="kpi-table-wrapper">
              <table class="table table-sm table-borderless text-center mb-0">
                <thead>
                  <tr class="kpi-header-row">${headers}</tr>
                </thead>
                <tbody>
                  <tr>${values}</tr>
                </tbody>
              </table>
            </div>
        </div>`;

            $("#kpiScrollContainer").append(cardHtml);
        }

        $("#kpiScrollContainer").empty();
        renderKpiCard("MTD (Avg)", mtdByGosp);
        renderKpiCard("MBD (Avg)", mbdByGosp);
        renderKpiCard("Average Production Variance", avgVarianceByGosp);

        const gaugedFactorsMap = {};
        (json.GAUGE_FACTOR || []).forEach(f => {
            gaugedFactorsMap[f.GOSP_CODE] = f.GAUGE_FACTOR ?? 1;
        });

        const perGospRows = [];

        selection.areas.forEach(area => {
            selection.gosps.forEach(gosp => {
                const actRow = {
                    area: area,
                    gosp: gosp,
                    metric: "Actual"
                };
                const adjRow = {
                    area: area,
                    gosp: gosp,
                    metric: "Adjustment"
                };

                dates.forEach(date => {
                    const key = `d_${date}`;
                    actRow[key] = 0;
                    adjRow[key] = 0;
                });

                filtered.forEach(r => {
                    if (r.PLANT_AREA_CODE !== area || r.GOSP_CODE !== gosp) return;
                    const key = `d_${r.DATE_VALUE}`;
                    actRow[key] += r.ACTUAL_QTY || 0;
                    adjRow[key] += r.ADJUSTED_QTY || 0;
                });

                perGospRows.push(actRow, adjRow);
            });
        });

        const sumRow = { metric: "Sum" };
        const sumGfRow = { metric: "Sum with Gauged Factor" };
        const totalRow = { metric: "Total Production" };
        const varRow = { metric: "Production Variance" };
        const gvarRow = { metric: "Gauged Variance" };

        dates.forEach(date => {
            const key = `d_${date}`;

            let sum = 0;
            let sumGf = 0;

            filtered
                .filter(r => r.DATE_VALUE === date)
                .forEach(r => {
                    const actAdj = (r.ACTUAL_QTY || 0) + (r.ADJUSTED_QTY || 0);
                    sum += actAdj;
                    sumGf += actAdj * (gaugedFactorsMap[r.GOSP_CODE] ?? 1);
                });

            const totProd = totalProdMap[date] || 0;

            sumRow[key] = sum;
            sumGfRow[key] = sumGf;
            totalRow[key] = totProd;
            varRow[key] = sum - totProd;
            gvarRow[key] = sumGf - totProd;
        });


        const summaryData = [
            ...perGospRows,
            sumRow,
            sumGfRow,
            totalRow,
            varRow,
            gvarRow
        ];

        const cols = [
            { dataField: "area", caption: "Area", width: 100, allowEditing: false },
            { dataField: "gosp", caption: "GOSP", width: 100, allowEditing: false },
            { dataField: "metric", caption: "Metric", width: 150, allowEditing: false }
        ];

        dates.forEach(date => {
            cols.push({
                dataField: `d_${date}`,
                caption: moment(date, "DMMMYYYY").date(),
                dataType: "number",
                format: { type: "fixedPoint", precision: 0 },
                alignment: "center",
                allowEditing: false,
                width: 90
            });
        });

        $("#gospGrid2").dxDataGrid({
            dataSource: summaryData,
            columns: cols,
            showBorders: true,
            columnAutoWidth: true,
            paging: false,
            height: "auto",
        });

    }

    callGOSPReadAPI();
});