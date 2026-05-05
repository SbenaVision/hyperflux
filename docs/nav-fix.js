// Rewrite navigationLinks hrefs to be relative to the page's actual depth.
// TypeDoc outputs them as root-relative strings but doesn't adjust for page depth.
(function () {
  function fix() {
    var base = document.documentElement.dataset.base || './';
    var selectors = '#tsd-toolbar-links a, #tsd-sidebar-links a.tsd-nav-link';
    document.querySelectorAll(selectors).forEach(function (a) {
      var href = a.getAttribute('href');
      if (href && !href.startsWith('http') && !href.startsWith('/') && !href.startsWith('#')) {
        a.setAttribute('href', base + href);
      }
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fix);
  } else {
    fix();
  }
})();
