import Papa from 'papaparse';


const isStringADouble = (str) => {
  if (typeof str != "string" || str.trim() === "") {
    return false;
  }
  // Use Number() to attempt conversion and check against NaN and Infinity
  const num = Number(str);
  // isNaN checks if it's "Not a Number"
  // isFinite checks if it's a real number (not Infinity or -Infinity)
  // The value must be finite and not NaN. Numeric strings like "123" and "123.45" will pass.
  return !isNaN(num) && isFinite(num);
}


export const csv2JSON = async (csvFileText) => {
    let resp = await parseCSVText(csvFileText);

    let dataList = [];
    if (resp != null) {
        dataList = resp.data;
    }

    // convert 'True' and 'False' python into javascript booleans
    for (let data of dataList) {
        for (const [key, value] of Object.entries(data)) {
            if (value === 'True') {
                data[key] = true;
            } else if (value === 'False') {
                data[key] = false;
            }
            if (isStringADouble(value)) {
                data[key] = parseFloat(value);
            }
        }
    }

    return dataList;
}

export const parseCSVText = async (csvFileText) => {
    return new Promise((resolve, reject) => {
        Papa.parse(csvFileText, {
            header: true,
            skipEmptyLines: true,
            transform: (value) => {
                return value.trim();
            },
            complete: (results) => {
                return resolve(results);
            },
            error: (error) => {
                return reject(error);
            },
        });
    });
}
