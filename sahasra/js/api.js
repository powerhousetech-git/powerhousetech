(function (global) {
  'use strict';

  var API = global.SAHASRA.API;
  var TOKEN_KEY = 'sahasra_portal_token';

  function getToken() {
    try {
      return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
    } catch (_) {
      return null;
    }
  }

  function setToken(token) {
    try {
      sessionStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(TOKEN_KEY, token);
    } catch (_) {}
  }

  function clearToken() {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(TOKEN_KEY);
    } catch (_) {}
  }

  async function request(method, query, body, auth) {
    var url = API + (query ? '?' + query : '');
    var headers = { 'Content-Type': 'application/json' };
    if (auth !== false) {
      var t = getToken();
      if (!t) return { ok: false, status: 401, data: { error: 'Sign in required' } };
      headers.Authorization = 'Bearer ' + t;
    }
    var opts = { method: method, headers: headers };
    if (body != null) opts.body = JSON.stringify(body);
    var res = await fetch(url, opts);
    var data = {};
    try {
      data = await res.json();
    } catch (_) {}
    return { ok: res.ok, status: res.status, data: data };
  }

  global.SahasraApi = {
    getToken: getToken,
    setToken: setToken,
    clearToken: clearToken,
    login: function (username, password) {
      return request('POST', 'op=login', { username: username, password: password }, false);
    },
    me: function () {
      return request('GET', 'op=me');
    },
    listCostings: function (status) {
      var q = 'op=costings';
      if (status) q += '&status=' + encodeURIComponent(status);
      return request('GET', q);
    },
    getCosting: function (id) {
      return request('GET', 'op=costing&id=' + encodeURIComponent(id));
    },
    createCosting: function (payload) {
      return request('POST', 'op=costing', payload);
    },
    patchCosting: function (id, payload) {
      return request('PATCH', 'op=costing&id=' + encodeURIComponent(id), payload);
    },
    deleteCosting: function (id) {
      return request('DELETE', 'op=costing&id=' + encodeURIComponent(id));
    },
    dashboard: function () {
      return request('GET', 'op=dashboard');
    },
    history: function () {
      return request('GET', 'op=history');
    },
    addComment: function (id, body, isFlag) {
      return request('POST', 'op=comment&id=' + encodeURIComponent(id), {
        body: body,
        is_flag: !!isFlag,
      });
    },
  };
})(window);
