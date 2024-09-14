import fs from "fs"
import { drawQR, drawTableWithOuterBorder, printHeader, printTitle, uploadToServer } from "./helper.js";
import PDFDocument from 'pdfkit';
import { DetailsTable, logo } from "./demo.js";

export const handler = async (event) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    // Save the PDF to a file
    const fileName = 'sales_invoice.pdf';  // Define the filename
    const fileType = 'application/pdf';
    let buffers = [];
    const marginColor = 'white';
    const marginWidth = 20;  // Assuming 50 is the defined margin size
    doc.on('data', buffers.push.bind(buffers));
    const pdfBuffer = await new Promise(async (resolve, reject) => {
        doc.on('end', async () => {
            const pdfData = Buffer.concat(buffers);  // Create a buffer from the collected data
            console.log(pdfData)
            resolve(pdfData);
        });
        // Draw yellow rectangle as margin background
        doc
            .rect(0, 0, doc.page.width, marginWidth) // Top margin
            .fill(marginColor);
        doc
            .rect(0, doc.page.height - marginWidth, doc.page.width, marginWidth) // Bottom margin
            .fill(marginColor);
        doc
            .rect(0, 0, marginWidth, doc.page.height) // Left margin
            .fill(marginColor);
        doc
            .rect(doc.page.width - marginWidth, 0, marginWidth, doc.page.height) // Right margin
            .fill(marginColor);
        // doc.pipe(fs.createWriteStream('sales_invoice.pdf'));
        doc.fillColor("black")
        // Define invoice settings
        const invoiceSettings = {
            companyName: 'Your Company Name',
            companyAddress: '1234 Company Address, City, Country',
            logoS3Url: logo, // Public S3 URL
        };
        // Print the common header
        await printHeader(doc, invoiceSettings, marginWidth);
        await printTitle(doc, invoiceSettings, marginWidth)
        const columnWidths = [200, 200, 200];  // Adjust widths of each column
        await drawTableWithOuterBorder(doc, DetailsTable, marginWidth, 160, columnWidths, marginWidth);
        await drawQR(doc, invoiceSettings, marginWidth)

        doc.end();
    })
console.log(pdfBuffer)
    try {
        console.log(`Buffer Size: ${pdfBuffer.length} bytes`);
        await uploadToServer(pdfBuffer, fileName, fileType);
        console.log("File uploaded successfully");
    } catch (error) {
        console.error("Failed to upload file", error);
    }
}
