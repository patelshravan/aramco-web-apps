var usernm = "";
var nglCoordinationAccess = "";
var cosmdGroupAccess = "";
var ospasAccess = "";
var sropAccess = "";
var technicalAccess = "";
var processFlowData = [];

function getProcessStatus() {
  $.ajax({
    url: "../response/process-flow-response.json",
    dataType: "json",
    async: false,
    beforeSend: function () {
      $(".overlay").show();
    },
    success: function (data) {
      console.log("data: ", data);
      processFlowData = data;
      usernm = data.west_availability[0].SYS_COMPUTE_SESSION_OWNER;
      getUserDetails(usernm);
      updateProcessFlags(processFlowData);
      $(".overlay").hide();
    },
    error: function (xhr, status, error) {
      console.error("Error fetching JSON:", error);
      $(".overlay").hide();
    },
  });
}

getProcessStatus();

function getUserDetails(user) {
  var url = "../response/process-flow-response.json";
  $.ajax({
    url: url,
    dataType: "json",
    beforeSend: function (xhr) {
      xhr.setRequestHeader("X-CSRF-TOKEN", "Bearer sas_services");
      $(".overlay").show();
    },
    success: function (data) {
      var ospasGroup = "LPG OSPAS Terminal SAS";
      var nglGroup = "LPG NGL COORDINATION SAS";
      var comdGroup = "LPG COSMD SAS";
      var sropGroup = "LPG SROP SAS";
      var TechnicalGroup = "STSP LPG Demand Forecasting Technical Group";

      ospasAccess = JSON.stringify(data).indexOf(ospasGroup);
      nglCoordinationAccess = JSON.stringify(data).indexOf(nglGroup);
      cosmdGroupAccess = JSON.stringify(data).indexOf(comdGroup);
      sropAccess = JSON.stringify(data).indexOf(sropGroup);
      technicalAccess = JSON.stringify(data).indexOf(TechnicalGroup);

      // Enable or Disable link based on the security
      // Ospas to get access to only upload the west availability
      if (ospasAccess != -1) {
        $("#l_create_nom")
          .removeAttr("href")
          .addClass("disabled")
          .css("color", "gray");
        $("#l_cosmd_planning")
          .removeAttr("href")
          .addClass("disabled")
          .css("color", "gray");
        $("#l_export_nomination")
          .removeAttr("href")
          .addClass("disabled")
          .css("color", "gray");
      }
      // Cosmd to get access to enter monthly nomination & Scenario planning but not approval
      if (cosmdGroupAccess != -1) {
        $("#l_west_availability")
          .removeAttr("href")
          .addClass("disabled")
          .css("color", "gray");
        $("#l_ospas_planning")
          .removeAttr("href")
          .addClass("disabled")
          .css("color", "gray");
      }

      // technical group get all access
      if (technicalAccess != -1) {
      }
    },
  });
}

function updateProcessFlags(data) {
  west_availability_status = data.west_availability[0].STATUS;
  export_nomination_status = data.export_nomination[0].STATUS;
  cosmd_planning_status = data.cosmd_planning[0].STATUS;
  ospas_planning_status = data.ospas_planning[0].STATUS;
  create_nom_status = data.create_nom[0].STATUS;

  // Check status for west slot availability module
  if (west_availability_status === 1) {
    west_availability_class = "active";
    $("#l_create_nom")
      .removeAttr("href")
      .addClass("disabled")
      .css("color", "gray");
    $("#l_cosmd_planning")
      .removeAttr("href")
      .addClass("disabled")
      .css("color", "gray");
    $("#l_ospas_planning")
      .removeAttr("href")
      .addClass("disabled")
      .css("color", "gray");
  } else if (west_availability_status === 2) {
    west_availability_class = "completed";
  } else if (west_availability_status === 0) {
    west_availability_class = "";
  }

  // Check status for enter export monthly nomination module
  if (export_nomination_status === 1) {
    export_nomination_class = "active";

    $("#l_cosmd_planning")
      .removeAttr("href")
      .addClass("disabled")
      .css("color", "gray");
    $("#l_ospas_planning")
      .removeAttr("href")
      .addClass("disabled")
      .css("color", "gray");
    $("#l_create_nom")
      .removeAttr("href")
      .addClass("disabled")
      .css("color", "gray");
  } else if (export_nomination_status === 2) {
    export_nomination_class = "completed";
  } else if (export_nomination_status === 0) {
    export_nomination_class = "";
  }

  // Check status for export planning process at cosmd module
  if (cosmd_planning_status === 1) {
    cosmd_planning_class = "active";
    $("#l_create_nom")
      .removeAttr("href")
      .addClass("disabled")
      .css("color", "gray");
    $("#l_ospas_planning")
      .removeAttr("href")
      .addClass("disabled")
      .css("color", "gray");
  } else if (cosmd_planning_status === 2) {
    cosmd_planning_class = "completed";
  } else if (cosmd_planning_status === 0) {
    cosmd_planning_class = "";
  }

  // Check status for ospas approval of export planning process module
  if (ospas_planning_status === 1) {
    $("#l_west_availability")
      .removeAttr("href")
      .addClass("disabled")
      .css("color", "gray");
    $("#l_export_nomination")
      .removeAttr("href")
      .addClass("disabled")
      .css("color", "gray");

    $("#l_cosmd_planning")
      .removeAttr("href")
      .addClass("disabled")
      .css("color", "gray");
    $("#l_create_nom")
      .removeAttr("href")
      .addClass("disabled")
      .css("color", "gray");
    ospas_planning_class = "active";
  } else if (ospas_planning_status === 2) {
    ospas_planning_class = "completed";
  } else if (ospas_planning_status === 0) {
    ospas_planning_class = "";
  }

  // Check status for create nomination in SAP module
  if (create_nom_status === 1) {
    $("#l_west_availability")
      .removeAttr("href")
      .addClass("disabled")
      .css("color", "gray");
    $("#l_export_nomination")
      .removeAttr("href")
      .addClass("disabled")
      .css("color", "gray");
    $("#l_cosmd_planning")
      .removeAttr("href")
      .addClass("disabled")
      .css("color", "gray");
    $("#l_ospas_planning")
      .removeAttr("href")
      .addClass("disabled")
      .css("color", "gray");
    create_nom_class = "active";
  } else if (create_nom_status === 2) {
    $("#l_west_availability")
      .removeAttr("href")
      .addClass("disabled")
      .css("color", "gray");
    $("#l_export_nomination")
      .removeAttr("href")
      .addClass("disabled")
      .css("color", "gray");
    $("#l_cosmd_planning")
      .removeAttr("href")
      .addClass("disabled")
      .css("color", "gray");
    $("#l_ospas_planning")
      .removeAttr("href")
      .addClass("disabled")
      .css("color", "gray");
    $("#l_create_nom")
      .removeAttr("href")
      .addClass("disabled")
      .css("color", "gray");
    create_nom_class = "completed";
  } else if (create_nom_status === 0) {
    create_nom_class = "";
  }

  // Update the classes for individual boxes
  $("#create_nom").addClass(create_nom_class);
  $("#ospas_planning").addClass(ospas_planning_class);
  $("#cosmd_planning").addClass(cosmd_planning_class);
  $("#export_nomination").addClass(export_nomination_class);
  $("#west_availability").addClass(west_availability_class);

  // Update the classes for grouped boxes

  // Check status for both west slot availability module &  export monthly nomination module
  if (west_availability_status == 2 && export_nomination_status == 2) {
    preRequisites_class = "completed";
  } else if (west_availability_status == 0 && export_nomination_status == 0) {
    preRequisites_class = "";
  } else if (west_availability_status == 1 || export_nomination_status == 1) {
    preRequisites_class = "active";
  }

  // Check status for pre Requisites
  if (cosmd_planning_status == 1) {
    createScenario_class = "active";
  } else if (cosmd_planning_status == 2) {
    createScenario_class = "completed";
  } else if (cosmd_planning_status == 0) {
    createScenario_class = "";
  }

  // Check status for create scenario (export scenario)
  if (ospas_planning_status == 1) {
    approveScenario_class = "active";
  } else if (ospas_planning_status == 0) {
    approveScenario_class = "";
  } else if (ospas_planning_status == 2) {
    approveScenario_class = "completed";
  }

  // Check status for approval of export scenario
  if (create_nom_status == 1) {
    createNominationsinSAP_class = "active";
  } else if (create_nom_status == 2) {
    createNominationsinSAP_class = "completed";
  } else if (create_nom_status == 0) {
    createNominationsinSAP_class = "";
  }

  // Check status for all process
  if (create_nom_status == 2) {
    completed_class = "completed";
  } else if (create_nom_status == 1 || create_nom_status == 0) {
    completed_class = "";
  }

  // Add to classes
  $("#preRequisites").addClass(preRequisites_class);
  $("#createScenario").addClass(createScenario_class);
  $("#approveScenario").addClass(approveScenario_class);
  $("#createNominationsinSAP").addClass(createNominationsinSAP_class);
  $("#completed").addClass(completed_class);
}
