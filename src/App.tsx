import './styles.css';
import React, { useState, useRef, useEffect } from 'react';
import { ZstdCodec } from 'zstd-codec';
import download from 'downloadjs';
import CryptoJS from 'crypto-js';
import {
  convertUint8ArrayToWordArray,
  convertWordArrayToUint8Array,
  numberToBytes,
  bytesToNumber,
  stringToUint8Array,
  hexToString,
  stringToHex
} from './convert';
import * as sigUtil from '@metamask/eth-sig-util';
import * as ethUtil from 'ethereumjs-util';

const App = () => {
  const FILE_EXTENSION = '.cpz';
  const ENCRYPTION_BIT = 128;

  const [encryptionPassword, setEncryptionPassword] = useState('');
  const [publicKey, setPublicKey] = useState('');
  const [currentAccount, setCurrentAccount] = useState('');
  const [encryptedPassword, setEncryptedPassword] = useState('');
  const [decryptedPassword, setDecryptedPassword] = useState('');

  const decompressFile = useRef<HTMLInputElement>(null as any);
  const compressFile = useRef<HTMLInputElement>(null as any);

  useEffect(() => {
    const init = async () => {
      if (!window.ethereum) {
        console.log(`Please use in wallet!`);
        return;
      }

      let accounts: Array<string> = await window.ethereum.request({
        method: 'eth_accounts'
      });
      if (accounts.length === 0) {
        // No account connected
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        accounts = await window.ethereum.request({ method: 'eth_accounts' });
      }
      setCurrentAccount(accounts[0]);
    };

    init();
  }, []);

  const getBufferFromCipherParams = (
    cipherParams: CryptoJS.lib.CipherParams,
    originalLength: number
  ) => {
    const ciphertextU8 = convertWordArrayToUint8Array(cipherParams.ciphertext);
    const keyU8 = convertWordArrayToUint8Array(cipherParams.key); // 32
    const ivU8 = convertWordArrayToUint8Array(cipherParams.iv); // 16
    const saltU8 = convertWordArrayToUint8Array(cipherParams.salt); // 8

    // Format of Uint8Array header + body
    // 0-15: original file length of Uint8Array
    // 16-31: ciphertext length of Uint8Array
    // 32-63: keyU8
    // 64-79: ivU8
    // 80-87: saltU8
    // 88~: ciphertext
    const newBuffer = new Uint8Array(88 + ciphertextU8.length);
    newBuffer.set(numberToBytes(originalLength));
    newBuffer.set(numberToBytes(ciphertextU8.length), 16);
    newBuffer.set(keyU8, 32);
    newBuffer.set(ivU8, 64);
    newBuffer.set(saltU8, 80);
    newBuffer.set(ciphertextU8, 88);
    return newBuffer;
  };

  const parseCipherParamsFromBuffer = (buf: Uint8Array) => {
    // decrypt from Uint8Array
    const ciphertext = convertUint8ArrayToWordArray(buf.subarray(88)); // convertUint8ArrayToWordArray(ciphertextU8);
    const originalLength = bytesToNumber(buf.subarray(0, 16));
    const cipherLength = bytesToNumber(buf.subarray(16, 32));
    const key = convertUint8ArrayToWordArray(buf.subarray(32, 64));
    const iv = convertUint8ArrayToWordArray(buf.subarray(64, 80));
    const salt = convertUint8ArrayToWordArray(buf.subarray(80, 88));
    return {
      ciphertext,
      key,
      iv,
      salt,
      originalLength,
      cipherLength
    };
  };

  const encryptData = async (
    data: Uint8Array,
    pwd: string
  ): Promise<Uint8Array> => {
    const wa = convertUint8ArrayToWordArray(data);
    const wordArray = CryptoJS.lib.WordArray.create(wa.words, wa.sigBytes);
    var encrypted = CryptoJS.Rabbit.encrypt(wordArray, pwd);
    return getBufferFromCipherParams(encrypted, data.length);
  };

  const decryptData = async (
    data: Uint8Array,
    pwd: string
  ): Promise<Uint8Array> => {
    const cp = parseCipherParamsFromBuffer(data);
    const cipherParams = CryptoJS.lib.CipherParams.create({
      ciphertext: CryptoJS.lib.WordArray.create(
        cp.ciphertext.words,
        cp.ciphertext.sigBytes
      ),
      key: CryptoJS.lib.WordArray.create(cp.key.words, cp.key.sigBytes),
      iv: CryptoJS.lib.WordArray.create(cp.iv.words, cp.iv.sigBytes),
      salt: CryptoJS.lib.WordArray.create(cp.salt.words, cp.salt.sigBytes)
    });

    var decrypted = CryptoJS.Rabbit.decrypt(cipherParams, pwd);
    const decryptedU8 = convertWordArrayToUint8Array(decrypted);
    const result = decryptedU8.subarray(0, cp.originalLength);
    return result;
  };

  const test = () => {
    console.log('===========================');
    const buf = new Uint8Array(
      Buffer.from(
        'Hello Hello Hello Hellofdfdf ellofdfdf, Hello Hello Hello Hellofdfdf ellofdfdf'
      )
    );
    console.log('original buf and length', buf, buf.length);
    const wa = convertUint8ArrayToWordArray(buf);
    const wordArray = CryptoJS.lib.WordArray.create(wa.words, wa.sigBytes);
    var encrypted = CryptoJS.Rabbit.encrypt(
      wordArray,
      '111fdfasdfsdfasdfasdfasdfas'
    );
    const newBuffer = getBufferFromCipherParams(encrypted, buf.length);

    // Test decrypt
    const cp = parseCipherParamsFromBuffer(newBuffer);
    const cipherParams = CryptoJS.lib.CipherParams.create({
      ciphertext: CryptoJS.lib.WordArray.create(
        cp.ciphertext.words,
        cp.ciphertext.sigBytes
      ),
      key: CryptoJS.lib.WordArray.create(cp.key.words, cp.key.sigBytes),
      iv: CryptoJS.lib.WordArray.create(cp.iv.words, cp.iv.sigBytes),
      salt: CryptoJS.lib.WordArray.create(cp.salt.words, cp.salt.sigBytes)
    });

    var decrypted = CryptoJS.Rabbit.decrypt(
      cipherParams,
      '111fdfasdfsdfasdfasdfasdfas'
    );
    const decryptedU8 = convertWordArrayToUint8Array(decrypted);
    const result = decryptedU8.subarray(0, cp.originalLength);
    console.log('decrypted', result, result.length);
  };

  const generatePassword = () => {
    const len = ENCRYPTION_BIT;
    const charset =
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let retVal = '';
    for (var i = 0, n = charset.length; i < len; ++i) {
      retVal += charset.charAt(Math.floor(Math.random() * n));
    }
    setEncryptionPassword(retVal);
    return retVal;
  };

  const handleCompress = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    console.log('====================');
    const file = Array.from(e.target.files)[0];
    const fileContent = new Uint8Array(await file.arrayBuffer());
    ZstdCodec.run(async (zst: any) => {
      // Compress encrypted data, the file will be smaller
      const simple = new zst.Simple();
      const level = 21;
      try {
        const compressedFile = simple.compress(
          fileContent,
          level
        ) as Uint8Array;
        console.log('original', fileContent, fileContent.length);

        // Encrypt file, the file will be larger
        const encryptedUint8Array = await encryptData(
          compressedFile,
          encryptionPassword
        );

        console.log('encrypt', encryptedUint8Array, encryptedUint8Array.length);

        const blob = new Blob([encryptedUint8Array], {
          type: 'application/octet-stream'
        });
        download(blob, file.name + FILE_EXTENSION);
        compressFile.current.value = null as any;
      } catch (err) {
        console.log(err);
        compressFile.current.value = null as any;
      }
    });
  };

  const handleDecompress = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const file = Array.from(e.target.files)[0];
    if (file.name.substring(file.name.length - 4) !== FILE_EXTENSION) return;
    if (file.arrayBuffer() === undefined || file.arrayBuffer() === null) return;
    const fileContent = new Uint8Array(await file.arrayBuffer());

    // Decrypt file
    const decryptedU8 = await decryptData(fileContent, encryptionPassword);

    // Decompress
    ZstdCodec.run((zst: any) => {
      const simple = new zst.Simple();
      try {
        const result = simple.decompress(decryptedU8) as Uint8Array;
        if (result !== null) {
          console.log('result', result);
          const blob = new Blob([result], {
            type: 'application/octet-stream'
          });
          download(blob, file.name.substring(0, file.name.length - 4));
          decompressFile.current.value = null as any;
        } else {
          console.log('Decompress error');
          decompressFile.current.value = null as any;
        }
      } catch (err) {
        console.log(err);
        decompressFile.current.value = null as any;
      }
    });
  };

  const getEncryptionPublicKey = async () => {
    const encryptionPublicKey = await window.ethereum.request({
      method: 'eth_getEncryptionPublicKey',
      params: [currentAccount]
    });
    setPublicKey(encryptionPublicKey);
  };

  const encryptByPubKey = async () => {
    const encryptData = {
      publicKey,
      data: encryptionPassword,
      version: 'x25519-xsalsa20-poly1305'
    };
    const enc = sigUtil.encrypt(encryptData);
    const buff = stringToUint8Array(JSON.stringify(enc)) as any;
    const encryptedMessage = ethUtil.bufferToHex(buff);
    const compressedEncryptedMessage = hexToString(encryptedMessage);
    setEncryptedPassword(compressedEncryptedMessage);
  };

  const decryptByPubKey = async () => {
    try {
      const m = stringToHex(encryptedPassword);
      const decryptMessage = await window.ethereum.request({
        method: 'eth_decrypt',
        params: [m, currentAccount]
      });
      setDecryptedPassword(decryptMessage);
      return decryptMessage;
    } catch (error) {
      return false;
    }
  };

  return (
    <div className="App">
      <h1>Chatpuppy file encryption lab.</h1>
      <div>
        <h2>Encrypt & compress</h2>
        <input type="file" ref={compressFile} onChange={handleCompress} />
      </div>

      <div>
        <h2>Decrypt & decompress</h2>
        <input type="file" ref={decompressFile} onChange={handleDecompress} />
      </div>

      <div>
        <h2>Rabbit password</h2>
        <textarea
          value={encryptionPassword}
          // onChange={(e) => setEncryptionPassword(e.target.value)}
        ></textarea>
      </div>
      <div>
        <input
          type="button"
          value="Generate a password"
          onClick={generatePassword}
        />
      </div>
      <div>
        <h2>Reciever's public key</h2>
        <textarea
          value={publicKey}
          onChange={(e) => setPublicKey(e.target.value)}
        ></textarea>
      </div>

      <div>
        <input
          type="button"
          value="Get my pub key"
          onClick={(e) => getEncryptionPublicKey()}
        />
      </div>

      <div>
        <h2>Encryption by pub key</h2>
        <textarea value={encryptedPassword}></textarea>
      </div>

      <div>
        <input
          type="button"
          value="Encrypt by pubKey"
          onClick={encryptByPubKey}
        />
      </div>

      <div>
        <h2>Decrypt by private key</h2>
        <textarea value={decryptedPassword}></textarea>
      </div>

      <div>
        <input
          type="button"
          value="Decrypt by priKey"
          onClick={decryptByPubKey}
        />
      </div>
    </div>
  );
};

export default App;
