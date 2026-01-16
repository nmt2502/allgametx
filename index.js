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

/* ================= LOAD THUẬT TOÁN (TXT) ================= */
function loadAlgo(file) {
  const text = fs.readFileSync(file, "utf8").trim();
  const lines = text.split(/\r?\n/);
  const rules = {};

  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith("#")) continue;

    const m = line.match(/^([TX]+)\s*[:=]\s*(.+)$/i);
    if (!m) continue;

    rules[m[1]] = m[2];
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
let lastData = { sicbo: {}, luck: {}, lc: {} };

/* ================= UPDATE CHUỖI ================= */
function updateChuoi(game, ket_qua, phien, raw) {
  if (!ket_qua || !phien || lastPhien[game] === phien) return;

  const k = ket_qua.toLowerCase();
  const kyTu =
    k.includes("xỉu") || k.includes("nhỏ") || k.includes("lẻ") ? "X" : "T";

  chuoi[game] += kyTu;
  lastPhien[game] = phien;
  lastData[game] = raw;

  saveChuoi();
}

/* ================= RANDOM ĐỘ TIN CẬY ================= */
function randomTinCay(hasCau) {
  if (hasCau) return +(75 + Math.random() * 20).toFixed(1); // 75–95
  return +(30 + Math.random() * 25).toFixed(1);            // 30–55
}

/* ================= DỰ ĐOÁN (SO ĐUÔI) ================= */
function duDoan(game) {
  const rules = algo[game];
  const s = chuoi[game];

  let du_doan = "Chờ cầu";
  let do_tin_cay = randomTinCay(false);

  for (const p in rules) {
    if (s.endsWith(p)) {
      du_doan = rules[p];
      do_tin_cay = randomTinCay(true);
      break;
    }
  }

  return { chuoi_cau: s, du_doan, do_tin_cay };
}

/* ================= SICBO: VỊ (KHÔNG NHẢY) ================= */
let lastSicboVi = [];

function getViSicbo(du_doan) {
  if (du_doan !== "Tài" && du_doan !== "Xỉu") return lastSicboVi;

  const base = du_doan === "Tài"
    ? [11,12,13,14,15,16,17,18]
    : [4,5,6,7,8,9,10];

  let vi;
  do {
    vi = base.sort(() => Math.random() - 0.5).slice(0, 4);
  } while (JSON.stringify(vi) === JSON.stringify(lastSicboVi));

  lastSicboVi = vi;
  return vi;
}

/* ================= AUTO FETCH (KHÔNG CẦN CHECK API) ================= */
async function autoFetch(game) {
  try {
    const r = await fetch(APIS[game]);
    const d = await r.json();

    const phien = d.phien_hien_tai || d.phien;
    const ket_qua = d.ket_qua || d.result || "";

    updateChuoi(game, ket_qua, phien, d);
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

  const base = duDoan(game);
  const data = lastData[game] || {};

  const out = {
    game,
    phien_hien_tai: data.phien_hien_tai || data.phien || null,
    ...base
  };

  if (game === "sicbo") {
    out.tong_phien_truoc = data.tong;
    out.xuc_xac = [data.xuc_xac_1, data.xuc_xac_2, data.xuc_xac_3];
    out.dudoan_vi = getViSicbo(base.du_doan);
  }

  res.json(out);
});

/* ================= START ================= */
app.listen(PORT, () => {
  console.log("API RUNNING PORT", PORT);
});
