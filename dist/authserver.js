"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const app = (0, express_1.default)();
app.use(express_1.default.json());
const users = [];
let refreshTokens = [];
// Create a new user with the given username and password
app.post("/users", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const passHash = yield bcrypt_1.default.hash(req.body.password, 10);
        const user = {
            name: req.body.name,
            password: passHash
        };
        users.push(user);
        res.status(201).send("New user added");
    }
    catch (_a) {
        res.status(500).send();
    }
}));
// Login the given user with the given username and password, if correct
app.post("/users/login", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = users.find(user => user.name === req.body.name);
    if (user == null) {
        // Username does not exist
        return res.status(400).send("Username or password is incorrect");
    }
    // Check if password hashes match
    try {
        if (yield bcrypt_1.default.compare(req.body.password, user.password)) {
            // Correct credentials. Send access & refresh token pair
            const authUser = { name: user.name };
            res.json(generateTokenPair(authUser));
        }
        else {
            // Incorrect credentials
            res.status(400).send("Username or password is incorrect");
        }
    }
    catch (_b) {
        res.status(500).send();
    }
}));
// Generates a new access & refresh token pair if the given refresh token is valid
app.post("/token", (req, res) => {
    const refreshToken = req.body.token;
    if (!refreshToken)
        return res.sendStatus(401);
    if (!refreshTokens.includes(refreshToken))
        return res.sendStatus(403);
    jsonwebtoken_1.default.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, user) => {
        if (err || user == undefined)
            return res.sendStatus(403);
        // Remove old refresh token
        deleteRefreshToken(refreshToken);
        // Generate new refresh & access pair and send
        res.json(generateTokenPair({ name: user.name }));
    });
});
// Logout user
app.delete("/users/logout", (req, res) => {
    const refreshToken = req.body.token;
    if (!refreshToken)
        return res.sendStatus(401);
    deleteRefreshToken(refreshToken);
    res.sendStatus(204);
});
app.listen(8001, () => {
    console.log("Listening on port 8001");
});
function generateAccessToken(authUser) {
    return jsonwebtoken_1.default.sign(authUser, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "15m" });
}
function generateRefreshToken(authUser) {
    const refreshToken = jsonwebtoken_1.default.sign(authUser, process.env.REFRESH_TOKEN_SECRET);
    refreshTokens.push(refreshToken);
    return refreshToken;
}
function generateTokenPair(authUser) {
    const accessToken = generateAccessToken(authUser);
    const refreshToken = generateRefreshToken(authUser);
    return { accessToken: accessToken, refreshToken: refreshToken };
}
function deleteRefreshToken(refreshToken) {
    refreshTokens = refreshTokens.filter(token => token !== refreshToken);
}
