// Montant en toutes lettres (factures et reçus : « Arrêtée la présente
// facture à la somme de … dirhams »). Orthographe rectifiée de 1990 : tous
// les nombres composés sont reliés par des traits d'union.

const UNITS = [
  "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix",
  "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf",
];
const TENS = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante", "quatre-vingt", "quatre-vingt"];

function belowHundred(n: number): string {
  if (n < 20) return UNITS[n];
  const t = Math.floor(n / 10);
  let u = n % 10;
  // 70-79 et 90-99 : soixante-dix…, quatre-vingt-dix…
  if (t === 7 || t === 9) u += 10;
  if (u === 0) return t === 8 ? "quatre-vingts" : TENS[t];
  const link = (u === 1 || u === 11) && t !== 8 && t !== 9 ? "-et-" : "-";
  return `${TENS[t]}${link}${UNITS[u]}`;
}

function belowThousand(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const restWords = rest ? belowHundred(rest) : "";
  if (h === 0) return restWords;
  const hundreds = h === 1 ? "cent" : `${UNITS[h]}-cent${rest === 0 ? "s" : ""}`;
  return rest ? `${hundreds}-${restWords}` : hundreds;
}

export function numberToFrench(value: number): string {
  let n = Math.floor(Math.abs(value));
  if (n === 0) return "zéro";
  const parts: string[] = [];
  const scales: [number, string, string][] = [
    [1_000_000_000, "milliard", "milliards"],
    [1_000_000, "million", "millions"],
  ];
  for (const [size, one, many] of scales) {
    const q = Math.floor(n / size);
    if (q) {
      parts.push(`${numberToFrench(q)}-${q > 1 ? many : one}`);
      n %= size;
    }
  }
  const thousands = Math.floor(n / 1000);
  if (thousands) {
    // « mille » est invariable ; « cents » et « vingts » perdent leur s devant
    // mille (deux-cent-mille, quatre-vingt-mille), pas devant million.
    parts.push(thousands === 1 ? "mille" : `${belowThousand(thousands).replace(/(cent|vingt)s$/, "$1")}-mille`);
    n %= 1000;
  }
  if (n) parts.push(belowThousand(n));
  return parts.join("-");
}

/** « dix-mille-cinq-cents dirhams » (+ centimes s'il y en a). */
export function amountInWords(amount: number): string {
  const whole = Math.floor(Math.abs(amount));
  const cents = Math.round((Math.abs(amount) - whole) * 100);
  const dh = `${numberToFrench(whole)} dirham${whole > 1 ? "s" : ""}`;
  return cents ? `${dh} et ${numberToFrench(cents)} centime${cents > 1 ? "s" : ""}` : dh;
}
