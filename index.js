
const express = require("express");
const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

/* ================= API GỐC ================= */
const APIS = {
  sicbo: "https://sicsun-9wes.onrender.com/predict",
  luck: "https://luckywingugu.onrender.com/luck/md5",
  lc: "https://lc79md5-lun8.onrender.com/lc79/md5"
};

/* ================= LOAD THUẬT TOÁN (JSON + TEXT) ================= */
function loadAlgo(file) {
  const filePath = path.join(__dirname, file);
  if (!fs.existsSync(filePath)) return {};

  const raw = fs.readFileSync(filePath, "utf8").trim();

  // thử JSON trước
  try {
    if (raw.startsWith("{")) return JSON.parse(raw);
  } catch {}

  // parse text thường
  const lines = raw.split(/\r?\n/);
  const result = {};
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    let key, value;
    if (line.includes("=")) [key, value] = line.split("=");
    else if (line.includes(":")) [key, value] = line.split(":");

    if (key && value) {
      result[key.replace(/"/g, "").trim()] =
        value.replace(/"/g, "").replace(",", "").trim();
    }
  }
  return result;
}

const algo = {
  sicbo: loadAlgo("ttoansicbo.txt"),
  luck: loadAlgo("ttoanluck.txt"),
  lc: loadAlgo("ttoanlc.txt")
};

/* ================= CHUỖI CẦU (KHÔNG RESET) ================= */
const CHUOI_FILE = path.join(__dirname, "chuoi_cau.json");

function loadChuoi() {
  if (fs.existsSync(CHUOI_FILE)) {
    return JSON.parse(fs.readFileSync(CHUOI_FILE, "utf8"));
  }
  return { sicbo: "", luck: "", lc: "" };
}

function saveChuoi(data) {
  fs.writeFileSync(CHUOI_FILE, JSON.stringify(data, null, 2));
}

let chuoi = loadChuoi();

function updateChuoi(game, ket_qua) {
  const kq = (ket_qua || "").toLowerCase();
  const kyTu = kq.includes("xỉu") ? "X" : "T";

  // không cho trùng liên tiếp
  if (chuoi[game].endsWith(kyTu)) return chuoi[game];

  chuoi[game] += kyTu;
  if (chuoi[game].length > 9) chuoi[game] = chuoi[game].slice(-9);

  saveChuoi(chuoi);
  return chuoi[game];
}

/* ================= DỰ ĐOÁN ================= */
function duDoan(game, chuoi_cau) {
  const rules = algo[game];
  let result = "Chờ cầu";
  let do_tin_cay = 0;

  for (const pattern in rules) {
    if (chuoi_cau.endsWith(pattern)) {
      result = rules[pattern];
      do_tin_cay = Math.round((pattern.length / 9) * 100);
      break;
    }
  }
  return { result, do_tin_cay };
}

/* ================= SICBO: DỰ ĐOÁN VỊ (KHÔNG NHẢY KHI CHỜ CẦU) ================= */
let lastSicboVi = [];

function getDuDoanViSicbo(du_doan, tong) {
  // chờ cầu -> giữ nguyên vị cũ
  if (du_doan !== "Tài" && du_doan !== "Xỉu") {
    return lastSicboVi;
  }

  const base = du_doan === "Tài"
    ? [11,12,13,14,15,16,17,18]
    : [4,5,6,7,8,9,10];

  // trộn số, không lặp liên tục
  const vi = base.sort(() => Math.random() - 0.5).slice(0, 4);

  lastSicboVi = vi;
  return vi;
}

/* ================= API CHUNG ================= */
app.get("/api/:game", async (req, res) => {
  const game = req.params.game;
  if (!APIS[game]) {
    return res.json({ error: "Game không tồn tại" });
  }

  try {
    const response = await fetch(APIS[game]);
    const data = await response.json();

    const ket_qua = data.ket_qua || data.result || "";
    const phien_hien_tai = data.phien_hien_tai || data.phien || "N/A";

    const chuoi_cau = updateChuoi(game, ket_qua);
    const { result, do_tin_cay } = duDoan(game, chuoi_cau);

    const out = {
      game,
      phien_hien_tai,
      chuoi_cau,
      du_doan: result,
      do_tin_cay
    };

    /* ===== RIÊNG SICBO ===== */
    if (game === "sicbo") {
      out.tong_phien_truoc = data.tong;
      out.xuc_xac = [data.xuc_xac_1, data.xuc_xac_2, data.xuc_xac_3];
      out.dudoan_vi = getDuDoanViSicbo(result, data.tong);
    }

    res.json(out);
  } catch (err) {
    res.json({ error: err.message });
  }
});

/* ================= START SERVER ================= */
app.listen(PORT, () => {
  console.log("✅ API running on port " + PORT);
});
