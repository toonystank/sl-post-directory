const fs = require('fs');
const pdf = require('pdf-parse');

let dataBuffer = fs.readFileSync('C:\\Users\\hakee\\Downloads\\Documents\\45861503-Sri-Lank-a-Postal-Codes.pdf');

pdf(dataBuffer).then(function (data) {
    fs.writeFileSync('C:\\Users\\hakee\\Downloads\\Documents\\extracted_pdf.txt', data.text);
    console.log('Successfully extracted text to extracted_pdf.txt');
    console.log('First 1000 characters:');
    console.log(data.text.substring(0, 1000));
}).catch(function (error) {
    console.error('Error parsing PDF:', error);
});
