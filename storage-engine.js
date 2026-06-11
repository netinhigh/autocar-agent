// ============================================================
// StorageEngine - 双存储引擎 v1.0
//   本地：IndexedDB（无容量限制）
//   云端：Supabase user_data 表（100MB/账号 配额限制）
//   策略：双写（本地+云端），加载时云端优先，本地兜底
// ============================================================

var StorageEngine = (function () {
  'use strict';

  var DB_NAME = 'autocar_local_storage';
  var DB_VERSION = 2;
  var STORE_NAME = 'userData';
  var CLOUD_QUOTA_BYTES = 100 * 1024 * 1024;   // 100 MB

  var db = null;
  var dbReady = false;
  var _initPromise = null;

  // ========== IndexedDB 初始化 ==========

  function _initDB() {
    if (_initPromise) return _initPromise;
    _initPromise = new Promise(function (resolve) {
      if (!window.indexedDB) {
        console.warn('[StorageEngine] IndexedDB 不可用，仅使用云端');
        resolve(false);
        return;
      }
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function (e) {
        var d = e.target.result;
        if (!d.objectStoreNames.contains(STORE_NAME)) {
          d.createObjectStore(STORE_NAME, { keyPath: 'data_key' });
        }
      };
      req.onsuccess = function (e) {
        db = e.target.result;
        dbReady = true;
        console.log('[StorageEngine] IndexedDB 就绪');
        resolve(true);
      };
      req.onerror = function (e) {
        console.warn('[StorageEngine] IndexedDB 错误:', e.target.error);
        resolve(false);
      };
      req.onblocked = function () {
        console.warn('[StorageEngine] IndexedDB blocked，请关闭其他标签页');
        resolve(false);
      };
    });
    return _initPromise;
  }

  // ========== IndexedDB 读写 ==========

  function _localGet(key) {
    return _initDB().then(function (ok) {
      if (!ok || !db) return null;
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction(STORE_NAME, 'readonly');
          var req = tx.objectStore(STORE_NAME).get(key);
          req.onsuccess = function () { resolve(req.result ? req.result.data_value : null); };
          req.onerror = function () { resolve(null); };
        } catch (e) { resolve(null); }
      });
    });
  }

  function _localSet(key, value) {
    return _initDB().then(function (ok) {
      if (!ok || !db) return false;
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).put({
            data_key: key,
            data_value: value,
            size_bytes: _sizeBytes(value),
            updated_at: Date.now()
          });
          tx.oncomplete = function () { resolve(true); };
          tx.onerror = function () { resolve(false); };
        } catch (e) { resolve(false); }
      });
    });
  }

  function _localDelete(key) {
    return _initDB().then(function (ok) {
      if (!ok || !db) return false;
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).delete(key);
          tx.oncomplete = function () { resolve(true); };
          tx.onerror = function () { resolve(false); };
        } catch (e) { resolve(false); }
      });
    });
  }

  function _localGetAllKeys() {
    return _initDB().then(function (ok) {
      if (!ok || !db) return [];
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction(STORE_NAME, 'readonly');
          var req = tx.objectStore(STORE_NAME).getAllKeys();
          req.onsuccess = function () { resolve(req.result || []); };
          req.onerror = function () { resolve([]); };
        } catch (e) { resolve([]); }
      });
    });
  }

  function _localTotalSize() {
    return _initDB().then(function (ok) {
      if (!ok || !db) return 0;
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction(STORE_NAME, 'readonly');
          var req = tx.objectStore(STORE_NAME).getAll();
          req.onsuccess = function () {
            var total = 0;
            (req.result || []).forEach(function (r) { total += (r.size_bytes || 0); });
            resolve(total);
          };
          req.onerror = function () { resolve(0); };
        } catch (e) { resolve(0); }
      });
    });
  }

  // ========== 工具 ==========

  function _sizeBytes(value) {
    try { return new Blob([JSON.stringify(value)]).size; } catch (e) { return 0; }
  }

  function _formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(2) + ' MB';
  }

  // ========== 云端操作 ==========

  function _cloudSave(key, value) {
    return new Promise(function (resolve) {
      if (!_cloudReady()) { resolve({ ok: false, reason: '未登录' }); return; }

      var size = _sizeBytes(value);

      // 查询当前总用量，检查配额
      window.Auth.loadAllUserData().then(function (all) {
        var oldSize = all[key] ? _sizeBytes(all[key]) : 0;
        var current = 0;
        Object.keys(all).forEach(function (k) { current += _sizeBytes(all[k]); });
        var newTotal = current - oldSize + size;

        if (newTotal > CLOUD_QUOTA_BYTES) {
          resolve({
            ok: false, reason: '云端配额不足',
            usage: current, quota: CLOUD_QUOTA_BYTES, newTotal: newTotal
          });
          return;
        }

        window.Auth.saveUserData(key, value).then(function () {
          console.log('[StorageEngine] ☁ 云端写入: ' + key + ' (' + _formatBytes(size) + ')');
          resolve({ ok: true, size: size });
        }).catch(function (e) {
          resolve({ ok: false, reason: e.message });
        });
      }).catch(function () {
        // 无法查询用量，直接尝试保存
        window.Auth.saveUserData(key, value).then(function () {
          resolve({ ok: true, size: size });
        }).catch(function (e) {
          resolve({ ok: false, reason: e.message });
        });
      });
    });
  }

  function _cloudLoad(key) {
    return new Promise(function (resolve) {
      if (!_cloudReady()) { resolve(null); return; }
      window.Auth.loadUserData(key).then(function (d) { resolve(d); })
        .catch(function () { resolve(null); });
    });
  }

  function _cloudReady() {
    return !!(window.SUPABASE_READY && window.Auth && window.Auth.getCurrentUser);
  }

  // ========== 公共 API ==========

  return {

    // ---- 配额常量 ----
    CLOUD_QUOTA_BYTES: CLOUD_QUOTA_BYTES,

    // ---- 初始化（预加载 IndexedDB）----
    init: function () { return _initDB(); },

    // ===================================================================
    // 核心：保存 —— 双写：本地(IndexedDB) + 云端(Supabase)
    //   云端失败不影响本地，数据不会丢失
    //   返回 Promise<{ key, local:bool, cloud:{ok, ...} }>
    // ===================================================================
    save: function (key, value) {
      var r = { key: key, local: false, cloud: null, cloudSkipped: null };

      return _localSet(key, value).then(function (ok) {
        r.local = ok;
        console.log('[StorageEngine] 💾 本地写入: ' + key + (ok ? ' ✓' : ' ✗'));

        return _cloudSave(key, value).then(function (cr) {
          r.cloud = cr;
          if (!cr.ok) {
            r.cloudSkipped = cr.reason;
            console.warn('[StorageEngine] ☁ 云端跳过(' + key + '):', cr.reason, '| 数据已存本地');
          }
          return r;
        });
      });
    },

    // ===================================================================
    // 核心：加载 —— 云端优先，本地兜底
    //   返回 Promise<{ data, source:'cloud'|'local'|null }>
    // ===================================================================
    load: function (key) {
      return _cloudLoad(key).then(function (cd) {
        if (cd !== null && cd !== undefined) {
          console.log('[StorageEngine] ☁ 云读: ' + key);
          return { data: cd, source: 'cloud' };
        }
        return _localGet(key).then(function (ld) {
          if (ld !== null && ld !== undefined) {
            console.log('[StorageEngine] 💾 本读: ' + key);
            return { data: ld, source: 'local' };
          }
          return { data: null, source: null };
        });
      });
    },

    // ---- 仅本地 ----
    saveLocalOnly: function (key, value) { return _localSet(key, value); },
    loadLocalOnly: function (key) { return _localGet(key); },

    // ---- 仅云端 ----
    saveCloudOnly: function (key, value) { return _cloudSave(key, value); },
    loadCloudOnly: function (key) { return _cloudLoad(key); },

    // ---- 用量查询 ----
    getCloudUsage: function () {
      return new Promise(function (resolve) {
        if (!_cloudReady()) { resolve(null); return; }
        window.Auth.loadAllUserData().then(function (all) {
          var total = 0;
          Object.keys(all).forEach(function (k) { total += _sizeBytes(all[k]); });
          resolve({
            bytes: total,
            formatted: _formatBytes(total),
            quotaBytes: CLOUD_QUOTA_BYTES,
            quotaFormatted: _formatBytes(CLOUD_QUOTA_BYTES),
            percent: total > 0 ? Math.round(total / CLOUD_QUOTA_BYTES * 1e4) / 100 : 0,
            nearLimit: total > CLOUD_QUOTA_BYTES * 0.85,
            overLimit: total > CLOUD_QUOTA_BYTES
          });
        }).catch(function () { resolve(null); });
      });
    },

    getLocalUsage: function () {
      return _localTotalSize().then(function (bytes) {
        return { bytes: bytes, formatted: _formatBytes(bytes), unlimited: true };
      });
    },

    // ---- 诊断 ----
    getStatus: function () {
      return Promise.all([
        new Promise(function (r) {
          _cloudReady()
            ? window.Auth.loadAllUserData().then(function (all) {
                var t = 0;
                Object.keys(all).forEach(function (k) { t += _sizeBytes(all[k]); });
                r(t);
              }).catch(function () { r(0); })
            : r(0);
        }),
        _localTotalSize(),
        _localGetAllKeys()
      ]).then(function (arr) {
        return {
          local: {
            ok: dbReady,
            bytes: arr[1],
            formatted: _formatBytes(arr[1]),
            keys: arr[2]
          },
          cloud: {
            ok: _cloudReady(),
            bytes: arr[0],
            formatted: _formatBytes(arr[0]),
            quotaBytes: CLOUD_QUOTA_BYTES,
            quotaFormatted: _formatBytes(CLOUD_QUOTA_BYTES),
            percent: arr[0] > 0 ? Math.round(arr[0] / CLOUD_QUOTA_BYTES * 1e4) / 100 : 0
          }
        };
      });
    },

    // ---- 清理 ----
    clearLocal: function () {
      return _initDB().then(function (ok) {
        if (!ok) return false;
        return new Promise(function (resolve) {
          try {
            var tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).clear();
            tx.oncomplete = function () { console.log('[StorageEngine] 本地已清空'); resolve(true); };
            tx.onerror = function () { resolve(false); };
          } catch (e) { resolve(false); }
        });
      });
    },

    clearLocalKey: function (key) { return _localDelete(key); },

    // ---- 工具 ----
    formatBytes: _formatBytes,
    sizeBytes: _sizeBytes,

    // ---- 兼容 localStorage 的紧急备份（用于跨标签页同步等场景）----
    backupToLocalStorage: function (key, value) {
      try {
        localStorage.setItem('vc_se_' + key, JSON.stringify({ v: value, t: Date.now() }));
      } catch (e) { /* localStorage 满了 */ }
    },

    restoreFromLocalStorage: function (key) {
      try {
        var raw = localStorage.getItem('vc_se_' + key);
        return raw ? JSON.parse(raw).v : null;
      } catch (e) { return null; }
    }
  };
})();
