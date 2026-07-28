
MockDB.clcs = [
    {
        id: 1, name: "Poblacion CLC", municipality: "Binalonan",
        location: "Poblacion, Binalonan, Pangasinan", status: "Active", icon: "account_balance",
        totalLearners: 46, schoolYear: "2026-2027", teachers: 3
    },
    {
        id: 2, name: "San Felipe Sur CLC", municipality: "Binalonan",
        location: "San Felipe Sur, Binalonan, Pangasinan", status: "Active", icon: "school",
        totalLearners: 38, schoolYear: "2026-2027", teachers: 2
    },
    {
        id: 3, name: "San Felipe Norte CLC", municipality: "Binalonan",
        location: "San Felipe Norte, Binalonan, Pangasinan", status: "Active", icon: "cottage",
        totalLearners: 29, schoolYear: "2026-2027", teachers: 2
    },
    {
        id: 4, name: "Cabalitian CLC", municipality: "Binalonan",
        location: "Cabalitian, Binalonan, Pangasinan", status: "Active", icon: "account_balance",
        totalLearners: 22, schoolYear: "2026-2027", teachers: 1
    },
    {
        id: 5, name: "Alacan CLC", municipality: "Binalonan",
        location: "Alacan, Binalonan, Pangasinan", status: "Active", icon: "apartment",
        totalLearners: 33, schoolYear: "2026-2027", teachers: 2
    },
    {
        id: 6, name: "Buenlag CLC", municipality: "Binalonan",
        location: "Buenlag, Binalonan, Pangasinan", status: "Active", icon: "meeting_room",
        totalLearners: 27, schoolYear: "2026-2027", teachers: 2
    }
];

MockDB.getMunicipalities = function () {

    return [...new Set(this.clcs.map(c => c.municipality))];

};

MockDB.getClcsByMunicipality = function (municipality) {

    if (!municipality) return this.clone(this.clcs);

    return this.clone(this.clcs.filter(c => c.municipality === municipality));

};
