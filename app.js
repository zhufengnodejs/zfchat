var express = require('express')
var async = require('async');
var app = express();
var port = process.env.PORT || 3000;

app.use(express.static(__dirname + '/static'));
var Controllers = require('./controllers')

var cookieParser = require('cookie-parser');
var signedCookieParser = cookieParser('zfchat')
var bodyParser = require('body-parser');
var session = require('express-session');
var MongoStore = require('connect-mongo')(session);
var settings = require('./settings');
app.use(cookieParser());
app.use(bodyParser.json({extended:true}));
var sessionStore = new MongoStore({
    db:settings.db,
    host:settings.host,
    port:settings.port
});
app.use(session({
    resave:true,
    saveUninitialized:true,
    secret:'zfchat',
    store:sessionStore
}));// req.session
app.get('/api/validate', function (req, res) {
    _userId = req.session._userId
    if (_userId) {
        Controllers.User.findUserById(_userId, function (err, user) {
            if (err) {
                res.status(401).json({msg: err});
            } else {
                res.json(user)
            }
        })
    } else {
        res.status(401).json(null);
    }
})
app.post('/api/login', function(req, res) {
    var email = req.body.email;
    if (email) {
        Controllers.User.findByEmailOrCreate(email, function(err, user) {
            if (err) {
                res.json(500, {
                    msg: err
                })
            } else {
                req.session._userId = user._id
                Controllers.User.online(user._id, function (err, user) {
                    if (err) {
                        res.json(500, {
                            msg: err
                        })
                    } else {
                        res.json(user)
                    }
                })
            }
        })
    } else {
        res.josn(403)
    }
})

app.get('/api/logout', function(req, res) {
    var _userId = req.session._userId
    Controllers.User.offline(_userId, function (err, user) {
        if (err) {
            res.json(500, {
                msg: err
            })
        } else {
            res.json(200)
            delete req.session._userId
        }
    })
})
app.use(function (req, res) {
    res.sendFile(__dirname+'/static/index.html');
})


var io = require('socket.io').listen(app.listen(port));
io.set('authorization', function(request, next) {
    signedCookieParser(request,{},function(err){//解密cookie
        sessionStore.get(request.signedCookies['connect.sid'],function(err,session){//从session中获取会话信息
            if (err) {
                next(err.message, false)
            } else {
                if (session && session._userId) {
                    request.session = session;
                    next(null, true)
                } else {
                    next('No login')
                }
            }
        });
    });
});

var SYSTEM = {
    name: '江湖',
    avatarUrl: 'https://secure.gravatar.com/avatar/50d11d6a57cfd40e0878c8ac307f3e01?s=48'
}

io.sockets.on('connection', function(socket) {
    var _userId = socket.request.session._userId
    Controllers.User.online(_userId, function(err, user) {
        if (err) {
            socket.emit('err', {
                mesg: err
            })
        } else {
            socket.broadcast.emit('users.add', user)
            socket.broadcast.emit('messages.add', {
                content: user.name + '进入了聊天室',
                creator: SYSTEM,
                createAt: new Date()
            })
        }
    })
    socket.on('disconnect', function() {
        Controllers.User.offline(_userId, function(err, user) {
            if (err) {
                socket.emit('err', {
                    mesg: err
                })
            } else {
                socket.broadcast.emit('users.remove', user)
                socket.broadcast.emit('messages.add', {
                    content: user.name + '离开了聊天室',
                    creator: SYSTEM,
                    createAt: new Date()
                })
            }
        })
    });

    socket.on('getRoom', function() {
        async.parallel([
                function(done) {
                    Controllers.User.getOnlineUsers(done)
                },
                function(done) {
                    Controllers.Message.read(done)
                }
            ],
            function(err, results) {
                if (err) {
                    socket.emit('err', {
                        msg: err
                    })
                } else {
                    socket.emit('roomData', {
                        users: results[0],
                        messages: results[1]
                    })
                }
            });
    })
    socket.on('messages.create', function(message) {
        Controllers.Message.create(message,function (err, message) {
            console.log(message);
            if (err) {
                socket.emit('err', {msg: err})
            } else {
                io.sockets.emit('messages.add', message)
            }
        })
    })
})
console.log('TechNode is on port ' + port + '!')