/*
wordArray: { words: [..], sigBytes: words.length * 4 }
*/

// assumes wordArray is Big-Endian (because it comes from CryptoJS which is all BE)
// From: https://gist.github.com/creationix/07856504cf4d5cede5f9#file-encode-js
export function convertWordArrayToUint8Array(
  wordArray: CryptoJS.lib.WordArray
) {
  var len = wordArray.words.length,
    u8_array = new Uint8Array(len << 2),
    offset = 0,
    word,
    i;
  for (i = 0; i < len; i++) {
    word = wordArray.words[i];
    u8_array[offset++] = word >> 24;
    u8_array[offset++] = (word >> 16) & 0xff;
    u8_array[offset++] = (word >> 8) & 0xff;
    u8_array[offset++] = word & 0xff;
  }

  // delete the latest 0 elements
  const lastWord = wordArray.words[len - 1];
  const lastWordArray = [
    lastWord >> 24,
    (lastWord >> 16) & 0xff,
    (lastWord >> 8) & 0xff,
    lastWord & 0xff
  ];
  let zeros = 0;
  if (
    lastWordArray[0] === 0 &&
    lastWordArray[1] === 0 &&
    lastWordArray[2] === 0 &&
    lastWordArray[3] === 0
  )
    zeros = 4;
  else if (
    lastWordArray[0] !== 0 &&
    lastWordArray[1] === 0 &&
    lastWordArray[2] === 0 &&
    lastWordArray[3] === 0
  )
    zeros = 3;
  else if (
    lastWordArray[0] !== 0 &&
    lastWordArray[1] !== 0 &&
    lastWordArray[2] === 0 &&
    lastWordArray[3] === 0
  )
    zeros = 2;
  else if (
    lastWordArray[0] !== 0 &&
    lastWordArray[1] !== 0 &&
    lastWordArray[2] !== 0 &&
    lastWordArray[3] === 0
  )
    zeros = 1;
  return u8_array.subarray(0, u8_array.length - zeros);
}

// create a wordArray that is Big-Endian (because it's used with CryptoJS which is all BE)
// From: https://gist.github.com/creationix/07856504cf4d5cede5f9#file-encode-js
export function convertUint8ArrayToWordArray(u8Array: Uint8Array) {
  var words = [],
    i = 0,
    len = u8Array.length;

  while (i < len) {
    words.push(
      (u8Array[i++] << 24) |
        (u8Array[i++] << 16) |
        (u8Array[i++] << 8) |
        u8Array[i++]
    );
  }

  return {
    sigBytes: words.length * 4,
    words: words
  };
}

export function convertUint8ArrayToBinaryString(u8Array: Uint8Array) {
  const len = u8Array.length;
  let b_str = '';
  for (let i = 0; i < len; i++) {
    b_str += String.fromCharCode(u8Array[i]);
  }
  return b_str;
}

export function convertBinaryStringToUint8Array(bStr: string) {
  const len = bStr.length;
  const u8_array = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    u8_array[i] = bStr.charCodeAt(i);
  }
  return u8_array;
}

export function numberToBytes(number: number) {
  // you can use constant number of bytes by using 8 or 4
  const len = Math.ceil(Math.log2(number) / 8);
  const byteArray = new Uint8Array(len);

  for (let index = 0; index < byteArray.length; index++) {
    const byte = number & 0xff;
    byteArray[index] = byte;
    number = (number - byte) / 256;
  }

  return byteArray;
}

export function bytesToNumber(byteArray: Uint8Array) {
  let result = 0;
  for (let i = byteArray.length - 1; i >= 0; i--) {
    result = result * 256 + byteArray[i];
  }

  return result;
}

export const stringToUint8Array = (str: string): Uint8Array => {
  const arr = [];
  for (let i = 0, j = str.length; i < j; ++i) {
    arr.push(str.charCodeAt(i));
  }

  const tmpUint8Array = new Uint8Array(arr);
  return tmpUint8Array;
};

export const hexToString = (hex: string): string => {
  hex = hex.substring(2); // remove the '0x' part
  let string = '';
  while (hex.length % 4 !== 0) {
    // we need it to be multiple of 4
    hex = '0' + hex;
  }
  for (let i = 0; i < hex.length; i += 4) {
    string += String.fromCharCode(parseInt(hex.substring(i, i + 4), 16)); // get char from ascii code which goes from 0 to 65536
  }
  return string;
};

export const stringToHex = (string: string): string => {
  let hex = '';
  for (let i = 0; i < string.length; i++) {
    hex += ((i === 0 ? '' : '000') + string.charCodeAt(i).toString(16)).slice(
      -4
    ); // get character ascii code and convert to hexa string, adding necessary 0s
  }
  return '0x' + hex.toUpperCase();
};
