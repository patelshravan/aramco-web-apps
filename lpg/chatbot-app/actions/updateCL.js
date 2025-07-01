export function updateCustomerLiftingAdjustmentCL({ product, startDay, endDay, value }) {
    const productCodeMap = window.productCodeMap || {};
    let productCodes;
    if (product.toLowerCase() === 'all') {
        productCodes = window.selection?.products || [];
    } else {
        const singleCode = productCodeMap[product.toLowerCase()] || product;
        if (!singleCode || typeof singleCode !== "string") {
            return addChat("bot", `❌ Unknown or invalid product: "${product}"`);
        }
        productCodes = [singleCode];
    }

    const adjCLVal = parseFloat(value);
    const start = parseInt(startDay);
    const end = parseInt(endDay);

    if (start > end) {
        addChat("bot", `⚠️ Start day (${start}) cannot be after end day (${end}).`);
        return false;
    }

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const year = window.yearStr ? parseInt(window.yearStr) : now.getFullYear();
    const monthIndex = window.monthMap?.[window.monthStr] ?? now.getMonth();

    const startDate = new Date(year, monthIndex, start);
    const endDate = new Date(year, monthIndex, end);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);

    if (endDate < now) {
        addChat("bot", `⚠️ Both start day (${start}) and end day (${end}) are in the past or invalid. Please use today or future days. Start Again!`);
        return false;
    }

    const data = window.liftingAmendmentData;
    const grid = $("#liftingAmendmentGrid").dxDataGrid("instance");
    const isInternational =
        (window.versionsData?.[0]?.INTERNATIONAL === 1) &&
        (selection.terminal?.toLowerCase() === "international");

    let updatedCount = 0;

    for (let day = start; day <= end; day++) {
        const targetDate = new Date(year, monthIndex, day);
        targetDate.setHours(0, 0, 0, 0);
        now.setHours(0, 0, 0, 0);

        if (targetDate < now) {
            addChat("bot", `⚠️ Skipped day ${day} because it's in the past.`);
            continue;
        }

        const rowIndex = data.findIndex(row => Number(row.date) === day);
        if (rowIndex === -1) {
            addChat("bot", `⚠️ Couldn’t find a lifting row for day ${day}.`);
            continue;
        }

        productCodes.forEach(productCode => {
            if (isInternational) {
                const locations = window.countryMap[productCode] || [];
                if (locations.length === 0) {
                    addChat("bot", `⚠️ No locations found for product "${productCode}" in international mode.`);
                    return;
                }
                locations.forEach(location => {
                    const field = `adjustment_${productCode}_${location}CL`;
                    const rowKey = grid.getKeyByRowIndex(rowIndex);
                    grid.cellValue(rowKey, field, adjCLVal);
                    data[rowIndex][field] = adjCLVal;
                    updatedCount++;
                });
            } else {
                const field = `adjustment_${productCode}CL`;
                const rowKey = grid.getKeyByRowIndex(rowIndex);
                grid.cellValue(rowKey, field, adjCLVal);
                data[rowIndex][field] = adjCLVal;
                updatedCount++;
            }
        });

    }

    if (typeof window.recalculateLiftingData === "function") {
        window.recalculateLiftingData();
    }

    grid.refresh();
    window.renderAllKpiCards?.();
}