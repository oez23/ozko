// Scroll-Bewegung der Variante "Jahr". Ohne JavaScript oder bei reduzierter Bewegung bleibt die Seite voll lesbar.
(function () {
  if (!window.gsap || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  gsap.registerPlugin(ScrollTrigger);

  // Landschaft im Kopf: Ebenen wandern unterschiedlich schnell (Parallax)
  gsap.utils.toArray(".landschaft [data-tiefe]").forEach(function (ebene) {
    gsap.to(ebene, {
      yPercent: Number(ebene.dataset.tiefe), ease: "none",
      scrollTrigger: { trigger: ".kopf", start: "top top", end: "bottom top", scrub: 1 },
    });
  });

  ScrollTrigger.batch(".leistungen li", {
    start: "top 88%",
    onEnter: function (gruppe) {
      gsap.from(gruppe, { y: 36, opacity: 0, duration: 0.7, ease: "power3.out", stagger: 0.08, overwrite: true });
    },
  });

  // Das Gartenjahr laeuft auf grossen Bildschirmen quer durch, waehrend der Abschnitt stehen bleibt
  var mm = gsap.matchMedia();
  mm.add("(min-width: 52rem)", function () {
    var jahr = document.querySelector(".jahr"), bahn = jahr.querySelector(".bahn");
    jahr.classList.add("quer");
    gsap.to(bahn, {
      x: function () { return -(bahn.scrollWidth - jahr.querySelector(".breite").clientWidth); }, ease: "none",
      scrollTrigger: { trigger: jahr, start: "top top", end: "+=1600", pin: true, scrub: 1, anticipatePin: 1, invalidateOnRefresh: true },
    });
    return function () { jahr.classList.remove("quer"); };
  });
  document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
})();
