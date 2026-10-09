// Liveries and part notes for the 2026 car viewer.

export interface Livery {
  id: string;
  name: string;
  /** names this team goes by in forecasts-2026.json */
  aliases: string[];
  body: string;
  accent: string;
}

// Approximate 2026 colour schemes: main bodywork colour and the accent stripe.
export const LIVERIES: Livery[] = [
  { id: "mercedes", name: "Mercedes", aliases: ["Mercedes"], body: "#17191d", accent: "#00d7b6" },
  { id: "ferrari", name: "Ferrari", aliases: ["Ferrari"], body: "#d4001a", accent: "#f4f4f4" },
  { id: "mclaren", name: "McLaren", aliases: ["McLaren"], body: "#ff8000", accent: "#15181c" },
  { id: "redbull", name: "Red Bull", aliases: ["Red Bull", "Red Bull Racing"], body: "#1c2756", accent: "#e2231a" },
  { id: "aston", name: "Aston Martin", aliases: ["Aston Martin"], body: "#0b5a4e", accent: "#cedc00" },
  { id: "alpine", name: "Alpine", aliases: ["Alpine", "Alpine F1 Team"], body: "#1a73d9", accent: "#ff87bc" },
  { id: "williams", name: "Williams", aliases: ["Williams"], body: "#0d2d6c", accent: "#00a3e0" },
  { id: "rb", name: "Racing Bulls", aliases: ["Racing Bulls", "RB F1 Team", "RB"], body: "#eef1f6", accent: "#1d3fd1" },
  { id: "haas", name: "Haas", aliases: ["Haas", "Haas F1 Team"], body: "#ececec", accent: "#d61a1a" },
  { id: "audi", name: "Audi", aliases: ["Audi", "Kick Sauber", "Sauber"], body: "#8f959b", accent: "#f50537" },
  { id: "cadillac", name: "Cadillac", aliases: ["Cadillac", "Cadillac F1 Team"], body: "#141414", accent: "#e6e6e6" },
];

export const liveryFor = (team: string) => LIVERIES.find((l) => l.aliases.includes(team)) ?? LIVERIES[0];

export type PartKey = "frontWing" | "nose" | "chassis" | "sidepods" | "floor" | "power" | "rearWing" | "wheels";

export interface PartNote {
  key: PartKey;
  name: string;
  note: string;
}

// Headline numbers from the FIA's 2026 technical regulations. The model is built to these, not to any team's car.
export const PARTS: PartNote[] = [
  {
    key: "frontWing",
    name: "Front wing",
    note: "Now active. Its flaps lie flatter in straight-line mode and close up again for the corners.",
  },
  { key: "nose", name: "Nose", note: "Carries the front impact structure, sitting on the wing's main plane." },
  {
    key: "chassis",
    name: "Survival cell",
    note: "Carbon monocoque and titanium halo. The whole car must weigh at least 768 kg, down from 800 kg.",
  },
  {
    key: "sidepods",
    name: "Sidepods",
    note: "Cooling inlets for a power unit that now takes about half its output from the battery.",
  },
  {
    key: "floor",
    name: "Floor",
    note: "Partly flat, with a smaller diffuser: less ground-effect downforce than the 2022–25 cars.",
  },
  {
    key: "power",
    name: "Power unit",
    note: "1.6 L turbo V6 on fully sustainable fuel. The MGU-H is gone; the MGU-K rises from 120 kW to 350 kW.",
  },
  {
    key: "rearWing",
    name: "Rear wing",
    note: "Active too. DRS is gone: in straight-line mode the flap opens on every straight, for every driver.",
  },
  {
    key: "wheels",
    name: "Wheels",
    note: "Still 18-inch rims, on tyres 25 mm narrower at the front and 30 mm at the rear.",
  },
];

export const SPECS: { label: string; value: string; was: string }[] = [
  { label: "Wheelbase", value: "3,400 mm", was: "3,600" },
  { label: "Width", value: "1,900 mm", was: "2,000" },
  { label: "Minimum weight", value: "768 kg", was: "800" },
  { label: "Electric power", value: "350 kW", was: "120" },
];
