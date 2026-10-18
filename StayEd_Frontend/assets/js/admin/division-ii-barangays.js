// Barangays of each Pangasinan School Division II municipality, keyed by the
// same slug ids used in DIVISION_II_MUNICIPALITIES. Drives the Barangay
// dropdown in the CLC "Add New CLC" / "Edit CLC" modal so barangay names are
// picked from a fixed list instead of typed free-form.
const DIVISION_II_BARANGAYS = {
  "alcala": [
    "Anulid", "Atainan", "Bersamin", "Canarvacanan", "Caranglaan", "Curareng",
    "Gualsic", "Kisikis", "Laoac", "Macayo", "Pindangan Centro", "Pindangan East",
    "Pindangan West", "Poblacion East", "Poblacion West", "San Juan", "San Nicolas",
    "San Pedro Apartado", "San Pedro Ili", "San Vicente", "Vacante",
  ],
  "asingan": [
    "Ariston East", "Ariston West", "Bantog", "Baro", "Bobonan", "Cabalitian",
    "Calepaan", "Carosucan Norte", "Carosucan Sur", "Coldit", "Domanpot", "Dupac",
    "Macalong", "Palaris", "Poblacion East", "Poblacion West", "San Vicente Este",
    "San Vicente Weste", "Sanchez", "Sobol", "Toboy",
  ],
  "balungao": [
    "Angayan Norte", "Angayan Sur", "Capulaan", "Esmeralda", "Kita-kita", "Mabini",
    "Mauban", "Poblacion", "Pugaro", "Rajal", "San Andres", "San Aurelio 1st",
    "San Aurelio 2nd", "San Aurelio 3rd", "San Joaquin", "San Julian", "San Leon",
    "San Marcelino", "San Miguel", "San Raymundo",
  ],
  "bautista": [
    "Artacho", "Baluyot", "Cabuaan", "Cacandongan", "Diaz", "Ketegan", "Nandacan",
    "Nibaliw Norte", "Nibaliw Sur", "Palisoc", "Poblacion East", "Poblacion West",
    "Pogo", "Poponto", "Primicias", "Sinabaan", "Vacante", "Villanueva",
  ],
  "binalonan": [
    "Balangobong", "Bued", "Bugayong", "Camangaan", "Canarvacanan", "Capas", "Cili",
    "Dumayat", "Linmansangan", "Mangcasuy", "Moreno", "Pasileng Norte",
    "Pasileng Sur", "Poblacion", "San Felipe Central", "San Felipe Sur", "San Pablo",
    "Santa Catalina", "Santa Maria Norte", "Santiago", "Santo Niño", "Sumabnit",
    "Tabuyoc", "Vacante",
  ],
  "laoac": [
    "Anis", "Balligi", "Banuar", "Botigue", "Caaringayan", "Cabilaoan",
    "Cabulalaan", "Calaoagan", "Calmay", "Casampagaan", "Casanestebanan",
    "Casantiagoan", "Domingo Alarcio", "Inmanduyan", "Lebueg", "Maraboc",
    "Nanbagatan", "Panaga", "Poblacion", "Talogtog", "Turko", "Yatyat",
  ],
  "manaoag": [
    "Babasit", "Baguinay", "Baritao", "Bisal", "Bucao", "Cabanbanan", "Calaocan",
    "Inamotan", "Lelemaan", "Licsi", "Lipit Norte", "Lipit Sur", "Matulong",
    "Mermer", "Nalsian", "Oraan East", "Oraan West", "Pantal", "Pao", "Parian",
    "Poblacion", "Pugaro", "San Ramon", "Santa Ines", "Sapang", "Tebuel",
  ],
  "mangaldan": [
    "Alitaya", "Amansabina", "Anolid", "Banaoang", "Bantayan", "Bari", "Bateng",
    "Buenlag", "David", "Embarcadero", "Gueguesangen", "Guesang", "Guiguilonen",
    "Guilig", "Inlambo", "Lanas", "Landas", "Maasin", "Macayug", "Malabago",
    "Navaluan", "Nibaliw", "Osiem", "Palua", "Poblacion", "Pogo", "Salaan", "Salay",
    "Talogtog", "Tebag",
  ],
  "natividad": [
    "Barangobong", "Batchelor East", "Batchelor West", "Burgos", "Cacandungan",
    "Calapugan", "Canarem", "Luna", "Poblacion East", "Poblacion West", "Rizal",
    "Salud", "San Eugenio", "San Macario Norte", "San Macario Sur", "San Maximo",
    "San Miguel", "Silag",
  ],
  "pozorrubio": [
    "Alipangpang", "Amagbagan", "Balacag", "Banding", "Bantugan", "Batakil",
    "Bobonan", "Buneg", "Cablong", "Casanfernandoan", "Castaño", "Dilan",
    "Don Benito", "Haway", "Imbalbalatong", "Inoman", "Laoac", "Maambal", "Malasin",
    "Malokiat", "Manaol", "Nama", "Nantangalan", "Palacpalac", "Palguyod",
    "Poblacion District I", "Poblacion District II", "Poblacion District III",
    "Poblacion District IV", "Rosario", "Sugcong", "Talogtog", "Tulnac", "Villegas",
  ],
  "rosales": [
    "Acop", "Bakit-Bakit", "Balincanaway", "Cabalaoangan Norte",
    "Cabalaoangan Sur", "Calanutan", "Camangaan", "Capitan Tomas", "Carmay East",
    "Carmay West", "Carmen East", "Carmen West", "Casanicolasan", "Coliling",
    "Don Antonio Village", "Guiling", "Palakipak", "Pangaoan", "Rabago", "Rizal",
    "Salvacion", "San Angel", "San Antonio", "San Bartolome", "San Isidro",
    "San Luis", "San Pedro East", "San Pedro West", "San Vicente",
    "Station District", "Tumana East", "Tumana West", "Zone I (Poblacion)",
    "Zone II (Poblacion)", "Zone III (Poblacion)", "Zone IV (Poblacion)",
    "Zone V (Poblacion)",
  ],
  "san-fabian": [
    "Alacan", "Ambalangan-Dalin", "Angio", "Anonang", "Aramal", "Bigbiga", "Binday",
    "Bolaoen", "Bolasi", "Cabaruan", "Cayanga", "Colisao", "Gumot",
    "Inmalog Norte", "Inmalog Sur", "Lekep-Butao", "Lipit-Tomeeng",
    "Longos Central", "Longos Proper", "Longos-Amangonan-Parac-Parac Fabrica",
    "Mabilao", "Nibaliw Central", "Nibaliw East", "Nibaliw Magliba",
    "Nibaliw Narvarte", "Nibaliw Vidal", "Palapad", "Poblacion", "Rabon",
    "Sagud-Bahley", "Sobol", "Tempra-Guilig", "Tiblong", "Tocok",
  ],
  "san-jacinto": [
    "Awai", "Bagong Pag-asa", "Bolo", "Capaoay", "Casibong", "Guibel", "Imelda",
    "Labney", "Lobong", "Macayug", "Magsaysay", "San Guillermo", "San Jose",
    "San Juan", "San Roque", "San Vicente", "Santa Cruz", "Santa Maria",
    "Santo Tomas",
  ],
  "san-manuel": [
    "Cabacaraan", "Cabaritan", "Flores", "Guiset Norte", "Guiset Sur", "Lapalo",
    "Nagsaag", "Narra", "San Antonio-Arzadon", "San Bonifacio", "San Juan",
    "San Roque", "San Vicente", "Santo Domingo",
  ],
  "san-nicolas": [
    "Bensican", "Cabitnongan", "Cabuloan", "Cacabugaoan", "Calanutian", "Calaocan",
    "Camangaan", "Camindoroan", "Casaratan", "Dalumpinas", "Fianza", "Lungao",
    "Malico", "Malilion", "Nagkaysa", "Nining", "Poblacion East", "Poblacion West",
    "Salingcob", "Salpad", "San Felipe East", "San Felipe West", "San Isidro",
    "San Jose", "San Rafael Centro", "San Rafael East", "San Rafael West",
    "San Roque", "Santa Maria East", "Santa Maria West", "Santo Tomas", "Siblot",
    "Sobol",
  ],
  "san-quintin": [
    "Alac", "Baligayan", "Bantog", "Bolintaguen", "Cabalaoangan", "Cabangaran",
    "Calomboyan", "Carayacan", "Casantamaria-an", "Gonzalo", "Labuan", "Lagasit",
    "Lumayao", "Mabini", "Mantacdang", "Nangapugan", "Poblacion Zone I",
    "Poblacion Zone II", "Poblacion Zone III", "San Pedro", "Ungib",
  ],
  "santo-tomas": [
    "La Luna", "Poblacion East", "Poblacion West", "Salvacion", "San Agustin",
    "San Antonio", "San Jose", "San Marcos", "Santo Domingo", "Santo Niño",
  ],
  "sison": [
    "Agat", "Alibeng", "Amagbagan", "Artacho", "Asan Norte", "Asan Sur",
    "Bantay Insik", "Bila", "Binmeckeg", "Bulaoen East", "Bulaoen West", "Cabaritan",
    "Calunetan", "Camangaan", "Cauringan", "Dungon", "Esperanza", "Inmalog",
    "Killo", "Labayug", "Paldit", "Pindangan", "Pinmilapil", "Poblacion Central",
    "Poblacion Norte", "Poblacion Sur", "Sagunto", "Tara-tara",
  ],
  "santa-maria": [
    "Bal-loy", "Bantog", "Caboluan", "Cal-litang", "Capandanan", "Cauplasan",
    "Dalayap", "Libsong", "Namagbagan", "Paitan", "Pataquid", "Pilar",
    "Poblacion East", "Poblacion West", "Pugot", "Samon", "San Alejandro",
    "San Mariano", "San Pablo", "San Patricio", "San Vicente", "Santa Cruz",
    "Santa Rosa",
  ],
  "tayug": [
    "Agno", "Amistad", "Barangobong", "C. Lichauco", "Carriedo", "Evangelista",
    "Guzon", "Lawak", "Legaspi", "Libertad", "Magallanes", "Panganiban",
    "Poblacion A", "Poblacion B", "Poblacion C", "Poblacion D", "Saleng",
    "Santo Domingo", "Toketec", "Trenchera", "Zamora",
  ],
  "umingan": [
    "Abot Molina", "Alo-o", "Amaronan", "Annam", "Bantug", "Baracbac", "Barat",
    "Buenavista", "Cabalitian", "Cabangaran", "Cabaruan", "Cabatuan", "Cadiz",
    "Calitlitan", "Capas", "Carayungan Sur", "Carosalesan", "Casilan",
    "Caurdanetaan", "Concepcion", "Decreto", "Del Rosario", "Diaz", "Diket",
    "Don Justo Abalos", "Don Montano", "Esperanza", "Evangelista", "Flores",
    "Fulgosino", "Gonzales", "La Paz", "Labuan", "Lauren", "Lubong", "Luna Este",
    "Luna Weste", "Mantacdang", "Maseil-seil", "Nampalcan", "Nancalabasaan",
    "Pangangaan", "Papallasen", "Pemienta", "Poblacion East", "Poblacion West",
    "Prado", "Resurreccion", "Ricos", "San Andres", "San Juan", "San Leon",
    "San Pablo", "San Vicente", "Santa Maria", "Santa Rosa", "Sinabaan",
    "Tanggal Sawang",
  ],
  "villasis": [
    "Amamperez", "Bacag", "Barangobong", "Barraca", "Capulaan", "Caramutan",
    "La Paz", "Labit", "Lipay", "Lomboy", "Piaz", "Puelay", "San Blas",
    "San Nicolas", "Tombod", "Unzad", "Zone I (Poblacion)", "Zone II (Poblacion)",
    "Zone III (Poblacion)", "Zone IV (Poblacion)", "Zone V (Poblacion)",
  ],
};

// Barangays for a municipality given its display name (e.g. "San Fabian"),
// or [] when the municipality isn't in Division II.
function getDivisionIIBarangays(municipalityName) {
  return DIVISION_II_BARANGAYS[slugifyMunicipality(municipalityName)] || [];
}

window.DIVISION_II_BARANGAYS = DIVISION_II_BARANGAYS;
window.getDivisionIIBarangays = getDivisionIIBarangays;
