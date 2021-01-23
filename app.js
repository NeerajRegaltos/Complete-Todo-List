

const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const _ = require("lodash");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const { requireLogin } = require("./middleware");


const app = express();
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: false }));

app.use(express.static("public"));

app.use(session({
    secret: "<YourSessionKey>",
    resave: true,
    saveUninitialized: false,
}));

//Mongoose connected with mongoDB
mongoose.connect("<YourMongoDBURI>", { useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true });

//mongoose Schema
const itemsSchema = {
    name: String
};
//Mongoose Model
const Item = mongoose.model("Item", itemsSchema);

const item1 = new Item({
    name: "Welcome to your todolist!"
});

const item2 = new Item({
    name: "Hit the + button to add a new item."
});

const item3 = new Item({
    name: "<-- Hit this to delete an item."
});



const defaulItems = [item1, item2, item3];

const listSchema = {
    name: String,
    items: [itemsSchema]
};

const List = mongoose.model("List", listSchema);

const UserSchema = {
    email: {
        type: String,
        unique: true,
        trim: true,
        lowercase: true,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    items: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Item' }]
}

const User = mongoose.model("User", UserSchema);

app.get("/", (req, res) => {
    if (req.session && req.session.user) {
        res.redirect(`/${req.session.user._id}`)
    } else {
        res.redirect("/login");
    }

})

app.get("/login", (req, res) => {
    res.render("login");
});

app.post("/login", async (req, res) => {
    const email = req.body.email.trim();
    const password = req.body.password;

    if (email && password) {

        const user = await User.findOne({ email })
            .catch(error => {
                console.log(error);

                var errorMessage = "Something Went Wrong.";
                res.render("login", { errorMessage });
            });

        if (user !== null) {
            var result = await bcrypt.compare(password, user.password)
            if (result === true) {
                //correct password
                req.session.user = user
                return res.redirect(`/${req.session.user._id}`);
            }
        }
        var errorMessage = "Credentials incorrect.";
        res.render("login", { errorMessage });
    }
    var errorMessage = "Make sure each field has correct values.";
    return res.render("login", { errorMessage });
});




app.get("/register", (req, res) => {
    res.render("register");
});
app.post("/register", async (req, res) => {
    const email = req.body.email.trim();
    const password = req.body.password;
    const confPassword = req.body.confPassword;

    if (email && password && confPassword) {
        if (password !== confPassword) {
            var errorMessage = "Passwords Do not match";
            return res.status(200).render("register", { email, errorMessage, title: "Register" });
        }

        const user = await User.findOne({ email })
            .catch(error => {
                console.log(error);
                var errorMessage = "Something went Wrong";
                res.status(200).render("register", { email, errorMessage, title: "Register" });
            });

        if (user === null) {
            var data = req.body;

            data.password = await bcrypt.hash(password, 10);

            User.create(data)
                .then(user => {
                    req.session.user = user;
                    return res.redirect("/login");
                });
        }
        else {
            if (email === user.email) {
                var errorMessage = "Email already in use";
            }
            res.status(200).render("register", { errorMessage, title: "Register" });
        }

    }
    else {
        var errorMessage = "Make sure each field is filled";
        res.status(200).render("register", { email, errorMessage, title: "Register" });
    }


});

app.get("/logout", (req, res) => {
    req.session.destroy();
    res.redirect("/login");
})

app.get("/:customListName/", requireLogin, function (req, res) {
    const customListName = _.capitalize(req.session.user.
        _id);

    List.findOne({ name: customListName }, function (err, foundList) {
        if (!err) {
            if (!foundList) {
                //Create a new List
                const list = new List({
                    name: customListName,
                    items: defaulItems
                });
                list.save();
                res.redirect("/" + req.session.user._id);
            } else {
                //show an existing list

                res.render("list", { listTitle: foundList.name, newListItems: foundList.items })
            }
        }
    });

});




// app.get("/", requireLogin, function (req, res) {

//     Item.find({}, function (err, foundItems) {
//         if (err) {
//             console.log(err);
//         }
//         else {

//             if (foundItems.length === 0) {
//                 Item.insertMany(defaulItems, function (err) {
//                     if (err) {
//                         console.log(err);
//                     } else {
//                         console.log("Succesfully added");
//                     }
//                 });
//                 res.redirect("/");
//             } else {
//                 res.render("list", { listTitle: "Today", newListItems: foundItems });
//             }
//         }
//     });
// });

app.post("/", function (req, res) {

    const itemName = req.body.newItem;
    const listName = req.body.list;


    const item = new Item({
        name: itemName
    });

    if (listName === "Today") {
        item.save();
        res.redirect("/");
    } else {
        List.findOne({ name: listName }, function (err, foundList) {
            foundList.items.push(item);
            foundList.save();
            res.redirect("/" + listName);
        });
    }
});

app.post("/delete/", function (req, res) {
    const checkedItemID = req.body.checkbox;
    const listName = req.body.listName;
    if (listName === "Today") {
        Item.deleteOne({ _id: checkedItemID }, function (err) {
            if (err) {
                console.log(err);
            } else {
                console.log("Deleted Succesfully");
                res.redirect(`/${req.session.user._id}`);
            }
        });
    } else {
        List.findOneAndUpdate({ name: listName }, { $pull: { items: { _id: checkedItemID } } }, function (err, foundList) {
            if (!err) {
                res.redirect("/" + listName);
            }
        });
    }


});









app.get("/about/", function (req, res) {
    res.render("about");
});

app.get("/*", function (req, res) {
    res.send("<h1> Please Go Back This is not the Page you are looking for</h1>");
});







let port = process.env.PORT;
if (port == null || port == "") {
    port = 3000;
}

app.listen(port, function () {
    console.log("Server has started");
});



//Inserting Items HEre

// Item.insertMany(defaulItems,function(err){
//     if(err){
//         console.log(err);
//     }else{
//         console.log("Succesfully added");
//     }
// });



//Finding Itemms

// Item.find({}, function (err, foundItems) {
//     if (err) {
//         console.log(err);
//     }
//     else {
//         console.log("Found Items");
//         console.log(foundItems);
//     }
// });



//Deleting Duplicate Items from my Database::

// Item.deleteMany({_id:"5f994be05a77bf1aa03b76f9"},function(err){
//     if(err){
//         console.log(err);
//     }else{
//         console.log("Deleted Succesfully");
//     }
// });