/**
 * Controller 的共通性：(1) 拿資料 => 渲染
 * 拿資料過程：透過 Post Modal 層將處理過的資料回傳
 * 渲染：回傳的資料丟進 render 函數
 * router 有怎樣的 url，基本上 Controller 就要定義對應的 methods
 */
const Post = require("../models/Post");

exports.viewCreateScreen = function (req, res) {
  res.render("create-post");
};

// 注意在這之前已經先在 User 方法驗證過，透過 next() 跳過來這個中間層
exports.create = function (req, res) {
  let post = new Post(req.body, req.session.user._id); // 這個時候可以拿到 user._id 是因為登入狀態，可以參考 note.md 筆記的三種 session 狀態
  post
    .create()
    .then(function (newId) {
      req.flash("success", "New post successfully created.");
      req.session.save(() => res.redirect(`/post/${newId}`));
    })
    .catch(function (errors) {
      errors.forEach((error) => req.flash("errors", error));
      req.session.save(() => res.redirect("/create-post"));
    });
};

exports.apiCreate = function (req, res) {
  let post = new Post(req.body, req.apiUser._id); // 這個時候可以拿到 user._id 是因為登入狀態，可以參考 note.md 筆記的三種 session 狀態
  post
    .create()
    .then(function (newId) {
      res.json("Congrats.")
    })
    .catch(function (errors) {
      res.json(errors)
    });
};

exports.viewSingle = async function (req, res) {
  try {
    let post = await Post.findSingleById(req.params.id, req.visitorId);
    res.render("single-post-screen", { post: post ,title: post.title});
  } catch (error) {
    res.render("404");
  }
};

exports.viewEditScreen = async function (req, res) {
  try {
    let post = await Post.findSingleById(req.params.id, req.visitorId);
    if (post.isVisitorOwner) {
      res.render("edit-post", { post: post });
    } else {
      req.flash("errors", "You do not have permission to perform that action.");
      req.session.save(() => res.redirect("/"));
    }
  } catch {
    res.render("404");
  }
};

exports.edit = function (req, res) {
  let post = new Post(req.body, req.visitorId, req.params.id);
  post
    .update()
    .then((status) => {
      // the post was successfully updated in the database
      // or user did have permission, but there were validation errors
      if (status == "success") {
        console.log(status);

        // post was updated in db
        req.flash("success", "Post successfully updated.");
        req.session.save(function () {
          res.redirect(`/post/${req.params.id}/edit`);
        });
      } else {
        post.errors.forEach(function (error) {
          req.flash("errors", error);
        });
        req.session.save(function () {
          res.redirect(`/post/${req.params.id}/edit`);
        });
      }
    })
    .catch(() => {
      // a post with the requested id doesn't exist
      // or if the current visitor is not the owner of the requested post
      req.flash("errors", "You do not have permission to perform that action.");
      req.session.save(function () {
        // TODO req.session 方法是用來儲存的，將 store 裡的內容替換成記憶體的內容，這個方法通常是預設調用，所以不需要特別去呼叫。除非幾種情況：redirect, long-lived requests 或是 WebSoket
        res.redirect("/");
      });
    });
};

exports.delete = function (req, res) {
  Post.delete(req.params.id, req.visitorId)
    .then(() => {
      req.flash("success", "Post successfully deleted.");
      req.session.save(() =>
        res.redirect(`/profile/${req.session.user.username}`)
      );
    })
    .catch(() => {
      req.flash("errors", "You do not have permission to perform that action.");
      req.session.save(() => res.redirect("/"));
    });
};

exports.apiDelete = function (req, res) {
  Post.delete(req.params.id, req.apiUser._id)
    .then(() => {
     res.json("Success")
    })
    .catch(() => {
      res.json("You do not have permission to perform that action.")
    });
};

exports.search = function (req, res) {
  Post.search(req.body.searchTerm)
    .then((posts) => {
      res.json(posts);
    })
    .catch(() => {
      res.json([]);
    });
};
