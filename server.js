// server.js
const dotenv =require('dotenv');
dotenv.config();
const bcrypt= require('bcryptjs')
const jwt= require('jsonwebtoken')
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.use(express.urlencoded({ extended: true }));

const userSchema = new mongoose.Schema({
    username: String,
    email: String,
    password: String,
    todoList: [
      {
        data: String,
        createdAt: { type: Date, default: Date.now },
        completed: { type: Boolean, default: false }
      }
    ]
});  


const User = mongoose.model('Users', userSchema);

const authMiddleware = (req, res, next) => {
    const token = req.body.token;
    
    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }
  
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded; // Attach the decoded token to the request object
      next(); // Proceed to the next middleware or route handler
    } catch (err) {
      res.status(401).json({ message: 'Token is not valid' });
    }
  };  

// Login Route
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    // Check if the user exists
    const user = await User.findOne({ email });
    if (!user) {
        return res.status(400).json({ message: 'Invalid email or password' });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        return res.status(400).json({ message: 'Invalid email or password' });
    }

    // Generate JWT
    const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET);

    // Send response
    res.json({ token });
});


// Signup Route
app.post('/signup', async (req, res) => {
    const { username, email, password } = req.body;

    // Check if the user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
        return res.status(400).json({ message: 'Username or email already in use' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new user
    const newUser = new User({
        username,
        email,
        password: hashedPassword,
        todoList: []
    });

    // Save the user to the database
    await newUser.save();

    // Generate JWT
    const token = jwt.sign({ _id: newUser._id }, process.env.JWT_SECRET);

    // Send response with the token
    res.status(201).json({ token });
});


// Get Todos Route
app.post('/gettodos', authMiddleware, async (req, res) => {
    const _id = req.user._id;

    try {
        // Find the user and get their todo list
        const user = await User.findById(_id);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Return the todo list
        res.status(200).json({ todos: user.todoList });
    } catch (error) {
        console.error(error);  // Log the error for debugging
        res.status(500).json({ error: 'Server error retrieving todos' });
    }
});



app.post('/addtodo', authMiddleware, async (req, res) => {
    const _id = req.user._id;
    const { data } = req.body;// Assuming the request body contains { description: "todo description" }

    console.log(_id, data);

    // Ensure description is provided
    if (!data) {
        return res.status(400).json({ error: 'Data is required' });
    }

    const newTodo = { data: data, completed: false, createdAt: new Date() };  // Add a createdAt field to the new todo
  
    try {
      const user = await User.findByIdAndUpdate(
        { "_id": _id},
        { $push: { todoList: newTodo } },  // Add the new todo to the todoList
        { returnNewDocument : true }  // Return the updated user document
      );

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Return the entire todoList or just the newly added todo
      const addedTodo = user.todoList[user.todoList.length - 1];
      res.status(200).json({ response: "new todo added successfully" });
    } catch (error) {
      console.error(error);  // Log the error for debugging
      res.status(500).json({ error: 'Server error adding new todo' });
    }
});


// Edit Todo Route
app.post('/edittododata', authMiddleware, async (req, res) => {
    const userid = req.user._id;
    const { _id, data } = req.body; // Data to update

    try {
        // Find the user and update the specific todo
        const user = await User.findOneAndUpdate(
            { _id: userid, 'todoList._id': _id },
            { 
                $set: { 
                    'todoList.$.data': data,
                } 
            },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({ error: 'User or Todo not found' });
        }

        // Return the updated todo
        const updatedTodo = user.todoList.id(_id);
        res.status(200).json({ response: 'Todo updated successfully', todo: updatedTodo });
    } catch (error) {
        console.error(error);  // Log the error for debugging
        res.status(500).json({ error: 'Server error updating todo' });
    }
});
// Edit Todo Route completed
app.post('/edittodocompleted', authMiddleware, async (req, res) => {
    const userid = req.user._id;
    const { _id, completed } = req.body; // Data to update

    try {
        // Find the user and update the specific todo
        const user = await User.findOneAndUpdate(
            { _id: userid, 'todoList._id': _id },
            { 
                $set: { 
                    'todoList.$.completed': completed 
                } 
            },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({ error: 'User or Todo not found' });
        }

        // Return the updated todo
        const updatedTodo = user.todoList.id(_id);
        res.status(200).json({ response: 'Todo updated successfully', todo: updatedTodo });
    } catch (error) {
        console.error(error);  // Log the error for debugging
        res.status(500).json({ error: 'Server error updating todo' });
    }
});


// Delete Todo Route
app.post('/deletetodo', authMiddleware, async (req, res) => {
    const userId = req.user._id;
    const { _id } = req.body; // ID of the todo to be deleted

    console.log(userId, _id);

    try {
        // Find the user and pull the specific todo from the array
        const user = await User.findOneAndUpdate(
            { _id: userId },
            { $pull: { todoList: { _id: _id } } },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({ error: 'User or Todo not found' });
        }

        // Return a success message
        res.status(200).json({ response: 'Todo deleted successfully' });
    } catch (error) {
        console.error(error);  // Log the error for debugging
        res.status(500).json({ error: 'Server error deleting todo' });
    }
});




mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        app.listen(process.env.PORT, () => {
            console.log(`Server is running on port ${process.env.PORT}`);
        });
    })
    .catch(err => console.error('Could not connect to MongoDB', err));