const mongoose = require('mongoose');
/* const plm = require('passport-local-mongoose'); 

mongoose.connect('mongodb://localhost:27017/SharePins', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}); */


const postSchema = new mongoose.Schema({
  postText: {
    type: String,
    required: true,
  },
  image : {
    type: String, 
  },
  user : {
    type : mongoose.Schema.Types.ObjectId,
    ref : 'User',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  comments: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Comment' 
  }],
  likes : [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  ]
}, { 
  timestamps: true, 
  default: [] // Set default to an empty array 
});

/* postSchema.plugin(plm); */

module.exports = mongoose.model('Post', postSchema);