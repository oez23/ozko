// Bewegung der Variante "Foto": Kopfbild zieht beim Scrollen langsam nach, Fotos decken sich beim Erscheinen auf.
(function () {
  if (!window.gsap || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  gsap.registerPlugin(ScrollTrigger);
  gsap.fromTo(".kopf .bild img", { scale: 1.12 }, {
    scale: 1, yPercent: 8, ease: "none",
    scrollTrigger: { trigger: ".kopf", start: "top top", end: "bottom top", scrub: 1 },
  });
  ScrollTrigger.batch(".schwer figure, .galerie figure", {
    start: "top 88%",
    onEnter: function (gruppe) {
      gsap.from(gruppe, { clipPath: "inset(18% 0% 18% 0%)", opacity: 0, duration: 0.9, ease: "power3.out", stagger: 0.1, overwrite: true });
    },
  });
})();
