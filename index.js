import fs from "fs"
import { drawFooter, drawQR, drawTableWithOuterBorder, printHeader, printTitle, uploadToServer } from "./helper.js";
import PDFDocument from 'pdfkit';
import { DetailsTable, logo } from "./demo.js";

export const handler = async (event) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    // Save the PDF to a file
    const fileName = 'sales_invoice.pdf';  // Define the filename
    const fileType = 'application/pdf';
    const filePath = `./${fileName}`
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
        //////////////////////
        doc.moveDown();
        doc.moveDown();
        const defaultColumnWidth = 60;  // Default column width if not specified
        const drawCustomTable = (doc, tableHead, tableBody, marginWidth,footerData) => {
            const tableStartY = doc.y;  // Starting Y position for the table
            const availableWidth = doc.page.width - 2 * marginWidth;  // Maximum width excluding margins
            let yPosition = tableStartY;

            // Set smaller font size
            doc.fontSize(8);  // Reduce font size

            // Function to calculate the total width of all columns except "Item Name"
            const calculateFixedColumnsWidth = () => {
                return tableHead.reduce((sum, header) => {
                    if (header.name !== "Item Name") {
                        const columnWidth = header.width || defaultColumnWidth;
                        return sum + columnWidth;
                    }
                    return sum;
                }, 0);
            };

            // Calculate remaining width for the "Item Name" column
            const remainingWidthForItemName = availableWidth - calculateFixedColumnsWidth();

            // Function to draw the header with borders and center alignment
            const drawHeader = () => {
                doc.font('Helvetica-Bold').fillColor('black');
                let xPosition = marginWidth;  // Initialize xPosition for the first column

                tableHead.forEach((header) => {
                    const columnWidth = header.name === "Item Name" ? remainingWidthForItemName : (header.width || defaultColumnWidth);
                    const headerY = yPosition + 15;  // Vertically center the text

                    if (header.name === "GST" && header.rows) {
                        const gstColumnWidth = columnWidth;  // Save the GST column width for the sub-headers

                        // First row: Single GST header spanning the entire column width
                        doc.text(header.name, xPosition, yPosition + 5, { width: gstColumnWidth, align: 'center' });

                        // Draw border for the entire GST header cell
                        doc.rect(xPosition, yPosition, gstColumnWidth, 20).stroke();

                        // Second row: Two sub-columns under GST (%, Amount)
                        const subColumnWidth = gstColumnWidth / header.rows[0].cols.length;
                        header.rows[0].cols.forEach((col, subColIndex) => {
                            // Draw sub-header text
                            doc.text(col.name, xPosition + subColIndex * subColumnWidth, yPosition + 25, { width: subColumnWidth, align: 'center' });

                            // Draw border for each sub-column
                            doc.rect(xPosition + subColIndex * subColumnWidth, yPosition + 20, subColumnWidth, 20).stroke();
                        });

                        // Draw border for the bottom of the GST header
                        doc.rect(xPosition, yPosition + 20, gstColumnWidth, 20).stroke();

                    } else {
                        // Center all other headers horizontally and vertically
                        doc.text(header.name, xPosition, headerY, { width: columnWidth, align: 'center' });

                        // Draw a border for the header cells
                        doc.rect(xPosition, yPosition, columnWidth, 40).stroke();  // Added border for header cells
                    }

                    // Move xPosition for the next column
                    xPosition += columnWidth;
                });

                yPosition += 40;  // Move Y position after header
            };

            // Function to draw the body with centered text, serial number, and no internal borders
            const drawBody = () => {
                let serialNumber = 1;  // Initialize serial number

                tableBody.forEach((rowData) => {
                    let xPosition = marginWidth;  // Reset xPosition for each row

                    // Add a serial number column at the start
                    const serialColumnWidth = tableHead.find(header => header.name === "SI NO")?.width || defaultColumnWidth;
                    doc.text(serialNumber++, xPosition, yPosition + 7, { width: serialColumnWidth, align: 'center' });
                    xPosition += serialColumnWidth;

                    tableHead.forEach((header) => {
                        const columnWidth = header.width || defaultColumnWidth;

                        if (header.name in rowData || header.name === "GST") {
                            if (header.name === "GST") {
                                const gstData = rowData.GST;
                                const subColumnWidth = columnWidth / 2;
                                // Center GST data vertically and horizontally
                                doc.text(gstData.percent, xPosition, yPosition + 7, { width: subColumnWidth, align: 'center' });
                                doc.text(gstData.amt, xPosition + subColumnWidth, yPosition + 7, { width: subColumnWidth, align: 'center' });
                            } else {
                                // Center all other text vertically and horizontally
                                doc.text(rowData[header.name], xPosition, yPosition + 7, { width: columnWidth, align: 'center' });
                            }
                        }

                        // Move xPosition for the next column
                        xPosition += columnWidth;
                    });

                    yPosition += 20;  // Move to the next row
                });

                // Draw the outer border around the whole table body
                doc.rect(marginWidth, tableStartY + 40, availableWidth, yPosition - tableStartY - 40).stroke();
            };
            const drawFooter = () => {
                let footerYPosition = yPosition;  // Set the Y position for the footer
                
                // Define the footer data with the corresponding widths (example values)
                const footerData = [
                    { text: 'TOTAL', width: 0 },  // Width will be calculated for this item
                    { text: '233.32', width: 50 },
                    { text: '233.23', width: 50 },
                    { text: '2333.00', width: 50 },
                    { text: '3.00', width: 50 }
                ];
            
                let xPosition = marginWidth;  // Initialize xPosition for the first footer cell
            
                // Calculate the remaining width for the "Total" column (first cell)
                const fixedWidthSum = footerData.slice(1).reduce((sum, item) => sum + item.width, 0);
                const totalWidth = availableWidth;
                footerData[0].width = totalWidth - fixedWidthSum;  // Assign remaining width to the first cell ("Total")
            
                // Render each footer cell
                footerData.forEach((footerItem, index) => {
                    // Set alignment: left for the first cell, center for others
                    const alignText = index === 0 ? 'right' : 'center';
            
                    // Draw the footer text
                    doc.text(footerItem.text, xPosition -2, footerYPosition + 12, { width: footerItem.width, align: alignText });
            
                    // Draw a border for each footer cell
                    doc.rect(xPosition, footerYPosition, footerItem.width, 30).stroke();
            
                    // Move xPosition for the next footer cell
                    xPosition += footerItem.width;
                });
            
                // Draw the outer border for the entire footer
                doc.rect(marginWidth, footerYPosition, availableWidth, 30).stroke();
            };
            

            // Call the functions to draw the table
            drawHeader();
            drawBody();
            drawFooter()
        };

        









        // Example usage
        // Example usage
        const tableHead = [
            { name: "SI NO", width: 25 },
            { name: "Item Name", width: 50 },
            { name: "HSN Code", width: 50 },
            { name: "Rate", width: 25 },
            { name: "Qty", width: 25 },
            { name: "Unit", width: 30 },
            { name: "Amount", width: 50 },
            { name: "Discount", width: 50 },
            { name: "Taxable Amount", width: 50 },
            {
                name: "GST",
                rows: [
                    { cols: [{ name: "%", width: 80 }, { name: "Amount", width: 80 }] }
                ],
                width: 80
            },
            { name: "GST Cess", width: 50 },
            { name: "Net Amount", width: 50 },
        ];

        const tableBody = [
            { "Item Name": "Product 1", "HSN Code": "100", "Rate": 2, "Qty": "02", "Unit": "LI", Amount: "1000.00", Discount: "200.00", "Taxable Amount": "100.00", GST: { percent: "18", amt: "432.23" }, "GST Cess": "300.00", "Net Amount": "20.00" },
            { "Item Name": "Product 1", "HSN Code": "100", "Rate": 2, "Qty": "02", "Unit": "LI", Amount: "1000.00", Discount: "200.00", "Taxable Amount": "100.00", GST: { percent: "18", amt: "432.23" }, "GST Cess": "300.00", "Net Amount": "20.00" }
            ,
            { "Item Name": "Product 1", "HSN Code": "100", "Rate": 2, "Qty": "02", "Unit": "LI", Amount: "1000.00", Discount: "200.00", "Taxable Amount": "100.00", GST: { percent: "18", amt: "432.23" }, "GST Cess": "300.00", "Net Amount": "20.00" }
            ,
            { "Item Name": "Product 1", "HSN Code": "100", "Rate": 2, "Qty": "02", "Unit": "LI", Amount: "1000.00", Discount: "200.00", "Taxable Amount": "100.00", GST: { percent: "18", amt: "432.23" }, "GST Cess": "300.00", "Net Amount": "20.00" }

        ];
        const footerData = [
            { text: "Total", width: defaultColumnWidth * 3 },  // "Total" cell, spanning 3 columns width
            { text: "233.32", width: (tableHead.find(header => header.name === "Taxable Amount")?.width || defaultColumnWidth) },  // Corresponding width for each footer cell
            { text: "233.23", width: (tableHead.find(header => header.name === "GST")?.width || defaultColumnWidth) },
            { text: "2333.00", width    : (tableHead.find(header => header.name === "GST Cess")?.width || defaultColumnWidth) },
            { text: "3.00", width: (tableHead.find(header => header.name === "Net Amount")?.width || defaultColumnWidth) }
        ];
        // Assume doc is your PDFDocument instance and marginWidth is defined
        drawCustomTable(doc, tableHead, tableBody, marginWidth,footerData);
        const tableHead2 = [
            { name: "SI NO", width: 25 },
            { name: "Item Name", width: 50 },
            { name: "GST Rate (%)", width: 50 },
            { name: "Taxable Value", width: 25 },
            { name: "IGST", width: 25 },
            { name: "GST Cess", width: 30 },
            { name: "Total", width: 50 },
        ];
        const tableBody2 = [
            { "Item Name": "Product 1", "GST Rate (%)": "100", "Taxable Value": 2, "IGST": "02", "GST Cess": "LI", Total: "1000.00"},
            { "Item Name": "Product 1", "GST Rate (%)": "100", "Taxable Value": 2, "IGST": "02", "GST Cess": "LI", Total: "1000.00"},

        ];
        doc.moveDown();
        doc.moveDown();
        // drawCustomTable(doc, tableHead2, tableBody2, marginWidth,footerData);


        //////////////////////
        await drawQR(doc, invoiceSettings, marginWidth)

        await drawFooter(doc, invoiceSettings, marginWidth, DetailsTable)

        doc.end();
    })
    console.log(pdfBuffer)
    try {
        fs.writeFileSync(filePath, pdfBuffer);
        console.log(`Buffer Size: ${pdfBuffer.length} bytes`);
        await uploadToServer(pdfBuffer, fileName, fileType);
        console.log("File uploaded successfully");
    } catch (error) {
        console.error("Failed to upload file", error);
    }
}
handler()

// let tablehead = [
//     { name: "SI NO" },
//     { name: "Item Name" },
//     { name: "HSN Code" },
//     { name: "Rate" },
//     { name: "Qty" },
//     { name: "Unit" },
//     { name: "Amount" },
//     { name: "Discount" },
//     { name: "Taxable Amount" },
//     {
//         name: "GST",
//         rows: [
//             { cols: [{ name: "&" }, { name: "Amount" }] }
//         ]
//     },
//     { name: "GST Cess" },
//     { name: "Net Amount" },
// ]

// let tableBody = [
//     { name: "Product 1", HSN: "100", QTY: "02", UNIT: "LI", Amount: "1000.00", Discount: "200.00", TaxableAmount: "100.00", GST: { percent: "18", amt: "432.23"}, GSTCess: "300.00", NetAmount: "20.00" } }
// ]

