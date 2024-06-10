require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const mysql2 = require('mysql2');
const app = express();
const port = 3000;
const fileUpload = require("express-fileupload");
const session = require("express-session");
const bcrypt = require("bcrypt");
const flash = require("connect-flash");
const MySQLStore = require("express-mysql-session")(session);

const DBCONFIG = {
  host: process.env.DB_HOST,
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: 8889
};

const sessionStore = new MySQLStore(DBCONFIG);

app.use(
  session({
      key: "session_cookie_name",
      secret: "session_cookie_secret",
      store: sessionStore,
      resave: false,
      saveUninitialized: false,
  })
);

sessionStore.onReady()
  .then(() => {
      // MySQL session store ready for use.
      console.log("MySQLStore ready (session store)");
  })
  .catch((error) => {
      // Something went wrong.
      console.error("MySQLStore error", error);
  });

app.use(flash());
app.use((req,res,next)=>{
  res.locals.messages = req.flash();
  next();
})
app.use(express.static('assets'));
app.use(fileUpload());
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const userRouter = require('./routes/users');

let connection = mysql2.createConnection(DBCONFIG);

connection.connect(error => {
  if (error) throw error;
  console.log("Successfully connected to the database.")
});

app.use('/route/users', userRouter);

// User login 
app.get("/partials/login",(req,res)=>{
  const messages = req.flash();
  res.render("partials/login", { messages});
});

app.post("/partials/login", async(req, res) => {
  const { user_name, user_password } = req.body;
  
  try { 
    connection.query(
      "SELECT user_id, user_password FROM users WHERE user_name = ?", [user_name],
        async(dbErr, dbResults) => {
          if (dbErr) {
              console.log("Database error:", dbErr);
              req.flash('error', 'Error logging in');
              return res.redirect('/');
          }
          if (dbResults.length === 0) {
              req.flash('error', 'Invalid username');
              return res.redirect('/');
          }
          const hashedPassword = dbResults[0].user_password;
          const user = dbResults[0];

          const passwordMatch = await bcrypt.compare(user_password, hashedPassword);
          if (!passwordMatch) {
              req.flash('error', 'Invalid password');
              return res.redirect('/');
          }

          req.session.user = { id: user.user_id, name: user_name };
          req.session.save(err => {
            if (err) {
                console.log('Session save error:', err);
                return res.status(500).send('Error saving session.');
            }
            req.flash('success', 'Login successful');
            res.redirect('/gallery'); 
        });
      }
      );
    } catch (error) {
      console.error("Error logging in:", error);
      req.flash('error', 'Error logging in');
      return res.redirect('/login');
    }
});

// User register
app.get('/register', (req, res) => {
  res.render('pages/register_page');
});

app.post("/register", async(req, res) => {
  const {user_name, user_bio, user_email, user_password} = req.body;

  const checkUserQuery = "SELECT user_id FROM users WHERE user_name = ?";
  try {
    const [existingUser] = await connection.promise().execute(checkUserQuery, [user_name]);
    if (existingUser.length>0) {
      req.flash("error","Username already exist, please choose a different one");
      return res.redirect('/register');
    }

  const hashedPassword = await bcrypt.hash(user_password, 10);
  const newUserQuery = "INSERT INTO users (user_name, user_bio, user_email, user_password) VALUES (?, ?, ?, ?)";
  connection.query(
      newUserQuery,
      [req.body.user_name,req.body.user_bio,req.body.user_email, hashedPassword],
      (dbErr, dbResults) => {
        if (dbErr) {
            req.flash('error','Error logging in');
            return res.redirect('/register');
          } else {
              console.log("User created successfully:", dbResults);
              req.flash('success','User created successfully, please login your new account')
              res.redirect('/');
            }
    });
  } catch (error) {
    console.log('Error hashing password:', error);
    req.flash('error','Error creating new user, please try again.')
    return res.redirect('/register');
  }});

// User upload images
app.use('/uploads', express.static(path.join(__dirname, 'assets/uploads')));

app.get("/partials/upload-image", (req,res) =>{
  return res.render("partials/upload-image",{
    user: req.session.user,
    messages: req.flash()
  });
})

app.post('/upload',async (req,res)=> {
  console.log("uploading image");

  if (!req.session || !req.session.user) {
    req.flash('error','You must be logged in to upload images.');
    console.log(req.flash('error'));
    return res.redirect("/gallery");
  }

  if (!req.files || !req.files.image) {
    req.flash('error','No file uploaded.');
    console.log(req.flash('error'));
    return res.redirect('/gallery');
}
  const user_id = req.session.user.id;
  const caption = req.body.caption;
  const uploadedFile = req.files.image;

  const validTypes = ['.jpg', '.jpeg', '.gif', '.png', '.bmp'];
    const fileType = path.extname(uploadedFile.name).toLowerCase();
    if (!validTypes.includes(fileType)) {
        req.flash('error','Invalid file type. Only JPG, GIF, PNG, BMP files are allowed.');
        console.log(req.flash('error'));
        return res.redirect('/gallery');
    }

    // Check file size (5MB)
    const maxSize = 5 * 1024 * 1024; 
    if (uploadedFile.size > maxSize) {
        req.flash('error', 'File size exceeds the limit of 5MB.');
        console.log(req.flash('error'));
        return res.redirect('/gallery');
    } 
  
  let currentTime = new Date();
  let newFileName = `${Date.now()}_${uploadedFile.name}`;
  const uploadPath = path.join(__dirname,'assets/uploads', newFileName);

  uploadedFile.mv(uploadPath, async(err) =>{
    if (err) {
      console.error("File upload error", err);
      return res.status(500).send(err);
    } 
    const query = `
      INSERT INTO images_upload (user_id, url, post_date, image_description) 
      VALUES (?, ?, NOW(), ?)
    `;

    console.log('Inserting into DB:', { user_id, newFileName, caption });

    try {
      console.log('Executing query:', query, [user_id, `/uploads/${newFileName}`, caption]);
      const [result] = await connection.promise().execute(query, [user_id, `/uploads/${newFileName}`, caption]);
      console.log('Image data inserted with ID:', result.insertId);
      req.flash('success', 'Image uploaded successfully!');
      console.log(req.flash('success'));
      res.redirect("/gallery");
  } catch (error) {
      console.error('Database insertion error:', error);
      req.flash('error', 'Your image upload failed, please try again.');
      console.log(req.flash('error'));
      res.redirect("/gallery");
  }
  });
})

// display images
function getImages(callback) {
  const query = "SELECT image_id,url FROM images_upload";

  connection.query(query,(err,results) =>{
    if (err) {
      console.error('Error fetching images:',err);
      return callback(err);
    }
    callback(null,results);
  });
}

app.get('/gallery', async (req, res) => {
  try {
    const query = `
      SELECT image_id, url, post_date 
      FROM images_upload 
      ORDER BY post_date DESC
    `;
    const [images] = await connection.promise().execute(query);

    const messages = req.flash();
    console.log(messages); 

    res.render('pages/gallery', { 
      user: req.session.user,
      images: images,
      messages: messages
    });
  } catch (error) {
    console.error('Failed to fetch images:', error);
    req.flash('error', 'An error occurred while retrieving the images.');
    res.redirect('/gallery');
  }
});


// view image detail
app.get('/image/:image_id', async (req, res) => {
  const imageId = req.params.image_id;

  try {
      const query = `
          SELECT i.url, i.post_date, u.user_name, i.image_description 
          FROM images_upload AS i
          JOIN users AS u ON i.user_id = u.user_id
          WHERE i.image_id = ?
      `;

      const [imageDetails] = await connection.promise().execute(query, [imageId]);

      if (imageDetails.length > 0) {
         const id = imageId;
          res.render('pages/image_details', {user: req.session.user, image: imageDetails[0], imageID: id });
      } else {
          req.flash('error', 'Image not found.');
          res.redirect('/gallery');
      }
  } catch (error) {
      console.error('Failed to get image details:', error);
      req.flash('error', 'An error occurred while retrieving the image details.');
      res.redirect('/gallery');
  }
});
  
// homepage
app.get('/', (req, res) => {
   
   const uploadsDir = path.join(__dirname, 'assets', 'uploads');
   fs.readdir(uploadsDir, (err, files) => {
    if (err) {
      console.error('Failed to read uploads directory:', err);
      res.sendStatus(500);
    } else {
      const images = files.filter(file => file.endsWith('.jpg') || file.endsWith('.png'));
      const randomImage = images[Math.floor(Math.random() * images.length)];
      
      res.render('index', { randomImage: randomImage,});
    }
  });
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

module.exports=app;