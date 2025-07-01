var response = {};
var isTesting = false;
var maxinventoryPerc = 100;
var cosmdGroupAccess = 1;
var ospasAccess = -1;
var user_nm = "";

var NG_SIMULATION_GET_DATA =
  "sas-dev.aramco.com.sa/SASJobExecution/?_program=%2FSTSP%20LPG%20Demand%20Forecasting%2FCodes%2FWeb%20Interface%2FAPI%20Jobs%2FOperating%20Month%20Inv%20Simulation%20NG%20-%20Read%20API";
var saveAdjustmentUrl = SIMULATION_SAVE_ADJUSTMENT;

$("#gridProjection").after(`<div id="toast"></div>`);
var toast = $("#toast")
  .dxToast({ displayTime: 5000, closeOnClick: true, position: "top center" })
  .dxToast("instance");
function showToast(type, message) {
  toast.option({ message, type });
  toast.show();
}

const tabs = [
  {
    id: 0,
    text: "EAST",
    inputs: "eastInputs",
  },
  {
    id: 1,
    text: "WEST",
    inputs: "westInputs",
  },
];

const baseurl = ROOT_URL;

let { year, futureMonthName, monthName, shortMonth, shortFutureMonth } =
  getActiveMonth();
let readMonth = shortMonth?.toUpperCase() + year;

function getActiveMonth() {
  let year = moment().format("YYYY");
  let monthName = moment().format("MMMM");
  let futureMonthName = moment().add(1, "month").format("MMMM");
  return {
    year,
    futureMonthName,
    monthName,
    shortMonth: moment().format("MMM"),
    shortFutureMonth: moment().add(1, "month").format("MMM"),
  };
}
function setHeaderDate() {
  var planningMonth = monthName + " " + year;
  $("#datepicker1").html(planningMonth);
}
const viewBtnConfig = [
  {
    icon: "contentlayout",
    alignment: "grid",
    hint: "Grid",
  },
  {
    icon: "chart",
    alignment: "chart",
    hint: "Chart",
  },
];
var isReciptUpdated = false;
var today = new Date();
function checkSameDay(d1, d2) {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}
function highlightFutureDate(e) {
  if (e.rowType == "data") {
    let { data } = e;
    let isSameDay = checkSameDay(data?.DATE, today) && data.ROW_COUNT == 1;
    if (isSameDay)
      e.rowElement.css({
        "border-top": "2px solid #CCC",
      });
  }
}

$(() => {
  $("#viewBtns").dxButtonGroup({
    items: viewBtnConfig,
    keyExpr: "alignment",
    stylingMode: "outlined",
    selectedItemKeys: ["grid"],
    onItemClick: (e) => {
      let { hint } = e.itemData;
      switch (hint) {
        case "Chart":
          $("#grid").hide();
          $("#chart").show();
          break;

        default:
          $("#grid").show();
          $("#chart").hide();
          break;
      }
    },
  });

  $("#westInputs").hide();
  const regionTabs = $("#region-tabs > .tabs-container")
    .dxTabs({
      dataSource: tabs,
      selectedIndex: 0,
      animationEnabled: true,
      swipeEnabled: true,
      onItemClick(e) {
        regionTabs.option("selectedIndex", e.itemData.id);
        if (e.itemData.text == "EAST") {
          $("#westInputs").hide();
          $("#eastInputs").show();
        } else {
          $("#eastInputs").hide();
          $("#westInputs").show();
        }

        handleFilter();
      },
    })
    .dxTabs("instance");

  $("#chart").hide();

  setHeaderDate();

  // format mapper
  function formatDateToNumber(dt) {
    return dt ? Number(dt?.trim().substr(0, 2)) : dt;
  }
  function mapCellTemplate(cellElement, cellInfo) {
    let isEditable = checkEditable(cellInfo, "cellTemplate");

    if (isEditable) cellElement.css({ background: COLORS.yellow });
    cellElement.text(cellInfo?.value ? Math.round(cellInfo?.value) : "");
  }

  function mapPercentTemplate(e, data) {
    let { value } = data;
    let { dataField } = data?.column;
    let isNg = dataField == dataFields.NG_CLOSING_INV_PERCENT;
    let regionValue = regionTabs.option("selectedItem");
    let minValue =
      regionConstants[regionValue?.inputs]["ng_min"].option("value");
    let maxValue =
      regionConstants[regionValue?.inputs]["ng_max"].option("value");
    let isAlert = value < minValue || value > maxValue;
    let actValue = Math.round(data?.value);
    var percentageValue = Math.min(actValue, 100);
    if (data?.value) {
      let txt = actValue ? actValue + "%" : null;
      e.html(`<div class="progress" style="position:relative; background: rgb(89 89 89 / 60%);"  >
      <div class="progress-bar" role="progressbar" style="width: ${percentageValue}%;
      background: ${isAlert ? COLORS.error : COLORS.progrss_color_proane};

       " aria-valuenow="25" aria-valuemin="0" aria-valuemax="100"> <span style="position:absolute; z-index:2"  >${txt} </span> </div>
    </div>`);
    }
    return e;
  }

  // Grid code
  getData();
  function getChartData(list) {
    let newData = list?.filter((obj) => {
      let { REGION, ROW_COUNT } = obj || {};
      const isValid =
        REGION == regionTabs.option("selectedItem")?.text && ROW_COUNT == 1;
      return isValid;
    });
    return newData;
  }

  function handleFilter() {
    let params = {
      Region: regionTabs.option("selectedItem")?.text,
    };

    let ADJUSTMENT = getChartData(adjustmentGrid.option("dataSource"));
    projectionGrid.filter(function (itemData) {
      let { REGION, ROW_COUNT } = itemData || {};
      let finder = REGION == params.Region;
      return finder;
    });
    adjustmentGrid.filter(function (itemData) {
      let { REGION } = itemData || {};
      let finder = REGION == params.Region;
      return finder;
    });

    // Graph
    ngChart.option("dataSource", ADJUSTMENT);
    maxinventoryPerc = Math.max(100, ADJUSTMENT.NG_CLOSING_INV_PERCENT);
    ngChart.option(`valueAxis[0].visualRange[0]`, [0, maxinventoryPerc]);
    ngChart.option(`valueAxis[0].visualRange[1]`, [0, maxinventoryPerc]);
    let inputs = params.Region == "EAST" ? eastInputs : westInputs;

    // update min-max values in chart
    updateConstLines(true, "ng", inputs.ng_min.option("value"));
    updateConstLines(false, "ng", inputs.ng_max.option("value"));
  }
  function setInputConstants(resp, i) {
    let key = i == 0 ? "eastInputs" : "westInputs";

    regionConstants?.[key].working_capacity_ng.option(
      "value",
      resp?.WORKING_CAPACITY?.[i].WORKING_CAPACITY_NG
    );

    regionConstants?.[key]?.adjust_capacity_ng.option(
      "value",
      resp?.ADJUSTED_CAPACITY?.[i].ADJUSTED_CAPACITY_NG
    );

    regionConstants?.[key]?.ng_min.option("value", resp?.MIN?.[i].MIN_NG);
    regionConstants?.[key]?.ng_max.option("value", resp?.MAX?.[i].MAX_NG);
  }

  function calcPercent({ obj, i, arr }, gridKey) {
    let newObj = { ...obj };
    let { OPENING_INV_NG, ROW_COUNT } = obj;
    if (ROW_COUNT == 2) return;

    let regionObj = regionTabs.option("selectedItem");
    let isEast = regionObj?.text == "EAST";

    let key = regionObj?.inputs;
    let wk_cap_ng =
      regionConstants?.[key]?.working_capacity_ng?.option("value");

    if (gridKey == "ADJUSTMENT" || gridKey == "ADJUSTMENT-updateGridPercent") {
      let DATE = new Date((obj?.NOMINATION_EFFECTIVE_DT).trim().substr(0, 9));
      let DAY = new Date(
        (obj?.NOMINATION_EFFECTIVE_DT).trim().substr(0, 9)
      ).getDate();
      let MONTH = new Date(
        (obj?.NOMINATION_EFFECTIVE_DT).trim().substr(0, 9)
      ).getMonth();
      let DAYMONTH = (obj?.NOMINATION_EFFECTIVE_DT).trim().substr(0, 5);
      let prevNonEmptyRowIndex = i - arr[i - 1]?.ROW_COUNT || 0;
      let isSameDay = checkSameDay(DATE, today);
      if (DATE < today && !isSameDay) {
        newObj.CLOSING_ADJ_INV_NG = obj?.CLOSING_INV_NG;

        newObj.NG_CLOSING_INV_PERCENT = (obj?.CLOSING_INV_NG / wk_cap_ng) * 100;
      } else {
        // calculate next empty row's lifting value
        let nextRow = arr?.[i + 1];
        let isNextRowEmpty = nextRow?.ROW_COUNT > 1;
        let liftingValueNg = isNextRowEmpty ? nextRow?.CUST_LIFTING_NG : 0;

        let { closingInvPercent, adjInventory } = calcInventoryBykey(
          {
            CLOSING_INV: obj?.CLOSING_INV_NG,
            TERMINAL_RECEIPT: obj?.TERMINAL_RECEIPT_NG,
            CUST_LIFTING: obj?.CUST_LIFTING_NG,
            ACT_TERM_RECEIPT: obj?.ACT_TERM_RECEIPT_NG,
            ACT_CUST_LIFTING: obj?.ACT_CUST_LIFTING_NG,
            ROW_ORDER: obj?.ROW_ORDER,
            ROW_COUNT: obj?.ROW_COUNT,
            DAY,
            MONTH,
            DATE,
            DAYMONTH,
            LIFTING_VALUE: liftingValueNg,
            PREV_CLOSING_ADJ_INV:
              arr[prevNonEmptyRowIndex]?.CLOSING_ADJ_INV_NG || 0,
            preNonEmptyRowData: arr[prevNonEmptyRowIndex],
          },
          "CUST_LIFTING_NG"
        );

        if (gridKey != "ADJUSTMENT-updateGridPercent") {
          newObj.CLOSING_ADJ_INV_NG = adjInventory;
        }

        newObj.NG_CLOSING_INV_PERCENT = closingInvPercent; // ng
      }
    }

    if (gridKey != "ADJUSTMENT") {
      newObj.NG_CLOSING_INV_PERCENT = (obj?.CLOSING_INV_NG / wk_cap_ng) * 100;
    }

    newObj.NG_CLOSING_INV_PERCENT_ACTUAL =
      (obj?.CLOSING_INV_NG / wk_cap_ng) * 100;
    return newObj;
  }

  function mapResp(list, key) {
    if (list?.length) {
      let regionObj = regionTabs.option("selectedItem");

      list = list?.map((obj, i, arr) => {
        let { NOMINATION_EFFECTIVE_DT } = obj;

        // if row is greater than 2 (1 for west ),opening inventory = prev row opening inv.
        let newObj = { ...obj };

        if (
          key != "ADJUSTMENT-updateGridPercent" ||
          obj?.REGION == regionObj?.text
        ) {
          // skip calculation if region is not active region tab
          var percentMapped = calcPercent({ obj, i, arr }, key);
          newObj = { ...newObj, ...percentMapped };
        }
        newObj.DAY = new Date(
          NOMINATION_EFFECTIVE_DT.trim().substr(0, 9)
        ).getDate();
        newObj.MONTH = new Date(
          NOMINATION_EFFECTIVE_DT.trim().substr(0, 9)
        ).getMonth();
        newObj.DATE = new Date(NOMINATION_EFFECTIVE_DT.trim().substr(0, 9));
        newObj.DAYMONTH = NOMINATION_EFFECTIVE_DT.trim().substr(0, 5);

        return (arr[i] = newObj);
      });
    }
    return list;
  }
  function handleUserGroup({ USER_NM }) {
    user_nm = USER_NM[0];
    getUserDetails(user_nm);
    if (cosmdGroupAccess != -1 && !isTesting) {
      reset_Stock();
    }
  }
  function handleResp(resp) {
    let { WORKING_CAPACITY, MIN, MAX, USER_NM } = resp;
    let ACTUAL_FROM_STOCK_PROJ = resp?.ACTUAL_FROM_STOCK_PROJ || [];
    let ADJUSTMENT = resp?.ADJUSTMENT || [];

    // input constants values;
    setInputConstants(resp, 0);
    setInputConstants(resp, 1);

    ADJUSTMENT = mapResp(ADJUSTMENT, "ADJUSTMENT");
    ACTUAL_FROM_STOCK_PROJ = mapResp(
      ACTUAL_FROM_STOCK_PROJ,
      "ACTUAL_FROM_STOCK_PROJ"
    );

    projectionGrid.option("dataSource", ACTUAL_FROM_STOCK_PROJ);
    adjustmentGrid.option("dataSource", ADJUSTMENT);

    let lastUpdatedTime =
      resp?.["_LAST_UPDATED_"][0]?.OPE_MONTH_INV_SIM_UPDATED_DTTM;
    lastUpdatedTime && $("#lastSaveDate").text(lastUpdatedTime);

    handleFilter();
    handleUserGroup({ USER_NM });
  }
  async function getData() {
    try {
      let url = NG_SIMULATION_GET_DATA;
      let resp = await sendRequest(`${url}`, "GET");
      response = resp;
      handleResp(resp);
    } catch (err) {
      $(".overlay").hide();
      isTesting && handleResp(response);
    }
  }

  var COLORS = {
    yellow: "#fff2cc",
    g_yellow: "#ffc000",
    g_red: "red",
    g_blue: "#0673c2",
    g_green: "#7ab354",
    error: "#d9534f",
    warn: "#fbe5d6",
    lightBlue: "#c6f0ff",
    progrss_color_proane: "#1C7D7F",
    grey: "rgb(236 236 236)",
  };
  var dataFields = {
    NG_CLOSING_INV_PERCENT: "NG_CLOSING_INV_PERCENT",
  };
  var projectionGrid = $("#gridProjection")
    .dxDataGrid({
      rowAlternationEnabled: true,
      keyExpr: ["ROW_COUNT", "ROW_ORDER"],
      showBorders: true,
      scrolling: {
        useNative: false,
        scrollByContent: true,
        scrollByThumb: true,
        showScrollbar: "onHover", // or "onScroll" | "always" | "never"
      },
      onContentReady(e) {
        let activeScrollContainer = e.component.getScrollable();
        setTimeout(() => {
          activeScrollContainer.on("scroll", () => {
            let activeTop = activeScrollContainer.scrollTop();
            let targetTop = $("#gridAdjustment")
              .dxDataGrid("instance")
              .getScrollable()
              .scrollTop();
            if (activeTop !== targetTop) {
              $("#gridAdjustment")
                .dxDataGrid("instance")
                .getScrollable()
                .scrollTo({
                  y: activeScrollContainer.scrollTop(),
                });
            }
          });
        }, 1000);
      },
      editing: {
        mode: "cell",
        allowUpdating: false,
      },
      paging: { enabled: false },
      onRowPrepared: function (e) {
        // Check if the row index is divisible by 2 (every two rows)
        highlightFutureDate(e);
      },

      onCellPrepared: function (e) {
        if (e.rowType == "header") {
          e.cellElement.css("text-align", "center");
          e.cellElement.css("color", "#fff");
          e.cellElement.css("background-color", "#00A3E0");
        }
        if (e.rowType == "data") {
          e.cellElement.css("text-align", "center");
        }
      },
      columns: [
        {
          dataField: "NOMINATION_EFFECTIVE_DT",
          caption: "Date",
          alignment: "center",
          // width: '4em',
          customizeText: (options) => {
            let dt = options.valueText;
            dt?.length && (dt = dt?.trim().substr(0, 5));
            return dt;
          },
        },
        {
          caption: "Avails",
          dataField: "TERMINAL_RECEIPT_NG",
          alignment: "center",
          format: { type: "fixedPoint", precision: 0 },
        },
        {
          caption: "Liftings (MB)",
          dataField: "CUST_LIFTING_NG",
          alignment: "center",
          format: { type: "fixedPoint", precision: 0 },
        },
        {
          dataField: "SHIP_NAME",
          caption: "Ship",
          alignment: "center",
        },
        {
          dataField: "NOMINATION_NO",
          caption: "Nom",
          alignment: "center",
        },
        {
          caption: "Inventory",
          dataField: "CLOSING_INV_NG",
          allowReordering: false,
          alignment: "center",
          format: { type: "fixedPoint", precision: 0 },
        },
        {
          caption: "%",
          dataField: "NG_CLOSING_INV_PERCENT",
          allowReordering: false,
          alignment: "center",
          cellTemplate: mapPercentTemplate,
        },
      ],
    })
    .dxDataGrid("instance");

  var inputProps = {
    working_capacity_ng: "",
    adjust_capacity_ng: "",
    ng_min: "",
    ng_max: "",
  };
  var regionConstants = {
    eastInputs: { ...inputProps },
    westInputs: { ...inputProps },
  };
  var { eastInputs, westInputs } = regionConstants;

  const inputConfig = {
    height: 24,
    width: "4em",
  };

  function updateGridPercent() {
    let ADJUSTMENT = adjustmentGrid.option("dataSource");
    if (ADJUSTMENT?.length) {
      let newAdj = mapResp(ADJUSTMENT, "ADJUSTMENT-updateGridPercent");
      adjustmentGrid.option("dataSource", newAdj);
      let chartData = getChartData(newAdj);
      ngChart.option("dataSource", chartData);

      maxinventoryPerc = Math.max(100, chartData.NG_CLOSING_INV_PERCENT);
      ngChart.option(`valueAxis[0].visualRange[0]`, [0, maxinventoryPerc]);

      ngChart.option(`valueAxis[0].visualRange[1]`, [0, maxinventoryPerc]);

      let ACTUAL_FROM_STOCK_PROJ = projectionGrid.option("dataSource");
      let newProj = mapResp(ACTUAL_FROM_STOCK_PROJ, "ACTUAL_FROM_STOCK_PROJ");
      projectionGrid.option("dataSource", newProj);
    }
  }

  for (const key in regionConstants) {
    if (Object.hasOwnProperty.call(regionConstants, key)) {
      const inputs = regionConstants[key];

      inputs.working_capacity_ng = $(`#${key} #working_capacity_ng`)
        .dxNumberBox({
          ...inputConfig,
          disabled: true,
        })
        .dxNumberBox("instance");
      function adjust_onchange(data, prefix) {
        let { WORKING_CAPACITY } = response;
        let region = regionTabs.option("selectedItem")?.text;
        let wcp =
          WORKING_CAPACITY?.[region == "EAST" ? 0 : 1]?.[
          `WORKING_CAPACITY_${prefix}`
          ];
        inputs[`working_capacity_${prefix?.toLowerCase()}`].option(
          "value",
          wcp + +data?.value
        );
        updateGridPercent();
      }

      inputs.adjust_capacity_ng = $(`#${key} #adjust_capacity_ng`)
        .dxNumberBox({
          ...inputConfig,
          onValueChanged: (data) => adjust_onchange(data, "NG"),
        })
        .dxNumberBox("instance");

      inputs.ng_min = $(`#${key} #ng_min`)
        .dxNumberBox({
          ...inputConfig,
          onValueChanged(data) {
            updateConstLines(true, "ng", data?.value);
            projectionGrid.refresh(); // update grid, highlight min-max value.
            adjustmentGrid.refresh(); // update grid, highlight min-max value.
          },
        })
        .dxNumberBox("instance");
      inputs.ng_max = $(`#${key} #ng_max`)
        .dxNumberBox({
          ...inputConfig,
          onValueChanged(data) {
            updateConstLines(false, "ng", data?.value);
            projectionGrid.refresh(); // update grid, highlight min-max value.
            adjustmentGrid.refresh(); // update grid, highlight min-max value.
          },
        })
        .dxNumberBox("instance");
    }
  }

  // min-max value updater in chart
  function updateConstLines(isMin, chart, value) {
    function updateByChart(i) {
      ngChart.option(`valueAxis[0].constantLines[${i}].value`, value);
      ngChart.option(`valueAxis[0].visualRange[${i}]`, [0, maxinventoryPerc]);
    }
    if (isMin) {
      updateByChart(1);
    } else {
      updateByChart(0);
    }
  }
  // common field in both chart
  function getValueAxis(label) {
    let name = "NgGraph";
    return [
      {
        name,
        position: "left",
        visualRange: [0, maxinventoryPerc],
        visualRangeUpdateMode: "keep",
        title: "",
        constantLines: [
          {
            value: 80,
            width: 2,
            color: "red",
            dashStyle: "solid",
            label: {
              visible: true,
              text: "Safe Max",
            },
          },
          {
            value: 20,
            width: 2,
            color: "red",
            dashStyle: "solid",
            label: {
              visible: true,
              text: "Safe Min",
            },
          },
        ],
      },
    ];
  }

  setTimeout(function () {
    ngChart.render();
  }, 100);

  function calcInventoryBykey(config) {
    let {
      CLOSING_INV,
      TERMINAL_RECEIPT,
      CUST_LIFTING,
      LIFTING_VALUE,
      PREV_CLOSING_ADJ_INV,
      DATE,
      preNonEmptyRowData,
    } = config;
    let prefix = "NG";
    let isSameDay = checkSameDay(DATE, today);
    let isNextDate = DATE >= today || isSameDay;
    let prevClosingInv = preNonEmptyRowData?.[`CLOSING_INV_${prefix}`] || 0;
    if (isNextDate) {
      let RHSClosinginv = PREV_CLOSING_ADJ_INV || 0;
      let LhsDiff = CLOSING_INV - prevClosingInv;
      CLOSING_INV = (RHSClosinginv || 0) + LhsDiff;
    }
    let adjInventory =
      +(CLOSING_INV || 0) +
      +(TERMINAL_RECEIPT || 0) -
      +(CUST_LIFTING || 0) -
      (LIFTING_VALUE || 0);
    const inputs = regionTabs.option("selectedItem")?.inputs;
    let wk_cap_ng =
      regionConstants[inputs][
        `working_capacity_${prefix.toLowerCase()}`
      ].option("value");
    let closingInvPercent = (+adjInventory / wk_cap_ng) * 100;

    return {
      adjInventory: adjInventory || null,
      closingInvPercent: Math.round(closingInvPercent) || null,
    };
  }
  function checkEditable(e) {
    // let DATE = new Date((dt).trim().substr(0, 9));
    let { ROW_COUNT, NOMINATION_EFFECTIVE_DT } = e?.row?.data || {};
    let dt = NOMINATION_EFFECTIVE_DT;
    if (!NOMINATION_EFFECTIVE_DT) return false;
    let DATE = new Date(NOMINATION_EFFECTIVE_DT.trim().substr(0, 9));
    let dataField = e?.column?.dataField;
    let isEditable = false;
    // enable editing for date greater than today
    if (dt) {
      dt = formatDateToNumber(dt);
      let today = new Date();
      let isEmptyRecipt = ROW_COUNT == 2 && dataField == "TERMINAL_RECEIPT_NG";
      let isSameDay = checkSameDay(DATE, today);
      isEditable = !isEmptyRecipt && (DATE > today || isSameDay);
    }
    return isEditable;
  }
  var adjustmentGrid = $("#gridAdjustment")
    .dxDataGrid({
      rowAlternationEnabled: true,
      keyExpr: ["ROW_COUNT", "ROW_ORDER"],
      showBorders: true,

      onContentReady(e) {
        // handle simultanious scroll of both the tables
        let activeScrollContainer = e.component.getScrollable();
        setTimeout(() => {
          activeScrollContainer.on("scroll", () => {
            let activeTop = activeScrollContainer.scrollTop();
            let targetTop = $("#gridProjection")
              .dxDataGrid("instance")
              .getScrollable();

            if (activeTop != targetTop) {
              $("#gridProjection")
                .dxDataGrid("instance")
                .getScrollable()
                .scrollTo({
                  y: activeScrollContainer.scrollTop(),
                });
            }
          });
        }, 1000);
      },
      onCellPrepared: function (e) {
        if (e.rowType == "header") {
          e.cellElement.css("text-align", "center");
          e.cellElement.css("color", "#fff");
          e.cellElement.css("background-color", "#00A3E0");
        }
      },

      editing: {
        mode: "cell",
        allowUpdating: (e) => checkEditable(e, "allowUpdate"),
      },
      scrolling: {
        useNative: false,
        scrollByContent: true,
        scrollByThumb: true,
        showScrollbar: "onHover", // or "onScroll" | "always" | "never"
      },
      paging: { enabled: false },
      onOptionChanged: function (e) {
        let isNgUpdate =
          e.value?.[0]?.data?.hasOwnProperty("CLOSING_ADJ_INV_NG") &&
          e.value?.[0]?.data?.hasOwnProperty("NG_CLOSING_INV_PERCENT");

        let prefix = "NG";
        // detect that TERMINAL_RECEIPT_ / Avail value is updated
        isReciptUpdated =
          isReciptUpdated ||
          e.value?.[0]?.data?.hasOwnProperty(`TERMINAL_RECEIPT_NG`);

        if (isNgUpdate) {
          let regionObj = regionTabs.option("selectedItem");
          let isEast = regionObj?.text == "EAST";
          let { data, key } = e.value?.[0];
          let { ROW_ORDER } = key;
          let adjustSource = e.component.option("dataSource");
          let index = adjustSource.findIndex(
            (obj) => obj?.ROW_ORDER == ROW_ORDER
          );
          adjustSource[index][`CLOSING_ADJ_INV_${prefix}`] =
            data[`CLOSING_ADJ_INV_${prefix}`];
          adjustSource[index][`${prefix}_CLOSING_INV_PERCENT`] =
            data[`${prefix}_CLOSING_INV_PERCENT`];
          let updatedValue = adjustSource[index][`TERMINAL_RECEIPT_${prefix}`];
          for (let i = index + 1; i < adjustSource.length; i++) {
            const item = adjustSource[i];
            if (item?.ROW_COUNT !== 2 && item?.REGION == regionObj?.text) {
              let LIFTING_VALUE = isEast
                ? i + 1 < adjustSource.length
                  ? adjustSource[i + 1][`CUST_LIFTING_${prefix}`]
                  : 0
                : 0; //empty row lift value
              let { DATE, DAYMONTH, MONTH, DAY } = item;
              let preNonEmptyRowData =
                adjustSource[i - adjustSource[i - 1]?.ROW_COUNT];
              let { adjInventory, closingInvPercent } = calcInventoryBykey(
                {
                  CLOSING_INV: item[`CLOSING_INV_${prefix}`],
                  TERMINAL_RECEIPT: updatedValue,
                  ACT_TERM_RECEIPT: item[`ACT_TERM_RECEIPT_${prefix}`],
                  ACT_CUST_LIFTING: item[`ACT_CUST_LIFTING_${prefix}`],
                  PREV_CLOSING_ADJ_INV:
                    preNonEmptyRowData[`CLOSING_ADJ_INV_${prefix}`],
                  preNonEmptyRowData,
                  CUST_LIFTING: item[`CUST_LIFTING_${prefix}`],
                  LIFTING_VALUE,
                  DATE,
                  DAYMONTH,
                  MONTH,
                  DAY,
                },
                `onOptionChanged-${prefix}`
              );

              adjustSource[i][`CLOSING_ADJ_INV_${prefix}`] = adjInventory;
              adjustSource[i][`${prefix}_CLOSING_INV_PERCENT`] =
                closingInvPercent;

              // Fill empty values
              adjustSource[i][`TERMINAL_RECEIPT_${prefix}`] = updatedValue;
              // if(isReciptUpdated) // later user
            }
          }
          isReciptUpdated = false;
          e.component.option("dataSource", adjustSource);

          // chart sync with grid
          let chartData = getChartData(adjustSource);
          maxinventoryPerc = Math.max(100, chartData.NG_CLOSING_INV_PERCENT);
          ngChart.option(`valueAxis[0].visualRange[0]`, [0, maxinventoryPerc]);
          ngChart.option(`valueAxis[0].visualRange[1]`, [0, maxinventoryPerc]);
          ngChart.option("dataSource", chartData);
        }
      },
      onRowUpdated: async function (e) {
        // update graph when grid data updated
        let { ROW_ORDER, ROW_COUNT, DATE, DAY, MONTH, DAYMONTH, REGION } =
          e?.data;
        const editColumnName = e.component.option("editing.editColumnName");
        let regionObj = regionTabs.option("selectedItem");
        let isEast = regionObj?.text == "EAST";

        let isInventoryCalculation = [
          "CUST_LIFTING_NG",
          "TERMINAL_RECEIPT_NG",
        ].includes(editColumnName);

        if (isInventoryCalculation) {
          let prefix = "NG";
          let AdjSource = adjustmentGrid.option("dataSource");
          let preNonEmptyRowDataObj = AdjSource.findLast(
            (element) =>
              element?.ROW_ORDER < ROW_ORDER &&
              element?.ROW_COUNT == 1 &&
              element?.REGION == REGION
          );
          let prevNonEmptyKey = {
            ROW_ORDER: preNonEmptyRowDataObj?.ROW_ORDER,
            ROW_COUNT: preNonEmptyRowDataObj?.ROW_COUNT,
          };
          let preNonEmptyRowData = await e.component.byKey(prevNonEmptyKey);

          let prevRowData = AdjSource.findLast(
            (element) =>
              element?.ROW_ORDER < ROW_ORDER && element?.REGION == REGION
          );
          let prevKey = {
            ROW_ORDER: prevRowData?.ROW_ORDER,
            ROW_COUNT: prevRowData?.ROW_COUNT,
          };
          let activeKey = { ROW_ORDER, ROW_COUNT };
          let isEmptyRow = ROW_COUNT == 2;
          let prevIndex = e.component.getRowIndexByKey(prevKey);
          let activeIndex = e.component.getRowIndexByKey(activeKey);

          let calcObj = e?.data;
          if (isEmptyRow) {
            calcObj = await e.component.byKey(prevKey);
          }
          let invPayload = {
            CLOSING_INV: calcObj?.[`CLOSING_INV_${prefix}`],
            TERMINAL_RECEIPT: calcObj?.[`TERMINAL_RECEIPT_${prefix}`],
            ACT_TERM_RECEIPT: calcObj?.[`ACT_TERM_RECEIPT_${prefix}`],
            ACT_CUST_LIFTING: calcObj?.[`ACT_CUST_LIFTING_${prefix}`],
            PREV_CLOSING_ADJ_INV:
              preNonEmptyRowData?.[`CLOSING_ADJ_INV_${prefix}`],
            preNonEmptyRowData,
            CUST_LIFTING: calcObj?.[`CUST_LIFTING_${prefix}`],
            DAY,
            MONTH,
            DATE,
            DAYMONTH,
            LIFTING_VALUE: 0,
          };

          if (isEmptyRow) {
            invPayload = {
              ...invPayload,
              LIFTING_VALUE: e?.data?.[`CUST_LIFTING_${prefix}`],
            };
          }

          let { adjInventory, closingInvPercent } = calcInventoryBykey(
            invPayload,
            `CUST_LIFTING_${prefix}_EMPTY`
          );

          let cellIndex = isEmptyRow ? prevIndex : activeIndex;

          e.component.cellValue(
            cellIndex,
            `CLOSING_ADJ_INV_${prefix}`,
            adjInventory
          );
          e.component.cellValue(
            cellIndex,
            `${prefix}_CLOSING_INV_PERCENT`,
            closingInvPercent
          );
          getValueAxis("ng");
        }
      },
      onRowPrepared: function (e) {
        // Check if the row index is divisible by 2 (every two rows)
        highlightFutureDate(e);
      },
      onEditorPreparing: function (e) {
        const { dataField } = e || {};
        const { ROW_COUNT } = e?.row?.data || {};
        if (dataField) {
          let isEmptyRecipt =
            dataField == "TERMINAL_RECEIPT_NG" && ROW_COUNT == 2;
          if (dataField === "OPENING_INV_NG" || isEmptyRecipt) {
            e.editorOptions.disabled = true;
          }
        }
      },
      columns: [
        {
          caption: "Avails",
          dataField: "TERMINAL_RECEIPT_NG",
          alignment: "center",
          cellTemplate: mapCellTemplate,
          format: { type: "fixedPoint", precision: 0 },
        },
        {
          caption: "Liftings (MB)",
          dataField: "CUST_LIFTING_NG",
          alignment: "center",
          cellTemplate: mapCellTemplate,
          format: { type: "fixedPoint", precision: 0 },
        },
        {
          dataField: "SHIP_NAME",
          caption: "Ship",
          alignment: "center",
          allowEditing: false,
        },
        {
          dataField: "NOMINATION_NO",
          caption: "Nom",
          alignment: "center",
          allowEditing: false,
        },
        {
          caption: "Inventory",
          dataField: "CLOSING_ADJ_INV_NG",
          allowEditing: false,
          allowReordering: false,
          alignment: "center",
          format: { type: "fixedPoint", precision: 0 },
          calculateDisplayValue: function (rowData) {
            let { CLOSING_INV_NG, CLOSING_ADJ_INV_NG } = rowData;
            return CLOSING_ADJ_INV_NG || CLOSING_INV_NG;
          },
        },
        {
          caption: "%",
          dataField: "NG_CLOSING_INV_PERCENT",
          allowReordering: false,
          alignment: "center",
          cellTemplate: mapPercentTemplate,
          allowEditing: false,
        },
      ],
    })
    .dxDataGrid("instance");

  function reset_Stock() {
    let dataSource = adjustmentGrid.option("dataSource");
    let stockDataSource = projectionGrid.option("dataSource");
    dataSource = dataSource?.map((obj) => {
      let stockRow = stockDataSource.find(
        (stockObj) => stockObj?.ROW_ORDER == obj?.ROW_ORDER
      );

      return {
        ...obj,
        TERMINAL_RECEIPT_NG: null,
        CUST_LIFTING_NG: null,
        CLOSING_ADJ_INV_NG: stockRow?.CLOSING_INV_NG,
        NG_CLOSING_INV_PERCENT: stockRow?.NG_CLOSING_INV_PERCENT,
        FLAG: "0",
      };
    });

    adjustmentGrid.option("dataSource", dataSource);

    // reset adjust capasity
    var { eastInputs, westInputs } = regionConstants;
    eastInputs?.adjust_capacity_ng.option("value", 0);
    westInputs?.adjust_capacity_ng.option("value", 0);
  }

  var ngChart = $("#ngChart")
    .dxChart({
      palette: "Harmony Light",
      size: {
        width: "100%",
      },
      title: {
        text: "Ng Closing Inventory %",
        font: {
          color: COLORS.g_green,
          size: 18,
          weight: 600,
        },
      },
      valueAxis: getValueAxis("ng"),
      commonSeriesSettings: {
        argumentField: "DAYMONTH",
        point: {
          visible: false,
        },
      },
      series: [
        {
          type: "line",
          valueField: "NG_CLOSING_INV_PERCENT",
          axis: "NgGraph",
          name: "Adjusted Inventory",
          color: COLORS.g_yellow,
          hoverMode: "allSeriesPoints",
        },
        {
          type: "line",
          valueField: "NG_CLOSING_INV_PERCENT_ACTUAL",
          axis: "NgGraph",
          name: "Actual Inventory",
          color: COLORS.g_green,
          hoverMode: "includePoints",
        },
      ],
      tooltip: {
        enabled: true,
        location: "edge",
        customizeTooltip: function (arg) {
          return {
            text:
              "Day: " +
              arg.argument +
              "<br/>" +
              arg.seriesName +
              ": " +
              Math.round(arg.valueText),
          };
        },
      },
      argumentAxis: {
        tickInterval: 1,
      },
      legend: {
        verticalAlignment: "bottom",
        horizontalAlignment: "center",
      },
    })
    .dxChart("instance");
  const actionBtnConfig = [
    {
      icon: "import",
      alignment: "Reset_Stock",
      hint: "Reset to as per Stock Projection",
      onClick: (e) => reset_Stock(),
    },
    {
      icon: "fa fa-save",
      alignment: "Save",
      hint: "Save Adjustment",
      onClick: async (e) => {
        DevExpress.ui.dialog
          .confirm(
            "Are you sure you want data to Save Adjustment?",
            "Confirmation"
          )
          .done(async function (dialogResult) {
            if (dialogResult) {
              let dataSource = adjustmentGrid.option("dataSource");
              let DATA = {
                WORKING_CAPACITY: [
                  {
                    REGION: "EAST",
                    WORKING_CAPACITY_NG:
                      eastInputs?.working_capacity_ng?.option("value"),
                  },
                  {
                    REGION: "WEST",
                    WORKING_CAPACITY_NG:
                      westInputs?.working_capacity_ng?.option("value"),
                  },
                ],
                ADJUSTED_CAPACITY: [
                  {
                    REGION: "EAST",
                    ADJUSTED_CAPACITY_NG:
                      eastInputs?.adjust_capacity_ng?.option("value"),
                  },
                  {
                    REGION: "WEST",
                    ADJUSTED_CAPACITY_NG:
                      westInputs?.adjust_capacity_ng?.option("value"),
                  },
                ],
                MIN: [
                  {
                    REGION: "EAST",

                    MIN_NG: eastInputs?.ng_min?.option("value"),
                  },
                  {
                    REGION: "WEST",

                    MIN_NG: westInputs?.ng_min?.option("value"),
                  },
                ],
                MAX: [
                  {
                    REGION: "EAST",

                    MAX_NG: eastInputs?.ng_max?.option("value"),
                  },
                  {
                    REGION: "WEST",

                    MAX_NG: westInputs?.ng_max?.option("value"),
                  },
                ],
                ADJUSTMENT: dataSource,
              };

              let finalJson = JSON.stringify({ DATA });
              let resp = await sendRequest(
                saveAdjustmentUrl,
                (method = "POST"),
                finalJson
              );
              resp?.Message == "0"
                ? showToast("success", "Data saved successfully")
                : showToast("error", "Failed to save data");

              let lastUpdatedTime = resp?._LAST_UPDATED_;
              lastUpdatedTime && $("#lastSaveDate").text(lastUpdatedTime);
            }
          });
      },
    },
  ];

  $("#actionBtns").dxButtonGroup({
    items: actionBtnConfig,
    keyExpr: "alignment",
    stylingMode: "outlined",
    selectedItemKeys: ["grid"],
  });

  async function sendRequest(url, method, data) {
    const d = $.Deferred();

    if (data === undefined) {
      data = "";
    }
    var myToken = await sasgetCSRFToken();

    $.ajax(url, {
      method,
      data,
      // xhrFields: { withCredentials: false },
      contentType: "application/json",
      cache: false,
      // async: false,
      beforeSend: function (xhr) {
        xhr.setRequestHeader("X-CSRF-Token", myToken);
        xhr.setRequestHeader("X-CSRF-Header", "X-CSRF-Token");
        $(".overlay").show();
      },
      complete: (xhr, status) => {
        $(".overlay").hide();
      },
    })
      .done((result) => {
        d.resolve(method === "POST" ? result : result);
      })
      .fail((xhr) => {
        d.reject(xhr.responseJSON ? xhr.responseJSON.Message : xhr.statusText);
      });
    return d.promise();
  }

  async function sasgetCSRFToken() {
    const csrfURL = CSRF_URL;
    const csrfParameters = { method: "GET", credentials: "include" };
    const csrfRequest = await fetch(csrfURL, csrfParameters);
    const csrfToken = await csrfRequest.headers.get("X-CSRF-TOKEN");
    return csrfToken;
  }
});
