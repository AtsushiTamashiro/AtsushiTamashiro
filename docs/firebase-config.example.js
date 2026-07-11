/**
 * Firebase を使って全ユーザー間でリアルタイム共有する場合の設定サンプル。
 *
 * 1. https://console.firebase.google.com/ でプロジェクトを作成
 * 2. Realtime Database を有効化(ロケーションは asia-southeast1 など)
 * 3. プロジェクト設定 > ウェブアプリを追加し、構成オブジェクトを取得
 * 4. このファイルを firebase-config.js にコピーして値を書き換える
 *
 * セキュリティルールの例(旧盆期間のみ書き込みを許可するなどの調整推奨):
 * {
 *   "rules": {
 *     "reports": {
 *       ".read": true,
 *       ".write": true
 *     }
 *   }
 * }
 *
 * firebase-config.js が存在しない場合、アプリは localStorage を使った
 * デモモード(端末内のみ共有)で自動的に起動します。
 */
window.FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:xxxxxxxxxxxxxxxx",
};
