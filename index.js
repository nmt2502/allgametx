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
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    console.error("Lỗi thuật toán:", file);
    return {};
  }
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
  if (!ket_qua) return;

  const k = ket_qua.toLowerCase();
  const kyTu =
    k.includes("xỉu") || k.includes("nhỏ") || k.includes("lẻ")
      ? "X"
      : "T";

  chuoi[game] += kyTu;        // cộng dài – KHÔNG cắt
  saveChuoi(chuoi);
}

/* ================= DỰ ĐOÁN (SO TỪ 1 → 9 KÝ TỰ) ================= */
function duDoan(game) {
  const rules = algo[game];
  const s = chuoi[game];

  let du_doan = "Chờ cầu";
  let do_tin_cay = 0;

  for (let len = 9; len >= 1; len--) {
    const sub = s.slice(-len);
    for (const pattern in rules) {
      if (pattern.endsWith(sub)) {
        du_doan = rules[pattern];
        do_tin_cay = Math.min(60 + len * 5, 98);
        return { chuoi_cau: s, du_doan, do_tin_cay };
      }
    }
  }

  return { chuoi_cau: s, du_doan, do_tin_cay };
}

/* ================= SICBO: VỊ (KHÔNG NHẢY KHI CHỜ) ================= */
let lastSicboVi = [];
let lastPhienSicbo = null;

function getDuDoanViSicbo(du_doan, phien) {
  if (phien === lastPhienSicbo) return lastSicboVi;
  lastPhienSicbo = phien;

  if (du_doan !== "Tài" && du_doan !== "Xỉu") return lastSicboVi;

  const base =
    du_doan === "Tài"
      ? [11,12,13,14,15,16,17,18]
      : [4,5,6,7,8,9,10];

  let vi;
  do {
    vi = [...base].sort(() => Math.random() - 0.5).slice(0, 4);
  } while (JSON.stringify(vi) === JSON.stringify(lastSicboVi));

  lastSicboVi = vi;
  return vi;
}

/* ================= AUTO FETCH (KHÔNG CẦN AI CHECK API) ================= */
async function autoFetch(game) {
  try {
    const r = await fetch(APIS[game]);
    const data = await r.json();
    const ket_qua = data.ket_qua || data.result;
    updateChuoi(game, ket_qua);
  } catch (e) {
    console.log("Auto fetch lỗi:", game);
  }
}

setInterval(() => {
  autoFetch("sicbo");
  autoFetch("luck");
  autoFetch("lc");
}, 15000); // 15s / lần

/* ================= API ================= */
app.get("/api/:game", async (req, res) => {
  const game = req.params.game;
  if (!APIS[game]) return res.json({ error: "Game không tồn tại" });

  try {
    const r = await fetch(APIS[game]);
    const data = await r.json();

    const ket_qua = data.ket_qua || data.result || "";
    const phien_hien_tai =
      data.phien_hien_tai || data.phien || Date.now();

    updateChuoi(game, ket_qua);
    const kq = duDoan(game);

    const out = {
      game,
      phien_hien_tai,
      chuoi_cau: kq.chuoi_cau,
      du_doan: kq.du_doan,
      do_tin_cay:
        game === "sicbo"
          ? kq.do_tin_cay
          : Math.floor(70 + Math.random() * 25)
    };

    if (game === "sicbo") {
      out.tong_phien_truoc = data.tong;
      out.xuc_xac = [
        data.xuc_xac_1,
        data.xuc_xac_2,
        data.xuc_xac_3
      ];
      out.dudoan_vi = getDuDoanViSicbo(
        out.du_doan,
        phien_hien_tai
      );
    }

    res.json(out);
  } catch (e) {
    res.json({ error: e.message });
  }
});

/* ================= START ================= */
app.listen(PORT, () => {
  console.log("API running on port " + PORT);
});
