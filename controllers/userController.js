/**
 * req.flash()
 * res.direct('/') 寫在 session.save 或是 session.detroy 是作為 callback
 * session 是種概念，基於 http 無狀態特性所出現的解決辦法
 * 看到 req.params 要直覺想到後面接的屬性是從 router 的 動態 url來的
 *  npm install cors => 安裝解決跨域問題
 */
const User = require("../models/User");
const Post = require("../models/Post");
const Follow = require("../models/Follow");
const jwt = require("jsonwebtoken");

exports.apiGetPostsByUsername = async function(req,res){
  try {
    let authorDoc = await User.findByUsername(req.params.username)
    let posts = await Post.findByAuthorId(authorDoc._id)
    res.json(posts)
  } catch  {
    res.json("Sorry, invalid user requested.")
  }
}


exports.apiMustBeLoggedIn = function (req, res, next) {
  try {
    req.apiUser = jwt.verify(req.body.token, process.env.JWTSECRET);
    next();
  } catch {
    res.json("sorry, you must provide a valid token.");
  }
};

exports.doesUsernameExist = function (req, res) {
  User.findByUsername(req.body.username)
    .then(function () {
      res.json(true);
    })
    .catch(function () {
      res.json(false);
    });
};

exports.doesEmailExist = async function (req, res) {
  let emailBool = await User.doesEmailExist(req.body.email);
  res.json(emailBool);
};

exports.sharedProfileData = async function (req, res, next) {
  let isVisitorsProfile = false;
  let isFollowing = false;
  if (req.session.user) {
    isVisitorsProfile = req.profileUser._id.equals(req.session.user._id); // profileUser 是我們要點擊查看的個人資料，是否等於該用戶（正在使用這個 App）？
    isFollowing = await Follow.isVisitorFollowing(
      req.profileUser._id,
      req.visitorId
    );
  }
  // 先判斷是不是 session 用戶？然後判斷用戶是否等同於查看的個人檔案？然後判斷是否已經追蹤過？
  req.isVisitorsProfile = isVisitorsProfile; // 是否用戶與查看用戶是同一個人
  req.isFollowing = isFollowing; // 是否追蹤？
  // retrieve post, follower and following counts
  let postCountPromise = Post.countPostsByAuthor(req.profileUser._id); // req.profileUser._id  這個參數不帶進去，就不知道要看的是哪個人的檔案
  let followerCountPromise = Follow.countFollowerById(req.profileUser._id);
  let followingCountPromise = Follow.countFollowingById(req.profileUser._id);
  let [postCount, followerCount, followingCount] = await Promise.all([
    postCountPromise,
    followerCountPromise,
    followingCountPromise,
  ]);
  req.postCount = postCount;
  req.followerCount = followerCount;
  req.followingCount = followingCount;

  next();
};

exports.mustBeLoggedIn = function (req, res, next) {
  if (req.session.user) {
    next();
  } else {
    req.flash("errors", "you must be logged in to perform that action");
    req.session.save(function () {
      res.redirect("/");
    });
  }
};

exports.login = function (req, res) {
  let user = new User(req.body);
  user
    .login()
    .then(function (result) {
      req.session.user = {
        avatar: user.avatar,
        username: user.data.username,
        _id: user.data._id,
      };
      req.session.save(function () {
        res.redirect("/");
      });
    })
    .catch(function (e) {
      req.flash("errors", e);
      req.session.save(function () {
        res.redirect("/");
      });
    });
};

exports.apiLogin = function (req, res) {
  let user = new User(req.body);
  user
    .login()
    .then(function (result) {
      res.json(
        jwt.sign({ _id: user.data._id }, process.env.JWTSECRET, {
          expiresIn: "7d",
        })
      );
    })
    .catch(function (e) {
      res.json("sorry, your values are not correct.");
    });
};

exports.logout = function (req, res) {
  req.session.destroy(function () {
    res.redirect("/");
  });
};

exports.register = function (req, res) {
  let user = new User(req.body);
  user
    .register()
    .then(() => {
      req.session.user = {
        username: user.data.username,
        avatar: user.avatar,
        _id: user.data._id,
      };
      req.session.save(function () {
        res.redirect("/");
      });
    })
    .catch((regErrors) => {
      regErrors.forEach(function (error) {
        req.flash("regErrors", error);
      });
      req.session.save(function () {
        res.redirect("/");
      });
    });
};

exports.home = async function (req, res) {
  if (req.session.user) {
    // fetch feed of posts for current user
    let posts = await Post.getFeed(req.session.user._id);
    res.render("home-dashboard", { posts: posts });
  } else {
    res.render("home-guest", {
      regErrors: req.flash("regErrors"),
    });
  }
};

exports.ifUserExists = function (req, res, next) {
  User.findByUsername(req.params.username) // return userDoc = {_id: userDoc.data._id username: userDoc.data.username, avatar: userDoc.avatar }  /
    .then(function (userDocument) {
      req.profileUser = userDocument; // 在 req 新增一個屬性將從資料庫取得的資料 userDocument 存進去，然後透過 next() 傳遞給下一個中介
      // TODO 一個問題是為什麼要特別新增在 req 上，而不是直接將 userDocument 直接傳過去？這又衍生一個問題，怎麼傳？
      next();
    })
    .catch(function () {
      res.render("404");
    });
};

exports.profilePostsScreen = function (req, res) {
  // ask our post model for posts by a certain author id
  Post.findByAuthorId(req.profileUser._id)
    .then(function (posts) {
      res.render("profile", {
        title: `Profile for ${req.profileUser.username}`,
        currentPage: "posts",
        posts: posts,
        profileUsername: req.profileUser.username,
        profileAvatar: req.profileUser.avatar,
        isFollowing: req.isFollowing,
        isVisitorsProfile: req.isVisitorsProfile,
        counts: {
          postCount: req.postCount,
          followerCount: req.followerCount,
          followingCount: req.followingCount,
        },
      });
    })
    .catch(function () {
      res.render("404");
    });
};

exports.profileFollowersScreen = async function (req, res) {
  try {
    let followers = await Follow.getFollowersById(req.profileUser._id);
    res.render("profile-followers", {
      currentPage: "followers",
      followers: followers,
      profileUsername: req.profileUser.username,
      profileAvatar: req.profileUser.avatar,
      isFollowing: req.isFollowing,
      isVisitorsProfile: req.isVisitorsProfile,
      counts: {
        postCount: req.postCount,
        followerCount: req.followerCount,
        followingCount: req.followingCount,
      },
    });
  } catch {
    res.render("404");
  }
};

exports.profileFollowingScreen = async function (req, res) {
  try {
    let following = await Follow.getFollowingById(req.profileUser._id);
    res.render("profile-following", {
      currentPage: "following",
      following: following,
      profileUsername: req.profileUser.username,
      profileAvatar: req.profileUser.avatar,
      isFollowing: req.isFollowing,
      isVisitorsProfile: req.isVisitorsProfile,
      counts: {
        postCount: req.postCount,
        followerCount: req.followerCount,
        followingCount: req.followingCount,
      },
    });
  } catch {
    res.render("404");
  }
};
