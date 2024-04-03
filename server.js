require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const mysql2 = require('mysql2');
const app = express();
const port = 3000;
const fileUpload = require("express-fileupload");
const session = require("express-session");
const bcrypt = require("bcrypt");
const flash = require("connect-flash");

app.use(flash());

app.use(session({
  secret: '111111', 
  resave: true,
  saveUninitialized: false
}));

app.use(fileUpload());

app.use(express.static(path.join(__dirname, 'public')));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const userRouter = require('./routes/users');

const DBCONFIG = {
  host: process.env.DB_HOST,
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: 8889
};

let connection = mysql2.createConnection(DBCONFIG);

connection.connect(error => {
  if (error) throw error;
  console.log("Successfully connected to the database.")
});

app.use('/route/users', userRouter);

// User login 
app.get("/partials/login",(req,res)=>{
  res.render("partials/login");
});

app.post("/partials/login", (req, res) => {
  const { user_name, user_password } = req.body;

  const query = "SELECT user_name, user_password FROM users WHERE user_name =?";

  connection.query(
    query, [user_name],
    // "SELECT user_name, user_password FROM users WHERE user_name =?",
    // [req.body.user_name,req.body.user_password],
    
    async(dbErr, dbResult) => {
      console.log(dbErr,dbResult);

      if (dbErr){
        return res.status(500).send("Database error occurred");
      }
      
      if (dbResult.length > 0) {
        const hashedPassword = dbResult[0].user_password;
        const passwordMatch = await bcrypt.compare(user_password, hashedPassword);

        if (passwordMatch) {
          return res.redirect("pages/gallery");
        } else {
          res.send("Incorrect user name or password, please try again.")
        }
      }
    }
  )
});

// User register
app.get("/partials/register",(req,res)=>{
  res.render("partials/register");
});

app.post("/register", async(req, res) => {
  const {user_name, user_bio, user_email, user_password} = req.body;

  const newUserQuery = "INSERT INTO users (user_name, user_bio, user_email, user_password) VALUES (?, ?, ?, ?)";

  try {
    const hashedPassword = await bcrypt.hash(user_password, 10);
    connection.query(
      newUserQuery,
      [req.body.user_name,req.body.user_bio,req.body.user_email, hashedPassword],
      (dbErr, dbResults) => {
        if (dbErr) {
            console.log("Database error:", dbErr);
            res.status(500).send("Error creating user");
          } else {
              console.log("User created successfully:", dbResults);
              res.redirect('partials/login');
            }
    });
  } catch (error) {
    console.log('Error hashing password:', error);
    return res.status(500).send("Error creating user");
  }
});

// User upload images

app.use('/uploads', express.static('assets/uploads'));

app.get("/partials/upload-image", (req,res) =>{
  return res.render("partials/upload-image");
})

app.post('/upload',(req,res)=>{
  console.log("uploading image");

  if (!req.session || !req.session.userId) {
    return res.status(401).send('You must be logged in to upload images.');
  }

  const caption = req.body.caption;
  const uploadedFile = req.files.image;
  
  let currentTime = new Date();
  let newFileName = currentTime.getTime + uploadedFile.name;
  const uploadPath = path.join(__dirname,'assets/uploads', newFileName);
  const user_id = 1;
  uploadedFile.mv(uploadPath,async(err)=>{
    if (err) {
      return res.status(500).send(err);
    } 
    const query = `
      INSERT INTO images_upload (user_id, url, post_date, image_description) 
      VALUES (?, ?, ?, ?)
    `;
    // const user_id = req.session.userId;

    try {
      const result = await db.execute(query, [user_id, newFileName, new Date(), caption]);
      console.log('Image data inserted with ID:', result[0].insertId);
      res.send(`<img src="/uploads/${newFileName}" alt="Uploaded Image">`);
    } catch (error) {
      console.error('Failed to insert image data:', error);
      res.status(500).send('Failed to save image data.');
    }

  });
})
  
// Define a simple route to test connection w ejs template
app.get('/', (req, res) => {
    res.render('index');
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

module.exports=app;