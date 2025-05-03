var express = require('express');
var router = express.Router();
var userModel = require('./users');
var postModel = require('./posts');
var passport = require('passport');
var localStrategy = require('passport-local');
var flash = require('connect-flash');
var upload = require('./multer');
var commentModel = require('./comments');
var notificationModel = require('./notifications');

passport.use(new localStrategy(userModel.authenticate()));


/* GET home page. */
router.get('/', function (req, res, next) {
  res.render('index');
});

router.get('/login', function (req, res, next) {
  res.render('login', { error: req.flash('error') });
});

router.get('/feed', isLoggedIn, async function (req, res, next) {
  const posts = await postModel.find().populate('user');
  const user = await userModel.findById(req.user._id);
  res.render('feed', { posts, user });
});


router.post('/upload', isLoggedIn, upload.single('file'), async function (req, res, next) {
  if (!req.file) {
    return res.status(400).send('No files were uploaded.');
  }
  const user = await userModel.findOne({ username: req.session.passport.user });
  const postData = await postModel.create({
    postText: req.body.filecaption,
    image: req.file.path,
    user: user._id,
  })

  user.posts.push(postData._id);
  await user.save();

  for (const follower of user.followedBy) {
    await notificationModel.create({
      recipient: follower,
      message: `${user.fullname} (@${user.username}) uploaded a new post.`,
      link: `/user/${user._id}/profile`
    });
  }
  res.redirect('/profile');
});

router.post('/post/:id/like', isLoggedIn, async function (req, res, next) {
  try {
    const postId = req.params.id;
    const userId = req.user._id;

    const post = await postModel.findById(postId);

    if (post.likes.includes(userId)) {
      // If already liked, unlike
      post.likes.pull(userId);
    } else {
      // Otherwise, like the post
      post.likes.push(userId);
    }

    await post.save();
    if (!post.user.equals(req.user._id)) {
      await notificationModel.create({
        recipient: post.user,
        message: `${req.user.username} liked your post "${post.postText}"`,
        link: `/post/${post._id}/likes`
      });
    }
    const referer = req.get('Referer');
    res.redirect(referer || '/feed');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error liking post.');
  }
});

router.get('/user/:id/profile', isLoggedIn, async (req, res) => {
  const user = await userModel.findById(req.params.id).populate('posts');
  const currentUser = await userModel.findById(req.user._id);
  res.render('userProfile', { user, currentUser });
});

router.post('/post/:id/delete', isLoggedIn, async function (req, res, next) {
  try {
    const postId = req.params.id;
    const user = await userModel.findOne({ username: req.session.passport.user });

    // Find the post and ensure the logged-in user is the owner
    const post = await postModel.findOne({ _id: postId, user: user._id });

    if (!post) {
      return res.status(403).send('Unauthorized: You can only delete your own posts.');
    }

    // Delete the post
    await postModel.findByIdAndDelete(postId);

    // Remove the post from the user's posts array
    user.posts.pull(postId);
    await user.save();

    res.redirect('/profile'); // Redirect to profile after deletion
  } catch (err) {
    console.error(err);
    res.status(500).send('Error deleting post.');
  }
});

router.get('/search', isLoggedIn, async (req, res, next) => {
  try {
    const query = req.query.query.trim();
    const users = await userModel.find({
      $or: [
        { username: { $regex: query, $options: 'i' } },  // Case-insensitive search
        { fullname: { $regex: query, $options: 'i' } }
      ]
    });

    if (users.length === 0) {
      return res.render('searchResults', { users: [], message: 'No user exists.' });
    }

    res.render('searchResults', { users, message: null });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error searching for users.');
  }
});

router.get('/post/:id/comments', isLoggedIn, async (req, res) => {
  try {
    const post = await postModel.findById(req.params.id).populate('comments');
    const comments = await commentModel.find({ post: post._id }).populate('user');
    res.render('comments', { post, comments });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching comments.');
  }
});

router.post('/post/:id/comments', isLoggedIn, async (req, res) => {
  try {
    const post = await postModel.findById(req.params.id);
    const comment = await commentModel.create({
      text: req.body.commentText,
      user: req.user._id,
      post: post._id
    });

    post.comments.push(comment._id);
    await post.save();

    // Notification system: create a notification for the post owner
    if (!post.user.equals(req.user._id)) {
      await notificationModel.create({
        recipient: post.user,
        message: `Your post "${post.postText}" received a new comment.`,
        link: `/post/${post._id}/comments`
      });
    }

    res.redirect(`/post/${post._id}/comments`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error adding comment.');
  }
});

router.get('/notifications', isLoggedIn, async (req, res) => {
  try {
    const notifications = await notificationModel.find({ recipient: req.user._id }).sort({ createdAt: -1 });
    res.render('notifications', { notifications });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching notifications.');
  }
});

router.post('/notifications/:id/mark-read', isLoggedIn, async (req, res) => {
  try {
    const { id } = req.params;

    // Remove the notification from the database
    await notificationModel.findByIdAndDelete(id);

    res.status(200).send({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).send({ success: false, message: 'Error marking notification as read.' });
  }
});


router.get('/post/:id/likes', isLoggedIn, async function (req, res, next) {
  try {
    const post = await postModel.findById(req.params.id).populate('likes');
    res.render('likes', { post });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching likes.');
  }
});

// Follow/unfollow a user
router.post('/user/:id/follow', isLoggedIn, async (req, res) => {
  const userToFollow = await userModel.findById(req.params.id);
  const currentUser = await userModel.findById(req.user._id);

  if (currentUser.follows.includes(userToFollow._id)) {
    currentUser.follows.pull(userToFollow._id);
    userToFollow.followedBy.pull(currentUser._id);
  } else {
    currentUser.follows.push(userToFollow._id);
    userToFollow.followedBy.push(currentUser._id);
  }

  await currentUser.save();
  await userToFollow.save();
  if (!(userToFollow._id === currentUser._id) && userToFollow.followedBy.includes(currentUser._id)) {
    await notificationModel.create({
      recipient: userToFollow._id,
      message: `${currentUser.fullname} (@${currentUser.username}) followed you.`,
      link: `/user/${currentUser._id}/profile`
    });
  }
  res.redirect(`/user/${userToFollow._id}/profile`);
});

// List of users the logged-in user follows
router.get('/profile/following', isLoggedIn, async (req, res) => {
  const user = await userModel.findById(req.user._id).populate('follows');
  res.render('following', { user });
});

// List of users following the logged-in user
router.get('/profile/followers', isLoggedIn, async (req, res) => {
  const user = await userModel.findById(req.user._id).populate('followedBy');
  res.render('followers', { user });
});


router.get('/profile/:id/following', isLoggedIn, async (req, res) => {
  const user = await userModel.findById(req.params.id).populate('follows');
  res.render('following', { user });
});

// List of users following the logged-in user
router.get('/profile/:id/followers', isLoggedIn, async (req, res) => {
  const user = await userModel.findById(req.params.id).populate('followedBy');
  res.render('followers', { user });
});


router.get('/profile', isLoggedIn, async function (req, res, next) {
  const user = await userModel.findOne({
    username: req.session.passport.user
  }).populate('posts');
  const notifications = await notificationModel.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.render('profile', { user, notifications });
});

router.post('/profile/update-tagline', isLoggedIn, async function (req, res, next) {
  try {
    const { tagline } = req.body;
    const user = await userModel.findById(req.user._id);

    if (!user) {
      return res.status(404).send('User not found.');
    }

    user.tagline = tagline.trim(); // Update tagline
    await user.save();

    res.redirect('/profile');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error updating tagline.');
  }
});


router.post('/profile/upload-picture', isLoggedIn, upload.single('profilePicture'), async function (req, res, next) {
  try {
    const user = await userModel.findById(req.user._id);

    // Update the user's profile picture
    user.profilePicture = req.file.path;
    await user.save();

    res.redirect('/profile');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error uploading profile picture.');
  }
});


router.post('/register', async function (req, res, next) {
  const userData = await new userModel({
    username: req.body.username,
    email: req.body.email,
    fullname: req.body.fullname,
  })
  userModel.register(userData, req.body.password).then(function () {
    passport.authenticate('local')(req, res, function () {
      res.redirect('/profile');
    });
  });
});

router.post('/login', passport.authenticate('local', {
  successRedirect: '/profile',
  failureRedirect: '/',
  failiureFlash: true
}), function (req, res) { });

router.get('/logout', function (req, res) {
  req.logout(function (err) {
    if (err) { return next(err); }
    res.redirect('/');
  });
});

function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/');
}

module.exports = router;



