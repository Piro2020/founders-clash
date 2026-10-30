import {QUOTES} from './quotes.js';
const raw = [
  ['福澤諭吉','慶應義塾大学','FUKUZAWA YUKICHI',1858,'一身独立して一国独立す','projectile',4,3,4,'#deda99','#243a3f','bald','robe','江戸・築地に蘭学塾を開き、慶應義塾の起源を築いた。','https://www.keio.ac.jp/ja/about/philosophy/fukuzawa/'],
  ['大隈重信','早稲田大学','OKUMA SHIGENOBU',1882,'いよいよ奮闘努力を続行する','wave',5,2,5,'#ec826f','#542d38','bald','suit','早稲田大学の前身、東京専門学校を創立した。','https://www.waseda.jp/top/about/work/history'],
  ['新島襄','同志社大学','NEESIMA JO',1875,'良心の全身に充満したる丈夫','uppercut',3,5,3,'#c8acf0','#493a59','side','suit','多くの協力者とともに同志社英学校を設立した。','https://www.doshisha.ac.jp/information/neesima/index.html'],
  ['津田梅子','津田塾大学','TSUDA UMEKO',1900,'all-round women','burst',3,5,3,'#f1bd8d','#4b636b','bun','dress','津田塾大学の前身、女子英学塾を創設した。','https://www.tsuda.ac.jp/aboutus/history/'],
  ['井上円了','東洋大学','INOUE ENRYO',1887,'諸学の基礎は哲学にあり','projectile',3,3,5,'#8ebbe1','#2c4462','beard','robe','東洋大学の前身、私立哲学館を創立した。妖怪研究でも知られる。','https://www.toyo.ac.jp/about/founder/about/'],
  ['大倉喜八郎','東京経済大学','OKURA KIHACHIRO',1900,'進一層','uppercut',5,2,3,'#e7b669','#554438','beard','suit','東京経済大学の前身、大倉商業学校を創設した。','https://www.tku.ac.jp/president_message20260401.html'],
  ['米田吉盛','神奈川大学','YONEDA YOSHIMORI',1928,'教育は人を造るにあり','dash',4,4,3,'#a7cfd7','#294953','glasses','suit','勤労青年の学びを支える横浜学院を創設した。','https://www.kanagawa-u.ac.jp/aboutus/timeline/'],
  ['中川小十郎','立命館大学','NAKAGAWA KOJURO',1900,'形影相訪','dash',3,5,4,'#d67776','#47353c','mustache','suit','立命館大学の前身、京都法政学校を創設した。','https://www.ritsumei.ac.jp/features/nakagawakojyuro/'],
  ['中村春二','成蹊大学','NAKAMURA HARUJI',1912,'また何をか憂へんや','wave',4,2,5,'#9cbb76','#3f5644','glasses','robe','岩崎小弥太・今村繁三の援助を受け、成蹊実務学校を創立した。','https://www.seikei.ac.jp/gakuen/struct/reimeiki.html'],
  ['澤柳政太郎','成城大学','SAWAYANAGI MASATARO',1917,'所求第一義','burst',4,3,4,'#92c6a0','#314647','mustache','suit','成城学園の起源となる成城小学校を創設した。','https://www.seijogakuen.ed.jp/about/from-president/'],
  ['岸本辰雄','明治大学','KISHIMOTO TATSUO',1881,'自由討究主義なり','uppercut',5,3,2,'#be9ae3','#44384e','side','suit','宮城浩蔵・矢代操とともに明治法律学校を創立した。','https://www.meiji.ac.jp/koho/information/history/index.html'],
  ['大妻コタカ','大妻女子大学','OTSUMA KOTAKA',1908,'理想は高遠に、実行は足もとから','dash',3,5,3,'#f0ac60','#293d4d','bun','robe','裁縫・手芸の塾を開き、大妻学院の基礎を築いた。','https://www.otsuma-tama.ed.jp/guide/history/'],
  ['下田歌子','実践女子大学','SHIMODA UTAKO',1899,'天下を動かすことを得べし','projectile',3,4,5,'#d1afcb','#645060','bun','robe','実践女学校と女子工芸学校を創立し、女子教育の普及に尽くした。','https://www.jissen.ac.jp/school/shimoda_utako/analects/index.html'],
  ['跡見花蹊','跡見学園女子大学','ATOMI KAKEI',1875,'五千弟子漸成林','wave',4,3,5,'#f09285','#4a3335','bun','robe','跡見学校を開校し、跡見学園の礎を築いた。','https://www.atomi.ac.jp/progress/philosophy/'],
  ['三島中洲','二松学舎大学','MISHIMA CHUSHU',1877,'余が庭にも二松あり','projectile',4,2,5,'#b5b99c','#4e5143','whitebeard','robe','大学の前身である漢学塾二松学舎を創設した。','https://www.nishogakusha-u.ac.jp/about/f3.html'],
  ['柴田徳次郎','国士舘大学','SHIBATA TOKUJIRO',1917,'誠意の智恵、勤勉の勇気','dash',5,4,2,'#e39779','#3d4146','crew','suit','同世代の同志とともに教育機関・国士舘を創立した。','https://www.kokushikan.ac.jp/archive/publication/other/docs/founder130thbooklet.pdf'],
  ['小原國芳','玉川大学','OBARA KUNIYOSHI',1929,'真っ先に微笑を以って担当せよ','burst',4,3,4,'#ebd58e','#45525a','glasses','suit','全人教育の理念に基づいて玉川学園を創立した。','https://www.tamagawa.jp/introduction/chairman/message00.html'],
  ['成瀬仁蔵','日本女子大学','NARUSE JINZO',1901,'信念徹底','uppercut',3,4,4,'#b6a3cd','#413c52','beard','suit','人格教育を重んじ、日本女子大学校を開校した。','https://corp.jwu.ac.jp/about/spirit/'],
  ['公江喜市郎','武庫川女子大学','KOE KIICHIRO',1939,'風涛偕に和す','wave',4,3,4,'#a4c3cf','#354751','glasses','suit','武庫川学院を創設し、武庫川高等女学校を開校した。','https://www.mukogawa-u.ac.jp/~kohoj/history.html'],
  ['吉岡彌生','東京女子医科大学','YOSHIOKA YAYOI',1900,'この信念をまげまい','burst',3,4,4,'#ecc0bd','#54464c','bun','dress','大学の前身、東京女医学校を創立した。','https://www.twmu.ac.jp/univ/about/founder.php']
];
export const STYLES={projectile:['飛び道具型','書物に信念を込めて放つ飛び道具'],wave:['遠距離・重撃型','低く走る強力な衝撃波'],dash:['突進・スピード型','一気に間合いを詰める高速突進'],uppercut:['対空・パワー型','上昇しながら放つ対空の一撃'],burst:['近距離・範囲型','周囲に広がる信念の衝撃']};
export const FOUNDERS=raw.map((r,id)=>({id,name:r[0],school:r[1],roman:r[2],year:r[3],special:QUOTES[id].text,quoteSource:QUOTES[id].source,quoteContext:QUOTES[id].context,type:r[5],power:r[6],speed:r[7],reach:r[8],color:r[9],outfit:r[10],hair:r[11],clothes:r[12],bio:r[13],source:r[14],style:STYLES[r[5]][0],description:STYLES[r[5]][1]}));
