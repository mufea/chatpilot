(function () {
  "use strict";
  var current =
    document.currentScript ||
    (function () {
      var nodes = document.getElementsByTagName("script");
      return nodes[nodes.length - 1] || null;
    })();
  if (!current || !current.src) return;
  var next = document.createElement("script");
  next.src = current.src.replace(/\/widget\.js(\?.*)?$/i, "/widget/v1.js$1");
  next.async = true;
  for (var i = 0; i < current.attributes.length; i += 1) {
    var attr = current.attributes[i];
    if (attr.name !== "src") next.setAttribute(attr.name, attr.value);
  }
  (current.parentNode || document.head).insertBefore(next, current.nextSibling);
})();
