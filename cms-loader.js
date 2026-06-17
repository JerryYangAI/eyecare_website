/*!
 * 品川光医官网 · 内容绑定脚本 (CMS loader)
 * 读取 /content/*.json，把后台编辑的内容应用到前端。
 * 设计原则：渐进增强 + 防御式。任一文件缺失或字段为空时，
 * 页面保留 HTML 中的默认内容，绝不因数据问题而白屏。
 */
(function () {
  "use strict";

  var BASE = "content/";
  var FILES = ["site", "copy", "images", "videos", "certs", "refs"];

  function getJSON(name) {
    return fetch(BASE + name + ".json", { cache: "no-cache" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  // 安全工具
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function setText(sel, val, root) {
    if (val == null || val === "") return;
    var el = $(sel, root); if (el) el.textContent = val;
  }
  function setAttr(sel, attr, val, root) {
    if (val == null || val === "") return;
    var el = $(sel, root); if (el) el.setAttribute(attr, val);
  }
  function esc(s) { return String(s == null ? "" : s); }
  // 把 emphasized 子串包裹为 <em>（仅替换一次）
  function withEm(text, em) {
    if (!text) return "";
    if (em && text.indexOf(em) !== -1) {
      return esc(text).replace(em, "<em>" + esc(em) + "</em>");
    }
    return esc(text);
  }

  // ---------- 网站设置 + 首屏 ----------
  function applySite(d) {
    if (!d) return;
    if (d.seo_title) document.title = d.seo_title;
    var md = $('meta[name="description"]'); if (md && d.seo_description) md.setAttribute("content", d.seo_description);
    var mk = $('meta[name="keywords"]'); if (mk && d.seo_keywords) mk.setAttribute("content", d.seo_keywords);

    setText(".hero .slogan", d.hero_slogan);
    var h1 = $(".hero h1");
    if (h1 && (d.hero_title_l1 || d.hero_title_l2)) {
      var l1 = esc(d.hero_title_l1);
      var l2 = withEm(d.hero_title_l2, d.hero_title_em);
      h1.innerHTML = l1 + "<br>" + l2;
    }
    setText(".hero .pname", d.hero_product_name);
    setText(".hero p.desc", d.hero_description);
    if (Array.isArray(d.hero_tags) && d.hero_tags.length) {
      var tl = $(".hero .trustline");
      if (tl) tl.innerHTML = d.hero_tags.map(function (t) { return "<span>" + esc(t) + "</span>"; }).join("");
    }
  }

  // ---------- 文案管理 ----------
  function applyCopy(d) {
    if (!d) return;
    var p = d.problem;
    if (p) {
      setText("#problem .eyebrow", p.eyebrow);
      var pt = $("#problem .sec-title");
      if (pt && p.title) pt.innerHTML = esc(p.title) + (p.title_em ? "<em>" + esc(p.title_em) + "</em>" : "") + esc(p.title_tail || "");
      setText("#problem .lead", p.lead);
    }
    var pr = d.principle;
    if (pr) {
      setText("#principle .eyebrow", pr.eyebrow);
      var titles = $all("#principle .sec-title");
      if (titles[0] && pr.title1) titles[0].innerHTML = esc(pr.title1) + (pr.title1_em ? "<em>" + esc(pr.title1_em) + "</em>" : "");
      if (titles[1] && pr.title2) titles[1].innerHTML = esc(pr.title2) + (pr.title2_em ? "<em>" + esc(pr.title2_em) + "</em>" : "");
      setText("#principle .sci .scihead .eyebrow", pr.sci_eyebrow);
      var sh = $("#principle .sci h3");
      if (sh && pr.sci_title) sh.innerHTML = esc(pr.sci_title) + (pr.sci_title_em ? "<em>" + esc(pr.sci_title_em) + "</em>" : "");
    }
    var h = d.heritage;
    if (h) {
      setText("#heritage .eyebrow", h.eyebrow);
      var ht = $("#heritage .sec-title");
      if (ht && h.title) ht.innerHTML = esc(h.title) + (h.title_em ? "<em>" + esc(h.title_em) + "</em>" : "");
      setText("#heritage .lead", h.lead);
    }
    var t = d.trust;
    if (t) {
      var eb = $all("#trust .eyebrow");
      if (eb[0] && t.eyebrow) eb[0].textContent = t.eyebrow;
      var tt = $all("#trust .sec-title");
      if (tt[0] && t.title) tt[0].innerHTML = esc(t.title) + (t.title_em ? "<em>" + esc(t.title_em) + "</em>" : "");
      var vh = $("#trust .vmod h3");
      if (vh && t.vmod_title) vh.innerHTML = esc(t.vmod_title) + (t.vmod_em ? "<em>" + esc(t.vmod_em) + "</em>" : "");
      setText("#trust .vmod .lead", t.vmod_text);
      if (eb[1] && t.honor_eyebrow) eb[1].textContent = t.honor_eyebrow;
      if (tt[1] && t.honor_title) tt[1].innerHTML = esc(t.honor_title) + (t.honor_title_em ? "<em>" + esc(t.honor_title_em) + "</em>" : "");
      var hl = $all("#trust .lead");
      if (hl.length && t.honor_lead) hl[hl.length - 1].textContent = t.honor_lead;
    }
    var c = d.cases;
    if (c) {
      setText("#cases .eyebrow", c.eyebrow);
      var ct = $("#cases .sec-title");
      if (ct && c.title) ct.innerHTML = esc(c.title) + (c.title_em ? "<em>" + esc(c.title_em) + "</em>" : "");
    }
    // 底端内容
    var f = d.footer;
    if (f) {
      var fi = $("footer .ft > div:first-child p"); if (fi && f.intro) fi.textContent = f.intro;
      var em = $('footer a[href^="mailto:"]'); if (em && f.email) { em.textContent = f.email; em.setAttribute("href", "mailto:" + f.email); }
      if (f.legal) { var lg = $("footer .legal"); if (lg) lg.innerHTML = f.legal + '<br>© 2026 品川光医 KOUSHICARE · 保留所有权利'; }
    }
  }

  // ---------- 图片管理 ----------
  function applyImages(d) {
    if (!d || !Array.isArray(d.items)) return;
    var map = {
      "hero": ".hero-bg img",
      "scene-screen": '#problem .grid .card:nth-child(1) img',
      "scene-latenight": '#problem .grid .card:nth-child(2) img',
      "scene-ac": '#problem .grid .card:nth-child(3) img',
      "scene-lens": '#problem .grid .card:nth-child(4) img',
      "tearfilm": "#principle .tearwrap img",
      "rnd": '#trust .grid .card:nth-child(1) img',
      "production2": '#trust .grid .card:nth-child(2) img',
      "qc": '#trust .grid .card:nth-child(3) img'
    };
    d.items.forEach(function (it) {
      if (it.key && map[it.key] && it.src) setAttr(map[it.key], "src", it.src);
    });
  }

  // ---------- 视频管理 ----------
  function applyVideos(d) {
    if (!d || !Array.isArray(d.items)) return;
    var map = {
      "redlight": '#principle .dual .panel:nth-child(1) video',
      "heat": '#principle .dual .panel:nth-child(2) video',
      "factory": '#trust .vmod video',
      "reviews": '#cases video'
    };
    d.items.forEach(function (it) {
      if (!it.key || !map[it.key]) return;
      var v = $(map[it.key]); if (!v) return;
      if (it.poster) v.setAttribute("poster", it.poster);
      var src = v.querySelector("source");
      if (it.src && src) { src.setAttribute("src", it.src); v.load && v.load(); }
    });
  }

  // ---------- 资质证书（首屏证书墙）----------
  function applyCerts(d) {
    if (!d || !Array.isArray(d.items) || !d.items.length) return;
    var wrap = $(".hero .certs"); if (!wrap) return;
    var html = d.items.map(function (it) {
      return '<img src="' + esc(it.src) + '" alt="' + esc(it.title) + '" data-lb>';
    }).join("");
    html += '<span class="more">点击证书可放大查看</span>';
    wrap.innerHTML = html;
  }

  // ---------- 文献资料（references.html 列表）----------
  function applyRefs(d) {
    if (!d || !Array.isArray(d.items)) return;
    var box = $("#cms-refs"); if (!box) return; // 仅在存在容器的页面渲染
    var rows = d.items.filter(function (it) { return it.title; }).map(function (it) {
      var label = esc(it.title) + (it.year ? "（" + esc(it.year) + "）" : "");
      return it.file
        ? '<li><a href="' + esc(it.file) + '" target="_blank" rel="noopener">' + label + ' · 下载原文 →</a></li>'
        : "<li>" + label + "</li>";
    }).join("");
    box.innerHTML = rows ? "<ul>" + rows + "</ul>" : "";
  }

  // 证书替换后重新绑定 lightbox
  function rebindLightbox() {
    var lb = $("#lightbox"); if (!lb) return;
    var lbi = lb.querySelector("img");
    $all("[data-lb]").forEach(function (im) {
      im.addEventListener("click", function () { lbi.src = im.src; lb.classList.add("open"); });
    });
  }

  function run() {
    Promise.all(FILES.map(getJSON)).then(function (res) {
      var data = {};
      FILES.forEach(function (n, i) { data[n] = res[i]; });
      try { applySite(data.site); } catch (e) {}
      try { applyCopy(data.copy); } catch (e) {}
      try { applyImages(data.images); } catch (e) {}
      try { applyVideos(data.videos); } catch (e) {}
      try { applyCerts(data.certs); } catch (e) {}
      try { applyRefs(data.refs); } catch (e) {}
      try { rebindLightbox(); } catch (e) {}
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
