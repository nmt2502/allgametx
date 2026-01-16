
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

/* ================= LOAD THUẬT TOÁN ================= */
function loadAlgo(file) {
  const filePath = path.join(__dirname, file);
  if (!fs.existsSync(filePath)) return {};

  const raw = fs.readFileSync(filePath, "utf8").trim();

  try {
    if (raw.startsWith("{")) return JSON.parse(raw);
  } catch (e) {}

  const lines = raw.split(/\r?\n/);
  const result = {};
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    let key, value;
    if (line.includes("=")) [key, value] = line.split("=");
    else if (line.includes(":")) [key, value] = line.split(":");

    if (key && value) {
      result[key.replace(/"/g,"").trim()] =
        value.replace(/"/g,"").replace(",","").trim();
    }
  }
  return result;
}

const algo = {
  sicbo: loadAlgo("ttoansicbo.txt"),
  luck: loadAlgo("ttoanluck.txt"),
  lc: loadAlgo("ttoanlc.txt")
};

/* ================= CHUỖI CẦU ================= */
const CHUOI_FILE = path.join(__dirname, "chuoi_cau.json");

function loadChuoi() {
  if (fs.existsSync(CHUOI_FILE)) {
    return JSON.parse(fs.readFileSync(CHUOI_FILE, "utf8"));
  }
  return { sicbo:"", luck:"", lc:"" };
}
function saveChuoi(d){ fs.writeFileSync(CHUOI_FILE, JSON.stringify(d,null,2)); }

let chuoi = loadChuoi();

function updateChuoi(game, ket_qua){
  const kq = (ket_qua||"").toLowerCase();
  const k = kq.includes("xỉu") ? "X" : "T";
  if (chuoi[game].endsWith(k)) return chuoi[game];
  chuoi[game]+=k;
  if (chuoi[game].length>9) chuoi[game]=chuoi[game].slice(-9);
  saveChuoi(chuoi);
  return chuoi[game];
}

function duDoan(game, chuoi_cau){
  const rules = algo[game];
  let result="Chờ cầu", do_tin_cay=0;
  for (const p in rules){
    if (chuoi_cau.endsWith(p)){
      result = rules[p];
      do_tin_cay = Math.round((p.length/9)*100);
      break;
    }
  }
  return {result, do_tin_cay};
}

function getDuDoanViSicbo(du_doan){
  const base = du_doan==="Tài"
    ? [11,12,13,14,15,16,17,18]
    : [4,5,6,7,8,9,10];
  return base.sort(()=>Math.random()-0.5).slice(0,4);
}

/* ================= API ================= */
app.get("/api/:game", async (req,res)=>{
  const game=req.params.game;
  if(!APIS[game]) return res.json({error:"Game không tồn tại"});
  try{
    const r=await fetch(APIS[game]);
    const d=await r.json();
    const chuoi_cau=updateChuoi(game, d.ket_qua||"");
    const {result, do_tin_cay}=duDoan(game, chuoi_cau);

    const out={
      game,
      phien_hien_tai: d.phien_hien_tai||d.phien,
      chuoi_cau,
      du_doan: result,
      do_tin_cay
    };

    if(game==="sicbo"){
      out.tong_phien_truoc=d.tong;
      out.dudoan_vi=getDuDoanViSicbo(result);
    }
    res.json(out);
  }catch(e){
    res.json({error:e.message});
  }
});

app.listen(PORT,()=>console.log("API running "+PORT));
