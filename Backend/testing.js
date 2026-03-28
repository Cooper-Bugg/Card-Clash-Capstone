function padZero(num) {
    return num.toString().padStart(2, '0');
}

function formatToMySQLUTC(date) {
  const year = date.getUTCFullYear();
  const month = padZero(date.getUTCMonth() + 1); // 0-based → +1
  const day = padZero(date.getUTCDate());
  const hours = padZero(date.getUTCHours());
  const minutes = padZero(date.getUTCMinutes());
  const seconds = padZero(date.getUTCSeconds());
 
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function testDateConversion() {


    currentDate = new Date()
    console.log(currentDate)
    console.log(formatToMySQLUTC(currentDate))

    var t = "2010-06-09 13:12:01".split(/[- :]/)

    // Apply each element to the Date function
    var d = new Date(Date.UTC(t[0], t[1]-1, t[2], t[3], t[4], t[5]))

    var offset = new Date().getTimezoneOffset()

    console.log(d)

    console.log(offset)

    d.setMinutes(d.getMinutes() - offset)

    console.log(d)
}

function convertFromMySQLUTC(mysqlDateStr) {
    var t = mysqlDateStr.split(/[- :]/)

    // Put each element in the Date function (subtract 1 from month since it's 0-based)
    var d = new Date(Date.UTC(t[0], t[1]-1, t[2], t[3], t[4], t[5]))

    // Adjust for local timezone
    var offset = new Date().getTimezoneOffset()
    d.setMinutes(d.getMinutes() - offset)

    return d
}

testDateConversion()