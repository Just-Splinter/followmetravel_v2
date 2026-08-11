/* Year-less "DD/MM" departure dates are evergreen: an entry whose day/month
   has already passed this year refers to next year's occurrence. The legacy
   viewer dropped past entries entirely, leaving packages unbookable for most
   of the year. Labels (and the reservation payload) keep the raw strings. */
export function upcomingDepartures(dates) {
  const today = new Date();
  const floor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return (dates || [])
    .map((d) => {
      const [day, month] = String(d.from || "").split("/").map(Number);
      if (!day || !month) return null;
      let when = new Date(today.getFullYear(), month - 1, day);
      if (when < floor) when = new Date(today.getFullYear() + 1, month - 1, day);
      return { ...d, when };
    })
    .filter(Boolean)
    .sort((a, b) => a.when - b.when);
}
