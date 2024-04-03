const express = require("express");
const router = express.Router();

router.get("/register",(req,res) => {
  
})

router.get("/login",(req,res) => {
  
})


router
  .route('/:id')
  .get((req,res)=>{
    res.send('')
  })
  .put((req,res)=> {
    res.send('')
  })
  .delete((req,res) => {
    res.send('')
  })

router.param('id',(req,res,next,id)=>{

  //...///

  next();
})

module.exports = router;