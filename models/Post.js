/**
 * ObjectID
 * ObjectID 方法參閱 https://mongodb.github.io/node-mongodb-native/api-bson-generated/objectid.html
 * 參閱 BSON，一種電腦資料交換格式，主要給 MongoDB 使用，二進制。Binary JSON
 * ObjectID.isValid() 方法主要用於檢查 id 是否符合 BSON 的 id
 * $lookup，也是有點頭疼。
 * 什麼情況用 prototype 什麼情況一般函式
 */
const postsCollection = require("../db").db().collection("posts");
const followsCollection = require("../db").db().collection("follows");
const ObjectID = require("mongodb").ObjectID; // Mongo 內建的一種生成 Id 方法
const User = require("./User");
const sanitizeHTML = require("sanitize-html");

// 思考為什麼要傳入這些資料？ data => 這沒有問題、userId => ?、requestedPostId => ?
let Post = function (data, userid, requestedPostId) {
  this.data = data;
  this.errors = [];
  this.userid = userid;
  this.requestedPostId = requestedPostId;
};

Post.prototype.cleanUp = function () {
  if (typeof this.data.title != "string") {
    this.data.title = "";
  }
  if (typeof this.data.body != "string") {
    this.data.body = "";
  }

  // get rid of any bogus properties
  this.data = {
    title: sanitizeHTML(this.data.title.trim(), {
      allowedTags: [],
      allowedAttributes: {},
    }),
    body: sanitizeHTML(this.data.body.trim(), {
      allowedTags: [],
      allowedAttributes: {},
    }),
    createdDate: new Date(),
    author: ObjectID(this.userid),
  };
};

Post.prototype.validate = function () {
  if (this.data.title == "") {
    this.errors.push("You must provide a title.");
  }
  if (this.data.body == "") {
    this.errors.push("You must provide post content.");
  }
};

Post.prototype.create = function () {
  return new Promise((resolve, reject) => {
    this.cleanUp();
    this.validate();
    if (!this.errors.length) {
      postsCollection
        .insertOne(this.data)
        .then((info) => {
          resolve(info.ops[0]._id); // TODO 好好瞭解一下用途？ ops
        })
        .catch(() => {
          this.errors.push("Please try again later.");
          reject(this.errors);
        });
    } else {
      reject(this.errors);
    }
  });
};

Post.prototype.update = function () {
  return new Promise(async (resolve, reject) => {
    try {
      let post = await Post.findSingleById(this.requestedPostId, this.userid);
      if (post.isVisitorOwner) {
        // actually update the db
        let status = await this.actuallyUpdate();
        resolve(status);
      } else {
        reject();
      }
    } catch {
      reject();
    }
  });
};

Post.prototype.actuallyUpdate = function () {
  return new Promise(async (resolve, reject) => {
    this.cleanUp();
    this.validate();
    if (!this.errors.length) {
      await postsCollection.findOneAndUpdate(
        { _id: new ObjectID(this.requestedPostId) },
        { $set: { title: this.data.title, body: this.data.body } }
      );
      resolve("success");
    } else {
      resolve("failure");
    }
  });
};

// uniqueOperations 是我們給 Mongo 下的搜尋條件，帶「$」字號是告訴 Mongo 這個字不是字串，是資料庫的某個屬性
Post.reusablePostQuery = function (uniqueOperations, visitorId) {
  return new Promise(async function (resolve, reject) {
    let aggOperations = uniqueOperations.concat([
      {
        $lookup: {
          // 去  foreignField 的 _id 欄位找符合 localField 的 author 欄位的項目，然後新增到舊的 database 為新的欄位
          from: "users",
          localField: "author",
          foreignField: "_id",
          as: "authorDocument",
        },
      },
      {
        $project: {
          // 篩選需要的資料構成新 database，1 表示保留、0 表示捨去，也可放條件判斷。_id 為默認
          title: 1,
          body: 1,
          createdDate: 1,
          authorId: "$author",
          author: { $arrayElemAt: ["$authorDocument", 0] },
        },
      },
    ]);
    let posts = await postsCollection.aggregate(aggOperations).toArray();

    // clean up author property in each post object (因為有密碼跟 id 我們不需要)

    posts = posts.map(function (post) {
      post.isVisitorOwner = post.authorId.equals(visitorId);
      delete post.authorId; // 這邊刪除是因為 search 不需要這個 id
      post.authorId = undefined;

      post.author = {
        username: post.author.username,
        avatar: new User(post.author, true).avatar,
      };
      return post;
    });
    resolve(posts);
  });
};

// 為什麼取 singlePost 資料需要判斷是一般 id 還是訪客 id

Post.findSingleById = function (id, visitorId) {
  return new Promise(async function (resolve, reject) {
    if (typeof id != "string" || !ObjectID.isValid(id)) {
      reject();
      return;
    }
    let posts = await Post.reusablePostQuery(
      [{ $match: { _id: new ObjectID(id) } }],
      visitorId
    );

    if (posts.length) {
      resolve(posts[0]);
    } else {
      reject();
    }
  });
};

Post.findByAuthorId = function (authorId) {
  return Post.reusablePostQuery([
    { $match: { author: authorId } },
    { $sort: { createdDate: -1 } }, // 1 為升冪、-1 為降冪 => 此處表示最新的 post 排最上面
  ]);
};

Post.delete = function (postIdToDelete, currentUserId) {
  return new Promise(async function (resolve, reject) {
    try {
      let post = await Post.findSingleById(postIdToDelete, currentUserId);
      if (post.isVisitorOwner) {
        await postsCollection.deleteOne({ _id: new ObjectID(postIdToDelete) });
        resolve();
      } else {
        reject();
      }
    } catch {
      reject();
    }
  });
};

// 這邊要去 Mongo 裡面對 post 的 database 做設定。在 indexes 的地方做設定
Post.search = function (searchTerm) {
  return new Promise(async (resolve, reject) => {
    if (typeof searchTerm == "string") {
      let posts = await Post.reusablePostQuery([
        {
          $match: { $text: { $search: searchTerm } },
        },
        {
          $sort: { score: { $meta: "textScore" } },
        },
      ]);
      resolve(posts);
    } else {
    }
  });
};

Post.countPostsByAuthor = function (id) {
  return new Promise(async (resolve, reject) => {
    let postCount = await postsCollection.countDocuments({ author: id });
    resolve(postCount);
  });
};

Post.getFeed = async function (id) {
  // create an array of the user ids that the currrent user follows
  let followedUser = await followsCollection
    .find({ authorId: new ObjectID(id) })
    .toArray();
  followedUser = followedUser.map(function (followDoc) {
    return followDoc.followedId;
  });
  // look for posts where the author is in the above array of followed users
  return Post.reusablePostQuery([
    {$match:{author: {$in: followedUser}}},
    {$sort:{createdDate: -1}}
  ])
};

module.exports = Post;
