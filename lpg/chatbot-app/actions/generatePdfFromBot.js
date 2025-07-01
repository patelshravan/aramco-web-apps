export function generatePdfFromBot() {
    if (typeof window.generatePDF === "function") {
        window.generatePDF();
    } else {
        addChat("bot", "❌ PDF generation function is not available.");
    }
}
