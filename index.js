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
  sicbo: loadAlgo("ttoansicbo.txt"),
  luck: loadAlgo("ttoanluck.txt"),
  lc: loadAlgo("ttoanlc.txt")
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

function updateChuoi(game, ket_qua) {
  const kq = (ket_qua || "").toLowerCase();
  const kyTu =
    kq.includes("xỉu") ||
    kq.includes("nhỏ") ||
    kq.includes("lẻ")
      ? "X"
      : "T";

  chuoi[game] += kyTu;
  if (chuoi[game].length > 9) {
    chuoi[game] = chuoi[game].slice(-9);
  }

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

/* ================= SICBO: TẠO 4 VỊ THEO TỔNG ================= */
function getDuDoanViSicbo(du_doan, tong) {
  if (typeof tong !== "number") return [];

  const isTai = du_doan === "Tài";
  const min = isTai ? 11 : 4;
  const max = isTai ? 18 : 10;

  let list = [
    tong,
    tong - 1,
    tong + 1,
    tong - 2,
    tong + 2
  ].filter(n => n >= min && n <= max);

  if (list.length === 0) {
    list = isTai ? [11, 12, 13, 14] : [7, 8, 9, 10];
  }

  let i = min;
  while (list.length < 4 && i <= max) {
    if (!list.includes(i)) list.push(i);
    i++;
  }

  return list.slice(0, 4);
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
    const phien_hien_tai =
      data.phien_hien_tai || data.phien || "N/A";

    const chuoi_cau = updateChuoi(game, ket_qua);
    const { result, do_tin_cay } = duDoan(game, chuoi_cau);

    const responseData = {
      game,
      phien_hien_tai,
      chuoi_cau,
      du_doan: result,
      do_tin_cay
    };

    /* ===== RIÊNG SICBO ===== */
    if (game === "sicbo") {
      responseData.tong_phien_truoc = data.tong;
      responseData.xuc_xac = [
        data.xuc_xac_1,
        data.xuc_xac_2,
        data.xuc_xac_3
      ];
      responseData.dudoan_vi = getDuDoanViSicbo(result, data.tong);
    }

    res.json(responseData);
  } catch (err) {
    res.json({ error: err.message });
  }
});

/* ================= START SERVER ================= */
app.listen(PORT, () => {
  console.log("API running on port " + PORT);
});