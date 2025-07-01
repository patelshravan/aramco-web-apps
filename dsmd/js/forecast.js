//   <script type="text/javascript">
var url = "https://cs-action.aramco.com";

$(document).ready(function () {
  // setHeaderDate()
  var selectedDays = [];
  var selectedDate = [];
  var calendarResponse = null;
  var chartResponse = null;

  var readUrl =
    "https://cs-action.aramco.com/SASJobExecution/?_program=%2FSTSP%20LPG%20Demand%20Forecasting%2FCodes%2FWeb%20Interface%2FAPI%20Jobs%2FMark%20Unavailable%20Slots%20in%20West%20Term-Read";
  // ajax function get results

  //   $.ajax({
  //     url: calendar,
  //     dataType: "json",
  //     beforeSend: function (xhr) {
  //       xhr.setRequestHeader("X-CSRF-TOKEN", "Bearer sas_services");
  //       $(".overlay").show();
  //     },
  //     data: {},
  //     success: function (data) {
  //       $(".overlay").hide();
  //       calendarResponse = data;
  //       setChart(data);
  //       var selectedDays = [];
  //       // console.log("data", data);

  //       $.each(data, function (i, obj) {
  //         selectedDays.push({
  //           planning_month: obj.PLANNING_MONTH,
  //           terminal_cd: obj.TERMINSL_CD,
  //           terminal_nm: obj.TERMINSL_NM,
  //           day: obj.DAY,
  //           available_flag: obj.AVAILABLE_FLG,
  //           modified_dttm: obj.MODIFIED_DTTM,
  //           modified_by: obj.MODIFIED_BY,
  //         });
  //       });
  //       initializeFullCalendar(selectedDays);
  //     },
  //   });

  var selectedDays = [];
  $.each(calendar, function (i, obj) {
    selectedDays.push({
      planning_month: obj.PLANNING_MONTH,
      terminal_cd: obj.TERMINSL_CD,
      terminal_nm: obj.TERMINSL_NM,
      day: obj.DAY,
      available_flag: obj.AVAILABLE_FLG,
      modified_dttm: obj.MODIFIED_DTTM,
      modified_by: obj.MODIFIED_BY,
    });
  });
  initializeFullCalendar(selectedDays);

  //Start function to insitalize calendar
  function initializeFullCalendar(selectedDays) {
    // console.log(selectedDays);
    $("table").addClass(".table");
    var cal = $("#calendar");
    var calendarOptions = {
      header: false,
      // aspectRatio:3,
      contentHeight: 400,
      // defaultDate: moment("2023-02-21"),
      defaultDate: moment().add(1, "months"),
      defaultView: "month",
      fixedWeekCount: "variable",
      showNonCurrentDates: false,
      dayRender: function (date, cell) {
        var theDate = date.format("YYYY-MM-DD");

        // Check if the current date matches any date in the JSON data
        var selectedDate = selectedDays.find(function (day) {
          return day.day === theDate;
        });

        // If a match is found, set the checkbox as checked
        if (selectedDate && selectedDate.available_flag === "Y") {
          cell.append(
            '<input id="' +
              selectedDate?.day +
              '" data-flag="' +
              selectedDate.available_flag +
              '" type="checkbox" class="checkbox fc-checkbox-day" checked/>'
          );
        } else {
          var date_n = cell.closest("td").attr("data-date");
          if (date_n === undefined || date_n < 6) {
            var row = cell.closest("tr");

            // Check if all the cells in the row have the 'fc-disabled-day' class
            var allCellsDisabled = true;
            row.find("td").each(function () {
              if (!$(this).hasClass("fc-disabled-day")) {
                allCellsDisabled = false;
                return false; // Exit the loop if any cell does not have the class
              }
            });

            // Hide the row if all cells have the 'fc-disabled-day' class
            if (allCellsDisabled) {
              row.css("display", "none");
              row
                .closest(".fc-row.fc-week.fc-widget-content")
                .css("display", "none");
            }
          }

          cell.append(
            '<input id="' +
              date_n +
              '" data-flag="N" type="checkbox" class="checkbox fc-checkbox-day"' +
              (date_n === undefined || date_n < 6 ? " disabled" : "") +
              "/>"
          );
        }
      },
    };
    cal.fullCalendar(calendarOptions);
  }
  //End function to insitalize calendar

  $("#slotCalendar").click(function () {
    var checkboxes = new Array();
    var $checked = $('input[type="checkbox"]:checked.fc-checkbox-day');
    var allData = new Array();
    $.each($checked, function (i, ctrl) {
      checkboxes.push($(this).closest("td").attr("data-date"));
    });

    var allData = new Array();
    $.each(checkboxes, function (index, val) {
      var calenMonths = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      var dateFormatted = moment(val).format("MMMYYYY");

      allData.push({
        PLANNING_MONTH: dateFormatted,
        TERMINSL_CD: "YNB TERM",
        TERMINSL_NM: "YANBU TERMINAL",
        DAY: val,
        AVAILABLE_FLG: "Y",
        MODIFIED_DTTM: moment().format("MM/DD/YYYY"),
        CREATED_DTTM: moment().format("MM/DD/YYYY"),
        MODIFIED_BY: "SAS",
        CREATED_BY: "UNXSAS",
      });
    });

    csrfToken = "";
    const so = async () => {
      const csrfURL = `${url}/SASJobExecution/csrf`;
      const csrfParameters = { method: "GET", credentials: "include" };
      const csrfRequest = await fetch(csrfURL, csrfParameters);
      const csrfToken = await csrfRequest.headers.get("X-CSRF-TOKEN");

      // var data = JSON.stringify([{ "id": "id" + 1, "name": "ARAMCO", "lastname": "YNB" }]);
      var newUrl =
        "https://cs-action.aramco.com/SASJobExecution/?_program=%2FSTSP%20LPG%20Demand%20Forecasting%2FCodes%2FWeb%20Interface%2FAPI%20Jobs%2FMark%20Unavailable%20Slots%20in%20West%20Term-Upsert";

      $.ajax({
        type: "POST",
        url: newUrl,
        dataType: "json",
        // data: data,
        credentials: "include",
        contentType: "application/json",
        beforeSend: function (xhr) {
          xhr.setRequestHeader("X-CSRF-Token", csrfToken);
          xhr.setRequestHeader("X-CSRF-Header", "X-CSRF-Token");
          $(".overlay").show();
        },

        data: JSON.stringify(allData),
        success: function (data, status, xhr) {
          $(".overlay").hide();
          // $("#myToast").toast("show");
          // $(".toast-header").addClass("bg-success text-white");
          // $(".toast-body").addClass("bg-white");
          // $(".me-auto").html("Success");
          // $(".toast-header > strong").html(data.user);
          // $(".toast-body ").html(data.Message);
          var checked = $('#calendar input[type="checkbox"]:checked');
          let checkedArray = Array.from(checked);
          checkedArray = checkedArray?.map((obj) => {
            return { DAY: obj?.id };
          });
          //   setChart(checkedArray);
        },
        error: function (data) {
          // $("#myToast").toast("show");
          // $(".toast-header").addClass("bg-danger text-white");
          // $(".toast-body").addClass("bg-white");
          // $(".me-auto").html("Warning");
          // $(".toast-header > strong").html(data.user);
          // $(".toast-body ").html(data.Message);
        },
      });
    };
    so().then((af) => csrfToken);
  });

  setChart([{ Day: 21 }]);
  //   --------------------Chart code----------

  // register verticle line code
  const verticalLinePlugin = {
    getLinePosition: function (chart, pointIndex) {
      const meta = chart.getDatasetMeta(0); // first dataset is used to discover X coordinate of a point
      const data = meta.data;
      return data[pointIndex]._model.x;
    },
    renderVerticalLine: function (chartInstance, pointIndex) {
      const lineLeftOffset = this.getLinePosition(chartInstance, pointIndex);
      const scale = chartInstance.scales["y-axis-0"];
      const context = chartInstance.chart.ctx;
      // render vertical line
      context.beginPath();
      context.strokeStyle = "#70ad47";
      context.moveTo(lineLeftOffset, scale.top);
      context.lineTo(lineLeftOffset, scale.bottom);
      context.stroke();
    },
    afterDatasetsDraw: function (chart, easing) {
      if (chart.config.lineAtIndex) {
        chart.config.lineAtIndex.forEach((pointIndex) =>
          this.renderVerticalLine(chart, pointIndex)
        );
      }
    },
  };
  Chart.plugins.register(verticalLinePlugin);
  // register code end

  $(document).ready(function () {
    function setChartOnCheckboxClick() {
      var checked = $('#calendar input[type="checkbox"]:checked');
      let checkedArray = Array.from(checked);
      checkedArray = checkedArray?.map((obj) => {
        return { DAY: obj?.id };
      });
      setChart(checkedArray);
    }

    // Run the function on the first render
    setChartOnCheckboxClick();

    // Set up the click event handler for ".checkbox" elements
    $(document).on("click", ".checkbox", setChartOnCheckboxClick);
  });

  function setChart(calendarData) {
    // Access data directly from the graphData.js file
    var graphData = window.graphData; // Assuming chartData is defined in graphData.js

    let futureMonthName = moment().add(1, "month").format("MMMM");

    var keyValuesPropane = [];
    var keyValuesButane = [];
    var keyValuesDays = [];
    var lineAtIndex = [];
    $.each(graphData, function (i, obj) {
      keyValuesPropane.push(obj.PROPANE);
      keyValuesButane.push(obj.BUTANE);
      const date = moment(obj.PERIOD_START_DT, "MM-DD-YYYY").format("DD");
      keyValuesDays.push(date);
      let index = calendarData?.findIndex((cObj) => {
        const cdate = moment(cObj.DAY, "YYYY-MM-DD").format("DD");
        return cdate == date;
      });
      index !== -1 && lineAtIndex.push(i);
    });

    var xValues = keyValuesDays;

    new Chart("myChart", {
      type: "line",
      lineAtIndex: lineAtIndex,
      responsive: true,
      maintainAspectRatio: true,
      data: {
        labels: xValues,
        datasets: [
          {
            data: keyValuesPropane,
            borderColor: "#00a3e0",
            label: "Propane",
            fill: false,
          },
          {
            data: keyValuesButane,
            borderColor: "#ababab",
            label: "Butane",
            fill: false,
          },
        ],
      },
      options: {
        legend: {
          title: {
            display: true,
            text: "LPG",
          },
        },
        scales: {
          yAxes: [
            {
              scaleLabel: {
                display: true,
                labelString: "Terminal Avails (MB)",
              },
            },
          ],
          xAxes: [
            {
              gridLines: { color: "rgba(0, 0, 0, 0)" },
              scaleLabel: {
                display: true,
                labelString: futureMonthName,
              },
            },
          ],
        },
      },
    });
  }
});
