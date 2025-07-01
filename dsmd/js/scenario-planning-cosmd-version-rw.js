var monthyear = $("#datepicker1").html();
var widths = { propane: 60, butane: 55, propaneChart: 640, butaneChart: 640 };
var COLORS = {
    yellow: "#fff2cc", g_yellow: "#ffc000", g_red: "red", g_blue: "#0673c2", g_green: "#7ab354",
    error: "#d9534f", warn: "#fbe5d6", lightBlue: "#c6f0ff", grey: "rgb(236 236 236)",
};
// to get values for scenario data
// this return value json object will be stored in scenario data
var scenarioData = function () {
    var tmp = null;
    $.ajax({
        url: '../response/COSMD-read-write.json',
        dataType: "json",
        async: false,
        beforeSend: function (xhr) {
            xhr.setRequestHeader('X-CSRF-TOKEN', 'Bearer sas_services');
            $('.overlay').show();
        },
        success: function (data) {
            $('.overlay').hide();
            tmp = data;
        }
    });
    return tmp;
}();
// variable for unit of measurement
var PROPANE_KMT_UOM = 12.446;
var BUTANE_KMT_UOM = 10.896;
// On page load run the statistics for export nominations
recalculateStats(scenarioData.DATA);

// function for chart preparation
function preProcessData(data, returnData) {
    // refreshBothGridData();
    var tData = {};
    $.each(data, function (i, v) {
        var date = v.SCENARIO_DATE;
        if (!tData[date]) {
            tData[date] = {
                "CUSTOMER_LIFTINGS_PROPANE_MB": 0,
                "CUSTOMER_LIFTINGS_BUTANE_MB": 0,
                "MIN_SAFE_INVENTORY_PROPANE": 0,
                "MIN_SAFE_INVENTORY_BUTANE": 0,
                "MAX_SAFE_INVENTORY_BUTANE": 0,
                "MAX_SAFE_INVENTORY_PROPANE": 0,
                "CLOSING_INVENTORY_BUTANE": 0,
                "CLOSING_INVENTORY_PROPANE": 0
            };
        }
        tData[date].CUSTOMER_LIFTINGS_PROPANE_MB += parseInt(v.CUSTOMER_LIFTINGS_PROPANE_MB) || 0;
        tData[date].CUSTOMER_LIFTINGS_BUTANE_MB += parseInt(v.CUSTOMER_LIFTINGS_BUTANE_MB) || 0;
        tData[date].MIN_SAFE_INVENTORY_PROPANE += parseInt(v.MIN_SAFE_INVENTORY_PROPANE) || 0;
        tData[date].MIN_SAFE_INVENTORY_BUTANE += parseInt(v.MIN_SAFE_INVENTORY_BUTANE) || 0;
        tData[date].MAX_SAFE_INVENTORY_BUTANE += parseInt(v.MAX_SAFE_INVENTORY_BUTANE) || 0;
        tData[date].MAX_SAFE_INVENTORY_PROPANE += parseInt(v.MAX_SAFE_INVENTORY_PROPANE) || 0;
        tData[date].CLOSING_INVENTORY_BUTANE += parseInt(v.CLOSING_INVENTORY_BUTANE) || 0;
        tData[date].CLOSING_INVENTORY_PROPANE += parseInt(v.CLOSING_INVENTORY_PROPANE) || 0;
    });
    $.each(tData, function (date, sums) {
        var newRow = {
            "index": tData.length,
            "SCENARIO_DATE": date,
            "CUSTOMER_LIFTINGS_PROPANE_MB": sums.CUSTOMER_LIFTINGS_PROPANE_MB,
            "CUSTOMER_LIFTINGS_BUTANE_MB": sums.CUSTOMER_LIFTINGS_BUTANE_MB,
            "MIN_SAFE_INVENTORY_PROPANE": sums.MIN_SAFE_INVENTORY_PROPANE,
            "MIN_SAFE_INVENTORY_BUTANE": sums.MIN_SAFE_INVENTORY_BUTANE,
            "MAX_SAFE_INVENTORY_BUTANE": sums.MAX_SAFE_INVENTORY_BUTANE,
            "MAX_SAFE_INVENTORY_PROPANE": sums.MAX_SAFE_INVENTORY_PROPANE,
            "CLOSING_INVENTORY_BUTANE": sums.CLOSING_INVENTORY_BUTANE,
            "CLOSING_INVENTORY_PROPANE": sums.CLOSING_INVENTORY_PROPANE
        };
        returnData.push(newRow);
    });
    return returnData;
};

var eastChartData = [];
var westChartData = [];

function prepareChartData(eData, wData) {
    eastChartData = [];
    westChartData = [];
    preProcessData(eastData, eastChartData);
    preProcessData(westData, westChartData);
    // Create the four chart options
    var eastPropaneChartOptions = createChartOptions(eastChartData, "propane");
    var eastButaneChartOptions = createChartOptions(eastChartData, "butane");
    var westPropaneChartOptions = createChartOptions(westChartData, "propane");
    var westButaneChartOptions = createChartOptions(westChartData, "butane");

    // Create the TabPanel and add the charts to the appropriate tabs
    var tabPanelOptions = {
        dataSource: [
            {
                title: "East",
                charts: [eastPropaneChartOptions, eastButaneChartOptions],
            },
            {
                title: "West",
                charts: [westPropaneChartOptions, westButaneChartOptions],
            },
        ],
        itemTitleTemplate: function (data) {
            return $("<div>")
                .append($("<i>").addClass("dx-icon dx-icon-rowfield"))
                .append($("<span>").text(data.title))
        },
        itemTemplate: function (data) {
            var $tabContent = $("<div class='row'>");

            for (var i = 0; i < data.charts.length; i++) {
                var $chartContainer = $("<div class='col'>");
                $tabContent.append($chartContainer);
                $chartContainer.css("height", "400px")
                    .css("width", "600px");
                $chartContainer.dxChart(data.charts[i]);
            }

            return $tabContent;
        },
        animationEnabled: true,
        swipeEnabled: true,
        paddingTop: 30,
    };

    $("#tabChartContainer").dxTabPanel(tabPanelOptions);
};

function createChartOptions(data, calledFrom) {
    var valueAxisSettings = {
        grid: {
            visible: true,
        },
        size: {
            height: 400,
            width: 600,
        },
        label: {
            format: {
                type: "fixedPoints",
                precision: 2,

            },
            overlappingBehaviour: 'stagger',

        },
        axisDivisionFactor: 0,
    };
    if (calledFrom === "propane") {
        valueAxisSettings.title = "Propane";
    }
    else {
        valueAxisSettings.title = "Butane";
    }
    console.log(calledFrom);
    return {
        dataSource: data,
        title: {
            text: calledFrom.toUpperCase(),
            font: {
                size: 18
            }
        },
        export: {
            enabled: true,
        },
        valueAxis: {
            visualRange: {
                startValue: 0,
            },
            maxValueMargin: 10,
        },
        series: [
            {
                valueField:
                    calledFrom === "propane"
                        ? "CUSTOMER_LIFTINGS_PROPANE_MB"
                        : "CUSTOMER_LIFTINGS_BUTANE_MB",
                name:
                    calledFrom === "propane"
                        ? "Customer Lifting Propane"
                        : "Customer Lifting Butane",
                type: "bar",
                axis: "valueAxis",
                color: "#ffc107",
            },
            {
                valueField:
                    calledFrom === "propane"
                        ? "CLOSING_INVENTORY_PROPANE"
                        : "CLOSING_INVENTORY_BUTANE",
                name:
                    calledFrom === "propane"
                        ? "Closing Inventory Propane"
                        : "Closing Inventory Butane",
                type: "line",
                axis: "valueAxis",
                color: "#0dcaf0",
                point: {visible: false}
            },
            {
                valueField:
                    calledFrom === "propane"
                        ? "MIN_SAFE_INVENTORY_PROPANE"
                        : "MIN_SAFE_INVENTORY_BUTANE",
                name: "Min Safe Inventory",
                dashStyle: 'dash',
                axis: "valueAxis",
                color: "red",
                point: {visible: false}
            },
            {
                valueField:
                    calledFrom === "butane"
                        ? "MAX_SAFE_INVENTORY_BUTANE"
                        : "MAX_SAFE_INVENTORY_PROPANE",
                name: "Max Safe Inventory",
                dashStyle: 'dash',
                axis: "valueAxis",
                color: "green",
                point: {visible: false}
            }
        ],
        commonSeriesSettings: {
            argumentField: "SCENARIO_DATE",
            aggregatedPointsPosition: 'crossTicks'
        },
        zoomAndPan: {
            argumentAxis: "both",
            valueAxis: "both"
        },
        argumentAxis: {
            label: {
                rotationAngle: 60,
                customizeText: function () {
                    var dateParts = this.value.split(/\d{4}/).filter(Boolean);
                    return dateParts[0];
                },
            },
        },
        tooltip: {
            enabled: true,
            customizeTooltip: function (arg) {
                return {
                    text: arg.seriesName + ": " + arg.valueText,
                };
            },
        },
        legend: {
            visible: true,
            verticalAlignment: "bottom",
            horizontalAlignment: "center",
        }
    };

}

// Function to calculation total nominations for export planning
var eastTotNoms = 0;
var westTotNoms = 0;
var totNoms = 0;
function getTotalNominations(data) {
    eastTotNoms = 0;
    westTotNoms = 0;
    totNoms = 0;
    if (data != "") {
        $.each(data, function (index, value) {
            if (value.REGION === "EAST") {
                if (value.NOMINATION_TEMP_KEY !== null && value.NOMINATION_TEMP_KEY !== "") {
                    eastTotNoms++;
                }

            } else if (value.REGION === "WEST") {
                if (value.NOMINATION_TEMP_KEY !== null && value.NOMINATION_TEMP_KEY !== "") {
                    westTotNoms++;
                }
            }
        })
    }
    totNoms = westTotNoms + eastTotNoms;
    $("#totalNominations").html(totNoms);
};

//// Function to calculation average delays and advances for export nominations

var num_delays = 0;
var sum_delays = 0;
var avg_delays = 0;
var num_advances = 0;
var sum_advances = 0;
var avg_advances = 0;

function getDefaultAverages(data) {
    var delays = [];
    var advances = [];
    num_delays = 0;
    sum_delays = 0;
    avg_delays = 0;
    num_advances = 0;
    sum_advances = 0;
    avg_advances = 0;
    $.each(data, function (index, value) {
        var newdt = new Date(value.SCENARIO_DATE);
        var olddt = new Date(value.NOMINATION_DATE);
        var nomTempKey = value.NOMINATION_TEMP_KEY;
        if ((nomTempKey !== null) && ((value.CUSTOMER_NAME).slice(6) != "PROPANE")) {
            var daydif = newdt.getDate() - olddt.getDate();
            if (daydif > 0) {
                delays.push(daydif);
            }
            if (daydif < 0) {
                advances.push(daydif);
            }
        }
    });
    if (delays !== "") {
        num_delays = delays.length;
        sum_delays = delays.reduce((acc, curr) => acc + curr, 0);
        avg_delays = Math.round(num_delays === 0 ? 0 : sum_delays / num_delays);
        $("#avgDelay").html(avg_delays);
    } else {
        avg_delays = 0;
        $("#avgDelay").html(avg_delays);
    }
    if (advances !== "") {
        num_advances = advances.length;
        sum_advances = advances.reduce((acc, curr) => acc + curr, 0);
        avg_advances = Math.round(num_advances === 0 ? 0 : sum_advances / num_advances);
        $("#avgAdvance").html(avg_advances);
    } else {
        avg_advances = 0;
        $("#avgAdvance").html(avg_advances);
    }

};

//Function to calculate the number of diversions for export nominations
var eastToWestDiv = 0;
var westToWestDiv = 0;
var totDiv = 0;
function getDiversionCounts(data) {
    eastToWestDiv = 0;
    westToWestDiv = 0;
    totDiv = 0;
    $.each(data, function (index, value) {
        var srcRegion = value.NOMINATION_REGION;
        var destRegion = value.REGION;
        var nomTempKey = value.NOMINATION_TEMP_KEY;
        if ((srcRegion === "EAST" && destRegion === "WEST") && (nomTempKey != null)) {
            eastToWestDiv++;
        }
        if ((srcRegion === "WEST" && destRegion === "EAST") && (nomTempKey != null)) {
            westToWestDiv++;
        }
        totDiv = eastToWestDiv + westToWestDiv;
        $("#totalDiversion").html(totDiv);
    })
};

//Function to calculate the number of nominations that are cancelled or deferred
var eastCanDef = 0;
var westCanDef = 0;
var totCanDef = 0;
function getCanDefCounts() {
    eastCanDef = 0;
    westCanDef = 0;
    totCanDef = 0;
    $.each(scenarioData.MONTHLY_NOMINATIONS, function (index, value) {
        var srcRegion = value.REGION;
        var deleteFlg = value.DELETE_FLAG;
        if (srcRegion === "EAST" && deleteFlg == "Y") {
            eastCanDef++;
        }
        if (srcRegion === "WEST" && deleteFlg == "Y") {
            westCanDef++;
        }
        totCanDef = eastCanDef + westCanDef;
        $("#totalCancel").html(totCanDef);
    })
};

function getVersionStatus(data) {
    //     console.log(data);
    var status = data.TOLERANCE[0].SCENARIO_PLANNING_STATUS_DESC;
    var version = data.DATA[0].SCENARIO_PLANNING_VERSION;
    var lastSaved = data.DATA[0].UPDATED_DTTM;

    $("#ospasSubmitStatus").html(status);
    $("#version").html(version);
    $("#lastSaved").html(lastSaved);
}

//Function to call above calculations
function recalculateStats(data) {
    getTotalNominations(data);
    getDefaultAverages(data);
    getDiversionCounts(data);
    getCanDefCounts();
    getVersionStatus(scenarioData);
};


// Function to extract the unavailable dates for moving any nomination

function findAvailableSlot(staticData, data) {
    var westSlotAvailDate = [];
    var eastSlotAvailDate = [];
    // Get slot unavailability from west
    for (let i = 0; i < staticData.SLOT_AVAILABILITY.length; i++) {
        if (staticData.SLOT_AVAILABILITY[i].AVAILABLE_FLG === "N") {
            const currentObject = staticData.SLOT_AVAILABILITY[i].DAY;
            westSlotAvailDate.push(currentObject);
        }

    }
    // Get slot which are already blocked by the nominations in west
    $.each(data, function (index, value) {
        if (value.REGION === "WEST" && value.NOMINATION_TEMP_KEY !== null) {
            if ($.inArray(value.SCENARIO_DATE, westSlotAvailDate) === -1) {
                westSlotAvailDate.push(value.SCENARIO_DATE);
            }
        }
    });


    // Get Slots unavailable for east
    // Object to store counts by date
    var countsByDate = {};

    // Iterate over the data array
    $.each(data, function (index, item) {
        if (item.REGION === "EAST") {
            var date = item.SCENARIO_DATE;
            var character = item.NOMINATION_TEMP_KEY;
            if (character != null) {
                // Check if the date already exists in the counts object
                if (countsByDate[date]) {
                    // Increment the count for the character if it exists
                    countsByDate[date] += 1;
                }
                else {
                    countsByDate[date] = 1;
                }
            }
        }

    });
    $.each(countsByDate, function (index, item) {
        if (item == 2) {
            if ($.inArray(index, eastSlotAvailDate) === -1) {
                eastSlotAvailDate.push(index);
            }
        }
    });

    return { "westSlotAvailDate": westSlotAvailDate, "eastSlotAvailDate": eastSlotAvailDate };

};

// Function to move nominations from one region to other region

function moveNominationOnGrid(data, plDate) {
    if (data.LOCK_NOMINATION != "Y") {
        var tformatDates = DevExpress.localization.formatDate(plDate, "ddMMMyyyy").toUpperCase();
        // Moving from East to West
        if (data.REGION == 'EAST') {
            $.each(westData, function (i, v) {
                if (v.SCENARIO_DATE == tformatDates) {
                    v.REGION = "WEST";
                    v.CUSTOMER_ID = data.CUSTOMER_ID;
                    v.CUSTOMER_LIFTING_BUTANE = data.CUSTOMER_LIFTING_BUTANE;
                    v.CUSTOMER_LIFTING_PROPANE = data.CUSTOMER_LIFTING_PROPANE;
                    v.CUSTOMER_NAME = data.CUSTOMER_NAME;
                    v.LOCK_NOMINATION = 'N';
                    v.NOMINATION_CUSTOMER_LIFTING_BUTA = data.NOMINATION_CUSTOMER_LIFTING_BUTA;
                    v.NOMINATION_CUSTOMER_LIFTING_PROP = data.NOMINATION_CUSTOMER_LIFTING_PROP;
                    v.NOMINATION_DATE = data.NOMINATION_DATE;
                    v.NOMINATION_REGION = data.NOMINATION_REGION;
                    v.NOMINATION_TEMP_KEY = parseInt(data.NOMINATION_TEMP_KEY);
                    v.NOMINATION_TERMINAL_ID = data.NOMINATION_TERMINAL_ID;
                    v.SCENARIO_DATE = tformatDates.toUpperCase();
                    v.TERMINAL_ID = "T005";
                }

            });
            $.each(eastData, function (i, v) {
                if (v.ROW_ORDER == data.ROW_ORDER && v.ROW_COUNT == data.ROW_COUNT) {
                    v.CUSTOMER_ID = "";
                    v.CUSTOMER_LIFTING_BUTANE = null;
                    v.CUSTOMER_LIFTING_PROPANE = null;
                    v.CUSTOMER_NAME = "";
                    v.LOCK_NOMINATION = "N";
                    v.NOMINATION_CUSTOMER_LIFTING_BUTA = null;
                    v.NOMINATION_CUSTOMER_LIFTING_PROP = null;
                    v.NOMINATION_TEMP_KEY = null;
                    v.ONTIME_ACTION = "";
                }
            });
        }

        // Moving from West to East
        if (data.REGION == 'WEST') {
            var rowbreaker = 0;
            $.each(eastData, function (i, v) {
                if ((rowbreaker === 0) && (v.SCENARIO_DATE == tformatDates) && (v.NOMINATION_TEMP_KEY == null)) {
                    v.REGION = "EAST";
                    v.CUSTOMER_ID = data.CUSTOMER_ID;
                    v.CUSTOMER_LIFTING_BUTANE = data.CUSTOMER_LIFTING_BUTANE;
                    v.CUSTOMER_LIFTING_PROPANE = data.CUSTOMER_LIFTING_PROPANE;
                    v.CUSTOMER_NAME = data.CUSTOMER_NAME;
                    v.LOCK_NOMINATION = 'N';
                    v.NOMINATION_CUSTOMER_LIFTING_BUTA = data.NOMINATION_CUSTOMER_LIFTING_BUTA;
                    v.NOMINATION_CUSTOMER_LIFTING_PROP = data.NOMINATION_CUSTOMER_LIFTING_PROP;
                    v.NOMINATION_DATE = data.NOMINATION_DATE;
                    v.NOMINATION_REGION = data.NOMINATION_REGION;
                    v.NOMINATION_TEMP_KEY = parseInt(data.NOMINATION_TEMP_KEY);
                    v.NOMINATION_TERMINAL_ID = data.NOMINATION_TERMINAL_ID;
                    v.SCENARIO_DATE = tformatDates.toUpperCase();
                    v.TERMINAL_ID = "A004";
                    rowbreaker = 1;
                }


            });
            $.each(westData, function (i, v) {
                if (rowbreaker == 1 && v.ROW_ORDER == data.ROW_ORDER && v.ROW_COUNT == data.ROW_COUNT) {
                    v.CUSTOMER_ID = "";
                    v.CUSTOMER_LIFTING_BUTANE = null;
                    v.CUSTOMER_LIFTING_PROPANE = null;
                    v.CUSTOMER_NAME = "";
                    v.LOCK_NOMINATION = "N";
                    v.NOMINATION_CUSTOMER_LIFTING_BUTA = null;
                    v.NOMINATION_CUSTOMER_LIFTING_PROP = null;
                    v.NOMINATION_TEMP_KEY = null;
                    v.ONTIME_ACTION = "";
                }
            });
        };
    };
    refreshRecalculateGrid();
};

// Function to refresh calculation and grid data
function refreshRecalculateGrid() {
    initializeCancelledNominationList();
    recalculateStats(eastData.concat(westData));
    reCalculateTotals(westData);
    reCalculateTotals(eastData);
    $("#eastGrid").dxDataGrid("instance").refresh();
    $("#westGrid").dxDataGrid("instance").refresh();
};
// Function to append cancelled nomintaion to a temporary array
var t_cancelled_nominations_ar = [];
var t_cancelled_nominations_vr = [];
function initializeCancelledNominationList() {
    t_cancelled_nominations_ar = [];
    $.each(scenarioData.MONTHLY_NOMINATIONS, function (i, v) {
        if (v.DELETE_FLAG == "Y") {
            t_cancelled_nominations_ar.push(v);
        };
    });
    t_cancelled_nominations_vr.CUSTOMER_NM = $.map(t_cancelled_nominations_ar, function (v) {
        return v.CUSTOMER_NM;
    });
    t_cancelled_nominations_vr.NOMINATION_TEMP_KEY = $.map(t_cancelled_nominations_ar, function (v) {
        return v.NOMINATION_TEMP_KEY;
    });
    t_cancelled_nominations_vr.APPND_NAME_KEY = $.map(t_cancelled_nominations_ar, function (v) {
        return v.CUSTOMER_NM + " ( " + v.NOMINATION_TEMP_KEY + " )";
    });
    t_cancelled_nominations_vr.CUSTOMER_NM = [... new Set(t_cancelled_nominations_vr.CUSTOMER_NM)];
    t_cancelled_nominations_vr.NOMINATION_TEMP_KEY = [... new Set(t_cancelled_nominations_vr.NOMINATION_TEMP_KEY)];
    t_cancelled_nominations_vr.APPND_NAME_KEY = [... new Set(t_cancelled_nominations_vr.APPND_NAME_KEY)];
};
// On page refresh load the cancelled Nomination List
initializeCancelledNominationList();

// function to Cancel nominations
function cancelNomination(data) {
    // Don't change anything to nomination if it is locked
    if (data.LOCK_NOMINATION != "Y") {
        // Update flag in monthly nomination grid
        $.each(scenarioData.MONTHLY_NOMINATIONS, function (i, v) {
            if ((data.NOMINATION_TEMP_KEY == v.NOMINATION_TEMP_KEY) && (data.CUSTOMER_ID == v.CUSTOMER_ID)) {
                v.DELETE_FLAG = "Y";
            };
        });
        initializeCancelledNominationList();
        // update datagrid
        if (data.REGION == "EAST") {
            $.each(eastData, function (i, v) {
                if ((v.ROW_COUNT == data.ROW_COUNT) && (data.ROW_ORDER == v.ROW_ORDER)) {
                    v.CUSTOMER_ID = "";
                    v.CUSTOMER_LIFTING_BUTANE = null;
                    v.CUSTOMER_LIFTING_PROPANE = null;
                    v.CUSTOMER_NAME = "";
                    v.LOCK_NOMINATION = "N";
                    v.NOMINATION_CUSTOMER_LIFTING_BUTA = null;
                    v.NOMINATION_CUSTOMER_LIFTING_PROP = null;
                    v.NOMINATION_TEMP_KEY = null;
                    v.ONTIME_ACTION = "";
                };
            });
        };
        if (data.REGION == "WEST") {
            $.each(westData, function (i, v) {
                if ((v.ROW_COUNT == data.ROW_COUNT) && (data.ROW_ORDER == v.ROW_ORDER)) {
                    v.CUSTOMER_ID = "";
                    v.CUSTOMER_LIFTING_BUTANE = null;
                    v.CUSTOMER_LIFTING_PROPANE = null;
                    v.CUSTOMER_NAME = "";
                    v.LOCK_NOMINATION = "N";
                    v.NOMINATION_CUSTOMER_LIFTING_BUTA = null;
                    v.NOMINATION_CUSTOMER_LIFTING_PROP = null;
                    v.NOMINATION_TEMP_KEY = null;
                    v.ONTIME_ACTION = "";
                }
            });
        };
    };
    refreshRecalculateGrid();
};


// Function to bring back cancelled Nomination
function bringBackNomination(selectedrow, selectedcust) {
    var selectedTab = scenarioGrid.option("selectedIndex");
    var t_CUSTOMER_ID = "";
    var t_CUSTOMER_NM = "";
    var t_CUSTOMER_LIFTING_BUTANE = "";
    var t_CUSTOMER_LIFTING_PROPANE = "";
    var t_NOMINATION_TEMP_KEY = "";
    var t_NOM_DT = "";
    var t_TERMINAL_NM = "";
    var t_TERMINAL_ID = "";
    var t_REGION = "";
    $.each(scenarioData.MONTHLY_NOMINATIONS, function (i, v) {
        t_c = v.CUSTOMER_NM + " ( " + v.NOMINATION_TEMP_KEY + " )";
        if (t_c == selectedcust) {
            t_CUSTOMER_ID = v.CUSTOMER_ID;
            t_CUSTOMER_NM = v.CUSTOMER_NM;
            t_CUSTOMER_LIFTING_BUTANE = v.BUTANE_KMT;
            t_CUSTOMER_LIFTING_PROPANE = v.PROPANE_KMT;
            t_NOMINATION_TEMP_KEY = v.NOMINATION_TEMP_KEY;
            t_NOM_DT = v.NOMINATION_DAY;
            t_TERMINAL_NM = v.TERMINAL_NM;
            t_TERMINAL_ID = v.TERMINAL_ID;
            t_REGION = v.REGION;
            v.DELETE_FLAG = "N";
        };
    });
    if (selectedTab == 0) {
        $.each(eastData, function (i, v) {
            if (v.ROW_ORDER == selectedrow.ROW_ORDER) {
                console.log("v.ROW_ORDER", v.ROW_ORDER);
                v.REGION = "EAST";
                v.CUSTOMER_ID = t_CUSTOMER_ID;
                v.CUSTOMER_LIFTING_BUTANE = t_CUSTOMER_LIFTING_BUTANE;
                v.CUSTOMER_LIFTING_PROPANE = t_CUSTOMER_LIFTING_PROPANE;
                v.CUSTOMER_NAME = t_CUSTOMER_NM;
                v.LOCK_NOMINATION = 'N';
                v.NOMINATION_CUSTOMER_LIFTING_BUTA = t_CUSTOMER_LIFTING_BUTANE;
                v.NOMINATION_CUSTOMER_LIFTING_PROP = t_CUSTOMER_LIFTING_BUTANE;
                v.NOMINATION_DATE = t_NOM_DT;
                v.NOMINATION_REGION = t_REGION;
                v.NOMINATION_TEMP_KEY = t_NOMINATION_TEMP_KEY;
                v.NOMINATION_TERMINAL_ID = t_TERMINAL_ID;
                v.SCENARIO_DATE = selectedrow.SCENARIO_DATE;
                v.TERMINAL_ID = "A004";
            };
        });
    };
    if (selectedTab == 1) {
        $.each(westData, function (i, v) {
            if (v.ROW_ORDER == selectedrow.ROW_ORDER) {
                console.log("v.ROW_ORDER", v.ROW_ORDER);
                v.REGION = "WEST";
                v.CUSTOMER_ID = t_CUSTOMER_ID;
                v.CUSTOMER_LIFTING_BUTANE = t_CUSTOMER_LIFTING_BUTANE;
                v.CUSTOMER_LIFTING_PROPANE = t_CUSTOMER_LIFTING_PROPANE;
                v.CUSTOMER_NAME = t_CUSTOMER_NM;
                v.LOCK_NOMINATION = 'N';
                v.NOMINATION_CUSTOMER_LIFTING_BUTA = t_CUSTOMER_LIFTING_BUTANE;
                v.NOMINATION_CUSTOMER_LIFTING_PROP = t_CUSTOMER_LIFTING_BUTANE;
                v.NOMINATION_DATE = t_NOM_DT;
                v.NOMINATION_REGION = t_REGION;
                v.NOMINATION_TEMP_KEY = t_NOMINATION_TEMP_KEY;
                v.NOMINATION_TERMINAL_ID = t_TERMINAL_ID;
                v.SCENARIO_DATE = selectedrow.SCENARIO_DATE;
                v.TERMINAL_ID = "T005";
            };
        });
    };
    refreshRecalculateGrid();
};


function reCalculateDraggedTotals(data, toIndex, fromIndex) {
    var fromItem = data[fromIndex];
    var toItem = data[toIndex];
    var startDate = new Date(fromItem.SCENARIO_DATE);
    var endDate = new Date(toItem.NOMINATION_DATE);

    temp_nom_date = toItem.SCENARIO_DATE;
    toItem.SCENARIO_DATE = fromItem.SCENARIO_DATE;
    fromItem.SCENARIO_DATE = temp_nom_date;

    temp_oi_propane = toItem.OPENING_INVENTORY_PROPANE;
    toItem.OPENING_INVENTORY_PROPANE = fromItem.OPENING_INVENTORY_PROPANE;
    fromItem.OPENING_INVENTORY_PROPANE = temp_oi_propane;

    temp_oi_butane = toItem.OPENING_INVENTORY_BUTANE;
    toItem.OPENING_INVENTORY_BUTANE = fromItem.OPENING_INVENTORY_BUTANE;
    fromItem.OPENING_INVENTORY_BUTANE = temp_oi_butane;

    temp_ta_propane = toItem.TERMINAL_AVAILS_PROPANE;
    toItem.TERMINAL_AVAILS_PROPANE = fromItem.TERMINAL_AVAILS_PROPANE;
    fromItem.TERMINAL_AVAILS_PROPANE = temp_ta_propane;

    temp_ta_butane = toItem.TERMINAL_AVAILS_BUTANE;
    toItem.TERMINAL_AVAILS_BUTANE = fromItem.TERMINAL_AVAILS_BUTANE;
    fromItem.TERMINAL_AVAILS_BUTANE = temp_ta_butane;

    temp_maxsaf_butane = toItem.MAX_SAFE_INVENTORY_BUTANE;
    toItem.MAX_SAFE_INVENTORY_BUTANE = fromItem.MAX_SAFE_INVENTORY_BUTANE;
    fromItem.MAX_SAFE_INVENTORY_BUTANE = temp_maxsaf_butane;

    temp_maxsaf_propane = toItem.MAX_SAFE_INVENTORY_PROPANE;
    toItem.MAX_SAFE_INVENTORY_PROPANE = fromItem.MAX_SAFE_INVENTORY_PROPANE;
    fromItem.MAX_SAFE_INVENTORY_PROPANE = temp_maxsaf_propane;

    temp_minsaf_butane = toItem.MIN_SAFE_INVENTORY_BUTANE;
    toItem.MIN_SAFE_INVENTORY_BUTANE = fromItem.MIN_SAFE_INVENTORY_BUTANE;
    fromItem.MIN_SAFE_INVENTORY_BUTANE = temp_minsaf_butane;

    temp_row_order = toItem.ROW_ORDER;
    toItem.ROW_ORDER = fromItem.ROW_ORDER;
    fromItem.ROW_ORDER = temp_row_order;

    temp_row_count = toItem.ROW_COUNT;
    toItem.ROW_COUNT = fromItem.ROW_COUNT;
    fromItem.ROW_COUNT = temp_row_count;

    temp_minsaf_propane = toItem.MIN_SAFE_INVENTORY_PROPANE;
    toItem.MIN_SAFE_INVENTORY_PROPANE = fromItem.MIN_SAFE_INVENTORY_PROPANE;
    fromItem.MIN_SAFE_INVENTORY_PROPANE = temp_minsaf_propane;
    toItem.CLOSING_INVENTORY_BUTANE = null;
    toItem.CLOSING_INVENTORY_PROPANE = null;
    toItem.CLOSING_PERCENTAGE_PROPANE = null;
    toItem.CLOSING_PERCENTAGE_BUTANE = null;
    fromItem.CLOSING_INVENTORY_BUTANE = null;
    fromItem.CLOSING_INVENTORY_PROPANE = null;
    fromItem.CLOSING_PERCENTAGE_PROPANE = null;
    fromItem.CLOSING_PERCENTAGE_BUTANE = null;
    delete temp_nom_date;
    delete temp_oi_propane;
    delete temp_oi_butane;
    delete temp_ta_propane;
    delete temp_ta_butane;
    delete fromItem;
    delete toItem;

    for (var i = 1; i < data.length; i++) {
        data.ROW_ORDER = i;
    }
    reCalculateTotals(data);
}

function reCalculateTotals(data) {
    for (var i = 0; i < data.length - 1; i++) {

        if (data[i].REGION == "EAST") {
            data[i].CUSTOMER_LIFTINGS_PROPANE_MB = ((data[i].CUSTOMER_LIFTING_PROPANE * PROPANE_KMT_UOM) + ((data[i].CUSTOMER_LIFTING_PROPANE * PROPANE_KMT_UOM * (eastTolPropane / 100)))).toFixed(2);
            data[i].CUSTOMER_LIFTINGS_BUTANE_MB = ((data[i].CUSTOMER_LIFTING_BUTANE * BUTANE_KMT_UOM) + ((data[i].CUSTOMER_LIFTING_BUTANE * BUTANE_KMT_UOM * (eastTolButane / 100)))).toFixed(2);
            data[i + 1].CUSTOMER_LIFTINGS_PROPANE_MB = ((data[i + 1].CUSTOMER_LIFTING_PROPANE * PROPANE_KMT_UOM) + ((data[i + 1].CUSTOMER_LIFTING_PROPANE * PROPANE_KMT_UOM * (eastTolPropane / 100)))).toFixed(2);
            data[i + 1].CUSTOMER_LIFTINGS_BUTANE_MB = ((data[i + 1].CUSTOMER_LIFTING_BUTANE * BUTANE_KMT_UOM) + ((data[i + 1].CUSTOMER_LIFTING_BUTANE * BUTANE_KMT_UOM * (eastTolButane / 100)))).toFixed(2);

            if (i == 0) {
                data[i].OPENING_INVENTORY_PROPANE = parseFloat(data[i].OPENING_INVENTORY_PROPANE);
                data[i].CLOSING_INVENTORY_PROPANE = (data[i].OPENING_INVENTORY_PROPANE + data[i].TERMINAL_AVAILS_PROPANE - data[i].CUSTOMER_LIFTINGS_PROPANE_MB - data[i + 1].CUSTOMER_LIFTINGS_PROPANE_MB).toFixed(2);
                data[i].CLOSING_PERCENTAGE_PROPANE = ((data[i].CLOSING_INVENTORY_PROPANE / (data[0].MAX_SAFE_INVENTORY_PROPANE - data[0].MIN_SAFE_INVENTORY_PROPANE)) * 100).toFixed(2);

                data[i].OPENING_INVENTORY_BUTANE = parseFloat(data[i].OPENING_INVENTORY_BUTANE);
                data[i].CLOSING_INVENTORY_BUTANE = (data[i].OPENING_INVENTORY_BUTANE + data[i].TERMINAL_AVAILS_BUTANE - data[i].CUSTOMER_LIFTINGS_BUTANE_MB - data[i + 1].CUSTOMER_LIFTINGS_BUTANE_MB).toFixed(2);
                data[i].CLOSING_PERCENTAGE_BUTANE = ((data[i].CLOSING_INVENTORY_BUTANE / (data[0].MAX_SAFE_INVENTORY_BUTANE - data[0].MIN_SAFE_INVENTORY_BUTANE)) * 100).toFixed(2);
                data[i].ONTIME_ACTION = "";
            } else {
                if (i % 2 == 0) {
                    data[i].OPENING_INVENTORY_PROPANE = parseFloat(data[i - 2].CLOSING_INVENTORY_PROPANE);
                    data[i].CLOSING_INVENTORY_PROPANE = (data[i].OPENING_INVENTORY_PROPANE + data[i].TERMINAL_AVAILS_PROPANE - data[i].CUSTOMER_LIFTINGS_PROPANE_MB - data[i + 1].CUSTOMER_LIFTINGS_PROPANE_MB).toFixed(2);
                    data[i].CLOSING_PERCENTAGE_PROPANE = ((data[i].CLOSING_INVENTORY_PROPANE / (data[0].MAX_SAFE_INVENTORY_PROPANE - data[0].MIN_SAFE_INVENTORY_PROPANE)) * 100).toFixed(2);

                    data[i].OPENING_INVENTORY_BUTANE = parseFloat(data[i - 2].CLOSING_INVENTORY_BUTANE);
                    data[i].CLOSING_INVENTORY_BUTANE = (data[i].OPENING_INVENTORY_BUTANE + data[i].TERMINAL_AVAILS_BUTANE - data[i].CUSTOMER_LIFTINGS_BUTANE_MB - data[i + 1].CUSTOMER_LIFTINGS_BUTANE_MB).toFixed(2);
                    data[i].CLOSING_PERCENTAGE_BUTANE = ((data[i].CLOSING_INVENTORY_BUTANE / (data[0].MAX_SAFE_INVENTORY_BUTANE - data[0].MIN_SAFE_INVENTORY_BUTANE)) * 100).toFixed(2);
                    data[i].ONTIME_ACTION = "";
                }

            }
        }
    }
    var k = 0;
    for (var i = 0; i < data.length; i++) {
        if (data.REGION == "WEST") {
            if (data[i - 1].REGION == "EAST") {
                k = i;
            }
        }
    }

    for (var i = k; i < data.length; i++) {

        if (data[i].REGION == "WEST") {
            data[i].CUSTOMER_LIFTINGS_PROPANE_MB = ((data[i].CUSTOMER_LIFTING_PROPANE * PROPANE_KMT_UOM) + ((data[i].CUSTOMER_LIFTING_PROPANE * PROPANE_KMT_UOM * (westTolPropane / 100)))).toFixed(2);
            data[i].CUSTOMER_LIFTINGS_BUTANE_MB = ((data[i].CUSTOMER_LIFTING_BUTANE * BUTANE_KMT_UOM) + ((data[i].CUSTOMER_LIFTING_BUTANE * BUTANE_KMT_UOM * (westTolButane / 100)))).toFixed(2);

            if (i == k) {
                data[i].OPENING_INVENTORY_PROPANE = parseFloat(data[i].OPENING_INVENTORY_PROPANE);
                data[i].CLOSING_INVENTORY_PROPANE = (data[i].OPENING_INVENTORY_PROPANE + data[i].TERMINAL_AVAILS_PROPANE - data[i].CUSTOMER_LIFTINGS_PROPANE_MB).toFixed(2);
                data[i].CLOSING_PERCENTAGE_PROPANE = ((data[i].CLOSING_INVENTORY_PROPANE / (data[0].MAX_SAFE_INVENTORY_PROPANE - data[0].MIN_SAFE_INVENTORY_PROPANE)) * 100).toFixed(2);

                data[i].OPENING_INVENTORY_BUTANE = parseFloat(data[i].OPENING_INVENTORY_BUTANE);
                data[i].CLOSING_INVENTORY_BUTANE = (data[i].OPENING_INVENTORY_BUTANE + data[i].TERMINAL_AVAILS_BUTANE - data[i].CUSTOMER_LIFTINGS_BUTANE_MB).toFixed(2);
                data[i].CLOSING_PERCENTAGE_BUTANE = ((data[i].CLOSING_INVENTORY_BUTANE / (data[0].MAX_SAFE_INVENTORY_BUTANE - data[0].MIN_SAFE_INVENTORY_BUTANE)) * 100).toFixed(2);
                data[i].ONTIME_ACTION = "";
            }
            else {
                data[i].OPENING_INVENTORY_PROPANE = parseFloat(data[i - 1].CLOSING_INVENTORY_PROPANE);
                data[i].CLOSING_INVENTORY_PROPANE = data[i].OPENING_INVENTORY_PROPANE + data[i].TERMINAL_AVAILS_PROPANE - data[i].CUSTOMER_LIFTINGS_PROPANE_MB;
                data[i].CLOSING_PERCENTAGE_PROPANE = ((data[i].CLOSING_INVENTORY_PROPANE / (data[0].MAX_SAFE_INVENTORY_PROPANE - data[0].MIN_SAFE_INVENTORY_PROPANE)) * 100).toFixed(2);

                data[i].OPENING_INVENTORY_BUTANE = parseFloat(data[i - 1].CLOSING_INVENTORY_BUTANE);
                data[i].CLOSING_INVENTORY_BUTANE = (data[i].OPENING_INVENTORY_BUTANE + data[i].TERMINAL_AVAILS_BUTANE - data[i].CUSTOMER_LIFTINGS_BUTANE_MB).toFixed(2);
                data[i].CLOSING_PERCENTAGE_BUTANE = ((data[i].CLOSING_INVENTORY_BUTANE / (data[0].MAX_SAFE_INVENTORY_BUTANE - data[0].MIN_SAFE_INVENTORY_BUTANE)) * 100).toFixed(2);
                data[i].ONTIME_ACTION = "";
            }
        }
    }
};

// $("#lastSaved").html(scenarioData.DATA[0].UPDATED_DTTM);
// $("#version").html(scenarioData.DATA[0].SCENARIO_PLANNING_VERSION);
// $("#ospasSubmitStatus").html(scenarioData.TOLERANCE[0].SCENARIO_PLANNING_STATUS);
// to get values for Revert Last Saved Version
// this return value json object will be stored in Revert Last Saved Version
revertData = null;
// Filter the DATA array based on region
const eastDate = scenarioData.SLOT_AVAILABILITY.filter((item) => item.REGION === "EAST");
// const westDate = scenarioData.SLOT_AVAILABILITY.filter((item) => item.REGION === "WEST");

// Extract unique dates from the filtered data
const eastDateArray = [...new Set(eastDate.map((item) => item.SCENARIO_DATE))];
const westDateArray = [...new Set(scenarioData.SLOT_AVAILABILITY.map((item) => item.DAY))];

var tolerance = scenarioData.TOLERANCE;
var eastTolPropane = tolerance[0].TOLERANCE_PROPANE;
var eastTolButane = tolerance[0].TOLERANCE_BUTANE;

var westTolPropane = tolerance[1].TOLERANCE_PROPANE;
var westTolButane = tolerance[1].TOLERANCE_BUTANE;

var now = new Date();
var nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
var nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0);

var eastData = scenarioData.DATA.filter(function (item) {
    return item.REGION === "EAST";
});

var westData = scenarioData.DATA.filter(function (item) {
    return item.REGION === "WEST";
});

reCalculateTotals(eastData);
reCalculateTotals(westData);

var scenarioGrid = $("#tabpanel-container").dxTabPanel({
    deferRendering: true,
    items: [{
        title: "East",
        icon: "rowfield",
        keyExpr: 'NOMINATION_TEMP_KEY',
        showBorders: true,
        template: function (itemData, itemIndex, element) {
            $('#tabChartContainer').hide();
            let dataGridDiv = $("<div id='eastGrid'>");
            dataGridDiv.appendTo(element);
            dataGridDiv.dxDataGrid({
                dataSource: eastData,

                sorting: {
                    mode: "none"
                },
                rowAlternationEnabled: true,
                allowColumnReordering: true,
                allowColumnResizing: true,
                columnAutoWidth: false,
                showBorders: true,
                // height: 500,
                // direction: 'vertical',
                columnFixing: {
                    enabled: true,
                },
                paging: false,
                editing: {
                    mode: 'cell',
                    allowUpdating: true,
                },
                onInitialized: function (e) {
                    reCalculateTotals(eastData);
                },

                rowDragging: {
                    allowReordering: true,
                    onReorder(e) {
                        const visibleRows = e.component.getVisibleRows();
                        const toIndex = eastData.findIndex((item) => item.ROW_ORDER === (visibleRows[e.toIndex].data.ROW_ORDER));
                        const fromIndex = eastData.findIndex((item) => item.ROW_ORDER === e.itemData.ROW_ORDER);
                        if ((fromIndex >= 0) && (toIndex >= 0) && (fromIndex !== toIndex) && ((eastData[toIndex].LOCK_NOMINATION != "Y") && (eastData[fromIndex].LOCK_NOMINATION != "Y"))) {
                            const temp = eastData[fromIndex];
                            eastData[fromIndex] = eastData[toIndex];
                            eastData[toIndex] = temp;

                            $("#eastGrid").dxDataGrid("instance").refresh();
                            reCalculateDraggedTotals(eastData, toIndex, fromIndex);
                        }

                        $("#eastGrid").dxDataGrid("instance").refresh();
                        recalculateStats(eastData.concat(westData));
                    },
                },
                onDrag: function (e) {
                    var dragDistance = e.event.pageY - e.event.target.getBoundingClientRect().top;
                },
                onRowDragStart: function (e) {
                    e.component.option("drggedRowData", e.data);
                },
                onRowDropped: function (e) {
                    var draggedRowData = e.component.option("draggedRowData");
                    const toIndex = eastData.findIndex((item) => item.ROW_ORDER === visibleRows[e.toIndex].data.ROW_ORDER);
                    const fromIndex = eastData.findIndex((item) => item.ROW_ORDER === e.itemData.ROW_ORDER);
                    if (eastData[toIndex].LOCK_NOMINATION != "Y" || eastData[fromIndex].LOCK_NOMINATION != "Y") {
                        var targetData = e.dropInside ? e.component.getVisibleRows()[e.toIndex].data : e.component.getVisibleRows()[e.toIndex - 1].data;
                        targetData.NOMINATION_DATE = draggedRowData.SCENARIO_DATE;
                        reCalculateDraggedTotals(eastData, toIndex, fromIndex);

                    };
                    recalculateStats(eastData.concat(westData));
                    e.component.refresh();

                },
                onEditorPreparing: function (e) {
                    if (e.dataField == "OPENING_INVENTORY_PROPANE") {
                        if (e.row.rowIndex === 0) {
                            e.cancel = false;
                        } else {
                            e.cancel = true;
                        }
                    }

                    if (e.dataField == "OPENING_INVENTORY_BUTANE") {
                        if (e.row.rowIndex === 0) {
                            e.cancel = false;
                        } else {
                            e.cancel = true;
                        }
                    }

                    if (e.dataField == "TERMINAL_AVAILS_PROPANE") {
                        if (e.row.rowIndex % 2 === 0) {
                            e.cancel = false;
                        } else {
                            e.cancel = true;
                        }
                    }
                    if (e.dataField == "TERMINAL_AVAILS_BUTANE") {
                        if (e.row.rowIndex % 2 === 0) {
                            e.cancel = false;
                        } else {
                            e.cancel = true;
                        }
                    }

                    if (e.parentType === "dataRow" && e.dataField === "CUSTOMER_LIFTING_PROPANE") {
                        var checkLift = e.row.data.CUSTOMER_LIFTING_PROPANE;
                        var checkNomKey = e.row.data.NOMINATION_TEMP_KEY;
                        if (checkLift !== null && checkNomKey !== "") {
                            e.cancel = false;
                        } else {
                            e.cancel = true;
                        }
                    }

                    if (e.parentType === "dataRow" && e.dataField === "CUSTOMER_LIFTING_BUTANE") {
                        var checkLift = e.row.data.CUSTOMER_LIFTING_BUTANE;
                        var checkNomKey = e.row.data.NOMINATION_TEMP_KEY;
                        if (checkLift !== null && checkNomKey !== "") {
                            e.cancel = false;
                        } else {
                            e.cancel = true;
                        }
                    }
                    if (e.parentType === "dataRow" && e.row.data.NOMINATION_TEMP_KEY == null) {
                        $("#diversionCalendarEast").hide();
                    }

                },
                onEditorPrepared: function (e) {
                    var newData = reCalculateTotals(e.component.option('dataSource'));
                    e.component.refresh(true);
                    recalculateStats(eastData.concat(westData));
                },
                columns: [
                    {
                        caption: "Action",
                        width: 80,
                        alignment: "center",
                        cellTemplate: function (container, options) {
                            // Create a container div
                            var iconsContainer = $("<div>")
                                .addClass("icons-container")
                                .appendTo(container);

                            // Calendar icon
                            if (options.data.NOMINATION_TEMP_KEY != null) {
                                $("<a>").addClass("calendar-icon table-btn mr-2")
                                    .append($("<i>").addClass("fa fa-calendar")).attr(
                                        "disabled", options.data.CUSTOMER_NAME === "")
                                    .on("click", function () {
                                        var popup = $("<div id = 'diversionCalendarEast'>").addClass("calendar-popup").dxPopover({
                                            title: "Calendar",
                                            target: ".calendar-popup",
                                            position: "bottom",
                                            contentTemplate: function (contentElement) {
                                                // Get the current date
                                                var currentDate = new Date();
                                                // Set the next month as the value for the calendar
                                                var nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
                                                var disabledDates = findAvailableSlot(scenarioData, eastData.concat(westData));
                                                var nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0);
                                                var formatDates = disabledDates.westSlotAvailDate.map(function (date) { return new Date(date); });
                                                // Create and append the calendar widget
                                                $("<div>").dxCalendar({
                                                    value: nextMonth,
                                                    min: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1),
                                                    max: nextMonthEnd,
                                                    maxZoomLevel: "month",
                                                    disabledDates: formatDates,
                                                    onValueChanged: function (e) {
                                                        moveNominationOnGrid(options.data, e.value);
                                                        recalculateStats(eastData.concat(westData));
                                                    }
                                                }).appendTo(contentElement);
                                            },
                                            onHidden: function () {
                                                // Cleanup when the popup is closed
                                                popup.remove();
                                            },
                                        })
                                            .appendTo(container);
                                        popup.dxPopover("show");
                                    }).appendTo(iconsContainer);
                                //Cancel or Deffered inside grid
                                if (options.data.NOMINATION_TEMP_KEY != null) {
                                    $("<a>").addClass("cancel-icon table-btn mr-2")
                                        .append($("<i>").addClass("fa fa-times")).attr(
                                            "disabled", options.data.CUSTOMER_NAME === "")
                                        .on("click", async function () {
                                            cancelNomination(options.data);
                                        }).appendTo(iconsContainer);
                                };
                            };
                            //show dropdown for removed values
                            if (options.data.NOMINATION_TEMP_KEY == null && t_cancelled_nominations_vr.APPND_NAME_KEY.length > 0) {
                                $("<a>").addClass("listing-icon table-btn mr-2")
                                    .append($("<i>").addClass("fa fa-caret-down")).css("cursor", "pointer").appendTo(iconsContainer)
                                    .on("click", function () {
                                        var popover = $("<div>").addClass("listing-popup").dxPopover({
                                            target: ".listing-popup",
                                            placement: "bottom",
                                            contentTemplate: function (contentElement) {

                                                var customerList = $("<div>").addClass("customer-popover");
                                                var ulElement = $("<ul style='list-style-type: none'>");

                                                t_cancelled_nominations_vr.APPND_NAME_KEY.forEach(function (dataItem) {
                                                    var customerAppend = $('<li>').text(dataItem).on("click", function (e) {
                                                        // Bring Back Nominations
                                                        bringBackNomination(options.data, $(this).text());
                                                    });
                                                    ulElement.append(customerAppend).css({ 'cursor': "pointer", "padding": "3px", "background-color": "#f2c2c", "border-bottom": "1px solid #ccc" });
                                                })

                                                customerList.append(ulElement);
                                                contentElement.append(customerList);
                                            },
                                            onShown: function (e) {
                                                var popoverContent = e.component.content();
                                                popoverContent.trigger("click");
                                            },
                                            onHidden: function () {
                                                $(".customer-popover").remove();
                                                $(".listing-popup").remove();
                                            },
                                        })
                                            .appendTo(container);
                                        popover.dxPopover("show");
                                    });
                            }
                        },

                    },
                    {
                        dataField: "LOCK_NOMINATION",
                        caption: "Lock Nomination",
                        allowEditing: false,
                        width: 50,
                        alignment: "center",
                        cellTemplate: function (container, options) {
                            $("<div>")
                                .addClass("dx-checkbox")
                                .dxCheckBox({
                                    value: options.data.LOCK_NOMINATION === "Y",
                                    onValueChanged: function (e) {
                                        var newValue = e.value ? "Y" : "N";
                                        options.data.LOCK_NOMINATION = newValue;
                                    }
                                }).appendTo(container);
                        }
                    },
                    {
                        dataField: "SCENARIO_DATE",
                        caption: "Date",
                    },
                    {
                        caption: "Opening Inventory",
                        columns: [
                            {
                                caption: "Propane",
                                dataField: "OPENING_INVENTORY_PROPANE",
                                format: { type: "fixedPoint", precision: 2 },
                                cellTemplate: function (container, options) {
                                    var isEditable = options.column.allowEditing && options.rowType === 'data' && options.rowIndex === 0;
                                    if (isEditable) {
                                        container.css("background-color", "#fff2cc");
                                    }
                                    container.text(options.text);
                                }
                            },
                            {
                                caption: "Butane",
                                dataField: "OPENING_INVENTORY_BUTANE",
                                format: { type: "fixedPoint", precision: 2 },
                                cellTemplate: function (container, options) {
                                    var isEditable = options.column.allowEditing && options.rowType === 'data' && options.rowIndex === 0;
                                    if (isEditable) {
                                        container.css("background-color", "#fff2cc");
                                    }
                                    container.text(options.text);
                                }
                            }
                        ]
                    },
                    {
                        caption: "Terminal Avails",
                        columns: [
                            {
                                caption: "Propane",
                                dataField: "TERMINAL_AVAILS_PROPANE",
                                allowEditing: true,
                                cellTemplate: function (container, options) {
                                    var isEditable = options.column.allowEditing && options.rowType === 'data';
                                    if (isEditable) {
                                        if (options.rowIndex % 2 !== 0) {
                                            container.css("background-color", "#f5f5f5");
                                        } else {
                                            container.css("background-color", "#fff2cc");
                                        }

                                    }
                                    container.text(options.text);
                                }
                            },
                            {
                                caption: "Butane",
                                dataField: "TERMINAL_AVAILS_BUTANE",
                                allowEditing: true,
                                cellTemplate: function (container, options) {
                                    var isEditable = options.column.allowEditing && options.rowType === 'data';
                                    if (isEditable) {
                                        if (options.rowIndex % 2 !== 0) {
                                            container.css("background-color", "#f5f5f5");
                                        } else {
                                            container.css("background-color", "#fff2cc");
                                        }
                                    }
                                    container.text(options.text);
                                }
                            }
                        ]
                    },
                    {
                        dataField: "CUSTOMER_NAME",
                        caption: "Customer",
                        allowEditing: false,
                        cellTemplate: function (container, options) {
                            var customerId = options.data.CUSTOMER_ID;

                            var url = "https://cs-smoke.aramco.com/SASVisualAnalytics/?reportUri=%2Freports%2Freports%2F69b4a12c-4289-4df6-befc-20dcf897c1f3&sectionIndex=0&reportViewOnly=true&reportContextBar=false&pageNavigation=false&sas-welcome=false&pr26083=" + customerId;
                            $("<a>", {
                                "href": url,
                                "text": options.data.CUSTOMER_NAME,
                                "target": "_blank"
                            }).appendTo(container);
                        }

                    },
                    {
                        dataField: "NOMINATION_TEMP_KEY",
                        caption: "Nomination Temp Key",
                        allowEditing: false,
                    },
                    {
                        caption: "Customer Liftings (KMT)",
                        columns: [
                            {
                                caption: "Propane",
                                allowEditing: true,
                                dataField: "CUSTOMER_LIFTING_PROPANE",
                                cellTemplate: function (container, options) {
                                    var isEditable = options.column.allowEditing && options.rowType === 'data' && options.data.NOMINATION_TEMP_KEY !== null;
                                    if (isEditable) {
                                        container.css("background-color", "#fff2cc");
                                    } else {
                                        container.css("background-color", "#f5f5f5");
                                        $(container).attr("disabled", "disabled");
                                    }
                                    container.text(options.text);
                                }
                            },
                            {
                                caption: "Butane",
                                allowEditing: true,
                                dataField: "CUSTOMER_LIFTING_BUTANE",
                                cellTemplate: function (container, options) {
                                    var isEditable = options.column.allowEditing && options.rowType === 'data' && options.data.NOMINATION_TEMP_KEY !== null;
                                    if (isEditable) {
                                        container.css("background-color", "#fff2cc");
                                    } else {
                                        container.css("background-color", "#f5f5f5");
                                        $(container).attr("disabled", "disabled");
                                    }
                                    container.text(options.text);
                                }
                            }
                        ]
                    },
                    {
                        caption: "Customer Liftings (MB)",
                        columns: [
                            {
                                caption: "Propane",
                                allowEditing: false,
                                // dataField: "CUSTOMER_LIFTINGS_PROPANE_MB"
                                calculateCellValue: function (rowData) {
                                    if (rowData.NOMINATION_TEMP_KEY != null) { return rowData.CUSTOMER_LIFTINGS_PROPANE_MB };
                                }
                            },
                            {
                                caption: "Butane",
                                allowEditing: false,
                                calculateCellValue: function (rowData) {
                                    if (rowData.NOMINATION_TEMP_KEY != null) { return rowData.CUSTOMER_LIFTINGS_BUTANE_MB };
                                }
                                // dataField: "CUSTOMER_LIFTINGS_BUTANE_MB"
                            }
                        ]
                    },
                    {
                        caption: "Closing Inventory",
                        columns: [
                            {
                                caption: "Propane",
                                allowEditing: false,
                                calculateCellValue: function (rowData) {
                                    return rowData.CLOSING_INVENTORY_PROPANE;
                                }
                            },
                            {
                                caption: "Butane",
                                allowEditing: false,
                                calculateCellValue: function (rowData) {
                                    return rowData.CLOSING_INVENTORY_BUTANE;
                                }
                            }
                        ]
                    },
                    {
                        caption: "Closing Percentage",
                        columns: [
                            {
                                caption: "Propane",
                                allowEditing: false,
                                format: "percent",
                                alignment: "right",
                                dataType: "number",
                                // dataField: "CLOSING_PERCENTAGE_PROPANE",
                                cellTemplate: function (container, options) {
                                    if (options.data.CLOSING_PERCENTAGE_PROPANE == "" || options.data.CLOSING_PERCENTAGE_PROPANE == undefined) {
                                        return "";
                                    }
                                    const valueDiv = $("<div>").text(options.data.CLOSING_PERCENTAGE_PROPANE + "%");
                                    if (options.data.CLOSING_PERCENTAGE_PROPANE < 20 || options.data.CLOSING_PERCENTAGE_PROPANE > 80) {
                                        container.addClass('highlight-cell');
                                    }
                                    return valueDiv;
                                },

                            },
                            {
                                caption: "Butane",
                                allowEditing: false,
                                format: "percent",
                                alignment: "right",
                                dataType: "number",
                                cellTemplate: function (container, options) {
                                    if (options.data.CLOSING_PERCENTAGE_BUTANE == "" || options.data.CLOSING_PERCENTAGE_BUTANE == undefined) {
                                        return "";
                                    }
                                    const valueDiv = $("<div>").text(options.data.CLOSING_PERCENTAGE_BUTANE + "%");
                                    if (options.data.CLOSING_PERCENTAGE_BUTANE < 20 || options.data.CLOSING_PERCENTAGE_BUTANE > 80) {
                                        container.addClass('highlight-cell');
                                    }
                                    return valueDiv;
                                },
                            }
                        ]
                    },
                    {
                        // dataField: "NOMINATION_TEMP_KEY",
                        caption: "OnTime/Delayed/Advanced",
                        allowEditing: false,
                        calculateCellValue: function (rowData) {
                            var startDate = new Date(rowData.SCENARIO_DATE);
                            var endDate = new Date(rowData.NOMINATION_DATE);
                            var nomTempKey = rowData.NOMINATION_TEMP_KEY;
                            if (nomTempKey !== null) {
                                var timeDiff = Math.abs(startDate.getTime() - endDate.getTime());
                                var diffDays = Math.ceil(timeDiff / (1000 * 3600 * 24));
                                if (diffDays === 0) {
                                    return rowData.ONTIME_ACTION = "OnTime";
                                } else if (startDate < endDate) {
                                    return rowData.ONTIME_ACTION = "Advanced";
                                } else {
                                    return rowData.ONTIME_ACTION = "Delayed";
                                }
                            }
                            return rowData.ONTIME_ACTION;
                        }
                    },
                    {
                        // dataField: "NOMINATION_TEMP_KEY",
                        caption: "Days",
                        allowEditing: false,
                        calculateCellValue: function (rowData) {
                            var startDate = new Date(rowData.SCENARIO_DATE);
                            var endDate = new Date(rowData.NOMINATION_DATE);
                            var nomTempKey = rowData.NOMINATION_TEMP_KEY;
                            if (nomTempKey !== null) {
                                var timeDiff = Math.abs(startDate.getTime() - endDate.getTime());
                                var diffDays = Math.ceil(timeDiff / (1000 * 3600 * 24));
                                return diffDays;
                            }
                        }
                    },

                ],
            });

            //East Propane Chart
            //East Butane Chart

            let formDivEast = $("<div id='eastToleranceForm' style='margin:8px;'>")
            // formDiv.appendTo(element);
            formDivEast.appendTo(element);
            var formItemsEast = [
                {
                    dataField: "TOLERANCE_PROPANE",
                    label: {
                        text: "Tolerance Propane",
                    },
                    editorType: "dxTextBox",
                    editorOptions: {
                        onValueChanged: function (e) {
                            eastTolPropane = e.value;
                            reCalculateTotals(eastData);
                            $("#eastGrid").dxDataGrid("instance").refresh();
                        }
                    },
                },
                {
                    dataField: "TOLERANCE_BUTANE",
                    label:
                    {
                        text: "Tolerance Butane",
                    },
                    editorType: "dxTextBox",
                    editorOptions: {
                        onValueChanged: function (e) {
                            eastTolButane = e.value;
                            reCalculateTotals(eastData);
                            $("#eastGrid").dxDataGrid("instance").refresh();
                        }
                    },
                },
                {
                    disabled: true,
                    label:
                    {
                        text: "Working Capacity Propane",
                    },
                    editorType: "dxTextBox",
                },
                {
                    disabled: true,
                    label:
                    {
                        text: "Working Capacity Butane",
                    },
                    editorType: "dxTextBox",
                }
            ];
            formDivEast.dxForm({
                colCount: 4,
                formData: scenarioData.TOLERANCE[0],
                items: formItemsEast
            }).dxForm('instance');
        }
    }, {
        title: "West",
        icon: "rowfield",
        keyExpr: 'NOMINATION_TEMP_KEY',
        showBorders: true,
        template: function (itemData, itemIndex, element) {
            let dataGridDiv = $("<div id='westGrid'>");
            dataGridDiv.appendTo(element);
            dataGridDiv.dxDataGrid({
                dataSource: westData,
                sorting: {
                    mode: "none"
                },
                rowAlternationEnabled: true,
                allowColumnReordering: true,
                allowColumnResizing: true,
                columnAutoWidth: false,
                showBorders: true,
                columnFixing: {
                    enabled: true,
                },

                paging: false,
                onInitialized: function (e) {
                    reCalculateTotals(westData);
                },
                rowDragging: {
                    allowReordering: true,
                    onReorder(e) {
                        const visibleRows = e.component.getVisibleRows();
                        const toIndex = westData.findIndex((item) => item.ROW_ORDER === (visibleRows[e.toIndex].data.ROW_ORDER));
                        const fromIndex = westData.findIndex((item) => item.ROW_ORDER === e.itemData.ROW_ORDER);

                        if ((fromIndex >= 0) && (toIndex >= 0) && (fromIndex !== toIndex) && ((westData[toIndex].LOCK_NOMINATION != "Y") && (westData[fromIndex].LOCK_NOMINATION != "Y"))) {
                            const temp = westData[fromIndex];
                            westData[fromIndex] = westData[toIndex];
                            westData[toIndex] = temp;

                            $("#westGrid").dxDataGrid("instance").refresh();
                            reCalculateDraggedTotals(westData, toIndex, fromIndex);
                        }
                        $("#westGrid").dxDataGrid("instance").refresh();
                        recalculateStats(eastData.concat(westData));
                    },
                },
                onRowDragStart: function (e) {
                    e.component.option("drggedRowData", e.data);
                },
                onRowDropped: function (e) {
                    var draggedRowData = e.component.option("draggedRowData");
                    const toIndex = westData.findIndex((item) => item.ROW_ORDER === visibleRows[e.toIndex].data.ROW_ORDER);
                    const fromIndex = westData.findIndex((item) => item.ROW_ORDER === e.itemData.ROW_ORDER);
                    if (westData[toIndex].LOCK_NOMINATION != "Y" || westData[fromIndex].LOCK_NOMINATION != "Y") {
                        var targetData = e.dropInside ? e.component.getVisibleRows()[e.toIndex].data : e.component.getVisibleRows()[e.toIndex - 1].data;
                        getOnTimeAction(draggedRowData.SCENARIO_DATE, targetData.NOMINATION_DATE);
                        targetData.NOMINATION_DATE = draggedRowData.SCENARIO_DATE;
                        reCalculateDraggedTotals(westData, toIndex, fromIndex);
                    };
                    recalculateStats(eastData.concat(westData));
                    e.component.refresh();
                },
                editing: {
                    mode: 'cell',
                    allowUpdating: true,
                },
                onContextMenuPreparing: function (e) {
                    if (e.column.visibleIndex) {
                        e.items = [{
                            text: "Divert to West",
                            onItemClick: function () {
                                if (e.row.rowIndex) {

                                }
                            },
                        }, {
                            text: "Defer/Cancel Nomination",
                            onItemClick: function () {
                            }
                        }
                        ]
                    }
                },
                onRowUpdated: function (e) {
                    if (e.dataField == "OPENING_INVENTORY_PROPANE") {
                        const editColumnName = e.component.option("editing.editColumnName");
                        let scenarioEastData = e.component.option('dataSource');
                        reCalculateTotals(scenarioEastData);
                        // e.component.cellValue(e.row.rowIndex, editColumnName, e.data);
                    }
                },
                onEditorPreparing: function (e) {
                    if (e.dataField == "OPENING_INVENTORY_PROPANE") {
                        if (e.row.rowIndex === 0) {
                            e.cancel = false;
                        } else {
                            e.cancel = true;
                        }
                    }

                    if (e.dataField == "OPENING_INVENTORY_BUTANE") {
                        if (e.row.rowIndex === 0) {
                            e.cancel = false;
                        } else {
                            e.cancel = true;
                        }
                    }

                },
                onEditorPrepared: function (e) {
                    var newData = reCalculateTotals(e.component.option('dataSource'));
                    e.component.refresh(true);
                    recalculateStats(eastData.concat(westData));
                },
                columns: [
                    {
                        caption: "Action",
                        width: 80,
                        alignment: "center",
                        cellTemplate: function (container, options) {
                            // Create a container div
                            var iconsContainer = $("<div>")
                                .addClass("icons-container")
                                .appendTo(container);

                            // Calendar icon
                            if (options.data.NOMINATION_TEMP_KEY != null) {
                                $("<a>").addClass("calendar-icon table-btn mr-2")
                                    .append($("<i>").addClass("fa fa-calendar")).attr(
                                        "disabled", options.data.CUSTOMER_NAME === "")
                                    .on("click", function () {
                                        var popup = $("<div id = 'diversionCalendarWest'>").addClass("calendar-popup").dxPopover({
                                            title: "Calendar",
                                            target: ".calendar-popup",
                                            position: "bottom",
                                            contentTemplate: function (contentElement) {
                                                // Get the current date
                                                var currentDate = new Date();
                                                // Set the next month as the value for the calendar
                                                var nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
                                                var nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0);
                                                var disabledDates = findAvailableSlot(scenarioData, eastData.concat(westData));
                                                var formatDates = disabledDates.eastSlotAvailDate.map(function (date) { return new Date(date); });
                                                // Create and append the calendar widget
                                                $("<div>").dxCalendar({
                                                    value: nextMonth,
                                                    min: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1),
                                                    max: nextMonthEnd,
                                                    maxZoomLevel: "month",
                                                    disabledDates: formatDates,
                                                    onValueChanged: function (e) {
                                                        moveNominationOnGrid(options.data, e.value);
                                                        recalculateStats(eastData.concat(westData));
                                                    },


                                                }).appendTo(contentElement);
                                            },
                                            onHidden: function () {
                                                // Cleanup when the popup is closed
                                                popup.remove();
                                            },
                                        })
                                            .appendTo(container);
                                        popup.dxPopover("show");
                                    }).appendTo(iconsContainer);
                            }
                            if (options.data.NOMINATION_TEMP_KEY != null) {
                                $("<a>").addClass("cancel-icon table-btn mr-2")
                                    .append($("<i>").addClass("fa fa-times")).attr(
                                        "disabled", options.data.CUSTOMER_NAME === "")
                                    .on("click", async function () {
                                        cancelNomination(options.data);
                                        $('.overlay').hide();
                                    }).appendTo(iconsContainer);
                            };
                            if (options.data.NOMINATION_TEMP_KEY == null && t_cancelled_nominations_vr.APPND_NAME_KEY.length > 0) {
                                $("<a>").addClass("listing-icon table-btn mr-2")
                                    .append($("<i>").addClass("fa fa-caret-down")).css("cursor", "pointer").appendTo(iconsContainer)
                                    .on("click", function () {
                                        var popover = $("<div>").addClass("listing-popup").dxPopover({
                                            target: ".listing-popup",
                                            placement: "bottom",
                                            contentTemplate: function (contentElement) {

                                                var customerList = $("<div>").addClass("customer-popover");
                                                var ulElement = $("<ul style='list-style-type: none'>");

                                                t_cancelled_nominations_vr.APPND_NAME_KEY.forEach(function (dataItem) {
                                                    var customerAppend = $('<li>').text(dataItem).on("click", function (e) {
                                                        // Bring Back Nominations
                                                        bringBackNomination(options.data, $(this).text());
                                                    });
                                                    ulElement.append(customerAppend).css({ 'cursor': "pointer", "padding": "3px", "background-color": "#f2c2c", "border-bottom": "1px solid #ccc" });
                                                })

                                                customerList.append(ulElement);
                                                contentElement.append(customerList);
                                            },
                                            onShown: function (e) {
                                                var popoverContent = e.component.content();
                                                popoverContent.trigger("click");
                                            },
                                            onHidden: function () {
                                                $(".customer-popover").remove();
                                                $(".listing-popup").remove();
                                            },
                                        })
                                            .appendTo(container);
                                        popover.dxPopover("show");
                                    });
                            };
                        },
                    },
                    {
                        dataField: "LOCK_NOMINATION",
                        caption: "Lock Nomination",

                        width: 50,
                        alignment: "center",
                        cellTemplate: function (container, options) {
                            $("<div>")
                                .addClass("dx-checkbox")
                                .dxCheckBox({
                                    value: options.data.LOCK_NOMINATION === "Y",
                                    onValueChanged: function (e) {
                                        var newValue = e.value ? "Y" : "N";
                                        options.data.LOCK_NOMINATION = newValue;
                                    }
                                }).appendTo(container);
                        }
                    },
                    {
                        dataField: "SCENARIO_DATE",
                        caption: "Date",

                    },
                    {
                        caption: "Opening Inventory",
                        columns: [
                            {
                                caption: "Propane",
                                dataField: "OPENING_INVENTORY_PROPANE",
                                format: { type: "fixedPoint", precision: 2 },
                                cellTemplate: function (container, options) {
                                    var isEditable = options.column.allowEditing && options.rowType === 'data' && options.rowIndex === 0;
                                    if (isEditable) {
                                        container.css("background-color", "#fff2cc");
                                    }
                                    container.text(options.text);
                                }
                            },
                            {
                                caption: "Butane",
                                dataField: "OPENING_INVENTORY_BUTANE",
                                format: { type: "fixedPoint", precision: 2 },
                                cellTemplate: function (container, options) {
                                    var isEditable = options.column.allowEditing && options.rowType === 'data' && options.rowIndex === 0;
                                    if (isEditable) {
                                        container.css("background-color", "#fff2cc");
                                    }
                                    container.text(options.text);
                                }
                            }
                        ]
                    },
                    {
                        caption: "Terminal Avails",
                        columns: [
                            {
                                caption: "Propane",
                                dataField: "TERMINAL_AVAILS_PROPANE",
                                allowEditing: true,
                                cellTemplate: function (container, options) {
                                    var isEditable = options.column.allowEditing && options.rowType === 'data';
                                    if (isEditable) {
                                        container.css("background-color", "#fff2cc");
                                    }
                                    container.text(options.text);
                                }
                            },
                            {
                                caption: "Butane",
                                dataField: "TERMINAL_AVAILS_BUTANE",
                                allowEditing: true,
                                cellTemplate: function (container, options) {
                                    var isEditable = options.column.allowEditing && options.rowType === 'data';
                                    if (isEditable) {
                                        container.css("background-color", "#fff2cc");
                                    }
                                    container.text(options.text);
                                }
                            }
                        ]
                    },
                    {
                        dataField: "CUSTOMER_NAME",
                        caption: "Customer",
                        allowEditing: false,
                        cellTemplate: function (container, options) {
                            var customerId = options.data.CUSTOMER_ID;
                            console.log(customerId);
                            var url = "https://cs-smoke.aramco.com/SASVisualAnalytics/?reportUri=%2Freports%2Freports%2F69b4a12c-4289-4df6-befc-20dcf897c1f3&sectionIndex=0&reportViewOnly=true&reportContextBar=false&pageNavigation=false&sas-welcome=false&pr26083=" + customerId;
                            $("<a>", {
                                "href": url,
                                "text": options.data.CUSTOMER_NAME,
                                "target": "_blank"
                            }).appendTo(container);
                        }

                    },
                    {
                        dataField: "NOMINATION_TEMP_KEY",
                        caption: "Nomination Temp Key",
                        allowEditing: false,
                    },
                    {
                        caption: "Customer Liftings (KMT)",
                        columns: [
                            {
                                caption: "Propane",
                                allowEditing: true,
                                dataField: "CUSTOMER_LIFTING_PROPANE",
                                cellTemplate: function (container, options) {
                                    var isEditable = options.column.allowEditing && options.rowType === 'data';
                                    if (isEditable) {
                                        container.css("background-color", "#fff2cc");
                                    }
                                    container.text(options.text);
                                }
                            },
                            {
                                caption: "Butane",
                                allowEditing: true,
                                dataField: "CUSTOMER_LIFTING_BUTANE",
                                cellTemplate: function (container, options) {
                                    var isEditable = options.column.allowEditing && options.rowType === 'data';
                                    if (isEditable) {
                                        container.css("background-color", "#fff2cc");
                                    }
                                    container.text(options.text);
                                }
                            }
                        ]
                    },
                    {
                        caption: "Customer Liftings (MB)",
                        columns: [
                            {
                                caption: "Propane",
                                allowEditing: false,
                                calculateCellValue: function (rowData) {
                                    if (rowData.NOMINATION_TEMP_KEY != null) { return rowData.CUSTOMER_LIFTINGS_PROPANE_MB };
                                }
                            },
                            {
                                caption: "Butane",
                                allowEditing: false,
                                calculateCellValue: function (rowData) {
                                    if (rowData.NOMINATION_TEMP_KEY != null) { return rowData.CUSTOMER_LIFTINGS_BUTANE_MB };
                                }
                            }
                        ]
                    },
                    {
                        caption: "Closing Inventory",
                        columns: [
                            {
                                caption: "Propane",
                                allowEditing: false,
                                calculateCellValue: function (rowData) {
                                    return rowData.CLOSING_INVENTORY_PROPANE;
                                }
                            },
                            {
                                caption: "Butane",
                                allowEditing: false,
                                calculateCellValue: function (rowData) {
                                    return rowData.CLOSING_INVENTORY_BUTANE;
                                }
                            }
                        ]
                    },
                    {
                        caption: "Closing Percentage",
                        columns: [
                            {
                                caption: "Propane",
                                allowEditing: false,
                                format: "percent",
                                alignment: "right",
                                dataType: "number",
                                cellTemplate: function (container, options) {
                                    if (options.data.CLOSING_PERCENTAGE_PROPANE == "" || options.data.CLOSING_PERCENTAGE_PROPANE == undefined) {
                                        return "";
                                    }
                                    const valueDiv = $("<div>").text(options.data.CLOSING_PERCENTAGE_PROPANE + "%");
                                    if (options.data.CLOSING_PERCENTAGE_PROPANE < 20 || options.data.CLOSING_PERCENTAGE_PROPANE > 80) {
                                        container.addClass('highlight-cell');
                                    }
                                    return valueDiv;
                                },
                            },
                            {
                                caption: "Butane",
                                allowEditing: false,
                                format: "percent",
                                alignment: "right",
                                dataType: "number",
                                cellTemplate: function (container, options) {
                                    if (options.data.CLOSING_PERCENTAGE_BUTANE == "" || options.data.CLOSING_PERCENTAGE_BUTANE == undefined) {
                                        return "";
                                    }
                                    const valueDiv = $("<div>").text(options.data.CLOSING_PERCENTAGE_BUTANE + "%");
                                    if (options.data.CLOSING_PERCENTAGE_BUTANE < 20 || options.data.CLOSING_PERCENTAGE_BUTANE > 80) {
                                        container.addClass('highlight-cell');
                                    }
                                    return valueDiv;
                                },
                            }
                        ]
                    },
                    {
                        // dataField: "NOMINATION_TEMP_KEY",
                        caption: "OnTime/Delayed/Advanced",
                        allowEditing: false,
                        calculateCellValue: function (rowData) {
                            var startDate = new Date(rowData.SCENARIO_DATE);
                            var endDate = new Date(rowData.NOMINATION_DATE);
                            var nomTempKey = rowData.NOMINATION_TEMP_KEY;
                            if (nomTempKey !== null) {
                                var timeDiff = Math.abs(startDate.getTime() - endDate.getTime());
                                var diffDays = Math.ceil(timeDiff / (1000 * 3600 * 24));
                                if (diffDays === 0) {
                                    return rowData.ONTIME_ACTION = "OnTime";
                                } else if (startDate < endDate) {
                                    return rowData.ONTIME_ACTION = "Advanced";
                                } else {
                                    return rowData.ONTIME_ACTION = "Delayed";
                                }
                            }
                            return rowData.ONTIME_ACTION;
                        }
                    },
                    {
                        // dataField: "NOMINATION_TEMP_KEY",
                        caption: "Days",
                        allowEditing: false,
                        calculateCellValue: function (rowData) {
                            var startDate = new Date(rowData.SCENARIO_DATE);
                            var endDate = new Date(rowData.NOMINATION_DATE);
                            var nomTempKey = rowData.NOMINATION_TEMP_KEY;
                            if (nomTempKey !== null) {
                                var timeDiff = Math.abs(startDate.getTime() - endDate.getTime());
                                var diffDays = Math.ceil(timeDiff / (1000 * 3600 * 24));
                                return diffDays;
                            }
                        }
                    },

                ],
            });

            let formDivWest = $("<div id='westToleranceForm' style='margin:8px;'>")
            // formDiv.appendTo(element);
            formDivWest.appendTo(element);
            var formItemsWest = [
                {
                    dataField: "TOLERANCE_PROPANE",
                    label:
                    {
                        text: "Tolerance Propane",
                    },
                    editorType: "dxTextBox",
                    editorOptions: {
                        onValueChanged: function (e) {
                            westTolPropane = e.value;
                            reCalculateTotals(westData);
                            $("#westGrid").dxDataGrid("instance").refresh();
                            //e.component.option('dataSource');
                        }
                    },
                },
                {
                    dataField: "TOLERANCE_BUTANE",
                    label:
                    {
                        text: "Tolerance Butane",
                    },
                    editorType: "dxTextBox",
                    editorOptions: {
                        onValueChanged: function (e) {
                            westTolButane = e.value;
                            reCalculateTotals(westData);
                            //e.component.option('dataSource');
                            $("#westGrid").dxDataGrid("instance").refresh();
                        }
                    },
                },
                {
                    disabled: true,
                    label:
                    {
                        text: "Working Capacity Propane",
                    },
                    editorType: "dxTextBox",
                },
                {
                    disabled: true,
                    label:
                    {
                        text: "Working Capacity Butane",
                    },
                    editorType: "dxTextBox",
                }
            ];
            formDivWest.dxForm({
                colCount: 4,
                formData: scenarioData.TOLERANCE[1],
                items: formItemsWest
            }).dxForm('instance');

        }
    }
    ],
    animationEnabled: true,
    swipeEnabled: true,
    selectedIndex: 0,
    onSelectionChanged: function (e) {
        var selectedIndex = e.component.option('selectedIndex');
        if (selectedIndex === 0) {
        } else if (selectedIndex === 1) {
        }
    }
}).dxTabPanel("instance");

function saveScenarioData() {
    DevExpress.ui.dialog.confirm("Are you sure you want data to Save Scenario ?", "Confirmation").done(function (dialogResult) {
        if (dialogResult) {
            $(".overlay").show();
            setTimeout(function () {
                var url = "https://cs-action.aramco.com/SASJobExecution/?_program=%2FSTSP%20LPG%20Demand%20Forecasting%2FCodes%2FWeb%20Interface%2FAPI%20Jobs%2FExport%20Demand%20Allocation%20Scenario%20Planning%20Save";
                var jsonObject = formatToSave();
                var scenarioSave = sendBatchRequest(url, JSON.stringify(jsonObject));
                $('.overlay').hide();
            }, 100);
        }
    });
}


function saveNewVerionScenarioData() {
    DevExpress.ui.dialog.confirm("Are you sure you want save data has New Version?", "Confirmation").done(function (dialogResult) {
        if (dialogResult) {
            $(".overlay").show();
            setTimeout(function () {
                var url = "https://cs-action.aramco.com/SASJobExecution/?_program=%2FSTSP%20LPG%20Demand%20Forecasting%2FCodes%2FWeb%20Interface%2FAPI%20Jobs%2FExport%20Demand%20Allocation%20Scenario%20Planning%20Save%20as%20New%20Version";
                var jsonObject = formatToSave();
                var scenarioSave = sendBatchRequest(url, JSON.stringify(jsonObject));
                $('.overlay').hide();
            }, 100);
        }
    });

}

function revertToLastSaved() {
    DevExpress.ui.dialog.confirm("Are you sure you want data to revert to last saved?", "Confirmation").done(function (dialogResult) {
        if (dialogResult) {
            $(".overlay").show();
            setTimeout(function () {
                var url = "https://cs-action.aramco.com/SASJobExecution/?_program=%2FSTSP%20LPG%20Demand%20Forecasting%2FCodes%2FWeb%20Interface%2FAPI%20Jobs%2FExport%20Demand%20Allocation%20Scenario%20Planning%20Revert%20Last%20Saved&BUSINESS_UNIT=COSMD";
                var jsonObject = formatToSave();
                // $('.overlay').show();
                var scenarioSave = sendBatchRequest(url, JSON.stringify(jsonObject), actions = "revertToLastSaved");
                $('.overlay').hide();
            }, 100);
        }
    });
}

function nominationSuggestion() {
    DevExpress.ui.dialog.confirm("Are you sure you want data to show nomination suggestion?", "Confirmation").done(function (dialogResult) {
        if (dialogResult) {
            $(".overlay").show();
            setTimeout(function () {
                var url = "https://cs-action.aramco.com/SASJobExecution/?_program=%2FSTSP%20LPG%20Demand%20Forecasting%2FCodes%2FWeb%20Interface%2FAPI%20Jobs%2FExport%20Demand%20Allocation%20Scenario%20Planning%20Generate%20Nomination%20Suggestion";
                var jsonObject = formatToSave();
                var latestInv = sendBatchRequest(url, JSON.stringify(jsonObject), actions = "nominationSuggestion");
                $('.overlay').hide();
            }, 100);
        }
    });

}

function fetchLatestInventory() {
    DevExpress.ui.dialog.confirm("Are you sure you want data to fetech latest inventory avails?", "Confirmation").done(function (dialogResult) {
        if (dialogResult) {
            $(".overlay").show();
            setTimeout(function () {
                var url = "https://cs-action.aramco.com/SASJobExecution/?_program=%2FSTSP%20LPG%20Demand%20Forecasting%2FCodes%2FWeb%20Interface%2FAPI%20Jobs%2FExport%20Demand%20Allocation%20Scenario%20Planning%20Fetch%20Latest%20Inventory%20and%20Avails";
                var jsonObject = formatToSave();
                $('.overlay').show();
                var latestInv = sendBatchRequest(url, JSON.stringify(jsonObject), actions = "latestInv");
                $('.overlay').hide();
            }, 100);
        }
    });
}

function refreshBothGridData(eastData, westData) {
    var selectedTab = scenarioGrid.option("selectedIndex");
    $("#tabpanel-container").dxTabPanel("instance").option("selectedIndex", 0);
    var gridEast = $("#eastGrid").dxDataGrid("instance");
    reCalculateTotals(eastData);
    gridEast.option("dataSource", eastData);
    reCalculateTotals(eastData);
    $("#tabpanel-container").dxTabPanel("instance").option("selectedIndex", 1);

    var gridWest = $("#westGrid").dxDataGrid("instance");
    reCalculateTotals(westData);
    gridWest.option("dataSource", westData);
    $("#tabpanel-container").dxTabPanel("instance").option("selectedIndex", selectedTab);
};

function reloadData(newData) {
    scenarioData = newData;
    getVersionStatus(newData);
    eastData = newData.DATA.filter(function (item) {
        return item.REGION === "EAST";
    });

    westData = newData.DATA.filter(function (item) {
        return item.REGION === "WEST";
    });
    refreshBothGridData(eastData, westData);
    // scenarioGrid.option("items[0].template", eastData);
};

function formatToSave() {
    var toleranceData = [];
    var currentDate = new moment();
    var nextMonth = currentDate.clone().add(1, 'months');
    var nextMonthFullname = nextMonth.format("MMMYYYY").toUpperCase();

    toleranceData.push({
        "PLANNING_MONTH": nextMonthFullname,
        "REGION": "EAST",
        "TOLERANCE_BUTANE": parseInt(eastTolButane),
        "TOLERANCE_PROPANE": parseInt(eastTolPropane),
    });
    toleranceData.push({
        "PLANNING_MONTH": nextMonthFullname,
        "REGION": "WEST",
        "TOLERANCE_BUTANE": parseInt(westTolButane),
        "TOLERANCE_PROPANE": parseInt(westTolPropane),
    });
    var mergeData = eastData.concat(westData);

    var scenarioSummary = [];
    scenarioSummary.push({
        "PLANNING_MONTH": nextMonthFullname,
        "NUM_OF_NOMINATIONS_EAST": eastTotNoms,
        "NUM_OF_NOMINATIONS_WEST": westTotNoms,
        "TOTAL_NOMINATIONS": totNoms,
        "DIVERTED_TO_YANBU": eastToWestDiv,
        "DEFERRED_CANCELLED": totCanDef,
        "AVERAGE_DELAYED_DAYS": avg_delays,
        "BUSINESS_UNIT": "COSMD",
        "ACCEPTED_AS_PER_NOM_PORT": (totNoms - totDiv),
        "ACCEPTED_AS_PER_NOM_PORT_PCT": ((totNoms - totDiv) / totNoms),
        "DIVERTED_TO_YANBU_PCT": (eastToWestDiv / eastTotNoms),
        "DEFERRED_CANCELLED_PCT": (totCanDef / totNoms),
        "ACCEPTED_AS_PER_NOM_DATE": (totNoms - num_delays - num_advances),
        "ACCEPTED_AS_PER_NOM_DATE_PCT": ((totNoms - num_delays - num_advances) / totNoms),
        "DELAYED_NOMINATIONS": num_delays,
        "DELAYED_NOMINATIONS_PCT": num_delays / totNoms,
        "ADVANCED_NOMINATIONS": num_advances,
        "ADVANCED_NOMINATIONS_PCT": num_advances / totNoms,
        "AVERAGE_ADVANCEMENT_DAYS": avg_advances,
        "SCENARIO_PLANNING_VERSION": parseInt($('#version').html()),
        "SCENARIO_PLANNING_SUB_VERSION": 1,//backend will not consider this value, required field
        "PLAN_CYCLE_CLICK_VERSION": 1,//backend will not consider this value, required field

    });

    var jsonObject = {
        TOLERANCE: toleranceData,
        DATA: mergeData,
        MONTHLY_NOMINATIONS: scenarioData.MONTHLY_NOMINATIONS,
        SUMMARY: scenarioSummary
    };
    return jsonObject;
}

$('#dragIcons').dxCheckBox({
    text: 'Show Drag Icons',
    value: true,
    onValueChanged(data) {
        gridData.option('rowDragging.showDragIcons', data.value);
    },
});

async function sendBatchRequest(url, data, actions = "") {
    const resultObject = {};
    const d = $.Deferred();
    var myToken = await sasgetCSRFToken();
    $.ajax(url, {
        type: "POST",
        data: data,
        contentType: 'application/json',
        beforeSend: function (xhr) {
            xhr.setRequestHeader('X-CSRF-Token', myToken);
            xhr.setRequestHeader('X-CSRF-Header', 'X-CSRF-Token');
            $('.overlay').show();
        },
    }).done((result) => {
        $('.overlay').hide();
        reloadData(result);
        d.resolve(result);
        resultObject.promiseResult = Promise.resolve(result);
        DevExpress.ui.notify({
            message: "Successfull",
            position: {
                my: "top",
                at: "top",
                of: "#gridContainer"
            },
            type: "success",
            displayTime: 2000
        });
    }).fail((xhr) => {
        d.reject(xhr.responseJSON ? xhr.responseJSON.Message : xhr.statusText);
        DevExpress.ui.notify({
            message: "Something Went Wrong",
            position: {
                my: "top",
                at: "top",
                of: "#gridContainer"
            },
            type: "error",
            displayTime: 2000
        });
    });
    resultObject.promise = d.promise();
    return resultObject;
}

async function sasgetCSRFToken() {
    const csrfURL = `https://cs-action.aramco.com/SASJobExecution/csrf`
    const csrfParameters = { method: "GET", credentials: "include" }
    const csrfRequest = await fetch(csrfURL, csrfParameters)
    const csrfToken = await csrfRequest.headers.get("X-CSRF-TOKEN")
    return csrfToken;
}

// Ospas Approval

$("#popup").dxPopup({
    visible: false,
    hideOnOutsideClick: true,
    title: 'Submit Scenario for OSPAS Approval',
    showTitle: true,
    onShown: function () {
        $("#popup-textarea-container").dxTextArea({
            height: 150,
        });
        $("#popup-submit-button").dxButton({
            text: "Submit Comment",
            onClick: function () {
                var url = "https://cs-action.aramco.com/SASJobExecution/?_program=%2FSTSP%20LPG%20Demand%20Forecasting%2FCodes%2FWeb%20Interface%2FAPI%20Jobs%2FExport%20Demand%20Allocation%20Scenario%20Planning%20Submit%20to%20OSPAS&PLANNING_MONTH=MAY2023";
                var textAreaValue = $("#popup-textarea-container").dxTextArea("instance").option("value");
                var jsonObject = {
                    "DATA": textAreaValue
                };
                var jsonData = JSON.stringify(jsonObject);
                sendBatchRequest(url, jsonData);
                var textAreaValue = "";
                $('#popup').dxPopup("instance").hide();
            }
        });
    }
});


//show comments
function showPopupComments() {
    $("#allComments").dxPopup({
        visible: false,
        hideOnOutsideClick: true,
        title: 'Comments',
        showTitle: true,
        contentTemplate: function (container) {
            var showCommentsData = function () {
                var tmp = null;
                $.ajax({
                    url: 'https://cs-action.aramco.com/SASJobExecution/?_program=%2FSTSP%20LPG%20Demand%20Forecasting%2FCodes%2FWeb%20Interface%2FAPI%20Jobs%2FExport%20Demand%20Allocation%20Scenario%20Planning%20Read%20Comments&PLANNING_MONTH=MAY2023',
                    dataType: "json",
                    async: false,
                    beforeSend: function (xhr) {
                        xhr.setRequestHeader('X-CSRF-TOKEN', 'Bearer sas_services');
                        $('.overlay').show();
                    },
                    success: function (data) {
                        $('.overlay').hide();
                        tmp = data;
                    }
                });
                return tmp;
            }();

            var gridData = $('<div id="showCommentsgrid">').dxDataGrid({
                dataSource: showCommentsData,
                showBorders: true,
                columns: [
                    {
                        dataField: 'COMMENTS',
                        caption: 'Comments',
                    },
                    {
                        dataField: 'CREATED_BY',
                        caption: 'Created By',
                    },
                    {
                        dataField: 'CREATED_DTTM',
                        caption: 'Created DTTM',
                    },

                ],
            });
            gridData.appendTo(container);
        },

    }).dxPopup('instance');
}
//scenario summary statistics comparision
// $("#scenarioSummary").dxButton({
//     text: "Scenario Summary Statistics Comparsion",
//     onClick: function () {
//         window.location.href = "https://cs-action.aramco.com/lpg_v1/scenario-summary-statistics-comparison.html";
//     }
// });


function getOnTimeAction(startDate, endDate) {
    if ((startDate == "" || startDate == null) && (endDate == "" || endDate == null)) {
        return "";
    }

    var timeDiff = Math.abs(startDate.getTime() - endDate.getTime());
    var diffDays = Math.ceil(timeDiff / (1000 * 3600 * 24));
    switch (diffDays) {
        case (diffDays === 0): {
            return "OnTime";
        }
        case (diffDays > 0): {
            return "Advanced";
        }
        case (diffDays > 0): {
            return "Delayed";
        }

    }
}
const viewBtnConfig = [
    {
        icon: 'contentlayout',
        alignment: 'grid',
        hint: 'Table View',
    },
    {
        icon: 'chart',
        alignment: 'chart',
        hint: 'Graph View',
    },
];


var viewBtns = $("#viewBtns").dxButtonGroup({
    items: viewBtnConfig,
    keyExpr: "alignment",
    stylingMode: "outlined",
    selectedItemKeys: ["grid"],
    onItemClick: (e) => {
        refreshBothGridData(eastData, westData);
        prepareChartData(eastData, westData);
        let { hint } = e.itemData;
        switch (hint) {
            case "Graph View":
                $("#tabpanel-container").hide();
                $("#tabChartContainer").show();
                break;
            case "Table View":
                $("#tabpanel-container").show();
                $("#tabChartContainer").hide();
                break;
            default:
                $("#tabpanel-container").show();
                $("#tabChartContainer").hide();
                break;
        }

    },
}).dxButtonGroup("instance");
var ospasVersionStatus = (scenarioData.TOLERANCE[0].SCENARIO_PLANNING_STATUS === 1) ? true : false;
var disabledbyStatus = (scenarioData.TOLERANCE[0].SCENARIO_PLANNING_STATUS === 2) ? true : false;

var groupActionButtons = [{ id: "idFetchLatestInventory", icon: 'fa fa-database', alignment: 'fetchInventory', onClick: fetchLatestInventory, hint: 'Fetch Latest Inventory and Avails' },
{ id: "idNominationSuggestion", icon: 'fa fa-magic', alignment: 'nomSuggest', onClick: nominationSuggestion, hint: 'Generate Nomination Suggestion' },
{ id: "revertLastSavedVersion", icon: 'fa fa-cogs', disabled: disabledbyStatus, onClick: revertToLastSaved, alignment: 'revertSaved', hint: 'Revert to Last Saved Version' },
{ id: "saveScenario", icon: 'fa fa-save', disabled: disabledbyStatus, onClick: saveScenarioData, alignment: 'saveScenario', hint: 'Save Scenario' },
{ id: "saveAsNewVersion", icon: 'fa fa-share-square-o', disabled: disabledbyStatus, alignment: 'saveNewVersion', onClick: saveNewVerionScenarioData, hint: 'Save Scenario as New Version' },
{ id: "showComments", icon: 'fa fa-comment', alignment: 'showComment', hint: 'Show Comments' },
// {id: "scenarioSummary", icon:'fa fa-paperclip', onClick: window.location.href = "https://cs-action.aramco.com/lpg_v1/scenario-summary-statistics-comparison.html"},
{ id: "scenarioSummary", icon: 'fa fa-list-alt', alignment: 'scenarioSummary', hint: 'Compare Summary Stats' },
{ id: "viewOspasVersion", disabled: ospasVersionStatus, icon: 'fa fa-eye', alignment: 'viewOSPASVersion', hint: 'View OSPAS Version' },
{ id: "ospasApproval", icon: 'fa fa-send', alignment: 'ospasApprove', disabled: disabledbyStatus, hint: 'Submit Scenario for OSPAS Approval' }];


$('#groupActionBtns').dxButtonGroup({
    items: groupActionButtons,
    keyExpr: 'alignment',
    stylingMode: 'outlined',
    selectedItemKeys: [],
    onItemClick: (e) => {
        if (e.itemData) {
            var itemId = e.itemData.id
            if (itemId === "idFetchLatestInventory") {
                fetchLatestInventory
            } else if (itemId === "idNominationSuggestion") {
                nominationSuggestion
            } else if (itemId === "revertLastSavedVersion") {
                revertToLastSaved
            } else if (itemId === "saveScenario") {
                saveScenarioData
            } else if (itemId === "saveAsNewVersion") {
                saveNewVerionScenarioData
            } else if (itemId === "showComments") {
                //we get all the comments data in var showCommentsData
                $(".overlay").show();
                showPopupComments();
                $("#allComments").dxPopup("instance").show();
                $(".overlay").hide();
            } else if (itemId === "scenarioSummary") {
                window.location.href = "https://cs-action.aramco.com/lpg_v1/scenario-summary-statistics-comparison.html";
            } else if (itemId === "viewOspasVersion") {
                window.location.href = "https://cs-action.aramco.com/lpg_v1/scenario-planning-ospas-version-ro.html";
            } else if (itemId === "ospasApproval") {
                $("#popup").dxPopup("instance").show();
            } else {
                $("#allComments").dxPopup("instance").hide();
                $("#popup").dxPopup("instance").hide();
            }
        }
        // $("#groupActionBtns .dxbutton").removeClass("dx-item-selected");
        // $(e.itemElement).addClass("dx-item-selected");
    },
});
