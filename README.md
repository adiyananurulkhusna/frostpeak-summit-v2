# Frostpeak Drift

![bounty](https://make.fun/badge/bounty/gta6-01)
![rank](https://make.fun/badge/rank/gta6-01/adiyananurulkhusna/frostpeak-summit-v2)
![prize](https://make.fun/badge/prize/gta6-01/adiyananurulkhusna/frostpeak-summit-v2)

[Lihat bounty di make.fun](https://make.fun/bounty/gta6-01)

## Tentang game

**Frostpeak Drift** adalah game open-world 2D top-down berlatar kota resor ski
bersalju bernama Frostpeak. Kamu bermain sebagai Raka, sopir snowplow yang
terseret ke dunia bawah kota itu: membersihkan jalan sebelum resor dibuka,
mengantar paket dingin, membuntuti kurir kru saingan, menyelundupkan barang
di tengah badai salju, balapan drift menuruni lereng ski, dan akhirnya mencuri
simpanan kru lalu kabur dari kejaran polisi lima bintang.

Jalanan Frostpeak licin seperti es asli: mobil meluncur, rem tangan membuat
drift, dan cengkeraman setir berbeda di jalan bersalju dibanding jalan yang
sudah dibersihkan. Ada lalu lintas yang mengikuti jalan, pejalan kaki yang lari
ketakutan saat ada bahaya, sistem buronan nol sampai lima bintang, pertarungan
jalan kaki, minimap, dan penyimpanan otomatis di browser.

## Cara menjalankan

Tidak perlu instal apa pun. Sajikan folder `game/` lewat server HTTP statis,
lalu buka di browser desktop:

```sh
cd game
python3 -m http.server 8123
```

Lalu buka `http://localhost:8123` di browser. Game berjalan sepenuhnya
offline — tidak ada permintaan network.

## Kontrol

| Tombol | Fungsi |
| ------ | ------ |
| WASD / tombol panah | Bergerak & mengemudi |
| E | Masuk / keluar mobil |
| F | Pukul |
| Klik mouse | Tembak ke arah kursor |
| Spasi | Rem tangan (drift) |
| P | Jeda |
| M | Bisukan suara |

## Struktur

- `game/index.html` — halaman utama game
- `game/src/main.js` — loop utama, kamera, dan salju
- `game/src/world.js` — kota Frostpeak: jalan, gedung, lereng, danau beku
- `game/src/player.js` — Raka jalan kaki: pukul, tembak, nyawa, uang
- `game/src/vehicles.js` — mobil, lalu lintas, dan fisika es
- `game/src/police.js` — sistem buronan, polisi, dan pejalan kaki
- `game/src/missions.js` — enam misi cerita yang saling sambung
- `game/src/hud.js` — HUD, minimap, dialog, dan layar judul/akhir
- `game/src/audio.js` — suara yang disintesis lewat Web Audio
- `game/src/storage.js` — simpan dan muat lewat local storage
- `vendor/makefun-game.ts` — library dossier dari make.fun
- `main.ts` — program utama yang membangun `dossier.json`

## Referral

Kode referral: `0sc1f0wn`
