export function resetAllAdjustmentsByBot() {
    if (!Array.isArray(window.liftingAmendmentData)) {
        toastr.error("❌ No lifting data found to reset.");
        return;
    }

    window.liftingAmendmentData.forEach((row) => {
        window.selection.products.forEach((product) => {
            row[`adjustment_${product}TA`] = 0;
            row[`adjustment_${product}CL`] = 0;

            if (Array.isArray(row.nomination)) {
                row.nomination.forEach((nomination) => {
                    nomination[`adjustedQty_${product}`] = 0;
                });
            }
        });
    });

    window.recalculateLiftingData();
    const grid = $("#liftingAmendmentGrid").dxDataGrid("instance");
    grid.option("dataSource", window.liftingAmendmentData);
    grid.refresh();

    window.storeOriginalNominationState();
    window.renderAllKpiCards();

    $(".apply-both-checkbox, .apply-qty-checkbox, .apply-date-checkbox").prop("checked", false);
    $("#checkAllBoth, #checkAllQty, #checkAllDate").prop("checked", false);

    if (Array.isArray(window.latestAmendmentRequests)) {
        window.latestAmendmentRequests.forEach(r => {
            r.APPLY_BOTH = "0";
            r.APPLY_QTY = "0";
            r.APPLY_DATE = "0";
        });
    } else {
        console.warn("⚠️ latestAmendmentRequests not found; skipping reset on amendment flags.");
    }

    window.updateFooterButtons();

    toastr.success("✅ All adjustments have been reset.");
}
