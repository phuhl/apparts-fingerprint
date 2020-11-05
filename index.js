const Fingerprint2 = require("./fingerprint2.js");

/**
 * This script produces a 291 bit fingerprint of the client using the
 * library fingerprint2.js. The fingerprint is designed in a way that it
 * works like a localy sensitive hash. If only few changes happen to the
 * client (update, installed plugin, installed font, etc.) only few bits
 * of the hash should change. This makes it possible to identify a user
 * even if his hash changes.
 */

const getFontBits = (myFonts) => {
  const fontList = [
    "Andale Mono",
    "Arial",
    "Arial Black",
    "Arial Hebrew",
    "Arial MT",
    "Arial Narrow",
    "Arial Rounded MT Bold",
    "Arial Unicode MS",
    "Bitstream Vera Sans Mono",
    "Book Antiqua",
    "Bookman Old Style",
    "Calibri",
    "Cambria",
    "Cambria Math",
    "Century",
    "Century Gothic",
    "Century Schoolbook",
    "Comic Sans",
    "Comic Sans MS",
    "Consolas",
    "Courier",
    "Courier New",
    "Geneva",
    "Georgia",
    "Helvetica",
    "Helvetica Neue",
    "Impact",
    "Lucida Bright",
    "Lucida Calligraphy",
    "Lucida Console",
    "Lucida Fax",
    "LUCIDA GRANDE",
    "Lucida Handwriting",
    "Lucida Sans",
    "Lucida Sans Typewriter",
    "Lucida Sans Unicode",
    "Microsoft Sans Serif",
    "Monaco",
    "Monotype Corsiva",
    "MS Gothic",
    "MS Outlook",
    "MS PGothic",
    "MS Reference Sans Serif",
    "MS Sans Serif",
    "MS Serif",
    "MYRIAD",
    "MYRIAD PRO",
    "Palatino",
    "Palatino Linotype",
    "Segoe Print",
    "Segoe Script",
    "Segoe UI",
    "Segoe UI Light",
    "Segoe UI Semibold",
    "Segoe UI Symbol",
    "Tahoma",
    "Times",
    "Times New Roman",
    "Times New Roman PS",
    "Trebuchet MS",
    "Verdana",
    "Wingdings",
    "Wingdings 2",
    "Wingdings 3",
  ];
  return fontList.map((font) => (myFonts.indexOf(font) !== -1 ? 1 : 0));
};

const hashCode = (val) => {
  var hash = 0,
    i,
    chr;
  if (val.length === 0) return hash;
  for (i = 0; i < val.length; i++) {
    chr = val.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
};

const xorbloom = (bloom, value) => {
  const pos = Math.abs(hashCode(value)) % bloom.length;
  bloom[pos] = 1 - bloom[pos];
  return bloom;
};

const getBloomOfArr = (arr, bloomSize) => {
  let myBloom = [...Array(bloomSize).keys()].map((_) => 0);
  return arr.reduce(xorbloom, myBloom);
};

const getPluginBits = (myPlugins, bloomSize) => {
  return getBloomOfArr(
    myPlugins.map((p) => p.join()),
    bloomSize
  );
};

const getUABits = (ua, bloomSize) => {
  return getBloomOfArr(ua.split(" "), bloomSize);
};

const getStringBits = (val, size) => {
  let res = (Math.abs(hashCode(JSON.stringify(val))) % Math.pow(2, size))
    .toString(2)
    .split("")
    .map((a) => parseInt(a));
  return [...Array(size - res.length).keys()].map((_) => 0).concat(res);
};

const getCanvasBits = (canvas, size) => {
  return getStringBits(canvas, size);
};

const onlyOneBit = [9, 10, 11, 12, 13, 20, 21, 22, 23, 24];
const multiBit = [1, 2, 3, 4, 6, 7, 8, 14, 15, 25, 27];
const mbitSizes = [16, 3, 4, 4, 16, 16, 16, 4, 4, 6, 32];
const MAX_BITS = Math.ceil(Math.log2(Number.MAX_SAFE_INTEGER));

const TOTAL_SIZE = 291;
const BLOCK_SIZE = 50;
const LAST_BLOCK_SIZE = TOTAL_SIZE % BLOCK_SIZE;
const BLOCK_COUNT = Math.ceil(TOTAL_SIZE / BLOCK_SIZE);

const bitArrayToHexFP = (bits) => {
  const numbers = [];
  for (let i = 0, j = bits.length; i < j; i += BLOCK_SIZE) {
    numbers.push(bits.slice(i, i + BLOCK_SIZE));
  }
  return numbers
    .map((number) => parseInt(number.join(""), 2).toString(16))
    .join("-");
};

const hexFPToBitArray = (fp) =>
  fp
    .split("-")
    .map((block) =>
      parseInt(block, 16)
        .toString(2)
        .split("")
        .map((a) => parseInt(a))
    )
    .map((block, i) => {
      const bsize = i == BLOCK_COUNT - 1 ? LAST_BLOCK_SIZE : BLOCK_SIZE;
      return [...Array(bsize - block.length).keys()]
        .map((_) => 0)
        .concat(block);
    })
    .flat();

const compare = (val1, val2) => {
  if (!Array.isArray(val1)) {
    val1 = hexFPToBitArray(val1);
  }
  if (!Array.isArray(val2)) {
    val2 = hexFPToBitArray(val2);
  }
  let dif = 0;
  for (let i = 0; i < val1.length; i++) {
    if (val1[i] !== val2[i]) {
      dif++;
    }
  }
  return dif;
};

module.exports = () => {
  Fingerprint2.get((fp) => {
    let res = [
      getUABits(fp[0].value, 8),
      getUABits(fp[19].value, 8),
      getPluginBits(fp[16].value, 16),
      getFontBits(fp[26].value, 16),
      getCanvasBits(fp[17].value, 32),
      getCanvasBits(fp[18].value, 32),
    ];
    res = res.concat(onlyOneBit.map((key) => (fp[key].value ? 1 : 0))); // 10
    res = res.concat(
      multiBit.map((key, i) => getStringBits(fp[key].value, mbitSizes[i]))
    ); // 77
    res = res.flat();
    let numberArr = [];
    for (let i = 0, j = res.length; i < j; i += MAX_BITS) {
      numberArr.push(res.slice(i, i + MAX_BITS));
    }
    const myfp = bitArrayToHexFP(res);
    return myfp;
  });
};
