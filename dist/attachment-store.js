(() => {
  'use strict';
  let connection;
  function open() {
    if (!connection) connection = new Promise((resolve, reject) => {
      if (!window.indexedDB) { reject(new Error('O navegador não oferece armazenamento de arquivos.')); return; }
      let abandoned = false;
      const request = indexedDB.open(window.EloAuth.storageKey('elojus-files-v1'), 1);
      request.onupgradeneeded = () => request.result.createObjectStore('files', { keyPath: 'id' });
      request.onsuccess = () => { const db = request.result; if (abandoned) { db.close(); return; } db.onversionchange = () => { db.close(); connection = null; }; resolve(db); };
      request.onerror = () => { connection = null; reject(new Error('Não foi possível abrir o armazenamento local.')); };
      request.onblocked = () => { abandoned = true; connection = null; reject(new Error('Feche outras abas da EloJus e tente novamente.')); };
    });
    return connection;
  }
  async function transaction(mode, operation) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('files', mode); let result;
      const request = operation(tx.objectStore('files'));
      request.onsuccess = () => { result = request.result; };
      tx.oncomplete = () => resolve(result);
      tx.onerror = tx.onabort = () => reject(new Error('Não foi possível salvar ou ler o arquivo. Verifique o espaço e as permissões do navegador.'));
    });
  }
  const get = id => transaction('readonly', store => store.get(id));
  const put = record => transaction('readwrite', store => store.put(record));
  const remove = id => transaction('readwrite', store => store.delete(id));
  const keys = () => transaction('readonly', store => store.getAllKeys());
  window.EloFileStore = { get, put, remove, keys };
})();
