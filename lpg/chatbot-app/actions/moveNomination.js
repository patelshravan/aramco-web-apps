export function moveNominationByBot({ nominationNumber, targetDay }) {
    const sourceRow = liftingAmendmentData.find(row =>
        row.nomination?.some(n => n.nominationNumber === nominationNumber)
    );
    if (!sourceRow) {
        addChat("bot", `❌ Could not find nomination ${nominationNumber}.`);
        return;
    }

    const targetRow = liftingAmendmentData.find(row => Number(row.date) === Number(targetDay));
    if (!targetRow) {
        addChat("bot", `❌ Could not find target day ${targetDay} in the grid.`);
        return;
    }

    const nominationIndex = sourceRow.nomination.findIndex(n =>
        n.nominationNumber === nominationNumber
    );
    if (nominationIndex === -1) {
        addChat("bot", `❌ Nomination ${nominationNumber} not found in source row.`);
        return;
    }

    const nomination = sourceRow.nomination.splice(nominationIndex, 1)[0];

    // Preserve original day on first move only
    if (!nomination.DATE_VALUE_ORIGINAL) {
        nomination.DATE_VALUE_ORIGINAL = nomination.DATE_VALUE_ADJ || nomination.DATE_VALUE;
    }

    nomination.DATE_VALUE_ADJ = targetDay;

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
