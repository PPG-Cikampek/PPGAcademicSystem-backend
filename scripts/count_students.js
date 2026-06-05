const ExcelJS = require('exceljs');
const path = require('path');

const files = [
  'Cikampek Barat.xlsx',
  'Cikampek Tengah.xlsx',
  'Cikampek Timur.xlsx',
  'Cilamaya.xlsx',
  'Jatiluhur.xlsx',
  'Purwakarta 1.xlsx',
  'Purwakarta 2.xlsx',
];

const branchLabels = {
  'Cikampek Barat.xlsx': 'Cikbar',
  'Cikampek Tengah.xlsx': 'Cikteng',
  'Cikampek Timur.xlsx': 'Ciktim',
  'Cilamaya.xlsx': 'Cilamaya',
  'Jatiluhur.xlsx': 'Jatiluhur',
  'Purwakarta 1.xlsx': 'PWK 1',
  'Purwakarta 2.xlsx': 'Pwk 2',
};

async function main() {
  let grandTotal = 0;

  for (const file of files) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(path.join(__dirname, 'output', file));
    console.log(branchLabels[file]);

    let branchTotal = 0;

    for (const ws of wb.worksheets) {
      let count = 0;
      ws.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const name = row.getCell(2).value;
        if (!name) return;
        const v = row.getCell(7).value;
        if (v === '' || v === null || v === undefined) {
          count++;
        }
      });
      if (count > 0) {
        console.log(`- ${ws.name} ${count}`);
        branchTotal += count;
      }
    }

    console.log(`Jumlah = ${branchTotal}\n`);
    grandTotal += branchTotal;
  }

  console.log(`Jumlah total = ${grandTotal}`);
}

main().catch(console.error);
