var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var routes = require('./routes/index');
var users = require('./routes/users');
var io=require("socket.io");
var app = express();

var mysql=require("./db/mysql");
var query=mysql({host:"localhost",user:"root",password:"",database:"chat"});
/*query.get("usuario").select(["nickname","id"]).limit(2).where({id:"1"}).execute(function(rows){
    rows[0].all(rows[0].mensaje_table);
    rows[0].all(rows[0].sala_table,function(r){
        console.log(rows[0].sala);
    }); 
});
*/

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', routes);
app.use('/users', users);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});


module.exports = app;
var PORT=3000;
var server=app.listen(PORT,function(){
    console.log("Servidor corriendo en "+PORT);
})
//instanciamos los sockets junto con el servidor
var nicknames=[];
var sockets=io(server);
sockets.on("connection",function(socket){
    //el evento setnickname se ejecuta cuando el cliente a emitido sobre setnickname
    socket.on("mensajes",function(clientedata){
        if(clientedata.nick===socket.nickname)
        {
            console.log(clientedata)
            var comando=clientedata.msn.split(" ");
            if(comando[0]=="join")
            {
                var sala=comando[1];
                socket.emit("mensajes",{"nick":"SERVIDOR","msn":"Ahora estas en la sala "+sala});
                socket.leave(socket.salas);
                socket.salas=sala;
                socket.join(sala);
                return;
            }
            query.save("mensajes",{mensaje:clientedata.msn,idSa:socket.idSala,idUs:socket.idUs},function(r){
                console.log(r);
            });
            sockets.to(socket.salas).emit("mensajes",clientedata);
            return;    
        }
        sockets.sockets.emit("mensajes",false);
        
    });
    socket.on("get_users",function(clientdata){
        sockets.sockets.emit("get_users",{"lista":nicknames})
    });
    socket.on("setnickname",function(clientedata){
        if(verificarCuenta(clientedata.nick,socket)){
            nicknames.push(clientedata);
            //seteamos el nick en el mismo socket del cliente            
            crearSalaDb("seminario",socket,function(){
                socket.nickname=clientedata.nick;
                socket.salas="general";
                socket.join("general");
                socket.emit("setnickname",{"server":true});
            });            
            return;
        }
        socket.emit("setnickname",{"server":"El nick no esta disponible"});
        return;
    });
});
var crearSalaDb=function(nombre_sala,socket,callback)
{
    query.get("sala").where({nombre:nombre_sala}).execute(function(rows){
        if(rows==0)
        {
            query.save("sala",{nombre:nombre_sala,idUs:socket.idUs},function(r){
                socket.idSala=r.inserId;
                callback();
            });
        }else{
            socket.idSala=rows[0].id;
            callback();
        }
    });
}
var verificarCuenta=function(ins,socket)
{
    query.get("usuario").where({nickname:ins}).execute(function(rows){
        if(rows.length==0)
        {
            query.save("usuario",{nickname:ins},function(response){
                console.log(response);
                socket.idUs=response.insertId;
                //nicknames.push(rows[0].nickname)
            });
        }else{
            console.log(rows);
            socket.idUs=rows[0].id;
            nicknames.push(rows[0].nickname);
        }
    });
    return true; 
}
