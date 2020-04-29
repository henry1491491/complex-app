/**
 * app.use([path,] callback [, callback...]) => 第一個參數預設 '/' 根目錄
 * app.use 通常像是攔截器，可以在發出所有請求前處理事情
 * visitorId 是將 session.user._id 存進去，若是訪客則為 0
 * ==========
 * 截至目前為止，最困難應該是：MongoDB 的那個複雜的方法
 * 關於更多 markdown 語法可參考 markdown cheat sheet
 * cookie 跟 session。session 要解決什麼問題？為什麼出現這個技術？
 * 所需下載的套件：npm install csurf
 * 
 * 開 api 要將
 */

const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo")(session); // 存 session 用的
const flash = require("connect-flash");
const markdown = require("marked");
const csrf = require("csurf");
const app = express(); // express 與 express() 執行後差別？
const sanitizeHTML = require("sanitize-html");

/**這兩個與 body-parsing 有關 */
app.use(express.urlencoded({ extended: false })); // { extended: false } 關於網路上的解釋是 false 則 post 不能是嵌套的物件，反之 true 則可以
app.use(express.json()); // 設定為回傳要是 json 格式
app.use('/api',require('./router-api')) // 這行要寫在這個位置，是因為不走 session 等流程，但因為會用到以上兩個 app.use 

let sessionOptions = session({
  secret: "JavaScript is sooooooooo coool", // ?
  store: new MongoStore({ client: require("./db") }), // ?
  resave: false, // ?
  saveUninitialized: false, // ?
  cookie: { maxAge: 1000 * 60 * 60 * 24, httpOnly: true }, // 官網說不要直接使用 expires，取而代之是 maxAge。注意有些客戶端（瀏覽器？）不允許透過 document.cookie 的方式去查看 cookie
});

app.use(sessionOptions);
app.use(flash());

app.use(function (req, res, next) {
  // make our markdown function avalible from within ejs templates
  res.locals.filterUserHTML = function (content) {
    return sanitizeHTML(markdown(content), {
      allowedTags: ["h1", "h2", "h3", "h4", "h5", "p", "b", "code"],
      allowedAttributes: {},
    });
  };

  // make all error and success flah messages avalible from all templates
  res.locals.errors = req.flash("errors");
  res.locals.success = req.flash("success");
  // make current user id avalible on the req object
  if (req.session.user) {
    req.visitorId = req.session.user._id;
  } else {
    req.visitorId = 0;
  }
  // make user session data avalible from within view templates
  res.locals.user = req.session.user;
  next();
});

const router = require("./router");



app.use(express.static("public"));
app.set("views", "views");
app.set("view engine", "ejs");

app.use(csrf());

app.use(function (req, res, next) {
  res.locals.csrfToken = req.csrfToken();
  next();
});
app.use("/", router); // 所有根目錄為 '/' 的請求都會先被傳送給 router 物件

app.use(function (err, req, res, next) {
  if (err) {
    if (err.code == "EBADCSRFTOKEN") {
      req.flash("errors", "Cross site request forgery detected.");
      req.session.save(() => res.redirect("/"));
    } else {
      res.render('404')
    }
  }
});

const server = require("http").createServer(app);
const io = require("socket.io")(server);

io.use(function (socket, next) {
  sessionOptions(socket.request, socket.request.res, next);
});

io.on("connection", function (socket) {
  if (socket.request.session.user) {
    let user = socket.request.session.user;

    socket.emit("welcome", { username: user.username, avatar: user.avatar });

    socket.on("chatMessageFromBrowser", function (data) {
      socket.broadcast.emit("chatMessageFromServer", {
        message: sanitizeHTML(data.message, {
          allowedTags: [],
          allowedAttributes: {},
        }),
        username: user.username,
        avatar: user.avatar,
      });
    });
  }
});

module.exports = server;
