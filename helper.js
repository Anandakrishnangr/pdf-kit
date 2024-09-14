import axios from "axios";
import { demoRegular } from "./demo.js";
import QRCode from 'qrcode'

export async function loadImageFromS3(url) {
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data, 'binary');
  } catch (error) {
    console.error('Error loading image from S3:', error);
    return null;
  }
}

// Function to print the common header
export async function printHeader(doc, invoiceSettings, margin) {
  const { companyName, companyAddress, logoS3Url } = invoiceSettings;
  let { City, District, StateCode, CountryCode, PINCode } = demoRegular.companyDetails
  let { GSTIN, PAN } = demoRegular?.companyDetails?.relatedCompanyEntity[0]
  let { PhoneNumber } = demoRegular?.companyDetails?.relatedPhoneContacts[0]
  let { EmailAddress } = demoRegular?.companyDetails?.relatedEmailContacts[0]

  doc.font('Helvetica-Bold').fontSize(12).text(demoRegular.companyDetails.CompanyName, margin, margin);
  doc.fontSize(12).text(demoRegular.companyDetails.Line1 + ',', { align: 'left' });
  doc.fontSize(12).text(`${City}, ${District}, ${StateCode}, ${CountryCode}, ${PINCode}`, { align: 'left' });

  doc.font('Helvetica-Bold').fontSize(12).text('GST No : ', { continued: true }) // Stay on the same line
    .font('Helvetica').text(GSTIN, { continued: false })  // Stay on the same line
    .font('Helvetica-Bold').fontSize(12).text('PAN : ', { continued: true })  // Add space before 'PAN :'
    .font('Helvetica').text(PAN, { continued: false })  // Stay on the same line
    .font('Helvetica-Bold').fontSize(12).text('MAIL : ', { continued: true })  // Add space before 'MAIL :'
    .font('Helvetica').text(EmailAddress, { continued: false })  // Stay on the same line
    .font('Helvetica-Bold').fontSize(12).text('TEL : ', { continued: true })  // Add space before 'TEL :'
    .font('Helvetica').text(PhoneNumber, { continued: false });  // End line after TEL

  // Fetch and print the logo image from S3 using axios
  const imageBuffer = await loadImageFromS3(logoS3Url);
  if (imageBuffer) {
    doc.image(imageBuffer, doc.page.width - margin - 80, margin, { width: 80, align: "right" });  // Adjust position and size accordingly
  }

  // Move to the next line after the header
  doc.moveDown();
}

export async function printTitle(doc, invoiceSettings, margin, title) {
  doc.font('Helvetica-Bold').fontSize(16).text(title || 'SALES INVOICE', {
    align: 'center',
    underline: false,
  });

}
export function drawTableWithOuterBorder(doc, data, startX, startY, columnWidths, margin) {
  const rowHeight = 20;
  const cellPaddingLeft = 3; // Left padding for table cells
  const cellPaddingTop = 2; // Top padding for table cells
  const borderWidth = 0.5; // Set a narrow border width

  // Calculate available width for the table (width of the page minus left and right margins)
  const availableWidth = doc.page.width - 2 * margin;

  // Calculate the sum of column widths (e.g., 200 + 200 + 200 = 600)
  const totalColumnWidth = columnWidths.reduce((sum, width) => sum + width, 0);

  // Calculate each column's width as a percentage of the available space
  const columnWidthPercentages = columnWidths.map(width => (width / totalColumnWidth) * availableWidth);

  // Vertical centering for header text (adjust Y to center in the row)
  const headerVerticalOffset = (rowHeight - doc.heightOfString('A', { fontSize: 12 })) / 2 +5

  // Set line width (narrow border)
  doc.lineWidth(borderWidth);

  // Draw header with vertical centering and individual borders
  doc.font('Helvetica-Bold').fontSize(12);

  // Column 1 Header
  doc.text(data.Head[0], startX + cellPaddingLeft, startY + headerVerticalOffset, { width: columnWidthPercentages[0], align: 'center' });
  doc.rect(startX, startY, columnWidthPercentages[0], rowHeight).stroke(); // Border for column 1 header

  // Column 2 Header
  doc.text(data.Head[1], startX + columnWidthPercentages[0] + cellPaddingLeft, startY + headerVerticalOffset, { width: columnWidthPercentages[1], align: 'center' });
  doc.rect(startX + columnWidthPercentages[0], startY, columnWidthPercentages[1], rowHeight).stroke(); // Border for column 2 header

  // Column 3 Header
  doc.text(data.Head[2], startX + columnWidthPercentages[0] + columnWidthPercentages[1] + cellPaddingLeft, startY + headerVerticalOffset, { width: columnWidthPercentages[2], align: 'center' });
  doc.rect(startX + columnWidthPercentages[0] + columnWidthPercentages[1], startY, columnWidthPercentages[2], rowHeight).stroke(); // Border for column 3 header

  // Draw body (without cell separation)
  let currentY = startY + rowHeight;
  doc.font('Helvetica').fontSize(10);
  data.Body.forEach((row) => {
    // Add padding to left and top in each cell, no borders between cells
    doc.text(row[0], startX + cellPaddingLeft, currentY + cellPaddingTop, { width: columnWidthPercentages[0], align: 'left' });
    doc.text(row[1], startX + columnWidthPercentages[0] + cellPaddingLeft, currentY + cellPaddingTop, { width: columnWidthPercentages[1], align: 'left' });
    doc.text(row[2], startX + columnWidthPercentages[0] + columnWidthPercentages[1] + cellPaddingLeft, currentY + cellPaddingTop, { width: columnWidthPercentages[2], align: 'left' });

    currentY += rowHeight;
  });

  // Draw outer border for the table (wrap the whole table)
  doc.rect(startX, startY, availableWidth, rowHeight * (data.Body.length + 1)).stroke();
}

export async function drawQR(doc, InvoiceSettings, margin) {
  // Generate the QR code based on the UPI ID
  let imageBuffer = await QRCode.toDataURL(`upi://pay?pa=${InvoiceSettings.UPI_ID}`, { margin: 0 });

  // Ensure the cursor is moved down to avoid overlap with the previous content (the table)
  doc.moveDown();
  doc.moveDown();

  const qrWidth = 80;  // Width of the QR code
  const qrHeight = 80;  // Assuming the height is the same as the width

  const xPosition = doc.page.width - margin - qrWidth;  // Align QR code to the right, considering margin

  // Draw the QR code at the calculated x position and current y position
  doc.image(imageBuffer, xPosition, doc.y, { width: qrWidth });

  // Calculate the y position for the text to vertically center it with the QR code
  const qrYCenter = doc.y + (qrHeight / 2);  // QR code's vertical center

  // Position the text slightly to the left of the QR code with a small gap
  const textXPosition = xPosition - 100;  // Adjust the value 100 based on how far left you want the text to be

  // Add the text vertically centered with the QR code
  doc.font('Helvetica').fontSize(12).text('Payment QR', textXPosition, qrYCenter - 6); 
  doc.font('Helvetica').fontSize(12).text('ananda@ybl', textXPosition, qrYCenter +6);  // Adjust -6 for better vertical centering
   // Adjust -6 for better vertical centering
}


export const uploadToServer = (uploadedFile, fileName, fileType) => {
  return new Promise((resolve, reject) => {
      console.log(process.env.REACT_APP_FILE_UPLOAD_URL)
      try {
          let data = "";
          let config = {
              method: "post",
              url: `https://b7gihkrd57faaumq2f3gknp7na0imivy.lambda-url.ap-south-1.on.aws?filename=${fileName}&contentType=${fileType}`,
              // url: `https://xd8ts5ub3e.execute-api.us-east-1.amazonaws.com/Prod/api/PreSigned/PreSignedUrl?filename=${uploadedFile.name}&contentType=${uploadedFile.type}`,
              headers: {},
              data: data,
          };
          // console.log('config', config);
          axios(config)
              .then(function (response) {
                  console.log("res :::: ", response.data);
                  let config2 = {
                      method: "put",
                      url: response.data.signedUrl,
                      headers: {
                          "Content-Type": `${fileType}`,
                      },
                      data: uploadedFile,
                  };
                  console.log('config2', config2);
                  axios(config2)
                      .then(function (res) {
                          resolve(res)
                          console.log('res in upload :::: ', JSON.stringify(res.data));
                      })
                      .catch(function (error) {
                          console.log("error in upload ::: ", error);
                          reject()
                      });
              })
              .catch(function (error) {
                  console.log("errr ::: ", error);
                  reject()
              });
      } catch (e) {
          console.log("error ::: ", e);
          reject()
      }
  })

}

// Example usage:
