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

/* ================= LOAD THUẬT TOÁN ================= */
function loadAlgo(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

const algo = {
  sicbo: loadAlgo("./ttoansicbo.txt"),
  luck: loadAlgo("./ttoanluck.txt"),
  lc: loadAlgo("./ttoanlc.txt")
};

/* ================= CHUỖI CẦU (KHÔNG RESET) ================= */
const CHUOI_FILE = "chuoi_cau.json";

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

/* ================= UPDATE CHUỖI ================= */
function updateChuoi(game, ket_qua) {
  if (!ket_qua) return chuoi[game];

  const k = ket_qua.toLowerCase();
  const kyTu =
    k.includes("xỉu") || k.includes("nhỏ") || k.includes("lẻ")
      ? "X"
      : "T";

  chuoi[game] += kyTu;
  if (chuoi[game].length > 9) {
    chuoi[game] = chuoi[game].slice(-9);
  }

  saveChuoi(chuoi);
  return chuoi[game];
}

/* ================= DỰ ĐOÁN (TRÙNG NGUYÊN DÃY) ================= */
function duDoan(game) {
  const rules = algo[game];
  const chuoi_cau = chuoi[game];

  let du_doan = "Chờ cầu";
  let do_tin_cay = 0;

  for (const pattern in rules) {
    if (chuoi_cau === pattern) {
      du_doan = rules[pattern];
      do_tin_cay = 100;
      break;
    }
  }

  return { chuoi_cau, du_doan, do_tin_cay };
}

/* ================= SICBO: VỊ (KHÔNG NHẢY) ================= */
let lastSicboVi = [];

function getDuDoanViSicbo(du_doan, tong) {
  if (du_doan !== "Tài" && du_doan !== "Xỉu") {
    return lastSicboVi; // chờ cầu → giữ nguyên
  }

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

/* ================= API CHUNG ================= */
app.get("/api/:game", async (req, res) => {
  const game = req.params.game;
  if (!APIS[game]) {
    return res.json({ error: "Game không tồn tại" });
  }

  try {
    const r = await fetch(APIS[game]);
    const data = await r.json();

    const ket_qua = data.ket_qua || data.result || "";
    const phien_hien_tai = data.phien_hien_tai || data.phien || "N/A";

    updateChuoi(game, ket_qua);
    const { chuoi_cau, du_doan, do_tin_cay } = duDoan(game);

    const out = {
      game,
      phien_hien_tai,
      chuoi_cau,
      du_doan,
      do_tin_cay
    };

    if (game === "sicbo") {
      out.tong_phien_truoc = data.tong;
      out.xuc_xac = [
        data.xuc_xac_1,
        data.xuc_xac_2,
        data.xuc_xac_3
      ];
      out.dudoan_vi = getDuDoanViSicbo(du_doan, data.tong);
    }

    res.json(out);
  } catch (e) {
    res.json({ error: e.message });
  }
});

/* ================= START ================= */
app.listen(PORT, () => {
  console.log("API running on port " + PORT);
});  return chuoi[game];
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
