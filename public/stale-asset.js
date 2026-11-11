// Servi à la place d'un script d'une ancienne version du site (supprimé du
// serveur) : la page en cache du navigateur est rechargée depuis le serveur,
// une seule fois (paramètre _v, retiré ensuite par l'application).
(function () {
  var url = new URL(window.location.href);
  if (url.searchParams.has("_v")) return;
  url.searchParams.set("_v", Date.now().toString(36));
  window.location.replace(url.toString());
})();
