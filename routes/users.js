var express = require('express');
var router = express.Router();

const mongoose = require('mongoose');
const plm = require('passport-local-mongoose'); 

mongoose.connect('mongodb://localhost:27017/SharePins', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});


const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  password: {
    type: String,
  },
  posts : [{
    type : mongoose.Schema.Types.ObjectId,
    ref : 'Post',
  }],
  profilePicture: {
    type: String,  // URL of the profile picture
    default: '',
  },
  fullname: {
    type: String,
    default: '',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  tagline: { 
    type: String, 
    default: '', 
  }, 
  follows: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', default: [] }],
  followedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', default: [] }]
});

userSchema.plugin(plm);

module.exports = mongoose.model('User', userSchema); 





