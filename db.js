// TODO 對於 MongoDB 的樹狀結構，需要掌握
// equals() 方法似乎是 Mongo 的方法？
const dotenv = require("dotenv");
dotenv.config();
// 以上設定跟環境變數有關，目的是使得 .env 檔可以透過 process.env.<變數> 的方式供程式使用

const mongodb = require("mongodb");
//console.log('1. =>',mongodb)
//console.log('2. =>',mongodb.MongoClient)

mongodb.connect(
  process.env.CONNECTIONSTRING,
  { useNewUrlParser: true, useUnifiedTopology: true },
  function (err, client) {
    module.exports = client;
    const app = require("./app");
    app.listen(process.env.PORT);
  }
);

