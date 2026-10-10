/* =====================================================================
   HALAMAN INFORMASI AKADEMIK — Interactions & Motion
   - Mobile navigation toggle (with entrance motion)
   - Header scroll state + scroll progress (rAF-throttled, single listener)
   - Section-rail scroll spy per page (Intersection Observer, guarded)
   - One-shot scroll reveal system with staggered groups
   - Category filter with animated transitions + live status
   ===================================================================== */
(function () {
  "use strict";

  var reduceMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Stop the no-reveal safety net: the main script initialised fine.
  window.clearTimeout(window.__hiaRevealGuard);

  /* ---------------------------------------------------------------
     1. Mobile navigation
     --------------------------------------------------------------- */
  var toggle = document.querySelector(".nav-toggle");
  var mobileNav = document.getElementById("mobile-nav");

  function closeMobileNav() {
    if (!toggle || !mobileNav) return;
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Buka menu navigasi");
    mobileNav.hidden = true;
  }

  if (toggle && mobileNav) {
    toggle.addEventListener("click", function () {
      var isOpen = toggle.getAttribute("aria-expanded") === "true";
      if (isOpen) {
        closeMobileNav();
      } else {
        toggle.setAttribute("aria-expanded", "true");
        toggle.setAttribute("aria-label", "Tutup menu navigasi");
        mobileNav.hidden = false;
      }
    });

    mobileNav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", closeMobileNav);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeMobileNav();
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > 900) closeMobileNav();
    });
  }

  /* ---------------------------------------------------------------
     2. Header scroll state + scroll progress
     One passive listener, work deferred to requestAnimationFrame.
     --------------------------------------------------------------- */
  var header = document.querySelector(".site-header");
  var progressBar = document.querySelector(".scroll-progress");
  var ticking = false;

  function updateScrollState() {
    var doc = document.documentElement;
    var top = window.pageYOffset || doc.scrollTop || 0;
    var max = doc.scrollHeight - window.innerHeight;
    var ratio = max > 0 ? Math.min(1, Math.max(0, top / max)) : 0;

    if (progressBar) progressBar.style.setProperty("--scroll-progress", ratio.toFixed(4));
    if (header) header.classList.toggle("is-scrolled", top > 12);

    ticking = false;
  }

  function onScroll() {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(updateScrollState);
    }
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  updateScrollState();

  /* ---------------------------------------------------------------
     3. Section rail scroll spy — highlight the part of THIS page in view.
     Works per page via [data-rail]; guarded so pages without a rail
     (e.g. the home page) simply skip it.
     --------------------------------------------------------------- */
  var rails = Array.prototype.slice.call(document.querySelectorAll("[data-rail]"));

  rails.forEach(function (rail) {
    var railLinks = Array.prototype.slice.call(
      rail.querySelectorAll(".section-rail__link")
    );
    var railSections = railLinks
      .map(function (link) {
        var href = link.getAttribute("href") || "";
        return href.charAt(0) === "#"
          ? document.getElementById(href.slice(1))
          : null;
      })
      .filter(Boolean);

    if (!railLinks.length || !railSections.length) return;

    function setRailActive(id) {
      railLinks.forEach(function (link) {
        var match = link.getAttribute("href") === "#" + id;
        link.classList.toggle("is-active", match);
        if (match) {
          link.setAttribute("aria-current", "true");
        } else {
          link.removeAttribute("aria-current");
        }
      });
    }

    if ("IntersectionObserver" in window) {
      var railVisible = new Map();

      var railSpy = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            railVisible.set(
              entry.target.id,
              entry.isIntersecting ? entry.intersectionRatio : 0
            );
          });

          var best = null;
          var bestRatio = 0;
          railVisible.forEach(function (ratio, id) {
            if (ratio > bestRatio) {
              bestRatio = ratio;
              best = id;
            }
          });

          if (best) setRailActive(best);
        },
        { rootMargin: "-40% 0px -55% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] }
      );

      railSections.forEach(function (section) {
        railSpy.observe(section);
      });
    }
  });

  /* ---------------------------------------------------------------
     4. Scroll reveal — one-shot, staggered, IO-driven
     --------------------------------------------------------------- */
  var revealEls = Array.prototype.slice.call(document.querySelectorAll("[data-reveal]"));

  // Assign a short stagger delay to children of each reveal group.
  Array.prototype.forEach.call(
    document.querySelectorAll("[data-reveal-group]"),
    function (group) {
      var kids = group.querySelectorAll(":scope > [data-reveal]");
      Array.prototype.forEach.call(kids, function (el, i) {
        el.style.setProperty("--reveal-delay", Math.min(i * 55, 275) + "ms");
      });
    }
  );

  function reveal(el) {
    if (el.classList.contains("is-visible")) return;
    el.classList.add("is-visible");

    if (reduceMotion) {
      el.classList.add("reveal-done");
      return;
    }

    // Clear the fill-mode animation once done so hover transitions work.
    var done = function (event) {
      if (event.target !== el) return;
      el.classList.add("reveal-done");
      el.removeEventListener("animationend", done);
    };
    el.addEventListener("animationend", done);
  }

  if (revealEls.length) {
    if ("IntersectionObserver" in window && !reduceMotion) {
      var revealer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              reveal(entry.target);
              revealer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
      );

      revealEls.forEach(function (el) {
        revealer.observe(el);
      });
    } else {
      // No IO support, or reduced motion: show everything immediately.
      revealEls.forEach(reveal);
    }
  }

  /* ---------------------------------------------------------------
     5. Category filter — animated, accessible
     --------------------------------------------------------------- */
  var filterButtons = Array.prototype.slice.call(document.querySelectorAll(".filter__btn"));
  var filterItems = Array.prototype.slice.call(document.querySelectorAll("[data-category]"));
  var filterStatus = document.getElementById("filter-status");
  var filterEmpty = document.getElementById("filter-empty");

  function cancelAnimations(el) {
    if (typeof el.getAnimations === "function") {
      el.getAnimations().forEach(function (anim) { anim.cancel(); });
    }
  }

  function applyFilter(filter) {
    var visibleCount = 0;
    var shownIndex = 0;

    filterItems.forEach(function (item) {
      var show = filter === "all" || item.getAttribute("data-category") === filter;
      cancelAnimations(item);

      if (show) {
        item.hidden = false;
        // If the item was never scrolled into view, make sure it cannot
        // stay invisible at CSS level after the JS entrance finishes.
        item.classList.add("is-visible", "reveal-done");
        visibleCount++;
        if (!reduceMotion) {
          item.animate(
            [
              { opacity: 0, transform: "translateY(10px)" },
              { opacity: 1, transform: "translateY(0)" }
            ],
            {
              duration: 340,
              delay: (shownIndex % 5) * 45,
              easing: "cubic-bezier(0.16, 1, 0.3, 1)"
            }
          );
        }
        shownIndex++;
      } else if (reduceMotion) {
        item.hidden = true;
      } else {
        var out = item.animate(
          [
            { opacity: 1, transform: "translateY(0)" },
            { opacity: 0, transform: "translateY(-8px)" }
          ],
          { duration: 170, easing: "ease-in" }
        );
        out.onfinish = function () {
          item.hidden = true;
          out.cancel();
        };
      }
    });

    if (filterStatus) {
      if (visibleCount === 0) {
        filterStatus.textContent = "Tidak ada informasi pada kategori ini.";
      } else {
        filterStatus.textContent = visibleCount + " informasi ditampilkan.";
      }
    }

    if (filterEmpty) {
      filterEmpty.hidden = visibleCount !== 0;
    }
  }

  if (filterButtons.length && filterItems.length) {
    var editorialGrid = document.querySelector(".editorial");
    var featureCard = editorialGrid ? editorialGrid.querySelector(".feature") : null;

    function syncEditorialLayout() {
      if (editorialGrid && featureCard) {
        // Base it on the active filter, not the (async) hidden attribute.
        var activeBtn = document.querySelector(".filter__btn.is-active");
        var filter = activeBtn ? activeBtn.getAttribute("data-filter") : "all";
        var show =
          filter === "all" ||
          featureCard.getAttribute("data-category") === filter;
        editorialGrid.classList.toggle("editorial--solo", !show);
      }
    }

    syncEditorialLayout();

    filterButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        var filter = button.getAttribute("data-filter");

        filterButtons.forEach(function (other) {
          var active = other === button;
          other.classList.toggle("is-active", active);
          other.setAttribute("aria-pressed", active ? "true" : "false");
        });

        applyFilter(filter);
        syncEditorialLayout();
      });
    });
  }
})();
