var express = require("express");
var app = express();
var bodyParser= require("body-parser");
var mongoose= require("mongoose");
var flash = require("connect-flash");
var methodOverride= require("method-override");
var passport = require("passport");
var LocalStrategy = require("passport-local");
var Blog= require("./models/Blog");
var Comment = require("./models/comments");
var User = require("./models/user");

mongoose.connect("mongodb://localhost:27017/bloggery" ,{useNewUrlParser: true , useUnifiedTopology: true, useFindAndModify: false});
app.use(express.static("public"));
app.use(bodyParser.urlencoded({extended:true}));
app.use(methodOverride("_method"));
app.use(flash());
app.set("view engine", "ejs");

//PASSPORT CONFIGURATION
app.use(require("express-session")({
    secret: "MY BLOG PAGE",
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use( function(req, res, next){
    res.locals.currentUser = req.user;
    res.locals.error= req.flash("error")
    res.locals.success= req.flash("success")
    next();
});
//********************
//BLOG ROUTES
//********************

//INDEX PAGE
app.get("/", function(req, res){
    res.redirect("/blogs");
})
app.get("/blogs", function(req, res){
    Blog.find({}, function(err,blogs){
        if(err){
            console.log("error");
        }else{
            res.render("index", {blogs:blogs});
        }
    });
});
//NEW POST
app.get("/blogs/new",isLoggedIn,function(req,res){
    res.render("new")
});
app.post("/blogs",isLoggedIn,function(req,res){
    
    Blog.create(req.body.blog, function(err, newBlog){
        if(err){
            res.render("new");
        }else{
            newBlog.author.id = req.user._id;
            newBlog.author.username = req.user.username;
            newBlog.save();
            res.redirect("/blogs");
        };
    });
});
//SHOW PAGE
app.get("/blogs/:id",function(req,res){
    Blog.findById(req.params.id).populate("comments").exec(function(err, foundBlog){
        if(err){
            res.redirect("/blogs");
        }else{ 
            res.render("show", { blog: foundBlog});
        };
    });
});
//EDIT FORM
app.get("/blogs/:id/edit",checkBlogOwnership,function(req,res){
    Blog.findById(req.params.id, function(err, foundBlog){
            res.render("edit", {blog: foundBlog});
        });
    });
//UPDATED PAGE
app.put("/blogs/:id",checkBlogOwnership,function(req,res){
    Blog.findByIdAndUpdate(req.params.id, req.body.blog,function(err, updatedBlog){
        if(err){
            res.redirect("/blogs");
        }else{
            res.redirect("/blogs/" + req.params.id);
        };
    });
});
//DELETE BLOG
app.delete("/blogs/:id",checkBlogOwnership,function(req,res){
    Blog.findByIdAndRemove(req.params.id,function(err){
        if(err){
            res.redirect("/blogs/"+ req.params.id);
        }else {
            res.redirect("/blogs");
        };
    });
});
//===============================
//COMMENTS ROUTES
//===============================

app.get("/blogs/:id/comments/new",isLoggedIn ,function(req, res){
    Blog.findById(req.params.id, function(err, blog){
        if(err){
            console.log(err);
        }else{
            res.render("newcomment", {blog:blog})
        }
    });
});
app.post("/blogs/:id/comments",isLoggedIn , function(req, res){
    Blog.findById(req.params.id, function(err, blog){
        if(err){
            console.log(err);
        }else {
            Comment.create(req.body.comment, function(err,comment){
                if(err){
                    req.flash("error", "Something went wrong :(")
                    console.log(err);
                }else{
                    comment.author.id = req.user._id;
                    comment.author.username = req.user.username;
                    comment.save();
                    blog.comments.push(comment);
                    blog.save();
                    req.flash("success", "Successfully added comment")
                    res.redirect("/blogs/"+ blog._id);
                };
            });
        };
    });
});
//edit comment
app.get("/blogs/:id/comments/:comment_id/edit",checkCommentOwnership,function(req, res){
    Comment.findById(req.params.comment_id, function(err, foundComment){
        if(err){
            res.redirect("back");
        }else{
            res.render("editcomment",{ blog_id: req.params.id, comment: foundComment})
        }
    });
});
//update comment
app.put("/blogs/:id/comments/:comment_id",checkCommentOwnership,function(req, res){
    Comment.findByIdAndUpdate(req.params.comment_id,req.body.comment,function(err, updatedComment){
        if(err){
            res.redirect("back");
        }else{
            res.redirect("/blogs/" + req.params.id)
        }
    });
});

//delete comment
app.delete("/blogs/:id/comments/:comment_id",checkCommentOwnership,function(req,res){
    Comment.findByIdAndRemove(req.params.comment_id,function(err){
        if(err){
            res.redirect("back");
        }else {
            req.flash("success", "Comment Deleted");
            res.redirect("/blogs/"+ req.params.id);
        };
    });
});
//===========
//AUTH ROUTES
//===========

//show register form
app.get("/register", function(req, res){
    res.render("register");
})
//handle register form
app.post("/register", function(req,res){
    var newUser = new User({username: req.body.username})
    User.register(newUser, req.body.password, function(err, user){
        if(err){
            req.flash("error", err.message);
            return res.render("register");
        }
            passport.authenticate("local")(req, res , function(){
            req.flash("success", "Welcome to Bloggery "  + " " + user.username)
                res.redirect("/blogs");
            });
        });
    });

//show login form
app.get("/login",function(req,res){
    res.render("login")
})
//handle login route
app.post("/login",passport.authenticate("local",
    {
        successRedirect: "/blogs",
        failureRedirect:"/login",
        failureFlash: true,
        successFlash: "Welcome to Bloggery"
    }), function(req,res){
    });

//logout route
app.get("/logout", function(req, res){
    req.logout();
    req.flash("success", "Logged Out !!")
    res.redirect("/blogs");
})

function isLoggedIn(req , res, next){
    if(req.isAuthenticated()){
        return next();
    }
    req.flash("error", "You need to be logged in to do that")
    res.redirect("/login");
}

function checkBlogOwnership(req, res, next){
    if(req.isAuthenticated()){
        Blog.findById(req.params.id , function(err, foundBlog){
            if(err){
                req.flash("error", "Blog not found");
                res.redirect("back");
            }else{
                if(foundBlog.author.id.equals(req.user._id)){
                    next();
                }else {
                    req.flash("error", "You don't have permission to do that")
                    res.redirect("back");
                }
            }
        });
    }else{
        req.flash("error", "You need to be logged in to do that");
        res.redirect("back");
    }
}
function checkCommentOwnership(req, res, next){
    if(req.isAuthenticated()){
        Comment.findById(req.params.comment_id , function(err, foundComment){
            if(err){
                req.flash("error", "Comment not found");
                res.redirect("back");
            }else{
                if(foundComment.author.id.equals(req.user._id)){
                    next();
                }else {
                    req.flash("error", "You don't have permission to do that");
                    res.redirect("back");
                }
            }
        });
    }else{
        req.flash("error", "You need to be logged in to do that");
        res.redirect("back");
    }
}

app.listen(8000);