import { updateTerminalAvailsAdjustment } from './updateTA.js';
import { updateCustomerLiftingAdjustmentCL } from './updateCL.js';
import { simulateProductAvailsAdjustment } from './simulateAvails.js';
import { moveNominationByBot } from './moveNomination.js';
import { restoreNominationByBot } from './restoreNomination.js';
import { clarifyNominationAction } from './clarifyNomination.js';
import { generatePdfFromBot } from './generatePdfFromBot.js';
import { resetAllAdjustmentsByBot } from './resetAllAdjustments.js';

export const actions = {
    updateTerminalAvailsAdjustment,
    updateCustomerLiftingAdjustmentCL,
    simulateProductAvailsAdjustment,
    moveNominationByBot,
    restoreNominationByBot,
    clarifyNominationAction,
    generatePdfFromBot,
    resetAllAdjustmentsByBot
};
