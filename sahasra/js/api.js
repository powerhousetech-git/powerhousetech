(function (global) {
  'use strict';

  var API = global.SAHASRA.API;

  async function token() {
    var fb = global.sahasraFirebase;
    if (!fb || !fb.auth || !fb.auth.currentUser) return null;
    return fb.auth.currentUser.getIdToken();
  }

  async function request(method, query, body) {
    var t = await token();
    if (!t) return { ok: false, status: 401, data: { error: 'Sign in required' } };
    var url = API + (query ? '?' + query : '');
    var opts = {
      method: method,
      headers: {
        Authorization: 'Bearer ' + t,
        'Content-Type': 'application/json',
      },
    };
    if (body != null) opts.body = JSON.stringify(body);
    var res = await fetch(url, opts);
    var data = {};
    try {
      data = await res.json();
    } catch (_) {}
    return { ok: res.ok, status: res.status, data: data };
  }

  global.SahasraApi = {
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
    dashboard: function () {
      return request('GET', 'op=dashboard');
    },
  };
})(window);
