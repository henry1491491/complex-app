## req.body(在 userController 之 login 方法)

```js
{
  username: 'henryadmin1130',
  password: 'godoffullstack1130'
}
```

## attemptedUser(在 User 的 login 方法)

```js
{
  _id: 5e8aeb31c3907e8ca38b54f5,
  username: 'henryadmin1130',
  email: 'kawasakininja3021@gmail.com',
  password: '$2a$10$C1DWhdOSAnQmIoknDXIkgeslHguqAFYAW/bQnSa6ED7nbMVcK7hv2'
}
```

> 經過 findOne 方法之後 then() 回傳的的物件。透過資料庫取得的資料

## req.session

### 情況一：尚未登入

```js
Session {
  cookie: {
    path: '/',
    _expires: 2020-04-26T11:30:30.639Z,
    originalMaxAge: 86400000,
    httpOnly: true
  },
  flash: {}
}
```

### 情況二：已登入(req.session.user)

```js
Session {
  cookie: {
    path: '/',
    _expires: 2020-04-26T11:30:30.639Z,
    originalMaxAge: 86400000,
    httpOnly: true
  },
  flash: {},
  user: {
    avatar: 'https://gravatar.com/avatar/114ef23a5bc7e5d026f569365c4d37ee?s=128',
    username: 'henryadmin1130',
    _id: 5e8aeb31c3907e8ca38b54f5
  }
}
```

### 情況二：已登入(透過 req.session.destroy 方法)

```js
undefined;
```

## req.flash("errors", '哈哈哈')

```
1
```

> 回傳竟然是個數字？！

## regErrors(在 userController 之 register 方法之 catch() 丟出的陣列)

```js
[
  "You must provide a valid email address.",
  "You must provide a password.",
  "Username must be at least 3 characters.",
];
```

## posts( 在 Post 的 findSingleById 方法的 reusablePostQuery 方法)

```js
[
  {
    _id: 5e9001e72939515e0f705fcb,
    title: '1234',
    body: '12341234',
    createdDate: 2020-04-10T05:19:35.522Z,
    authorId: 5e8aeb31c3907e8ca38b54f5,
    author: {
      username: 'henryadmin1130',
      avatar: 'https://gravatar.com/avatar/114ef23a5bc7e5d026f569365c4d37ee?s=128'
    },
    isVisitorOwner: true
  }
]
```

# package.json 設定

```json
   "watch": "start nodemon db --ignore frontend-js --ignore public/ && start webpack --watch",
```
以上這行的 start 可省略、&& 可替換為 &，原因在於怕 window 作業系統不支援
原本後端只需要 nodemon db 這個 script，但因為加進了 webpack，因此加上 webpack --watch 指令
-- ignore 是編譯時希望忽略的檔案及檔案夾