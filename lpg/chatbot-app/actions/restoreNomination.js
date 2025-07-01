export function restoreNominationByBot({ nominationNumber }) {
    const allRows = window.liftingAmendmentData || [];
    let foundNomination = null;
    let sourceRow = null;

    allRows.forEach(row => {
        const match = row.nomination?.find(n => n.nominationNumber === nominationNumber);
        if (match) {
            foundNomination = match;
            sourceRow = row;
        }
    });

    if (!foundNomination) {
        addChat("bot", `❌ Could not find nomination ${nominationNumber}.`);
        return;
    }

    if (!foundNomination.DATE_VALUE_ORIGINAL) {
        addChat("bot", `⚠️ Nomination ${nominationNumber} does not have an original recorded day.`);
        return;
    }

    const originalDay = Number(foundNomination.DATE_VALUE_ORIGINAL);
    const currentDay = Number(sourceRow.date);

    if (currentDay === originalDay) {
        addChat("bot", `ℹ️ Nomination ${nominationNumber} is already on its original day.`);
        return;
    }

    const targetRow = allRows.find(r => Number(r.date) === originalDay);
    if (!targetRow) {
        addChat("bot", `❌ Could not find the original row (day ${originalDay}).`);
        return;
    }

    const index = sourceRow.nomination.findIndex(n => n.nominationNumber === nominationNumber);
    const nomination = sourceRow.nomination.splice(index, 1)[0];

    nomination.DATE_VALUE_ADJ = originalDay;

    if (!targetRow.nomination) targetRow.nomination = [];
    targetRow.nomination.push(nomination);

    sourceRow.numberOfShips = sourceRow.nomination.length;
    targetRow.numberOfShips = targetRow.nomination.length;

    selection.products.forEach(product => {
        sourceRow[`adjustment_${product}CL`] = sourceRow.nomination.reduce(
            (sum, n) => sum + (Number(n[`adjustedQty_${product}`]) || 0),
            0
        );
        targetRow[`adjustment_${product}CL`] = targetRow.nomination.reduce(
            (sum, n) => sum + (Number(n[`adjustedQty_${product}`]) || 0),
            0
        );
    });

    window.recalculateLiftingData();
    $("#liftingAmendmentGrid").dxDataGrid("instance").refresh();
    window.renderAllKpiCards();
}
