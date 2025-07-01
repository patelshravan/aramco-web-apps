const BASE_URL = "https://sas-prod.aramco.com/sas";

const API_PATH = "X2FSTP LPG Demand ForecastingX2FInventory Analysis ToolX2FApi";

const API_ENDPOINTS = {
    LANDING_PAGE: '/SASJobExecution/?_program=${API_PATH}%2Finvproj.get_usernm',
    READ: '/SASJobExecution/?_program=${API_PATH}%2Finvproj.read',
    SAVE: '/SASJobExecution/?_program=${API_PATH}%2Finvproj.save',
    FETCH_GOSP_AVAIL: '/SASJobExecution/?_program=${API_PATH}%2Finvproj.fetch_gosp_avail',
    UPDATE_UOM: '/SASJobExecution/?_program=${API_PATH}%2Finvproj.update_uom',
    UPDATE_GUAGE_FACTOR: '/SASJobExecution/?_program=${API_PATH}%2Finvproj.update_uom',
    GOSP_DROPDOWN: `/SASJobExecution/?_program=${API_PATH}%2Finvproj_gosp_get_dropdown`,
    GOSP_READ: `/SASJobExecution/?_program=${API_PATH}%2Finvproj_gosp_read`,
    GOSP_SAVE: `/SASJobExecution/?_program=${API_PATH}%2Finvproj_gosp_save`,
    CSRF: '/SASJobExecution/?csrf',
};

export {
    BASE_URL,
    API_PATH,
    API_ENDPOINTS,
};