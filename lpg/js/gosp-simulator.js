import { BASE_URL, API_ENDPOINTS } from "../api/api-config.js";

$(document).ready(function () {
    $.ajaxSetup({ cache: false });

    let productCodeToName = {};
    let mappingData = [];
    let groupToProducts = {};
    let productToAreas = {};
    let areaToGosps = {};
    let gospNameToCode = {};
    let selectedVersionNo = -1;

    $("#loadingSpinner").show();

    async function sasgetCSRFToken() {
        const csrfURL = `${BASE_URL}${API_ENDPOINTS.CSRF}?_t=${Date.now()}`;
        const res = await fetch(csrfURL, {
            method: "GET",
            credentials: "include",
            headers: { "Cache-Control": "no-cache" },
        });

        if (!res.ok) throw new Error(`Failed to fetch CSRF token: ${res.status}`);
        return res.headers.get("X-CSRF-TOKEN");
    }

    (async function fetchGospMapping() {
        try {
            // Real SAS API ─────────────
            // const csrfToken = await sasgetCSRFToken();
            // const response = await fetch(`${BASE_URL}${API_ENDPOINTS.GOSP_DROPDOWN}`, {
            //     method: "GET",
            //     headers: {
            //         "X-CSRF-TOKEN": csrfToken,
            //         "Cache-Control": "no-cache"
            //     },
            //     credentials: "include"
            // });

            // Local mock JSON ──────────
            const response = await fetch("../response/gosp-dropdown.json?v=" + Date.now());

            if (!response.ok) {
                throw new Error(`GOSP API fetch failed: ${response.status}`);
            }

            const data = await response.json();

            mappingData = data.MAPPING;
            buildMaps(mappingData);
            populateProductGroups(Object.keys(groupToProducts));

            if (data.VERSION_NO !== undefined) {
                selectedVersionNo = data.VERSION_NO;
                window.selectedVersionNo = selectedVersionNo;
            }

            toastr.success("GOSP dropdown loaded successfully");
        } catch (error) {
            console.error("Failed to fetch GOSP_DROPDOWN API:", error);
            toastr.error("Failed to load GOSP dropdown: " + error.message, "Error");
        } finally {
            $("#loadingSpinner").hide();
        }
    })();



    function buildMaps(arr) {
        groupToProducts = {};
        productToAreas = {};
        areaToGosps = {};
        gospNameToCode = {};

        arr.forEach(item => {
            const grp = item.PRODUCT_GROUP;
            const prod = item.PRODUCT_CODE;
            const prodName = item.PRODUCT_CODE_NAME;
            const area = item.PLANT_AREA_CODE;
            const gosp = item.GOSP_NAME;

            groupToProducts[grp] = groupToProducts[grp] || new Set();
            groupToProducts[grp].add(prod);

            productToAreas[prod] = productToAreas[prod] || new Set();
            productToAreas[prod].add(area);

            areaToGosps[area] = areaToGosps[area] || new Set();
            areaToGosps[area].add(gosp);

            gospNameToCode[item.GOSP_NAME.trim().toLowerCase()] = item.GOSP_CODE;
            window.gospNameToCode = gospNameToCode;
            productCodeToName[prod] = prodName;
        });

        for (let k in groupToProducts) {
            groupToProducts[k] = Array.from(groupToProducts[k]);
        }
        for (let k in productToAreas) {
            productToAreas[k] = Array.from(productToAreas[k]);
        }
        for (let k in areaToGosps) {
            areaToGosps[k] = Array.from(areaToGosps[k]);
        }
    }

    function populateProductGroups(groups) {
        const $sel = $("#productGroup").empty()
            .append(`<option disabled selected value="">Select Product Group</option>`);
        groups.forEach(g => $sel.append(`<option value="${g}">${g}</option>`));
    }

    function populateProducts(products) {
        const $sel = $("#product").empty()
            .append(`<option disabled selected value="">Select Product</option>`);
        products.forEach(p => {
            const displayName = productCodeToName[p] || p;
            $sel.append(`<option value="${p}">${displayName}</option>`);
        });
    }

    function populateAreas(areas) {
        const $cont = $("#multiAreaCheckboxes").empty();
        areas.forEach(a => {
            $cont.append(`
            <div class="form-check">
              <input class="form-check-input area-checkbox" type="checkbox" value="${a}" id="area_${a}">
              <label class="form-check-label" for="area_${a}">${a}</label>
            </div>
        `);
        });
        $("#selectAllAreas").prop("checked", false);
        $("#gospContainer").empty();
        $("#selectAllGosp").prop("checked", false).parent().hide();
    }

    function populateGosps(gosps) {
        const $cont = $("#gospContainer").empty();
        const $selAll = $("#selectAllGosp").parent();
        if (gosps.length > 1) {
            $selAll.show();
            $("#selectAllGosp").prop("checked", false);
        } else {
            $selAll.hide();
        }

        gosps.forEach(g => {
            $cont.append(`
                <div class="form-check gosp-checkbox">
                  <input class="form-check-input" type="checkbox" id="gosp_${g}" value="${g}">
                  <label class="form-check-label" for="gosp_${g}">${g}</label>
                </div>
            `);
        });

        if (gosps.length === 1) {
            $cont.find("input[type=checkbox]").prop("checked", true);
        }
    }

    $("#productGroup").on("change", function () {
        const grp = this.value;
        populateProducts(groupToProducts[grp] || []);
    });

    $("#product").on("change", function () {
        const prod = this.value;
        populateAreas(productToAreas[prod] || []);
    });

    $(document).on("change", ".area-checkbox", function () {
        const selectedAreas = $(".area-checkbox:checked").map((_, el) => el.value).get();
        const gosps = Array.from(new Set(
            selectedAreas.flatMap(a => areaToGosps[a] || [])
        ));
        populateGosps(gosps);
    });

    $("#selectAllAreas").on("change", function () {
        $("#multiAreaCheckboxes input[type=checkbox]").prop("checked", this.checked).trigger("change");
    });

    $("#multiAreaCheckboxes").on("change", "input[type=checkbox]", function () {
        const all = $("#multiAreaCheckboxes input[type=checkbox]");
        const allChecked = all.length === all.filter(":checked").length;
        $("#selectAllAreas").prop("checked", allChecked);
    });

    $("#selectAllGosp").on("change", function () {
        $("#gospContainer input[type=checkbox]").prop("checked", this.checked);
    });

    $("#gospContainer").on("change", "input[type=checkbox]", function () {
        const all = $("#gospContainer input[type=checkbox]");
        $("#selectAllGosp").prop(all.length === all.filter(":checked").length);
    });

    $("#monthPicker").datepicker({
        format: "M yyyy",
        startView: "months",
        minViewMode: "months",
        autoclose: true
    }).datepicker("setDate", new Date());

    function validateForm() {
        $(".error-message").remove();

        const errors = {
            group: "",
            product: "",
            area: "",
            month: "",
            gosp: ""
        };

        if (!$("#productGroup").val()) errors.group = "Select Product Group.";
        if (!$("#product").val()) errors.product = "Select Product.";
        if ($(".area-checkbox:checked").length === 0) errors.area = "Select at least one Area.";
        if (!$("#monthPicker").val()) errors.month = "Select Month.";
        if ($("#gospContainer input:checked").length === 0) errors.gosp = "Select at least one GOSP.";

        if (errors.group) $("#productGroup").after(`<div class="error-message text-danger">${errors.group}</div>`);
        if (errors.product) $("#product").after(`<div class="error-message text-danger">${errors.product}</div>`);
        if (errors.area) $("#multiAreaCheckboxContainer").after(`<div class="error-message text-danger">${errors.area}</div>`);
        if (errors.month) $("#monthPicker").after(`<div class="error-message text-danger">${errors.month}</div>`);
        if (errors.gosp) $("#gospContainer").after(`<div class="error-message text-danger">${errors.gosp}</div>`);

        const isValid = Object.values(errors).every(e => !e);
        $("#btn-proceed").prop("disabled", !isValid);
        return isValid;
    }

    $("#btn-proceed-view1").click(function (e) {
        e.preventDefault();
        if (!validateForm()) return;

        const url = generateRedirectURL("gosp-simulator-detail-view-one.html");
        window.location.href = url;
    });

    $("#btn-proceed-view2").click(function (e) {
        e.preventDefault();
        if (!validateForm()) return;

        const url = generateRedirectURL("gosp-simulator-detail-view-two.html");
        window.location.href = url;
    });

    function generateRedirectURL(basePage) {
        const selectedGroupCode = $("#productGroup").val();
        const selectedProductCode = $("#product").val();
        const selectedProductName = $("#product option:selected").text().trim();

        const selectedAreas = $(".area-checkbox:checked")
            .map((_, el) => el.value)
            .get()
            .join(",");

        const selectedGOSPNames = $("#gospContainer input:checked")
            .map((_, el) => el.value)
            .get();

        const gospCodeMap = window.gospNameToCode || {};
        const selectedGOSPCodes = selectedGOSPNames
            .map(name => gospCodeMap[name.trim().toLowerCase()])
            .filter(Boolean)
            .join(",");

        const version = encodeURIComponent(selectedVersionNo ?? -1);
        const month = encodeURIComponent($("#monthPicker").val());

        return `${basePage}?` +
            `productGroup=${encodeURIComponent(selectedGroupCode)}` +
            `&product=${encodeURIComponent(selectedProductCode)}` +
            `&productName=${encodeURIComponent(selectedProductName)}` +
            `&area=${encodeURIComponent(selectedAreas)}` +
            `&month=${month}` +
            `&gosp=${encodeURIComponent(selectedGOSPCodes)}` +
            `&versionNo=${version}`;
    }
});
