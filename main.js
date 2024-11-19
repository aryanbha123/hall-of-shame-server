const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const authenticateToken = require("./auth");
const fileUpload = require("express-fileupload");
const { nanoid } = require("nanoid");
const path = require("path");
const ObjectId = require("mongodb").ObjectId;

var app = express();
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(express.json());
app.use(fileUpload());
app.use(express.static("public"));
app.use("/uploads/posts", authenticateToken, express.static("uploads/posts"));

// const JWT_SECRET = process.env.JWT_SECRET;
// const MONGO_URL = process.env.MONGO_URL;

const JWT_SECRET = "ACHHE DIN AA GYE HAI";
// const MONGO_URL = process.env.MONGO_URL;

mongoose
  .connect(
    "mongodb+srv://vrputin180:dGfWUmeNrHAMaKgF@cluster0.0csu5.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
  )
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Connection error:", err));

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});

const postSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  poster: { type: String, required: true },
  imagename: { type: String, required: true, unique: true },
  likes: {
    type: [{ id: String }],
    default: [],
  },
  comments: {
    type: [
      {
        username: { type: String },
        comment: { type: String },
      },
    ],
    default: [],
  },
  date: { type: Date, default: Date.now },
});

const User = mongoose.model("users", userSchema);
const Post = mongoose.model("posts", postSchema);

app.get("/", (req,res) => {
  return res.send("Hello from the server");
});

app.post("/api/signup", async (req, res) => {
  try {
    const user = await User.create({
      username: req.body.username,
      email: req.body.email,
      password: req.body.password,
    });

    return res.json({ message: "Sign up successful" });
  } catch (error) {
    if (error.code == 11000) {
      return res.status(409).json({ message: "Account Already exists" });
    } else {
      console.log(error);
      return res.status(501).json({ message: "Failure" });
    }
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const id = String(req.body.username).trim();
    const query = { password: req.body.password };
    var isMail = true;

    if (id.includes("@")) {
      query.email = id;
    } else {
      query.username = id;
      isMail = false;
    }

    const user = await User.findOne(query);

    if (user != null) {
      const token = jwt.sign(
        { id: user._id, username: user.username },
        JWT_SECRET,
        { expiresIn: "1y" }
      );
      return res.status(200).json({ token });
    }
    return res.status(400).json({
      message: `Invalid ${id.includes("@") ? "email" : "username"} or password`,
    });
  } catch (error) {
    console.log(error);
    return res.status(400).json({ message: "Failure" });
  }
});

const posts = mongoose.connection.collection("posts");

app.get("/api/protected/getposts", authenticateToken, async (req, res) => {
  try {
    const data = await posts.find({}).toArray();
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ message: error });
  }
});

app.post("/api/protected/uploadpost", authenticateToken, async (req, res) => {
  try {
    const { image } = req.files || {}; // Ensure `req.files` exists
    const { title, content, poster } = req.body;

    if (!image) return res.status(400).json({ message: "No image uploaded" });
    if (!title || !content)
      return res
        .status(400)
        .json({ message: "Title and content are required" });

    const imgname = nanoid(16) + path.extname(image.name);

    const uploadPath = path.join(__dirname, "uploads", "posts", imgname);
    await image.mv(uploadPath);

    const post = await Post.create({
      title: title,
      content: content,
      imagename: imgname,
      poster: poster,
      likes: [],
      comments: [],
      date: new Date(),
    });

    return res.status(201).json({
      message: "Post uploaded successfully",
      postId: post.id,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "An error occurred while uploading the post",
      error: error.message,
    });
  }
});

app.put("/api/protected/addLike", authenticateToken, async (req, res) => {
  try {
    const postid = new ObjectId(req.body.postid);
    const userid = req.body.userid;

    const result = await posts.updateOne(
      { _id: postid },
      { $addToSet: { likes: userid } }
    );

    if (result.modifiedCount > 0) {
      return res.status(200).json({ message: "Like added successfully" });
    } else {
      return res.status(200).json({ message: "Like already exists" });
    }
  } catch (err) {
    console.log(err);
    return res.status(401).json({ message: "Failed to add like" });
  }
});

app.put("/api/protected/deleteLike", authenticateToken, async (req, res) => {
  try {
    const postid = new ObjectId(req.body.postid);
    const userid = req.body.userid;

    const result = await posts.updateOne(
      { _id: postid },
      { $pull: { likes: userid } }
    );

    if (result.modifiedCount > 0) {
      return res.status(200).json({ message: "Like removed successfully" });
    } else {
      return res.status(200).json({ message: "Like does not exist" });
    }
  } catch (err) {
    console.log(err);
    return res.status(401).json({ message: "Failed to remove like" });
  }
});

app.put("/api/protected/getlikes", authenticateToken, async (req, res) => {
  try {
    const postid = new ObjectId(req.body.postid);
    const post = await posts.findOne({ _id: postid });
    const count = post.likes.length;
    return res.status(200).json({ message: "success", likes: count });
  } catch (err) {
    console.log(err);
    res.status(401).json({ message: "failure" });
  }
});

app.post("/api/protected/addComment", authenticateToken, async (req, res) => {
  try {
    const postid = new ObjectId(req.body.postid);
    const username = req.body.username;
    const comment = req.body.comment;

    const result = await posts.findOneAndUpdate(
      { _id: postid },
      {
        $push: {
          comments: {
            username: username,
            comment: comment,
          },
        },
      },
      { returnDocument: "after" }
    );

    if (result) {
      return res.status(200).json({
        message: "Comment added successfully",
        comments: result.comments,
      });
    } else {
      return res.status(404).json({ message: "Post not found" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "An error occurred" });
  }
});

app.get("/api/protected/verifyuser", authenticateToken, async (req, res) => {
  return res.status(200).json({ message: "User verified" });
});

app.get('/' , (req,res) => {
  res.send("Hello World From Rajas Repo")
})

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
