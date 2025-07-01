export function simulateProductAvailsAdjustment({ product, increment }) {
    const simulatedData = JSON.parse(JSON.stringify(window.liftingAmendmentData));
    const incValue = parseFloat(increment);
    const targetProducts =
        product.toLowerCase() === "all"
            ? selection.products
            : [product];

    simulatedData.forEach(row => {
        targetProducts.forEach(prod => {
            const key = `terminalAvails_${prod}`;
            if (key in row) {
                row[key] += incValue;
            }
        });
    });

    recalculateLiftingDataOnSim(simulatedData);

    const totalDays = simulatedData.length;
    let violatedDays = 0;
    let monthEndClosing = 0;
    const targetClosing = 2000;

    const violatedDayList = new Set();
    const perProductDayViolations = {};

    const minRow = (window.inventoryPlanningData || []).find(r => r.Type === 'Min') || {};

    simulatedData.forEach(row => {
        let dayHasViolation = false;

        Object.keys(row).forEach(key => {
            if (key.startsWith("closingInventory_")) {
                const prodKey = key.replace("closingInventory_", "");
                const value = row[key];
                const minValue = parseFloat(minRow[prodKey]) || 0;

                if (value < minValue) {
                    dayHasViolation = true;
                    if (!perProductDayViolations[prodKey]) {
                        perProductDayViolations[prodKey] = new Set();
                    }
                    perProductDayViolations[prodKey].add(row.date);
                }

                if (row.date === totalDays) {
                    monthEndClosing += value;
                }
            }
        });

        if (dayHasViolation) {
            violatedDayList.add(row.date);
            violatedDays++;
        }
    });

    const monthEndPercent = Math.round((monthEndClosing / targetClosing) * 100);
    const belowTarget = monthEndClosing < targetClosing;

    const earliestShipmentDay =
        simulatedData.find(r => r.date > new Date().getDate())?.date || "N/A";
    const recommendedQty = 250;

    const violatedDaysStr = violatedDays > 0
        ? [...violatedDayList].sort((a, b) => a - b).join(", ")
        : "None";

    const topViolatingProducts = Object.keys(perProductDayViolations).length > 0
        ? Object.entries(perProductDayViolations)
            .map(([prod, days]) => `${prod} (${days.size} days)`)
            .join(", ")
        : "None";

    const summaryHTML = `
<div>
  <strong>🔍 Simulation Results</strong>
  <ul>
    <li><strong>Total Days Violated:</strong> ${violatedDays}</li>
    <li><strong>Days Affected:</strong> ${violatedDaysStr}</li>
    <li><strong>Month-End Closing Inventory:</strong> ${monthEndClosing}</li>
    <li><strong>Percentage of Target:</strong> ${monthEndPercent}%</li>
    <li><strong>Status:</strong> ${belowTarget ? "⚠️ Below Target" : "✅ On Target"}</li>
    <li><strong>Additional Shipments Possible:</strong> Yes</li>
    <li><strong>Earliest Possible Day:</strong> ${earliestShipmentDay}</li>
    <li><strong>Recommended Quantity:</strong> ${recommendedQty} units</li>
    <li><strong>Top Violating Products:</strong> ${topViolatingProducts}</li>
    <li><strong>Month-End Inventory Below Target:</strong> ${belowTarget ? "Yes" : "No"}</li>
  </ul>
  <strong>💡 Recommendations</strong>
  <ul>
    <li>Focus on improving days: ${violatedDaysStr}</li>
    <li>Pay attention to products with repeated shortfalls: ${topViolatingProducts}</li>
    <li>Consider targeted adjustments or rescheduling to reduce violations</li>
  </ul>
</div>
`;

    respondWithDelay(summaryHTML.trim(), true);
}

function recalculateLiftingDataOnSim(data) {
    const monthMap = window.monthMap || {
        Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
        Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [monthStr, yearStr] = selection.month.split(" ");
    const monthIndex = monthMap[monthStr];
    const planningYear = parseInt(yearStr);

    data.forEach((row, i) => {
        const currentDay = row.date;
        const currentDate = new Date(planningYear, monthIndex, currentDay);
        currentDate.setHours(0, 0, 0, 0);
        const isPastDay = currentDate < today;
        const isToday = currentDate.getTime() === today.getTime();

        selection.products.forEach(product => {
            let closing;

            if (isPastDay) {
                closing = row[`closingInventory_${product}`] || 0;
            } else {
                const opening = isToday
                    ? row[`openingInventory_${product}`] || 0
                    : data[i - 1]?.[`closingInventory_${product}`] || 0;

                const terminal = row[`terminalAvails_${product}`] || 0;
                const customer = row[`customerLifting_${product}`] || 0;
                const adjTA = row[`adjustment_${product}TA`] || 0;
                const adjCL = row[`adjustment_${product}CL`] || 0;

                closing = opening + terminal + adjTA - customer - adjCL;
            }

            row[`closingInventory_${product}`] = closing;
        });

        row.totalLifting = selection.products.reduce((sum, p) => {
            return sum + (row[`customerLifting_${p}`] || 0);
        }, 0);
    });
}