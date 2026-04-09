// Settlement labels extracted from ui_map_label.xml
// Coordinates calibrated to map pixel space
// Names verified against official KCD2 location list and wiki
// Trosky calibrated from: Nomads' Camp, Troskowitz, Apollonia, Semine (4-point least squares)
// Kuttenberg calibrated via GG fast travel bridge (9-point least squares)
//
// Missing from XML (not in ui_map_label.xml):
//   Trosky: Lower Semine Mill, Nebakov Mill, Rocktower Pond, Schdiar East/West Farm,
//           The Lair, Vidlak Pond, Zhelejov Wagoners' Inn

const SETTLEMENT_LABELS = {
  trosky: [
    { name: "Apollonia", x: 5276, y: 3719 },
    { name: "Nebakov Fortress", x: 2952, y: 1266 },
    { name: "Nomads' Camp", x: 1339, y: 2706 },
    { name: "Semine", x: 2334, y: 1980 },
    { name: "Tachov", x: 3714, y: 4172 },
    { name: "Troskowitz", x: 4008, y: 3192 },
    { name: "Trosky Castle", x: 4524, y: 4495 },
    { name: "Zhelejov", x: 2781, y: 3000 },
  ],
  kuttenberg: [
    { name: "Opatowitz", x: 4198, y: 7285 },
    { name: "Apollonia", x: 5228, y: 7572 },
    { name: "Suchdol", x: 2423, y: 5805 },
    { name: "Horschan", x: 6138, y: 7766 },
    { name: "Semine", x: 2439, y: 5812 },
    { name: "Old Kutna", x: 8671, y: 6746 },
    { name: "Kuttenberg", x: 9936, y: 5653 },
    { name: "Tachov", x: 3556, y: 8022 },
    { name: "Raborsch", x: 2732, y: 8073 },
    { name: "Wysoka", x: 3169, y: 4254 },
    { name: "Nomads' Camp", x: 1312, y: 6538 },
    { name: "Maleshov", x: 6389, y: 1328 },
    { name: "Grund", x: 7666, y: 8212 },
    { name: "Bylany", x: 7248, y: 4170 },
    { name: "Devil's Den", x: 6079, y: 8719 },
    { name: "Pschitoky", x: 6870, y: 6218 },
    { name: "Miskowitz", x: 5580, y: 5283 },
    { name: "Troskowitz", x: 3996, y: 7037 },
    { name: "Zhelejov", x: 2758, y: 6839 },
    { name: "Sigismund's Camp", x: 4432, y: 6741 },
    { name: "Nebakov Fortress", x: 3175, y: 5096 },
    { name: "Trosky Castle", x: 4346, y: 8350 },
    { name: "Bohunowitz", x: 3952, y: 8041 },
  ]
};