$(document).ready(function () {
    $.ajaxSetup({ cache: false }); // Disable caching globally

    $(".overlay").show();

    const CACHE_BUSTER = "?v=" + new Date().getTime(); // Cache busting string

    let dropdownData = [];
    let tableData = [];
    let editedRows = [];

    // First, check user access
    getUserId();

    // function getUserId() {
    //     $.ajax({
    // url: "http://sasserver.demo.sas.com/SASJobExecution/?_program=%2FPublic%2FMEE_getuser_API" +  CACHE_BUSTER,
    //         dataType: "json",
    //         success: function (response) {
    //             if (Array.isArray(response) && response.length > 0) {
    //                 let currentUser = response[0];
    //                 console.log("User ID:", currentUser);
    //                 getUserDetails(currentUser);
    //             } else {
    //                 $(".overlay").hide();
    //                 alert("Error: Unable to retrieve user ID.");
    //             }
    //         },
    //         error: function () {
    //             $(".overlay").hide();
    //             alert("Error fetching user ID.");
    //         }
    //     });
    // }


    function getUserId() {
        // Hardcode the user ID for testing
        let currentUser = "viadmin";
        console.log("User ID:", currentUser);
        getUserDetails(currentUser);
    }

    function getUserDetails(user) {
        var url = "../response/month-end-estimation.json" + CACHE_BUSTER;
        $.ajax({
            url: url,
            dataType: "json",
            beforeSend: function (xhr) {
                xhr.setRequestHeader('X-CSRF-TOKEN', 'Bearer sas_services');
                $('.overlay').show();
            },
            success: function (data) {
                var dsmdGroup = "dsmdforecaster";
                let dsmdGroupAccess = JSON.stringify(data).indexOf(dsmdGroup) == -1;

                if (dsmdGroupAccess) {
                    loadDropdownData();
                }

                loadDropdownData();
            },
            error: function () {
                $(".overlay").hide();
                alert("Error fetching user access details.");
            }
        });
    }

    // function loadDropdownData() {
    //     $.getJSON("http://sasserver.demo.sas.com/SASJobExecution/?_program=%2FPublic%2FMEE_Read_API", function (data) {
    //         $(".overlay").hide();
    //         dropdownData = data.MAPPING;
    //         tableData = data.DATA;

    //         // Initialize dropdowns with data
    //         initializeDropdowns();
    //     }).fail(function () {
    //         $(".overlay").hide();
    //         alert("Error fetching dropdown data.");
    //     });
    // }

    function loadDropdownData() {
        $.getJSON("../response/month-end-estimation.json" + CACHE_BUSTER, function (data) {
            $(".overlay").hide();
            dropdownData = data.MAPPING;
            tableData = data.DATA;

            // Initialize dropdowns with data
            initializeDropdowns();
        }).fail(function () {
            $(".overlay").hide();
            alert("Error fetching dropdown data.");
        });
    }

    function initializeDropdowns() {
        let productGroups = Array.from(new Set(dropdownData.map(item => item.ProductGroup)));

        $("#productGroup").dxSelectBox({
            dataSource: productGroups,
            placeholder: "Select Product Group",
            onValueChanged: function (e) {
                let selectedGroup = e.value;
                let filteredProducts = dropdownData
                    .filter(item => item.ProductGroup === selectedGroup)
                    .map(item => item.Product);
                let uniqueProducts = [...new Set(filteredProducts)];

                // Auto-select if there's only one product
                $("#product").dxSelectBox("instance").option("dataSource", uniqueProducts);
                if (uniqueProducts.length === 1) {
                    $("#product").dxSelectBox("instance").option("value", uniqueProducts[0]);
                    autoSelectCustomer(uniqueProducts[0]);
                }
            }
        });

        $("#product").dxSelectBox({
            dataSource: [],
            placeholder: "Select Product",
            onValueChanged: function (e) {
                let selectedProduct = e.value;
                autoSelectCustomer(selectedProduct);
            }
        });

        $("#customer").dxSelectBox({
            dataSource: [],
            placeholder: "Select Customer",
            onValueChanged: function () {
                checkSelections();
            }
        });
    }

    // Function to auto-select customer if only one option is available
    function autoSelectCustomer(selectedProduct) {
        let selectedProductGroup = $("#productGroup").dxSelectBox("instance").option("value");

        let filteredCustomers = dropdownData
            .filter(item => item.ProductGroup === selectedProductGroup && item.Product === selectedProduct)
            .map(item => item.Customer);

        // If no specific customer is found, fallback to "ALL"
        if (filteredCustomers.length === 0) {
            filteredCustomers = dropdownData
                .filter(item => item.ProductGroup === selectedProductGroup && item.Product === "ALL")
                .map(item => item.Customer);
        }

        let uniqueCustomers = [...new Set(filteredCustomers)];

        $("#customer").dxSelectBox("instance").option("dataSource", uniqueCustomers);
        if (uniqueCustomers.length === 1) {
            $("#customer").dxSelectBox("instance").option("value", uniqueCustomers[0]);
        }

        checkSelections();
    }

    function checkSelections() {
        let productGroup = $("#productGroup").dxSelectBox("instance").option("value");
        let product = $("#product").dxSelectBox("instance").option("value");
        let customer = $("#customer").dxSelectBox("instance").option("value");

        if (productGroup && product && customer) {
            loadTable(productGroup, product, customer);
        } else {
            $("#dataGridContainer").hide();
        }
    }

    function loadTable(productGroup, product, customer) {
        let filteredData = tableData.filter(item =>
            item.ProductGroup === productGroup &&
            item.Product === product &&
            item.Customer === customer
        );

        $("#dataGridContainer").show().dxDataGrid({
            columnAutoWidth: true,
            allowColumnResizing: true,
            columnResizingMode: "widget",
            paging: { enabled: false },
            height: "auto",
            scrolling: { scrollByContent: true, scrollByThumb: true, showScrollbar: "onHover" },
            dataSource: filteredData,
            showBorders: true,
            columns: [
                { dataField: "Date", caption: "Date", alignment: "center", allowSorting: false },
                {
                    dataField: "Actual",
                    caption: "Actual",
                    alignment: "center",
                    allowSorting: false,
                    format: { type: "fixedPoint", precision: 2 }
                },
                {
                    dataField: "Final_Operating_FCST",
                    caption: "Final Operating Forecast",
                    alignment: "center",
                    allowSorting: false,
                    format: { type: "fixedPoint", precision: 2 }
                },
                {
                    dataField: "Final_Planning_FCST",
                    caption: "Final Planning Forecast",
                    alignment: "center",
                    allowSorting: false,
                    format: { type: "fixedPoint", precision: 2 }
                },
                {
                    dataField: "Month_End_Estimate",
                    caption: "Month End Estimate",
                    alignment: "center",
                    allowSorting: false,
                    format: "#,##0",
                    calculateCellValue: function (rowData) {
                        return Number(rowData.Month_End_Estimate).toLocaleString();
                    },
                    cellTemplate: editableCellTemplate("Month_End_Estimate")
                },
                {
                    dataField: "Variance",
                    caption: "Variance",
                    alignment: "center",
                    allowSorting: false,
                    calculateCellValue: function (rowData) {
                        return Number(rowData.Month_End_Estimate - rowData.Final_Planning_FCST).toLocaleString();
                    },
                    cellTemplate: function (container, options) {
                        let value = options.value;
                        $("<span>").text(value).css("color", "red").appendTo(container);
                    }
                },
                {
                    dataField: "Quota_Impact",
                    caption: "Quota Impact",
                    alignment: "center",
                    allowSorting: false,
                    format: "#,##0",
                    calculateCellValue: function (rowData) {
                        return Number(rowData.Quota_Impact).toLocaleString();
                    },
                    cellTemplate: editableCellTemplate("Quota_Impact")
                },
                {
                    dataField: "Remark",
                    caption: "Remark",
                    alignment: "center",
                    allowSorting: false,
                    cellTemplate: editableCellTemplate("Remark")
                }
            ]
        });
    }

    function editableCellTemplate(field) {
        return function (container, options) {
            let value = options.value || "";
            let input = $("<input>")
                .val(value)
                .css({
                    "border": "none",
                    "background-color": "#f6edc8",
                    "width": "100%",
                    "text-align": "center"
                });

            // Apply numeric restriction, allowing negatives only for Quota_Impact
            if (field === "Quota_Impact") {
                input.on("input", function () {
                    let numericValue = $(this).val().replace(/[^0-9.-]/g, ""); // Allow numbers, negative sign, and one decimal point

                    // Ensure only one minus (-) sign at the start
                    if (numericValue.includes("-") && numericValue.indexOf("-") > 0) {
                        numericValue = numericValue.replace("-", ""); // Remove invalid minus signs
                    }

                    // Limit decimal points to one
                    let decimalCount = (numericValue.match(/\./g) || []).length;
                    if (decimalCount > 1) {
                        numericValue = numericValue.substring(0, numericValue.length - 1);
                    }

                    $(this).val(numericValue);
                });
            }

            // Apply numeric restriction, only positive values for Month_End_Estimate
            if (field === "Month_End_Estimate") {
                input.on("input", function () {
                    let numericValue = $(this).val().replace(/[^0-9.]/g, ""); // Allow only numbers and one decimal point

                    // Limit decimal points to one
                    let decimalCount = (numericValue.match(/\./g) || []).length;
                    if (decimalCount > 1) {
                        numericValue = numericValue.substring(0, numericValue.length - 1);
                    }

                    $(this).val(numericValue);
                });
            }

            // Save value when losing focus
            input.blur(function () {
                updateCellValue(options, field, $(this).val());
            });

            // Save value when pressing Enter key
            input.keypress(function (event) {
                if (event.which === 13) { // Enter key
                    $(this).blur();
                }
            });

            $(container).append(input);
        };
    }

    function updateCellValue(options, field, newValue) {
        let dataGrid = $("#dataGridContainer").dxDataGrid("instance");
        let rowData = options.data;

        // Convert numeric fields to float with two decimal places
        if (["Month_End_Estimate", "Quota_Impact"].includes(field)) {
            newValue = parseFloat(newValue).toFixed(2) || "0.00";
        }

        // Allow anything for Remarks
        if (field === "Remark") {
            newValue = String(newValue);
        }

        // Update the row data
        rowData[field] = newValue;

        // Update Variance when Month_End_Estimate changes
        if (field === "Month_End_Estimate") {
            rowData.Variance = (parseFloat(rowData.Month_End_Estimate) - parseFloat(rowData.Final_Planning_FCST)).toFixed(2);
        }

        dataGrid.cellValue(options.rowIndex, field, rowData[field]);
        dataGrid.cellValue(options.rowIndex, "Variance", rowData.Variance);
        dataGrid.refresh();

        // Store all edits for this row in editedRows
        let existingIndex = editedRows.findIndex(r => r.key === rowData.Key);
        if (existingIndex !== -1) {
            editedRows[existingIndex] = {
                ...editedRows[existingIndex],
                Month_End_Estimate: parseFloat(rowData.Month_End_Estimate) || 0.00,
                Variance: parseFloat(rowData.Variance) || 0.00,
                Quota_Impact: parseFloat(rowData.Quota_Impact) || 0.00,
                Remark: rowData.Remark ? String(rowData.Remark) : ""
            };
        } else {
            editedRows.push({
                key: rowData.Key,
                Month_End_Estimate: parseFloat(rowData.Month_End_Estimate) || 0.00,
                Variance: parseFloat(rowData.Variance) || 0.00,
                Quota_Impact: parseFloat(rowData.Quota_Impact) || 0.00,
                Remark: rowData.Remark ? String(rowData.Remark) : ""
            });
        }

        console.log("Edited Rows:", editedRows);
    }

    async function sasgetCSRFToken() {
        const csrfURL = `https://cs-action.aramco.com/SASJobExecution/csrf`;
        const csrfParameters = { method: "GET", credentials: "include" };
        const csrfRequest = await fetch(csrfURL, csrfParameters);
        const csrfToken = await csrfRequest.headers.get("X-CSRF-TOKEN");
        return csrfToken;
    }

    $("#saveButton").click(async function () {
        if (editedRows.length === 0) {
            alert("No changes to save.");
            return;
        }

        const csrfToken = await sasgetCSRFToken();

        $.ajax({
            url: "http://sasserver.demo.sas.com/SASJobExecution/?_program=%2FPublic%2FMEE_Save_API",
            method: "POST",
            contentType: "application/json",
            data: JSON.stringify(editedRows),
            beforeSend: function (xhr) {
                xhr.setRequestHeader('X-CSRF-Token', csrfToken);
                $('.overlay').show();
            },
            success: function () {
                alert("Data saved successfully!");
                editedRows = [];
                $(".overlay").hide();
            },
            error: function (xhr) {
                alert("Error saving data.");
                console.error("Save Error:", xhr.status, xhr.responseText);
                $(".overlay").hide();
            }
        });
    });
});