export function clarifyNominationAction({ type }) {
    if (!type) {
        window.respondWithDelay("❓ Do you want to move or restore a nomination? Please type 'move nomination' or 'restore nomination'.");
        return;
    }

    const action = type.toLowerCase();

    if (action.includes("move")) {
        const intent = window.intents.find(i => i.intent === "move_nomination_by_bot");
        if (intent) {
            const collected = {};
            const remainingParams = intent.params || [];

            window.pendingIntent = {
                ...intent,
                collected,
                currentParamIndex: 0,
                remainingParams,
            };
            window.promptNextParam();
        } else {
            window.respondWithDelay("⚠️ Move intent not found.");
        }
    } else if (action.includes("restore") || action.includes("reset")) {
        const intent = window.intents.find(i => i.intent === "restore_nomination_by_bot");
        if (intent) {
            const collected = {};
            const remainingParams = intent.params || [];

            window.pendingIntent = {
                ...intent,
                collected,
                currentParamIndex: 0,
                remainingParams,
            };
            window.promptNextParam();
        } else {
            window.respondWithDelay("⚠️ Restore intent not found.");
        }
    } else {
        window.respondWithDelay("⚠️ I didn't understand. Please type 'move nomination' or 'restore nomination'.");
    }
}
