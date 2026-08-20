// Canonical room-type vocabulary. `label` is what actually ends up on a
// reservation's `rooms[].type` (see BookingFlow.jsx submit()) — the hotel
// catalog's room inventory must use the exact same labels, otherwise
// availability can never be matched against real bookings.
export const ROOM_TYPES = [
  { key: "triple", label: "Triple", colIdx: 0, paxPerRoom: 3 },
  { key: "double", label: "Double", colIdx: 1, paxPerRoom: 2 },
  { key: "single", label: "Single", colIdx: 2, paxPerRoom: 1 },
  { key: "child", label: "2–5 ans", colIdx: 3, paxPerRoom: 1 },
];
