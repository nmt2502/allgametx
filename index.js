const express = require("express");
const fetch = require("node-fetch");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

/* ================= API GỐC ================= */
const APIS = {
  sicbo: "https://sicsun-9wes.onrender.com/predict",
  luck: "https://luckywingugu.onrender.com/luck/md5",
  lc: "https://lc79md5-lun8.onrender.com/lc79/md5"
};

/* ================= LOAD THUẬT TOÁN (FIX JSON ERROR) ================= */
function loadAlgo(file) {
  const text = fs.readFileSync(file, "utf8").trim();
  const lines = text.split(/\r?\n/);

  const rules = {};
  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith("#")) continue;

    const match = line.match(/^([TX]+)\s*[:=]\s*(.+)$/i);
    if (!match) continue;

    rules[match[1]] = match[2];
  }
  return rules;
}

const algo = {
  sicbo: loadAlgo("./ttoansicbo.txt"),
  luck: loadAlgo("./ttoanluck.txt"),
  lc: loadAlgo("./ttoanlc.txt")
};

/* ================= CHUỖI CẦU (CỘNG DÀI) ================= */
const CHUOI_FILE = "chuoi_cau.json";

let chuoi = fs.existsSync(CHUOI_FILE)
  ? JSON.parse(fs.readFileSync(CHUOI_FILE))
  : { sicbo: "", luck: "", lc: "" };

function saveChuoi() {
  fs.writeFileSync(CHUOI_FILE, JSON.stringify(chuoi, null, 2));
}

let lastPhien = { sicbo: null, luck: null, lc: null };

/* ================= UPDATE CHUỖI ================= */
function updateChuoi(game, ket_qua, phien) {
  if (!ket_qua || !phien || lastPhien[game] === phien) return;

  const k = ket_qua.toLowerCase();
  const kyTu =
    k.includes("xỉu") || k.includes("nhỏ") || k.includes("lẻ") ? "X" : "T";

  chuoi[game] += kyTu;
  lastPhien[game] = phien;
  saveChuoi();
}

/* ================= DỰ ĐOÁN (SO ĐUÔI) ================= */
function duDoan(game) {
  const rules = algo[game];
  const s = chuoi[game];

  let du_doan = "Chờ cầu";
  let do_tin_cay = 0;

  for (const p in rules) {
    if (s.endsWith(p)) {
      du_doan = rules[p];
      do_tin_cay = 100;
      break;
    }
  }
  return { chuoi_cau: s, du_doan, do_tin_cay };
}

/* ================= AUTO FETCH ================= */
async function autoFetch(game) {
  try {
    const r = await fetch(APIS[game]);
    const d = await r.json();
    updateChuoi(game, d.ket_qua || d.result, d.phien_hien_tai || d.phien);
  } catch {}
}

setInterval(() => {
  autoFetch("sicbo");
  autoFetch("luck");
  autoFetch("lc");
}, 5000);

/* ================= API ================= */
app.get("/api/:game", (req, res) => {
  const game = req.params.game;
  if (!algo[game]) return res.json({ error: "Game không tồn tại" });
  res.json({ game, ...duDoan(game) });
});

app.listen(PORT, () => console.log("RUNNING", PORT));
