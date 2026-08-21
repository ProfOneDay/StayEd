// Canonical list of the municipalities/cities under Pangasinan School
// Division II, id-matched to the <path id="..." data-division-ii="true">
// slugs baked into the admin dashboard's SVG map. Shared by every admin page
// that needs to enumerate Division II municipalities -- the dashboard map
// and the CLC "Add New CLC" municipality picker -- so the list only lives in
// one place.
const DIVISION_II_MUNICIPALITIES = [
  { id: "alcala", name: "Alcala" },
  { id: "asingan", name: "Asingan" },
  { id: "balungao", name: "Balungao" },
  { id: "bautista", name: "Bautista" },
  { id: "binalonan", name: "Binalonan" },
  { id: "dagupan-city", name: "Dagupan City" },
  { id: "laoac", name: "Laoac" },
  { id: "manaoag", name: "Manaoag" },
  { id: "mangaldan", name: "Mangaldan" },
  { id: "natividad", name: "Natividad" },
  { id: "pozorrubio", name: "Pozorrubio" },
  { id: "rosales", name: "Rosales" },
  { id: "san-fabian", name: "San Fabian" },
  { id: "san-jacinto", name: "San Jacinto" },
  { id: "san-manuel", name: "San Manuel" },
  { id: "san-nicolas", name: "San Nicolas" },
  { id: "san-quintin", name: "San Quintin" },
  { id: "santa-maria", name: "Santa Maria" },
  { id: "santo-tomas", name: "Santo Tomas" },
  { id: "sison", name: "Sison" },
  { id: "tayug", name: "Tayug" },
  { id: "umingan", name: "Umingan" },
  { id: "urdaneta-city", name: "Urdaneta City" },
  { id: "villasis", name: "Villasis" },
];

const DIVISION_II_IDS = new Set(DIVISION_II_MUNICIPALITIES.map((m) => m.id));

function slugifyMunicipality(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

window.DIVISION_II_MUNICIPALITIES = DIVISION_II_MUNICIPALITIES;
window.DIVISION_II_IDS = DIVISION_II_IDS;
window.slugifyMunicipality = slugifyMunicipality;
